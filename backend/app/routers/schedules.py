from typing import List
from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import models
from app.schemas.schemas import (
    WorkingScheduleCreate, WorkingScheduleResponse, ScheduleLineResponse
)
from app.auth.rbac import require_roles, TokenData

router = APIRouter(prefix="/schedules", tags=["Working Schedules"])

def parse_time_to_minutes(t_str: str) -> int:
    try:
        parts = [int(p) for p in t_str.split(":")]
        return parts[0] * 60 + parts[1]
    except Exception:
        return 0

def compute_weekly_hours(lines: List[models.ScheduleLine]) -> float:
    total_minutes = 0
    for line in lines:
        start_min = parse_time_to_minutes(str(line.start_time))
        end_min = parse_time_to_minutes(str(line.end_time))
        net_min = max(0, (end_min - start_min) - (line.break_duration_minutes or 0))
        total_minutes += net_min
    return round(total_minutes / 60.0, 2)

def build_schedule_response(sched: models.WorkingSchedule) -> WorkingScheduleResponse:
    weekly_hours = compute_weekly_hours(sched.lines)
    lines_resp = [
        ScheduleLineResponse(
            id=l.id,
            day_of_week=l.day_of_week,
            start_time=str(l.start_time),
            end_time=str(l.end_time),
            break_duration_minutes=l.break_duration_minutes
        ) for l in sorted(sched.lines, key=lambda x: x.day_of_week)
    ]
    return WorkingScheduleResponse(
        id=sched.id,
        name=sched.name,
        schedule_type=sched.schedule_type,
        weekly_hours=weekly_hours,
        lines=lines_resp,
        created_at=sched.created_at,
        updated_at=sched.updated_at
    )

@router.get("", response_model=List[WorkingScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    schedules = db.query(models.WorkingSchedule).order_by(models.WorkingSchedule.name).all()
    return [build_schedule_response(s) for s in schedules]

@router.get("/{schedule_id}", response_model=WorkingScheduleResponse)
def get_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    sched = db.query(models.WorkingSchedule).filter(models.WorkingSchedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    return build_schedule_response(sched)

@router.post("", response_model=WorkingScheduleResponse)
def create_schedule(
    data: WorkingScheduleCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    existing = db.query(models.WorkingSchedule).filter(models.WorkingSchedule.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Working schedule name already exists")

    sched = models.WorkingSchedule(name=data.name, schedule_type=data.schedule_type)
    db.add(sched)
    db.flush()

    for line_data in data.lines:
        db.add(models.ScheduleLine(
            schedule_id=sched.id,
            day_of_week=line_data.day_of_week,
            start_time=line_data.start_time,
            end_time=line_data.end_time,
            break_duration_minutes=line_data.break_duration_minutes
        ))

    db.commit()
    db.refresh(sched)
    return build_schedule_response(sched)

@router.put("/{schedule_id}", response_model=WorkingScheduleResponse)
def update_schedule(
    schedule_id: str,
    data: WorkingScheduleCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    sched = db.query(models.WorkingSchedule).filter(models.WorkingSchedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Working schedule not found")

    sched.name = data.name
    sched.schedule_type = data.schedule_type

    # Replace schedule lines
    db.query(models.ScheduleLine).filter(models.ScheduleLine.schedule_id == schedule_id).delete()
    for line_data in data.lines:
        db.add(models.ScheduleLine(
            schedule_id=sched.id,
            day_of_week=line_data.day_of_week,
            start_time=line_data.start_time,
            end_time=line_data.end_time,
            break_duration_minutes=line_data.break_duration_minutes
        ))

    db.commit()
    db.refresh(sched)
    return build_schedule_response(sched)

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    sched = db.query(models.WorkingSchedule).filter(models.WorkingSchedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Working schedule not found")
    db.delete(sched)
    db.commit()
    return {"message": "Working schedule deleted"}
