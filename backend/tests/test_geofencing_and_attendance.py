import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.services.geofence_engine import calculate_haversine_distance_meters, evaluate_geofence_state

def test_haversine_distance():
    """Verify spherical distance calculation accuracy."""
    hq_lat, hq_lon = 16.7107, 81.0952
    # Same point gives 0
    assert calculate_haversine_distance_meters(hq_lat, hq_lon, hq_lat, hq_lon) == 0.0

    # ~110m north (1 degree lat ~= 111,000m -> 0.001 deg ~= 111m)
    dist = calculate_haversine_distance_meters(hq_lat, hq_lon, hq_lat + 0.001, hq_lon)
    assert 105.0 < dist < 115.0

def test_geofence_state_and_hysteresis():
    """Verify state machine, hysteresis buffer, and poor accuracy filtering."""
    radius = 100.0
    accuracy_thresh = 35.0
    hysteresis = 10.0

    # 1. Clear Entry: distance 50m, accuracy 10m -> from OUTSIDE to INSIDE (ENTRY)
    state, is_trans, trans_type = evaluate_geofence_state(
        distance_meters=50.0,
        accuracy_meters=10.0,
        current_state="OUTSIDE",
        radius_meters=radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )
    assert state == "INSIDE"
    assert is_trans is True
    assert trans_type == "ENTRY"

    # 2. Hysteresis Buffer: officer at 105m while currently INSIDE
    # (outer boundary is 100 + 10 = 110m, so 105m is EXITING buffer, not confirmed EXIT)
    state, is_trans, trans_type = evaluate_geofence_state(
        distance_meters=105.0,
        accuracy_meters=10.0,
        current_state="INSIDE",
        radius_meters=radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )
    assert state == "EXITING"
    assert is_trans is False
    assert trans_type == "NONE"

    # 3. Confirmed Exit: officer reaches 150m (> 110m outer boundary)
    state, is_trans, trans_type = evaluate_geofence_state(
        distance_meters=150.0,
        accuracy_meters=10.0,
        current_state="EXITING",
        radius_meters=radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )
    assert state == "OUTSIDE"
    assert is_trans is True
    assert trans_type == "EXIT"

    # 4. Poor Accuracy: accuracy 60m (> threshold 35m) -> state remains unchanged
    state, is_trans, trans_type = evaluate_geofence_state(
        distance_meters=20.0,
        accuracy_meters=60.0,
        current_state="OUTSIDE",
        radius_meters=radius,
        accuracy_threshold_meters=accuracy_thresh,
        hysteresis_meters=hysteresis
    )
    assert state == "OUTSIDE"
    assert is_trans is False
    assert trans_type == "NONE"

@pytest.mark.asyncio
async def test_geofence_radius_update(async_client: AsyncClient):
    """Test administrator updating geofence radius to 150m with change reason."""
    # Login as Super Admin
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update geofence radius
    update_resp = await async_client.patch("/api/v1/headquarters/geofence", headers=headers, json={
        "radius_meters": 150.0,
        "accuracy_threshold_meters": 35.0,
        "stale_threshold_seconds": 300,
        "change_reason": "Perimeter expansion to include outer parade ground"
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["radius_meters"] == 150.0

    # Check history
    hist_resp = await async_client.get("/api/v1/headquarters/geofence/history", headers=headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()["history"]) >= 1

@pytest.mark.asyncio
async def test_full_attendance_lifecycle(async_client: AsyncClient):
    """
    Test real visit ledger workflow:
    1. Constable logs in, changes initial password.
    2. Reports location inside HQ -> creates OPEN visit.
    3. Repeated location inside HQ -> does NOT duplicate visit.
    4. Constable reports location outside HQ -> closes visit, computes duration.
    5. Second visit later in day -> creates second visit, closes it.
    6. Checks summary reflects 2 separate visits and sum of durations.
    """
    # 1. Login with initial temporary password '3210'
    init_login = await async_client.post("/api/v1/auth/login", json={
        "username": "constable101",
        "password": "3210"
    })
    temp_token = init_login.json()["access_token"]
    temp_headers = {"Authorization": f"Bearer {temp_token}"}

    # Change password
    change_resp = await async_client.post("/api/v1/auth/change-password", headers=temp_headers, json={
        "current_password": "3210",
        "new_password": "Constable@Eluru123",
        "confirm_password": "Constable@Eluru123"
    })
    assert change_resp.status_code == 200

    # Fresh login with new password
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "constable101",
        "password": "Constable@Eluru123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # HQ coordinates: 16.7107, 81.0952
    now = datetime.now(timezone.utc)

    # 2. First Entry: observed inside HQ (lat 16.7107, lon 81.0952, dist ~0m)
    entry_time1 = now - timedelta(hours=3)
    resp = await async_client.post("/api/v1/location/observations", headers=headers, json={
        "latitude": 16.7107,
        "longitude": 81.0952,
        "accuracy_meters": 12.0,
        "observed_at": entry_time1.isoformat()
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_inside"] is True
    assert data["current_state"] == "INSIDE"

    # 3. Repeated report inside HQ after 10 minutes -> no duplicate visit
    resp = await async_client.post("/api/v1/location/observations", headers=headers, json={
        "latitude": 16.71075,
        "longitude": 81.09522,
        "accuracy_meters": 10.0,
        "observed_at": (entry_time1 + timedelta(minutes=10)).isoformat()
    })
    assert resp.status_code == 200

    # 4. Exit 1: observed outside HQ (lat 16.7500, lon 81.1500, dist ~7km)
    exit_time1 = entry_time1 + timedelta(minutes=45)
    resp = await async_client.post("/api/v1/location/observations", headers=headers, json={
        "latitude": 16.7500,
        "longitude": 81.1500,
        "accuracy_meters": 15.0,
        "observed_at": exit_time1.isoformat()
    })
    assert resp.status_code == 200
    assert resp.json()["current_state"] == "OUTSIDE"

    # 5. Second Entry: enters again 1 hour later
    entry_time2 = now - timedelta(hours=1)
    resp = await async_client.post("/api/v1/location/observations", headers=headers, json={
        "latitude": 16.71072,
        "longitude": 81.09518,
        "accuracy_meters": 8.0,
        "observed_at": entry_time2.isoformat()
    })
    assert resp.status_code == 200
    assert resp.json()["current_state"] == "INSIDE"

    # 6. Second Exit: exits 30 minutes later
    exit_time2 = entry_time2 + timedelta(minutes=30)
    resp = await async_client.post("/api/v1/location/observations", headers=headers, json={
        "latitude": 16.7600,
        "longitude": 81.1600,
        "accuracy_meters": 14.0,
        "observed_at": exit_time2.isoformat()
    })
    assert resp.status_code == 200
    assert resp.json()["current_state"] == "OUTSIDE"

    # 7. Verify Constable's "my-attendance" response
    att_resp = await async_client.get("/api/v1/attendance/my-attendance", headers=headers)
    assert att_resp.status_code == 200
    my_att = att_resp.json()
    assert my_att["today"]["visit_count"] == 2
    # Visit 1 was 45 min (2700s), Visit 2 was 30 min (1800s) -> total 4500s (01h 15m)
    assert my_att["today"]["total_seconds"] == 4500
    assert my_att["today"]["total_formatted"] == "01h 15m"


@pytest.mark.asyncio
async def test_register_new_facility_short_name(async_client: AsyncClient):
    """Test registering a new facility with short name (e.g. 'l1', 'I1') and custom coordinates."""
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await async_client.post("/api/v1/headquarters", headers=headers, json={
        "name": "I1",
        "code": "AP-ELR-701",
        "state": "Andhra Pradesh",
        "district": "Eluru",
        "city": "Eluru",
        "address": "IIIT Nuzvid",
        "latitude": 16.795184,
        "longitude": 80.823093,
        "radius_meters": 100.0,
        "status": "ACTIVE",
        "is_primary": False
    })
    assert create_resp.status_code == 201
    data = create_resp.json()
    assert data["name"] == "I1"
    assert data["code"] == "AP-ELR-701"
    assert data["latitude"] == 16.795184
    assert data["longitude"] == 80.823093
