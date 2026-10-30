class AppConstants {
  // Production Render Cloud Backend:
  static const String defaultBaseUrl = 'https://police-attendance.onrender.com/api/v1';
  // Fallbacks:
  // For Physical Device over USB (with adb reverse): http://127.0.0.1:8000/api/v1
  // For Physical Device over Wi-Fi: http://192.168.6.112:8000/api/v1
  // For Android Studio Emulator: http://10.0.2.2:8000/api/v1

  // Storage Keys
  static const String keyToken = 'jwt_access_token';
  static const String keyRefreshToken = 'jwt_refresh_token';
  static const String keyUser = 'user_profile_data';
  static const String keyHeadquarters = 'cached_active_headquarters';
  static const String keyOfflineQueue = 'offline_gps_observations_queue';
  static const String keyCustomBaseUrl = 'custom_api_base_url';
  static const String keyTrackingActive = 'location_tracking_active_flag';
  static const String keyDeviceId = 'bound_hardware_device_id';
  static const String keyActiveAssignment = 'cached_duty_assignment';

  // Eluru District Police Headquarters Defaults
  static const String hqName = 'Eluru District Police Headquarters';
  static const double hqLatitude = 16.7107;
  static const double hqLongitude = 81.0952;
  static const double defaultGeofenceRadius = 150.0; // meters

  // Location Quality Thresholds
  static const double maxAcceptableAccuracyMeters = 35.0;
  static const int locationIntervalSeconds = 30;

  // Mandatory Duty Monitoring Window (local device time)
  // Location tracking runs automatically for the full window below and
  // cannot be paused by the officer from within the app.
  static const int dutyStartHour = 9;
  static const int dutyStartMinute = 30;
  static const int dutyEndHour = 18;
  static const int dutyEndMinute = 0;
  static const int dutyWindowCheckSeconds = 60;

  // Digital Wellbeing
  static const String keyPermissionsOnboardingComplete = 'permissions_onboarding_complete_flag';
  static const int appUsageReportIntervalMinutes = 30;
}
