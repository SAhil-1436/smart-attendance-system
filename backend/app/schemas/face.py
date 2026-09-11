from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class FaceValidationRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded JPEG/PNG image data")

class FaceValidationResponse(BaseModel):
    valid: bool
    face_detected: bool
    num_faces: int
    bbox: Optional[List[int]] = None
    confidence: float = 0.0
    quality_score: float = 0.0
    sharpness: float = 0.0
    brightness: float = 0.0
    message: str

class FaceEnrollRequest(BaseModel):
    images: List[str] = Field(..., min_length=3, max_length=5, description="List of 3 to 5 base64 face samples")

class FaceEnrollResponse(BaseModel):
    success: bool
    student_id: int
    student_name: str
    samples_registered: int
    average_quality: float
    message: str

class FaceStatusResponse(BaseModel):
    student_id: int
    face_registered: bool
    sample_count: int
    average_quality: float
    registered_at: Optional[datetime] = None
