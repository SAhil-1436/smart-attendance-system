from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from app.models.student import Student
from app.models.academic import Department, Course, Subject
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.schemas.dashboard import (
    DashboardKPIs,
    DailyTrendItem,
    DepartmentAttendanceItem,
    StatusDistributionItem,
    RecentActivityItem,
    LowAttendanceStudentItem,
    DashboardDataResponse
)

class DashboardService:

    @staticmethod
    async def get_dashboard_summary(db: AsyncSession) -> DashboardDataResponse:
        today = date.today()

        # 1. Total & Face-Registered Students
        tot_students_stmt = select(func.count(Student.id)).where(Student.is_active == True)
        tot_students_res = await db.execute(tot_students_stmt)
        total_students = tot_students_res.scalar_one() or 0

        reg_students_stmt = select(func.count(Student.id)).where(
            and_(Student.is_active == True, Student.face_registered == True)
        )
        reg_students_res = await db.execute(reg_students_stmt)
        face_registered_students = reg_students_res.scalar_one() or 0

        face_reg_rate = round((face_registered_students / total_students * 100), 1) if total_students > 0 else 0.0

        # 2. Departments & Courses
        dept_count_res = await db.execute(select(func.count(Department.id)))
        total_departments = dept_count_res.scalar_one() or 0

        course_count_res = await db.execute(select(func.count(Course.id)))
        total_courses = course_count_res.scalar_one() or 0

        # 3. Sessions
        active_sess_stmt = select(func.count(AttendanceSession.id)).where(AttendanceSession.status == "ACTIVE")
        active_sess_res = await db.execute(active_sess_stmt)
        active_sessions_count = active_sess_res.scalar_one() or 0

        today_sess_stmt = select(func.count(AttendanceSession.id)).where(AttendanceSession.session_date == today)
        today_sess_res = await db.execute(today_sess_stmt)
        today_sessions_count = today_sess_res.scalar_one() or 0

        # 4. Today's Attendance Records
        today_records_stmt = (
            select(AttendanceRecord)
            .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
            .where(AttendanceSession.session_date == today)
        )
        today_rec_res = await db.execute(today_records_stmt)
        today_records = today_rec_res.scalars().all()

        today_records_count = len(today_records)
        today_present_count = sum(1 for r in today_records if r.status == "PRESENT")
        today_late_count = sum(1 for r in today_records if r.status == "LATE")

        today_attendance_rate = (
            round(((today_present_count + today_late_count) / today_records_count * 100), 1)
            if today_records_count > 0 else 100.0
        )

        # 5. Low Attendance Alerts Calculation (< 75% attendance)
        low_attendance_alerts = await DashboardService.get_low_attendance_students(db, threshold=75.0)
        low_attendance_count = len(low_attendance_alerts)

        kpis = DashboardKPIs(
            total_students=total_students,
            face_registered_students=face_registered_students,
            face_registration_rate=face_reg_rate,
            total_departments=total_departments,
            total_courses=total_courses,
            active_sessions_count=active_sessions_count,
            today_sessions_count=today_sessions_count,
            today_records_count=today_records_count,
            today_present_count=today_present_count,
            today_late_count=today_late_count,
            today_attendance_rate=today_attendance_rate,
            low_attendance_students_count=low_attendance_count
        )

        # 6. Daily Trends (Past 7 Days)
        daily_trends: List[DailyTrendItem] = []
        for i in range(6, -1, -1):
            day_target = today - timedelta(days=i)
            day_stmt = (
                select(AttendanceRecord)
                .join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)
                .where(AttendanceSession.session_date == day_target)
            )
            day_res = await db.execute(day_stmt)
            day_records = day_res.scalars().all()

            p_count = sum(1 for r in day_records if r.status == "PRESENT")
            l_count = sum(1 for r in day_records if r.status == "LATE")
            tot_day = len(day_records)

            daily_trends.append(DailyTrendItem(
                date=day_target.strftime("%Y-%m-%d"),
                day_name=day_target.strftime("%a"),
                present_count=p_count,
                late_count=l_count,
                total_marked=tot_day
            ))

        # 7. Department Attendance Breakdown
        dept_attendance: List[DepartmentAttendanceItem] = []
        depts_stmt = select(Department).options(selectinload(Department.students))
        depts_res = await db.execute(depts_stmt)
        depts = depts_res.scalars().all()

        for dept in depts:
            dept_student_ids = [s.id for s in dept.students if s.is_active]
            student_count = len(dept_student_ids)

            if student_count == 0:
                dept_attendance.append(DepartmentAttendanceItem(
                    department_id=dept.id,
                    department_name=dept.name,
                    department_code=dept.code,
                    total_students=0,
                    attendance_percentage=100.0
                ))
                continue

            # Count attended vs total eligible session counts for department students
            # Query attendance records for students in this department
            recs_stmt = select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.student_id.in_(dept_student_ids)
            )
            recs_res = await db.execute(recs_stmt)
            dept_recs_count = recs_res.scalar_one() or 0

            # Query total sessions matching department's courses
            dept_course_stmt = select(Course.id).where(Course.department_id == dept.id)
            course_ids_res = await db.execute(dept_course_stmt)
            course_ids = [c for c in course_ids_res.scalars().all()]

            sess_stmt = select(func.count(AttendanceSession.id)).where(
                AttendanceSession.course_id.in_(course_ids)
            )
            sess_res = await db.execute(sess_stmt)
            dept_sess_count = sess_res.scalar_one() or 0

            total_opportunities = dept_sess_count * student_count
            pct = round((dept_recs_count / total_opportunities * 100), 1) if total_opportunities > 0 else 100.0

            dept_attendance.append(DepartmentAttendanceItem(
                department_id=dept.id,
                department_name=dept.name,
                department_code=dept.code,
                total_students=student_count,
                attendance_percentage=min(pct, 100.0)
            ))

        # 8. Overall Status Distribution
        status_dist_stmt = (
            select(AttendanceRecord.status, func.count(AttendanceRecord.id))
            .group_by(AttendanceRecord.status)
        )
        status_res = await db.execute(status_dist_stmt)
        status_counts = dict(status_res.all())
        total_all_records = sum(status_counts.values())

        status_distribution: List[StatusDistributionItem] = []
        possible_statuses = ["PRESENT", "LATE", "MANUALLY_MARKED", "ABSENT"]
        for st in possible_statuses:
            cnt = status_counts.get(st, 0)
            pct = round((cnt / total_all_records * 100), 1) if total_all_records > 0 else 0.0
            status_distribution.append(StatusDistributionItem(
                status=st,
                count=cnt,
                percentage=pct
            ))

        # 9. Recent Activity Feed (Top 10)
        recent_stmt = (
            select(AttendanceRecord)
            .options(
                selectinload(AttendanceRecord.student),
                selectinload(AttendanceRecord.session).selectinload(AttendanceSession.subject)
            )
            .order_by(AttendanceRecord.marked_at.desc())
            .limit(10)
        )
        recent_res = await db.execute(recent_stmt)
        recent_records = recent_res.scalars().all()

        recent_activity: List[RecentActivityItem] = []
        for r in recent_records:
            recent_activity.append(RecentActivityItem(
                record_id=r.id,
                student_name=r.student.name if r.student else "Unknown",
                roll_number=r.student.student_id if r.student else "N/A",
                subject_name=r.session.subject.name if (r.session and r.session.subject) else "Lecture",
                subject_code=r.session.subject.code if (r.session and r.session.subject) else "SUB",
                status=r.status,
                verification_method=r.verification_method,
                confidence_score=r.confidence_score,
                marked_at=r.marked_at
            ))

        return DashboardDataResponse(
            kpis=kpis,
            daily_trends=daily_trends,
            department_attendance=dept_attendance,
            status_distribution=status_distribution,
            recent_activity=recent_activity,
            low_attendance_alerts=low_attendance_alerts
        )

    @staticmethod
    async def get_low_attendance_students(
        db: AsyncSession,
        threshold: float = 75.0
    ) -> List[LowAttendanceStudentItem]:
        # Fetch all active students with course and department
        stmt = (
            select(Student)
            .options(
                selectinload(Student.department),
                selectinload(Student.course),
                selectinload(Student.attendance_records)
            )
            .where(Student.is_active == True)
        )
        res = await db.execute(stmt)
        students = res.scalars().all()

        alerts: List[LowAttendanceStudentItem] = []

        for student in students:
            # Total sessions conducted for student's class (course, semester, section)
            sess_stmt = select(func.count(AttendanceSession.id)).where(
                and_(
                    AttendanceSession.course_id == student.course_id,
                    AttendanceSession.semester == student.semester,
                    AttendanceSession.section == student.section
                )
            )
            sess_res = await db.execute(sess_stmt)
            total_sessions = sess_res.scalar_one() or 0

            # Records for this student in valid sessions
            attended_sessions = len(student.attendance_records or [])

            if total_sessions > 0:
                pct = round((attended_sessions / total_sessions * 100), 1)
                if pct < threshold:
                    alerts.append(LowAttendanceStudentItem(
                        student_id=student.id,
                        roll_number=student.student_id,
                        student_name=student.name,
                        department_name=student.department.name if student.department else "N/A",
                        course_name=student.course.name if student.course else "N/A",
                        semester=student.semester,
                        section=student.section,
                        total_sessions=total_sessions,
                        attended_sessions=attended_sessions,
                        attendance_percentage=pct
                    ))

        # Sort with lowest attendance percentage first
        alerts.sort(key=lambda x: x.attendance_percentage)
        return alerts
