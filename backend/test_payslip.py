import uuid
from datetime import date
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models
from app.auth.jwt import create_access_token

client = TestClient(app)

def test_payslip_suite():
    init_isolated_test_db(seed_initial=True)
    db: Session = TestSessionLocal()
    total_tests = 0
    passed_tests = 0

    def run_test(name, fn):
        nonlocal total_tests, passed_tests
        total_tests += 1
        print(f"\n--- Payslip Test {total_tests}: {name} ---")
        try:
            fn()
            passed_tests += 1
            print(f"[OK] Test {total_tests} Passed: {name}")
        except Exception as e:
            print(f"[FAIL] Test {total_tests} Failed: {name}\n  Error: {e}")
            raise e

    try:
        print("==================================================")
        print("  TESTING PAYSLIP MODULE & DATA CONSISTENCY")
        print("==================================================")

        # Users and tokens
        admin_user = db.query(models.AppUser).filter(models.AppUser.email == "admin@peoplepay360.com").first()
        ravi_user = db.query(models.AppUser).filter(models.AppUser.email == "employee@peoplepay360.com").first()
        priya_user = db.query(models.AppUser).filter(models.AppUser.email == "hrmanager@peoplepay360.com").first()

        ravi_emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
        priya_emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP002").first()

        admin_token = create_access_token({"sub": admin_user.id, "email": admin_user.email, "roles": ["admin"]})
        ravi_token = create_access_token({"sub": ravi_user.id, "email": ravi_user.email, "employee_id": ravi_emp.id, "roles": ["employee"]})
        priya_token = create_access_token({"sub": priya_user.id, "email": priya_user.email, "employee_id": priya_emp.id, "roles": ["hr_manager"]})

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        ravi_headers = {"Authorization": f"Bearer {ravi_token}"}
        priya_headers = {"Authorization": f"Bearer {priya_token}"}

        struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.name == "Regular Salary Structure").first()

        # Create & Compute a Payrun for testing
        payrun_payload = {
            "name": "November 2026 Test Payrun",
            "salary_structure_id": struct.id,
            "period_start": "2026-11-01",
            "period_end": "2026-11-30",
            "employee_ids": [ravi_emp.id, priya_emp.id]
        }
        create_res = client.post("/api/payruns", json=payrun_payload, headers=admin_headers)
        assert create_res.status_code == 201, f"Failed to create test payrun: {create_res.text}"
        payrun_id = create_res.json()["id"]

        # Compute Payrun
        compute_res = client.post(f"/api/payruns/{payrun_id}/compute", headers=admin_headers)
        assert compute_res.status_code == 200, f"Failed to compute test payrun: {compute_res.text}"
        computed_payrun = compute_res.json()

        # --------------------------------------------------
        # 1. Payslips Exist After Compute
        # --------------------------------------------------
        def test_payslips_exist_after_compute():
            res = client.get(f"/api/payruns/{payrun_id}/payslips", headers=admin_headers)
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 2, f"Expected 2 payslips, got {len(data)}"

        run_test("Payslips Exist After Payrun Compute", test_payslips_exist_after_compute)

        # --------------------------------------------------
        # 2 & 3. Payslip Belongs to Correct Employee & Payrun
        # --------------------------------------------------
        ravi_payslip_id = None
        priya_payslip_id = None

        def test_payslip_relationships():
            nonlocal ravi_payslip_id, priya_payslip_id
            res = client.get(f"/api/payruns/{payrun_id}/payslips", headers=admin_headers)
            data = res.json()
            for ps in data:
                assert ps["payrun_id"] == payrun_id
                if ps["employee_id"] == ravi_emp.id:
                    ravi_payslip_id = ps["id"]
                    assert ps["employee_number"] == "EMP001"
                elif ps["employee_id"] == priya_emp.id:
                    priya_payslip_id = ps["id"]
                    assert ps["employee_number"] == "EMP002"

            assert ravi_payslip_id is not None
            assert priya_payslip_id is not None

        run_test("Payslip Belongs to Correct Employee and Payrun", test_payslip_relationships)

        # --------------------------------------------------
        # 4. Correct Payroll Period
        # --------------------------------------------------
        def test_payroll_period():
            res = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["period_start"] == "2026-11-01"
            assert data["period_end"] == "2026-11-30"

        run_test("Correct Payroll Period Preserved", test_payroll_period)

        # --------------------------------------------------
        # 5 - 8. Basic, Gross, Deductions, Net Salary Stored Correctly
        # --------------------------------------------------
        def test_monetary_fields_stored():
            res = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers)
            data = res.json()
            # Ravi: wage=60000 -> BASIC=60000, HRA=12000, MA=2000, TA=1500, GROSS=75500, PF=7200, TAX=7550, NET=60750
            assert data["basic_salary"] == 60000.00
            assert data["total_allowances"] == 15500.00
            assert data["gross_salary"] == 75500.00
            assert data["total_deductions"] == 14750.00
            assert data["net_salary"] == 60750.00

        run_test("Basic, Gross, Deductions, Net Stored Correctly", test_monetary_fields_stored)

        # --------------------------------------------------
        # 9 & 10. PayslipLines Salary Rule Breakdown & Sequence Preservation
        # --------------------------------------------------
        def test_payslip_lines_breakdown():
            res = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers)
            data = res.json()
            lines = data["lines"]
            assert len(lines) == 9, f"Expected 9 rule lines, got {len(lines)}"
            
            # Verify sequence ordering (10, 20, 30, 40, 50, 60, 70, 80, 90)
            sequences = [l["sequence"] for l in lines]
            assert sequences == sorted(sequences), f"Sequences not ordered: {sequences}"
            
            rule_codes = [l["rule_code"] for l in lines]
            assert "BASIC" in rule_codes
            assert "HRA" in rule_codes
            assert "GROSS" in rule_codes
            assert "PF" in rule_codes
            assert "NET" in rule_codes

        run_test("PayslipLines Rule Breakdown and Sequence Preservation", test_payslip_lines_breakdown)

        # --------------------------------------------------
        # 11. Multiple Selected Employees Produce Separate Payslips
        # --------------------------------------------------
        def test_multiple_employee_payslips():
            res_ravi = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers).json()
            res_priya = client.get(f"/api/payslips/{priya_payslip_id}", headers=admin_headers).json()
            
            assert res_ravi["employee_id"] != res_priya["employee_id"]
            # Priya's wage is 75,000 vs Ravi's 60,000
            assert res_priya["basic_salary"] == 75000.00
            assert res_ravi["basic_salary"] == 60000.00
            assert res_priya["gross_salary"] != res_ravi["gross_salary"]

        run_test("Multiple Employees Produce Separate Distinct Payslips", test_multiple_employee_payslips)

        # --------------------------------------------------
        # 12. Custom / Non-Seeded Salary Structure Support
        # --------------------------------------------------
        def test_custom_structure_payslip():
            custom_struct = models.SalaryStructure(name=f"Custom Payslip Struct {uuid.uuid4().hex[:6]}", active=True)
            db.add(custom_struct)
            db.commit()

            r1 = models.SalaryRule(structure_id=custom_struct.id, name="Fixed Base", code="BASE", category="basic", sequence=10, computation_type="fixed", fixed_amount=80000.0, active=True)
            r2 = models.SalaryRule(structure_id=custom_struct.id, name="Gross", code="GROSS", category="gross", sequence=20, computation_type="formula", formula="BASE", active=True)
            r3 = models.SalaryRule(structure_id=custom_struct.id, name="Net", code="NET", category="net", sequence=30, computation_type="formula", formula="GROSS", active=True)
            db.add_all([r1, r2, r3])
            db.commit()

            c_temp = models.Contract(employee_id=ravi_emp.id, name="Custom Contract", date_start=date(2026, 1, 1), wage=80000.0, status="active", salary_structure_id=custom_struct.id)
            db.add(c_temp)
            db.commit()

            try:
                # Create and compute payrun with custom struct
                p_custom = client.post("/api/payruns", json={
                    "name": "Custom Structure Payrun",
                    "salary_structure_id": custom_struct.id,
                    "period_start": "2026-12-01",
                    "period_end": "2026-12-31",
                    "employee_ids": [ravi_emp.id]
                }, headers=admin_headers).json()

                client.post(f"/api/payruns/{p_custom['id']}/compute", headers=admin_headers)

                ps_res = client.get(f"/api/payruns/{p_custom['id']}/payslips", headers=admin_headers).json()
                assert len(ps_res) == 1
                ps_item = ps_res[0]
                assert ps_item["gross_salary"] == 80000.00
                assert ps_item["net_salary"] == 80000.00
                assert len(ps_item["lines"]) == 3

                # Cleanup custom payrun
                pr_obj = db.query(models.Payrun).filter(models.Payrun.id == p_custom["id"]).first()
                if pr_obj:
                    db.delete(pr_obj)
                    db.commit()
            finally:
                db.delete(c_temp)
                db.delete(r1)
                db.delete(r2)
                db.delete(r3)
                db.delete(custom_struct)
                db.commit()

        run_test("Custom Non-Seeded Salary Structure Payslip Support", test_custom_structure_payslip)

        # --------------------------------------------------
        # 13. Existing Payroll Warnings Preserved
        # --------------------------------------------------
        def test_warnings_preserved():
            res = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers)
            data = res.json()
            assert "warnings" in data
            assert isinstance(data["warnings"], list)

        run_test("Existing Payroll Warnings Preserved in Schema", test_warnings_preserved)

        # --------------------------------------------------
        # 14. RBAC Restriction: Employee Cannot Access Other Employee's Payslip
        # --------------------------------------------------
        def test_rbac_payslip_access():
            # Employee user (Ravi) attempts to access Priya's payslip
            res = client.get(f"/api/payslips/{priya_payslip_id}", headers=ravi_headers)
            assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"

            # Employee user (Ravi) CAN access his own payslip
            res_own = client.get(f"/api/payslips/{ravi_payslip_id}", headers=ravi_headers)
            assert res_own.status_code == 200

            # Employee user listing payslips only gets his own
            res_list = client.get("/api/payslips", headers=ravi_headers)
            assert res_list.status_code == 200
            for ps in res_list.json():
                assert ps["employee_id"] == ravi_emp.id

        run_test("RBAC Restriction: Employee Cannot View Other Employees' Payslips", test_rbac_payslip_access)

        # --------------------------------------------------
        # 15. Payslip Does NOT Independently Recalculate Payroll
        # --------------------------------------------------
        def test_no_independent_recalculation():
            # Check current gross salary of Ravi's computed payslip
            res_before = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers).json()
            gross_before = res_before["gross_salary"]

            # Temporarily modify rule in DB
            ma_rule = db.query(models.SalaryRule).filter(models.SalaryRule.code == "MA").first()
            assert ma_rule is not None
            orig_ma = ma_rule.fixed_amount

            try:
                ma_rule.fixed_amount = 9999.0
                db.commit()

                # GET /api/payslips/{id} MUST NOT recalculate payroll — it returns the stored result
                res_after = client.get(f"/api/payslips/{ravi_payslip_id}", headers=admin_headers).json()
                assert res_after["gross_salary"] == gross_before, f"Payslip layer recalculated! Expected {gross_before}, got {res_after['gross_salary']}"
            finally:
                ma_rule.fixed_amount = orig_ma
                db.commit()

        run_test("Payslip Layer Does NOT Independently Recalculate Payroll", test_no_independent_recalculation)

        # Cleanup test payrun
        payrun_obj = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
        if payrun_obj:
            db.delete(payrun_obj)
            db.commit()

        # --------------------------------------------------
        # Final Summary
        # --------------------------------------------------
        print("\n==================================================")
        print("  PAYSLIP SUITE SUMMARY")
        print(f"  Total Tests Executed : {total_tests}")
        print(f"  Total Tests Passed   : {passed_tests}")
        print(f"  Total Tests Failed   : {total_tests - passed_tests}")
        print("==================================================")

        assert passed_tests == total_tests, "Not all payslip tests passed!"

    finally:
        db.close()

if __name__ == "__main__":
    test_payslip_suite()
