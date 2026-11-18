# Configuration du nom reseau local (.local / mDNS) du serveur EduNova Pro
# Permet aux autres appareils du reseau d'acceder via http://edunova-server.local:3000
# Execution PowerShell (Administrateur) :
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\set-lan-hostname.ps1
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\set-lan-hostname.ps1 -Hostname "edunova-server"

param(
  [string]$Hostname = "",
  [int]$AppPort = 3000,
  [switch]$SkipRename,
  [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro - Configuration du nom reseau local (.local / mDNS)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not $Hostname) {
  $typed = Read-Host "Nom du serveur sur le reseau (Entree pour 'edunova-server' -> edunova-server.local)"
  $Hostname = if ($typed.Trim()) { $typed.Trim() } else { "edunova-server" }
}

# Normalisation RFC-1123 + compatibilite NetBIOS Windows (max 15 caracteres)
$shortName = $Hostname.ToLower() -replace '^https?://', '' -replace '[:/].*$', ''
if ($shortName.EndsWith(".local")) {
  $shortName = $shortName.Substring(0, $shortName.Length - 6)
}
$shortName = ($shortName -replace '[^a-z0-9-]', '-') -replace '^-+|-+$', ''
if (-not $shortName) { $shortName = "edunova-server" }
if ($shortName.Length -gt 15) {
  Write-Host "[ATTENTION] '$shortName' depasse 15 caracteres (limite NetBIOS Windows). Troncature a 15 caracteres." -ForegroundColor Yellow
  $shortName = $shortName.Substring(0, 15).TrimEnd('-')
}

$fqdnLocal = "${shortName}.local"
$localUrl = "http://${fqdnLocal}:${AppPort}"

Write-Host "[1/4] Nom reseau retenu : $fqdnLocal ($localUrl)" -ForegroundColor Green

# 1. Mettre a jour .env.local si present
Write-Host "[2/4] Mise a jour de .env.local..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
  $lines = Get-Content ".env.local" -Encoding UTF8
  $hasHostname = $false
  $newLines = @()
  foreach ($line in $lines) {
    if ($line -match '^LAN_HOSTNAME=') {
      $newLines += "LAN_HOSTNAME=$fqdnLocal"
      $hasHostname = $true
    } elseif ($line -match '^ADDITIONAL_REDIRECT_URLS=(.*)$') {
      $existing = $Matches[1].Trim()
      $redirectPattern = "${localUrl}/*"
      if ($existing -notlike "*$redirectPattern*") {
        $updated = if ($existing) { "$existing,$redirectPattern" } else { $redirectPattern }
        $newLines += "ADDITIONAL_REDIRECT_URLS=$updated"
      } else {
        $newLines += $line
      }
    } else {
      $newLines += $line
    }
  }
  if (-not $hasHostname) {
    $newLines += "LAN_HOSTNAME=$fqdnLocal"
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines((Resolve-Path ".env.local").Path, $newLines, $utf8NoBom)
  Write-Host "      .env.local mis a jour (LAN_HOSTNAME=$fqdnLocal)." -ForegroundColor Green
} else {
  Write-Host "      .env.local absent : executez d'abord install-serveur-local.ps1." -ForegroundColor Yellow
}

# 2. Autoriser mDNS (UDP 5353) dans le Pare-feu Windows & renommer le PC si Admin
Write-Host "[3/4] Configuration mDNS & nom d'hote Windows..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$needsReboot = $false

if ($isAdmin) {
  $mdnsRule = Get-NetFirewallRule -DisplayName "EduNova Pro mDNS (.local)" -ErrorAction SilentlyContinue
  if (-not $mdnsRule) {
    New-NetFirewallRule -DisplayName "EduNova Pro mDNS (.local)" -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow -Profile Private,Domain | Out-Null
    Write-Host "      Regle pare-feu mDNS (UDP 5353) creee." -ForegroundColor Green
  } else {
    Write-Host "      Regle pare-feu mDNS (UDP 5353) deja active." -ForegroundColor Green
  }

  if (-not $SkipRename) {
    $currentName = $env:COMPUTERNAME.ToLower()
    if ($currentName -ne $shortName) {
      Rename-Computer -NewName $shortName -Force
      $needsReboot = $true
      Write-Host "      Nom Windows modifie en '$shortName' (effectif apres redemarrage)." -ForegroundColor Green
    } else {
      Write-Host "      Le PC porte deja le nom '$shortName'." -ForegroundColor Green
    }
  }
} else {
  Write-Host "      [Note] Relancez PowerShell en Administrateur pour appliquer le nom Windows et la regle mDNS UDP 5353." -ForegroundColor Yellow
}

# 3. Redemarrer les conteneurs applicatifs si presents
Write-Host "[4/4] Application de la configuration aux conteneurs..." -ForegroundColor Yellow
if (-not $NoRestart -and (Test-Path ".env.local") -and (Test-Path "docker-compose.local.yml")) {
  docker compose -f docker-compose.local.yml --env-file .env.local up -d edunova-auth edunova-app
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ATTENTION] Impossible de redemarrer automatiquement les conteneurs Docker." -ForegroundColor Yellow
  } else {
    Write-Host "      Conteneurs edunova-app et edunova-auth mis a jour." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "  Adresse reseau local : $localUrl" -ForegroundColor White
if ($needsReboot) {
  Write-Host "  ACTION REQUISE : Redemarrez ce PC Windows pour activer '$fqdnLocal' sur le LAN." -ForegroundColor Yellow
}
Write-Host "  Astuce (anciens PC/Android sans mDNS) : ajoutez '<IP_SERVEUR> $fqdnLocal' dans hosts." -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
