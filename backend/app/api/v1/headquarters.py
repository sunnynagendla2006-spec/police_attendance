from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.headquarters import (
    HeadquartersResponse,
    HeadquartersCreateRequest,
    HeadquartersUpdateRequest,
    HeadquartersStatusUpdateRequest,
    HeadquartersHistoryItem,
    GeofenceConfigResponse,
    GeofenceConfigUpdateRequest,
    GeofenceHistoryResponse
)
from app.services.auth_service import require_roles, get_current_user
from app.services.headquarters_service import (
    get_headquarters_info,
    get_active_headquarters,
    get_all_headquarters,
    get_headquarters_by_id,
    create_headquarters,
    update_headquarters,
    set_primary_headquarters,
    update_headquarters_status,
    get_headquarters_change_history,
    get_current_geofence_config,
    update_geofence_config,
    get_geofence_history
)

router = APIRouter(prefix="/headquarters", tags=["Headquarters & Geofencing"])

@router.get("", response_model=HeadquartersResponse)
async def get_headquarters(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve primary active headquarters metadata and authoritative coordinates."""
    return await get_headquarters_info(db)

@router.get("/active", response_model=HeadquartersResponse)
async def get_active_hq(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Explicitly retrieve current active primary headquarters."""
    return await get_active_headquarters(db)

@router.get("/facilities", response_model=List[HeadquartersResponse])
async def list_facilities(
    search: Optional[str] = Query(None, description="Search by name, code, district, or address"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, INACTIVE, MAINTENANCE, ALL"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List all police headquarters and administrative facilities."""
    return await get_all_headquarters(db, search=search, status_filter=status)

@router.get("/geofence", response_model=GeofenceConfigResponse)
async def get_geofence(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve active geofence radius and parameters."""
    return await get_current_geofence_config(db)

@router.patch("/geofence", response_model=GeofenceConfigResponse)
async def update_geofence(
    req: GeofenceConfigUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update headquarters geofence radius (e.g. 50, 100, 150, 200m).
    Authoritative change is recorded, audited, and broadcasted to live maps.
    """
    return await update_geofence_config(db=db, admin_user=admin_user, req=req)

@router.get("/geofence/history", response_model=GeofenceHistoryResponse)
async def get_history(
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve configuration audit history."""
    return await get_geofence_history(db)

@router.post("", response_model=HeadquartersResponse, status_code=status.HTTP_201_CREATED)
async def create_new_headquarters(
    req: HeadquartersCreateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Register a new headquarters or operational police post."""
    return await create_headquarters(db=db, admin_user=admin_user, req=req)

@router.get("/{headquarters_id}", response_model=HeadquartersResponse)
async def get_hq_details(
    headquarters_id: str,
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve details for a specific headquarters facility."""
    return await get_headquarters_by_id(db=db, hq_id=headquarters_id)

@router.put("/{headquarters_id}", response_model=HeadquartersResponse)
async def update_hq(
    headquarters_id: str,
    req: HeadquartersUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Authoritative update of headquarters details, coordinates, or geofence radius.
    Records historical snapshot and audit log.
    """
    return await update_headquarters(db=db, admin_user=admin_user, hq_id=headquarters_id, req=req)

@router.patch("/{headquarters_id}/primary", response_model=HeadquartersResponse)
async def designate_primary_hq(
    headquarters_id: str,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Set specified facility as primary operational headquarters."""
    return await set_primary_headquarters(db=db, admin_user=admin_user, hq_id=headquarters_id)

@router.patch("/{headquarters_id}/status", response_model=HeadquartersResponse)
async def update_hq_status_route(
    headquarters_id: str,
    req: HeadquartersStatusUpdateRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Activate, deactivate, or set maintenance status for headquarters."""
    return await update_headquarters_status(db=db, admin_user=admin_user, hq_id=headquarters_id, req=req)

@router.get("/{headquarters_id}/history", response_model=List[HeadquartersHistoryItem])
async def get_hq_history(
    headquarters_id: str,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve audit history and location snapshots for specified headquarters."""
    return await get_headquarters_change_history(db=db, hq_id=headquarters_id)
