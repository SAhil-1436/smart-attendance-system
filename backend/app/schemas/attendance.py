from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, time, datetime

class SessionCreate(BaseModel):
    subject_id: int
    course_id: int
    semester: int = Field(..., ge=1, le=12)
    section: str = Field(..., max_length=10)
    faculty_id: Optional[int] = None
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None


class SessionResponse(BaseModel):
    id: int
    session_code: str
    subject_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    faculty_id: int
    faculty_name: Optional[str] = None
    course_id: int
    course_name: Optional[str] = None
    semester: int
    section: str
    session_date: date
    start_time: time
    end_time: Optional[time] = None
    status: str
    present_count: int = 0
    late_count: int = 0
    total_marked: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AttendanceMarkRequest(BaseModel):
    session_id: int
    image_data: str = Field(..., description="Base64 encoded webcam image frame")
    liveness_receipt_token: Optional[str] = Field(None, description="Cryptographic single-use receipt from liveness challenge")

class AttendanceMarkResponse(BaseModel):
    success: bool
    record_id: int
    session_id: int
    student_id: int
    student_name: str
    roll_number: str
    status: str  # PRESENT, LATE
    confidence_score: float
    verification_method: str
    liveness_verified: bool
    marked_at: datetime
    message: str

class AttendanceRecordResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    marked_at: datetime
    status: str
    confidence_score: Optional[float] = None
    verification_method: str
    liveness_verified: bool
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ManualAttendanceRequest(BaseModel):
    session_id: int
    student_id: int
    status: str = Field(..., description="PRESENT, LATE, ABSENT, MANUALLY_MARKED")
    remarks: str = Field(..., min_length=3, description="Mandatory remarks for manual override")
