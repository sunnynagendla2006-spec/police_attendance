# PoliceHQ GeoAttend — REST API & WebSocket Specification

## 1. Authentication & Session Endpoints

### `POST /api/v1/auth/login`
Authenticates an administrator or constable.
* **Request**:
  ```json
  {
    "username": "constable101",
    "password": "3210"
  }
  ```
* **Response**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "must_change_password": true,
    "user": {
      "id": "671cc81...",
      "username": "constable101",
      "role": "constable",
      "account_status": "active",
      "must_change_password": true,
      "profile": {
        "officer_id": "AP-ELR-101",
        "full_name": "K. Rajesh",
        "rank": "Police Constable",
        "mobile_number": "9876543210",
        "department": "Traffic Division",
        "profile_status": "active"
      }
    }
  }
  ```

### `POST /api/v1/auth/change-password`
Mandatory first-login password update.
* **Headers**: `Authorization: Bearer <access_token>`
* **Request**:
  ```json
  {
    "old_password": "3210",
    "new_password": "NewSecretPass@2026",
    "confirm_new_password": "NewSecretPass@2026"
  }
  ```
* **Response**:
  ```json
  {
    "message": "Password changed successfully"
  }
  ```

### `GET /api/v1/auth/me`
Retrieves authenticated user profile.
* **Headers**: `Authorization: Bearer <access_token>`

### `POST /api/v1/auth/logout`
Revokes active session.
* **Headers**: `Authorization: Bearer <access_token>`

---

## 2. Personnel Management Endpoints

### `GET /api/v1/officers`
Lists registered police personnel. Supports search, status, rank, and pagination.
* **Headers**: `Authorization: Bearer <access_token>` (Admin only)
* **Query Parameters**: `query`, `rank`, `status`, `skip`, `limit`

### `POST /api/v1/officers`
Registers a new police officer account.
* **Headers**: `Authorization: Bearer <access_token>` (Admin only)
* **Initial Credential**: Generated automatically from the last 4 digits of `mobile_number`. `must_change_password` set to `true`.

### `POST /api/v1/officers/{officer_id}/reset-password`
Administrative password reset. Sets temporary password to the last 4 digits of the officer's registered mobile number and requires change on next login.

---

## 3. Headquarters & Geofence Endpoints

### `GET /api/v1/headquarters/geofence`
Returns the active headquarters location, radius, and operational policies.

### `PATCH /api/v1/headquarters/geofence`
Updates headquarters coordinates, radius (e.g. 50m, 100m, 150m, 200m), accuracy threshold, and hysteresis.
* **Headers**: `Authorization: Bearer <access_token>` (Super Admin only)
* **Request**:
  ```json
  {
    "radius_meters": 150.0,
    "accuracy_threshold_meters": 35.0,
    "change_reason": "Perimeter security review expansion"
  }
  ```

---

## 4. Location & Geofencing Endpoints

### `POST /api/v1/location/observations`
Submits a real-time location observation from the constable app.
* **Headers**: `Authorization: Bearer <access_token>`
* **Request**:
  ```json
  {
    "idempotency_key": "d3b07384-d113-4676-9cf8-67253457a412",
    "latitude": 16.7107,
    "longitude": 81.0952,
    "accuracy_meters": 12.5,
    "observed_at": "2026-10-26T10:00:00Z"
  }
  ```
* **Response**:
  ```json
  {
    "status": "processed",
    "state": "INSIDE",
    "distance_meters": 0.0,
    "transition": "ENTERED"
  }
  ```

### `POST /api/v1/location/sync`
Synchronizes a batch of queued offline observations after network reconnect.
* **Headers**: `Authorization: Bearer <access_token>`

### `GET /api/v1/location/current`
Returns current operational locations for all authorized personnel on the live map.

---

## 5. Attendance & Visit Ledger Endpoints

### `GET /api/v1/attendance`
Retrieves attendance visit records. Constables receive only their own visits; Administrators can query system-wide records with date, officer, and rank filters.

### `POST /api/v1/attendance/correction-requests`
Submits an attendance discrepancy review request.

### `POST /api/v1/attendance/{visit_id}/corrections`
Administrator approval/manual correction of attendance entry or exit timestamps with audit logging.

---

## 6. Reports & Analytics Endpoints

### `GET /api/v1/analytics/overview`
Returns summary statistics: total registered, inside HQ, outside HQ, stale count, today's visits, and total stay duration.

### `GET /api/v1/analytics/trends`
Provides daily, weekly, and monthly visit trends and duration distributions.

### `GET /api/v1/reports/attendance.csv`
Streams an authorized CSV export with comprehensive audit metadata.

### `GET /api/v1/reports/attendance.pdf`
Generates a printable police administration PDF report.

---

## 7. Real-Time WebSockets

### `WS /ws/live`
Real-time streaming channel for administrative dashboards:
* `geofence_transition`: Emitted when an officer enters or exits headquarters.
* `location_update`: Emitted when authorized officers report updated coordinates.
* `stale_transition`: Emitted when an officer's location becomes stale (>5 minutes).
