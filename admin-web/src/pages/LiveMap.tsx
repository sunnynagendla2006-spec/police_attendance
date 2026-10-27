import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Search,
  Crosshair,
  Filter,
  Shield,
  Clock,
  Radio,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
  Users,
  Compass,
  CheckCircle2,
  ChevronRight,
  X
} from 'lucide-react';
import { LiveOfficerLocation, GeofenceConfig, Headquarters } from '../types';
import { api } from '../services/api';

interface Props {
  targetOfficerId?: string;
}

export const LiveMap: React.FC<Props> = ({ targetOfficerId }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const hqMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [officers, setOfficers] = useState<LiveOfficerLocation[]>([]);
  const [geofence, setGeofence] = useState<GeofenceConfig | null>(null);
  const [hq, setHq] = useState<Headquarters | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [selectedOfficer, setSelectedOfficer] = useState<LiveOfficerLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Helper: create SVG icon for markers
  const createOfficerIcon = (state: string, isStale: boolean) => {
    let color = '#2563EB'; // outside default blue
    let label = 'OUT';

    if (state === 'INSIDE') {
      color = '#15803D'; // emerald
      label = 'HQ';
    } else if (isStale || state === 'LOCATION_STALE') {
      color = '#B45309'; // amber
      label = 'STL';
    } else if (state === 'UNKNOWN' || state === 'OFFLINE') {
      color = '#64748B'; // slate
      label = 'OFF';
    }

    return L.divIcon({
      className: 'custom-officer-pin',
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 10px;
          letter-spacing: -0.5px;
          cursor: pointer;
        ">
          ${label}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  };

  const createHqIcon = () => {
    return L.divIcon({
      className: 'custom-hq-pin',
      html: `
        <div style="
          background-color: #17365D;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 3px solid #ffffff;
          box-shadow: 0 6px 16px rgba(23, 54, 93, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #F59E0B;
          font-weight: 900;
          font-size: 18px;
          cursor: pointer;
        ">
          ★
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22]
    });
  };

  const initialCenteredRef = useRef<boolean>(false);

  // Initialize Leaflet Map with OpenStreetMap Standard Tile Layer
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultLat = hq?.latitude || 16.7107;
    const defaultLng = hq?.longitude || 81.0952;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: false
    });

    // Zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Standard OpenStreetMap Tile Layer with obligatory attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fetch Headquarters, Geofence, and Officer Locations
  const loadData = async () => {
    try {
      const [hqData, geoData, locData] = await Promise.all([
        api.getHeadquarters(),
        api.getGeofenceConfig(),
        api.getLiveLocations()
      ]);
      setHq(hqData);
      setGeofence(geoData);
      setOfficers(locData);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // If target officer passed, select them and fly
      if (targetOfficerId) {
        const found = locData.find(o => o.officer_id === targetOfficerId);
        if (found) {
          setSelectedOfficer(found);
          if (mapInstanceRef.current && found.latitude != null && found.longitude != null) {
            mapInstanceRef.current.flyTo([found.latitude, found.longitude], 17, { animate: true, duration: 1.0 });
          }
        }
      } else if (!initialCenteredRef.current) {
        // Auto-fit to active officers + HQ if available
        const activePoints = locData.filter(o => o.latitude != null && o.longitude != null);
        if (activePoints.length > 0 && mapInstanceRef.current) {
          const points: [number, number][] = [];
          if (hqData?.latitude && hqData?.longitude) points.push([hqData.latitude, hqData.longitude]);
          activePoints.forEach(o => points.push([o.latitude!, o.longitude!]));
          if (points.length > 1) {
            mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16 });
          } else if (points.length === 1) {
            mapInstanceRef.current.flyTo(points[0], 16, { animate: true, duration: 1.0 });
          }
          initialCenteredRef.current = true;
        } else if (hqData?.latitude && hqData?.longitude && mapInstanceRef.current) {
          mapInstanceRef.current.setView([hqData.latitude, hqData.longitude], 16);
          initialCenteredRef.current = true;
        }
      }
    } catch (e) {
      console.error('Error loading live map data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time events
    const handleLocationUpdate = (e: any) => {
      const updated = e.detail;
      setOfficers(prev => {
        const idx = prev.findIndex(o => o.user_id === updated.user_id || o.officer_id === updated.officer_id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            latitude: updated.latitude,
            longitude: updated.longitude,
            accuracy_meters: updated.accuracy_meters,
            current_state: updated.current_state,
            distance_from_hq_meters: updated.distance_from_hq_meters,
            observed_at: updated.observed_at,
            is_stale: updated.is_stale
          };
          return next;
        }
        return [...prev, updated];
      });

      setSelectedOfficer(prev => {
        if (prev && (prev.user_id === updated.user_id || prev.officer_id === updated.officer_id)) {
          return {
            ...prev,
            latitude: updated.latitude,
            longitude: updated.longitude,
            accuracy_meters: updated.accuracy_meters,
            current_state: updated.current_state,
            distance_from_hq_meters: updated.distance_from_hq_meters,
            observed_at: updated.observed_at,
            is_stale: updated.is_stale
          };
        }
        return prev;
      });

      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    const handleGeofenceUpdate = (e: any) => {
      const data = e.detail;
      setGeofence(prev => (prev ? { ...prev, radius_meters: data.radius_meters } : null));
    };

    window.addEventListener('policehq_officer_location_updated', handleLocationUpdate);
    window.addEventListener('policehq_geofence_config_updated', handleGeofenceUpdate);
    window.addEventListener('policehq_manual_refresh', loadData);

    // Polling every 15 seconds to ensure accuracy if websockets disconnect
    const interval = setInterval(loadData, 15000);

    return () => {
      window.removeEventListener('policehq_officer_location_updated', handleLocationUpdate);
      window.removeEventListener('policehq_geofence_config_updated', handleGeofenceUpdate);
      window.removeEventListener('policehq_manual_refresh', loadData);
      clearInterval(interval);
    };
  }, [targetOfficerId]);

  // Update Headquarters Marker & Geofence Boundary Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geofence) return;

    const lat = hq?.latitude || 16.7107;
    const lng = hq?.longitude || 81.0952;
    const radius = geofence.radius_meters || 100;

    // Remove existing circle
    if (geofenceCircleRef.current) {
      map.removeLayer(geofenceCircleRef.current);
    }
    // Remove existing HQ marker
    if (hqMarkerRef.current) {
      map.removeLayer(hqMarkerRef.current);
    }

    // Draw authoritative circular geofence with Navy & Blue accents
    const circle = L.circle([lat, lng], {
      color: '#17365D',
      weight: 2,
      opacity: 0.85,
      dashArray: '6, 6',
      fillColor: '#2563EB',
      fillOpacity: 0.12,
      radius: radius
    }).addTo(map);

    geofenceCircleRef.current = circle;

    // Place HQ Center Marker
    const hqMarker = L.marker([lat, lng], {
      icon: createHqIcon()
    }).addTo(map);

    hqMarker.bindPopup(`
      <div style="padding: 4px 2px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <strong style="color: #17365D; font-size: 13px;">${hq?.name || 'Eluru Police HQ'}</strong>
        </div>
        <p style="font-size: 11px; color: #64748B; margin: 0 0 6px 0;">Authoritative Geofence Center</p>
        <div style="font-size: 11px; line-height: 1.5; color: #334155;">
          <div><strong>Radius:</strong> ${radius} metres</div>
          <div><strong>Coordinates:</strong> ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</div>
          <div><strong>Filter:</strong> Accuracy &le; ${geofence.accuracy_threshold_meters || 35}m</div>
        </div>
      </div>
    `);

    hqMarkerRef.current = hqMarker;
  }, [hq, geofence]);

  // Update Officer Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Filter officers
    const visibleOfficers = officers.filter(o => {
      if (statusFilter === 'INSIDE' && o.current_state !== 'INSIDE') return false;
      if (statusFilter === 'OUTSIDE' && o.current_state !== 'OUTSIDE') return false;
      if (statusFilter === 'STALE' && !o.is_stale && o.current_state !== 'LOCATION_STALE') return false;
      if (statusFilter === 'UNAVAILABLE' && o.current_state !== 'UNKNOWN' && o.current_state !== 'OFFLINE') return false;
      if (stationFilter !== 'ALL' && o.department !== stationFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.full_name.toLowerCase().includes(q) ||
          o.officer_id.toLowerCase().includes(q) ||
          o.rank.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Clear existing markers not in current view
    const currentKeys = new Set(visibleOfficers.map(o => o.user_id));
    markersRef.current.forEach((marker, uid) => {
      if (!currentKeys.has(uid)) {
        map.removeLayer(marker);
        markersRef.current.delete(uid);
      }
    });

    // Render or update markers
    visibleOfficers.forEach(officer => {
      // Default to HQ offset if no coords recorded yet
      const lat = officer.latitude ?? (hq?.latitude || 16.7107) + (Math.random() * 0.001 - 0.0005);
      const lng = officer.longitude ?? (hq?.longitude || 81.0952) + (Math.random() * 0.001 - 0.0005);

      const icon = createOfficerIcon(officer.current_state, officer.is_stale);

      if (markersRef.current.has(officer.user_id)) {
        const existing = markersRef.current.get(officer.user_id)!;
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([lat, lng], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedOfficer(officer);
        });

        const statusColor = officer.current_state === 'INSIDE' ? '#15803D' : officer.is_stale ? '#B45309' : '#2563EB';

        marker.bindPopup(`
          <div style="min-width: 180px; padding: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
              <strong style="color: #172B4D; font-size: 13px;">${officer.full_name}</strong>
              <span style="font-size: 10px; font-weight: bold; color: ${statusColor};">${officer.current_state}</span>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              <span>${officer.rank}</span> • <span style="font-family: monospace;">${officer.officer_id}</span>
            </div>
            <div style="font-size: 11px; line-height: 1.5; color: #334155; border-top: 1px solid #E2E8F0; padding-top: 4px;">
              <div><strong>Station:</strong> ${officer.department}</div>
              <div><strong>Distance from HQ:</strong> ${officer.distance_from_hq_meters ? `${officer.distance_from_hq_meters.toFixed(0)}m` : 'Unknown'}</div>
              <div><strong>GPS Accuracy:</strong> ${officer.accuracy_meters ? `±${officer.accuracy_meters.toFixed(1)}m` : 'N/A'}</div>
              <div><strong>Updated:</strong> ${officer.observed_at ? new Date(officer.observed_at).toLocaleTimeString('en-IN') : 'No GPS data'}</div>
            </div>
          </div>
        `);

        markersRef.current.set(officer.user_id, marker);
      }
    });
  }, [officers, statusFilter, stationFilter, searchQuery, hq]);

  // Fit Map bounds to show all active officers + Headquarters
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const points: [number, number][] = [];
    if (hq?.latitude && hq?.longitude) {
      points.push([hq.latitude, hq.longitude]);
    }
    officers.forEach(o => {
      if (o.latitude != null && o.longitude != null) {
        points.push([o.latitude, o.longitude]);
      }
    });
    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else if (points.length === 1) {
      mapInstanceRef.current.flyTo(points[0], 16, { animate: true, duration: 1.0 });
    }
  };

  // Recenter Map on HQ
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      const lat = hq?.latitude || 16.7107;
      const lng = hq?.longitude || 81.0952;
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    }
  };

  // Fly to selected officer
  const handleSelectOfficer = (officer: LiveOfficerLocation) => {
    setSelectedOfficer(officer);
    setMobileTab('map');
    if (mapInstanceRef.current) {
      const lat = officer.latitude ?? (hq?.latitude || 16.7107);
      const lng = officer.longitude ?? (hq?.longitude || 81.0952);
      mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1.0 });

      const marker = markersRef.current.get(officer.user_id);
      if (marker) marker.openPopup();
    }
  };

  const stations = Array.from(new Set(officers.map(o => o.department))).filter(Boolean);

  const filteredOfficers = officers.filter(o => {
    if (statusFilter === 'INSIDE' && o.current_state !== 'INSIDE') return false;
    if (statusFilter === 'OUTSIDE' && o.current_state !== 'OUTSIDE') return false;
    if (statusFilter === 'STALE' && !o.is_stale && o.current_state !== 'LOCATION_STALE') return false;
    if (statusFilter === 'UNAVAILABLE' && o.current_state !== 'UNKNOWN' && o.current_state !== 'OFFLINE') return false;
    if (stationFilter !== 'ALL' && o.department !== stationFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.full_name.toLowerCase().includes(q) ||
        o.officer_id.toLowerCase().includes(q) ||
        o.rank.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#F5F7FA] p-4' : ''}`}>
      {/* Top Map Toolbar & Status Indicator */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search personnel or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Statuses ({officers.length})</option>
            <option value="INSIDE">Inside HQ ({officers.filter(o => o.current_state === 'INSIDE').length})</option>
            <option value="OUTSIDE">Outside HQ ({officers.filter(o => o.current_state === 'OUTSIDE').length})</option>
            <option value="STALE">Stale Location ({officers.filter(o => o.is_stale).length})</option>
            <option value="UNAVAILABLE">Location Unavailable ({officers.filter(o => o.current_state === 'UNKNOWN' || o.current_state === 'OFFLINE').length})</option>
          </select>

          {/* Station Filter */}
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Stations / Units</option>
            {stations.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <div className="text-[11px] text-slate-400 mr-2 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: <strong className="text-slate-700">{lastUpdated}</strong></span>
          </div>

          <button
            onClick={handleFitAll}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold text-[#2563EB] flex items-center space-x-1.5 transition shadow-sm"
            title="Fit Map to show All Active Officers and Headquarters"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">Fit All ({officers.filter(o => o.latitude != null).length})</span>
          </button>

          <button
            onClick={handleRecenter}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-[#17365D] flex items-center space-x-1.5 transition"
            title="Recenter on Headquarters"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">Center HQ</span>
          </button>

          <button
            onClick={loadData}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition"
            title="Refresh Locations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="flex lg:hidden bg-white p-1 rounded-lg border border-[#E2E8F0]">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition ${
            mobileTab === 'map' ? 'bg-[#17365D] text-white' : 'text-slate-600'
          }`}
        >
          Live Map View
        </button>
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition ${
            mobileTab === 'list' ? 'bg-[#17365D] text-white' : 'text-slate-600'
          }`}
        >
          Personnel Roster ({filteredOfficers.length})
        </button>
      </div>

      {/* Main Map + Side Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '680px' }}>
        {/* Interactive Leaflet Map (Col 1-3) */}
        <div className={`lg:col-span-3 bg-white rounded-xl border border-[#E2E8F0] shadow-sm relative overflow-hidden flex flex-col ${
          mobileTab === 'list' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div ref={mapContainerRef} className="w-full flex-1 z-10" />

          {/* Active Live Signal Tracking Banner */}
          {officers.filter(o => o.latitude != null && !o.is_stale).map(activeOfficer => (
            <div
              key={activeOfficer.user_id}
              className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-emerald-400/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center space-x-3 text-xs max-w-md animate-in fade-in"
            >
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <div>
                  <div className="font-bold text-slate-800 leading-tight">{activeOfficer.full_name}</div>
                  <div className="text-[10px] text-slate-400 font-mono leading-tight">{activeOfficer.officer_id} • {activeOfficer.rank}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeOfficer.current_state === 'INSIDE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeOfficer.current_state === 'ENTERING'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {activeOfficer.current_state} ({activeOfficer.distance_from_hq_meters ? `${activeOfficer.distance_from_hq_meters.toFixed(0)}m` : '0m'})
              </span>
              <button
                onClick={() => handleSelectOfficer(activeOfficer)}
                className="px-2.5 py-1 bg-[#17365D] hover:bg-[#102642] text-white text-[11px] font-bold rounded-lg transition shadow-sm ml-auto shrink-0"
              >
                Track Officer
              </button>
            </div>
          ))}

          {/* Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg p-2.5 shadow-md text-[11px] space-y-1.5">
            <div className="font-bold text-slate-800 text-[11px] border-b border-slate-100 pb-1">
              Location Status Legend
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-emerald-700"></span>
              <span className="text-slate-700">Inside Headquarters Geofence</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              <span className="text-slate-700">Outside Headquarters Geofence</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-600"></span>
              <span className="text-slate-700">Stale Location (&gt; 300s)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-slate-400"></span>
              <span className="text-slate-700">Location Unavailable / Offline</span>
            </div>
          </div>
        </div>

        {/* Personnel List Beside Map (Col 4) */}
        <div className={`lg:col-span-1 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden ${
          mobileTab === 'map' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h3 className="text-xs font-bold text-[#172B4D]">Authorized Personnel</h3>
              <p className="text-[11px] text-slate-400">{filteredOfficers.length} personnel in view</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          {/* Officer Details Modal / Popover if Selected */}
          {selectedOfficer && (
            <div className="p-3 bg-blue-50/50 border-b border-blue-100 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#17365D]">{selectedOfficer.full_name}</span>
                <button
                  onClick={() => setSelectedOfficer(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div><strong>Rank:</strong> {selectedOfficer.rank} ({selectedOfficer.officer_id})</div>
                <div><strong>Station:</strong> {selectedOfficer.department}</div>
                <div><strong>Distance from HQ:</strong> {selectedOfficer.distance_from_hq_meters ? `${selectedOfficer.distance_from_hq_meters.toFixed(0)}m` : 'N/A'}</div>
                <div><strong>GPS Accuracy:</strong> {selectedOfficer.accuracy_meters ? `±${selectedOfficer.accuracy_meters.toFixed(1)}m` : 'Unknown'}</div>
                <div><strong>Status:</strong> <span className="font-bold text-slate-800">{selectedOfficer.current_state}</span></div>
                <div><strong>Visits Today:</strong> {selectedOfficer.today_visit_count}</div>
              </div>
            </div>
          )}

          {/* Officers Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredOfficers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No personnel found matching filter.
              </div>
            ) : (
              filteredOfficers.map(officer => {
                const isSelected = selectedOfficer?.user_id === officer.user_id;
                const isInside = officer.current_state === 'INSIDE';
                const isStale = officer.is_stale || officer.current_state === 'LOCATION_STALE';

                return (
                  <div
                    key={officer.user_id}
                    onClick={() => handleSelectOfficer(officer)}
                    className={`p-3 cursor-pointer transition flex items-center justify-between text-xs ${
                      isSelected ? 'bg-blue-50/80 border-l-4 border-[#2563EB]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                        isInside ? 'bg-emerald-600' : isStale ? 'bg-amber-600' : 'bg-blue-600'
                      }`}>
                        {officer.full_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800 truncate block">
                          {officer.full_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {officer.officer_id} • {officer.rank}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isInside
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isStale
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {isInside ? 'Inside HQ' : isStale ? 'Stale' : 'Outside'}
                      </span>
                      {officer.distance_from_hq_meters && (
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {officer.distance_from_hq_meters.toFixed(0)}m
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
