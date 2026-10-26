import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Lock,
  UserCheck,
  UserX,
  AlertCircle,
  X
} from 'lucide-react';
import { Officer, User } from '../types';
import { api } from '../services/api';

interface Props {
  currentUser: User | null;
}

export const UserManagement: React.FC<Props> = ({ currentUser }) => {
  const [users, setUsers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Password Reset Modal
  const [resetTarget, setResetTarget] = useState<Officer | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Status Change Confirmation
  const [statusTarget, setStatusTarget] = useState<Officer | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getOfficers(searchQuery || undefined);
      setUsers(data);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!resetReason.trim() || resetReason.trim().length < 5) {
      setResetError('Administrative reset justification of at least 5 characters is required.');
      return;
    }

    setResetting(true);
    setResetError(null);
    setResetMessage(null);

    try {
      const res = await api.adminResetPassword(resetTarget.user_id, resetReason.trim());
      setResetMessage(res.message);
      await fetchUsers();
      setTimeout(() => {
        setResetTarget(null);
        setResetMessage(null);
        setResetReason('');
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset officer password.');
    } finally {
      setResetting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      if (statusTarget.account_status === 'ACTIVE') {
        await api.deactivateOfficer(statusTarget.officer_id);
      } else {
        await api.updateOfficer(statusTarget.officer_id, { account_status: 'ACTIVE' });
      }
      setStatusTarget(null);
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to update user status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.rank !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.officer_id.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#17365D]" />
            <span>Administrative User & Role Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage system access credentials, role authorizations, and password policies
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs text-slate-500 font-medium">
            Active Accounts: <span className="font-bold text-slate-800 font-mono">{users.filter(u => u.account_status === 'ACTIVE').length}</span> / {users.length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, ID, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#2563EB] transition"
          >
            <option value="">All Ranks & Roles</option>
            <option value="Superintendent of Police">Superintendent of Police</option>
            <option value="Inspector of Police">Inspector of Police</option>
            <option value="Sub-Inspector">Sub-Inspector</option>
            <option value="Assistant Sub-Inspector">Assistant Sub-Inspector</option>
            <option value="Head Constable">Head Constable</option>
            <option value="Police Constable">Police Constable</option>
          </select>

          <button
            onClick={fetchUsers}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">User / Officer</th>
                <th className="py-3 px-4">Police ID</th>
                <th className="py-3 px-4">Rank / Designation</th>
                <th className="py-3 px-4">Station / Unit</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">First-Login Policy</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading personnel accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No user accounts match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {u.officer_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {u.rank}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.department}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.account_status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {u.account_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.must_change_password ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Password Change Pending
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Credentials Verified</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setResetTarget(u);
                            setResetError(null);
                            setResetMessage(null);
                            setResetReason('');
                          }}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 text-[11px] font-medium flex items-center space-x-1 transition"
                          title="Reset Password to Mobile Suffix"
                        >
                          <KeyRound className="w-3 h-3 text-slate-500" />
                          <span>Reset Credential</span>
                        </button>
                        {currentUser?.role === 'super_admin' && (
                          <button
                            onClick={() => setStatusTarget(u)}
                            className={`p-1 rounded transition border ${
                              u.account_status === 'ACTIVE'
                                ? 'text-rose-600 hover:bg-rose-50 border-rose-200'
                                : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                            }`}
                            title={u.account_status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                          >
                            {u.account_status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-[#17365D]">
                <KeyRound className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-bold text-sm text-slate-800">Reset Officer Password</h3>
              </div>
              <button
                onClick={() => setResetTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Resetting password for <strong>{resetTarget.full_name}</strong> ({resetTarget.officer_id}).
              In accordance with AP Police standard first-login policy, the password will be reset to the{' '}
              <strong>last four digits of registered mobile</strong> and the officer will be required to change it upon next login.
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
                  Mandatory Audit Justification / Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer requested credential reset after device reinstallation"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
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

      {/* Status Toggle Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-6">
            <h3 className="font-bold text-sm text-slate-800 mb-2">
              {statusTarget.account_status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to {statusTarget.account_status === 'ACTIVE' ? 'deactivate' : 'activate'} the personnel account for{' '}
              <strong>{statusTarget.full_name}</strong> ({statusTarget.officer_id})?
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={updatingStatus}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition ${
                  statusTarget.account_status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {updatingStatus ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
