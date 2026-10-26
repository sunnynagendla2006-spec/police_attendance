import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Shield,
  CheckCircle,
  AlertCircle,
  X,
  Lock,
  UserX,
  UserCheck,
  Eye,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Officer, AttendanceVisit } from '../types';
import { api } from '../services/api';

interface Props {
  onNavigateToMap?: (officerId?: string) => void;
}

export const PoliceDirectory: React.FC<Props> = ({ onNavigateToMap }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Detail Modal
  const [viewOfficer, setViewOfficer] = useState<Officer | null>(null);
  const [officerVisits, setOfficerVisits] = useState<AttendanceVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Register Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formBadgeId, setFormBadgeId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRank, setFormRank] = useState('Police Constable');
  const [formMobile, setFormMobile] = useState('');
  const [formDepartment, setFormDepartment] = useState('Eluru Town Traffic');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetOfficer, setResetOfficer] = useState<Officer | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Deactivate Modal
  const [deactivateOfficerTarget, setDeactivateOfficerTarget] = useState<Officer | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const data = await api.getOfficers(
        searchQuery || undefined,
        departmentFilter || undefined,
        rankFilter || undefined
      );
      setOfficers(data);
    } catch (e) {
      console.error('Error fetching police directory:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [departmentFilter, rankFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchDirectory();
  };

  const handleOpenDetail = async (officer: Officer) => {
    setViewOfficer(officer);
    setLoadingVisits(true);
    try {
      const visits = await api.getAttendanceVisits({ officer_id: officer.officer_id });
      setOfficerVisits(visits.slice(0, 10));
    } catch (e) {
      console.error('Error fetching officer visits:', e);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegistering(true);

    try {
      await api.registerOfficer({
        username: formUsername.trim(),
        officer_id: formBadgeId.trim(),
        full_name: formFullName.trim(),
        rank: formRank,
        mobile_number: formMobile.trim(),
        department: formDepartment.trim()
      });
      setShowRegisterModal(false);
      setFormUsername('');
      setFormBadgeId('');
      setFormFullName('');
      setFormMobile('');
      await fetchDirectory();
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to register officer.');
    } finally {
      setRegistering(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOfficer) return;
    if (!resetReason.trim() || resetReason.trim().length < 5) {
      setResetError('Administrative reset justification of at least 5 characters is required.');
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetMessage(null);

    try {
      await api.adminResetPassword(resetOfficer.user_id, resetReason.trim());
      setResetMessage(`Password successfully reset to mobile 4-digit temporary credential for ${resetOfficer.username}.`);
      await fetchDirectory();
      setTimeout(() => {
        setResetOfficer(null);
        setResetMessage(null);
        setResetReason('');
      }, 2500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateOfficerTarget) return;
    setDeactivating(true);
    try {
      await api.deactivateOfficer(deactivateOfficerTarget.officer_id);
      setDeactivateOfficerTarget(null);
      await fetchDirectory();
    } catch (err: any) {
      alert(err.message || 'Deactivation failed.');
    } finally {
      setDeactivating(false);
    }
  };

  const departments = Array.from(new Set(officers.map(o => o.department))).filter(Boolean);

  const filteredOfficers = officers.filter(o => {
    if (statusFilter && o.account_status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredOfficers.length / itemsPerPage) || 1;
  const paginatedOfficers = filteredOfficers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header and Onboarding CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#17365D]" />
            <span>Police Personnel Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            District roster management, profile inspection, and credential lifecycle administration
          </p>
        </div>

        <button
          onClick={() => {
            setRegisterError(null);
            setShowRegisterModal(true);
          }}
          className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-2 transition shrink-0"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          <span>Register New Personnel</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, ID, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Station Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Police Stations / Units</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

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
            <option value="">All Account Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <button
            onClick={fetchDirectory}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Police ID</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Station / Unit</th>
                <th className="py-3 px-4">Registered Mobile</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading district police personnel...
                  </td>
                </tr>
              ) : paginatedOfficers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No police personnel found matching your filter.
                  </td>
                </tr>
              ) : (
                paginatedOfficers.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{o.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{o.username}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {o.officer_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {o.rank}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {o.department}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {o.mobile_number || '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        o.account_status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {o.account_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenDetail(o)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition"
                          title="View Details & Attendance"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        {onNavigateToMap && (
                          <button
                            onClick={() => onNavigateToMap(o.officer_id)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded border border-blue-200 transition"
                            title="Locate on Map"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setResetOfficer(o);
                            setResetError(null);
                            setResetMessage(null);
                            setResetReason('');
                          }}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition"
                          title="Reset Password to Mobile Suffix"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeactivateOfficerTarget(o)}
                          className={`p-1.5 rounded border transition ${
                            o.account_status === 'ACTIVE'
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                          }`}
                          title={o.account_status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            Showing <span className="font-semibold text-slate-800">{filteredOfficers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredOfficers.length)}</span> of <span className="font-semibold text-slate-800">{filteredOfficers.length}</span> personnel
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

      {/* Officer Detail Modal */}
      {viewOfficer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-sm">
                  {viewOfficer.full_name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">{viewOfficer.full_name}</h3>
                  <p className="text-xs text-slate-500">{viewOfficer.rank} • Police ID: {viewOfficer.officer_id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewOfficer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs mb-5">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Station</span>
                <span className="font-semibold text-slate-700">{viewOfficer.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Username</span>
                <span className="font-mono text-slate-700">@{viewOfficer.username}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Mobile</span>
                <span className="font-mono text-slate-700">{viewOfficer.mobile_number || '--'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Status</span>
                <span className="font-bold text-emerald-700">{viewOfficer.account_status}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">First-Login Policy</span>
                <span className="text-slate-700">
                  {viewOfficer.must_change_password ? 'Must Change Password' : 'Verified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Onboarded At</span>
                <span className="text-slate-700">
                  {new Date(viewOfficer.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>

            {/* Recent Headquarters Visits */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Recent Headquarters Visits</h4>
              {loadingVisits ? (
                <p className="text-xs text-slate-400 py-4 text-center">Loading visit records...</p>
              ) : officerVisits.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-lg">
                  No headquarters visit records found for this officer.
                </p>
              ) : (
                <div className="border border-slate-100 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-semibold">
                        <th className="py-2 px-3">Entry Time</th>
                        <th className="py-2 px-3">Exit Time</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {officerVisits.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono">
                            {new Date(v.entry_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {v.exit_at ? new Date(v.exit_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Still inside'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#17365D]">
                            {v.duration_formatted}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {v.visit_status}
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
                onClick={() => setViewOfficer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-[#17365D]">
                <UserPlus className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold text-sm text-slate-800">Register Police Personnel</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {registerError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. constable102"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Police ID / Badge Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ELR-PC-102"
                    value={formBadgeId}
                    onChange={(e) => setFormBadgeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Officer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. R. Srinivasa Rao"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rank / Designation *
                  </label>
                  <select
                    value={formRank}
                    onChange={(e) => setFormRank(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                  >
                    <option value="Police Constable">Police Constable</option>
                    <option value="Head Constable">Head Constable</option>
                    <option value="Assistant Sub-Inspector">Assistant Sub-Inspector</option>
                    <option value="Sub-Inspector">Sub-Inspector</option>
                    <option value="Inspector of Police">Inspector of Police</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Last 4 digits will form the initial first-login temporary credential.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Police Station / Unit *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eluru One Town PS"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {registering ? 'Onboarding...' : 'Register Personnel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetOfficer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-[#17365D]">
                <KeyRound className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold text-sm text-slate-800">Reset Officer Password</h3>
              </div>
              <button
                onClick={() => setResetOfficer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Resetting password for <strong>{resetOfficer.full_name}</strong> ({resetOfficer.officer_id}).
              Password will reset to the last 4 digits of their mobile number ({resetOfficer.mobile_number ? resetOfficer.mobile_number.slice(-4) : '****'}).
              A mandatory password update will be required on next sign-in.
            </p>

            {resetError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Operational Justification *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Requested by officer after forgotten password"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetOfficer(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {resetting ? 'Applying...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateOfficerTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-6">
            <h3 className="font-bold text-sm text-slate-800 mb-2">
              Confirm Account Deactivation
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to deactivate the personnel account for{' '}
              <strong>{deactivateOfficerTarget.full_name}</strong> ({deactivateOfficerTarget.officer_id})?
              Deactivated accounts will be barred from signing in to the mobile attendance application.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeactivateOfficerTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={deactivating}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                {deactivating ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
