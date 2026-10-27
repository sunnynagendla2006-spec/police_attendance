import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.report_engine import gather_report_data
from app.services.snapshot_service import get_or_create_schedule_config

logger = logging.getLogger(__name__)

# Global background task handle
_scheduler_task: Optional[asyncio.Task] = None

async def generate_and_save_scheduled_report(
    db: AsyncIOMotorDatabase,
    report_type: str,
    reporting_date_str: str,
    reporting_slot: str,
    generated_by: str = "SYSTEM_SCHEDULER",
    location_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate and save a scheduled report record idempotently.
    Prevents duplicate generation for the same date and slot unless explicitly forced.
    """
    # 1. Check if already generated
    query = {
        "report_type": report_type,
        "reporting_date": reporting_date_str,
        "reporting_slot": reporting_slot,
        "location_id": location_id
    }
    existing = await db.scheduled_reports.find_one(query)
    now = datetime.now(timezone.utc)

    # 2. Gather data
    data = await gather_report_data(
        db=db,
        report_type=report_type,
        date_str=reporting_date_str,
        location_id=location_id
    )

    metrics = data.get("summary_metrics", {})
    completeness = data.get("data_completeness", "COMPLETE")

    report_id = f"REP-{reporting_date_str.replace('-', '')}-{report_type[:4]}-{reporting_slot.replace(':', '')[:4]}"

    doc = {
        "report_id": report_id,
        "report_type": report_type,
        "title": data["title"],
        "reporting_date": reporting_date_str,
        "reporting_slot": reporting_slot,
        "location_id": location_id,
        "location_name": data["location_name"],
        "report_date": reporting_date_str,
        "schedule_time_label": f"{reporting_slot} Daily Report",
        "total_assigned_constables": metrics.get("Total Assigned Constables", len(data.get("rows", []))),
        "total_constables_evaluated": metrics.get("Total Assigned Constables", len(data.get("rows", []))),
        "total_snapshots_received": metrics.get("10:00 AM Snapshots Received", len(data.get("rows", []))),
        "present_count": metrics.get("Inside Geofence", 0),
        "total_inside_geofence": metrics.get("Inside Geofence", 0),
        "absent_count": metrics.get("Missed or Unavailable", 0),
        "total_outside_geofence": metrics.get("Outside Geofence", 0),
        "outside_geofence_count": metrics.get("Outside Geofence", 0),
        "total_missed_or_unavailable": metrics.get("Missed or Unavailable", 0),
        "generation_status": "SUCCESS",
        "status": "COMPLETED",
        "data_completeness": completeness,
        "generated_at": now,
        "generated_by": generated_by,
        "summary_metrics": metrics,
        "row_count": len(data.get("rows", []))
    }

    if existing:
        # Update existing record
        await db.scheduled_reports.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
        logger.info(f"Regenerated existing report {report_id} for date {reporting_date_str}")
    else:
        res = await db.scheduled_reports.insert_one(doc)
        doc["_id"] = res.inserted_id
        logger.info(f"Generated new scheduled report {report_id} for date {reporting_date_str}")

    doc["id"] = str(doc["_id"])
    return doc

async def run_scheduler_cycle(db: AsyncIOMotorDatabase):
    """
    Evaluates current time against configured schedule in Asia/Kolkata timezone.
    Triggers 10:30 AM Morning Report and 5:00 PM Evening Report.
    """
    try:
        cfg = await get_or_create_schedule_config(db)
        # Compute IST time (UTC + 5:30)
        now_utc = datetime.now(timezone.utc)
        ist_now = now_utc + timedelta(hours=5, minutes=30)
        today_str = ist_now.strftime("%Y-%m-%d")
        current_time_str = ist_now.strftime("%H:%M")

        morning_rep_time = cfg.get("morning_report_time", "10:30")
        evening_rep_time = cfg.get("evening_report_time", "17:00")

        # Morning report check (runs at morning_report_time)
        if current_time_str == morning_rep_time:
            already = await db.scheduled_reports.find_one({
                "report_type": "MORNING_REPORT",
                "reporting_date": today_str,
                "reporting_slot": "10:30_AM"
            })
            if not already:
                await generate_and_save_scheduled_report(
                    db=db,
                    report_type="MORNING_REPORT",
                    reporting_date_str=today_str,
                    reporting_slot="10:30_AM",
                    generated_by="SYSTEM_SCHEDULER"
                )

        # Evening report check (runs at evening_report_time)
        if current_time_str == evening_rep_time:
            already = await db.scheduled_reports.find_one({
                "report_type": "EVENING_REPORT",
                "reporting_date": today_str,
                "reporting_slot": "05:00_PM"
            })
            if not already:
                await generate_and_save_scheduled_report(
                    db=db,
                    report_type="EVENING_REPORT",
                    reporting_date_str=today_str,
                    reporting_slot="05:00_PM",
                    generated_by="SYSTEM_SCHEDULER"
                )

    except Exception as e:
        logger.error(f"Error in scheduler cycle: {e}")

async def start_scheduler_loop(db: AsyncIOMotorDatabase):
    """Continuous background loop executing every 30 seconds."""
    logger.info("Starting PoliceHQ GeoAttend automated report scheduler...")
    while True:
        try:
            await run_scheduler_cycle(db)
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(30)
