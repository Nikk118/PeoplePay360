from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import models
from app.schemas.schemas import ContractCreate, ContractResponse, ApplicableContractResponse
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/contracts", tags=["Contracts"])

def check_contract_overlap(db: Session, contract: models.Contract) -> bool:
    if contract.status != "active":
        return False
        
    query = db.query(models.Contract).filter(
        models.Contract.employee_id == contract.employee_id,
        models.Contract.id != contract.id,
        models.Contract.status == "active"
    )
    
    # Overlap condition:
    # c1.date_start <= (c2.date_end or max) AND c2.date_start <= (c1.date_end or max)
    c1_end = contract.date_end or date(9999, 12, 31)
    
    for other in query.all():
        other_end = other.date_end or date(9999, 12, 31)
        if contract.date_start <= other_end and other.date_start <= c1_end:
            return True
    return False

def build_contract_response(c: models.Contract, db: Session) -> ContractResponse:
    emp_name = f"{c.employee.first_name} {c.employee.last_name}" if c.employee else None
    dept_name = c.employee.department.name if (c.employee and c.employee.department) else None
    struct_name = c.salary_structure.name if c.salary_structure else None
    sched_name = c.schedule.name if c.schedule else None
    
    has_overlap = check_contract_overlap(db, c)
    
    return ContractResponse(
        id=c.id,
        employee_id=c.employee_id,
        employee_name=emp_name,
        name=c.name,
        contract_type=c.contract_type,
        department_id=c.department_id,
        department_name=dept_name,
        job_position=c.job_position,
        job_title=c.job_title,
        date_start=c.date_start,
        date_end=c.date_end,
        wage=c.wage,
        wage_type=c.wage_type,
        salary_structure_id=c.salary_structure_id,
        salary_structure_name=struct_name,
        working_schedule_id=c.working_schedule_id,
        schedule_name=sched_name,
        status=c.status,
        notes=c.notes,
        has_overlap_warning=has_overlap,
        created_at=c.created_at,
        updated_at=c.updated_at
    )

@router.get("", response_model=List[ContractResponse])
def list_contracts(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    query = db.query(models.Contract)
    if employee_id:
        query = query.filter(models.Contract.employee_id == employee_id)
    if status:
        query = query.filter(models.Contract.status == status)
        
    contracts = query.order_by(models.Contract.date_start.desc()).all()
    return [build_contract_response(c, db) for c in contracts]

@router.get("/applicable", response_model=ApplicableContractResponse)
def get_applicable_contract(
    employee_id: str = Query(...),
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    """
    Selects the active contract applicable to the specified payroll period [period_start, period_end].
    """
    contracts = db.query(models.Contract).filter(
        models.Contract.employee_id == employee_id,
        models.Contract.status.in_(["active", "expired"]),
        models.Contract.date_start <= period_end,
        or_(models.Contract.date_end == None, models.Contract.date_end >= period_start)
    ).order_by(models.Contract.date_start.desc()).all()

    if not contracts:
        return ApplicableContractResponse(
            period_start=period_start,
            period_end=period_end,
            employee_id=employee_id,
            applicable_contract=None,
            status_message="No active contract found covering the specified payroll period."
        )

    applicable = contracts[0]
    msg = f"Applicable contract '{applicable.name}' selected."
    if len(contracts) > 1:
        msg += f" WARNING: Multiple overlapping active contracts detected ({len(contracts)})."

    return ApplicableContractResponse(
        period_start=period_start,
        period_end=period_end,
        employee_id=employee_id,
        applicable_contract=build_contract_response(applicable, db),
        status_message=msg
    )

@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    c = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return build_contract_response(c, db)

@router.post("", response_model=ContractResponse)
def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="Target employee does not exist")

    contract = models.Contract(**data.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return build_contract_response(contract, db)

@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: str,
    data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    c = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")

    for key, val in data.model_dump().items():
        setattr(c, key, val)

    db.commit()
    db.refresh(c)
    return build_contract_response(c, db)

@router.delete("/{contract_id}")
def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    c = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(c)
    db.commit()
    return {"message": "Contract deleted"}
