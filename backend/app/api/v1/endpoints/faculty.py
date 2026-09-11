from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_admin_user, get_faculty_or_admin
from app.models.user import User
from app.schemas.faculty import FacultyCreate, FacultyResponse
from app.services.faculty_service import FacultyService

router = APIRouter(prefix="/faculty", tags=["Faculty Management"])

@router.post("", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def register_faculty(
    payload: FacultyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Admin-only endpoint to register a new college faculty member.
    Creates credentials (username & password) and provisions faculty academic profile.
    """
    client_ip = request.client.host if request.client else "unknown"
    return await FacultyService.create_faculty(
        db=db,
        faculty_in=payload,
        admin_user=admin_user,
        client_ip=client_ip
    )

@router.get("", response_model=List[FacultyResponse])
@router.get("/", response_model=List[FacultyResponse], include_in_schema=False)
async def list_faculty(
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    search: Optional[str] = Query(None, description="Search by name, username, email, or employee ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    List all registered faculty members with academic assignments and user details.
    """
    return await FacultyService.list_faculty(
        db=db,
        department_id=department_id,
        search=search
    )

@router.patch("/{faculty_id}/status", response_model=FacultyResponse)
async def toggle_faculty_status(
    faculty_id: int,
    is_active: bool = Query(..., description="Active status boolean"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Admin-only endpoint to toggle faculty account active status.
    """
    client_ip = request.client.host if request and request.client else "unknown"
    return await FacultyService.toggle_faculty_status(
        db=db,
        faculty_id=faculty_id,
        is_active=is_active,
        admin_user=admin_user,
        client_ip=client_ip
    )

@router.delete("/{faculty_id}")
async def delete_faculty(
    faculty_id: int,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Admin-only endpoint to remove a faculty member and associated credentials.
    """
    client_ip = request.client.host if request and request.client else "unknown"
    return await FacultyService.delete_faculty(
        db=db,
        faculty_id=faculty_id,
        admin_user=admin_user,
        client_ip=client_ip
    )
