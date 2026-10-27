import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.assignment import (
    DutyAssignmentCreateRequest,
    DutyAssignmentUpdateRequest,
    DutyAssignmentResponse
)
from app.services.auth_service import verify_location_access, get_permitted_location_ids
from app.services.audit_service import record_audit_log
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

def _format_assignment(doc: Dict[str, Any]) -> DutyAssignmentResponse:
    return DutyAssignmentResponse(
        id=str(doc["_id"]),
        assignment_id=doc.get("assignment_id", str(doc["_id"])),
        officer_id=doc["officer_id"],
        user_id=doc["user_id"],
        full_name=doc.get("full_name", "Officer"),
        rank=doc.get("rank", "Constable"),
        department=doc.get("department", "District Police"),
        mobile_number=doc.get("mobile_number", ""),
        location_id=str(doc["location_id"]),
        location_name=doc.get("location_name", "Headquarters"),
        location_code=doc.get("location_code", "AP-LOC"),
        geofence_radius_meters=float(doc.get("geofence_radius_meters", 100.0)),
        duty_title=doc.get("duty_title", "General Duty"),
        duty_description=doc.get("duty_description"),
        start_time=doc.get("start_time", datetime.now(timezone.utc)),
        end_time=doc.get("end_time"),
        status=doc.get("status", "ACTIVE"),
        assigned_by_user_id=str(doc.get("assigned_by_user_id", "")),
        assigned_by_username=doc.get("assigned_by_username", "Admin"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        updated_at=doc.get("updated_at", datetime.now(timezone.utc))
    )

async def create_duty_assignment(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    req: DutyAssignmentCreateRequest
) -> DutyAssignmentResponse:
    """Assign an existing registered constable to a location / duty."""
    # 1. Enforce location permission for admin
    await verify_location_access(admin_user, req.location_id, db)

    # 2. Verify target location exists
    loc_oid = ObjectId(req.location_id) if ObjectId.is_valid(req.location_id) else None
    loc = await db.headquarters.find_one({"_id": loc_oid}) if loc_oid else None
    if not loc:
        loc = await db.headquarters.find_one({"_id": req.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail=f"Target duty location '{req.location_id}' not found.")

    # 3. Find existing constable profile
    query_conditions = []
    if req.officer_id and req.officer_id.strip():
        oid = req.officer_id.strip()
        query_conditions.append({"officer_id": oid})
        query_conditions.append({"officer_id": {"$regex": f"^{oid}$", "$options": "i"}})
    target_uid = req.constable_user_id or req.user_id
    if target_uid and str(target_uid).strip():
        uid_str = str(target_uid).strip()
        query_conditions.append({"user_id": uid_str})
        if ObjectId.is_valid(uid_str):
            query_conditions.append({"user_id": ObjectId(uid_str)})
            query_conditions.append({"_id": ObjectId(uid_str)})

    if not query_conditions:
        raise HTTPException(
            status_code=422,
            detail="Either officer_id or constable_user_id must be provided to create a duty assignment."
        )

    profile = await db.officer_profiles.find_one({"$or": query_conditions})
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No registered constable found matching provided identification. Constables must be registered before assignment."
        )

    now = datetime.now(timezone.utc)
    user_id_str = str(profile.get("user_id", ""))

    # 4. Handle active assignments: Reject duplicate at same location; archive previous on reassignment to different location
    active_prev = await db.location_assignments.find_one({
        "user_id": user_id_str,
        "status": "ACTIVE"
    })
    if active_prev:
        if str(active_prev.get("location_id")) == str(loc["_id"]):
            raise HTTPException(
                status_code=400,
                detail=f"Constable '{profile.get('full_name')}' ({profile.get('officer_id')}) already has an active duty assignment at location '{active_prev.get('location_name', 'Station')}'. Please complete or cancel the existing assignment before creating a new one."
            )
        else:
            # Reassignment to a DIFFERENT location: complete previous assignment to preserve full history
            prev_notes = active_prev.get("duty_description") or ""
            reassign_note = f"Reassigned to {loc.get('name', 'new facility')} on {now.strftime('%Y-%m-%d %H:%M:%S UTC')}"
            updated_notes = f"{prev_notes}\n[{reassign_note}]".strip() if prev_notes else f"[{reassign_note}]"
            await db.location_assignments.update_one(
                {"_id": active_prev["_id"]},
                {
                    "$set": {
                        "status": "COMPLETED",
                        "end_time": now,
                        "updated_at": now,
                        "duty_description": updated_notes
                    }
                }
            )
            logger.info(
                f"Archived previous active assignment {active_prev.get('assignment_id')} for constable "
                f"{profile.get('officer_id')} as COMPLETED upon reassignment to {loc.get('name')}."
            )

    # 5. Create new assignment record
    asgn_code = f"ASN-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    desc = req.notes or req.duty_description or ""
    new_doc = {
        "assignment_id": asgn_code,
        "officer_id": profile["officer_id"],
        "user_id": user_id_str,
        "full_name": profile.get("full_name", "Officer"),
        "rank": profile.get("rank", "Constable"),
        "department": profile.get("department", "Police"),
        "mobile_number": profile.get("mobile_number", ""),
        "location_id": str(loc["_id"]),
        "location_name": loc.get("name", "Duty Post"),
        "location_code": loc.get("code", "AP-LOC"),
        "geofence_radius_meters": float(loc.get("radius_meters", 100.0)),
        "duty_title": (req.duty_title or "General Duty").strip(),
        "duty_description": desc.strip() if desc else None,
        "start_time": req.start_time or now,
        "end_time": req.end_time,
        "status": "ACTIVE",
        "assigned_by_user_id": str(admin_user["_id"]),
        "assigned_by_username": admin_user["username"],
        "created_at": now,
        "updated_at": now
    }

    res = await db.location_assignments.insert_one(new_doc)
    new_doc["_id"] = res.inserted_id

    # 6. Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="DUTY_ASSIGNMENT_CREATED",
        target_type="assignment",
        target_id=asgn_code,
        reason=f"Assigned constable {profile['officer_id']} ({profile.get('full_name')}) to {loc.get('name')}",
        metadata={
            "location_id": str(loc["_id"]),
            "officer_id": profile["officer_id"],
            "duty_title": req.duty_title
        }
    )

    # 7. Broadcast WebSocket event
    formatted = _format_assignment(new_doc)
    await ws_manager.broadcast({
        "type": "DUTY_ASSIGNMENT_UPDATED",
        "data": formatted.model_dump(mode="json")
    })

    return formatted

async def list_duty_assignments(
    db: AsyncIOMotorDatabase,
    current_user: Dict[str, Any],
    location_id: Optional[str] = None,
    officer_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None
) -> List[DutyAssignmentResponse]:
    """List duty assignments filtered by role and authorized locations."""
    permitted_locs = await get_permitted_location_ids(current_user, db)

    query: Dict[str, Any] = {}

    # Role-based location scoping
    if permitted_locs is not None:
        if location_id:
            if location_id not in permitted_locs:
                raise HTTPException(status_code=403, detail="Access denied to requested location.")
            query["location_id"] = location_id
        else:
            query["location_id"] = {"$in": permitted_locs}
    elif location_id:
        query["location_id"] = location_id

    if officer_id and officer_id.strip():
        query["officer_id"] = {"$regex": f"^{officer_id.strip()}$", "$options": "i"}

    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter.upper()

    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"full_name": {"$regex": s, "$options": "i"}},
            {"officer_id": {"$regex": s, "$options": "i"}},
            {"location_name": {"$regex": s, "$options": "i"}},
            {"duty_title": {"$regex": s, "$options": "i"}}
        ]

    cursor = db.location_assignments.find(query).sort([("created_at", -1)])
    docs = await cursor.to_list(length=300)
    return [_format_assignment(d) for d in docs]

async def update_duty_assignment(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    assignment_id: str,
    req: DutyAssignmentUpdateRequest
) -> DutyAssignmentResponse:
    """Modify, end, or revoke an existing duty assignment."""
    query = {
        "$or": [
            {"assignment_id": assignment_id},
            {"_id": ObjectId(assignment_id) if ObjectId.is_valid(assignment_id) else assignment_id}
        ]
    }
    asgn = await db.location_assignments.find_one(query)
    if not asgn:
        raise HTTPException(status_code=404, detail="Duty assignment not found.")

    # Enforce admin permission for the assignment's location
    await verify_location_access(admin_user, str(asgn["location_id"]), db)

    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {"updated_at": now}

    if req.duty_title:
        updates["duty_title"] = req.duty_title.strip()
    if req.notes is not None:
        updates["duty_description"] = req.notes.strip()
    if req.duty_description is not None:
        updates["duty_description"] = req.duty_description.strip()
    if req.end_time:
        updates["end_time"] = req.end_time
    if req.status:
        updates["status"] = req.status
        if req.status in ("COMPLETED", "REVOKED", "CANCELLED") and not asgn.get("end_time"):
            updates["end_time"] = now

    await db.location_assignments.update_one({"_id": asgn["_id"]}, {"$set": updates})
    updated_doc = await db.location_assignments.find_one({"_id": asgn["_id"]})

    # Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="DUTY_ASSIGNMENT_UPDATED",
        target_type="assignment",
        target_id=asgn.get("assignment_id", str(asgn["_id"])),
        reason=req.reason,
        metadata={"new_status": req.status, "officer_id": asgn["officer_id"]}
    )

    formatted = _format_assignment(updated_doc)
    await ws_manager.broadcast({
        "type": "DUTY_ASSIGNMENT_UPDATED",
        "data": formatted.model_dump(mode="json")
    })
    return formatted

async def get_active_assignment_for_constable(
    db: AsyncIOMotorDatabase,
    user_id_or_officer_id: str,
    at_time: Optional[datetime] = None
) -> Optional[Dict[str, Any]]:
    """Retrieve the applicable duty assignment for a constable at a specific observation time."""
    ref_time = at_time or datetime.now(timezone.utc)
    if ref_time.tzinfo is None:
        ref_time = ref_time.replace(tzinfo=timezone.utc)

    # 1. Exact active assignment valid at ref_time
    asgn = await db.location_assignments.find_one({
        "$or": [
            {"user_id": user_id_or_officer_id},
            {"officer_id": user_id_or_officer_id}
        ],
        "start_time": {"$lte": ref_time},
        "$or": [
            {"end_time": None},
            {"end_time": {"$gte": ref_time}}
        ],
        "status": "ACTIVE"
    }, sort=[("start_time", -1)])

    if asgn:
        return asgn

    # 2. Fallback to latest ACTIVE assignment
    asgn = await db.location_assignments.find_one({
        "$or": [
            {"user_id": user_id_or_officer_id},
            {"officer_id": user_id_or_officer_id}
        ],
        "status": "ACTIVE"
    }, sort=[("start_time", -1)])

    return asgn
