## Celesta 0.1.3 — Windows

### Changed

- **Application identity renamed**: the branding now sets `MOZ_APP_BASENAME=Celesta`, so `application.ini` reports `Name=Celesta` instead of `Firefox`. Together with the 0.1.2 executable metadata, Windows and Gecko's own application info both read Celesta.
- Identity strings (brand name, display name, company, process description) are Celesta; internal build identifiers (`MOZ_APP_NAME`, preference names, module paths, `firefox.js`) are deliberately unchanged so profiles, build paths and prefs keep working.

### Install

1. Run `Celesta-Setup-0.1.3.exe` (one UAC prompt; installs to `Program Files\Celesta`)
2. Launch from the desktop or Start Menu shortcut

The installer is **unsigned**, so SmartScreen warns on first run ("More info → Run anyway").

### Logo sizes

Master artwork 1024×1024; Windows needs 16/24/32/48/64/128/256 PNGs plus a multi-size `.ico`, macOS a 1024 icon for Assets.car, Linux 16–512 PNGs.
