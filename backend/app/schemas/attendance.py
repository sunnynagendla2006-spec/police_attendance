from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class AttendanceVisitResponse(BaseModel):
    id: str
    user_id: str
    officer_id: str
    officer_name: str
    rank: str
    department: str
    headquarters_id: str
    entry_at: datetime
    exit_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    duration_formatted: str = "00h 00m"
    entry_verification_status: str
    exit_verification_status: str
    visit_status: str  # OPEN, COMPLETED, INCOMPLETE
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class AttendanceCorrectionCreateRequest(BaseModel):
    visit_id: str
    reason: str = Field(..., min_length=5, description="Officer's justification for requesting timestamp correction")
    requested_entry_at: Optional[datetime] = None
    requested_exit_at: Optional[datetime] = None

class AttendanceCorrectionReviewRequest(BaseModel):
    request_status: str = Field(..., description="'APPROVED' or 'REJECTED'")
    admin_notes: str = Field(..., min_length=5, description="Audited review comments")

class AdminVisitCorrectionRequest(BaseModel):
    entry_at: Optional[datetime] = None
    exit_at: Optional[datetime] = None
    reason: str = Field(..., min_length=5, description="Audited reason for manual administrative correction")

class OfficerAttendanceSummary(BaseModel):
    user_id: str
    officer_id: str
    officer_name: str
    rank: str
    department: str
    first_entry_today: Optional[datetime] = None
    latest_exit_today: Optional[datetime] = None
    visits_today: int = 0
    total_duration_seconds_today: int = 0
    total_duration_formatted_today: str = "00h 00m"
    current_hq_status: str = "OUTSIDE"
    latest_location_update: Optional[datetime] = None
    verification_status: str = "VERIFIED"
