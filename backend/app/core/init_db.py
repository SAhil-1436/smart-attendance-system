import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
import app.models  # Ensure all models are registered
from app.models.user import User
from app.models.academic import Department, Course, Subject
from app.models.faculty import FacultyProfile
from app.models.student import Student
from app.models.setting import SystemSetting
from app.core.security import get_password_hash

logger = logging.getLogger("smart_attendance.init_db")

async def init_db():
    # Create all tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure composite performance indices exist
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendance_student_marked ON attendance_records (student_id, marked_at)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendance_status_marked ON attendance_records (status, marked_at)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_session_status_date ON attendance_sessions (status, session_date)"))
    logger.info("Database tables and performance indices initialized successfully.")

    async with AsyncSessionLocal() as session:
        # 1. Seed Admin User
        admin_res = await session.execute(select(User).where(User.role == "ADMIN"))
        admin = admin_res.scalar_one_or_none()
        if not admin:
            admin = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                full_name="System Administrator",
                role="ADMIN",
                is_active=True
            )
            session.add(admin)
            logger.info(f"Default admin user created: {settings.DEFAULT_ADMIN_USERNAME}")

        # 2. Seed Departments
        dept_res = await session.execute(select(Department).where(Department.code == "CSE"))
        cse_dept = dept_res.scalar_one_or_none()
        if not cse_dept:
            cse_dept = Department(
                code="CSE",
                name="Computer Science & Engineering",
                description="Department of Computer Science and Engineering"
            )
            session.add(cse_dept)
            await session.flush()

        ece_res = await session.execute(select(Department).where(Department.code == "ECE"))
        ece_dept = ece_res.scalar_one_or_none()
        if not ece_dept:
            ece_dept = Department(
                code="ECE",
                name="Electronics & Communication Engineering",
                description="Department of Electronics and Communication Engineering"
            )
            session.add(ece_dept)
            await session.flush()

        # 3. Seed Courses
        course_res = await session.execute(select(Course).where(Course.code == "BTECH_CSE"))
        btech_cse = course_res.scalar_one_or_none()
        if not btech_cse:
            btech_cse = Course(
                department_id=cse_dept.id,
                code="BTECH_CSE",
                name="B.Tech Computer Science & Engineering",
                semester_count=8
            )
            session.add(btech_cse)
            await session.flush()

        # 4. Seed Subjects
        subj_res = await session.execute(select(Subject).where(Subject.code == "CS501"))
        cs501 = subj_res.scalar_one_or_none()
        if not cs501:
            cs501 = Subject(
                course_id=btech_cse.id,
                code="CS501",
                name="Computer Vision & Pattern Recognition",
                semester=5
            )
            session.add(cs501)

        subj_res2 = await session.execute(select(Subject).where(Subject.code == "CS502"))
        cs502 = subj_res2.scalar_one_or_none()
        if not cs502:
            cs502 = Subject(
                course_id=btech_cse.id,
                code="CS502",
                name="Artificial Intelligence & Machine Learning",
                semester=5
            )
            session.add(cs502)

        # 5. Seed Faculty User & Profile
        fac_user_res = await session.execute(select(User).where(User.username == "dr.sharma"))
        fac_user = fac_user_res.scalar_one_or_none()
        if not fac_user:
            fac_user = User(
                username="dr.sharma",
                email="sharma@college.edu",
                password_hash=get_password_hash("Faculty@123"),
                full_name="Dr. Rajesh Sharma",
                role="FACULTY",
                is_active=True
            )
            session.add(fac_user)
            await session.flush()

            faculty_profile = FacultyProfile(
                user_id=fac_user.id,
                department_id=cse_dept.id,
                employee_id="FAC-1001",
                phone="+91-9876543210",
                designation="Associate Professor"
            )
            session.add(faculty_profile)
            logger.info("Default faculty created: dr.sharma / Faculty@123")

        # 6. Seed Students (if table empty)
        stu_res = await session.execute(select(Student))
        if not stu_res.scalars().first():
            students_to_seed = [
                Student(
                    student_id="2024CSE001",
                    name="Aarav Sharma",
                    email="aarav.cse@college.edu",
                    phone="+91-9876543201",
                    department_id=cse_dept.id,
                    course_id=btech_cse.id,
                    semester=5,
                    section="A",
                    face_registered=False,
                    is_active=True
                ),
                Student(
                    student_id="2024CSE002",
                    name="Diya Patel",
                    email="diya.cse@college.edu",
                    phone="+91-9876543202",
                    department_id=cse_dept.id,
                    course_id=btech_cse.id,
                    semester=5,
                    section="A",
                    face_registered=False,
                    is_active=True
                ),
                Student(
                    student_id="2024CSE003",
                    name="Rohan Verma",
                    email="rohan.cse@college.edu",
                    phone="+91-9876543203",
                    department_id=cse_dept.id,
                    course_id=btech_cse.id,
                    semester=5,
                    section="B",
                    face_registered=False,
                    is_active=True
                )
            ]
            session.add_all(students_to_seed)
            logger.info("Initial students seeded.")

        # 7. Seed System Settings
        default_settings = {
            "face_similarity_threshold": ("0.65", "Minimum cosine similarity score (0.0 - 1.0) to identify student"),
            "liveness_strictness": ("NORMAL", "Liveness verification strictness: RELAXED, NORMAL, STRICT"),
            "face_min_size": ("100", "Minimum bounding box width/height in pixels"),
            "laplacian_blur_threshold": ("80.0", "Minimum Laplacian variance threshold to reject blurry images"),
            "late_cutoff_minutes": ("15", "Minutes after session start when attendance is marked LATE instead of PRESENT"),
            "retention_days": ("365", "Biometric and session audit log retention period in days"),
        }

        for key, (val, desc) in default_settings.items():
            setting_res = await session.execute(select(SystemSetting).where(SystemSetting.key == key))
            if not setting_res.scalar_one_or_none():
                session.add(SystemSetting(key=key, value=val, description=desc))

        await session.commit()
        logger.info("Database seeding completed successfully.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
