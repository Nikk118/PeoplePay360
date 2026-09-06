import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "PeoplePay360"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "peoplepay360_secret_key_2026_super_secure_hackathon")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Required Supabase / PostgreSQL URL loaded from environment variable (DATABASE_URL).
    # Silent SQLite fallback has been removed to prevent database confusion and data loss.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Resend / Transactional Email Settings
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "PeoplePay360 <onboarding@resend.dev>")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    INVITATION_EXPIRE_HOURS: int = int(os.getenv("INVITATION_EXPIRE_HOURS", "24"))

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="allow")

settings = Settings()

# Validate that DATABASE_URL is configured and points to PostgreSQL
_is_test = os.getenv("TESTING", "").lower() in ("true", "1", "yes")
if not settings.DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required and must point to a valid PostgreSQL database (e.g. Supabase). "
        "Silent SQLite fallback has been removed for data safety. Please check your backend/.env configuration."
    )
if not _is_test and not (settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgres://")):
    raise RuntimeError(
        f"Invalid DATABASE_URL scheme '{settings.DATABASE_URL.split('://')[0]}'. PeoplePay360 requires PostgreSQL (e.g. Supabase). "
        "Silent SQLite fallback has been removed for data safety."
    )
