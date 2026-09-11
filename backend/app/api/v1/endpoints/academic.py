from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_faculty_or_admin
from app.models.user import User
from app.models.academic import Department, Course, Subject
from app.schemas.student import DepartmentOption, CourseOption, SubjectOption

router = APIRouter(prefix="/academic", tags=["Academic"])

@router.get("/departments", response_model=List[DepartmentOption])
async def get_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()

@router.get("/courses", response_model=List[CourseOption])
async def get_courses(
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    stmt = select(Course)
    if department_id is not None:
        stmt = stmt.where(Course.department_id == department_id)
    stmt = stmt.order_by(Course.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/subjects", response_model=List[SubjectOption])
async def get_subjects(
    course_id: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    stmt = select(Subject)
    if course_id is not None:
        stmt = stmt.where(Subject.course_id == course_id)
    if semester is not None:
        stmt = stmt.where(Subject.semester == semester)
    stmt = stmt.order_by(Subject.name)
    result = await db.execute(stmt)
    return result.scalars().all()

