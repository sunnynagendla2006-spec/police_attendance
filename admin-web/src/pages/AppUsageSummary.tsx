import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Download,
  Filter,
  CheckCircle2,
  Settings,
  Search,
  X
} from 'lucide-react';
import { AppUsageSummary as AppUsageItem, AppUsagePolicyConfig } from '../types';
import { api } from '../services/api';

export const AppUsageSummaryPage: React.FC = () => {
  const [usageList, setUsageList] = useState<AppUsageItem[]>([]);
  const [policy, setPolicy] = useState<AppUsagePolicyConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [onlyExceeding, setOnlyExceeding] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Policy Modal
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [warningThreshold, setWarningThreshold] = useState<number>(30);
  const [approvedPackages, setApprovedPackages] = useState<string>('');
  const [savingPolicy, setSavingPolicy] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<'PDF' | 'CSV' | null>(null);

  const currentUser = api.getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usageRes, policyRes] = await Promise.all([
        api.getAppUsageSummaries({
          date: selectedDate || undefined,
          only_exceeding_threshold: onlyExceeding ? true : undefined
        }),
        api.getAppUsagePolicy().catch(() => null)
      ]);
      setUsageList(usageRes);
      if (policyRes) {
        setPolicy(policyRes);
        setWarningThreshold(policyRes.warning_threshold_minutes ?? 30);
        setApprovedPackages(policyRes.approved_work_packages?.join('\n') ?? '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load app usage summaries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, onlyExceeding]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPolicy(true);
      setError(null);
      const packagesList = approvedPackages
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const updated = await api.updateAppUsagePolicy({
        warning_threshold_minutes: Number(warningThreshold),
        approved_work_packages: packagesList
      });
      setPolicy(updated);
      setSuccessMsg('App usage monitoring policy updated successfully.');
      setShowPolicyModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDownload = async (format: 'PDF' | 'CSV') => {
    try {
      setDownloading(format);
      await api.downloadReportFile({
        report_type: 'APP_USAGE_SUMMARY',
        format,
        report_date: selectedDate
      });
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const filteredUsage = usageList.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.officer_name.toLowerCase().includes(q) ||
      item.officer_id.toLowerCase().includes(q) ||
      item.app_name.toLowerCase().includes(q) ||
      item.package_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#17365D] uppercase tracking-wider">
            <Smartphone className="w-4 h-4 text-[#2563EB]" />
            <span>Workforce Transparency & Discipline</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Constable App Usage Summaries
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Transparent tracking of aggregate foreground minutes during duty hours. Content and private messages are strictly excluded.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isSuperAdmin && (
            <button
              onClick={() => setShowPolicyModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Policy Config</span>
            </button>
          )}

          <button
            onClick={() => handleDownload('PDF')}
            disabled={downloading !== null}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'PDF' ? 'Exporting...' : 'PDF'}</span>
          </button>
          <button
            onClick={() => handleDownload('CSV')}
            disabled={downloading !== null}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'CSV' ? 'Exporting...' : 'CSV'}</span>
          </button>
        </div>
      </div>

      {/* Disclosed Monitoring Privacy Banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start space-x-3">
        <Info className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold text-blue-950">Statutory Transparency Notice:</strong>{' '}
          In accordance with Police Department workforce regulations, only aggregate foreground active minutes per installed package are audited during duty shifts.
          The system <em>never</em> captures keystrokes, personal chats, media, camera feed, or screen contents. Constables are explicitly notified within the mobile app.
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by constable name, ID, or app title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          />

          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={onlyExceeding}
              onChange={(e) => setOnlyExceeding(e.target.checked)}
              className="rounded text-[#17365D] focus:ring-0"
            />
            <span>&gt; {policy?.warning_threshold_minutes ?? 30}m Non-Work Apps Only</span>
          </label>
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Officer Details</th>
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Active Foreground Usage</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 text-right">Policy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading usage records...
                  </td>
                </tr>
              ) : filteredUsage.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No foreground app usage records logged for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredUsage.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{item.officer_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {item.officer_id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{item.app_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                          {item.package_name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.foreground_minutes.toFixed(1)} mins</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {item.is_approved_work_app ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            Approved Work App
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            General / Non-Work
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.exceeds_threshold ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Exceeds &gt; {policy?.warning_threshold_minutes ?? 30}m Threshold
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-semibold">
                            Within Tolerance
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Policy Configuration */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#172B4D]">Configure App Usage Policy</h3>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Non-Work App Warning Threshold (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  required
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Non-work applications exceeding this cumulative daily duration are flagged in rosters.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Approved Official Work App Package IDs (One per line)
                </label>
                <textarea
                  rows={5}
                  value={approvedPackages}
                  onChange={(e) => setApprovedPackages(e.target.value)}
                  placeholder="com.policehq.geoattend&#10;com.google.android.apps.maps"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {savingPolicy ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AppUsageSummaryPage;
