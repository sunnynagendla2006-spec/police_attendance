import logging
from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo
from app.core.config import settings
from app.core.security import hash_password, extract_initial_password

try:
    import dns.resolver
    _orig_resolver_init = dns.resolver.Resolver.__init__
    def _custom_resolver_init(self, *args, **kwargs):
        kwargs['configure'] = False
        _orig_resolver_init(self, *args, **kwargs)
        self.nameservers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
    dns.resolver.Resolver.__init__ = _custom_resolver_init
except Exception:
    pass

logger = logging.getLogger(__name__)

class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

db_manager = DatabaseManager()

async def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency to retrieve the active MongoDB database."""
    if db_manager.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return db_manager.db

async def connect_to_mongodb() -> AsyncIOMotorDatabase:
    """Connect to MongoDB and initialize collections and indexes."""
    logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
    db_manager.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=20000
    )
    db_manager.db = db_manager.client[settings.MONGODB_DATABASE]
    
    # Test connection
    await db_manager.client.admin.command('ping')
    logger.info("Successfully connected to MongoDB.")
    
    # Initialize indexes and default seeds
    await setup_database_indexes(db_manager.db)
    await seed_default_headquarters_and_admin(db_manager.db)
    
    return db_manager.db

async def close_mongodb_connection():
    """Close MongoDB connection gracefully."""
    if db_manager.client:
        logger.info("Closing MongoDB connection...")
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("MongoDB connection closed.")

async def setup_database_indexes(db: AsyncIOMotorDatabase):
    """Create all required unique, compound, and geospatial indexes."""
    logger.info("Configuring MongoDB indexes...")

    # users
    await db.users.create_index("username", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("account_status")

    # officer_profiles
    await db.officer_profiles.create_index("officer_id", unique=True)
    await db.officer_profiles.create_index("user_id", unique=True)
    await db.officer_profiles.create_index("mobile_number")

    # headquarters: 2dsphere index on location
    await db.headquarters.create_index([("location", pymongo.GEOSPHERE)])

    # geofence_configurations
    await db.geofence_configurations.create_index("headquarters_id")
    await db.geofence_configurations.create_index([("created_at", pymongo.DESCENDING)])

    # registered_devices
    await db.registered_devices.create_index([("user_id", 1), ("device_identifier", 1)], unique=True)

    # location_observations: 2dsphere index for spatial queries
    await db.location_observations.create_index([("location", pymongo.GEOSPHERE)])
    await db.location_observations.create_index([("user_id", 1), ("observed_at", pymongo.DESCENDING)])
    await db.location_observations.create_index([("observed_at", pymongo.DESCENDING)])

    # geofence_events
    await db.geofence_events.create_index("idempotency_key", unique=True)
    await db.geofence_events.create_index([("user_id", 1), ("observed_at", pymongo.DESCENDING)])
    await db.geofence_events.create_index([("headquarters_id", 1), ("observed_at", pymongo.DESCENDING)])

    # attendance_visits
    await db.attendance_visits.create_index([("user_id", 1), ("entry_at", pymongo.DESCENDING)])
    await db.attendance_visits.create_index([("user_id", 1), ("visit_status", 1)])
    await db.attendance_visits.create_index([("headquarters_id", 1), ("entry_at", pymongo.DESCENDING)])
    await db.attendance_visits.create_index("officer_id")

    # attendance_correction_requests
    await db.attendance_correction_requests.create_index("visit_id")
    await db.attendance_correction_requests.create_index("request_status")

    # audit_logs
    await db.audit_logs.create_index([("created_at", pymongo.DESCENDING)])
    await db.audit_logs.create_index("actor_user_id")
    await db.audit_logs.create_index("action")

    # refresh_sessions
    await db.refresh_sessions.create_index("token_hash", unique=True)
    await db.refresh_sessions.create_index("user_id")

    # synchronization_records
    await db.synchronization_records.create_index([("user_id", 1), ("batch_id", 1)], unique=True)

    logger.info("MongoDB indexes configured successfully.")

async def seed_default_headquarters_and_admin(db: AsyncIOMotorDatabase):
    """Seed default Eluru Headquarters and initial Administrator accounts if absent."""
    now = datetime.now(timezone.utc)

    # Seed Default Headquarters
    hq = await db.headquarters.find_one({"name": settings.DEFAULT_HQ_NAME})
    if not hq:
        hq_doc = {
            "name": settings.DEFAULT_HQ_NAME,
            "address": settings.DEFAULT_HQ_ADDRESS,
            "location": {
                "type": "Point",
                "coordinates": [settings.DEFAULT_HQ_LONGITUDE, settings.DEFAULT_HQ_LATITUDE]
            },
            "created_at": now,
            "updated_at": now
        }
        res = await db.headquarters.insert_one(hq_doc)
        hq_id = str(res.inserted_id)
        logger.info(f"Seeded default headquarters: {settings.DEFAULT_HQ_NAME} (ID: {hq_id})")

        # Initial geofence configuration
        geofence_doc = {
            "headquarters_id": hq_id,
            "radius_meters": settings.DEFAULT_GEOFENCE_RADIUS_METERS,
            "accuracy_threshold_meters": settings.DEFAULT_ACCURACY_THRESHOLD_METERS,
            "entry_confirmation_policy": {
                "consecutive_observations": settings.ENTRY_CONFIRMATION_COUNT,
                "dwell_seconds": 15
            },
            "exit_confirmation_policy": {
                "consecutive_observations": settings.EXIT_CONFIRMATION_COUNT,
                "dwell_seconds": 30
            },
            "stale_threshold_seconds": settings.DEFAULT_STALE_THRESHOLD_SECONDS,
            "effective_from": now,
            "changed_by": "SYSTEM_INITIALIZER",
            "change_reason": "Initial system deployment configuration",
            "created_at": now
        }
        await db.geofence_configurations.insert_one(geofence_doc)
    else:
        hq_id = str(hq["_id"])

    # Seed Super Admin if no user exists
    superadmin = await db.users.find_one({"username": "superadmin"})
    if not superadmin:
        admin_doc = {
            "username": "superadmin",
            "password_hash": hash_password("SuperAdmin@Eluru1"),
            "role": "super_admin",
            "account_status": "ACTIVE",
            "must_change_password": False,
            "failed_login_attempts": 0,
            "locked_until": None,
            "created_at": now,
            "updated_at": now,
            "last_login_at": None
        }
        u_res = await db.users.insert_one(admin_doc)
        admin_uid = str(u_res.inserted_id)
        
        # Super admin profile
        await db.officer_profiles.insert_one({
            "user_id": admin_uid,
            "officer_id": "AP-ELR-SA01",
            "full_name": "Superintendent of Police, Eluru",
            "rank": "Superintendent of Police",
            "mobile_number": "9999900001",
            "department": "District Police Office",
            "profile_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        })
        logger.info("Seeded default Super Admin: 'superadmin'")

    # Seed HQ Admin
    hqadmin = await db.users.find_one({"username": "hqadmin"})
    if not hqadmin:
        hq_admin_doc = {
            "username": "hqadmin",
            "password_hash": hash_password("HQAdmin@Eluru1"),
            "role": "hq_admin",
            "account_status": "ACTIVE",
            "must_change_password": False,
            "failed_login_attempts": 0,
            "locked_until": None,
            "created_at": now,
            "updated_at": now,
            "last_login_at": None
        }
        h_res = await db.users.insert_one(hq_admin_doc)
        hq_admin_uid = str(h_res.inserted_id)
        
        await db.officer_profiles.insert_one({
            "user_id": hq_admin_uid,
            "officer_id": "AP-ELR-HQ01",
            "full_name": "HQ Duty Officer, Eluru",
            "rank": "Inspector of Police",
            "mobile_number": "9999900002",
            "department": "HQ Administration",
            "profile_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        })
        logger.info("Seeded default HQ Admin: 'hqadmin'")

    # Seed an initial sample Constable to demonstrate first-login requirement
    constable101 = await db.users.find_one({"username": "constable101"})
    if not constable101:
        mobile = "9876543210"
        initial_pw = extract_initial_password(mobile) # '3210'
        c_doc = {
            "username": "constable101",
            "password_hash": hash_password(initial_pw),
            "role": "constable",
            "account_status": "ACTIVE",
            "must_change_password": True, # First-login security mandatory change!
            "failed_login_attempts": 0,
            "locked_until": None,
            "created_at": now,
            "updated_at": now,
            "last_login_at": None
        }
        c_res = await db.users.insert_one(c_doc)
        c_uid = str(c_res.inserted_id)

        await db.officer_profiles.insert_one({
            "user_id": c_uid,
            "officer_id": "ELR-PC-101",
            "full_name": "K. Venkata Rao",
            "rank": "Police Constable",
            "mobile_number": mobile,
            "department": "Eluru Town Traffic",
            "profile_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        })
        logger.info("Seeded sample Constable 'constable101' with initial password '3210' (must_change_password=True)")
