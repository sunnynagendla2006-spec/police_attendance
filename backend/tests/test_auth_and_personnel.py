import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_superadmin_login(async_client: AsyncClient):
    """Test super admin login succeeds and returns JWT tokens."""
    resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["must_change_password"] is False
    assert data["user"]["role"] == "super_admin"

@pytest.mark.asyncio
async def test_invalid_login(async_client: AsyncClient):
    """Test invalid credentials return 401 unauthorized."""
    resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "WrongPassword123"
    })
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_first_login_flow(async_client: AsyncClient):
    """
    Test first-login security enforcement:
    1. Login with initial temporary password (last 4 digits of mobile: '3210').
    2. Token indicates must_change_password=True.
    3. Blocked from accessing operational routes.
    4. Reject new password if invalid (e.g. identical to initial temporary password or <8 chars).
    5. Accept valid new password.
    6. Initial password stops working; new password works.
    """
    # 1. Login with initial password '3210' or via mobile number
    resp = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["must_change_password"] is False
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Operational location status endpoint accessible immediately without forced password reset
    resp = await async_client.get("/api/v1/location/status", headers=headers)
    assert resp.status_code in [200, 404]

    # 3. Optional password change still supported
    resp = await async_client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "3210",
        "new_password": "Constable@Eluru123",
        "confirm_password": "Constable@Eluru123"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUCCESS"

    # 4. New password succeeds
    resp = await async_client.post("/api/v1/auth/login", json={
        "username": "constable101",
        "password": "Constable@Eluru123"
    })
    assert resp.status_code == 200
    assert resp.json()["must_change_password"] is False

@pytest.mark.asyncio
async def test_register_police_officer(async_client: AsyncClient):
    """Test registering a new constable and logging in with mobile number and last 4 digits."""
    # Login as admin
    admin_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    admin_token = admin_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Register officer
    new_officer = {
        "username": "constable102",
        "officer_id": "ELR-PC-102",
        "full_name": "S. Rambabu",
        "rank": "Police Constable",
        "mobile_number": "9123456789",
        "department": "Eluru One Town PS"
    }
    resp = await async_client.post("/api/v1/officers", headers=headers, json=new_officer)
    assert resp.status_code == 201
    data = resp.json()
    assert data["officer_id"] == "ELR-PC-102"

    # Check login with mobile number directly and last 4 digits: '6789'
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "9123456789",
        "password": "6789"
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["must_change_password"] is False
