import unittest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models

class TestTimeOffSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_isolated_test_db(seed_initial=True)
        cls.db = TestSessionLocal()
        cls.client = TestClient(app)

        # Login as HR Manager
        resp = cls.client.post("/api/auth/login", json={"email": "hrmanager@peoplepay360.com", "password": "Password123!"})
        assert resp.status_code == 200, f"HR login failed: {resp.text}"
        cls.hr_token = resp.json()["access_token"]
        cls.hr_headers = {"Authorization": f"Bearer {cls.hr_token}"}

        # Find target employee and paid annual leave type
        cls.target_emp = cls.db.query(models.Employee).filter(models.Employee.email != "hrmanager@peoplepay360.com").first()
        assert cls.target_emp is not None
        cls.emp_id = cls.target_emp.id

        cls.paid_type = cls.db.query(models.TimeOffType).filter(models.TimeOffType.code == "ANNUAL").first()
        assert cls.paid_type is not None
        cls.type_id = cls.paid_type.id

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_leave_workflow_and_balance_deduction(self):
        # 1. Check initial balances
        bal_resp = self.client.get(f"/api/time-off/balances?employee_id={self.emp_id}", headers=self.hr_headers)
        self.assertEqual(bal_resp.status_code, 200)
        balances = bal_resp.json()
        initial_annual = next(b for b in balances if b["time_off_type_id"] == self.type_id)
        init_remaining = initial_annual["remaining_days"]

        # 2. Create leave request for Sep 15-17, 2026 (3 days)
        req_data = {
            "employee_id": self.emp_id,
            "time_off_type_id": self.type_id,
            "date_from": "2026-09-15",
            "date_to": "2026-09-17",
            "reason": "Personal vacation"
        }
        create_resp = self.client.post("/api/time-off/requests", json=req_data, headers=self.hr_headers)
        self.assertEqual(create_resp.status_code, 200)
        req_res = create_resp.json()
        req_id = req_res["id"]
        self.assertEqual(req_res["duration_days"], 3.0)

        # 3. Approve the request
        app_resp = self.client.put(f"/api/time-off/requests/{req_id}/approve", headers=self.hr_headers)
        self.assertEqual(app_resp.status_code, 200)
        self.assertEqual(app_resp.json()["status"], "approved")

        # 4. Verify updated balance
        bal_resp2 = self.client.get(f"/api/time-off/balances?employee_id={self.emp_id}", headers=self.hr_headers)
        self.assertEqual(bal_resp2.status_code, 200)
        updated_annual = next(b for b in bal_resp2.json() if b["time_off_type_id"] == self.type_id)
        self.assertEqual(updated_annual["remaining_days"], init_remaining - 3.0)

        # 5. Duplicate approval protection
        app_dup = self.client.put(f"/api/time-off/requests/{req_id}/approve", headers=self.hr_headers)
        self.assertEqual(app_dup.status_code, 200)
        bal_resp3 = self.client.get(f"/api/time-off/balances?employee_id={self.emp_id}", headers=self.hr_headers)
        dup_annual = next(b for b in bal_resp3.json() if b["time_off_type_id"] == self.type_id)
        self.assertEqual(dup_annual["remaining_days"], init_remaining - 3.0)

        # 6. Insufficient balance protection
        big_req_data = {
            "employee_id": self.emp_id,
            "time_off_type_id": self.type_id,
            "date_from": "2026-10-01",
            "date_to": "2026-10-31",
            "reason": "Excessive leave"
        }
        big_create = self.client.post("/api/time-off/requests", json=big_req_data, headers=self.hr_headers)
        self.assertEqual(big_create.status_code, 200)
        big_id = big_create.json()["id"]

        big_app = self.client.put(f"/api/time-off/requests/{big_id}/approve", headers=self.hr_headers)
        self.assertEqual(big_app.status_code, 400)
        self.assertIn("insufficient", big_app.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
