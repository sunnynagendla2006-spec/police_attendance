# Android Background Location & Device Permissions Guide

## Overview
Continuous and accurate location tracking on modern Android versions (Android 10 through 14+) requires strict compliance with Google's privacy guidelines, foreground service regulations, and battery optimization standards.

This document details the configuration, permissions, and operational constraints implemented in the **PoliceHQ GeoAttend Constable App**.

---

## 1. Declared Permissions

The following permissions are declared in [AndroidManifest.xml](file:///d:/police_location/constable-app/android/app/src/main/AndroidManifest.xml):

| Permission | Purpose | Level |
|---|---|---|
| `android.permission.INTERNET` | Communication with FastAPI backend API | Normal |
| `android.permission.ACCESS_NETWORK_STATE` | Check connectivity for offline observation queuing | Normal |
| `android.permission.ACCESS_FINE_LOCATION` | Accurate GPS coordinates required for geofence validation | Dangerous |
| `android.permission.ACCESS_COARSE_LOCATION` | Approximate cell/Wi-Fi positioning fallback | Dangerous |
| `android.permission.ACCESS_BACKGROUND_LOCATION` | Passive geofence event detection when app is minimized | Dangerous |
| `android.permission.FOREGROUND_SERVICE` | Running persistent location tracking service | Normal |
| `android.permission.FOREGROUND_SERVICE_LOCATION` | Android 14 requirement for foreground location tracking | Normal |
| `android.permission.WAKE_LOCK` | CPU wake lock during queued batch synchronization | Normal |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Resume tracking service upon device reboot | Normal |

---

## 2. Permission Request Sequence

In accordance with Android 11+ requirements, **background location cannot be requested at the same time as foreground location**:

1. **Step 1: Explain Purpose**: The app displays the Andhra Pradesh Police location policy banner, clearly stating that tracking is restricted to the Eluru District Police Headquarters geofence.
2. **Step 2: Request Foreground Location**: First request `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION`.
3. **Step 3: Request Background Location**: Only after foreground permission is granted, request `ACCESS_BACKGROUND_LOCATION` ("Allow all the time").

---

## 3. Battery Optimization & Manufacturer Restrictions

Modern Android OEM builds (e.g., Samsung OneUI, Xiaomi MIUI, Oppo ColorOS, Vivo FuntouchOS) aggressively kill background tasks:
1. **Battery Optimization Exemption**: Constables are guided in the `PermissionsScreen` to exempt the application from Android Battery Optimization.
2. **Auto-Start / Background Execution**: For OEM devices, personnel must ensure the app is allowed to "Run in background" and "Auto-start".
3. **Forecasting Disconnections**: When battery dies or GPS is disabled by the user, the backend **does not fabricate an exit event**. The state transitions to `LOCATION_STALE` or `PERMISSION_DENIED`, preserving visit integrity.

---

## 4. Offline Queuing & Idempotent Synchronization

When an officer enters headquarters during a cellular dead zone or network outage:
1. Coordinates are recorded by `LocationTrackingService` with local timestamp and a client-generated UUID `idempotency_key`.
2. The observation is stored in `OfflineQueueService` (backed by Android `SharedPreferences`).
3. When network connectivity is restored, observations are transmitted via `POST /api/v1/location/sync` in batches of 50.
4. The FastAPI backend validates observations against the `geofence_engine` using the original observation timestamps, recalculating entry and exit events accurately without creating duplicate visits.
