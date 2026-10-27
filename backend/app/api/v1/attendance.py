from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.attendance import (
    AttendanceVisitResponse,
    AttendanceCorrectionCreateRequest,
    AttendanceCorrectionReviewRequest,
    AdminVisitCorrectionRequest,
    OfficerAttendanceSummary
)
from app.services.auth_service import get_current_user, require_roles
from app.services.attendance_service import format_duration, get_officer_today_stats
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/attendance", tags=["Headquarters Attendance & Visits"])

@router.get("", response_model=List[AttendanceVisitResponse])
async def get_attendance_visits(
    officer_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve headquarters visit records with filtering and pagination."""
    query: Dict[str, Any] = {}
    if current_user.get("role") == "constable":
        query["user_id"] = str(current_user["_id"])
    elif officer_id:
        query["officer_id"] = officer_id
    if status_filter:
        query["visit_status"] = status_filter
    if start_date or end_date:
        query["entry_at"] = {}
        if start_date:
            query["entry_at"]["$gte"] = start_date
        if end_date:
            query["entry_at"]["$lte"] = end_date

    cursor = db.attendance_visits.find(query).sort("entry_at", -1).skip(skip).limit(limit)
    visits = await cursor.to_list(length=limit)

    return [
        AttendanceVisitResponse(
            id=str(v["_id"]),
            user_id=v["user_id"],
            officer_id=v.get("officer_id", "UNKNOWN"),
            officer_name=v.get("officer_name", "Officer"),
            rank=v.get("rank", "Constable"),
            department=v.get("department", "District Police"),
            headquarters_id=v.get("headquarters_id", "default"),
            entry_at=v["entry_at"],
            exit_at=v.get("exit_at"),
            duration_seconds=v.get("duration_seconds"),
            duration_formatted=format_duration(v.get("duration_seconds")),
            entry_verification_status=v.get("entry_verification_status", "VERIFIED"),
            exit_verification_status=v.get("exit_verification_status", "PENDING"),
            visit_status=v.get("visit_status", "OPEN"),
            notes=v.get("notes"),
            created_at=v.get("created_at", datetime.now(timezone.utc)),
            updated_at=v.get("updated_at", datetime.now(timezone.utc))
        )
        for v in visits
    ]

@router.get("/summary", response_model=List[OfficerAttendanceSummary])
async def get_attendance_summary_today(
    date_filter: Optional[str] = Query(None, description="'today', 'yesterday', '7days', '30days'"),
    rank_filter: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve headquarters attendance table summary by officer."""
    now = datetime.now(timezone.utc)
    
    # Date bounds
    if date_filter == "yesterday":
        yest = now - timedelta(days=1)
        start_of_period = yest.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_period = yest.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_filter == "7days":
        start_of_period = now - timedelta(days=7)
        end_of_period = now
    elif date_filter == "30days":
        start_of_period = now - timedelta(days=30)
        end_of_period = now
    else:  # default 'today'
        start_of_period = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_period = now

    # Fetch officers
    prof_query = {"profile_status": "ACTIVE"}
    if rank_filter:
        prof_query["rank"] = rank_filter
    if query:
        prof_query["$or"] = [
            {"full_name": {"$regex": query, "$options": "i"}},
            {"officer_id": {"$regex": query, "$options": "i"}}
        ]

    profiles = await db.officer_profiles.find(prof_query).to_list(length=500)
    summaries = []

    for p in profiles:
        user_id = p["user_id"]
        
        visits = await db.attendance_visits.find({
            "user_id": user_id,
            "entry_at": {"$gte": start_of_period, "$lte": end_of_period}
        }).sort("entry_at", 1).to_list(length=100)

        total_sec = 0
        first_entry = None
        latest_exit = None

        for v in visits:
            if first_entry is None:
                first_entry = v["entry_at"]
            if v.get("exit_at"):
                latest_exit = v["exit_at"]
                total_sec += (v.get("duration_seconds") or 0)
            elif v.get("visit_status") == "OPEN":
                entry_at = v["entry_at"]
                if entry_at.tzinfo is None:
                    entry_at = entry_at.replace(tzinfo=timezone.utc)
                total_sec += max(0, int((now - entry_at).total_seconds()))

        # Current location
        last_obs = await db.location_observations.find_one(
            {"user_id": user_id},
            sort=[("observed_at", -1)]
        )

        current_hq_status = "OUTSIDE"
        latest_update = None
        if last_obs:
            latest_update = last_obs.get("observed_at")
            obs_time = latest_update
            if obs_time and obs_time.tzinfo is None:
                obs_time = obs_time.replace(tzinfo=timezone.utc)
            if (now - obs_time).total_seconds() > 300:
                current_hq_status = "LOCATION_STALE"
            else:
                current_hq_status = "INSIDE" if last_obs.get("is_inside_geofence") else "OUTSIDE"

        if status_filter and current_hq_status != status_filter:
            continue

        summaries.append(OfficerAttendanceSummary(
            user_id=user_id,
            officer_id=p["officer_id"],
            officer_name=p["full_name"],
            rank=p["rank"],
            department=p["department"],
            first_entry_today=first_entry,
            latest_exit_today=latest_exit,
            visits_today=len(visits),
            total_duration_seconds_today=total_sec,
            total_duration_formatted_today=format_duration(total_sec),
            current_hq_status=current_hq_status,
            latest_location_update=latest_update,
            verification_status="VERIFIED"
        ))

    return summaries

@router.get("/my-attendance")
async def get_my_attendance(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve personal attendance records for the constable mobile app."""
    user_id = str(current_user["_id"])
    stats = await get_officer_today_stats(db, user_id)
    
    # Historical visits (last 30)
    cursor = db.attendance_visits.find({"user_id": user_id}).sort("entry_at", -1).limit(30)
    history_docs = await cursor.to_list(length=30)
    
    history = [
        AttendanceVisitResponse(
            id=str(v["_id"]),
            user_id=v["user_id"],
            officer_id=v.get("officer_id", "UNKNOWN"),
            officer_name=v.get("officer_name", "Officer"),
            rank=v.get("rank", "Constable"),
            department=v.get("department", "District Police"),
            headquarters_id=v.get("headquarters_id", "default"),
            entry_at=v["entry_at"],
            exit_at=v.get("exit_at"),
            duration_seconds=v.get("duration_seconds"),
            duration_formatted=format_duration(v.get("duration_seconds")),
            entry_verification_status=v.get("entry_verification_status", "VERIFIED"),
            exit_verification_status=v.get("exit_verification_status", "PENDING"),
            visit_status=v.get("visit_status", "OPEN"),
            notes=v.get("notes"),
            created_at=v.get("created_at", datetime.now(timezone.utc)),
            updated_at=v.get("updated_at", datetime.now(timezone.utc))
        )
        for v in history_docs
    ]

    return {
        "today": {
            "visit_count": stats["visit_count"],
            "total_seconds": stats["total_seconds"],
            "total_formatted": stats["total_formatted"],
            "first_entry": stats["first_entry"],
            "latest_exit": stats["latest_exit"],
        },
        "history": history
    }

@router.post("/correction-requests")
async def submit_correction_request(
    req: AttendanceCorrectionCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Constable submits a request to correct an erroneous attendance record."""
    user_id = str(current_user["_id"])
    now = datetime.now(timezone.utc)
    
    doc = {
        "visit_id": req.visit_id,
        "requested_by": user_id,
        "reason": req.reason.strip(),
        "requested_changes": {
            "entry_at": req.requested_entry_at,
            "exit_at": req.requested_exit_at
        },
        "request_status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now
    }
    res = await db.attendance_correction_requests.insert_one(doc)
    return {"status": "SUCCESS", "request_id": str(res.inserted_id), "message": "Correction request submitted for admin review."}

@router.post("/{visit_id}/corrections")
async def admin_correct_visit(
    visit_id: str,
    req: AdminVisitCorrectionRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Admin manually corrects a visit timestamp with audited justification."""
    v_obj_id = ObjectId(visit_id) if ObjectId.is_valid(visit_id) else visit_id
    visit = await db.attendance_visits.find_one({"_id": v_obj_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit record not found")

    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {"updated_at": now, "notes": f"Admin correction: {req.reason}"}

    entry_at = req.entry_at or visit["entry_at"]
    exit_at = req.exit_at or visit.get("exit_at")

    if entry_at:
        updates["entry_at"] = entry_at
        updates["entry_verification_status"] = "MANUAL_CORRECTED"
    if exit_at:
        updates["exit_at"] = exit_at
        updates["exit_verification_status"] = "MANUAL_CORRECTED"
        updates["visit_status"] = "COMPLETED"
        if entry_at:
            if entry_at.tzinfo is None:
                entry_at = entry_at.replace(tzinfo=timezone.utc)
            if exit_at.tzinfo is None:
                exit_at = exit_at.replace(tzinfo=timezone.utc)
            updates["duration_seconds"] = max(0, int((exit_at - entry_at).total_seconds()))

    await db.attendance_visits.update_one({"_id": v_obj_id}, {"$set": updates})

    # Record audit log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="VISIT_CORRECTED",
        target_type="attendance_visit",
        target_id=visit_id,
        reason=req.reason,
        metadata={"previous": {"entry_at": str(visit.get("entry_at")), "exit_at": str(visit.get("exit_at"))}, "updated": updates}
    )

    return {"status": "SUCCESS", "message": f"Visit {visit_id} corrected successfully."}
