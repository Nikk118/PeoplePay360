"""
Test suite for Employee Object-Level Authorization & RBAC in PeoplePay360.
Verifies:
1. Login as Employee A.
2. Employee A can access their own profile.
3. Employee A sees ONLY Employee A's profile.
4. Employee A cannot see Employee B.
5. Manually requesting Employee B's ID returns 403 Forbidden.
6. Manually requesting employee list returns only own record.
7. Employee cannot create another employee (403).
8. Employee cannot edit another employee (403).
9. Employee cannot delete another employee (403).
10. Login as HR Manager -> existing employee directory still works.
11. Login as Admin -> existing employee directory still works.
"""

import sys
import os
import unittest
from datetime import date
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models
from app.auth.jwt import get_password_hash

class TestEmployeeRBAC(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        init_isolated_test_db(seed_initial=False)
        cls.db = TestSessionLocal()
        cls.client = TestClient(app)

        pwd_hash = get_password_hash("Password123!")

        # 1. Department
        cls.dept = models.Department(id="dept_test", name="Engineering")
        cls.db.add(cls.dept)
        cls.db.flush()

        # 2. Employee A & User A (role: employee)
        cls.emp_a = models.Employee(
            id="emp_a",
            employee_number="EMP001",
            first_name="Alice",
            last_name="Smith",
            email="alice@peoplepay360.com",
            department_id="dept_test",
            job_title="Software Engineer",
            employee_type="full_time",
            status="active"
        )
        cls.db.add(cls.emp_a)
        cls.db.flush()

        cls.user_a = models.AppUser(
            id="user_a",
            email="alice@peoplepay360.com",
            password_hash=pwd_hash,
            employee_id="emp_a",
            is_active=True
        )
        cls.db.add(cls.user_a)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_a.id, role="employee"))

        # 3. Employee B & User B (role: employee)
        cls.emp_b = models.Employee(
            id="emp_b",
            employee_number="EMP002",
            first_name="Bob",
            last_name="Jones",
            email="bob@peoplepay360.com",
            department_id="dept_test",
            job_title="Product Designer",
            employee_type="full_time",
            status="active"
        )
        cls.db.add(cls.emp_b)
        cls.db.flush()

        cls.user_b = models.AppUser(
            id="user_b",
            email="bob@peoplepay360.com",
            password_hash=pwd_hash,
            employee_id="emp_b",
            is_active=True
        )
        cls.db.add(cls.user_b)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_b.id, role="employee"))

        # 4. User C: Employee without linked employee record
        cls.user_c = models.AppUser(
            id="user_c",
            email="charlie@peoplepay360.com",
            password_hash=pwd_hash,
            employee_id=None,
            is_active=True
        )
        cls.db.add(cls.user_c)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_c.id, role="employee"))

        # 5. HR Manager User (role: hr_manager)
        cls.user_hr = models.AppUser(
            id="user_hr",
            email="hr@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.user_hr)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_hr.id, role="hr_manager"))

        # 6. Admin User (role: admin)
        cls.user_admin = models.AppUser(
            id="user_admin",
            email="admin@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.user_admin)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_admin.id, role="admin"))

        # 7. Time Off Type & Allocations
        cls.leave_type = models.TimeOffType(
            id="type_annual",
            name="Paid Annual Leave",
            code="ANNUAL",
            requires_allocation=True,
            active=True
        )
        cls.db.add(cls.leave_type)
        cls.db.flush()

        # Allocations
        cls.alloc_a = models.TimeOffAllocation(
            id="alloc_a",
            employee_id="emp_a",
            time_off_type_id="type_annual",
            allocated_days=20.0,
            date_from=date(2026, 1, 1),
            date_to=date(2026, 12, 31),
            status="approved"
        )
        cls.alloc_b = models.TimeOffAllocation(
            id="alloc_b",
            employee_id="emp_b",
            time_off_type_id="type_annual",
            allocated_days=15.0,
            date_from=date(2026, 1, 1),
            date_to=date(2026, 12, 31),
            status="approved"
        )
        cls.db.add(cls.alloc_a)
        cls.db.add(cls.alloc_b)
        cls.db.flush()

        # Requests
        cls.req_a = models.TimeOffRequest(
            id="req_a",
            employee_id="emp_a",
            time_off_type_id="type_annual",
            date_from=date(2026, 9, 10),
            date_to=date(2026, 9, 12),
            duration_days=3.0,
            status="pending",
            reason="Alice vacation"
        )
        cls.req_b = models.TimeOffRequest(
            id="req_b",
            employee_id="emp_b",
            time_off_type_id="type_annual",
            date_from=date(2026, 9, 20),
            date_to=date(2026, 9, 22),
            duration_days=3.0,
            status="pending",
            reason="Bob vacation"
        )
        cls.db.add(cls.req_a)
        cls.db.add(cls.req_b)
        cls.db.flush()

        # Attendance records
        from datetime import datetime
        cls.att_a = models.Attendance(
            id="att_a",
            employee_id="emp_a",
            check_in=datetime(2026, 9, 1, 9, 0, 0),
            check_out=datetime(2026, 9, 1, 17, 0, 0),
            worked_hours=8.0,
            status="present"
        )
        cls.att_b = models.Attendance(
            id="att_b",
            employee_id="emp_b",
            check_in=datetime(2026, 9, 1, 9, 30, 0),
            check_out=datetime(2026, 9, 1, 17, 30, 0),
            worked_hours=8.0,
            status="present"
        )
        cls.db.add(cls.att_a)
        cls.db.add(cls.att_b)
        cls.db.flush()

        # HR Payroll User (role: hr_payroll_user)
        cls.user_payroll = models.AppUser(
            id="user_payroll",
            email="payrolluser@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.user_payroll)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.user_payroll.id, role="hr_payroll_user"))

        # Salary Structure & Contracts
        cls.struct = models.SalaryStructure(
            id="struct_test",
            name="Test Salary Structure",
            description="Test structure",
            active=True
        )
        cls.db.add(cls.struct)
        cls.db.flush()

        cls.contract_a = models.Contract(
            id="contract_a",
            employee_id="emp_a",
            name="Alice Contract",
            contract_type="permanent",
            date_start=date(2026, 1, 1),
            wage=50000.0,
            salary_structure_id="struct_test",
            status="active"
        )
        cls.contract_b = models.Contract(
            id="contract_b",
            employee_id="emp_b",
            name="Bob Contract",
            contract_type="permanent",
            date_start=date(2026, 1, 1),
            wage=55000.0,
            salary_structure_id="struct_test",
            status="active"
        )
        cls.db.add_all([cls.contract_a, cls.contract_b])
        cls.db.flush()

        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def get_auth_headers(self, email: str, password: str = "Password123!"):
        resp = self.client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_01_login_as_employee_a(self):
        """Case 1: Login as Employee A succeeds"""
        resp = self.client.post("/api/auth/login", json={"email": "alice@peoplepay360.com", "password": "Password123!"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["email"], "alice@peoplepay360.com")

    def test_02_employee_a_profile_via_me(self):
        """Case 2 & 3: Employee A sees only their own profile via /me"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/employees/me", headers=headers)
        self.assertEqual(resp.status_code, 200)
        emp = resp.json()
        self.assertEqual(emp["id"], "emp_a")
        self.assertEqual(emp["first_name"], "Alice")
        self.assertEqual(emp["email"], "alice@peoplepay360.com")

    def test_03_employee_a_sees_only_own_record_in_list(self):
        """Case 3 & 4: Employee A listing employees sees ONLY Employee A, never Employee B"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/employees", headers=headers)
        self.assertEqual(resp.status_code, 200)
        employees = resp.json()
        self.assertEqual(len(employees), 1)
        self.assertEqual(employees[0]["id"], "emp_a")
        self.assertEqual(employees[0]["first_name"], "Alice")
        # Assert Employee B is NOT in the returned list
        b_ids = [e["id"] for e in employees if e["id"] == "emp_b"]
        self.assertEqual(len(b_ids), 0)

    def test_04_employee_a_manually_requesting_employee_b_returns_403(self):
        """Case 5: Employee A requesting Employee B by ID returns 403 Forbidden"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/employees/emp_b", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_05_employee_a_requesting_own_id_succeeds(self):
        """Employee A requesting own ID succeeds with 200"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/employees/emp_a", headers=headers)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], "emp_a")

    def test_06_employee_a_requesting_employee_b_stats_returns_403(self):
        """Case 5b: Employee A requesting Employee B stats returns 403 Forbidden"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/employees/emp_b/stats", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_07_unlinked_employee_returns_empty_or_404(self):
        """Case 6: Employee without linked employee record gets empty list on list, 404 on me"""
        headers = self.get_auth_headers("charlie@peoplepay360.com")
        resp_list = self.client.get("/api/employees", headers=headers)
        self.assertEqual(resp_list.status_code, 200)
        self.assertEqual(resp_list.json(), [])

        resp_me = self.client.get("/api/employees/me", headers=headers)
        self.assertEqual(resp_me.status_code, 404)
        self.assertIn("Employee profile not found", resp_me.json()["detail"])

    def test_08_employee_cannot_create_employee(self):
        """Case 7: Employee cannot create another employee -> 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.post("/api/employees", headers=headers, json={
            "employee_number": "EMP999",
            "first_name": "Eve",
            "last_name": "Hacker",
            "employee_type": "full_time"
        })
        self.assertEqual(resp.status_code, 403)

    def test_09_employee_cannot_edit_employee(self):
        """Case 8: Employee cannot edit another employee -> 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.put("/api/employees/emp_b", headers=headers, json={
            "employee_number": "EMP002",
            "first_name": "Bob",
            "last_name": "Hacked",
            "employee_type": "full_time"
        })
        self.assertEqual(resp.status_code, 403)

    def test_10_employee_cannot_delete_employee(self):
        """Case 9: Employee cannot delete another employee -> 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.delete("/api/employees/emp_b", headers=headers)
        self.assertEqual(resp.status_code, 403)

    def test_11_hr_manager_can_access_directory(self):
        """Case 10: HR Manager can view full directory and all employees"""
        headers = self.get_auth_headers("hr@peoplepay360.com")
        resp = self.client.get("/api/employees", headers=headers)
        self.assertEqual(resp.status_code, 200)
        employees = resp.json()
        self.assertGreaterEqual(len(employees), 2)
        ids = [e["id"] for e in employees]
        self.assertIn("emp_a", ids)
        self.assertIn("emp_b", ids)

        # HR can access specific employee profiles
        resp_a = self.client.get("/api/employees/emp_a", headers=headers)
        self.assertEqual(resp_a.status_code, 200)
        resp_b = self.client.get("/api/employees/emp_b", headers=headers)
        self.assertEqual(resp_b.status_code, 200)

    def test_12_admin_can_access_directory_and_crud(self):
        """Case 11: Admin can view full directory, create, and manage employees"""
        headers = self.get_auth_headers("admin@peoplepay360.com")
        resp = self.client.get("/api/employees", headers=headers)
        self.assertEqual(resp.status_code, 200)
        employees = resp.json()
        self.assertGreaterEqual(len(employees), 2)

        # Admin can view any profile
        resp_a = self.client.get("/api/employees/emp_a", headers=headers)
        self.assertEqual(resp_a.status_code, 200)
        resp_b = self.client.get("/api/employees/emp_b", headers=headers)
        self.assertEqual(resp_b.status_code, 200)

        # Admin can create employee
        resp_create = self.client.post("/api/employees", headers=headers, json={
            "employee_number": "EMP_ADMIN_TEST",
            "first_name": "New",
            "last_name": "Hire",
            "employee_type": "full_time"
        })
        self.assertEqual(resp_create.status_code, 200)
        new_emp_id = resp_create.json()["id"]

        # Admin can delete employee
        resp_del = self.client.delete(f"/api/employees/{new_emp_id}", headers=headers)
        self.assertEqual(resp_del.status_code, 200)
        self.assertTrue(resp_del.json()["success"])

    # ==================== TIME OFF RBAC TESTS ====================

    def test_13_employee_a_lists_time_off_requests_sees_only_own(self):
        """Employee A listing Time Off requests sees only Alice's requests, not Bob's"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/time-off/requests", headers=headers)
        self.assertEqual(resp.status_code, 200)
        requests = resp.json()
        self.assertGreaterEqual(len(requests), 1)
        for r in requests:
            self.assertEqual(r["employee_id"], "emp_a")

    def test_14_employee_a_requesting_employee_b_time_off_returns_403(self):
        """Employee A requesting Employee B's Time Off requests returns 403 Forbidden"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/time-off/requests?employee_id=emp_b", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_15_employee_a_balances_scoping_and_forbidden_for_other(self):
        """Employee A gets own balances (200), but requesting Employee B balances returns 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        # Own balances
        resp_own = self.client.get("/api/time-off/balances?employee_id=emp_a", headers=headers)
        self.assertEqual(resp_own.status_code, 200)
        # Without param (defaults to self)
        resp_default = self.client.get("/api/time-off/balances", headers=headers)
        self.assertEqual(resp_default.status_code, 200)
        # Attempt to access Employee B's balance
        resp_b = self.client.get("/api/time-off/balances?employee_id=emp_b", headers=headers)
        self.assertEqual(resp_b.status_code, 403)
        self.assertIn("Access denied", resp_b.json()["detail"])

    def test_16_employee_cannot_create_time_off_for_other(self):
        """Employee A attempting to submit leave request for Employee B returns 403 Forbidden"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.post("/api/time-off/requests", headers=headers, json={
            "employee_id": "emp_b",
            "time_off_type_id": "type_annual",
            "date_from": "2026-10-01",
            "date_to": "2026-10-03",
            "reason": "Hacking leave"
        })
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Employees can only create time off requests for themselves", resp.json()["detail"])

    def test_17_employee_cannot_approve_or_refuse_request(self):
        """Employee A cannot approve or refuse any Time Off requests -> 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp_approve = self.client.put("/api/time-off/requests/req_a/approve", headers=headers)
        self.assertEqual(resp_approve.status_code, 403)

        resp_refuse = self.client.put("/api/time-off/requests/req_a/refuse", headers=headers)
        self.assertEqual(resp_refuse.status_code, 403)

    def test_18_employee_can_create_own_time_off_request(self):
        """Employee A can successfully submit their own Time Off request"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.post("/api/time-off/requests", headers=headers, json={
            "employee_id": "emp_a",
            "time_off_type_id": "type_annual",
            "date_from": "2026-11-01",
            "date_to": "2026-11-02",
            "reason": "Doctor visit"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["employee_id"], "emp_a")

    # ==================== ATTENDANCE RBAC TESTS ====================

    def test_19_employee_a_lists_attendance_sees_only_own(self):
        """Employee A listing Attendance sees only Alice's records, not Bob's"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/attendance", headers=headers)
        self.assertEqual(resp.status_code, 200)
        records = resp.json()
        self.assertGreaterEqual(len(records), 1)
        for r in records:
            self.assertEqual(r["employee_id"], "emp_a")

    def test_20_employee_a_requesting_employee_b_attendance_returns_403(self):
        """Employee A querying Employee B's attendance returns 403 Forbidden"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/attendance?employee_id=emp_b", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_21_employee_a_attendance_summary_scoping_and_forbidden_for_other(self):
        """Employee A gets own summary (200), but requesting Employee B's summary returns 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        # Own summary
        resp_own = self.client.get("/api/attendance/summary?employee_id=emp_a&period_start=2026-09-01&period_end=2026-09-30", headers=headers)
        self.assertEqual(resp_own.status_code, 200)
        # Attempt to access Employee B's summary
        resp_b = self.client.get("/api/attendance/summary?employee_id=emp_b&period_start=2026-09-01&period_end=2026-09-30", headers=headers)
        self.assertEqual(resp_b.status_code, 403)
        self.assertIn("Access denied", resp_b.json()["detail"])

    def test_22_employee_a_cannot_checkout_b_record(self):
        """Employee A attempting to check out Employee B's attendance record returns 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.put("/api/attendance/check-out/att_b", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Employees can only check out their own attendance", resp.json()["detail"])

    def test_23_employee_cannot_create_manual_attendance(self):
        """Employee A cannot create manual attendance entries -> 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.post("/api/attendance", headers=headers, json={
            "employee_id": "emp_a",
            "check_in": "2026-09-02T09:00:00",
            "status": "present"
        })
        self.assertEqual(resp.status_code, 403)

    # ==================== HR & ADMIN REGRESSION TESTS ====================

    def test_24_hr_manager_full_visibility_and_actions(self):
        """HR Manager can see all Time Off requests, all attendance, and approve requests"""
        headers = self.get_auth_headers("hr@peoplepay360.com")

        # Can see all Time Off requests
        resp_to = self.client.get("/api/time-off/requests", headers=headers)
        self.assertEqual(resp_to.status_code, 200)
        emp_ids_to = {r["employee_id"] for r in resp_to.json()}
        self.assertIn("emp_a", emp_ids_to)
        self.assertIn("emp_b", emp_ids_to)

        # Can approve a request
        resp_app = self.client.put("/api/time-off/requests/req_b/approve", headers=headers)
        self.assertEqual(resp_app.status_code, 200)
        self.assertEqual(resp_app.json()["status"], "approved")

        # Can see all Attendance records
        resp_att = self.client.get("/api/attendance", headers=headers)
        self.assertEqual(resp_att.status_code, 200)
        emp_ids_att = {r["employee_id"] for r in resp_att.json()}
        self.assertIn("emp_a", emp_ids_att)
        self.assertIn("emp_b", emp_ids_att)

    def test_25_admin_full_visibility(self):
        """Admin can see all Time Off requests and Attendance records"""
        headers = self.get_auth_headers("admin@peoplepay360.com")

        resp_to = self.client.get("/api/time-off/requests", headers=headers)
        self.assertEqual(resp_to.status_code, 200)

        resp_att = self.client.get("/api/attendance", headers=headers)
        self.assertEqual(resp_att.status_code, 200)

    # ==================== CONTRACTS & PAYROLL RBAC REGRESSION TESTS ====================

    def test_26_employee_contracts_object_level_scoping(self):
        """Employee A listing contracts only sees their own contract"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/contracts", headers=headers)
        self.assertEqual(resp.status_code, 200)
        contracts = resp.json()
        self.assertEqual(len(contracts), 1)
        self.assertEqual(contracts[0]["employee_id"], "emp_a")

    def test_27_employee_a_cannot_view_employee_b_contract_by_id(self):
        """Employee A attempting to view Employee B's contract by ID returns 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/contracts/contract_b", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_28_employee_a_cannot_query_applicable_contract_for_employee_b(self):
        """Employee A querying applicable contract for Employee B returns 403"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        resp = self.client.get("/api/contracts/applicable?employee_id=emp_b&period_start=2026-09-01&period_end=2026-09-30", headers=headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access denied", resp.json()["detail"])

    def test_29_employee_cannot_create_or_modify_contracts(self):
        """Employee role cannot create, edit or delete contracts (403)"""
        headers = self.get_auth_headers("alice@peoplepay360.com")
        # Create
        resp_create = self.client.post("/api/contracts", json={
            "employee_id": "emp_a",
            "name": "Hacked Contract",
            "date_start": "2026-01-01",
            "wage": 999999.0
        }, headers=headers)
        self.assertEqual(resp_create.status_code, 403)

        # Delete
        resp_del = self.client.delete("/api/contracts/contract_a", headers=headers)
        self.assertEqual(resp_del.status_code, 403)

    def test_30_hr_manager_no_access_to_payroll_features(self):
        """HR Manager is strictly denied access to Payruns, Payslips, and Salary Structures"""
        headers = self.get_auth_headers("hr@peoplepay360.com")

        resp_pr = self.client.get("/api/payruns", headers=headers)
        self.assertEqual(resp_pr.status_code, 403)

        resp_ps = self.client.get("/api/payslips", headers=headers)
        self.assertEqual(resp_ps.status_code, 403)

        resp_ss = self.client.get("/api/salary-structures", headers=headers)
        self.assertEqual(resp_ss.status_code, 403)

    def test_31_hr_payroll_user_cannot_delete_payruns_or_structures(self):
        """HR Payroll User has read/create/update but cannot delete payruns or salary structures (403)"""
        headers = self.get_auth_headers("payrolluser@peoplepay360.com")

        # Can read salary structures
        resp_ss = self.client.get("/api/salary-structures", headers=headers)
        self.assertEqual(resp_ss.status_code, 200)

        # Cannot delete salary structure
        resp_del_ss = self.client.delete("/api/salary-structures/struct_test", headers=headers)
        self.assertEqual(resp_del_ss.status_code, 403)

        # Cannot delete payrun
        resp_del_pr = self.client.delete("/api/payruns/nonexistent_payrun", headers=headers)
        self.assertEqual(resp_del_pr.status_code, 403)

    def test_32_auth_login_invalid_email_format(self):
        """Login request with invalid email format fails Pydantic validation (422)"""
        resp = self.client.post("/api/auth/login", json={"email": "not-an-email", "password": "Password123!"})
        self.assertEqual(resp.status_code, 422)

    def test_33_contract_date_validation(self):
        """Contract with date_end earlier than date_start fails validation (422)"""
        admin_headers = self.get_auth_headers("admin@peoplepay360.com")
        resp = self.client.post("/api/contracts", json={
            "employee_id": "emp_a",
            "name": "Invalid Date Contract",
            "date_start": "2026-12-31",
            "date_end": "2026-01-01",
            "wage": 50000.0
        }, headers=admin_headers)
        self.assertEqual(resp.status_code, 422)

if __name__ == "__main__":
    unittest.main()
