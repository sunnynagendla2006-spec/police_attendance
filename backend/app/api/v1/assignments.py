from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.assignment import (
    DutyAssignmentCreateRequest,
    DutyAssignmentUpdateRequest,
    DutyAssignmentResponse
)
from app.services.auth_service import require_roles, get_current_user
from app.services.assignment_service import (
    create_duty_assignment,
    list_duty_assignments,
    update_duty_assignment,
    get_active_assignment_for_constable
)

router = APIRouter(prefix="/assignments", tags=["Duty Assignments"])

@router.post("", response_model=DutyAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_constable(
    req: DutyAssignmentCreateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Assign an existing registered constable to a permitted duty location."""
    return await create_duty_assignment(db=db, admin_user=admin_user, req=req)

@router.get("", response_model=List[DutyAssignmentResponse])
async def get_assignments(
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    officer_id: Optional[str] = Query(None, description="Filter by constable Officer ID"),
    status: Optional[str] = Query(None, description="Status filter: ACTIVE, COMPLETED, REVOKED, ALL"),
    search: Optional[str] = Query(None, description="Search by name, ID, or location"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List duty assignments filtered by role and permitted locations."""
    return await list_duty_assignments(
        db=db,
        current_user=current_user,
        location_id=location_id,
        officer_id=officer_id,
        status_filter=status,
        search=search
    )

@router.patch("/{assignment_id}", response_model=DutyAssignmentResponse)
async def modify_assignment(
    assignment_id: str,
    req: DutyAssignmentUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update duty title, description, or mark assignment COMPLETED / REVOKED."""
    return await update_duty_assignment(
        db=db,
        admin_user=admin_user,
        assignment_id=assignment_id,
        req=req
    )

@router.get("/my", response_model=Optional[DutyAssignmentResponse])
async def get_my_active_assignment(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Constable: Get current active duty assignment and assigned geofence information."""
    user_id = str(current_user["_id"])
    asgn = await get_active_assignment_for_constable(db, user_id)
    if not asgn:
        # Fallback to primary headquarters
        primary = await db.headquarters.find_one({"is_primary": True})
        if not primary:
            primary = await db.headquarters.find_one()
        if not primary:
            return None
        return DutyAssignmentResponse(
            id="default-primary",
            assignment_id="DEFAULT-HQ",
            officer_id=current_user.get("username", "CONSTABLE"),
            user_id=user_id,
            full_name=current_user.get("username", "Constable"),
            rank="Police Constable",
            department="District Police",
            mobile_number="",
            location_id=str(primary["_id"]),
            location_name=primary.get("name", "Police Headquarters"),
            location_code=primary.get("code", "AP-HQ"),
            geofence_radius_meters=float(primary.get("radius_meters", 100.0)),
            duty_title="Station Duty",
            duty_description="Primary headquarters assignment",
            start_time=primary.get("created_at"),
            end_time=None,
            status="ACTIVE",
            assigned_by_user_id="SYSTEM",
            assigned_by_username="System Initializer",
            created_at=primary.get("created_at"),
            updated_at=primary.get("updated_at")
        )

    from app.services.assignment_service import _format_assignment
    return _format_assignment(asgn)

@router.get("/constables/available")
async def list_available_constables(
    search: Optional[str] = Query(None, description="Search by name, Officer ID, or department"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Search existing registered constables for assignment to duty locations without creating duplicates."""
    query: Dict[str, Any] = {"profile_status": "ACTIVE"}
    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"full_name": {"$regex": s, "$options": "i"}},
            {"officer_id": {"$regex": s, "$options": "i"}},
            {"department": {"$regex": s, "$options": "i"}},
            {"mobile_number": {"$regex": s}}
        ]

    cursor = db.officer_profiles.find(query).limit(100)
    profiles = await cursor.to_list(100)

    results = []
    for p in profiles:
        uid = str(p.get("user_id", ""))
        # Check current active assignment if any
        current_asgn = await db.location_assignments.find_one({
            "user_id": uid,
            "status": "ACTIVE"
        })

        results.append({
            "officer_id": p.get("officer_id"),
            "user_id": uid,
            "full_name": p.get("full_name"),
            "rank": p.get("rank"),
            "department": p.get("department"),
            "mobile_number": p.get("mobile_number"),
            "current_location_id": str(current_asgn["location_id"]) if current_asgn else None,
            "current_location_name": current_asgn.get("location_name") if current_asgn else "Unassigned / Default HQ",
            "current_duty_title": current_asgn.get("duty_title") if current_asgn else None
        })
    return results
