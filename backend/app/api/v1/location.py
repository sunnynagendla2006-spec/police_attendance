from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.location import (
    LocationObservationCreate,
    LocationSyncBatch,
    LocationObservationResult,
    OfficerLiveLocation
)
from app.services.auth_service import get_current_user, require_roles, get_permitted_location_ids
from app.services.location_service import (
    process_single_observation,
    sync_offline_batch,
    get_all_live_locations
)
from app.services.geofence_engine import get_active_geofence_config, calculate_haversine_distance_meters
from app.services.assignment_service import get_active_assignment_for_constable

router = APIRouter(prefix="/location", tags=["Location & Geofence Tracking"])

async def _find_profile_for_user(db: AsyncIOMotorDatabase, current_user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    user_id = str(current_user["_id"])
    profile = await db.officer_profiles.find_one({"user_id": user_id})
    if not profile and ObjectId.is_valid(user_id):
        profile = await db.officer_profiles.find_one({"user_id": ObjectId(user_id)})
    if not profile:
        profile = await db.officer_profiles.find_one({
            "$or": [
                {"officer_id": {"$regex": f"^{current_user.get('username', '').strip()}$", "$options": "i"}},
                {"mobile_number": current_user.get('username', '').strip()}
            ]
        })
    return profile

@router.post("/observations", response_model=LocationObservationResult)
async def submit_location(
    obs: LocationObservationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit a location observation from an authorized officer's device.
    Evaluates assigned headquarters geofence and triggers verified entry/exit transitions.
    """
    profile = await _find_profile_for_user(db, current_user)
    if not profile:
        raise HTTPException(status_code=404, detail="Officer profile not found")

    if profile.get("tracking_enabled") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Location tracking is not enabled for this personnel account. Explicit administrator activation is required."
        )

    return await process_single_observation(
        db=db,
        user=current_user,
        profile=profile,
        obs=obs,
        sync_status="REALTIME"
    )

@router.post("/sync")
async def sync_offline_locations(
    batch: LocationSyncBatch,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Synchronize a batch of locally queued offline observations.
    Preserves original timestamps and prevents duplicate visit creation.
    """
    profile = await _find_profile_for_user(db, current_user)
    if not profile:
        raise HTTPException(status_code=404, detail="Officer profile not found")

    if profile.get("tracking_enabled") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Location tracking is not enabled for this personnel account. Explicit administrator activation is required."
        )

    return await sync_offline_batch(
        db=db,
        user=current_user,
        profile=profile,
        batch=batch
    )

@router.get("/current", response_model=List[OfficerLiveLocation])
async def get_live_locations(
    location_id: Optional[str] = Query(None, description="Filter live locations by authorized facility ID"),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve current locations and freshness states for all active officers for live map."""
    permitted_locs = await get_permitted_location_ids(admin_user, db)
    return await get_all_live_locations(
        db=db,
        location_id=location_id,
        permitted_location_ids=permitted_locs
    )

@router.get("/status")
async def get_my_location_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve current authenticated officer's location freshness and duty facility status."""
    user_id = str(current_user["_id"])
    last_obs = await db.location_observations.find_one(
        {"user_id": user_id},
        sort=[("observed_at", -1)]
    )
    hq_config = await get_active_geofence_config(db)

    # Check assigned facility
    asgn = await get_active_assignment_for_constable(db, user_id)
    target_facility = None
    if asgn and asgn.get("location_id"):
        loc_oid = ObjectId(asgn["location_id"]) if ObjectId.is_valid(asgn["location_id"]) else None
        target_facility = await db.headquarters.find_one({"_id": loc_oid}) if loc_oid else None
        if not target_facility:
            target_facility = await db.headquarters.find_one({"_id": str(asgn["location_id"])})

    if target_facility:
        coords = target_facility.get("location", {}).get("coordinates", [])
        tgt_lat = coords[1] if len(coords) > 1 else target_facility.get("latitude", hq_config["latitude"])
        tgt_lon = coords[0] if len(coords) > 0 else target_facility.get("longitude", hq_config["longitude"])
        tgt_radius = float(target_facility.get("radius_meters", asgn.get("geofence_radius_meters", hq_config["radius_meters"])))
        tgt_name = target_facility.get("name", "Duty Post")
    else:
        tgt_lat = hq_config["latitude"]
        tgt_lon = hq_config["longitude"]
        tgt_radius = hq_config["radius_meters"]
        tgt_name = hq_config.get("name", "Headquarters")

    now = datetime.now(timezone.utc)
    if not last_obs:
        return {
            "current_state": "UNKNOWN",
            "is_inside": False,
            "is_stale": True,
            "distance_meters": None,
            "last_observed_at": None,
            "hq_radius_meters": tgt_radius,
            "facility_name": tgt_name
        }

    obs_time = last_obs.get("observed_at")
    if obs_time and obs_time.tzinfo is None:
        obs_time = obs_time.replace(tzinfo=timezone.utc)

    diff_sec = (now - obs_time).total_seconds() if obs_time else 999999
    is_stale = (diff_sec > hq_config.get("stale_threshold_seconds", 300))
    obs_coords = last_obs.get("location", {}).get("coordinates", [None, None])
    dist = None
    if obs_coords and obs_coords[0] is not None and obs_coords[1] is not None:
        dist = round(calculate_haversine_distance_meters(obs_coords[1], obs_coords[0], tgt_lat, tgt_lon), 1)

    is_inside = (dist <= tgt_radius) if (dist is not None and not is_stale) else False
    current_state = "LOCATION_STALE" if is_stale else ("INSIDE" if is_inside else "OUTSIDE")

    return {
        "current_state": current_state,
        "is_inside": is_inside,
        "is_stale": is_stale,
        "distance_meters": dist,
        "last_observed_at": obs_time.isoformat() if obs_time else None,
        "accuracy_meters": last_obs.get("accuracy_meters"),
        "hq_radius_meters": tgt_radius,
        "facility_name": tgt_name
    }
