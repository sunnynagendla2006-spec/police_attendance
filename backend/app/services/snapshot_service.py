import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.location_schedule import (
    ScheduledLocationSnapshotSubmit,
    ScheduledLocationSnapshotResponse,
    OutsideGeofenceObservation,
    LocationScheduleConfig,
    LocationScheduleConfigUpdate
)
from app.services.auth_service import get_permitted_location_ids, verify_location_access
from app.services.assignment_service import get_active_assignment_for_constable
from app.services.audit_service import record_audit_log
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in meters between two coordinates."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

async def get_or_create_schedule_config(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """Retrieve the authoritative location and report scheduling configuration."""
    cfg = await db.location_schedule_configs.find_one({"is_active": True})
    if not cfg:
        now = datetime.now(timezone.utc)
        cfg = {
            "timezone": "Asia/Kolkata",
            "morning_snapshot_time": "10:00",
            "morning_report_time": "10:30",
            "evening_report_time": "17:00",
            "evening_snapshot_time": "18:00",
            "grace_period_minutes": 15,
            "stale_threshold_seconds": 300,
            "is_active": True,
            "updated_at": now,
            "updated_by": "SYSTEM"
        }
        res = await db.location_schedule_configs.insert_one(cfg)
        cfg["_id"] = res.inserted_id
    return cfg

async def update_schedule_config(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    req: LocationScheduleConfigUpdate
) -> LocationScheduleConfig:
    """Super Admin: Update the organization-wide scheduled snapshot and reporting times."""
    current = await get_or_create_schedule_config(db)
    now = datetime.now(timezone.utc)

    updates: Dict[str, Any] = {"updated_at": now, "updated_by": admin_user["username"]}
    if req.morning_snapshot_time:
        updates["morning_snapshot_time"] = req.morning_snapshot_time
    if req.evening_snapshot_time:
        updates["evening_snapshot_time"] = req.evening_snapshot_time
    if req.morning_report_time:
        updates["morning_report_time"] = req.morning_report_time
    if req.evening_report_time:
        updates["evening_report_time"] = req.evening_report_time
    if req.grace_period_minutes:
        updates["grace_period_minutes"] = req.grace_period_minutes

    await db.location_schedule_configs.update_one({"_id": current["_id"]}, {"$set": updates})

    # Record Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="REPORTING_SCHEDULE_UPDATED",
        target_type="configuration",
        target_id=str(current["_id"]),
        reason=req.change_reason,
        metadata=updates
    )

    updated = await db.location_schedule_configs.find_one({"_id": current["_id"]})
    return LocationScheduleConfig(
        timezone=updated.get("timezone", "Asia/Kolkata"),
        morning_snapshot_time=updated.get("morning_snapshot_time", "10:00"),
        evening_snapshot_time=updated.get("evening_snapshot_time", "18:00"),
        morning_report_time=updated.get("morning_report_time", "10:30"),
        evening_report_time=updated.get("evening_report_time", "17:00"),
        grace_period_minutes=int(updated.get("grace_period_minutes", 15)),
        stale_threshold_seconds=int(updated.get("stale_threshold_seconds", 300)),
        updated_at=updated.get("updated_at", now),
        updated_by=updated.get("updated_by", "SYSTEM")
    )

async def record_scheduled_snapshot(
    db: AsyncIOMotorDatabase,
    officer_user: Dict[str, Any],
    req: ScheduledLocationSnapshotSubmit
) -> ScheduledLocationSnapshotResponse:
    """
    Record an authorized scheduled location snapshot submitted by a constable's device.
    Calculates geofence distance against the constable's applicable duty assignment.
    """
    user_id_str = str(officer_user["_id"])
    now = datetime.now(timezone.utc)

    # 1. Lookup officer profile
    profile = await db.officer_profiles.find_one({"user_id": user_id_str})
    if not profile:
        profile = await db.officer_profiles.find_one({
            "$or": [
                {"officer_id": officer_user.get("username")},
                {"mobile_number": officer_user.get("username")}
            ]
        })
    officer_id = profile.get("officer_id", officer_user.get("username", "CONSTABLE")) if profile else officer_user.get("username", "CONSTABLE")

    # 2. Lookup active assignment for this constable at the observation time
    obs_time = req.observed_at
    if obs_time.tzinfo is None:
        obs_time = obs_time.replace(tzinfo=timezone.utc)

    assignment = await get_active_assignment_for_constable(db, user_id_str, obs_time)

    # 3. Resolve target location
    if assignment:
        loc_id = str(assignment["location_id"])
        loc_name = assignment.get("location_name", "Duty Location")
        loc_radius = float(assignment.get("geofence_radius_meters", 100.0))
        # Fetch actual coordinates of this location
        loc_doc = await db.headquarters.find_one({"_id": ObjectId(loc_id) if ObjectId.is_valid(loc_id) else loc_id})
        if loc_doc:
            coords = loc_doc.get("location", {}).get("coordinates", [81.0952, 16.7107])
            hq_lng, hq_lat = coords[0], coords[1]
        else:
            hq_lng, hq_lat = 81.0952, 16.7107
    else:
        # Fallback to primary headquarters
        primary = await db.headquarters.find_one({"is_primary": True})
        if not primary:
            primary = await db.headquarters.find_one()
        loc_id = str(primary["_id"]) if primary else "default"
        loc_name = primary.get("name", "Eluru District Headquarters") if primary else "Headquarters"
        coords = primary.get("location", {}).get("coordinates", [81.0952, 16.7107]) if primary else [81.0952, 16.7107]
        hq_lng, hq_lat = coords[0], coords[1]
        loc_radius = float(primary.get("radius_meters", 100.0)) if primary else 100.0

    # 4. Calculate Distance and Status
    dist = haversine_distance(req.latitude, req.longitude, hq_lat, hq_lng)
    accuracy = req.accuracy_meters or 20.0

    if accuracy > 85.0:
        calculated_status = "UNCERTAIN_ACCURACY"
    elif dist <= loc_radius:
        calculated_status = "INSIDE"
    elif dist <= (loc_radius + 20.0):
        calculated_status = "NEAR_BOUNDARY"
    else:
        calculated_status = "OUTSIDE"

    # 5. Determine on-time vs delayed
    cfg = await get_or_create_schedule_config(db)
    grace_mins = int(cfg.get("grace_period_minutes", 15))

    # Parse slot time
    is_on_time = True
    delay_mins = 0
    ref_time = req.scheduled_time
    if ref_time is not None:
        if ref_time.tzinfo is None:
            ref_time = ref_time.replace(tzinfo=timezone.utc)
        diff_sec = abs((obs_time - ref_time).total_seconds())
    else:
        diff_sec = abs((now - obs_time).total_seconds())

    if diff_sec > (grace_mins * 60):
        is_on_time = False
        delay_mins = int(diff_sec / 60)

    map_url = f"https://www.openstreetmap.org/?mlat={req.latitude}&mlon={req.longitude}#map=17/{req.latitude}/{req.longitude}"

    slot = req.scheduled_slot or req.snapshot_window or "MORNING_1000"
    excess_dist = max(0.0, round(dist - loc_radius, 1))

    doc = {
        "user_id": user_id_str,
        "officer_id": officer_id,
        "full_name": profile.get("full_name", officer_user.get("username")) if profile else officer_user.get("username"),
        "rank": profile.get("rank", "Constable") if profile else "Constable",
        "department": profile.get("department", "Police") if profile else "Police",
        "location_id": loc_id,
        "location_name": loc_name,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "accuracy_meters": round(accuracy, 1),
        "distance_meters": round(dist, 1),
        "geofence_radius_meters": loc_radius,
        "excess_distance_meters": excess_dist,
        "status": calculated_status,
        "geofence_status": calculated_status,
        "scheduled_slot": slot,
        "snapshot_window": slot,
        "scheduled_time": ref_time or now,
        "observed_at": obs_time,
        "received_at": now,
        "is_on_time": is_on_time,
        "delay_minutes": delay_mins if not is_on_time else 0,
        "device_id": req.device_id,
        "map_preview_url": map_url,
        "created_at": now
    }

    res = await db.location_snapshots.insert_one(doc)
    doc["_id"] = res.inserted_id

    # 6. If outside or uncertain, also record in outside_geofence_observations for dedicated auditing
    if calculated_status in ("OUTSIDE", "UNCERTAIN_ACCURACY", "NEAR_BOUNDARY"):
        await db.outside_geofence_observations.insert_one({
            "snapshot_id": str(res.inserted_id),
            "user_id": user_id_str,
            "officer_id": officer_id,
            "full_name": doc["full_name"],
            "rank": doc["rank"],
            "department": doc["department"],
            "assigned_location_id": loc_id,
            "assigned_location_name": loc_name,
            "duty_location_id": loc_id,
            "duty_location_name": loc_name,
            "scheduled_slot": slot,
            "snapshot_window": slot,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "distance_meters": round(dist, 1),
            "geofence_radius_meters": loc_radius,
            "excess_distance_meters": excess_dist,
            "accuracy_meters": round(accuracy, 1),
            "status": calculated_status,
            "observed_at": obs_time,
            "received_at": now,
            "is_delayed": not is_on_time,
            "map_url": map_url,
            "created_at": now
        })

    # 7. Broadcast real-time event
    response = ScheduledLocationSnapshotResponse(
        id=str(doc["_id"]),
        officer_id=officer_id,
        user_id=user_id_str,
        full_name=doc["full_name"],
        rank=doc["rank"],
        department=doc["department"],
        location_id=loc_id,
        location_name=loc_name,
        latitude=req.latitude,
        longitude=req.longitude,
        accuracy_meters=doc["accuracy_meters"],
        distance_meters=doc["distance_meters"],
        geofence_radius_meters=loc_radius,
        status=calculated_status,
        geofence_status=calculated_status,
        timeliness_status="ON_TIME" if is_on_time else "DELAYED",
        scheduled_slot=slot,
        snapshot_window=slot,
        scheduled_time=doc["scheduled_time"],
        observed_at=obs_time,
        received_at=now,
        is_on_time=is_on_time,
        delay_minutes=delay_mins if not is_on_time else 0,
        map_preview_url=map_url
    )

    await ws_manager.broadcast({
        "type": "SCHEDULED_SNAPSHOT_RECEIVED",
        "data": response.model_dump(mode="json")
    })

    return response

async def list_scheduled_snapshots(
    db: AsyncIOMotorDatabase,
    current_user: Dict[str, Any],
    location_id: Optional[str] = None,
    slot: Optional[str] = None,
    date_str: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None
) -> List[ScheduledLocationSnapshotResponse]:
    """Retrieve scheduled snapshots filtered by role, permitted locations, date, and status."""
    permitted_locs = await get_permitted_location_ids(current_user, db)

    query: Dict[str, Any] = {}

    if permitted_locs is not None:
        if location_id:
            if location_id not in permitted_locs:
                raise HTTPException(status_code=403, detail="Access denied to requested location.")
            query["location_id"] = location_id
        else:
            query["location_id"] = {"$in": permitted_locs}
    elif location_id:
        query["location_id"] = location_id

    if slot and slot != "ALL":
        query["scheduled_slot"] = slot

    if status_filter and status_filter != "ALL":
        query["status"] = status_filter

    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
            end = start + timedelta(days=1)
            query["observed_at"] = {"$gte": start, "$lt": end}
        except ValueError:
            pass

    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"full_name": {"$regex": s, "$options": "i"}},
            {"officer_id": {"$regex": s, "$options": "i"}},
            {"location_name": {"$regex": s, "$options": "i"}}
        ]

    cursor = db.location_snapshots.find(query).sort([("observed_at", -1)]).limit(300)
    docs = await cursor.to_list(300)

    results = []
    for d in docs:
        results.append(ScheduledLocationSnapshotResponse(
            id=str(d["_id"]),
            officer_id=d.get("officer_id", "UNKNOWN"),
            user_id=d.get("user_id", ""),
            full_name=d.get("full_name", "Officer"),
            rank=d.get("rank", "Constable"),
            department=d.get("department", "Police"),
            location_id=d.get("location_id", ""),
            location_name=d.get("location_name", "Location"),
            latitude=d.get("latitude"),
            longitude=d.get("longitude"),
            accuracy_meters=d.get("accuracy_meters"),
            distance_meters=d.get("distance_meters"),
            geofence_radius_meters=d.get("geofence_radius_meters", 100.0),
            status=d.get("status", "UNKNOWN"),
            scheduled_slot=d.get("scheduled_slot", "SCHEDULED"),
            scheduled_time=d.get("scheduled_time", d.get("created_at", datetime.now(timezone.utc))),
            observed_at=d.get("observed_at"),
            received_at=d.get("received_at"),
            is_on_time=d.get("is_on_time", True),
            delay_minutes=d.get("delay_minutes", 0),
            map_preview_url=d.get("map_preview_url")
        ))
    return results

async def list_outside_geofence_observations(
    db: AsyncIOMotorDatabase,
    current_user: Dict[str, Any],
    location_id: Optional[str] = None,
    officer_id: Optional[str] = None,
    date_str: Optional[str] = None,
    search: Optional[str] = None
) -> List[OutsideGeofenceObservation]:
    """Retrieve observations where constables were detected outside their assigned duty geofence."""
    permitted_locs = await get_permitted_location_ids(current_user, db)

    query: Dict[str, Any] = {}

    if permitted_locs is not None:
        if location_id:
            if location_id not in permitted_locs:
                raise HTTPException(status_code=403, detail="Access denied to requested location.")
            query["assigned_location_id"] = location_id
        else:
            query["assigned_location_id"] = {"$in": permitted_locs}
    elif location_id:
        query["assigned_location_id"] = location_id

    if officer_id and officer_id.strip():
        query["officer_id"] = {"$regex": f"^{officer_id.strip()}$", "$options": "i"}

    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
            end = start + timedelta(days=1)
            query["observed_at"] = {"$gte": start, "$lt": end}
        except ValueError:
            pass

    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"full_name": {"$regex": s, "$options": "i"}},
            {"officer_id": {"$regex": s, "$options": "i"}},
            {"assigned_location_name": {"$regex": s, "$options": "i"}}
        ]

    cursor = db.outside_geofence_observations.find(query).sort([("observed_at", -1)]).limit(300)
    docs = await cursor.to_list(300)

    results = []
    for d in docs:
        dist_val = float(d.get("distance_meters", 0.0))
        rad_val = float(d.get("geofence_radius_meters", 100.0))
        excess_val = float(d.get("excess_distance_meters", max(0.0, round(dist_val - rad_val, 1))))
        results.append(OutsideGeofenceObservation(
            id=str(d["_id"]),
            officer_id=d.get("officer_id", "UNKNOWN"),
            full_name=d.get("full_name", "Officer"),
            officer_name=d.get("full_name", "Officer"),
            rank=d.get("rank", "Constable"),
            department=d.get("department", "Police"),
            assigned_location_id=d.get("assigned_location_id", ""),
            assigned_location_name=d.get("assigned_location_name", "Duty Post"),
            duty_location_id=d.get("assigned_location_id", ""),
            duty_location_name=d.get("assigned_location_name", "Duty Post"),
            scheduled_slot=d.get("scheduled_slot"),
            snapshot_window=d.get("scheduled_slot"),
            latitude=float(d.get("latitude", 0.0)),
            longitude=float(d.get("longitude", 0.0)),
            distance_meters=dist_val,
            geofence_radius_meters=rad_val,
            excess_distance_meters=excess_val,
            accuracy_meters=d.get("accuracy_meters"),
            status=d.get("status", "OUTSIDE"),
            observed_at=d.get("observed_at", datetime.now(timezone.utc)),
            received_at=d.get("received_at", datetime.now(timezone.utc)),
            is_delayed=d.get("is_delayed", False),
            map_url=d.get("map_url", "")
        ))
    return results
