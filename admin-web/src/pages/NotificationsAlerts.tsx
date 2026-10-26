import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Trash2,
  Radio,
  MapPin,
  ArrowRight,
  Shield,
  Search
} from 'lucide-react';
import { api } from '../services/api';

interface NotificationItem {
  id: string;
  type: 'ENTRY' | 'EXIT' | 'STALE' | 'CONFIG' | 'ALERT';
  title: string;
  message: string;
  timestamp: string;
  officer_id?: string;
  read: boolean;
  severity: 'info' | 'success' | 'warning' | 'danger';
}

interface Props {
  onNavigateToMap?: (officerId?: string) => void;
}

export const NotificationsAlerts: React.FC<Props> = ({ onNavigateToMap }) => {
  const [alerts, setAlerts] = useState<NotificationItem[]>([
    {
      id: '1',
      type: 'CONFIG',
      title: 'Geofence Active',
      message: 'Authoritative Eluru Headquarters perimeter active with 100m radius and 35m GPS filter.',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      severity: 'info'
    }
  ]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    // Listen for WebSocket entry, exit, and stale events
    const handleEntry = (e: any) => {
      const data = e.detail;
      const newAlert: NotificationItem = {
        id: Math.random().toString(),
        type: 'ENTRY',
        title: 'Headquarters Geofence Entry',
        message: `Officer ${data.officer_id} (${data.full_name || 'Personnel'}) entered Eluru Police HQ perimeter.`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        officer_id: data.officer_id,
        read: false,
        severity: 'success'
      };
      setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    };

    const handleExit = (e: any) => {
      const data = e.detail;
      const newAlert: NotificationItem = {
        id: Math.random().toString(),
        type: 'EXIT',
        title: 'Headquarters Geofence Exit',
        message: `Officer ${data.officer_id} exited Eluru Police HQ. Recorded stay: ${data.duration_formatted || '--'}.`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        officer_id: data.officer_id,
        read: false,
        severity: 'info'
      };
      setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    };

    const handleConfigUpdate = (e: any) => {
      const data = e.detail;
      const newAlert: NotificationItem = {
        id: Math.random().toString(),
        type: 'CONFIG',
        title: 'Geofence Radius Updated',
        message: `Authoritative headquarters radius updated to ${data.radius_meters}m by Super Admin.`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        severity: 'warning'
      };
      setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    };

    window.addEventListener('policehq_hq_entry', handleEntry);
    window.addEventListener('policehq_hq_exit', handleExit);
    window.addEventListener('policehq_geofence_config_updated', handleConfigUpdate);

    return () => {
      window.removeEventListener('policehq_hq_entry', handleEntry);
      window.removeEventListener('policehq_hq_exit', handleExit);
      window.removeEventListener('policehq_geofence_config_updated', handleConfigUpdate);
    };
  }, []);

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    }
    return true;
  });

  const getSeverityBadge = (sev: NotificationItem['severity']) => {
    switch (sev) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Bell className="w-5 h-5 text-[#17365D]" />
            <span>Operational Alerts & Event Feed</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time geofence events, headquarters entry/exit timestamps, and system notifications
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={markAllAsRead}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
          >
            Mark All Read
          </button>
          <button
            onClick={clearAllAlerts}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 flex items-center space-x-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Feed</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search alerts by title or officer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          {['ALL', 'ENTRY', 'EXIT', 'CONFIG', 'STALE'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                filterType === type
                  ? 'bg-[#17365D] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Alerts' : type === 'CONFIG' ? 'Geofence Config' : `${type} Events`}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No active alerts</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Real-time geofence transitions and system notifications will automatically appear here as officers enter or exit headquarters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-slate-50/80 transition flex items-start justify-between gap-4 ${
                  !alert.read ? 'bg-blue-50/20' : ''
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className={`p-2 rounded-lg border shrink-0 ${getSeverityBadge(alert.severity)}`}>
                    {alert.type === 'ENTRY' ? (
                      <MapPin className="w-4 h-4 text-emerald-600" />
                    ) : alert.type === 'EXIT' ? (
                      <Radio className="w-4 h-4 text-blue-600" />
                    ) : alert.type === 'CONFIG' ? (
                      <Shield className="w-4 h-4 text-amber-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-800">{alert.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(alert.severity)}`}>
                        {alert.type}
                      </span>
                      {!alert.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    <div className="flex items-center space-x-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{alert.timestamp} IST</span>
                      </span>
                      {alert.officer_id && (
                        <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          ID: {alert.officer_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {alert.officer_id && onNavigateToMap && (
                  <button
                    onClick={() => onNavigateToMap(alert.officer_id)}
                    className="shrink-0 text-xs text-[#2563EB] hover:text-[#17365D] font-semibold flex items-center space-x-1 hover:underline"
                  >
                    <span>View on Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
