import {
  User,
  Officer,
  Headquarters,
  HeadquartersCreatePayload,
  HeadquartersUpdatePayload,
  HeadquartersHistoryItem,
  GeofenceConfig,
  LiveOfficerLocation,
  AttendanceVisit,
  OfficerAttendanceSummary,
  OverviewStats,
  DailyTrendItem,
  AuditLog,
  FullAnalyticsData,
  RecentActivityItem,
  DutyAssignment,
  LocationScheduleConfig,
  ScheduledLocationSnapshot,
  OutsideGeofenceObservation,
  DeviceRecord,
  AppUsageSummary,
  AppUsagePolicyConfig,
  ScheduledReportRecord,
  ReportDownloadRecord,
  AdministratorUser
} from '../types';

const getApiBase = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/api/v1')) {
      return trimmed;
    }
    return `${trimmed}/api/v1`;
  }
  return 'https://police-attendance.onrender.com/api/v1';
};

export const API_BASE = getApiBase();

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('policehq_access_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      // Clear token on authentication failure
      localStorage.removeItem('policehq_access_token');
      localStorage.removeItem('policehq_user');
      window.dispatchEvent(new Event('policehq_auth_error'));
      throw new Error('Unauthorized or expired session');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let message = `Request failed with status ${response.status}`;
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail
          .map((d: any) => {
            if (typeof d === 'string') return d;
            const field = Array.isArray(d.loc)
              ? d.loc.filter((x: any) => x !== 'body').join('.')
              : '';
            return field ? `${field}: ${d.msg || d}` : (d.msg || JSON.stringify(d));
          })
          .join('; ');
      } else if (errorData.detail && typeof errorData.detail === 'object') {
        message = JSON.stringify(errorData.detail);
      } else if (typeof errorData.message === 'string') {
        message = errorData.message;
      }
      throw new Error(message);
    }

    return response.json();
  }

  // --- Auth ---
  async login(username: string, password: string) {
    const data = await this.request<{
      access_token: string;
      refresh_token: string;
      must_change_password: boolean;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('policehq_access_token', data.access_token);
    localStorage.setItem('policehq_user', JSON.stringify(data.user));
    return data;
  }

  logout() {
    localStorage.removeItem('policehq_access_token');
    localStorage.removeItem('policehq_user');
    window.dispatchEvent(new Event('policehq_auth_logout'));
  }

  getCurrentUser(): User | null {
    const stored = localStorage.getItem('policehq_user');
    return stored ? JSON.parse(stored) : null;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async changePassword(current_password: string, new_password: string, confirm_password: string) {
    return this.request<{ status: string; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password, confirm_password })
    });
  }

  async adminResetPassword(user_id: string, reason: string) {
    return this.request<{ status: string; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ user_id, reason })
    });
  }

  // --- Officers / Personnel ---
  async getOfficers(query?: string, department?: string, rank?: string): Promise<Officer[]> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (department) params.append('department', department);
    if (rank) params.append('rank', rank);
    return this.request<Officer[]>(`/officers?${params.toString()}`);
  }

  async registerOfficer(officer: {
    username: string;
    officer_id: string;
    full_name: string;
    rank: string;
    mobile_number: string;
    department: string;
  }): Promise<Officer> {
    return this.request<Officer>('/officers', {
      method: 'POST',
      body: JSON.stringify(officer)
    });
  }

  async updateOfficer(officer_id: string, updates: Partial<Officer>): Promise<Officer> {
    return this.request<Officer>(`/officers/${officer_id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deactivateOfficer(officer_id: string) {
    return this.request<{ status: string; message: string }>(`/officers/${officer_id}/deactivate`, {
      method: 'POST'
    });
  }

  // --- Headquarters & Geofence ---
  async getHeadquarters(): Promise<Headquarters> {
    return this.request<Headquarters>('/headquarters');
  }

  async getActiveHeadquarters(): Promise<Headquarters> {
    return this.request<Headquarters>('/headquarters/active');
  }

  async getHeadquartersFacilities(search?: string, status?: string): Promise<Headquarters[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const qs = params.toString();
    return this.request<Headquarters[]>(`/headquarters/facilities${qs ? `?${qs}` : ''}`);
  }

  async getHeadquartersById(id: string): Promise<Headquarters> {
    return this.request<Headquarters>(`/headquarters/${id}`);
  }

  async createHeadquarters(data: HeadquartersCreatePayload): Promise<Headquarters> {
    return this.request<Headquarters>('/headquarters', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateHeadquarters(id: string, data: HeadquartersUpdatePayload): Promise<Headquarters> {
    return this.request<Headquarters>(`/headquarters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async setPrimaryHeadquarters(id: string): Promise<Headquarters> {
    return this.request<Headquarters>(`/headquarters/${id}/primary`, {
      method: 'PATCH'
    });
  }

  async updateHeadquartersStatus(id: string, status: string, reason?: string): Promise<Headquarters> {
    return this.request<Headquarters>(`/headquarters/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason })
    });
  }

  async getHeadquartersHistory(id: string): Promise<HeadquartersHistoryItem[]> {
    return this.request<HeadquartersHistoryItem[]>(`/headquarters/${id}/history`);
  }

  async getGeofenceConfig(): Promise<GeofenceConfig> {
    return this.request<GeofenceConfig>('/headquarters/geofence');
  }

  async updateGeofenceConfig(data: {
    radius_meters: number;
    accuracy_threshold_meters?: number;
    stale_threshold_seconds?: number;
    change_reason: string;
  }): Promise<GeofenceConfig> {
    return this.request<GeofenceConfig>('/headquarters/geofence', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async getGeofenceHistory(): Promise<{ current: GeofenceConfig; history: GeofenceConfig[] }> {
    return this.request<{ current: GeofenceConfig; history: GeofenceConfig[] }>('/headquarters/geofence/history');
  }

  // --- Live Location ---
  async getLiveLocations(): Promise<LiveOfficerLocation[]> {
    return this.request<LiveOfficerLocation[]>('/location/current');
  }

  // --- Attendance ---
  async getAttendanceVisits(params?: {
    officer_id?: string;
    status_filter?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<AttendanceVisit[]> {
    const q = new URLSearchParams();
    if (params?.officer_id) q.append('officer_id', params.officer_id);
    if (params?.status_filter) q.append('status_filter', params.status_filter);
    if (params?.start_date) q.append('start_date', params.start_date);
    if (params?.end_date) q.append('end_date', params.end_date);
    return this.request<AttendanceVisit[]>(`/attendance?${q.toString()}`);
  }

  async getAttendanceSummary(params?: {
    date_filter?: string;
    rank_filter?: string;
    status_filter?: string;
    query?: string;
  }): Promise<OfficerAttendanceSummary[]> {
    const q = new URLSearchParams();
    if (params?.date_filter) q.append('date_filter', params.date_filter);
    if (params?.rank_filter) q.append('rank_filter', params.rank_filter);
    if (params?.status_filter) q.append('status_filter', params.status_filter);
    if (params?.query) q.append('query', params.query);
    return this.request<OfficerAttendanceSummary[]>(`/attendance/summary?${q.toString()}`);
  }

  async correctVisit(visit_id: string, entry_at: string | null, exit_at: string | null, reason: string) {
    return this.request<{ status: string; message: string }>(`/attendance/${visit_id}/corrections`, {
      method: 'POST',
      body: JSON.stringify({ entry_at, exit_at, reason })
    });
  }

  // --- Analytics ---
  async getOverviewStats(): Promise<OverviewStats> {
    return this.request<OverviewStats>('/analytics/overview');
  }

  async getDailyTrends(days = 7): Promise<DailyTrendItem[]> {
    return this.request<DailyTrendItem[]>(`/analytics/daily?days=${days}`);
  }

  async getFullAnalytics(): Promise<FullAnalyticsData> {
    return this.request<FullAnalyticsData>('/analytics/full');
  }

  async getRecentActivity(params?: {
    query?: string;
    event_type?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }): Promise<RecentActivityItem[]> {
    const q = new URLSearchParams();
    if (params?.query) q.append('query', params.query);
    if (params?.event_type) q.append('event_type', params.event_type);
    if (params?.status) q.append('status', params.status);
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.skip) q.append('skip', params.skip.toString());
    return this.request<RecentActivityItem[]>(`/analytics/activity?${q.toString()}`);
  }

  // --- Reports ---
  getCsvExportUrl(start_date?: string, end_date?: string, officer_id?: string): string {
    const q = new URLSearchParams();
    if (start_date) q.append('start_date', start_date);
    if (end_date) q.append('end_date', end_date);
    if (officer_id) q.append('officer_id', officer_id);
    return `${API_BASE}/reports/attendance.csv?${q.toString()}`;
  }

  getPdfExportUrl(start_date?: string, end_date?: string, officer_id?: string): string {
    const q = new URLSearchParams();
    if (start_date) q.append('start_date', start_date);
    if (end_date) q.append('end_date', end_date);
    if (officer_id) q.append('officer_id', officer_id);
    return `${API_BASE}/reports/attendance.pdf?${q.toString()}`;
  }

  // --- Duty Assignments ---
  async getAssignments(params?: {
    location_id?: string;
    constable_user_id?: string;
    status?: string;
  }): Promise<DutyAssignment[]> {
    const q = new URLSearchParams();
    if (params?.location_id) q.append('location_id', params.location_id);
    if (params?.constable_user_id) q.append('constable_user_id', params.constable_user_id);
    if (params?.status) q.append('status', params.status);
    return this.request<DutyAssignment[]>(`/assignments?${q.toString()}`);
  }

  async createAssignment(data: {
    constable_user_id: string;
    location_id: string;
    start_date: string;
    end_date?: string;
    notes?: string;
  }): Promise<DutyAssignment> {
    return this.request<DutyAssignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAssignment(
    id: string,
    updates: {
      status?: string;
      end_date?: string;
      notes?: string;
    }
  ): Promise<DutyAssignment> {
    return this.request<DutyAssignment>(`/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async getMyActiveAssignment(): Promise<DutyAssignment | null> {
    return this.request<DutyAssignment | null>('/assignments/my');
  }

  async getAvailableConstables(): Promise<Officer[]> {
    return this.request<Officer[]>('/assignments/constables/available');
  }

  // --- Scheduled Snapshots & Geofence Checks ---
  async getSnapshots(params?: {
    location_id?: string;
    user_id?: string;
    date?: string;
    snapshot_window?: string;
    geofence_status?: string;
  }): Promise<ScheduledLocationSnapshot[]> {
    const q = new URLSearchParams();
    if (params?.location_id) q.append('location_id', params.location_id);
    if (params?.user_id) q.append('user_id', params.user_id);
    if (params?.date) q.append('date', params.date);
    if (params?.snapshot_window) q.append('snapshot_window', params.snapshot_window);
    if (params?.geofence_status) q.append('geofence_status', params.geofence_status);
    return this.request<ScheduledLocationSnapshot[]>(`/snapshots?${q.toString()}`);
  }

  async getOutsideGeofenceObservations(params?: {
    location_id?: string;
    date?: string;
  }): Promise<OutsideGeofenceObservation[]> {
    const q = new URLSearchParams();
    if (params?.location_id) q.append('location_id', params.location_id);
    if (params?.date) q.append('date', params.date);
    return this.request<OutsideGeofenceObservation[]>(`/snapshots/outside-geofence?${q.toString()}`);
  }

  async getSnapshotScheduleConfig(): Promise<LocationScheduleConfig> {
    return this.request<LocationScheduleConfig>('/snapshots/schedule-config');
  }

  async updateSnapshotScheduleConfig(data: {
    morning_snapshot_time?: string;
    evening_snapshot_time?: string;
    timezone?: string;
    grace_period_minutes?: number;
  }): Promise<LocationScheduleConfig> {
    return this.request<LocationScheduleConfig>('/snapshots/schedule-config', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // --- Registered Devices ---
  async getDevices(params?: {
    user_id?: string;
    status?: string;
    search?: string;
  }): Promise<DeviceRecord[]> {
    const q = new URLSearchParams();
    if (params?.user_id) q.append('user_id', params.user_id);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    return this.request<DeviceRecord[]>(`/devices?${q.toString()}`);
  }

  async approveDevice(device_id: string, reason?: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/devices/approve', {
      method: 'POST',
      body: JSON.stringify({ device_id, reason })
    });
  }

  async replaceDevice(data: {
    constable_user_id: string;
    old_device_id: string;
    new_device_id: string;
    reason: string;
  }): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/devices/replace', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- App Usage ---
  async getAppUsageSummaries(params?: {
    date?: string;
    user_id?: string;
    only_exceeding_threshold?: boolean;
    location_id?: string;
  }): Promise<AppUsageSummary[]> {
    const q = new URLSearchParams();
    if (params?.date) q.append('date', params.date);
    if (params?.user_id) q.append('user_id', params.user_id);
    if (params?.only_exceeding_threshold !== undefined) {
      q.append('only_exceeding_threshold', String(params.only_exceeding_threshold));
    }
    if (params?.location_id) q.append('location_id', params.location_id);
    return this.request<AppUsageSummary[]>(`/app-usage?${q.toString()}`);
  }

  async getAppUsagePolicy(): Promise<AppUsagePolicyConfig> {
    return this.request<AppUsagePolicyConfig>('/app-usage/policy');
  }

  async updateAppUsagePolicy(data: {
    warning_threshold_minutes?: number;
    approved_work_packages?: string[];
  }): Promise<AppUsagePolicyConfig> {
    return this.request<AppUsagePolicyConfig>('/app-usage/policy', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // --- Scheduled Reports & Downloads ---
  async getScheduledReports(params?: {
    report_date?: string;
    location_id?: string;
  }): Promise<ScheduledReportRecord[]> {
    const q = new URLSearchParams();
    if (params?.report_date) q.append('report_date', params.report_date);
    if (params?.location_id) q.append('location_id', params.location_id);
    return this.request<ScheduledReportRecord[]>(`/reports/scheduled?${q.toString()}`);
  }

  async generateReport(data: {
    report_type: string;
    report_date: string;
    location_id?: string;
  }): Promise<ScheduledReportRecord> {
    return this.request<ScheduledReportRecord>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  getReportDownloadUrl(params: {
    report_type: string;
    format: string;
    report_date?: string;
    start_date?: string;
    end_date?: string;
    location_id?: string;
  }): string {
    const q = new URLSearchParams();
    q.append('report_type', params.report_type);
    q.append('format', params.format);
    if (params.report_date) q.append('report_date', params.report_date);
    if (params.start_date) q.append('start_date', params.start_date);
    if (params.end_date) q.append('end_date', params.end_date);
    if (params.location_id) q.append('location_id', params.location_id);
    return `${API_BASE}/reports/download?${q.toString()}`;
  }

  async downloadReportFile(params: {
    report_type: string;
    format: 'PDF' | 'CSV';
    report_date?: string;
    start_date?: string;
    end_date?: string;
    location_id?: string;
  }): Promise<void> {
    const url = this.getReportDownloadUrl(params);
    const headers = this.getHeaders();
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to download report');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const dateStr = params.report_date || params.start_date || new Date().toISOString().split('T')[0];
    const extension = params.format.toLowerCase();
    link.download = `${params.report_type.toLowerCase()}_${dateStr}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async getDownloadHistory(limit = 50): Promise<ReportDownloadRecord[]> {
    return this.request<ReportDownloadRecord[]>(`/reports/downloads/history?limit=${limit}`);
  }

  // --- Administrator Permissions ---
  async getAdministrators(): Promise<AdministratorUser[]> {
    return this.request<AdministratorUser[]>('/auth/administrators');
  }

  async updateAdminLocationPermissions(
    admin_user_id: string,
    assigned_location_ids: string[]
  ): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/auth/admin-location-permissions', {
      method: 'POST',
      body: JSON.stringify({ admin_user_id, assigned_location_ids })
    });
  }

  // --- Audit ---
  async getAuditLogs(action?: string): Promise<AuditLog[]> {
    const q = action ? `?action=${action}` : '';
    return this.request<AuditLog[]>(`/audit-logs${q}`);
  }

  // --- System ---
  async getSystemHealth(): Promise<any> {
    return this.request('/health');
  }

  async getSystemReadiness(): Promise<any> {
    return this.request('/readiness');
  }
}

export const api = new ApiService();
