from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel

class AuditLogResponse(BaseModel):
    id: str
    actor_user_id: str
    actor_username: str
    action: str
    target_type: str
    target_id: str
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
