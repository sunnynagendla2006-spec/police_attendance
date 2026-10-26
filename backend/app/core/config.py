import os
import json
import logging
from typing import List, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices, field_validator

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "PoliceHQ GeoAttend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Auth
    JWT_SECRET_KEY: str = "super-secret-police-hq-jwt-key-change-in-production-min32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = Field(
        default="policehq_geoattend",
        validation_alias=AliasChoices("MONGODB_DATABASE", "MONGODB_DB_NAME")
    )

    # Default Headquarters Configuration (Eluru District Police HQ, AP)
    DEFAULT_HQ_NAME: str = "Eluru District Police Headquarters"
    DEFAULT_HQ_ADDRESS: str = "District Police Office, Sanivarapupeta, Eluru, Andhra Pradesh 534007"
    DEFAULT_HQ_LATITUDE: float = 16.7107
    DEFAULT_HQ_LONGITUDE: float = 81.0952
    DEFAULT_GEOFENCE_RADIUS_METERS: float = 100.0
    DEFAULT_ACCURACY_THRESHOLD_METERS: float = 35.0
    DEFAULT_STALE_THRESHOLD_SECONDS: int = 300
    GEOFENCE_HYSTERESIS_METERS: float = 10.0
    ENTRY_CONFIRMATION_COUNT: int = 2
    EXIT_CONFIRMATION_COUNT: int = 2

    # CORS & Server
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "*"
    ]
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            trimmed = v.strip()
            if trimmed.startswith("[") and trimmed.endswith("]"):
                try:
                    return json.loads(trimmed)
                except Exception:
                    pass
            return [origin.strip() for origin in trimmed.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

if settings.ENVIRONMENT.lower() == "production":
    if "super-secret-police-hq" in settings.JWT_SECRET_KEY:
        logger.warning(
            "SECURITY WARNING: Default JWT_SECRET_KEY is being used in production. "
            "Please generate a strong secret key using `openssl rand -hex 32`."
        )
