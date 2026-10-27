from datetime import datetime, timezone
from typing import Dict, Any
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    hash_password,
    extract_initial_password,
    validate_new_password
)
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    ChangePasswordRequest,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    AdminResetPasswordRequest,
    OfficerProfileBrief
)
from app.services.auth_service import (
    authenticate_user,
    get_current_user,
    require_roles
)
from app.services.audit_service import record_audit_log

async def _get_profile_brief(db: AsyncIOMotorDatabase, user_id: str, username: str):
    profile_doc = await db.officer_profiles.find_one({"user_id": user_id})
    if not profile_doc and ObjectId.is_valid(user_id):
        profile_doc = await db.officer_profiles.find_one({"user_id": ObjectId(user_id)})
    if not profile_doc:
        profile_doc = await db.officer_profiles.find_one({
            "$or": [
                {"officer_id": {"$regex": f"^{username.strip()}$", "$options": "i"}},
                {"mobile_number": username.strip()}
            ]
        })
    if profile_doc:
        return OfficerProfileBrief(
            officer_id=profile_doc.get("officer_id", ""),
            full_name=profile_doc.get("full_name", ""),
            rank=profile_doc.get("rank", ""),
            department=profile_doc.get("department", ""),
            mobile_number=profile_doc.get("mobile_number", "")
        )
    return None

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Authenticate user with username and password."""
    user = await authenticate_user(db, req.username, req.password)
    user_id = str(user["_id"])
    role = user.get("role", "constable")
    must_change = user.get("must_change_password", False)

    # Fetch profile if exists
    profile_brief = await _get_profile_brief(db, user_id, user.get("username", ""))

    token_data = {
        "sub": user_id,
        "username": user["username"],
        "role": role,
        "must_change_password": must_change
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    user_resp = UserResponse(
        id=user_id,
        username=user["username"],
        role=role,
        account_status=user.get("account_status", "ACTIVE"),
        must_change_password=must_change,
        created_at=user.get("created_at", datetime.now(timezone.utc)),
        last_login_at=user.get("last_login_at"),
        profile=profile_brief
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=must_change,
        user=user_resp
    )

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Mandatory first-login and regular password change endpoint.
    - Validates current password.
    - Enforces password complexity policy (>=8 chars, alphanumeric).
    - Prevents reusing initial 4-digit mobile temporary password.
    - Updates hash and marks must_change_password = False.
    """
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match."
        )

    # Verify current password
    if not verify_password(req.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    # Get officer profile to check initial password
    user_id = str(current_user["_id"])
    profile = await db.officer_profiles.find_one({"user_id": user_id})
    initial_pw = ""
    if profile and profile.get("mobile_number"):
        initial_pw = extract_initial_password(profile["mobile_number"])

    is_valid, err_msg = validate_new_password(req.new_password, initial_pw)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # Update password
    now = datetime.now(timezone.utc)
    new_hash = hash_password(req.new_password)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "password_hash": new_hash,
            "must_change_password": False,
            "updated_at": now
        }}
    )

    # Record audit log
    await record_audit_log(
        db=db,
        actor_user_id=user_id,
        actor_username=current_user["username"],
        action="PASSWORD_CHANGED",
        target_type="user",
        target_id=user_id,
        reason="User successfully changed password",
        metadata={"first_login_resolved": current_user.get("must_change_password", False)}
    )

    return {"status": "SUCCESS", "message": "Password changed successfully."}

@router.post("/refresh")
async def refresh_token(req: RefreshTokenRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Refresh JWT access token using valid refresh token."""
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user or user.get("account_status") != "ACTIVE":
        raise HTTPException(status_code=401, detail="User not found or inactive")

    token_data = {
        "sub": str(user["_id"]),
        "username": user["username"],
        "role": user.get("role", "constable"),
        "must_change_password": user.get("must_change_password", False)
    }
    new_access_token = create_access_token(token_data)
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get current authenticated user profile."""
    user_id = str(current_user["_id"])
    profile_brief = await _get_profile_brief(db, user_id, current_user.get("username", ""))

    return UserResponse(
        id=user_id,
        username=current_user["username"],
        role=current_user.get("role", "constable"),
        account_status=current_user.get("account_status", "ACTIVE"),
        must_change_password=current_user.get("must_change_password", False),
        created_at=current_user.get("created_at", datetime.now(timezone.utc)),
        last_login_at=current_user.get("last_login_at"),
        profile=profile_brief
    )

@router.post("/reset-password")
async def admin_reset_password(
    req: AdminResetPasswordRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Administrative account recovery:
    Resets officer password to the last 4 digits of their registered mobile number,
    sets must_change_password = True, and records an audited entry with reason.
    """
    target_user = await db.users.find_one({"_id": ObjectId(req.user_id) if ObjectId.is_valid(req.user_id) else req.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    profile = await db.officer_profiles.find_one({"user_id": req.user_id})
    if not profile or not profile.get("mobile_number"):
        raise HTTPException(status_code=400, detail="Officer profile or mobile number not found")

    initial_pw = extract_initial_password(profile["mobile_number"])
    new_hash = hash_password(initial_pw)
    now = datetime.now(timezone.utc)

    await db.users.update_one(
        {"_id": target_user["_id"]},
        {"$set": {
            "password_hash": new_hash,
            "must_change_password": True,
            "failed_login_attempts": 0,
            "locked_until": None,
            "updated_at": now
        }}
    )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="ADMIN_PASSWORD_RESET",
        target_type="user",
        target_id=req.user_id,
        reason=req.reason,
        metadata={
            "target_username": target_user["username"],
            "officer_id": profile["officer_id"]
        }
    )

    return {
        "status": "SUCCESS",
        "message": f"Password reset to initial temporary 4-digit mobile credential for {target_user['username']}."
    }
