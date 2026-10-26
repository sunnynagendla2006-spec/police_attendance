import 'package:uuid/uuid.dart';

class LocationObservationModel {
  final String idempotencyKey;
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final DateTime observedAt;
  final String? deviceIdentifier;
  final double? altitudeMeters;
  final double? speedMps;

  LocationObservationModel({
    String? idempotencyKey,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.observedAt,
    this.deviceIdentifier,
    this.altitudeMeters,
    this.speedMps,
  }) : idempotencyKey = idempotencyKey ?? const Uuid().v4();

  factory LocationObservationModel.fromJson(Map<String, dynamic> json) {
    return LocationObservationModel(
      idempotencyKey: json['idempotency_key'] ?? const Uuid().v4(),
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accuracyMeters: (json['accuracy_meters'] as num).toDouble(),
      observedAt: DateTime.parse(json['observed_at']),
      deviceIdentifier: json['device_identifier'],
      altitudeMeters: json['altitude_meters'] != null ? (json['altitude_meters'] as num).toDouble() : null,
      speedMps: json['speed_mps'] != null ? (json['speed_mps'] as num).toDouble() : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'idempotency_key': idempotencyKey,
      'latitude': latitude,
      'longitude': longitude,
      'accuracy_meters': accuracyMeters,
      'observed_at': observedAt.toUtc().toIso8601String(),
      if (deviceIdentifier != null) 'device_identifier': deviceIdentifier,
      if (altitudeMeters != null) 'altitude_meters': altitudeMeters,
      if (speedMps != null) 'speed_mps': speedMps,
    };
  }
}
