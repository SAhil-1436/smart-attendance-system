from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, List
from datetime import datetime

class FacultyCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username for login")
    email: EmailStr = Field(..., description="Institutional email address")
    password: str = Field(..., min_length=6, max_length=100, description="Login password")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full legal name")
    department_id: int = Field(..., description="Department ID assignment")
    employee_id: str = Field(..., min_length=2, max_length=50, description="Unique faculty employee ID")
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    designation: Optional[str] = Field("Assistant Professor", max_length=100, description="Academic designation")

class FacultyUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department_id: Optional[int] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    is_active: Optional[bool] = None

class FacultyResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    full_name: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    employee_id: str
    phone: Optional[str] = None
    designation: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FacultyListResponse(BaseModel):
    total: int
    faculty: List[FacultyResponse]
