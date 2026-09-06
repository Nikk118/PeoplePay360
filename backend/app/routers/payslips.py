import json
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session


from app.database import get_db
from app.models import models
from app.schemas.schemas import PayslipResponse, PayslipLineResponse, PayslipUpdate
from app.auth.rbac import get_current_user, require_roles, TokenData
from app.services.payroll_engine import compute_payroll
from app.services.pdf_generator import generate_payslip_pdf

router = APIRouter(prefix="/payslips", tags=["Payslips"])

def build_payslip_response(payslip: models.Payslip) -> PayslipResponse:
    emp_name = f"{payslip.employee.first_name} {payslip.employee.last_name}" if payslip.employee else None
    dept_name = payslip.employee.department.name if payslip.employee and payslip.employee.department else None
    emp_num = payslip.employee.employee_number if payslip.employee else None
    contract_name = payslip.contract.name if payslip.contract else None
    payrun_name = payslip.payrun.name if payslip.payrun else None
    struct_name = payslip.payrun.salary_structure.name if (payslip.payrun and payslip.payrun.salary_structure) else None
    
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
        payrun_name=payrun_name,
        salary_structure_name=struct_name,
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

def is_management_user(user: TokenData) -> bool:
    mgmt_roles = {"admin", "hr_payroll_user", "hr_payroll_manager"}
    return any(r in mgmt_roles for r in user.roles)

def check_not_hr_manager_only(user: TokenData):
    if "hr_manager" in user.roles and not any(r in user.roles for r in ["admin", "hr_payroll_user", "hr_payroll_manager"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. HR Managers do not have access to payroll features."
        )


@router.get("", response_model=List[PayslipResponse])
def list_payslips(
    employee_id: Optional[str] = Query(None),
    payrun_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    """
    List payslips with optional filtering.
    Employees can only view their own payslips.
    HR Payroll / Admin users can view all or filter by employee.
    HR Managers are denied access.
    """
    check_not_hr_manager_only(current_user)

    query = db.query(models.Payslip)

    # RBAC Enforcement: Non-management users can only view their own payslips
    if not is_management_user(current_user):
        if not current_user.employee_id:
            return []
        query = query.filter(models.Payslip.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.filter(models.Payslip.employee_id == employee_id)

    if payrun_id:
        query = query.filter(models.Payslip.payrun_id == payrun_id)
    if status_filter:
        query = query.filter(models.Payslip.status == status_filter)
    if period_start:
        query = query.filter(models.Payslip.period_start >= period_start)
    if period_end:
        query = query.filter(models.Payslip.period_end <= period_end)

    payslips = query.order_by(models.Payslip.period_start.desc(), models.Payslip.created_at.desc()).all()
    return [build_payslip_response(p) for p in payslips]


@router.get("/{payslip_id}", response_model=PayslipResponse)
def get_payslip(
    payslip_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    """
    Get a single payslip with its salary-rule breakdown.
    Enforces RBAC so employees cannot view other employees' payslips.
    """
    check_not_hr_manager_only(current_user)

    payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # RBAC Enforcement
    if not is_management_user(current_user):
        if payslip.employee_id != current_user.employee_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own payslips.")

    return build_payslip_response(payslip)


@router.put("/{payslip_id}", response_model=PayslipResponse)
@router.post("/{payslip_id}/recompute", response_model=PayslipResponse)
def update_payslip(
    payslip_id: str,
    body: Optional[PayslipUpdate] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin", "hr_payroll_user", "hr_payroll_manager"]))
):
    """
    Updates and recomputes a specific payslip for an employee while in draft or computed status.
    Recalculates worked days, hours, time off deductions, and salary rules.
    Updates the parent payrun's gross and net totals.
    Validated or paid payslips cannot be modified.
    """
    check_not_hr_manager_only(current_user)

    payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    if payslip.status in ["validated", "paid"]:
        raise HTTPException(status_code=400, detail=f"Cannot update a payslip in '{payslip.status}' status")

    try:
        calc_res = compute_payroll(
            db=db,
            employee_id=payslip.employee_id,
            period_start=payslip.period_start,
            period_end=payslip.period_end,
            override_salary_structure_id=payslip.payrun.salary_structure_id if payslip.payrun else None
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Payroll calculation failed: {str(e)}"
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
    payslip.updated_at = datetime.utcnow()

    # Clear and recreate lines
    db.query(models.PayslipLine).filter(models.PayslipLine.payslip_id == payslip.id).delete()
    db.flush()

    rules_map = {r.code.upper(): r.id for r in payslip.payrun.salary_structure.rules} if (payslip.payrun and payslip.payrun.salary_structure) else {}

    for line in calc_res.salary_lines:
        rule_id = rules_map.get(line.code.upper())
        if not rule_id and payslip.payrun and payslip.payrun.salary_structure and payslip.payrun.salary_structure.rules:
            rule_id = payslip.payrun.salary_structure.rules[0].id

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

    # Update parent payrun totals
    if payslip.payrun:
        payrun = payslip.payrun
        total_gross = sum(float(p.gross_salary or 0.0) if p.id != payslip.id else calc_res.gross_salary for p in payrun.payslips)
        total_net = sum(float(p.net_salary or 0.0) if p.id != payslip.id else calc_res.net_salary for p in payrun.payslips)
        payrun.total_gross = round(total_gross, 2)
        payrun.total_net = round(total_net, 2)
        if payrun.status == "draft":
            payrun.status = "computed"
        payrun.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(payslip)
    return build_payslip_response(payslip)


@router.get("/{payslip_id}/pdf")
def get_payslip_pdf(
    payslip_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    """
    Generates and returns an official PDF document for a stored Payslip.
    Enforces RBAC: Employees can only generate/view their own payslip PDF.
    Does NOT recalculate payroll — strictly uses stored Payslip and PayslipLine database data.
    """
    check_not_hr_manager_only(current_user)

    payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # RBAC Enforcement
    if not is_management_user(current_user):
        if payslip.employee_id != current_user.employee_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only generate/view your own payslip PDF.")

    try:
        pdf_bytes = generate_payslip_pdf(payslip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate payslip PDF: {str(e)}")

    emp_code = payslip.employee.employee_number if payslip.employee else "EMP"
    filename = f"payslip_{emp_code}_{payslip.period_start}_{payslip.period_end}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
