class UserModel {
  final String id;
  final String username;
  final String role;
  final String accountStatus;
  final bool mustChangePassword;
  final OfficerProfile? profile;

  UserModel({
    required this.id,
    required this.username,
    required this.role,
    required this.accountStatus,
    required this.mustChangePassword,
    this.profile,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? json['_id'] ?? '',
      username: json['username'] ?? '',
      role: json['role'] ?? '',
      accountStatus: json['account_status'] ?? 'active',
      mustChangePassword: json['must_change_password'] ?? false,
      profile: json['profile'] != null ? OfficerProfile.fromJson(json['profile']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'account_status': accountStatus,
      'must_change_password': mustChangePassword,
      'profile': profile?.toJson(),
    };
  }
}

class OfficerProfile {
  final String officerId;
  final String fullName;
  final String rank;
  final String mobileNumber;
  final String department;
  final String profileStatus;

  OfficerProfile({
    required this.officerId,
    required this.fullName,
    required this.rank,
    required this.mobileNumber,
    required this.department,
    required this.profileStatus,
  });

  factory OfficerProfile.fromJson(Map<String, dynamic> json) {
    return OfficerProfile(
      officerId: json['officer_id'] ?? '',
      fullName: json['full_name'] ?? '',
      rank: json['rank'] ?? '',
      mobileNumber: json['mobile_number'] ?? '',
      department: json['department'] ?? '',
      profileStatus: json['profile_status'] ?? 'active',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'officer_id': officerId,
      'full_name': fullName,
      'rank': rank,
      'mobile_number': mobileNumber,
      'department': department,
      'profile_status': profileStatus,
    };
  }
}

class AuthResponse {
  final String accessToken;
  final String tokenType;
  final bool mustChangePassword;
  final UserModel user;

  AuthResponse({
    required this.accessToken,
    required this.tokenType,
    required this.mustChangePassword,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['access_token'] ?? '',
      tokenType: json['token_type'] ?? 'bearer',
      mustChangePassword: json['must_change_password'] ?? false,
      user: UserModel.fromJson(json['user'] ?? {}),
    );
  }
}
