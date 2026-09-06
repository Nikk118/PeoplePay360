import pytest
import secrets
import hashlib
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.config import settings
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models.models import AppUser, UserRole, UserInvitation, Employee
from app.services.email_service import send_invitation_email

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_isolated_db():
    init_isolated_test_db(seed_initial=True)

def get_admin_token():
    resp = client.post("/api/auth/login", json={
        "email": "admin@peoplepay360.com",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]

def test_missing_resend_configuration():
    """Test when RESEND_API_KEY is missing or empty"""
    original_key = settings.RESEND_API_KEY
    try:
        settings.RESEND_API_KEY = ""
        
        # 1. Direct email_service call
        success, msg = send_invitation_email(
            to_email="test@example.com",
            invite_url="http://localhost:3000/set-password?token=abc",
            role="employee"
        )
        assert success is False
        assert "RESEND_API_KEY is missing" in msg

        # 2. Admin creating user reports email failure clearly
        admin_token = get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        unique_email = f"no_resend_{secrets.token_hex(4)}@peoplepay360.com"
        
        create_resp = client.post("/api/users", headers=headers, json={
            "email": unique_email,
            "roles": ["hr_payroll_user"]
        })
        assert create_resp.status_code == 200
        user_data = create_resp.json()
        assert user_data["email_sent"] is False
        assert "RESEND_API_KEY is missing" in user_data["email_error"]

        # 3. Admin resending invitation returns HTTP 502 Bad Gateway
        resend_resp = client.post(f"/api/users/{user_data['id']}/resend-invitation", headers=headers)
        assert resend_resp.status_code == 502
        assert "RESEND_API_KEY is missing" in resend_resp.json()["detail"]

        # Clean up
        db = TestSessionLocal()
        u = db.query(AppUser).filter(AppUser.id == user_data["id"]).first()
        if u:
            db.delete(u)
            db.commit()
        db.close()
    finally:
        settings.RESEND_API_KEY = original_key

def test_resend_api_failure():
    """Test when Resend API returns an error / raises exception"""
    original_key = settings.RESEND_API_KEY
    try:
        settings.RESEND_API_KEY = "re_dummy_test_key"
        
        with patch("resend.Emails.send", side_effect=Exception("Domain not verified on Resend")):
            # 1. Direct email_service call
            success, msg = send_invitation_email(
                to_email="test@example.com",
                invite_url="http://localhost:3000/set-password?token=abc",
                role="employee"
            )
            assert success is False
            assert "Domain not verified on Resend" in msg

            # 2. Admin creating user reports email failure
            admin_token = get_admin_token()
            headers = {"Authorization": f"Bearer {admin_token}"}
            unique_email = f"resend_fail_{secrets.token_hex(4)}@peoplepay360.com"
            
            create_resp = client.post("/api/users", headers=headers, json={
                "email": unique_email,
                "roles": ["hr_payroll_user"]
            })
            assert create_resp.status_code == 200
            user_data = create_resp.json()
            assert user_data["email_sent"] is False
            assert "Domain not verified on Resend" in user_data["email_error"]

            # 3. Admin resending invitation fails with 502
            resend_resp = client.post(f"/api/users/{user_data['id']}/resend-invitation", headers=headers)
            assert resend_resp.status_code == 502
            assert "Domain not verified on Resend" in resend_resp.json()["detail"]

            # Clean up
            db = TestSessionLocal()
            u = db.query(AppUser).filter(AppUser.id == user_data["id"]).first()
            if u:
                db.delete(u)
                db.commit()
            db.close()
    finally:
        settings.RESEND_API_KEY = original_key

def test_resend_api_success():
    """Test when Resend successfully accepts the email"""
    original_key = settings.RESEND_API_KEY
    try:
        settings.RESEND_API_KEY = "re_valid_mock_key"
        
        mock_response = {"id": "resend_msg_98765"}
        with patch("resend.Emails.send", return_value=mock_response) as mock_send:
            # 1. Direct email_service call
            success, msg = send_invitation_email(
                to_email="test@example.com",
                invite_url="http://localhost:3000/set-password?token=abc",
                role="hr_payroll_user",
                employee_name="Jane Doe"
            )
            assert success is True
            assert "resend_msg_98765" in msg
            assert mock_send.called
            sent_params = mock_send.call_args[0][0]
            assert sent_params["to"] == ["test@example.com"]
            assert "PeoplePay360" in sent_params["from"]
            assert "Activate Account" in sent_params["html"]

            # 2. Admin creating user reports email_sent: True
            admin_token = get_admin_token()
            headers = {"Authorization": f"Bearer {admin_token}"}
            unique_email = f"resend_ok_{secrets.token_hex(4)}@peoplepay360.com"
            
            create_resp = client.post("/api/users", headers=headers, json={
                "email": unique_email,
                "roles": ["hr_payroll_user"]
            })
            assert create_resp.status_code == 200
            user_data = create_resp.json()
            assert user_data["email_sent"] is True
            assert user_data["email_error"] is None
            assert user_data["invitation_pending"] is True

            # 3. Admin resend invitation succeeds
            resend_resp = client.post(f"/api/users/{user_data['id']}/resend-invitation", headers=headers)
            assert resend_resp.status_code == 200
            assert resend_resp.json()["success"] is True
            assert "successfully sent" in resend_resp.json()["message"]

            # Clean up
            db = TestSessionLocal()
            u = db.query(AppUser).filter(AppUser.id == user_data["id"]).first()
            if u:
                db.delete(u)
                db.commit()
            db.close()
    finally:
        settings.RESEND_API_KEY = original_key

def test_full_invitation_and_password_setup_flow_with_resend():
    """Verify entire onboarding flow end-to-end with Resend mocked"""
    original_key = settings.RESEND_API_KEY
    try:
        settings.RESEND_API_KEY = "re_valid_mock_key"
        
        with patch("resend.Emails.send", return_value={"id": "msg_flow_123"}):
            admin_token = get_admin_token()
            headers = {"Authorization": f"Bearer {admin_token}"}

            unique_email = f"flow_user_{secrets.token_hex(4)}@peoplepay360.com"
            create_resp = client.post("/api/users", headers=headers, json={
                "email": unique_email,
                "roles": ["hr_payroll_user"]
            })
            assert create_resp.status_code == 200
            created_user = create_resp.json()
            assert created_user["email_sent"] is True
            invite_url = created_user["invitation_link"]
            raw_token = invite_url.split("token=")[1]

            # Validate invitation token
            val_resp = client.get(f"/api/auth/validate-invitation?token={raw_token}")
            assert val_resp.status_code == 200
            assert val_resp.json()["valid"] is True
            assert val_resp.json()["email"] == unique_email

            # User sets password
            new_password = "SecurePassword2026!#"
            set_resp = client.post("/api/auth/set-password", json={
                "token": raw_token,
                "password": new_password,
                "confirm_password": new_password
            })
            assert set_resp.status_code == 200
            assert set_resp.json()["success"] is True

            # Reused token is rejected
            reused_val = client.get(f"/api/auth/validate-invitation?token={raw_token}")
            assert reused_val.status_code == 400

            # User logs in with new credentials
            login_resp = client.post("/api/auth/login", json={
                "email": unique_email,
                "password": new_password
            })
            assert login_resp.status_code == 200
            assert login_resp.json()["roles"] == ["hr_payroll_user"]

            # Clean up
            db = TestSessionLocal()
            u = db.query(AppUser).filter(AppUser.email == unique_email).first()
            if u:
                db.delete(u)
                db.commit()
            db.close()
    finally:
        settings.RESEND_API_KEY = original_key

def test_token_validation_edge_cases_and_resend():
    """Verify invalid token, expired token, trailing slashes, and resend token invalidation"""
    original_key = settings.RESEND_API_KEY
    try:
        settings.RESEND_API_KEY = "re_valid_mock_key"
        with patch("resend.Emails.send", return_value={"id": "msg_edge_123"}):
            admin_token = get_admin_token()
            headers = {"Authorization": f"Bearer {admin_token}"}

            # 1. Test random invalid token
            invalid_val = client.get("/api/auth/validate-invitation?token=completely_invalid_random_token_123")
            assert invalid_val.status_code == 400
            assert "Invalid invitation token" in invalid_val.json()["detail"]

            # 2. Test short token
            short_val = client.get("/api/auth/validate-invitation?token=short")
            assert short_val.status_code == 400
            assert "Invalid invitation token" in short_val.json()["detail"]

            # 3. Create user to get valid token
            unique_email = f"edge_user_{secrets.token_hex(4)}@peoplepay360.com"
            create_resp = client.post("/api/users", headers=headers, json={
                "email": unique_email,
                "roles": ["hr_payroll_user"]
            })
            assert create_resp.status_code == 200
            created_user = create_resp.json()
            raw_token_1 = created_user["invitation_link"].split("token=")[1]

            # 4. Validate with trailing slash and trailing dot (robustness)
            val_slash = client.get(f"/api/auth/validate-invitation?token={raw_token_1}/")
            assert val_slash.status_code == 200
            assert val_slash.json()["valid"] is True

            val_dot = client.get(f"/api/auth/validate-invitation?token={raw_token_1}.")
            assert val_dot.status_code == 200
            assert val_dot.json()["valid"] is True

            # 5. Resend invitation: generates new token and invalidates old token
            resend_resp = client.post(f"/api/users/{created_user['id']}/resend-invitation", headers=headers)
            assert resend_resp.status_code == 200
            raw_token_2 = resend_resp.json()["invitation_link"].split("token=")[1]
            assert raw_token_1 != raw_token_2

            # Old token 1 must now be INVALID
            old_val = client.get(f"/api/auth/validate-invitation?token={raw_token_1}")
            assert old_val.status_code == 400
            assert "Invalid invitation token" in old_val.json()["detail"]

            # New token 2 must be VALID
            new_val = client.get(f"/api/auth/validate-invitation?token={raw_token_2}")
            assert new_val.status_code == 200
            assert new_val.json()["valid"] is True

            # 6. Test expired token
            db = TestSessionLocal()
            inv = db.query(UserInvitation).filter(UserInvitation.user_id == created_user["id"]).first()
            inv.expires_at = datetime.utcnow() - timedelta(hours=1)
            db.commit()
            db.close()

            expired_val = client.get(f"/api/auth/validate-invitation?token={raw_token_2}")
            assert expired_val.status_code == 400
            assert "expired" in expired_val.json()["detail"].lower()

            # Clean up
            db = TestSessionLocal()
            u = db.query(AppUser).filter(AppUser.id == created_user["id"]).first()
            if u:
                db.delete(u)
                db.commit()
            db.close()
    finally:
        settings.RESEND_API_KEY = original_key

def test_delete_user_endpoints():
    """Verify DELETE /api/users/{user_id} RBAC, validation, cascading, and login blocking"""
    admin_token = get_admin_token()
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Non-admin receives 403
    emp_login = client.post("/api/auth/login", json={"email": "employee@peoplepay360.com", "password": "Password123!"})
    assert emp_login.status_code == 200
    emp_token = emp_login.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    del_forbidden = client.delete("/api/users/some-arbitrary-id", headers=emp_headers)
    assert del_forbidden.status_code == 403

    # 2. Missing user returns 404
    del_404 = client.delete("/api/users/00000000-0000-0000-0000-000000000000", headers=admin_headers)
    assert del_404.status_code == 404

    # 3. Admin cannot delete self
    me_resp = client.get("/api/auth/me", headers=admin_headers)
    admin_id = me_resp.json()["id"]
    del_self = client.delete(f"/api/users/{admin_id}", headers=admin_headers)
    assert del_self.status_code == 400
    assert "cannot delete your own" in del_self.json()["detail"].lower()

    # 4. Create user with pending invitation and linked employee
    db = TestSessionLocal()
    test_emp = Employee(
        employee_number=f"DEL{secrets.token_hex(3)}",
        first_name="Delete",
        last_name="Test",
        email=f"del_emp_{secrets.token_hex(3)}@peoplepay360.com",
        employee_type="full_time",
        hire_date=datetime.utcnow().date()
    )
    db.add(test_emp)
    db.commit()
    db.refresh(test_emp)
    emp_id = test_emp.id
    db.close()

    unique_email = f"del_pending_{secrets.token_hex(4)}@peoplepay360.com"
    create_resp = client.post("/api/users", headers=admin_headers, json={
        "email": unique_email,
        "employee_id": emp_id,
        "roles": ["employee"]
    })
    assert create_resp.status_code == 200
    user_data = create_resp.json()
    user_id = user_data["id"]

    # Verify user and invitation exist in DB
    db = TestSessionLocal()
    u_db = db.query(AppUser).filter(AppUser.id == user_id).first()
    assert u_db is not None
    assert u_db.invitation is not None
    inv_id = u_db.invitation.id
    db.close()

    # Delete pending user
    del_resp = client.delete(f"/api/users/{user_id}", headers=admin_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # Verify user and invitation are deleted, but employee is preserved
    db = TestSessionLocal()
    assert db.query(AppUser).filter(AppUser.id == user_id).first() is None
    assert db.query(UserInvitation).filter(UserInvitation.id == inv_id).first() is None
    if emp_id:
        assert db.query(Employee).filter(Employee.id == emp_id).first() is not None, "Employee record must NOT be deleted"
    db.close()

    # 5. Create user with password, verify login works, delete user, verify login is blocked
    active_email = f"del_active_{secrets.token_hex(4)}@peoplepay360.com"
    create_active = client.post("/api/users", headers=admin_headers, json={
        "email": active_email,
        "password": "ValidPassword123!",
        "roles": ["hr_payroll_user"]
    })
    assert create_active.status_code == 200
    active_id = create_active.json()["id"]

    # Login succeeds
    login_ok = client.post("/api/auth/login", json={"email": active_email, "password": "ValidPassword123!"})
    assert login_ok.status_code == 200

    # Delete active user
    del_active_resp = client.delete(f"/api/users/{active_id}", headers=admin_headers)
    assert del_active_resp.status_code == 200

    # Login now fails
    login_fail = client.post("/api/auth/login", json={"email": active_email, "password": "ValidPassword123!"})
    assert login_fail.status_code == 401

    # Clean up test employee
    if emp_id:
        db = TestSessionLocal()
        e = db.query(Employee).filter(Employee.id == emp_id).first()
        if e:
            db.delete(e)
            db.commit()
        db.close()


