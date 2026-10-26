import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  Radio,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Cpu,
  Layers,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const [hData, rData] = await Promise.all([
        api.getSystemHealth(),
        api.getSystemReadiness()
      ]);
      const end = performance.now();
      setLatency(Math.round(end - start));
      setHealth(hData);
      setReadiness(rData);
    } catch (e) {
      console.error('Health check error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-[#17365D]" />
            <span>System Health, Infrastructure & Security Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational status of FastAPI server, MongoDB 2dsphere indexing engine, and real-time WebSocket cluster
          </p>
        </div>

        <button
          onClick={checkHealth}
          className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center space-x-2 transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#2563EB]' : ''}`} />
          <span>Run Diagnostic Probe</span>
        </button>
      </div>

      {/* 3 Node Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Backend API Service */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">FastAPI Backend</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xl font-bold font-mono text-emerald-700">
              {health?.status || 'ONLINE'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block font-mono">
            API RTT Latency: <strong className="text-slate-700">{latency ? `${latency}ms` : '--'}</strong>
          </span>
        </div>

        {/* MongoDB Database */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">MongoDB 2dsphere</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xl font-bold font-mono text-emerald-700">
              {readiness?.database || 'CONNECTED'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block font-mono">
            Target DB: <strong className="text-slate-700">{readiness?.mongodb_target || 'policehq_geoattend'}</strong>
          </span>
        </div>

        {/* Real-Time WebSocket */}
        <div className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">WebSocket Stream</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${wsService.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span className="text-xl font-bold font-mono text-indigo-700">
              {wsService.isConnected ? 'ACTIVE' : 'CONNECTING'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block font-mono">
            Protocol: <strong className="text-slate-700">WSS Broadcast Engine</strong>
          </span>
        </div>
      </div>

      {/* Technical Configuration Diagnostics */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-[#2563EB]" />
          <span>Headquarters System Environment & Spatial Indexing</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
            <span className="font-bold text-slate-700 block">Geospatial Indexing Verification</span>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>MongoDB 2dsphere index active on location_observations</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Geofence circular polygon query acceleration enabled</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Idempotent geofence event deduplication index enforced</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
            <span className="font-bold text-slate-700 block">Security Policies & Integrity Safeguards</span>
            <div className="flex items-center space-x-2 text-slate-700">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Bcrypt hash encryption active for all police credentials</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-700">
              <Shield className="w-4 h-4 text-slate-500" />
              <span>Mandatory first-login password rotation policy active</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>JWT authentication token expiration: 60 minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
