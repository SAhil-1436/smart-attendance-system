import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.academic import Department, Course, Subject
from sqlalchemy import select

from app.models.attendance import AttendanceSession
from app.models.faculty import FacultyProfile

@pytest.fixture(autouse=True)
async def cleanup_test_faculty():
    async def _clean():
        async with AsyncSessionLocal() as session:
            test_users = await session.execute(
                select(User).where(User.username.in_(["dr.anita", "dr.unique", "dr.unauthorized"]))
            )
            users = test_users.scalars().all()
            for u in users:
                fp_res = await session.execute(select(FacultyProfile).where(FacultyProfile.user_id == u.id))
                fp = fp_res.scalar_one_or_none()
                if fp:
                    sess_res = await session.execute(select(AttendanceSession).where(AttendanceSession.faculty_id == fp.id))
                    for s in sess_res.scalars().all():
                        await session.delete(s)
                    await session.delete(fp)
                await session.delete(u)
            await session.commit()

    await _clean()
    yield
    await _clean()

@pytest.fixture
async def tokens():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        admin_token = admin_resp.json()["access_token"]

        fac_resp = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        fac_token = fac_resp.json()["access_token"]

    return {"admin": admin_token, "faculty": fac_token}

@pytest.fixture
async def academic_data():
    async with AsyncSessionLocal() as session:
        dept = (await session.execute(select(Department).where(Department.code == "CSE"))).scalar_one()
        course = (await session.execute(select(Course).where(Course.code == "BTECH_CSE"))).scalar_one()
        subject = (await session.execute(select(Subject).where(Subject.code == "CS501"))).scalar_one()
        return {"dept_id": dept.id, "course_id": course.id, "subject_id": subject.id}

@pytest.mark.asyncio
async def test_create_faculty_admin_success(tokens, academic_data):
    admin_token = tokens["admin"]
    dept_id = academic_data["dept_id"]

    payload = {
        "username": "dr.anita",
        "email": "anita.desai@college.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Anita Desai",
        "department_id": dept_id,
        "employee_id": "FAC-2001",
        "phone": "+91-9876500001",
        "designation": "Assistant Professor"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/faculty/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=payload
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "dr.anita"
        assert data["email"] == "anita.desai@college.edu"
        assert data["employee_id"] == "FAC-2001"
        assert data["full_name"] == "Dr. Anita Desai"
        assert data["department_code"] == "CSE"
        assert data["is_active"] is True
        assert "password" not in data
        assert "password_hash" not in data

@pytest.mark.asyncio
async def test_create_faculty_duplicate_checks(tokens, academic_data):
    admin_token = tokens["admin"]
    dept_id = academic_data["dept_id"]

    base_payload = {
        "username": "dr.anita",
        "email": "anita.desai@college.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Anita Desai",
        "department_id": dept_id,
        "employee_id": "FAC-2001"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create first
        c_resp = await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"}, json=base_payload)
        assert c_resp.status_code == 201

        # Duplicate username
        dup_u = {**base_payload, "email": "different@college.edu", "employee_id": "FAC-2002"}
        resp1 = await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"}, json=dup_u)
        assert resp1.status_code == 409
        assert "already registered" in resp1.json()["detail"]

        # Duplicate employee_id
        dup_e = {**base_payload, "username": "dr.unique", "email": "unique@college.edu"}
        resp2 = await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"}, json=dup_e)
        assert resp2.status_code == 409
        assert "Employee ID" in resp2.json()["detail"]

@pytest.mark.asyncio
async def test_create_faculty_forbidden_for_faculty(tokens, academic_data):
    fac_token = tokens["faculty"]
    dept_id = academic_data["dept_id"]

    payload = {
        "username": "dr.unauthorized",
        "email": "unauth@college.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Unauthorized",
        "department_id": dept_id,
        "employee_id": "FAC-9999"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {fac_token}"}, json=payload)
        assert resp.status_code == 403

@pytest.mark.asyncio
async def test_new_faculty_can_login_and_schedule(tokens, academic_data):
    admin_token = tokens["admin"]
    dept_id = academic_data["dept_id"]
    course_id = academic_data["course_id"]
    subject_id = academic_data["subject_id"]

    payload = {
        "username": "dr.anita",
        "email": "anita.desai@college.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Anita Desai",
        "department_id": dept_id,
        "employee_id": "FAC-2001"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create faculty
        c_resp = await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
        assert c_resp.status_code == 201

        # 1. Login with newly created faculty credentials
        login_resp = await ac.post(
            "/api/v1/auth/login",
            json={"username": "dr.anita", "password": "Faculty@123"}
        )
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        new_fac_token = token_data["access_token"]
        assert token_data["user"]["role"] == "FACULTY"
        assert token_data["user"]["full_name"] == "Dr. Anita Desai"

        # 2. Schedule a class session using this teacher's account
        session_payload = {
            "subject_id": subject_id,
            "course_id": course_id,
            "semester": 5,
            "section": "B",
            "session_date": "2026-09-12",
            "start_time": "11:00:00"
        }
        sess_resp = await ac.post(
            "/api/v1/sessions",
            headers={"Authorization": f"Bearer {new_fac_token}"},
            json=session_payload
        )
        assert sess_resp.status_code == 201
        sess_data = sess_resp.json()
        assert sess_data["faculty_name"] == "Dr. Anita Desai"
        assert sess_data["section"] == "B"

@pytest.mark.asyncio
async def test_list_faculty_and_search(tokens, academic_data):
    admin_token = tokens["admin"]
    dept_id = academic_data["dept_id"]

    payload = {
        "username": "dr.anita",
        "email": "anita.desai@college.edu",
        "password": "Faculty@123",
        "full_name": "Dr. Anita Desai",
        "department_id": dept_id,
        "employee_id": "FAC-2001"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)

        # List all faculty
        resp = await ac.get("/api/v1/faculty/", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        usernames = [f["username"] for f in data]
        assert "dr.sharma" in usernames
        assert "dr.anita" in usernames

        # Search by name
        search_resp = await ac.get("/api/v1/faculty/?search=anita", headers={"Authorization": f"Bearer {admin_token}"})
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert len(search_data) == 1
        assert search_data[0]["username"] == "dr.anita"
