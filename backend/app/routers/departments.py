from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Department
from app.schemas.schemas import DepartmentResponse
from app.auth.rbac import require_roles, TokenData

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentResponse])
def list_departments(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "admin"]))
):
    return db.query(Department).order_by(Department.name).all()

@router.post("", response_model=DepartmentResponse)
def create_department(
    name: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["hr_manager", "admin"]))
):
    existing = db.query(Department).filter(Department.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists")
    dept = Department(name=name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
