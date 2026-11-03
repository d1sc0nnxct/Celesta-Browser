## Celesta 0.1.2 — Windows

### Changed

- **Address-bar suggestions no longer load the 63 MB export in the parent process.** A compact 3.3 MB list of the top 50,000 sites is generated at build time; the old path blocked startup for ~6 s and held ~1.6 GB.
- **Windows process metadata** is hard-coded to Celesta in the executable's version resource, so Task Manager and file properties should read Celesta rather than Nightly.
- **Capture mode** (`?shot=1`) clears bubble names and category captions, for documentation screenshots.

### Install

1. Run `Celesta-Setup-0.1.2.exe` (one UAC prompt; installs to `Program Files\Celesta`)
2. Launch from the desktop or Start Menu shortcut

The installer is **unsigned**, so SmartScreen warns on first run ("More info → Run anyway").

### Still open

Settings-page restructuring (background settings in Theme, per-section dropdowns, theme styling on the settings page, shader centring, vertical-tabs toggle, density on the bars), process compaction, remaining memory work, star rendering, resize artefacts.
