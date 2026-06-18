# Fresh start — wipe ALL data + create platform super admin
# Run from project root in PowerShell:
#   .\scripts\fresh-start.ps1
#
# Requires .env.local with:
#   NEXT_PUBLIC_SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$envFile = Join-Path $projectRoot ".env.local"
if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found. Add your Supabase URL and service role key first."
}

$superAdminBlock = @"

# Fresh start super admin (scripts/fresh-start.ps1)
SUPER_ADMIN_EMAIL=pyxitsolutions@gmail.com
SUPER_ADMIN_PASSWORD=rio123456
SUPER_ADMIN_NAME=TalyerHub Admin
"@

$content = Get-Content $envFile -Raw
if ($content -notmatch "SUPER_ADMIN_EMAIL=") {
  Add-Content -Path $envFile -Value $superAdminBlock
  Write-Host "Added SUPER_ADMIN_* settings to .env.local"
} else {
  Write-Host "Using existing SUPER_ADMIN_* settings in .env.local"
}

Write-Host ""
Write-Host "TalyerHub — fresh start"
Write-Host "This will DELETE all shops, data, and accounts."
Write-Host ""

npm run db:reset
