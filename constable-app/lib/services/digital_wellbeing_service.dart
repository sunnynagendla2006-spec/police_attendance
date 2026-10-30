import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:usage_stats/usage_stats.dart';
import '../core/constants.dart';
import 'api_service.dart';

/// Reports aggregate on-duty screen-time / app-usage to the backend so
/// supervisors can see how much of duty hours is spent on-screen.
///
/// Only aggregate per-app foreground durations are read via Android's
/// UsageStatsManager - no keystrokes, screenshots, messages, or browsing
/// content are ever accessed.
class DigitalWellbeingService {
  static final DigitalWellbeingService _instance = DigitalWellbeingService._internal();
  factory DigitalWellbeingService() => _instance;
  DigitalWellbeingService._internal();

  final ApiService _apiService = ApiService();
  Timer? _reportTimer;

  void start() {
    _reportTimer?.cancel();
    // Report shortly after startup, then on a fixed interval through the day.
    unawaited(reportNow());
    _reportTimer = Timer.periodic(
      const Duration(minutes: AppConstants.appUsageReportIntervalMinutes),
      (_) => reportNow(),
    );
  }

  void stop() {
    _reportTimer?.cancel();
  }

  Future<void> reportNow() async {
    try {
      final granted = await UsageStats.checkUsagePermission() ?? false;
      if (!granted) return;

      final now = DateTime.now();
      final startOfDay = DateTime(now.year, now.month, now.day);
      final usageList = await UsageStats.queryUsageStats(startOfDay, now);

      double totalMinutes = 0;
      final apps = <Map<String, dynamic>>[];
      for (final info in usageList) {
        final ms = int.tryParse(info.totalTimeInForeground ?? '0') ?? 0;
        if (ms <= 0) continue;
        final minutes = ms / 60000.0;
        totalMinutes += minutes;
        apps.add({
          'package_name': info.packageName ?? 'unknown',
          'app_name': info.packageName ?? 'unknown',
          'foreground_duration_minutes': minutes,
          'is_work_app': false,
        });
      }

      apps.sort((a, b) =>
          (b['foreground_duration_minutes'] as double).compareTo(a['foreground_duration_minutes'] as double));

      final payload = {
        'reporting_date': DateFormat('yyyy-MM-dd').format(startOfDay),
        'permission_granted': true,
        'total_foreground_minutes': totalMinutes,
        'apps': apps.take(50).toList(),
        'collected_at': now.toUtc().toIso8601String(),
      };

      await _apiService.submitAppUsage(payload);
    } catch (e) {
      // Non-critical background reporting - never surface this to the officer.
      debugPrint('Digital wellbeing report skipped: $e');
    }
  }
}
