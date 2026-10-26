import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash plain text password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain text password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def extract_initial_password(mobile_number: str) -> str:
    """
    Extract the initial password as the last 4 digits of the registered mobile number.
    e.g. '9876543210' -> '3210'.
    """
    digits = re.sub(r"\D", "", mobile_number)
    if len(digits) < 4:
        raise ValueError("Mobile number must contain at least 4 numeric digits")
    return digits[-4:]

def validate_new_password(new_password: str, initial_password: str) -> tuple[bool, str]:
    """
    Validate police password policy:
    1. Minimum 8 characters.
    2. Cannot be identical to the initial 4-digit temporary password.
    3. Must contain at least one digit and one letter.
    """
    if len(new_password) < 8:
        return False, "Password must be at least 8 characters long"
    if new_password.strip() == initial_password.strip():
        return False, "New password cannot be identical to the initial temporary password"
    if not any(c.isdigit() for c in new_password):
        return False, "Password must contain at least one numeric digit"
    if not any(c.isalpha() for c in new_password):
        return False, "Password must contain at least one letter"
    return True, "Valid password"

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access"
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh"
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
