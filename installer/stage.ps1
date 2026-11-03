# Stage a trimmed Celesta payload into installer\Celesta for NSIS.
# Layout: Celesta.exe next to a browser\ directory holding the gecko runtime.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'gecko\obj-ff\dist\bin'
$stage = Join-Path $PSScriptRoot 'Celesta'
$appDir = Join-Path $stage 'browser'

if (-not (Test-Path $dist)) { throw "no build output at $dist" }
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

Write-Host "copying browser runtime ..."
Copy-Item "$dist\*" $appDir -Recurse -Force

# development leftovers that must never ship
$dropDirs = @('profile-celesta', 'profile-umbra', 'profile', 'uninstall', 'desktop-launcher', 'sdk', 'include', 'idlc', 'python')
foreach ($d in Get-ChildItem $appDir -Directory) {
  if ($dropDirs -contains $d.Name) { Remove-Item $d.FullName -Recurse -Force; Write-Host "  - $($d.Name)/" }
}

# crash reporting, updates, dev shell
$dropFiles = @(
  'crashreporter.exe', 'crashreporter.ini', 'crashreporter.exe.manifest',
  'minidump-analyzer.exe', 'pingsender.exe', 'updater.exe', 'updater.ini',
  'update-settings.ini', 'js.exe', 'xpcshell.exe', 'ssltunnel.exe',
  'default-browser-agent.exe', 'notification_helper.exe'
)
foreach ($f in $dropFiles) {
  $p = Join-Path $appDir $f
  if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  - $f" }
}

Get-ChildItem $appDir -Recurse -File -Include *.pdb,*.map,*.chk,*.log | Remove-Item -Force

Copy-Item (Join-Path $root 'Celesta.exe') $stage -Force

$size = (Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum)
Write-Host ("staged {0:N0} files, {1:N0} MB -> {2}" -f $size.Count, ($size.Sum / 1MB), $stage)
