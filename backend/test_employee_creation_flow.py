"""
Comprehensive test suite for Employee Account Creation, Employee Linking, and Onboarding Flow.

Tests:
1. Admin creates an Employee account by linking an existing Employee (Case A).
2. Admin creates an Employee account along with a new Employee record (Case B).
3. Attempting to create an Employee account without linking or creating an Employee is rejected (400).
4. Attempting to link an already linked Employee is rejected (400).
5. Attempting to link an inactive Employee is rejected (400).
6. Non-employee role (e.g., HR/Admin) can be created without an Employee record.
7. Verification of complete end-to-end chain:
   - Admin invites new Employee (Case B).
   - Employee appears in Employee Directory (GET /api/employees).
   - AppUser appears in Admin Users table with linked employee_name.
   - Employee sets password via token.
   - Employee logs in.
   - Employee accesses GET /api/employees/me -> matches newly created employee.
   - Employee accesses GET /api/time-off/requests -> scoped to this employee.
   - Employee accesses GET /api/attendance -> scoped to this employee.
   - Employee cannot access other employees' data.
   - HR Manager can see this employee in the Employee Directory.
"""

import sys
import os
import unittest
import secrets
from fastapi.testclient import TestClient
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.config import settings
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models
from app.auth.jwt import get_password_hash

class TestEmployeeCreationFlow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_isolated_test_db(seed_initial=False)
        cls.db = TestSessionLocal()
        cls.client = TestClient(app)

        pwd_hash = get_password_hash("Password123!")

        # 1. Department
        cls.dept = models.Department(id="dept_eng", name="Engineering")
        cls.db.add(cls.dept)
        cls.db.flush()

        # 2. Admin User
        cls.admin_user = models.AppUser(
            id="user_admin_test",
            email="admin@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.admin_user)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.admin_user.id, role="admin"))

        # 3. HR Manager User
        cls.hr_user = models.AppUser(
            id="user_hr_test",
            email="hr@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.hr_user)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.hr_user.id, role="hr_manager"))

        # 4. Existing Unlinked Employee
        cls.unlinked_emp = models.Employee(
            id="emp_unlinked",
            employee_number="EMP_UNLINKED",
            first_name="David",
            last_name="Miller",
            email="david.miller@peoplepay360.com",
            department_id="dept_eng",
            status="active"
        )
        cls.db.add(cls.unlinked_emp)

        # 5. Existing Inactive Employee
        cls.inactive_emp = models.Employee(
            id="emp_inactive",
            employee_number="EMP_INACTIVE",
            first_name="Ghost",
            last_name="User",
            email="ghost@peoplepay360.com",
            status="inactive"
        )
        cls.db.add(cls.inactive_emp)

        # 6. Existing Linked Employee
        cls.linked_emp = models.Employee(
            id="emp_already_linked",
            employee_number="EMP_LINKED",
            first_name="Sarah",
            last_name="Connor",
            email="sarah@peoplepay360.com",
            status="active"
        )
        cls.db.add(cls.linked_emp)
        cls.db.flush()

        cls.user_sarah = models.AppUser(
            id="user_sarah",
            email="sarah@peoplepay360.com",
            password_hash=pwd_hash,
            employee_id=cls.linked_emp.id,
            is_active=True
        )
        cls.db.add(cls.user_sarah)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_sarah.id, role="employee"))

        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def get_auth_headers(self, email: str, password: str = "Password123!"):
        resp = self.client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_01_create_employee_without_linking_or_creating_rejected(self):
        """Creating an Employee role account with no employee_id or new_employee is rejected (400)"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        resp = self.client.post("/api/users", headers=headers, json={
            "email": "orphan_employee@peoplepay360.com",
            "roles": ["employee"]
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Employee accounts must be linked", resp.json()["detail"])

    def test_02_create_employee_with_already_linked_employee_rejected(self):
        """Linking an already-linked Employee is rejected (400)"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        resp = self.client.post("/api/users", headers=headers, json={
            "email": "duplicate_sarah@peoplepay360.com",
            "employee_id": self.linked_emp.id,
            "roles": ["employee"]
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already linked", resp.json()["detail"])

    def test_03_create_employee_with_inactive_employee_rejected(self):
        """Linking an inactive Employee is rejected (400)"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        resp = self.client.post("/api/users", headers=headers, json={
            "email": "ghost_account@peoplepay360.com",
            "employee_id": self.inactive_emp.id,
            "roles": ["employee"]
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("inactive", resp.json()["detail"].lower())

    def test_04_create_employee_case_a_existing_employee_success(self):
        """Case A: Admin creates an Employee account linking an existing unlinked Employee"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        with patch("resend.Emails.send", return_value={"id": "msg_case_a"}):
            resp = self.client.post("/api/users", headers=headers, json={
                "email": "david.miller@peoplepay360.com",
                "employee_id": self.unlinked_emp.id,
                "roles": ["employee"]
            })
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["email"], "david.miller@peoplepay360.com")
            self.assertEqual(data["employee_id"], self.unlinked_emp.id)
            self.assertEqual(data["employee_name"], "David Miller")
            self.assertTrue(data["invitation_pending"])

    def test_05_create_employee_case_b_new_employee_success(self):
        """Case B: Admin creates an Employee account AND new Employee record together"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        with patch("resend.Emails.send", return_value={"id": "msg_case_b"}):
            resp = self.client.post("/api/users", headers=headers, json={
                "email": "fresh.hire@peoplepay360.com",
                "roles": ["employee"],
                "new_employee": {
                    "first_name": "Fresh",
                    "last_name": "Hire",
                    "employee_number": "EMP_FRESH_001",
                    "department_id": "dept_eng",
                    "job_title": "Backend Developer",
                    "employee_type": "full_time"
                }
            })
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["email"], "fresh.hire@peoplepay360.com")
            self.assertIsNotNone(data["employee_id"])
            self.assertEqual(data["employee_name"], "Fresh Hire")
            self.assertTrue(data["invitation_pending"])

            # Verify the Employee record was created in the Employee Directory
            emp_check = self.client.get(f"/api/employees/{data['employee_id']}", headers=headers)
            self.assertEqual(emp_check.status_code, 200)
            emp_data = emp_check.json()
            self.assertEqual(emp_data["first_name"], "Fresh")
            self.assertEqual(emp_data["last_name"], "Hire")
            self.assertEqual(emp_data["employee_number"], "EMP_FRESH_001")
            self.assertEqual(emp_data["department_id"], "dept_eng")

    def test_06_non_employee_role_can_be_created_without_employee(self):
        """Admin or HR roles can be created without an Employee record (System User)"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        with patch("resend.Emails.send", return_value={"id": "msg_sys_admin"}):
            resp = self.client.post("/api/users", headers=headers, json={
                "email": "sysadmin@peoplepay360.com",
                "roles": ["admin"]
            })
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertIsNone(data["employee_id"])
            self.assertIsNone(data["employee_name"])

    def test_07_complete_employee_onboarding_and_scoping_chain(self):
        """
        Complete end-to-end chain:
        Admin Add User (Case B)
        -> Employee appears in Directory
        -> User appears in Admin Users with linked employee name
        -> Employee sets password
        -> Employee logs in
        -> My Profile shows correct employee
        -> My Time Off scopes to this employee
        -> My Attendance scopes to this employee
        -> Employee cannot access other employees' records
        """
        admin_headers = self.get_auth_headers("admin@peoplepay360.com")
        emp_email = "alexander.wright@peoplepay360.com"

        # 1. Admin creates user with new Employee
        with patch("resend.Emails.send", return_value={"id": "msg_alex"}):
            create_resp = self.client.post("/api/users", headers=admin_headers, json={
                "email": emp_email,
                "roles": ["employee"],
                "new_employee": {
                    "first_name": "Alexander",
                    "last_name": "Wright",
                    "employee_number": "EMP_ALEX_99",
                    "department_id": "dept_eng",
                    "job_title": "QA Engineer",
                    "employee_type": "full_time"
                }
            })
            self.assertEqual(create_resp.status_code, 200)
            user_data = create_resp.json()
            alex_emp_id = user_data["employee_id"]
            self.assertIsNotNone(alex_emp_id)
            self.assertEqual(user_data["employee_name"], "Alexander Wright")
            invite_url = user_data["invitation_link"]
            raw_token = invite_url.split("token=")[1]

        # 2. Check Admin Users list shows Linked Employee name
        users_list = self.client.get("/api/users", headers=admin_headers)
        self.assertEqual(users_list.status_code, 200)
        found_alex = next((u for u in users_list.json() if u["email"] == emp_email), None)
        self.assertIsNotNone(found_alex)
        self.assertEqual(found_alex["employee_name"], "Alexander Wright")
        self.assertEqual(found_alex["employee_id"], alex_emp_id)

        # 3. Check Employee Directory contains the new employee
        dir_resp = self.client.get("/api/employees", headers=admin_headers)
        self.assertEqual(dir_resp.status_code, 200)
        emp_in_dir = next((e for e in dir_resp.json() if e["id"] == alex_emp_id), None)
        self.assertIsNotNone(emp_in_dir)
        self.assertEqual(emp_in_dir["first_name"], "Alexander")

        # 4. HR Manager can also see this employee in Directory
        hr_headers = self.get_auth_headers("hr@peoplepay360.com")
        hr_dir = self.client.get("/api/employees", headers=hr_headers)
        self.assertEqual(hr_dir.status_code, 200)
        hr_emp = next((e for e in hr_dir.json() if e["id"] == alex_emp_id), None)
        self.assertIsNotNone(hr_emp)

        # 5. Employee sets password
        new_password = "AlexanderPassword2026!"
        set_resp = self.client.post("/api/auth/set-password", json={
            "token": raw_token,
            "password": new_password,
            "confirm_password": new_password
        })
        self.assertEqual(set_resp.status_code, 200)
        self.assertTrue(set_resp.json()["success"])

        # 6. Employee logs in
        login_resp = self.client.post("/api/auth/login", json={
            "email": emp_email,
            "password": new_password
        })
        self.assertEqual(login_resp.status_code, 200)
        alex_token = login_resp.json()["access_token"]
        alex_headers = {"Authorization": f"Bearer {alex_token}"}
        self.assertEqual(login_resp.json()["employee_id"], alex_emp_id)

        # 7. Employee accesses /me -> returns Alexander Wright
        me_resp = self.client.get("/api/employees/me", headers=alex_headers)
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["id"], alex_emp_id)
        self.assertEqual(me_resp.json()["first_name"], "Alexander")

        # 8. Employee accesses /employees (directory query) -> strictly 1 record (self)
        my_list = self.client.get("/api/employees", headers=alex_headers)
        self.assertEqual(my_list.status_code, 200)
        self.assertEqual(len(my_list.json()), 1)
        self.assertEqual(my_list.json()[0]["id"], alex_emp_id)

        # 9. Employee attempting to access Sarah Connor's profile -> 403
        forbidden_profile = self.client.get(f"/api/employees/{self.linked_emp.id}", headers=alex_headers)
        self.assertEqual(forbidden_profile.status_code, 403)

        # 10. Employee accesses Time Off requests -> empty or own only
        time_off_resp = self.client.get("/api/time-off/requests", headers=alex_headers)
        self.assertEqual(time_off_resp.status_code, 200)
        for r in time_off_resp.json():
            self.assertEqual(r["employee_id"], alex_emp_id)

        # 11. Employee attempting to query Sarah's Time Off -> 403
        forbidden_to = self.client.get(f"/api/time-off/requests?employee_id={self.linked_emp.id}", headers=alex_headers)
        self.assertEqual(forbidden_to.status_code, 403)

        # 12. Employee accesses Attendance -> own only
        att_resp = self.client.get("/api/attendance", headers=alex_headers)
        self.assertEqual(att_resp.status_code, 200)
        for a in att_resp.json():
            self.assertEqual(a["employee_id"], alex_emp_id)

        # 13. Employee attempting to query Sarah's Attendance -> 403
        forbidden_att = self.client.get(f"/api/attendance?employee_id={self.linked_emp.id}", headers=alex_headers)
        self.assertEqual(forbidden_att.status_code, 403)

    def test_08_admin_link_employee_endpoint(self):
        """Admin can link an unlinked user to an active employee via PATCH /api/users/{user_id}/link-employee"""
        admin_headers = self.get_auth_headers("admin@peoplepay360.com")

        # 1. Create an unlinked employee
        fresh_unlinked_emp = models.Employee(
            id="emp_fresh_link_test",
            employee_number="EMP_FRESH_LINK",
            first_name="Marcus",
            last_name="Brody",
            email="marcus.brody@peoplepay360.com",
            status="active"
        )
        self.db.add(fresh_unlinked_emp)

        # 2. Create an unlinked user
        unlinked_user = models.AppUser(
            id="user_unlinked_test",
            email="to_be_linked@peoplepay360.com",
            password_hash=get_password_hash("Password123!"),
            is_active=True
        )
        self.db.add(unlinked_user)
        self.db.flush()
        self.db.add(models.UserRole(user_id=unlinked_user.id, role="employee"))
        self.db.commit()

        # 3. Link to the active unlinked employee
        link_resp = self.client.patch(
            f"/api/users/{unlinked_user.id}/link-employee",
            headers=admin_headers,
            json={"employee_id": fresh_unlinked_emp.id}
        )
        self.assertEqual(link_resp.status_code, 200)
        self.assertEqual(link_resp.json()["employee_id"], fresh_unlinked_emp.id)
        self.assertEqual(link_resp.json()["employee_name"], "Marcus Brody")

        # 3. Attempt to link to already linked employee fails (400)
        dup_resp = self.client.patch(
            f"/api/users/{unlinked_user.id}/link-employee",
            headers=admin_headers,
            json={"employee_id": self.linked_emp.id}
        )
        self.assertEqual(dup_resp.status_code, 400)
        self.assertIn("already linked", dup_resp.json()["detail"])

        # 4. Attempt to link to inactive employee fails (400)
        inact_resp = self.client.patch(
            f"/api/users/{unlinked_user.id}/link-employee",
            headers=admin_headers,
            json={"employee_id": self.inactive_emp.id}
        )
        self.assertEqual(inact_resp.status_code, 400)
        self.assertIn("inactive", inact_resp.json()["detail"])

    def test_09_exact_required_flow_existing_employee(self):
        """
        Exact required flow:
        Admin selects existing Employee -> creates AppUser with employee_id -> sends invitation.
        Password set -> user active -> employee_id unchanged -> no duplicate employee.
        """
        admin_headers = self.get_auth_headers("admin@peoplepay360.com")

        # 1. Fresh Employee exists in Employee Directory
        fresh_emp = models.Employee(
            id="emp_required_flow_test",
            employee_number="EMP_REQ_001",
            first_name="Eleanor",
            last_name="Vance",
            email="eleanor.vance@peoplepay360.com",
            department_id="dept_eng",
            status="active"
        )
        self.db.add(fresh_emp)
        self.db.commit()

        initial_emp_count = self.db.query(models.Employee).count()

        # 2. Rejection if Employee-role user has NO employee_id (Point 9)
        no_emp_resp = self.client.post("/api/users", headers=admin_headers, json={
            "email": "orphan_fail@peoplepay360.com",
            "roles": ["employee"]
        })
        self.assertEqual(no_emp_resp.status_code, 400)

        # 3. Admin creates Employee AppUser linked to Eleanor (Point 1: invitation created)
        with patch("resend.Emails.send", return_value={"id": "msg_eleanor"}):
            create_resp = self.client.post("/api/users", headers=admin_headers, json={
                "email": "eleanor.vance@peoplepay360.com",
                "employee_id": fresh_emp.id,
                "roles": ["employee"]
            })
            self.assertEqual(create_resp.status_code, 200)
            user_data = create_resp.json()
            self.assertEqual(user_data["employee_id"], fresh_emp.id)
            self.assertEqual(user_data["employee_name"], "Eleanor Vance")
            self.assertTrue(user_data["invitation_pending"])

        # 4. Verify in DB immediately: app_users.employee_id == employees.id (BEFORE password setup)
        created_app_user = self.db.query(models.AppUser).filter(models.AppUser.email == "eleanor.vance@peoplepay360.com").first()
        self.assertIsNotNone(created_app_user)
        self.assertEqual(created_app_user.employee_id, fresh_emp.id)
        self.assertFalse(created_app_user.is_active)

        # 5. Same Employee cannot be linked to another user (Point 10)
        dup_link_resp = self.client.post("/api/users", headers=admin_headers, json={
            "email": "eleanor_clone@peoplepay360.com",
            "employee_id": fresh_emp.id,
            "roles": ["employee"]
        })
        self.assertEqual(dup_link_resp.status_code, 400)
        self.assertIn("already linked", dup_link_resp.json()["detail"])

        # 6. Extract invitation token and set password (Point 2)
        invitation = self.db.query(models.UserInvitation).filter(models.UserInvitation.user_id == created_app_user.id).first()
        self.assertIsNotNone(invitation)

        # Extract raw token from invite link
        invite_link = user_data["invitation_link"]
        raw_token = invite_link.split("token=")[1]

        set_pwd_resp = self.client.post("/api/auth/set-password", json={
            "token": raw_token,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!"
        })
        self.assertEqual(set_pwd_resp.status_code, 200)

        # 7. Verify AppUser is now active (Point 3)
        self.db.refresh(created_app_user)
        self.assertTrue(created_app_user.is_active)

        # 8. Verify employee_id remains EXACTLY the same (Point 4)
        self.assertEqual(created_app_user.employee_id, fresh_emp.id)

        # 9. Verify NO duplicate employee was created (Point 8)
        current_emp_count = self.db.query(models.Employee).count()
        self.assertEqual(current_emp_count, initial_emp_count)

        # 10. Login works (Point 5)
        login_resp = self.client.post("/api/auth/login", json={
            "email": "eleanor.vance@peoplepay360.com",
            "password": "SecurePassword123!"
        })
        self.assertEqual(login_resp.status_code, 200)
        eleanor_token = login_resp.json()["access_token"]
        eleanor_headers = {"Authorization": f"Bearer {eleanor_token}"}

        # 11. /api/employees/me returns linked employee (Point 6)
        me_resp = self.client.get("/api/employees/me", headers=eleanor_headers)
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["id"], fresh_emp.id)
        self.assertEqual(me_resp.json()["first_name"], "Eleanor")

        # 12. Employee sees only own Attendance and Time Off (Point 7)
        to_resp = self.client.get("/api/time-off/requests", headers=eleanor_headers)
        self.assertEqual(to_resp.status_code, 200)
        for r in to_resp.json():
            self.assertEqual(r["employee_id"], fresh_emp.id)

        att_resp = self.client.get("/api/attendance", headers=eleanor_headers)
        self.assertEqual(att_resp.status_code, 200)
        for a in att_resp.json():
            self.assertEqual(a["employee_id"], fresh_emp.id)

if __name__ == "__main__":
    unittest.main()
