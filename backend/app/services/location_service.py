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

logger = logging.getLogger(__name__)

async def process_single_observation(
    db: AsyncIOMotorDatabase,
    user: Dict[str, Any],
    profile: Dict[str, Any],
    obs: LocationObservationCreate,
    sync_status: str = "REALTIME"
) -> LocationObservationResult:
    """Validate and process a location observation through the geofence engine."""
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    
    # 1. Get Active Geofence Config
    hq_config = await get_active_geofence_config(db)
    hq_lat = hq_config["latitude"]
    hq_lon = hq_config["longitude"]
    radius = hq_config["radius_meters"]
    accuracy_thresh = hq_config["accuracy_threshold_meters"]
    stale_thresh = hq_config["stale_threshold_seconds"]
    hysteresis = hq_config["hysteresis_meters"]

    # 2. Calculate Distance
    distance = calculate_haversine_distance_meters(
        obs.latitude, obs.longitude,
        hq_lat, hq_lon
    )

    # 3. Retrieve Officer's Last Known State
    last_obs = await db.location_observations.find_one(
        {"user_id": user_id},
        sort=[("observed_at", -1)]
    )
    current_state = "UNKNOWN"
    if last_obs:
        current_state = last_obs.get("current_state", "UNKNOWN")

    # 4. Evaluate Geofence State Machine
    new_state, is_transition, transition_type = evaluate_geofence_state(
        distance_meters=distance,
        accuracy_meters=obs.accuracy_meters,
        current_state=current_state,
        radius_meters=radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )

    is_inside = (new_state == "INSIDE")

    # 5. Handle Entry/Exit Transition in Attendance Ledger
    if is_transition and transition_type in ["ENTRY", "EXIT"]:
        await process_geofence_transition(
            db=db,
            user_id=user_id,
            officer_profile=profile,
            hq_config=hq_config,
            transition_type=transition_type,
            observation_time=obs.observed_at,
            accuracy_meters=obs.accuracy_meters,
            location_coords=[obs.longitude, obs.latitude],
            sync_status=sync_status
        )

    # 6. Save Location Observation
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
            "observed_at": obs.observed_at.isoformat(),
            "is_stale": False
        }
    })

    return LocationObservationResult(
        status="SUCCESS",
        current_state=new_state,
        distance_from_hq_meters=round(distance, 2),
        is_inside=is_inside,
        message=f"Location processed. Current HQ state: {new_state}"
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

async def get_all_live_locations(db: AsyncIOMotorDatabase) -> List[OfficerLiveLocation]:
    """Retrieve current locations, geofence states, and freshness for all active officers."""
    hq_config = await get_active_geofence_config(db)
    stale_thresh = hq_config["stale_threshold_seconds"]
    now = datetime.now(timezone.utc)

    # Find all active officer profiles
    cursor = db.officer_profiles.find({"profile_status": "ACTIVE"})
    profiles = await cursor.to_list(length=500)

    results = []
    for p in profiles:
        user_id = p["user_id"]
        
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
                observed_at=None,
                is_stale=True,
                seconds_since_update=None,
                today_visit_count=stats["visit_count"],
                today_duration_seconds=stats["total_seconds"]
            ))
            continue

        coords = last_obs.get("location", {}).get("coordinates", [None, None])
        obs_time = last_obs.get("observed_at")
        if obs_time and obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        seconds_ago = int((now - obs_time).total_seconds()) if obs_time else 999999
        is_stale = (seconds_ago > stale_thresh)
        current_state = "LOCATION_STALE" if is_stale else last_obs.get("current_state", "UNKNOWN")

        results.append(OfficerLiveLocation(
            user_id=user_id,
            officer_id=p["officer_id"],
            full_name=p["full_name"],
            rank=p["rank"],
            department=p["department"],
            latitude=coords[1] if coords else None,
            longitude=coords[0] if coords else None,
            accuracy_meters=last_obs.get("accuracy_meters"),
            current_state=current_state,
            distance_from_hq_meters=last_obs.get("distance_from_hq_meters"),
            observed_at=obs_time,
            is_stale=is_stale,
            seconds_since_update=seconds_ago,
            today_visit_count=stats["visit_count"],
            today_duration_seconds=stats["total_seconds"]
        ))

    return results
