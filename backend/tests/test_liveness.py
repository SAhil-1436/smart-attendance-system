import pytest
from httpx import AsyncClient, ASGITransport
import base64
import os
import cv2
import numpy as np
from app.main import app
from app.cv.liveness import (
    liveness_engine, 
    ACTION_TURN_LEFT, 
    ACTION_TURN_RIGHT, 
    ACTION_SMILE, 
    ACTION_BLINK,
    LivenessChallengeSession
)

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_face.jpg")

def get_base64_sample(filepath=FIXTURE_PATH):
    img = cv2.imread(filepath)
    _, buffer = cv2.imencode(".jpg", img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

def get_blank_base64():
    blank = np.zeros((300, 300, 3), dtype=np.uint8)
    _, buffer = cv2.imencode(".jpg", blank)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")

@pytest.fixture
async def auth_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        return res.json()["access_token"]

@pytest.mark.asyncio
async def test_create_challenge_endpoint(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/attendance/liveness/challenge",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    assert res.status_code == 200
    data = res.json()
    assert "challenge_id" in data
    assert len(data["actions"]) >= 2
    assert data["step"] == 1
    assert data["total_steps"] >= 2
    assert data["expires_in_seconds"] == 25
    assert len(data["instructions"]) > 5

@pytest.mark.asyncio
async def test_verify_step_invalid_session(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/attendance/liveness/verify-step",
            json={"challenge_id": "non-existent-uuid", "image_data": get_base64_sample()},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert "not found or expired" in data["message"]

@pytest.mark.asyncio
async def test_verify_step_blank_frame(auth_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create valid challenge first
        ch_res = await ac.post("/api/v1/attendance/liveness/challenge", headers={"Authorization": f"Bearer {auth_token}"})
        challenge_id = ch_res.json()["challenge_id"]

        # Send blank image
        res = await ac.post(
            "/api/v1/attendance/liveness/verify-step",
            json={"challenge_id": challenge_id, "image_data": get_blank_base64()},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert "No face detected" in data["message"]

def test_head_yaw_analysis():
    # Facing Left: Nose closer to left eye in image -> d_left >> d_right
    landmarks_left = [(200, 200), (320, 200), (300, 250), (220, 300), (300, 300)]
    pose_left, ratio_left = liveness_engine.analyze_head_yaw(landmarks_left)
    assert pose_left == ACTION_TURN_LEFT
    assert ratio_left >= 1.45

    # Facing Right: Nose closer to right eye in image -> d_left << d_right
    landmarks_right = [(200, 200), (320, 200), (220, 250), (220, 300), (300, 300)]
    pose_right, ratio_right = liveness_engine.analyze_head_yaw(landmarks_right)
    assert pose_right == ACTION_TURN_RIGHT
    assert ratio_right <= 0.65

    # Centered
    landmarks_center = [(200, 200), (300, 200), (250, 250), (220, 300), (280, 300)]
    pose_center, _ = liveness_engine.analyze_head_yaw(landmarks_center)
    assert pose_center == "CENTER"

def test_smile_analysis():
    # Wide smile: mouth_width > 0.66 * eye_dist
    re = (100, 100)
    le = (200, 100) # eye_dist = 100
    nt = (150, 150)
    rm = (110, 190)
    lm = (190, 190) # mouth_width = 80 -> ratio = 0.80
    is_smiling, ratio = liveness_engine.analyze_smile([re, le, nt, rm, lm])
    assert is_smiling is True
    assert ratio == 0.80

    # Neutral mouth: mouth_width = 50 -> ratio = 0.50
    rm_n = (125, 190)
    lm_n = (175, 190)
    is_smiling_n, ratio_n = liveness_engine.analyze_smile([re, le, nt, rm_n, lm_n])
    assert is_smiling_n is False
    assert ratio_n == 0.50

def test_receipt_token_lifecycle():
    # Create test session manually
    session = LivenessChallengeSession("test_session_id", [ACTION_TURN_LEFT, ACTION_SMILE])
    liveness_engine._sessions["test_session_id"] = session

    # Frame with Turn Left landmarks
    landmarks_left = [(200, 200), (320, 200), (300, 250), (220, 300), (300, 300)]
    session.completed_actions.append(ACTION_TURN_LEFT)
    session.current_step_index = 1

    # Simulate final step passed
    session.completed_actions.append(ACTION_SMILE)
    session.current_step_index = 2
    session.is_completed = True
    session.receipt_token = "LIVE_test_token_12345"
    import time
    session.receipt_expires_at = time.time() + 60.0

    # 1. First validation succeeds
    assert liveness_engine.validate_receipt("LIVE_test_token_12345") is True

    # 2. Second validation fails (single-use anti-replay protection!)
    assert liveness_engine.validate_receipt("LIVE_test_token_12345") is False
