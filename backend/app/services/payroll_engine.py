import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.models import models
from simpleeval import SimpleEval, NameNotDefined, FunctionNotDefined

@dataclass
class CalculatedSalaryLine:
    code: str
    name: str
    category: str  # basic, allowance, gross, deduction, net
    sequence: int
    computation_type: str  # fixed, percentage, formula
    base_value: float
    percentage: float
    formula: Optional[str]
    amount: float
    appears_on_payslip: bool = True

@dataclass
class PayrollCalculationResult:
    employee_id: str
    employee_name: str
    contract_id: str
    contract_name: str
    salary_structure_id: str
    salary_structure_name: str
    period_start: date
    period_end: date
    contract_wage: float
    worked_days: float
    expected_days: float
    worked_hours: float
    expected_hours: float
    time_off_days: float
    time_off_unpaid_days: float
    salary_lines: List[CalculatedSalaryLine]
    total_basic: float
    total_allowances: float
    gross_salary: float
    total_deductions: float
    net_salary: float
    calculation_context: Dict[str, Any]
    warnings: List[str] = field(default_factory=list)

def round_money(val: float) -> float:
    """Helper to consistently round monetary amounts to 2 decimal places using Decimal."""
    d = Decimal(str(val))
    return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

# Payroll context variable names reserved by the engine — rule codes must not collide with these.
_RESERVED_CONTEXT_KEYS = frozenset({
    "contract_wage", "wage", "worked_days", "expected_days",
    "worked_hours", "expected_hours", "time_off_days", "time_off_unpaid_days",
})

def evaluate_formula(formula_str: str, context: Dict[str, Any]) -> float:
    """
    Safely evaluates a formula expression using simpleeval.
    Restricted to standard arithmetic and safe functions: max, min, round, abs.
    NO eval() is used. Formula result must be numeric (int or float), not bool or string.
    """
    if not formula_str or not formula_str.strip():
        return 0.0

    evaluator = SimpleEval()
    evaluator.functions = {
        "max": max,
        "min": min,
        "round": round,
        "abs": abs,
    }

    # Map context variables for case-insensitive lookup (exact, UPPER, lower)
    names_dict: Dict[str, Any] = {}
    for k, v in context.items():
        val = float(v) if isinstance(v, (int, float, Decimal)) else v
        names_dict[k] = val
        names_dict[k.upper()] = val
        names_dict[k.lower()] = val

    evaluator.names = names_dict

    try:
        res = evaluator.eval(formula_str)
    except NameNotDefined as e:
        raise ValueError(f"Formula evaluation error: Variable '{e.name}' referenced in formula '{formula_str}' was not found in context (check rule sequence ordering)")
    except FunctionNotDefined as e:
        func_name = getattr(e, 'name', getattr(e, 'func', str(e)))
        raise ValueError(f"Formula evaluation error: Function '{func_name}' is not allowed in formula '{formula_str}'")
    except ZeroDivisionError:
        raise ValueError(f"Formula evaluation error: Division by zero in formula '{formula_str}'")
    except Exception as e:
        raise ValueError(f"Formula evaluation error: Invalid expression '{formula_str}': {str(e)}")

    # Validate result type — must be numeric (int or float), NOT bool, string, list, etc.
    # bool is a subclass of int in Python, so check it explicitly first.
    if isinstance(res, bool):
        raise ValueError(
            f"Formula evaluation error: Formula '{formula_str}' returned a boolean ({res}). "
            "Salary formulas must return a numeric monetary amount."
        )
    if not isinstance(res, (int, float)):
        raise ValueError(
            f"Formula evaluation error: Formula '{formula_str}' returned a non-numeric result "
            f"(type={type(res).__name__}). Salary formulas must return a numeric monetary amount."
        )
    return float(res)


def compute_expected_schedule(
    db: Session,
    employee: models.Employee,
    contract: models.Contract,
    period_start: date,
    period_end: date
) -> tuple[float, float]:
    """
    Calculates expected working days and hours for the payroll period based on WorkingSchedule.
    """
    # Prioritize contract schedule over employee schedule
    schedule_id = contract.working_schedule_id or employee.working_schedule_id
    schedule = None
    if schedule_id:
        schedule = db.query(models.WorkingSchedule).filter(models.WorkingSchedule.id == schedule_id).first()

    if not schedule or not schedule.lines:
        # Fallback: Count Mon-Fri weekdays in period, assuming 8 hours/day
        expected_days = 0.0
        expected_hours = 0.0
        curr = period_start
        while curr <= period_end:
            if curr.weekday() < 5:  # Mon-Fri
                expected_days += 1.0
                expected_hours += 8.0
            curr += timedelta(days=1)
        return expected_days, expected_hours

    # Build schedule map by day_of_week (0=Mon, 6=Sun)
    day_schedule_map = {}
    for line in schedule.lines:
        try:
            h1, m1, s1 = map(int, line.start_time.split(':'))
            h2, m2, s2 = map(int, line.end_time.split(':'))
            daily_hours = (h2 + m2/60.0 + s2/3600.0) - (h1 + m1/60.0 + s1/3600.0) - (line.break_duration_minutes / 60.0)
            daily_hours = max(0.0, daily_hours)
        except Exception:
            daily_hours = 8.0
        day_schedule_map[line.day_of_week] = daily_hours

    expected_days = 0.0
    expected_hours = 0.0
    curr = period_start
    while curr <= period_end:
        wday = curr.weekday()
        if wday in day_schedule_map:
            expected_days += 1.0
            expected_hours += day_schedule_map[wday]
        curr += timedelta(days=1)

    return expected_days, expected_hours


def compute_payroll(
    db: Session,
    employee_id: str,
    period_start: date,
    period_end: date,
    override_salary_structure_id: Optional[str] = None
) -> PayrollCalculationResult:
    """
    Core Payroll Engine.
    Executes salary rules in strict sequence order for an employee and payroll period.
    """
    # 1. Resolve Employee
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise ValueError(f"Employee with ID '{employee_id}' not found")

    # 2. Resolve Applicable Contract
    # Priority: active contracts rank above expired; within same status, most recent start date wins.
    # FIX: (status == 'active') must use .desc() so True(1) sorts BEFORE False(0).
    from sqlalchemy import case as sa_case
    applicable_contracts = db.query(models.Contract).filter(
        models.Contract.employee_id == employee_id,
        models.Contract.status.in_(["active", "expired"]),
        models.Contract.date_start <= period_end,
        or_(models.Contract.date_end == None, models.Contract.date_end >= period_start)
    ).order_by(
        sa_case(
            (models.Contract.status == "active", 0),
            else_=1
        ).asc(),  # active (0) before expired (1)
        models.Contract.date_start.desc()
    ).all()

    if not applicable_contracts:
        raise ValueError(f"No active or applicable contract found for employee '{employee.first_name} {employee.last_name}' in period {period_start} to {period_end}")

    contract = applicable_contracts[0]
    target_structure_id = override_salary_structure_id or contract.salary_structure_id
    if not target_structure_id:
        raise ValueError(f"Contract '{contract.name}' has no assigned salary structure")

    # 3. Resolve Salary Structure & Rules
    structure = db.query(models.SalaryStructure).filter(models.SalaryStructure.id == target_structure_id).first()
    if not structure:
        raise ValueError(f"Salary structure with ID '{contract.salary_structure_id}' not found")

    rules = db.query(models.SalaryRule).filter(
        models.SalaryRule.structure_id == structure.id,
        models.SalaryRule.active == True
    ).order_by(models.SalaryRule.sequence.asc()).all()

    if not rules:
        raise ValueError(f"Salary structure '{structure.name}' contains no active salary rules")

    # 4. Compute Expected Days & Hours
    expected_days, expected_hours = compute_expected_schedule(db, employee, contract, period_start, period_end)

    # 5. Compute Attendance Data
    start_dt = datetime.combine(period_start, datetime.min.time())
    end_dt = datetime.combine(period_end, datetime.max.time())
    
    attendance_records = db.query(models.Attendance).filter(
        models.Attendance.employee_id == employee_id,
        models.Attendance.check_in >= start_dt,
        models.Attendance.check_in <= end_dt
    ).all()

    if attendance_records:
        # FIX: Guard against None worked_hours (possible on manually-edited records despite default=0.0)
        worked_hours = sum((att.worked_hours or 0.0) for att in attendance_records)
        # Worked days fraction based on attendance status
        status_weights = {'present': 1.0, 'late': 1.0, 'half_day': 0.5, 'absent': 0.0}
        worked_days = sum(status_weights.get((att.status or '').lower(), 1.0) for att in attendance_records)
    else:
        # If no attendance records in DB for this period, default to full attendance (time off adjusted below)
        worked_hours = expected_hours
        worked_days = expected_days

    # 6. Compute Time Off Data
    time_off_requests = db.query(models.TimeOffRequest).filter(
        models.TimeOffRequest.employee_id == employee_id,
        models.TimeOffRequest.status == "approved",
        models.TimeOffRequest.date_from <= period_end,
        models.TimeOffRequest.date_to >= period_start
    ).all()

    time_off_days = 0.0
    time_off_unpaid_days = 0.0

    for req in time_off_requests:
        # Overlapping date range
        overlap_start = max(req.date_from, period_start)
        overlap_end = min(req.date_to, period_end)
        if overlap_start <= overlap_end:
            overlap_count = float((overlap_end - overlap_start).days + 1)
            time_off_days += overlap_count
            
            is_unpaid = False
            if req.time_off_type:
                if req.time_off_type.affects_payroll or req.time_off_type.code == "UNPAID":
                    is_unpaid = True
            if is_unpaid:
                time_off_unpaid_days += overlap_count

    # If attendance records were not present, adjust fallback worked_days by time_off_unpaid_days
    if not attendance_records:
        worked_days = max(0.0, expected_days - time_off_unpaid_days)

    # 7. Construct Calculation Context
    context: Dict[str, Any] = {
        "contract_wage": float(contract.wage),
        "wage": float(contract.wage),
        "worked_days": float(worked_days),
        "expected_days": float(expected_days),
        "worked_hours": float(worked_hours),
        "expected_hours": float(expected_hours),
        "time_off_days": float(time_off_days),
        "time_off_unpaid_days": float(time_off_unpaid_days),
    }

    salary_lines: List[CalculatedSalaryLine] = []
    warnings: List[str] = []

    # 8. Pre-validate rule set before executing any rules
    seen_codes: Dict[str, int] = {}  # code -> sequence
    for rule in rules:
        code_upper = rule.code.upper()
        if code_upper in seen_codes:
            raise ValueError(
                f"Salary structure '{structure.name}' has duplicate active rule code '{rule.code}' "
                f"at sequences {seen_codes[code_upper]} and {rule.sequence}. "
                f"Each rule code must be unique within a structure."
            )
        seen_codes[code_upper] = rule.sequence
        # Warn if rule code shadows a reserved payroll variable
        if rule.code.lower() in _RESERVED_CONTEXT_KEYS:
            warnings.append(
                f"Rule code '{rule.code}' conflicts with a reserved payroll variable name. "
                f"Formulas referencing '{rule.code}' will see the RULE RESULT, not the payroll variable."
            )

    # 9. Sequential Salary Rule Execution
    for rule in rules:
        comp_type = rule.computation_type.lower()
        amount = 0.0
        base_value = 0.0
        pct = 0.0

        if comp_type == "fixed":
            amount = float(rule.fixed_amount or 0.0)

        elif comp_type == "percentage":
            base_code = (rule.percentage_base or "contract_wage").strip()
            # Lookup base in context (case-insensitive, prefer exact match then upper then lower)
            matched_base_key = (
                base_code if base_code in context else
                base_code.upper() if base_code.upper() in context else
                base_code.lower() if base_code.lower() in context else
                None
            )
            if matched_base_key is None:
                raise ValueError(
                    f"Rule '{rule.name}' ({rule.code}) references percentage base '{base_code}' "
                    f"which was not found in the calculation context. "
                    f"Check rule sequence execution order (this rule's base must be computed before it)."
                )

            base_value = float(context[matched_base_key])
            pct = float(rule.percentage or 0.0)
            amount = base_value * (pct / 100.0)

        elif comp_type == "formula":
            if not rule.formula or not rule.formula.strip():
                raise ValueError(
                    f"Rule '{rule.name}' ({rule.code}) has computation_type 'formula' "
                    f"but no formula expression is specified."
                )
            amount = evaluate_formula(rule.formula, context)

        else:
            raise ValueError(f"Unsupported computation type '{rule.computation_type}' in rule '{rule.code}'")

        # Monetary Rounding
        amount = round_money(amount)
        base_value = round_money(base_value)

        # Update context so subsequent rules can reference this rule's code
        # Only the exact code and its uppercase variant are stored; lowercase aliases are also kept.
        context[rule.code] = amount
        context[rule.code.upper()] = amount
        context[rule.code.lower()] = amount

        salary_lines.append(CalculatedSalaryLine(
            code=rule.code,
            name=rule.name,
            category=rule.category.lower(),
            sequence=rule.sequence,
            computation_type=comp_type,
            base_value=base_value,
            percentage=pct,
            formula=rule.formula,
            amount=amount,
            appears_on_payslip=rule.appears_on_payslip
        ))

    # 10. Compute Summary Totals from Calculated Salary Lines
    total_basic = round_money(sum(line.amount for line in salary_lines if line.category == "basic"))
    total_allowances = round_money(sum(line.amount for line in salary_lines if line.category == "allowance"))

    # Gross: Use explicit 'gross' category line if present, else compute basic + allowances
    gross_line = next((line for line in salary_lines if line.category == "gross"), None)
    if gross_line:
        gross_salary = gross_line.amount
    else:
        gross_salary = round_money(total_basic + total_allowances)

    # Deductions: Deduction amounts should be negative by convention (e.g. PF = -7200).
    # We sum the RAW amounts (preserving sign), then report the absolute total for display.
    # The fallback net uses gross + sum(raw deduction amounts), not gross - abs(deductions),
    # so a mis-configured positive deduction rule does NOT silently add to net.
    raw_deduction_total = round_money(sum(line.amount for line in salary_lines if line.category == "deduction"))
    total_deductions = round_money(abs(raw_deduction_total))  # for display only

    # Net: Use explicit 'net' category line if present (preferred — matches the NET formula rule),
    # else compute from gross + raw deductions (preserves deduction sign correctly).
    net_line = next((line for line in salary_lines if line.category == "net"), None)
    if net_line:
        net_salary = net_line.amount
    else:
        net_salary = round_money(gross_salary + raw_deduction_total)  # deductions are already negative

    return PayrollCalculationResult(
        employee_id=employee.id,
        employee_name=f"{employee.first_name} {employee.last_name}",
        contract_id=contract.id,
        contract_name=contract.name,
        salary_structure_id=structure.id,
        salary_structure_name=structure.name,
        period_start=period_start,
        period_end=period_end,
        contract_wage=float(contract.wage),
        worked_days=worked_days,
        expected_days=expected_days,
        worked_hours=worked_hours,
        expected_hours=expected_hours,
        time_off_days=time_off_days,
        time_off_unpaid_days=time_off_unpaid_days,
        salary_lines=salary_lines,
        total_basic=total_basic,
        total_allowances=total_allowances,
        gross_salary=gross_salary,
        total_deductions=total_deductions,
        net_salary=net_salary,
        calculation_context=context,
        warnings=warnings
    )
