import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/attendance_model.dart';
import '../services/api_service.dart';

class MyAttendanceScreen extends StatefulWidget {
  const MyAttendanceScreen({super.key});

  @override
  State<MyAttendanceScreen> createState() => _MyAttendanceScreenState();
}

class _MyAttendanceScreenState extends State<MyAttendanceScreen> {
  final _apiService = ApiService();
  List<AttendanceVisitModel> _visits = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTodayAttendance();
  }

  Future<void> _loadTodayAttendance() async {
    setState(() => _isLoading = true);
    try {
      final visits = await _apiService.getMyAttendance();
      setState(() {
        _visits = visits;
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showCorrectionDialog(AttendanceVisitModel visit) {
    final reasonController = TextEditingController();
    final changesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Request Visit Correction', style: TextStyle(color: AppTheme.textMain, fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Visit: ${visit.formattedEntryTime}',
                style: const TextStyle(color: AppTheme.policeBlue, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Reason for correction',
                  hintText: 'e.g., GPS delayed exit event',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: changesController,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Requested changes',
                  hintText: 'e.g., Exited at 17:30',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              final reason = reasonController.text.trim();
              final changes = changesController.text.trim();
              if (reason.isEmpty) return;

              try {
                await _apiService.submitCorrectionRequest(
                  visitId: visit.id,
                  reason: reason,
                  requestedChanges: changes.isNotEmpty ? changes : 'Attendance timestamp review requested',
                );
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: AppTheme.policeSuccess,
                      content: Text('Correction request submitted to Headquarters Admin for review.'),
                    ),
                  );
                }
              } catch (e) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(backgroundColor: AppTheme.policeDanger, content: Text('Error: $e')),
                  );
                }
              }
            },
            child: const Text('Submit Request'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.policeNavy));
    }

    if (_visits.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadTodayAttendance,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: const [
            SizedBox(height: 60),
            Center(
              child: Icon(Icons.history, size: 60, color: Color(0xFFCBD5E1)),
            ),
            SizedBox(height: 16),
            Text(
              'No Headquarters Visits Recorded Today',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textMain, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 8),
            Text(
              'When you enter the Eluru District Police Headquarters geofence with location tracking enabled, your visit will automatically appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadTodayAttendance,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _visits.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final visit = _visits[index];
          final isInProgress = visit.visitStatus == 'in_progress';

          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: isInProgress ? AppTheme.policeSuccess.withOpacity(0.12) : const Color(0xFFF1F5F9),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isInProgress ? Icons.login : Icons.check_circle_outline,
                              size: 16,
                              color: isInProgress ? AppTheme.policeSuccess : AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Visit #${_visits.length - index}',
                            style: const TextStyle(color: AppTheme.textMain, fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isInProgress
                              ? AppTheme.policeSuccess.withOpacity(0.12)
                              : AppTheme.policeBlue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isInProgress ? AppTheme.policeSuccess.withOpacity(0.3) : AppTheme.policeBlue.withOpacity(0.2),
                          ),
                        ),
                        child: Text(
                          isInProgress ? 'ACTIVE (INSIDE)' : visit.durationString,
                          style: TextStyle(
                            color: isInProgress ? AppTheme.policeSuccess : AppTheme.policeBlue,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: AppTheme.borderLight, height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ENTRY TIME', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 3),
                            Text(visit.formattedEntryTime, style: const TextStyle(color: AppTheme.textMain, fontSize: 13, fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('EXIT TIME', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 3),
                            Text(
                              visit.formattedExitTime,
                              style: TextStyle(
                                color: isInProgress ? AppTheme.policeSuccess : AppTheme.textMain,
                                fontSize: 13,
                                fontWeight: isInProgress ? FontWeight.bold : FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            visit.entryVerificationStatus == 'verified' ? Icons.check : Icons.help_outline,
                            size: 14,
                            color: AppTheme.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Verification: ${visit.entryVerificationStatus.toUpperCase()}',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                      TextButton.icon(
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                        onPressed: () => _showCorrectionDialog(visit),
                        icon: const Icon(Icons.edit_note, size: 16, color: AppTheme.policeGold),
                        label: const Text('Discrepancy?', style: TextStyle(color: AppTheme.policeGold, fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
