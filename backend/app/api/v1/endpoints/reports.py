from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.dependencies import get_faculty_or_admin
from app.models.user import User
from app.schemas.reports import ReportFilterParams, AttendanceReportResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Attendance Reports & Export"])

def parse_report_filters(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subject_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    student_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
) -> ReportFilterParams:
    return ReportFilterParams(
        start_date=start_date,
        end_date=end_date,
        subject_id=subject_id,
        course_id=course_id,
        department_id=department_id,
        semester=semester,
        section=section,
        student_id=student_id,
        status=status
    )

@router.get("", response_model=AttendanceReportResponse)
async def get_attendance_report(
    filters: ReportFilterParams = Depends(parse_report_filters),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Generates multi-criteria attendance report data including per-student summary
    rates and full detailed audit records.
    """
    return await ReportService.generate_report_data(db, filters)

@router.get("/export/pdf")
async def export_attendance_pdf(
    filters: ReportFilterParams = Depends(parse_report_filters),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Exports official college attendance document as formatted PDF via ReportLab.
    """
    report = await ReportService.generate_report_data(db, filters)
    pdf_bytes = ReportService.export_pdf(report)
    filename = f"attendance_report_{date.today().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/excel")
async def export_attendance_excel(
    filters: ReportFilterParams = Depends(parse_report_filters),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Exports multi-sheet attendance records and summary workbook as Excel (.xlsx) via openpyxl.
    """
    report = await ReportService.generate_report_data(db, filters)
    xlsx_bytes = ReportService.export_excel(report)
    filename = f"attendance_report_{date.today().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/csv")
async def export_attendance_csv(
    filters: ReportFilterParams = Depends(parse_report_filters),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Exports attendance records as standardized CSV for ERP ingestion.
    """
    report = await ReportService.generate_report_data(db, filters)
    csv_str = ReportService.export_csv(report)
    filename = f"attendance_report_{date.today().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_str.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
