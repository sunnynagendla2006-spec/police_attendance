import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../core/theme.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  bool _isGpsEnabled = false;
  LocationPermission _locationPermission = LocationPermission.denied;
  PermissionStatus _backgroundStatus = PermissionStatus.denied;

  @override
  void initState() {
    super.initState();
    _checkAllPermissions();
  }

  Future<void> _checkAllPermissions() async {
    final gps = await Geolocator.isLocationServiceEnabled();
    final locPerm = await Geolocator.checkPermission();
    final bgStatus = await Permission.locationAlways.status;

    setState(() {
      _isGpsEnabled = gps;
      _locationPermission = locPerm;
      _backgroundStatus = bgStatus;
    });
  }

  Future<void> _requestLocationPermission() async {
    await Geolocator.requestPermission();
    await _checkAllPermissions();
  }

  Future<void> _requestBackgroundPermission() async {
    await Permission.locationAlways.request();
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

    return SingleChildScrollView(
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
            subtitle: 'Recommended: Disable battery restrictions for unhindered duty check-ins',
            isGranted: true,
            onRequest: () => openAppSettings(),
            buttonText: 'Settings',
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
        ],
      ),
    );
  }
}
