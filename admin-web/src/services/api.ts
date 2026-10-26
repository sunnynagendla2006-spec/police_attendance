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
  RecentActivityItem
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
  return 'http://localhost:8000/api/v1';
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
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
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
