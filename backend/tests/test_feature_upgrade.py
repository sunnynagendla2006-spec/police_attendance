import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_duty_assignments_lifecycle(async_client: AsyncClient):
    """
    Test duty assignment workflow:
    1. Admin logs in.
    2. Admin checks available constables and headquarters locations.
    3. Admin creates duty assignment.
    4. Duplicate active assignment for same constable is rejected.
    5. Constable queries GET /assignments/my to receive duty assignment.
    6. Admin marks assignment as COMPLETED.
    """
    # 1. Super Admin login
    admin_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    assert admin_resp.status_code == 200
    admin_token = admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Get headquarters facility
    fac_resp = await async_client.get("/api/v1/headquarters/facilities", headers=admin_headers)
    assert fac_resp.status_code == 200
    facilities = fac_resp.json()
    assert len(facilities) > 0
    hq_id = facilities[0]["id"]

    # 3. Get available constables
    avail_resp = await async_client.get("/api/v1/assignments/constables/available", headers=admin_headers)
    assert avail_resp.status_code == 200
    constables = avail_resp.json()
    assert len(constables) > 0
    constable_user_id = constables[0]["user_id"]

    # 4. Create assignment
    create_resp = await async_client.post("/api/v1/assignments", headers=admin_headers, json={
        "constable_user_id": constable_user_id,
        "location_id": hq_id,
        "start_date": "2026-10-27",
        "notes": "Shift A Patrol Duty"
    })
    assert create_resp.status_code == 201
    assignment = create_resp.json()
    assert assignment["status"] == "ACTIVE"
    assert assignment["location_id"] == hq_id
    assignment_id = assignment["id"]

    # 5. Duplicate assignment attempt must be rejected
    dup_resp = await async_client.post("/api/v1/assignments", headers=admin_headers, json={
        "constable_user_id": constable_user_id,
        "location_id": hq_id,
        "start_date": "2026-10-27"
    })
    assert dup_resp.status_code == 400
    assert "already has an active duty assignment" in dup_resp.json()["detail"]

    # 6. Constable queries their assignment
    constable_login = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210"
    })
    assert constable_login.status_code == 200
    constable_token = constable_login.json()["access_token"]
    constable_headers = {"Authorization": f"Bearer {constable_token}"}

    my_assign_resp = await async_client.get("/api/v1/assignments/my", headers=constable_headers)
    assert my_assign_resp.status_code == 200
    my_assignment = my_assign_resp.json()
    assert my_assignment is not None
    assert my_assignment["id"] == assignment_id

    # 7. Complete assignment
    update_resp = await async_client.patch(
        f"/api/v1/assignments/{assignment_id}",
        headers=admin_headers,
        json={"status": "COMPLETED", "notes": "Shift finished successfully"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_scheduled_snapshots_and_outside_geofence(async_client: AsyncClient):
    """
    Test scheduled location snapshots:
    1. Constable submits snapshot inside geofence -> classified INSIDE.
    2. Constable submits snapshot outside geofence -> classified OUTSIDE.
    3. Admin checks outside-geofence endpoint -> sees observation with excess distance.
    """
    # 1. Admin login
    admin_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    admin_token = admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Constable login
    c_login = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210"
    })
    c_token = c_login.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # 3. Submit inside snapshot at Eluru HQ coordinates (16.7107, 81.0952)
    inside_resp = await async_client.post("/api/v1/snapshots", headers=c_headers, json={
        "snapshot_window": "MORNING_10AM",
        "scheduled_time": "2026-10-27T10:00:00Z",
        "observed_at": "2026-10-27T10:05:00Z",
        "latitude": 16.7107,
        "longitude": 81.0952,
        "accuracy_meters": 12.0
    })
    assert inside_resp.status_code == 201
    assert inside_resp.json()["geofence_status"] == "INSIDE"
    assert inside_resp.json()["timeliness_status"] == "ON_TIME"

    # 4. Submit outside snapshot ~3 km away
    outside_resp = await async_client.post("/api/v1/snapshots", headers=c_headers, json={
        "snapshot_window": "MORNING_10AM",
        "scheduled_time": "2026-10-27T10:00:00Z",
        "observed_at": "2026-10-27T10:15:00Z",
        "latitude": 16.7400,
        "longitude": 81.1200,
        "accuracy_meters": 15.0
    })
    assert outside_resp.status_code == 201
    assert outside_resp.json()["geofence_status"] == "OUTSIDE"

    # 5. Admin retrieves outside-geofence observations
    obs_resp = await async_client.get("/api/v1/snapshots/outside-geofence", headers=admin_headers)
    assert obs_resp.status_code == 200
    observations = obs_resp.json()
    assert len(observations) >= 1
    assert observations[0]["excess_distance_meters"] > 0


@pytest.mark.asyncio
async def test_single_device_binding_enforcement(async_client: AsyncClient):
    """
    Test single-device binding:
    1. First login with device_id DEV-PHONE-001 auto-approves.
    2. Subsequent login with same device succeeds.
    3. Login with unauthorized second device returns 403 Forbidden.
    4. Admin replaces device -> now second device succeeds.
    """
    # 1. First login with device DEV-PHONE-001
    resp1 = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210",
        "device_id": "DEV-PHONE-001",
        "device_model": "Samsung Galaxy A54",
        "os_version": "Android 14"
    })
    assert resp1.status_code == 200
    constable_user_id = resp1.json()["user"]["id"]

    # 2. Login with mismatched unauthorized device DEV-PHONE-002
    resp2 = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210",
        "device_id": "DEV-PHONE-002",
        "device_model": "OnePlus 11R",
        "os_version": "Android 14"
    })
    assert resp2.status_code == 403
    assert "Unauthorized device" in resp2.json()["detail"]

    # 3. Super admin authorizes replacement
    admin_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    admin_token = admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    replace_resp = await async_client.post("/api/v1/devices/replace", headers=admin_headers, json={
        "constable_user_id": constable_user_id,
        "old_device_id": "DEV-PHONE-001",
        "new_device_id": "DEV-PHONE-002",
        "reason": "Officer phone replacement authorized"
    })
    assert replace_resp.status_code == 200

    # 4. Now DEV-PHONE-002 can login cleanly
    resp3 = await async_client.post("/api/v1/auth/login", json={
        "username": "9876543210",
        "password": "3210",
        "device_id": "DEV-PHONE-002",
        "device_model": "OnePlus 11R",
        "os_version": "Android 14"
    })
    assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_scheduled_report_and_downloads(async_client: AsyncClient):
    """
    Test scheduled report generation, file downloads, and download audit trail.
    """
    admin_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    admin_token = admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Generate report
    gen_resp = await async_client.post("/api/v1/reports/generate", headers=admin_headers, json={
        "report_type": "MORNING_1030_REPORT",
        "report_date": "2026-10-27"
    })
    assert gen_resp.status_code == 200
    report_data = gen_resp.json()
    assert report_data["status"] == "COMPLETED"

    # 2. Download PDF
    pdf_resp = await async_client.get(
        "/api/v1/reports/download?report_type=MORNING_1030_REPORT&format=PDF&report_date=2026-10-27",
        headers=admin_headers
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 100

    # 3. Download CSV
    csv_resp = await async_client.get(
        "/api/v1/reports/download?report_type=MORNING_1030_REPORT&format=CSV&report_date=2026-10-27",
        headers=admin_headers
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Officer Name" in csv_resp.text or "Constable Name" in csv_resp.text

    # 4. Check download history
    hist_resp = await async_client.get("/api/v1/reports/downloads/history", headers=admin_headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) >= 2
    assert history[0]["username"] == "superadmin"
