from datetime import datetime, timezone
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

async def record_audit_log(
    db: AsyncIOMotorDatabase,
    actor_user_id: str,
    actor_username: str,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    reason: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> str:
    """Record an immutable security and administrative audit entry."""
    resolved_target_type = target_type or entity_type or "system"
    resolved_target_id = target_id or entity_id or "system"
    resolved_metadata = metadata or details or {}

    doc = {
        "actor_user_id": actor_user_id,
        "actor_username": actor_username,
        "action": action,
        "target_type": resolved_target_type,
        "target_id": resolved_target_id,
        "reason": reason,
        "metadata": resolved_metadata,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.audit_logs.insert_one(doc)
    return str(result.inserted_id)
