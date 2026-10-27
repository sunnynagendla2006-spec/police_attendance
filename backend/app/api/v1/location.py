from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.location import (
    LocationObservationCreate,
    LocationSyncBatch,
    LocationObservationResult,
    OfficerLiveLocation
)
from app.services.auth_service import get_current_user, require_roles
from app.services.location_service import (
    process_single_observation,
    sync_offline_batch,
    get_all_live_locations
)
from app.services.geofence_engine import get_active_geofence_config

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
    Evaluates headquarters geofence and triggers verified entry/exit transitions.
    """
    profile = await _find_profile_for_user(db, current_user)
    if not profile:
        raise HTTPException(status_code=404, detail="Officer profile not found")

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

    return await sync_offline_batch(
        db=db,
        user=current_user,
        profile=profile,
        batch=batch
    )

@router.get("/current", response_model=List[OfficerLiveLocation])
async def get_live_locations(
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve current locations and freshness states for all active officers for live map."""
    return await get_all_live_locations(db)

@router.get("/status")
async def get_my_location_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve current authenticated officer's location freshness and headquarters status."""
    user_id = str(current_user["_id"])
    last_obs = await db.location_observations.find_one(
        {"user_id": user_id},
        sort=[("observed_at", -1)]
    )
    hq_config = await get_active_geofence_config(db)

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if not last_obs:
        return {
            "current_state": "UNKNOWN",
            "is_inside": False,
            "is_stale": True,
            "distance_meters": None,
            "last_observed_at": None,
            "hq_radius_meters": hq_config["radius_meters"]
        }

    obs_time = last_obs.get("observed_at")
    if obs_time and obs_time.tzinfo is None:
        obs_time = obs_time.replace(tzinfo=timezone.utc)

    diff_sec = (now - obs_time).total_seconds() if obs_time else 999999
    is_stale = (diff_sec > hq_config["stale_threshold_seconds"])

    return {
        "current_state": "LOCATION_STALE" if is_stale else last_obs.get("current_state", "UNKNOWN"),
        "is_inside": last_obs.get("is_inside_geofence", False),
        "is_stale": is_stale,
        "distance_meters": last_obs.get("distance_from_hq_meters"),
        "last_observed_at": obs_time.isoformat() if obs_time else None,
        "accuracy_meters": last_obs.get("accuracy_meters"),
        "hq_radius_meters": hq_config["radius_meters"]
    }
