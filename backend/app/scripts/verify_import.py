import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.database import DatabaseManager # triggers resolver patch
from app.services.staff_import_service import find_eluru_location, get_eluru_staff_designation_summary

async def verify():
    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[settings.MONGODB_DATABASE]
    
    print("=== 1. Profile and User Counts ===")
    total_profiles = await db.officer_profiles.count_documents({})
    staff_profiles = await db.officer_profiles.count_documents({'role': 'staff'})
    print(f"Total Profiles in DB: {total_profiles}")
    print(f"Staff Profiles in DB: {staff_profiles} (Expect 35)")
    assert staff_profiles == 35, f"Expected 35 staff profiles, got {staff_profiles}"
    
    print("\n=== 2. Missing CFMS ID & G.No handling ===")
    no_cfms = await db.officer_profiles.find({'cfms_id': None, 'role': 'staff'}).to_list(100)
    print(f"Records with cfms_id == None: {len(no_cfms)} (Expect 7: sl_no 29-35)")
    assert len(no_cfms) == 7, f"Expected 7, got {len(no_cfms)}"
    for s in sorted(no_cfms, key=lambda x: x['sl_no']):
        print(f"  Sl No {s['sl_no']}: {s['full_name']} | Desig: {s['designation']} | CFMS: {s.get('cfms_id')} | G.No: {s.get('g_no')} | Mobile: {s['mobile_number']} | Tracking: {s.get('tracking_enabled')}")
        assert s.get('cfms_id') is None
        assert s.get('g_no') is None
        assert isinstance(s['mobile_number'], str)
        assert s.get('tracking_enabled') is False
        assert s.get('role') == 'staff'

    print("\n=== 3. Records with CFMS ID ===")
    with_cfms = await db.officer_profiles.find({'cfms_id': {'$ne': None}, 'role': 'staff'}).to_list(100)
    print(f"Records with valid CFMS ID: {len(with_cfms)} (Expect 28)")
    assert len(with_cfms) == 28, f"Expected 28, got {len(with_cfms)}"
    for s in with_cfms[:3]:
        print(f"  Sample Sl No {s['sl_no']}: {s['full_name']} | CFMS: {s['cfms_id']} | G.No: {s['g_no']} | Mobile: {s['mobile_number']}")

    print("\n=== 4. Eluru Location & Duty Assignments ===")
    eluru_loc = await find_eluru_location(db)
    assert eluru_loc is not None, "Eluru location must exist"
    eluru_id = str(eluru_loc['_id'])
    print(f"Found Eluru Location: {eluru_loc['name']} (ID: {eluru_id})")
    
    active_assignments = await db.location_assignments.count_documents({
        'location_id': eluru_id,
        'status': 'ACTIVE'
    })
    print(f"Active Assignments at Eluru Location: {active_assignments} (Expect at least 35)")
    assert active_assignments >= 35, f"Expected at least 35, got {active_assignments}"

    print("\n=== 5. User Roles and Security Defaults ===")
    staff_users = await db.users.find({'role': 'staff'}).to_list(100)
    print(f"Users with role='staff': {len(staff_users)} (Expect 35)")
    assert len(staff_users) == 35, f"Expected 35, got {len(staff_users)}"
    for u in staff_users:
        assert u['role'] == 'staff', "User must have staff role"
        assert u.get('must_change_password') is True, "Must enforce password change"
        assert 'password_hash' in u, "Password hash must exist"

    print("\n=== 6. Live Designation Summary ===")
    summary = await get_eluru_staff_designation_summary(db)
    print(f"Total staff: {summary['total_staff']}")
    print(f"Assigned count: {summary['assigned_count']}")
    print(f"Breakdown:")
    for desig, count in summary['counts'].items():
        print(f"  - {desig:<15}: {count}")

    expected_counts = {
        "AO": 1,
        "Office Supdt": 2,
        "Sr.Asst": 7,
        "Jr.Asst": 18,
        "Record Asst": 1,
        "Attender": 2,
        "Dhobhi": 1,
        "OS": 3
    }
    assert summary['counts'] == expected_counts, f"Counts mismatch: {summary['counts']} vs {expected_counts}"

    print("\n[VERIFICATION COMPLETE] ALL TESTS PASSED SUCCESSFULLY!")
    client.close()

if __name__ == '__main__':
    asyncio.run(verify())
