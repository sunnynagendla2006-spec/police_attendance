from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.officer import OfficerCreateRequest, OfficerUpdateRequest, OfficerResponse
from app.services.auth_service import require_roles, get_current_user
from app.services.officer_service import (
    create_officer_account,
    list_officers,
    update_officer_details
)
from app.services.staff_import_service import import_eluru_staff, get_eluru_staff_designation_summary
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/officers", tags=["Police Personnel Directory"])

@router.get("/statistics/designations")
async def get_designation_statistics(
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve actual database designation breakdown for Eluru District Staff."""
    return await get_eluru_staff_designation_summary(db=db)

@router.post("/import-eluru-staff")
async def trigger_import_eluru_staff(
    location_id: Optional[str] = Query(None, description="Optional target Headquarters ID to assign staff to"),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Import 35 Eluru District Staff records directly into MongoDB.
    Assigns personnel to Eluru Duty Location, avoids duplicates, and preserves existing accounts.
    """
    return await import_eluru_staff(
        db=db,
        admin_user=admin_user,
        target_location_id=location_id
    )

@router.get("", response_model=List[OfficerResponse])
async def get_officers(
    query: Optional[str] = Query(None, description="Search by name, CFMS ID, G.No, Officer ID, or mobile"),
    department: Optional[str] = Query(None, description="Filter by unit/station"),
    rank: Optional[str] = Query(None, description="Filter by rank"),
    designation: Optional[str] = Query(None, description="Filter by cadre designation (AO, Office Supdt, Sr.Asst, Jr.Asst, etc.)"),
    assignment_status: Optional[str] = Query(None, description="Filter by duty assignment status (ACTIVE, UNASSIGNED, etc.)"),
    location_id: Optional[str] = Query(None, description="Filter by duty location ID"),
    account_status: Optional[str] = Query(None, description="Filter by account status"),
    role: Optional[str] = Query(None, description="Filter by user application role"),
    limit: int = Query(500, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve police officers and district staff with search and multi-criteria filtering."""
    return await list_officers(
        db=db,
        query=query,
        department=department,
        rank=rank,
        designation=designation,
        assignment_status=assignment_status,
        location_id=location_id,
        account_status=account_status,
        role=role,
        limit=limit,
        skip=skip
    )

@router.post("", response_model=OfficerResponse, status_code=status.HTTP_201_CREATED)
async def register_officer(
    req: OfficerCreateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Register a new police officer account and initial temporary password."""
    return await create_officer_account(db=db, admin_user=admin_user, req=req)

@router.get("/{officer_id}", response_model=OfficerResponse)
async def get_officer(
    officer_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve individual officer details."""
    # Ensure constables and staff can only view their own profile
    user_role = current_user.get("role")
    if user_role in ("constable", "staff"):
        my_profile = await db.officer_profiles.find_one({"user_id": str(current_user["_id"])})
        if not my_profile or my_profile.get("officer_id") != officer_id:
            raise HTTPException(status_code=403, detail="Staff and constables can only access their own profile.")

    officers = await list_officers(db=db, query=officer_id, limit=1)
    if not officers or officers[0].officer_id != officer_id:
        raise HTTPException(status_code=404, detail=f"Officer '{officer_id}' not found")
    return officers[0]

@router.patch("/{officer_id}", response_model=OfficerResponse)
async def update_officer(
    officer_id: str,
    req: OfficerUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update officer personnel details or account status."""
    return await update_officer_details(
        db=db,
        admin_user=admin_user,
        officer_id=officer_id,
        req=req
    )

@router.post("/{officer_id}/deactivate")
async def deactivate_officer(
    officer_id: str,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Deactivate police personnel account (Super Admin only)."""
    profile = await db.officer_profiles.find_one({"officer_id": officer_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Officer not found")

    user_id = profile["user_id"]
    from bson import ObjectId
    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": {"account_status": "INACTIVE"}}
    )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="OFFICER_DEACTIVATED",
        target_type="officer_profile",
        target_id=officer_id,
        reason="Super Admin deactivated personnel account"
    )

    return {"status": "SUCCESS", "message": f"Officer {officer_id} deactivated."}
