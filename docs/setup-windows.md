# PoliceHQ GeoAttend — Windows Setup & Execution Guide

## Overview
PoliceHQ GeoAttend is a location-based attendance and headquarters visit monitoring system for **Eluru District Police Headquarters, Andhra Pradesh** (Coordinates: `16.7107° N, 81.0952° E`).

The system consists of:
1. **Backend API**: Python 3.13 + FastAPI + Motor (Async MongoDB) + PyJWT + Bcrypt.
2. **Database**: MongoDB Server (Native Windows Service or Docker Container) with `2dsphere` geospatial indexing.
3. **Admin Web Console**: React 18 + TypeScript + Vite + Tailwind CSS + Leaflet with OpenStreetMap.
4. **Constable Mobile App**: Flutter (Android) with foreground and background GPS monitoring, accuracy filtering, and offline queuing.

---

## 1. Prerequisites for Windows

Ensure the following tools are installed:
* **Python 3.11+ or 3.13** (Available in PATH).
* **Node.js 18+ or 20+** and npm.
* **MongoDB Server 6.0+ or 7.0+** (Running as a Windows service on `localhost:27017` or via Docker).
* **Flutter SDK 3.13+** (Optional for mobile development, located at `D:\Flutter\flutter\bin`).
* **PowerShell 7 or Windows PowerShell 5.1**.

---

## 2. MongoDB Setup

### Native Windows Service Verification
Verify MongoDB is running:
```powershell
Get-Service -Name MongoDB
```
If not running, start it:
```powershell
Start-Service -Name MongoDB
```

The database `policehq_geoattend` will be created automatically on the first backend run, along with:
* `2dsphere` spatial index on `headquarters.location`.
* Default seed configuration for **Eluru District Police Headquarters** (`16.7107, 81.0952`, radius 150m).
* Default administrative accounts:
  * Super Admin: `superadmin` / `Admin@EluruHQ2026!`
  * HQ Admin: `hqadmin` / `HQAdmin@Eluru2026!`
  * Constable: `constable101` / Initial password `3210` (Mobile: `9876543210`).

---

## 3. Backend Setup & Run

### A. Environment Configuration
Navigate to the `backend/` directory:
```powershell
cd d:\police_location\backend
```
The `.env` file is pre-configured with:
```ini
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=policehq_geoattend
JWT_SECRET_KEY=policehq_super_secure_jwt_secret_key_eluru_2026_production
ENVIRONMENT=development
HOST=127.0.0.1
PORT=8000
```

### B. Run the Backend
Using the dedicated virtual environment:
```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Or run the root helper script:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_backend.ps1
```

* API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health Check: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### C. Running Automated Tests
To run the automated test suite (all 9 comprehensive integration tests):
```powershell
cd d:\police_location\backend
.\.venv\Scripts\python.exe -m pytest tests/ -v
```

---

## 4. Admin Web Console Setup & Run

### A. Install Dependencies & Start Dev Server
Navigate to the `admin-web/` directory:
```powershell
cd d:\police_location\admin-web
npm install
npm run dev
```
Or run the root helper script:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_admin.ps1
```

* Admin Web Portal: [http://localhost:5173](http://localhost:5173)
* Production Build:
```powershell
npm run build
```

---

## 5. Constable Mobile Application (Flutter)

### A. Run in Android Emulator or Physical Device
Navigate to `constable-app/`:
```powershell
cd d:\police_location\constable-app
```
To run on connected emulator or device:
```powershell
& "D:\Flutter\flutter\bin\flutter.bat" run
```

### B. Network Endpoints
* **Android Emulator**: Uses `http://10.0.2.2:8000/api/v1` by default (already configured in `AppConstants`).
* **Physical Device**: Connect phone and computer to the same Wi-Fi. In the app login screen, tap the gear icon in the top right and set the base URL to your PC's IP address (e.g., `http://192.168.1.50:8000/api/v1`).
