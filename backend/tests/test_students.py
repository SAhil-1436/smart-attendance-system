import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.academic import Department, Course
from sqlalchemy import select

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
        return {"dept_id": dept.id, "course_id": course.id}

@pytest.mark.asyncio
async def test_create_student_admin_vs_faculty(tokens, academic_data):
    admin_token = tokens["admin"]
    fac_token = tokens["faculty"]
    dept_id = academic_data["dept_id"]
    course_id = academic_data["course_id"]

    payload = {
        "student_id": "STU_TEST_001",
        "name": "David Miller",
        "email": "david.miller@college.edu",
        "phone": "+91-9876543211",
        "department_id": dept_id,
        "course_id": course_id,
        "semester": 5,
        "section": "A"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Faculty attempt -> 403 Forbidden
        fac_attempt = await ac.post(
            "/api/v1/students",
            json=payload,
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert fac_attempt.status_code == 403

        # Admin attempt -> 201 Created
        admin_attempt = await ac.post(
            "/api/v1/students",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_attempt.status_code == 201
        created = admin_attempt.json()
        assert created["student_id"] == "STU_TEST_001"
        assert created["face_registered"] is False
        assert created["is_active"] is True
        assert created["department_code"] == "CSE"
        student_id_pk = created["id"]

        # Duplicate Student ID -> 409 Conflict
        dup_id = await ac.post(
            "/api/v1/students",
            json={**payload, "email": "different.email@college.edu"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert dup_id.status_code == 409

        # Duplicate Email -> 409 Conflict
        dup_email = await ac.post(
            "/api/v1/students",
            json={**payload, "student_id": "STU_TEST_DIFF"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert dup_email.status_code == 409

        # Clean up
        await ac.delete(f"/api/v1/students/{student_id_pk}?hard_delete=true", headers={"Authorization": f"Bearer {admin_token}"})

@pytest.mark.asyncio
async def test_search_and_filter_students(tokens, academic_data):
    admin_token = tokens["admin"]
    fac_token = tokens["faculty"]
    dept_id = academic_data["dept_id"]
    course_id = academic_data["course_id"]

    # Seed 2 test students
    s1 = {
        "student_id": "STU_SEARCH_ALPHA",
        "name": "Alpha Hunter",
        "email": "alpha.hunter@college.edu",
        "department_id": dept_id,
        "course_id": course_id,
        "semester": 3,
        "section": "A"
    }
    s2 = {
        "student_id": "STU_SEARCH_BETA",
        "name": "Beta Parker",
        "email": "beta.parker@college.edu",
        "department_id": dept_id,
        "course_id": course_id,
        "semester": 5,
        "section": "B"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res1 = await ac.post("/api/v1/students", json=s1, headers={"Authorization": f"Bearer {admin_token}"})
        pk1 = res1.json()["id"]
        res2 = await ac.post("/api/v1/students", json=s2, headers={"Authorization": f"Bearer {admin_token}"})
        pk2 = res2.json()["id"]

        # 1. Search by name "Hunter"
        search_res = await ac.get("/api/v1/students?search=Hunter", headers={"Authorization": f"Bearer {fac_token}"})
        assert search_res.status_code == 200
        items = search_res.json()["items"]
        assert len(items) == 1
        assert items[0]["student_id"] == "STU_SEARCH_ALPHA"

        # 2. Search by roll number "BETA"
        search_res2 = await ac.get("/api/v1/students?search=BETA", headers={"Authorization": f"Bearer {fac_token}"})
        assert len(search_res2.json()["items"]) == 1

        # 3. Filter by semester=5
        filter_sem = await ac.get("/api/v1/students?semester=5", headers={"Authorization": f"Bearer {fac_token}"})
        sem_items = filter_sem.json()["items"]
        assert all(s["semester"] == 5 for s in sem_items)

        # 4. Filter by section=B
        filter_sec = await ac.get("/api/v1/students?section=B", headers={"Authorization": f"Bearer {fac_token}"})
        sec_items = filter_sec.json()["items"]
        assert all(s["section"] == "B" for s in sec_items)

        # Clean up
        await ac.delete(f"/api/v1/students/{pk1}?hard_delete=true", headers={"Authorization": f"Bearer {admin_token}"})
        await ac.delete(f"/api/v1/students/{pk2}?hard_delete=true", headers={"Authorization": f"Bearer {admin_token}"})

@pytest.mark.asyncio
async def test_update_and_deactivate_student(tokens, academic_data):
    admin_token = tokens["admin"]
    dept_id = academic_data["dept_id"]
    course_id = academic_data["course_id"]

    student_data = {
        "student_id": "STU_UPDATE_001",
        "name": "Original Name",
        "email": "original.name@college.edu",
        "department_id": dept_id,
        "course_id": course_id,
        "semester": 1,
        "section": "A"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        create_res = await ac.post("/api/v1/students", json=student_data, headers={"Authorization": f"Bearer {admin_token}"})
        pk = create_res.json()["id"]

        # Update name and semester
        update_res = await ac.put(
            f"/api/v1/students/{pk}",
            json={"name": "Modified Name", "semester": 2},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Modified Name"
        assert update_res.json()["semester"] == 2

        # Soft deactivate
        deact_res = await ac.delete(f"/api/v1/students/{pk}", headers={"Authorization": f"Bearer {admin_token}"})
        assert deact_res.status_code == 200
        assert "deactivated" in deact_res.json()["message"]

        # Verify is_active is now False
        get_res = await ac.get(f"/api/v1/students/{pk}", headers={"Authorization": f"Bearer {admin_token}"})
        assert get_res.json()["is_active"] is False

        # Hard delete
        hard_del = await ac.delete(f"/api/v1/students/{pk}?hard_delete=true", headers={"Authorization": f"Bearer {admin_token}"})
        assert hard_del.status_code == 200
        assert "permanently deleted" in hard_del.json()["message"]
