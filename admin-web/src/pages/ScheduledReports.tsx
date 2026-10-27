import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Download,
  Settings,
  Plus,
  RefreshCw,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Building,
  X
} from 'lucide-react';
import { ScheduledReportRecord, Headquarters, LocationScheduleConfig } from '../types';
import { api } from '../services/api';

export const ScheduledReports: React.FC = () => {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReportRecord[]>([]);
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<LocationScheduleConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [genReportType, setGenReportType] = useState<string>('MORNING_1030_REPORT');
  const [genDate, setGenDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [genLocationId, setGenLocationId] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);

  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [morningTime, setMorningTime] = useState<string>('10:00');
  const [eveningTime, setEveningTime] = useState<string>('18:00');
  const [gracePeriod, setGracePeriod] = useState<number>(30);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [reportsRes, locsRes, configRes] = await Promise.all([
        api.getScheduledReports({
          report_date: selectedDate || undefined,
          location_id: selectedLocation || undefined
        }),
        api.getHeadquartersFacilities(),
        api.getSnapshotScheduleConfig().catch(() => null)
      ]);
      setScheduledReports(reportsRes);
      setLocations(locsRes);
      if (configRes) {
        setScheduleConfig(configRes);
        setMorningTime(configRes.morning_snapshot_time || '10:00');
        setEveningTime(configRes.evening_snapshot_time || '18:00');
        setGracePeriod(configRes.grace_period_minutes ?? 30);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduled reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedLocation]);

  const handleTriggerGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      setError(null);
      await api.generateReport({
        report_type: genReportType,
        report_date: genDate,
        location_id: genLocationId || undefined
      });
      setSuccessMsg('Report generation dispatched successfully.');
      setShowGenerateModal(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setError(null);
      const updated = await api.updateSnapshotScheduleConfig({
        morning_snapshot_time: morningTime,
        evening_snapshot_time: eveningTime,
        grace_period_minutes: Number(gracePeriod)
      });
      setScheduleConfig(updated);
      setSuccessMsg('Schedule timing configuration updated.');
      setShowConfigModal(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update schedule config.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDownload = async (
    record: ScheduledReportRecord,
    format: 'PDF' | 'CSV'
  ) => {
    try {
      setDownloadingId(`${record.id}_${format}`);
      await api.downloadReportFile({
        report_type: record.report_type,
        format,
        report_date: record.report_date,
        location_id: record.location_id || undefined
      });
    } catch (err: any) {
      setError(`Download error: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#17365D] uppercase tracking-wider">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <span>Automated Roster Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Scheduled Daily Reports
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Automated morning (10:30 AM) and evening cutoff (5:00 PM) police attendance reports evaluated against geofence perimeters.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Timings Config</span>
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Generate On-Demand</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {/* Timing Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Morning Scheduled Cutoff</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                10:30 AM IST Daily
              </span>
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mt-0.5">Morning Attendance Roster</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Takes morning snapshot observations (window 10:00 AM &plusmn; 30 min) and compiles presence vs absence inside headquarters and stations.
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evening Final Cutoff</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                5:00 PM IST Daily
              </span>
            </div>
            <h3 className="text-base font-bold text-[#172B4D] mt-0.5">Evening Cutoff Report</h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              Evaluates all recorded observations strictly up to 17:00 IST cutoff. Summarizes daily hours, perimeter compliance, and deviations.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          >
            <option value="">All Duty Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadData}
          title="Refresh"
          className="p-2 rounded-lg text-slate-500 hover:text-[#17365D] hover:bg-slate-100 transition self-end md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table of Scheduled Reports */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Report Details</th>
                <th className="py-3 px-4">Scheduled Date</th>
                <th className="py-3 px-4">Duty Location</th>
                <th className="py-3 px-4">Compliance Summary</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Downloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading scheduled reports...
                  </td>
                </tr>
              ) : scheduledReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No scheduled report runs recorded for {selectedDate}. Use "Generate On-Demand" to create one.
                  </td>
                </tr>
              ) : (
                scheduledReports.map((report) => {
                  const isPdfDownloading = downloadingId === `${report.id}_PDF`;
                  const isCsvDownloading = downloadingId === `${report.id}_CSV`;
                  return (
                    <tr key={report.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{report.schedule_time_label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {report.report_type}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {report.report_date}
                        {report.generated_at && (
                          <div className="text-[10px] text-slate-400">
                            {new Date(report.generated_at).toLocaleTimeString('en-IN')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {report.location_name || 'Organization-wide (All Locations)'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span className="text-emerald-700 font-bold">
                            {report.present_count} Present
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-rose-600 font-bold">
                            {report.absent_count} Absent
                          </span>
                          {report.outside_geofence_count > 0 && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="text-amber-700 font-bold">
                                {report.outside_geofence_count} Outside HQ
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Total {report.total_constables_evaluated} evaluated
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {report.status === 'COMPLETED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                          </span>
                        )}
                        {report.status === 'GENERATING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                            Generating
                          </span>
                        )}
                        {report.status === 'PENDING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {report.status === 'FAILED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownload(report, 'PDF')}
                          disabled={isPdfDownloading}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50"
                        >
                          {isPdfDownloading ? 'Loading...' : 'PDF'}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => handleDownload(report, 'CSV')}
                          disabled={isCsvDownloading}
                          className="text-xs text-slate-700 hover:text-slate-900 font-semibold disabled:opacity-50"
                        >
                          {isCsvDownloading ? 'Loading...' : 'CSV'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Generate On-Demand Report */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#172B4D]">Generate On-Demand Official Report</h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerGenerate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Report Type *
                </label>
                <select
                  required
                  value={genReportType}
                  onChange={(e) => setGenReportType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                >
                  <option value="MORNING_1030_REPORT">Morning Attendance Report (10:30 AM)</option>
                  <option value="EVENING_1700_REPORT">Evening Cutoff Report (5:00 PM)</option>
                  <option value="OUTSIDE_GEOFENCE_AUDIT">Outside-Geofence Audit Report</option>
                  <option value="LOCATION_DUTY_COMPLIANCE">Location-Wise Duty Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Date *
                </label>
                <input
                  type="date"
                  required
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duty Location Scope (Optional)
                </label>
                <select
                  value={genLocationId}
                  onChange={(e) => setGenLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                >
                  <option value="">All Permitted Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Start Generation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Timing Config */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#172B4D]">Configure Schedule Snapshot Timings</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Morning Snapshot Window Center (HH:MM)
                </label>
                <input
                  type="text"
                  required
                  placeholder="10:00"
                  value={morningTime}
                  onChange={(e) => setMorningTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default: 10:00 AM IST</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Evening Snapshot Window Center (HH:MM)
                </label>
                <input
                  type="text"
                  required
                  placeholder="18:00"
                  value={eveningTime}
                  onChange={(e) => setEveningTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default: 18:00 (6:00 PM) IST</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Grace Period Window (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  required
                  value={gracePeriod}
                  onChange={(e) => setGracePeriod(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Observations within &plusmn;{gracePeriod} min of scheduled time are classified as ON_TIME.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {savingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ScheduledReports;
