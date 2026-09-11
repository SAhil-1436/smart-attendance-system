from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_faculty_or_admin, get_admin_user
from app.core.rate_limiter import rate_limit_enroll
from app.models.user import User
from app.schemas.face import (
    FaceValidationRequest, 
    FaceValidationResponse,
    FaceEnrollRequest,
    FaceEnrollResponse,
    FaceStatusResponse
)
from app.services.face_service import FaceService

router = APIRouter(tags=["Face Registration & Recognition"])

@router.post("/face/validate-frame", response_model=FaceValidationResponse)
async def validate_frame(
    payload: FaceValidationRequest,
    current_user: User = Depends(get_faculty_or_admin)
):
    """Validates real-time webcam frame for single face, sharpness, lighting and dimensions."""
    return FaceService.validate_frame(payload.image_data)

@router.post("/students/{id}/face-enroll", response_model=FaceEnrollResponse, dependencies=[Depends(rate_limit_enroll)])
async def enroll_student_faces(
    payload: FaceEnrollRequest,
    id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """Captures 3-5 face samples, validates quality and consistency, and stores 128-d embeddings."""
    return await FaceService.enroll_student_faces(db, id, payload, current_user)

@router.get("/students/{id}/face-status", response_model=FaceStatusResponse)
async def get_student_face_status(
    id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """Returns registration status, sample count, and average quality score without exposing biometric vectors."""
    return await FaceService.get_student_face_status(db, id)

@router.delete("/students/{id}/face-embeddings")
async def delete_student_face_embeddings(
    id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Removes stored face embeddings and resets student face registration status."""
    return await FaceService.reset_student_face(db, id, current_user)
