# PoliceHQ GeoAttend — Production Deployment Guide

This guide provides end-to-end instructions for deploying **PoliceHQ GeoAttend** to production with high availability, security hardening, and real-time WebSocket connectivity.

---

## 1. Production Architecture Overview

The system is composed of three production layers:

```
┌──────────────────────────────────────────┐
│   Admin Web Portal (React 18 + Vite)     │
│   Deployed on: Vercel Global Edge CDN    │
│   Domain: https://policehq-admin.vercel.app
└──────────────────┬───────────────────────┘
                   │ HTTPS REST + WSS WebSockets
                   ▼
┌──────────────────────────────────────────┐
│   Backend Service (FastAPI + WebSockets) │
│   Deployed on: Render / Railway / Fly.io │
│   Domain: https://policehq-api.onrender.com
└──────────────────┬───────────────────────┘
                   │ Native MongoDB Protocol (mongodb+srv://)
                   ▼
┌──────────────────────────────────────────┐
│   Database: MongoDB Atlas (Cloud)        │
│   Managed replica set with 2dsphere index│
└──────────────────────────────────────────┘
```

> **Why Frontend on Vercel and Backend on Render/Railway?**
> - **Vercel** is the gold standard for hosting single-page React applications (`admin-web`), offering instant deployments, zero maintenance, global edge caching, and free SSL.
> - **FastAPI Backend with WebSockets (`/api/v1/ws`)**: Vercel Serverless Functions have maximum execution timeouts (10s to 60s) and do **not** support long-lived WebSocket connections. Real-time officer location streaming and geofence alerts require persistent WebSocket connections and Motor async connection pooling. Therefore, hosting the FastAPI backend on a continuous container platform like **Render**, **Railway**, **Fly.io**, **AWS App Runner**, or a Linux VPS is the industry best practice.

---

## 2. Required Environment Variables & URLs

### A. Frontend Environment Variables (`admin-web` on Vercel)

| Variable Name | Required | Example Production Value | Description |
|---|:---:|---|---|
| `VITE_API_URL` | **Yes** | `https://policehq-api.onrender.com/api/v1` | Public HTTPS REST URL of your deployed backend service. Trailing slashes and `/api/v1` suffixes are automatically normalized. |
| `VITE_WS_URL` | Optional | `wss://policehq-api.onrender.com/api/v1/ws` | Public WSS WebSocket URL. If omitted, it is automatically derived from `VITE_API_URL` by replacing `https://` with `wss://`. |

---

### B. Backend Environment Variables (`backend` on Render / Railway / VPS)

| Variable Name | Required | Example Production Value | Description |
|---|:---:|---|---|
| `MONGODB_URI` | **Yes** | `mongodb+srv://admin:StrongPass@cluster0.abcde.mongodb.net/policehq_geoattend?retryWrites=true&w=majority` | Authoritative MongoDB connection string (MongoDB Atlas cloud cluster or self-hosted MongoDB 7.0+). |
| `MONGODB_DATABASE` | Optional | `policehq_geoattend` | Target database name (defaults to `policehq_geoattend`). Accepts `MONGODB_DB_NAME` alias as well. |
| `JWT_SECRET_KEY` | **Yes** | `d4e5f6...` *(64 hex characters)* | Strong 256-bit cryptographic secret for signing and verifying JSON Web Tokens. Generate with `openssl rand -hex 32`. |
| `JWT_ALGORITHM` | Optional | `HS256` | JWT algorithm (defaults to `HS256`). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | `60` | Lifetime of access tokens before requiring refresh. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | `7` | Lifetime of refresh tokens. |
| `ENVIRONMENT` | **Yes** | `production` | Set to `production` to activate security checks and disable verbose dev traces. |
| `DEBUG` | **Yes** | `false` | Disables FastAPI interactive debug auto-reload and verbose logging. |
| `CORS_ORIGINS` | **Yes** | `["https://policehq-admin.vercel.app"]` | Whitelist of allowed web domains. Accepts JSON array or comma-separated string `https://policehq-admin.vercel.app,http://localhost:5173`. |
| `HOST` | Optional | `0.0.0.0` | Bind host address. |
| `PORT` | Optional | `8000` *(or injected by platform)* | Port to bind. Platforms like Render and Railway automatically inject this. |

---

### C. Constable Mobile App Configuration (`constable-app`)

| Setting | Value / Format | Notes |
|---|---|---|
| **API Base URL** | `https://policehq-api.onrender.com/api/v1` | Can be entered directly on the app login screen under **Advanced / Server Settings**, or set in `lib/core/constants.dart`. |

---

## 3. Step-by-Step Deployment to Vercel (Admin Web Portal)

### Option 1: Deploy via Vercel Web Dashboard (Recommended)

1. **Push your code to GitHub / GitLab / Bitbucket**:
   ```bash
   git init
   git add .
   git commit -m "feat: production ready policehq geoattend system"
   # Push to your private or public GitHub repository
   ```
2. Go to [https://vercel.com](https://vercel.com) and log in.
3. Click **"Add New..."** → **"Project"**.
4. Import your GitHub repository.
5. In the **Configure Project** screen:
   - **Framework Preset**: `Vite` (auto-detected).
   - **Root Directory**: Click *Edit* and select `admin-web`.
   - **Build Command**: `npm run build` (auto-configured).
   - **Output Directory**: `dist` (auto-configured).
6. Expand **Environment Variables** and add:
   - Key: `VITE_API_URL`
   - Value: `https://<YOUR-BACKEND-DOMAIN>/api/v1`
7. Click **Deploy**.
8. Once deployed, Vercel provides a custom URL such as `https://policehq-admin.vercel.app`.

*(Note: If you leave Root Directory as `/`, the included root `vercel.json` will automatically build `admin-web` and serve `admin-web/dist` seamlessly.)*

### Option 2: Deploy via Vercel CLI

```bash
cd admin-web
npm install -g vercel
vercel login
vercel --prod
```
When prompted for environment variables, add `VITE_API_URL=https://<YOUR-BACKEND-DOMAIN>/api/v1`.

---

## 4. Deploying the Backend & Database

### Step 1: Create a Free Cloud Database on MongoDB Atlas
1. Sign up at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster (e.g. M0 tier in AWS `ap-south-1` Mumbai / Hyderabad for lowest latency to Andhra Pradesh).
3. Under **Database Access**, create a user (e.g. `policehq_admin`) and a strong password.
4. Under **Network Access**, click **Add IP Address** → select **Allow Access from Anywhere (`0.0.0.0/0`)** so cloud container hosts can connect.
5. Under **Clusters**, click **Connect** → **Drivers** → Python → copy the connection string:
   ```
   mongodb+srv://policehq_admin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 2: Deploy the FastAPI Backend to Render (Free/Low-cost)
1. Sign up at [https://render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your repository.
4. Configure service settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. In **Environment Variables**, add:
   ```env
   ENVIRONMENT=production
   DEBUG=false
   MONGODB_URI=mongodb+srv://policehq_admin:<password>@cluster0.xxxx.mongodb.net/policehq_geoattend?retryWrites=true&w=majority
   MONGODB_DATABASE=policehq_geoattend
   JWT_SECRET_KEY=<YOUR-GENERATED-64-CHAR-HEX-KEY>
   CORS_ORIGINS=["https://policehq-admin.vercel.app"]
   ```
6. Click **Create Web Service**. Render will provision your service and assign a public URL (e.g. `https://policehq-api.onrender.com`).
7. Verify health:
   - `https://policehq-api.onrender.com/` (Should return `{"status": "OPERATIONAL"}`)
   - `https://policehq-api.onrender.com/api/v1/health` (Should return `{"status": "HEALTHY", "database": "CONNECTED"}`)

---

## 5. Production Health Verification Checklist

- [x] **Database Connectivity**: Automatic ping and geospatial `2dsphere` index verification on startup.
- [x] **Zero-Downtime Seeds**: Default Eluru Headquarters and admin roles (`superadmin`, `hqadmin`) automatically seed if absent.
- [x] **CORS Isolation**: Only requests from the authorized Vercel domain and whitelisted origins are permitted.
- [x] **Dynamic Rollup Chunks**: Frontend chunks split into modular bundles (`vendor-react`, `vendor-leaflet`, `vendor-charts`, `vendor-icons`), minimizing loading latency.
- [x] **SPA URL Fallbacks**: Client routes (`/live-map`, `/attendance`, `/police-directory`) work on direct browser refresh via `vercel.json` rewrites.
- [x] **WebSocket Auto-Failover**: Admin console WebSocket client auto-detects `wss://` on HTTPS pages and reconnects with exponential backoff on intermittent network disruptions.
