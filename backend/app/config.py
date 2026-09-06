import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "PeoplePay360"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
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

# Validate that DATABASE_URL and SECRET_KEY are configured
_is_test = os.getenv("TESTING", "").lower() in ("true", "1", "yes")

if not settings.SECRET_KEY:
    if _is_test:
        settings.SECRET_KEY = "test_secret_key_for_isolated_test_db_only_2026"
    else:
        raise RuntimeError(
            "SECRET_KEY environment variable is required in production. "
            "Please configure SECRET_KEY in your environment or backend/.env file."
        )
elif not _is_test and len(settings.SECRET_KEY.strip()) < 16:
    raise RuntimeError(
        "SECRET_KEY must be at least 16 characters long. Please check your backend/.env file."
    )

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
