# PoliceHQ GeoAttend — Admin Web Portal Startup Script
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Starting PoliceHQ GeoAttend Admin Web Portal       " -ForegroundColor Cyan
Write-Host " Eluru District Police Headquarters                 " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$adminDir = Join-Path $PSScriptRoot "admin-web"

if (-Not (Test-Path (Join-Path $adminDir "node_modules"))) {
    Write-Host "[*] Installing node dependencies..." -ForegroundColor Yellow
    Set-Location $adminDir
    npm install
}

Write-Host "[*] Launching Vite development server on http://localhost:5173 ..." -ForegroundColor Green
Set-Location $adminDir
npm run dev
