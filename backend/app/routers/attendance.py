from typing import List, Optional
from datetime import datetime, date, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.database import get_db
from app.models import models
from app.schemas.schemas import (
    AttendanceCreate,
    AttendanceUpdate,
    AttendanceResponse,
    AttendanceSummaryResponse
)
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def now_india():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)


def compute_worked_hours(check_in: datetime, check_out: Optional[datetime]) -> float:
    if not check_out or check_out <= check_in:
        return 0.0

    diff = check_out - check_in
    return round(diff.total_seconds() / 3600.0, 2)
def derive_status(check_in: datetime, check_out: Optional[datetime], employee: models.Employee) -> str:
    # If check_in time is after 09:15 AM local, flag late (or customize per schedule if present)
    check_in_time = check_in.time()
    if check_in_time > time(9, 15):
        return "late"
    
    if check_out:
        hours = compute_worked_hours(check_in, check_out)
        if hours < 4.0:
            return "half_day"
            
    return "present"

def build_attendance_response(att: models.Attendance) -> AttendanceResponse:
    emp_name = f"{att.employee.first_name} {att.employee.last_name}" if att.employee else None
    dept_name = att.employee.department.name if (att.employee and att.employee.department) else None
    
    return AttendanceResponse(
        id=att.id,
        employee_id=att.employee_id,
        employee_name=emp_name,
        department_name=dept_name,
        check_in=att.check_in,
        check_out=att.check_out,
        worked_hours=att.worked_hours or 0.0,
        status=att.status,
        is_manual_edit=att.is_manual_edit,
        notes=att.notes,
        created_at=att.created_at,
        updated_at=att.updated_at
    )

@router.get("", response_model=List[AttendanceResponse])
def list_attendance(
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    query = db.query(models.Attendance).join(models.Employee)
    
    # If user is only an employee role, restrict to self
    if "employee" in current_user.roles and not any(r in current_user.roles for r in ["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]):
        if current_user.employee_id:
            query = query.filter(models.Attendance.employee_id == current_user.employee_id)

    if employee_id:
        query = query.filter(models.Attendance.employee_id == employee_id)
    if department_id:
        query = query.filter(models.Employee.department_id == department_id)
    if status:
        query = query.filter(models.Attendance.status == status)
    if date_from:
        query = query.filter(models.Attendance.check_in >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(models.Attendance.check_in <= datetime.combine(date_to, time.max))

    records = query.order_by(models.Attendance.check_in.desc()).all()
    return [build_attendance_response(r) for r in records]

@router.get("/today", response_model=Optional[AttendanceResponse])
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    if not current_user.employee_id:
        return None
        
    today_start = datetime.combine(date.today(), time.min)
    record = db.query(models.Attendance).filter(
        models.Attendance.employee_id == current_user.employee_id,
        models.Attendance.check_in >= today_start
    ).order_by(models.Attendance.check_in.desc()).first()
    
    if not record:
        return None
    return build_attendance_response(record)

@router.post("/check-in", response_model=AttendanceResponse)
def check_in(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="Current user has no linked employee profile")
        
    # Check if active check-in exists without check-out
    existing = db.query(models.Attendance).filter(
        models.Attendance.employee_id == current_user.employee_id,
        models.Attendance.check_out == None
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You are already checked in. Please check out first.")
        
    emp = db.query(models.Employee).filter(models.Employee.id == current_user.employee_id).first()
    now_time = now_india()
    att_status = derive_status(now_time, None, emp)
    
    att = models.Attendance(
        employee_id=current_user.employee_id,
        check_in=now_time,
        check_out=None,
        worked_hours=0.0,
        status=att_status,
        is_manual_edit=False
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return build_attendance_response(att)

@router.put("/check-out/{attendance_id}", response_model=AttendanceResponse)
def check_out(
    attendance_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    att = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    now_time = now_india()
    att.check_out = now_time
    att.worked_hours = compute_worked_hours(att.check_in, now_time)
    att.status = derive_status(att.check_in, now_time, att.employee)
    
    db.commit()
    db.refresh(att)
    return build_attendance_response(att)

@router.get("/summary", response_model=AttendanceSummaryResponse)
def get_attendance_summary(
    employee_id: str = Query(...),
    period_start: date = Query(...),
    period_end: date = Query(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    start_dt = datetime.combine(period_start, time.min)
    end_dt = datetime.combine(period_end, time.max)
    
    records = db.query(models.Attendance).filter(
        models.Attendance.employee_id == employee_id,
        models.Attendance.check_in >= start_dt,
        models.Attendance.check_in <= end_dt
    ).all()
    
    worked_days = len({r.check_in.date() for r in records})
    total_hours = sum(r.worked_hours or 0.0 for r in records)
    present_cnt = sum(1 for r in records if r.status == "present")
    late_cnt = sum(1 for r in records if r.status == "late")
    absent_cnt = sum(1 for r in records if r.status == "absent")
    half_cnt = sum(1 for r in records if r.status == "half_day")
    
    return AttendanceSummaryResponse(
        employee_id=employee_id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        period_start=period_start,
        period_end=period_end,
        worked_days=float(worked_days),
        total_worked_hours=round(total_hours, 2),
        present_count=present_cnt,
        late_count=late_cnt,
        absent_count=absent_cnt,
        half_day_count=half_cnt
    )

@router.post("", response_model=AttendanceResponse)
def create_manual_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    emp = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="Employee not found")
        
    worked = compute_worked_hours(data.check_in, data.check_out)
    att = models.Attendance(
        employee_id=data.employee_id,
        check_in=data.check_in,
        check_out=data.check_out,
        worked_hours=worked,
        status=data.status,
        is_manual_edit=True,
        notes=data.notes
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return build_attendance_response(att)

@router.put("/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(
    attendance_id: str,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    att = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    if data.check_in is not None:
        att.check_in = data.check_in
    if data.check_out is not None:
        att.check_out = data.check_out
    if data.status is not None:
        att.status = data.status
    if data.notes is not None:
        att.notes = data.notes

    att.worked_hours = compute_worked_hours(att.check_in, att.check_out)
    att.is_manual_edit = True

    db.commit()
    db.refresh(att)
    return build_attendance_response(att)

@router.delete("/{attendance_id}")
def delete_attendance(
    attendance_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    att = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    db.delete(att)
    db.commit()
    return {"message": "Attendance record deleted"}
