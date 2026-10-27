import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldCheck,
  MapPin,
  Building2,
  Search,
  Plus,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
  X,
  Compass,
  ArrowRight,
  Eye,
  Check,
  RefreshCw,
  Sliders,
  Info,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Headquarters, HeadquartersCreatePayload, HeadquartersUpdatePayload, HeadquartersHistoryItem } from '../types';
import { api } from '../services/api';

// Haversine distance calculator for comparison modal
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const HeadquartersSettings: React.FC = () => {
  // Leaflet references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Data States
  const [facilities, setFacilities] = useState<Headquarters[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Headquarters | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formState, setFormState] = useState<string>('Andhra Pradesh');
  const [formDistrict, setFormDistrict] = useState<string>('Eluru');
  const [formCity, setFormCity] = useState<string>('Eluru');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formLat, setFormLat] = useState<number>(16.7107);
  const [formLng, setFormLng] = useState<number>(81.0952);
  const [formRadius, setFormRadius] = useState<number>(100);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'>('ACTIVE');
  const [formIsPrimary, setFormIsPrimary] = useState<boolean>(true);
  const [formDescription, setFormDescription] = useState<string>('');

  // Location search state (Method C)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [auditReason, setAuditReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // History Drawer State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<HeadquartersHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [formLat, formLng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Method B: Map-click location picker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const roundedLat = parseFloat(lat.toFixed(6));
      const roundedLng = parseFloat(lng.toFixed(6));
      setFormLat(roundedLat);
      setFormLng(roundedLng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fetch all headquarters facilities
  const loadFacilities = async () => {
    setLoading(true);
    try {
      const data = await api.getHeadquartersFacilities();
      setFacilities(data);

      // Select active primary headquarters by default
      const primary = data.find(f => f.is_primary && f.status === 'ACTIVE') || data[0];
      if (primary && !selectedFacility && !isCreatingNew) {
        populateForm(primary);
      }
    } catch (err: any) {
      console.error('Failed to load headquarters facilities:', err);
      // Fallback to active single endpoint
      try {
        const active = await api.getHeadquarters();
        setFacilities([active]);
        if (!selectedFacility && !isCreatingNew) {
          populateForm(active);
        }
      } catch (e) {
        console.error('Fallback failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  // Populate form with facility details
  const populateForm = (hq: Headquarters) => {
    setSelectedFacility(hq);
    setIsCreatingNew(false);
    setFormName(hq.name);
    setFormCode(hq.code);
    setFormState(hq.state || 'Andhra Pradesh');
    setFormDistrict(hq.district || 'Eluru');
    setFormCity(hq.city || 'Eluru');
    setFormAddress(hq.address);
    setFormLat(hq.latitude);
    setFormLng(hq.longitude);
    setFormRadius(hq.radius_meters || 100);
    setFormStatus(hq.status || 'ACTIVE');
    setFormIsPrimary(hq.is_primary ?? true);
    setFormDescription(hq.description || '');
    setSaveError(null);
    setSaveSuccess(false);

    // Move map
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([hq.latitude, hq.longitude], 16, { animate: true, duration: 1.0 });
    }
  };

  // Start new facility creation
  const handleStartCreateNew = () => {
    setSelectedFacility(null);
    setIsCreatingNew(true);
    setFormName('');
    setFormCode(`AP-ELR-${Math.floor(100 + Math.random() * 900)}`);
    setFormState('Andhra Pradesh');
    setFormDistrict('Eluru');
    setFormCity('Eluru');
    setFormAddress('');
    setFormLat(16.7107);
    setFormLng(81.0952);
    setFormRadius(100);
    setFormStatus('ACTIVE');
    setFormIsPrimary(false);
    setFormDescription('');
    setSaveError(null);
    setSaveSuccess(false);

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([16.7107, 81.0952], 16);
    }
  };

  // Synchronize Marker & Circular Geofence on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing layers
    if (circleRef.current) {
      map.removeLayer(circleRef.current);
    }
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Draggable custom headquarters marker pin
    const hqIcon = L.divIcon({
      className: 'hq-marker-pin',
      html: `
        <div style="
          background: #17365D;
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 3px solid #FFFFFF;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([formLat, formLng], {
      icon: hqIcon,
      draggable: true,
      autoPan: true
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px;">
        <strong style="color: #17365D;">${formName || 'Headquarters Location'}</strong><br/>
        <span style="color: #64748B;">Radius: ${formRadius}m</span><br/>
        <span style="font-size: 11px; color: #2563EB;">Drag pin or click map to move</span>
      </div>
    `);

    // Method B: Drag marker to update coordinates
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setFormLat(parseFloat(pos.lat.toFixed(6)));
      setFormLng(parseFloat(pos.lng.toFixed(6)));
    });

    markerRef.current = marker;

    // Draw authoritative Geofence circle
    const circle = L.circle([formLat, formLng], {
      color: '#17365D',
      weight: 2,
      opacity: 0.9,
      dashArray: '6, 6',
      fillColor: '#2563EB',
      fillOpacity: 0.14,
      radius: formRadius
    }).addTo(map);

    circleRef.current = circle;
  }, [formLat, formLng, formRadius, formName]);

  // Method A: Manual coordinates preview
  const handlePreviewCoordinates = () => {
    if (isNaN(formLat) || formLat < -90 || formLat > 90) {
      setSaveError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(formLng) || formLng < -180 || formLng > 180) {
      setSaveError('Longitude must be a valid number between -180 and 180.');
      return;
    }
    setSaveError(null);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([formLat, formLng], 16, { animate: true, duration: 1.0 });
    }
  };

  // Method C: Nominatim place search
  const handleSearchPlaces = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const encoded = encodeURIComponent(`${searchQuery.trim()}, Andhra Pradesh, India`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Nominatim search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: NominatimResult) => {
    const lat = parseFloat(parseFloat(result.lat).toFixed(6));
    const lng = parseFloat(parseFloat(result.lon).toFixed(6));
    setFormLat(lat);
    setFormLng(lng);
    setFormAddress(result.display_name);
    setShowSearchResults(false);
    setSearchQuery('');

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
    }
  };

  // Open Save Confirmation Dialog
  const handleInitiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    // Validation
    if (!formName.trim()) {
      setSaveError('Headquarters Name is mandatory.');
      return;
    }
    if (!formCode.trim()) {
      setSaveError('Headquarters Code is mandatory.');
      return;
    }
    if (formLat < -90 || formLat > 90 || formLng < -180 || formLng > 180) {
      setSaveError('Coordinates out of range. Latitude: -90 to 90, Longitude: -180 to 180.');
      return;
    }
    if (formRadius <= 0 || formRadius > 5000) {
      setSaveError('Geofence radius must be between 10m and 5000m.');
      return;
    }

    // If updating existing headquarters, display confirmation modal
    if (selectedFacility && !isCreatingNew) {
      setConfirmCheckbox(false);
      setAuditReason('');
      setShowConfirmModal(true);
    } else {
      // Direct create
      executeSaveFacility();
    }
  };

  // Execute Save (Create or Update)
  const executeSaveFacility = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (isCreatingNew || !selectedFacility) {
        // Create new
        const payload: HeadquartersCreatePayload = {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          state: formState.trim(),
          district: formDistrict.trim(),
          city: formCity.trim(),
          address: formAddress.trim(),
          latitude: formLat,
          longitude: formLng,
          radius_meters: formRadius,
          status: formStatus,
          is_primary: formIsPrimary,
          description: formDescription.trim() || undefined
        };
        const created = await api.createHeadquarters(payload);
        setSaveSuccess(true);
        setShowConfirmModal(false);
        await loadFacilities();
        populateForm(created);
      } else {
        // Authoritative update with audit snapshot
        const payload: HeadquartersUpdatePayload = {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          state: formState.trim(),
          district: formDistrict.trim(),
          city: formCity.trim(),
          address: formAddress.trim(),
          latitude: formLat,
          longitude: formLng,
          radius_meters: formRadius,
          status: formStatus,
          is_primary: formIsPrimary,
          description: formDescription.trim() || undefined,
          change_reason: auditReason.trim() || 'Official update to headquarters location and geofence boundary'
        };
        const updated = await api.updateHeadquarters(selectedFacility.id, payload);
        setSaveSuccess(true);
        setShowConfirmModal(false);
        await loadFacilities();
        populateForm(updated);
      }

      // Dispatch global refresh event so LiveMap and Overview update immediately
      window.dispatchEvent(new Event('policehq_headquarters_updated'));
      window.dispatchEvent(new Event('policehq_manual_refresh'));
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save headquarters configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Set primary facility action
  const handleSetPrimary = async (hqId: string) => {
    try {
      await api.setPrimaryHeadquarters(hqId);
      await loadFacilities();
      window.dispatchEvent(new Event('policehq_headquarters_updated'));
    } catch (err: any) {
      alert(`Failed to set primary headquarters: ${err.message}`);
    }
  };

  // Toggle facility status action
  const handleToggleStatus = async (hq: Headquarters) => {
    const newStatus = hq.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.updateHeadquartersStatus(hq.id, newStatus, `Status toggled to ${newStatus} by administrator`);
      await loadFacilities();
      window.dispatchEvent(new Event('policehq_headquarters_updated'));
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // View historical change log
  const handleViewHistory = async (hqId: string) => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const items = await api.getHeadquartersHistory(hqId);
      setHistoryItems(items);
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filter facilities
  const filteredFacilities = facilities.filter(f => {
    const matchesSearch =
      f.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
      f.code.toLowerCase().includes(facilitySearch.toLowerCase()) ||
      f.district.toLowerCase().includes(facilitySearch.toLowerCase()) ||
      f.address.toLowerCase().includes(facilitySearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate shift distance for confirmation modal
  const distanceShifted = selectedFacility
    ? calculateDistanceMeters(selectedFacility.latitude, selectedFacility.longitude, formLat, formLng)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
              <Building2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
              Police Facility Command
            </span>
          </div>
          <h1 className="text-xl font-black text-[#172B4D] tracking-tight">
            Headquarters & Geofence Settings
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Authoritative configuration of police headquarters locations, geographic coordinates, and operational geofence boundaries.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={loadFacilities}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          <button
            type="button"
            onClick={handleStartCreateNew}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Facility</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form (Left) & OpenStreetMap Interactive Picker (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleInitiateSave} className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#17365D]" />
                <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                  {isCreatingNew ? 'Register New Facility' : `Edit: ${formName || 'Headquarters'}`}
                </h3>
              </div>

              {selectedFacility && !isCreatingNew && (
                <button
                  type="button"
                  onClick={() => handleViewHistory(selectedFacility.id)}
                  className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#2563EB] hover:text-blue-800"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit History</span>
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Alert Feedback Messages */}
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Headquarters location and geofence updated successfully. Applied across all live maps.</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2.5 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{typeof saveError === 'string' ? saveError : (saveError as any)?.message || JSON.stringify(saveError)}</span>
                </div>
              )}

              {/* Facility Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Headquarters Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Police Headquarters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="AP-ELR-HQ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white"
                  />
                </div>
              </div>

              {/* State, District, City */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    value={formDistrict}
                    onChange={(e) => setFormDistrict(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    City / Town
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Address
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Official office street address, landmark, PIN code"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none"
                />
              </div>

              {/* Method A: Manual Coordinates Input with Preview */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#17365D] uppercase tracking-wider flex items-center space-x-1">
                    <Compass className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Geographic Coordinates</span>
                  </span>
                  <button
                    type="button"
                    onClick={handlePreviewCoordinates}
                    className="px-2.5 py-1 text-[11px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                  >
                    Preview on Map
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formLat}
                      onChange={(e) => setFormLat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formLng}
                      onChange={(e) => setFormLng(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Tip: You can also click directly on the map or drag the headquarters pin to update these coordinates.
                </p>
              </div>

              {/* Geofence Radius Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Geofence Radius
                  </label>
                  <span className="text-xs font-black text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-mono">
                    {formRadius} metres
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[50, 100, 150, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormRadius(preset)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        formRadius === preset
                          ? 'bg-[#17365D] text-white border-[#17365D] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                {/* Custom Radius Slider / Input */}
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="25"
                    max="500"
                    step="5"
                    value={formRadius}
                    onChange={(e) => setFormRadius(parseInt(e.target.value))}
                    className="flex-1 accent-[#2563EB]"
                  />
                  <div className="w-20">
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={formRadius}
                      onChange={(e) => setFormRadius(Math.max(10, parseInt(e.target.value) || 10))}
                      className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Primary Designation */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Facility Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Primary Operational HQ
                  </label>
                  <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPrimary}
                      onChange={(e) => setFormIsPrimary(e.target.checked)}
                      className="w-4 h-4 text-[#2563EB] rounded border-slate-300 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-700">Set as Primary</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Operational Notes
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notes on jurisdiction, access gates, or duty officer contact"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-[#17365D] hover:bg-[#102642] text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isCreatingNew ? 'Create & Establish Headquarters' : 'Save Location & Geofence'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: OpenStreetMap Interactive Location Picker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          {/* Method C: Place Search Input Bar */}
          <div className="relative z-20">
            <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-1.5">
              <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchPlaces();
                  }
                }}
                placeholder="Method C: Search place name or address (e.g. Eluru SP Office, Sanivarapupeta)..."
                className="w-full px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 mr-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSearchPlaces}
                disabled={isSearching}
                className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shrink-0 flex items-center space-x-1"
              >
                {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Search</span>}
              </button>
            </div>

            {/* Nominatim Search Dropdown Results */}
            {showSearchResults && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 z-50">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {isSearching ? 'Querying OpenStreetMap Nominatim...' : 'No matching locations found. Try manual coordinates or map click.'}
                  </div>
                ) : (
                  searchResults.map((res) => (
                    <button
                      key={res.place_id}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-start space-x-2 transition"
                    >
                      <MapPin className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-1">{res.display_name}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Lat: {parseFloat(res.lat).toFixed(5)}, Lng: {parseFloat(res.lon).toFixed(5)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="relative flex-1 min-h-[460px] bg-slate-100 border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
            <div ref={mapContainerRef} className="w-full h-full min-h-[460px] z-10" />

            {/* Map Floating HUD Badges */}
            <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-xl px-3 py-2 shadow-md text-xs space-y-1">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-[#17365D]">Interactive OpenStreetMap</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600">
                Lat: {formLat.toFixed(6)} | Lng: {formLng.toFixed(6)}
              </div>
              <div className="text-[11px] font-semibold text-[#2563EB]">
                Geofence: {formRadius}m radius
              </div>
            </div>

            {/* Selection Methods Legend in bottom-left */}
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-xl px-3 py-2 shadow-md text-[11px] text-slate-600 space-y-1">
              <span className="font-bold text-[#172B4D] block uppercase tracking-wider text-[10px]">3 Selection Methods:</span>
              <div><strong className="text-slate-800">Method A:</strong> Enter Lat/Lng and click Preview</div>
              <div><strong className="text-slate-800">Method B:</strong> Click map or drag the shield marker</div>
              <div><strong className="text-slate-800">Method C:</strong> Search address/place bar above</div>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple Headquarters Facilities Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#172B4D]">
              Registered Police Headquarters & Facilities
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Multi-facility governance: {facilities.length} location{facilities.length !== 1 ? 's' : ''} on record. Exactly one primary headquarters dictates mobile attendance geofencing.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Search facilities..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3">Facility Name & Code</th>
                <th className="px-4 py-3">District / City</th>
                <th className="px-4 py-3">Coordinates</th>
                <th className="px-4 py-3">Geofence Radius</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No headquarters facilities matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((f) => {
                  const isCurrentSelected = selectedFacility?.id === f.id;
                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-slate-50/80 transition ${isCurrentSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-[#172B4D] flex items-center space-x-1.5">
                          <span>{f.name}</span>
                          {f.is_primary && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[9px] uppercase tracking-wider">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Code: {f.code}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700">
                        <div>{f.district}, {f.city}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{f.address}</div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-600 text-[11px]">
                        {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}
                      </td>

                      <td className="px-4 py-3.5 font-bold text-[#2563EB]">
                        {f.radius_meters}m
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            f.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : f.status === 'MAINTENANCE'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {f.is_primary ? (
                          <span className="text-[11px] font-bold text-amber-600 flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Primary HQ</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(f.id)}
                            className="text-[10px] font-bold text-slate-500 hover:text-[#2563EB] underline"
                          >
                            Set as Primary
                          </button>
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => populateForm(f)}
                          className="px-2.5 py-1 text-xs font-bold text-[#17365D] bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(f)}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition ${
                            f.status === 'ACTIVE'
                              ? 'text-rose-700 hover:bg-rose-50 border-rose-200'
                              : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {f.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      {/* Confirmation Modal — Section 6 Requirement */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-100" />
                <h3 className="font-bold text-sm">Change Headquarters Location?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-amber-100 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>Attention:</strong> Changing this location will affect future geofence calculations and attendance decisions. Existing attendance and visit records will be preserved in historical logs.
              </div>

              {/* Comparison Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 p-2.5 font-bold text-slate-600 text-[11px] uppercase tracking-wider">
                  <div>Previous Configuration</div>
                  <div className="text-blue-700">New Configuration</div>
                </div>

                <div className="p-3 space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Address</span>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <span className="text-slate-600 text-[11px] line-clamp-2">{selectedFacility?.address || 'N/A'}</span>
                      <span className="text-slate-800 font-semibold text-[11px] line-clamp-2">{formAddress || 'N/A'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Coordinates</span>
                    <div className="grid grid-cols-2 gap-2 mt-0.5 font-mono text-[11px]">
                      <span className="text-slate-600">
                        {selectedFacility?.latitude.toFixed(5)}, {selectedFacility?.longitude.toFixed(5)}
                      </span>
                      <span className="text-[#2563EB] font-bold">
                        {formLat.toFixed(5)}, {formLng.toFixed(5)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Geofence Radius</span>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <span className="text-slate-600 font-semibold">{selectedFacility?.radius_meters}m</span>
                      <span className="text-[#2563EB] font-bold">{formRadius}m</span>
                    </div>
                  </div>

                  {distanceShifted > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Center Shift Distance:</span>
                      <span className="font-bold font-mono text-amber-700">~{distanceShifted} metres</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Location Change *
                </label>
                <input
                  type="text"
                  required
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. Relocated to newly inaugurated District Police Office complex"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start space-x-2.5 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheckbox}
                  onChange={(e) => setConfirmCheckbox(e.target.checked)}
                  className="w-4 h-4 text-[#2563EB] rounded border-slate-300 mt-0.5"
                />
                <span className="text-xs text-slate-700 font-medium leading-tight">
                  I understand that this updates official police attendance geofencing boundaries and will be logged in the permanent audit trail.
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmCheckbox || !auditReason.trim() || saving}
                onClick={executeSaveFacility}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Apply Location</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Drawer / Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#17365D]" />
                <h3 className="font-bold text-sm text-[#172B4D]">
                  Location & Geofence Change Log: {selectedFacility?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                  <span>Loading audit log...</span>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No historical changes recorded for this headquarters facility.
                </div>
              ) : (
                historyItems.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#17365D] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[10px]">
                        Version {item.version}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>

                    <div className="text-slate-700 font-semibold">{item.change_reason}</div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-slate-100">
                      <div>Coordinates: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</div>
                      <div>Radius: {item.radius_meters}m</div>
                      <div className="col-span-2 text-slate-500 font-sans text-[10px]">
                        Author: {item.changed_by}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
