## Celesta 0.1.0 — Windows

A custom Gecko browser with an OLED star-network start page.

### What's in it

- **Start page**: every one of the 1.2 M sites from the Cloudflare Radar / CrUX data set, laid out from a precomputed 14 MB layout so it opens without laying anything out in the browser
- **Distance LOD**: sub-2 px bubbles draw a tight dot quad instead of glow-sized overdraw — the bubble pass went from 863 ms to 33 ms GPU p50
- **Navigation**: click a bubble to lock on and open; right-click a bubble for its menu; right-click empty space for the omnibox
- **Hover notes**: every domain maps to its own pitch on a pentatonic scale, faint, with a volume slider; silent while any tab is playing audio
- **Bars**: tab strip and address bar auto-hide and return on edge hover or `Ctrl+Space`
- **Window title**: content and brand join as `Start / Celesta`

### Install

1. Run `Celesta-Setup-0.1.0.exe` (one UAC prompt; installs to `Program Files\Celesta`)
2. Launch from the desktop or Start Menu shortcut

The installer is **unsigned**, so Windows SmartScreen will warn on first run. Choose "More info → Run anyway" if you trust the build.

### Notes

- The payload is trimmed: no crash reporter, updater, telemetry pinger, dev shell binaries or PDBs
- Profile and settings live in `%LOCALAPPDATA%\Celesta`
- Uninstall via Settings → Apps, or the Start Menu uninstaller
