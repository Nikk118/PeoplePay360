import secrets
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.models import AppUser, UserRole, Employee, UserInvitation, Department
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserResponse, UserCreate,
    ValidateInvitationResponse, SetPasswordRequest, SetPasswordResponse,
    ResendInvitationResponse, UserLinkEmployee
)
from app.auth.jwt import verify_password, get_password_hash, create_access_token
from app.auth.rbac import get_current_user, require_roles, TokenData
from app.services.email_service import send_invitation_email

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

@router.get("/validate-invitation", response_model=ValidateInvitationResponse)
def validate_invitation(token: str, db: Session = Depends(get_db)):
    clean_token = token.strip().rstrip("/").rstrip(".") if token else ""
    if not clean_token or len(clean_token) < 16:
        raise HTTPException(status_code=400, detail="Invalid invitation token.")
    
    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    invitation = db.query(UserInvitation).filter(UserInvitation.token_hash == token_hash).first()
    
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid invitation token.")
    
    if invitation.used_at is not None:
        raise HTTPException(status_code=400, detail="This invitation has already been used. Please log in.")
    
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invitation link has expired. Please request a new invitation from your administrator.")
    
    user = db.query(AppUser).filter(AppUser.id == invitation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invited user account not found.")
    
    emp_name = f"{user.employee.first_name} {user.employee.last_name}" if user.employee else None
    primary_role = user.roles[0].role if user.roles else "employee"

    return ValidateInvitationResponse(
        valid=True,
        email=user.email,
        employee_name=emp_name,
        role=primary_role
    )

@router.post("/set-password", response_model=SetPasswordResponse)
def set_password(data: SetPasswordRequest, db: Session = Depends(get_db)):
    clean_token = data.token.strip().rstrip("/").rstrip(".") if data.token else ""
    if not clean_token or len(clean_token) < 16:
        raise HTTPException(status_code=400, detail="Invalid invitation token.")
    
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    
    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    invitation = db.query(UserInvitation).filter(UserInvitation.token_hash == token_hash).first()
    
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid invitation token.")
    
    if invitation.used_at is not None:
        raise HTTPException(status_code=400, detail="This invitation has already been used.")
    
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invitation link has expired. Please request a new invitation.")
    
    user = db.query(AppUser).filter(AppUser.id == invitation.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    
    # Securely hash password using existing bcrypt implementation
    user.password_hash = get_password_hash(data.password)
    user.is_active = True
    invitation.used_at = datetime.utcnow()
    
    db.commit()
    return SetPasswordResponse(
        success=True,
        message="Your password has been set successfully. You can now sign in with your credentials."
    )

# Admin User Management Endpoints
@user_router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    users = db.query(AppUser).all()
    results = []
    now = datetime.utcnow()
    for u in users:
        emp_name = f"{u.employee.first_name} {u.employee.last_name}" if u.employee else None
        is_pending = False
        if u.invitation and u.invitation.used_at is None and u.invitation.expires_at > now:
            is_pending = True
        
        results.append(UserResponse(
            id=u.id,
            email=u.email,
            employee_id=u.employee_id,
            employee_name=emp_name,
            is_active=u.is_active,
            roles=[r.role for r in u.roles],
            invitation_pending=is_pending
        ))
    return results

@user_router.post("", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    cleaned_email = data.email.strip().lower()
    existing = db.query(AppUser).filter(AppUser.email == cleaned_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already exists")
    
    assigned_roles = data.roles if data.roles else ["employee"]
    is_employee_role = "employee" in assigned_roles

    emp_name = None
    target_employee_id = None

    if data.new_employee:
        ne = data.new_employee
        first_name = (ne.first_name or "").strip()
        last_name = (ne.last_name or "").strip()
        if not first_name:
            raise HTTPException(status_code=400, detail="Employee first name is required")
        if not last_name:
            raise HTTPException(status_code=400, detail="Employee last name is required")

        emp_number = (ne.employee_number or "").strip()
        if not emp_number:
            import random
            while True:
                candidate = f"EMP{random.randint(1000, 99999)}"
                if not db.query(Employee).filter(Employee.employee_number == candidate).first():
                    emp_number = candidate
                    break
        else:
            if db.query(Employee).filter(Employee.employee_number == emp_number).first():
                raise HTTPException(status_code=400, detail=f"Employee number '{emp_number}' already exists")

        if ne.department_id:
            dept = db.query(Department).filter(Department.id == ne.department_id).first()
            if not dept:
                raise HTTPException(status_code=400, detail="Specified department does not exist")

        new_emp = Employee(
            employee_number=emp_number,
            first_name=first_name,
            last_name=last_name,
            email=cleaned_email,
            phone=ne.phone.strip() if ne.phone else None,
            department_id=ne.department_id,
            job_title=ne.job_title.strip() if ne.job_title else None,
            employee_type=ne.employee_type or "full_time",
            status="active"
        )
        db.add(new_emp)
        db.flush()
        target_employee_id = new_emp.id
        emp_name = f"{new_emp.first_name} {new_emp.last_name}"

    elif data.employee_id:
        emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
        if not emp:
            raise HTTPException(status_code=400, detail="Specified employee does not exist")
        if emp.status != "active":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot link user account to inactive or archived employee '{emp.first_name} {emp.last_name}'"
            )

        existing_emp = db.query(AppUser).filter(AppUser.employee_id == data.employee_id).first()
        if existing_emp:
            raise HTTPException(
                status_code=400,
                detail=f"Employee '{emp.first_name} {emp.last_name}' is already linked to user account '{existing_emp.email}'"
            )
        target_employee_id = emp.id
        emp_name = f"{emp.first_name} {emp.last_name}"
    else:
        if is_employee_role:
            raise HTTPException(
                status_code=400,
                detail="Employee accounts must be linked to an Employee record. Please select an existing employee or enter new employee details."
            )

    # Case 1: Manual password provided (backward compatibility)
    if data.password:
        hashed_pwd = get_password_hash(data.password)
        user = AppUser(
            email=cleaned_email,
            password_hash=hashed_pwd,
            employee_id=target_employee_id,
            is_active=data.is_active if data.is_active is not None else True
        )
        db.add(user)
        db.flush()
        
        for r in assigned_roles:
            db.add(UserRole(user_id=user.id, role=r))
        
        db.commit()
        db.refresh(user)
        
        return UserResponse(
            id=user.id,
            email=user.email,
            employee_id=user.employee_id,
            employee_name=emp_name,
            is_active=user.is_active,
            roles=[r.role for r in user.roles],
            invitation_pending=False
        )
    
    # Case 2: Invitation onboarding flow (no password provided by Admin)
    # 1. Create account with unusable placeholder hash and inactive status
    user = AppUser(
        email=cleaned_email,
        password_hash="!INVITATION_PENDING",
        employee_id=target_employee_id,
        is_active=False
    )
    db.add(user)
    db.flush()
    
    for r in assigned_roles:
        db.add(UserRole(user_id=user.id, role=r))
    
    # 2. Generate secure one-time invitation token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=settings.INVITATION_EXPIRE_HOURS)
    
    invitation = UserInvitation(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=datetime.utcnow()
    )
    db.add(invitation)
    db.commit()
    db.refresh(user)
    
    # 3. Dispatch invitation email via Resend
    invite_url = f"{settings.FRONTEND_URL}/set-password?token={raw_token}"
    primary_role = assigned_roles[0]
    email_sent, email_msg = send_invitation_email(
        to_email=user.email,
        invite_url=invite_url,
        role=primary_role,
        employee_name=emp_name,
        expires_in_hours=settings.INVITATION_EXPIRE_HOURS
    )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        employee_name=emp_name,
        is_active=user.is_active,
        roles=[r.role for r in user.roles],
        invitation_pending=True,
        invitation_link=invite_url,
        email_sent=email_sent,
        email_error=email_msg if not email_sent else None
    )

@user_router.post("/{user_id}/resend-invitation", response_model=ResendInvitationResponse)
def resend_invitation(
    user_id: str,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already set their password and is active
    if user.is_active and user.password_hash != "!INVITATION_PENDING":
        raise HTTPException(
            status_code=400,
            detail="User account is already active with a set password. Resending invitation is not applicable."
        )
    
    # Remove existing invitation if present
    existing_inv = db.query(UserInvitation).filter(UserInvitation.user_id == user.id).first()
    if existing_inv:
        db.delete(existing_inv)
        db.flush()
    
    # Generate new token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=settings.INVITATION_EXPIRE_HOURS)
    
    new_inv = UserInvitation(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=datetime.utcnow()
    )
    db.add(new_inv)
    db.commit()
    
    emp_name = f"{user.employee.first_name} {user.employee.last_name}" if user.employee else None
    primary_role = user.roles[0].role if user.roles else "employee"
    invite_url = f"{settings.FRONTEND_URL}/set-password?token={raw_token}"
    
    email_sent, email_msg = send_invitation_email(
        to_email=user.email,
        invite_url=invite_url,
        role=primary_role,
        employee_name=emp_name,
        expires_in_hours=settings.INVITATION_EXPIRE_HOURS
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=email_msg
        )
    
    return ResendInvitationResponse(
        success=True,
        message=f"Invitation email successfully sent to {user.email} ({email_msg})",
        invitation_link=invite_url
    )

@user_router.patch("/{user_id}/status", response_model=UserResponse)
def toggle_user_status(
    user_id: str,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    emp_name = f"{user.employee.first_name} {user.employee.last_name}" if user.employee else None
    
    is_pending = False
    now = datetime.utcnow()
    if user.invitation and user.invitation.used_at is None and user.invitation.expires_at > now:
        is_pending = True

    return UserResponse(
        id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        employee_name=emp_name,
        is_active=user.is_active,
        roles=[r.role for r in user.roles],
        invitation_pending=is_pending
    )

@user_router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_roles(["admin"]))
):
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account while logged in."
        )
    
    # Delete user (cascade="all, delete-orphan" removes associated invitation and roles cleanly)
    user_email = user.email
    db.delete(user)
    db.commit()
    return {"success": True, "message": f"User {user_email} successfully deleted"}

@user_router.patch("/{user_id}/link-employee", response_model=UserResponse)
def link_user_to_employee(
    user_id: str,
    data: UserLinkEmployee,
    db: Session = Depends(get_db),
    _: TokenData = Depends(require_roles(["admin"]))
):
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=400, detail="Specified employee does not exist")
    if emp.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot link user to inactive employee '{emp.first_name} {emp.last_name}'"
        )
    
    existing = db.query(AppUser).filter(AppUser.employee_id == data.employee_id, AppUser.id != user_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Employee '{emp.first_name} {emp.last_name}' is already linked to user account '{existing.email}'"
        )
    
    user.employee_id = emp.id
    db.commit()
    db.refresh(user)
    
    is_pending = False
    now = datetime.utcnow()
    if user.invitation and user.invitation.used_at is None and user.invitation.expires_at > now:
        is_pending = True

    return UserResponse(
        id=user.id,
        email=user.email,
        employee_id=user.employee_id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        is_active=user.is_active,
        roles=[r.role for r in user.roles],
        invitation_pending=is_pending
    )


