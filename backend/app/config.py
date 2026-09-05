import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "PeoplePay360"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "peoplepay360_secret_key_2026_super_secure_hackathon")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Supabase PostgreSQL URL loaded from environment variable (DATABASE_URL).
    # Defaults to local SQLite if DATABASE_URL is not set in environment.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./peoplepay360.db"
    )

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="allow")

settings = Settings()
