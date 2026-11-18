# Clonage complet Supabase Cloud (Online) -> Supabase Docker Local (Offline/LAN)
# Aucun outil PostgreSQL Windows requis : pg_dump et psql s'executent dans edunova-db.
# Execution :
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\import-cloud-to-local.ps1

param(
  [string]$CloudDbUrl = "",
  [string]$ContainerName = "edunova-db",
  [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro - Import Supabase Cloud (Online) -> Serveur Local" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Verifier que edunova-db tourne
$dbStatus = docker inspect -f "{{.State.Running}}" $ContainerName 2>$null
if ($LASTEXITCODE -ne 0 -or $dbStatus -ne "true") {
  Write-Host "[ERREUR] Le conteneur '$ContainerName' n'est pas demarre." -ForegroundColor Red
  Write-Host "         Lancez d'abord : powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\install-serveur-local.ps1" -ForegroundColor Yellow
  exit 1
}

# 2. Demander la chaine de connexion Supabase Cloud (Session Pooler conseille sur IPv4)
if (-not $CloudDbUrl) {
  Write-Host ""
  Write-Host "Dans Supabase Cloud (app.supabase.com) -> bouton 'Connect' (en haut) -> 'Session pooler' :" -ForegroundColor White
  Write-Host "Exemple : postgresql://postgres.iymzthjkucvhyjnxpslg:MOT_DE_PASSE@aws-0-us-east-1.pooler.supabase.com:5432/postgres" -ForegroundColor Gray
  Write-Host ""
  $CloudDbUrl = (Read-Host "Collez l'URI PostgreSQL Supabase Cloud").Trim()
}

if (-not $CloudDbUrl -or -not ($CloudDbUrl -match '^postgres(ql)?://')) {
  Write-Host "[ERREUR] URI PostgreSQL invalide (doit commencer par postgresql:// ou postgres://)." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$publicDumpLocal = Join-Path $BackupDir "cloud_public_${ts}.sql"
$authDumpLocal = Join-Path $BackupDir "cloud_auth_${ts}.sql"
$safetyBackup = Join-Path $BackupDir "local_before_import_${ts}.sql"

# 3. Sauvegarde de securite de la base locale actuelle
Write-Host "[1/5] Sauvegarde de securite de la base locale avant import..." -ForegroundColor Yellow
docker exec $ContainerName pg_dumpall --clean --if-exists -U postgres -f /tmp/local_safety.sql
docker cp "${ContainerName}:/tmp/local_safety.sql" $safetyBackup
docker exec $ContainerName rm -f /tmp/local_safety.sql
Write-Host "      Sauvegarde enregistree : $safetyBackup" -ForegroundColor Green

# 4. Extraction du schema + donnees 'public' et des comptes 'auth' depuis Supabase Cloud
Write-Host "[2/5] Telechargement du schema et des donnees 'public' depuis Supabase Cloud..." -ForegroundColor Yellow
docker exec -e "CLOUD_DB_URL=$CloudDbUrl" $ContainerName sh -c 'pg_dump "$CLOUD_DB_URL" --clean --if-exists --no-owner --no-privileges --schema=public -f /tmp/cloud_public.sql'
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERREUR] Echec de connexion/export depuis Supabase Cloud." -ForegroundColor Red
  Write-Host "         Verifiez le mot de passe et utilisez l'URI 'Session pooler' (port 5432, IPv4)." -ForegroundColor Yellow
  exit 1
}
docker cp "${ContainerName}:/tmp/cloud_public.sql" $publicDumpLocal

Write-Host "[3/5] Export des utilisateurs et identites ('auth.users', 'auth.identities')..." -ForegroundColor Yellow
docker exec -e "CLOUD_DB_URL=$CloudDbUrl" $ContainerName sh -c 'pg_dump "$CLOUD_DB_URL" --data-only --inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -t auth.mfa_factors -f /tmp/cloud_auth.sql'
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ATTENTION] Export partiel de 'auth' (tentative sans auth.mfa_factors)..." -ForegroundColor Yellow
  docker exec -e "CLOUD_DB_URL=$CloudDbUrl" $ContainerName sh -c 'pg_dump "$CLOUD_DB_URL" --data-only --inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -f /tmp/cloud_auth.sql'
}
docker cp "${ContainerName}:/tmp/cloud_auth.sql" $authDumpLocal

# 5. Restauration dans la base locale Docker
Write-Host "[4/5] Importation des tables, donnees et comptes dans edunova-db..." -ForegroundColor Yellow
docker exec $ContainerName psql -U postgres -d postgres -f /tmp/cloud_auth.sql | Out-Null
docker exec $ContainerName psql -U postgres -d postgres -f /tmp/cloud_public.sql | Out-Null
docker exec $ContainerName psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" | Out-Null
docker exec $ContainerName rm -f /tmp/cloud_public.sql /tmp/cloud_auth.sql

# 6. Verification finale et redemarrage de l'API REST / App
Write-Host "[5/5] Rafraichissement des services et controle des donnees importees..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
  docker compose -f docker-compose.local.yml --env-file .env.local restart edunova-rest edunova-app | Out-Null
}

$tablesCount = (docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';").Trim()
$usersCount = (docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users;").Trim()
$schoolsCount = (docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT CASE WHEN to_regclass('public.schools') IS NULL THEN 0 ELSE (SELECT count(*) FROM public.schools) END;").Trim()

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  IMPORTATION CLOUD -> LOCAL TERMINEE !" -ForegroundColor Green
Write-Host "  Tables 'public' importees : $tablesCount" -ForegroundColor White
Write-Host "  Comptes auth.users        : $usersCount" -ForegroundColor White
Write-Host "  Ecoles (public.schools)   : $schoolsCount" -ForegroundColor White
Write-Host "  Archives SQL conservees   : $publicDumpLocal" -ForegroundColor Gray
Write-Host "  Note : Les fichiers Storage (logos/PDF) peuvent etre re-importes" -ForegroundColor Gray
Write-Host "         ou televerses localement si vous utilisez des buckets." -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
