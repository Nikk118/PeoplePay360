import json
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import models
from app.schemas.schemas import PayslipResponse, PayslipLineResponse
from app.auth.rbac import get_current_user, TokenData

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
    mgmt_roles = {"admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager"}
    return any(r in mgmt_roles for r in user.roles)


@router.get("", response_model=List[PayslipResponse])
def list_payslips(
    employee_id: Optional[str] = Query(None),
    payrun_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    List payslips with optional filtering.
    Employees can only view their own payslips.
    HR / Payroll / Admin users can view all or filter by employee.
    """
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
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get a single payslip with its salary-rule breakdown.
    Enforces RBAC so employees cannot view other employees' payslips.
    """
    payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # RBAC Enforcement
    if not is_management_user(current_user):
        if payslip.employee_id != current_user.employee_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own payslips.")

    return build_payslip_response(payslip)
