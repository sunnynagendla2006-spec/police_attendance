import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  CalendarCheck,
  History,
  Users,
  BarChart3,
  ShieldCheck,
  Bell,
  UserCog,
  Settings,
  FileText,
  Radio,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  Shield,
  Clock,
  AlertTriangle,
  ChevronDown,
  Building,
  ShieldAlert,
  Smartphone,
  Download,
  FileCheck2
} from 'lucide-react';
import { User } from '../types';
import { wsService } from '../services/websocket';

interface Props {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onLogout,
  children
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isWsConnected, setIsWsConnected] = useState<boolean>(wsService.isConnected);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; time: string; type: string }>>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Live ticking clock in IST (Asia/Kolkata)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket connection status and events
  useEffect(() => {
    const handleWsStatus = (e: any) => {
      setIsWsConnected(e.detail?.connected ?? false);
    };

    const handleHqEntry = (e: any) => {
      const data = e.detail;
      setNotifications(prev => [
        {
          id: Math.random().toString(),
          text: `Officer ${data.officer_id} (${data.full_name || 'Personnel'}) entered HQ Geofence`,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          type: 'entry'
        },
        ...prev.slice(0, 19)
      ]);
    };

    const handleHqExit = (e: any) => {
      const data = e.detail;
      setNotifications(prev => [
        {
          id: Math.random().toString(),
          text: `Officer ${data.officer_id} exited HQ (Duration: ${data.duration_formatted || '--'})`,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          type: 'exit'
        },
        ...prev.slice(0, 19)
      ]);
    };

    window.addEventListener('policehq_ws_status', handleWsStatus);
    window.addEventListener('policehq_hq_entry', handleHqEntry);
    window.addEventListener('policehq_hq_exit', handleHqExit);

    return () => {
      window.removeEventListener('policehq_ws_status', handleWsStatus);
      window.removeEventListener('policehq_hq_entry', handleHqEntry);
      window.removeEventListener('policehq_hq_exit', handleHqExit);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Operations' },
    { id: 'live-map', label: 'Live Location Map', icon: MapPin, category: 'Operations' },
    { id: 'duty-assignments', label: 'Duty Assignments', icon: Building, category: 'Operations' },
    { id: 'outside-geofence', label: 'Outside-Geofence Audit', icon: ShieldAlert, category: 'Operations' },
    { id: 'police-personnel', label: 'Police Personnel', icon: Users, category: 'Personnel' },
    { id: 'registered-devices', label: 'Device Binding', icon: Smartphone, category: 'Personnel' },
    { id: 'app-usage', label: 'App Usage Summaries', icon: Smartphone, category: 'Personnel' },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck, category: 'Attendance' },
    { id: 'station-visits', label: 'Station Visits', icon: History, category: 'Attendance' },
    { id: 'attendance-history', label: 'Attendance History', icon: FileText, category: 'Attendance' },
    { id: 'scheduled-reports', label: 'Scheduled Daily Reports', icon: FileCheck2, category: 'Reports' },
    { id: 'report-downloads', label: 'Report Downloads (12)', icon: Download, category: 'Reports' },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, category: 'Analytics' },
    { id: 'headquarters-settings', label: 'Headquarters & Geofences', icon: ShieldCheck, category: 'System' },
    { id: 'notifications-alerts', label: 'Notifications / Alerts', icon: Bell, category: 'System', badge: notifications.length > 0 ? notifications.length : undefined },
    { id: 'user-management', label: 'User Management', icon: UserCog, category: 'Administration' },
    { id: 'system-settings', label: 'System Settings', icon: Settings, category: 'Administration' }
  ];

  const getPageTitleAndBreadcrumb = () => {
    const item = navItems.find(n => n.id === currentTab);
    return {
      title: item ? item.label : 'Headquarters Overview',
      category: item ? item.category : 'Police Management'
    };
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    window.dispatchEvent(new Event('policehq_manual_refresh'));
    setTimeout(() => setRefreshing(false), 800);
  };

  const pageMeta = getPageTitleAndBreadcrumb();

  return (
    <div className="flex h-screen bg-[#F5F7FA] text-[#172B4D] overflow-hidden font-sans antialiased">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300 shadow-sm ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#17365D] flex items-center justify-center text-white shadow-sm shrink-0">
              <Shield className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold tracking-tight text-[#17365D] leading-none">
                  PoliceHQ GeoAttend
                </h1>
                <p className="text-[11px] text-[#64748B] font-medium mt-1 truncate">
                  Eluru District Police HQ
                </p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.id === 'headquarters-settings' && (currentTab === 'geofence-settings' || currentTab === 'admin/headquarters-settings'));
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                } py-2.5 rounded-lg text-xs font-semibold transition-all group relative ${
                  isActive
                    ? 'bg-[#EBF2FA] text-[#17365D] shadow-sm font-bold'
                    : 'text-[#64748B] hover:text-[#17365D] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#17365D]' : 'text-slate-400 group-hover:text-[#17365D]'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {item.badge}
                  </span>
                )}

                {/* Collapsed Hover Tooltip */}
                {isCollapsed && (
                  <div className="hidden group-hover:block absolute left-full ml-2 px-2.5 py-1 bg-[#17365D] text-white text-[11px] font-medium rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Collapse Toggle & Officer Session Profile */}
        <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-3 truncate'}`}>
              <div className="w-8 h-8 rounded-full bg-[#17365D] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                {currentUser?.username.substring(0, 2).toUpperCase() || 'HQ'}
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <p className="text-xs font-bold text-[#172B4D] truncate">
                    {currentUser?.username || 'Officer'}
                  </p>
                  <p className="text-[10px] text-[#2563EB] font-semibold uppercase tracking-wider">
                    {currentUser?.role?.replace('_', ' ') || 'Admin'}
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapse/Expand Toggle Button (Desktop Only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex w-full mt-3 py-1.5 px-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-100 text-[#64748B] hover:text-[#172B4D] items-center justify-center text-xs font-medium transition"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            ) : (
              <div className="flex items-center space-x-1.5">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[11px]">Collapse menu</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb & Title */}
            <div>
              <div className="flex items-center space-x-1.5 text-[11px] text-[#64748B] font-medium">
                <span>PoliceHQ</span>
                <span>/</span>
                <span>{pageMeta.category}</span>
                <span>/</span>
                <span className="text-[#17365D] font-bold">{pageMeta.title}</span>
              </div>
              <h2 className="text-base font-bold text-[#172B4D] leading-none mt-0.5">
                {pageMeta.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Live Real-time Status Badge */}
            <div
              className={`hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold border ${
                isWsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isWsConnected ? 'animate-pulse text-emerald-600' : 'text-amber-600'}`} />
              <span>{isWsConnected ? 'Live WSS Active' : 'Polling Connection'}</span>
            </div>

            {/* Live Clock IST */}
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-[#64748B] font-mono bg-slate-50 px-3 py-1 rounded-lg border border-[#E2E8F0]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentTime}</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-500 hover:text-[#17365D] hover:bg-slate-100 transition"
                title="Geofence Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Geofence Event Alerts</span>
                      <p className="text-[10px] text-slate-400">Real-time perimeter entry & exit</p>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[11px] text-[#2563EB] hover:underline font-semibold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No active alerts or events
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-3 hover:bg-slate-50 text-xs transition">
                          <p className={`font-semibold ${n.type === 'entry' ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {n.text}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">{n.time} IST</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-100 bg-slate-50/50 text-center">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        setCurrentTab('notifications-alerts');
                      }}
                      className="text-xs text-[#17365D] font-bold hover:underline"
                    >
                      View All Alerts Feed &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              title="Refresh Data"
              className={`p-2 rounded-lg text-slate-500 hover:text-[#17365D] hover:bg-slate-100 transition ${
                refreshing ? 'animate-spin text-[#2563EB]' : ''
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Admin Profile Badge */}
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-full bg-[#17365D] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {currentUser?.username.substring(0, 2).toUpperCase() || 'AP'}
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-[#172B4D] leading-tight">
                  {currentUser?.username || 'Administrator'}
                </span>
                <span className="block text-[10px] text-[#64748B] font-medium leading-tight">
                  {currentUser?.role === 'super_admin' ? 'Super Admin' : 'HQ Admin'}
                </span>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F5F7FA]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-[#E2E8F0] shadow-2xl p-6">
            <div className="flex items-center space-x-3 text-slate-800 mb-2">
              <div className="p-2 rounded-full bg-rose-50 text-rose-600">
                <LogOut className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">Confirm Sign Out</h3>
            </div>
            <p className="text-xs text-[#64748B] mt-2 mb-6 leading-relaxed">
              Are you sure you want to end your administrative session for{' '}
              <strong className="text-slate-800">{currentUser?.username}</strong>? You will need to sign in again to access headquarters management.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
