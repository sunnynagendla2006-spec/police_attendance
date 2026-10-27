from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

class OverviewStats(BaseModel):
    registered_officers: int = 0
    registered_admins: int = 0
    active_locations_count: int = 0
    assigned_to_duty: int = 0
    location_available: int = 0
    officers_inside_hq: int = 0
    officers_outside_hq: int = 0
    officers_on_duty_today: int = 0
    officers_not_recorded_today: int = 0
    officers_stale_or_unavailable: int = 0
    compliance_percentage: float = 0.0
    visits_recorded_today: int = 0
    total_hq_duration_seconds_today: int = 0
    total_hq_duration_formatted_today: str = "00h 00m"
    yesterday_visits: int = 0
    yesterday_on_duty: int = 0
    yesterday_compliance_percentage: float = 0.0
    incomplete_sessions_today: int = 0
    total_entries_today: int = 0
    total_exits_today: int = 0
    scheduled_reports_today: int = 0
    device_security_alerts: int = 0
    app_usage_summaries_today: int = 0

class DailyTrendItem(BaseModel):
    date: str
    distinct_officers: int
    total_visits: int
    avg_duration_minutes: float
    median_duration_minutes: float
    total_hours: float

class StationSummaryItem(BaseModel):
    station_name: str
    total_officers: int
    present_today: int
    compliance_percentage: float

class RecentActivityItem(BaseModel):
    id: str
    officer_id: str
    officer_name: str
    rank: str
    department: str
    event_type: str  # Headquarters entry, Headquarters exit, Attendance recorded, Location update, Visit completed, Location unavailable
    event_time: datetime
    location_label: str
    status: str      # Inside Geofence, Outside Geofence, Verified, Stale, Incomplete
    details: Optional[str] = None

class AnalyticsResponse(BaseModel):
    overview: OverviewStats
    trends: List[DailyTrendItem]
    rank_distribution: Dict[str, int]
    station_distribution: Dict[str, int] = {}
    entry_hour_distribution: Dict[str, int]
    station_summaries: List[StationSummaryItem] = []
    incomplete_sessions: int = 0
    avg_visit_duration_minutes: float = 0.0

