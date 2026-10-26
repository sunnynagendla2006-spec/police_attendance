import React, { useState, useEffect } from 'react';
import { FileText, Search, Shield, Filter, Calendar, Clock, ArrowDown } from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(actionFilter || undefined);
      setLogs(data);
    } catch (e) {
      console.error('Error loading audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter(l => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.actor_username.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target_type.toLowerCase().includes(q) ||
        (l.reason && l.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#17365D]" />
            <span>Attendance History & Administrative Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable audit record of all geofence updates, personnel registrations, password resets, and manual attendance corrections
          </p>
        </div>

        <span className="text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Total Logged Events: <strong className="text-slate-800">{logs.length}</strong>
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by actor, action, or reason..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Action Types</option>
            <option value="GEOFENCE_UPDATED">GEOFENCE_UPDATED</option>
            <option value="OFFICER_REGISTERED">OFFICER_REGISTERED</option>
            <option value="OFFICER_UPDATED">OFFICER_UPDATED</option>
            <option value="ADMIN_PASSWORD_RESET">ADMIN_PASSWORD_RESET</option>
            <option value="VISIT_CORRECTED">VISIT_CORRECTED</option>
            <option value="REPORT_EXPORTED">REPORT_EXPORTED</option>
            <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
          </select>

          <button
            onClick={fetchLogs}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Target Reference</th>
                <th className="py-3 px-4">Operational Justification / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    Loading security audit logs...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    No audit records match the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#17365D]">
                      @{l.actor_username}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {l.target_type}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">
                      {l.target_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-sans text-xs">
                      {l.reason || '--'}
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
            Showing <span className="font-semibold text-slate-800">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="font-semibold text-slate-800">{filteredLogs.length}</span> audit logs
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
    </div>
  );
};
