import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onSuccess: () => void;
}

export const Login: React.FC<Props> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.login(username.trim(), password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center items-center px-4 font-sans select-none">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-8 sm:p-10">
        {/* Emblem / Badge Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#17365D] flex items-center justify-center shadow-md mb-3 border-2 border-slate-100">
            <Shield className="w-9 h-9 text-amber-400 fill-amber-400" />
          </div>
          <span className="text-[11px] font-bold text-[#2563EB] uppercase tracking-widest">
            Andhra Pradesh Police
          </span>
          <h2 className="text-xl font-bold text-[#172B4D] mt-1">
            Eluru District Police HQ
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            PoliceHQ GeoAttend Administrative Command Portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mobile Number / Officer ID / Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#17365D] hover:bg-[#102642] text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating with HQ...' : 'Sign In to Command Portal'}
          </button>
        </form>

        {/* Footer Audit Notice */}
        <div className="mt-8 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-5">
          Official Government Police System • Unauthorized Access Barred
        </div>
      </div>
    </div>
  );
};
