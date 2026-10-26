import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import hash_password, extract_initial_password
from app.schemas.officer import OfficerCreateRequest, OfficerUpdateRequest, OfficerResponse
from app.services.audit_service import record_audit_log

logger = logging.getLogger(__name__)

async def create_officer_account(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    req: OfficerCreateRequest
) -> OfficerResponse:
    """
    Register a new police officer in MongoDB:
    1. Validate unique username and officer_id.
    2. Extract initial password as last 4 digits of registered mobile number.
    3. Hash initial password.
    4. Set must_change_password = True (First-Login Security).
    5. Save in users and officer_profiles collections.
    6. Record administrative audit log.
    """
    username = req.username.strip().lower()

    # 1. Check uniqueness
    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{username}' is already registered."
        )

    existing_profile = await db.officer_profiles.find_one({"officer_id": req.officer_id.strip()})
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Officer ID '{req.officer_id}' is already registered."
        )

    # 2. Extract initial password from last 4 digits of mobile
    initial_pw = extract_initial_password(req.mobile_number)
    pw_hash = hash_password(initial_pw)

    now = datetime.now(timezone.utc)

    # 3. Insert User
    user_doc = {
        "username": username,
        "password_hash": pw_hash,
        "role": "constable",
        "account_status": "ACTIVE",
        "must_change_password": True,  # Mandatory first-login change!
        "failed_login_attempts": 0,
        "locked_until": None,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None
    }
    user_res = await db.users.insert_one(user_doc)
    user_id = str(user_res.inserted_id)

    # 4. Insert Officer Profile
    profile_doc = {
        "user_id": user_id,
        "officer_id": req.officer_id.strip(),
        "full_name": req.full_name.strip(),
        "rank": req.rank.strip(),
        "mobile_number": req.mobile_number.strip(),
        "department": req.department.strip(),
        "profile_status": "ACTIVE",
        "created_at": now,
        "updated_at": now
    }
    prof_res = await db.officer_profiles.insert_one(profile_doc)
    profile_id = str(prof_res.inserted_id)

    # 5. Record Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="OFFICER_REGISTERED",
        target_type="officer_profile",
        target_id=req.officer_id.strip(),
        reason="Administrative onboarding of police personnel",
        metadata={
            "username": username,
            "rank": req.rank,
            "department": req.department,
            "initial_credential_policy": "Last 4 digits of mobile"
        }
    )

    return OfficerResponse(
        id=profile_id,
        user_id=user_id,
        officer_id=req.officer_id.strip(),
        username=username,
        full_name=req.full_name.strip(),
        rank=req.rank.strip(),
        mobile_number=req.mobile_number.strip(),
        department=req.department.strip(),
        account_status="ACTIVE",
        profile_status="ACTIVE",
        must_change_password=True,
        created_at=now,
        last_login_at=None,
        current_state="UNKNOWN"
    )

async def list_officers(
    db: AsyncIOMotorDatabase,
    query: Optional[str] = None,
    department: Optional[str] = None,
    rank: Optional[str] = None,
    account_status: Optional[str] = None,
    limit: int = 200,
    skip: int = 0
) -> List[OfficerResponse]:
    """Retrieve filtered police directory personnel with active location state."""
    filter_dict: Dict[str, Any] = {}
    if department:
        filter_dict["department"] = department
    if rank:
        filter_dict["rank"] = rank
    if query:
        filter_dict["$or"] = [
            {"full_name": {"$regex": query, "$options": "i"}},
            {"officer_id": {"$regex": query, "$options": "i"}}
        ]

    cursor = db.officer_profiles.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    profiles = await cursor.to_list(length=limit)

    results = []
    for p in profiles:
        user = await db.users.find_one({"_id": ObjectId(p["user_id"]) if ObjectId.is_valid(p["user_id"]) else p["user_id"]})
        if not user:
            continue

        if account_status and user.get("account_status") != account_status:
            continue

        # Check last location observation
        last_obs = await db.location_observations.find_one(
            {"user_id": p["user_id"]},
            sort=[("observed_at", -1)]
        )

        current_state = "UNKNOWN"
        distance = None
        last_seen = None

        if last_obs:
            last_seen = last_obs.get("observed_at")
            distance = last_obs.get("distance_from_hq_meters")
            
            # Check if stale (> 300s)
            now = datetime.now(timezone.utc)
            obs_time = last_seen
            if obs_time.tzinfo is None:
                obs_time = obs_time.replace(tzinfo=timezone.utc)
            if (now - obs_time).total_seconds() > 300:
                current_state = "LOCATION_STALE"
            else:
                current_state = "INSIDE" if last_obs.get("is_inside_geofence") else "OUTSIDE"

        results.append(OfficerResponse(
            id=str(p["_id"]),
            user_id=p["user_id"],
            officer_id=p["officer_id"],
            username=user.get("username", "unknown"),
            full_name=p["full_name"],
            rank=p["rank"],
            mobile_number=p["mobile_number"],
            department=p["department"],
            account_status=user.get("account_status", "ACTIVE"),
            profile_status=p.get("profile_status", "ACTIVE"),
            must_change_password=user.get("must_change_password", False),
            created_at=p.get("created_at", datetime.now(timezone.utc)),
            last_login_at=user.get("last_login_at"),
            current_state=current_state,
            last_seen_at=last_seen,
            distance_meters=distance
        ))

    return results

async def update_officer_details(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    officer_id: str,
    req: OfficerUpdateRequest
) -> OfficerResponse:
    """Update officer personal details or account status."""
    profile = await db.officer_profiles.find_one({"officer_id": officer_id})
    if not profile:
        raise HTTPException(status_code=404, detail=f"Officer '{officer_id}' not found")

    user_id = profile["user_id"]
    now = datetime.now(timezone.utc)

    prof_updates = {}
    if req.full_name is not None:
        prof_updates["full_name"] = req.full_name.strip()
    if req.rank is not None:
        prof_updates["rank"] = req.rank.strip()
    if req.department is not None:
        prof_updates["department"] = req.department.strip()
    if req.mobile_number is not None:
        prof_updates["mobile_number"] = req.mobile_number.strip()
    
    if prof_updates:
        prof_updates["updated_at"] = now
        await db.officer_profiles.update_one({"_id": profile["_id"]}, {"$set": prof_updates})

    if req.account_status is not None:
        u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        await db.users.update_one(
            {"_id": u_obj_id},
            {"$set": {"account_status": req.account_status, "updated_at": now}}
        )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="OFFICER_UPDATED",
        target_type="officer_profile",
        target_id=officer_id,
        reason="Administrative personnel update",
        metadata={"changes": prof_updates, "new_status": req.account_status}
    )

    # Return refreshed object
    refreshed_prof = await db.officer_profiles.find_one({"_id": profile["_id"]})
    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})

    return OfficerResponse(
        id=str(refreshed_prof["_id"]),
        user_id=user_id,
        officer_id=officer_id,
        username=user.get("username", ""),
        full_name=refreshed_prof["full_name"],
        rank=refreshed_prof["rank"],
        mobile_number=refreshed_prof["mobile_number"],
        department=refreshed_prof["department"],
        account_status=user.get("account_status", "ACTIVE"),
        profile_status=refreshed_prof.get("profile_status", "ACTIVE"),
        must_change_password=user.get("must_change_password", False),
        created_at=refreshed_prof.get("created_at", now),
        last_login_at=user.get("last_login_at"),
        current_state="UNKNOWN"
    )
