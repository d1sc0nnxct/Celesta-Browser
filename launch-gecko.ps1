# Launch the Umbra Gecko build as an actual Windows process.
# Usage (PowerShell):  .\launch-gecko.ps1
# Runs the branded build binary on its packaged start page, then exits when you close it.

$bin = "$PSScriptRoot\gecko\obj-ff\dist\bin"
$exe = "$bin\firefox.exe"
if (-not (Test-Path $exe)) {
    Write-Error "Binary not found at $exe - run ./mach build first"
    exit 1
}

$profileDir = "$bin\profile-umbra"
New-Item -ItemType Directory -Force $profileDir | Out-Null

# -purgecaches: front-end files in dist are updated in place, which does not
# change the build ID that would otherwise invalidate the profile's startup
# script cache, so a stale chrome.js could keep running.
$ffArgs = @(
    "-no-remote",
    "-purgecaches",
    "-profile", $profileDir,
    "about:home"
)

Write-Host "Starting Umbra (Gecko) process: $exe"
Start-Process -FilePath $exe -ArgumentList $ffArgs -Wait
Write-Host "Umbra exited (process finished)"
