<#
  build.ps1 - one-click build for Farm Tycoon.

  -Installer  additionally packages the unsigned Squirrel.Windows installer CI publishes.
  -Silent     no prompts, no launch offer, non-zero exit on the first real failure.

  Deliberately calls tools/bootstrap.ps1 itself rather than assuming dependencies exist: one
  click means one click, and nobody should have to know download-dependencies.bat is there.
#>
[CmdletBinding()]
param([switch]$Silent, [switch]$Installer)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$started = Get-Date

function Say([string]$m) { Write-Host "[build] $m" }
function Fail([string]$m) { Write-Host "[build] FAILED: $m" -ForegroundColor Red; exit 1 }

# --- 1. dependencies ------------------------------------------------------------------------
Say 'phase 1/3: dependencies'
$bootstrapArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'bootstrap.ps1'))
if ($Silent) { $bootstrapArgs += '-Silent' }
& powershell.exe @bootstrapArgs
if ($LASTEXITCODE -ne 0) { Fail "dependency bootstrap exited $LASTEXITCODE" }

Push-Location $repo
try {
  # --- 2. tests ------------------------------------------------------------------------------
  # The game has no compile step, so the test chain IS the build check. GitHui runs no tests at
  # all (see .github/workflows/release.yml), which makes this the only place they ever gate.
  Say 'phase 2/3: tests'
  # Native stderr is not an error. The suite deliberately prints 'Error: boom - a broken provider
  # must not break the render loop' from a fixture, and under ErrorActionPreference='Stop' that
  # one line aborts a run whose exit code is 0. Judge npm by its exit code, nothing else.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $testOut = & npm test 2>&1
  $testExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  $testOut | Out-Host
  if ($testExit -ne 0) { Fail "npm test exited $testExit" }
  $passed = 0; $failed = 0
  foreach ($line in $testOut) {
    if ("$line" -match '^(\d+) passed, (\d+) failed') { $passed += [int]$Matches[1]; $failed += [int]$Matches[2] }
  }
  Say "tests: $passed passed, $failed failed"
  if ($failed -gt 0) { Fail "$failed test(s) failed" }

  # --- 3. package ----------------------------------------------------------------------------
  if ($Installer) {
    Say 'phase 3/3: unsigned Squirrel.Windows installer'
    # electron-builder reuses stale output, so clear it or a failed build looks like a good one.
    foreach ($d in 'dist\win-unpacked','dist\squirrel-windows') {
      $p = Join-Path $repo $d
      if (Test-Path $p) { Remove-Item -Recurse -Force $p }
    }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & npm run dist 2>&1 | Out-Host
    $distExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($distExit -ne 0) { Fail "npm run dist exited $distExit" }

    $setup = Get-ChildItem (Join-Path $repo 'dist\squirrel-windows') -Filter '*Setup*.exe' -ErrorAction SilentlyContinue |
             Select-Object -First 1
    if (-not $setup) { Fail 'packaging reported success but no Setup executable was produced.' }
    foreach ($required in 'RELEASES') {
      if (-not (Test-Path (Join-Path $repo "dist\squirrel-windows\$required"))) {
        Fail "packaging did not produce $required"
      }
    }
    $hash = (Get-FileHash $setup.FullName -Algorithm SHA256).Hash
    $sig  = (Get-AuthenticodeSignature $setup.FullName).Status
    Say "installer: $($setup.FullName)"
    Say ("size:      {0:N0} bytes" -f $setup.Length)
    Say "sha256:    $hash"
    Say "signature: $sig"
    # Code signing is permanently out of scope, so say it rather than letting a user meet the
    # unknown-publisher warning with no warning of their own.
    if ($sig -ne 'NotSigned') { Fail "expected an unsigned installer, got signature status '$sig'" }
    Say 'This installer is UNSIGNED and Windows will show an unknown-publisher / SmartScreen warning.'
  } else {
    Say 'phase 3/3: packaging skipped (pass -Installer, or use build-installer.bat)'
  }
} finally { Pop-Location }

$elapsed = [int]((Get-Date) - $started).TotalSeconds
Say "done in $elapsed s"

if (-not $Silent) {
  $answer = Read-Host 'Launch Farm Tycoon now? [y/N]'
  if ($answer -match '^(y|yes)$') {
    Say 'starting Electron'
    Push-Location $repo
    try { & npm start } finally { Pop-Location }
  }
}
exit 0
