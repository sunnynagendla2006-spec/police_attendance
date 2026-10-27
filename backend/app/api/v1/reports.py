import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, Response, status, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.services.auth_service import require_roles, get_permitted_location_ids, verify_location_access
from app.services.report_engine import gather_report_data, build_csv_string, build_pdf_bytes
from app.services.scheduler_service import generate_and_save_scheduled_report
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/reports", tags=["Reports & Scheduled Downloads"])

@router.get("/scheduled")
async def list_scheduled_reports(
    report_type: Optional[str] = Query(None, description="MORNING_REPORT, EVENING_REPORT, or ALL"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List generated scheduled reports (Morning 10:30 AM, Evening 5:00 PM, and on-demand)."""
    permitted_locs = await get_permitted_location_ids(current_user, db)
    query: Dict[str, Any] = {}

    if permitted_locs is not None:
        query["$or"] = [
            {"location_id": None}, # Organization reports permitted if assigned
            {"location_id": {"$in": permitted_locs}}
        ]

    if report_type and report_type != "ALL":
        query["report_type"] = report_type
    if date:
        query["reporting_date"] = date

    cursor = db.scheduled_reports.find(query).sort([("reporting_date", -1), ("generated_at", -1)]).limit(100)
    docs = await cursor.to_list(100)
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
    return docs

from app.schemas.report_schedule import ReportGenerateRequest

@router.post("/generate")
async def trigger_report_generation(
    req: Optional[ReportGenerateRequest] = None,
    report_type: Optional[str] = Query(None, description="MORNING_REPORT, EVENING_REPORT, OUTSIDE_GEOFENCE, LOCATION_ASSIGNMENTS, APP_USAGE_SUMMARY"),
    reporting_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    location_id: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Administrators: Generate or regenerate a consolidated report for any specific date."""
    target_type = (req.report_type if req and req.report_type else None) or report_type or "MORNING_1030_REPORT"
    target_date = (req.reporting_date or req.report_date if req else None) or reporting_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target_loc = (req.location_id if req else None) or location_id

    if target_loc:
        await verify_location_access(admin_user, target_loc, db)

    res = await generate_and_save_scheduled_report(
        db=db,
        report_type=target_type,
        reporting_date_str=target_date,
        reporting_slot="ON_DEMAND",
        generated_by=admin_user["username"],
        location_id=target_loc
    )
    if res and "_id" in res:
        res["id"] = str(res["_id"])
        del res["_id"]
    return res

@router.get("/download")
async def download_report(
    report_type: str = Query(..., description="Report type identifier"),
    format: str = Query("pdf", description="pdf or csv"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    report_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    location_id: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Download official PoliceHQ reports in CSV or PDF format.
    Enforces location permissions and records download in audit history.
    """
    clean_format = format.lower().strip()
    if clean_format not in ("pdf", "csv"):
        clean_format = "pdf"

    target_date = report_date or date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if location_id:
        await verify_location_access(admin_user, location_id, db)
    elif admin_user.get("role") != "super_admin":
        # Admin must supply an authorized location or default to first assigned
        permitted = await get_permitted_location_ids(admin_user, db)
        if not permitted:
            raise HTTPException(status_code=403, detail="No duty locations assigned to your administrator account.")
        location_id = permitted[0]

    report_data = await gather_report_data(
        db=db,
        report_type=report_type,
        date_str=target_date,
        location_id=location_id,
        current_user=admin_user
    )

    now = datetime.now(timezone.utc)
    download_id = f"DL-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    # Log in report_downloads collection
    await db.report_downloads.insert_one({
        "download_id": download_id,
        "report_type": report_type,
        "format": format.upper(),
        "requested_by_user_id": str(admin_user["_id"]),
        "requested_by_username": admin_user["username"],
        "applicable_location_id": location_id,
        "applicable_location_name": report_data["location_name"],
        "reporting_period_start": date,
        "reporting_period_end": date,
        "status": "COMPLETED",
        "downloaded_at": now,
        "row_count": len(report_data.get("rows", []))
    })

    # Log in audit_logs
    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="REPORT_DOWNLOADED",
        target_type="report",
        target_id=download_id,
        reason=f"Downloaded {report_type} ({format.upper()}) for date {date}",
        metadata={"format": format, "location": report_data["location_name"]}
    )

    clean_filename = f"PoliceHQ_{report_type.lower()}_{target_date}_{now.strftime('%H%M%S')}.{clean_format}"

    if clean_format == "csv":
        csv_str = build_csv_string(report_data)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={clean_filename}"}
        )
    else:
        pdf_bytes = build_pdf_bytes(report_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={clean_filename}"}
        )

@router.get("/attendance.csv")
async def download_attendance_csv_legacy(
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Legacy compatibility endpoint: Download today's attendance visits as CSV."""
    return await download_report(
        report_type="ATTENDANCE_CONSOLIDATED",
        format="csv",
        date=None,
        report_date=None,
        location_id=None,
        admin_user=current_user,
        db=db
    )

@router.get("/attendance.pdf")
async def download_attendance_pdf_legacy(
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Legacy compatibility endpoint: Download today's attendance visits as PDF."""
    return await download_report(
        report_type="ATTENDANCE_CONSOLIDATED",
        format="pdf",
        date=None,
        report_date=None,
        location_id=None,
        admin_user=current_user,
        db=db
    )

@router.get("/downloads/history")
async def get_download_history(
    current_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """View audit history of generated and downloaded reports."""
    permitted_locs = await get_permitted_location_ids(current_user, db)
    query: Dict[str, Any] = {}

    if permitted_locs is not None:
        query["$or"] = [
            {"requested_by_user_id": str(current_user["_id"])},
            {"applicable_location_id": {"$in": permitted_locs}}
        ]

    cursor = db.report_downloads.find(query).sort("downloaded_at", -1).limit(100)
    docs = await cursor.to_list(100)
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
        d["user_id"] = d.get("requested_by_user_id")
        d["username"] = d.get("requested_by_username")
        d["location_name"] = d.get("applicable_location_name")
        d["report_date"] = d.get("reporting_period_start")
    return docs
