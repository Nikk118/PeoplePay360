from typing import List, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.jwt import decode_access_token, TokenData
from app.models.models import AppUser, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = decode_access_token(token)
    if token_data is None:
        raise credentials_exception
    
    user = db.query(AppUser).filter(AppUser.id == token_data.user_id, AppUser.is_active == True).first()
    if not user:
        raise credentials_exception
    
    return token_data

def require_roles(allowed_roles: List[str]):
    def role_checker(current_user: TokenData = Depends(get_current_user)) -> TokenData:
        # Admin role has full access across all endpoints
        if "admin" in current_user.roles:
            return current_user
        
        # Check if user has at least one of allowed roles
        has_role = any(role in current_user.roles for role in allowed_roles)
        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {allowed_roles}"
            )
        return current_user
    return role_checker
