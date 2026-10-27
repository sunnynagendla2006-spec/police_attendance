import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import connect_to_mongodb, close_mongodb_connection
from app.services.scheduler_service import start_scheduler_loop
from app.api.v1 import (
    auth,
    officers,
    headquarters,
    location,
    attendance,
    analytics,
    reports,
    audit,
    system,
    websocket,
    assignments,
    snapshots,
    devices,
    app_usage
)

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("policehq_geoattend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to MongoDB, setup indexes, seed Eluru HQ & initial accounts
    logger.info("Starting up PoliceHQ GeoAttend backend service...")
    db = await connect_to_mongodb()

    # Launch background automated report scheduler
    scheduler_task = asyncio.create_task(start_scheduler_loop(db))

    yield

    # Shutdown: cancel background scheduler and close DB connection
    logger.info("Shutting down PoliceHQ GeoAttend backend service...")
    scheduler_task.cancel()
    await close_mongodb_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Police Headquarters Multi-Location Geofencing, Duty Assignments, and Scheduled Workforce Reporting",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS Middleware: Allow origins from anywhere (Vercel, local development, mobile apps, any domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include API v1 Routers
API_V1_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(officers.router, prefix=API_V1_PREFIX)
app.include_router(headquarters.router, prefix=API_V1_PREFIX)
app.include_router(assignments.router, prefix=API_V1_PREFIX)
app.include_router(snapshots.router, prefix=API_V1_PREFIX)
app.include_router(devices.router, prefix=API_V1_PREFIX)
app.include_router(app_usage.router, prefix=API_V1_PREFIX)
app.include_router(location.router, prefix=API_V1_PREFIX)
app.include_router(attendance.router, prefix=API_V1_PREFIX)
app.include_router(analytics.router, prefix=API_V1_PREFIX)
app.include_router(reports.router, prefix=API_V1_PREFIX)
app.include_router(audit.router, prefix=API_V1_PREFIX)
app.include_router(system.router, prefix=API_V1_PREFIX)
app.include_router(websocket.router, prefix=API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "message": "PoliceHQ GeoAttend API — Eluru District Police Headquarters",
        "status": "OPERATIONAL",
        "docs": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
