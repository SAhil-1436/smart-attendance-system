import pytest
from httpx import AsyncClient, ASGITransport
import base64
import os
import cv2
import numpy as np
from app.main import app

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_face.jpg")

def get_base64_sample(filepath=FIXTURE_PATH, blur=False):
    img = cv2.imread(filepath)
    if img is None:
        raise FileNotFoundError(f"Fixture not found at {filepath}")
    if blur:
        img = cv2.GaussianBlur(img, (7, 7), 0)
    _, buffer = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

def get_blank_base64():
    blank = np.zeros((300, 300, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", blank)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

@pytest.fixture
async def auth_headers():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_validate_frame_no_face(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        blank_b64 = get_blank_base64()
        res = await ac.post("/api/v1/face/validate-frame", json={"image_data": blank_b64}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["face_detected"] is False
    assert data["valid"] is False
    assert "No face detected" in data["message"]

@pytest.mark.asyncio
async def test_validate_frame_valid_face(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        valid_b64 = get_base64_sample()
        res = await ac.post("/api/v1/face/validate-frame", json={"image_data": valid_b64}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["face_detected"] is True
    assert data["valid"] is True
    assert data["confidence"] > 0.80
    assert data["bbox"] is not None

@pytest.mark.asyncio
async def test_validate_frame_blurry_face(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        blurry_b64 = get_base64_sample(blur=True)
        res = await ac.post("/api/v1/face/validate-frame", json={"image_data": blurry_b64}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert "blurry" in data["message"].lower()

@pytest.mark.asyncio
async def test_student_face_enrollment_lifecycle(auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get first student
        students_res = await ac.get("/api/v1/students", headers=auth_headers)
        student_id = students_res.json()["items"][0]["id"]

        # Initial face status
        status_before = await ac.get(f"/api/v1/students/{student_id}/face-status", headers=auth_headers)
        assert status_before.status_code == 200

        # Attempt enrollment with fewer than 3 samples -> 422
        bad_enroll = await ac.post(
            f"/api/v1/students/{student_id}/face-enroll",
            json={"images": [get_base64_sample()]},
            headers=auth_headers
        )
        assert bad_enroll.status_code == 422

        # Successful enrollment with 3 valid samples
        samples = [get_base64_sample(), get_base64_sample(), get_base64_sample()]
        enroll_res = await ac.post(
            f"/api/v1/students/{student_id}/face-enroll",
            json={"images": samples},
            headers=auth_headers
        )
        assert enroll_res.status_code == 200
        enroll_data = enroll_res.json()
        assert enroll_data["success"] is True
        assert enroll_data["samples_registered"] == 3
        assert enroll_data["average_quality"] > 0.0

        # Verify face status now shows registered
        status_after = await ac.get(f"/api/v1/students/{student_id}/face-status", headers=auth_headers)
        assert status_after.status_code == 200
        assert status_after.json()["face_registered"] is True
        assert status_after.json()["sample_count"] == 3

        # Reset / delete face embeddings
        reset_res = await ac.delete(f"/api/v1/students/{student_id}/face-embeddings", headers=auth_headers)
        assert reset_res.status_code == 200

        # Verify face status reset
        status_reset = await ac.get(f"/api/v1/students/{student_id}/face-status", headers=auth_headers)
        assert status_reset.json()["face_registered"] is False
        assert status_reset.json()["sample_count"] == 0
