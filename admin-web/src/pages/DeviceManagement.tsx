import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Key,
  X
} from 'lucide-react';
import { DeviceRecord } from '../types';
import { api } from '../services/api';

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [approveReason, setApproveReason] = useState<string>('');
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);

  const [showReplaceModal, setShowReplaceModal] = useState<boolean>(false);
  const [replaceTargetDevice, setReplaceTargetDevice] = useState<DeviceRecord | null>(null);
  const [newDeviceId, setNewDeviceId] = useState<string>('');
  const [replaceReason, setReplaceReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDevices({
        status: selectedStatus || undefined,
        search: searchQuery || undefined
      });
      setDevices(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load registered devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleApprove = async () => {
    if (!selectedDevice) return;
    try {
      setSubmitting(true);
      setError(null);
      await api.approveDevice(selectedDevice.device_id, approveReason || undefined);
      setSuccessMsg(`Device ${selectedDevice.device_model} approved successfully.`);
      setShowApproveModal(false);
      setSelectedDevice(null);
      setApproveReason('');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve device.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetDevice || !newDeviceId || !replaceReason) {
      setError('Please provide new device ID and replacement reason.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await api.replaceDevice({
        constable_user_id: replaceTargetDevice.user_id,
        old_device_id: replaceTargetDevice.device_id,
        new_device_id: newDeviceId,
        reason: replaceReason
      });
      setSuccessMsg('Device binding replaced and approved successfully.');
      setShowReplaceModal(false);
      setReplaceTargetDevice(null);
      setNewDeviceId('');
      setReplaceReason('');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to replace device binding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#17365D] uppercase tracking-wider">
            <Smartphone className="w-4 h-4 text-[#2563EB]" />
            <span>Endpoint Hardware Security</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Registered Devices & Hardware Binding
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Strict single-device hardware binding prevents buddy punching, credential sharing, and location spoofing across all officers.
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Bound Devices</div>
          <div className="text-2xl font-bold text-[#172B4D] mt-1">{devices.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Enrolled mobile handsets</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved Active</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {devices.filter((d) => d.status === 'APPROVED').length}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Authorized for attendance recording</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending / Revoked</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {devices.filter((d) => d.status !== 'APPROVED').length}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Requires supervisor authorization</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by officer name, officer ID, or device model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          />
        </form>

        <div className="flex items-center space-x-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending Approval</option>
            <option value="REVOKED">Revoked</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-lg text-slate-500 hover:text-[#17365D] hover:bg-slate-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-4">Device Model</th>
                <th className="py-3 px-4">Device ID (Hardware Key)</th>
                <th className="py-3 px-4">OS & App Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading bound devices...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No registered devices found.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{device.officer_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {device.officer_id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{device.device_model}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Registered: {new Date(device.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {device.device_id.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">OS: {device.os_version}</div>
                        <div className="text-[10px] text-slate-400">App: {device.app_version}</div>
                      </td>
                      <td className="py-3 px-4">
                        {device.status === 'APPROVED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Approved
                          </span>
                        )}
                        {device.status === 'PENDING' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {device.status === 'REVOKED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {device.status === 'PENDING' && (
                          <button
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowApproveModal(true);
                            }}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setReplaceTargetDevice(device);
                            setShowReplaceModal(true);
                          }}
                          className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold"
                        >
                          Replace Device
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

      {/* Modal: Approve Device */}
      {showApproveModal && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-[#E2E8F0] shadow-2xl p-6">
            <h3 className="font-bold text-sm text-[#172B4D]">Approve Registered Device</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Confirm binding authorization for{' '}
              <strong className="text-slate-800">{selectedDevice.officer_name}</strong>'s device{' '}
              (<strong className="text-slate-800">{selectedDevice.device_model}</strong>).
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Approval Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Official department phone verified"
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedDevice(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Replace Device */}
      {showReplaceModal && replaceTargetDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#172B4D]">Replace Bound Device</h3>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplace} className="space-y-4 mt-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                Replacing the device will revoke current access on{' '}
                <strong>{replaceTargetDevice.device_model}</strong> and bind the officer to the new hardware token.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Device Hardware ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. android-keystore-hash or UUID"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Justification / Replacement Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lost device, official phone upgrade, device damaged"
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Authorize Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default DeviceManagement;
