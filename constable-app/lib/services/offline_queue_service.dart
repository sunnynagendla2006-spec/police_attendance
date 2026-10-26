import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants.dart';
import '../models/location_observation.dart';
import 'api_service.dart';

class OfflineQueueService {
  static final OfflineQueueService _instance = OfflineQueueService._internal();
  factory OfflineQueueService() => _instance;
  OfflineQueueService._internal();

  final ApiService _apiService = ApiService();
  bool _isSyncing = false;

  Future<void> enqueueObservation(LocationObservationModel obs) async {
    final prefs = await SharedPreferences.getInstance();
    final List<String> queue = prefs.getStringList(AppConstants.keyOfflineQueue) ?? [];
    queue.add(jsonEncode(obs.toJson()));
    // Keep max 500 queued observations to prevent unbounded local storage
    if (queue.length > 500) {
      queue.removeRange(0, queue.length - 500);
    }
    await prefs.setStringList(AppConstants.keyOfflineQueue, queue);
  }

  Future<int> getQueuedCount() async {
    final prefs = await SharedPreferences.getInstance();
    final List<String> queue = prefs.getStringList(AppConstants.keyOfflineQueue) ?? [];
    return queue.length;
  }

  Future<int> flushQueue() async {
    if (_isSyncing) return 0;
    _isSyncing = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final List<String> queue = prefs.getStringList(AppConstants.keyOfflineQueue) ?? [];
      if (queue.isEmpty) {
        _isSyncing = false;
        return 0;
      }

      // Convert stored JSON to observations
      final List<LocationObservationModel> observations = [];
      for (final raw in queue) {
        try {
          observations.add(LocationObservationModel.fromJson(jsonDecode(raw)));
        } catch (_) {}
      }

      if (observations.isEmpty) {
        await prefs.remove(AppConstants.keyOfflineQueue);
        _isSyncing = false;
        return 0;
      }

      // Sync in batches of 50
      final batch = observations.take(50).toList();
      final result = await _apiService.syncOfflineObservations(batch);
      final int processed = result['processed_count'] ?? batch.length;

      // Remove synced items
      final remaining = queue.skip(batch.length).toList();
      await prefs.setStringList(AppConstants.keyOfflineQueue, remaining);

      _isSyncing = false;
      return processed;
    } catch (e) {
      _isSyncing = false;
      return 0;
    }
  }

  Future<void> clearQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.keyOfflineQueue);
  }
}
