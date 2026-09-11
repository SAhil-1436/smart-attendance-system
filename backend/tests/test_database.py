import pytest
from datetime import datetime, date, time, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.academic import Department, Course, Subject
from app.models.faculty import FacultyProfile
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.audit import AuditLog

@pytest.mark.asyncio
async def test_seed_data_exists():
    """Verify default seeded admin, faculty, and departments exist."""
    async with AsyncSessionLocal() as session:
        # Check admin
        admin_res = await session.execute(select(User).where(User.username == "admin"))
        admin = admin_res.scalar_one_or_none()
        assert admin is not None
        assert admin.role == "ADMIN"
        assert admin.is_active is True

        # Check faculty
        fac_res = await session.execute(select(User).where(User.username == "dr.sharma"))
        fac = fac_res.scalar_one_or_none()
        assert fac is not None
        assert fac.role == "FACULTY"

        # Check department and course
        dept_res = await session.execute(select(Department).where(Department.code == "CSE"))
        cse = dept_res.scalar_one_or_none()
        assert cse is not None

        course_res = await session.execute(select(Course).where(Course.code == "BTECH_CSE"))
        btech = course_res.scalar_one_or_none()
        assert btech is not None

@pytest.mark.asyncio
async def test_student_crud():
    """Test full CRUD operations on Student entity."""
    async with AsyncSessionLocal() as session:
        dept = (await session.execute(select(Department).where(Department.code == "CSE"))).scalar_one()
        course = (await session.execute(select(Course).where(Course.code == "BTECH_CSE"))).scalar_one()

        # CREATE
        student = Student(
            student_id="TEST2026_001",
            name="Alice Test",
            email="alice.test@college.edu",
            phone="+91-9988776655",
            department_id=dept.id,
            course_id=course.id,
            semester=5,
            section="A",
            face_registered=False,
            is_active=True
        )
        session.add(student)
        await session.commit()
        await session.refresh(student)
        assert student.id is not None
        student_pk = student.id

        # READ
        read_res = await session.execute(select(Student).where(Student.id == student_pk))
        fetched_student = read_res.scalar_one()
        assert fetched_student.name == "Alice Test"
        assert fetched_student.student_id == "TEST2026_001"

        # UPDATE
        fetched_student.name = "Alice Updated"
        fetched_student.section = "B"
        await session.commit()

        read_res2 = await session.execute(select(Student).where(Student.id == student_pk))
        updated_student = read_res2.scalar_one()
        assert updated_student.name == "Alice Updated"
        assert updated_student.section == "B"

        # DELETE
        await session.delete(updated_student)
        await session.commit()

        read_res3 = await session.execute(select(Student).where(Student.id == student_pk))
        assert read_res3.scalar_one_or_none() is None

@pytest.mark.asyncio
async def test_face_embedding_cascade():
    """Verify that deleting a student cascades and removes their face embeddings."""
    async with AsyncSessionLocal() as session:
        dept = (await session.execute(select(Department).where(Department.code == "CSE"))).scalar_one()
        course = (await session.execute(select(Course).where(Course.code == "BTECH_CSE"))).scalar_one()

        student = Student(
            student_id="TEST2026_EMBED",
            name="Bob Embedding",
            email="bob.embed@college.edu",
            department_id=dept.id,
            course_id=course.id,
            semester=5,
            section="A"
        )
        session.add(student)
        await session.commit()
        await session.refresh(student)

        # Add 2 face embeddings
        dummy_vector = b"\x00\x01\x02\x03" * 32  # 128 bytes
        emb1 = FaceEmbedding(student_id=student.id, embedding_vector=dummy_vector, sample_index=0, quality_score=95.5)
        emb2 = FaceEmbedding(student_id=student.id, embedding_vector=dummy_vector, sample_index=1, quality_score=98.2)
        session.add_all([emb1, emb2])
        student.face_registered = True
        await session.commit()

        # Verify embeddings exist
        emb_res = await session.execute(select(FaceEmbedding).where(FaceEmbedding.student_id == student.id))
        embeddings = emb_res.scalars().all()
        assert len(embeddings) == 2

        # Delete student and verify cascade
        await session.delete(student)
        await session.commit()

        emb_res_after = await session.execute(select(FaceEmbedding).where(FaceEmbedding.student_id == student.id))
        assert len(emb_res_after.scalars().all()) == 0

@pytest.mark.asyncio
async def test_attendance_session_and_duplicate_prevention():
    """Verify attendance marking and database-level prevention of duplicate records."""
    async with AsyncSessionLocal() as session:
        dept = (await session.execute(select(Department).where(Department.code == "CSE"))).scalar_one()
        course = (await session.execute(select(Course).where(Course.code == "BTECH_CSE"))).scalar_one()
        subj = (await session.execute(select(Subject).where(Subject.code == "CS501"))).scalar_one()
        fac_prof = (await session.execute(select(FacultyProfile))).scalar_one()

        # Create student
        student = Student(
            student_id="TEST2026_ATT",
            name="Charlie Attendance",
            email="charlie.att@college.edu",
            department_id=dept.id,
            course_id=course.id,
            semester=5,
            section="A"
        )
        session.add(student)
        await session.commit()
        await session.refresh(student)

        # Create session
        now = datetime.now(timezone.utc)
        att_session = AttendanceSession(
            session_code="SES_TEST_DUP_001",
            subject_id=subj.id,
            faculty_id=fac_prof.id,
            course_id=course.id,
            semester=5,
            section="A",
            session_date=now.date(),
            start_time=now.time(),
            status="ACTIVE"
        )
        session.add(att_session)
        await session.commit()
        await session.refresh(att_session)

        # Mark 1st Attendance (Should Succeed)
        rec1 = AttendanceRecord(
            session_id=att_session.id,
            student_id=student.id,
            status="PRESENT",
            confidence_score=0.92,
            verification_method="FACE_LIVENESS",
            liveness_verified=True
        )
        session.add(rec1)
        await session.commit()
        assert rec1.id is not None

        # Attempt to mark duplicate attendance for same student in same session
        rec2 = AttendanceRecord(
            session_id=att_session.id,
            student_id=student.id,
            status="PRESENT",
            confidence_score=0.89,
            verification_method="FACE_LIVENESS",
            liveness_verified=True
        )
        session.add(rec2)
        with pytest.raises(IntegrityError):
            await session.commit()

        await session.rollback()

        # Clean up
        await session.delete(att_session)
        await session.delete(student)
        await session.commit()

@pytest.mark.asyncio
async def test_audit_logging():
    """Verify audit log creation."""
    async with AsyncSessionLocal() as session:
        admin = (await session.execute(select(User).where(User.username == "admin"))).scalar_one()
        log = AuditLog(
            user_id=admin.id,
            action="TEST_ACTION",
            entity_type="Student",
            entity_id="123",
            ip_address="127.0.0.1",
            details_json='{"info": "Unit test audit log"}'
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)

        assert log.id is not None
        assert log.action == "TEST_ACTION"

        await session.delete(log)
        await session.commit()
