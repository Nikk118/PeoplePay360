from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import AppUser, UserRole, Employee
from app.schemas.schemas import LoginRequest, TokenResponse, UserResponse, UserCreate
from app.auth.jwt import verify_password, get_password_hash, create_access_token
from app.auth.rbac import get_current_user, require_roles, TokenData

router = APIRouter(prefix="/auth", tags=["Authentication"])
user_router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AppUser).filter(AppUser.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive"
        )
    
    roles = [r.role for r in user.roles]
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "employee_id": user.employee_id,
        "roles": roles
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        roles=roles
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: TokenData = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(AppUser).filter(AppUser.id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    emp_name = None
    if user.employee:
        emp_name = f"{user.employee.first_name} {user.employee.last_name}"
        
    return UserResponse(
        id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        employee_name=emp_name,
        is_active=user.is_active,
        roles=[r.role for r in user.roles]
    )

# Admin User Management Endpoints
@user_router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin"]))
):
    users = db.query(AppUser).all()
    results = []
    for u in users:
        emp_name = f"{u.employee.first_name} {u.employee.last_name}" if u.employee else None
        results.append(UserResponse(
            id=u.id,
            email=u.email,
            employee_id=u.employee_id,
            employee_name=emp_name,
            is_active=u.is_active,
            roles=[r.role for r in u.roles]
        ))
    return results

@user_router.post("", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin"]))
):
    existing = db.query(AppUser).filter(AppUser.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already exists")
    
    hashed_pwd = get_password_hash(data.password)
    user = AppUser(
        email=data.email,
        password_hash=hashed_pwd,
        employee_id=data.employee_id,
        is_active=True
    )
    db.add(user)
    db.flush()
    
    for r in data.roles:
        db.add(UserRole(user_id=user.id, role=r))
    
    db.commit()
    db.refresh(user)
    
    emp_name = f"{user.employee.first_name} {user.employee.last_name}" if user.employee else None
    return UserResponse(
        id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        employee_name=emp_name,
        is_active=user.is_active,
        roles=[r.role for r in user.roles]
    )
