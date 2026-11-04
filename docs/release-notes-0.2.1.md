## Celesta 0.2.1 — Windows

Fixes for the toolbar and page load regressions in 0.2.0.

### Fixed

- **Toolbar**: removed the extra window-control/vertical-rail CSS and the process-compaction prefs that broke the bars; the tab strip and address bar behave as they did before.
- **Stars**: reverted the gaussian-core experiment that made stars look like fuzzy blobs.
- **First paint**: the packaged picture of the field (`first-paint.jpg`) is now shown immediately by `boot.js` and replaced by the live map when it is ready, so a new tab no longer sits black during the catalogue parse.

### Install

Run `Celesta-Setup-0.2.1.exe` (one UAC prompt). Unsigned, so SmartScreen warns once.

### Note

The full 1.2 M catalogue still takes several seconds to parse and lay out; the snapshot hides that wait rather than shortening it. Cutting the real time means changing how the dataset is shipped (binary/streamed), which is a separate piece of work.
