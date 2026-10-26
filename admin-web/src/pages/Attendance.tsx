import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  Shield,
  ArrowUpDown,
  Building2,
  Navigation
} from 'lucide-react';
import { OfficerAttendanceSummary, AttendanceVisit } from '../types';
import { api } from '../services/api';

export const Attendance: React.FC = () => {
  const [summaries, setSummaries] = useState<OfficerAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [rankFilter, setRankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Selected Officer Profile Modal
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [officerVisits, setOfficerVisits] = useState<AttendanceVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceSummary({
        date_filter: dateFilter,
        rank_filter: rankFilter || undefined,
        status_filter: statusFilter || undefined,
        query: searchQuery || undefined
      });
      setSummaries(data);
    } catch (e) {
      console.error('Error fetching attendance summary:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter, rankFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAttendance();
  };

  const openOfficerProfile = async (officerId: string) => {
    setSelectedOfficerId(officerId);
    setLoadingVisits(true);
    try {
      const visits = await api.getAttendanceVisits({ officer_id: officerId });
      setOfficerVisits(visits);
    } catch (e) {
      console.error('Error loading officer visits:', e);
    } finally {
      setLoadingVisits(false);
    }
  };

  const selectedOfficerSummary = summaries.find(s => s.officer_id === selectedOfficerId);

  // Pagination
  const totalPages = Math.ceil(summaries.length / itemsPerPage) || 1;
  const paginatedSummaries = summaries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#17365D]" />
            <span>Headquarters Attendance Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative physical presence and visit ledger for Eluru District Police Headquarters
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <a
            href={api.getCsvExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </a>
          <a
            href={api.getPdfExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-2 bg-[#17365D] hover:bg-[#102642] text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Generate Official PDF</span>
          </a>
        </div>
      </div>

      {/* Filter and Date Selector Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by officer name or Police ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Date Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setDateFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded font-semibold transition ${
                  dateFilter === tab.id
                    ? 'bg-white text-[#17365D] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Rank Filter */}
          <select
            value={rankFilter}
            onChange={(e) => {
              setRankFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Ranks</option>
            <option value="Superintendent of Police">Superintendent of Police</option>
            <option value="Inspector of Police">Inspector of Police</option>
            <option value="Sub-Inspector">Sub-Inspector</option>
            <option value="Assistant Sub-Inspector">Assistant Sub-Inspector</option>
            <option value="Head Constable">Head Constable</option>
            <option value="Police Constable">Police Constable</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Presence Statuses</option>
            <option value="INSIDE">Inside HQ</option>
            <option value="OUTSIDE">Outside HQ</option>
            <option value="LOCATION_STALE">Location Stale</option>
          </select>

          <button
            onClick={fetchAttendance}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Attendance Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Police Personnel</th>
                <th className="py-3 px-4">Police ID</th>
                <th className="py-3 px-4">Rank / Station</th>
                <th className="py-3 px-4">First Entry</th>
                <th className="py-3 px-4">Latest Exit</th>
                <th className="py-3 px-4">Visit Count</th>
                <th className="py-3 px-4">Total HQ Stay</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading headquarters attendance ledger...
                  </td>
                </tr>
              ) : paginatedSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No attendance records available for this period.
                  </td>
                </tr>
              ) : (
                paginatedSummaries.map(s => {
                  const isInside = s.current_hq_status === 'INSIDE';
                  const isStale = s.current_hq_status === 'LOCATION_STALE';
                  const hasIncomplete = isInside || (s.visits_today > 0 && !s.latest_exit_today);

                  return (
                    <tr key={s.user_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{s.officer_name}</div>
                        {hasIncomplete && (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                            Active Session Inside
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {s.officer_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{s.rank}</div>
                        <div className="text-[10px] text-slate-400">{s.department}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.first_entry_today ? (
                          new Date(s.first_entry_today).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.latest_exit_today ? (
                          new Date(s.latest_exit_today).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        ) : isInside ? (
                          <span className="text-emerald-700 font-sans font-bold">Inside HQ</span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {s.visits_today}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#17365D]">
                        {s.total_duration_formatted_today}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isInside
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isStale
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isInside ? 'Inside HQ' : isStale ? 'Location Stale' : 'Outside HQ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openOfficerProfile(s.officer_id)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[#17365D] rounded border border-slate-200 text-xs font-semibold flex items-center space-x-1 ml-auto transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{summaries.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, summaries.length)}</span> of <span className="font-semibold text-slate-800">{summaries.length}</span> personnel
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="px-2 text-slate-600 font-mono">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Individual Officer Attendance & Visit Modal */}
      {selectedOfficerId && selectedOfficerSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Attendance Audit: {selectedOfficerSummary.officer_name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Badge: {selectedOfficerSummary.officer_id} • {selectedOfficerSummary.rank} • {selectedOfficerSummary.department}
                </p>
              </div>
              <button
                onClick={() => setSelectedOfficerId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metric Summary */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs mb-5">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Stay Today</span>
                <span className="font-bold text-[#17365D] font-mono text-sm">
                  {selectedOfficerSummary.total_duration_formatted_today}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Visits Logged</span>
                <span className="font-bold text-slate-800 font-mono text-sm">
                  {selectedOfficerSummary.visits_today}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current HQ State</span>
                <span className="font-bold text-emerald-700 text-xs">
                  {selectedOfficerSummary.current_hq_status}
                </span>
              </div>
            </div>

            {/* Visit Session Ledger */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Headquarters Visits for Officer</h4>
              {loadingVisits ? (
                <p className="text-xs text-slate-400 py-6 text-center">Loading visit sessions...</p>
              ) : officerVisits.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-lg">
                  No individual headquarters visits recorded for this officer.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase">
                        <th className="py-2.5 px-3">Entry Time</th>
                        <th className="py-2.5 px-3">Exit Time</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {officerVisits.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono">
                            {new Date(v.entry_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {v.exit_at ? (
                              new Date(v.exit_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            ) : (
                              <span className="text-emerald-700 font-sans font-bold">Active Inside</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#17365D]">
                            {v.duration_formatted}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {v.entry_verification_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedOfficerId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
