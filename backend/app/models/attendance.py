from sqlalchemy import Column, Integer, String, Boolean, Float, Date, Time, DateTime, ForeignKey, UniqueConstraint, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_code = Column(String(50), unique=True, index=True, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="RESTRICT"), nullable=False, index=True)
    semester = Column(Integer, nullable=False, index=True)
    section = Column(String(10), nullable=False, index=True)
    session_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=True)
    status = Column(String(20), nullable=False, default="SCHEDULED", index=True)  # SCHEDULED, ACTIVE, COMPLETED, CANCELLED
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    subject = relationship("Subject", back_populates="attendance_sessions")
    faculty = relationship("FacultyProfile", back_populates="attendance_sessions")
    course = relationship("Course", back_populates="attendance_sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_session_filter", "subject_id", "faculty_id", "session_date", "status"),
        Index("ix_session_status_date", "status", "session_date"),
    )

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    marked_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="PRESENT", index=True)  # PRESENT, LATE, ABSENT, MANUALLY_MARKED
    confidence_score = Column(Float, nullable=True)
    verification_method = Column(String(30), nullable=False, default="FACE_LIVENESS")  # FACE_LIVENESS, MANUAL
    liveness_verified = Column(Boolean, default=False, nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")

    __table_args__ = (
        # STRICT RULE: Prevent duplicate attendance for the same student in the same session
        UniqueConstraint("session_id", "student_id", name="uq_session_student_attendance"),
        Index("ix_attendance_query", "session_id", "student_id", "status"),
        Index("ix_attendance_student_marked", "student_id", "marked_at"),
        Index("ix_attendance_status_marked", "status", "marked_at"),
    )
