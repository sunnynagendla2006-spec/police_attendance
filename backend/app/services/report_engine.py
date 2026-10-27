import io
import csv
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.auth_service import get_permitted_location_ids, verify_location_access
from app.services.attendance_service import format_duration

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and render total page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}   |   PoliceHQ GeoAttend — Official Police Workforce Management"
        self.drawRightString(760, 20, footer_text)
        self.drawString(30, 20, "CONFIDENTIAL — FOR OFFICIAL LAW ENFORCEMENT USE ONLY")
        self.restoreState()

async def gather_report_data(
    db: AsyncIOMotorDatabase,
    report_type: str,
    date_str: str,
    location_id: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Gather structured records and summary metrics for any report type."""
    # 1. Enforce location scoping
    permitted_locs = None
    if current_user:
        permitted_locs = await get_permitted_location_ids(current_user, db)
        if permitted_locs is not None:
            if location_id and location_id not in permitted_locs:
                raise Exception("Access denied: You do not have permission for the requested location.")
            if not location_id:
                location_ids_filter = permitted_locs
            else:
                location_ids_filter = [location_id]
        else:
            location_ids_filter = [location_id] if location_id else None
    else:
        location_ids_filter = [location_id] if location_id else None

    # Parse date range
    try:
        rep_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        rep_date = datetime.now(timezone.utc).date()
        date_str = rep_date.strftime("%Y-%m-%d")

    start_utc = datetime(rep_date.year, rep_date.month, rep_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_utc = start_utc + timedelta(days=1)

    location_name = "All Permitted Locations"
    if location_id:
        loc_doc = await db.headquarters.find_one({"_id": ObjectId(location_id) if ObjectId.is_valid(location_id) else location_id})
        if loc_doc:
            location_name = loc_doc.get("name", "Duty Post")

    rows: List[List[str]] = []
    headers: List[str] = []
    summary_metrics: Dict[str, Any] = {}
    data_completeness = "COMPLETE"

    if report_type in ("MORNING_REPORT", "MORNING_1030_REPORT", "MORNING_1000_REPORT") or report_type.startswith("MORNING"):
        headers = ["Officer ID", "Officer Name", "Rank", "Department", "Assigned Location", "10:00 AM Snapshot", "Distance (m)", "Accuracy", "Attendance Status"]
        # Query morning snapshots
        q_snap: Dict[str, Any] = {"scheduled_slot": {"$regex": "MORNING|1000", "$options": "i"}, "observed_at": {"$gte": start_utc, "$lt": end_utc}}
        if location_ids_filter:
            q_snap["location_id"] = {"$in": location_ids_filter}
        snapshots = await db.location_snapshots.find(q_snap).to_list(1000)

        # Query all active assignments
        q_asgn: Dict[str, Any] = {"status": "ACTIVE"}
        if location_ids_filter:
            q_asgn["location_id"] = {"$in": location_ids_filter}
        assignments = await db.location_assignments.find(q_asgn).to_list(1000)

        snap_map = {s["user_id"]: s for s in snapshots}
        inside_count = 0
        outside_count = 0
        missed_count = 0

        for a in assignments:
            uid = a["user_id"]
            s = snap_map.get(uid)
            if s:
                st = s.get("status", "UNKNOWN")
                if st == "INSIDE":
                    inside_count += 1
                else:
                    outside_count += 1
                dist_str = f"{s.get('distance_meters', 0):.1f}" if s.get('distance_meters') is not None else "--"
                acc_str = f"±{s.get('accuracy_meters', 0):.0f}m" if s.get('accuracy_meters') else "N/A"
                snap_display = f"{st} ({'On-time' if s.get('is_on_time', True) else 'Delayed'})"
            else:
                missed_count += 1
                snap_display = "MISSED SNAPSHOT"
                dist_str = "Unavailable"
                acc_str = "No Signal"

            # Check attendance
            att = await db.attendance_visits.find_one({"user_id": uid, "entry_at": {"$gte": start_utc, "$lt": end_utc}})
            att_status = att.get("visit_status", "NOT RECORDED") if att else "NOT RECORDED"

            rows.append([
                a.get("officer_id", ""),
                a.get("full_name", a.get("officer_name", "")),
                a.get("rank", ""),
                a.get("department", ""),
                a.get("location_name", ""),
                snap_display,
                dist_str,
                acc_str,
                att_status
            ])

        if missed_count > 0:
            data_completeness = "PARTIAL — MISSING OBSERVATIONS"

        summary_metrics = {
            "Total Assigned Constables": len(assignments),
            "10:00 AM Snapshots Received": len(snapshots),
            "Inside Geofence": inside_count,
            "Outside Geofence": outside_count,
            "Missed or Unavailable": missed_count
        }

    elif report_type in ("EVENING_REPORT", "EVENING_1700_REPORT", "EVENING_1800_REPORT") or report_type.startswith("EVENING"):
        headers = ["Officer ID", "Officer Name", "Rank", "Department", "Assigned Location", "Observation Time", "Geofence Status", "Distance (m)", "Total Duration Today"]
        # Use observations up to 5:00 PM cutoff (do NOT include future 6:00 PM observations)
        cutoff_utc = start_utc + timedelta(hours=17) # 5:00 PM UTC equivalent for the date
        q_obs: Dict[str, Any] = {"observed_at": {"$gte": start_utc, "$lte": cutoff_utc}}
        if location_ids_filter:
            q_obs["location_id"] = {"$in": location_ids_filter}

        q_asgn = {"status": "ACTIVE"}
        if location_ids_filter:
            q_asgn["location_id"] = {"$in": location_ids_filter}
        assignments = await db.location_assignments.find(q_asgn).to_list(1000)

        for a in assignments:
            uid = a["user_id"]
            # Latest observation before 5:00 PM cutoff
            last_obs = await db.location_observations.find_one(
                {"user_id": uid, "observed_at": {"$gte": start_utc, "$lte": cutoff_utc}},
                sort=[("observed_at", -1)]
            )
            obs_time_str = last_obs["observed_at"].strftime("%H:%M:%S") if last_obs and last_obs.get("observed_at") else "No data before 17:00"
            state_str = last_obs.get("current_state", "UNAVAILABLE") if last_obs else "UNAVAILABLE"
            dist_str = f"{last_obs.get('distance_from_hq_meters', 0):.1f}" if last_obs and last_obs.get("distance_from_hq_meters") is not None else "--"

            # Attendance duration
            visits = await db.attendance_visits.find({"user_id": uid, "entry_at": {"$gte": start_utc, "$lt": end_utc}}).to_list(100)
            tot_sec = sum(v.get("duration_seconds", 0) for v in visits if v.get("duration_seconds"))
            dur_str = format_duration(tot_sec)

            rows.append([
                a.get("officer_id", ""),
                a.get("full_name", ""),
                a.get("rank", ""),
                a.get("department", ""),
                a.get("location_name", ""),
                obs_time_str,
                state_str,
                dist_str,
                dur_str
            ])

        summary_metrics = {
            "Total Assigned Constables": len(assignments),
            "Report Cutoff Time": "17:00 (5:00 PM)",
            "Active Duty Status": f"{len([r for r in rows if r[6] == 'INSIDE'])} Inside HQ"
        }

    elif report_type == "OUTSIDE_GEOFENCE":
        headers = ["Officer ID", "Full Name", "Rank", "Assigned Location", "Scheduled Slot", "Observation Time", "Distance (m)", "Radius (m)", "Accuracy", "Status"]
        q_out: Dict[str, Any] = {"observed_at": {"$gte": start_utc, "$lt": end_utc}}
        if location_ids_filter:
            q_out["assigned_location_id"] = {"$in": location_ids_filter}
        out_docs = await db.outside_geofence_observations.find(q_out).sort("observed_at", -1).to_list(2000)

        for o in out_docs:
            obs_dt = o.get("observed_at")
            obs_str = obs_dt.strftime("%Y-%m-%d %H:%M:%S") if obs_dt else "--"
            acc_str = f"±{o.get('accuracy_meters', 0):.0f}m" if o.get('accuracy_meters') else "N/A"
            rows.append([
                o.get("officer_id", ""),
                o.get("full_name", ""),
                o.get("rank", ""),
                o.get("assigned_location_name", ""),
                o.get("scheduled_slot", "SCHEDULED"),
                obs_str,
                f"{o.get('distance_meters', 0):.1f}",
                f"{o.get('geofence_radius_meters', 100):.0f}",
                acc_str,
                o.get("status", "OUTSIDE")
            ])
        summary_metrics = {"Total Out-of-Premises Events": len(out_docs)}

    elif report_type == "LOCATION_ASSIGNMENTS":
        headers = ["Assignment ID", "Officer ID", "Full Name", "Rank", "Assigned Location", "Duty Title", "Start Time", "End Time", "Status", "Assigned By"]
        q_asgn = {}
        if location_ids_filter:
            q_asgn["location_id"] = {"$in": location_ids_filter}
        asgn_docs = await db.location_assignments.find(q_asgn).sort("created_at", -1).to_list(2000)

        for a in asgn_docs:
            st_dt = a.get("start_time")
            en_dt = a.get("end_time")
            rows.append([
                a.get("assignment_id", str(a["_id"])),
                a.get("officer_id", ""),
                a.get("full_name", ""),
                a.get("rank", ""),
                a.get("location_name", ""),
                a.get("duty_title", "General Duty"),
                st_dt.strftime("%Y-%m-%d %H:%M") if st_dt else "--",
                en_dt.strftime("%Y-%m-%d %H:%M") if en_dt else "Open-ended",
                a.get("status", "ACTIVE"),
                a.get("assigned_by_username", "Admin")
            ])
        summary_metrics = {"Total Assigned Records": len(asgn_docs)}

    elif report_type == "APP_USAGE_SUMMARY":
        headers = ["Officer ID", "Full Name", "Rank", "Department", "Assigned Location", "Date", "Total Foreground (Min)", "Apps > 30 Mins", "Permission Status"]
        q_app: Dict[str, Any] = {"reporting_date": date_str}
        app_docs = await db.app_usage_summaries.find(q_app).to_list(1000)
        for a in app_docs:
            over_apps = ", ".join([f"{x.get('app_name')} ({x.get('foreground_duration_minutes', 0):.0f}m)" for x in a.get("apps_exceeding_threshold", [])])
            rows.append([
                a.get("officer_id", ""),
                a.get("officer_name", ""),
                a.get("rank", "Constable"),
                a.get("department", "Police"),
                a.get("assigned_location_name", "Headquarters"),
                a.get("reporting_date", date_str),
                f"{a.get('total_foreground_minutes', 0):.1f}",
                over_apps or "None",
                "GRANTED" if a.get("permission_granted", True) else "DENIED"
            ])
        summary_metrics = {"Total App Usage Records": len(app_docs)}

    else:
        # Default fallback to Attendance visits
        headers = ["Visit ID", "Officer ID", "Officer Name", "Rank", "Station / Location", "Entry Time", "Exit Time", "Duration", "Status"]
        q_att: Dict[str, Any] = {"entry_at": {"$gte": start_utc, "$lt": end_utc}}
        if location_ids_filter:
            q_att["headquarters_id"] = {"$in": location_ids_filter}
        att_docs = await db.attendance_visits.find(q_att).sort("entry_at", -1).to_list(1000)
        for v in att_docs:
            en = v.get("entry_at")
            ex = v.get("exit_at")
            rows.append([
                str(v["_id"]),
                v.get("officer_id", ""),
                v.get("officer_name", ""),
                v.get("rank", "Constable"),
                v.get("department", "Headquarters"),
                en.strftime("%H:%M:%S") if en else "--",
                ex.strftime("%H:%M:%S") if ex else "Active",
                format_duration(v.get("duration_seconds")),
                v.get("visit_status", "CLOSED")
            ])
        summary_metrics = {"Total Attendance Visits": len(att_docs)}

    return {
        "report_type": report_type,
        "title": f"PoliceHQ GeoAttend — {report_type.replace('_', ' ').title()}",
        "reporting_date": date_str,
        "location_name": location_name,
        "headers": headers,
        "rows": rows,
        "summary_metrics": summary_metrics,
        "data_completeness": data_completeness,
        "generated_at": datetime.now(timezone.utc)
    }

def build_csv_string(report_data: Dict[str, Any]) -> str:
    """Generate RFC-4180 compliant CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Metadata header
    writer.writerow(["# ORGANIZATION:", "Andhra Pradesh Police Department — Eluru District"])
    writer.writerow(["# REPORT TITLE:", report_data["title"]])
    writer.writerow(["# REPORT DATE:", report_data["reporting_date"]])
    writer.writerow(["# LOCATION SCOPE:", report_data["location_name"]])
    writer.writerow(["# GENERATED AT:", report_data["generated_at"].isoformat()])
    writer.writerow(["# DATA STATUS:", report_data["data_completeness"]])
    writer.writerow([])

    # Summary metrics
    if report_data.get("summary_metrics"):
        writer.writerow(["# SUMMARY METRICS:"])
        for k, v in report_data["summary_metrics"].items():
            writer.writerow([f"# {k}", v])
        writer.writerow([])

    # Table headers and rows
    writer.writerow(report_data["headers"])
    for row in report_data["rows"]:
        writer.writerow(row)

    return output.getvalue()

def build_pdf_bytes(report_data: Dict[str, Any]) -> bytes:
    """Generate high-resolution, professional police PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="RepTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#17365D")
    )
    subtitle_style = ParagraphStyle(
        name="RepSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569")
    )
    metric_label = ParagraphStyle(
        name="MetricLabel",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=colors.HexColor("#17365D")
    )
    metric_val = ParagraphStyle(
        name="MetricVal",
        fontName="Helvetica",
        fontSize=8,
        textColor=colors.HexColor("#334155")
    )
    table_cell = ParagraphStyle(
        name="CellText",
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B")
    )
    table_hdr = ParagraphStyle(
        name="HdrText",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white
    )

    story = []

    # 1. Header Bar
    story.append(Paragraph("ANDHRA PRADESH POLICE DEPARTMENT", subtitle_style))
    story.append(Paragraph(report_data["title"], title_style))
    meta_line = f"Reporting Date: <b>{report_data['reporting_date']}</b>   |   Scope: <b>{report_data['location_name']}</b>   |   Timezone: <b>Asia/Kolkata</b>   |   Status: <b>{report_data['data_completeness']}</b>"
    story.append(Paragraph(meta_line, subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#17365D"), spaceAfter=10))

    # 2. Key Metrics Table (if any)
    if report_data.get("summary_metrics"):
        metric_cells = []
        for k, v in report_data["summary_metrics"].items():
            metric_cells.append([Paragraph(k, metric_label), Paragraph(str(v), metric_val)])
        # Chunk into 3 columns
        t_metrics = Table(metric_cells, colWidths=[180, 180])
        t_metrics.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(t_metrics)
        story.append(Spacer(1, 12))

    # 3. Main Data Table
    headers = [Paragraph(h, table_hdr) for h in report_data["headers"]]
    data_rows = [headers]

    for r in report_data["rows"][:500]: # up to 500 rows
        data_rows.append([Paragraph(str(c), table_cell) for c in r])

    num_cols = len(report_data["headers"])
    col_width = max(50, int(730 / num_cols))

    t_data = Table(data_rows, colWidths=[col_width] * num_cols, repeatRows=1)
    t_data.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#17365D")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(t_data)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
