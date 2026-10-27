import logging
import statistics
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.analytics import (
    OverviewStats,
    DailyTrendItem,
    AnalyticsResponse,
    RecentActivityItem,
    StationSummaryItem
)
from app.services.attendance_service import format_duration
from app.services.geofence_engine import get_active_geofence_config

logger = logging.getLogger(__name__)

async def compute_overview_stats(
    db: AsyncIOMotorDatabase,
    location_id: Optional[str] = None
) -> OverviewStats:
    """
    Compute real-time headquarters operational metrics based exclusively
    on MongoDB attendance, location, and duty assignment records.
    """
    now = datetime.now(timezone.utc)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_yesterday = start_of_today - timedelta(days=1)
    hq_config = await get_active_geofence_config(db)
    stale_thresh = hq_config["stale_threshold_seconds"]

    # 1. Total & Active Headquarters Locations
    total_locations = await db.headquarters.count_documents({})
    active_locations = await db.headquarters.count_documents({"status": "ACTIVE"})

    # 2. Duty Assignments & Personnel Scoping
    all_facilities = await db.headquarters.find({}).to_list(length=300)
    facility_map = {str(f["_id"]): f for f in all_facilities}

    all_active_asgns = await db.location_assignments.find({"status": "ACTIVE"}).to_list(length=2000)
    # Deduplicate constables to avoid double counting across historical reassignments
    assigned_user_id_set = set(str(a["user_id"]) for a in all_active_asgns if a.get("user_id"))
    assigned_officer_id_set = set(str(a["officer_id"]) for a in all_active_asgns if a.get("officer_id"))

    # Map constable to active assigned facility
    constable_to_facility: Dict[str, Dict[str, Any]] = {}
    for a in all_active_asgns:
        loc_id = str(a.get("location_id", ""))
        fac = facility_map.get(loc_id)
        if a.get("user_id"):
            constable_to_facility[str(a["user_id"])] = {
                "facility": fac,
                "radius": float(fac.get("radius_meters", a.get("geofence_radius_meters", 100.0))) if fac else float(a.get("geofence_radius_meters", 100.0)),
                "location_id": loc_id
            }

    # 3. Constables selection (filter by location_id if specified)
    if location_id:
        profiles_cursor = db.officer_profiles.find({"profile_status": "ACTIVE"})
        all_active_profiles = await profiles_cursor.to_list(length=1000)
        profiles = [
            p for p in all_active_profiles
            if constable_to_facility.get(str(p["user_id"]), {}).get("location_id") == str(location_id)
        ]
        reg_count = len(profiles)
        assigned_count = reg_count
        unassigned_count = 0
    else:
        profiles_cursor = db.officer_profiles.find({"profile_status": "ACTIVE"})
        profiles = await profiles_cursor.to_list(length=1000)
        reg_count = len(profiles)
        assigned_count = len(assigned_user_id_set)
        unassigned_count = max(0, reg_count - assigned_count)

    # 4. Evaluate Observation Freshness & Geofence Status
    inside_count = 0
    outside_count = 0
    stale_count = 0
    location_available_count = 0

    from app.services.geofence_engine import calculate_haversine_distance_meters

    for p in profiles:
        user_id = str(p["user_id"])
        last_obs = await db.location_observations.find_one(
            {"user_id": user_id},
            sort=[("observed_at", -1)]
        )
        if not last_obs:
            stale_count += 1
            continue

        obs_time = last_obs.get("observed_at")
        if obs_time and obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        diff_sec = (now - obs_time).total_seconds() if obs_time else 999999
        is_stale = (diff_sec > stale_thresh)

        if is_stale:
            stale_count += 1
        else:
            location_available_count += 1
            # Check against assigned facility (or HQ fallback)
            asgn_info = constable_to_facility.get(user_id)
            fac = asgn_info["facility"] if asgn_info else None
            radius = asgn_info["radius"] if asgn_info else hq_config["radius_meters"]

            coords = last_obs.get("location", {}).get("coordinates", [None, None])
            if coords and coords[0] is not None and coords[1] is not None and fac:
                fac_coords = fac.get("location", {}).get("coordinates", [fac.get("longitude"), fac.get("latitude")])
                fac_lat = fac_coords[1] if len(fac_coords) > 1 else fac.get("latitude", hq_config["latitude"])
                fac_lon = fac_coords[0] if len(fac_coords) > 0 else fac.get("longitude", hq_config["longitude"])
                dist = calculate_haversine_distance_meters(coords[1], coords[0], fac_lat, fac_lon)
                if dist <= radius:
                    inside_count += 1
                else:
                    outside_count += 1
            elif last_obs.get("is_inside_geofence", False):
                inside_count += 1
            else:
                outside_count += 1

    # 5. Visits today
    visit_query: Dict[str, Any] = {"entry_at": {"$gte": start_of_today}}
    if location_id:
        visit_query["headquarters_id"] = str(location_id)

    today_visits_cursor = db.attendance_visits.find(visit_query)
    today_visits = await today_visits_cursor.to_list(length=2000)

    total_seconds = 0
    on_duty_officers = set()
    incomplete_sessions = 0
    total_exits = 0

    for v in today_visits:
        if v.get("officer_id"):
            on_duty_officers.add(v["officer_id"])
        
        if v.get("exit_at"):
            total_exits += 1

        if v.get("duration_seconds"):
            total_seconds += v["duration_seconds"]
        elif v.get("visit_status") == "OPEN":
            incomplete_sessions += 1
            entry_at = v["entry_at"]
            if entry_at.tzinfo is None:
                entry_at = entry_at.replace(tzinfo=timezone.utc)
            total_seconds += max(0, int((now - entry_at).total_seconds()))

    officers_on_duty = len(on_duty_officers)
    not_recorded = max(0, reg_count - officers_on_duty)
    compliance_pct = round((officers_on_duty / reg_count * 100) if reg_count > 0 else 0.0, 1)

    # 6. Admin and Audit Metrics
    admin_count = await db.users.count_documents({"role": {"$in": ["super_admin", "hq_admin", "admin"]}})
    today_str = now.strftime("%Y-%m-%d")
    sched_rep_count = await db.scheduled_reports.count_documents({"reporting_date": today_str})
    device_alerts = await db.audit_logs.count_documents({"action": {"$regex": "UNAUTHORIZED_DEVICE|DEVICE_REVOKED"}})
    app_usage_count = await db.app_usage_summaries.count_documents({"reporting_date": today_str})

    # 7. Yesterday's comparisons
    yest_visit_query: Dict[str, Any] = {"entry_at": {"$gte": start_of_yesterday, "$lt": start_of_today}}
    if location_id:
        yest_visit_query["headquarters_id"] = str(location_id)
    yest_visits = await db.attendance_visits.find(yest_visit_query).to_list(length=1000)
    yest_on_duty_count = len(set(v.get("officer_id") for v in yest_visits if v.get("officer_id")))
    yest_compliance_pct = round((yest_on_duty_count / reg_count * 100) if reg_count > 0 else 0.0, 1)

    return OverviewStats(
        registered_officers=reg_count,
        registered_admins=admin_count,
        total_registered_locations=total_locations,
        active_locations_count=active_locations,
        assigned_to_duty=assigned_count,
        assigned_constables_count=assigned_count,
        unassigned_constables_count=unassigned_count,
        location_available=location_available_count,
        personnel_with_location=location_available_count,
        personnel_inside_assigned_geofence=inside_count,
        personnel_outside_assigned_geofence=outside_count,
        personnel_stale_or_unavailable=stale_count,
        officers_inside_hq=inside_count,
        officers_outside_hq=outside_count,
        officers_on_duty_today=officers_on_duty,
        officers_not_recorded_today=not_recorded,
        officers_stale_or_unavailable=stale_count,
        compliance_percentage=compliance_pct,
        visits_recorded_today=len(today_visits),
        total_hq_duration_seconds_today=total_seconds,
        total_hq_duration_formatted_today=format_duration(total_seconds),
        yesterday_visits=len(yest_visits),
        yesterday_on_duty=yest_on_duty_count,
        yesterday_compliance_percentage=yest_compliance_pct,
        incomplete_sessions_today=incomplete_sessions,
        total_entries_today=len(today_visits),
        total_exits_today=total_exits,
        scheduled_reports_today=sched_rep_count,
        device_security_alerts=device_alerts,
        app_usage_summaries_today=app_usage_count
    )

async def compute_daily_trends(db: AsyncIOMotorDatabase, days: int = 7) -> List[DailyTrendItem]:
    """Compute daily visit count, distinct officers, and average/median durations."""
    now = datetime.now(timezone.utc)
    trends = []

    for i in range(days - 1, -1, -1):
        day_date = (now - timedelta(days=i)).date()
        day_start = datetime.combine(day_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(day_date, datetime.max.time()).replace(tzinfo=timezone.utc)

        visits = await db.attendance_visits.find({
            "entry_at": {"$gte": day_start, "$lte": day_end}
        }).to_list(length=1000)

        distinct_officers = len(set(v["officer_id"] for v in visits if "officer_id" in v))
        durations = [v["duration_seconds"] / 60.0 for v in visits if v.get("duration_seconds")]

        avg_dur = round(statistics.mean(durations), 1) if durations else 0.0
        med_dur = round(statistics.median(durations), 1) if durations else 0.0
        total_hrs = round(sum(durations) / 60.0, 1) if durations else 0.0

        trends.append(DailyTrendItem(
            date=day_date.isoformat(),
            distinct_officers=distinct_officers,
            total_visits=len(visits),
            avg_duration_minutes=avg_dur,
            median_duration_minutes=med_dur,
            total_hours=total_hrs
        ))

    return trends

async def get_full_analytics(db: AsyncIOMotorDatabase) -> AnalyticsResponse:
    """Compile comprehensive headquarters attendance analytics."""
    overview = await compute_overview_stats(db)
    trends = await compute_daily_trends(db, days=7)

    # Rank and station distributions
    ranks: Dict[str, int] = {}
    stations: Dict[str, int] = {}
    station_officers: Dict[str, List[str]] = {}

    profiles = await db.officer_profiles.find({"profile_status": "ACTIVE"}).to_list(length=1000)
    for p in profiles:
        r = p.get("rank", "Constable")
        dept = p.get("department", "District Police")
        ranks[r] = ranks.get(r, 0) + 1
        stations[dept] = stations.get(dept, 0) + 1
        if dept not in station_officers:
            station_officers[dept] = []
        station_officers[dept].append(p.get("officer_id", ""))

    # Hourly entry distribution for today
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_visits = await db.attendance_visits.find({"entry_at": {"$gte": day_start}}).to_list(length=1000)
    
    hours = {f"{h:02d}:00": 0 for h in range(24)}
    durations = []
    incomplete_sessions = 0
    present_officers_today = set()

    for v in today_visits:
        entry = v.get("entry_at")
        if entry:
            hour_str = f"{entry.hour:02d}:00"
            hours[hour_str] = hours.get(hour_str, 0) + 1
        if v.get("duration_seconds"):
            durations.append(v["duration_seconds"] / 60.0)
        if v.get("visit_status") == "OPEN":
            incomplete_sessions += 1
        if v.get("officer_id"):
            present_officers_today.add(v["officer_id"])

    avg_duration = round(statistics.mean(durations), 1) if durations else 0.0

    # Station summaries
    station_summaries = []
    for dept_name, officer_ids in stations.items():
        total_in_dept = len(officer_ids)
        present_in_dept = sum(1 for oid in officer_ids if oid in present_officers_today)
        pct = round((present_in_dept / total_in_dept * 100) if total_in_dept > 0 else 0.0, 1)
        station_summaries.append(StationSummaryItem(
            station_name=dept_name,
            total_officers=total_in_dept,
            present_today=present_in_dept,
            compliance_percentage=pct
        ))

    return AnalyticsResponse(
        overview=overview,
        trends=trends,
        rank_distribution=ranks,
        station_distribution=stations,
        entry_hour_distribution=hours,
        station_summaries=station_summaries,
        incomplete_sessions=incomplete_sessions,
        avg_visit_duration_minutes=avg_duration
    )

async def get_recent_activity(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 20,
    query: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None
) -> List[RecentActivityItem]:
    """Retrieve actual logged geofence events and attendance transitions for the live activity table."""
    items: List[RecentActivityItem] = []

    # 1. Fetch from geofence_events collection
    geo_filter: Dict[str, Any] = {}
    if query:
        geo_filter["$or"] = [
            {"officer_id": {"$regex": query, "$options": "i"}},
            {"user_id": {"$regex": query, "$options": "i"}}
        ]
    if event_type:
        if "ENTRY" in event_type.upper():
            geo_filter["event_type"] = "ENTRY"
        elif "EXIT" in event_type.upper():
            geo_filter["event_type"] = "EXIT"

    cursor = db.geofence_events.find(geo_filter).sort("observed_at", -1).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)

    for ev in events:
        user_id = ev.get("user_id")
        profile = await db.officer_profiles.find_one({"user_id": user_id}) if user_id else None
        officer_name = profile.get("full_name", "Officer") if profile else "Police Personnel"
        officer_id = ev.get("officer_id") or (profile.get("officer_id") if profile else "UNKNOWN")
        rank = profile.get("rank", "Constable") if profile else "Constable"
        dept = profile.get("department", "District Police") if profile else "District Police"

        ev_type = ev.get("event_type", "UNKNOWN")
        formatted_type = "Headquarters entry" if ev_type == "ENTRY" else "Headquarters exit"

        obs_time = ev.get("observed_at") or ev.get("received_at") or datetime.now(timezone.utc)
        if obs_time and obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        coords = ev.get("location", {}).get("coordinates", [])
        loc_str = f"Lat: {coords[1]:.4f}, Lng: {coords[0]:.4f}" if len(coords) == 2 else "Eluru HQ Perimeter"

        status_label = "Verified" if ev.get("verification_status") == "VERIFIED" else "Inside Geofence"
        if ev_type == "EXIT":
            status_label = "Completed"

        items.append(RecentActivityItem(
            id=str(ev["_id"]),
            officer_id=officer_id,
            officer_name=officer_name,
            rank=rank,
            department=dept,
            event_type=formatted_type,
            event_time=obs_time,
            location_label=loc_str,
            status=status_label,
            details=f"GPS Accuracy: ±{ev.get('accuracy_meters', 10):.1f}m"
        ))

    # If geofence_events had fewer than limit items, supplement with attendance_visits
    if len(items) < limit:
        remaining = limit - len(items)
        visit_filter: Dict[str, Any] = {}
        if query:
            visit_filter["$or"] = [
                {"officer_name": {"$regex": query, "$options": "i"}},
                {"officer_id": {"$regex": query, "$options": "i"}}
            ]
        visits = await db.attendance_visits.find(visit_filter).sort("entry_at", -1).skip(skip).limit(remaining).to_list(length=remaining)
        for v in visits:
            # Entry event
            entry_time = v.get("entry_at")
            if entry_time and entry_time.tzinfo is None:
                entry_time = entry_time.replace(tzinfo=timezone.utc)
            items.append(RecentActivityItem(
                id=f"vis_entry_{str(v['_id'])}",
                officer_id=v.get("officer_id", "UNKNOWN"),
                officer_name=v.get("officer_name", "Officer"),
                rank=v.get("rank", "Constable"),
                department=v.get("department", "District Police"),
                event_type="Attendance recorded",
                event_time=entry_time,
                location_label="Eluru District HQ Perimeter",
                status="Inside Geofence" if v.get("visit_status") == "OPEN" else "Completed",
                details=f"Visit ID: {str(v['_id'])[:8]} • Status: {v.get('visit_status', 'OPEN')}"
            ))

    # Sort all by event_time desc
    items.sort(key=lambda x: x.event_time, reverse=True)
    return items[:limit]

