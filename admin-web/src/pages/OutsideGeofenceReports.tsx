import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  Calendar,
  Download,
  Filter,
  ExternalLink,
  ShieldAlert,
  Search,
  Building,
  RefreshCw
} from 'lucide-react';
import { OutsideGeofenceObservation, Headquarters } from '../types';
import { api } from '../services/api';

export const OutsideGeofenceReports: React.FC = () => {
  const [observations, setObservations] = useState<OutsideGeofenceObservation[]>([]);
  const [locations, setLocations] = useState<Headquarters[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloading, setDownloading] = useState<'PDF' | 'CSV' | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [obsRes, locsRes] = await Promise.all([
        api.getOutsideGeofenceObservations({
          location_id: selectedLocation || undefined,
          date: selectedDate || undefined
        }),
        api.getHeadquartersFacilities()
      ]);
      setObservations(obsRes);
      setLocations(locsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load outside-geofence observations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedLocation]);

  const handleDownload = async (format: 'PDF' | 'CSV') => {
    try {
      setDownloading(format);
      await api.downloadReportFile({
        report_type: 'OUTSIDE_GEOFENCE_AUDIT',
        format,
        report_date: selectedDate,
        location_id: selectedLocation || undefined
      });
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const filteredObservations = observations.filter((obs) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      obs.officer_name.toLowerCase().includes(q) ||
      obs.officer_id.toLowerCase().includes(q) ||
      obs.duty_location_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-rose-600 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Perimeter Security Breach Audit</span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B4D] mt-1">
            Outside-Geofence Observations
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real-time audit log of constables confirmed outside their assigned duty perimeter during scheduled check-in windows.
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleDownload('PDF')}
            disabled={downloading !== null}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'PDF' ? 'Exporting...' : 'PDF Audit'}</span>
          </button>
          <button
            onClick={() => handleDownload('CSV')}
            disabled={downloading !== null}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'CSV' ? 'Exporting...' : 'CSV'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Breaches Today</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{observations.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">Confirmed outside assigned radius</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Moderate Drift (&lt; 500m)</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {observations.filter((o) => o.excess_distance_meters < 500).length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Near station perimeter</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Major Deviation (&gt; 1 km)</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">
            {observations.filter((o) => o.excess_distance_meters >= 1000).length}
          </div>
          <div className="text-[10px] text-rose-500 mt-1">Requires supervisor escalation</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Average Excess Distance</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {observations.length > 0
              ? `${Math.round(observations.reduce((sum, o) => sum + o.excess_distance_meters, 0) / observations.length)} m`
              : '0 m'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Mean deviation beyond threshold</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by officer name, ID, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#17365D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

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

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-lg text-slate-500 hover:text-[#17365D] hover:bg-slate-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Observations Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Officer Details</th>
                <th className="py-3 px-4">Duty Location</th>
                <th className="py-3 px-4">Observation Window</th>
                <th className="py-3 px-4">Distance & Excess</th>
                <th className="py-3 px-4">GPS Accuracy</th>
                <th className="py-3 px-4 text-right">Map Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading perimeter observations...
                  </td>
                </tr>
              ) : filteredObservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No outside-geofence observations recorded for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredObservations.map((obs, idx) => {
                  const isMajor = obs.excess_distance_meters >= 1000;
                  return (
                    <tr key={obs.snapshot_id || idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172B4D]">{obs.officer_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {obs.officer_id} &bull; {obs.rank}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{obs.duty_location_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Radius: {obs.allowed_radius_meters}m
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {obs.snapshot_window === 'MORNING_10AM'
                            ? 'Morning (10:00 AM)'
                            : obs.snapshot_window === 'EVENING_6PM'
                            ? 'Evening (6:00 PM)'
                            : 'Ad-hoc Check'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {obs.observed_at ? new Date(obs.observed_at).toLocaleTimeString('en-IN') : '--'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {Math.round(obs.distance_from_location_meters)} m from HQ
                        </div>
                        <div
                          className={`text-[11px] font-semibold mt-0.5 ${
                            isMajor ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          +{Math.round(obs.excess_distance_meters)} m beyond geofence
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-600">
                          &plusmn;{Math.round(obs.accuracy_meters)}m
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {obs.accuracy_meters <= 25 ? 'High Accuracy' : 'Moderate Accuracy'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${obs.latitude}&mlon=${obs.longitude}#map=16/${obs.latitude}/${obs.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold"
                        >
                          <span>Open Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default OutsideGeofenceReports;
