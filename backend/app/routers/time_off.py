from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import models
from app.schemas.schemas import (
    TimeOffTypeCreate, TimeOffTypeResponse,
    TimeOffAllocationCreate, TimeOffAllocationResponse,
    TimeOffRequestCreate, TimeOffRequestResponse,
    LeaveBalanceResponse
)
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/time-off", tags=["Time Off"])

def calculate_duration_days(date_from: date, date_to: date) -> float:
    if date_to < date_from:
        return 0.0
    # Include both start and end days
    delta = (date_to - date_from).days + 1
    return float(delta)

# -------------------------------
# 1. TIME OFF TYPES
# -------------------------------
@router.get("/types", response_model=List[TimeOffTypeResponse])
def list_time_off_types(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    return db.query(models.TimeOffType).filter(models.TimeOffType.active == True).order_by(models.TimeOffType.name).all()

@router.post("/types", response_model=TimeOffTypeResponse)
def create_time_off_type(
    data: TimeOffTypeCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    existing = db.query(models.TimeOffType).filter(
        or_(models.TimeOffType.name == data.name, models.TimeOffType.code == data.code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Time Off Type name or code already exists")

    tt = models.TimeOffType(**data.model_dump())
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt

# -------------------------------
# 2. ALLOCATIONS
# -------------------------------
def build_allocation_response(alloc: models.TimeOffAllocation) -> TimeOffAllocationResponse:
    emp_name = f"{alloc.employee.first_name} {alloc.employee.last_name}" if alloc.employee else None
    type_name = alloc.time_off_type.name if alloc.time_off_type else None
    remaining = max(0.0, (alloc.allocated_days or 0.0) - (alloc.taken_days or 0.0))

    return TimeOffAllocationResponse(
        id=alloc.id,
        employee_id=alloc.employee_id,
        employee_name=emp_name,
        time_off_type_id=alloc.time_off_type_id,
        time_off_type_name=type_name,
        allocated_days=alloc.allocated_days,
        taken_days=alloc.taken_days or 0.0,
        remaining_days=remaining,
        date_from=alloc.date_from,
        date_to=alloc.date_to,
        status=alloc.status,
        notes=alloc.notes,
        created_at=alloc.created_at
    )

@router.get("/allocations", response_model=List[TimeOffAllocationResponse])
def list_allocations(
    employee_id: Optional[str] = None,
    time_off_type_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    query = db.query(models.TimeOffAllocation)
    if "employee" in current_user.roles and not any(r in current_user.roles for r in ["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]):
        if current_user.employee_id:
            query = query.filter(models.TimeOffAllocation.employee_id == current_user.employee_id)

    if employee_id:
        query = query.filter(models.TimeOffAllocation.employee_id == employee_id)
    if time_off_type_id:
        query = query.filter(models.TimeOffAllocation.time_off_type_id == time_off_type_id)
    if status:
        query = query.filter(models.TimeOffAllocation.status == status)

    allocs = query.order_by(models.TimeOffAllocation.date_from.desc()).all()
    return [build_allocation_response(a) for a in allocs]

@router.post("/allocations", response_model=TimeOffAllocationResponse)
def create_allocation(
    data: TimeOffAllocationCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="Employee not found")

    tt = db.query(models.TimeOffType).filter(models.TimeOffType.id == data.time_off_type_id).first()
    if not tt:
        raise HTTPException(status_code=400, detail="Time Off Type not found")

    alloc = models.TimeOffAllocation(
        employee_id=data.employee_id,
        time_off_type_id=data.time_off_type_id,
        allocated_days=data.allocated_days,
        taken_days=0.0,
        date_from=data.date_from,
        date_to=data.date_to,
        status="draft",
        notes=data.notes
    )
    db.add(alloc)
    db.commit()
    db.refresh(alloc)
    return build_allocation_response(alloc)

@router.put("/allocations/{allocation_id}/approve", response_model=TimeOffAllocationResponse)
def approve_allocation(
    allocation_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    alloc = db.query(models.TimeOffAllocation).filter(models.TimeOffAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation record not found")

    alloc.status = "approved"
    db.commit()
    db.refresh(alloc)
    return build_allocation_response(alloc)

@router.put("/allocations/{allocation_id}/refuse", response_model=TimeOffAllocationResponse)
def refuse_allocation(
    allocation_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    alloc = db.query(models.TimeOffAllocation).filter(models.TimeOffAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation record not found")

    alloc.status = "refused"
    db.commit()
    db.refresh(alloc)
    return build_allocation_response(alloc)

# -------------------------------
# 3. LEAVE REQUESTS
# -------------------------------
def build_request_response(req: models.TimeOffRequest) -> TimeOffRequestResponse:
    emp_name = f"{req.employee.first_name} {req.employee.last_name}" if req.employee else None
    dept_name = req.employee.department.name if (req.employee and req.employee.department) else None
    type_name = req.time_off_type.name if req.time_off_type else None
    type_code = req.time_off_type.code if req.time_off_type else None
    appr_name = f"{req.approver.first_name} {req.approver.last_name}" if req.approver else None

    return TimeOffRequestResponse(
        id=req.id,
        employee_id=req.employee_id,
        employee_name=emp_name,
        department_name=dept_name,
        time_off_type_id=req.time_off_type_id,
        time_off_type_name=type_name,
        time_off_type_code=type_code,
        date_from=req.date_from,
        date_to=req.date_to,
        duration_days=req.duration_days or 0.0,
        reason=req.reason,
        status=req.status,
        approved_by_name=appr_name,
        response_date=req.response_date,
        created_at=req.created_at,
        updated_at=req.updated_at
    )

@router.get("/requests", response_model=List[TimeOffRequestResponse])
def list_requests(
    employee_id: Optional[str] = None,
    time_off_type_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    query = db.query(models.TimeOffRequest)
    if "employee" in current_user.roles and not any(r in current_user.roles for r in ["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]):
        if current_user.employee_id:
            query = query.filter(models.TimeOffRequest.employee_id == current_user.employee_id)

    if employee_id:
        query = query.filter(models.TimeOffRequest.employee_id == employee_id)
    if time_off_type_id:
        query = query.filter(models.TimeOffRequest.time_off_type_id == time_off_type_id)
    if status:
        query = query.filter(models.TimeOffRequest.status == status)

    reqs = query.order_by(models.TimeOffRequest.created_at.desc()).all()
    return [build_request_response(r) for r in reqs]

@router.post("/requests", response_model=TimeOffRequestResponse)
def create_request(
    data: TimeOffRequestCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="Employee not found")

    tt = db.query(models.TimeOffType).filter(models.TimeOffType.id == data.time_off_type_id).first()
    if not tt:
        raise HTTPException(status_code=400, detail="Time Off Type not found")

    duration = calculate_duration_days(data.date_from, data.date_to)
    if duration <= 0:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")

    # Link matching allocation if required
    alloc_id = None
    if tt.requires_allocation:
        alloc = db.query(models.TimeOffAllocation).filter(
            models.TimeOffAllocation.employee_id == data.employee_id,
            models.TimeOffAllocation.time_off_type_id == data.time_off_type_id,
            models.TimeOffAllocation.status == "approved",
            models.TimeOffAllocation.date_from <= data.date_to,
            models.TimeOffAllocation.date_to >= data.date_from
        ).first()
        if alloc:
            alloc_id = alloc.id

    req = models.TimeOffRequest(
        employee_id=data.employee_id,
        time_off_type_id=data.time_off_type_id,
        allocation_id=alloc_id,
        date_from=data.date_from,
        date_to=data.date_to,
        duration_days=duration,
        reason=data.reason,
        status="pending"
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return build_request_response(req)

@router.put("/requests/{request_id}/approve", response_model=TimeOffRequestResponse)
def approve_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_manager", "admin"]))
):
    req = db.query(models.TimeOffRequest).filter(models.TimeOffRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    user_emp_id = current_user.employee_id
    if not user_emp_id and current_user.user_id:
        user_record = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
        if user_record:
            user_emp_id = user_record.employee_id

    # HR Managers cannot approve or refuse their own leave requests
    if user_emp_id and user_emp_id == req.employee_id and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR Managers cannot approve or refuse their own leave requests. An HR Payroll Manager or Admin must review it."
        )

    # Double deduction protection: if already approved, return without re-deducting balance
    if req.status == "approved":
        return build_request_response(req)

    tt = req.time_off_type
    if tt.requires_allocation:
        # Find matching approved allocation for employee & type
        alloc = db.query(models.TimeOffAllocation).filter(
            models.TimeOffAllocation.employee_id == req.employee_id,
            models.TimeOffAllocation.time_off_type_id == req.time_off_type_id,
            models.TimeOffAllocation.status == "approved",
            models.TimeOffAllocation.date_from <= req.date_to,
            models.TimeOffAllocation.date_to >= req.date_from
        ).first()

        if not alloc:
            raise HTTPException(
                status_code=400,
                detail=f"No active approved leave allocation found for type '{tt.name}' covering dates {req.date_from} to {req.date_to}"
            )

        remaining = max(0.0, (alloc.allocated_days or 0.0) - (alloc.taken_days or 0.0))
        if remaining < req.duration_days:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient leave balance! Available: {remaining} days, Requested: {req.duration_days} days."
            )

        # Deduct balance
        alloc.taken_days = (alloc.taken_days or 0.0) + req.duration_days
        req.allocation_id = alloc.id

    req.status = "approved"
    req.approved_by = user_emp_id or current_user.employee_id
    req.response_date = datetime.utcnow()

    db.commit()
    db.refresh(req)
    return build_request_response(req)

@router.put("/requests/{request_id}/refuse", response_model=TimeOffRequestResponse)
def refuse_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_manager", "admin"]))
):
    req = db.query(models.TimeOffRequest).filter(models.TimeOffRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    user_emp_id = current_user.employee_id
    if not user_emp_id and current_user.user_id:
        user_record = db.query(models.AppUser).filter(models.AppUser.id == current_user.user_id).first()
        if user_record:
            user_emp_id = user_record.employee_id

    # HR Managers cannot approve or refuse their own leave requests
    if user_emp_id and user_emp_id == req.employee_id and "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR Managers cannot approve or refuse their own leave requests. An HR Payroll Manager or Admin must review it."
        )

    # If previously approved, restore balance
    if req.status == "approved" and req.allocation_id:
        alloc = db.query(models.TimeOffAllocation).filter(models.TimeOffAllocation.id == req.allocation_id).first()
        if alloc:
            alloc.taken_days = max(0.0, (alloc.taken_days or 0.0) - req.duration_days)

    req.status = "refused"
    req.approved_by = user_emp_id or current_user.employee_id
    req.response_date = datetime.utcnow()

    db.commit()
    db.refresh(req)
    return build_request_response(req)

# -------------------------------
# 4. LEAVE BALANCES API
# -------------------------------
@router.get("/balances", response_model=List[LeaveBalanceResponse])
def get_leave_balances(
    employee_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    types = db.query(models.TimeOffType).filter(models.TimeOffType.active == True).all()
    results = []

    for tt in types:
        allocs = db.query(models.TimeOffAllocation).filter(
            models.TimeOffAllocation.employee_id == employee_id,
            models.TimeOffAllocation.time_off_type_id == tt.id,
            models.TimeOffAllocation.status == "approved"
        ).all()

        allocated = sum(a.allocated_days or 0.0 for a in allocs)
        taken = sum(a.taken_days or 0.0 for a in allocs)
        remaining = max(0.0, allocated - taken)

        results.append(LeaveBalanceResponse(
            employee_id=employee_id,
            time_off_type_id=tt.id,
            type_name=tt.name,
            type_code=tt.code,
            allocated_days=allocated,
            taken_days=taken,
            remaining_days=remaining,
            requires_allocation=tt.requires_allocation
        ))

    return results
