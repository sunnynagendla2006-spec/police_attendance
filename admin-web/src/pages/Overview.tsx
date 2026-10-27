import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Navigation,
  CalendarCheck2,
  UserCheck,
  UserMinus,
  Percent,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Shield,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { OverviewStats, GeofenceConfig, FullAnalyticsData, RecentActivityItem, Headquarters } from '../types';
import { api } from '../services/api';

interface Props {
  onNavigate: (tab: string) => void;
}

export const Overview: React.FC<Props> = ({ onNavigate }) => {
  const [stats, setStats] = useState<OverviewStats>({
    registered_officers: 0,
    officers_inside_hq: 0,
    officers_outside_hq: 0,
    officers_on_duty_today: 0,
    officers_not_recorded_today: 0,
    officers_stale_or_unavailable: 0,
    compliance_percentage: 0.0,
    visits_recorded_today: 0,
    total_hq_duration_seconds_today: 0,
    total_hq_duration_formatted_today: '00h 00m',
    yesterday_visits: 0,
    yesterday_on_duty: 0,
    yesterday_compliance_percentage: 0.0,
    incomplete_sessions_today: 0,
    total_entries_today: 0,
    total_exits_today: 0
  });

  const [geofence, setGeofence] = useState<GeofenceConfig | null>(null);
  const [analytics, setAnalytics] = useState<FullAnalyticsData | null>(null);
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter & Controls
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const itemsPerPage = 8;

  const [facilities, setFacilities] = useState<Headquarters[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const fetchOverviewData = async (locId?: string) => {
    try {
      const activeLocId = locId !== undefined ? locId : selectedLocationId;
      const [statsRes, geoRes, analyticsRes, actsRes, facsRes] = await Promise.allSettled([
        api.getOverviewStats(activeLocId || undefined),
        api.getGeofenceConfig(),
        api.getFullAnalytics(),
        api.getRecentActivity({ limit: 40 }),
        api.getHeadquartersFacilities()
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        console.warn('Failed to load overview stats:', statsRes.reason);
      }

      if (geoRes.status === 'fulfilled') {
        setGeofence(geoRes.value);
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      }

      if (actsRes.status === 'fulfilled') {
        setActivities(actsRes.value || []);
      }

      if (facsRes.status === 'fulfilled') {
        setFacilities(facsRes.value || []);
      }
    } catch (e) {
      console.error('Error loading dashboard overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();

    // Event listeners
    const handleRefresh = () => fetchOverviewData();
    window.addEventListener('policehq_manual_refresh', handleRefresh);
    window.addEventListener('policehq_hq_entry', handleRefresh);
    window.addEventListener('policehq_hq_exit', handleRefresh);
    window.addEventListener('policehq_geofence_config_updated', handleRefresh);
    window.addEventListener('policehq_officer_location_updated', handleRefresh);

    const interval = setInterval(fetchOverviewData, 15000);

    return () => {
      window.removeEventListener('policehq_manual_refresh', handleRefresh);
      window.removeEventListener('policehq_hq_entry', handleRefresh);
      window.removeEventListener('policehq_hq_exit', handleRefresh);
      window.removeEventListener('policehq_geofence_config_updated', handleRefresh);
      window.removeEventListener('policehq_officer_location_updated', handleRefresh);
      clearInterval(interval);
    };
  }, []);

  // 6 Specified Personnel KPI Cards
  const kpis = [
    {
      title: 'Total Registered Personnel',
      value: stats.registered_officers,
      desc: 'Active officers in police roster',
      subtext: 'Verified in Eluru district directory',
      icon: Users,
      color: 'text-[#17365D]',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      tab: 'police-personnel',
      trend: `${stats.registered_officers} total active`
    },
    {
      title: 'Present at Headquarters',
      value: stats.officers_inside_hq,
      desc: 'Confirmed within geofence perimeter',
      subtext: 'Authoritative physical presence',
      icon: Building2,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      tab: 'live-map',
      trend: 'Inside active 100m geofence'
    },
    {
      title: 'Currently Outside Headquarters',
      value: stats.officers_outside_hq,
      desc: 'Active officers on field/outstation',
      subtext: 'Fresh GPS verified outside perimeter',
      icon: Navigation,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      tab: 'live-map',
      trend: 'Signal active & fresh'
    },
    {
      title: 'On Duty Today',
      value: stats.officers_on_duty_today,
      desc: 'Logged attendance or visit today',
      subtext: `vs ${stats.yesterday_on_duty} yesterday`,
      icon: UserCheck,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      tab: 'attendance',
      trend: stats.yesterday_on_duty > 0
        ? `${stats.officers_on_duty_today >= stats.yesterday_on_duty ? '+' : ''}${stats.officers_on_duty_today - stats.yesterday_on_duty} vs yesterday`
        : 'Recorded sessions'
    },
    {
      title: 'Not Yet Recorded Today',
      value: stats.officers_not_recorded_today,
      desc: 'No attendance record logged yet',
      subtext: 'Pending arrival / off-duty status',
      icon: UserMinus,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-200',
      tab: 'police-personnel',
      trend: `${stats.officers_not_recorded_today} officers pending`
    },
    {
      title: 'Attendance Compliance Rate',
      value: `${stats.compliance_percentage}%`,
      desc: 'Attendance percentage of total strength',
      subtext: `Yesterday: ${stats.yesterday_compliance_percentage}%`,
      icon: Percent,
      color: 'text-[#17365D]',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      tab: 'reports',
      trend: stats.yesterday_compliance_percentage > 0
        ? `${stats.compliance_percentage >= stats.yesterday_compliance_percentage ? '↑ +' : '↓ '}${(stats.compliance_percentage - stats.yesterday_compliance_percentage).toFixed(1)}% vs yest.`
        : 'Daily compliance metric'
    }
  ];

  // Prepare chart data
  const hourlyData = analytics?.entry_hour_distribution
    ? Object.entries(analytics.entry_hour_distribution)
        .filter(([_, count]) => count >= 0)
        .slice(6, 22) // show 06:00 to 21:00 for optimal readability
        .map(([hour, count]) => ({ hour, entries: count }))
    : [];

  const trendData = analytics?.trends || [];

  const statusDonutData = [
    { name: 'Inside HQ', value: stats.officers_inside_hq, color: '#15803D' },
    { name: 'Outside HQ', value: stats.officers_outside_hq, color: '#2563EB' },
    { name: 'Stale / Offline', value: stats.officers_stale_or_unavailable, color: '#B45309' },
    { name: 'Not Recorded', value: stats.officers_not_recorded_today, color: '#94A3B8' }
  ].filter(d => d.value > 0);

  const rankBarData = analytics?.rank_distribution
    ? Object.entries(analytics.rank_distribution).map(([rank, count]) => ({
        rank: rank.replace('Police ', '').replace(' of Police', ''),
        count
      }))
    : [];

  const stationData = analytics?.station_summaries || [];

  // Filtered recent activities
  const filteredActivities = activities.filter(act => {
    if (activityFilter && act.event_type !== activityFilter) return false;
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      return (
        act.officer_name.toLowerCase().includes(q) ||
        act.officer_id.toLowerCase().includes(q) ||
        act.department.toLowerCase().includes(q) ||
        act.event_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage) || 1;
  const paginatedActivities = filteredActivities.slice(
    (activityPage - 1) * itemsPerPage,
    activityPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Top Police HQ Identity Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#17365D] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Shield className="w-6 h-6 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-[#172B4D]">
                Eluru District Police Headquarters — Command Overview
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#17365D] border border-blue-200">
                Authoritative Geofence Active
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Coordinates: 16.7107° N, 81.0952° E • Sanivarapupeta, Eluru District, Andhra Pradesh
            </p>
          </div>
        </div>

        {/* Geofence Parameters Status Card */}
        <div className="flex items-center space-x-6 text-xs border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-3 md:pt-0 md:pl-6 w-full md:w-auto">
          <div>
            <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">Perimeter Radius</span>
            <span className="text-sm font-bold text-[#17365D] font-mono">
              {geofence?.radius_meters || 100} metres
            </span>
          </div>
          <div>
            <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">Accuracy Threshold</span>
            <span className="text-sm font-bold text-slate-700 font-mono">
              &le; {geofence?.accuracy_threshold_meters || 35} m
            </span>
          </div>
          <div>
            <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">Stale Threshold</span>
            <span className="text-sm font-bold text-slate-700 font-mono">
              {geofence?.stale_threshold_seconds || 300} s
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Location Organization & Deployment Summary */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h2 className="font-bold text-sm text-[#172B4D]">Multi-Location Duty & Workforce Distribution</h2>
              <p className="text-[11px] text-[#64748B]">Real-time synchronization across all configured police facilities</p>
            </div>
          </div>

          {/* Location Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Location Scope:</span>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                const newLocId = e.target.value;
                setSelectedLocationId(newLocId);
                fetchOverviewData(newLocId);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#17365D] focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            >
              <option value="">All Registered Facilities (Aggregate)</option>
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.code}) {fac.is_primary ? '★ Primary HQ' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 8 Multi-Location Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Facilities</span>
            <span className="text-lg font-bold text-[#17365D] mt-0.5 block">
              {stats.total_registered_locations || facilities.length || 1}
            </span>
            <span className="text-[9px] text-slate-400">Registered</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block">Active Facilities</span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {stats.active_locations_count || facilities.filter(f => f.status === 'ACTIVE').length || 1}
            </span>
            <span className="text-[9px] text-emerald-600">Operational</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Constables</span>
            <span className="text-lg font-bold text-[#172B4D] mt-0.5 block">
              {stats.registered_officers}
            </span>
            <span className="text-[9px] text-slate-400">In Directory</span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
            <span className="text-[10px] text-blue-700 font-bold uppercase block">Assigned</span>
            <span className="text-lg font-bold text-blue-700 mt-0.5 block">
              {stats.assigned_constables_count ?? stats.assigned_to_duty ?? 0}
            </span>
            <span className="text-[9px] text-blue-600">On Active Duty Post</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Unassigned</span>
            <span className="text-lg font-bold text-slate-700 mt-0.5 block">
              {stats.unassigned_constables_count ?? Math.max(0, stats.registered_officers - (stats.assigned_constables_count || 0))}
            </span>
            <span className="text-[9px] text-slate-400">Awaiting Post</span>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block">Inside Geofence</span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {stats.personnel_inside_assigned_geofence ?? stats.officers_inside_hq}
            </span>
            <span className="text-[9px] text-emerald-600">At Assigned Post</span>
          </div>

          <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-100">
            <span className="text-[10px] text-rose-700 font-bold uppercase block">Outside Geofence</span>
            <span className="text-lg font-bold text-rose-700 mt-0.5 block">
              {stats.personnel_outside_assigned_geofence ?? stats.officers_outside_hq}
            </span>
            <span className="text-[9px] text-rose-600">Beyond Perimeter</span>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
            <span className="text-[10px] text-amber-700 font-bold uppercase block">Stale / Offline</span>
            <span className="text-lg font-bold text-amber-700 mt-0.5 block">
              {stats.personnel_stale_or_unavailable ?? stats.officers_stale_or_unavailable}
            </span>
            <span className="text-[9px] text-amber-600">Pending GPS sync</span>
          </div>
        </div>
      </div>

      {/* Date Filter & Reporting Scope Selector */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#17365D]">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <span>Operational Period:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'custom', label: 'Custom Range' }
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setDateFilter(period.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                dateFilter === period.id
                  ? 'bg-[#17365D] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center space-x-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        )}
      </div>

      {/* 6 Personnel KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(kpi.tab)}
              className={`p-5 rounded-xl border bg-white hover:border-[#2563EB] cursor-pointer transition-all hover:shadow-md ${kpi.borderColor} group`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  {kpi.title}
                </span>
                <div className={`p-2.5 rounded-lg ${kpi.bgColor} ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className={`text-2xl font-bold font-mono tracking-tight ${kpi.color}`}>
                  {kpi.value}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                  {kpi.trend}
                </span>
              </div>

              <p className="text-xs text-[#64748B] mt-2 font-medium">{kpi.desc}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-[#2563EB]">
                <span>{kpi.subtext}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Location Duty & Operational Security Control Hub */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D] flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#17365D]" />
              <span>Multi-Location Duty & Operational Security</span>
            </h3>
            <p className="text-xs text-[#64748B]">Station-scoped rosters, automated daily cutoff reporting, and hardware token binding</p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            Active Multi-Location System
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => onNavigate('headquarters-settings')}
            className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Duty Locations</div>
            <div className="text-xl font-bold text-[#17365D] mt-0.5">{stats.active_locations_count ?? 1}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Manage stations &rarr;</div>
          </div>

          <div
            onClick={() => onNavigate('duty-assignments')}
            className="p-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assigned to Duty</div>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">{stats.assigned_to_duty ?? stats.registered_officers}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Roster status &rarr;</div>
          </div>

          <div
            onClick={() => onNavigate('outside-geofence')}
            className="p-3.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Outside Perimeter</div>
            <div className="text-xl font-bold text-rose-800 mt-0.5">{stats.officers_outside_hq}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">Breach audit &rarr;</div>
          </div>

          <div
            onClick={() => onNavigate('registered-devices')}
            className="p-3.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Device Binding</div>
            <div className="text-xl font-bold text-blue-800 mt-0.5">{stats.registered_officers}</div>
            <div className="text-[10px] text-blue-600 mt-0.5">Hardware locks &rarr;</div>
          </div>

          <div
            onClick={() => onNavigate('scheduled-reports')}
            className="p-3.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Daily Reports</div>
            <div className="text-xl font-bold text-indigo-800 mt-0.5">{stats.scheduled_reports_today ?? 2}</div>
            <div className="text-[10px] text-indigo-600 mt-0.5">10:30 & 17:00 cutoffs &rarr;</div>
          </div>

          <div
            onClick={() => onNavigate('app-usage')}
            className="p-3.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer transition"
          >
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">App Usage Today</div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{stats.app_usage_summaries_today ?? 0}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Foreground audit &rarr;</div>
          </div>
        </div>
      </div>

      {/* Attendance & Personnel Visual Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance by Hour (Today) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Headquarters Entry Distribution by Hour</h3>
              <p className="text-xs text-[#64748B]">Real-time entry traffic recorded inside Eluru HQ today</p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#17365D]"></span>
              <span>Total Entries: {stats.total_entries_today}</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#172B4D',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                  formatter={(val: any) => [`${val} entries`, 'Entries']}
                />
                <Bar dataKey="entries" fill="#17365D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Presence Status Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Personnel Presence Status</h3>
            <p className="text-xs text-[#64748B]">Live observation evidence across registered roster</p>

            <div className="h-48 w-full mt-2">
              {statusDonutData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No presence records available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {statusDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#172B4D'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-700"></span>
                <span>Inside Headquarters</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{stats.officers_inside_hq}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Outside Headquarters</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{stats.officers_outside_hq}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                <span>Location Stale</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{stats.officers_stale_or_unavailable}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                <span>Not Recorded Today</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">{stats.officers_not_recorded_today}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Attendance Trend & Station Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Attendance Trend (Last 7 Days) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Daily Attendance Trend (Last 7 Days)</h3>
              <p className="text-xs text-[#64748B]">Headquarters visit volume & distinct officer attendance</p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-[#2563EB] hover:text-[#17365D] font-bold flex items-center space-x-1"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#172B4D'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="total_visits"
                  name="Total Visits"
                  stroke="#17365D"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#17365D' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="distinct_officers"
                  name="Distinct Officers"
                  stroke="#2563EB"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#2563EB' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Station-wise Summary Table */}
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">Unit / Station Breakdown</h3>
                <p className="text-xs text-[#64748B]">Compliance by police station</p>
              </div>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
              {stationData.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No station summary data available
                </div>
              ) : (
                stationData.map((st, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="truncate">{st.station_name}</span>
                      <span className="font-mono text-[#17365D] shrink-0 ml-2">
                        {st.present_today} / {st.total_officers}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-[#17365D] h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, st.compliance_percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>Compliance</span>
                      <span className="font-bold text-slate-700">{st.compliance_percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Average HQ Stay:</span>
            <span className="font-bold text-slate-800 font-mono">
              {analytics?.avg_visit_duration_minutes || 0} mins
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity Table (Section 3.D) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">Recent Headquarters Activity Ledger</h3>
            <p className="text-xs text-[#64748B]">
              Real-time geofence entries, exits, and attendance transitions backed by database records
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search officer or ID..."
                value={activitySearch}
                onChange={(e) => {
                  setActivitySearch(e.target.value);
                  setActivityPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <select
              value={activityFilter}
              onChange={(e) => {
                setActivityFilter(e.target.value);
                setActivityPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Event Types</option>
              <option value="Headquarters entry">HQ Entry</option>
              <option value="Headquarters exit">HQ Exit</option>
              <option value="Attendance recorded">Attendance Recorded</option>
            </select>
          </div>
        </div>

        {/* Paginated Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Personnel</th>
                <th className="py-2.5 px-3">Police ID</th>
                <th className="py-2.5 px-3">Station / Unit</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Date & Time (IST)</th>
                <th className="py-2.5 px-3">Geofence / Location</th>
                <th className="py-2.5 px-3 text-right">Event Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-sans">
                    No activity records match the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedActivities.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {act.officer_name}
                      <span className="block text-[10px] text-slate-400 font-normal">{act.rank}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 font-medium">
                      {act.officer_id}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {act.department}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        act.event_type.includes('entry')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : act.event_type.includes('exit')
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {act.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {new Date(act.event_time).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {act.location_label}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        act.status === 'Verified' || act.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-800">
              {filteredActivities.length === 0 ? 0 : (activityPage - 1) * itemsPerPage + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-800">
              {Math.min(activityPage * itemsPerPage, filteredActivities.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-800">{filteredActivities.length}</span> events
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setActivityPage(p => Math.max(1, p - 1))}
              disabled={activityPage === 1}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="px-2 text-slate-600 font-mono">
              {activityPage} / {totalPages}
            </span>
            <button
              onClick={() => setActivityPage(p => Math.min(totalPages, p + 1))}
              disabled={activityPage >= totalPages}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
