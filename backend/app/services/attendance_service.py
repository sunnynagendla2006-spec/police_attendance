import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.websocket_manager import ws_manager
from app.services.audit_service import record_audit_log

logger = logging.getLogger(__name__)

def format_duration(seconds: Optional[int]) -> str:
    """Format duration in seconds to human-readable 'Xh Ym'."""
    if seconds is None or seconds < 0:
        return "00h 00m"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours:02d}h {minutes:02d}m"

async def process_geofence_transition(
    db: AsyncIOMotorDatabase,
    user_id: str,
    officer_profile: Dict[str, Any],
    hq_config: Dict[str, Any],
    transition_type: str,  # 'ENTRY' or 'EXIT'
    observation_time: datetime,
    accuracy_meters: float,
    location_coords: List[float],  # [lon, lat]
    sync_status: str = "REALTIME"
) -> Optional[Dict[str, Any]]:
    """
    Process confirmed geofence entry or exit transition.
    Atomically updates visits ledger and geofence events.
    """
    now = datetime.now(timezone.utc)
    officer_id = officer_profile.get("officer_id", "UNKNOWN")
    full_name = officer_profile.get("full_name", "Unknown Officer")
    rank = officer_profile.get("rank", "Constable")
    department = officer_profile.get("department", "District Police")
    hq_id = hq_config.get("headquarters_id", "default")

    verification_status = "VERIFIED" if sync_status == "REALTIME" else "ESTIMATED"

    # Idempotency key to prevent duplicate processing
    time_str = observation_time.strftime("%Y-%m-%dT%H:%M:%S")
    idempotency_key = f"{user_id}:{time_str}:{transition_type}"

    # Check if this exact event was already processed
    existing_event = await db.geofence_events.find_one({"idempotency_key": idempotency_key})
    if existing_event:
        logger.info(f"Duplicate event ignored with idempotency key: {idempotency_key}")
        return None

    if transition_type == "ENTRY":
        # Check if officer ALREADY has an open visit
        open_visit = await db.attendance_visits.find_one({
            "user_id": user_id,
            "visit_status": "OPEN"
        })

        if open_visit:
            logger.warning(f"Officer {officer_id} already has an open visit (ID: {open_visit['_id']}). Skipping duplicate entry.")
            return None

        # Create new visit
        visit_doc = {
            "user_id": user_id,
            "officer_id": officer_id,
            "officer_name": full_name,
            "rank": rank,
            "department": department,
            "headquarters_id": hq_id,
            "entry_at": observation_time,
            "exit_at": None,
            "duration_seconds": None,
            "entry_verification_status": verification_status,
            "exit_verification_status": "PENDING",
            "visit_status": "OPEN",
            "notes": None,
            "created_at": now,
            "updated_at": now
        }
        v_res = await db.attendance_visits.insert_one(visit_doc)
        visit_id = str(v_res.inserted_id)

        # Record geofence event
        event_doc = {
            "user_id": user_id,
            "officer_id": officer_id,
            "headquarters_id": hq_id,
            "event_type": "ENTRY",
            "observed_at": observation_time,
            "received_at": now,
            "location": {"type": "Point", "coordinates": location_coords},
            "accuracy_meters": accuracy_meters,
            "verification_status": verification_status,
            "idempotency_key": idempotency_key,
            "visit_id": visit_id
        }
        await db.geofence_events.insert_one(event_doc)

        # Notify dashboard via WebSocket
        await ws_manager.broadcast({
            "type": "HQ_ENTRY",
            "data": {
                "visit_id": visit_id,
                "officer_id": officer_id,
                "full_name": full_name,
                "rank": rank,
                "entry_at": observation_time.isoformat(),
                "headquarters": hq_config.get("name", "Eluru HQ")
            }
        })
        return visit_doc

    elif transition_type == "EXIT":
        # Find open visit to close
        open_visit = await db.attendance_visits.find_one({
            "user_id": user_id,
            "visit_status": "OPEN"
        }, sort=[("entry_at", -1)])

        if open_visit:
            entry_at = open_visit["entry_at"]
            if entry_at.tzinfo is None:
                entry_at = entry_at.replace(tzinfo=timezone.utc)
            if observation_time.tzinfo is None:
                observation_time = observation_time.replace(tzinfo=timezone.utc)

            duration_seconds = max(0, int((observation_time - entry_at).total_seconds()))
            visit_id = str(open_visit["_id"])

            update_data = {
                "exit_at": observation_time,
                "duration_seconds": duration_seconds,
                "exit_verification_status": verification_status,
                "visit_status": "COMPLETED",
                "updated_at": now
            }
            await db.attendance_visits.update_one(
                {"_id": open_visit["_id"]},
                {"$set": update_data}
            )

            # Record event
            event_doc = {
                "user_id": user_id,
                "officer_id": officer_id,
                "headquarters_id": hq_id,
                "event_type": "EXIT",
                "observed_at": observation_time,
                "received_at": now,
                "location": {"type": "Point", "coordinates": location_coords},
                "accuracy_meters": accuracy_meters,
                "verification_status": verification_status,
                "idempotency_key": idempotency_key,
                "visit_id": visit_id
            }
            await db.geofence_events.insert_one(event_doc)

            # Notify dashboard via WebSocket
            await ws_manager.broadcast({
                "type": "HQ_EXIT",
                "data": {
                    "visit_id": visit_id,
                    "officer_id": officer_id,
                    "full_name": full_name,
                    "rank": rank,
                    "exit_at": observation_time.isoformat(),
                    "duration_formatted": format_duration(duration_seconds),
                    "headquarters": hq_config.get("name", "Eluru HQ")
                }
            })
            open_visit.update(update_data)
            return open_visit
        else:
            logger.info(f"Officer {officer_id} exited without prior open visit. Ignoring fabrication.")
            return None

async def get_officer_today_stats(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, Any]:
    """Calculate an officer's recorded visits and total duration for today (Asia/Kolkata / UTC)."""
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    cursor = db.attendance_visits.find({
        "user_id": user_id,
        "entry_at": {"$gte": start_of_day}
    }).sort("entry_at", 1)
    
    visits = await cursor.to_list(length=100)
    
    total_seconds = 0
    first_entry = None
    latest_exit = None

    for v in visits:
        if first_entry is None:
            first_entry = v["entry_at"]
        if v.get("exit_at"):
            latest_exit = v["exit_at"]
            total_seconds += (v.get("duration_seconds") or 0)
        elif v.get("visit_status") == "OPEN":
            # Add elapsed time so far for active ongoing visit
            entry_at = v["entry_at"]
            if entry_at.tzinfo is None:
                entry_at = entry_at.replace(tzinfo=timezone.utc)
            elapsed = max(0, int((now - entry_at).total_seconds()))
            total_seconds += elapsed

    return {
        "visit_count": len(visits),
        "total_seconds": total_seconds,
        "total_formatted": format_duration(total_seconds),
        "first_entry": first_entry,
        "latest_exit": latest_exit,
        "visits": visits
    }

async def get_officer_today_stats_batch(db: AsyncIOMotorDatabase, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batched equivalent of get_officer_today_stats for many officers at once.

    Issues a single query for all of today's visits instead of one query per
    officer, so the live dashboard does not run an N+1 query per refresh.
    """
    if not user_ids:
        return {}

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    cursor = db.attendance_visits.find({
        "user_id": {"$in": user_ids},
        "entry_at": {"$gte": start_of_day}
    }).sort("entry_at", 1)
    visits = await cursor.to_list(length=len(user_ids) * 50 + 500)

    by_user: Dict[str, List[Dict[str, Any]]] = {uid: [] for uid in user_ids}
    for v in visits:
        by_user.setdefault(str(v.get("user_id")), []).append(v)

    results: Dict[str, Dict[str, Any]] = {}
    for uid, user_visits in by_user.items():
        total_seconds = 0
        first_entry = None
        latest_exit = None
        for v in user_visits:
            if first_entry is None:
                first_entry = v["entry_at"]
            if v.get("exit_at"):
                latest_exit = v["exit_at"]
                total_seconds += (v.get("duration_seconds") or 0)
            elif v.get("visit_status") == "OPEN":
                entry_at = v["entry_at"]
                if entry_at.tzinfo is None:
                    entry_at = entry_at.replace(tzinfo=timezone.utc)
                elapsed = max(0, int((now - entry_at).total_seconds()))
                total_seconds += elapsed

        results[uid] = {
            "visit_count": len(user_visits),
            "total_seconds": total_seconds,
            "total_formatted": format_duration(total_seconds),
            "first_entry": first_entry,
            "latest_exit": latest_exit,
            "visits": user_visits
        }

    return results
