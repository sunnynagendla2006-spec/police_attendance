# PoliceHQ GeoAttend — Police Headquarters Geofencing, Attendance & Visit Monitoring System

> **Official Deployment Target**: Eluru District Police Headquarters, Andhra Pradesh  
> **Coordinates**: Latitude `16.7107° N`, Longitude `81.0952° E`  
> **Authoritative Database**: MongoDB (Native MongoDB with `2dsphere` geospatial indexing)  

---

## 1. System Architecture Overview

PoliceHQ GeoAttend is a production-oriented, location-based attendance and headquarters visit monitoring system built for the Andhra Pradesh Police. It accurately records officer visits to headquarters while adhering to strict privacy safeguards:

* **Geofence-Only Ledger**: The system strictly records attendance and visit events relating to the configured **Eluru Police Headquarters geofence**. It never creates continuous historical tracking records across arbitrary public locations, preserving officer privacy and battery life.
* **Authoritative State Machine**: Incorporates states: `UNKNOWN`, `OUTSIDE`, `ENTERING`, `INSIDE`, `EXITING`, `LOCATION_STALE`, `PERMISSION_DENIED`, and `OFFLINE`.
* **Zero False Exits**: Network outages, cellular dead zones, or depleted phone batteries never fabricate an exit event. Open visits are maintained and marked for audit review.
* **Boundary Hysteresis & Accuracy Filtering**: Applies a 10m hysteresis buffer and a 35m GPS accuracy threshold to eliminate GPS jitter and boundary oscillation.
* **First-Login Security Policy**: Initial police officer passwords are generated from the **last four digits of their registered mobile number**. Upon initial sign-in, the system strictly enforces a mandatory password update before permitting access to operational features.

```
                              ┌─────────────────────────────────────────┐
                              │  Admin Web Portal (React 18 + TS + Vite)│
                              │  - Leaflet / OpenStreetMap Live Map     │
                              │  - Real-Time WebSockets                 │
                              │  - Attendance & Visit Ledger            │
                              │  - Geofence Settings & Police Directory │
                              └───────────────────▲─────────────────────┘
                                                  │ REST + WS
                                                  │
┌─────────────────────────┐   REST / JSON         ▼         PyMongo / Motor   ┌─────────────────────────┐
│ Constable Android App   ├────────────────►┌───────────┐────────────────────►│ MongoDB Server (v7.0)   │
│ - Flutter Mobile Client │◄────────────────┤  FastAPI  │◄────────────────────┤ - 2dsphere Geospatial   │
│ - Background Monitoring │ (Observations & │  Backend  │ (Geospatial Queries │ - users & profiles      │
│ - Offline Observation Q │   Attendance)   │ (Python)  │  & Visit Ledger)    │ - attendance_visits     │
└─────────────────────────┘                 └───────────┘                     │ - geofence_events       │
                                                                              │ - audit_logs            │
                                                                              └─────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Backend API** | Python 3.13, FastAPI, Motor (Async MongoDB Driver), PyMongo, Pydantic v2, PyJWT, Bcrypt, WebSockets, ReportLab |
| **Database** | MongoDB (v7.0) with GeoJSON, `2dsphere` spatial indexing, and atomic updates |
| **Admin Web Console** | React 18, TypeScript, Vite, Tailwind CSS, Leaflet, OpenStreetMap, Lucide React |
| **Constable Mobile App** | Flutter 3.47+ / Dart 3.13+, Android Foreground/Background Services, Geolocator, SharedPreferences Offline Queue |
| **Containerization** | Docker, Docker Compose, Multi-stage builds, Nginx reverse proxy |

---

## 3. Seed Credentials & Roles

The system automatically initializes seed data on startup:

| Role | Username | Initial Password | Mobile / Notes |
|---|---|---|---|
| **Super Admin** | `superadmin` | `Admin@EluruHQ2026!` | Full administrative access, geofence radius & policy editing, audit logs |
| **Headquarters Admin** | `hqadmin` | `HQAdmin@Eluru2026!` | Officer directory, attendance inspection, manual correction workflow |
| **Constable (Sample)** | `constable101` | `3210` | Registered Mobile: `9876543210`. **Mandatory password update on 1st login** |

---

## 4. Quickstart Guide (Windows)

### Step 1: Verify MongoDB Service
Ensure MongoDB is running locally on port 27017:
```powershell
Get-Service -Name MongoDB
```
If stopped:
```powershell
Start-Service -Name MongoDB
```

### Step 2: Start the Backend Server
Launch using the included helper script:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_backend.ps1
```
* Interactive Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* System Health Endpoint: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### Step 3: Start the Admin Web Console
In a second terminal window:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_admin.ps1
```
* Open your browser at [http://localhost:5173](http://localhost:5173) and sign in as `superadmin` or `hqadmin`.

### Step 4: Run the Constable Flutter App
In a third terminal window:
```powershell
cd constable-app
& "D:\Flutter\flutter\bin\flutter.bat" run
```

---

## 5. Automated Verification & Test Results

Run the full automated test suite (backend integration tests + flutter widget tests):
```powershell
powershell -ExecutionPolicy Bypass -File .\run_tests.ps1
```

### Verified Test Suites:
1. **Backend Auth & Personnel** (`tests/test_auth_and_personnel.py`):
   - Super admin and HQ admin authentication.
   - Initial 4-digit mobile suffix credential validation (`3210`).
   - Mandatory first-login password update blocking operational endpoints.
   - Officer creation, duplicate username prevention, and password resets.
2. **Geofencing & Attendance Lifecycle** (`tests/test_geofencing_and_attendance.py`):
   - Geofence radius configuration updates with audit logging.
   - Entry observation triggering `INSIDE` state and creating `AttendanceVisit`.
   - Exit observation closing visit, computing exact duration, and logging departure.
   - Duplicate event prevention via UUID idempotency keys.
   - Inaccurate GPS rejection (>35m).
   - Missing GPS preserving open visit without fabricating exits.
3. **Analytics, Reports & Audit** (`tests/test_analytics_and_reports.py`):
   - Real database-backed summary statistics and trends.
   - Authorized CSV report streaming.
   - Audit trail validation for geofence and personnel changes.
4. **Flutter Mobile Client** (`constable-app/test/widget_test.dart`):
   - Widget smoke tests, clean Dart analysis with 0 errors and 0 warnings.

---

## 6. Production Deployment (Vercel & Cloud)

See the comprehensive [Production Deployment Guide](file:///d:/police_location/docs/production-deployment.md) for complete details.

### Architecture Summary
* **Admin Web Portal**: Deployed on **Vercel** (`admin-web` with `vercel.json` SPA rewrites & security headers).
* **Backend Service**: Deployed on continuous container hosting (**Render**, **Railway**, or **Docker VPS**) to support persistent WebSockets (`/api/v1/ws`) and async MongoDB connection pools.
* **Database**: **MongoDB Atlas** (Managed Cloud Replica Set with `2dsphere` spatial indexing).

### Required Environment Variables at a Glance
| Service | Variable | Value Example |
|---|---|---|
| **Vercel (Admin Web)** | `VITE_API_URL` | `https://policehq-api.onrender.com/api/v1` |
| **Vercel (Admin Web)** | `VITE_WS_URL` | `wss://policehq-api.onrender.com/api/v1/ws` *(optional, auto-derived)* |
| **Backend (Render/VPS)** | `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/policehq_geoattend` |
| **Backend (Render/VPS)** | `JWT_SECRET_KEY` | *(64-character random hex from `openssl rand -hex 32`)* |
| **Backend (Render/VPS)** | `CORS_ORIGINS` | `["https://policehq-admin.vercel.app"]` |
| **Backend (Render/VPS)** | `ENVIRONMENT` | `production` |
| **Backend (Render/VPS)** | `DEBUG` | `false` |

---

## 7. Project Directory Layout

```
policehq-geoattend/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST & WebSocket endpoints (auth, officers, location, attendance, reports)
│   │   ├── core/            # Config, security (bcrypt + JWT), MongoDB connection & 2dsphere indexing
│   │   ├── models/          # Domain models
│   │   ├── schemas/         # Pydantic v2 schemas
│   │   └── services/        # Geofence engine, attendance lifecycle, audit, reports, websocket manager
│   ├── tests/               # 9 comprehensive pytest integration tests (100% passing)
│   ├── Dockerfile
│   └── requirements.txt
├── admin-web/
│   ├── src/
│   │   ├── pages/           # 10 full pages (Overview, Live Map, Attendance, Directory, Settings, etc.)
│   │   ├── layouts/         # Dashboard layout with role-based navigation & connection banner
│   │   ├── services/        # Axios API client & WebSocket real-time event listener
│   │   └── types/           # Complete TypeScript domain contracts
│   ├── Dockerfile
│   └── nginx.conf
├── constable-app/
│   ├── lib/
│   │   ├── core/            # Constants (Eluru HQ defaults) & Andhra Pradesh Police dark theme
│   │   ├── models/          # User, AttendanceVisit, LocationObservation
│   │   ├── services/        # ApiService, LocationTrackingService, OfflineQueueService
│   │   └── screens/         # Login, Mandatory Password Change, Home, Attendance, History, Perms, Profile
│   ├── android/             # AndroidManifest.xml configured with foreground/background location
│   └── pubspec.yaml
├── docs/
│   ├── architecture.md      # Full architecture blueprint & state machine definitions
│   ├── setup-windows.md     # Detailed Windows setup instructions
│   ├── android-permissions.md# Background location & battery optimization deep-dive
│   ├── security.md          # Defense-in-depth safeguards & initial credential policy
│   └── api.md               # REST & WebSocket endpoint documentation
├── docker-compose.yml       # Production-ready multi-container orchestration
├── run_backend.ps1          # One-click Windows backend launcher
├── run_admin.ps1            # One-click Windows admin portal launcher
└── run_tests.ps1            # Unified test suite runner
```

---

## 8. Operational Policies & Safeguards

* **Geofence Authority**: The headquarters location and radius are centrally managed on the server. Mobile clients do not make unverified local attendance decisions.
* **Auditing Non-Repudiation**: Every radius modification, personnel registration, manual attendance adjustment, or report export produces an immutable audit log entry recording actor ID, timestamp, and mandatory change rationale.
* **Data Retention**: Observation evidence is linked to visits with explicit verification indicators (`verified`, `uncertain`, `delayed_sync`, or `manually_corrected`).
