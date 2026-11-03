## Celesta 0.1.1 — Windows

Polish pass on the start page and bars.

### Changed

- **Bars hide by default** and return on edge hover, on a new or middle-clicked tab, or with `Ctrl+Space`
- **Background pans 1:1 with the page** — the parallax offset that made it trail is gone
- **Bubble icons fade in and out** instead of popping with their DOM nodes
- **Icon reveal trails the cursor slightly**, so a fast pass still reveals what it crosses
- **Labels on small bubbles** get extra clearance so the name sits below the glow
- **More notes**: every domain still has its own pitch, now on a 35-step major scale over five octaves
- **Reverb**: a small synthetic room sits behind the hover notes
- **Window controls are pills** at any corner-roundness setting
- **Vertical tab rail** keeps its edges inside the rounded frame at maximum roundness

### Install

1. Run `Celesta-Setup-0.1.1.exe` (one UAC prompt; installs to `Program Files\Celesta`)
2. Launch from the desktop or Start Menu shortcut

The installer is **unsigned**, so SmartScreen warns on first run ("More info → Run anyway").

### Still open

The larger settings-page batch (background settings moved into Theme, per-section dropdowns, theme styling on the settings page, custom-shader centring, vertical-tabs toggle, density and even bar expansion), process/memory work, Task Manager naming, star rendering and the UI-free screenshot are not in this build.
