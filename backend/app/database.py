from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL

# Normalize postgres:// to postgresql:// for SQLAlchemy compatibility (common in Supabase / Heroku / Render URLs)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Configure engine options based on driver
engine_kwargs = {}
if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / Supabase optimizations: reconnect on stale connections
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(
    db_url,
    echo=False,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- CRITICAL DATABASE SAFETY GUARD ---
# Prevents any code or test from executing destructive drop_all operations
# against the shared/production PostgreSQL database.
_original_metadata_drop_all = Base.metadata.drop_all

def _safe_metadata_drop_all(bind=None, **kwargs):
    target_bind = bind or engine
    target_url_str = str(getattr(target_bind, "url", target_bind)).lower()
    if "postgres" in target_url_str:
        raise RuntimeError(
            "CRITICAL SAFETY VIOLATION BLOCKED: Base.metadata.drop_all() was attempted against a PostgreSQL database! "
            "Destructive schema operations against the shared PostgreSQL/Supabase database are strictly forbidden. "
            "Use an isolated test database (e.g. app.testing_db) for test teardown."
        )
    return _original_metadata_drop_all(bind=target_bind, **kwargs)

Base.metadata.drop_all = _safe_metadata_drop_all

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
