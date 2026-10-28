from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class AppUsageItem(BaseModel):
    package_name: str
    app_name: str
    foreground_duration_minutes: float = Field(..., ge=0.0)
    is_work_app: bool = False

class AppUsageSubmission(BaseModel):
    reporting_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD")
    permission_granted: bool = True
    total_foreground_minutes: float = 0.0
    apps: List[AppUsageItem] = []
    collected_at: datetime = Field(default_factory=datetime.utcnow)

class AppUsageSummaryItem(BaseModel):
    id: str
    officer_id: str
    officer_name: str
    rank: str
    department: str
    assigned_location_name: str
    reporting_date: str
    total_foreground_minutes: float
    permission_granted: bool
    apps_count: int
    apps_exceeding_threshold: List[AppUsageItem]
    collected_at: datetime

class AppUsagePolicyConfig(BaseModel):
    enabled: bool = True
    usage_threshold_minutes: int = 30
    warning_threshold_minutes: Optional[int] = None
    approved_work_packages: List[str] = [
        "com.policehq.geoattend",
        "com.google.android.apps.maps",
        "com.whatsapp",
        "com.android.dialer",
        "com.android.contacts",
        "org.telegram.messenger"
    ]
    updated_at: datetime
    updated_by: str

    def model_post_init(self, __context: Any) -> None:
        if self.warning_threshold_minutes is None:
            self.warning_threshold_minutes = self.usage_threshold_minutes

class AppUsagePolicyUpdate(BaseModel):
    enabled: Optional[bool] = None
    usage_threshold_minutes: Optional[int] = Field(None, ge=5, le=360)
    warning_threshold_minutes: Optional[int] = Field(None, ge=5, le=360)
    approved_work_packages: Optional[List[str]] = None
    change_reason: Optional[str] = None
