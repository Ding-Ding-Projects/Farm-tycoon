<#
  bootstrap.ps1 - obtain every dependency Farm Tycoon needs to build, on a machine that has none.

  The game itself has no dependencies and no build step: index.html loads src/main.js as a plain
  ES module. Everything below exists for PACKAGING - Electron and electron-builder - and for the
  test chain, which is plain `node tools/test-*.mjs`. So the whole dependency surface is: Node,
  and `npm ci`.

  Touchless by contract: no prompt, no manual download, and never a sentence that begins
  "install X and run this again". If Node is missing it is installed user-scoped through the
  package manager that ships with current Windows.
#>
[CmdletBinding()]
param([switch]$Silent, [switch]$SkipInstall)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$started = Get-Date

function Say([string]$m) { Write-Host "[deps] $m" }
function Fail([string]$m) { Write-Host "[deps] FAILED: $m" -ForegroundColor Red; exit 1 }

# A package manager writes PATH for FUTURE shells, so the very next command in THIS one still
# cannot find what was just installed. Re-read the machine and user PATH after any install, or a
# successful install reads as a failed one.
function Sync-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path','User')
}

Say "repository: $repo"

# --- Node ---------------------------------------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Sync-Path
  $node = Get-Command node -ErrorAction SilentlyContinue
}
if (-not $node) {
  if ($SkipInstall) { Fail 'Node.js is missing and -SkipInstall was passed.' }
  Say 'Node.js not found - installing user-scoped through winget.'
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Fail 'Node.js is missing and winget is unavailable. Install Node.js 20 or newer from https://nodejs.org and re-run.'
  }
  & winget install --id OpenJS.NodeJS.LTS --scope user --silent `
      --accept-package-agreements --accept-source-agreements 2>&1 | Out-Host
  Sync-Path
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Fail 'winget reported success but node is still not on PATH.' }
}
$nodeVersion = (& node --version).Trim()
Say "node $nodeVersion at $($node.Source)"

$major = 0
if ($nodeVersion -match '^v(\d+)') { $major = [int]$Matches[1] }
if ($major -gt 0 -and $major -lt 20) {
  Fail "node $nodeVersion is too old; electron-builder needs 20 or newer."
}

# --- npm packages -------------------------------------------------------------------------
# Packaging only. Nothing here is loaded by the game at runtime.
Push-Location $repo
try {
  $needInstall = $true
  if (Test-Path (Join-Path $repo 'node_modules\electron-builder\package.json')) {
    Say 'node_modules already carries electron-builder - verifying rather than reinstalling.'
    $needInstall = $false
  }
  if ($needInstall) {
    if ($SkipInstall) { Fail 'node_modules is missing and -SkipInstall was passed.' }
    Say 'npm ci (this fetches the Electron binary, about 100 MB the first time)'
    & npm ci 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail "npm ci exited $LASTEXITCODE" }
  }

  # electron's own postinstall can exit 0 while extracting nothing, leaving no electron.exe and
  # no error anywhere. Judge it by the binary existing, never by the exit code.
  $electronExe = Join-Path $repo 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path $electronExe)) {
    Say 'electron.exe missing after install - running electron/install.js'
    & node (Join-Path $repo 'node_modules\electron\install.js') 2>&1 | Out-Host
    if (-not (Test-Path $electronExe)) {
      Fail 'electron.exe is still absent. Delete node_modules and re-run, or check the @electron/get cache.'
    }
  }
  Say "electron binary present: $electronExe"
} finally { Pop-Location }

$elapsed = [int]((Get-Date) - $started).TotalSeconds
Say "all dependencies present ($elapsed s)"
exit 0
