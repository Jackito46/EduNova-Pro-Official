# Verification complete de la stack locale EduNova Pro + Supabase (Docker Windows)
# Execution : powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\verify-local.ps1

param(
  [int]$AppPort = 3000,
  [string]$ContainerName = "edunova-db"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro - Diagnostic Local (Docker + App + Supabase)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Etat des conteneurs Docker Compose
Write-Host "[1/5] Etat des conteneurs Docker :" -ForegroundColor Yellow
if (Test-Path ".env.local") {
  docker compose -f docker-compose.local.yml --env-file .env.local ps
} else {
  docker compose -f docker-compose.local.yml ps
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERREUR] Impossible d'interroger Docker Compose. Verifiez que Docker Desktop est demarre." -ForegroundColor Red
  exit 1
}

# 2. Verification /api/health
Write-Host ""
Write-Host "[2/5] Sante du serveur EduNova (http://127.0.0.1:${AppPort}/api/health) :" -ForegroundColor Yellow
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:${AppPort}/api/health" -TimeoutSec 5
  Write-Host ("      OK - mode=" + $health.deploymentMode + ", proxyLAN=" + $health.lanProxyActive + ", uptime=" + $health.uptimeSeconds + "s") -ForegroundColor Green
} catch {
  Write-Host "      [ECHEC] L'application ne repond pas encore sur le port $AppPort." -ForegroundColor Red
  Write-Host "      Consultez les logs : docker compose -f docker-compose.local.yml logs --tail=50 edunova-app" -ForegroundColor Yellow
}

# 3. Verification /api/lan/status et passerelle Supabase Kong (/local-supabase)
Write-Host ""
Write-Host "[3/5] Statut reseau LAN & passerelle Supabase :" -ForegroundColor Yellow
try {
  $lan = Invoke-RestMethod -Uri "http://127.0.0.1:${AppPort}/api/lan/status" -TimeoutSec 5
  Write-Host ("      Serveur   : " + $lan.lanServerLabel) -ForegroundColor White
  Write-Host ("      Base Kong : " + ($(if ($lan.localSupabaseReachable) { "JOIGNABLE (OK)" } else { "INJOIGNABLE" }))) -ForegroundColor $(if ($lan.localSupabaseReachable) { "Green" } else { "Red" })
  if ($lan.lanHostnameUrl) {
    Write-Host ("      Nom LAN   : " + $lan.lanHostnameUrl) -ForegroundColor Cyan
  }
  foreach ($u in $lan.detectedLanUrls) {
    Write-Host ("      IP LAN    : " + $u) -ForegroundColor Cyan
  }
} catch {
  Write-Host "      [ECHEC] /api/lan/status indisponible." -ForegroundColor Red
}

# 4. Verification GoTrue Auth via proxy /local-supabase
Write-Host ""
Write-Host "[4/5] Service Auth Supabase local (/local-supabase/auth/v1/health) :" -ForegroundColor Yellow
try {
  $authResp = Invoke-WebRequest -Uri "http://127.0.0.1:${AppPort}/local-supabase/auth/v1/health" -TimeoutSec 5 -UseBasicParsing
  Write-Host ("      OK (HTTP " + $authResp.StatusCode + ")") -ForegroundColor Green
} catch {
  Write-Host "      [ECHEC] GoTrue Auth ne repond pas via Kong." -ForegroundColor Red
}

# 5. Verification PostgreSQL local (nombre de tables public & utilisateurs auth.users)
Write-Host ""
Write-Host "[5/5] Inspection PostgreSQL local ($ContainerName) :" -ForegroundColor Yellow
$pgReady = docker exec $ContainerName pg_isready -U postgres 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "      PostgreSQL pret : $pgReady" -ForegroundColor Green
  $tablesCount = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';") | Out-String).Trim()
  $usersCount = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users;") | Out-String).Trim()
  $hasSchools = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT COALESCE(to_regclass('public.schools')::text, '');") | Out-String).Trim()
  Write-Host "      Tables dans public : $tablesCount" -ForegroundColor White
  Write-Host "      Comptes auth.users : $usersCount" -ForegroundColor White
  if (-not $hasSchools) {
    Write-Host "      [INFO] La table 'public.schools' n'existe pas encore : base vierge (normal avant l'import)." -ForegroundColor Yellow
    Write-Host "             Importez votre base Cloud : powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\import-cloud-to-local.ps1" -ForegroundColor Cyan
  } else {
    $schoolsCount = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM public.schools;") | Out-String).Trim()
    Write-Host "      Ecoles (schools)   : $schoolsCount" -ForegroundColor Green
  }
} else {
  Write-Host "      [ECHEC] Conteneur $ContainerName inaccessible ou arrete." -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  Astuce pgAdmin local : docker compose -f docker-compose.local.yml --env-file .env.local --profile admin up -d" -ForegroundColor Gray
Write-Host "  Puis ouvrez http://localhost:5050 (Postgres host = edunova-db, port = 5432)" -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
