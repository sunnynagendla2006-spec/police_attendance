# Security Architecture & Safeguards Guide

## Overview
Location-based police attendance and visit monitoring is sensitive operational intelligence. The system incorporates defense-in-depth principles across the database, backend APIs, administrative web console, and mobile application.

---

## 1. Authentication & Initial Credentials Policy

### Initial Constable Credentialing
* **Provisioning**: Administrative personnel create constable accounts by registering their username, full name, rank, department, and mobile number.
* **Temporary Credential**: The initial password is generated from the **last four digits of the registered mobile number**.
* **Storage**: Passwords are never stored in plaintext. They are salted and hashed using modern `bcrypt` key derivation.
* **Mandatory Change Workflow**:
  * The account is provisioned with `must_change_password = true`.
  * The login endpoint returns `must_change_password: true`.
  * The backend blocks all operational endpoints (`/attendance`, `/location`, `/officers`) until the password is changed.
  * The new password must be at least 8 characters long and cannot match the temporary 4-digit credential.
  * Once updated, `must_change_password` is set to `false`, and an audit log event is recorded.

---

## 2. Token Security & Authorization

* **JWT Access Tokens**: Signed using HMAC-SHA256 with a high-entropy secret key. Access tokens carry the officer's `user_id`, `username`, and `role`.
* **Expiration**: Short-lived tokens to minimize token replay risks.
* **Role-Based Access Control (RBAC)**:
  * **Super Admin (`super_admin`)**: Full system access, including geofence configuration, administrator account provisioning, audit log reviews, and global reports.
  * **Headquarters Admin (`hq_admin`)**: Officer management, live map monitoring, attendance inspection, report exports, and correction reviews.
  * **Constable (`constable`)**: Strictly scoped to their own profile, attendance records, and location updates.

---

## 3. Geofencing Validation & Anti-Spoofing

### Location Verification Pipeline
Each observation submitted by a mobile client passes through the `GeofenceEngine`:
1. **Accuracy Threshold**: Observations with GPS horizontal accuracy greater than 35 meters (`max_accuracy_meters`) are marked as `uncertain` or rejected, preventing inaccurate Wi-Fi or cellular triangulation from triggering false entries.
2. **Boundary Hysteresis (10m)**:
   * To prevent rapid flapping (entering/exiting jitter) when an officer patrols near the perimeter, entry is confirmed at `radius` and exit is confirmed only after moving outside `radius + hysteresis`.
3. **Plausible Velocity Check**: Unrealistic jumps in position (e.g. supersonic speed) between consecutive observations are flagged.
4. **Network / Battery Outage Protection**: Missing GPS points or device battery depletion **never fabricate an exit event**. The system marks the state as `LOCATION_STALE` or `OFFLINE`, preserving the open visit until verified.
5. **Idempotency Keys**: Every observation includes a UUID `idempotency_key`, preventing duplicate network transmissions from corrupting the visit ledger.

---

## 4. Audit Logging & Non-Repudiation

All sensitive actions generate immutable records in the `audit_logs` collection:
* Geofence radius or coordinate updates (records old value, new value, actor, and mandatory change reason).
* Officer account creation, activation, deactivation, and password resets.
* Attendance visit corrections (records original timestamps, corrected timestamps, administrator ID, and reason).
* Report generation and data exports.
