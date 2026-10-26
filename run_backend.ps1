# PoliceHQ GeoAttend — Backend Startup Script
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Starting PoliceHQ GeoAttend FastAPI Backend        " -ForegroundColor Cyan
Write-Host " Eluru District Police Headquarters                 " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-Not (Test-Path $venvPython)) {
    Write-Host "[!] Virtual environment not found at $venvPython. Please create it first." -ForegroundColor Red
    Exit 1
}

Write-Host "[*] Checking MongoDB service..." -ForegroundColor Yellow
$mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -ne 'Running') {
    Write-Host "[*] Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service -Name MongoDB
}

Write-Host "[*] Launching Uvicorn server on http://127.0.0.1:8000 ..." -ForegroundColor Green
Set-Location $backendDir
& $venvPython -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
