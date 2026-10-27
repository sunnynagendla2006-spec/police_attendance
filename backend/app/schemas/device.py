from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class DeviceRegistrationRequest(BaseModel):
    device_id: str = Field(..., min_length=4, max_length=128, description="Cryptographic device ID or unique hardware-bound UUID")
    device_model: str = Field(..., min_length=2, max_length=100)
    os_version: Optional[str] = Field(None, max_length=50)
    app_version: Optional[str] = Field("1.0.0", max_length=50)
    public_key_pem: Optional[str] = None
    fingerprint_hash: Optional[str] = None

class DeviceRecordResponse(BaseModel):
    id: str
    user_id: str
    officer_id: str
    officer_name: str
    device_id: str
    device_model: str
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    approval_status: str # PENDING, APPROVED, REVOKED
    registered_at: datetime
    last_authenticated_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    approved_by: Optional[str] = None

class DeviceApprovalRequest(BaseModel):
    device_id: str
    approval_status: str = Field(..., pattern="^(APPROVED|REVOKED)$")
    reason: str = Field(..., min_length=3, description="Operational audit reason")

class DeviceReplacementRequest(BaseModel):
    officer_id: Optional[str] = None
    constable_user_id: Optional[str] = None
    user_id: Optional[str] = None
    old_device_id: Optional[str] = None
    new_device_id: Optional[str] = None
    reason: str = Field(..., min_length=3, description="Administrative justification for device reassignment/replacement")
