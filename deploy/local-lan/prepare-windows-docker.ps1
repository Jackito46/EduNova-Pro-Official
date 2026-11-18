# Script de preparation Windows 10/11 avant installation de Docker Desktop
# A executer dans PowerShell en tant qu'Administrateur :
#   powershell -ExecutionPolicy Bypass -File .\deploy\local-lan\prepare-windows-docker.ps1

$ErrorActionPreference = "Stop"

# Verifier les privileges Administrateur
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "[ERREUR] Veuillez executer PowerShell en tant qu'Administrateur !" -ForegroundColor Red
  exit 1
}

Write-Host "[1/4] Verification de la virtualisation materielle CPU..." -ForegroundColor Cyan
$virtEnabled = (Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled
if ($virtEnabled -eq $false) {
  Write-Host "[ATTENTION] La virtualisation materielle (Intel VT-x / AMD-V) semble desactivee dans le BIOS/UEFI." -ForegroundColor Yellow
  Write-Host "            Pensez a l'activer dans le BIOS apres le redemarrage." -ForegroundColor Yellow
} else {
  Write-Host "       Virtualisation materielle OK." -ForegroundColor Green
}

Write-Host "[2/4] Activation de la fonctionnalite 'Virtual Machine Platform'..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null

Write-Host "[3/4] Activation du Sous-systeme Windows pour Linux (WSL)..." -ForegroundColor Cyan
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null

Write-Host "[4/4] Mise a jour de WSL 2 si possible..." -ForegroundColor Cyan
try {
  wsl --set-default-version 2 | Out-Null
} catch {
  Write-Host "       Executez 'wsl --install --no-distribution' si le noyau WSL2 n'est pas encore present." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " Prerequis actives ! REDEMARREZ VOTRE PC maintenant," -ForegroundColor Green
Write-Host " puis relancez Docker Desktop en mode 'All-users installation'." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
