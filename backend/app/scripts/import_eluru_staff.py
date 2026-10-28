#!/usr/bin/env python3
"""
PoliceHQ GeoAttend - Standalone Eluru District Staff Importer
Imports the 35 staff records embedded in app.services.staff_import_service
directly into the configured MongoDB database.
"""

import sys
import asyncio
from typing import Dict, Any

import functools
print = functools.partial(print, flush=True)

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

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.staff_import_service import import_eluru_staff, get_eluru_staff_designation_summary

async def main():
    print("=" * 80)
    print(" PoliceHQ GeoAttend - Eluru District Staff Data Importer")
    print("=" * 80)
    client = None
    db = None
    for attempt in range(1, 4):
        try:
            print(f"Connecting to MongoDB at: {settings.MONGODB_URI} (Attempt {attempt}/3)...")
            client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
            await client.admin.command('ping')
            db = client[settings.MONGODB_DATABASE]
            print("[OK] Successfully connected to MongoDB.")
            break
        except Exception as e:
            print(f"[WARN] Connection attempt {attempt} failed: {e}")
            if client:
                client.close()
            if attempt < 3:
                await asyncio.sleep(2)
            else:
                print(f"[ERROR] Could not connect to MongoDB after 3 attempts.")
                sys.exit(1)

    try:
        # Check if an existing superadmin exists to attribute the import
        admin = await db.users.find_one({"role": "super_admin"})
        admin_ctx = {
            "username": admin["username"] if admin else "superadmin",
            "_id": str(admin["_id"]) if admin else "SYSTEM_IMPORT"
        }

        print("\n[INFO] Starting safe import process for 35 Eluru District staff records...")
        res = await import_eluru_staff(db=db, admin_user=admin_ctx)

        print("\n" + "=" * 80)
        print(" IMPORT SUMMARY")
        print("=" * 80)
        print(f"Batch Identifier               : {res['import_batch_id']}")
        print(f"Duty Location                  : {res['location_name']} (ID: {res['location_id']})")
        print(f"Total Staff Records Evaluated  : {res['total_records']}")
        print(f"Created New Records            : {res['created_records']}")
        print(f"Matched Existing Records       : {res['matched_existing_records']}")
        print(f"Updated Records                : {res['updated_records']}")
        print(f"Records Requiring Manual Review: {res['records_requiring_manual_review']}")
        print(f"Duty Assignments Created       : {res['duty_assignments_created']}")
        print(f"Duty Assignments Retained/Exist: {res['duty_assignments_existing']}")

        print("\n" + "-" * 80)
        print(" DESIGNATION SUMMARY (Actual Records in Database)")
        print("-" * 80)
        for desig, count in res["designation_summary"].items():
            print(f"  * {desig:<20}: {count} personnel")

        print("\n" + "-" * 80)
        print(" IMPORTED STAFF RECORDS")
        print("-" * 80)
        print(f"{'#':<3} | {'NAME':<24} | {'G':<2} | {'CFMS ID':<10} | {'DESIG':<14} | {'G.NO':<6} | {'MOBILE':<11} | {'STATUS':<16}")
        print("-" * 80)
        for item in res["processed_items"]:
            cfms = item['cfms_id'] if item['cfms_id'] else '--'
            gno = item['g_no'] if item['g_no'] else '--'
            print(f"{item['sl_no']:<3} | {item['name']:<24} | {item['gender']:<2} | {cfms:<10} | {item['designation']:<14} | {gno:<6} | {item['mobile']:<11} | {item['status']:<16}")

        print("=" * 80)
        print("[SUCCESS] All 35 Eluru District Staff records successfully imported and assigned.")
        print("=" * 80)

    except Exception as e:
        print(f"[FATAL] Import failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
