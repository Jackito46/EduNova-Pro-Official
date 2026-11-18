# Assistant d'installation complet Serveur Local (LAN) & Poste Autonome — EduNova Pro
# Exécution dans PowerShell (Administrateur recommandé pour ouvrir le pare-feu) :
#   powershell -ExecutionPolicy Bypass -File deploy\local-lan\install-serveur-local.ps1

param(
  [ValidateSet("lan", "standalone", "")]
  [string]$Mode = "",
  [string]$LanIp = "",
  [string]$Label = "",
  [string]$SqlFile = "",
  [switch]$ForceEnv
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  EduNova Pro — Préparation Serveur Local Supabase + Docker (Windows)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Vérifier que Docker Engine répond
Write-Host "[1/6] Vérification de Docker Desktop Engine..." -ForegroundColor Yellow
try {
  docker info | Out-Null
} catch {
  Write-Host "[ERREUR] Docker Engine ne répond pas. Vérifiez que 'Engine running' (vert) apparaît dans Docker Desktop." -ForegroundColor Red
  exit 1
}
Write-Host "      Docker Engine prêt." -ForegroundColor Green

# 2. Détecter les cartes réseau LAN physiques (exclut vEthernet/WSL/Loopback)
$detectedIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)' -and
    $_.InterfaceAlias -notmatch 'WSL|Hyper-V|vEthernet|Docker|Loopback'
  } |
  Select-Object -ExpandProperty IPAddress -Unique

$defaultLanIp = if ($detectedIps) { ($detectedIps | Select-Object -First 1) } else { "localhost" }

# 3. Choix du mode si non fourni en paramètre
if (-not $Mode) {
  Write-Host ""
  Write-Host "Choisissez le type d'installation pour cette machine :" -ForegroundColor White
  Write-Host "  [1] Serveur Local d'Établissement (LAN multi-PC, accessible sur le réseau)" -ForegroundColor Cyan
  Write-Host "  [2] Poste Autonome (1 seul PC hors-ligne sur http://localhost:3000)" -ForegroundColor Cyan
  $choice = Read-Host "Votre choix (1 ou 2, défaut = 1)"
  $Mode = if ($choice -eq "2") { "standalone" } else { "lan" }
}

if ($Mode -eq "lan" -and -not $LanIp) {
  Write-Host "Adresse IP LAN détectée sur ce PC : $defaultLanIp" -ForegroundColor Gray
  $typedIp = Read-Host "IP statique du serveur (Entrée pour garder $defaultLanIp)"
  $LanIp = if ($typedIp.Trim()) { $typedIp.Trim() } else { $defaultLanIp }
} elseif (-not $LanIp) {
  $LanIp = "localhost"
}

if (-not $Label) {
  $defaultLabel = if ($Mode -eq "standalone") { "Poste Autonome EduNova Pro" } else { "Serveur Local Établissement" }
  $typedLabel = Read-Host "Nom du serveur affiché dans l'app (Entrée = $defaultLabel)"
  $Label = if ($typedLabel.Trim()) { $typedLabel.Trim() } else { $defaultLabel }
}

# 4. Générer .env.local (via Node local si présent, sinon via conteneur node:22-alpine sans installer Node!)
Write-Host "[2/6] Génération sécurisée de .env.local (clés JWT, Postgres, AES-256)..." -ForegroundColor Yellow
$envExists = Test-Path ".env.local"
if (-not $envExists -or $ForceEnv) {
  $forceFlag = if ($ForceEnv) { "--force" } else { "" }
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) {
    & node deploy/local-lan/setup-local-env.mjs "--mode=$Mode" "--ip=$LanIp" "--label=$Label" $forceFlag
  } else {
    Write-Host "      Node.js non détecté sur Windows : génération via Docker (node:22-alpine)..." -ForegroundColor Gray
    $workDir = (Get-Location).Path
    docker run --rm -v "${workDir}:/work" -w /work node:22-alpine node deploy/local-lan/setup-local-env.mjs "--mode=$Mode" "--ip=$LanIp" "--label=$Label" $forceFlag
  }
} else {
  Write-Host "      .env.local déjà présent : conservé (ajoutez -ForceEnv pour régénérer)." -ForegroundColor Green
}

# 5. Ouverture du Pare-feu Windows en mode LAN (si droits Administrateur)
Write-Host "[3/6] Configuration réseau & pare-feu Windows..." -ForegroundColor Yellow
if ($Mode -eq "lan") {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    $existingRule = Get-NetFirewallRule -DisplayName "EduNova Pro LAN (Port 3000)" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
      New-NetFirewallRule -DisplayName "EduNova Pro LAN (Port 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Domain | Out-Null
      Write-Host "      Règle pare-feu TCP 3000 créée avec succès." -ForegroundColor Green
    } else {
      Write-Host "      Règle pare-feu TCP 3000 déjà active." -ForegroundColor Green
    }
    # Éviter que le serveur s'endorme sur secteur
    powercfg /change standby-timeout-ac 0 | Out-Null
    Write-Host "      Mise en veille sur secteur désactivée pour la stabilité du serveur." -ForegroundColor Green
  } else {
    Write-Host "      [Note] Lancez PowerShell en Administrateur pour ouvrir automatiquement le port 3000 dans le pare-feu." -ForegroundColor Yellow
  }
} else {
  Write-Host "      Mode Poste Autonome : écoute strictement locale (127.0.0.1:3000)." -ForegroundColor Green
}

# 6. Téléchargement des images & construction locale
Write-Host "[4/6] Téléchargement des images Supabase + compilation EduNova Pro..." -ForegroundColor Yellow
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build

# 7. Attente de disponibilité de http://localhost:3000/api/health
Write-Host "[5/6] Vérification de santé de l'application et de la base locale..." -ForegroundColor Yellow
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
  Write-Host "[6/6] Stack prête (n'oubliez pas d'importer votre schéma/backup SQL si la base est neuve)." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
if ($ready) {
  Write-Host "  INSTALLATION RÉUSSIE — EduNova Pro + Supabase Local sont actifs !" -ForegroundColor Green
} else {
  Write-Host "  Conteneurs démarrés (vérifiez 'docker compose -f docker-compose.local.yml ps')" -ForegroundColor Yellow
}
Write-Host "  Accès sur ce PC     : http://localhost:3000" -ForegroundColor White
if ($Mode -eq "lan") {
  Write-Host "  Accès postes LAN    : http://${LanIp}:3000" -ForegroundColor White
}
Write-Host "  Vous pouvez maintenant travailler sans connexion Internet." -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
