export type UserRole = 'super_admin' | 'hq_admin' | 'constable';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  account_status: string;
  must_change_password: boolean;
  assigned_location_ids?: string[];
  created_at: string;
  last_login_at?: string;
  profile?: {
    officer_id: string;
    full_name: string;
    rank: string;
    department: string;
    mobile_number: string;
  };
}

export interface Officer {
  id: string;
  user_id: string;
  officer_id: string;
  username: string;
  full_name: string;
  rank: string;
  mobile_number: string;
  department: string;
  account_status: string;
  profile_status: string;
  must_change_password: boolean;
  created_at: string;
  last_login_at?: string;
  current_state: string;
  last_seen_at?: string;
  distance_meters?: number;
}

export interface Headquarters {
  id: string;
  name: string;
  code: string;
  state: string;
  district: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  is_primary: boolean;
  description?: string;
  assigned_admin_ids?: string[];
  assigned_constables_count?: number;
  created_at: string;
  updated_at: string;
}

export interface HeadquartersCreatePayload {
  name: string;
  code: string;
  state: string;
  district: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  is_primary?: boolean;
  description?: string;
}

export interface HeadquartersUpdatePayload {
  name: string;
  code: string;
  state: string;
  district: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  is_primary?: boolean;
  description?: string;
  change_reason: string;
}

export interface HeadquartersHistoryItem {
  id: string;
  headquarters_id: string;
  version: number;
  name: string;
  code: string;
  state: string;
  district: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  status: string;
  is_primary: boolean;
  changed_by: string;
  change_reason: string;
  created_at: string;
}

export interface GeofenceConfig {
  id: string;
  headquarters_id: string;
  radius_meters: number;
  accuracy_threshold_meters: number;
  entry_confirmation_policy: {
    consecutive_observations?: number;
    dwell_seconds?: number;
  };
  exit_confirmation_policy: {
    consecutive_observations?: number;
    dwell_seconds?: number;
  };
  stale_threshold_seconds: number;
  effective_from: string;
  changed_by: string;
  change_reason: string;
  created_at: string;
}

export interface LiveOfficerLocation {
  user_id: string;
  officer_id: string;
  full_name: string;
  rank: string;
  department: string;
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
  current_state: 'INSIDE' | 'OUTSIDE' | 'ENTERING' | 'EXITING' | 'LOCATION_STALE' | 'PERMISSION_DENIED' | 'OFFLINE' | 'UNKNOWN';
  distance_from_hq_meters?: number;
  observed_at?: string;
  is_stale: boolean;
  seconds_since_update?: number;
  today_visit_count: number;
  today_duration_seconds: number;
}

export interface AttendanceVisit {
  id: string;
  user_id: string;
  officer_id: string;
  officer_name: string;
  rank: string;
  department: string;
  headquarters_id: string;
  entry_at: string;
  exit_at?: string;
  duration_seconds?: number;
  duration_formatted: string;
  entry_verification_status: string;
  exit_verification_status: string;
  visit_status: 'OPEN' | 'COMPLETED' | 'INCOMPLETE';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OfficerAttendanceSummary {
  user_id: string;
  officer_id: string;
  officer_name: string;
  rank: string;
  department: string;
  first_entry_today?: string;
  latest_exit_today?: string;
  visits_today: number;
  total_duration_seconds_today: number;
  total_duration_formatted_today: string;
  current_hq_status: string;
  latest_location_update?: string;
  verification_status: string;
}

export interface OverviewStats {
  registered_officers: number;
  officers_inside_hq: number;
  officers_outside_hq: number;
  officers_on_duty_today: number;
  officers_not_recorded_today: number;
  officers_stale_or_unavailable: number;
  compliance_percentage: number;
  visits_recorded_today: number;
  total_hq_duration_seconds_today: number;
  total_hq_duration_formatted_today: string;
  yesterday_visits: number;
  yesterday_on_duty: number;
  yesterday_compliance_percentage: number;
  incomplete_sessions_today: number;
  total_entries_today: number;
  total_exits_today: number;
  // Multi-location & security metrics
  registered_admins?: number;
  active_locations_count?: number;
  assigned_to_duty?: number;
  location_available?: number;
  scheduled_reports_today?: number;
  device_security_alerts?: number;
  app_usage_summaries_today?: number;
}

export interface DailyTrendItem {
  date: string;
  distinct_officers: number;
  total_visits: number;
  avg_duration_minutes: number;
  median_duration_minutes: number;
  total_hours: number;
}

export interface StationSummaryItem {
  station_name: string;
  total_officers: number;
  present_today: number;
  compliance_percentage: number;
}

export interface RecentActivityItem {
  id: string;
  officer_id: string;
  officer_name: string;
  rank: string;
  department: string;
  event_type: string;
  event_time: string;
  location_label: string;
  status: string;
  details?: string;
}

export interface FullAnalyticsData {
  overview: OverviewStats;
  trends: DailyTrendItem[];
  rank_distribution: Record<string, number>;
  station_distribution: Record<string, number>;
  entry_hour_distribution: Record<string, number>;
  station_summaries: StationSummaryItem[];
  incomplete_sessions: number;
  avg_visit_duration_minutes: number;
}

export interface DutyAssignment {
  id: string;
  constable_user_id: string;
  constable_officer_id: string;
  constable_name: string;
  location_id: string;
  location_name: string;
  start_date: string;
  end_date?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  assigned_by_user_id: string;
  assigned_by_username: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationScheduleConfig {
  id: string;
  morning_snapshot_time: string;
  evening_snapshot_time: string;
  timezone: string;
  grace_period_minutes: number;
  updated_by: string;
  updated_at: string;
}

export interface ScheduledLocationSnapshot {
  id: string;
  user_id: string;
  officer_id: string;
  officer_name: string;
  rank: string;
  duty_location_id: string;
  duty_location_name: string;
  snapshot_window: 'MORNING_10AM' | 'EVENING_6PM' | 'ADHOC';
  scheduled_time: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  distance_from_duty_location_meters: number;
  geofence_status: 'INSIDE' | 'OUTSIDE' | 'NEAR_BOUNDARY' | 'UNCERTAIN_ACCURACY';
  timeliness_status: 'ON_TIME' | 'DELAYED' | 'MISSED' | 'STALE' | 'UNAVAILABLE';
  device_id?: string | null;
  device_model?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface OutsideGeofenceObservation {
  snapshot_id: string;
  user_id: string;
  officer_id: string;
  officer_name: string;
  rank: string;
  department: string;
  duty_location_id: string;
  duty_location_name: string;
  distance_from_location_meters: number;
  allowed_radius_meters: number;
  excess_distance_meters: number;
  accuracy_meters: number;
  snapshot_window: string;
  observed_at: string;
  timeliness_status: string;
  latitude: number;
  longitude: number;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  officer_id: string;
  officer_name: string;
  device_id: string;
  device_model: string;
  os_version: string;
  app_version: string;
  status: 'APPROVED' | 'PENDING' | 'REVOKED';
  approved_by?: string | null;
  approved_at?: string | null;
  revoked_by?: string | null;
  revoked_reason?: string | null;
  replacement_reason?: string | null;
  created_at: string;
  last_seen_at?: string | null;
}

export interface AppUsageSummary {
  id: string;
  user_id: string;
  officer_id: string;
  officer_name: string;
  date: string;
  package_name: string;
  app_name: string;
  foreground_minutes: number;
  is_approved_work_app: boolean;
  exceeds_threshold: boolean;
  disclosed_to_user: boolean;
  submitted_at: string;
}

export interface AppUsagePolicyConfig {
  id: string;
  warning_threshold_minutes: number;
  approved_work_packages: string[];
  updated_by: string;
  updated_at: string;
}

export interface ScheduledReportRecord {
  id: string;
  report_type: 'MORNING_1030_REPORT' | 'EVENING_1700_REPORT' | 'ON_DEMAND';
  schedule_time_label: string;
  report_date: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  generated_at?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  total_constables_evaluated: number;
  present_count: number;
  absent_count: number;
  outside_geofence_count: number;
  file_url_pdf?: string | null;
  file_url_csv?: string | null;
  generated_by: string;
  created_at: string;
}

export interface ReportDownloadRecord {
  id: string;
  user_id: string;
  username: string;
  officer_id?: string | null;
  report_type: string;
  format: 'PDF' | 'CSV';
  report_date: string;
  location_id?: string | null;
  location_name?: string | null;
  downloaded_at: string;
}

export interface AdministratorUser {
  id: string;
  username: string;
  role: string;
  assigned_location_ids: string[];
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_username: string;
  action: string;
  target_type: string;
  target_id: string;
  reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

