import io
import csv
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.attendance_service import format_duration

async def generate_attendance_csv(
    db: AsyncIOMotorDatabase,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    officer_id: Optional[str] = None
) -> str:
    """Generate CSV string of filtered attendance visits."""
    query: Dict[str, Any] = {}
    if officer_id:
        query["officer_id"] = officer_id
    if start_date or end_date:
        query["entry_at"] = {}
        if start_date:
            query["entry_at"]["$gte"] = start_date
        if end_date:
            query["entry_at"]["$lte"] = end_date

    visits = await db.attendance_visits.find(query).sort("entry_at", -1).to_list(length=5000)

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    writer.writerow([
        "Visit ID",
        "Officer ID",
        "Full Name",
        "Rank",
        "Department",
        "Entry Time (UTC)",
        "Exit Time (UTC)",
        "Duration (Seconds)",
        "Duration Formatted",
        "Entry Verification",
        "Exit Verification",
        "Visit Status",
        "Notes"
    ])

    for v in visits:
        writer.writerow([
            str(v["_id"]),
            v.get("officer_id", ""),
            v.get("officer_name", ""),
            v.get("rank", ""),
            v.get("department", ""),
            v["entry_at"].isoformat() if v.get("entry_at") else "",
            v["exit_at"].isoformat() if v.get("exit_at") else "",
            v.get("duration_seconds", ""),
            format_duration(v.get("duration_seconds")),
            v.get("entry_verification_status", ""),
            v.get("exit_verification_status", ""),
            v.get("visit_status", ""),
            v.get("notes", "")
        ])

    return output.getvalue()

async def generate_attendance_pdf(
    db: AsyncIOMotorDatabase,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    officer_id: Optional[str] = None
) -> bytes:
    """Generate official PDF attendance ledger report using ReportLab."""
    query: Dict[str, Any] = {}
    if officer_id:
        query["officer_id"] = officer_id
    if start_date or end_date:
        query["entry_at"] = {}
        if start_date:
            query["entry_at"]["$gte"] = start_date
        if end_date:
            query["entry_at"]["$lte"] = end_date

    visits = await db.attendance_visits.find(query).sort("entry_at", -1).to_list(length=200)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0f172a'),
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1
    )
    cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    header_cell_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("ANDHRA PRADESH POLICE DEPARTMENT", subtitle_style))
    elements.append(Paragraph("Eluru District Police Headquarters — Attendance & Visit Ledger", title_style))
    now_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M:%S UTC")
    elements.append(Paragraph(f"Official Headquarters Audit Ledger | Generated: {now_str}", subtitle_style))
    elements.append(Spacer(1, 15))

    # Table Data
    table_data = [[
        Paragraph("Officer ID", header_cell_style),
        Paragraph("Officer Name", header_cell_style),
        Paragraph("Rank", header_cell_style),
        Paragraph("Department", header_cell_style),
        Paragraph("Entry Time (UTC)", header_cell_style),
        Paragraph("Exit Time (UTC)", header_cell_style),
        Paragraph("Duration", header_cell_style),
        Paragraph("Status", header_cell_style),
        Paragraph("Verification", header_cell_style),
    ]]

    for v in visits:
        entry_str = v["entry_at"].strftime("%d-%b %H:%M") if v.get("entry_at") else "-"
        exit_str = v["exit_at"].strftime("%d-%b %H:%M") if v.get("exit_at") else "Ongoing"
        dur_str = format_duration(v.get("duration_seconds"))
        
        table_data.append([
            Paragraph(v.get("officer_id", ""), cell_style),
            Paragraph(v.get("officer_name", ""), cell_style),
            Paragraph(v.get("rank", ""), cell_style),
            Paragraph(v.get("department", ""), cell_style),
            Paragraph(entry_str, cell_style),
            Paragraph(exit_str, cell_style),
            Paragraph(dur_str, cell_style),
            Paragraph(v.get("visit_status", ""), cell_style),
            Paragraph(v.get("entry_verification_status", "VERIFIED"), cell_style),
        ])

    if len(table_data) == 1:
        table_data.append([Paragraph("No attendance records found for this period.", cell_style)] * 9)

    col_widths = [75, 110, 85, 110, 95, 95, 60, 65, 75]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0f172a')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))

    elements.append(table)
    doc.build(elements)
    
    return buffer.getvalue()
