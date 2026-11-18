# Restauration d'un dump SQL (schema ou sauvegarde Cloud) dans Docker PostgreSQL local
# Usage : powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\restore-local.ps1 -SqlFile .\backup_edunova.sql

param(
  [Parameter(Mandatory = $true)]
  [string]$SqlFile,
  [string]$ContainerName = "edunova-db"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $SqlFile)) {
  throw "Fichier SQL introuvable : $SqlFile"
}

Write-Host "[EduNova Restore] Importation de $SqlFile dans $ContainerName..." -ForegroundColor Cyan
Get-Content -Raw -Encoding UTF8 $SqlFile | docker exec -i $ContainerName psql -U postgres -d postgres

Write-Host "[EduNova Restore] Rechargement du schema API PostgREST..." -ForegroundColor Cyan
docker exec -i $ContainerName psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" | Out-Null

Write-Host "[EduNova Restore] Base locale restauree avec succes." -ForegroundColor Green
