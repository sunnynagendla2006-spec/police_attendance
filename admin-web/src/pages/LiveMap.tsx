import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  X,
  Building,
  Navigation,
  Layers,
  Info,
  Calendar,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { LiveOfficerLocation, Headquarters, DutyAssignment } from '../types';
import { api } from '../services/api';

interface Props {
  targetOfficerId?: string;
  onNavigateToAssignments?: () => void;
}

export const LiveMap: React.FC<Props> = ({ targetOfficerId, onNavigateToAssignments }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // References to track map layers across updates
  const facilityLayersRef = useRef<Map<string, { marker: L.Marker; circle: L.Circle }>>(new Map());
  const officerMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const initialCenteredRef = useRef<boolean>(false);

  // State
  const [facilities, setFacilities] = useState<Headquarters[]>([]);
  const [officers, setOfficers] = useState<LiveOfficerLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Selection state
  const [selectedFacility, setSelectedFacility] = useState<Headquarters | null>(null);
  const [selectedFacilityPersonnel, setSelectedFacilityPersonnel] = useState<DutyAssignment[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState<boolean>(false);
  const [selectedOfficer, setSelectedOfficer] = useState<LiveOfficerLocation | null>(null);

  // Sidebar controls
  const [sidebarTab, setSidebarTab] = useState<'facilities' | 'officers'>('facilities');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facilityStatusFilter, setFacilityStatusFilter] = useState<string>('ALL'); // ALL, ACTIVE, INACTIVE
  const [facilityAssignmentFilter, setFacilityAssignmentFilter] = useState<string>('ALL'); // ALL, WITH_ASSIGNED, UNASSIGNED
  const [officerStatusFilter, setOfficerStatusFilter] = useState<string>('ALL'); // ALL, INSIDE, OUTSIDE, STALE, UNAVAILABLE
  const [officerStationFilter, setOfficerStationFilter] = useState<string>('ALL');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // --- 1. Custom Marker Icons ---
  const createFacilityIcon = (facility: Headquarters) => {
    const isPrimary = facility.is_primary;
    const bg = isPrimary ? '#0F2942' : '#1E3A8A';
    const border = isPrimary ? '#F59E0B' : '#94A3B8';
    const textColor = isPrimary ? '#F59E0B' : '#FFFFFF';
    const label = isPrimary ? '★ HQ' : (facility.code?.slice(-3) || 'FAC');

    return L.divIcon({
      className: 'custom-facility-pin',
      html: `
        <div style="
          background: ${bg};
          border: 2.5px solid ${border};
          border-radius: 8px;
          padding: 3px 6px;
          color: ${textColor};
          font-weight: 800;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(15, 41, 66, 0.4);
          white-space: nowrap;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <span style="font-size: 13px;">${isPrimary ? '★' : '🏛'}</span>
          <span>${label}</span>
          ${(facility.assigned_constables_count || 0) > 0 ? `
            <span style="
              background: ${isPrimary ? '#F59E0B' : '#2563EB'};
              color: #ffffff;
              border-radius: 10px;
              padding: 0 4px;
              font-size: 9px;
              font-weight: 900;
              margin-left: 2px;
            ">${facility.assigned_constables_count}</span>
          ` : ''}
        </div>
      `,
      iconSize: [60, 28],
      iconAnchor: [30, 14],
      popupAnchor: [0, -18]
    });
  };

  const createOfficerIcon = (officer: LiveOfficerLocation) => {
    let color = '#2563EB'; // default blue
    let label = 'OUT';

    const state = officer.geofence_status || officer.current_state;

    if (state === 'INSIDE') {
      color = '#15803D'; // emerald
      label = 'IN';
    } else if (officer.is_stale || state === 'STALE' || state === 'LOCATION_STALE') {
      color = '#B45309'; // amber
      label = 'STL';
    } else if (state === 'OUTSIDE') {
      color = '#DC2626'; // red
      label = 'OUT';
    } else if (state === 'UNKNOWN' || state === 'NO_DATA' || state === 'OFFLINE') {
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
          box-shadow: 0 4px 10px rgba(0,0,0,0.28);
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

  // --- 2. Initialize Leaflet Map ---
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultLat = 16.7107;
    const defaultLng = 81.0952;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

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

  // --- 3. Load Authorized Facilities & Officer Locations ---
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [facilitiesData, liveLocationsData] = await Promise.all([
        api.getHeadquartersFacilities(),
        api.getLiveLocations()
      ]);

      setFacilities(facilitiesData || []);
      setOfficers(liveLocationsData || []);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Handle targeted officer navigation on initial load
      if (targetOfficerId && !initialCenteredRef.current) {
        const found = (liveLocationsData || []).find(o => o.officer_id === targetOfficerId);
        if (found) {
          setSelectedOfficer(found);
          if (mapInstanceRef.current && found.latitude != null && found.longitude != null) {
            mapInstanceRef.current.flyTo([found.latitude, found.longitude], 17, { animate: true, duration: 1.0 });
          }
        }
        initialCenteredRef.current = true;
      } else if (!initialCenteredRef.current && facilitiesData && facilitiesData.length > 0) {
        // Auto-fit bounds across all returned locations
        autoFitMap(facilitiesData, liveLocationsData || []);
        initialCenteredRef.current = true;
      }
    } catch (e) {
      console.error('Error loading live map data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-fit bounds helper
  const autoFitMap = (facList: Headquarters[], offList: LiveOfficerLocation[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const points: [number, number][] = [];

    // Permanent facility coordinates
    facList.forEach(f => {
      if (f.latitude != null && f.longitude != null && !isNaN(f.latitude) && !isNaN(f.longitude)) {
        points.push([f.latitude, f.longitude]);
      }
    });

    // Officer actual GPS observations (only valid coordinates)
    offList.forEach(o => {
      if (o.latitude != null && o.longitude != null && !isNaN(o.latitude) && !isNaN(o.longitude)) {
        points.push([o.latitude, o.longitude]);
      }
    });

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 16, { animate: true, duration: 1.0 });
    }
  };

  // Load selected facility personnel when facility is clicked
  useEffect(() => {
    if (!selectedFacility) {
      setSelectedFacilityPersonnel([]);
      return;
    }
    const fetchPersonnel = async () => {
      setLoadingPersonnel(true);
      try {
        const p = await api.getHeadquartersPersonnel(selectedFacility.id);
        setSelectedFacilityPersonnel(p || []);
      } catch (e) {
        console.error('Error loading facility personnel:', e);
        setSelectedFacilityPersonnel([]);
      } finally {
        setLoadingPersonnel(false);
      }
    };
    fetchPersonnel();
  }, [selectedFacility]);

  // Initial load & Polling & WebSocket Event listeners
  useEffect(() => {
    loadData();

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
            distance_from_assigned_location_meters: updated.distance_from_assigned_location_meters,
            assigned_location_id: updated.assigned_location_id,
            assigned_location_name: updated.assigned_location_name,
            assigned_location_code: updated.assigned_location_code,
            assigned_geofence_radius: updated.assigned_geofence_radius,
            geofence_status: updated.geofence_status,
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
            distance_from_assigned_location_meters: updated.distance_from_assigned_location_meters,
            assigned_location_id: updated.assigned_location_id,
            assigned_location_name: updated.assigned_location_name,
            assigned_location_code: updated.assigned_location_code,
            assigned_geofence_radius: updated.assigned_geofence_radius,
            geofence_status: updated.geofence_status,
            observed_at: updated.observed_at,
            is_stale: updated.is_stale
          };
        }
        return prev;
      });

      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    const handleAssignmentUpdate = () => {
      loadData(false);
    };

    const handleRefreshEvent = () => {
      loadData(false);
    };

    window.addEventListener('policehq_officer_location_updated', handleLocationUpdate);
    window.addEventListener('policehq_duty_assignment_updated', handleAssignmentUpdate);
    window.addEventListener('policehq_geofence_config_updated', handleRefreshEvent);
    window.addEventListener('policehq_manual_refresh', handleRefreshEvent);

    const interval = setInterval(() => loadData(false), 15000);

    return () => {
      window.removeEventListener('policehq_officer_location_updated', handleLocationUpdate);
      window.removeEventListener('policehq_duty_assignment_updated', handleAssignmentUpdate);
      window.removeEventListener('policehq_geofence_config_updated', handleRefreshEvent);
      window.removeEventListener('policehq_manual_refresh', handleRefreshEvent);
      clearInterval(interval);
    };
  }, [targetOfficerId]);

  // --- 4. Render ALL Facilities & Their Individual Geofence Circles ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Filter facilities based on controls
    const visibleFacilities = facilities.filter(fac => {
      if (facilityStatusFilter !== 'ALL' && fac.status !== facilityStatusFilter) return false;
      if (facilityAssignmentFilter === 'WITH_ASSIGNED' && (!fac.assigned_constables_count || fac.assigned_constables_count === 0)) return false;
      if (facilityAssignmentFilter === 'UNASSIGNED' && (fac.assigned_constables_count && fac.assigned_constables_count > 0)) return false;
      if (searchQuery.trim() && sidebarTab === 'facilities') {
        const q = searchQuery.toLowerCase();
        return (
          fac.name.toLowerCase().includes(q) ||
          fac.code.toLowerCase().includes(q) ||
          fac.district?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const activeIds = new Set(visibleFacilities.map(f => f.id));

    // Remove old layers no longer in view
    facilityLayersRef.current.forEach((layers, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(layers.marker);
        map.removeLayer(layers.circle);
        facilityLayersRef.current.delete(id);
      }
    });

    // Render each facility and its dedicated geofence circle
    visibleFacilities.forEach(fac => {
      if (fac.latitude == null || fac.longitude == null || isNaN(fac.latitude) || isNaN(fac.longitude)) return;

      const lat = fac.latitude;
      const lng = fac.longitude;
      const radius = fac.radius_meters || 100;
      const isPrimary = fac.is_primary;

      const strokeColor = isPrimary ? '#D97706' : '#2563EB';
      const fillColor = isPrimary ? '#F59E0B' : '#3B82F6';

      if (facilityLayersRef.current.has(fac.id)) {
        // Update existing marker and circle
        const existing = facilityLayersRef.current.get(fac.id)!;
        existing.marker.setLatLng([lat, lng]);
        existing.marker.setIcon(createFacilityIcon(fac));
        existing.circle.setLatLng([lat, lng]);
        existing.circle.setRadius(radius);
      } else {
        // Create authoritative geofence circle (supports overlapping circles)
        const circle = L.circle([lat, lng], {
          color: strokeColor,
          weight: isPrimary ? 2.5 : 2,
          opacity: 0.85,
          dashArray: isPrimary ? undefined : '6, 6',
          fillColor: fillColor,
          fillOpacity: isPrimary ? 0.16 : 0.12,
          radius: radius
        }).addTo(map);

        // Create facility marker
        const marker = L.marker([lat, lng], {
          icon: createFacilityIcon(fac)
        }).addTo(map);

        marker.on('click', () => {
          setSelectedFacility(fac);
          setSelectedOfficer(null);
        });

        // Rich Accessible Popup
        marker.bindPopup(`
          <div style="min-width: 220px; padding: 4px 2px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <strong style="color: #172B4D; font-size: 13px;">${fac.name}</strong>
              ${isPrimary ? '<span style="background: #FEF3C7; color: #B45309; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid #FCD34D;">PRIMARY HQ</span>' : ''}
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              Code: <strong style="color: #334155;">${fac.code}</strong> • Status: <span style="font-weight: 700; color: ${fac.status === 'ACTIVE' ? '#15803D' : '#DC2626'};">${fac.status}</span>
            </div>
            <div style="font-size: 11px; line-height: 1.5; color: #334155; border-top: 1px solid #E2E8F0; padding-top: 6px;">
              <div><strong>Geofence Radius:</strong> ${radius} metres</div>
              <div><strong>Coordinates:</strong> ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E</div>
              <div><strong>Assigned Constables:</strong> ${fac.assigned_constables_count || 0} on active duty</div>
              ${fac.address ? `<div style="margin-top: 4px; font-size: 10px; color: #64748B;">${fac.address}</div>` : ''}
            </div>
          </div>
        `);

        facilityLayersRef.current.set(fac.id, { marker, circle });
      }
    });
  }, [facilities, facilityStatusFilter, facilityAssignmentFilter, searchQuery, sidebarTab]);

  // --- 5. Render Authorized Officer Markers (Actual GPS Observations Only) ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Filter officers
    const visibleOfficers = officers.filter(o => {
      const state = o.geofence_status || o.current_state;
      if (officerStatusFilter === 'INSIDE' && state !== 'INSIDE') return false;
      if (officerStatusFilter === 'OUTSIDE' && state !== 'OUTSIDE') return false;
      if (officerStatusFilter === 'STALE' && !o.is_stale && state !== 'LOCATION_STALE' && state !== 'STALE') return false;
      if (officerStatusFilter === 'UNAVAILABLE' && state !== 'UNKNOWN' && state !== 'NO_DATA' && state !== 'OFFLINE') return false;
      if (officerStationFilter !== 'ALL' && o.assigned_location_id !== officerStationFilter && o.department !== officerStationFilter) return false;
      if (searchQuery.trim() && sidebarTab === 'officers') {
        const q = searchQuery.toLowerCase();
        return (
          o.full_name.toLowerCase().includes(q) ||
          o.officer_id.toLowerCase().includes(q) ||
          o.rank.toLowerCase().includes(q) ||
          (o.assigned_location_name && o.assigned_location_name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    // Only place markers for officers with ACTUAL GPS coordinates (never fabricate!)
    const activeWithCoords = visibleOfficers.filter(
      o => o.latitude != null && o.longitude != null && !isNaN(o.latitude) && !isNaN(o.longitude)
    );
    const activeKeys = new Set(activeWithCoords.map(o => o.user_id));

    // Clear removed officer markers
    officerMarkersRef.current.forEach((marker, uid) => {
      if (!activeKeys.has(uid)) {
        map.removeLayer(marker);
        officerMarkersRef.current.delete(uid);
      }
    });

    // Render or update markers for officers with real observations
    activeWithCoords.forEach(officer => {
      const lat = officer.latitude!;
      const lng = officer.longitude!;
      const icon = createOfficerIcon(officer);

      if (officerMarkersRef.current.has(officer.user_id)) {
        const existing = officerMarkersRef.current.get(officer.user_id)!;
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([lat, lng], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedOfficer(officer);
          setSelectedFacility(null);
        });

        const statusColor = (officer.geofence_status === 'INSIDE' || officer.current_state === 'INSIDE')
          ? '#15803D'
          : officer.is_stale
          ? '#B45309'
          : '#DC2626';

        marker.bindPopup(`
          <div style="min-width: 200px; padding: 4px 2px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
              <strong style="color: #172B4D; font-size: 13px;">${officer.full_name}</strong>
              <span style="font-size: 10px; font-weight: bold; color: ${statusColor};">
                ${officer.geofence_status || officer.current_state}
              </span>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              <span>${officer.rank}</span> • <span style="font-family: monospace;">${officer.officer_id}</span>
            </div>
            <div style="font-size: 11px; line-height: 1.5; color: #334155; border-top: 1px solid #E2E8F0; padding-top: 4px;">
              <div><strong>Assigned Duty Post:</strong> ${officer.assigned_location_name || 'Headquarters'}</div>
              <div><strong>Duty Post Radius:</strong> ${officer.assigned_geofence_radius || 100}m</div>
              <div><strong>Distance from Post:</strong> ${
                officer.distance_from_assigned_location_meters != null
                  ? `${officer.distance_from_assigned_location_meters.toFixed(0)}m`
                  : 'Calculating...'
              }</div>
              <div><strong>GPS Accuracy:</strong> ${officer.accuracy_meters ? `±${officer.accuracy_meters.toFixed(1)}m` : 'N/A'}</div>
              <div><strong>Observed At:</strong> ${
                officer.observed_at ? new Date(officer.observed_at).toLocaleTimeString('en-IN') : 'No timestamp'
              }</div>
              ${officer.is_stale ? '<div style="color: #B45309; font-weight: 700; margin-top: 4px;">⚠️ Observation is Stale (&gt;5m old)</div>' : ''}
            </div>
          </div>
        `);

        officerMarkersRef.current.set(officer.user_id, marker);
      }
    });
  }, [officers, officerStatusFilter, officerStationFilter, searchQuery, sidebarTab]);

  // --- 6. Navigation Actions ---
  const handleResetView = () => {
    autoFitMap(facilities, officers);
  };

  const handleSelectFacility = (fac: Headquarters) => {
    setSelectedFacility(fac);
    setSelectedOfficer(null);
    setMobileTab('map');
    if (mapInstanceRef.current && fac.latitude != null && fac.longitude != null) {
      mapInstanceRef.current.flyTo([fac.latitude, fac.longitude], 17, { animate: true, duration: 1.0 });
      const layer = facilityLayersRef.current.get(fac.id);
      if (layer) layer.marker.openPopup();
    }
  };

  const handleSelectOfficer = (officer: LiveOfficerLocation) => {
    setSelectedOfficer(officer);
    setSelectedFacility(null);
    setMobileTab('map');
    if (mapInstanceRef.current && officer.latitude != null && officer.longitude != null) {
      mapInstanceRef.current.flyTo([officer.latitude, officer.longitude], 17, { animate: true, duration: 1.0 });
      const marker = officerMarkersRef.current.get(officer.user_id);
      if (marker) marker.openPopup();
    }
  };

  // Filtered lists for sidebar
  const filteredFacilities = useMemo(() => {
    return facilities.filter(fac => {
      if (facilityStatusFilter !== 'ALL' && fac.status !== facilityStatusFilter) return false;
      if (facilityAssignmentFilter === 'WITH_ASSIGNED' && (!fac.assigned_constables_count || fac.assigned_constables_count === 0)) return false;
      if (facilityAssignmentFilter === 'UNASSIGNED' && (fac.assigned_constables_count && fac.assigned_constables_count > 0)) return false;
      if (searchQuery.trim() && sidebarTab === 'facilities') {
        const q = searchQuery.toLowerCase();
        return (
          fac.name.toLowerCase().includes(q) ||
          fac.code.toLowerCase().includes(q) ||
          (fac.district && fac.district.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [facilities, facilityStatusFilter, facilityAssignmentFilter, searchQuery, sidebarTab]);

  const filteredOfficers = useMemo(() => {
    return officers.filter(o => {
      const state = o.geofence_status || o.current_state;
      if (officerStatusFilter === 'INSIDE' && state !== 'INSIDE') return false;
      if (officerStatusFilter === 'OUTSIDE' && state !== 'OUTSIDE') return false;
      if (officerStatusFilter === 'STALE' && !o.is_stale && state !== 'LOCATION_STALE' && state !== 'STALE') return false;
      if (officerStatusFilter === 'UNAVAILABLE' && state !== 'UNKNOWN' && state !== 'NO_DATA' && state !== 'OFFLINE') return false;
      if (officerStationFilter !== 'ALL' && o.assigned_location_id !== officerStationFilter && o.department !== officerStationFilter) return false;
      if (searchQuery.trim() && sidebarTab === 'officers') {
        const q = searchQuery.toLowerCase();
        return (
          o.full_name.toLowerCase().includes(q) ||
          o.officer_id.toLowerCase().includes(q) ||
          o.rank.toLowerCase().includes(q) ||
          (o.assigned_location_name && o.assigned_location_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [officers, officerStatusFilter, officerStationFilter, searchQuery, sidebarTab]);

  // Aggregate stats
  const totalOfficersWithGps = officers.filter(o => o.latitude != null && o.longitude != null).length;
  const totalOfficersInside = officers.filter(o => (o.geofence_status === 'INSIDE' || o.current_state === 'INSIDE') && !o.is_stale).length;
  const totalOfficersOutside = officers.filter(o => (o.geofence_status === 'OUTSIDE' || o.current_state === 'OUTSIDE') && !o.is_stale).length;
  const totalOfficersStale = officers.filter(o => o.is_stale || o.current_state === 'LOCATION_STALE' || o.geofence_status === 'STALE').length;

  return (
    <div className={`flex flex-col h-[calc(100vh-5rem)] bg-[#F8FAFC] ${isFullscreen ? 'fixed inset-0 z-50 h-screen' : ''}`}>
      {/* Top Header Bar */}
      <div className="bg-white px-5 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#17365D] text-white rounded-lg shadow-sm">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-[#172B4D]">Multi-Facility Live Tactical Map</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live OpenStreetMap
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Monitoring <strong className="text-slate-800">{facilities.length}</strong> configured facilities & <strong className="text-slate-800">{officers.length}</strong> registered constables • Synced at {lastUpdated}
            </p>
          </div>
        </div>

        {/* Quick Map Controls */}
        <div className="flex items-center space-x-2">
          {/* Fit All / Reset View Button */}
          <button
            onClick={handleResetView}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#17365D] hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-xs transition"
            title="Fit Map to show all configured facilities and active constables"
          >
            <Compass className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Fit All Facilities</span>
          </button>

          {/* Refresh Data without reloading page */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#17365D] hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50"
            title="Fetch latest facility and GPS updates without reloading page"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-white border border-[#CBD5E1] text-[#64748B] hover:text-[#17365D] rounded-lg transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="lg:hidden flex border-b border-[#E2E8F0] bg-white">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b-2 ${mobileTab === 'map' ? 'border-[#17365D] text-[#17365D]' : 'border-transparent text-slate-500'}`}
        >
          Tactical Map
        </button>
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b-2 ${mobileTab === 'list' ? 'border-[#17365D] text-[#17365D]' : 'border-transparent text-slate-500'}`}
        >
          {sidebarTab === 'facilities' ? `Facilities (${filteredFacilities.length})` : `Constables (${filteredOfficers.length})`}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map View Container */}
        <div className={`flex-1 relative ${mobileTab === 'list' ? 'hidden lg:block' : 'block'}`}>
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* On-Map Summary Overlay Pill */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-lg flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200"></span>
              <span className="font-bold text-[#172B4D]">{facilities.length} Facilities</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center space-x-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{totalOfficersInside} Inside</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center space-x-1.5 text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>{totalOfficersOutside} Outside</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center space-x-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{totalOfficersStale} Stale</span>
            </div>
          </div>

          {/* Floating Details Card: Selected Facility */}
          {selectedFacility && (
            <div className="absolute bottom-5 left-5 z-20 bg-white rounded-xl border border-[#CBD5E1] shadow-2xl p-4 w-96 max-w-[calc(100vw-2.5rem)] max-h-[70vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#17365D]">
                    <Building className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#172B4D] leading-tight">{selectedFacility.name}</h3>
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono font-semibold">{selectedFacility.code}</span>
                      {selectedFacility.is_primary && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold rounded text-[9px] border border-amber-300">
                          PRIMARY HQ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Geofence Radius</span>
                  <div className="font-bold text-[#172B4D]">{selectedFacility.radius_meters} metres</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Status</span>
                  <div className="font-bold text-emerald-700">{selectedFacility.status}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Authoritative Coordinates</span>
                  <div className="font-mono text-slate-700">
                    {selectedFacility.latitude.toFixed(5)}° N, {selectedFacility.longitude.toFixed(5)}° E
                  </div>
                </div>
              </div>

              {/* Assigned Constables to this facility */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Assigned Constables ({selectedFacilityPersonnel.length})</span>
                  </span>
                  {onNavigateToAssignments && (
                    <button
                      onClick={onNavigateToAssignments}
                      className="text-[11px] text-[#2563EB] hover:underline font-semibold flex items-center space-x-0.5"
                    >
                      <span>Assign</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {loadingPersonnel ? (
                  <div className="text-[11px] text-slate-400 py-3 text-center">Loading assigned personnel...</div>
                ) : selectedFacilityPersonnel.length === 0 ? (
                  <div className="text-[11px] text-slate-400 py-3 bg-slate-50 rounded-lg text-center">
                    No constables currently assigned to this facility.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedFacilityPersonnel.map(asgn => (
                      <div key={asgn.id} className="p-2 bg-slate-50 rounded-lg text-xs flex items-center justify-between border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">{asgn.full_name || asgn.constable_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {asgn.officer_id || asgn.constable_officer_id}</div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                          {asgn.duty_title || 'Active Duty'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Details Card: Selected Officer */}
          {selectedOfficer && (
            <div className="absolute bottom-5 left-5 z-20 bg-white rounded-xl border border-[#CBD5E1] shadow-2xl p-4 w-96 max-w-[calc(100vw-2.5rem)]">
              <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-xs">
                    {selectedOfficer.full_name?.slice(0, 2).toUpperCase() || 'PO'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#172B4D] leading-tight">{selectedOfficer.full_name}</h3>
                    <div className="text-[11px] text-slate-500 font-mono">{selectedOfficer.officer_id} • {selectedOfficer.rank}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOfficer(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Assigned Post</span>
                  <div className="font-bold text-slate-800 truncate" title={selectedOfficer.assigned_location_name || 'Headquarters'}>
                    {selectedOfficer.assigned_location_name || 'Headquarters'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Geofence Status</span>
                  <div className={`font-bold ${
                    selectedOfficer.geofence_status === 'INSIDE'
                      ? 'text-emerald-700'
                      : selectedOfficer.is_stale
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}>
                    {selectedOfficer.is_stale ? 'STALE' : selectedOfficer.geofence_status || selectedOfficer.current_state}
                  </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Distance to Post</span>
                  <div className="font-bold text-slate-800">
                    {selectedOfficer.distance_from_assigned_location_meters != null
                      ? `${selectedOfficer.distance_from_assigned_location_meters.toFixed(0)}m`
                      : 'Unavailable'}
                  </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">GPS Accuracy</span>
                  <div className="font-bold text-slate-800">
                    {selectedOfficer.accuracy_meters ? `±${selectedOfficer.accuracy_meters.toFixed(1)}m` : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-700">Latest observation: </span>
                {selectedOfficer.observed_at ? new Date(selectedOfficer.observed_at).toLocaleString('en-IN') : 'No GPS reported yet'}
                {selectedOfficer.is_stale && (
                  <div className="text-amber-700 font-semibold mt-1">
                    ⚠️ GPS signal is stale. Stale data is not proof that the constable is outside the perimeter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tactical Sidebar */}
        <div className={`w-full lg:w-96 bg-white border-l border-[#E2E8F0] flex flex-col z-10 ${mobileTab === 'map' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Tab Switcher: Facilities vs Constables */}
          <div className="p-3 border-b border-[#E2E8F0] bg-slate-50/70">
            <div className="grid grid-cols-2 gap-1 bg-slate-200/80 p-1 rounded-lg text-xs font-bold">
              <button
                onClick={() => setSidebarTab('facilities')}
                className={`py-1.5 rounded-md transition ${sidebarTab === 'facilities' ? 'bg-white text-[#17365D] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Facilities ({facilities.length})
              </button>
              <button
                onClick={() => setSidebarTab('officers')}
                className={`py-1.5 rounded-md transition ${sidebarTab === 'officers' ? 'bg-white text-[#17365D] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Constables ({officers.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mt-2.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={sidebarTab === 'facilities' ? 'Search facilities, station code...' : 'Search constables by name, ID...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
              />
            </div>

            {/* Filters for Facilities */}
            {sidebarTab === 'facilities' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select
                  value={facilityStatusFilter}
                  onChange={e => setFacilityStatusFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
                <select
                  value={facilityAssignmentFilter}
                  onChange={e => setFacilityAssignmentFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  <option value="ALL">All Personnel</option>
                  <option value="WITH_ASSIGNED">With Assigned</option>
                  <option value="UNASSIGNED">Unassigned</option>
                </select>
              </div>
            )}

            {/* Filters for Constables */}
            {sidebarTab === 'officers' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select
                  value={officerStatusFilter}
                  onChange={e => setOfficerStatusFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="INSIDE">Inside Post</option>
                  <option value="OUTSIDE">Outside Post</option>
                  <option value="STALE">Stale Data</option>
                  <option value="UNAVAILABLE">No GPS</option>
                </select>
                <select
                  value={officerStationFilter}
                  onChange={e => setOfficerStationFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700 truncate"
                >
                  <option value="ALL">All Stations</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {sidebarTab === 'facilities' ? (
              // Facilities List
              filteredFacilities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No police facilities found matching current filters.
                </div>
              ) : (
                filteredFacilities.map(fac => {
                  const isSelected = selectedFacility?.id === fac.id;
                  return (
                    <div
                      key={fac.id}
                      onClick={() => handleSelectFacility(fac)}
                      className={`p-3.5 cursor-pointer transition flex items-center justify-between ${
                        isSelected ? 'bg-blue-50/70 border-l-4 border-l-[#2563EB]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <strong className="text-xs text-[#172B4D]">{fac.name}</strong>
                          {fac.is_primary && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold rounded text-[9px] border border-amber-300">
                              HQ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                          <span className="font-mono">{fac.code}</span>
                          <span>•</span>
                          <span>Radius: {fac.radius_meters}m</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
                          <span className={`font-semibold ${fac.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {fac.status}
                          </span>
                          <span>•</span>
                          <span className="text-[#2563EB] font-bold">
                            {fac.assigned_constables_count || 0} Constables Assigned
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  );
                })
              )
            ) : (
              // Constables List
              filteredOfficers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No constables found matching current filters.
                </div>
              ) : (
                filteredOfficers.map(officer => {
                  const isSelected = selectedOfficer?.user_id === officer.user_id;
                  const hasGps = officer.latitude != null && officer.longitude != null;
                  const state = officer.geofence_status || officer.current_state;

                  return (
                    <div
                      key={officer.user_id}
                      onClick={() => handleSelectOfficer(officer)}
                      className={`p-3.5 cursor-pointer transition flex items-center justify-between ${
                        isSelected ? 'bg-blue-50/70 border-l-4 border-l-[#2563EB]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#172B4D]">{officer.full_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            state === 'INSIDE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : officer.is_stale
                              ? 'bg-amber-100 text-amber-800'
                              : state === 'OUTSIDE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {officer.is_stale ? 'STALE' : state}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: {officer.officer_id} • {officer.rank}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" />
                          <span className="truncate">{officer.assigned_location_name || 'Assigned to HQ'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {hasGps ? (
                            <span>
                              {officer.distance_from_assigned_location_meters != null
                                ? `${officer.distance_from_assigned_location_meters.toFixed(0)}m from post`
                                : 'Coordinates tracked'}
                              {officer.observed_at ? ` • ${new Date(officer.observed_at).toLocaleTimeString('en-IN')}` : ''}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">GPS unavailable / device offline</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
