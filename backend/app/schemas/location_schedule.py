from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ScheduledLocationSnapshotSubmit(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: Optional[float] = Field(None, ge=0.0)
    observed_at: datetime
    scheduled_slot: Optional[str] = "MORNING_1000"
    snapshot_window: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    device_id: Optional[str] = None
    battery_level: Optional[int] = None
    network_type: Optional[str] = None # wifi, cellular, none

class ScheduledLocationSnapshotResponse(BaseModel):
    id: str
    officer_id: str
    user_id: str
    full_name: str
    rank: str
    department: str
    location_id: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    distance_meters: Optional[float] = None
    geofence_radius_meters: float
    status: str # INSIDE, OUTSIDE, UNCERTAIN_ACCURACY, STALE, UNAVAILABLE, MISSED, DELAYED
    geofence_status: Optional[str] = None
    timeliness_status: Optional[str] = "ON_TIME"
    scheduled_slot: str
    snapshot_window: Optional[str] = None
    scheduled_time: datetime
    observed_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    is_on_time: bool = True
    delay_minutes: Optional[int] = None
    map_preview_url: Optional[str] = None

class OutsideGeofenceObservation(BaseModel):
    id: str
    officer_id: str
    full_name: str
    officer_name: Optional[str] = None
    rank: str
    department: str
    assigned_location_id: str
    assigned_location_name: str
    duty_location_id: Optional[str] = None
    duty_location_name: Optional[str] = None
    scheduled_slot: Optional[str] = None
    snapshot_window: Optional[str] = None
    latitude: float
    longitude: float
    distance_meters: float
    geofence_radius_meters: float
    excess_distance_meters: Optional[float] = None
    accuracy_meters: Optional[float] = None
    status: str # OUTSIDE, UNCERTAIN_ACCURACY
    observed_at: datetime
    received_at: datetime
    is_delayed: bool = False
    map_url: str

class LocationScheduleConfig(BaseModel):
    timezone: str = "Asia/Kolkata"
    morning_snapshot_time: str = "10:00" # HH:MM
    evening_snapshot_time: str = "18:00" # HH:MM
    morning_report_time: str = "10:30"   # HH:MM
    evening_report_time: str = "17:00"   # HH:MM
    grace_period_minutes: int = 15
    stale_threshold_seconds: int = 300
    updated_at: datetime
    updated_by: str

class LocationScheduleConfigUpdate(BaseModel):
    morning_snapshot_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    evening_snapshot_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    morning_report_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    evening_report_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    grace_period_minutes: Optional[int] = Field(None, ge=1, le=60)
    change_reason: str = Field(..., min_length=3)
