from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Police Officer or Admin Username")
    password: str = Field(..., min_length=4, max_length=128, description="Password (Initial password: last 4 digits of mobile number)")
    device_id: Optional[str] = Field(None, description="Secure hardware/keystore-backed device ID")
    device_model: Optional[str] = Field(None, description="Mobile device model")
    os_version: Optional[str] = Field(None, description="Android OS version")
    app_version: Optional[str] = Field("1.0.0", description="App release version")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=4, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters with letters and numbers")
    confirm_password: str = Field(..., min_length=8, max_length=128)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    username: str
    reason: str = Field(..., min_length=5, description="Operational explanation for password recovery")

class AdminResetPasswordRequest(BaseModel):
    user_id: str
    reason: str = Field(..., min_length=5, description="Administrative reason for resetting password to temporary mobile digits")

class OfficerProfileBrief(BaseModel):
    officer_id: str
    full_name: str
    rank: str
    department: str
    mobile_number: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    account_status: str
    must_change_password: bool
    assigned_location_ids: List[str] = []
    created_at: datetime
    last_login_at: Optional[datetime] = None
    profile: Optional[OfficerProfileBrief] = None

class AdminLocationAssignmentRequest(BaseModel):
    admin_user_id: str
    assigned_location_ids: List[str]
    audit_reason: str = Field(..., min_length=3, description="Super Admin reason for setting admin location permissions")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool
    user: UserResponse
