from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardDataResponse, LowAttendanceStudentItem
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])

@router.get("/summary", response_model=DashboardDataResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns aggregate college KPI metrics, daily attendance trends,
    department comparisons, status distribution, and low attendance alerts.
    """
    return await DashboardService.get_dashboard_summary(db)

@router.get("/low-attendance", response_model=List[LowAttendanceStudentItem])
async def get_low_attendance_students(
    threshold: float = Query(75.0, ge=0.0, le=100.0, description="Attendance percentage alert threshold"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a sorted list of students whose attendance percentage is below the specified threshold.
    """
    return await DashboardService.get_low_attendance_students(db, threshold)
