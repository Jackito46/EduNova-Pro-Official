# Script de préparation Windows 10/11 avant installation de Docker Desktop
# À exécuter dans PowerShell en tant qu'Administrateur :
#   powershell -ExecutionPolicy Bypass -File deploy\local-lan\prepare-windows-docker.ps1

$ErrorActionPreference = "Stop"

# Vérifier les privilèges Administrateur
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "[ERREUR] Veuillez exécuter PowerShell en tant qu'Administrateur !" -ForegroundColor Red
  exit 1
}

Write-Host "[1/4] Vérification de la virtualisation matérielle CPU..." -ForegroundColor Cyan
$virtEnabled = (Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled
if ($virtEnabled -eq $false) {
  Write-Host "[ATTENTION] La virtualisation matérielle (Intel VT-x / AMD-V) semble désactivée dans le BIOS/UEFI." -ForegroundColor Yellow
  Write-Host "            Pensez à l'activer dans le BIOS après le redémarrage." -ForegroundColor Yellow
} else {
  Write-Host "       Virtualisation matérielle OK." -ForegroundColor Green
}

Write-Host "[2/4] Activation de la fonctionnalité 'Virtual Machine Platform'..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null

Write-Host "[3/4] Activation du Sous-système Windows pour Linux (WSL)..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null

Write-Host "[4/4] Mise à jour de WSL 2 si possible..." -ForegroundColor Cyan
try {
  wsl --set-default-version 2 | Out-Null
} catch {
  Write-Host "       Exécutez 'wsl --install --no-distribution' si le noyau WSL2 n'est pas encore présent." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " Prérequis activés ! REDÉMARREZ VOTRE PC maintenant," -ForegroundColor Green
Write-Host " puis relancez Docker Desktop en mode 'All-users installation'." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
