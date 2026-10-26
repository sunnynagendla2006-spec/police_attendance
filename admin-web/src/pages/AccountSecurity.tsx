import React, { useState } from 'react';
import { Lock, Shield, CheckCircle2, AlertCircle, KeyRound, User } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../services/api';

interface Props {
  currentUser: UserType | null;
}

export const AccountSecurity: React.FC<Props> = ({ currentUser }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      setSuccessMsg('Password updated successfully. Security credentials synchronized.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <Lock className="w-5 h-5 text-[#17365D]" />
          <span>Account Security & Administrative Credentials</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage session authorization, authenticated profile, and change account password
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <User className="w-4 h-4 text-[#2563EB]" />
          <span>Authenticated Account Details</span>
        </h3>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-sans uppercase block">Username</span>
            <span className="text-slate-800 font-bold font-sans">@{currentUser?.username || 'admin'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-sans uppercase block">Assigned Role</span>
            <span className="text-[#17365D] font-bold uppercase">{currentUser?.role?.replace('_', ' ') || 'Super Admin'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-sans uppercase block">Account Status</span>
            <span className="text-emerald-700 font-bold">{currentUser?.account_status || 'ACTIVE'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 font-sans uppercase block">First-Login Policy</span>
            <span className={currentUser?.must_change_password ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
              {currentUser?.must_change_password ? 'Pending Initial Change' : 'Credentials Verified'}
            </span>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <KeyRound className="w-4 h-4 text-[#2563EB]" />
          <span>Update Account Password</span>
        </h3>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (minimum 8 characters) *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new strong password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Updating Credentials...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
