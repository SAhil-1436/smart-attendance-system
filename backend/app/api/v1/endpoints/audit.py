from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_admin_user
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogListResponse, AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit & Compliance"])

@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None, description="Filter by action (e.g., USER_LOGIN, FACE_ENROLL, ATTENDANCE_MARK)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g., User, Student, AttendanceRecord)"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Administrator-only inspection of security, authentication, and biometric audit logs.
    Biometric vectors are strictly excluded from audit payloads.
    """
    query = select(AuditLog).options(selectinload(AuditLog.user))
    count_query = select(func.count(AuditLog.id))

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)

    # Count total
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Paginate and order by newest first
    offset = (page - 1) * limit
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    res = await db.execute(query)
    records = res.scalars().all()

    # Load users for username display
    items = []
    for rec in records:
        uname = rec.user.username if rec.user else None
        items.append(AuditLogResponse(
            id=rec.id,
            user_id=rec.user_id,
            username=uname,
            action=rec.action,
            entity_type=rec.entity_type,
            entity_id=rec.entity_id,
            ip_address=rec.ip_address,
            details_json=rec.details_json,
            created_at=rec.created_at
        ))

    return AuditLogListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items
    )
