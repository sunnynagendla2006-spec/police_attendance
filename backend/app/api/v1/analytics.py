from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.analytics import OverviewStats, DailyTrendItem, AnalyticsResponse, RecentActivityItem
from app.services.auth_service import require_roles
from app.services.analytics_service import (
    compute_overview_stats,
    compute_daily_trends,
    get_full_analytics,
    get_recent_activity
)

router = APIRouter(prefix="/analytics", tags=["Headquarters Analytics"])

@router.get("/overview", response_model=OverviewStats)
async def get_overview(
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve top-level dashboard metrics for Eluru Headquarters."""
    return await compute_overview_stats(db)

@router.get("/daily", response_model=List[DailyTrendItem])
async def get_daily(
    days: int = 7,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve daily attendance trends and duration averages."""
    return await compute_daily_trends(db, days=days)

@router.get("/full", response_model=AnalyticsResponse)
async def get_full(
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve full analytics compilation for reports and visual charts."""
    return await get_full_analytics(db)

@router.get("/activity", response_model=List[RecentActivityItem])
async def get_activity(
    query: Optional[str] = Query(None, description="Search by Officer name or Police ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    status: Optional[str] = Query(None, description="Filter by event status"),
    limit: int = Query(25, ge=1, le=100),
    skip: int = Query(0, ge=0),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve live geofence and attendance activity ledger events."""
    return await get_recent_activity(
        db=db,
        skip=skip,
        limit=limit,
        query=query,
        event_type=event_type,
        status=status
    )

