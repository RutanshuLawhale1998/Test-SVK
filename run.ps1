# Starts Nukad Coffee using the portable Node runtime in ..\..\nodeenv
# (Node is not installed system-wide on this machine, so PATH is set per-run.)
#
#   .\run.ps1              live if .env has a key, otherwise the shelf copies
#   .\run.ps1 -Curated     force the shelf copies
#   .\run.ps1 -Port 4000   serve on another port

param(
  [switch]$Curated,
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$nodeDir = Get-ChildItem (Join-Path $root '..\..\nodeenv') -Directory -Filter 'node-v*' -ErrorAction SilentlyContinue |
           Sort-Object Name -Descending | Select-Object -First 1
if (-not $nodeDir) {
  Write-Error "No portable Node found in $(Resolve-Path (Join-Path $root '..\..')) \nodeenv. Install Node, or re-extract the runtime there."
}

$env:Path = "$($nodeDir.FullName);$env:Path"
$env:PORT = "$Port"

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host "Installing dependencies..." -ForegroundColor DarkYellow
  & npm install --no-audit --no-fund --prefix $root
}

# so the Devanagari banner renders instead of mojibake
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$argv = @((Join-Path $root 'server.js'))
if ($Curated) { $argv += '--curated' }

& node @argv
