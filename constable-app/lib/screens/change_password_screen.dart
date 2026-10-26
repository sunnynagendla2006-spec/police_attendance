import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../services/api_service.dart';
import 'home_dashboard_screen.dart';
import 'login_screen.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _apiService = ApiService();

  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleChangePassword() async {
    final oldPassword = _oldPasswordController.text.trim();
    final newPassword = _newPasswordController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();

    if (oldPassword.isEmpty || newPassword.isEmpty || confirmPassword.isEmpty) {
      setState(() {
        _errorMessage = 'All fields are mandatory';
      });
      return;
    }

    if (newPassword.length < 8) {
      setState(() {
        _errorMessage = 'New password must be at least 8 characters long';
      });
      return;
    }

    if (newPassword != confirmPassword) {
      setState(() {
        _errorMessage = 'New password and confirmation do not match';
      });
      return;
    }

    if (newPassword == oldPassword) {
      setState(() {
        _errorMessage = 'New password cannot be the same as your initial temporary password';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _apiService.changePassword(
        oldPassword: oldPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmPassword,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppTheme.policeSuccess,
          content: Text('Password updated successfully. Welcome to PoliceHQ GeoAttend!'),
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeDashboardScreen()),
      );
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleLogout() async {
    await _apiService.logout();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.pageBackground,
      appBar: AppBar(
        title: const Text('Mandatory Security Update', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Sign Out',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.policeNavy.withOpacity(0.08),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppTheme.policeNavy.withOpacity(0.2), width: 1.5),
                      ),
                      child: const Icon(
                        Icons.lock_reset,
                        size: 40,
                        color: AppTheme.policeNavy,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'First-Login Password Change',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppTheme.policeNavy,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'For security compliance, you must change your initial 4-digit temporary password before accessing the system.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.policeDanger.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.policeDanger.withOpacity(0.3)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: AppTheme.policeDanger, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Current Password
                  TextField(
                    controller: _oldPasswordController,
                    obscureText: _obscureOld,
                    style: const TextStyle(color: AppTheme.textMain),
                    decoration: InputDecoration(
                      labelText: 'Current Initial Password',
                      hintText: '4-digit mobile suffix',
                      prefixIcon: const Icon(Icons.lock_open, color: AppTheme.textSecondary),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureOld ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: AppTheme.textSecondary),
                        onPressed: () => setState(() => _obscureOld = !_obscureOld),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // New Password
                  TextField(
                    controller: _newPasswordController,
                    obscureText: _obscureNew,
                    style: const TextStyle(color: AppTheme.textMain),
                    decoration: InputDecoration(
                      labelText: 'New Secure Password',
                      hintText: 'Minimum 8 characters',
                      prefixIcon: const Icon(Icons.lock_outline, color: AppTheme.textSecondary),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureNew ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: AppTheme.textSecondary),
                        onPressed: () => setState(() => _obscureNew = !_obscureNew),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Confirm New Password
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirm,
                    style: const TextStyle(color: AppTheme.textMain),
                    decoration: InputDecoration(
                      labelText: 'Confirm New Password',
                      hintText: 'Re-enter new password',
                      prefixIcon: const Icon(Icons.check_circle_outline, color: AppTheme.textSecondary),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureConfirm ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: AppTheme.textSecondary),
                        onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleChangePassword,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.policeNavy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text(
                            'CONFIRM & CONTINUE',
                            style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.5),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
