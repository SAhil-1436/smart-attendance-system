from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import timedelta
import json

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.dependencies import get_current_user, get_admin_user, get_faculty_or_admin
from app.core.rate_limiter import rate_limit_auth
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, ChangePasswordRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Lookup by username or email
    stmt = select(User).where(
        or_(User.username == payload.username, User.email == payload.username)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact administrator."
        )

    # Log login event in audit log
    client_ip = request.client.host if request.client else "unknown"
    audit_entry = AuditLog(
        user_id=user.id,
        action="USER_LOGIN",
        entity_type="User",
        entity_id=str(user.id),
        ip_address=client_ip,
        details_json=json.dumps({"role": user.role, "username": user.username})
    )
    db.add(audit_entry)
    await db.commit()

    token = create_access_token(
        subject=user.id,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="USER_LOGOUT",
        entity_type="User",
        entity_id=str(current_user.id),
        ip_address=client_ip,
        details_json=json.dumps({"username": current_user.username})
    )
    db.add(audit_entry)
    await db.commit()
    return {"message": "Successfully logged out"}

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long"
        )
    
    current_user.password_hash = get_password_hash(payload.new_password)
    client_ip = request.client.host if request.client else "unknown"
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="PASSWORD_CHANGED",
        entity_type="User",
        entity_id=str(current_user.id),
        ip_address=client_ip,
        details_json=json.dumps({"username": current_user.username, "role": current_user.role})
    )
    db.add(current_user)
    db.add(audit_entry)
    await db.commit()
    return {"message": "Password updated successfully"}

# Gated test routes for authorization testing
@router.get("/test-admin-only")
async def test_admin_route(current_user: User = Depends(get_admin_user)):
    return {"message": f"Welcome Admin {current_user.full_name}", "role": current_user.role}

@router.get("/test-faculty-or-admin")
async def test_faculty_route(current_user: User = Depends(get_faculty_or_admin)):
    return {"message": f"Welcome {current_user.full_name}", "role": current_user.role}
