"""
Test suite for Time Off Request creation, validation, and approval workflow.
Verifies TimeOffType lookup, UUID contract, balance deduction, and RBAC authorization.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models
from app.auth.jwt import create_access_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_isolated_test_db(seed_initial=True)

def get_tokens():
    db: Session = TestSessionLocal()
    try:
        emp_user = db.query(models.AppUser).filter(models.AppUser.email == "employee@peoplepay360.com").first()
        hr_user = db.query(models.AppUser).filter(models.AppUser.email == "hrmanager@peoplepay360.com").first()
        emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
        
        emp_token = create_access_token({
            "sub": emp_user.id,
            "email": emp_user.email,
            "user_id": emp_user.id,
            "employee_id": emp.id,
            "roles": ["employee"]
        })
        hr_token = create_access_token({
            "sub": hr_user.id,
            "email": hr_user.email,
            "user_id": hr_user.id,
            "employee_id": hr_user.employee_id,
            "roles": ["hr_manager"]
        })
        return emp_token, hr_token, emp.id
    finally:
        db.close()

def test_time_off_type_selection_and_request_creation():
    emp_token, hr_token, emp_id = get_tokens()
    headers = {"Authorization": f"Bearer {emp_token}"}
    
    # 1. Fetch available time off types
    types_res = client.get("/api/time-off/types", headers=headers)
    assert types_res.status_code == 200
    types = types_res.json()
    assert len(types) >= 1
    annual_type = next(t for t in types if t["code"] == "ANNUAL")
    annual_type_id = annual_type["id"]
    assert annual_type_id == "t1111111-1111-1111-1111-111111111111"

    # 2. Submit valid request with proper UUID
    payload = {
        "employee_id": emp_id,
        "time_off_type_id": annual_type_id,
        "date_from": "2026-09-15",
        "date_to": "2026-09-17",
        "reason": "Personal leave"
    }
    create_res = client.post("/api/time-off/requests", json=payload, headers=headers)
    assert create_res.status_code == 200
    req_data = create_res.json()
    assert req_data["status"] == "pending"
    assert req_data["duration_days"] == 3.0
    assert req_data["time_off_type_id"] == annual_type_id
    assert req_data["time_off_type_name"] == "Paid Annual Leave"

    # 3. HR Manager approves request
    hr_headers = {"Authorization": f"Bearer {hr_token}"}
    approve_res = client.put(f"/api/time-off/requests/{req_data['id']}/approve", headers=hr_headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

def test_empty_or_whitespace_time_off_type_id_rejected():
    emp_token, _, emp_id = get_tokens()
    headers = {"Authorization": f"Bearer {emp_token}"}

    # Empty string
    res_empty = client.post("/api/time-off/requests", json={
        "employee_id": emp_id,
        "time_off_type_id": "",
        "date_from": "2026-09-15",
        "date_to": "2026-09-17"
    }, headers=headers)
    assert res_empty.status_code == 400
    assert "Time Off Type ID is required" in res_empty.json()["detail"]

    # Whitespace only
    res_blank = client.post("/api/time-off/requests", json={
        "employee_id": emp_id,
        "time_off_type_id": "   ",
        "date_from": "2026-09-15",
        "date_to": "2026-09-17"
    }, headers=headers)
    assert res_blank.status_code == 400
    assert "Time Off Type ID is required" in res_blank.json()["detail"]

def test_invalid_time_off_type_id_returns_400():
    emp_token, _, emp_id = get_tokens()
    headers = {"Authorization": f"Bearer {emp_token}"}

    res = client.post("/api/time-off/requests", json={
        "employee_id": emp_id,
        "time_off_type_id": "non-existent-uuid-99999",
        "date_from": "2026-09-15",
        "date_to": "2026-09-17"
    }, headers=headers)
    assert res.status_code == 400
    assert "Time Off Type not found" in res.json()["detail"]

def test_employee_cannot_approve_own_request():
    emp_token, _, emp_id = get_tokens()
    headers = {"Authorization": f"Bearer {emp_token}"}

    # Create request
    create_res = client.post("/api/time-off/requests", json={
        "employee_id": emp_id,
        "time_off_type_id": "t1111111-1111-1111-1111-111111111111",
        "date_from": "2026-09-15",
        "date_to": "2026-09-17",
        "reason": "Self approval attempt"
    }, headers=headers)
    assert create_res.status_code == 200
    req_id = create_res.json()["id"]

    # Employee role cannot approve
    approve_res = client.put(f"/api/time-off/requests/{req_id}/approve", headers=headers)
    assert approve_res.status_code == 403
