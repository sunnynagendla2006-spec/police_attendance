import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  PieChart as PieIcon,
  Filter,
  Shield,
  Layers,
  Building2,
  AlertTriangle
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
import { OverviewStats, DailyTrendItem, FullAnalyticsData, StationSummaryItem } from '../types';
import { api } from '../services/api';

export const ReportsAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<FullAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<string>('daily');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [officerIdFilter, setOfficerIdFilter] = useState<string>('');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const full = await api.getFullAnalytics();
        setAnalytics(full);
      } catch (e) {
        console.error('Error loading analytics:', e);
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  const stats = analytics?.overview;
  const trends = analytics?.trends || [];
  const rankDist = analytics?.rank_distribution || {};
  const hourDist = analytics?.entry_hour_distribution || {};
  const stations = analytics?.station_summaries || [];

  const rankChartData = Object.entries(rankDist).map(([name, value]) => ({
    name: name.replace('Police ', '').replace(' of Police', ''),
    value
  }));

  const COLORS = ['#17365D', '#2563EB', '#15803D', '#B45309', '#64748B', '#0284C7'];

  return (
    <div className="space-y-6">
      {/* Header & Export CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#17365D]" />
            <span>Reports & Headquarters Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational visit frequency, attendance duration trends, and official export engine
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <a
            href={api.getCsvExportUrl(startDate || undefined, endDate || undefined, officerIdFilter || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV Dataset</span>
          </a>
          <a
            href={api.getPdfExportUrl(startDate || undefined, endDate || undefined, officerIdFilter || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#17365D] hover:bg-[#102642] text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Generate Official PDF</span>
          </a>
        </div>
      </div>

      {/* Report Type Selector & Date Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'daily', label: 'Daily Attendance' },
            { id: 'weekly', label: 'Weekly Summary' },
            { id: 'monthly', label: 'Monthly Report' },
            { id: 'station', label: 'Station-Wise' },
            { id: 'compliance', label: 'Compliance Trend' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setReportType(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                reportType === r.id
                  ? 'bg-[#17365D] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
            title="Start Date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
            title="End Date"
          />
        </div>
      </div>

      {/* Aggregate Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Today's Visits</span>
          <span className="text-2xl font-bold font-mono text-[#17365D] mt-1 block">
            {stats?.visits_recorded_today || 0}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">Logged HQ Geofence Entries</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total HQ Presence</span>
          <span className="text-2xl font-bold font-mono text-blue-700 mt-1 block">
            {stats?.total_hq_duration_formatted_today || '00h 00m'}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">Recorded Constable Stay</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Average Visit Duration</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
            {analytics?.avg_visit_duration_minutes || 0} min
          </span>
          <span className="text-xs text-slate-500 mt-1 block">Across Completed Sessions</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Compliance Rate</span>
          <span className="text-2xl font-bold font-mono text-[#17365D] mt-1 block">
            {stats?.compliance_percentage || 0}%
          </span>
          <span className="text-xs text-slate-500 mt-1 block">Of Total Registered Roster</span>
        </div>
      </div>

      {/* Detailed Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Compliance & Volume Trends */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Attendance Volume Trend (7 Days)</h3>
              <p className="text-xs text-slate-400">Total physical entries vs distinct officers</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#2563EB]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                />
                <Line
                  type="monotone"
                  dataKey="distinct_officers"
                  name="Distinct Officers"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563EB' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rank Distribution Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Officer Strength by Rank</h3>
              <p className="text-xs text-slate-400">Active personnel across AP Police designations</p>
            </div>
            <Award className="w-4 h-4 text-amber-500" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} stroke="#E2E8F0" />
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
                <Bar dataKey="value" name="Personnel Count" fill="#17365D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Station-wise Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Police Station Operational Summary</h3>
        <p className="text-xs text-slate-400 mb-4">
          Detailed personnel allocation and verified headquarters visits by police station
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Police Station / Unit</th>
                <th className="py-2.5 px-3">Total Registered Strength</th>
                <th className="py-2.5 px-3">Present at Headquarters Today</th>
                <th className="py-2.5 px-3">Compliance Rate</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No station records available.
                  </td>
                </tr>
              ) : (
                stations.map((st, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {st.station_name}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {st.total_officers} officers
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#17365D]">
                      {st.present_today}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#17365D] h-full rounded-full"
                            style={{ width: `${Math.min(100, st.compliance_percentage)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700 font-mono text-[11px]">
                          {st.compliance_percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        st.compliance_percentage >= 50
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {st.compliance_percentage >= 50 ? 'Compliant' : 'Low Attendance'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
