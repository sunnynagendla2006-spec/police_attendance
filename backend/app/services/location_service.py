import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.location import (
    LocationObservationCreate,
    LocationSyncBatch,
    LocationObservationResult,
    OfficerLiveLocation
)
from app.services.geofence_engine import (
    calculate_haversine_distance_meters,
    get_active_geofence_config,
    evaluate_geofence_state
)
from app.services.attendance_service import (
    process_geofence_transition,
    get_officer_today_stats
)
from app.services.websocket_manager import ws_manager

from app.services.assignment_service import get_active_assignment_for_constable

logger = logging.getLogger(__name__)

async def process_single_observation(
    db: AsyncIOMotorDatabase,
    user: Dict[str, Any],
    profile: Dict[str, Any],
    obs: LocationObservationCreate,
    sync_status: str = "REALTIME"
) -> LocationObservationResult:
    """Validate and process a location observation through the geofence engine against officer's assigned duty post."""
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    
    # 1. Retrieve Officer's Active Duty Assignment & Target Facility
    asgn = await get_active_assignment_for_constable(db, user_id, obs.observed_at)
    target_facility = None
    if asgn and asgn.get("location_id"):
        loc_id_str = str(asgn["location_id"])
        loc_oid = ObjectId(loc_id_str) if ObjectId.is_valid(loc_id_str) else None
        target_facility = await db.headquarters.find_one({"_id": loc_oid}) if loc_oid else None
        if not target_facility:
            target_facility = await db.headquarters.find_one({"_id": loc_id_str})

    # Default to primary headquarters if no active assignment or facility not found
    hq_config = await get_active_geofence_config(db)
    if target_facility:
        target_coords = target_facility.get("location", {}).get(
            "coordinates", [target_facility.get("longitude", hq_config["longitude"]), target_facility.get("latitude", hq_config["latitude"])]
        )
        target_lat = target_coords[1] if len(target_coords) > 1 else target_facility.get("latitude", hq_config["latitude"])
        target_lon = target_coords[0] if len(target_coords) > 0 else target_facility.get("longitude", hq_config["longitude"])
        target_radius = float(target_facility.get("radius_meters", asgn.get("geofence_radius_meters", hq_config["radius_meters"])))
        target_loc_id = str(target_facility["_id"])
        target_loc_name = target_facility.get("name", asgn.get("location_name", "Duty Post"))
        target_loc_code = target_facility.get("code", asgn.get("location_code", "AP-LOC"))
    else:
        target_lat = hq_config["latitude"]
        target_lon = hq_config["longitude"]
        target_radius = hq_config["radius_meters"]
        target_loc_id = hq_config.get("headquarters_id", "default")
        target_loc_name = hq_config.get("name", "Headquarters")
        target_loc_code = "AP-HQ"

    accuracy_thresh = hq_config.get("accuracy_threshold_meters", 35.0)
    stale_thresh = hq_config.get("stale_threshold_seconds", 300)
    hysteresis = hq_config.get("hysteresis_meters", 5.0)

    # 2. Calculate Distance to Assigned Duty Location
    distance = calculate_haversine_distance_meters(
        obs.latitude, obs.longitude,
        target_lat, target_lon
    )

    # 3. Retrieve Officer's Last Known State
    last_obs = await db.location_observations.find_one(
        {"user_id": user_id},
        sort=[("observed_at", -1)]
    )
    current_state = "UNKNOWN"
    if last_obs:
        current_state = last_obs.get("current_state", "UNKNOWN")

    # 4. Evaluate Geofence State Machine against assigned location radius
    new_state, is_transition, transition_type = evaluate_geofence_state(
        distance_meters=distance,
        accuracy_meters=obs.accuracy_meters,
        current_state=current_state,
        radius_meters=target_radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )

    is_inside = (new_state == "INSIDE")

    # 5. Handle Entry/Exit Transition in Attendance Ledger for this facility
    if is_transition and transition_type in ["ENTRY", "EXIT"]:
        facility_ctx = {
            **hq_config,
            "headquarters_id": target_loc_id,
            "name": target_loc_name,
            "radius_meters": target_radius
        }
        await process_geofence_transition(
            db=db,
            user_id=user_id,
            officer_profile=profile,
            hq_config=facility_ctx,
            transition_type=transition_type,
            observation_time=obs.observed_at,
            accuracy_meters=obs.accuracy_meters,
            location_coords=[obs.longitude, obs.latitude],
            sync_status=sync_status
        )

    # 6. Save Location Observation with Assigned Location Linkage
    obs_doc = {
        "user_id": user_id,
        "officer_id": profile.get("officer_id", "UNKNOWN"),
        "device_id": obs.device_identifier or "primary",
        "location": {
            "type": "Point",
            "coordinates": [obs.longitude, obs.latitude]
        },
        "accuracy_meters": obs.accuracy_meters,
        "speed": obs.speed,
        "bearing": obs.bearing,
        "distance_from_hq_meters": round(distance, 2),
        "distance_from_assigned_location_meters": round(distance, 2),
        "assigned_location_id": target_loc_id,
        "assigned_location_name": target_loc_name,
        "assigned_location_code": target_loc_code,
        "assigned_geofence_radius": target_radius,
        "geofence_status": new_state,
        "is_inside_geofence": is_inside,
        "current_state": new_state,
        "observed_at": obs.observed_at,
        "received_at": now,
        "processing_status": "PROCESSED" if obs.accuracy_meters <= accuracy_thresh else "UNCERTAIN_ACCURACY",
        "sync_status": sync_status,
        "client_batch_id": obs.client_batch_id
    }
    await db.location_observations.insert_one(obs_doc)

    # 7. Broadcast Live Officer Location to Admin Consoles
    await ws_manager.broadcast({
        "type": "OFFICER_LOCATION_UPDATED",
        "data": {
            "user_id": user_id,
            "officer_id": profile.get("officer_id", "UNKNOWN"),
            "full_name": profile.get("full_name", "Officer"),
            "rank": profile.get("rank", "Constable"),
            "latitude": obs.latitude,
            "longitude": obs.longitude,
            "accuracy_meters": obs.accuracy_meters,
            "current_state": new_state,
            "distance_from_hq_meters": round(distance, 1),
            "distance_from_assigned_location_meters": round(distance, 1),
            "assigned_location_id": target_loc_id,
            "assigned_location_name": target_loc_name,
            "assigned_location_code": target_loc_code,
            "assigned_geofence_radius": target_radius,
            "geofence_status": new_state,
            "observed_at": obs.observed_at.isoformat(),
            "is_stale": False
        }
    })

    return LocationObservationResult(
        status="SUCCESS",
        current_state=new_state,
        distance_from_hq_meters=round(distance, 2),
        is_inside=is_inside,
        message=f"Location processed for {target_loc_name}. Current state: {new_state}"
    )

async def sync_offline_batch(
    db: AsyncIOMotorDatabase,
    user: Dict[str, Any],
    profile: Dict[str, Any],
    batch: LocationSyncBatch
) -> Dict[str, Any]:
    """Process a batch of offline recorded observations in chronological order."""
    now = datetime.now(timezone.utc)
    user_id = str(user["_id"])

    # Check if batch was already processed
    existing_batch = await db.synchronization_records.find_one({
        "user_id": user_id,
        "batch_id": batch.batch_id
    })
    if existing_batch:
        return {
            "batch_id": batch.batch_id,
            "status": "ALREADY_PROCESSED",
            "items_processed": 0
        }

    # Sort observations chronologically
    sorted_obs = sorted(batch.observations, key=lambda x: x.observed_at)
    processed_count = 0

    for obs in sorted_obs:
        try:
            await process_single_observation(
                db=db,
                user=user,
                profile=profile,
                obs=obs,
                sync_status="OFFLINE_SYNC"
            )
            processed_count += 1
        except Exception as e:
            logger.error(f"Error processing offline observation: {e}")

    # Record sync batch summary
    sync_doc = {
        "user_id": user_id,
        "device_id": batch.device_identifier,
        "batch_id": batch.batch_id,
        "received_at": now,
        "processed_at": now,
        "items_count": len(batch.observations),
        "items_processed": processed_count,
        "sync_status": "SUCCESS" if processed_count == len(batch.observations) else "PARTIAL",
        "error_summary": None
    }
    await db.synchronization_records.insert_one(sync_doc)

    return {
        "batch_id": batch.batch_id,
        "status": "SUCCESS",
        "items_processed": processed_count
    }

async def get_all_live_locations(
    db: AsyncIOMotorDatabase,
    location_id: Optional[str] = None,
    permitted_location_ids: Optional[List[str]] = None
) -> List[OfficerLiveLocation]:
    """Retrieve current locations, geofence states against assigned facilities, and freshness for all active officers."""
    hq_config = await get_active_geofence_config(db)
    stale_thresh = hq_config["stale_threshold_seconds"]
    now = datetime.now(timezone.utc)

    # 1. Load all registered headquarters facilities for quick lookup
    all_facilities = await db.headquarters.find({}).to_list(length=300)
    facility_map: Dict[str, Dict[str, Any]] = {str(f["_id"]): f for f in all_facilities}
    primary_facility = next((f for f in all_facilities if f.get("is_primary") and f.get("status") == "ACTIVE"), None)
    if not primary_facility:
        primary_facility = next((f for f in all_facilities if f.get("is_primary")), None)
    if not primary_facility and all_facilities:
        primary_facility = all_facilities[0]

    # 2. Load all active duty assignments
    asgn_cursor = db.location_assignments.find({"status": "ACTIVE"})
    active_assignments = await asgn_cursor.to_list(length=1000)
    asgn_by_user = {str(a.get("user_id", "")): a for a in active_assignments}
    asgn_by_officer = {str(a.get("officer_id", "")): a for a in active_assignments}

    # 3. Find all active officer profiles
    cursor = db.officer_profiles.find({"profile_status": "ACTIVE"})
    profiles = await cursor.to_list(length=500)

    results = []
    for p in profiles:
        user_id = str(p["user_id"])
        officer_id = str(p["officer_id"])

        # Determine constable's assigned facility
        asgn = asgn_by_user.get(user_id) or asgn_by_officer.get(officer_id)
        assigned_facility = None
        assigned_loc_id: Optional[str] = None
        assigned_loc_name: Optional[str] = None
        assigned_loc_code: Optional[str] = None
        assigned_radius: float = float(hq_config.get("radius_meters", 100.0))

        if asgn and asgn.get("location_id"):
            asgn_loc_str = str(asgn["location_id"])
            assigned_facility = facility_map.get(asgn_loc_str)
            assigned_loc_id = asgn_loc_str
            assigned_loc_name = asgn.get("location_name") or (assigned_facility.get("name") if assigned_facility else "Duty Post")
            assigned_loc_code = asgn.get("location_code") or (assigned_facility.get("code") if assigned_facility else "AP-LOC")
            if assigned_facility:
                assigned_radius = float(assigned_facility.get("radius_meters", asgn.get("geofence_radius_meters", 100.0)))
            else:
                assigned_radius = float(asgn.get("geofence_radius_meters", 100.0))
        elif primary_facility:
            assigned_facility = primary_facility
            assigned_loc_id = str(primary_facility["_id"])
            assigned_loc_name = primary_facility.get("name", "Headquarters")
            assigned_loc_code = primary_facility.get("code", "AP-HQ")
            assigned_radius = float(primary_facility.get("radius_meters", 100.0))

        # Scope enforcement by location_id or permitted_location_ids
        if location_id and assigned_loc_id != location_id:
            continue
        if permitted_location_ids is not None and assigned_loc_id not in permitted_location_ids:
            continue

        # Target facility coordinates
        if assigned_facility:
            coords = assigned_facility.get("location", {}).get("coordinates", [])
            target_lat = coords[1] if len(coords) > 1 else assigned_facility.get("latitude", hq_config["latitude"])
            target_lon = coords[0] if len(coords) > 0 else assigned_facility.get("longitude", hq_config["longitude"])
        else:
            target_lat = hq_config["latitude"]
            target_lon = hq_config["longitude"]

        # Latest observation
        last_obs = await db.location_observations.find_one(
            {"user_id": user_id},
            sort=[("observed_at", -1)]
        )

        # Get today stats
        stats = await get_officer_today_stats(db, user_id)

        if not last_obs:
            results.append(OfficerLiveLocation(
                user_id=user_id,
                officer_id=p["officer_id"],
                full_name=p["full_name"],
                rank=p["rank"],
                department=p["department"],
                latitude=None,
                longitude=None,
                accuracy_meters=None,
                current_state="UNKNOWN",
                distance_from_hq_meters=None,
                assigned_location_id=assigned_loc_id,
                assigned_location_name=assigned_loc_name,
                assigned_location_code=assigned_loc_code,
                assigned_geofence_radius=assigned_radius,
                distance_from_assigned_location_meters=None,
                geofence_status="NO_DATA",
                observed_at=None,
                is_stale=True,
                seconds_since_update=None,
                today_visit_count=stats["visit_count"],
                today_duration_seconds=stats["total_seconds"]
            ))
            continue

        obs_coords = last_obs.get("location", {}).get("coordinates", [None, None])
        obs_lat = obs_coords[1] if obs_coords else None
        obs_lon = obs_coords[0] if obs_coords else None

        obs_time = last_obs.get("observed_at")
        if obs_time and obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        seconds_ago = int((now - obs_time).total_seconds()) if obs_time else 999999
        is_stale = (seconds_ago > stale_thresh)

        # Distance to assigned duty facility
        dist_assigned: Optional[float] = None
        if obs_lat is not None and obs_lon is not None and target_lat is not None and target_lon is not None:
            dist_assigned = round(calculate_haversine_distance_meters(obs_lat, obs_lon, target_lat, target_lon), 1)

        # Compute authoritative geofence status:
        # CRITICAL: Missing or stale GPS data must NOT be treated as proof of being outside!
        if is_stale:
            geofence_status = "STALE"
            current_state = "LOCATION_STALE"
        elif dist_assigned is not None:
            if dist_assigned <= assigned_radius:
                geofence_status = "INSIDE"
                current_state = "INSIDE"
            else:
                geofence_status = "OUTSIDE"
                current_state = "OUTSIDE"
        else:
            geofence_status = "UNCERTAIN"
            current_state = last_obs.get("current_state", "UNKNOWN")

        results.append(OfficerLiveLocation(
            user_id=user_id,
            officer_id=p["officer_id"],
            full_name=p["full_name"],
            rank=p["rank"],
            department=p["department"],
            latitude=obs_lat,
            longitude=obs_lon,
            accuracy_meters=last_obs.get("accuracy_meters"),
            current_state=current_state,
            distance_from_hq_meters=dist_assigned,
            assigned_location_id=assigned_loc_id,
            assigned_location_name=assigned_loc_name,
            assigned_location_code=assigned_loc_code,
            assigned_geofence_radius=assigned_radius,
            distance_from_assigned_location_meters=dist_assigned,
            geofence_status=geofence_status,
            observed_at=obs_time,
            is_stale=is_stale,
            seconds_since_update=seconds_ago,
            today_visit_count=stats["visit_count"],
            today_duration_seconds=stats["total_seconds"]
        ))

    return results
