import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_analytics_and_reports(async_client: AsyncClient):
    """Test analytics overview, CSV export, and PDF generation."""
    # Login as Super Admin
    login_resp = await async_client.post("/api/v1/auth/login", json={
        "username": "superadmin",
        "password": "SuperAdmin@Eluru1"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Overview Analytics
    overview_resp = await async_client.get("/api/v1/analytics/overview", headers=headers)
    assert overview_resp.status_code == 200
    ov = overview_resp.json()
    assert "registered_officers" in ov
    assert "visits_recorded_today" in ov
    assert ov["registered_officers"] >= 1

    # 2. CSV Export
    csv_resp = await async_client.get("/api/v1/reports/attendance.csv", headers=headers)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Officer ID" in csv_resp.text

    # 3. PDF Export
    pdf_resp = await async_client.get("/api/v1/reports/attendance.pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert pdf_resp.content.startswith(b"%PDF-")
