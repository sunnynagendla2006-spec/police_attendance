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
    designation: Optional[str] = None,
    assignment_status: Optional[str] = None,
    location_id: Optional[str] = None,
    account_status: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = 500,
    skip: int = 0
) -> List[OfficerResponse]:
    """Retrieve filtered police directory personnel with active location state and staff fields."""
    filter_dict: Dict[str, Any] = {}
    if department:
        filter_dict["department"] = department
    if rank:
        filter_dict["rank"] = rank
    if designation:
        desig_clean = designation.strip()
        filter_dict["$or"] = [
            {"designation": {"$regex": f"^{re.escape(desig_clean)}$", "$options": "i"}},
            {"rank": {"$regex": f"^{re.escape(desig_clean)}$", "$options": "i"}}
        ]
    if location_id:
        filter_dict["duty_location_id"] = location_id
    if assignment_status:
        filter_dict["assignment_status"] = assignment_status.upper()
    if query:
        q = query.strip()
        existing_or = filter_dict.get("$or", [])
        search_or = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"officer_id": {"$regex": q, "$options": "i"}},
            {"cfms_id": {"$regex": q, "$options": "i"}},
            {"g_no": {"$regex": q, "$options": "i"}},
            {"mobile_number": {"$regex": q, "$options": "i"}},
            {"designation": {"$regex": q, "$options": "i"}}
        ]
        if existing_or:
            filter_dict["$and"] = [{"$or": existing_or}, {"$or": search_or}]
            del filter_dict["$or"]
        else:
            filter_dict["$or"] = search_or

    cursor = db.officer_profiles.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    profiles = await cursor.to_list(length=limit)

    results = []
    for p in profiles:
        user = await db.users.find_one({"_id": ObjectId(p["user_id"]) if ObjectId.is_valid(p["user_id"]) else p["user_id"]})
        if not user:
            continue

        if account_status and user.get("account_status") != account_status:
            continue

        if role and user.get("role") != role:
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

        # Duty location and assignment status
        duty_loc_id = p.get("duty_location_id")
        duty_loc_name = p.get("duty_location_name")
        asgn_status = p.get("assignment_status") or ("ACTIVE" if duty_loc_id else "UNASSIGNED")

        # If duty location is not stored directly on profile, query location_assignments
        if not duty_loc_name:
            asgn = await db.location_assignments.find_one(
                {"$or": [{"user_id": p["user_id"]}, {"officer_id": p["officer_id"]}], "status": "ACTIVE"},
                sort=[("created_at", -1)]
            )
            if asgn:
                duty_loc_id = str(asgn.get("location_id"))
                duty_loc_name = asgn.get("location_name")
                asgn_status = asgn.get("status", "ACTIVE")

        results.append(OfficerResponse(
            id=str(p["_id"]),
            user_id=p["user_id"],
            officer_id=p["officer_id"],
            username=user.get("username", "unknown"),
            full_name=p["full_name"],
            rank=p.get("rank") or p.get("designation") or "Staff",
            designation=p.get("designation") or p.get("rank"),
            gender=p.get("gender"),
            cfms_id=p.get("cfms_id"),
            g_no=p.get("g_no"),
            mobile_number=p["mobile_number"],
            department=p["department"],
            account_status=user.get("account_status", "ACTIVE"),
            profile_status=p.get("profile_status", "ACTIVE"),
            must_change_password=user.get("must_change_password", False),
            created_at=p.get("created_at", datetime.now(timezone.utc)),
            last_login_at=user.get("last_login_at"),
            current_state=current_state,
            last_seen_at=last_seen,
            distance_meters=distance,
            duty_location_id=duty_loc_id,
            duty_location_name=duty_loc_name,
            assignment_status=asgn_status,
            role=user.get("role", "staff"),
            tracking_enabled=p.get("tracking_enabled", False),
            import_batch_id=p.get("import_batch_id")
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
    if req.designation is not None:
        prof_updates["designation"] = req.designation.strip()
        prof_updates["rank"] = req.designation.strip()
    if req.gender is not None:
        prof_updates["gender"] = req.gender.strip().upper()
    if req.cfms_id is not None:
        prof_updates["cfms_id"] = req.cfms_id.strip() if req.cfms_id.strip() else None
    if req.g_no is not None:
        prof_updates["g_no"] = req.g_no.strip() if req.g_no.strip() else None
    if req.department is not None:
        prof_updates["department"] = req.department.strip()
    if req.mobile_number is not None:
        prof_updates["mobile_number"] = req.mobile_number.strip()
    if req.duty_location_id is not None:
        prof_updates["duty_location_id"] = req.duty_location_id
    if req.assignment_status is not None:
        prof_updates["assignment_status"] = req.assignment_status
    
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
        rank=refreshed_prof.get("rank") or refreshed_prof.get("designation") or "Staff",
        designation=refreshed_prof.get("designation") or refreshed_prof.get("rank"),
        gender=refreshed_prof.get("gender"),
        cfms_id=refreshed_prof.get("cfms_id"),
        g_no=refreshed_prof.get("g_no"),
        mobile_number=refreshed_prof["mobile_number"],
        department=refreshed_prof["department"],
        account_status=user.get("account_status", "ACTIVE"),
        profile_status=refreshed_prof.get("profile_status", "ACTIVE"),
        must_change_password=user.get("must_change_password", False),
        created_at=refreshed_prof.get("created_at", now),
        last_login_at=user.get("last_login_at"),
        current_state="UNKNOWN",
        duty_location_id=refreshed_prof.get("duty_location_id"),
        duty_location_name=refreshed_prof.get("duty_location_name"),
        assignment_status=refreshed_prof.get("assignment_status", "ACTIVE"),
        role=user.get("role", "staff"),
        tracking_enabled=refreshed_prof.get("tracking_enabled", False),
        import_batch_id=refreshed_prof.get("import_batch_id")
    )
