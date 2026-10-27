import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants.dart';
import '../models/user_model.dart';
import '../models/attendance_model.dart';
import '../models/location_observation.dart';
import '../models/headquarters_model.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _cachedToken;
  String? _customBaseUrl;

  static String normalizeUrl(String raw) {
    var url = raw.trim();
    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    if (!url.endsWith('/api/v1')) {
      url = '$url/api/v1';
    }
    return url;
  }

  Future<String> get baseUrl async {
    if (_customBaseUrl != null) return normalizeUrl(_customBaseUrl!);
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(AppConstants.keyCustomBaseUrl);
    // Automatically upgrade legacy localhost defaults to the current cloud production default
    if (saved == null || saved.contains('127.0.0.1')) {
      _customBaseUrl = AppConstants.defaultBaseUrl;
    } else {
      _customBaseUrl = saved;
    }
    return normalizeUrl(_customBaseUrl!);
  }

  Future<void> setBaseUrl(String newUrl) async {
    final normalized = normalizeUrl(newUrl);
    _customBaseUrl = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.keyCustomBaseUrl, normalized);
  }

  Future<String?> getToken() async {
    if (_cachedToken != null) return _cachedToken;
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString(AppConstants.keyToken);
    return _cachedToken;
  }

  Future<void> saveAuth(AuthResponse auth) async {
    _cachedToken = auth.accessToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.keyToken, auth.accessToken);
    await prefs.setString(AppConstants.keyUser, jsonEncode(auth.user.toJson()));
  }

  Future<UserModel?> getCachedUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString(AppConstants.keyUser);
      if (userJson != null) {
        return UserModel.fromJson(jsonDecode(userJson));
      }
    } catch (_) {}
    return null;
  }

  Future<HeadquartersModel?> getCachedHeadquarters() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final hqJson = prefs.getString(AppConstants.keyHeadquarters);
      if (hqJson != null) {
        return HeadquartersModel.fromJson(jsonDecode(hqJson));
      }
    } catch (_) {}
    return null;
  }

  Future<HeadquartersModel> getActiveHeadquarters() async {
    try {
      final url = Uri.parse('${await baseUrl}/headquarters/active');
      final response = await http.get(url, headers: await _headers(needsAuth: true));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final hq = HeadquartersModel.fromJson(data);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.keyHeadquarters, jsonEncode(hq.toJson()));
        return hq;
      }
    } catch (_) {}

    // Fallback: check cached or default
    final cached = await getCachedHeadquarters();
    if (cached != null) return cached;
    return HeadquartersModel(
      id: 'default',
      name: AppConstants.hqName,
      address: '',
      latitude: AppConstants.hqLatitude,
      longitude: AppConstants.hqLongitude,
      radiusMeters: AppConstants.defaultGeofenceRadius,
      status: 'ACTIVE',
      isPrimary: true,
    );
  }

  Future<void> clearAuth() async {
    _cachedToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.keyToken);
    await prefs.remove(AppConstants.keyUser);
  }

  Future<Map<String, String>> _headers({bool needsAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (needsAuth) {
      final token = await getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  // 1. Login
  Future<AuthResponse> login(String username, String password) async {
    final url = Uri.parse('${await baseUrl}/auth/login');
    final response = await http.post(
      url,
      headers: await _headers(needsAuth: false),
      body: jsonEncode({
        'username': username.trim(),
        'password': password.trim(),
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final auth = AuthResponse.fromJson(data);
      await saveAuth(auth);
      return auth;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Authentication failed (${response.statusCode})');
    }
  }

  // 2. Change Password (Mandatory First Login)
  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) async {
    final url = Uri.parse('${await baseUrl}/auth/change-password');
    final response = await http.post(
      url,
      headers: await _headers(needsAuth: true),
      body: jsonEncode({
        'old_password': oldPassword,
        'new_password': newPassword,
        'confirm_new_password': confirmNewPassword,
      }),
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Password change failed');
    }
  }

  // 3. Get Current User Info
  Future<UserModel> getMe() async {
    final url = Uri.parse('${await baseUrl}/auth/me');
    final response = await http.get(url, headers: await _headers(needsAuth: true));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final user = UserModel.fromJson(data);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.keyUser, jsonEncode(user.toJson()));
      return user;
    } else {
      throw Exception('Failed to load profile (${response.statusCode})');
    }
  }

  // 4. Submit Location Observation
  Future<Map<String, dynamic>> submitObservation(LocationObservationModel obs) async {
    final url = Uri.parse('${await baseUrl}/location/observations');
    final response = await http.post(
      url,
      headers: await _headers(needsAuth: true),
      body: jsonEncode(obs.toJson()),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Location submission failed');
    }
  }

  // 5. Sync Offline Location Observations
  Future<Map<String, dynamic>> syncOfflineObservations(List<LocationObservationModel> observations) async {
    if (observations.isEmpty) return {'processed_count': 0};
    final url = Uri.parse('${await baseUrl}/location/sync');
    final response = await http.post(
      url,
      headers: await _headers(needsAuth: true),
      body: jsonEncode({
        'observations': observations.map((o) => o.toJson()).toList(),
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Offline synchronization failed (${response.statusCode})');
    }
  }

  // 6. Get Attendance Visits
  Future<List<AttendanceVisitModel>> getMyAttendance({String? date, String? startDate, String? endDate}) async {
    try {
      var queryParams = <String, String>{};
      if (date != null) queryParams['date'] = date;
      if (startDate != null) queryParams['start_date'] = startDate;
      if (endDate != null) queryParams['end_date'] = endDate;

      final uri = Uri.parse('${await baseUrl}/attendance').replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
      var response = await http.get(uri, headers: await _headers(needsAuth: true));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded.map((item) => AttendanceVisitModel.fromJson(item)).toList();
        } else if (decoded is Map && decoded['history'] is List) {
          final List<dynamic> list = decoded['history'];
          return list.map((item) => AttendanceVisitModel.fromJson(item)).toList();
        }
      }

      // Fallback to /attendance/my-attendance
      final myUri = Uri.parse('${await baseUrl}/attendance/my-attendance');
      response = await http.get(myUri, headers: await _headers(needsAuth: true));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['history'] is List) {
          final List<dynamic> list = decoded['history'];
          return list.map((item) => AttendanceVisitModel.fromJson(item)).toList();
        } else if (decoded is List) {
          return decoded.map((item) => AttendanceVisitModel.fromJson(item)).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  // 7. Submit Attendance Correction Request
  Future<void> submitCorrectionRequest({
    required String visitId,
    required String reason,
    required String requestedChanges,
  }) async {
    final url = Uri.parse('${await baseUrl}/attendance/correction-requests');
    final response = await http.post(
      url,
      headers: await _headers(needsAuth: true),
      body: jsonEncode({
        'visit_id': visitId,
        'reason': reason,
        'requested_changes': requestedChanges,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Correction request failed');
    }
  }

  // 8. Logout
  Future<void> logout() async {
    try {
      final url = Uri.parse('${await baseUrl}/auth/logout');
      await http.post(url, headers: await _headers(needsAuth: true));
    } catch (_) {}
    await clearAuth();
  }
}
