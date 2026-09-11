from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_faculty_or_admin
from app.models.user import User
from app.schemas.recognition import RecognizeRequest, RecognizeResponse
from app.services.recognition_service import RecognitionService

router = APIRouter(prefix="/attendance", tags=["Attendance & Recognition"])

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_student_face(
    payload: RecognizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Performs face detection, 128-d embedding extraction, cosine similarity search
    against registered students, and configurable threshold verification.
    """
    return await RecognitionService.recognize_face(db, payload)
