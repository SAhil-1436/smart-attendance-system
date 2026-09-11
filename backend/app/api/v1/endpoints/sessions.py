from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_faculty_or_admin
from app.models.user import User
from app.schemas.attendance import SessionCreate, SessionResponse, AttendanceRecordResponse
from app.services.attendance_service import AttendanceService

router = APIRouter(prefix="/sessions", tags=["Attendance Sessions"])

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """Creates a new attendance session for a class lecture/lab."""
    return await AttendanceService.create_session(db, payload, current_user)

@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    subject_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    faculty_id: Optional[int] = Query(None),
    date_filter: Optional[date] = Query(None, alias="date"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists attendance sessions with optional filters."""
    return await AttendanceService.list_sessions(
        db, current_user, subject_id, faculty_id, course_id, date_filter, status_filter
    )

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gets details for a specific attendance session."""
    return await AttendanceService.get_session_by_id(db, session_id)

@router.patch("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """Activates an attendance session for live marking."""
    return await AttendanceService.update_session_status(db, session_id, "ACTIVE", current_user)

@router.patch("/{session_id}/stop", response_model=SessionResponse)
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """Completes and closes an attendance session."""
    return await AttendanceService.update_session_status(db, session_id, "COMPLETED", current_user)

@router.get("/{session_id}/records", response_model=List[AttendanceRecordResponse])
async def get_session_records(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all attendance records marked for the given session."""
    return await AttendanceService.get_session_records(db, session_id)
