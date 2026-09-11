from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime, date, time, timezone, timedelta
from typing import Optional, List, Tuple
import uuid
import json
import logging

from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.student import Student
from app.models.academic import Subject, Course
from app.models.faculty import FacultyProfile
from app.models.audit import AuditLog
from app.models.setting import SystemSetting
from app.models.user import User
from app.schemas.attendance import (
    SessionCreate,
    SessionResponse,
    AttendanceMarkRequest,
    AttendanceMarkResponse,
    AttendanceRecordResponse,
    ManualAttendanceRequest
)
from app.schemas.recognition import RecognizeRequest
from app.services.recognition_service import RecognitionService
from app.cv.liveness import liveness_engine

logger = logging.getLogger("smart_attendance.attendance_service")

class AttendanceService:

    @staticmethod
    def _to_session_response(session: AttendanceSession) -> SessionResponse:
        records = session.records or []
        present_count = sum(1 for r in records if r.status == "PRESENT")
        late_count = sum(1 for r in records if r.status == "LATE")
        total_marked = len(records)

        faculty_name = None
        if session.faculty and session.faculty.user:
            faculty_name = session.faculty.user.full_name

        return SessionResponse(
            id=session.id,
            session_code=session.session_code,
            subject_id=session.subject_id,
            subject_name=session.subject.name if session.subject else None,
            subject_code=session.subject.code if session.subject else None,
            faculty_id=session.faculty_id,
            faculty_name=faculty_name,
            course_id=session.course_id,
            course_name=session.course.name if session.course else None,
            semester=session.semester,
            section=session.section,
            session_date=session.session_date,
            start_time=session.start_time,
            end_time=session.end_time,
            status=session.status,
            present_count=present_count,
            late_count=late_count,
            total_marked=total_marked,
            created_at=session.created_at
        )

    @staticmethod
    async def create_session(
        db: AsyncSession,
        session_in: SessionCreate,
        current_user: User
    ) -> SessionResponse:
        # 1. Resolve Faculty ID
        faculty_id = session_in.faculty_id
        if current_user.role == "FACULTY":
            fac_stmt = select(FacultyProfile).where(FacultyProfile.user_id == current_user.id)
            fac_res = await db.execute(fac_stmt)
            fac_profile = fac_res.scalar_one_or_none()
            if not fac_profile:
                # Create profile on the fly if missing for existing faculty user
                fac_profile = FacultyProfile(
                    user_id=current_user.id,
                    employee_id=f"FAC-{current_user.id:04d}",
                    designation="Faculty"
                )
                db.add(fac_profile)
                await db.flush()
            faculty_id = fac_profile.id
        elif current_user.role == "ADMIN":
            if not faculty_id:
                # Pick first faculty profile in system or create default
                fac_stmt = select(FacultyProfile)
                fac_res = await db.execute(fac_stmt)
                fac_profile = fac_res.scalars().first()
                if not fac_profile:
                    fac_profile = FacultyProfile(
                        user_id=current_user.id,
                        employee_id="ADM-FAC-01",
                        designation="Administrator / Faculty"
                    )
                    db.add(fac_profile)
                    await db.flush()
                faculty_id = fac_profile.id

        # 2. Verify Subject and Course existence
        subj_stmt = select(Subject).where(Subject.id == session_in.subject_id)
        subj_res = await db.execute(subj_stmt)
        subject = subj_res.scalar_one_or_none()
        if not subject:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

        course_stmt = select(Course).where(Course.id == session_in.course_id)
        course_res = await db.execute(course_stmt)
        course = course_res.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

        # 3. Generate unique session code
        today = date.today()
        now_time = datetime.now().time()
        rand_suffix = uuid.uuid4().hex[:6].upper()
        session_code = f"SESS-{today.strftime('%Y%m%d')}-{rand_suffix}"

        # 4. Construct AttendanceSession model
        session = AttendanceSession(
            session_code=session_code,
            subject_id=session_in.subject_id,
            faculty_id=faculty_id,
            course_id=session_in.course_id,
            semester=session_in.semester,
            section=session_in.section.upper(),
            session_date=session_in.session_date or today,
            start_time=session_in.start_time or now_time,
            end_time=session_in.end_time,
            status="ACTIVE"  # Starts active so kiosk can immediately mark
        )
        db.add(session)
        await db.flush()

        # 5. Audit Log
        audit = AuditLog(
            user_id=current_user.id,
            action="SESSION_CREATE",
            entity_type="AttendanceSession",
            entity_id=str(session.id),
            details_json=json.dumps({
                "session_code": session_code,
                "subject": subject.name,
                "section": session.section,
                "semester": session.semester
            })
        )
        db.add(audit)
        await db.commit()

        return await AttendanceService.get_session_by_id(db, session.id)

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        current_user: User,
        subject_id: Optional[int] = None,
        faculty_id: Optional[int] = None,
        course_id: Optional[int] = None,
        date_filter: Optional[date] = None,
        status_filter: Optional[str] = None
    ) -> List[SessionResponse]:
        query = (
            select(AttendanceSession)
            .options(
                selectinload(AttendanceSession.subject),
                selectinload(AttendanceSession.faculty).selectinload(FacultyProfile.user),
                selectinload(AttendanceSession.course),
                selectinload(AttendanceSession.records)
            )
            .order_by(AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc())
        )

        conditions = []
        if subject_id:
            conditions.append(AttendanceSession.subject_id == subject_id)
        if course_id:
            conditions.append(AttendanceSession.course_id == course_id)
        if faculty_id:
            conditions.append(AttendanceSession.faculty_id == faculty_id)
        elif current_user.role == "FACULTY":
            # Show this faculty's sessions by default
            fac_stmt = select(FacultyProfile).where(FacultyProfile.user_id == current_user.id)
            fac_res = await db.execute(fac_stmt)
            fac_profile = fac_res.scalar_one_or_none()
            if fac_profile:
                conditions.append(AttendanceSession.faculty_id == fac_profile.id)

        if date_filter:
            conditions.append(AttendanceSession.session_date == date_filter)
        if status_filter:
            conditions.append(AttendanceSession.status == status_filter.upper())

        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query)
        sessions = result.scalars().all()
        return [AttendanceService._to_session_response(s) for s in sessions]

    @staticmethod
    async def get_session_by_id(db: AsyncSession, session_id: int) -> SessionResponse:
        query = (
            select(AttendanceSession)
            .options(
                selectinload(AttendanceSession.subject),
                selectinload(AttendanceSession.faculty).selectinload(FacultyProfile.user),
                selectinload(AttendanceSession.course),
                selectinload(AttendanceSession.records).selectinload(AttendanceRecord.student)
            )
            .where(AttendanceSession.id == session_id)
        )
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")
        return AttendanceService._to_session_response(session)

    @staticmethod
    async def update_session_status(
        db: AsyncSession,
        session_id: int,
        new_status: str,
        current_user: User
    ) -> SessionResponse:
        stmt = (
            select(AttendanceSession)
            .options(
                selectinload(AttendanceSession.subject),
                selectinload(AttendanceSession.faculty).selectinload(FacultyProfile.user),
                selectinload(AttendanceSession.course),
                selectinload(AttendanceSession.records)
            )
            .where(AttendanceSession.id == session_id)
        )
        res = await db.execute(stmt)
        session = res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")

        session.status = new_status.upper()
        if session.status == "COMPLETED" and not session.end_time:
            session.end_time = datetime.now().time()

        audit = AuditLog(
            user_id=current_user.id,
            action=f"SESSION_STATUS_{session.status}",
            entity_type="AttendanceSession",
            entity_id=str(session.id),
            details_json=json.dumps({"new_status": session.status})
        )
        db.add(audit)
        await db.commit()
        return AttendanceService._to_session_response(session)

    @staticmethod
    async def mark_attendance_via_face(
        db: AsyncSession,
        payload: AttendanceMarkRequest,
        current_user: User
    ) -> AttendanceMarkResponse:
        # 1. Fetch and validate session
        sess_stmt = (
            select(AttendanceSession)
            .options(
                selectinload(AttendanceSession.subject),
                selectinload(AttendanceSession.course)
            )
            .where(AttendanceSession.id == payload.session_id)
        )
        res = await db.execute(sess_stmt)
        session = res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")

        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attendance session is {session.status}. Only ACTIVE sessions can accept attendance."
            )

        # 2. Check Anti-Spoofing / Liveness
        setting_stmt = select(SystemSetting).where(SystemSetting.key == "liveness_strictness")
        setting_res = await db.execute(setting_stmt)
        liveness_setting = setting_res.scalar_one_or_none()
        liveness_strictness = liveness_setting.value if liveness_setting else "NORMAL"

        liveness_verified = False
        if payload.liveness_receipt_token:
            is_valid_receipt = liveness_engine.validate_receipt(payload.liveness_receipt_token)
            if not is_valid_receipt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired anti-spoofing token. Please perform the live challenge again."
                )
            liveness_verified = True
        else:
            if liveness_strictness != "DISABLED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Anti-spoofing verification required. Please complete the live challenge first."
                )

        # 3. Perform Biometric Recognition scoped to this class
        rec_request = RecognizeRequest(
            image_data=payload.image_data,
            course_id=session.course_id,
            semester=session.semester,
            section=session.section
        )
        rec_result = await RecognitionService.recognize_face(db, rec_request)

        if not rec_result.is_recognized or not rec_result.student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=rec_result.message or "Student face not recognized or match confidence too low."
            )

        student_id = rec_result.student.id

        # 4. Duplicate Check (CRITICAL: Fast-fail before write)
        dup_stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.student_id == student_id
            )
        )
        dup_res = await db.execute(dup_stmt)
        existing_record = dup_res.scalar_one_or_none()
        if existing_record:
            marked_time_str = existing_record.marked_at.strftime("%H:%M:%S") if existing_record.marked_at else "earlier"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate attendance! {rec_result.student.name} ({rec_result.student.student_id}) has already been marked at {marked_time_str}."
            )

        # 5. Determine Late vs Present
        late_setting_stmt = select(SystemSetting).where(SystemSetting.key == "late_cutoff_minutes")
        late_setting_res = await db.execute(late_setting_stmt)
        late_setting = late_setting_res.scalar_one_or_none()
        late_cutoff_min = int(late_setting.value) if late_setting and late_setting.value.isdigit() else 15

        now = datetime.now()
        session_start_dt = datetime.combine(session.session_date, session.start_time)
        diff_minutes = (now - session_start_dt).total_seconds() / 60.0

        attendance_status = "LATE" if diff_minutes > late_cutoff_min else "PRESENT"

        # 6. Insert AttendanceRecord with Integrity Protection
        record = AttendanceRecord(
            session_id=session.id,
            student_id=student_id,
            status=attendance_status,
            confidence_score=rec_result.similarity_score,
            verification_method="FACE_LIVENESS",
            liveness_verified=liveness_verified
        )
        db.add(record)

        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate attendance detected! {rec_result.student.name} is already marked for this session."
            )

        # 7. Audit Log
        audit = AuditLog(
            user_id=current_user.id,
            action="ATTENDANCE_MARKED",
            entity_type="AttendanceRecord",
            entity_id=str(record.id),
            details_json=json.dumps({
                "session_id": session.id,
                "student_id": student_id,
                "student_code": rec_result.student.student_id,
                "status": attendance_status,
                "confidence": rec_result.similarity_score,
                "liveness": liveness_verified
            })
        )
        db.add(audit)
        await db.commit()
        await db.refresh(record)

        return AttendanceMarkResponse(
            success=True,
            record_id=record.id,
            session_id=session.id,
            student_id=student_id,
            student_name=rec_result.student.name,
            roll_number=rec_result.student.student_id,
            status=attendance_status,
            confidence_score=rec_result.similarity_score,
            verification_method="FACE_LIVENESS",
            liveness_verified=liveness_verified,
            marked_at=record.marked_at,
            message=f"Attendance recorded for {rec_result.student.name} as {attendance_status} ({rec_result.similarity_score*100:.1f}% confidence)."
        )

    @staticmethod
    async def manual_mark_attendance(
        db: AsyncSession,
        payload: ManualAttendanceRequest,
        current_user: User
    ) -> AttendanceRecordResponse:
        # Verify session
        sess_stmt = select(AttendanceSession).where(AttendanceSession.id == payload.session_id)
        sess_res = await db.execute(sess_stmt)
        session = sess_res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Verify student
        stud_stmt = select(Student).where(Student.id == payload.student_id)
        stud_res = await db.execute(stud_stmt)
        student = stud_res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

        # Check existing
        rec_stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.session_id == payload.session_id,
                AttendanceRecord.student_id == payload.student_id
            )
        )
        rec_res = await db.execute(rec_stmt)
        record = rec_res.scalar_one_or_none()

        if record:
            record.status = payload.status.upper()
            record.remarks = payload.remarks
            record.verification_method = "MANUAL"
        else:
            record = AttendanceRecord(
                session_id=payload.session_id,
                student_id=payload.student_id,
                status=payload.status.upper(),
                confidence_score=1.0,
                verification_method="MANUAL",
                liveness_verified=False,
                remarks=payload.remarks
            )
            db.add(record)

        await db.flush()

        audit = AuditLog(
            user_id=current_user.id,
            action="ATTENDANCE_MANUAL_OVERRIDE",
            entity_type="AttendanceRecord",
            entity_id=str(record.id),
            details_json=json.dumps({
                "session_id": payload.session_id,
                "student_id": payload.student_id,
                "status": payload.status.upper(),
                "remarks": payload.remarks
            })
        )
        db.add(audit)
        await db.commit()
        await db.refresh(record)

        return AttendanceRecordResponse(
            id=record.id,
            session_id=record.session_id,
            student_id=student.id,
            student_name=student.name,
            roll_number=student.student_id,
            semester=student.semester,
            section=student.section,
            marked_at=record.marked_at,
            status=record.status,
            confidence_score=record.confidence_score,
            verification_method=record.verification_method,
            liveness_verified=record.liveness_verified,
            remarks=record.remarks
        )

    @staticmethod
    async def get_session_records(db: AsyncSession, session_id: int) -> List[AttendanceRecordResponse]:
        stmt = (
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.student))
            .where(AttendanceRecord.session_id == session_id)
            .order_by(AttendanceRecord.marked_at.desc())
        )
        res = await db.execute(stmt)
        records = res.scalars().all()

        results = []
        for r in records:
            results.append(AttendanceRecordResponse(
                id=r.id,
                session_id=r.session_id,
                student_id=r.student_id,
                student_name=r.student.name if r.student else None,
                roll_number=r.student.student_id if r.student else None,
                semester=r.student.semester if r.student else None,
                section=r.student.section if r.student else None,
                marked_at=r.marked_at,
                status=r.status,
                confidence_score=r.confidence_score,
                verification_method=r.verification_method,
                liveness_verified=r.liveness_verified,
                remarks=r.remarks
            ))
        return results
