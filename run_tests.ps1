# PoliceHQ GeoAttend — Automated Test Runner
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Running Automated Test Suite: PoliceHQ GeoAttend   " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$flutterBin = "D:\Flutter\flutter\bin\flutter.bat"
$constableDir = Join-Path $PSScriptRoot "constable-app"

Write-Host "`n>>> [1/2] Running Backend Pytest Suite (FastAPI + MongoDB)..." -ForegroundColor Yellow
Set-Location $backendDir
& $venvPython -m pytest tests/ -v
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Backend Tests Passed Successfully!" -ForegroundColor Green
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Backend Tests Failed." -ForegroundColor Red
}

if (Test-Path $flutterBin) {
    Write-Host "`n>>> [2/2] Running Flutter Constable App Widget and Unit Tests..." -ForegroundColor Yellow
    Set-Location $constableDir
    cmd.exe /c "$flutterBin test"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Flutter Tests Passed Successfully!" -ForegroundColor Green
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Flutter Tests Failed." -ForegroundColor Red
    }
}
if (-Not (Test-Path $flutterBin)) {
    Write-Host "[INFO] Flutter SDK not found at $flutterBin. Skipping Flutter tests." -ForegroundColor Gray
}

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host " Test Execution Completed                            " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
