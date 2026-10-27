import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  UserPlus,
  Briefcase
} from 'lucide-react';
import { DutyAssignment, Headquarters, Officer } from '../types';
import { api } from '../services/api';

export const DutyAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [allOfficers, setAllOfficers] = useState<Officer[]>([]);
  const [availableConstables, setAvailableConstables] = useState<Officer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for New / Reassign Duty
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assignLocationId, setAssignLocationId] = useState<string>('');
  const [assignDutyTitle, setAssignDutyTitle] = useState<string>('General Duty');
  const [assignDutyDesc, setAssignDutyDesc] = useState<string>('');
  const [assignStartDate, setAssignStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [assignEndDate, setAssignEndDate] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [constableFilterQuery, setConstableFilterQuery] = useState<string>('');

  // Action Modal State (Complete / Cancel)
  const [selectedAssignment, setSelectedAssignment] = useState<DutyAssignment | null>(null);
  const [actionType, setActionType] = useState<'COMPLETE' | 'CANCEL' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');

  const currentUser = api.getCurrentUser();

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [assignmentsRes, facilitiesRes, availableRes, officersRes] = await Promise.all([
        api.getAssignments({
          location_id: selectedLocation || undefined,
          status: selectedStatus || undefined
        }),
        api.getHeadquartersFacilities(),
        api.getAvailableConstables().catch(() => []),
        api.getOfficers().catch(() => [])
      ]);
      setAssignments(assignmentsRes || []);
      setLocations(facilitiesRes || []);
      setAvailableConstables(availableRes || []);
      setAllOfficers(officersRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load duty assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLocation, selectedStatus]);

  // Map of which constables currently have an active assignment
  const activeAssignmentMap = useMemo(() => {
    const map = new Map<string, DutyAssignment>();
    assignments.forEach(a => {
      if (a.status === 'ACTIVE') {
        const uid = a.user_id || a.constable_user_id;
        if (uid) map.set(uid, a);
      }
    });
    return map;
  }, [assignments]);

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
        duty_title: assignDutyTitle || 'General Duty',
        duty_description: assignDutyDesc || undefined,
        start_date: assignStartDate,
        end_date: assignEndDate || undefined,
        notes: assignNotes || undefined
      });
      setSuccessMsg('Constable successfully assigned to duty location.');
      setShowAssignModal(false);
      setAssigneeId('');
      setAssignLocationId('');
      setAssignDutyTitle('General Duty');
      setAssignDutyDesc('');
      setAssignNotes('');
      setConstableFilterQuery('');
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
    const name = (a.full_name || a.constable_name || '').toLowerCase();
    const oid = (a.officer_id || a.constable_officer_id || '').toLowerCase();
    const loc = (a.location_name || '').toLowerCase();
    const title = (a.duty_title || '').toLowerCase();
    return name.includes(q) || oid.includes(q) || loc.includes(q) || title.includes(q);
  });

  // Filter constables in modal
  const selectableOfficers = useMemo(() => {
    return allOfficers.filter(o => {
      if (!constableFilterQuery.trim()) return true;
      const q = constableFilterQuery.toLowerCase();
      return (
        o.full_name.toLowerCase().includes(q) ||
        o.officer_id.toLowerCase().includes(q) ||
        o.rank.toLowerCase().includes(q)
      );
    });
  }, [allOfficers, constableFilterQuery]);

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
          <p className="text-xs text-slate-500 mt-1">
            Assign registered constables to authorized duty locations and establish authoritative geofenced posts.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAssignModal(true);
            setError(null);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#17365D] hover:bg-[#1E4273] text-white text-xs font-bold rounded-lg shadow-sm transition"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>New Duty Assignment</span>
        </button>
      </div>

      {/* Error & Success Alerts */}
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
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Total Registered Officers</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {allOfficers.length}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Available for duty management</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by constable name, officer ID, duty post, or duty title..."
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
                <th className="py-3 px-4">Duty Title</th>
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading duty assignments...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No duty assignments found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const isActive = assignment.status === 'ACTIVE';
                  const constableName = assignment.full_name || assignment.constable_name || 'Officer';
                  const constableId = assignment.officer_id || assignment.constable_officer_id || 'UNKNOWN';
                  const startDateStr = assignment.start_date || (assignment.start_time ? assignment.start_time.split('T')[0] : '');
                  const endDateStr = assignment.end_date || (assignment.end_time ? assignment.end_time.split('T')[0] : null);

                  return (
                    <tr key={assignment.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{constableName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {constableId} • {assignment.rank || 'Constable'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{assignment.duty_title || 'General Duty'}</div>
                        {(assignment.duty_description || assignment.notes) && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-xs" title={assignment.duty_description || assignment.notes || ''}>
                            {assignment.duty_description || assignment.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                          <span>{assignment.location_name}</span>
                        </div>
                        {assignment.location_code && (
                          <div className="text-[10px] text-slate-400 font-mono">{assignment.location_code}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">
                          {startDateStr}
                          {endDateStr ? ` to ${endDateStr}` : ' (Ongoing)'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {assignment.assigned_by_username || 'Admin'}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Assignment / Reassignment */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-blue-50 text-[#17365D]">
                  <Building className="w-5 h-5 text-[#2563EB]" />
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
                <input
                  type="text"
                  placeholder="Filter constables by name or badge ID..."
                  value={constableFilterQuery}
                  onChange={(e) => setConstableFilterQuery(e.target.value)}
                  className="w-full px-3 py-1.5 mb-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <select
                  required
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                >
                  <option value="">-- Choose registered constable --</option>
                  {selectableOfficers.map((c) => {
                    const activeAsgn = activeAssignmentMap.get(c.user_id);
                    return (
                      <option key={c.user_id} value={c.user_id}>
                        {c.full_name} ({c.officer_id}) - {c.rank}
                        {activeAsgn ? ` [Currently: ${activeAsgn.location_name} - Reassigns duty]` : ' [Unassigned]'}
                      </option>
                    );
                  })}
                </select>
                {activeAssignmentMap.has(assigneeId) && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-md mt-1.5 border border-amber-200">
                    ℹ️ Constable already has an active duty assignment at <strong>{activeAssignmentMap.get(assigneeId)?.location_name}</strong>. Reassigning will complete the previous duty and archive its history.
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
                  <option value="">-- Choose authorized duty location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code}) - Radius: {loc.radius_meters}m {loc.is_primary ? '★ Primary HQ' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duty Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Gate Security, Patrol"
                    value={assignDutyTitle}
                    onChange={(e) => setAssignDutyTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
                  />
                </div>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Duty Description / Operational Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Order #SP/ELR/2026/04 - Shift A Morning patrol and perimeter security check"
                  value={assignDutyDesc}
                  onChange={(e) => setAssignDutyDesc(e.target.value)}
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
              <strong className="text-slate-800">{selectedAssignment.full_name || selectedAssignment.constable_name}</strong> at{' '}
              <strong className="text-slate-800">{selectedAssignment.location_name}</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason / Closing Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Shift relieved by Officer X"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setSelectedAssignment(null);
                  setActionType(null);
                  setActionReason('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={submitting}
                className={`px-3 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm ${
                  actionType === 'COMPLETE' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Saving...' : actionType === 'COMPLETE' ? 'Confirm Complete' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
