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
async def test_get_attendance_report_json(auth_tokens):
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reports", headers={"Authorization": f"Bearer {fac_token}"})
        assert res.status_code == 200
        data = res.json()
        assert "total_records" in data
        assert "total_sessions" in data
        assert "unique_students" in data
        assert "average_attendance_percentage" in data
        assert "records" in data
        assert "student_summaries" in data
        assert isinstance(data["records"], list)
        assert isinstance(data["student_summaries"], list)

@pytest.mark.asyncio
async def test_export_pdf_report(auth_tokens):
    admin_token = auth_tokens["admin"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reports/export/pdf", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert "Content-Disposition" in res.headers
        assert "attachment; filename=" in res.headers["Content-Disposition"]
        # PDF files begin with the magic header %PDF-
        assert res.content.startswith(b"%PDF-")

@pytest.mark.asyncio
async def test_export_excel_report(auth_tokens):
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reports/export/excel", headers={"Authorization": f"Bearer {fac_token}"})
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "Content-Disposition" in res.headers
        assert ".xlsx" in res.headers["Content-Disposition"]
        # XLSX files are ZIP archives beginning with magic header PK\x03\x04
        assert res.content.startswith(b"PK")

@pytest.mark.asyncio
async def test_export_csv_report(auth_tokens):
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reports/export/csv", headers={"Authorization": f"Bearer {fac_token}"})
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "Content-Disposition" in res.headers
        assert ".csv" in res.headers["Content-Disposition"]
        text = res.content.decode("utf-8-sig")
        assert "Record ID" in text
        assert "Roll Number" in text
        assert "Status" in text

@pytest.mark.asyncio
async def test_reports_unauthenticated():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/reports")
        assert res.status_code == 401
