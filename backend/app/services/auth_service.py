import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from bson import ObjectId
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.core.database import get_database
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    extract_initial_password,
    validate_new_password
)
from app.services.audit_service import record_audit_log

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def authenticate_user(
    db: AsyncIOMotorDatabase,
    username: str,
    password: str
) -> Dict[str, Any]:
    """Authenticate username and password against MongoDB users collection."""
    username_clean = username.strip().lower()
    user = await db.users.find_one({"username": username_clean})

    # 2. If not found by username, support searching by Police Officer ID (e.g. N210842, ELR-PC-101)
    if not user:
        profile = await db.officer_profiles.find_one({
            "officer_id": {"$regex": f"^{username.strip()}$", "$options": "i"}
        })
        if profile and profile.get("user_id"):
            try:
                user = await db.users.find_one({"_id": ObjectId(profile["user_id"])})
            except Exception:
                user = await db.users.find_one({"_id": str(profile["user_id"])})

    # 3. If not found, support searching by Mobile Number (e.g. 8121216628, 9876543210, +91 8121216628)
    if not user:
        clean_digits = "".join(filter(str.isdigit, username.strip()))
        if len(clean_digits) >= 4:
            search_digits = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits
            profile = await db.officer_profiles.find_one({
                "$or": [
                    {"mobile_number": username.strip()},
                    {"mobile_number": clean_digits},
                    {"mobile_number": search_digits},
                    {"mobile_number": {"$regex": search_digits}}
                ]
            })
            if profile and profile.get("user_id"):
                try:
                    user = await db.users.find_one({"_id": ObjectId(profile["user_id"])})
                except Exception:
                    user = await db.users.find_one({"_id": str(profile["user_id"])})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Check account status
    if user.get("account_status") != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.get('account_status', 'INACTIVE')}. Contact administrator."
        )

    # Check temporary lockout
    now = datetime.now(timezone.utc)
    locked_until = user.get("locked_until")
    if locked_until:
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            minutes_left = max(1, int((locked_until - now).total_seconds() / 60))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to multiple failed attempts. Try again in {minutes_left} minutes."
            )

    # Verify password hash or mobile last 4 digits
    password_valid = verify_password(password, user["password_hash"])
    if not password_valid:
        # Check if entered password matches the last 4 digits of officer's registered mobile number
        profile_match = await db.officer_profiles.find_one({"user_id": str(user["_id"])})
        if not profile_match:
            try:
                profile_match = await db.officer_profiles.find_one({"user_id": ObjectId(user["_id"])})
            except Exception:
                profile_match = None
        if profile_match and profile_match.get("mobile_number"):
            mobile_digits = "".join(filter(str.isdigit, profile_match["mobile_number"]))
            if len(mobile_digits) >= 4 and password.strip() == mobile_digits[-4:]:
                password_valid = True
                # Rehash password as mobile last 4 digits for fast verification
                try:
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {"$set": {"password_hash": hash_password(password.strip()), "must_change_password": False}}
                    )
                except Exception:
                    pass

    if not password_valid:
        failed_attempts = user.get("failed_login_attempts", 0) + 1
        update_fields: Dict[str, Any] = {"failed_login_attempts": failed_attempts}
        
        if failed_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
            update_fields["locked_until"] = now + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
            logger.warning(f"Account {username_clean} locked for {settings.LOCKOUT_DURATION_MINUTES} minutes.")

        await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Successful login: reset failed attempts & update last_login, clear must_change_password
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "failed_login_attempts": 0,
            "locked_until": None,
            "last_login_at": now,
            "must_change_password": False,
            "updated_at": now
        }}
    )
    user["last_login_at"] = now
    user["must_change_password"] = False
    return user

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """Validate Bearer JWT access token and return active user object."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"_id": user_id})

    if user is None:
        raise credentials_exception

    if user.get("account_status") != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")

    # Enforce mandatory first-login password change on all operational endpoints
    # Allowed endpoints without password change: /auth/change-password, /auth/me, /auth/logout
    path = request.url.path
    allowed_pending_paths = ["/api/v1/auth/change-password", "/api/v1/auth/me", "/api/v1/auth/logout"]
    if user.get("must_change_password", False) and path not in allowed_pending_paths:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="First-login security: Mandatory password change required before accessing system."
        )

    return user

def require_roles(allowed_roles: List[str]):
    """Role-based access control dependency factory."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in {allowed_roles}, your role is '{user_role}'"
            )
        return current_user
    return role_checker

async def get_current_active_officer(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """Retrieve officer profile associated with authenticated user."""
    profile = await db.officer_profiles.find_one({"user_id": str(current_user["_id"])})
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer profile record not found for this account"
        )
    return profile
