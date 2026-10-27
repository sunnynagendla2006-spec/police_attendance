import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Calendar,
  Building,
  History,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { Headquarters, ReportDownloadRecord } from '../types';
import { api } from '../services/api';

interface ReportOption {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'Daily Cutoffs' | 'Duty & Compliance' | 'Hardware & Security' | 'Historical & Movement';
  defaultFormat: 'PDF' | 'CSV';
}

const REPORT_CATALOG: ReportOption[] = [
  {
    id: 'MORNING_1030_REPORT',
    code: 'POL-REP-01',
    title: 'Daily Morning Attendance Report (10:30 AM)',
    description: 'Evaluates 10:00 AM morning check-ins with presence vs absence against station boundaries.',
    category: 'Daily Cutoffs',
    defaultFormat: 'PDF'
  },
  {
    id: 'EVENING_1700_REPORT',
    code: 'POL-REP-02',
    title: 'Daily Evening Cutoff Report (5:00 PM)',
    description: 'Full day attendance snapshot strictly filtering records up to 17:00 IST cutoff.',
    category: 'Daily Cutoffs',
    defaultFormat: 'PDF'
  },
  {
    id: 'LOCATION_DUTY_COMPLIANCE',
    code: 'POL-REP-03',
    title: 'Location-Wise Duty Compliance Report',
    description: 'Breakdown of personnel stationed at each police station, out-post, or headquarters.',
    category: 'Duty & Compliance',
    defaultFormat: 'PDF'
  },
  {
    id: 'OUTSIDE_GEOFENCE_AUDIT',
    code: 'POL-REP-04',
    title: 'Outside-Geofence Audit Report',
    description: 'Detailed roster of constables detected beyond approved perimeter with distance excess.',
    category: 'Duty & Compliance',
    defaultFormat: 'PDF'
  },
  {
    id: 'DEVICE_BINDING_AUDIT',
    code: 'POL-REP-05',
    title: 'Hardware & Device Binding Audit Report',
    description: 'Single-device verification log, approved handsets, and hardware swap requests.',
    category: 'Hardware & Security',
    defaultFormat: 'PDF'
  },
  {
    id: 'APP_USAGE_SUMMARY',
    code: 'POL-REP-06',
    title: 'Constable App Usage Summary Report',
    description: 'Disclosed foreground application usage with flags for apps exceeding the 30-minute threshold.',
    category: 'Hardware & Security',
    defaultFormat: 'PDF'
  },
  {
    id: 'MONTHLY_ATTENDANCE_SHEET',
    code: 'POL-REP-07',
    title: 'Consolidated Monthly Attendance Sheet',
    description: 'Complete day-by-day attendance grid across all days in the selected month.',
    category: 'Duty & Compliance',
    defaultFormat: 'CSV'
  },
  {
    id: 'LATE_ARRIVAL_REPORT',
    code: 'POL-REP-08',
    title: 'Late Arrival & Delayed Check-in Report',
    description: 'Audit of delayed check-ins submitted beyond the configured 30-minute grace period.',
    category: 'Duty & Compliance',
    defaultFormat: 'PDF'
  },
  {
    id: 'STATION_MOVEMENT_REPORT',
    code: 'POL-REP-09',
    title: 'Station Movement & Visit Duration Report',
    description: 'Complete record of geofence entry/exit events and duration spent inside headquarters.',
    category: 'Historical & Movement',
    defaultFormat: 'CSV'
  },
  {
    id: 'ADMIN_ACTION_AUDIT',
    code: 'POL-REP-10',
    title: 'Admin Action & Permission Audit Log',
    description: 'Comprehensive trail of administrative assignments, permission changes, and password resets.',
    category: 'Hardware & Security',
    defaultFormat: 'PDF'
  },
  {
    id: 'GEOFENCE_TRANSITION_HISTORY',
    code: 'POL-REP-11',
    title: 'Geofence Perimeter Transition History',
    description: 'Low-level entry and exit timestamps with verification statuses across all stations.',
    category: 'Historical & Movement',
    defaultFormat: 'CSV'
  },
  {
    id: 'INCOMPLETE_SESSIONS_REPORT',
    code: 'POL-REP-12',
    title: 'Incomplete Duty Session Report',
    description: 'Identifies unclosed duty shifts where an officer entered HQ without a verified departure.',
    category: 'Duty & Compliance',
    defaultFormat: 'PDF'
  }
];

export const ReportDownloads: React.FC = () => {
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<ReportDownloadRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDownload, setActiveDownload] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [locsRes, historyRes] = await Promise.all([
        api.getHeadquartersFacilities(),
        api.getDownloadHistory(25).catch(() => [])
      ]);
      setLocations(locsRes);
      setDownloadHistory(historyRes);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize report hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownload = async (reportId: string, format: 'PDF' | 'CSV') => {
    try {
      setActiveDownload(`${reportId}_${format}`);
      setError(null);
      await api.downloadReportFile({
        report_type: reportId,
        format,
        report_date: selectedDate,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        location_id: selectedLocation || undefined
      });
      setSuccessMsg(`Official ${format} report generated and downloaded.`);
      // Refresh download history
      api.getDownloadHistory(25).then(setDownloadHistory).catch(() => {});
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setActiveDownload(null);
    }
  };

  const filteredReports = REPORT_CATALOG.filter((rep) => {
    if (selectedCategory !== 'All' && rep.category !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      rep.title.toLowerCase().includes(q) ||
      rep.code.toLowerCase().includes(q) ||
      rep.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#17365D] uppercase tracking-wider">
            <Download className="w-4 h-4 text-[#2563EB]" />
            <span>Official Reporting Center</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Police Headquarters Reports & Downloads
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Download official police department PDF rosters and raw CSV datasets for accountability, command briefings, and audits.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* Filter Scope Controls */}
      <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Report Parameters & Scope
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Duty Location Scope
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            >
              <option value="">All Authorized Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Primary Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Range Start Date (Optional)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Range End Date (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            />
          </div>
        </div>

        {/* Categories Tab and Search */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {['All', 'Daily Cutoffs', 'Duty & Compliance', 'Hardware & Security', 'Historical & Movement'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? 'bg-[#17365D] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search report titles or codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
            />
          </div>
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((report) => {
          const isPdfActive = activeDownload === `${report.id}_PDF`;
          const isCsvActive = activeDownload === `${report.id}_CSV`;
          return (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {report.code}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {report.category}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#172B4D] mt-2 leading-snug">
                  {report.title}
                </h3>
                <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownload(report.id, 'PDF')}
                    disabled={activeDownload !== null}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isPdfActive ? 'Generating...' : 'PDF'}</span>
                  </button>
                  <button
                    onClick={() => handleDownload(report.id, 'CSV')}
                    disabled={activeDownload !== null}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{isCsvActive ? 'Exporting...' : 'CSV'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Official</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Download Audit History Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-[#17365D]" />
            <h3 className="text-sm font-bold text-[#172B4D]">Recent Report Download Audit Trail</h3>
          </div>
          <span className="text-[11px] text-slate-400">Strict regulatory chain-of-custody</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Administrator</th>
                <th className="py-2.5 px-4">Report Type</th>
                <th className="py-2.5 px-4">Format</th>
                <th className="py-2.5 px-4">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {downloadHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No recent download events logged.
                  </td>
                </tr>
              ) : (
                downloadHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                      {new Date(item.downloaded_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })} IST
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {item.username}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#17365D]">
                      {item.report_type}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.format === 'PDF'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.format}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {item.location_name || 'Organization-wide'} &bull; {item.report_date}
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
export default ReportDownloads;
