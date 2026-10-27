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

  // Eluru District Police Headquarters Defaults
  static const String hqName = 'Eluru District Police Headquarters';
  static const double hqLatitude = 16.7107;
  static const double hqLongitude = 81.0952;
  static const double defaultGeofenceRadius = 150.0; // meters

  // Location Quality Thresholds
  static const double maxAcceptableAccuracyMeters = 35.0;
  static const int locationIntervalSeconds = 30;
}
