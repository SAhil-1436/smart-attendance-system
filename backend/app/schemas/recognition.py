from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List

class RecognizeRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded JPEG/PNG frame")
    course_id: Optional[int] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional custom similarity threshold")

class RecognizedStudentInfo(BaseModel):
    id: int
    student_id: str
    name: str
    email: str
    department_name: Optional[str] = None
    course_name: Optional[str] = None
    semester: int
    section: str

    model_config = ConfigDict(from_attributes=True)

class RecognizeResponse(BaseModel):
    face_detected: bool
    num_faces: int
    is_recognized: bool
    bbox: Optional[List[int]] = None
    similarity_score: float
    threshold_used: float
    confidence_level: Optional[str] = None  # HIGH, MEDIUM, LOW
    student: Optional[RecognizedStudentInfo] = None
    message: str
