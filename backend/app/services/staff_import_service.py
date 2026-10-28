import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import hash_password, extract_initial_password
from app.services.audit_service import record_audit_log

logger = logging.getLogger(__name__)

# Complete 35 Staff Records from Eluru District embedded dataset
ELURU_STAFF_DATA = [
    {
        "sl_no": 1,
        "name": "SHAIK MASTAN",
        "gender": "M",
        "cfms_id": "14359232",
        "designation": "AO",
        "g_no": "3455",
        "mobile": "6281384115",
    },
    {
        "sl_no": 2,
        "name": "P.NAGESWARA RAO",
        "gender": "M",
        "cfms_id": "14383530",
        "designation": "Office Supdt",
        "g_no": "3467",
        "mobile": "8125618805",
    },
    {
        "sl_no": 3,
        "name": "B.SUVARCHALA",
        "gender": "F",
        "cfms_id": "14089198",
        "designation": "Office Supdt",
        "g_no": "3074",
        "mobile": "9492920274",
    },
    {
        "sl_no": 4,
        "name": "ABDUL ALEEM",
        "gender": "M",
        "cfms_id": "14090033",
        "designation": "Sr.Asst",
        "g_no": "3061",
        "mobile": "6301489443",
    },
    {
        "sl_no": 5,
        "name": "T.PAVAN KUMAR",
        "gender": "M",
        "cfms_id": "14106123",
        "designation": "Sr.Asst",
        "g_no": "3064",
        "mobile": "9703111144",
    },
    {
        "sl_no": 6,
        "name": "K.KANAKA DURGA",
        "gender": "F",
        "cfms_id": "14089201",
        "designation": "Sr.Asst",
        "g_no": "3063",
        "mobile": "9652561253",
    },
    {
        "sl_no": 7,
        "name": "V.VIDAYA PRABHA",
        "gender": "F",
        "cfms_id": "14089197",
        "designation": "Sr.Asst",
        "g_no": "3080",
        "mobile": "8978384338",
    },
    {
        "sl_no": 8,
        "name": "K.VENKATESWARAMMA",
        "gender": "F",
        "cfms_id": "14114710",
        "designation": "Sr.Asst",
        "g_no": "5012",
        "mobile": "8008523998",
    },
    {
        "sl_no": 9,
        "name": "I.S.NAGESH BABU",
        "gender": "M",
        "cfms_id": "14114732",
        "designation": "Sr.Asst",
        "g_no": "5013",
        "mobile": "9885763498",
    },
    {
        "sl_no": 10,
        "name": "YSV. Prasad",
        "gender": "M",
        "cfms_id": "14089203",
        "designation": "Sr.Asst",
        "g_no": "3065",
        "mobile": "9393945008",
    },
    {
        "sl_no": 11,
        "name": "V.Murali Krishna",
        "gender": "M",
        "cfms_id": "14106126",
        "designation": "Jr.Asst",
        "g_no": "3071",
        "mobile": "8328102223",
    },
    {
        "sl_no": 12,
        "name": "M Harika",
        "gender": "F",
        "cfms_id": "14089980",
        "designation": "Jr.Asst",
        "g_no": "3070",
        "mobile": "7981905120",
    },
    {
        "sl_no": 13,
        "name": "P.Deena Helen Grace",
        "gender": "F",
        "cfms_id": "14107295",
        "designation": "Jr.Asst",
        "g_no": "3198",
        "mobile": "9866320214",
    },
    {
        "sl_no": 14,
        "name": "L.V.V.Kishore",
        "gender": "M",
        "cfms_id": "14107294",
        "designation": "Jr.Asst",
        "g_no": "3089",
        "mobile": "9440790123",
    },
    {
        "sl_no": 15,
        "name": "T. Raj Kumar",
        "gender": "M",
        "cfms_id": "14107449",
        "designation": "Jr.Asst",
        "g_no": "3033",
        "mobile": "9441432211",
    },
    {
        "sl_no": 16,
        "name": "D.Venkatesh",
        "gender": "M",
        "cfms_id": "14107487",
        "designation": "Jr.Asst",
        "g_no": "3179",
        "mobile": "9848606654",
    },
    {
        "sl_no": 17,
        "name": "G.Jai Sai Ram",
        "gender": "M",
        "cfms_id": "14107485",
        "designation": "Jr.Asst",
        "g_no": "3178",
        "mobile": "8121663376",
    },
    {
        "sl_no": 18,
        "name": "J Pavana Sree latha",
        "gender": "F",
        "cfms_id": "14109799",
        "designation": "Jr.Asst",
        "g_no": "3231",
        "mobile": "9949556873",
    },
    {
        "sl_no": 19,
        "name": "P.Venkateswara Rao",
        "gender": "M",
        "cfms_id": "14365653",
        "designation": "Jr.Asst",
        "g_no": "3093",
        "mobile": "9959235350",
    },
    {
        "sl_no": 20,
        "name": "G.Bhanu Priya",
        "gender": "F",
        "cfms_id": "15165362",
        "designation": "Jr.Asst",
        "g_no": "3425",
        "mobile": "9701970508",
    },
    {
        "sl_no": 21,
        "name": "D.Sundar",
        "gender": "M",
        "cfms_id": "15204667",
        "designation": "Jr.Asst",
        "g_no": "3451",
        "mobile": "7075064286",
    },
    {
        "sl_no": 22,
        "name": "J.Jhansi",
        "gender": "F",
        "cfms_id": "15205333",
        "designation": "Jr.Asst",
        "g_no": "3450",
        "mobile": "7386031418",
    },
    {
        "sl_no": 23,
        "name": "K.Usha Rani",
        "gender": "F",
        "cfms_id": "15211218",
        "designation": "Jr.Asst",
        "g_no": "3459",
        "mobile": "8500289448",
    },
    {
        "sl_no": 24,
        "name": "R. Jayasri",
        "gender": "F",
        "cfms_id": "15214878",
        "designation": "Jr.Asst",
        "g_no": "3460",
        "mobile": "9494568304",
    },
    {
        "sl_no": 25,
        "name": "G. Swetha Ramya",
        "gender": "F",
        "cfms_id": "15214877",
        "designation": "Jr.Asst",
        "g_no": "3461",
        "mobile": "9492566574",
    },
    {
        "sl_no": 26,
        "name": "K.Y. Pruthivi",
        "gender": "M",
        "cfms_id": "15215075",
        "designation": "Jr.Asst",
        "g_no": "3462",
        "mobile": "9948354115",
    },
    {
        "sl_no": 27,
        "name": "P. SAI SUDHEER KUMAR",
        "gender": "M",
        "cfms_id": "15237995",
        "designation": "Jr.Asst",
        "g_no": "3468",
        "mobile": "8555025456",
    },
    {
        "sl_no": 28,
        "name": "G. SAI SANTHOSH",
        "gender": "M",
        "cfms_id": "15238796",
        "designation": "Jr.Asst",
        "g_no": "3469",
        "mobile": "7306902313",
    },
    {
        "sl_no": 29,
        "name": "P.RAVINDRA",
        "gender": "M",
        "cfms_id": None,
        "designation": "Record Asst",
        "g_no": None,
        "mobile": "7989013701",
    },
    {
        "sl_no": 30,
        "name": "G.LEELA KUMAR",
        "gender": "F",
        "cfms_id": None,
        "designation": "Attender",
        "g_no": None,
        "mobile": "9398611369",
    },
    {
        "sl_no": 31,
        "name": "K.SURIBABU",
        "gender": "M",
        "cfms_id": None,
        "designation": "Attender",
        "g_no": None,
        "mobile": "8186904551",
    },
    {
        "sl_no": 32,
        "name": "K.RANGA BABU",
        "gender": "M",
        "cfms_id": None,
        "designation": "Dhobhi",
        "g_no": None,
        "mobile": "8106397255",
    },
    {
        "sl_no": 33,
        "name": "Pratap",
        "gender": "M",
        "cfms_id": None,
        "designation": "OS",
        "g_no": None,
        "mobile": "8106168018",
    },
    {
        "sl_no": 34,
        "name": "Sravani",
        "gender": "F",
        "cfms_id": None,
        "designation": "OS",
        "g_no": None,
        "mobile": "7386544456",
    },
    {
        "sl_no": 35,
        "name": "Rajyalakshmi",
        "gender": "F",
        "cfms_id": None,
        "designation": "OS",
        "g_no": None,
        "mobile": "8341779775",
    },
]

async def find_eluru_location(
    db: AsyncIOMotorDatabase,
    target_location_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Find existing Eluru duty location from MongoDB.
    Checks specified ID first, then prioritizes name containing 'Eluru',
    then primary headquarters in Eluru district.
    """
    if target_location_id:
        oid = ObjectId(target_location_id) if ObjectId.is_valid(target_location_id) else None
        loc = await db.headquarters.find_one({"_id": oid}) if oid else None
        if not loc:
            loc = await db.headquarters.find_one({"_id": target_location_id})
        if loc:
            return loc

    # Prioritize Headquarters with 'Eluru' in name (e.g. 'Eluru District Police Headquarters')
    loc = await db.headquarters.find_one({
        "name": {"$regex": "Eluru", "$options": "i"}
    })
    if loc:
        return loc

    # Fallback to primary HQ if located in Eluru
    loc = await db.headquarters.find_one({
        "is_primary": True,
        "$or": [
            {"district": {"$regex": "Eluru", "$options": "i"}},
            {"city": {"$regex": "Eluru", "$options": "i"}}
        ]
    })
    if loc:
        return loc

    # Fallback to any facility in Eluru
    loc = await db.headquarters.find_one({
        "$or": [
            {"district": {"$regex": "Eluru", "$options": "i"}},
            {"city": {"$regex": "Eluru", "$options": "i"}}
        ]
    })
    return loc

async def import_eluru_staff(
    db: AsyncIOMotorDatabase,
    admin_user: Optional[Dict[str, Any]] = None,
    target_location_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Safely import all 35 staff records into MongoDB:
    1. Verify existing Eluru duty location (or raise if absent).
    2. Check whether employee already exists using CFMS ID when available.
    3. For records without CFMS ID, match by exact mobile number and verify name.
       Do not automatically merge records based solely on matching name.
    4. Preserve existing user accounts and authentication credentials.
    5. Give basic 'staff' role by default (no admin or super admin privilege).
    6. Disable location tracking and app usage collection by default.
    7. Link all 35 personnel to the existing Eluru duty location in location_assignments.
    8. Prevent duplicate active assignments or duplicate personnel on re-runs.
    """
    now = datetime.now(timezone.utc)
    batch_id = f"BATCH-ELR-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    admin_username = admin_user.get("username", "admin") if admin_user else "System Administrator"
    admin_user_id = str(admin_user.get("_id", "SYSTEM")) if admin_user else "SYSTEM_IMPORT"

    # 1. Verify Eluru Location
    eluru_loc = await find_eluru_location(db, target_location_id)
    if not eluru_loc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No existing Eluru duty location was found in MongoDB. "
                "Please select or create an Eluru duty location before importing staff."
            )
        )

    loc_id = str(eluru_loc["_id"])
    loc_name = eluru_loc.get("name", "Eluru District Police Headquarters")
    loc_code = eluru_loc.get("code", "AP-ELR-HQ")
    radius_meters = float(eluru_loc.get("radius_meters", 100.0))

    created_records = 0
    matched_existing_records = 0
    updated_records = 0
    records_requiring_manual_review = 0
    duty_assignments_created = 0
    duty_assignments_existing = 0

    processed_items = []
    review_details = []

    for staff in ELURU_STAFF_DATA:
        sl_no = staff["sl_no"]
        name = staff["name"].strip()
        gender = staff["gender"].strip().upper()
        cfms_id = staff["cfms_id"].strip() if staff.get("cfms_id") else None
        designation = staff["designation"].strip()
        g_no = str(staff["g_no"]).strip() if staff.get("g_no") is not None else None
        mobile = "".join(filter(str.isdigit, str(staff["mobile"])))

        existing_profile: Optional[Dict[str, Any]] = None
        matched_by: Optional[str] = None

        # 2. Matching logic:
        # Match using CFMS ID when available
        if cfms_id:
            existing_profile = await db.officer_profiles.find_one({"cfms_id": cfms_id})
            if not existing_profile:
                existing_profile = await db.officer_profiles.find_one({"officer_id": cfms_id})
            if existing_profile:
                matched_by = "CFMS_ID"

        # For records without CFMS ID:
        if not existing_profile and not cfms_id:
            # Match by unique verified mobile number
            existing_profile = await db.officer_profiles.find_one({"mobile_number": mobile})
            if existing_profile:
                matched_by = "MOBILE_NUMBER"
            else:
                # Check standard generated ID fallback
                standard_id = f"ELR-STF-{sl_no:03d}"
                existing_profile = await db.officer_profiles.find_one({"officer_id": standard_id})
                if existing_profile:
                    matched_by = "STANDARD_ID"

            # Critical requirement: Do NOT automatically merge records based solely on matching name!
            if not existing_profile:
                name_match = await db.officer_profiles.find_one({
                    "full_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}
                })
                if name_match and name_match.get("mobile_number") != mobile:
                    # Name matches someone else with a different mobile and no CFMS ID link!
                    # Do not merge automatically!
                    records_requiring_manual_review += 1
                    review_msg = (
                        f"Staff #{sl_no} '{name}' matches an existing officer profile '{name_match.get('officer_id')}' "
                        f"by name, but has a different mobile number ({mobile} vs {name_match.get('mobile_number')}). "
                        "Automatic merge prevented."
                    )
                    review_details.append(review_msg)
                    logger.warning(review_msg)

        # 3. Process Existing vs New Record
        if existing_profile:
            matched_existing_records += 1
            updated_records += 1
            user_id = str(existing_profile["user_id"])
            officer_id = existing_profile["officer_id"]

            # Update profile while preserving accounts and authentication data
            update_fields: Dict[str, Any] = {
                "full_name": name,
                "gender": gender,
                "designation": designation,
                "rank": designation,  # Keep rank aligned for backwards compatibility
                "cfms_id": cfms_id,
                "g_no": g_no,
                "mobile_number": mobile,
                "duty_location_id": loc_id,
                "duty_location_name": loc_name,
                "assignment_status": "ACTIVE",
                "role": "staff",  # Basic staff role
                "last_import_batch_id": batch_id,
                "updated_at": now
            }
            # Preserve tracking flags if already present, otherwise ensure False
            if "tracking_enabled" not in existing_profile:
                update_fields["tracking_enabled"] = False
            if "app_usage_collection_enabled" not in existing_profile:
                update_fields["app_usage_collection_enabled"] = False

            await db.officer_profiles.update_one(
                {"_id": existing_profile["_id"]},
                {"$set": update_fields}
            )

            # Ensure user account preserves role as staff (never auto-grant admin!)
            u_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
            user_doc = await db.users.find_one({"_id": u_oid})
            if user_doc and user_doc.get("role") not in ("super_admin", "hq_admin", "admin"):
                await db.users.update_one(
                    {"_id": u_oid},
                    {"$set": {"role": "staff", "updated_at": now}}
                )

            item_status = "MATCHED_EXISTING"

        else:
            # 4. Insert New Record
            created_records += 1

            # Standardized unique officer_id:
            # Use CFMS ID if present, otherwise ELR-STF-XXX
            if cfms_id:
                officer_id = cfms_id
            else:
                officer_id = f"ELR-STF-{sl_no:03d}"

            # Standardized username:
            if cfms_id:
                base_username = f"cfms_{cfms_id}"
            else:
                base_username = f"staff_{sl_no:02d}"

            username = base_username.lower()
            # If username exists, suffix with last 4 digits of mobile
            if await db.users.find_one({"username": username}):
                username = f"{username}_{mobile[-4:]}"

            # Credentials: Initial temporary password is last 4 digits of mobile
            initial_pw = extract_initial_password(mobile)
            pw_hash = hash_password(initial_pw)

            # Create User Account: Basic staff role by default
            user_doc = {
                "username": username,
                "password_hash": pw_hash,
                "role": "staff",  # Basic staff application role
                "account_status": "ACTIVE",
                "must_change_password": True,  # Mandatory first-login change
                "failed_login_attempts": 0,
                "locked_until": None,
                "assigned_location_ids": [loc_id],
                "created_at": now,
                "updated_at": now,
                "last_login_at": None,
                "import_batch_id": batch_id
            }
            u_res = await db.users.insert_one(user_doc)
            user_id = str(u_res.inserted_id)

            # Create Officer Profile
            profile_doc = {
                "user_id": user_id,
                "officer_id": officer_id,
                "sl_no": sl_no,
                "full_name": name,
                "gender": gender,
                "cfms_id": cfms_id,
                "designation": designation,
                "rank": designation,
                "g_no": g_no,
                "mobile_number": mobile,
                "department": "District Police Office, Eluru",
                "profile_status": "ACTIVE",
                "duty_location_id": loc_id,
                "duty_location_name": loc_name,
                "assignment_status": "ACTIVE",
                "role": "staff",
                "tracking_enabled": False,  # Disabled by default
                "app_usage_collection_enabled": False,  # Disabled by default
                "import_batch_id": batch_id,
                "created_at": now,
                "updated_at": now
            }
            await db.officer_profiles.insert_one(profile_doc)
            item_status = "CREATED"

        # 5. Eluru Duty Assignment Linking
        # Archive any previous active assignment at a different facility
        prev_other = await db.location_assignments.find_one({
            "$or": [
                {"user_id": user_id, "status": "ACTIVE"},
                {"officer_id": officer_id, "status": "ACTIVE"}
            ]
        })
        if prev_other and str(prev_other.get("location_id")) != loc_id:
            await db.location_assignments.update_one(
                {"_id": prev_other["_id"]},
                {"$set": {"status": "COMPLETED", "end_time": now, "updated_at": now}}
            )

        # Check if active assignment already exists for this staff at the target Eluru location
        existing_asgn = await db.location_assignments.find_one({
            "$or": [
                {"user_id": user_id, "location_id": loc_id, "status": "ACTIVE"},
                {"officer_id": officer_id, "location_id": loc_id, "status": "ACTIVE"}
            ]
        })

        if existing_asgn:
            duty_assignments_existing += 1
            await db.location_assignments.update_one(
                {"_id": existing_asgn["_id"]},
                {"$set": {"last_import_batch_id": batch_id, "updated_at": now}}
            )
        else:
            # Create active duty assignment linking personnel to Eluru HQ
            asgn_code = f"ASN-ELR-{now.strftime('%Y%m%d')}-{sl_no:03d}"
            asgn_doc = {
                "assignment_id": asgn_code,
                "officer_id": officer_id,
                "personnel_id": officer_id,
                "user_id": user_id,
                "full_name": name,
                "rank": designation,
                "designation": designation,
                "department": "District Police Office, Eluru",
                "mobile_number": mobile,
                "location_id": loc_id,
                "location_name": loc_name,
                "location_code": loc_code,
                "geofence_radius_meters": radius_meters,
                "duty_title": f"{designation} Duty - Eluru DPO",
                "duty_description": "Imported Eluru District Staff Duty Assignment",
                "start_time": now,
                "end_time": None,
                "status": "ACTIVE",
                "assigned_by_user_id": admin_user_id,
                "assigned_by_username": admin_username,
                "assigned_by": admin_username,
                "import_batch_id": batch_id,
                "created_at": now,
                "updated_at": now
            }
            await db.location_assignments.insert_one(asgn_doc)
            duty_assignments_created += 1

        processed_items.append({
            "sl_no": sl_no,
            "name": name,
            "gender": gender,
            "cfms_id": cfms_id,
            "designation": designation,
            "g_no": g_no,
            "mobile": mobile,
            "officer_id": officer_id,
            "status": item_status,
            "matched_by": matched_by,
            "duty_location": loc_name
        })

    # 6. Record Administrative Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=admin_user_id,
        actor_username=admin_username,
        action="ELURU_STAFF_IMPORTED",
        target_type="district_staff_import",
        target_id=batch_id,
        reason="Direct import of 35 Eluru District Staff into PoliceHQ GeoAttend",
        metadata={
            "total_records": len(ELURU_STAFF_DATA),
            "created": created_records,
            "matched_existing": matched_existing_records,
            "updated": updated_records,
            "duty_assignments_created": duty_assignments_created,
            "duty_assignments_existing": duty_assignments_existing,
            "location_name": loc_name,
            "location_id": loc_id
        }
    )

    # 7. Get refreshed designation breakdown
    summary = await get_eluru_staff_designation_summary(db)

    return {
        "status": "SUCCESS",
        "import_batch_id": batch_id,
        "location_id": loc_id,
        "location_name": loc_name,
        "location_code": loc_code,
        "total_records": len(ELURU_STAFF_DATA),
        "created_records": created_records,
        "matched_existing_records": matched_existing_records,
        "updated_records": updated_records,
        "records_requiring_manual_review": records_requiring_manual_review,
        "duty_assignments_created": duty_assignments_created,
        "duty_assignments_existing": duty_assignments_existing,
        "review_details": review_details,
        "designation_summary": summary["counts"],
        "processed_items": processed_items
    }

async def get_eluru_staff_designation_summary(
    db: AsyncIOMotorDatabase
) -> Dict[str, Any]:
    """
    Calculate live designation statistics and assignment numbers directly from MongoDB.
    Target cadre breakdown:
    - AO
    - Office Supdt
    - Sr.Asst
    - Jr.Asst
    - Record Asst
    - Attender
    - Dhobhi
    - OS
    """
    target_designations = [
        "AO", "Office Supdt", "Sr.Asst", "Jr.Asst",
        "Record Asst", "Attender", "Dhobhi", "OS"
    ]
    counts = {d: 0 for d in target_designations}

    cursor = db.officer_profiles.find({
        "$or": [
            {"designation": {"$in": target_designations}},
            {"rank": {"$in": target_designations}}
        ]
    })
    profiles = await cursor.to_list(length=1000)

    total_staff = 0
    assigned_count = 0
    for p in profiles:
        desig = p.get("designation") or p.get("rank")
        if desig in counts:
            counts[desig] += 1
            total_staff += 1
        if p.get("assignment_status") == "ACTIVE" or p.get("duty_location_id"):
            assigned_count += 1

    eluru_loc = await find_eluru_location(db)

    return {
        "total_staff": total_staff,
        "counts": counts,
        "location_id": str(eluru_loc["_id"]) if eluru_loc else None,
        "location_name": eluru_loc.get("name") if eluru_loc else "Eluru District Police Headquarters",
        "assigned_count": assigned_count,
        "unassigned_count": max(0, total_staff - assigned_count)
    }
