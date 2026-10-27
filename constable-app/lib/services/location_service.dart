import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants.dart';
import '../models/location_observation.dart';
import 'api_service.dart';
import 'offline_queue_service.dart';

enum TrackingState {
  unknown,
  outside,
  inside,
  gpsDisabled,
  permissionDenied,
  stale,
  offline,
}

class LocationTrackingService extends ChangeNotifier {
  static final LocationTrackingService _instance = LocationTrackingService._internal();
  factory LocationTrackingService() => _instance;
  LocationTrackingService._internal();

  final ApiService _apiService = ApiService();
  final OfflineQueueService _queueService = OfflineQueueService();

  StreamSubscription<Position>? _positionStream;
  Timer? _heartbeatTimer;

  bool _isTracking = false;
  TrackingState _state = TrackingState.unknown;
  Position? _lastPosition;
  DateTime? _lastUpdateTime;
  String _statusMessage = 'Tracking idle';
  double _distanceToHQ = 0.0;
  bool _isInsideGeofence = false;

  String _hqName = AppConstants.hqName;
  double _hqLatitude = AppConstants.hqLatitude;
  double _hqLongitude = AppConstants.hqLongitude;
  double _hqRadius = AppConstants.defaultGeofenceRadius;

  bool get isTracking => _isTracking;
  TrackingState get state => _state;
  Position? get lastPosition => _lastPosition;
  DateTime? get lastUpdateTime => _lastUpdateTime;
  String get statusMessage => _statusMessage;
  double get distanceToHQ => _distanceToHQ;
  bool get isInsideGeofence => _isInsideGeofence;
  String get hqName => _hqName;
  double get hqLatitude => _hqLatitude;
  double get hqLongitude => _hqLongitude;
  double get hqRadius => _hqRadius;

  void updateHeadquarters({required String name, required double lat, required double lon, required double radius}) {
    _hqName = name;
    _hqLatitude = lat;
    _hqLongitude = lon;
    _hqRadius = radius;
    if (_lastPosition != null) {
      _distanceToHQ = Geolocator.distanceBetween(
        _lastPosition!.latitude,
        _lastPosition!.longitude,
        _hqLatitude,
        _hqLongitude,
      );
      _isInsideGeofence = _distanceToHQ <= _hqRadius;
      _state = _isInsideGeofence ? TrackingState.inside : TrackingState.outside;
    }
    notifyListeners();
  }

  Future<void> initialize() async {
    final cachedHq = await _apiService.getCachedHeadquarters();
    if (cachedHq != null) {
      _hqName = cachedHq.name;
      _hqLatitude = cachedHq.latitude;
      _hqLongitude = cachedHq.longitude;
      _hqRadius = cachedHq.radiusMeters;
    }

    final prefs = await SharedPreferences.getInstance();
    final shouldTrack = prefs.getBool(AppConstants.keyTrackingActive) ?? false;
    if (shouldTrack) {
      await startTracking();
    }
  }

  Future<bool> checkPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _state = TrackingState.gpsDisabled;
      _statusMessage = 'GPS / Location services disabled on device';
      notifyListeners();
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _state = TrackingState.permissionDenied;
        _statusMessage = 'Location permission denied by officer';
        notifyListeners();
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      _state = TrackingState.permissionDenied;
      _statusMessage = 'Location permissions permanently denied in OS settings';
      notifyListeners();
      return false;
    }

    return true;
  }

  Future<void> startTracking() async {
    final hasPerm = await checkPermissions();
    if (!hasPerm) return;

    _isTracking = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConstants.keyTrackingActive, true);
    _statusMessage = 'Location monitoring active';
    notifyListeners();

    // 1. Get initial position immediately
    await sendCurrentLocation();

    // 2. Start streaming positions with balanced accuracy (fast satellite/Wi-Fi fix)
    final locationSettings = const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 0,
    );

    _positionStream?.cancel();
    _positionStream = Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      _onPositionUpdate,
      onError: (err) {
        _statusMessage = 'Location stream error: $err';
        notifyListeners();
      },
    );

    // 3. Periodic timer to send heartbeats and flush offline queue
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: AppConstants.locationIntervalSeconds), (_) async {
      await _queueService.flushQueue();
      await sendCurrentLocation();
    });
  }

  Future<void> stopTracking() async {
    _isTracking = false;
    _positionStream?.cancel();
    _heartbeatTimer?.cancel();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConstants.keyTrackingActive, false);
    _statusMessage = 'Tracking paused by officer';
    notifyListeners();
  }

  Future<void> sendCurrentLocation() async {
    try {
      // 1. Fast path: send last known position immediately
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null && _lastPosition == null) {
        await _onPositionUpdate(lastKnown);
      }

      // 2. Fresh GPS fix with balanced accuracy (fast and works indoors)
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      await _onPositionUpdate(position);
    } catch (e) {
      debugPrint('Location retrieval note: $e');
      if (_lastPosition != null) {
        // Fall back to broadcasting last known position to prevent stale state
        try {
          await _onPositionUpdate(_lastPosition!);
        } catch (_) {}
      } else {
        _statusMessage = 'Acquiring GPS fix...';
        notifyListeners();
      }
    }
  }

  Future<void> _onPositionUpdate(Position position) async {
    _lastPosition = position;
    _lastUpdateTime = DateTime.now();

    // Calculate distance to active operational Headquarters
    _distanceToHQ = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      _hqLatitude,
      _hqLongitude,
    );

    // Rough client-side estimation (authoritative logic is on the FastAPI backend)
    _isInsideGeofence = _distanceToHQ <= _hqRadius;
    _state = _isInsideGeofence ? TrackingState.inside : TrackingState.outside;

    final obs = LocationObservationModel(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      observedAt: DateTime.now(),
      altitudeMeters: position.altitude,
      speedMps: position.speed,
    );

    try {
      final res = await _apiService.submitObservation(obs);
      _statusMessage = 'Synced (${res['state'] ?? 'OK'} - ${_distanceToHQ.toStringAsFixed(0)}m from HQ)';
      // Flush any queued offline items if online
      await _queueService.flushQueue();
    } catch (e) {
      // Network failed or offline: enqueue for later synchronization
      await _queueService.enqueueObservation(obs);
      _state = TrackingState.offline;
      _statusMessage = 'Offline: Observation stored locally for sync';
    }

    notifyListeners();
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    _heartbeatTimer?.cancel();
    super.dispose();
  }
}
