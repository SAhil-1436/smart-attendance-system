import pytest
from httpx import AsyncClient, ASGITransport
import base64
import os
import cv2
import numpy as np
from app.main import app

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_face.jpg")

def get_base64_sample(filepath=FIXTURE_PATH, brightness_delta=0):
    img = cv2.imread(filepath)
    if brightness_delta != 0:
        img = cv2.convertScaleAbs(img, alpha=1.0, beta=brightness_delta)
    _, buffer = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

def get_dual_face_base64(filepath=FIXTURE_PATH):
    img = cv2.imread(filepath)
    dual = np.hstack([img, img])
    _, buffer = cv2.imencode(".jpg", dual)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

def get_blank_base64():
    blank = np.zeros((300, 300, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", blank)
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
async def test_full_face_recognition_flow(auth_tokens):
    admin_token = auth_tokens["admin"]
    fac_token = auth_tokens["faculty"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get first student and enroll them with fixture face
        students_res = await ac.get("/api/v1/students", headers={"Authorization": f"Bearer {admin_token}"})
        student = students_res.json()["items"][0]
        student_id = student["id"]

        sample_b64 = get_base64_sample()
        enroll_res = await ac.post(
            f"/api/v1/students/{student_id}/face-enroll",
            json={"images": [sample_b64, sample_b64, sample_b64]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert enroll_res.status_code == 200

        # 2. Recognize with matching face -> Expect Success
        rec_res = await ac.post(
            "/api/v1/attendance/recognize",
            json={
                "image_data": sample_b64,
                "course_id": student.get("course_id"),
                "semester": student.get("semester"),
                "section": student.get("section")
            },
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["face_detected"] is True
        assert rec_data["num_faces"] == 1
        assert rec_data["is_recognized"] is True
        assert rec_data["similarity_score"] > 0.85
        assert rec_data["confidence_level"] == "HIGH"
        assert rec_data["student"] is not None
        assert rec_data["student"]["id"] == student_id
        assert rec_data["student"]["name"] == student["name"]

        # 3. High threshold test -> Altered frame with threshold set higher than match
        altered_b64 = get_base64_sample(brightness_delta=30)
        high_thresh_res = await ac.post(
            "/api/v1/attendance/recognize",
            json={"image_data": altered_b64, "threshold": 0.99},
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert high_thresh_res.status_code == 200
        ht_data = high_thresh_res.json()
        assert ht_data["is_recognized"] is False
        assert ht_data["student"] is None  # Strictly no identity revealed when below threshold!
        assert "below configured threshold" in ht_data["message"]

        # 4. Blank frame -> No face detected
        blank_res = await ac.post(
            "/api/v1/attendance/recognize",
            json={"image_data": get_blank_base64()},
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert blank_res.status_code == 200
        assert blank_res.json()["face_detected"] is False
        assert blank_res.json()["is_recognized"] is False

        # 5. Dual face frame -> Multiple faces detected
        dual_res = await ac.post(
            "/api/v1/attendance/recognize",
            json={"image_data": get_dual_face_base64()},
            headers={"Authorization": f"Bearer {fac_token}"}
        )
        assert dual_res.status_code == 200
        dual_data = dual_res.json()
        assert dual_data["face_detected"] is True
        assert dual_data["num_faces"] == 2
        assert dual_data["is_recognized"] is False
        assert "Multiple faces" in dual_data["message"]
