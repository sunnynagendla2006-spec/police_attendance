class HeadquartersModel {
  final String id;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String status;
  final bool isPrimary;

  HeadquartersModel({
    required this.id,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.status,
    required this.isPrimary,
  });

  factory HeadquartersModel.fromJson(Map<String, dynamic> json) {
    return HeadquartersModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Police Headquarters',
      address: json['address'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 16.7107,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 81.0952,
      radiusMeters: (json['radius_meters'] as num?)?.toDouble() ?? 150.0,
      status: json['status'] ?? 'ACTIVE',
      isPrimary: json['is_primary'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'radius_meters': radiusMeters,
      'status': status,
      'is_primary': isPrimary,
    };
  }
}
