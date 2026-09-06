import unittest
import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models

class TestSalaryStructuresSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_isolated_test_db(seed_initial=True)
        cls.db = TestSessionLocal()
        cls.client = TestClient(app)

        # Login as Admin
        resp = cls.client.post("/api/auth/login", json={"email": "admin@peoplepay360.com", "password": "Password123!"})
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        cls.admin_token = resp.json()["access_token"]
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # Login as HR Payroll User
        resp = cls.client.post("/api/auth/login", json={"email": "hrpayroll@peoplepay360.com", "password": "Password123!"})
        if resp.status_code == 200:
            cls.payroll_token = resp.json()["access_token"]
            cls.payroll_headers = {"Authorization": f"Bearer {cls.payroll_token}"}
        else:
            cls.payroll_headers = cls.admin_headers

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_fetch_salary_structures_and_rules(self):
        resp = self.client.get("/api/salary-structures", headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        structures = resp.json()
        self.assertGreaterEqual(len(structures), 1)

        reg_struct = next((s for s in structures if s["name"] == "Regular Salary Structure"), None)
        self.assertIsNotNone(reg_struct)
        rules = reg_struct["rules"]
        self.assertEqual(len(rules), 9)

        sequences = [r["sequence"] for r in rules]
        codes = [r["code"] for r in rules]
        self.assertEqual(sequences, sorted(sequences))
        expected_codes = ["BASIC", "HRA", "MA", "TA", "GROSS", "PF", "TAX", "UPL", "NET"]
        self.assertEqual(codes, expected_codes)

    def test_02_create_salary_structure_and_rules(self):
        payload = {
            "name": "Executive Salary Structure",
            "description": "Structure for C-level executives",
            "active": True
        }
        resp = self.client.post("/api/salary-structures", json=payload, headers=self.admin_headers)
        self.assertEqual(resp.status_code, 201)
        struct_data = resp.json()
        struct_id = struct_data["id"]

        rule_payload = {
            "structure_id": struct_id,
            "name": "Executive Bonus",
            "code": "BONUS",
            "category": "allowance",
            "sequence": 15,
            "computation_type": "fixed",
            "fixed_amount": 10000.0,
            "active": True,
            "appears_on_payslip": True
        }
        r_resp = self.client.post("/api/salary-rules", json=rule_payload, headers=self.admin_headers)
        self.assertEqual(r_resp.status_code, 201)
        rule_data = r_resp.json()
        rule_id = rule_data["id"]

        # Duplicate rule code in same structure rejected
        dup_payload = {
            "structure_id": struct_id,
            "name": "Another Bonus",
            "code": "bonus",
            "category": "allowance",
            "sequence": 25,
            "computation_type": "fixed",
            "fixed_amount": 5000.0
        }
        dup_resp = self.client.post("/api/salary-rules", json=dup_payload, headers=self.admin_headers)
        self.assertEqual(dup_resp.status_code, 400)

        # Update rule
        up_resp = self.client.put(f"/api/salary-rules/{rule_id}", json={"fixed_amount": 15000.0, "sequence": 12}, headers=self.admin_headers)
        self.assertEqual(up_resp.status_code, 200)
        self.assertEqual(up_resp.json()["fixed_amount"], 15000.0)

        # Delete rule
        del_rule = self.client.delete(f"/api/salary-rules/{rule_id}", headers=self.admin_headers)
        self.assertEqual(del_rule.status_code, 200)

        # Delete structure
        del_struct = self.client.delete(f"/api/salary-structures/{struct_id}", headers=self.admin_headers)
        self.assertEqual(del_struct.status_code, 200)

    def test_03_in_use_structure_deletion_prevented(self):
        resp = self.client.get("/api/salary-structures", headers=self.admin_headers)
        structures = resp.json()
        reg_struct = next((s for s in structures if s["name"] == "Regular Salary Structure"), None)
        self.assertIsNotNone(reg_struct)

        # Deleting in-use structure must fail with 400
        del_resp = self.client.delete(f"/api/salary-structures/{reg_struct['id']}", headers=self.admin_headers)
        self.assertEqual(del_resp.status_code, 400)

    def test_04_rule_referenced_by_payslip_line_deletion_prevented(self):
        # Find any rule referenced by payslip line
        ps_line = self.db.query(models.PayslipLine).first()
        if ps_line and ps_line.salary_rule_id:
            del_rule = self.client.delete(f"/api/salary-rules/{ps_line.salary_rule_id}", headers=self.admin_headers)
            self.assertEqual(del_rule.status_code, 400)
            self.assertIn("referenced by", del_rule.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
