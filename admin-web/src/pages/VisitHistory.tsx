import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Calendar,
  Clock,
  Edit3,
  CheckCircle,
  AlertTriangle,
  X,
  ShieldAlert,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { AttendanceVisit } from '../types';
import { api } from '../services/api';

export const VisitHistory: React.FC = () => {
  const [visits, setVisits] = useState<AttendanceVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [officerFilter, setOfficerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Correction Modal State
  const [editingVisit, setEditingVisit] = useState<AttendanceVisit | null>(null);
  const [correctedEntry, setCorrectedEntry] = useState('');
  const [correctedExit, setCorrectedExit] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceVisits({
        officer_id: officerFilter || undefined,
        status_filter: statusFilter || undefined
      });
      setVisits(data);
    } catch (e) {
      console.error('Error loading visits ledger:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [officerFilter, statusFilter]);

  const openCorrectionModal = (v: AttendanceVisit) => {
    setEditingVisit(v);
    setCorrectedEntry(v.entry_at ? new Date(v.entry_at).toISOString().slice(0, 16) : '');
    setCorrectedExit(v.exit_at ? new Date(v.exit_at).toISOString().slice(0, 16) : '');
    setCorrectionReason('');
    setCorrectionError(null);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setCorrectionError('Audited operational justification of at least 5 characters is required.');
      return;
    }

    setSavingCorrection(true);
    setCorrectionError(null);

    try {
      await api.correctVisit(
        editingVisit.id,
        correctedEntry ? new Date(correctedEntry).toISOString() : null,
        correctedExit ? new Date(correctedExit).toISOString() : null,
        correctionReason.trim()
      );
      setEditingVisit(null);
      await fetchVisits();
    } catch (err: any) {
      setCorrectionError(err.message || 'Failed to apply visit correction');
    } finally {
      setSavingCorrection(false);
    }
  };

  const filteredVisits = visits.filter(v => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.officer_name.toLowerCase().includes(q) ||
        v.officer_id.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage) || 1;
  const paginatedVisits = filteredVisits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <History className="w-5 h-5 text-[#17365D]" />
            <span>Headquarters Visits & Station Visits Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual officer visits, verified geofence arrival & departure timestamps, and duration records
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
            <span>Export Visits CSV</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by officer name or Police ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Visit Statuses</option>
            <option value="OPEN">Open Visits (Inside HQ)</option>
            <option value="COMPLETED">Completed Visits</option>
          </select>

          <button
            onClick={fetchVisits}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Visits Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Police Personnel</th>
                <th className="py-3 px-4">Police ID</th>
                <th className="py-3 px-4">Rank / Station</th>
                <th className="py-3 px-4">Entry Timestamp</th>
                <th className="py-3 px-4">Exit Timestamp</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Visit Status</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading visit sessions ledger...
                  </td>
                </tr>
              ) : paginatedVisits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No visit records found.
                  </td>
                </tr>
              ) : (
                paginatedVisits.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{v.officer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Ref: {v.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {v.officer_id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{v.rank}</div>
                      <div className="text-[10px] text-slate-400">{v.department}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(v.entry_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {v.exit_at ? (
                        new Date(v.exit_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      ) : (
                        <span className="text-emerald-700 font-sans font-bold">Currently Inside</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#17365D]">
                      {v.duration_formatted}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        v.visit_status === 'OPEN'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {v.visit_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {v.entry_verification_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openCorrectionModal(v)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs font-semibold flex items-center space-x-1 ml-auto transition"
                        title="Manual Audit Adjustment"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Correct</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{filteredVisits.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredVisits.length)}</span> of <span className="font-semibold text-slate-800">{filteredVisits.length}</span> records
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

      {/* Manual Correction Modal */}
      {editingVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-[#17365D]">
                <Edit3 className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold text-sm text-slate-800">Manual Visit Timestamp Correction</h3>
              </div>
              <button
                onClick={() => setEditingVisit(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Applying administrative adjustment to visit record for{' '}
              <strong>{editingVisit.officer_name}</strong> ({editingVisit.officer_id}).
              This modification will be recorded permanently in the system audit logs.
            </p>

            {correctionError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{correctionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjusted Entry Time
                </label>
                <input
                  type="datetime-local"
                  value={correctedEntry}
                  onChange={(e) => setCorrectedEntry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjusted Exit Time
                </label>
                <input
                  type="datetime-local"
                  value={correctedExit}
                  onChange={(e) => setCorrectedExit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audited Justification *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Officer reported hardware GPS sleep delay on departure"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {savingCorrection ? 'Saving...' : 'Apply Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
