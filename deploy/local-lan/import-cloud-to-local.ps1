# Clonage complet Supabase Cloud (Online, PG 15/16/17) -> Supabase Docker Local (Offline/LAN)
# Utilise un conteneur ephemera postgres:17-alpine pour pg_dump afin de supporter
# les bases Supabase Cloud en PostgreSQL 17.x vers edunova-db (PostgreSQL 15.8).
# Execution :
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\import-cloud-to-local.ps1

param(
  [string]$CloudDbUrl = "",
  [string]$ContainerName = "edunova-db",
  [string]$BackupDir = ".\backups",
  [string]$PgDumpImage = "postgres:17-alpine"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro - Import Supabase Cloud (Online) -> Serveur Local" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Verifier que edunova-db tourne
$dbStatus = ((docker inspect -f "{{.State.Running}}" $ContainerName 2>$null) | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $dbStatus -ne "true") {
  Write-Host "[ERREUR] Le conteneur '$ContainerName' n'est pas demarre." -ForegroundColor Red
  Write-Host "         Lancez d'abord : powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\install-serveur-local.ps1" -ForegroundColor Yellow
  exit 1
}

# 2. Demander la chaine de connexion Supabase Cloud (Session Pooler IPv4)
if (-not $CloudDbUrl) {
  Write-Host ""
  Write-Host "Dans Supabase Cloud (app.supabase.com) -> bouton 'Connect' -> 'Session pooler' :" -ForegroundColor White
  Write-Host "Exemple : postgresql://postgres.iymzthjkucvhyjnxpslg:MOT_DE_PASSE@aws-1-us-east-1.pooler.supabase.com:5432/postgres" -ForegroundColor Gray
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
$absBackupDir = (Resolve-Path $BackupDir).Path

$ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$publicDumpName = "cloud_public_${ts}.sql"
$authDumpName = "cloud_auth_${ts}.sql"
$publicDumpLocal = Join-Path $absBackupDir $publicDumpName
$authDumpLocal = Join-Path $absBackupDir $authDumpName
$safetyBackup = Join-Path $absBackupDir "local_before_import_${ts}.sql"
$importLog = Join-Path $absBackupDir "import_log_${ts}.txt"

# Fonction de nettoyage PG17 -> PG15 (supprime \restrict, \unrestrict et SET transaction_timeout)
function Clean-Pg17SqlForPg15 {
  param([string]$FilePath)
  if (-not (Test-Path $FilePath)) { return }
  $lines = Get-Content -Path $FilePath -Encoding UTF8
  $filtered = $lines | Where-Object {
    ($_ -notmatch '^\s*\\(restrict|unrestrict)\b') -and
    ($_ -notmatch '^\s*SET\s+transaction_timeout\s*=')
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($FilePath, $filtered, $utf8NoBom)
}

# 3. Sauvegarde de securite de la base locale actuelle
Write-Host "[1/5] Sauvegarde de securite de la base locale avant import..." -ForegroundColor Yellow
docker exec $ContainerName pg_dumpall --clean --if-exists -U postgres -f /tmp/local_safety.sql 2>$null
if ($LASTEXITCODE -eq 0) {
  docker cp "${ContainerName}:/tmp/local_safety.sql" $safetyBackup 2>$null | Out-Null
  docker exec $ContainerName rm -f /tmp/local_safety.sql 2>$null | Out-Null
  Write-Host "      Sauvegarde enregistree : $safetyBackup" -ForegroundColor Green
}

# 4. Extraction du schema + donnees 'public' via postgres:17-alpine (compatible PG 15/16/17)
Write-Host "[2/5] Telechargement du schema et des donnees 'public' (via $PgDumpImage)..." -ForegroundColor Yellow
docker run --rm -v "${absBackupDir}:/out" $PgDumpImage pg_dump $CloudDbUrl --clean --if-exists --no-owner --no-privileges --schema=public -f "/out/${publicDumpName}"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $publicDumpLocal)) {
  Write-Host "[ERREUR] Echec de connexion/export depuis Supabase Cloud." -ForegroundColor Red
  Write-Host "         Verifiez le mot de passe et utilisez l'URI 'Session pooler' (port 5432, IPv4)." -ForegroundColor Yellow
  exit 1
}
Clean-Pg17SqlForPg15 -FilePath $publicDumpLocal
Write-Host "      Schema/donnees 'public' telecharges." -ForegroundColor Green

# 5. Export des comptes 'auth.users' et 'auth.identities'
Write-Host "[3/5] Export des utilisateurs et identites ('auth.users', 'auth.identities')..." -ForegroundColor Yellow
docker run --rm -v "${absBackupDir}:/out" $PgDumpImage pg_dump $CloudDbUrl --data-only --column-inserts --on-conflict-do-nothing --disable-triggers -t auth.users -t auth.identities -f "/out/${authDumpName}"
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ATTENTION] Export pg_dump de 'auth' partiel, poursuite..." -ForegroundColor Yellow
}
Clean-Pg17SqlForPg15 -FilePath $authDumpLocal

# 6. Restauration dans la base locale Docker
Write-Host "[4/5] Importation des comptes, tables et donnees dans $ContainerName..." -ForegroundColor Yellow
docker cp $publicDumpLocal "${ContainerName}:/tmp/cloud_public.sql" | Out-Null
if (Test-Path $authDumpLocal) {
  docker cp $authDumpLocal "${ContainerName}:/tmp/cloud_auth.sql" | Out-Null
}

docker exec $ContainerName psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>&1 | Out-File -FilePath $importLog -Encoding utf8
if (Test-Path $authDumpLocal) {
  docker exec $ContainerName psql -U postgres -d postgres -f /tmp/cloud_auth.sql 2>&1 | Out-File -FilePath $importLog -Append -Encoding utf8
}

# Repli automatique si Cloud auth.users possede des colonnes plus recentes que GoTrue local
$usersCheck = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users;") | Out-String).Trim()
if ($usersCheck -eq "0") {
  Write-Host "      Adaptation automatique des colonnes auth.users / auth.identities (PG17 -> local)..." -ForegroundColor Cyan
  foreach ($tbl in @("users", "identities")) {
    $colQuery = "SELECT column_name FROM information_schema.columns WHERE table_schema='auth' AND table_name='$tbl' AND is_generated='NEVER' ORDER BY ordinal_position;"
    $localColsRaw = ((docker exec $ContainerName psql -U postgres -d postgres -tAc $colQuery) | Out-String)
    $cloudColsRaw = ((docker run --rm $PgDumpImage psql $CloudDbUrl -tAc $colQuery) | Out-String)
    $localSet = @($localColsRaw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $cloudSet = @($cloudColsRaw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $commonCols = @($localSet | Where-Object { $cloudSet -contains $_ })
    if ($commonCols.Count -gt 0) {
      $colList = $commonCols -join ", "
      $csvName = "auth_${tbl}_${ts}.csv"
      $csvLocal = Join-Path $absBackupDir $csvName
      $exportCmd = "\copy (SELECT $colList FROM auth.$tbl) TO '/out/$csvName' WITH (FORMAT csv, HEADER true)"
      docker run --rm -v "${absBackupDir}:/out" $PgDumpImage psql $CloudDbUrl -c $exportCmd 2>&1 | Out-File -FilePath $importLog -Append -Encoding utf8
      if (Test-Path $csvLocal) {
        docker cp $csvLocal "${ContainerName}:/tmp/$csvName" | Out-Null
        $copySql = "SET session_replication_role = 'replica'; \copy auth.$tbl ($colList) FROM '/tmp/$csvName' WITH (FORMAT csv, HEADER true); SET session_replication_role = 'origin';"
        $copySql | docker exec -i $ContainerName psql -U postgres -d postgres 2>&1 | Out-File -FilePath $importLog -Append -Encoding utf8
        docker exec $ContainerName rm -f "/tmp/$csvName" 2>$null | Out-Null
      }
    }
  }
}

docker exec $ContainerName psql -U postgres -d postgres -f /tmp/cloud_public.sql 2>&1 | Out-File -FilePath $importLog -Append -Encoding utf8
docker exec $ContainerName psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" 2>$null | Out-Null
docker exec $ContainerName rm -f /tmp/cloud_public.sql /tmp/cloud_auth.sql 2>$null | Out-Null

# 7. Verification finale et redemarrage de l'API REST / App
Write-Host "[5/5] Rafraichissement des services et controle des donnees importees..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
  docker compose -f docker-compose.local.yml --env-file .env.local restart edunova-rest edunova-app 2>&1 | Out-Null
}

$tablesCount = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';") | Out-String).Trim()
$usersCount = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM auth.users;") | Out-String).Trim()
$hasSchools = ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT COALESCE(to_regclass('public.schools')::text, '');") | Out-String).Trim()
$schoolsCount = if ($hasSchools) { ((docker exec $ContainerName psql -U postgres -d postgres -tAc "SELECT count(*) FROM public.schools;") | Out-String).Trim() } else { "0" }

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  IMPORTATION CLOUD -> LOCAL TERMINEE !" -ForegroundColor Green
Write-Host "  Tables 'public' importees : $tablesCount" -ForegroundColor White
Write-Host "  Comptes auth.users        : $usersCount" -ForegroundColor White
Write-Host "  Ecoles (public.schools)   : $schoolsCount" -ForegroundColor White
Write-Host "  Archives SQL conservees   : $publicDumpLocal" -ForegroundColor Gray
Write-Host "  Journal detaille          : $importLog" -ForegroundColor Gray
Write-Host "  Ouvrez maintenant http://localhost:3000 dans Chrome !" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
