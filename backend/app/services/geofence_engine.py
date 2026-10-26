import math
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings

def calculate_haversine_distance_meters(
    lat1: float, lon1: float,
    lat2: float, lon2: float
) -> float:
    """
    Calculate the great circle distance between two points on Earth in meters.
    Uses Haversine spherical formula.
    """
    R = 6371000.0  # Earth's mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

async def get_active_geofence_config(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """Retrieve the active headquarters and geofence configuration."""
    # Prioritize primary active facility, then any active facility, then default name
    hq = await db.headquarters.find_one({"is_primary": True, "status": "ACTIVE"})
    if not hq:
        hq = await db.headquarters.find_one({"is_primary": True})
    if not hq:
        hq = await db.headquarters.find_one({"status": "ACTIVE"})
    if not hq:
        hq = await db.headquarters.find_one({"name": settings.DEFAULT_HQ_NAME})
    if not hq:
        hq = await db.headquarters.find_one()
    
    if not hq:
        # Fallback to config settings
        return {
            "headquarters_id": "default",
            "name": settings.DEFAULT_HQ_NAME,
            "latitude": settings.DEFAULT_HQ_LATITUDE,
            "longitude": settings.DEFAULT_HQ_LONGITUDE,
            "radius_meters": settings.DEFAULT_GEOFENCE_RADIUS_METERS,
            "accuracy_threshold_meters": settings.DEFAULT_ACCURACY_THRESHOLD_METERS,
            "stale_threshold_seconds": settings.DEFAULT_STALE_THRESHOLD_SECONDS,
            "hysteresis_meters": settings.GEOFENCE_HYSTERESIS_METERS,
            "entry_consecutive_required": settings.ENTRY_CONFIRMATION_COUNT,
            "exit_consecutive_required": settings.EXIT_CONFIRMATION_COUNT,
        }

    hq_id = str(hq["_id"])
    cfg = await db.geofence_configurations.find_one(
        {"headquarters_id": hq_id},
        sort=[("created_at", -1)]
    )

    radius = cfg.get("radius_meters") if cfg else hq.get("radius_meters", settings.DEFAULT_GEOFENCE_RADIUS_METERS)
    if radius is None:
        radius = hq.get("radius_meters", settings.DEFAULT_GEOFENCE_RADIUS_METERS)

    accuracy_thresh = cfg.get("accuracy_threshold_meters", settings.DEFAULT_ACCURACY_THRESHOLD_METERS) if cfg else settings.DEFAULT_ACCURACY_THRESHOLD_METERS
    stale_thresh = cfg.get("stale_threshold_seconds", settings.DEFAULT_STALE_THRESHOLD_SECONDS) if cfg else settings.DEFAULT_STALE_THRESHOLD_SECONDS

    coords = hq.get("location", {}).get("coordinates", [settings.DEFAULT_HQ_LONGITUDE, settings.DEFAULT_HQ_LATITUDE])

    return {
        "headquarters_id": hq_id,
        "name": hq.get("name", settings.DEFAULT_HQ_NAME),
        "latitude": coords[1],
        "longitude": coords[0],
        "radius_meters": float(radius),
        "accuracy_threshold_meters": float(accuracy_thresh),
        "stale_threshold_seconds": int(stale_thresh),
        "hysteresis_meters": settings.GEOFENCE_HYSTERESIS_METERS,
        "entry_consecutive_required": settings.ENTRY_CONFIRMATION_COUNT,
        "exit_consecutive_required": settings.EXIT_CONFIRMATION_COUNT,
    }

def evaluate_geofence_state(
    distance_meters: float,
    accuracy_meters: float,
    current_state: str,
    radius_meters: float,
    accuracy_threshold_meters: float,
    hysteresis_meters: float = 10.0
) -> Tuple[str, bool, str]:
    """
    Authoritative state evaluation with hysteresis and accuracy threshold.
    
    States:
    - UNKNOWN, OUTSIDE, ENTERING, INSIDE, EXITING, LOCATION_STALE, PERMISSION_DENIED, OFFLINE
    
    Returns: (new_state, is_transition, transition_type)
    transition_type: 'ENTRY', 'EXIT', or 'NONE'
    """
    # 1. Accuracy Check
    if accuracy_meters > accuracy_threshold_meters:
        # If accuracy is too poor, retain the current known state but mark uncertain
        return current_state if current_state != "UNKNOWN" else "UNKNOWN", False, "NONE"

    # 2. Hysteresis boundary evaluation
    # Inner threshold for confirmed entry
    inner_boundary = radius_meters - hysteresis_meters
    # Outer threshold for confirmed exit
    outer_boundary = radius_meters + hysteresis_meters

    if current_state in ["INSIDE", "EXITING"]:
        if distance_meters > outer_boundary:
            # Confirmed transition to OUTSIDE
            return "OUTSIDE", True, "EXIT"
        elif distance_meters > radius_meters:
            # Within outer hysteresis band
            return "EXITING", False, "NONE"
        else:
            return "INSIDE", False, "NONE"
            
    else:  # OUTSIDE, ENTERING, UNKNOWN, LOCATION_STALE, OFFLINE
        if distance_meters <= inner_boundary:
            # Confirmed transition to INSIDE
            return "INSIDE", True, "ENTRY"
        elif distance_meters <= radius_meters:
            # Within inner hysteresis band
            return "ENTERING", False, "NONE"
        else:
            return "OUTSIDE", False, "NONE"
