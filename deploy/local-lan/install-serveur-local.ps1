# Assistant d'installation complet Serveur Local (LAN) & Poste Autonome - EduNova Pro
# Execution dans PowerShell (Administrateur recommande pour ouvrir le pare-feu) :
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\install-serveur-local.ps1

param(
  [ValidateSet("lan", "standalone", "")]
  [string]$Mode = "",
  [string]$LanIp = "",
  [string]$Hostname = "",
  [string]$Label = "",
  [string]$SqlFile = "",
  [switch]$ForceEnv
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro - Preparation Serveur Local Supabase + Docker (Windows)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Verifier que Docker Engine repond
Write-Host "[1/6] Verification de Docker Desktop Engine..." -ForegroundColor Yellow
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERREUR] Docker Engine ne repond pas. Verifiez que 'Engine running' (vert) apparait dans Docker Desktop." -ForegroundColor Red
  exit 1
}
Write-Host "      Docker Engine pret." -ForegroundColor Green

# 2. Detecter les cartes reseau LAN physiques (exclut vEthernet/WSL/Loopback)
$detectedIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)' -and
    $_.InterfaceAlias -notmatch 'WSL|Hyper-V|vEthernet|Docker|Loopback'
  } |
  Select-Object -ExpandProperty IPAddress -Unique

$defaultLanIp = if ($detectedIps) { ($detectedIps | Select-Object -First 1) } else { "localhost" }

# 3. Choix du mode si non fourni en parametre
if (-not $Mode) {
  Write-Host ""
  Write-Host "Choisissez le type d'installation pour cette machine :" -ForegroundColor White
  Write-Host "  [1] Serveur Local d'Etablissement (LAN multi-PC, accessible sur le reseau)" -ForegroundColor Cyan
  Write-Host "  [2] Poste Autonome (1 seul PC hors-ligne sur http://localhost:3000)" -ForegroundColor Cyan
  $choice = Read-Host "Votre choix (1 ou 2, defaut = 1)"
  $Mode = if ($choice -eq "2") { "standalone" } else { "lan" }
}

if ($Mode -eq "lan" -and -not $LanIp) {
  Write-Host "Adresse IP LAN detectee sur ce PC : $defaultLanIp" -ForegroundColor Gray
  $typedIp = Read-Host "IP statique du serveur (Entree pour garder $defaultLanIp)"
  $LanIp = if ($typedIp.Trim()) { $typedIp.Trim() } else { $defaultLanIp }
} elseif (-not $LanIp) {
  $LanIp = "localhost"
}

if ($Mode -eq "lan" -and -not $Hostname) {
  $typedHost = Read-Host "Nom reseau local (.local) (Entree pour 'edunova-server' -> edunova-server.local)"
  $Hostname = if ($typedHost.Trim()) { $typedHost.Trim() } else { "edunova-server" }
}

if (-not $Label) {
  $defaultLabel = if ($Mode -eq "standalone") { "Poste Autonome EduNova Pro" } else { "Serveur Local Etablissement" }
  $typedLabel = Read-Host "Nom du serveur affiche dans l'app (Entree = $defaultLabel)"
  $Label = if ($typedLabel.Trim()) { $typedLabel.Trim() } else { $defaultLabel }
}

# 4. Generer .env.local (via Node local si present, sinon via conteneur node:22-alpine sans installer Node!)
Write-Host "[2/6] Generation securisee de .env.local (cles JWT, Postgres, AES-256)..." -ForegroundColor Yellow
$envExists = Test-Path ".env.local"
if (-not $envExists -or $ForceEnv) {
  $nodeArgs = @("deploy/local-lan/setup-local-env.mjs", "--mode=$Mode", "--ip=$LanIp", "--label=$Label")
  if ($Hostname) {
    $nodeArgs += "--hostname=$Hostname"
  }
  if ($ForceEnv) {
    $nodeArgs += "--force"
  }
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    & node @nodeArgs
  } else {
    Write-Host "      Node.js non detecte sur Windows : generation via Docker (node:22-alpine)..." -ForegroundColor Gray
    $workDir = (Get-Location).Path
    docker run --rm -v "${workDir}:/work" -w /work node:22-alpine node @nodeArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Echec de la generation de .env.local."
  }
} else {
  Write-Host "      .env.local deja present : conserve (ajoutez -ForceEnv pour regenerer)." -ForegroundColor Green
}

# 5. Ouverture du Pare-feu Windows en mode LAN (si droits Administrateur)
Write-Host "[3/6] Configuration reseau & pare-feu Windows..." -ForegroundColor Yellow
if ($Mode -eq "lan") {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    $existingRule = Get-NetFirewallRule -DisplayName "EduNova Pro LAN (Port 3000)" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
      New-NetFirewallRule -DisplayName "EduNova Pro LAN (Port 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain | Out-Null
      Write-Host "      Regle pare-feu TCP 3000 creee avec succes." -ForegroundColor Green
    } else {
      Write-Host "      Regle pare-feu TCP 3000 deja active." -ForegroundColor Green
    }

    $mdnsRule = Get-NetFirewallRule -DisplayName "EduNova Pro mDNS (.local)" -ErrorAction SilentlyContinue
    if (-not $mdnsRule) {
      New-NetFirewallRule -DisplayName "EduNova Pro mDNS (.local)" -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow -Profile Private,Domain | Out-Null
      Write-Host "      Regle pare-feu mDNS UDP 5353 creee." -ForegroundColor Green
    }

    # Eviter que le serveur s'endorme sur secteur
    powercfg /change standby-timeout-ac 0 | Out-Null
    Write-Host "      Mise en veille sur secteur desactivee pour la stabilite du serveur." -ForegroundColor Green
  } else {
    Write-Host "      [Note] Lancez PowerShell en Administrateur pour ouvrir automatiquement les ports 3000 et 5353." -ForegroundColor Yellow
  }
} else {
  Write-Host "      Mode Poste Autonome : ecoute strictement locale (127.0.0.1:3000)." -ForegroundColor Green
}

# 6. Demarrer PostgreSQL d'abord et synchroniser les mots de passe des roles internes Supabase
Write-Host "[4/6] Demarrage de PostgreSQL et synchronisation des roles Supabase..." -ForegroundColor Yellow
$prevErrPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose -f docker-compose.local.yml --env-file .env.local up -d --wait edunova-db
$dbExit = $LASTEXITCODE
$ErrorActionPreference = $prevErrPref

if ($dbExit -ne 0) {
  Write-Host ""
  Write-Host "[ERREUR] Le conteneur PostgreSQL (edunova-db) n'a pas pu demarrer (code $dbExit)." -ForegroundColor Red
  $ErrorActionPreference = "Continue"
  docker logs --tail 40 edunova-db 2>&1 | ForEach-Object { Write-Host $_ }
  $ErrorActionPreference = $prevErrPref
  Write-Host ""
  Write-Host "         Pour repartir sur une base vierge :" -ForegroundColor Cyan
  Write-Host "           docker compose -f docker-compose.local.yml --env-file .env.local down -v" -ForegroundColor White
  exit 1
}

# Synchroniser les mots de passe meme si le volume existait deja ('Skipping initialization')
$pgPassLine = Get-Content ".env.local" | Where-Object { $_ -match '^POSTGRES_PASSWORD=' } | Select-Object -First 1
if ($pgPassLine) {
  $pgPass = $pgPassLine.Substring("POSTGRES_PASSWORD=".Length).Trim()
  if ($pgPass) {
    $escapedPass = $pgPass.Replace("'", "''")
    $syncSql = "SELECT format('ALTER ROLE %I WITH PASSWORD ''$escapedPass'';', rolname) FROM pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','authenticator','supabase_storage_admin','pgbouncer') \gexec"
    $ErrorActionPreference = "Continue"
    $synced = $false
    $syncSql | docker exec -i edunova-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $synced = $true }
    if (-not $synced) {
      $syncSql | docker exec -i edunova-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $synced = $true }
    }
    if (-not $synced) {
      $syncSql | docker exec -i -e PGPASSWORD=postgres edunova-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $synced = $true }
    }
    $ErrorActionPreference = $prevErrPref
    if ($synced) {
      Write-Host "      Roles Supabase synchronises avec .env.local." -ForegroundColor Green
    } else {
      Write-Host "      [Note] Synchronisation automatique ignoree (si erreur Auth, executez 'docker compose -f docker-compose.local.yml --env-file .env.local down -v')." -ForegroundColor Yellow
    }
  }
}

# 7. Telechargement des images & construction / demarrage de toute la stack
Write-Host "[4b/6] Compilation EduNova Pro et demarrage des services Supabase..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
$upExit = $LASTEXITCODE
$ErrorActionPreference = $prevErrPref

if ($upExit -ne 0) {
  Write-Host ""
  Write-Host "[ERREUR] La construction ou le demarrage Docker a echoue (code $upExit)." -ForegroundColor Red
  $ErrorActionPreference = "Continue"
  Write-Host "         --- Logs edunova-auth ---" -ForegroundColor Yellow
  docker logs --tail 25 edunova-auth 2>&1 | ForEach-Object { Write-Host $_ }
  Write-Host "         --- Logs edunova-db ---" -ForegroundColor Yellow
  docker logs --tail 25 edunova-db 2>&1 | ForEach-Object { Write-Host $_ }
  $ErrorActionPreference = $prevErrPref
  Write-Host ""
  Write-Host "         Si le volume DB est corrompu, reinitialisez avec :" -ForegroundColor Cyan
  Write-Host "           docker compose -f docker-compose.local.yml --env-file .env.local down -v" -ForegroundColor White
  exit 1
}

# 7. Attente de disponibilite de http://localhost:3000/api/health
Write-Host "[5/6] Verification de sante de l'application et de la base locale..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 3
    if ($resp.status -eq "ok") {
      $ready = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
}

# 8. Restauration SQL optionnelle si -SqlFile fourni
if ($SqlFile) {
  Write-Host "[6/6] Importation du fichier SQL : $SqlFile..." -ForegroundColor Yellow
  & powershell -ExecutionPolicy Bypass -File deploy/local-lan/restore-local.ps1 -SqlFile $SqlFile
} else {
  Write-Host "[6/6] Stack prete (n'oubliez pas d'importer votre schema/backup SQL si la base est neuve)." -ForegroundColor Cyan
}

$displayHost = ""
if ($Hostname) {
  $cleanHost = ($Hostname.ToLower() -replace '^https?://', '' -replace '\.local$', '' -replace '[^a-z0-9-]', '-')
  if ($cleanHost) { $displayHost = "${cleanHost}.local" }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
if ($ready) {
  Write-Host "  INSTALLATION REUSSIE - EduNova Pro + Supabase Local sont actifs !" -ForegroundColor Green
} else {
  Write-Host "  Conteneurs lances, attente reponse HTTP (verifiez 'docker compose -f docker-compose.local.yml ps')" -ForegroundColor Yellow
}
Write-Host "  Acces sur ce PC     : http://localhost:3000" -ForegroundColor White
if ($Mode -eq "lan") {
  Write-Host "  Acces postes (IP)   : http://${LanIp}:3000" -ForegroundColor White
  if ($displayHost) {
    Write-Host "  Nom reseau (.local) : http://${displayHost}:3000 (executez set-lan-hostname.ps1 pour renommer le PC)" -ForegroundColor White
  }
}
Write-Host "  Vous pouvez maintenant travailler sans connexion Internet." -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
