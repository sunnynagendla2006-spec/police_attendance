import React, { useState, useEffect, useMemo } from 'react';
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
  Filter,
  Download,
  Building,
  RefreshCw,
  BadgeCheck,
  Phone,
  FileText,
  ShieldAlert,
  Smartphone,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Layers,
  Database
} from 'lucide-react';
import { Officer, AttendanceVisit, Headquarters, DesignationSummary, StaffImportResult } from '../types';
import { api } from '../services/api';

interface Props {
  onNavigateToMap?: (officerId?: string) => void;
}

const CADRES = [
  { key: 'AO', label: 'AO', full: 'Administrative Officer', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', dot: 'bg-purple-500' },
  { key: 'Office Supdt', label: 'Office Supdt', full: 'Office Superintendent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', dot: 'bg-indigo-500' },
  { key: 'Sr.Asst', label: 'Sr.Asst', full: 'Senior Assistant', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', dot: 'bg-blue-500' },
  { key: 'Jr.Asst', label: 'Jr.Asst', full: 'Junior Assistant', color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100', dot: 'bg-sky-500' },
  { key: 'Record Asst', label: 'Record Asst', full: 'Record Assistant', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  { key: 'Attender', label: 'Attender', full: 'Office Attender', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', dot: 'bg-amber-500' },
  { key: 'Dhobhi', label: 'Dhobhi', full: 'Support Services / Dhobhi', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', dot: 'bg-teal-500' },
  { key: 'OS', label: 'OS', full: 'Office Subordinate', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', dot: 'bg-orange-500' },
];

export const PoliceDirectory: React.FC<Props> = ({ onNavigateToMap }) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [designationSummary, setDesignationSummary] = useState<DesignationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Detail Modal
  const [viewOfficer, setViewOfficer] = useState<Officer | null>(null);
  const [officerVisits, setOfficerVisits] = useState<AttendanceVisit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Reassign Modal
  const [reassignOfficer, setReassignOfficer] = useState<Officer | null>(null);
  const [reassignLocationId, setReassignLocationId] = useState('');
  const [reassignDutyTitle, setReassignDutyTitle] = useState('Staff Duty');
  const [reassignNotes, setReassignNotes] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignSuccess, setReassignSuccess] = useState<string | null>(null);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<StaffImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Register Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formBadgeId, setFormBadgeId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRank, setFormRank] = useState('Jr.Asst');
  const [formDesignation, setFormDesignation] = useState('Jr.Asst');
  const [formGender, setFormGender] = useState('M');
  const [formCfmsId, setFormCfmsId] = useState('');
  const [formGNo, setFormGNo] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formDepartment, setFormDepartment] = useState('District Police Office, Eluru');
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

  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      const sum = await api.getDesignationSummary();
      setDesignationSummary(sum);
    } catch (e) {
      console.warn('Failed to fetch designation summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const locs = await api.getHeadquartersFacilities();
      setLocations(locs || []);
    } catch (e) {
      console.warn('Failed to fetch facilities:', e);
    }
  };

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const data = await api.getOfficers(
        searchQuery || undefined,
        departmentFilter || undefined,
        undefined, // rank
        designationFilter || undefined,
        assignmentStatusFilter || undefined,
        locationFilter || undefined,
        statusFilter || undefined
      );
      setOfficers(data);
    } catch (e) {
      console.error('Error fetching police directory:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [departmentFilter, designationFilter, locationFilter, assignmentStatusFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchDirectory();
  };

  const handleCadrePillClick = (key: string) => {
    if (designationFilter === key) {
      setDesignationFilter('');
    } else {
      setDesignationFilter(key);
    }
    setCurrentPage(1);
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

  const handleOpenReassign = (officer: Officer) => {
    setReassignOfficer(officer);
    setReassignLocationId(officer.duty_location_id || (locations[0]?.id || ''));
    setReassignDutyTitle(`${officer.designation || officer.rank || 'Staff'} Duty`);
    setReassignNotes('');
    setReassignError(null);
    setReassignSuccess(null);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignOfficer || !reassignLocationId) return;
    setReassigning(true);
    setReassignError(null);
    try {
      await api.createAssignment({
        constable_user_id: reassignOfficer.user_id,
        officer_id: reassignOfficer.officer_id,
        location_id: reassignLocationId,
        duty_title: reassignDutyTitle,
        notes: reassignNotes
      });
      setReassignSuccess('Duty location successfully reassigned.');
      await fetchDirectory();
      await fetchSummary();
      setTimeout(() => {
        setReassignOfficer(null);
        setReassignSuccess(null);
      }, 1500);
    } catch (err: any) {
      setReassignError(err.message || 'Failed to reassign duty location.');
    } finally {
      setReassigning(false);
    }
  };

  const handleTriggerImport = async () => {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await api.importEluruStaff();
      setImportResult(res);
      await fetchDirectory();
      await fetchSummary();
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Check server logs.');
    } finally {
      setImporting(false);
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
      await fetchSummary();
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
      setResetMessage(`Password reset to 4-digit temporary mobile digits for ${resetOfficer.username}.`);
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

  const departments = useMemo(() => {
    return Array.from(new Set(officers.map(o => o.department))).filter(Boolean);
  }, [officers]);

  const totalPages = Math.ceil(officers.length / itemsPerPage) || 1;
  const paginatedOfficers = officers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#17365D] via-[#1E4373] to-[#2563EB] p-6 rounded-2xl shadow-md text-white">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Users className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Eluru District Personnel & Police Directory</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-400 text-[#17365D] rounded-full">
                  District DPO
                </span>
              </h2>
              <p className="text-xs text-blue-100/80 mt-0.5">
                Official staff registry, cadre designations, CFMS identifiers & Eluru headquarters duty deployments
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setImportResult(null);
              setImportError(null);
              setShowImportModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 text-xs font-bold rounded-xl shadow-sm flex items-center space-x-2 transition shrink-0 transform hover:-translate-y-0.5"
          >
            <Database className="w-4 h-4 text-slate-900" />
            <span>Import Eluru Staff Data</span>
          </button>

          <button
            onClick={() => {
              setRegisterError(null);
              setShowRegisterModal(true);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl backdrop-blur-sm flex items-center space-x-2 transition shrink-0"
          >
            <UserPlus className="w-4 h-4 text-blue-200" />
            <span>Register Personnel</span>
          </button>

          <button
            onClick={() => {
              fetchDirectory();
              fetchSummary();
            }}
            className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cadre Designation Summary Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#17365D]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cadre Designation Breakdown (Database Verified)
            </h3>
          </div>
          <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
            <span>Total Cadre Staff:</span>
            <span className="font-bold font-mono text-[#17365D] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {designationSummary?.total_staff ?? 35}
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600 font-semibold">
              Assigned: {designationSummary?.assigned_count ?? 35}
            </span>
          </div>
        </div>

        {/* Cadre Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {CADRES.map(cadre => {
            const count = designationSummary?.counts[cadre.key] ?? 0;
            const isSelected = designationFilter === cadre.key;
            return (
              <button
                key={cadre.key}
                onClick={() => handleCadrePillClick(cadre.key)}
                className={`p-2.5 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 ring-[#2563EB] border-transparent shadow-sm bg-blue-50/80'
                    : cadre.color
                }`}
                title={`Filter by ${cadre.full}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold tracking-tight truncate">
                    {cadre.label}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${cadre.dot}`} />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-extrabold font-mono">
                    {count}
                  </span>
                  <span className="text-[9px] uppercase font-bold opacity-70">
                    Staff
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {designationFilter && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-600 text-[11px]">
              Filtered by cadre: <strong className="text-[#17365D] font-bold">{designationFilter}</strong>
            </span>
            <button
              onClick={() => {
                setDesignationFilter('');
                setCurrentPage(1);
              }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Clear cadre filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, CFMS ID, G.No, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Designation Dropdown */}
          <select
            value={designationFilter}
            onChange={(e) => {
              setDesignationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Cadre Designations</option>
            {CADRES.map(c => (
              <option key={c.key} value={c.key}>{c.label} - {c.full}</option>
            ))}
            <option value="Superintendent of Police">Superintendent of Police</option>
            <option value="Inspector of Police">Inspector of Police</option>
            <option value="Police Constable">Police Constable</option>
          </select>

          {/* Location Dropdown */}
          <select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Duty Locations</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>

          {/* Assignment Status Dropdown */}
          <select
            value={assignmentStatusFilter}
            onChange={(e) => {
              setAssignmentStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Assignment Statuses</option>
            <option value="ACTIVE">Active Deployment Only</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            <option value="COMPLETED">Completed / Archived</option>
          </select>

          {/* Account Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Account Statuses</option>
            <option value="ACTIVE">Active Accounts</option>
            <option value="INACTIVE">Inactive Accounts</option>
          </select>

          {(searchQuery || designationFilter || locationFilter || assignmentStatusFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDesignationFilter('');
                setLocationFilter('');
                setAssignmentStatusFilter('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">CFMS ID</th>
                <th className="py-3 px-4">G.No.</th>
                <th className="py-3 px-4">Duty Location</th>
                <th className="py-3 px-4">Assignment Status</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#17365D]" />
                      <p className="text-xs font-medium text-slate-600">Loading district staff records from MongoDB...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedOfficers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No personnel records found matching filters.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try clearing filters or click "Import Eluru Staff Data" above.</p>
                  </td>
                </tr>
              ) : (
                paginatedOfficers.map(o => {
                  const cadreConfig = CADRES.find(c => c.key === (o.designation || o.rank));
                  const isStaff = o.role === 'staff';
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition">
                      {/* Name & Gender */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border ${
                            o.gender === 'F'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {o.gender || 'M'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{o.full_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span>@{o.username}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] font-medium text-slate-500">{o.mobile_number}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${
                          cadreConfig
                            ? cadreConfig.color
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cadreConfig?.dot || 'bg-slate-400'}`} />
                          {o.designation || o.rank}
                        </span>
                      </td>

                      {/* CFMS ID */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {o.cfms_id ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200 text-[#17365D]">
                            {o.cfms_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* G.No */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {o.g_no ? (
                          <span className="bg-slate-50 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {o.g_no}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Duty Location */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium truncate max-w-[190px]" title={o.duty_location_name || 'Eluru District Police Headquarters'}>
                            {o.duty_location_name || 'Eluru District Police Headquarters'}
                          </span>
                        </div>
                      </td>

                      {/* Assignment Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                          o.assignment_status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {o.assignment_status === 'ACTIVE' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {o.assignment_status || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          o.account_status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {o.account_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenDetail(o)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition"
                            title="View Staff Profile"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                          </button>

                          <button
                            onClick={() => handleOpenReassign(o)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition"
                            title="Manage Duty Location Assignment"
                          >
                            <Building className="w-3.5 h-3.5" />
                          </button>

                          {onNavigateToMap && (
                            <button
                              onClick={() => onNavigateToMap(o.officer_id)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 transition"
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
                            }}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition"
                            title="Reset Password to Mobile Last 4"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeactivateOfficerTarget(o)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition"
                            title="Deactivate Account"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{paginatedOfficers.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{officers.length}</span> personnel
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded font-medium disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Previous
            </button>
            <span className="px-3 py-1 font-medium text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded font-medium disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#17365D] to-[#2563EB] p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm">Import Eluru District Staff Data</h3>
                  <p className="text-[11px] text-blue-100">
                    Safe direct import of 35 verified district personnel into PoliceHQ GeoAttend
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Requirements & Target Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-blue-900">
                <div className="flex items-center space-x-2 font-bold text-xs text-[#17365D]">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Target Duty Location: Eluru District Police Headquarters</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Imports all 35 district staff with their exact names, gender, cadre designation, CFMS ID (when available), G.No. (when available), and 10-digit mobile number.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-900/90 pt-1">
                  <div>• Assigns basic <strong>staff</strong> application role</div>
                  <div>• Preserves existing accounts and passwords</div>
                  <div>• Idempotent: 0 duplicates on rerun</div>
                  <div>• Location tracking disabled by default</div>
                </div>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="text-xs">{importError}</span>
                </div>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-xs text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Import Batch Completed Successfully!</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <div className="text-slate-500">Evaluated</div>
                        <div className="font-bold text-sm text-slate-800">{importResult.total_records}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <div className="text-slate-500">New Created</div>
                        <div className="font-bold text-sm text-emerald-600">{importResult.created_records}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <div className="text-slate-500">Matched Existing</div>
                        <div className="font-bold text-sm text-blue-600">{importResult.matched_existing_records}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <div className="text-slate-500">Duty Assigned</div>
                        <div className="font-bold text-sm text-purple-600">
                          {importResult.duty_assignments_created + importResult.duty_assignments_existing}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cadre Counts */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="font-bold text-[11px] text-slate-700 mb-2">Verified Cadre Statistics in DB:</div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      {Object.entries(importResult.designation_summary).map(([desig, count]) => (
                        <div key={desig} className="bg-white px-2 py-1 rounded border border-slate-200 flex justify-between">
                          <span className="text-slate-600">{desig}:</span>
                          <span className="font-bold font-mono text-[#17365D]">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {importResult ? `Batch ID: ${importResult.import_batch_id}` : 'Embedded Python Dataset (35 records)'}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition font-medium"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleTriggerImport}
                  disabled={importing}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white rounded-xl font-bold flex items-center space-x-2 transition disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} />
                  <span>{importing ? 'Importing Staff...' : importResult ? 'Re-run Safe Import' : 'Run Safe Import Now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN DUTY MODAL */}
      {reassignOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#17365D] to-[#2563EB] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Duty Location Assignment</h3>
              </div>
              <button
                onClick={() => setReassignOfficer(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-slate-800 text-sm">{reassignOfficer.full_name}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID: {reassignOfficer.officer_id} • Cadre: {reassignOfficer.designation || reassignOfficer.rank}
                </div>
                <div className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Current Location: {reassignOfficer.duty_location_name || 'Eluru District Police Headquarters'}</span>
                </div>
              </div>

              {reassignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{reassignError}</span>
                </div>
              )}

              {reassignSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{reassignSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Target Duty Location</label>
                <select
                  value={reassignLocationId}
                  onChange={(e) => setReassignLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  required
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.district || 'AP'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Duty Assignment Title</label>
                <input
                  type="text"
                  value={reassignDutyTitle}
                  onChange={(e) => setReassignDutyTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Administrative Notes / Justification</label>
                <textarea
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="Reason for deployment update..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReassignOfficer(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white rounded-xl font-bold flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
                >
                  {reassigning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Building className="w-3.5 h-3.5" />}
                  <span>{reassigning ? 'Assigning...' : 'Confirm Assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {viewOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-[#17365D] to-[#2563EB] p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  viewOfficer.gender === 'F' ? 'bg-rose-400 text-white' : 'bg-blue-400 text-white'
                }`}>
                  {viewOfficer.gender || 'M'}
                </div>
                <div>
                  <h3 className="font-bold text-base">{viewOfficer.full_name}</h3>
                  <p className="text-xs text-blue-100 font-mono">
                    ID: {viewOfficer.officer_id} • @{viewOfficer.username}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewOfficer(null)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Cadre Designation</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {viewOfficer.designation || viewOfficer.rank}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">CFMS Identification</div>
                  <div className="font-bold text-[#17365D] font-mono text-sm mt-0.5">
                    {viewOfficer.cfms_id || 'Not Assigned / Missing'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">G.No. (Government Number)</div>
                  <div className="font-bold text-slate-800 font-mono text-sm mt-0.5">
                    {viewOfficer.g_no || 'Not Assigned'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Registered Mobile</div>
                  <div className="font-bold text-slate-800 font-mono text-sm mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>{viewOfficer.mobile_number}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Duty Location Deployment</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>{viewOfficer.duty_location_name || 'Eluru District Police Headquarters'}</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {viewOfficer.assignment_status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Privacy and Tracking Security Disclosure */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                  <Shield className="w-4 h-4 text-[#17365D]" />
                  <span>Security & Privacy Controls</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                  <div>
                    Application Role: <strong className="text-slate-800 uppercase">{viewOfficer.role || 'staff'}</strong>
                  </div>
                  <div>
                    Account Status: <strong className="text-emerald-700">{viewOfficer.account_status}</strong>
                  </div>
                  <div>
                    Location Tracking: <span className="text-slate-500 font-medium">Disabled by Default</span>
                  </div>
                  <div>
                    App Usage Collection: <span className="text-slate-500 font-medium">Disabled by Default</span>
                  </div>
                </div>
              </div>

              {/* Recent Visits Preview */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2">Recent Headquarters Attendance Activity</h4>
                {loadingVisits ? (
                  <div className="py-6 text-center text-slate-400">Loading visit logs...</div>
                ) : officerVisits.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    No visit entries recorded yet for this staff profile.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {officerVisits.map(v => (
                      <div key={v.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">
                            {new Date(v.entry_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(v.entry_at).toLocaleTimeString()} - {v.exit_at ? new Date(v.exit_at).toLocaleTimeString() : 'In Progress'}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.visit_status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {v.visit_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewOfficer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER PERSONNEL MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#17365D] to-[#2563EB] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Register New District Staff</h3>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-3 text-xs">
              {registerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{registerError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="e.g. B.SUVARCHALA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Login Username</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="e.g. cfms_14089198"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Personnel ID / CFMS</label>
                  <input
                    type="text"
                    value={formBadgeId}
                    onChange={(e) => setFormBadgeId(e.target.value)}
                    placeholder="e.g. 14089198"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Cadre Designation</label>
                  <select
                    value={formRank}
                    onChange={(e) => setFormRank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  >
                    {CADRES.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                    <option value="Police Constable">Police Constable</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Mobile Number (10 Digits)</label>
                  <input
                    type="text"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="9492920274"
                    maxLength={10}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Department / Office</label>
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                Temporary password will be set automatically to the last 4 digits of the registered mobile number.
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white rounded-xl font-bold flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
                >
                  {registering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{registering ? 'Registering...' : 'Register Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {resetOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-xs">Reset Personnel Password</h3>
              </div>
              <button
                onClick={() => setResetOfficer(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetSubmit} className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-semibold text-slate-800">{resetOfficer.full_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">@{resetOfficer.username}</div>
              </div>

              {resetError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {resetError}
                </div>
              )}

              {resetMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs">
                  {resetMessage}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Administrative Reason</label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="e.g. Employee forgot initial credentials"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetOfficer(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-3 py-1.5 bg-[#17365D] hover:bg-[#102642] text-white rounded-lg font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
                >
                  {resetting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{resetting ? 'Resetting...' : 'Confirm Reset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {deactivateOfficerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <UserX className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm text-slate-900">Deactivate Personnel Account?</h3>
              <p className="text-slate-500 text-[11px]">
                Are you sure you want to deactivate{' '}
                <strong className="text-slate-800">{deactivateOfficerTarget.full_name}</strong>? They will be prevented from logging in.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivateOfficerTarget(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={deactivating}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition disabled:opacity-50 shadow-sm"
              >
                {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
