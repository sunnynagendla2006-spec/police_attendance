import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:usage_stats/usage_stats.dart';
import '../core/theme.dart';

class PermissionsScreen extends StatefulWidget {
  /// When true, renders as a full-screen mandatory onboarding gate with a
  /// "Continue" button that only unlocks once every required permission is
  /// granted, and calls [onAllGranted] when the officer taps it.
  final bool gateMode;
  final VoidCallback? onAllGranted;

  const PermissionsScreen({super.key, this.gateMode = false, this.onAllGranted});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> with WidgetsBindingObserver {
  bool _isGpsEnabled = false;
  LocationPermission _locationPermission = LocationPermission.denied;
  PermissionStatus _backgroundStatus = PermissionStatus.denied;
  PermissionStatus _batteryStatus = PermissionStatus.denied;
  bool _usageAccessGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkAllPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Officers often grant permissions from Settings, then return to the
    // app - re-check immediately so the gate unlocks without a manual pull.
    if (state == AppLifecycleState.resumed) {
      _checkAllPermissions();
    }
  }

  bool get _allMandatoryGranted {
    final hasForeground = _locationPermission == LocationPermission.always || _locationPermission == LocationPermission.whileInUse;
    final hasBackground = _locationPermission == LocationPermission.always || _backgroundStatus.isGranted;
    return _isGpsEnabled && hasForeground && hasBackground && _batteryStatus.isGranted && _usageAccessGranted;
  }

  Future<void> _checkAllPermissions() async {
    final gps = await Geolocator.isLocationServiceEnabled();
    final locPerm = await Geolocator.checkPermission();
    final bgStatus = await Permission.locationAlways.status;
    final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
    bool usageGranted = false;
    try {
      usageGranted = await UsageStats.checkUsagePermission() ?? false;
    } catch (_) {
      usageGranted = false;
    }

    if (!mounted) return;
    setState(() {
      _isGpsEnabled = gps;
      _locationPermission = locPerm;
      _backgroundStatus = bgStatus;
      _batteryStatus = batteryStatus;
      _usageAccessGranted = usageGranted;
    });

    // Skip the gate instantly on subsequent launches once everything is
    // already granted, instead of forcing the officer to tap Continue.
    if (widget.gateMode && _allMandatoryGranted && !_autoAdvanced) {
      _autoAdvanced = true;
      widget.onAllGranted?.call();
    }
  }

  bool _autoAdvanced = false;

  Future<void> _requestLocationPermission() async {
    await Geolocator.requestPermission();
    await _checkAllPermissions();
  }

  Future<void> _requestBackgroundPermission() async {
    await Permission.locationAlways.request();
    await _checkAllPermissions();
  }

  Future<void> _requestBatteryOptimizationExemption() async {
    await Permission.ignoreBatteryOptimizations.request();
    await _checkAllPermissions();
  }

  Future<void> _requestUsageAccess() async {
    // Usage Access cannot be granted via a runtime dialog - Android requires
    // the officer to flip it on in the dedicated system settings screen.
    await UsageStats.grantUsagePermission();
    await _checkAllPermissions();
  }

  Widget _buildStatusRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isGranted,
    VoidCallback? onRequest,
    String buttonText = 'Grant',
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isGranted ? AppTheme.policeSuccess.withOpacity(0.12) : AppTheme.policeWarning.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isGranted ? AppTheme.policeSuccess : AppTheme.policeWarning,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(color: AppTheme.textMain, fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 3),
                  Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12, height: 1.3)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (!isGranted && onRequest != null)
              ElevatedButton(
                onPressed: onRequest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.policeNavy,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
                child: Text(buttonText, style: const TextStyle(fontSize: 12)),
              )
            else if (isGranted)
              const Icon(Icons.check_circle, color: AppTheme.policeSuccess, size: 24),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasForeground = _locationPermission == LocationPermission.always || _locationPermission == LocationPermission.whileInUse;
    final hasBackground = _locationPermission == LocationPermission.always || _backgroundStatus.isGranted;

    final body = SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Policy Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.shield_outlined, color: AppTheme.policeNavy, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Operational Policy & Purpose',
                      style: TextStyle(color: AppTheme.policeNavy, fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text(
                  'In accordance with Andhra Pradesh Police Headquarters operational guidelines, location monitoring is restricted exclusively to validating attendance within the Eluru District Headquarters geofence. Continuous location histories outside duty areas are strictly not recorded.',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          _buildStatusRow(
            icon: Icons.gps_fixed,
            title: 'GPS / Device Location',
            subtitle: _isGpsEnabled ? 'Hardware location sensor active' : 'GPS sensor is turned off',
            isGranted: _isGpsEnabled,
            onRequest: () => Geolocator.openLocationSettings(),
            buttonText: 'Enable',
          ),
          const SizedBox(height: 10),

          _buildStatusRow(
            icon: Icons.location_on,
            title: 'Foreground Location',
            subtitle: hasForeground ? 'Permission granted for app' : 'Required to capture attendance upon arrival',
            isGranted: hasForeground,
            onRequest: _requestLocationPermission,
          ),
          const SizedBox(height: 10),

          _buildStatusRow(
            icon: Icons.all_inclusive,
            title: 'Background Location',
            subtitle: hasBackground
                ? 'Allow "All the time" granted for passive visit detection'
                : 'Select "Allow all the time" in Android settings for background geofence updates',
            isGranted: hasBackground,
            onRequest: _requestBackgroundPermission,
            buttonText: 'Allow All',
          ),
          const SizedBox(height: 10),

          _buildStatusRow(
            icon: Icons.battery_charging_full,
            title: 'Battery Optimization',
            subtitle: _batteryStatus.isGranted
                ? 'Battery restrictions disabled for uninterrupted duty monitoring'
                : 'Required: Disable battery restrictions so monitoring is not killed in the background',
            isGranted: _batteryStatus.isGranted,
            onRequest: _requestBatteryOptimizationExemption,
            buttonText: 'Allow',
          ),
          const SizedBox(height: 10),

          _buildStatusRow(
            icon: Icons.hourglass_bottom,
            title: 'Digital Wellbeing / Usage Access',
            subtitle: _usageAccessGranted
                ? 'Screen-time and app-usage reporting enabled'
                : 'Required: Grant Usage Access so on-duty screen-time can be reported',
            isGranted: _usageAccessGranted,
            onRequest: _requestUsageAccess,
            buttonText: 'Allow',
          ),
          const SizedBox(height: 20),

          OutlinedButton.icon(
            onPressed: () => openAppSettings(),
            icon: const Icon(Icons.settings),
            label: const Text('OPEN ANDROID APP SETTINGS'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.policeNavy,
              side: const BorderSide(color: AppTheme.borderLight),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),

          if (widget.gateMode) ...[
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _allMandatoryGranted ? widget.onAllGranted : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.policeNavy,
                disabledBackgroundColor: AppTheme.borderLight,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                _allMandatoryGranted ? 'CONTINUE TO DASHBOARD' : 'GRANT ALL PERMISSIONS TO CONTINUE',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );

    if (!widget.gateMode) return body;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppTheme.pageBackground,
        appBar: AppBar(
          title: const Text('Required Permissions'),
          backgroundColor: AppTheme.policeNavy,
          foregroundColor: Colors.white,
          automaticallyImplyLeading: false,
        ),
        body: body,
      ),
    );
  }
}
