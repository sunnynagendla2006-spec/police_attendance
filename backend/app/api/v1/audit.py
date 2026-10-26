from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.audit import AuditLogResponse
from app.services.auth_service import require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
async def get_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Retrieve immutable administrative and security audit trail (Super Admin only)."""
    query: Dict[str, Any] = {}
    if action:
        query["action"] = action

    cursor = db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)

    return [
        AuditLogResponse(
            id=str(l["_id"]),
            actor_user_id=l["actor_user_id"],
            actor_username=l["actor_username"],
            action=l["action"],
            target_type=l["target_type"],
            target_id=l["target_id"],
            reason=l.get("reason"),
            metadata=l.get("metadata"),
            created_at=l["created_at"]
        )
        for l in logs
    ]
