import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/attendance_model.dart';
import '../services/api_service.dart';

class VisitHistoryScreen extends StatefulWidget {
  const VisitHistoryScreen({super.key});

  @override
  State<VisitHistoryScreen> createState() => _VisitHistoryScreenState();
}

class _VisitHistoryScreenState extends State<VisitHistoryScreen> {
  final _apiService = ApiService();
  List<AttendanceVisitModel> _historyVisits = [];
  bool _isLoading = true;
  String _selectedFilter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    setState(() => _isLoading = true);
    try {
      final now = DateTime.now();
      String? startDate;
      if (_selectedFilter == '7days') {
        startDate = now.subtract(const Duration(days: 7)).toIso8601String().split('T')[0];
      } else if (_selectedFilter == '30days') {
        startDate = now.subtract(const Duration(days: 30)).toIso8601String().split('T')[0];
      }

      final visits = await _apiService.getMyAttendance(startDate: startDate);
      setState(() {
        _historyVisits = visits;
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Filter Chips Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppTheme.borderLight)),
          ),
          child: Row(
            children: [
              const Text('Filter: ', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('All History', style: TextStyle(fontSize: 12)),
                selected: _selectedFilter == 'all',
                selectedColor: AppTheme.policeNavy.withOpacity(0.12),
                labelStyle: TextStyle(
                  color: _selectedFilter == 'all' ? AppTheme.policeNavy : AppTheme.textSecondary,
                  fontWeight: _selectedFilter == 'all' ? FontWeight.w700 : FontWeight.normal,
                ),
                onSelected: (val) {
                  if (val) {
                    setState(() => _selectedFilter = 'all');
                    _fetchHistory();
                  }
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Last 7 Days', style: TextStyle(fontSize: 12)),
                selected: _selectedFilter == '7days',
                selectedColor: AppTheme.policeNavy.withOpacity(0.12),
                labelStyle: TextStyle(
                  color: _selectedFilter == '7days' ? AppTheme.policeNavy : AppTheme.textSecondary,
                  fontWeight: _selectedFilter == '7days' ? FontWeight.w700 : FontWeight.normal,
                ),
                onSelected: (val) {
                  if (val) {
                    setState(() => _selectedFilter = '7days');
                    _fetchHistory();
                  }
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Last 30 Days', style: TextStyle(fontSize: 12)),
                selected: _selectedFilter == '30days',
                selectedColor: AppTheme.policeNavy.withOpacity(0.12),
                labelStyle: TextStyle(
                  color: _selectedFilter == '30days' ? AppTheme.policeNavy : AppTheme.textSecondary,
                  fontWeight: _selectedFilter == '30days' ? FontWeight.w700 : FontWeight.normal,
                ),
                onSelected: (val) {
                  if (val) {
                    setState(() => _selectedFilter = '30days');
                    _fetchHistory();
                  }
                },
              ),
            ],
          ),
        ),

        // List
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.policeNavy))
              : _historyVisits.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.event_note, size: 48, color: Color(0xFFCBD5E1)),
                          SizedBox(height: 12),
                          Text('No past headquarters visits found', style: TextStyle(color: AppTheme.textMain, fontSize: 15, fontWeight: FontWeight.w600)),
                          SizedBox(height: 4),
                          Text('Visits to Eluru HQ will be archived here.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchHistory,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _historyVisits.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final v = _historyVisits[index];
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(Icons.apartment, color: AppTheme.policeNavy, size: 24),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          v.headquartersName,
                                          style: const TextStyle(color: AppTheme.textMain, fontWeight: FontWeight.bold, fontSize: 14),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'In: ${v.formattedEntryTime}',
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                        ),
                                        Text(
                                          'Out: ${v.formattedExitTime}',
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        v.durationString,
                                        style: const TextStyle(color: AppTheme.policeBlue, fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                      const SizedBox(height: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF1F5F9),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(color: AppTheme.borderLight),
                                        ),
                                        child: Text(
                                          v.entryVerificationStatus.toUpperCase(),
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 9, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
