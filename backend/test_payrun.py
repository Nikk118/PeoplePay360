import uuid
from datetime import date
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models import models
from app.auth.jwt import create_access_token

client = TestClient(app)

def test_payrun_suite():
    db: Session = SessionLocal()
    total_tests = 0
    passed_tests = 0

    def run_test(name, fn):
        nonlocal total_tests, passed_tests
        total_tests += 1
        print(f"\n--- Payrun Test {total_tests}: {name} ---")
        try:
            fn()
            passed_tests += 1
            print(f"[OK] Test {total_tests} Passed: {name}")
        except Exception as e:
            print(f"[FAIL] Test {total_tests} Failed: {name}\n  Error: {e}")
            raise e

    try:
        print("==================================================")
        print("  TESTING PAYRUN MODULE & WORKFLOW")
        print("==================================================")

        # Reset database tables & seed initial data
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        from app.main import seed_initial_data
        seed_initial_data(db)

        # Helper tokens
        admin_user = db.query(models.AppUser).filter(models.AppUser.email == "admin@peoplepay360.com").first()
        emp_user = db.query(models.AppUser).filter(models.AppUser.email == "employee@peoplepay360.com").first()
        
        admin_token = create_access_token({"sub": admin_user.id, "email": admin_user.email, "roles": ["admin"]})
        emp_token = create_access_token({"sub": emp_user.id, "email": emp_user.email, "roles": ["employee"]})

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        # Seed data references
        struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.name == "Regular Salary Structure").first()
        ravi = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
        priya = db.query(models.Employee).filter(models.Employee.employee_number == "EMP002").first()
        vikram = db.query(models.Employee).filter(models.Employee.employee_number == "EMP004").first()

        # --------------------------------------------------
        # 1. Eligible Employees API (Step 2 Helper)
        # --------------------------------------------------
        def test_eligible_employees():
            res = client.get(
                f"/api/payruns/eligible-employees?period_start=2026-10-01&period_end=2026-10-31&salary_structure_id={struct.id}",
                headers=admin_headers
            )
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert len(data) >= 2
            emp_ids = [e["id"] for e in data]
            assert ravi.id in emp_ids
            assert priya.id in emp_ids

        run_test("Step 2 Eligible Employees API", test_eligible_employees)

        # --------------------------------------------------
        # 2. Empty Employee Selection Rejection
        # --------------------------------------------------
        def test_empty_employee_selection():
            payload = {
                "name": "Empty Selection Payrun",
                "salary_structure_id": struct.id,
                "period_start": "2026-10-01",
                "period_end": "2026-10-31",
                "employee_ids": []
            }
            res = client.post("/api/payruns", json=payload, headers=admin_headers)
            assert res.status_code == 400
            assert "cannot be empty" in res.json()["detail"].lower()

        run_test("Reject Empty Employee Selection", test_empty_employee_selection)

        # --------------------------------------------------
        # 3. Invalid Date Range Rejection
        # --------------------------------------------------
        def test_invalid_date_range():
            payload = {
                "name": "Bad Date Payrun",
                "salary_structure_id": struct.id,
                "period_start": "2026-10-31",
                "period_end": "2026-10-01", # Start > End
                "employee_ids": [ravi.id]
            }
            res = client.post("/api/payruns", json=payload, headers=admin_headers)
            assert res.status_code == 400
            assert "cannot be after" in res.json()["detail"].lower()

        run_test("Reject Invalid Date Range (start > end)", test_invalid_date_range)

        # --------------------------------------------------
        # 4. Employee With No Applicable Contract Rejection
        # --------------------------------------------------
        def test_employee_no_contract():
            no_contract_emp = models.Employee(
                first_name="NoContract",
                last_name="Test",
                email=f"nocontract_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP888",
                status="active"
            )
            db.add(no_contract_emp)
            db.commit()

            try:
                payload = {
                    "name": "No Contract Payrun",
                    "salary_structure_id": struct.id,
                    "period_start": "2026-10-01",
                    "period_end": "2026-10-31",
                    "employee_ids": [no_contract_emp.id]
                }
                res = client.post("/api/payruns", json=payload, headers=admin_headers)
                assert res.status_code == 400
                assert "no active or applicable contract" in res.json()["detail"].lower()
            finally:
                db.delete(no_contract_emp)
                db.commit()

        run_test("Reject Employee With No Applicable Contract", test_employee_no_contract)

        # --------------------------------------------------
        # 5. Payrun Creation (Draft status & explicit employee selection)
        # --------------------------------------------------
        created_payrun_id = None
        def test_payrun_creation():
            nonlocal created_payrun_id
            payload = {
                "name": "October 2026 Regular Payrun",
                "salary_structure_id": struct.id,
                "period_start": "2026-10-01",
                "period_end": "2026-10-31",
                "employee_ids": [ravi.id, priya.id] # Explicit selection of ONLY Ravi and Priya
            }
            res = client.post("/api/payruns", json=payload, headers=admin_headers)
            assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["name"] == "October 2026 Regular Payrun"
            assert data["status"] == "draft"
            assert data["payslip_count"] == 2
            assert len(data["payslips"]) == 2
            selected_ids = [p["employee_id"] for p in data["payslips"]]
            assert ravi.id in selected_ids
            assert priya.id in selected_ids
            assert vikram.id not in selected_ids # Only selected employees included!
            created_payrun_id = data["id"]

        run_test("Create Payrun (Draft status, Selected Employees only)", test_payrun_creation)

        # --------------------------------------------------
        # 6. Duplicate Overlapping Payrun Prevention
        # --------------------------------------------------
        def test_duplicate_payrun_prevention():
            payload = {
                "name": "Duplicate Oct Payrun",
                "salary_structure_id": struct.id,
                "period_start": "2026-10-15", # Overlaps Oct 1-31
                "period_end": "2026-11-15",
                "employee_ids": [ravi.id]
            }
            res = client.post("/api/payruns", json=payload, headers=admin_headers)
            assert res.status_code == 400
            assert "already exists" in res.json()["detail"].lower()

        run_test("Prevent Overlapping Duplicate Payrun", test_duplicate_payrun_prevention)

        # --------------------------------------------------
        # 7. Invalid Workflow Transition (Validate draft before compute)
        # --------------------------------------------------
        def test_validate_draft_prevention():
            res = client.post(f"/api/payruns/{created_payrun_id}/validate", headers=admin_headers)
            assert res.status_code == 400
            assert "must be computed before validation" in res.json()["detail"].lower()

        run_test("Prevent Validating Draft Payrun Before Compute", test_validate_draft_prevention)

        # --------------------------------------------------
        # 8. Compute Payrun (Uses Payroll Engine, calculates selected employees)
        # --------------------------------------------------
        def test_compute_payrun():
            res = client.post(f"/api/payruns/{created_payrun_id}/compute", headers=admin_headers)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["status"] == "computed"
            assert data["total_gross"] > 0
            assert data["total_net"] > 0
            assert len(data["payslips"]) == 2

            # Check individual calculated payslip lines
            for ps in data["payslips"]:
                assert ps["status"] == "computed"
                assert ps["gross_salary"] > 0
                assert ps["net_salary"] > 0
                assert len(ps["lines"]) > 0

        run_test("Compute Payrun via Payroll Engine", test_compute_payrun)

        # --------------------------------------------------
        # 9. Invalid Workflow Transition (Mark Paid computed before validate)
        # --------------------------------------------------
        def test_mark_paid_computed_prevention():
            res = client.post(f"/api/payruns/{created_payrun_id}/mark-paid", headers=admin_headers)
            assert res.status_code == 400
            assert "must be validated before marking paid" in res.json()["detail"].lower()

        run_test("Prevent Marking Paid Before Validation", test_mark_paid_computed_prevention)

        # --------------------------------------------------
        # 10. Validate Payrun (Computed -> Validated)
        # --------------------------------------------------
        def test_validate_payrun():
            res = client.post(f"/api/payruns/{created_payrun_id}/validate", headers=admin_headers)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["status"] == "validated"
            for ps in data["payslips"]:
                assert ps["status"] == "validated"

        run_test("Validate Payrun (Computed -> Validated)", test_validate_payrun)

        # --------------------------------------------------
        # 11. Re-computation Prevention on Validated Payrun
        # --------------------------------------------------
        def test_recompute_validated_prevention():
            res = client.post(f"/api/payruns/{created_payrun_id}/compute", headers=admin_headers)
            assert res.status_code == 400
            assert "cannot re-compute" in res.json()["detail"].lower()

        run_test("Prevent Re-computation of Validated Payrun", test_recompute_validated_prevention)

        # --------------------------------------------------
        # 12. Mark Paid (Validated -> Paid)
        # --------------------------------------------------
        def test_mark_paid():
            res = client.post(f"/api/payruns/{created_payrun_id}/mark-paid", headers=admin_headers)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["status"] == "paid"
            for ps in data["payslips"]:
                assert ps["status"] == "paid"

        run_test("Mark Payrun Paid (Validated -> Paid)", test_mark_paid)

        # --------------------------------------------------
        # 13. Unauthorized Payroll Actions Protection
        # --------------------------------------------------
        def test_unauthorized_actions():
            # Employee user (no hr/payroll role) attempts to create payrun
            payload = {
                "name": "Hacker Payrun",
                "salary_structure_id": struct.id,
                "period_start": "2026-11-01",
                "period_end": "2026-11-30",
                "employee_ids": [ravi.id]
            }
            res = client.post("/api/payruns", json=payload, headers=emp_headers)
            assert res.status_code == 403

        run_test("Reject Unauthorized Payroll Actions (RBAC Enforcement)", test_unauthorized_actions)

        # Cleanup created payrun
        payrun_to_del = db.query(models.Payrun).filter(models.Payrun.id == created_payrun_id).first()
        if payrun_to_del:
            db.delete(payrun_to_del)
            db.commit()

        # --------------------------------------------------
        # Final Summary
        # --------------------------------------------------
        print("\n==================================================")
        print("  PAYRUN SUITE SUMMARY")
        print(f"  Total Tests Executed : {total_tests}")
        print(f"  Total Tests Passed   : {passed_tests}")
        print(f"  Total Tests Failed   : {total_tests - passed_tests}")
        print("==================================================")

        assert passed_tests == total_tests, "Not all payrun tests passed!"

    finally:
        db.close()

if __name__ == "__main__":
    test_payrun_suite()
