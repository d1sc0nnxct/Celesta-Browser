## Celesta 0.2.0 — Windows

Consolidated release: everything since 0.1.0 in one build.

### Start page

- 1.2 M sites from the shipped layout (`shipped:1219112:1826085808`)
- Distance LOD: bubble pass GPU p50 863 ms → 33 ms
- Relaxed layout: ~59 k overlapping bubble pairs separated
- Per-site celesta notes on a 35-step major scale over five octaves, with reverb
- Volume slider; notes mute while any browser tab plays audio
- Icons fade in and out; the reveal point trails the cursor; small-bubble labels clear their glow

### Browser

- Bars auto-hide by default; `Ctrl+Space` or a new/middle-clicked tab brings them back
- Sky pans 1:1 with the page (no parallax lag)
- Window and application identity read Celesta (`application.ini`, exe metadata, title `Start / Celesta`)
- Address bar uses a compact 3.3 MB index instead of the 63 MB export in the parent process
- Process count reduced from 8 to 5 (single content process, no RDP/media process, extensions in-process)
- Window-control pills and vertical-rail padding

### Install

Run `Celesta-Setup-0.2.0.exe` (one UAC prompt; installs to `Program Files\Celesta`). Unsigned, so SmartScreen warns once.

### Still open

Settings-page restructuring (background settings in Theme, per-section dropdowns, theme styling on the settings page, shader centring, vertical-tabs toggle, density on the bars, even bar expansion), the remaining memory work, star rendering beyond the gaussian core, and lag-spike follow-up.
