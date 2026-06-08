#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-time setup for the EV Research project on Windows.
    Installs: Terraform, doctl (DigitalOcean CLI), generates SSH key.
    Run once from an elevated PowerShell terminal:
        Set-ExecutionPolicy Bypass -Scope Process -Force
        .\infrastructure\scripts\windows_setup.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    WARN: $msg" -ForegroundColor Yellow }

# --- 1. Winget check ---
Write-Step "Checking winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget not found. Install 'App Installer' from the Microsoft Store first."
}
Write-OK "winget available"

# --- 2. Terraform ---
Write-Step "Installing Terraform"
if (Get-Command terraform -ErrorAction SilentlyContinue) {
    Write-OK "Terraform already installed"
} else {
    winget install --id Hashicorp.Terraform --accept-source-agreements --accept-package-agreements -e
    Write-OK "Terraform installed"
}

# --- 3. doctl (DigitalOcean CLI) ---
Write-Step "Installing doctl"
if (Get-Command doctl -ErrorAction SilentlyContinue) {
    Write-OK "doctl already installed"
} else {
    winget install --id DigitalOcean.doctl --accept-source-agreements --accept-package-agreements -e
    Write-OK "doctl installed"
}

# --- 4. SSH key ---
Write-Step "Setting up SSH key"
$sshDir  = Join-Path $env:USERPROFILE ".ssh"
$keyPath = Join-Path $sshDir "ev_research_ed25519"

if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir | Out-Null
}

if (Test-Path $keyPath) {
    Write-Warn "SSH key already exists at $keyPath - skipping generation"
} else {
    ssh-keygen -t ed25519 -C "ev-research" -f $keyPath -N ""
    Write-OK "SSH key generated at $keyPath"
}

$pubKey = Get-Content "$keyPath.pub"
Write-Host ""
Write-Host "*** Your SSH public key (paste into terraform.tfvars as ssh_public_key) ***" -ForegroundColor Yellow
Write-Host $pubKey -ForegroundColor White

# --- 5. Refresh PATH so new tools are usable immediately ---
Write-Step "Refreshing PATH"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")
Write-OK "PATH refreshed"

# --- 6. Summary ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Setup complete! Next steps:"            -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Authenticate doctl (run in a new terminal):"
Write-Host "       doctl auth init"
Write-Host "   Paste your DO Personal Access Token when prompted."
Write-Host ""
Write-Host "2. Copy terraform.tfvars.example to terraform.tfvars:"
Write-Host "       Copy-Item infrastructure\terraform\terraform.tfvars.example infrastructure\terraform\terraform.tfvars"
Write-Host ""
Write-Host "3. Fill in terraform.tfvars with your credentials."
Write-Host "   Your SSH public key is printed above - paste it in."
Write-Host ""
Write-Host "4. Apply infrastructure:"
Write-Host "       cd infrastructure\terraform"
Write-Host "       terraform init"
Write-Host "       terraform apply"
Write-Host ""
Write-Host "5. Copy the outputs (Droplet IP, DB URI) into config\.env"
Write-Host ""
