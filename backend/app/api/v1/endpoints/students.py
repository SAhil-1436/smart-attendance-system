from fastapi import APIRouter, Depends, Query, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_faculty_or_admin
from app.models.user import User
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentListResponse
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["Students"])

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    student_in: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    return await StudentService.create_student(db, student_in, current_user)

@router.get("", response_model=StudentListResponse)
async def list_students(
    search: Optional[str] = Query(None, description="Search by name, roll number, or email"),
    department_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=12),
    section: Optional[str] = Query(None),
    face_registered: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    return await StudentService.list_students(
        db=db,
        search=search,
        department_id=department_id,
        course_id=course_id,
        semester=semester,
        section=section,
        face_registered=face_registered,
        is_active=is_active,
        page=page,
        size=size
    )

@router.get("/{id}", response_model=StudentResponse)
async def get_student(
    id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    return await StudentService.get_student_by_id(db, id)

@router.put("/{id}", response_model=StudentResponse)
async def update_student(
    id: int = Path(..., ge=1),
    student_in: StudentUpdate = ...,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    return await StudentService.update_student(db, id, student_in, current_user)

@router.delete("/{id}")
async def delete_student(
    id: int = Path(..., ge=1),
    hard_delete: bool = Query(False, description="If true, permanently removes record; else deactivates."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    return await StudentService.delete_or_deactivate_student(db, id, hard_delete, current_user)
