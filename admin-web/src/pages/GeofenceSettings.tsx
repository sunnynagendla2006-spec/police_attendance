import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldCheck,
  MapPin,
  Sliders,
  History,
  AlertTriangle,
  Save,
  CheckCircle2,
  X,
  Compass,
  Info
} from 'lucide-react';
import { Headquarters, GeofenceConfig } from '../types';
import { api } from '../services/api';

export const GeofenceSettings: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [hq, setHq] = useState<Headquarters | null>(null);
  const [currentConfig, setCurrentConfig] = useState<GeofenceConfig | null>(null);
  const [history, setHistory] = useState<GeofenceConfig[]>([]);
  const [radiusInput, setRadiusInput] = useState<number>(100);
  const [accuracyInput, setAccuracyInput] = useState<number>(35);
  const [staleInput, setStaleInput] = useState<number>(300);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize Leaflet preview map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const lat = 16.7107;
    const lng = 81.0952;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const fetchConfig = async () => {
    try {
      const [hqData, histData] = await Promise.all([
        api.getHeadquarters(),
        api.getGeofenceHistory()
      ]);
      setHq(hqData);
      setCurrentConfig(histData.current);
      setHistory(histData.history);
      setRadiusInput(histData.current.radius_meters);
      setAccuracyInput(histData.current.accuracy_threshold_meters || 35);
      setStaleInput(histData.current.stale_threshold_seconds || 300);
    } catch (e) {
      console.error('Error loading geofence config:', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Update map circle whenever radiusInput or hq changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const lat = hq?.latitude || 16.7107;
    const lng = hq?.longitude || 81.0952;

    if (circleRef.current) {
      map.removeLayer(circleRef.current);
    }
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    const circle = L.circle([lat, lng], {
      color: '#17365D',
      weight: 2,
      opacity: 0.9,
      dashArray: '6, 6',
      fillColor: '#2563EB',
      fillOpacity: 0.15,
      radius: radiusInput
    }).addTo(map);
    circleRef.current = circle;

    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`<strong>${hq?.name || 'Headquarters'}</strong><br/>Radius: ${radiusInput}m`);
    markerRef.current = marker;

    map.setView([lat, lng], map.getZoom());
  }, [radiusInput, hq]);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setChangeReason('');
    setShowConfirmModal(true);
  };

  const handleSaveConfirmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeReason.trim() || changeReason.trim().length < 5) {
      setSaveError('Operational justification of at least 5 characters is mandatory.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const updated = await api.updateGeofenceConfig({
        radius_meters: Number(radiusInput),
        accuracy_threshold_meters: Number(accuracyInput),
        stale_threshold_seconds: Number(staleInput),
        change_reason: changeReason.trim()
      });
      setCurrentConfig(updated);
      setSaveSuccess(true);
      setShowConfirmModal(false);
      await fetchConfig();
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update geofence configuration.');
    } finally {
      setSaving(false);
    }
  };

  const presets = [50, 100, 150, 200, 250];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#17365D]" />
            <span>Headquarters Geofence & Perimeter Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Centrally configured headquarters coordinates, boundary radius, and GPS validation policies
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Perimeter configuration updated and broadcasted!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Settings Form (Col 1-2) */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleOpenConfirm} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[#2563EB]" />
              <span>Perimeter Configuration</span>
            </h3>

            {/* Headquarters Metadata */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Authoritative Location</span>
              <p className="font-bold text-slate-800">{hq?.name || 'Eluru District Police Headquarters'}</p>
              <p className="font-mono text-slate-600 text-[11px]">
                Latitude: {hq?.latitude?.toFixed(4) || '16.7107'}° N • Longitude: {hq?.longitude?.toFixed(4) || '81.0952'}° E
              </p>
            </div>

            {/* Radius Preset Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Geofence Radius Presets (Metres)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {presets.map(p => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setRadiusInput(p)}
                    className={`py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                      radiusInput === p
                        ? 'bg-[#17365D] text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p}m
                  </button>
                ))}
              </div>
            </div>

            {/* Radius Range Slider & Custom Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Custom Radius Boundary
                </label>
                <span className="text-xs font-bold font-mono text-[#17365D] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {radiusInput} metres
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={500}
                step={5}
                value={radiusInput}
                onChange={(e) => setRadiusInput(Number(e.target.value))}
                className="w-full accent-[#17365D]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>Min: 30m</span>
                <span>Default: 100m</span>
                <span>Max: 500m</span>
              </div>
            </div>

            {/* GPS Accuracy Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GPS Accuracy Threshold (Metres)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={accuracyInput}
                onChange={(e) => setAccuracyInput(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#2563EB]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Observations with reported accuracy &gt; {accuracyInput}m will be flagged as uncertain.
              </p>
            </div>

            {/* Stale Location Threshold */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location Freshness Stale Threshold (Seconds)
              </label>
              <input
                type="number"
                min={60}
                max={1800}
                step={30}
                value={staleInput}
                onChange={(e) => setStaleInput(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#2563EB]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Officers without GPS updates for &gt; {staleInput} seconds ({Math.round(staleInput / 60)} mins) will be marked Location Stale.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 transition"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Review & Save Configuration</span>
            </button>
          </form>
        </div>

        {/* Map Preview & Historical Configuration (Col 3-5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Map Preview Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Interactive Geofence Preview</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                Active Radius: <strong className="text-slate-800">{radiusInput}m</strong>
              </span>
            </div>
            <div ref={mapContainerRef} className="w-full h-80 rounded-lg border border-slate-200 z-10" />
          </div>

          {/* Audit History of Radius Modifications */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-100 mb-3 flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Authoritative Configuration Audit History</span>
            </h4>

            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
              {history.length === 0 ? (
                <p className="text-slate-400 py-4 text-center">No previous configuration changes recorded.</p>
              ) : (
                history.map((h, i) => (
                  <div key={h.id || i} className="py-2.5 flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#17365D] font-mono">{h.radius_meters}m Radius</span>
                        <span className="text-[10px] text-slate-400">by {h.changed_by}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{h.change_reason || 'Administrative update'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {new Date(h.effective_from || h.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-6">
            <div className="flex items-center space-x-3 text-amber-600 mb-3">
              <div className="p-2 bg-amber-50 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">Confirm Geofence Perimeter Update</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              You are about to update the Eluru District Police Headquarters geofence radius to{' '}
              <strong className="text-slate-800">{radiusInput} metres</strong>. All subsequent officer entry and exit calculations will be governed by this boundary.
            </p>

            {saveError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveConfirmed} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Operational Justification / Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Expanded perimeter boundary to encompass newly constructed annex building"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2563EB] resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Authorize Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
