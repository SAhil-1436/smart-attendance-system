import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.rate_limiter import rate_limiter

@pytest.mark.asyncio
async def test_security_headers_presence():
    """Verify that SecurityHeadersMiddleware injects required defensive HTTP headers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    
    assert response.status_code == 200
    headers = response.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=(self)" in headers.get("Permissions-Policy", "")

@pytest.mark.asyncio
async def test_payload_limit_middleware():
    """Verify that oversized payloads (> 15MB) are blocked with HTTP 413."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Send an oversized content-length header
        response = await ac.post(
            "/api/v1/face/validate-frame",
            headers={"Content-Length": "20000000"},  # ~20MB
            content=b"test"
        )
    assert response.status_code == 413
    data = response.json()
    assert "Payload too large" in data["detail"]

@pytest.mark.asyncio
async def test_sliding_window_rate_limiting_login():
    """Verify that rapid requests exceed rate limit and trigger HTTP 429 with Retry-After."""
    await rate_limiter.reset()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # The limit for auth login is 10 requests per 60 seconds
        for i in range(10):
            res = await ac.post("/api/v1/auth/login", json={
                "username": "admin",
                "password": "WrongPassword!"
            })
            assert res.status_code == 401  # Bad auth, but rate limit permitted
            assert "X-RateLimit-Limit" in res.headers
            assert res.headers["X-RateLimit-Limit"] == "10"
            assert "X-RateLimit-Remaining" in res.headers

        # 11th request must trigger HTTP 429
        rate_blocked = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "WrongPassword!"
        })
        assert rate_blocked.status_code == 429
        assert "Too many requests" in rate_blocked.json()["detail"]
        assert "Retry-After" in rate_blocked.headers
        assert rate_blocked.headers["X-RateLimit-Remaining"] == "0"

    # Reset limiter for subsequent tests
    await rate_limiter.reset()

@pytest.mark.asyncio
async def test_biometric_vectors_never_exposed():
    """Verify that API outputs strictly shield raw biometric embeddings."""
    await rate_limiter.reset()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Admin login
        login_res = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check student directory
        students_res = await ac.get("/api/v1/students", headers=headers)
        assert students_res.status_code == 200
        students_data = students_res.json()["items"]
        for st in students_data:
            assert "embedding_vector" not in st
            assert "embeddings" not in st
            assert "vector" not in st

        # Check single student
        single_res = await ac.get(f"/api/v1/students/{students_data[0]['id']}", headers=headers)
        assert single_res.status_code == 200
        assert "embedding_vector" not in single_res.json()

        # Check face status endpoint
        face_status_res = await ac.get(f"/api/v1/students/{students_data[0]['id']}/face-status", headers=headers)
        assert face_status_res.status_code == 200
        face_data = face_status_res.json()
        assert "embedding_vector" not in face_data
        assert "face_registered" in face_data
        assert "sample_count" in face_data

    await rate_limiter.reset()

@pytest.mark.asyncio
async def test_audit_logs_rbac_and_content():
    """Verify that audit logs are restricted to ADMIN and log security operations."""
    await rate_limiter.reset()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Faculty login
        fac_login = await ac.post("/api/v1/auth/login", json={
            "username": "dr.sharma",
            "password": "Faculty@123"
        })
        fac_token = fac_login.json()["access_token"]

        # Faculty attempts to read audit logs -> 403 Forbidden
        fac_resp = await ac.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {fac_token}"})
        assert fac_resp.status_code == 403

        # 2. Admin login
        admin_login = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
        admin_token = admin_login.json()["access_token"]

        # Admin reads audit logs -> 200 OK
        admin_resp = await ac.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
        assert admin_resp.status_code == 200
        data = admin_resp.json()
        assert "total" in data
        assert "items" in data
        assert data["total"] >= 1

        # Verify audit logs do not leak raw embeddings in details_json
        for log_item in data["items"]:
            if log_item.get("details_json"):
                assert "embedding_vector" not in log_item["details_json"]

    await rate_limiter.reset()
