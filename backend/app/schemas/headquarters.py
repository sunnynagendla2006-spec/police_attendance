from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class HeadquartersResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = "AP-ELR-HQ"
    state: Optional[str] = "Andhra Pradesh"
    district: Optional[str] = "Eluru"
    city: Optional[str] = "Eluru"
    address: str
    latitude: float
    longitude: float
    radius_meters: float = 100.0
    status: str = "ACTIVE" # ACTIVE, INACTIVE, MAINTENANCE
    is_primary: bool = True
    assigned_admin_ids: List[str] = []
    assigned_constables_count: int = 0
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class HeadquartersCreateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=150, description="Official Headquarters / Facility Name")
    code: str = Field(..., min_length=2, max_length=50, description="Station or Facility Code, e.g. AP-ELR-HQ")
    state: str = Field("Andhra Pradesh", min_length=2)
    district: str = Field("Eluru", min_length=2)
    city: str = Field("Eluru", min_length=2)
    address: str = Field(..., min_length=5, description="Full postal address")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Valid latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Valid longitude between -180 and 180")
    radius_meters: float = Field(100.0, gt=10.0, le=5000.0, description="Geofence boundary radius in meters")
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE|MAINTENANCE)$")
    is_primary: bool = Field(False, description="Whether this facility is the primary operational headquarters")
    assigned_admin_ids: Optional[List[str]] = Field(default_factory=list)
    description: Optional[str] = None

class HeadquartersUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=150)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = Field(None, min_length=5)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    radius_meters: Optional[float] = Field(None, gt=10.0, le=5000.0)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE|MAINTENANCE)$")
    is_primary: Optional[bool] = None
    description: Optional[str] = None
    change_reason: str = Field(..., min_length=5, description="Administrative justification for updating HQ location")

class HeadquartersStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|INACTIVE|MAINTENANCE)$")
    is_primary: Optional[bool] = None
    change_reason: str = Field(..., min_length=3, description="Justification for status modification")

class HeadquartersHistoryItem(BaseModel):
    id: str
    headquarters_id: str
    headquarters_name: str
    previous_coordinates: Optional[Dict[str, float]] = None
    new_coordinates: Optional[Dict[str, float]] = None
    previous_radius: Optional[float] = None
    new_radius: Optional[float] = None
    previous_address: Optional[str] = None
    new_address: Optional[str] = None
    changed_by: str
    change_reason: str
    created_at: datetime

class GeofenceConfigResponse(BaseModel):
    id: str
    headquarters_id: str
    radius_meters: float
    accuracy_threshold_meters: float
    entry_confirmation_policy: Dict[str, Any]
    exit_confirmation_policy: Dict[str, Any]
    stale_threshold_seconds: int
    effective_from: datetime
    changed_by: str
    change_reason: str
    created_at: datetime

class GeofenceConfigUpdateRequest(BaseModel):
    radius_meters: float = Field(..., gt=10.0, le=5000.0, description="Geofence boundary radius in meters (e.g., 50, 100, 150, 200)")
    accuracy_threshold_meters: Optional[float] = Field(35.0, gt=5.0, le=100.0)
    stale_threshold_seconds: Optional[int] = Field(300, ge=60, le=3600)
    change_reason: str = Field(..., min_length=5, description="Audited operational reason for modifying geofence configuration")

class GeofenceHistoryResponse(BaseModel):
    current: GeofenceConfigResponse
    history: List[GeofenceConfigResponse]
