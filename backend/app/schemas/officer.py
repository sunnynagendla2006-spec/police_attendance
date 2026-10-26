from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class OfficerCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique login username")
    officer_id: str = Field(..., min_length=3, max_length=50, description="Police ID / Badge Number, e.g. ELR-PC-102")
    full_name: str = Field(..., min_length=2, max_length=100)
    rank: str = Field(..., min_length=2, max_length=50, description="Designation / Rank")
    mobile_number: str = Field(..., min_length=10, max_length=15, description="Registered 10-digit mobile number")
    department: str = Field(..., min_length=2, max_length=100, description="Unit / Police Station")

    @field_validator("username")
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("mobile_number")
    def validate_mobile(cls, v: str) -> str:
        cleaned = "".join(filter(str.isdigit, v))
        if len(cleaned) < 10:
            raise ValueError("Mobile number must contain at least 10 digits")
        return cleaned

class OfficerUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    rank: Optional[str] = None
    mobile_number: Optional[str] = None
    department: Optional[str] = None
    account_status: Optional[str] = None  # ACTIVE, INACTIVE, LOCKED

class OfficerResponse(BaseModel):
    id: str
    user_id: str
    officer_id: str
    username: str
    full_name: str
    rank: str
    mobile_number: str
    department: str
    account_status: str
    profile_status: str
    must_change_password: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    current_state: Optional[str] = "UNKNOWN"
    last_seen_at: Optional[datetime] = None
    distance_meters: Optional[float] = None
