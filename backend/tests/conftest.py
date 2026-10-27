import logging
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.database import db_manager, setup_database_indexes, seed_default_headquarters_and_admin
from main import app

logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("motor").setLevel(logging.WARNING)

# Target isolated test database
settings.MONGODB_DATABASE = "policehq_geoattend_test"

@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Initialize function-scoped Motor client on the current test's event loop and clean state."""
    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[settings.MONGODB_DATABASE]
    db_manager.client = client
    db_manager.db = db

    # Reset test collections before each test
    for col in [
        "users", "officer_profiles", "headquarters", "geofence_configurations",
        "registered_devices", "location_observations", "geofence_events",
        "attendance_visits", "attendance_correction_requests", "audit_logs",
        "refresh_sessions", "synchronization_records",
        "location_assignments", "scheduled_snapshots", "location_schedule_configs",
        "scheduled_reports", "report_downloads", "app_usage_summaries", "app_usage_policies"
    ]:
        await db[col].delete_many({})

    await setup_database_indexes(db)
    await seed_default_headquarters_and_admin(db)
    
    yield db

    # Teardown
    client.close()
    db_manager.client = None
    db_manager.db = None

@pytest_asyncio.fixture(scope="function")
async def async_client():
    """Async HTTP test client bound to ASGI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
