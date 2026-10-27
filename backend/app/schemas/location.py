from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class LocationObservationCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: float = Field(..., ge=0.0, description="Reported GPS accuracy radius in meters")
    speed: Optional[float] = None
    bearing: Optional[float] = None
    observed_at: datetime = Field(..., description="UTC timestamp recorded by device hardware")
    client_batch_id: Optional[str] = None
    device_identifier: Optional[str] = None

class LocationSyncBatch(BaseModel):
    device_identifier: str
    batch_id: str
    observations: List[LocationObservationCreate]

class LocationObservationResult(BaseModel):
    status: str
    current_state: str
    distance_from_hq_meters: float
    is_inside: bool
    is_stale: bool = False
    message: str

class OfficerLiveLocation(BaseModel):
    user_id: str
    officer_id: str
    full_name: str
    rank: str
    department: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    current_state: str  # INSIDE, OUTSIDE, ENTERING, EXITING, LOCATION_STALE, PERMISSION_DENIED, OFFLINE, UNKNOWN
    distance_from_hq_meters: Optional[float] = None
    assigned_location_id: Optional[str] = None
    assigned_location_name: Optional[str] = None
    assigned_location_code: Optional[str] = None
    assigned_geofence_radius: Optional[float] = None
    distance_from_assigned_location_meters: Optional[float] = None
    geofence_status: Optional[str] = None
    observed_at: Optional[datetime] = None
    is_stale: bool = False
    seconds_since_update: Optional[int] = None
    today_visit_count: int = 0
    today_duration_seconds: int = 0
