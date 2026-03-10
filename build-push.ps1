# RedEngine - Build & Push to Docker Hub
# Run this script once from the project root before deploying in Portainer.
# Usage: Right-click → "Run with PowerShell"  OR  run in terminal: .\build-push.ps1

param(
    [string]$Username = "",
    [string]$Tag = "latest"
)

# ── Prompt for Docker Hub username if not provided ──────────────────────────
if (-not $Username) {
    $Username = Read-Host "Enter your Docker Hub username"
}

$BackendImage  = "$Username/redengine-backend:$Tag"
$FrontendImage = "$Username/redengine-frontend:$Tag"
$NginxImage    = "$Username/redengine-nginx:$Tag"

# The public URL the browser will use to reach the backend
# Same domain - Nginx routes /api to the backend
$ApiUrl = "https://redengine.upengine.app"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  RedEngine Docker Build & Push" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Backend image  : $BackendImage"
Write-Host "  Frontend image : $FrontendImage"
Write-Host "  Nginx image    : $NginxImage"
Write-Host "  API URL baked  : $ApiUrl"
Write-Host ""

# ── Login ────────────────────────────────────────────────────────────────────
Write-Host "[1/5] Logging in to Docker Hub..." -ForegroundColor Yellow
docker login
if ($LASTEXITCODE -ne 0) { Write-Host "Login failed. Aborting." -ForegroundColor Red; exit 1 }

# ── Build backend ────────────────────────────────────────────────────────────
Write-Host "[2/7] Building backend..." -ForegroundColor Yellow
docker build -t $BackendImage ./backend
if ($LASTEXITCODE -ne 0) { Write-Host "Backend build failed." -ForegroundColor Red; exit 1 }

# ── Build frontend (NEXT_PUBLIC_API_URL baked in) ────────────────────────────
Write-Host "[3/7] Building frontend (baking API URL: $ApiUrl)..." -ForegroundColor Yellow
docker build `
    --build-arg NEXT_PUBLIC_API_URL=$ApiUrl `
    -t $FrontendImage `
    ./frontend
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed." -ForegroundColor Red; exit 1 }

# ── Build nginx ──────────────────────────────────────────────────────────────
Write-Host "[4/7] Building nginx..." -ForegroundColor Yellow
docker build -t $NginxImage ./nginx
if ($LASTEXITCODE -ne 0) { Write-Host "Nginx build failed." -ForegroundColor Red; exit 1 }

# ── Push ─────────────────────────────────────────────────────────────────────
Write-Host "[5/7] Pushing backend..." -ForegroundColor Yellow
docker push $BackendImage
if ($LASTEXITCODE -ne 0) { Write-Host "Backend push failed." -ForegroundColor Red; exit 1 }

Write-Host "[6/7] Pushing frontend..." -ForegroundColor Yellow
docker push $FrontendImage
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend push failed." -ForegroundColor Red; exit 1 }

Write-Host "[7/7] Pushing nginx..." -ForegroundColor Yellow
docker push $NginxImage
if ($LASTEXITCODE -ne 0) { Write-Host "Nginx push failed." -ForegroundColor Red; exit 1 }

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Done! Images pushed to Docker Hub." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: paste docker-compose.portainer.yml into Portainer" -ForegroundColor Cyan
Write-Host "and set DOCKERHUB_USERNAME=$Username in the environment variables." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
