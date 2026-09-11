import pytest
from httpx import AsyncClient, ASGITransport
import base64
import os
import cv2
import uuid
from app.main import app
from app.cv.liveness import liveness_engine

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_face.jpg")

def get_base64_sample(filepath=FIXTURE_PATH):
    img = cv2.imread(filepath)
    _, buffer = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

@pytest.fixture
async def auth_tokens():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        admin_token = admin_resp.json()["access_token"]

        fac_resp = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        fac_token = fac_resp.json()["access_token"]

    return {"admin": admin_token, "faculty": fac_token}

@pytest.mark.asyncio
async def test_session_lifecycle_and_attendance_marking(auth_tokens):
    admin_token = auth_tokens["admin"]
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch subjects and courses
        subjects_res = await ac.get("/api/v1/academic/subjects", headers={"Authorization": f"Bearer {admin_token}"})
        assert subjects_res.status_code == 200
        subjects = subjects_res.json()
        assert len(subjects) > 0
        subject = subjects[0]

        courses_res = await ac.get("/api/v1/academic/courses", headers={"Authorization": f"Bearer {admin_token}"})
        courses = courses_res.json()
        course = courses[0]

        # 2. Enroll face for student 1
        students_res = await ac.get("/api/v1/students", headers={"Authorization": f"Bearer {admin_token}"})
        students = students_res.json()["items"]
        student = students[0]
        student_id = student["id"]

        sample_b64 = get_base64_sample()
        enroll_res = await ac.post(
            f"/api/v1/students/{student_id}/face-enroll",
            json={"images": [sample_b64, sample_b64, sample_b64]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert enroll_res.status_code == 200

        # 3. Create Session as Faculty
        create_res = await ac.post(
            "/api/v1/sessions",
            json={
                "subject_id": subject["id"],
                "course_id": course["id"],
                "semester": student["semester"],
                "section": student["section"]
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert create_res.status_code == 201
        session_data = create_res.json()
        session_id = session_data["id"]
        assert session_data["status"] == "ACTIVE"
        assert session_data["session_code"].startswith("SESS-")
        assert session_data["present_count"] == 0

        # 4. List sessions
        list_res = await ac.get("/api/v1/sessions", headers={"Authorization": f"Bearer {fac_token}"})
        assert list_res.status_code == 200
        session_ids = [s["id"] for s in list_res.json()]
        assert session_id in session_ids

        # 5. Attempt marking attendance without liveness receipt -> Expect 400
        no_live_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert no_live_res.status_code == 400
        assert "Anti-spoofing verification required" in no_live_res.json()["detail"]

        # 6. Attempt marking with forged / expired token -> Expect 400
        fake_live_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64,
                "liveness_receipt_token": "fake-invalid-token"
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert fake_live_res.status_code == 400
        assert "Invalid or expired" in fake_live_res.json()["detail"]

        # 7. Generate a valid liveness receipt token in liveness engine
        challenge = liveness_engine.create_challenge()
        challenge_id = challenge["challenge_id"]
        # Manually complete the session in memory to get valid receipt token
        c_sess = liveness_engine._sessions[challenge_id]

        c_sess.is_completed = True
        token = str(uuid.uuid4())
        import time
        c_sess.receipt_token = token
        c_sess.receipt_expires_at = time.time() + 60

        # 8. Mark attendance with valid token -> Expect Success!
        mark_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64,
                "liveness_receipt_token": token
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert mark_res.status_code == 200
        mark_data = mark_res.json()
        assert mark_data["success"] is True
        assert mark_data["student_id"] == student_id
        assert mark_data["student_name"] == student["name"]
        assert mark_data["roll_number"] == student["student_id"]
        assert mark_data["liveness_verified"] is True
        assert mark_data["status"] in ["PRESENT", "LATE"]

        # 9. Verify Token is single-use and consumed -> Replay attack test
        replay_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64,
                "liveness_receipt_token": token
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert replay_res.status_code == 400
        assert "Invalid or expired" in replay_res.json()["detail"]

        # 10. Generate fresh token and attempt DUPLICATE attendance -> Expect 409 Conflict
        challenge2 = liveness_engine.create_challenge()
        c_sess2 = liveness_engine._sessions[challenge2["challenge_id"]]
        c_sess2.is_completed = True

        token2 = str(uuid.uuid4())
        c_sess2.receipt_token = token2
        c_sess2.receipt_expires_at = time.time() + 60

        dup_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64,
                "liveness_receipt_token": token2
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert dup_res.status_code == 409
        assert "Duplicate attendance" in dup_res.json()["detail"]

        # 11. Manual override test: Faculty manually marks student 2
        student2 = students[1]
        manual_res = await ac.post(
            "/api/v1/attendance/manual-mark",
            json={
                "session_id": session_id,
                "student_id": student2["id"],
                "status": "PRESENT",
                "remarks": "Exempted medical leave approval shown to faculty"
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert manual_res.status_code == 200
        m_data = manual_res.json()
        assert m_data["status"] == "PRESENT"
        assert m_data["verification_method"] == "MANUAL"
        assert m_data["remarks"] == "Exempted medical leave approval shown to faculty"

        # 12. View session records list
        records_res = await ac.get(
            f"/api/v1/sessions/{session_id}/records",
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert records_res.status_code == 200
        records = records_res.json()
        assert len(records) >= 2
        marked_student_ids = [r["student_id"] for r in records]
        assert student_id in marked_student_ids
        assert student2["id"] in marked_student_ids

        # 13. Stop session
        stop_res = await ac.patch(
            f"/api/v1/sessions/{session_id}/stop",
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert stop_res.status_code == 200
        assert stop_res.json()["status"] == "COMPLETED"

        # 14. Attempt to mark on COMPLETED session -> Expect 400
        challenge3 = liveness_engine.create_challenge()
        c_sess3 = liveness_engine._sessions[challenge3["challenge_id"]]
        c_sess3.is_completed = True

        token3 = str(uuid.uuid4())
        c_sess3.receipt_token = token3
        c_sess3.receipt_expires_at = time.time() + 60

        stopped_mark_res = await ac.post(
            "/api/v1/attendance/mark",
            json={
                "session_id": session_id,
                "image_data": sample_b64,
                "liveness_receipt_token": token3
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert stopped_mark_res.status_code == 400
        assert "COMPLETED" in stopped_mark_res.json()["detail"]
