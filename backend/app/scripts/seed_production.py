import asyncio
import logging
from datetime import datetime, timezone
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.core.database import connect_to_mongodb, close_mongodb_connection
from app.core.security import hash_password, extract_initial_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")
logger = logging.getLogger("seed_production")

DEFAULT_ACCOUNTS = [
    {
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1",
        "role": "super_admin",
        "must_change_password": False,
        "officer_id": "AP-ELR-SA01",
        "full_name": "Superintendent of Police, Eluru",
        "rank": "Superintendent of Police",
        "mobile_number": "9999900001",
        "department": "District Police Office",
    },
    {
        "username": "hqadmin",
        "password": "HQAdmin@Eluru1",
        "role": "hq_admin",
        "must_change_password": False,
        "officer_id": "AP-ELR-HQ01",
        "full_name": "HQ Duty Officer, Eluru",
        "rank": "Inspector of Police",
        "mobile_number": "9999900002",
        "department": "HQ Administration",
    },
    {
        "username": "constable101",
        "password": "3210",  # Last 4 digits of 9876543210
        "role": "constable",
        "must_change_password": True,
        "officer_id": "ELR-PC-101",
        "full_name": "K. Venkata Rao",
        "rank": "Police Constable",
        "mobile_number": "9876543210",
        "department": "Eluru Town Traffic",
    },
    {
        "username": "constable102",
        "password": "5432",  # Last 4 digits of 9876545432
        "role": "constable",
        "must_change_password": True,
        "officer_id": "ELR-PC-102",
        "full_name": "P. Suresh Kumar",
        "rank": "Head Constable",
        "mobile_number": "9876545432",
        "department": "Eluru Rural Patrol",
    }
]

async def seed_production_database():
    logger.info(f"Target Database URI: {settings.MONGODB_URI[:35]}...")
    logger.info(f"Target Database Name: {settings.MONGODB_DATABASE}")

    db = await connect_to_mongodb()
    now = datetime.now(timezone.utc)

    # 1. Verify / Update Headquarters
    hq = await db.headquarters.find_one({"name": settings.DEFAULT_HQ_NAME})
    if not hq:
        hq_doc = {
            "name": settings.DEFAULT_HQ_NAME,
            "address": settings.DEFAULT_HQ_ADDRESS,
            "location": {
                "type": "Point",
                "coordinates": [settings.DEFAULT_HQ_LONGITUDE, settings.DEFAULT_HQ_LATITUDE]
            },
            "status": "ACTIVE",
            "is_primary": True,
            "radius_meters": settings.DEFAULT_GEOFENCE_RADIUS_METERS,
            "created_at": now,
            "updated_at": now
        }
        res = await db.headquarters.insert_one(hq_doc)
        hq_id = str(res.inserted_id)
        logger.info(f"Created primary Headquarters: '{settings.DEFAULT_HQ_NAME}' (ID: {hq_id})")

        # Initial geofence configuration
        await db.geofence_configurations.insert_one({
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
            "changed_by": "SYSTEM_SEEDER",
            "change_reason": "Production deployment seed",
            "created_at": now
        })
    else:
        hq_id = str(hq["_id"])
        await db.headquarters.update_one(
            {"_id": hq["_id"]},
            {"$set": {"status": "ACTIVE", "is_primary": True, "updated_at": now}}
        )
        logger.info(f"Primary Headquarters exists: '{settings.DEFAULT_HQ_NAME}' (ID: {hq_id})")

    # 2. Seed / Reset Accounts and Passwords
    results = []
    for acc in DEFAULT_ACCOUNTS:
        username = acc["username"]
        plain_password = acc["password"]
        pw_hash = hash_password(plain_password)

        existing_user = await db.users.find_one({"username": username})
        if existing_user:
            # Update password hash to guarantee seed credentials work
            await db.users.update_one(
                {"_id": existing_user["_id"]},
                {
                    "$set": {
                        "password_hash": pw_hash,
                        "account_status": "ACTIVE",
                        "failed_login_attempts": 0,
                        "locked_until": None,
                        "must_change_password": acc["must_change_password"],
                        "updated_at": now
                    }
                }
            )
            user_id = str(existing_user["_id"])
            logger.info(f"Updated password for existing user: '{username}'")
        else:
            # Insert user document
            u_doc = {
                "username": username,
                "password_hash": pw_hash,
                "role": acc["role"],
                "account_status": "ACTIVE",
                "must_change_password": acc["must_change_password"],
                "failed_login_attempts": 0,
                "locked_until": None,
                "created_at": now,
                "updated_at": now,
                "last_login_at": None
            }
            u_res = await db.users.insert_one(u_doc)
            user_id = str(u_res.inserted_id)
            logger.info(f"Created new user: '{username}'")

        # Officer Profile
        existing_profile = await db.officer_profiles.find_one({"user_id": user_id})
        if not existing_profile:
            p_doc = {
                "user_id": user_id,
                "officer_id": acc["officer_id"],
                "full_name": acc["full_name"],
                "rank": acc["rank"],
                "mobile_number": acc["mobile_number"],
                "department": acc["department"],
                "profile_status": "ACTIVE",
                "created_at": now,
                "updated_at": now
            }
            await db.officer_profiles.insert_one(p_doc)
            logger.info(f"Created profile for: '{acc['full_name']}' ({acc['officer_id']})")
        else:
            await db.officer_profiles.update_one(
                {"_id": existing_profile["_id"]},
                {"$set": {"mobile_number": acc["mobile_number"], "profile_status": "ACTIVE", "updated_at": now}}
            )

        results.append({
            "username": username,
            "role": acc["role"],
            "password": plain_password,
            "mobile": acc["mobile_number"],
            "must_change_password": acc["must_change_password"]
        })

    await close_mongodb_connection()
    return results

if __name__ == "__main__":
    results = asyncio.run(seed_production_database())
    print("\n" + "="*70)
    print("PRODUCTION DATABASE SEEDING COMPLETE")
    print("="*70)
    for r in results:
        status = "Mandatory 1st-login change" if r['must_change_password'] else "Direct Access"
        print(f"User: {r['username']:<15} | Role: {r['role']:<15} | Password: {r['password']:<18} | Mobile: {r['mobile']:<12} | ({status})")
    print("="*70)
