from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_faculty_or_admin
from app.core.rate_limiter import rate_limit_attendance
from app.models.user import User
from app.schemas.attendance import (
    AttendanceMarkRequest,
    AttendanceMarkResponse,
    AttendanceRecordResponse,
    ManualAttendanceRequest
)
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])

@router.post("/mark", response_model=AttendanceMarkResponse, dependencies=[Depends(rate_limit_attendance)])
async def mark_attendance(
    payload: AttendanceMarkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Real-time Face Recognition + Anti-Spoofing attendance marking.
    - Validates session is ACTIVE.
    - Validates single-use liveness receipt token (rejects photos / replays).
    - Runs scoped 128-d cosine similarity face recognition.
    - Checks duplicate attendance (409 Conflict if already marked).
    - Determines PRESENT vs LATE based on late cutoff minutes.
    - Stores immutable audit trail.
    """
    return await AttendanceService.mark_attendance_via_face(db, payload, current_user)

@router.post("/manual-mark", response_model=AttendanceRecordResponse)
async def manual_mark_attendance(
    payload: ManualAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Faculty or Administrator manual attendance override.
    Requires role FACULTY or ADMIN, and mandatory reason remarks.
    """
    return await AttendanceService.manual_mark_attendance(db, payload, current_user)
