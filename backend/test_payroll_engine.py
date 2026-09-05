import sys
import uuid
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import models
from app.services.payroll_engine import compute_payroll, evaluate_formula

def test_payroll_engine():
    db: Session = SessionLocal()
    total_tests_run = 0
    passed_tests = 0

    def run_test(test_name, test_fn):
        nonlocal total_tests_run, passed_tests
        total_tests_run += 1
        print(f"\n--- Test {total_tests_run}: {test_name} ---")
        try:
            test_fn()
            passed_tests += 1
            print(f"[OK] Test {total_tests_run} Passed: {test_name}")
        except Exception as e:
            print(f"[FAIL] Test {total_tests_run} Failed: {test_name}\n  Error: {e}")
            raise e

    try:
        print("==================================================")
        print("  TESTING PAYROLL CALCULATION ENGINE")
        print("==================================================")

        # --------------------------------------------------
        # 1. Fetch Seeded Employee (Ravi Kumar) & Verification
        # --------------------------------------------------
        def test_seeded_employee_calculation():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            assert emp is not None, "Seeded employee EMP001 (Ravi Kumar) not found"
            
            period_start = date(2026, 9, 1)
            period_end = date(2026, 9, 30)

            res = compute_payroll(db, emp.id, period_start, period_end)
            
            print(f"  Employee: {res.employee_name}")
            print(f"  Contract: {res.contract_name} (Wage: Rs.{res.contract_wage:,.2f})")
            print(f"  Structure: {res.salary_structure_name}")
            print(f"  Expected Days/Hours: {res.expected_days} days / {res.expected_hours} hrs")
            print(f"  Worked Days/Hours: {res.worked_days} days / {res.worked_hours} hrs")
            print(f"  Time Off (Total / Unpaid): {res.time_off_days} days / {res.time_off_unpaid_days} days")

            line_dict = {l.code: l.amount for l in res.salary_lines}
            assert line_dict["BASIC"] == 60000.00, f"Expected BASIC 60000, got {line_dict['BASIC']}"
            assert line_dict["HRA"] == 12000.00, f"Expected HRA 12000, got {line_dict['HRA']}"
            assert line_dict["MA"] == 2000.00, f"Expected MA 2000, got {line_dict['MA']}"
            assert line_dict["TA"] == 1500.00, f"Expected TA 1500, got {line_dict['TA']}"
            assert line_dict["GROSS"] == 75500.00, f"Expected GROSS 75500, got {line_dict['GROSS']}"
            assert line_dict["PF"] == -7200.00, f"Expected PF -7200, got {line_dict['PF']}"
            assert line_dict["TAX"] == -7550.00, f"Expected TAX -7550, got {line_dict['TAX']}"
            assert line_dict["NET"] == 60750.00, f"Expected NET 60750, got {line_dict['NET']}"
            assert res.gross_salary == 75500.00
            assert res.net_salary == 60750.00

        run_test("Seeded Regular Salary Structure Calculation", test_seeded_employee_calculation)

        # --------------------------------------------------
        # 2. Dynamic Rule Calculation (No Hardcoded Values)
        # --------------------------------------------------
        def test_dynamic_rule_recomputation():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            period_start = date(2026, 9, 1)
            period_end = date(2026, 9, 30)

            ma_rule = db.query(models.SalaryRule).filter(models.SalaryRule.code == "MA").first()
            assert ma_rule is not None
            original_ma = ma_rule.fixed_amount
            
            try:
                ma_rule.fixed_amount = 3000.0
                db.commit()
                
                res_dyn = compute_payroll(db, emp.id, period_start, period_end)
                line_dyn = {l.code: l.amount for l in res_dyn.salary_lines}
                
                assert line_dyn["MA"] == 3000.00
                assert line_dyn["GROSS"] == 76500.00
                assert line_dyn["TAX"] == -7650.00
                assert line_dyn["NET"] == 61650.00
            finally:
                ma_rule.fixed_amount = original_ma
                db.commit()

        run_test("Dynamic Rule Recomputation", test_dynamic_rule_recomputation)

        # --------------------------------------------------
        # 3. Time Off & Unpaid Leave Impact
        # --------------------------------------------------
        def test_unpaid_leave_impact():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            period_start = date(2026, 9, 1)
            period_end = date(2026, 9, 30)

            unpaid_type = db.query(models.TimeOffType).filter(models.TimeOffType.code == "UNPAID").first()
            assert unpaid_type is not None

            req_unpaid = models.TimeOffRequest(
                employee_id=emp.id,
                time_off_type_id=unpaid_type.id,
                date_from=date(2026, 9, 15),
                date_to=date(2026, 9, 16),
                duration_days=2.0,
                reason="Unpaid leave test",
                status="approved"
            )
            db.add(req_unpaid)
            db.commit()

            try:
                res_upl = compute_payroll(db, emp.id, period_start, period_end)
                assert res_upl.time_off_unpaid_days == 2.0, f"Expected 2 unpaid leave days, got {res_upl.time_off_unpaid_days}"
                
                line_upl = {l.code: l.amount for l in res_upl.salary_lines}
                expected_upl = round(-5454.545454545455, 2)
                assert abs(line_upl["UPL"] - expected_upl) < 0.05, f"Expected UPL {expected_upl}, got {line_upl['UPL']}"
            finally:
                db.delete(req_unpaid)
                db.commit()

        run_test("Time Off & Unpaid Leave Impact", test_unpaid_leave_impact)

        # --------------------------------------------------
        # 4. Safe Formula Evaluator Tests
        # --------------------------------------------------
        def test_formula_evaluator():
            ctx = {"BASIC": 50000, "HRA": 10000, "OVERTIME": 2500}
            
            assert evaluate_formula("BASIC + HRA + max(OVERTIME, 1000)", ctx) == 62500.0
            assert evaluate_formula("round(BASIC * 0.125, 2)", ctx) == 6250.0

            # Unsafe syntax
            try:
                evaluate_formula("__import__('os').system('echo hack')", ctx)
                assert False, "Should have rejected unsafe import syntax"
            except ValueError:
                pass

            # Undefined variable
            try:
                evaluate_formula("UNDEFINED_VAR + 500", ctx)
                assert False, "Should have rejected undefined variable"
            except ValueError:
                pass

            # Boolean formula result rejection
            try:
                evaluate_formula("BASIC > 0", ctx)
                assert False, "Should have rejected boolean result from formula"
            except ValueError as e:
                assert "returned a boolean" in str(e)

        run_test("Safe Formula Evaluator & Boolean Result Rejection", test_formula_evaluator)

        # --------------------------------------------------
        # 5. Rule Execution Sequence Protection
        # --------------------------------------------------
        def test_sequence_violation_protection():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            period_start = date(2026, 9, 1)
            period_end = date(2026, 9, 30)

            struct = db.query(models.SalaryStructure).filter(models.SalaryStructure.name == "Regular Salary Structure").first()
            
            bad_rule = models.SalaryRule(
                structure_id=struct.id,
                name="Bad Early Rule",
                code="BAD_EARLY",
                category="allowance",
                sequence=5,  # Executed BEFORE BASIC (seq 10)
                computation_type="formula",
                formula="BASIC * 0.10",
                active=True
            )
            db.add(bad_rule)
            db.commit()

            try:
                compute_payroll(db, emp.id, period_start, period_end)
                assert False, "Should have failed due to referencing uncalculated BASIC"
            except ValueError as e:
                assert "referenced in formula" in str(e)
            finally:
                db.delete(bad_rule)
                db.commit()

        run_test("Rule Execution Sequence Violation Protection", test_sequence_violation_protection)

        # --------------------------------------------------
        # 6. Active Contract Priority over Expired Contract
        # --------------------------------------------------
        def test_active_contract_priority():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            period_start = date(2026, 9, 1)
            period_end = date(2026, 9, 30)

            # Create an expired contract that overlaps September 2026 with a different wage
            expired_contract = models.Contract(
                employee_id=emp.id,
                name="Old Expired Contract",
                contract_type="employment",
                job_title="Junior Dev",
                date_start=date(2025, 1, 1),
                date_end=date(2026, 9, 15), # Overlaps current period
                wage=30000.0,
                status="expired",
                salary_structure_id=emp.contracts[0].salary_structure_id
            )
            db.add(expired_contract)
            db.commit()

            try:
                res = compute_payroll(db, emp.id, period_start, period_end)
                # Must pick active contract (wage=60000), not expired contract (wage=30000)
                assert res.contract_wage == 60000.0, f"Expected active contract wage 60000.0, got {res.contract_wage}"
                assert res.contract_id != expired_contract.id
            finally:
                db.delete(expired_contract)
                db.commit()

        run_test("Active Contract Priority Over Expired Contract", test_active_contract_priority)

        # --------------------------------------------------
        # 7. Employee with No Applicable Contract
        # --------------------------------------------------
        def test_no_applicable_contract():
            temp_emp = models.Employee(
                first_name="NoContract",
                last_name="User",
                email=f"nocontract_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP999"
            )
            db.add(temp_emp)
            db.commit()

            try:
                compute_payroll(db, temp_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert False, "Should have failed due to no contract"
            except ValueError as e:
                assert "No active or applicable contract found" in str(e)
            finally:
                db.delete(temp_emp)
                db.commit()

        run_test("Employee With No Applicable Contract", test_no_applicable_contract)

        # --------------------------------------------------
        # 8. Contract with No Salary Structure
        # --------------------------------------------------
        def test_contract_without_salary_structure():
            temp_emp = models.Employee(
                first_name="NoStruct",
                last_name="User",
                email=f"nostruct_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP998"
            )
            db.add(temp_emp)
            db.commit()

            temp_contract = models.Contract(
                employee_id=temp_emp.id,
                name="Contract No Struct",
                contract_type="employment",
                date_start=date(2026, 1, 1),
                wage=50000.0,
                status="active",
                salary_structure_id=None
            )
            db.add(temp_contract)
            db.commit()

            try:
                compute_payroll(db, temp_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert False, "Should have failed due to unassigned salary structure"
            except ValueError as e:
                assert "has no assigned salary structure" in str(e)
            finally:
                db.delete(temp_contract)
                db.delete(temp_emp)
                db.commit()

        run_test("Contract Without Salary Structure", test_contract_without_salary_structure)

        # --------------------------------------------------
        # 9. Salary Structure with No Active Rules
        # --------------------------------------------------
        def test_structure_no_active_rules():
            temp_struct = models.SalaryStructure(
                name=f"Empty Structure {uuid.uuid4().hex[:6]}",
                description="Empty test structure",
                active=True
            )
            db.add(temp_struct)
            db.commit()

            temp_emp = models.Employee(
                first_name="EmptyStruct",
                last_name="User",
                email=f"emptystruct_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP997"
            )
            db.add(temp_emp)
            db.commit()

            temp_contract = models.Contract(
                employee_id=temp_emp.id,
                name="Contract Empty Struct",
                contract_type="employment",
                date_start=date(2026, 1, 1),
                wage=50000.0,
                status="active",
                salary_structure_id=temp_struct.id
            )
            db.add(temp_contract)
            db.commit()

            try:
                compute_payroll(db, temp_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert False, "Should have failed due to no active rules"
            except ValueError as e:
                assert "contains no active salary rules" in str(e)
            finally:
                db.delete(temp_contract)
                db.delete(temp_emp)
                db.delete(temp_struct)
                db.commit()

        run_test("Salary Structure With No Active Rules", test_structure_no_active_rules)

        # --------------------------------------------------
        # 10. Duplicate Salary Rule Codes Detection
        # --------------------------------------------------
        def test_duplicate_rule_codes():
            temp_struct = models.SalaryStructure(
                name=f"Dup Code Structure {uuid.uuid4().hex[:6]}",
                description="Duplicate code test structure",
                active=True
            )
            db.add(temp_struct)
            db.commit()

            rule1 = models.SalaryRule(
                structure_id=temp_struct.id,
                name="Basic 1",
                code="BASIC",
                category="basic",
                sequence=10,
                computation_type="fixed",
                fixed_amount=40000.0,
                active=True
            )
            rule2 = models.SalaryRule(
                structure_id=temp_struct.id,
                name="Basic 2",
                code="BASIC",
                category="basic",
                sequence=20,
                computation_type="fixed",
                fixed_amount=10000.0,
                active=True
            )
            db.add_all([rule1, rule2])
            db.commit()

            temp_emp = models.Employee(
                first_name="DupRule",
                last_name="User",
                email=f"duprule_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP996"
            )
            db.add(temp_emp)
            db.commit()

            temp_contract = models.Contract(
                employee_id=temp_emp.id,
                name="Contract Dup Rule",
                contract_type="employment",
                date_start=date(2026, 1, 1),
                wage=50000.0,
                status="active",
                salary_structure_id=temp_struct.id
            )
            db.add(temp_contract)
            db.commit()

            try:
                compute_payroll(db, temp_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert False, "Should have failed due to duplicate rule code"
            except ValueError as e:
                assert "duplicate active rule code" in str(e)
            finally:
                db.delete(temp_contract)
                db.delete(temp_emp)
                db.delete(rule1)
                db.delete(rule2)
                db.delete(temp_struct)
                db.commit()

        run_test("Duplicate Salary Rule Codes Detection", test_duplicate_rule_codes)

        # --------------------------------------------------
        # 11. Reserved Context Variable Collision Warning
        # --------------------------------------------------
        def test_context_key_collision_warning():
            temp_struct = models.SalaryStructure(
                name=f"Collision Structure {uuid.uuid4().hex[:6]}",
                description="Collision test structure",
                active=True
            )
            db.add(temp_struct)
            db.commit()

            rule1 = models.SalaryRule(
                structure_id=temp_struct.id,
                name="Rule Shadowing Wage",
                code="wage",  # Shadowing reserved 'wage'
                category="basic",
                sequence=10,
                computation_type="fixed",
                fixed_amount=40000.0,
                active=True
            )
            db.add(rule1)
            db.commit()

            temp_emp = models.Employee(
                first_name="CollRule",
                last_name="User",
                email=f"collrule_{uuid.uuid4().hex[:6]}@test.com",
                employee_number="EMP995"
            )
            db.add(temp_emp)
            db.commit()

            temp_contract = models.Contract(
                employee_id=temp_emp.id,
                name="Contract Coll Rule",
                contract_type="employment",
                date_start=date(2026, 1, 1),
                wage=50000.0,
                status="active",
                salary_structure_id=temp_struct.id
            )
            db.add(temp_contract)
            db.commit()

            try:
                res = compute_payroll(db, temp_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert len(res.warnings) > 0, "Expected a warning regarding reserved context key conflict"
                assert "conflicts with a reserved payroll variable" in res.warnings[0]
            finally:
                db.delete(temp_contract)
                db.delete(temp_emp)
                db.delete(rule1)
                db.delete(temp_struct)
                db.commit()

        run_test("Reserved Context Variable Collision Warning", test_context_key_collision_warning)

        # --------------------------------------------------
        # 12. Attendance with None/Null worked_hours Handling
        # --------------------------------------------------
        def test_null_worked_hours_handling():
            emp = db.query(models.Employee).filter(models.Employee.employee_number == "EMP001").first()
            
            null_att = models.Attendance(
                employee_id=emp.id,
                check_in=datetime(2026, 9, 2, 9, 0, 0),
                check_out=datetime(2026, 9, 2, 17, 0, 0),
                status="present",
                worked_hours=None  # Manually set to None
            )
            db.add(null_att)
            db.commit()

            try:
                res = compute_payroll(db, emp.id, date(2026, 9, 1), date(2026, 9, 30))
                assert res is not None
            finally:
                db.delete(null_att)
                db.commit()

        run_test("Null worked_hours Attendance Handling", test_null_worked_hours_handling)

        # --------------------------------------------------
        # 13. Fully Custom Non-Seeded Employee + Contract + Salary Structure
        # --------------------------------------------------
        def test_fully_custom_employee_payroll():
            custom_struct = models.SalaryStructure(
                name=f"Executive Structure {uuid.uuid4().hex[:6]}",
                description="Custom executive salary structure",
                active=True
            )
            db.add(custom_struct)
            db.commit()

            r1 = models.SalaryRule(
                structure_id=custom_struct.id,
                name="Base Pay",
                code="BASE",
                category="basic",
                sequence=10,
                computation_type="percentage",
                percentage_base="contract_wage",
                percentage=80.0,
                active=True
            )
            r2 = models.SalaryRule(
                structure_id=custom_struct.id,
                name="Exec Bonus",
                code="BONUS",
                category="allowance",
                sequence=20,
                computation_type="fixed",
                fixed_amount=25000.0,
                active=True
            )
            r3 = models.SalaryRule(
                structure_id=custom_struct.id,
                name="Exec Gross",
                code="EXEC_GROSS",
                category="gross",
                sequence=30,
                computation_type="formula",
                formula="BASE + BONUS",
                active=True
            )
            r4 = models.SalaryRule(
                structure_id=custom_struct.id,
                name="Exec Tax",
                code="EXEC_TAX",
                category="deduction",
                sequence=40,
                computation_type="formula",
                formula="-(EXEC_GROSS * 0.15)",
                active=True
            )
            r5 = models.SalaryRule(
                structure_id=custom_struct.id,
                name="Exec Net",
                code="EXEC_NET",
                category="net",
                sequence=50,
                computation_type="formula",
                formula="EXEC_GROSS + EXEC_TAX",
                active=True
            )
            db.add_all([r1, r2, r3, r4, r5])
            db.commit()

            custom_emp = models.Employee(
                first_name="Jane",
                last_name="Executive",
                email=f"jane_exec_{uuid.uuid4().hex[:6]}@company.com",
                employee_number="EMP777"
            )
            db.add(custom_emp)
            db.commit()

            custom_contract = models.Contract(
                employee_id=custom_emp.id,
                name="Jane Executive Contract",
                contract_type="employment",
                date_start=date(2026, 1, 1),
                wage=100000.0,
                status="active",
                salary_structure_id=custom_struct.id
            )
            db.add(custom_contract)
            db.commit()

            try:
                res = compute_payroll(db, custom_emp.id, date(2026, 9, 1), date(2026, 9, 30))
                
                # Wage = 100,000
                # BASE = 80,000
                # BONUS = 25,000
                # EXEC_GROSS = 105,000
                # EXEC_TAX = -15,750
                # EXEC_NET = 89,250
                line_dict = {l.code: l.amount for l in res.salary_lines}
                assert line_dict["BASE"] == 80000.00
                assert line_dict["BONUS"] == 25000.00
                assert line_dict["EXEC_GROSS"] == 105000.00
                assert line_dict["EXEC_TAX"] == -15750.00
                assert line_dict["EXEC_NET"] == 89250.00
                assert res.gross_salary == 105000.00
                assert res.net_salary == 89250.00
            finally:
                db.delete(custom_contract)
                db.delete(custom_emp)
                db.delete(r1)
                db.delete(r2)
                db.delete(r3)
                db.delete(r4)
                db.delete(r5)
                db.delete(custom_struct)
                db.commit()

        run_test("Fully Custom Non-Seeded Employee + Contract + Salary Structure", test_fully_custom_employee_payroll)

        # --------------------------------------------------
        # Final Test Summary
        # --------------------------------------------------
        print("\n==================================================")
        print(f"  PAYROLL ENGINE TEST SUITE SUMMARY")
        print(f"  Total Tests Executed : {total_tests_run}")
        print(f"  Total Tests Passed   : {passed_tests}")
        print(f"  Total Tests Failed   : {total_tests_run - passed_tests}")
        print("==================================================")

        assert passed_tests == total_tests_run, "Not all tests passed!"

    finally:
        db.close()

if __name__ == "__main__":
    test_payroll_engine()
