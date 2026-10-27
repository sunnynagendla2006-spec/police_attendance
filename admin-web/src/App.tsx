import React, { useState, useEffect } from 'react';
import { User } from './types';
import { api } from './services/api';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { LiveMap } from './pages/LiveMap';
import { Attendance } from './pages/Attendance';
import { VisitHistory } from './pages/VisitHistory';
import { PoliceDirectory } from './pages/PoliceDirectory';
import { ReportsAnalytics } from './pages/ReportsAnalytics';
import { HeadquartersSettings } from './pages/HeadquartersSettings';
import { GeofenceSettings } from './pages/GeofenceSettings';
import { AuditLogs } from './pages/AuditLogs';
import { SystemHealth } from './pages/SystemHealth';
import { AccountSecurity } from './pages/AccountSecurity';
import { NotificationsAlerts } from './pages/NotificationsAlerts';
import { UserManagement } from './pages/UserManagement';
import { DutyAssignments } from './pages/DutyAssignments';
import { OutsideGeofenceReports } from './pages/OutsideGeofenceReports';
import { ScheduledReports } from './pages/ScheduledReports';
import { ReportDownloads } from './pages/ReportDownloads';
import { DeviceManagement } from './pages/DeviceManagement';
import { AppUsageSummaryPage } from './pages/AppUsageSummary';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => api.getCurrentUser());
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return sessionStorage.getItem('policehq_active_tab') || 'dashboard';
  });
  const [selectedMapOfficerId, setSelectedMapOfficerId] = useState<string | undefined>(undefined);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    try {
      sessionStorage.setItem('policehq_active_tab', tab);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Listen for auth logout or error events
    const handleLogout = () => {
      setCurrentUser(null);
    };
    window.addEventListener('policehq_auth_logout', handleLogout);
    window.addEventListener('policehq_auth_error', handleLogout);

    return () => {
      window.removeEventListener('policehq_auth_logout', handleLogout);
      window.removeEventListener('policehq_auth_error', handleLogout);
    };
  }, []);

  const handleLoginSuccess = () => {
    const user = api.getCurrentUser();
    setCurrentUser(user);
    const savedTab = sessionStorage.getItem('policehq_active_tab') || 'dashboard';
    setCurrentTab(savedTab);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  const navigateToMap = (officerId?: string) => {
    setSelectedMapOfficerId(officerId);
    handleTabChange('live-map');
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
      case 'overview':
        return <Overview onNavigate={(tab) => handleTabChange(tab)} />;
      case 'live-map':
        return <LiveMap targetOfficerId={selectedMapOfficerId} />;
      case 'duty-assignments':
        return <DutyAssignments />;
      case 'outside-geofence':
        return <OutsideGeofenceReports />;
      case 'police-personnel':
      case 'police-directory':
        return <PoliceDirectory onNavigateToMap={navigateToMap} />;
      case 'registered-devices':
        return <DeviceManagement />;
      case 'app-usage':
        return <AppUsageSummaryPage />;
      case 'attendance':
        return <Attendance />;
      case 'station-visits':
      case 'visit-history':
        return <VisitHistory />;
      case 'attendance-history':
      case 'audit-logs':
        return <AuditLogs />;
      case 'scheduled-reports':
        return <ScheduledReports />;
      case 'report-downloads':
        return <ReportDownloads />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'headquarters-settings':
      case 'admin/headquarters-settings':
      case 'geofence-settings':
        return <HeadquartersSettings />;
      case 'notifications-alerts':
        return <NotificationsAlerts onNavigateToMap={navigateToMap} />;
      case 'user-management':
        return <UserManagement currentUser={currentUser} />;
      case 'system-settings':
      case 'system-health':
        return <SystemHealth />;
      case 'account-security':
        return <AccountSecurity currentUser={currentUser} />;
      default:
        return <Overview onNavigate={(tab) => handleTabChange(tab)} />;
    }
  };

  return (
    <DashboardLayout
      currentTab={currentTab}
      setCurrentTab={handleTabChange}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default App;
