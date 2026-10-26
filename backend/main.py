import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import connect_to_mongodb, close_mongodb_connection
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
    websocket
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
    await connect_to_mongodb()
    yield
    # Shutdown: close DB connection
    logger.info("Shutting down PoliceHQ GeoAttend backend service...")
    await close_mongodb_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Police Headquarters Geofencing, Attendance, and Visit Monitoring System for Eluru Police HQ",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS Middleware
cors_origins = settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Routers
API_V1_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(officers.router, prefix=API_V1_PREFIX)
app.include_router(headquarters.router, prefix=API_V1_PREFIX)
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
