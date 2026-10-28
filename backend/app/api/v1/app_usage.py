from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.app_usage import (
    AppUsageSubmission,
    AppUsageSummaryItem,
    AppUsagePolicyConfig,
    AppUsagePolicyUpdate,
    AppUsageItem
)
from app.services.auth_service import require_roles, get_current_user, get_permitted_location_ids
from app.services.assignment_service import get_active_assignment_for_constable
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/app-usage", tags=["App Usage Summaries"])

async def _get_or_create_usage_policy(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    policy = await db.app_usage_policies.find_one({"is_active": True})
    if not policy:
        now = datetime.now(timezone.utc)
        policy = {
            "enabled": True,
            "usage_threshold_minutes": 30,
            "approved_work_packages": [
                "com.policehq.geoattend",
                "com.google.android.apps.maps",
                "com.whatsapp",
                "com.android.dialer",
                "com.android.contacts",
                "org.telegram.messenger"
            ],
            "is_active": True,
            "updated_at": now,
            "updated_by": "SYSTEM"
        }
        res = await db.app_usage_policies.insert_one(policy)
        policy["_id"] = res.inserted_id
    return policy

@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_app_usage(
    req: AppUsageSubmission,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Constable Mobile App: Submit aggregate foreground-usage statistics.
    Only permitted foreground durations are collected with full officer disclosure.
    No private messages, keystrokes, screenshots, or browsing data are collected.
    """
    user_id_str = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    # 1. Lookup policy threshold
    policy = await _get_or_create_usage_policy(db)
    threshold = policy.get("usage_threshold_minutes", 30)
    work_pkgs = set(policy.get("approved_work_packages", []))

    # 2. Lookup officer profile
    profile = await db.officer_profiles.find_one({"user_id": user_id_str})
    if profile and profile.get("app_usage_collection_enabled") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="App-usage collection is not enabled for this personnel account. Explicit administrator activation is required."
        )

    officer_id = profile.get("officer_id", current_user.get("username", "CONSTABLE")) if profile else current_user.get("username", "CONSTABLE")
    officer_name = profile.get("full_name", current_user.get("username")) if profile else current_user.get("username")
    rank = profile.get("rank", "Constable") if profile else "Constable"
    department = profile.get("department", "Police") if profile else "Police"

    # 3. Lookup duty assignment
    asgn = await get_active_assignment_for_constable(db, user_id_str)
    location_id = str(asgn["location_id"]) if asgn else "default"
    location_name = asgn.get("location_name", "Headquarters") if asgn else "Headquarters"

    # 4. Classify apps
    apps_data = []
    exceeding = []
    for app in req.apps:
        is_work = app.package_name in work_pkgs or app.is_work_app
        app_dict = {
            "package_name": app.package_name,
            "app_name": app.app_name,
            "foreground_duration_minutes": round(app.foreground_duration_minutes, 1),
            "is_work_app": is_work
        }
        apps_data.append(app_dict)
        if app.foreground_duration_minutes >= threshold:
            exceeding.append(app_dict)

    doc = {
        "user_id": user_id_str,
        "officer_id": officer_id,
        "officer_name": officer_name,
        "rank": rank,
        "department": department,
        "assigned_location_id": location_id,
        "assigned_location_name": location_name,
        "reporting_date": req.reporting_date,
        "total_foreground_minutes": round(req.total_foreground_minutes, 1),
        "permission_granted": req.permission_granted,
        "apps_count": len(apps_data),
        "apps": apps_data,
        "apps_exceeding_threshold": exceeding,
        "collected_at": req.collected_at or now,
        "created_at": now
    }

    # Upsert for date + officer
    await db.app_usage_summaries.update_one(
        {"user_id": user_id_str, "reporting_date": req.reporting_date},
        {"$set": doc},
        upsert=True
    )

    return {
        "status": "SUCCESS",
        "message": f"App usage summary recorded for {req.reporting_date} ({len(exceeding)} apps exceeded {threshold}m threshold).",
        "threshold_minutes": threshold,
        "apps_exceeding_threshold_count": len(exceeding)
    }

@router.get("", response_model=List[AppUsageSummaryItem])
async def list_app_usage_summaries(
    date: Optional[str] = Query(None, description="Reporting date YYYY-MM-DD"),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    officer_id: Optional[str] = Query(None, description="Filter by constable Officer ID"),
    exceeding_only: bool = Query(False, description="Filter only records with apps > 30 minutes"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve app usage summaries filtered by authorized locations and duty personnel."""
    permitted_locs = await get_permitted_location_ids(current_user, db)
    query: Dict[str, Any] = {}

    if permitted_locs is not None:
        if location_id:
            if location_id not in permitted_locs:
                raise HTTPException(status_code=403, detail="Access denied to requested location.")
            query["assigned_location_id"] = location_id
        else:
            query["assigned_location_id"] = {"$in": permitted_locs}
    elif location_id:
        query["assigned_location_id"] = location_id

    if date:
        query["reporting_date"] = date
    if officer_id and officer_id.strip():
        query["officer_id"] = {"$regex": f"^{officer_id.strip()}$", "$options": "i"}
    if exceeding_only:
        query["apps_exceeding_threshold.0"] = {"$exists": True}

    cursor = db.app_usage_summaries.find(query).sort("created_at", -1).limit(200)
    docs = await cursor.to_list(200)

    results = []
    for d in docs:
        ex_apps = [
            AppUsageItem(
                package_name=x["package_name"],
                app_name=x["app_name"],
                foreground_duration_minutes=x["foreground_duration_minutes"],
                is_work_app=x.get("is_work_app", False)
            ) for x in d.get("apps_exceeding_threshold", [])
        ]
        results.append(AppUsageSummaryItem(
            id=str(d["_id"]),
            officer_id=d.get("officer_id", "UNKNOWN"),
            officer_name=d.get("officer_name", "Officer"),
            rank=d.get("rank", "Constable"),
            department=d.get("department", "Police"),
            assigned_location_name=d.get("assigned_location_name", "Headquarters"),
            reporting_date=d.get("reporting_date", ""),
            total_foreground_minutes=float(d.get("total_foreground_minutes", 0.0)),
            permission_granted=d.get("permission_granted", True),
            apps_count=int(d.get("apps_count", len(d.get("apps", [])))),
            apps_exceeding_threshold=ex_apps,
            collected_at=d.get("collected_at", d.get("created_at", datetime.now(timezone.utc)))
        ))
    return results

@router.get("/policy", response_model=AppUsagePolicyConfig)
async def get_app_usage_policy(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve organization-wide app-usage collection threshold and approved work apps."""
    policy = await _get_or_create_usage_policy(db)
    return AppUsagePolicyConfig(
        enabled=policy.get("enabled", True),
        usage_threshold_minutes=int(policy.get("usage_threshold_minutes", 30)),
        approved_work_packages=policy.get("approved_work_packages", []),
        updated_at=policy.get("updated_at"),
        updated_by=policy.get("updated_by", "SYSTEM")
    )

@router.patch("/policy", response_model=AppUsagePolicyConfig)
async def update_app_usage_policy(
    req: AppUsagePolicyUpdate,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Admin: Update usage reporting threshold and approved police work apps."""
    policy = await _get_or_create_usage_policy(db)
    now = datetime.now(timezone.utc)

    updates: Dict[str, Any] = {"updated_at": now, "updated_by": admin_user["username"]}
    if req.enabled is not None:
        updates["enabled"] = req.enabled
    
    threshold = req.usage_threshold_minutes if req.usage_threshold_minutes is not None else req.warning_threshold_minutes
    if threshold is not None:
        updates["usage_threshold_minutes"] = threshold
    if req.approved_work_packages is not None:
        updates["approved_work_packages"] = req.approved_work_packages

    await db.app_usage_policies.update_one({"_id": policy["_id"]}, {"$set": updates})

    # Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="APP_USAGE_POLICY_UPDATED",
        target_type="configuration",
        target_id=str(policy["_id"]),
        reason=(req.change_reason.strip() if (req.change_reason and req.change_reason.strip()) else "Administrator updated app usage policy via web portal"),
        metadata=updates
    )

    updated = await db.app_usage_policies.find_one({"_id": policy["_id"]})
    return AppUsagePolicyConfig(
        enabled=updated.get("enabled", True),
        usage_threshold_minutes=int(updated.get("usage_threshold_minutes", 30)),
        approved_work_packages=updated.get("approved_work_packages", []),
        updated_at=updated.get("updated_at", now),
        updated_by=updated.get("updated_by", "SYSTEM")
    )
