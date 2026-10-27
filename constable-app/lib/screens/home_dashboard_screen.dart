import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/user_model.dart';
import '../models/attendance_model.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../services/offline_queue_service.dart';
import 'my_attendance_screen.dart';
import 'visit_history_screen.dart';
import 'permissions_screen.dart';
import 'profile_screen.dart';

class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  final _apiService = ApiService();
  final _locationService = LocationTrackingService();
  final _queueService = OfflineQueueService();

  UserModel? _user;
  List<AttendanceVisitModel> _todayVisits = [];
  Map<String, dynamic>? _activeAssignment;
  bool _isLoading = true;
  int _queuedCount = 0;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _locationService.addListener(_onLocationUpdate);
    _initializeData();
  }

  @override
  void dispose() {
    _locationService.removeListener(_onLocationUpdate);
    super.dispose();
  }

  void _onLocationUpdate() {
    if (mounted) setState(() {});
  }

  Future<void> _initializeData() async {
    // 1. Immediately display cached user profile so there is no empty state
    final cachedUser = await _apiService.getCachedUser();
    if (cachedUser != null && mounted) {
      setState(() {
        _user = cachedUser;
        _isLoading = false;
      });
    }

    // 2. Load cached headquarters into location tracking
    final cachedHq = await _apiService.getCachedHeadquarters();
    if (cachedHq != null) {
      _locationService.updateHeadquarters(
        name: cachedHq.name,
        lat: cachedHq.latitude,
        lon: cachedHq.longitude,
        radius: cachedHq.radiusMeters,
      );
    }

    // 3. Fetch fresh user profile from backend
    try {
      final user = await _apiService.getMe();
      if (mounted) {
        setState(() => _user = user);
      }
    } catch (e) {
      debugPrint('Note: /auth/me fetch error: $e');
    }

    // 4. Fetch dynamic active headquarters (updated by admin on web)
    try {
      final hq = await _apiService.getActiveHeadquarters();
      _locationService.updateHeadquarters(
        name: hq.name,
        lat: hq.latitude,
        lon: hq.longitude,
        radius: hq.radiusMeters,
      );
    } catch (e) {
      debugPrint('Note: /headquarters/active fetch error: $e');
    }

    // 5. Fetch active duty assignment
    try {
      final assignment = await _apiService.getMyActiveAssignment();
      if (mounted && assignment != null) {
        setState(() => _activeAssignment = assignment);
      }
    } catch (_) {}

    // 6. Fetch personal attendance records
    try {
      final visits = await _apiService.getMyAttendance();
      if (mounted) {
        setState(() => _todayVisits = visits);
      }
    } catch (e) {
      debugPrint('Note: attendance fetch error: $e');
    }

    // 7. Check queued offline items
    try {
      final queued = await _queueService.getQueuedCount();
      if (mounted) {
        setState(() => _queuedCount = queued);
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isLoading = false);
    }

    // Initialize location service
    await _locationService.initialize();
  }

  Future<void> _refreshData() async {
    // Refresh user profile
    try {
      final user = await _apiService.getMe();
      if (mounted) setState(() => _user = user);
    } catch (_) {}

    // Refresh active headquarters (e.g., changed on admin website)
    try {
      final hq = await _apiService.getActiveHeadquarters();
      _locationService.updateHeadquarters(
        name: hq.name,
        lat: hq.latitude,
        lon: hq.longitude,
        radius: hq.radiusMeters,
      );
    } catch (_) {}

    // Refresh active assignment
    try {
      final assignment = await _apiService.getMyActiveAssignment();
      if (mounted) setState(() => _activeAssignment = assignment);
    } catch (_) {}

    // Refresh attendance & queue
    try {
      final visits = await _apiService.getMyAttendance();
      final queued = await _queueService.getQueuedCount();
      if (mounted) {
        setState(() {
          _todayVisits = visits;
          _queuedCount = queued;
        });
      }
    } catch (_) {}
  }

  int get _totalDurationSecondsToday {
    int total = 0;
    for (final v in _todayVisits) {
      if (v.durationSeconds != null) {
        total += v.durationSeconds!;
      } else if (v.visitStatus == 'in_progress') {
        total += DateTime.now().difference(v.entryAt).inSeconds;
      }
    }
    return total;
  }

  String _formatDuration(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    return '${h}h ${m}m';
  }

  Widget _buildHomeTab() {
    final profile = _user?.profile;
    final isTracking = _locationService.isTracking;
    final isInside = _locationService.isInsideGeofence;
    final dist = _locationService.distanceToHQ;

    return RefreshIndicator(
      onRefresh: _refreshData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Officer Profile Banner Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppTheme.policeNavy,
                      child: Text(
                        (profile?.fullName.isNotEmpty ?? false) ? profile!.fullName[0].toUpperCase() : 'P',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (profile?.fullName.isNotEmpty ?? false) ? profile!.fullName : (_user?.username ?? 'Officer'),
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppTheme.textMain),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${(profile?.rank.isNotEmpty ?? false) ? profile!.rank : "Constable"} • ${(profile?.officerId.isNotEmpty ?? false) ? profile!.officerId : (_user?.username ?? "")}',
                            style: const TextStyle(color: AppTheme.policeBlue, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                          Text(
                            (profile?.department.isNotEmpty ?? false) ? profile!.department : _locationService.hqName,
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Active Duty Station Card
            if (_activeAssignment != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBFDBFE), width: 1.2),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_outlined, color: AppTheme.policeBlue, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ASSIGNED DUTY STATION',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.policeNavy,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            _activeAssignment!['location_name'] ?? 'Assigned Station',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textMain,
                            ),
                          ),
                          if (_activeAssignment!['notes'] != null)
                            Text(
                              _activeAssignment!['notes'],
                              style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'ACTIVE',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Real-Time Geofence Presence Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isInside ? const Color(0xFFF0FDF4) : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isInside ? AppTheme.policeSuccess : AppTheme.borderLight,
                  width: isInside ? 1.5 : 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isInside ? Icons.verified : Icons.location_on,
                            color: isInside ? AppTheme.policeSuccess : AppTheme.policeBlue,
                            size: 22,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isInside ? 'INSIDE HEADQUARTERS' : 'OUTSIDE HEADQUARTERS',
                            style: TextStyle(
                              color: isInside ? AppTheme.policeSuccess : AppTheme.policeNavy,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isTracking ? AppTheme.policeSuccess.withOpacity(0.12) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isTracking ? AppTheme.policeSuccess.withOpacity(0.3) : AppTheme.borderLight,
                          ),
                        ),
                        child: Text(
                          isTracking ? 'GPS ACTIVE' : 'IDLE',
                          style: TextStyle(
                            color: isTracking ? AppTheme.policeSuccess : AppTheme.textSecondary,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isInside
                        ? 'Reporting inside ${_locationService.hqName} (Radius ${_locationService.hqRadius.toInt()}m). Active visit recorded.'
                        : 'Distance to ${_locationService.hqName}: ${dist > 1000 ? "${(dist / 1000).toStringAsFixed(1)} km" : "${dist.toStringAsFixed(0)} m"}.',
                    style: const TextStyle(color: AppTheme.textMain, fontSize: 13, height: 1.3),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _locationService.statusMessage,
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Summary Stats Grid
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Today\'s Visits', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                          const SizedBox(height: 6),
                          Text(
                            '${_todayVisits.length}',
                            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.policeNavy),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _todayVisits.any((v) => v.visitStatus == 'in_progress') ? '1 active currently' : 'Completed',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _todayVisits.any((v) => v.visitStatus == 'in_progress')
                                  ? AppTheme.policeSuccess
                                  : AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total HQ Time', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                          const SizedBox(height: 6),
                          Text(
                            _formatDuration(_totalDurationSecondsToday),
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.policeBlue),
                          ),
                          const SizedBox(height: 4),
                          const Text('Today\'s recorded stay', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Sync Status & Offline Queue Notice
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14.0),
                child: Row(
                  children: [
                    Icon(
                      _queuedCount > 0 ? Icons.cloud_queue : Icons.cloud_done,
                      color: _queuedCount > 0 ? AppTheme.policeWarning : AppTheme.policeSuccess,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _queuedCount > 0 ? '$_queuedCount Offline Observations Pending' : 'Sync Status: All Synchronized',
                            style: const TextStyle(color: AppTheme.textMain, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _locationService.lastUpdateTime != null
                                ? 'Last GPS update: ${DateFormat('hh:mm:ss a').format(_locationService.lastUpdateTime!)}'
                                : 'Awaiting first GPS capture',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    if (_queuedCount > 0)
                      TextButton(
                        onPressed: () async {
                          final count = await _queueService.flushQueue();
                          await _refreshData();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Synchronized $count queued observations')),
                            );
                          }
                        },
                        child: const Text('Sync Now', style: TextStyle(color: AppTheme.policeBlue, fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Action Buttons
            ElevatedButton.icon(
              onPressed: () async {
                await _locationService.sendCurrentLocation();
                await _refreshData();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Location reported and geofence status refreshed.')),
                  );
                }
              },
              icon: const Icon(Icons.my_location),
              label: const Text('REPORT LOCATION NOW'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.policeNavy,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
            const SizedBox(height: 10),

            OutlinedButton.icon(
              onPressed: () async {
                if (isTracking) {
                  await _locationService.stopTracking();
                } else {
                  await _locationService.startTracking();
                }
              },
              icon: Icon(isTracking ? Icons.pause_circle_outline : Icons.play_circle_outline),
              label: Text(isTracking ? 'PAUSE MONITORING' : 'START CONTINUOUS MONITORING'),
              style: OutlinedButton.styleFrom(
                foregroundColor: isTracking ? AppTheme.policeWarning : AppTheme.policeNavy,
                side: BorderSide(color: isTracking ? AppTheme.policeWarning : AppTheme.borderLight),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppTheme.pageBackground,
        body: Center(child: CircularProgressIndicator(color: AppTheme.policeNavy)),
      );
    }

    final pages = [
      _buildHomeTab(),
      const MyAttendanceScreen(),
      const VisitHistoryScreen(),
      const PermissionsScreen(),
      ProfileScreen(user: _user),
    ];

    return Scaffold(
      backgroundColor: AppTheme.pageBackground,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PoliceHQ GeoAttend', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
            Text(
              _locationService.hqName,
              style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1), fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Refresh',
            onPressed: () {
              _refreshData();
              _locationService.sendCurrentLocation();
            },
          ),
        ],
      ),
      body: pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: AppTheme.policeNavy,
        unselectedItemColor: AppTheme.textSecondary,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.assignment_outlined), activeIcon: Icon(Icons.assignment), label: 'Today'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
          BottomNavigationBarItem(icon: Icon(Icons.security), label: 'GPS & Perms'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
