from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.services.auth_service import require_roles
from app.services.report_service import generate_attendance_csv, generate_attendance_pdf
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

@router.get("/attendance.csv")
async def export_csv(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    officer_id: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Export filtered headquarters attendance records as a downloadable CSV."""
    csv_content = await generate_attendance_csv(
        db=db,
        start_date=start_date,
        end_date=end_date,
        officer_id=officer_id
    )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="REPORT_EXPORTED",
        target_type="attendance_visits",
        target_id="CSV_EXPORT",
        reason="Admin exported attendance visits as CSV",
        metadata={"start_date": str(start_date), "end_date": str(end_date), "officer_id": officer_id}
    )

    filename = f"policehq_attendance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/attendance.pdf")
async def export_pdf(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    officer_id: Optional[str] = Query(None),
    admin_user: Dict[str, Any] = Depends(require_roles(["super_admin", "hq_admin"])),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Export filtered headquarters attendance ledger as an official AP Police PDF report."""
    pdf_bytes = await generate_attendance_pdf(
        db=db,
        start_date=start_date,
        end_date=end_date,
        officer_id=officer_id
    )

    await record_audit_log(
        db=db,
        actor_user_id=str(admin_user["_id"]),
        actor_username=admin_user["username"],
        action="REPORT_EXPORTED",
        target_type="attendance_visits",
        target_id="PDF_EXPORT",
        reason="Admin generated official PDF report",
        metadata={"start_date": str(start_date), "end_date": str(end_date), "officer_id": officer_id}
    )

    filename = f"policehq_ledger_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )
