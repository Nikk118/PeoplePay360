import uuid
from datetime import date
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from pypdf import PdfReader
import io

from app.main import app
from app.testing_db import init_isolated_test_db, TestSessionLocal
from app.models import models
from app.auth.jwt import create_access_token
from app.services.pdf_generator import generate_payslip_pdf

client = TestClient(app)

def test_payslip_pdf_suite():
    init_isolated_test_db(seed_initial=True)
    db: Session = TestSessionLocal()
    total_tests = 0
    passed_tests = 0

    def run_test(name, fn):
        nonlocal total_tests, passed_tests
        total_tests += 1
        print(f"\n--- Payslip PDF Test {total_tests}: {name} ---")
        try:
            fn()
            passed_tests += 1
            print(f"[OK] Test {total_tests} Passed: {name}")
        except Exception as e:
            print(f"[FAIL] Test {total_tests} Failed: {name}\n  Error: {e}")
            raise e

    try:
        print("==================================================")
        print("  TESTING PAYSLIP PDF GENERATION & CONTENT")
        print("==================================================")

        # Users and employees
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

        # Create & Compute a test Payrun to generate actual Payslips
        payrun_res = client.post("/api/payruns", json={
            "name": "PDF Test Payrun December 2026",
            "salary_structure_id": struct.id,
            "period_start": "2026-12-01",
            "period_end": "2026-12-31",
            "employee_ids": [ravi_emp.id, priya_emp.id]
        }, headers=admin_headers).json()

        client.post(f"/api/payruns/{payrun_res['id']}/compute", headers=admin_headers)

        payslips_res = client.get(f"/api/payruns/{payrun_res['id']}/payslips", headers=admin_headers).json()
        ravi_ps = next(p for p in payslips_res if p["employee_id"] == ravi_emp.id)
        priya_ps = next(p for p in payslips_res if p["employee_id"] == priya_emp.id)

        # Helper to extract PDF text from bytes
        def extract_pdf_text(pdf_bytes: bytes) -> str:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() + "\n"
            return full_text

        # --------------------------------------------------
        # 1. PDF Endpoint Requires Authentication
        # --------------------------------------------------
        def test_unauthenticated_access():
            res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf")
            assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}"

        run_test("PDF Endpoint Requires Authentication", test_unauthenticated_access)

        # --------------------------------------------------
        # 2 & 4. Authorized User Can Generate PDF
        # --------------------------------------------------
        def test_authorized_pdf_generation():
            res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
            assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}"

        run_test("Authorized Admin/HR User Can Generate PDF", test_authorized_pdf_generation)

        # --------------------------------------------------
        # 3. Employee Cannot Generate Another Employee's PDF (RBAC 403)
        # --------------------------------------------------
        def test_employee_forbidden_other_pdf():
            # Employee user (Ravi) attempts to generate Priya's PDF
            res = client.get(f"/api/payslips/{priya_ps['id']}/pdf", headers=ravi_headers)
            assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"

            # Employee user (Ravi) CAN generate his own PDF
            res_own = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=ravi_headers)
            assert res_own.status_code == 200

        run_test("RBAC Restriction: Employee Cannot Generate Other Employee's PDF", test_employee_forbidden_other_pdf)

        # --------------------------------------------------
        # 5. Content-Type is application/pdf
        # --------------------------------------------------
        def test_content_type():
            res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
            assert res.headers.get("content-type") == "application/pdf"
            assert "filename=" in res.headers.get("content-disposition", "")

        run_test("Response Content-Type is application/pdf with Content-Disposition", test_content_type)

        # --------------------------------------------------
        # 6. PDF Response is Non-Empty Valid PDF Bytes
        # --------------------------------------------------
        def test_pdf_bytes_validity():
            res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
            content = res.content
            assert len(content) > 1000, f"PDF file size too small: {len(content)} bytes"
            assert content.startswith(b"%PDF-"), "Invalid PDF header magic bytes"

        run_test("PDF Response Contains Non-Empty Valid PDF Bytes", test_pdf_bytes_validity)

        # --------------------------------------------------
        # 7 - 13. PDF Content Text Verification (Employee, Period, Basic, Gross, Deductions, Net, Rules)
        # --------------------------------------------------
        def test_pdf_content_inspection():
            res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
            pdf_text = extract_pdf_text(res.content)
            
            # Employee Info
            assert "Ravi" in pdf_text or "EMP001" in pdf_text
            assert "EMP001" in pdf_text
            
            # Payroll Period
            assert "2026-12-01" in pdf_text
            assert "2026-12-31" in pdf_text
            
            # Rule Codes
            assert "BASIC" in pdf_text
            assert "HRA" in pdf_text
            assert "GROSS" in pdf_text
            assert "PF" in pdf_text
            assert "TAX" in pdf_text
            assert "NET" in pdf_text

            # Stored Monetary Amounts
            # Gross = 75,500.00 | Net = 60,750.00
            assert "75,500.00" in pdf_text
            assert "60,750.00" in pdf_text

        run_test("PDF Text Content Inspection (Employee, Period, Amounts, Rule Breakdown)", test_pdf_content_inspection)

        # --------------------------------------------------
        # 14 & 15. PDF Reflects Stored Values & Does NOT Recalculate Payroll
        # --------------------------------------------------
        def test_pdf_no_recalculation():
            # Fetch Ravi's original PDF text
            res_before = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
            text_before = extract_pdf_text(res_before.content)
            assert "60,750.00" in text_before

            # Temporarily mutate Meal Allowance rule in DB
            ma_rule = db.query(models.SalaryRule).filter(models.SalaryRule.code == "MA").first()
            assert ma_rule is not None
            orig_ma = ma_rule.fixed_amount

            try:
                ma_rule.fixed_amount = 8888.0
                db.commit()

                # PDF endpoint MUST NOT recalculate payroll — it reads stored DB record
                res_after = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
                text_after = extract_pdf_text(res_after.content)
                assert "60,750.00" in text_after, "PDF generator recalculated payroll instead of using stored values!"
            finally:
                ma_rule.fixed_amount = orig_ma
                db.commit()

        run_test("PDF Reflects Stored Database Values & Does NOT Recalculate Payroll", test_pdf_no_recalculation)

        # --------------------------------------------------
        # 16. Warnings Section Appears When Present
        # --------------------------------------------------
        def test_pdf_warnings():
            # Inject a warning on Ravi's payslip
            ps_obj = db.query(models.Payslip).filter(models.Payslip.id == ravi_ps["id"]).first()
            assert ps_obj is not None
            ps_obj.warnings_json = '["Test Warning: Special deduction adjustment applied"]'
            db.commit()

            try:
                res = client.get(f"/api/payslips/{ravi_ps['id']}/pdf", headers=admin_headers)
                pdf_text = extract_pdf_text(res.content)
                assert "Test Warning" in pdf_text or "Special deduction" in pdf_text
            finally:
                ps_obj.warnings_json = '[]'
                db.commit()

        run_test("Warnings Section Appears In PDF When Present", test_pdf_warnings)

        # Cleanup test payrun
        pr_obj = db.query(models.Payrun).filter(models.Payrun.id == payrun_res["id"]).first()
        if pr_obj:
            db.delete(pr_obj)
            db.commit()

        # --------------------------------------------------
        # Final Summary
        # --------------------------------------------------
        print("\n==================================================")
        print("  PAYSLIP PDF SUITE SUMMARY")
        print(f"  Total Tests Executed : {total_tests}")
        print(f"  Total Tests Passed   : {passed_tests}")
        print(f"  Total Tests Failed   : {total_tests - passed_tests}")
        print("==================================================")

        assert passed_tests == total_tests, "Not all PDF tests passed!"

    finally:
        db.close()

if __name__ == "__main__":
    test_payslip_pdf_suite()
