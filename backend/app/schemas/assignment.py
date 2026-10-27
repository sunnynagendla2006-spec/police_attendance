from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class DutyAssignmentCreateRequest(BaseModel):
    officer_id: Optional[str] = None
    constable_user_id: Optional[str] = None
    user_id: Optional[str] = None
    location_id: str = Field(..., min_length=1, description="Target Location / Headquarters ID")
    duty_title: Optional[str] = "General Duty"
    duty_description: Optional[str] = None
    notes: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class DutyAssignmentUpdateRequest(BaseModel):
    duty_title: Optional[str] = None
    duty_description: Optional[str] = None
    notes: Optional[str] = None
    end_time: Optional[datetime] = None
    end_date: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(ACTIVE|COMPLETED|REVOKED|CANCELLED)$")
    reason: Optional[str] = "Administrative update"

class DutyAssignmentResponse(BaseModel):
    id: str
    assignment_id: str
    officer_id: str
    user_id: str
    full_name: str
    rank: str
    department: str
    mobile_number: str
    location_id: str
    location_name: str
    location_code: str
    geofence_radius_meters: float
    duty_title: str
    duty_description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str = "ACTIVE" # ACTIVE, COMPLETED, REVOKED
    assigned_by_user_id: str
    assigned_by_username: str
    created_at: datetime
    updated_at: datetime
