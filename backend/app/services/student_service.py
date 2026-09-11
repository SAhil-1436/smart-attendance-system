from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from typing import Optional, Tuple, List
import json
import math

from app.models.student import Student
from app.models.academic import Department, Course
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentListResponse

class StudentService:

    @staticmethod
    def _to_response(student: Student) -> StudentResponse:
        return StudentResponse(
            id=student.id,
            student_id=student.student_id,
            name=student.name,
            email=student.email,
            phone=student.phone,
            department_id=student.department_id,
            course_id=student.course_id,
            semester=student.semester,
            section=student.section,
            face_registered=student.face_registered,
            is_active=student.is_active,
            department_name=student.department.name if student.department else None,
            department_code=student.department.code if student.department else None,
            course_name=student.course.name if student.course else None,
            course_code=student.course.code if student.course else None,
            created_at=student.created_at,
            updated_at=student.updated_at
        )

    @staticmethod
    async def create_student(db: AsyncSession, student_in: StudentCreate, current_user: User) -> StudentResponse:
        # Check duplicate student_id
        dup_id = await db.execute(select(Student).where(Student.student_id == student_in.student_id))
        if dup_id.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Student ID / Roll Number '{student_in.student_id}' is already registered."
            )

        # Check duplicate email
        dup_email = await db.execute(select(Student).where(Student.email == student_in.email))
        if dup_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{student_in.email}' is already in use by another student."
            )

        # Validate department & course
        dept = await db.get(Department, student_in.department_id)
        if not dept:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department ID.")

        course = await db.get(Course, student_in.course_id)
        if not course or course.department_id != dept.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course ID or course does not belong to the selected department.")

        student = Student(
            student_id=student_in.student_id,
            name=student_in.name,
            email=student_in.email,
            phone=student_in.phone,
            department_id=student_in.department_id,
            course_id=student_in.course_id,
            semester=student_in.semester,
            section=student_in.section.upper(),
            face_registered=False,
            is_active=True
        )
        db.add(student)
        await db.flush()

        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            action="STUDENT_CREATE",
            entity_type="Student",
            entity_id=str(student.id),
            details_json=json.dumps({"student_id": student.student_id, "name": student.name})
        )
        db.add(audit)
        await db.commit()

        # Reload with relationships
        stmt = select(Student).options(selectinload(Student.department), selectinload(Student.course)).where(Student.id == student.id)
        res = await db.execute(stmt)
        student_loaded = res.scalar_one()
        return StudentService._to_response(student_loaded)

    @staticmethod
    async def get_student_by_id(db: AsyncSession, student_id: int) -> StudentResponse:
        stmt = select(Student).options(selectinload(Student.department), selectinload(Student.course)).where(Student.id == student_id)
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student with ID {student_id} not found.")
        return StudentService._to_response(student)

    @staticmethod
    async def list_students(
        db: AsyncSession,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        course_id: Optional[int] = None,
        semester: Optional[int] = None,
        section: Optional[str] = None,
        face_registered: Optional[bool] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        size: int = 10
    ) -> StudentListResponse:
        conditions = []

        if search:
            search_clean = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Student.name.ilike(search_clean),
                    Student.student_id.ilike(search_clean),
                    Student.email.ilike(search_clean)
                )
            )
        if department_id is not None:
            conditions.append(Student.department_id == department_id)
        if course_id is not None:
            conditions.append(Student.course_id == course_id)
        if semester is not None:
            conditions.append(Student.semester == semester)
        if section:
            conditions.append(Student.section == section.upper())
        if face_registered is not None:
            conditions.append(Student.face_registered == face_registered)
        if is_active is not None:
            conditions.append(Student.is_active == is_active)

        where_clause = and_(*conditions) if conditions else True

        # Total count query
        count_stmt = select(func.count(Student.id)).where(where_clause)
        total = (await db.execute(count_stmt)).scalar() or 0

        # Items query with pagination
        offset = (page - 1) * size
        items_stmt = (
            select(Student)
            .options(selectinload(Student.department), selectinload(Student.course))
            .where(where_clause)
            .order_by(Student.id.desc())
            .offset(offset)
            .limit(size)
        )
        items = (await db.execute(items_stmt)).scalars().all()
        response_items = [StudentService._to_response(s) for s in items]

        total_pages = math.ceil(total / size) if size > 0 else 1
        return StudentListResponse(
            items=response_items,
            total=total,
            page=page,
            size=size,
            total_pages=total_pages
        )

    @staticmethod
    async def update_student(
        db: AsyncSession,
        student_id: int,
        student_in: StudentUpdate,
        current_user: User
    ) -> StudentResponse:
        stmt = select(Student).options(selectinload(Student.department), selectinload(Student.course)).where(Student.id == student_id)
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student with ID {student_id} not found.")

        # Check unique email if changing
        if student_in.email and student_in.email != student.email:
            dup = await db.execute(select(Student).where(Student.email == student_in.email, Student.id != student_id))
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use by another student.")
            student.email = student_in.email

        if student_in.name is not None:
            student.name = student_in.name
        if student_in.phone is not None:
            student.phone = student_in.phone
        if student_in.department_id is not None:
            student.department_id = student_in.department_id
        if student_in.course_id is not None:
            student.course_id = student_in.course_id
        if student_in.semester is not None:
            student.semester = student_in.semester
        if student_in.section is not None:
            student.section = student_in.section.upper()
        if student_in.is_active is not None:
            student.is_active = student_in.is_active

        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            action="STUDENT_UPDATE",
            entity_type="Student",
            entity_id=str(student.id),
            details_json=json.dumps({"updated_fields": [k for k, v in student_in.model_dump(exclude_unset=True).items()]})
        )
        db.add(audit)
        await db.commit()
        await db.refresh(student)
        return StudentService._to_response(student)

    @staticmethod
    async def delete_or_deactivate_student(
        db: AsyncSession,
        student_id: int,
        hard_delete: bool,
        current_user: User
    ):
        stmt = select(Student).where(Student.id == student_id)
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student with ID {student_id} not found.")

        if hard_delete:
            await db.delete(student)
            action = "STUDENT_DELETE"
        else:
            student.is_active = False
            action = "STUDENT_DEACTIVATE"

        audit = AuditLog(
            user_id=current_user.id,
            action=action,
            entity_type="Student",
            entity_id=str(student_id),
            details_json=json.dumps({"student_id": student.student_id, "hard_delete": hard_delete})
        )
        db.add(audit)
        await db.commit()
        return {"message": f"Student {'permanently deleted' if hard_delete else 'deactivated'} successfully"}
