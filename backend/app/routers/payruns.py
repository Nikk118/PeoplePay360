import json
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, case

from app.database import get_db
from app.models import models
from app.schemas.schemas import (
    PayrunCreate, PayrunResponse, PayrunEligibleEmployeeResponse,
    PayslipResponse, PayslipLineResponse
)
from app.auth.rbac import get_current_user, require_roles, TokenData
from app.services.payroll_engine import compute_payroll

router = APIRouter(prefix="/payruns", tags=["Payruns"])

def build_payslip_response(payslip: models.Payslip) -> PayslipResponse:
    emp_name = f"{payslip.employee.first_name} {payslip.employee.last_name}" if payslip.employee else None
    dept_name = payslip.employee.department.name if payslip.employee and payslip.employee.department else None
    emp_num = payslip.employee.employee_number if payslip.employee else None
    contract_name = payslip.contract.name if payslip.contract else None
    
    warnings = []
    if payslip.warnings_json:
        try:
            warnings = json.loads(payslip.warnings_json)
        except Exception:
            warnings = []

    sorted_lines = sorted(payslip.lines, key=lambda l: l.sequence) if payslip.lines else []
    line_responses = [
        PayslipLineResponse(
            id=line.id,
            salary_rule_id=line.salary_rule_id,
            rule_name=line.rule_name,
            rule_code=line.rule_code,
            category=line.category,
            sequence=line.sequence,
            amount=float(line.amount)
        )
        for line in sorted_lines
    ]

    return PayslipResponse(
        id=payslip.id,
        payrun_id=payslip.payrun_id,
        employee_id=payslip.employee_id,
        employee_number=emp_num,
        employee_name=emp_name,
        department_name=dept_name,
        contract_id=payslip.contract_id,
        contract_name=contract_name,
        period_start=payslip.period_start,
        period_end=payslip.period_end,
        worked_days=float(payslip.worked_days or 0.0),
        worked_hours=float(payslip.worked_hours or 0.0),
        basic_salary=float(payslip.basic_salary or 0.0),
        total_allowances=float(payslip.total_allowances or 0.0),
        gross_salary=float(payslip.gross_salary or 0.0),
        total_deductions=float(payslip.total_deductions or 0.0),
        net_salary=float(payslip.net_salary or 0.0),
        status=payslip.status,
        warnings=warnings,
        lines=line_responses,
        created_at=payslip.created_at,
        updated_at=payslip.updated_at
    )

def build_payrun_response(payrun: models.Payrun) -> PayrunResponse:
    struct_name = payrun.salary_structure.name if payrun.salary_structure else None
    dept_name = payrun.department.name if payrun.department else None

    payslip_responses = [build_payslip_response(p) for p in payrun.payslips] if payrun.payslips else []

    return PayrunResponse(
        id=payrun.id,
        name=payrun.name,
        salary_structure_id=payrun.salary_structure_id,
        salary_structure_name=struct_name,
        period_start=payrun.period_start,
        period_end=payrun.period_end,
        status=payrun.status,
        employee_type_filter=payrun.employee_type_filter,
        department_id=payrun.department_id,
        department_name=dept_name,
        total_net=float(payrun.total_net or 0.0),
        total_gross=float(payrun.total_gross or 0.0),
        payslip_count=payrun.payslip_count or len(payslip_responses),
        payslips=payslip_responses,
        created_at=payrun.created_at,
        updated_at=payrun.updated_at
    )

def get_applicable_contract_for_employee(db: Session, employee_id: str, period_start: date, period_end: date) -> Optional[models.Contract]:
    contracts = db.query(models.Contract).filter(
        models.Contract.employee_id == employee_id,
        models.Contract.status.in_(["active", "expired"]),
        models.Contract.date_start <= period_end,
        or_(models.Contract.date_end == None, models.Contract.date_end >= period_start)
    ).order_by(
        case((models.Contract.status == "active", 0), else_=1).asc(),
        models.Contract.date_start.desc()
    ).all()
    return contracts[0] if contracts else None


@router.get("/eligible-employees", response_model=List[PayrunEligibleEmployeeResponse])
def list_eligible_employees(
    period_start: date,
    period_end: date,
    salary_structure_id: str,
    department_id: Optional[str] = None,
    employee_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    """
    Returns eligible active employees with contract status for Step 2 of Payrun Creation.
    """
    query = db.query(models.Employee).filter(models.Employee.status == "active")

    if department_id:
        query = query.filter(models.Employee.department_id == department_id)
    if employee_type:
        query = query.filter(models.Employee.employee_type == employee_type)

    employees = query.order_by(models.Employee.first_name, models.Employee.last_name).all()

    results = []
    for emp in employees:
        contract = get_applicable_contract_for_employee(db, emp.id, period_start, period_end)
        dept_name = emp.department.name if emp.department else None

        results.append(PayrunEligibleEmployeeResponse(
            id=emp.id,
            employee_number=emp.employee_number,
            first_name=emp.first_name,
            last_name=emp.last_name,
            email=emp.email,
            department_id=emp.department_id,
            department_name=dept_name,
            employee_type=emp.employee_type,
            contract_id=contract.id if contract else None,
            contract_name=contract.name if contract else None,
            contract_status=contract.status if contract else "no_contract",
            has_applicable_contract=(contract is not None)
        ))

    return results


@router.get("", response_model=List[PayrunResponse])
def list_payruns(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    query = db.query(models.Payrun)
    if status_filter:
        query = query.filter(models.Payrun.status == status_filter)

    payruns = query.order_by(models.Payrun.created_at.desc()).all()
    return [build_payrun_response(p) for p in payruns]


@router.get("/{payrun_id}", response_model=PayrunResponse)
def get_payrun(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")
    return build_payrun_response(payrun)


@router.get("/{payrun_id}/payslips", response_model=List[PayslipResponse])
def get_payrun_payslips(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    query = db.query(models.Payslip).filter(models.Payslip.payrun_id == payrun_id)
    payslips = query.all()
    return [build_payslip_response(p) for p in payslips]


@router.post("", response_model=PayrunResponse, status_code=status.HTTP_201_CREATED)
def create_payrun(
    body: PayrunCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    # 1. Date range validation
    if body.period_start > body.period_end:
        raise HTTPException(status_code=400, detail="Payroll period start date cannot be after end date")

    # 2. Salary Structure validation
    struct = db.query(models.SalaryStructure).filter(
        models.SalaryStructure.id == body.salary_structure_id,
        models.SalaryStructure.active == True
    ).first()
    if not struct:
        raise HTTPException(status_code=400, detail="Salary structure not found or inactive")

    # 3. Selected employees validation
    if not body.employee_ids:
        raise HTTPException(status_code=400, detail="Employee selection cannot be empty. Please select at least one employee.")

    if len(body.employee_ids) != len(set(body.employee_ids)):
        raise HTTPException(status_code=400, detail="Duplicate employee IDs found in selection")

    # 4. Prevent duplicate payrun for same structure and overlapping period
    existing_dup = db.query(models.Payrun).filter(
        models.Payrun.salary_structure_id == body.salary_structure_id,
        models.Payrun.status.in_(["draft", "computed", "validated"]),
        models.Payrun.period_start <= body.period_end,
        models.Payrun.period_end >= body.period_start
    ).first()
    if existing_dup:
        raise HTTPException(
            status_code=400,
            detail=f"A payrun ('{existing_dup.name}') for this salary structure already exists for the overlapping period ({existing_dup.period_start} to {existing_dup.period_end})"
        )

    # 5. Verify each employee and applicable contract
    resolved_contracts = []
    for emp_id in body.employee_ids:
        emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=400, detail=f"Employee with ID '{emp_id}' not found")

        contract = get_applicable_contract_for_employee(db, emp_id, body.period_start, body.period_end)
        if not contract:
            raise HTTPException(
                status_code=400,
                detail=f"Employee {emp.first_name} {emp.last_name} ({emp.employee_number}) has no active or applicable contract for period {body.period_start} to {body.period_end}"
            )
        resolved_contracts.append((emp, contract))

    # 6. Create Payrun in 'draft' status
    payrun = models.Payrun(
        name=body.name,
        salary_structure_id=body.salary_structure_id,
        period_start=body.period_start,
        period_end=body.period_end,
        status="draft",
        employee_type_filter=body.employee_type_filter,
        department_id=body.department_id,
        total_net=0.0,
        total_gross=0.0,
        payslip_count=len(resolved_contracts)
    )
    db.add(payrun)
    db.flush()

    # 7. Create draft Payslip records for selected employees
    for emp, contract in resolved_contracts:
        payslip = models.Payslip(
            payrun_id=payrun.id,
            employee_id=emp.id,
            contract_id=contract.id,
            period_start=body.period_start,
            period_end=body.period_end,
            status="draft",
            worked_days=0.0,
            worked_hours=0.0,
            basic_salary=0.0,
            total_allowances=0.0,
            gross_salary=0.0,
            total_deductions=0.0,
            net_salary=0.0,
            warnings_json="[]"
        )
        db.add(payslip)

    db.commit()
    db.refresh(payrun)
    return build_payrun_response(payrun)


@router.post("/{payrun_id}/compute", response_model=PayrunResponse)
def compute_payrun(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    """
    Computes payroll for ONLY the selected employees in this Payrun using Payroll Engine.
    Allowed status: draft, computed (re-computation).
    """
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    if payrun.status in ["validated", "paid"]:
        raise HTTPException(status_code=400, detail=f"Cannot re-compute a payrun in '{payrun.status}' status")

    if not payrun.payslips:
        raise HTTPException(status_code=400, detail="No selected employees found for this payrun")

    total_gross = 0.0
    total_net = 0.0

    for payslip in payrun.payslips:
        try:
            calc_res = compute_payroll(
                db=db,
                employee_id=payslip.employee_id,
                period_start=payrun.period_start,
                period_end=payrun.period_end,
                override_salary_structure_id=payrun.salary_structure_id
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Payroll calculation failed for employee '{payslip.employee.first_name} {payslip.employee.last_name}': {str(e)}"
            )

        # Update payslip values
        payslip.worked_days = calc_res.worked_days
        payslip.worked_hours = calc_res.worked_hours
        payslip.basic_salary = calc_res.total_basic
        payslip.total_allowances = calc_res.total_allowances
        payslip.gross_salary = calc_res.gross_salary
        payslip.total_deductions = calc_res.total_deductions
        payslip.net_salary = calc_res.net_salary
        payslip.status = "computed"
        payslip.warnings_json = json.dumps(calc_res.warnings)

        # Clear existing lines and insert new computed lines
        db.query(models.PayslipLine).filter(models.PayslipLine.payslip_id == payslip.id).delete()
        db.flush()

        # Find rule IDs from salary structure rules for line linkage
        rules_map = {r.code.upper(): r.id for r in payrun.salary_structure.rules} if payrun.salary_structure else {}

        for line in calc_res.salary_lines:
            rule_id = rules_map.get(line.code.upper())
            # Fallback if rule_id not found in map
            if not rule_id and payrun.salary_structure and payrun.salary_structure.rules:
                rule_id = payrun.salary_structure.rules[0].id

            payslip_line = models.PayslipLine(
                payslip_id=payslip.id,
                salary_rule_id=rule_id or "00000000-0000-0000-0000-000000000000",
                rule_name=line.name,
                rule_code=line.code,
                category=line.category,
                sequence=line.sequence,
                amount=line.amount
            )
            db.add(payslip_line)

        total_gross += calc_res.gross_salary
        total_net += calc_res.net_salary

    payrun.total_gross = round(total_gross, 2)
    payrun.total_net = round(total_net, 2)
    payrun.status = "computed"
    payrun.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(payrun)
    return build_payrun_response(payrun)


@router.post("/{payrun_id}/validate", response_model=PayrunResponse)
def validate_payrun(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    """
    Validates a computed payrun.
    Allowed transition: Computed -> Validated.
    """
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    if payrun.status == "draft":
        raise HTTPException(status_code=400, detail="Payrun must be computed before validation")
    if payrun.status in ["validated", "paid"]:
        raise HTTPException(status_code=400, detail=f"Payrun is already in '{payrun.status}' status")

    payrun.status = "validated"
    payrun.updated_at = datetime.utcnow()

    for p in payrun.payslips:
        p.status = "validated"

    db.commit()
    db.refresh(payrun)
    return build_payrun_response(payrun)


@router.post("/{payrun_id}/mark-paid", response_model=PayrunResponse)
def mark_payrun_paid(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    """
    Marks a validated payrun as paid.
    Allowed transition: Validated -> Paid.
    """
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    if payrun.status in ["draft", "computed"]:
        raise HTTPException(status_code=400, detail="Payrun must be validated before marking paid")
    if payrun.status == "paid":
        raise HTTPException(status_code=400, detail="Payrun is already marked as paid")

    payrun.status = "paid"
    payrun.updated_at = datetime.utcnow()

    for p in payrun.payslips:
        p.status = "paid"

    db.commit()
    db.refresh(payrun)
    return build_payrun_response(payrun)


@router.delete("/{payrun_id}")
def delete_payrun(
    payrun_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_manager"]))
):
    """
    Deletes a payrun if it is in 'draft' status.
    """
    payrun = db.query(models.Payrun).filter(models.Payrun.id == payrun_id).first()
    if not payrun:
        raise HTTPException(status_code=404, detail="Payrun not found")

    if payrun.status != "draft":
        raise HTTPException(status_code=400, detail=f"Only draft payruns can be deleted. Current status: '{payrun.status}'")

    db.delete(payrun)
    db.commit()
    return {"message": "Payrun deleted successfully"}
