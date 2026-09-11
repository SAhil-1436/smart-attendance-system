import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.audit import AuditLog
from sqlalchemy import select

@pytest.mark.asyncio
async def test_admin_login_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "ADMIN"

@pytest.mark.asyncio
async def test_faculty_login_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "username": "dr.sharma",
            "password": "Faculty@123"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "FACULTY"

@pytest.mark.asyncio
async def test_login_invalid_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "WrongPassword!999"
        })
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]

@pytest.mark.asyncio
async def test_login_nonexistent_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/auth/login", json={
            "username": "ghost_user",
            "password": "AnyPassword"
        })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_auth_me_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Unauthorized without token
        unauth_resp = await ac.get("/api/v1/auth/me")
        assert unauth_resp.status_code == 401

        # Login to get token
        login_resp = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "Admin@123"
        })
        token = login_resp.json()["access_token"]

        # Authorized with token
        auth_resp = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert auth_resp.status_code == 200
        user_data = auth_resp.json()
        assert user_data["username"] == "admin"
        assert user_data["role"] == "ADMIN"

@pytest.mark.asyncio
async def test_role_authorization_admin_vs_faculty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get admin token
        admin_login = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        admin_token = admin_login.json()["access_token"]

        # Get faculty token
        fac_login = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        fac_token = fac_login.json()["access_token"]

        # 1. Admin accessing admin-only route -> 200 OK
        res1 = await ac.get("/api/v1/auth/test-admin-only", headers={"Authorization": f"Bearer {admin_token}"})
        assert res1.status_code == 200

        # 2. Faculty accessing admin-only route -> 403 Forbidden
        res2 = await ac.get("/api/v1/auth/test-admin-only", headers={"Authorization": f"Bearer {fac_token}"})
        assert res2.status_code == 403
        assert "Access denied" in res2.json()["detail"]

        # 3. Faculty accessing faculty-or-admin route -> 200 OK
        res3 = await ac.get("/api/v1/auth/test-faculty-or-admin", headers={"Authorization": f"Bearer {fac_token}"})
        assert res3.status_code == 200

        # 4. Admin accessing faculty-or-admin route -> 200 OK
        res4 = await ac.get("/api/v1/auth/test-faculty-or-admin", headers={"Authorization": f"Bearer {admin_token}"})
        assert res4.status_code == 200

@pytest.mark.asyncio
async def test_logout_and_audit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        token = login_resp.json()["access_token"]

        logout_resp = await ac.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_resp.status_code == 200
        assert "Successfully logged out" in logout_resp.json()["message"]

    # Verify audit log recorded
    async with AsyncSessionLocal() as session:
        audit_res = await session.execute(
            select(AuditLog).where(AuditLog.action.in_(["USER_LOGIN", "USER_LOGOUT"])).order_by(AuditLog.id.desc())
        )
        logs = audit_res.scalars().all()
        assert len(logs) >= 2

@pytest.mark.asyncio
async def test_change_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login with current password
        login_resp = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        # 2. Change password with wrong current password -> 400
        bad_change = await ac.post(
            "/api/v1/auth/change-password",
            json={"current_password": "WrongPassword", "new_password": "NewSecret@456"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert bad_change.status_code == 400

        # 3. Change password successfully
        good_change = await ac.post(
            "/api/v1/auth/change-password",
            json={"current_password": "Admin@123", "new_password": "NewSecret@456"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert good_change.status_code == 200
        assert "Password updated successfully" in good_change.json()["message"]

        # 4. Old password fails
        fail_login = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@123"})
        assert fail_login.status_code == 401

        # 5. New password succeeds
        new_login = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "NewSecret@456"})
        assert new_login.status_code == 200
        new_token = new_login.json()["access_token"]

        # 6. Revert password back to Admin@123 for other tests
        revert_resp = await ac.post(
            "/api/v1/auth/change-password",
            json={"current_password": "NewSecret@456", "new_password": "Admin@123"},
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert revert_resp.status_code == 200

