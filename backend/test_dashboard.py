"""
Test suite for Dashboard & Reports module in PeoplePay360.
Covers:
- Authentication requirement
- RBAC enforcement (management vs employee access)
- Empty database gracefulness
- Payroll Summary calculations
- Payslip Status counts
- Salary by Department breakdown
- Payroll Trends
- Attendance Summary
- Time Off Summary
- System & Payroll Warnings
- Filter handling (period, department, status)
"""

import sys
import os
import unittest
from datetime import date
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import models
from app.auth.jwt import create_access_token, get_password_hash

class TestDashboardModule(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # Seed test users
        pwd_hash = get_password_hash("Password123!")

        # 1. Admin / HR user
        cls.admin_user = models.AppUser(
            id="u_admin_dash",
            email="admin_dash@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.admin_user)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.admin_user.id, role="admin"))

        # 2. Departments
        cls.dept_eng = models.Department(id="d_eng", name="Engineering")
        cls.dept_hr = models.Department(id="d_hr", name="Human Resources")
        cls.db.add_all([cls.dept_eng, cls.dept_hr])
        cls.db.flush()

        # 3. Schedule
        cls.sched = models.WorkingSchedule(id="s_dash", name="Standard 40h", schedule_type="standard")
        cls.db.add(cls.sched)
        cls.db.flush()

        # 4. Employees
        cls.emp_john = models.Employee(
            id="e_john",
            employee_number="EMP_D1",
            first_name="John",
            last_name="Doe",
            email="john@peoplepay360.com",
            department_id=cls.dept_eng.id,
            working_schedule_id=cls.sched.id,
            status="active"
        )
        cls.emp_jane = models.Employee(
            id="e_jane",
            employee_number="EMP_D2",
            first_name="Jane",
            last_name="Smith",
            email="jane@peoplepay360.com",
            department_id=cls.dept_hr.id,
            working_schedule_id=None, # Missing schedule triggers warning!
            status="active"
        )
        cls.db.add_all([cls.emp_john, cls.emp_jane])
        cls.db.flush()

        # 5. Regular Employee User
        cls.emp_user = models.AppUser(
            id="u_john_dash",
            employee_id=cls.emp_john.id,
            email="john@peoplepay360.com",
            password_hash=pwd_hash,
            is_active=True
        )
        cls.db.add(cls.emp_user)
        cls.db.flush()
        cls.db.add(models.UserRole(user_id=cls.emp_user.id, role="employee"))

        # 6. Salary Structure & Contracts
        cls.struct = models.SalaryStructure(id="struct_dash", name="Dash Structure", active=True)
        cls.db.add(cls.struct)
        cls.db.flush()

        cls.c_john = models.Contract(
            id="c_john",
            employee_id=cls.emp_john.id,
            name="John Contract",
            contract_type="permanent",
            department_id=cls.dept_eng.id,
            date_start=date(2026, 1, 1),
            wage=50000.0,
            salary_structure_id=cls.struct.id,
            working_schedule_id=cls.sched.id,
            status="active"
        )
        cls.db.add(cls.c_john)
        cls.db.flush()

        # 7. Payrun & Payslips
        cls.payrun = models.Payrun(
            id="pr_dash",
            name="Sep 2026 Payrun",
            salary_structure_id=cls.struct.id,
            period_start=date(2026, 9, 1),
            period_end=date(2026, 9, 30),
            status="computed"
        )
        cls.db.add(cls.payrun)
        cls.db.flush()

        cls.ps_john = models.Payslip(
            id="ps_john",
            payrun_id=cls.payrun.id,
            employee_id=cls.emp_john.id,
            contract_id=cls.c_john.id,
            period_start=date(2026, 9, 1),
            period_end=date(2026, 9, 30),
            worked_days=22.0,
            worked_hours=176.0,
            basic_salary=50000.0,
            total_allowances=10000.0,
            gross_salary=60000.0,
            total_deductions=10000.0,
            net_salary=50000.0,
            status="computed",
            warnings_json='["Tax calculated based on formula"]'
        )
        cls.db.add(cls.ps_john)
        cls.db.flush()

        # 8. Attendance
        from datetime import datetime
        cls.att_john = models.Attendance(
            id="att_john",
            employee_id=cls.emp_john.id,
            check_in=datetime(2026, 9, 5, 9, 0, 0),
            check_out=datetime(2026, 9, 5, 17, 0, 0),
            status="present",
            worked_hours=8.0
        )
        cls.db.add(cls.att_john)

        # 9. Time Off Type, Allocation, Request
        cls.tt = models.TimeOffType(id="tt_dash", name="Paid Leave", code="PAID", unit="days")
        cls.db.add(cls.tt)
        cls.db.flush()

        cls.alloc = models.TimeOffAllocation(
            id="alloc_john",
            employee_id=cls.emp_john.id,
            time_off_type_id=cls.tt.id,
            allocated_days=15.0,
            taken_days=2.0,
            date_from=date(2026, 1, 1),
            date_to=date(2026, 12, 31),
            status="approved"
        )
        cls.req = models.TimeOffRequest(
            id="req_john",
            employee_id=cls.emp_john.id,
            time_off_type_id=cls.tt.id,
            date_from=date(2026, 9, 10),
            date_to=date(2026, 9, 11),
            duration_days=2.0,
            status="approved"
        )
        cls.db.add_all([cls.alloc, cls.req])

        cls.db.commit()

        # Generate tokens
        cls.admin_token = create_access_token({
            "sub": cls.admin_user.id,
            "email": cls.admin_user.email,
            "user_id": cls.admin_user.id,
            "employee_id": None,
            "roles": ["admin"]
        })
        cls.emp_token = create_access_token({
            "sub": cls.emp_user.id,
            "email": cls.emp_user.email,
            "user_id": cls.emp_user.id,
            "employee_id": cls.emp_john.id,
            "roles": ["employee"]
        })

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_authentication_required(self):
        """Test 1: Dashboard endpoints require authentication."""
        res = self.client.get("/api/dashboard/overview")
        self.assertEqual(res.status_code, 401)

    def test_02_admin_summary(self):
        """Test 2: Admin can fetch organization-wide dashboard summary."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/summary", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_gross_salary"], 60000.0)
        self.assertEqual(data["total_net_salary"], 50000.0)
        self.assertEqual(data["payslip_count"], 1)
        self.assertEqual(data["total_employees"], 2)

    def test_03_payslip_status_counts(self):
        """Test 3: Payslip status endpoint returns accurate live counts."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/payslip-status", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["computed"], 1)
        self.assertEqual(data["total"], 1)

    def test_04_salary_by_department(self):
        """Test 4: Salary by department aggregation from database."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/salary-by-department", headers=headers)
        self.assertEqual(res.status_code, 200)
        items = res.json()
        self.assertTrue(len(items) >= 1)
        eng_item = next((i for i in items if i["department_name"] == "Engineering"), None)
        self.assertIsNotNone(eng_item)
        self.assertEqual(eng_item["total_gross"], 60000.0)

    def test_05_payroll_trends(self):
        """Test 5: Payroll trends returns payrun period data."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/payroll-trends", headers=headers)
        self.assertEqual(res.status_code, 200)
        trends = res.json()
        self.assertEqual(len(trends), 1)
        self.assertEqual(trends[0]["payrun_name"], "Sep 2026 Payrun")
        self.assertEqual(trends[0]["total_gross"], 60000.0)

    def test_06_attendance_summary(self):
        """Test 6: Attendance summary endpoint."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/attendance", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_records"], 1)
        self.assertEqual(data["present_records"], 1)
        self.assertEqual(data["total_worked_hours"], 8.0)

    def test_07_time_off_summary(self):
        """Test 7: Time off summary endpoint."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/time-off", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["approved_requests"], 1)
        self.assertEqual(data["total_allocated_days"], 15.0)
        self.assertEqual(data["used_days"], 2.0)
        self.assertEqual(data["remaining_days"], 13.0)

    def test_08_warnings_detection(self):
        """Test 8: System & Payroll warnings detection."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        res = self.client.get("/api/dashboard/warnings", headers=headers)
        self.assertEqual(res.status_code, 200)
        warnings = res.json()
        self.assertTrue(len(warnings) >= 1)
        # Jane has no schedule and no contract
        categories = [w["category"] for w in warnings]
        self.assertIn("Schedule Missing", categories)
        self.assertIn("Contract Missing", categories)

    def test_09_employee_rbac_isolation(self):
        """Test 9: Employee role isolation in overview call."""
        headers = {"Authorization": f"Bearer {self.emp_token}"}
        res = self.client.get("/api/dashboard/overview", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["summary"]["total_gross_salary"], 60000.0)
        self.assertEqual(data["summary"]["employee_count"], 1)
        self.assertEqual(data["summary"]["total_employees"], 1)

    def test_10_filters_application(self):
        """Test 10: Filtering dashboard data by department."""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        # Filter by HR department (Jane has no payslips)
        res = self.client.get(f"/api/dashboard/summary?department_id={self.dept_hr.id}", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["payslip_count"], 0)
        self.assertEqual(data["total_gross_salary"], 0.0)

        # Filter by Engineering department
        res_eng = self.client.get(f"/api/dashboard/summary?department_id={self.dept_eng.id}", headers=headers)
        self.assertEqual(res_eng.status_code, 200)
        data_eng = res_eng.json()
        self.assertEqual(data_eng["payslip_count"], 1)
        self.assertEqual(data_eng["total_gross_salary"], 60000.0)


if __name__ == "__main__":
    print("\n==================================================")
    print("  TESTING DASHBOARD & REPORTS MODULE")
    print("==================================================")
    unittest.main(verbosity=2)
