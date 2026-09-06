from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import models
from app.schemas.schemas import EmployeeCreate, EmployeeResponse
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/employees", tags=["Employees"])

def build_employee_response(emp: models.Employee) -> EmployeeResponse:
    dept_name = emp.department.name if emp.department else None
    mgr_name = f"{emp.manager.first_name} {emp.manager.last_name}" if emp.manager else None
    sched_name = emp.schedule.name if emp.schedule else None
    
    return EmployeeResponse(
        id=emp.id,
        employee_number=emp.employee_number,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        date_of_birth=emp.date_of_birth,
        gender=emp.gender,
        marital_status=emp.marital_status,
        nationality=emp.nationality,
        address=emp.address,
        department_id=emp.department_id,
        department_name=dept_name,
        manager_id=emp.manager_id,
        manager_name=mgr_name,
        job_title=emp.job_title,
        job_position=emp.job_position,
        employee_type=emp.employee_type,
        working_schedule_id=emp.working_schedule_id,
        schedule_name=sched_name,
        status=emp.status,
        hire_date=emp.hire_date,
        bank_account_name=emp.bank_account_name,
        bank_account_number=emp.bank_account_number,
        bank_name=emp.bank_name,
        created_at=emp.created_at,
        updated_at=emp.updated_at
    )

@router.get("", response_model=List[EmployeeResponse])
def list_employees(
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    employee_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    is_admin_or_hr = any(r in current_user.roles for r in ["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager"])
    
    # Object-level check: Employee role must ONLY receive their own employee record
    if not is_admin_or_hr:
        app_user = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
        trusted_emp_id = app_user.employee_id if app_user else None
        if not trusted_emp_id:
            return []
        emp = db.query(models.Employee).filter(models.Employee.id == trusted_emp_id).first()
        return [build_employee_response(emp)] if emp else []

    query = db.query(models.Employee)
    if department_id:
        query = query.filter(models.Employee.department_id == department_id)
    if status:
        query = query.filter(models.Employee.status == status)
    if employee_type:
        query = query.filter(models.Employee.employee_type == employee_type)
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                models.Employee.first_name.ilike(term),
                models.Employee.last_name.ilike(term),
                models.Employee.employee_number.ilike(term),
                models.Employee.email.ilike(term),
                models.Employee.job_title.ilike(term)
            )
        )
        
    employees = query.order_by(models.Employee.first_name).all()
    return [build_employee_response(e) for e in employees]

@router.get("/me", response_model=EmployeeResponse)
def get_my_employee(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    app_user = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
    trusted_emp_id = app_user.employee_id if app_user else None
    if not trusted_emp_id:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    emp = db.query(models.Employee).filter(models.Employee.id == trusted_emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return build_employee_response(emp)

@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    is_admin_or_hr = any(r in current_user.roles for r in ["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager"])
    if not is_admin_or_hr:
        app_user = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
        trusted_emp_id = app_user.employee_id if app_user else None
        if not trusted_emp_id or trusted_emp_id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Employees can only view their own employee profile."
            )

    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return build_employee_response(emp)

@router.get("/{employee_id}/stats")
def get_employee_stats(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    is_admin_or_hr = any(r in current_user.roles for r in ["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager"])
    if not is_admin_or_hr:
        app_user = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
        trusted_emp_id = app_user.employee_id if app_user else None
        if not trusted_emp_id or trusted_emp_id != employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Employees can only view their own employee stats."
            )

    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    contracts_count = db.query(models.Contract).filter(models.Contract.employee_id == employee_id).count()
    attendance_count = db.query(models.Attendance).filter(models.Attendance.employee_id == employee_id).count()
    time_off_count = db.query(models.TimeOffRequest).filter(models.TimeOffRequest.employee_id == employee_id).count()
    allocations_count = db.query(models.TimeOffAllocation).filter(models.TimeOffAllocation.employee_id == employee_id).count()
    
    return {
        "contracts_count": contracts_count,
        "attendance_count": attendance_count,
        "time_off_count": time_off_count,
        "allocations_count": allocations_count
    }

@router.post("", response_model=EmployeeResponse)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    existing = db.query(models.Employee).filter(models.Employee.employee_number == data.employee_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")
        
    emp = models.Employee(**data.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return build_employee_response(emp)

@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: str,
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    for key, value in data.model_dump().items():
        setattr(emp, key, value)
        
    db.commit()
    db.refresh(emp)
    return build_employee_response(emp)

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return {"success": True, "message": "Employee deleted successfully"}

