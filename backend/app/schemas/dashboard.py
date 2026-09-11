from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, date

class DashboardKPIs(BaseModel):
    total_students: int
    face_registered_students: int
    face_registration_rate: float
    total_departments: int
    total_courses: int
    active_sessions_count: int
    today_sessions_count: int
    today_records_count: int
    today_present_count: int
    today_late_count: int
    today_attendance_rate: float
    low_attendance_students_count: int

class DailyTrendItem(BaseModel):
    date: str
    day_name: str
    present_count: int
    late_count: int
    total_marked: int

class DepartmentAttendanceItem(BaseModel):
    department_id: int
    department_name: str
    department_code: str
    total_students: int
    attendance_percentage: float

class StatusDistributionItem(BaseModel):
    status: str
    count: int
    percentage: float

class RecentActivityItem(BaseModel):
    record_id: int
    student_name: str
    roll_number: str
    subject_name: str
    subject_code: str
    status: str
    verification_method: str
    confidence_score: Optional[float] = None
    marked_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LowAttendanceStudentItem(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    department_name: str
    course_name: str
    semester: int
    section: str
    total_sessions: int
    attended_sessions: int
    attendance_percentage: float

class DashboardDataResponse(BaseModel):
    kpis: DashboardKPIs
    daily_trends: List[DailyTrendItem]
    department_attendance: List[DepartmentAttendanceItem]
    status_distribution: List[StatusDistributionItem]
    recent_activity: List[RecentActivityItem]
    low_attendance_alerts: List[LowAttendanceStudentItem]
