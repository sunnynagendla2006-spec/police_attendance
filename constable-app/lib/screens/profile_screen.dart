import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  final UserModel? user;
  const ProfileScreen({super.key, this.user});

  void _showCorrectionDialog(BuildContext context) {
    final reasonController = TextEditingController();
    final detailsController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Submit Attendance Correction', style: TextStyle(color: AppTheme.textMain, fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Report a missed check-in, device battery depletion, or incorrect visit entry to Eluru HQ administration.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  hintText: 'e.g., Device discharged while inside HQ',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: detailsController,
                maxLines: 3,
                style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Explanation & Timestamps',
                  hintText: 'State your entry/exit times and duty assignment',
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
              final details = detailsController.text.trim();
              if (reason.isEmpty) return;

              try {
                // Using general correction request
                await ApiService().submitCorrectionRequest(
                  visitId: 'general_inquiry',
                  reason: reason,
                  requestedChanges: details.isNotEmpty ? details : 'Manual attendance review requested',
                );
                if (ctx.mounted) Navigator.pop(ctx);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: AppTheme.policeSuccess,
                      content: Text('Discrepancy notice recorded for Headquarters review.'),
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
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Sign Out?', style: TextStyle(color: AppTheme.textMain, fontSize: 16, fontWeight: FontWeight.bold)),
        content: const Text(
          'Signing out will stop active background location monitoring until your next sign-in.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.policeDanger),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      await ApiService().logout();
      if (context.mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  Widget _buildInfoTile(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const Spacer(),
          Text(value, style: const TextStyle(color: AppTheme.textMain, fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = user?.profile;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Officer Badge Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppTheme.policeNavy,
                    child: const Icon(Icons.shield, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    profile?.fullName ?? user?.username ?? 'Officer',
                    style: const TextStyle(color: AppTheme.textMain, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.policeNavy.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.policeNavy.withOpacity(0.2)),
                    ),
                    child: Text(
                      '${profile?.rank ?? "Constable"} • ${profile?.officerId ?? user?.username ?? ""}',
                      style: const TextStyle(color: AppTheme.policeNavy, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Details Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Personnel Details', style: TextStyle(color: AppTheme.textMain, fontWeight: FontWeight.bold, fontSize: 14)),
                  const Divider(color: AppTheme.borderLight, height: 20),
                  _buildInfoTile('Username', user?.username ?? '—', Icons.account_circle_outlined),
                  _buildInfoTile('Officer ID', profile?.officerId ?? '—', Icons.badge_outlined),
                  _buildInfoTile('Department', profile?.department ?? 'Eluru Division', Icons.domain),
                  _buildInfoTile('Mobile Number', profile?.mobileNumber ?? '—', Icons.phone_outlined),
                  _buildInfoTile('Account Status', user?.accountStatus.toUpperCase() ?? 'ACTIVE', Icons.verified_user_outlined),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Action: Submit Correction Request
          Card(
            child: ListTile(
              leading: const Icon(Icons.rate_review_outlined, color: AppTheme.policeNavy),
              title: const Text('Discrepancy / Correction Request', style: TextStyle(color: AppTheme.textMain, fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: const Text('Report missing or disputed visits to HQ Admin', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.textSecondary),
              onTap: () => _showCorrectionDialog(context),
            ),
          ),
          const SizedBox(height: 24),

          // Sign Out Button
          ElevatedButton.icon(
            onPressed: () => _handleLogout(context),
            icon: const Icon(Icons.logout),
            label: const Text('SIGN OUT'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.policeDanger,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ],
      ),
    );
  }
}
