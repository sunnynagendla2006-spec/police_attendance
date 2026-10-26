from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database, db_manager
from app.core.config import settings

router = APIRouter(tags=["System Health"])

@router.get("/health")
async def health_check():
    """Liveness probe."""
    return {
        "status": "UP",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/readiness")
async def readiness_check(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Readiness probe checking MongoDB connection."""
    try:
        await db.command("ping")
        db_status = "CONNECTED"
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    return {
        "status": "READY" if db_status == "CONNECTED" else "DEGRADED",
        "database": db_status,
        "mongodb_target": settings.MONGODB_DATABASE,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
