import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import settings
from app.schemas.headquarters import (
    HeadquartersResponse,
    HeadquartersCreateRequest,
    HeadquartersUpdateRequest,
    HeadquartersStatusUpdateRequest,
    HeadquartersHistoryItem,
    GeofenceConfigResponse,
    GeofenceConfigUpdateRequest,
    GeofenceHistoryResponse
)
from app.services.audit_service import record_audit_log
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

def _format_hq_doc(hq: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None) -> HeadquartersResponse:
    coords = hq.get("location", {}).get("coordinates", [settings.DEFAULT_HQ_LONGITUDE, settings.DEFAULT_HQ_LATITUDE])
    radius = cfg.get("radius_meters") if cfg else hq.get("radius_meters", settings.DEFAULT_GEOFENCE_RADIUS_METERS)
    if radius is None:
        radius = settings.DEFAULT_GEOFENCE_RADIUS_METERS

    return HeadquartersResponse(
        id=str(hq["_id"]),
        name=hq.get("name", "Police Headquarters"),
        code=hq.get("code", "AP-ELR-HQ"),
        state=hq.get("state", "Andhra Pradesh"),
        district=hq.get("district", "Eluru"),
        city=hq.get("city", "Eluru"),
        address=hq.get("address", ""),
        latitude=coords[1],
        longitude=coords[0],
        radius_meters=float(radius),
        status=hq.get("status", "ACTIVE"),
        is_primary=hq.get("is_primary", True),
        description=hq.get("description"),
        created_at=hq.get("created_at", datetime.now(timezone.utc)),
        updated_at=hq.get("updated_at", datetime.now(timezone.utc))
    )

async def get_active_headquarters(db: AsyncIOMotorDatabase) -> HeadquartersResponse:
    """Retrieve the primary active operational headquarters."""
    hq = await db.headquarters.find_one({"is_primary": True, "status": "ACTIVE"})
    if not hq:
        hq = await db.headquarters.find_one({"is_primary": True})
    if not hq:
        hq = await db.headquarters.find_one({"status": "ACTIVE"})
    if not hq:
        hq = await db.headquarters.find_one({"name": settings.DEFAULT_HQ_NAME})
    if not hq:
        hq = await db.headquarters.find_one()

    if not hq:
        raise HTTPException(status_code=404, detail="No headquarters registered in database.")

    cfg = await db.geofence_configurations.find_one(
        {"headquarters_id": str(hq["_id"])},
        sort=[("created_at", -1)]
    )
    return _format_hq_doc(hq, cfg)

async def get_headquarters_info(db: AsyncIOMotorDatabase) -> HeadquartersResponse:
    """Alias for active primary headquarters."""
    return await get_active_headquarters(db)

async def get_all_headquarters(
    db: AsyncIOMotorDatabase,
    search: Optional[str] = None,
    status_filter: Optional[str] = None
) -> List[HeadquartersResponse]:
    """Retrieve all headquarters facilities with optional search and status filter."""
    query: Dict[str, Any] = {}
    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter.upper()
    if search and search.strip():
        q_term = search.strip()
        query["$or"] = [
            {"name": {"$regex": q_term, "$options": "i"}},
            {"code": {"$regex": q_term, "$options": "i"}},
            {"address": {"$regex": q_term, "$options": "i"}},
            {"district": {"$regex": q_term, "$options": "i"}}
        ]

    cursor = db.headquarters.find(query).sort([("is_primary", -1), ("updated_at", -1)])
    docs = await cursor.to_list(length=100)

    results: List[HeadquartersResponse] = []
    for d in docs:
        cfg = await db.geofence_configurations.find_one(
            {"headquarters_id": str(d["_id"])},
            sort=[("created_at", -1)]
        )
        results.append(_format_hq_doc(d, cfg))
    return results

async def get_headquarters_by_id(db: AsyncIOMotorDatabase, hq_id: str) -> HeadquartersResponse:
    """Retrieve specific headquarters facility by ID."""
    try:
        oid = ObjectId(hq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid headquarters ID format.")

    hq = await db.headquarters.find_one({"_id": oid})
    if not hq:
        raise HTTPException(status_code=404, detail="Headquarters facility not found.")

    cfg = await db.geofence_configurations.find_one(
        {"headquarters_id": hq_id},
        sort=[("created_at", -1)]
    )
    return _format_hq_doc(hq, cfg)

async def create_headquarters(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    req: HeadquartersCreateRequest
) -> HeadquartersResponse:
    """Register a new headquarters or facility."""
    # Check duplicate code
    existing = await db.headquarters.find_one({"code": req.code.strip().upper()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A headquarters facility with code '{req.code.strip().upper()}' already exists."
        )

    now = datetime.now(timezone.utc)

    # If this is set as primary, unset other facilities
    if req.is_primary:
        await db.headquarters.update_many({}, {"$set": {"is_primary": False}})

    hq_doc = {
        "name": req.name.strip(),
        "code": req.code.strip().upper(),
        "state": req.state.strip(),
        "district": req.district.strip(),
        "city": req.city.strip(),
        "address": req.address.strip(),
        "location": {
            "type": "Point",
            "coordinates": [req.longitude, req.latitude]
        },
        "radius_meters": req.radius_meters,
        "status": req.status,
        "is_primary": req.is_primary,
        "description": req.description.strip() if req.description else None,
        "created_by": admin_user["username"],
        "created_at": now,
        "updated_by": admin_user["username"],
        "updated_at": now
    }

    res = await db.headquarters.insert_one(hq_doc)
    hq_id = str(res.inserted_id)

    # Insert initial geofence config
    geofence_doc = {
        "headquarters_id": hq_id,
        "radius_meters": req.radius_meters,
        "accuracy_threshold_meters": settings.DEFAULT_ACCURACY_THRESHOLD_METERS,
        "entry_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 15},
        "exit_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 30},
        "stale_threshold_seconds": settings.DEFAULT_STALE_THRESHOLD_SECONDS,
        "effective_from": now,
        "changed_by": admin_user["username"],
        "change_reason": "Facility created and initial geofence established",
        "created_at": now
    }
    await db.geofence_configurations.insert_one(geofence_doc)

    # Record Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="HEADQUARTERS_CREATED",
        target_type="headquarters",
        target_id=hq_id,
        reason=f"Created facility {req.name} ({req.code})",
        metadata={
            "name": req.name,
            "code": req.code,
            "coordinates": [req.longitude, req.latitude],
            "radius_meters": req.radius_meters
        }
    )

    hq_doc["_id"] = res.inserted_id
    return _format_hq_doc(hq_doc, geofence_doc)

async def update_headquarters(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    hq_id: str,
    req: HeadquartersUpdateRequest
) -> HeadquartersResponse:
    """
    Authoritative update of headquarters configuration:
    - Modifies facility metadata, coordinates, and/or radius.
    - Appends snapshot to headquarters_history and geofence_configurations.
    - Preserves all historical attendance and visit records without mutation.
    - Records audit log and broadcasts real-time WebSocket update.
    """
    try:
        oid = ObjectId(hq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid headquarters ID format.")

    current_hq = await db.headquarters.find_one({"_id": oid})
    if not current_hq:
        raise HTTPException(status_code=404, detail="Headquarters facility not found.")

    now = datetime.now(timezone.utc)
    prev_coords = current_hq.get("location", {}).get("coordinates", [settings.DEFAULT_HQ_LONGITUDE, settings.DEFAULT_HQ_LATITUDE])
    prev_lat = float(prev_coords[1])
    prev_lng = float(prev_coords[0])
    prev_radius = float(current_hq.get("radius_meters", settings.DEFAULT_GEOFENCE_RADIUS_METERS))
    prev_address = current_hq.get("address", "")
    prev_name = current_hq.get("name", "")

    # Check if duplicate code if code changed
    if req.code and req.code.strip().upper() != current_hq.get("code"):
        existing = await db.headquarters.find_one({
            "code": req.code.strip().upper(),
            "_id": {"$ne": oid}
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Headquarters code '{req.code.strip().upper()}' is already used by another facility."
            )

    update_fields: Dict[str, Any] = {
        "updated_at": now,
        "updated_by": admin_user["username"]
    }

    if req.name is not None:
        update_fields["name"] = req.name.strip()
    if req.code is not None:
        update_fields["code"] = req.code.strip().upper()
    if req.state is not None:
        update_fields["state"] = req.state.strip()
    if req.district is not None:
        update_fields["district"] = req.district.strip()
    if req.city is not None:
        update_fields["city"] = req.city.strip()
    if req.address is not None:
        update_fields["address"] = req.address.strip()
    if req.description is not None:
        update_fields["description"] = req.description.strip()
    if req.status is not None:
        update_fields["status"] = req.status

    coords_changed = False
    new_lat = prev_lat
    new_lng = prev_lng
    if req.latitude is not None and req.longitude is not None:
        new_lat = float(req.latitude)
        new_lng = float(req.longitude)
        if abs(new_lat - prev_lat) > 0.00001 or abs(new_lng - prev_lng) > 0.00001:
            coords_changed = True
        update_fields["location"] = {
            "type": "Point",
            "coordinates": [new_lng, new_lat]
        }

    radius_changed = False
    new_radius = prev_radius
    if req.radius_meters is not None:
        new_radius = float(req.radius_meters)
        if abs(new_radius - prev_radius) > 0.5:
            radius_changed = True
        update_fields["radius_meters"] = new_radius

    if req.is_primary is True:
        # Unset primary on others
        await db.headquarters.update_many({"_id": {"$ne": oid}}, {"$set": {"is_primary": False}})
        update_fields["is_primary"] = True
    elif req.is_primary is False:
        update_fields["is_primary"] = False

    await db.headquarters.update_one({"_id": oid}, {"$set": update_fields})

    # If coordinates, radius, or address changed, record to headquarters_history & geofence_configurations
    if coords_changed or radius_changed or (req.address and req.address != prev_address):
        history_doc = {
            "headquarters_id": hq_id,
            "headquarters_name": update_fields.get("name", prev_name),
            "previous_coordinates": {"latitude": prev_lat, "longitude": prev_lng},
            "new_coordinates": {"latitude": new_lat, "longitude": new_lng},
            "previous_radius": prev_radius,
            "new_radius": new_radius,
            "previous_address": prev_address,
            "new_address": update_fields.get("address", prev_address),
            "changed_by": admin_user["username"],
            "change_reason": req.change_reason.strip(),
            "created_at": now
        }
        await db.headquarters_history.insert_one(history_doc)

    if radius_changed or coords_changed:
        geofence_doc = {
            "headquarters_id": hq_id,
            "radius_meters": new_radius,
            "accuracy_threshold_meters": settings.DEFAULT_ACCURACY_THRESHOLD_METERS,
            "entry_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 15},
            "exit_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 30},
            "stale_threshold_seconds": settings.DEFAULT_STALE_THRESHOLD_SECONDS,
            "effective_from": now,
            "changed_by": admin_user["username"],
            "change_reason": req.change_reason.strip(),
            "created_at": now
        }
        await db.geofence_configurations.insert_one(geofence_doc)

    # Audit Logging
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="HEADQUARTERS_UPDATED",
        target_type="headquarters",
        target_id=hq_id,
        reason=req.change_reason,
        metadata={
            "previous_coordinates": [prev_lng, prev_lat],
            "new_coordinates": [new_lng, new_lat],
            "previous_radius": prev_radius,
            "new_radius": new_radius,
            "previous_address": prev_address,
            "new_address": update_fields.get("address", prev_address),
            "name": update_fields.get("name", prev_name)
        }
    )

    # WebSocket Broadcast
    await ws_manager.broadcast({
        "type": "HEADQUARTERS_LOCATION_UPDATED",
        "data": {
            "headquarters_id": hq_id,
            "name": update_fields.get("name", prev_name),
            "latitude": new_lat,
            "longitude": new_lng,
            "radius_meters": new_radius,
            "updated_by": admin_user["username"],
            "change_reason": req.change_reason
        }
    })

    updated_doc = await db.headquarters.find_one({"_id": oid})
    return _format_hq_doc(updated_doc, {"radius_meters": new_radius})

async def set_primary_headquarters(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    hq_id: str,
    change_reason: str
) -> HeadquartersResponse:
    """Designate this facility as the active primary headquarters."""
    try:
        oid = ObjectId(hq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid headquarters ID format.")

    target = await db.headquarters.find_one({"_id": oid})
    if not target:
        raise HTTPException(status_code=404, detail="Headquarters facility not found.")

    now = datetime.now(timezone.utc)
    # Unset is_primary on all
    await db.headquarters.update_many({"_id": {"$ne": oid}}, {"$set": {"is_primary": False}})
    await db.headquarters.update_one(
        {"_id": oid},
        {"$set": {"is_primary": True, "status": "ACTIVE", "updated_at": now, "updated_by": admin_user["username"]}}
    )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="HEADQUARTERS_SET_PRIMARY",
        target_type="headquarters",
        target_id=hq_id,
        reason=change_reason,
        metadata={"name": target.get("name"), "code": target.get("code")}
    )

    await ws_manager.broadcast({
        "type": "HEADQUARTERS_PRIMARY_CHANGED",
        "data": {
            "headquarters_id": hq_id,
            "name": target.get("name"),
            "changed_by": admin_user["username"]
        }
    })

    updated = await db.headquarters.find_one({"_id": oid})
    return _format_hq_doc(updated)

async def update_headquarters_status(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    hq_id: str,
    req: HeadquartersStatusUpdateRequest
) -> HeadquartersResponse:
    """Modify the operational status (ACTIVE, INACTIVE, MAINTENANCE) of a facility."""
    try:
        oid = ObjectId(hq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid headquarters ID format.")

    now = datetime.now(timezone.utc)
    set_fields: Dict[str, Any] = {
        "status": req.status,
        "updated_at": now,
        "updated_by": admin_user["username"]
    }
    if req.is_primary is True:
        await db.headquarters.update_many({"_id": {"$ne": oid}}, {"$set": {"is_primary": False}})
        set_fields["is_primary"] = True

    await db.headquarters.update_one({"_id": oid}, {"$set": set_fields})
    updated = await db.headquarters.find_one({"_id": oid})
    if not updated:
        raise HTTPException(status_code=404, detail="Headquarters facility not found.")

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="HEADQUARTERS_STATUS_CHANGED",
        target_type="headquarters",
        target_id=hq_id,
        reason=req.change_reason,
        metadata={"new_status": req.status}
    )

    return _format_hq_doc(updated)

async def get_headquarters_change_history(
    db: AsyncIOMotorDatabase,
    hq_id: Optional[str] = None
) -> List[HeadquartersHistoryItem]:
    """Retrieve the audit and version history of headquarters location modifications."""
    query: Dict[str, Any] = {}
    if hq_id:
        query["headquarters_id"] = hq_id

    cursor = db.headquarters_history.find(query).sort("created_at", -1).limit(100)
    docs = await cursor.to_list(length=100)

    return [
        HeadquartersHistoryItem(
            id=str(d["_id"]),
            headquarters_id=d["headquarters_id"],
            headquarters_name=d.get("headquarters_name", "Headquarters"),
            previous_coordinates=d.get("previous_coordinates"),
            new_coordinates=d.get("new_coordinates"),
            previous_radius=d.get("previous_radius"),
            new_radius=d.get("new_radius"),
            previous_address=d.get("previous_address"),
            new_address=d.get("new_address"),
            changed_by=d.get("changed_by", "ADMIN"),
            change_reason=d.get("change_reason", ""),
            created_at=d.get("created_at", datetime.now(timezone.utc))
        )
        for d in docs
    ]

async def get_current_geofence_config(db: AsyncIOMotorDatabase, hq_id: Optional[str] = None) -> GeofenceConfigResponse:
    """Retrieve active geofence configuration for the primary or specified headquarters."""
    if not hq_id:
        active_hq = await get_active_headquarters(db)
        hq_id = active_hq.id

    cfg = await db.geofence_configurations.find_one(
        {"headquarters_id": hq_id},
        sort=[("created_at", -1)]
    )

    if not cfg:
        now = datetime.now(timezone.utc)
        return GeofenceConfigResponse(
            id="default-cfg",
            headquarters_id=hq_id,
            radius_meters=settings.DEFAULT_GEOFENCE_RADIUS_METERS,
            accuracy_threshold_meters=settings.DEFAULT_ACCURACY_THRESHOLD_METERS,
            entry_confirmation_policy={"consecutive_observations": 2, "dwell_seconds": 15},
            exit_confirmation_policy={"consecutive_observations": 2, "dwell_seconds": 30},
            stale_threshold_seconds=settings.DEFAULT_STALE_THRESHOLD_SECONDS,
            effective_from=now,
            changed_by="SYSTEM",
            change_reason="Default system configuration",
            created_at=now
        )

    return GeofenceConfigResponse(
        id=str(cfg["_id"]),
        headquarters_id=cfg["headquarters_id"],
        radius_meters=cfg["radius_meters"],
        accuracy_threshold_meters=cfg.get("accuracy_threshold_meters", 35.0),
        entry_confirmation_policy=cfg.get("entry_confirmation_policy", {}),
        exit_confirmation_policy=cfg.get("exit_confirmation_policy", {}),
        stale_threshold_seconds=cfg.get("stale_threshold_seconds", 300),
        effective_from=cfg.get("effective_from", datetime.now(timezone.utc)),
        changed_by=cfg.get("changed_by", "ADMIN"),
        change_reason=cfg.get("change_reason", ""),
        created_at=cfg.get("created_at", datetime.now(timezone.utc))
    )

async def update_geofence_config(
    db: AsyncIOMotorDatabase,
    admin_user: Dict[str, Any],
    req: GeofenceConfigUpdateRequest,
    hq_id: Optional[str] = None
) -> GeofenceConfigResponse:
    """Update geofence radius for primary or specified headquarters."""
    if not hq_id:
        active_hq = await get_active_headquarters(db)
        hq_id = active_hq.id

    now = datetime.now(timezone.utc)
    current = await get_current_geofence_config(db, hq_id=hq_id)
    prev_radius = current.radius_meters

    new_doc = {
        "headquarters_id": hq_id,
        "radius_meters": req.radius_meters,
        "accuracy_threshold_meters": req.accuracy_threshold_meters or 35.0,
        "entry_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 15},
        "exit_confirmation_policy": {"consecutive_observations": 2, "dwell_seconds": 30},
        "stale_threshold_seconds": req.stale_threshold_seconds or 300,
        "effective_from": now,
        "changed_by": admin_user["username"],
        "change_reason": req.change_reason.strip(),
        "created_at": now
    }

    res = await db.geofence_configurations.insert_one(new_doc)
    new_id = str(res.inserted_id)

    # Also update headquarters doc radius
    try:
        await db.headquarters.update_one(
            {"_id": ObjectId(hq_id)},
            {"$set": {"radius_meters": req.radius_meters, "updated_at": now, "updated_by": admin_user["username"]}}
        )
    except Exception:
        pass

    # Audit Log
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="GEOFENCE_UPDATED",
        target_type="geofence_configurations",
        target_id=new_id,
        reason=req.change_reason,
        metadata={
            "previous_radius_meters": prev_radius,
            "new_radius_meters": req.radius_meters,
            "headquarters_id": hq_id
        }
    )

    # Broadcast
    await ws_manager.broadcast({
        "type": "GEOFENCE_CONFIG_UPDATED",
        "data": {
            "headquarters_id": hq_id,
            "radius_meters": req.radius_meters,
            "accuracy_threshold_meters": req.accuracy_threshold_meters or 35.0,
            "stale_threshold_seconds": req.stale_threshold_seconds or 300,
            "updated_by": admin_user["username"]
        }
    })

    return GeofenceConfigResponse(
        id=new_id,
        headquarters_id=hq_id,
        radius_meters=req.radius_meters,
        accuracy_threshold_meters=req.accuracy_threshold_meters or 35.0,
        entry_confirmation_policy=new_doc["entry_confirmation_policy"],
        exit_confirmation_policy=new_doc["exit_confirmation_policy"],
        stale_threshold_seconds=req.stale_threshold_seconds or 300,
        effective_from=now,
        changed_by=admin_user["username"],
        change_reason=req.change_reason,
        created_at=now
    )

async def get_geofence_history(db: AsyncIOMotorDatabase, hq_id: Optional[str] = None) -> GeofenceHistoryResponse:
    """Retrieve full history of geofence configuration changes."""
    current = await get_current_geofence_config(db, hq_id=hq_id)
    query: Dict[str, Any] = {}
    if hq_id:
        query["headquarters_id"] = hq_id

    cursor = db.geofence_configurations.find(query).sort("created_at", -1).limit(50)
    history_docs = await cursor.to_list(length=50)

    history = [
        GeofenceConfigResponse(
            id=str(d["_id"]),
            headquarters_id=d["headquarters_id"],
            radius_meters=d["radius_meters"],
            accuracy_threshold_meters=d.get("accuracy_threshold_meters", 35.0),
            entry_confirmation_policy=d.get("entry_confirmation_policy", {}),
            exit_confirmation_policy=d.get("exit_confirmation_policy", {}),
            stale_threshold_seconds=d.get("stale_threshold_seconds", 300),
            effective_from=d.get("effective_from", d.get("created_at")),
            changed_by=d.get("changed_by", "ADMIN"),
            change_reason=d.get("change_reason", ""),
            created_at=d.get("created_at")
        )
        for d in history_docs
    ]

    return GeofenceHistoryResponse(current=current, history=history)
