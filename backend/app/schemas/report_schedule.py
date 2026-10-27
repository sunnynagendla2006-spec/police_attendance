from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ScheduledReportRecord(BaseModel):
    id: str
    report_id: str
    report_type: str # MORNING_REPORT, EVENING_REPORT, SCHEDULED_SNAPSHOTS, OUTSIDE_GEOFENCE, MISSING_SNAPSHOTS, ATTENDANCE_CONSOLIDATED, LOCATION_ASSIGNMENTS, APP_USAGE_SUMMARY, SECURITY_AUDIT
    title: str
    reporting_date: str # YYYY-MM-DD
    report_date: Optional[str] = None
    reporting_slot: str # e.g. 10:30_AM or 05:00_PM or ON_DEMAND
    schedule_time_label: Optional[str] = None
    location_id: Optional[str] = None # None means all organization locations
    location_name: Optional[str] = "All Organization Locations"
    total_assigned_constables: int = 0
    total_constables_evaluated: int = 0
    total_snapshots_received: int = 0
    present_count: int = 0
    total_inside_geofence: int = 0
    absent_count: int = 0
    total_outside_geofence: int = 0
    outside_geofence_count: int = 0
    total_missed_or_unavailable: int = 0
    generation_status: str = "SUCCESS" # SUCCESS, PARTIAL, FAILED
    status: str = "COMPLETED" # COMPLETED, PENDING, GENERATING, FAILED
    data_completeness: str = "COMPLETE" # COMPLETE, MISSING_OBSERVATIONS
    generated_at: datetime
    generated_by: str = "SYSTEM_SCHEDULER"
    summary_metrics: Dict[str, Any] = {}

class ReportDownloadRecord(BaseModel):
    id: str
    download_id: str
    report_id: Optional[str] = None
    report_type: str
    format: str # CSV, PDF
    requested_by_user_id: str
    requested_by_username: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    officer_id: Optional[str] = None
    applicable_location_id: Optional[str] = None
    location_id: Optional[str] = None
    applicable_location_name: str
    location_name: Optional[str] = None
    reporting_period_start: str
    reporting_period_end: str
    report_date: Optional[str] = None
    status: str = "COMPLETED"
    downloaded_at: datetime
    row_count: int = 0

class ReportGenerateRequest(BaseModel):
    report_type: str = "MORNING_1030_REPORT"
    reporting_date: Optional[str] = None
    report_date: Optional[str] = None
    location_id: Optional[str] = None
