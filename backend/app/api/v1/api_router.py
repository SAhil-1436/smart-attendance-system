from fastapi import APIRouter
from app.api.v1.endpoints import auth, students, academic, face, recognition, liveness, sessions, attendance, dashboard, reports, audit, faculty

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(faculty.router)
api_router.include_router(students.router)
api_router.include_router(academic.router)
api_router.include_router(face.router)
api_router.include_router(recognition.router)
api_router.include_router(liveness.router)
api_router.include_router(sessions.router)
api_router.include_router(attendance.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(audit.router)




