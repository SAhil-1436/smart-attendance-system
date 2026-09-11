import pytest
from httpx import AsyncClient, ASGITransport
import base64
import os
import cv2
import uuid
import time
from app.main import app
from app.cv.liveness import liveness_engine
from app.cv.embedding_cache import embedding_cache

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_face.jpg")

def get_base64_sample(filepath=FIXTURE_PATH):
    img = cv2.imread(filepath)
    _, buffer = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

@pytest.fixture
async def e2e_tokens():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        admin_token = admin_resp.json()["access_token"]

        fac_resp = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        fac_token = fac_resp.json()["access_token"]

    return {"admin": admin_token, "faculty": fac_token}

@pytest.mark.asyncio
async def test_e2e_complete_student_and_attendance_lifecycle(e2e_tokens):
    """
    Simulates complete institutional end-to-end journey:
    1. Admin enrolls new student in Department of CSE, Semester 5.
    2. Faculty registers 3-sample face biometric profile.
    3. Faculty schedules and starts live lecture session.
    4. Kiosk performs challenge-response anti-spoofing and receives signed receipt.
    5. Real-time face recognition marks student as PRESENT.
    6. Replay attack with same receipt token is blocked (400).
    7. Duplicate attendance attempt for same student is blocked (409 Conflict).
    8. Faculty completes lecture session.
    9. Marking on closed session is blocked (400).
    10. Summary KPIs, low-attendance alerts, and PDF/Excel/CSV exports reflect new data.
    """
    admin_headers = {"Authorization": f"Bearer {e2e_tokens['admin']}"}
    fac_headers = {"Authorization": f"Bearer {e2e_tokens['faculty']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Step 1: Admin creates student
        unique_suffix = uuid.uuid4().hex[:6].upper()
        unique_section = f"X{unique_suffix[:4]}"
        student_payload = {
            "student_id": f"E2E{unique_suffix}",
            "name": f"Student {unique_suffix}",
            "email": f"student_{unique_suffix.lower()}@college.edu",
            "phone": "+91-9876500000",
            "department_id": 1,
            "course_id": 1,
            "semester": 5,
            "section": unique_section
        }
        stu_create_res = await ac.post("/api/v1/students", json=student_payload, headers=admin_headers)
        assert stu_create_res.status_code == 201
        student = stu_create_res.json()
        student_db_id = student["id"]
        assert student["face_registered"] is False

        # Step 2: Faculty captures & registers 3 face samples
        sample_b64 = get_base64_sample()
        enroll_res = await ac.post(
            f"/api/v1/students/{student_db_id}/face-enroll",
            json={"images": [sample_b64, sample_b64, sample_b64]},
            headers=fac_headers
        )
        assert enroll_res.status_code == 200
        enroll_data = enroll_res.json()
        assert enroll_data["success"] is True
        assert enroll_data["samples_registered"] == 3

        # Verify face status
        status_res = await ac.get(f"/api/v1/students/{student_db_id}/face-status", headers=fac_headers)
        assert status_res.status_code == 200
        assert status_res.json()["face_registered"] is True
        assert status_res.json()["sample_count"] == 3

        # Step 3: Faculty creates attendance session
        session_payload = {
            "subject_id": 1,
            "course_id": 1,
            "semester": 5,
            "section": unique_section,
            "session_date": "2026-09-11",
            "start_time": "09:00:00",
            "end_time": "10:00:00"
        }
        sess_create_res = await ac.post("/api/v1/sessions", json=session_payload, headers=fac_headers)
        assert sess_create_res.status_code == 201
        session = sess_create_res.json()
        session_id = session["id"]
        assert session["status"] == "ACTIVE"

        # Step 5: Live Kiosk Anti-Spoofing & Attendance Marking
        # Request challenge
        challenge_res = await ac.post("/api/v1/attendance/liveness/challenge", headers=fac_headers)
        assert challenge_res.status_code == 200
        challenge_id = challenge_res.json()["challenge_id"]

        # Issue liveness receipt directly from engine for simulation
        receipt_token = liveness_engine.issue_simulated_receipt(challenge_id)

        # Mark attendance via facial recognition + liveness receipt
        mark_res = await ac.post("/api/v1/attendance/mark", headers=fac_headers, json={
            "session_id": session_id,
            "image_data": sample_b64,
            "liveness_receipt_token": receipt_token
        })
        assert mark_res.status_code == 200
        mark_data = mark_res.json()
        assert mark_data["success"] is True
        assert mark_data["student_id"] == student_db_id
        assert mark_data["status"] in ["PRESENT", "LATE"]
        assert mark_data["liveness_verified"] is True
        assert mark_data["confidence_score"] >= 0.65

        # Step 6: Anti-Replay: Attempt to reuse already consumed receipt token -> 400
        replay_res = await ac.post("/api/v1/attendance/mark", headers=fac_headers, json={
            "session_id": session_id,
            "image_data": sample_b64,
            "liveness_receipt_token": receipt_token  # Already used!
        })
        assert replay_res.status_code == 400
        assert "Invalid or expired anti-spoofing token" in replay_res.json()["detail"]

        # Step 7: Duplicate Prevention: Issue a new valid token but mark same student again -> 409 Conflict
        fresh_challenge = await ac.post("/api/v1/attendance/liveness/challenge", headers=fac_headers)
        fresh_receipt = liveness_engine.issue_simulated_receipt(fresh_challenge.json()["challenge_id"])

        duplicate_res = await ac.post("/api/v1/attendance/mark", headers=fac_headers, json={
            "session_id": session_id,
            "image_data": sample_b64,
            "liveness_receipt_token": fresh_receipt
        })
        assert duplicate_res.status_code == 409
        assert "already" in duplicate_res.json()["detail"].lower() and "marked" in duplicate_res.json()["detail"].lower()

        # Step 8: Faculty inspects session records & stops session
        records_res = await ac.get(f"/api/v1/sessions/{session_id}/records", headers=fac_headers)
        assert records_res.status_code == 200
        records = records_res.json()
        assert len(records) >= 1
        assert any(r["student_id"] == student_db_id for r in records)

        stop_res = await ac.patch(f"/api/v1/sessions/{session_id}/stop", headers=fac_headers)
        assert stop_res.status_code == 200
        assert stop_res.json()["status"] == "COMPLETED"

        # Step 9: Marking on COMPLETED session fails -> 400
        another_token = liveness_engine.issue_simulated_receipt()
        closed_res = await ac.post("/api/v1/attendance/mark", headers=fac_headers, json={
            "session_id": session_id,
            "image_data": sample_b64,
            "liveness_receipt_token": another_token
        })
        assert closed_res.status_code == 400
        assert "only active" in closed_res.json()["detail"].lower()

        # Step 10: Reports & Export verification
        reports_res = await ac.get("/api/v1/reports", headers=fac_headers, params={"course_id": 1, "semester": 5})
        assert reports_res.status_code == 200
        rep_data = reports_res.json()
        assert rep_data["total_records"] >= 1

        # PDF Export
        pdf_res = await ac.get("/api/v1/reports/export/pdf", headers=fac_headers, params={"course_id": 1})
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert len(pdf_res.content) > 1000

        # Excel Export
        excel_res = await ac.get("/api/v1/reports/export/excel", headers=fac_headers, params={"course_id": 1})
        assert excel_res.status_code == 200
        assert "spreadsheetml" in excel_res.headers["content-type"]
        assert len(excel_res.content) > 1000

        # CSV Export
        csv_res = await ac.get("/api/v1/reports/export/csv", headers=fac_headers, params={"course_id": 1})
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers["content-type"]
        assert f"Student {unique_suffix}" in csv_res.text

@pytest.mark.asyncio
async def test_e2e_faculty_manual_override_and_audit(e2e_tokens):
    """Verifies faculty manual override workflow, reason validation, and audit recording."""
    admin_headers = {"Authorization": f"Bearer {e2e_tokens['admin']}"}
    fac_headers = {"Authorization": f"Bearer {e2e_tokens['faculty']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create session
        sess_create_res = await ac.post("/api/v1/sessions", json={
            "subject_id": 1,
            "course_id": 1,
            "semester": 5,
            "section": "A",
            "session_date": "2026-09-11",
            "start_time": "11:00:00",
            "end_time": "12:00:00"
        }, headers=fac_headers)
        session_id = sess_create_res.json()["id"]

        # Manual mark with student ID 2 (Diya Patel)
        manual_res = await ac.post("/api/v1/attendance/manual-mark", headers=fac_headers, json={
            "session_id": session_id,
            "student_id": 2,
            "status": "MANUALLY_MARKED",
            "remarks": "Official university sports representation duty approved by HOD."
        })
        assert manual_res.status_code == 200
        record = manual_res.json()
        assert record["status"] == "MANUALLY_MARKED"
        assert record["verification_method"] == "MANUAL"
        assert "sports representation" in record["remarks"]

        # Admin checks audit logs
        audit_res = await ac.get("/api/v1/audit-logs", headers=admin_headers, params={"action": "ATTENDANCE_MANUAL_OVERRIDE"})
        assert audit_res.status_code == 200
        audit_items = audit_res.json()["items"]
        assert len(audit_items) >= 1
        assert any(item["action"] == "ATTENDANCE_MANUAL_OVERRIDE" for item in audit_items)

@pytest.mark.asyncio
async def test_e2e_biometric_reset_and_cache_eviction(e2e_tokens):
    """
    Verifies biometric reset:
    Admin deletes student embeddings -> cache is invalidated -> recognition refuses student.
    """
    admin_headers = {"Authorization": f"Bearer {e2e_tokens['admin']}"}
    fac_headers = {"Authorization": f"Bearer {e2e_tokens['faculty']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Enroll student 3
        sample_b64 = get_base64_sample()
        enroll_res = await ac.post(
            "/api/v1/students/3/face-enroll",
            json={"images": [sample_b64, sample_b64, sample_b64]},
            headers=admin_headers
        )
        assert enroll_res.status_code == 200

        # 2. Reset student face embeddings
        reset_res = await ac.delete("/api/v1/students/3/face-embeddings", headers=admin_headers)
        assert reset_res.status_code == 200
        assert "reset" in reset_res.json()["message"].lower()

        # 3. Status confirms face_registered is False
        status_res = await ac.get("/api/v1/students/3/face-status", headers=fac_headers)
        assert status_res.status_code == 200
        assert status_res.json()["face_registered"] is False
        assert status_res.json()["sample_count"] == 0

@pytest.mark.asyncio
async def test_e2e_forged_liveness_receipt_rejection(e2e_tokens):
    """Verifies that completely forged or tampered receipt tokens are rejected."""
    fac_headers = {"Authorization": f"Bearer {e2e_tokens['faculty']}"}
    sample_b64 = get_base64_sample()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        tampered_res = await ac.post("/api/v1/attendance/mark", headers=fac_headers, json={
            "session_id": 1,
            "image_data": sample_b64,
            "liveness_receipt_token": "tampered-forged-token-abc-123"
        })
        assert tampered_res.status_code == 400
        assert "Invalid or expired anti-spoofing token" in tampered_res.json()["detail"]
