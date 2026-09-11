from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class DepartmentOption(BaseModel):
    id: int
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class CourseOption(BaseModel):
    id: int
    department_id: int
    code: str
    name: str
    semester_count: int

    model_config = ConfigDict(from_attributes=True)

class SubjectOption(BaseModel):
    id: int
    course_id: int
    code: str
    name: str
    semester: int

    model_config = ConfigDict(from_attributes=True)


class StudentBase(BaseModel):
    student_id: str = Field(..., min_length=2, max_length=50, description="Roll Number / Registration Number")
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    department_id: int
    course_id: int
    semester: int = Field(..., ge=1, le=12)
    section: str = Field(default="A", max_length=10)

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    course_id: Optional[int] = None
    semester: Optional[int] = Field(None, ge=1, le=12)
    section: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None

class StudentResponse(StudentBase):
    id: int
    face_registered: bool
    is_active: bool
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StudentListResponse(BaseModel):
    items: List[StudentResponse]
    total: int
    page: int
    size: int
    total_pages: int
