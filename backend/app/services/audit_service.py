from datetime import datetime, timezone
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

async def record_audit_log(
    db: AsyncIOMotorDatabase,
    actor_user_id: str,
    actor_username: str,
    action: str,
    target_type: str,
    target_id: str,
    reason: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Record an immutable security and administrative audit entry."""
    doc = {
        "actor_user_id": actor_user_id,
        "actor_username": actor_username,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "reason": reason,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.audit_logs.insert_one(doc)
    return str(result.inserted_id)
