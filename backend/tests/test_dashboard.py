import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def auth_tokens():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        admin_token = admin_resp.json()["access_token"]

        fac_resp = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        fac_token = fac_resp.json()["access_token"]

    return {"admin": admin_token, "faculty": fac_token}

@pytest.mark.asyncio
async def test_dashboard_summary_and_kpis(auth_tokens):
    admin_token = auth_tokens["admin"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch dashboard summary
        res = await ac.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()

        # 2. Check KPIs structure
        kpis = data["kpis"]
        assert "total_students" in kpis
        assert kpis["total_students"] >= 3
        assert "face_registered_students" in kpis
        assert "face_registration_rate" in kpis
        assert "total_departments" in kpis
        assert kpis["total_departments"] >= 2
        assert "total_courses" in kpis
        assert "active_sessions_count" in kpis
        assert "today_sessions_count" in kpis
        assert "today_records_count" in kpis
        assert "low_attendance_students_count" in kpis

        # 3. Check Daily Trends (Past 7 days)
        trends = data["daily_trends"]
        assert len(trends) == 7
        for t in trends:
            assert "date" in t
            assert "day_name" in t
            assert "present_count" in t
            assert "late_count" in t
            assert "total_marked" in t

        # 4. Check Department Attendance
        dept_att = data["department_attendance"]
        assert len(dept_att) >= 2
        for d in dept_att:
            assert "department_id" in d
            assert "department_name" in d
            assert "department_code" in d
            assert "attendance_percentage" in d

        # 5. Check Status Distribution
        dist = data["status_distribution"]
        statuses = [s["status"] for s in dist]
        assert "PRESENT" in statuses
        assert "LATE" in statuses

        # 6. Check Low Attendance Alerts
        alerts = data["low_attendance_alerts"]
        assert isinstance(alerts, list)

@pytest.mark.asyncio
async def test_low_attendance_endpoint(auth_tokens):
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/dashboard/low-attendance?threshold=85.0", headers={"Authorization": f"Bearer {fac_token}"})
        assert res.status_code == 200
        alerts = res.json()
        assert isinstance(alerts, list)
        for a in alerts:
            assert "student_id" in a
            assert "roll_number" in a
            assert "student_name" in a
            assert "attendance_percentage" in a
            assert a["attendance_percentage"] < 85.0

@pytest.mark.asyncio
async def test_dashboard_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/dashboard/summary")
        assert res.status_code == 401
