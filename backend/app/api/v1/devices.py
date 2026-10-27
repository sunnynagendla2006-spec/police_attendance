from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.device import (
    DeviceRegistrationRequest,
    DeviceRecordResponse,
    DeviceApprovalRequest,
    DeviceReplacementRequest
)
from app.services.auth_service import require_roles, get_current_user
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/devices", tags=["Device Management & Binding"])

@router.get("", response_model=List[DeviceRecordResponse])
async def list_registered_devices(
    status: Optional[str] = Query(None, description="Filter by approval status: APPROVED, PENDING, REVOKED, ALL"),
    search: Optional[str] = Query(None, description="Search by Officer ID, Model, or Device ID"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """View registered constable mobile devices and their cryptographic binding status."""
    query: Dict[str, Any] = {}
    if status and status != "ALL":
        query["approval_status"] = status

    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"device_id": {"$regex": s, "$options": "i"}},
            {"device_identifier": {"$regex": s, "$options": "i"}},
            {"device_model": {"$regex": s, "$options": "i"}},
            {"officer_id": {"$regex": s, "$options": "i"}}
        ]

    cursor = db.registered_devices.find(query).sort("registered_at", -1).limit(200)
    devices = await cursor.to_list(200)

    results = []
    for d in devices:
        uid = str(d.get("user_id", ""))
        profile = await db.officer_profiles.find_one({"user_id": uid})
        results.append(DeviceRecordResponse(
            id=str(d["_id"]),
            user_id=uid,
            officer_id=profile.get("officer_id", "UNKNOWN") if profile else "CONSTABLE",
            officer_name=profile.get("full_name", "Officer") if profile else "Constable",
            device_id=d.get("device_identifier") or d.get("device_id", "UNKNOWN"),
            device_model=d.get("device_model", "Android"),
            os_version=d.get("os_version"),
            app_version=d.get("app_version"),
            approval_status=d.get("approval_status", "APPROVED"),
            registered_at=d.get("registered_at", d.get("created_at", datetime.now(timezone.utc))),
            last_authenticated_at=d.get("last_authenticated_at"),
            revoked_at=d.get("revoked_at"),
            revocation_reason=d.get("revocation_reason"),
            approved_by=d.get("approved_by")
        ))
    return results

@router.post("/approve")
async def approve_device(
    req: DeviceApprovalRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Authorize or revoke a registered constable mobile device."""
    query = {
        "$or": [
            {"device_identifier": req.device_id},
            {"device_id": req.device_id},
            {"_id": ObjectId(req.device_id) if ObjectId.is_valid(req.device_id) else req.device_id}
        ]
    }
    device = await db.registered_devices.find_one(query)
    if not device:
        raise HTTPException(status_code=404, detail="Device record not found.")

    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {
        "approval_status": req.approval_status,
        "updated_at": now
    }
    if req.approval_status == "APPROVED":
        updates["approved_by"] = admin_user["username"]
        updates["revoked_at"] = None
        updates["revocation_reason"] = None
    else:
        updates["revoked_at"] = now
        updates["revocation_reason"] = req.reason

    await db.registered_devices.update_one({"_id": device["_id"]}, {"$set": updates})

    # Security Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action=f"DEVICE_{req.approval_status}",
        target_type="device",
        target_id=device.get("device_identifier", str(device["_id"])),
        reason=req.reason,
        metadata={"user_id": device["user_id"], "new_status": req.approval_status}
    )

    return {
        "status": "SUCCESS",
        "message": f"Device {device.get('device_identifier')} has been updated to {req.approval_status}."
    }

@router.post("/replace")
async def replace_constable_device(
    req: DeviceReplacementRequest,
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Device Replacement Workflow:
    Revoke existing bound device for a constable, enabling their new mobile device to register.
    """
    profile = None
    if req.officer_id and req.officer_id.strip():
        oid = req.officer_id.strip()
        profile = await db.officer_profiles.find_one({
            "$or": [
                {"officer_id": oid},
                {"officer_id": {"$regex": f"^{oid}$", "$options": "i"}}
            ]
        })
    target_uid = req.constable_user_id or req.user_id
    if not profile and target_uid:
        uid_str = str(target_uid).strip()
        profile = await db.officer_profiles.find_one({
            "$or": [
                {"user_id": uid_str},
                {"user_id": ObjectId(uid_str) if ObjectId.is_valid(uid_str) else uid_str},
                {"_id": ObjectId(uid_str) if ObjectId.is_valid(uid_str) else uid_str}
            ]
        })

    user_id_str = str(profile["user_id"]) if profile else str(target_uid) if target_uid else None
    if not user_id_str:
        raise HTTPException(status_code=404, detail="Officer profile or constable_user_id not found.")

    now = datetime.now(timezone.utc)

    # Revoke old device bindings
    res = await db.registered_devices.update_many(
        {"user_id": user_id_str},
        {"$set": {
            "approval_status": "REVOKED",
            "revoked_at": now,
            "revocation_reason": f"Device replaced: {req.reason}",
            "updated_at": now
        }}
    )

    # If new_device_id was provided, pre-approve it for this constable
    if req.new_device_id and req.new_device_id.strip():
        new_dev_id = req.new_device_id.strip()
        await db.registered_devices.update_one(
            {"device_identifier": new_dev_id},
            {
                "$set": {
                    "user_id": user_id_str,
                    "device_identifier": new_dev_id,
                    "device_model": "Replacement Mobile Handset",
                    "approval_status": "APPROVED",
                    "approved_by": admin_user["username"],
                    "approved_at": now,
                    "registered_at": now,
                    "created_at": now,
                    "updated_at": now
                }
            },
            upsert=True
        )

    # Security Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="DEVICE_REPLACEMENT_AUTHORIZED",
        target_type="user",
        target_id=user_id_str,
        reason=req.reason,
        metadata={"previous_devices_revoked": res.modified_count, "new_device_id": req.new_device_id}
    )

    return {
        "status": "SUCCESS",
        "message": "Successfully replaced device binding. New device is authorized for attendance recording."
    }
