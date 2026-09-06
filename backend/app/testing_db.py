"""
Isolated in-memory test database module for PeoplePay360.
Ensures tests run against a standalone, isolated SQLite in-memory database
and CANNOT touch, modify, or drop tables in the shared PostgreSQL/Supabase database.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app, seed_initial_data

# Explicit isolated in-memory test database
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def get_test_db():
    """Dependency override providing isolated test database sessions."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_isolated_test_db(seed_initial: bool = True):
    """
    Initializes a fresh isolated in-memory database:
    1. Creates all tables on the isolated test engine.
    2. Overrides FastAPI app.dependency_overrides[get_db] to use the isolated test database.
    3. Seeds initial data into the test database (if seed_initial is True).
    Returns the TestSessionLocal factory.
    """
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    # Direct all FastAPI requests in tests to the test database
    app.dependency_overrides[get_db] = get_test_db

    if seed_initial:
        db = TestSessionLocal()
        try:
            seed_initial_data(db)
        finally:
            db.close()

    return TestSessionLocal

def reset_isolated_test_db():
    """Drops and recreates only the isolated test database tables."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = get_test_db
    db = TestSessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    return TestSessionLocal
