# PoliceHQ GeoAttend — System Architecture & Design Document
## Eluru Police Headquarters Geofencing, Attendance and Visit Monitoring System

### 1. Architectural Overview

PoliceHQ GeoAttend is an enterprise-grade location-based attendance and headquarters visit monitoring system tailored for the Andhra Pradesh Police Department at **Eluru District Police Headquarters**.

The system is designed with a high-integrity, audit-compliant architecture ensuring that every visit record corresponds strictly to verified physical presence within the configured headquarters geofence, without tracking arbitrary civilian or off-duty movements or fabricating entry/exit records.

```
                      +-----------------------------------+
                      |   Super Admin / HQ Admin Portal   |
                      |   (React + TypeScript + Leaflet)  |
                      +-----------------+-----------------+
                                        | (HTTPS / WSS)
                                        v
+-----------------------+     +-------------------+     +----------------------+
|  Constable Mobile App | --> |   FastAPI Monolith| <-- |  Admin REST & WS API |
| (Flutter / Android)   |     |   Backend Service |     +----------------------+
+-----------------------+     +---------+---------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
        +-----------------+                           +------------------+
        |  MongoDB Server |                           | Background Audit |
        | (GeoJSON / 2dsphere)                        | & Stale Workers  |
        +-----------------+                           +------------------+
```

---

### 2. Core Components

1. **Backend Engine (FastAPI + Python 3.13)**
   - Asynchronous I/O using Motor (MongoDB async driver).
   - Strict Pydantic v2 schemas for all inputs/outputs.
   - JWT authentication with access tokens and refresh tokens.
   - Role-Based Access Control (RBAC): `SUPER_ADMIN`, `HQ_ADMIN`, `CONSTABLE`.
   - First-Login Security Enforcement: Accounts provisioned with the initial password (last 4 digits of registered mobile) are strictly locked into a password change route (`must_change_password = true`) until updated.
   - Authoritative Geofence State Machine with hysteresis, accuracy threshold filtering, dwell-time confirmation, and idempotency deduplication.
   - WebSocket connection manager broadcasting real-time location and visit transitions to connected admin consoles.
   - Automated CSV and PDF report generation.

2. **Database (MongoDB 7.x / 8.x with 2dsphere)**
   - Collections: `users`, `officer_profiles`, `headquarters`, `geofence_configurations`, `registered_devices`, `location_observations`, `geofence_events`, `attendance_visits`, `attendance_correction_requests`, `audit_logs`, `refresh_sessions`, `synchronization_records`.
   - GeoJSON Point formats: `{"type": "Point", "coordinates": [longitude, latitude]}`.
   - Geospatial index: `2dsphere` on `location` fields for spherical distance queries.
   - Unique constraints on `username`, `officer_id`, `idempotency_key`, etc.

3. **Admin Web Console (React 18 + TypeScript + Vite + Tailwind CSS + Leaflet)**
   - Responsive, dark-accented enterprise design following AP Police visual aesthetics (Navy `#0f172a`, Gold/Yellow `#eab308`, Slate `#334155`, Crimson `#dc2626`).
   - OpenStreetMap + Leaflet integration displaying headquarters geofence circle, active officer positions, freshness indicators (Fresh, Stale, Inactive), and officer detail popups.
   - Real-time updates via WebSockets with automatic reconnection.
   - Complete modules: Overview Dashboard, Live Map, HQ Attendance, Visit History, Police Directory, Reports & Analytics, Geofence Settings, Audit Logs, System Health.

4. **Constable Mobile Application (Flutter for Android)**
   - Professional, high-contrast, uncluttered UI built for on-duty police personnel.
   - Secure login and first-login password change flow.
   - Real-time display of current headquarters geofence status (Inside, Outside, Location Stale, Offline).
   - "My Attendance" ledger displaying today's visits, entry/exit timestamps, and total headquarters duration.
   - Transparent Location & Permissions management (Foreground service, Background location, Battery optimization guidelines).
   - Offline observation queuing with transactional sync to handle poor cellular coverage around district borders.

---

### 3. Geofence State Machine & Logic

The system strictly validates observations against the authoritative headquarters coordinates:
- **Default Location**: Eluru District Police Headquarters, Andhra Pradesh (`16.7107° N, 81.0952° E`).
- **Configurable Radius**: 50m, 100m, 150m, 200m or custom positive meters.
- **Accuracy Filter**: Observations with accuracy > threshold (e.g., > 35m) are marked `UNCERTAIN` and cannot trigger entry/exit.
- **Hysteresis Buffer**: A 15-meter buffer prevents rapid oscillation (bounce) when an officer patrols near the perimeter wall.
  - Entry Trigger: `distance <= (radius - hysteresis)` with confirmed accuracy.
  - Exit Trigger: `distance > (radius + hysteresis)` with confirmed accuracy.
- **Dwell Time Confirmation**: Requires consecutive observations or minimum dwell seconds before locking entry/exit.
- **Data Loss & Missing Data Protection**: If an officer phone loses signal, drops battery, or revokes permission, the system marks the state as `LOCATION_STALE` or `PERMISSION_DENIED`. **It never fabricates an exit event or incomplete exit timestamp.**

---

### 4. Security & Compliance Safeguards

- Password Hashing: Argon2id / Bcrypt with salt.
- Credential Protection: Passwords never logged, never exposed in JSON responses.
- Idempotency: All location submissions include client timestamp + batch UUID to prevent duplicate visits during retry.
- Audit Trail: Immutable audit logs for all administrative actions (geofence changes, personnel onboarding, manual attendance corrections, report downloads).
