import React, { useState, useEffect } from 'react';
import {
  Shield,
  MapPin,
  UserCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building,
  Calendar,
  X
} from 'lucide-react';
import { DutyAssignment, Headquarters, Officer, User } from '../types';
import { api } from '../services/api';

export const DutyAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [availableConstables, setAvailableConstables] = useState<Officer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assignLocationId, setAssignLocationId] = useState<string>('');
  const [assignStartDate, setAssignStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [assignEndDate, setAssignEndDate] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Action Modal State (Complete / Cancel)
  const [selectedAssignment, setSelectedAssignment] = useState<DutyAssignment | null>(null);
  const [actionType, setActionType] = useState<'COMPLETE' | 'CANCEL' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');

  const currentUser = api.getCurrentUser();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [assignmentsRes, facilitiesRes, availableRes] = await Promise.all([
        api.getAssignments({
          location_id: selectedLocation || undefined,
          status: selectedStatus || undefined
        }),
        api.getHeadquartersFacilities(),
        api.getAvailableConstables().catch(() => [])
      ]);
      setAssignments(assignmentsRes);
      setLocations(facilitiesRes);
      setAvailableConstables(availableRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load duty assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLocation, selectedStatus]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId || !assignLocationId || !assignStartDate) {
      setError('Please select a constable, location, and start date.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.createAssignment({
        constable_user_id: assigneeId,
        location_id: assignLocationId,
        start_date: assignStartDate,
        end_date: assignEndDate || undefined,
        notes: assignNotes || undefined
      });
      setSuccessMsg('Constable successfully assigned to duty location.');
      setShowAssignModal(false);
      setAssigneeId('');
      setAssignLocationId('');
      setAssignNotes('');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedAssignment || !actionType) return;
    try {
      setSubmitting(true);
      await api.updateAssignment(selectedAssignment.id, {
        status: actionType === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED',
        notes: actionReason ? `${selectedAssignment.notes || ''} [${actionType}: ${actionReason}]`.trim() : undefined
      });
      setSuccessMsg(`Assignment marked as ${actionType === 'COMPLETE' ? 'Completed' : 'Cancelled'}.`);
      setSelectedAssignment(null);
      setActionType(null);
      setActionReason('');
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.constable_name.toLowerCase().includes(q) ||
      a.constable_officer_id.toLowerCase().includes(q) ||
      a.location_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#17365D] uppercase tracking-wider">
            <Building className="w-4 h-4 text-[#2563EB]" />
            <span>Duty Administration</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Constable Duty Assignments
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Assign police constables to specific station headquarters or field check-posts. Only one active assignment is permitted per constable.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAssignModal(true);
            setError(null);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>New Duty Assignment</span>
        </button>
      </div>

      {/* Notifications */}
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Assignments</div>
          <div className="text-2xl font-bold text-[#172B4D] mt-1">{assignments.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Across all authorized locations</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active Deployments</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {assignments.filter(a => a.status === 'ACTIVE').length}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Currently on designated duty</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Completed Duties</div>
          <div className="text-2xl font-bold text-slate-700 mt-1">
            {assignments.filter(a => a.status === 'COMPLETED').length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Archived assignment records</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Unassigned Constables</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {availableConstables.length}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Ready for deployment</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by constable name, officer ID, or duty location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Location Filter */}
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

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table of Assignments */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Constable</th>
                <th className="py-3 px-4">Duty Location</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Assigned By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading duty assignments...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No duty assignments found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const isActive = assignment.status === 'ACTIVE';
                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{assignment.constable_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {assignment.constable_officer_id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                          <span>{assignment.location_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">
                          {assignment.start_date}
                          {assignment.end_date ? ` to ${assignment.end_date}` : ' (Ongoing)'}
                        </div>
                        {assignment.notes && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            {assignment.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {assignment.assigned_by_username}
                      </td>
                      <td className="py-3 px-4">
                        {assignment.status === 'ACTIVE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        )}
                        {assignment.status === 'COMPLETED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Completed
                          </span>
                        )}
                        {assignment.status === 'CANCELLED' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isActive && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setActionType('COMPLETE');
                              }}
                              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
                            >
                              Complete
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setActionType('CANCEL');
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {!isActive && (
                          <span className="text-[11px] text-slate-400 font-mono">Archived</span>
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

      {/* Modal: New Assignment */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#17365D]">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#172B4D]">Assign Constable to Duty Location</h3>
                  <p className="text-[11px] text-slate-400">Establish geofenced duty roster record</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Police Constable *
                </label>
                <select
                  required
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                >
                  <option value="">-- Choose available constable --</option>
                  {availableConstables.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name} ({c.officer_id}) - {c.rank}
                    </option>
                  ))}
                </select>
                {availableConstables.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    All registered constables currently have an active assignment.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duty Location / Headquarters *
                </label>
                <select
                  required
                  value={assignLocationId}
                  onChange={(e) => setAssignLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                >
                  <option value="">-- Choose location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code}) - {loc.city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={assignEndDate}
                    onChange={(e) => setAssignEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assignment Order / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Order #SP/ELR/2026/04 - Shift A Morning patrol and security check"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Action Confirmation */}
      {selectedAssignment && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-[#E2E8F0] shadow-2xl p-6">
            <h3 className="font-bold text-sm text-[#172B4D]">
              {actionType === 'COMPLETE' ? 'Complete Duty Assignment' : 'Cancel Duty Assignment'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Confirm updating duty assignment for{' '}
              <strong className="text-slate-800">{selectedAssignment.constable_name}</strong> at{' '}
              <strong className="text-slate-800">{selectedAssignment.location_name}</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason / Closing Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Transfer order, duty completed"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAssignment(null);
                  setActionType(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={submitting}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-sm transition ${
                  actionType === 'COMPLETE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Updating...' : `Confirm ${actionType === 'COMPLETE' ? 'Completion' : 'Cancellation'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DutyAssignments;
