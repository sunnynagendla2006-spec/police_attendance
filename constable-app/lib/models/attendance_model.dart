import 'package:intl/intl.dart';

class AttendanceVisitModel {
  final String id;
  final String officerId;
  final String? officerName;
  final String headquartersName;
  final DateTime entryAt;
  final DateTime? exitAt;
  final int? durationSeconds;
  final String entryVerificationStatus;
  final String? exitVerificationStatus;
  final String visitStatus;
  final String? correctionStatus;
  final bool isOvernight;

  AttendanceVisitModel({
    required this.id,
    required this.officerId,
    this.officerName,
    required this.headquartersName,
    required this.entryAt,
    this.exitAt,
    this.durationSeconds,
    required this.entryVerificationStatus,
    this.exitVerificationStatus,
    required this.visitStatus,
    this.correctionStatus,
    this.isOvernight = false,
  });

  factory AttendanceVisitModel.fromJson(Map<String, dynamic> json) {
    return AttendanceVisitModel(
      id: json['id'] ?? json['_id'] ?? '',
      officerId: json['officer_id'] ?? '',
      officerName: json['officer_name'],
      headquartersName: json['headquarters_name'] ?? 'Eluru District Police Headquarters',
      entryAt: json['entry_at'] != null ? DateTime.parse(json['entry_at']).toLocal() : DateTime.now(),
      exitAt: json['exit_at'] != null ? DateTime.parse(json['exit_at']).toLocal() : null,
      durationSeconds: json['duration_seconds'],
      entryVerificationStatus: json['entry_verification_status'] ?? 'verified',
      exitVerificationStatus: json['exit_verification_status'],
      visitStatus: json['visit_status'] ?? 'completed',
      correctionStatus: json['correction_status'],
      isOvernight: json['is_overnight'] ?? false,
    );
  }

  String get formattedEntryTime => DateFormat('dd MMM yyyy, hh:mm a').format(entryAt);
  String get formattedExitTime => exitAt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(exitAt!) : 'Present inside HQ';

  String get durationString {
    if (durationSeconds == null) {
      if (visitStatus == 'in_progress') {
        final currentElapsed = DateTime.now().difference(entryAt).inSeconds;
        final h = currentElapsed ~/ 3600;
        final m = (currentElapsed % 3600) ~/ 60;
        return '${h}h ${m}m (Active)';
      }
      return 'In Progress';
    }
    final h = durationSeconds! ~/ 3600;
    final m = (durationSeconds! % 3600) ~/ 60;
    return '${h}h ${m}m';
  }
}

class DailyAttendanceSummary {
  final String date;
  final int totalVisits;
  final int totalDurationSeconds;
  final String? currentStatus; // INSIDE, OUTSIDE, STALE, UNKNOWN
  final List<AttendanceVisitModel> visits;

  DailyAttendanceSummary({
    required this.date,
    required this.totalVisits,
    required this.totalDurationSeconds,
    this.currentStatus,
    required this.visits,
  });

  String get totalDurationString {
    final h = totalDurationSeconds ~/ 3600;
    final m = (totalDurationSeconds % 3600) ~/ 60;
    return '${h}h ${m}m';
  }
}
