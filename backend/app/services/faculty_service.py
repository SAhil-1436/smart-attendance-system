from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
import json
import logging

from app.models.user import User
from app.models.faculty import FacultyProfile
from app.models.academic import Department
from app.models.audit import AuditLog
from app.schemas.faculty import FacultyCreate, FacultyResponse, FacultyUpdate
from app.core.security import get_password_hash

logger = logging.getLogger("smart_attendance")

class FacultyService:
    @staticmethod
    def _to_response(profile: FacultyProfile) -> FacultyResponse:
        user = profile.user
        dept = profile.department
        return FacultyResponse(
            id=profile.id,
            user_id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            department_id=profile.department_id,
            department_name=dept.name if dept else None,
            department_code=dept.code if dept else None,
            employee_id=profile.employee_id,
            phone=profile.phone,
            designation=profile.designation,
            is_active=user.is_active,
            created_at=user.created_at
        )

    @staticmethod
    async def create_faculty(
        db: AsyncSession,
        faculty_in: FacultyCreate,
        admin_user: User,
        client_ip: str = "unknown"
    ) -> FacultyResponse:
        # 1. Check for duplicate username
        u_res = await db.execute(select(User).where(User.username == faculty_in.username.strip()))
        if u_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{faculty_in.username}' is already registered."
            )

        # 2. Check for duplicate email
        e_res = await db.execute(select(User).where(User.email == faculty_in.email.strip().lower()))
        if e_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{faculty_in.email}' is already registered."
            )

        # 3. Check for duplicate employee ID
        emp_res = await db.execute(select(FacultyProfile).where(FacultyProfile.employee_id == faculty_in.employee_id.strip().upper()))
        if emp_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee ID '{faculty_in.employee_id}' is already assigned to another faculty member."
            )

        # 4. Verify Department
        dept_res = await db.execute(select(Department).where(Department.id == faculty_in.department_id))
        dept = dept_res.scalar_one_or_none()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department ID {faculty_in.department_id} not found."
            )

        # 5. Create User
        new_user = User(
            username=faculty_in.username.strip(),
            email=faculty_in.email.strip().lower(),
            password_hash=get_password_hash(faculty_in.password),
            full_name=faculty_in.full_name.strip(),
            role="FACULTY",
            is_active=True
        )
        db.add(new_user)
        await db.flush()

        # 6. Create Faculty Profile
        new_profile = FacultyProfile(
            user_id=new_user.id,
            department_id=dept.id,
            employee_id=faculty_in.employee_id.strip().upper(),
            phone=faculty_in.phone.strip() if faculty_in.phone else None,
            designation=faculty_in.designation.strip() if faculty_in.designation else "Assistant Professor"
        )
        db.add(new_profile)
        await db.flush()

        # 7. Audit Log
        audit = AuditLog(
            user_id=admin_user.id,
            action="FACULTY_REGISTERED",
            entity_type="FacultyProfile",
            entity_id=str(new_profile.id),
            ip_address=client_ip,
            details_json=json.dumps({
                "username": new_user.username,
                "full_name": new_user.full_name,
                "employee_id": new_profile.employee_id,
                "department_code": dept.code
            })
        )
        db.add(audit)
        await db.commit()

        # Reload with relationships
        stmt = (
            select(FacultyProfile)
            .where(FacultyProfile.id == new_profile.id)
            .options(selectinload(FacultyProfile.user), selectinload(FacultyProfile.department))
        )
        res = await db.execute(stmt)
        fresh_profile = res.scalar_one()

        logger.info(f"New faculty registered: {fresh_profile.user.username} ({fresh_profile.employee_id}) by admin {admin_user.username}")
        return FacultyService._to_response(fresh_profile)

    @staticmethod
    async def list_faculty(
        db: AsyncSession,
        department_id: int = None,
        search: str = None
    ):
        stmt = (
            select(FacultyProfile)
            .join(FacultyProfile.user)
            .options(selectinload(FacultyProfile.user), selectinload(FacultyProfile.department))
            .order_by(FacultyProfile.id.asc())
        )

        conditions = []
        if department_id:
            conditions.append(FacultyProfile.department_id == department_id)
        if search:
            s = f"%{search.strip().lower()}%"
            conditions.append(
                or_(
                    User.full_name.ilike(s),
                    User.username.ilike(s),
                    User.email.ilike(s),
                    FacultyProfile.employee_id.ilike(s)
                )
            )

        if conditions:
            stmt = stmt.where(and_(*conditions))

        res = await db.execute(stmt)
        profiles = res.scalars().all()
        return [FacultyService._to_response(p) for p in profiles]

    @staticmethod
    async def toggle_faculty_status(
        db: AsyncSession,
        faculty_id: int,
        is_active: bool,
        admin_user: User,
        client_ip: str = "unknown"
    ) -> FacultyResponse:
        stmt = (
            select(FacultyProfile)
            .where(FacultyProfile.id == faculty_id)
            .options(selectinload(FacultyProfile.user), selectinload(FacultyProfile.department))
        )
        res = await db.execute(stmt)
        profile = res.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

        profile.user.is_active = is_active
        
        audit = AuditLog(
            user_id=admin_user.id,
            action="FACULTY_STATUS_UPDATED",
            entity_type="FacultyProfile",
            entity_id=str(profile.id),
            ip_address=client_ip,
            details_json=json.dumps({"is_active": is_active, "username": profile.user.username})
        )
        db.add(audit)
        await db.commit()
        await db.refresh(profile.user)
        return FacultyService._to_response(profile)

    @staticmethod
    async def delete_faculty(
        db: AsyncSession,
        faculty_id: int,
        admin_user: User,
        client_ip: str = "unknown"
    ):
        stmt = (
            select(FacultyProfile)
            .where(FacultyProfile.id == faculty_id)
            .options(selectinload(FacultyProfile.user))
        )
        res = await db.execute(stmt)
        profile = res.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")

        user = profile.user
        audit = AuditLog(
            user_id=admin_user.id,
            action="FACULTY_DELETED",
            entity_type="FacultyProfile",
            entity_id=str(profile.id),
            ip_address=client_ip,
            details_json=json.dumps({"username": user.username, "employee_id": profile.employee_id})
        )
        db.add(audit)
        await db.delete(user)
        await db.commit()
        return {"message": f"Faculty {user.full_name} ({profile.employee_id}) successfully deleted."}
