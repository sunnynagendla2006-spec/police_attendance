from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.location_schedule import (
    ScheduledLocationSnapshotSubmit,
    ScheduledLocationSnapshotResponse,
    OutsideGeofenceObservation,
    LocationScheduleConfig,
    LocationScheduleConfigUpdate
)
from app.services.auth_service import require_roles, get_current_user
from app.services.snapshot_service import (
    record_scheduled_snapshot,
    list_scheduled_snapshots,
    list_outside_geofence_observations,
    get_or_create_schedule_config,
    update_schedule_config
)

router = APIRouter(prefix="/snapshots", tags=["Scheduled Location Snapshots"])

@router.post("", response_model=ScheduledLocationSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def submit_snapshot(
    req: ScheduledLocationSnapshotSubmit,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Constable Mobile App: Submit authorized scheduled location snapshot."""
    return await record_scheduled_snapshot(db=db, officer_user=current_user, req=req)

@router.get("", response_model=List[ScheduledLocationSnapshotResponse])
async def get_snapshots(
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    slot: Optional[str] = Query(None, description="MORNING_1000, EVENING_1800, ADHOC, ALL"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="INSIDE, OUTSIDE, UNCERTAIN_ACCURACY, DELAYED, ALL"),
    search: Optional[str] = Query(None, description="Search personnel name or ID"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve scheduled location snapshots filtered by role and permitted locations."""
    return await list_scheduled_snapshots(
        db=db,
        current_user=current_user,
        location_id=location_id,
        slot=slot,
        date_str=date,
        status_filter=status,
        search=search
    )

@router.get("/outside-geofence", response_model=List[OutsideGeofenceObservation])
async def get_outside_geofence_report(
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    officer_id: Optional[str] = Query(None, description="Filter by Officer ID"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Search constable or location"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve out-of-premises reporting: All observations recorded outside assigned duty geofence."""
    return await list_outside_geofence_observations(
        db=db,
        current_user=current_user,
        location_id=location_id,
        officer_id=officer_id,
        date_str=date,
        search=search
    )

@router.get("/schedule-config", response_model=LocationScheduleConfig)
async def get_schedule_settings(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve organization-wide reporting and location snapshot schedule."""
    cfg = await get_or_create_schedule_config(db)
    return LocationScheduleConfig(
        timezone=cfg.get("timezone", "Asia/Kolkata"),
        morning_snapshot_time=cfg.get("morning_snapshot_time", "10:00"),
        evening_snapshot_time=cfg.get("evening_snapshot_time", "18:00"),
        morning_report_time=cfg.get("morning_report_time", "10:30"),
        evening_report_time=cfg.get("evening_report_time", "17:00"),
        grace_period_minutes=int(cfg.get("grace_period_minutes", 15)),
        stale_threshold_seconds=int(cfg.get("stale_threshold_seconds", 300)),
        updated_at=cfg.get("updated_at"),
        updated_by=cfg.get("updated_by", "SYSTEM")
    )

@router.patch("/schedule-config", response_model=LocationScheduleConfig)
async def update_schedule_settings(
    req: LocationScheduleConfigUpdate,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Super Admin: Configure morning/evening snapshot times and reporting schedule."""
    return await update_schedule_config(db=db, admin_user=admin_user, req=req)
