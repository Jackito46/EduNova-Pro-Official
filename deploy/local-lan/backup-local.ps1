# Sauvegarde PostgreSQL locale pour Serveur Windows (Docker Desktop)
# Exécution : powershell -ExecutionPolicy Bypass -File deploy\local-lan\backup-local.ps1

param(
  [string]$BackupDir = ".\backups",
  [string]$ContainerName = "edunova-db",
  [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$OutFile = Join-Path $BackupDir "edunova_backup_$Timestamp.sql"

Write-Host "[EduNova Backup] Exportation de la base depuis $ContainerName..." -ForegroundColor Cyan
docker exec $ContainerName pg_dumpall --clean --if-exists -U postgres | Out-File -FilePath $OutFile -Encoding utf8

if (-not (Test-Path $OutFile) -or ((Get-Item $OutFile).Length -lt 100)) {
  throw "La sauvegarde semble vide ou incomplète : $OutFile"
}

Write-Host "[EduNova Backup] Sauvegarde réussie : $OutFile" -ForegroundColor Green

# Rotation automatique
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "edunova_backup_*.sql" |
  Where-Object { $_.LastWriteTime -lt $Cutoff } |
  Remove-Item -Force
