from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date, datetime

class ReportFilterParams(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    subject_id: Optional[int] = None
    course_id: Optional[int] = None
    department_id: Optional[int] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    student_id: Optional[int] = None
    status: Optional[str] = None

class ReportRecordItem(BaseModel):
    id: int
    session_code: str
    session_date: date
    subject_code: str
    subject_name: str
    course_name: str
    semester: int
    section: str
    student_id: int
    roll_number: str
    student_name: str
    department_name: str
    marked_at: datetime
    status: str
    verification_method: str
    confidence_score: Optional[float] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StudentAttendanceSummary(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    department_name: str
    course_name: str
    semester: int
    section: str
    total_sessions: int
    present_count: int
    late_count: int
    attendance_percentage: float
    status_warning: bool  # True if < 75%

class AttendanceReportResponse(BaseModel):
    total_records: int
    total_sessions: int
    unique_students: int
    average_attendance_percentage: float
    records: List[ReportRecordItem]
    student_summaries: List[StudentAttendanceSummary]
