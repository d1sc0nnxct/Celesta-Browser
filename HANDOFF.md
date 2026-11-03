# Umbra Handoff — Mon Nov 02 2026

## Running
- Firefox: PID 17296 (`firefox.exe`), `profile-umbra`, `v=32` at `http://127.0.0.1:8742/index.html?v=32`
- Server: `python -m http.server 8742` (localhost) — up
- Process: 8 workers (parent + content/GPU)

## Done (M0h + M2/M3 source edits)
- `graph.js`: embedded SEED + `rebuildDB()` + `sites.json` DB; buttons navigate; search lock-on; sub magnetism reduced; shooting stars world-anchored
- `space.js`: `RENDER=1.0`; `layerUV` zoom-at-cursor; live `Space.draw` (no frozen `skyPan`)
- `style.css`: trail at rear edge; `.grab`; chrome dark-glass; `userChrome.css` (no titlebar/native chrome)
- `index.html`: `?v=32`; `#chrome` with title; bookmark toolbar width by count
- `test.html`: 69/69 green (warp + magnet suites)
- `README.md`: M0h entry
- `launch-gecko.ps1`: Windows process launcher
- `sites.json`: 12 high-traffic sites
- M3 redirect (`AboutNewTabRedirector.sys.mjs`): points to `chrome://umbra/content/index.html`
- `browser/base/jar.mn`: `% content umbra %content/umbra/`
- `browser/branding/umbra/`: branding dir exists; `mozconfig` includes `--with-branding`
- `profile-umbra/prefs.js`: sync off, bloat disabled, chrome URL set

## Broken / Fixed (last cycle)
- Blank page: `.tabbrowser-tab { display:none }` in `userChrome.css` → removed; embedded SEED restored; `userChrome.css` minimized
- `graph.js` old SEED remnants → cleaned by `clean_graph.py`
- `sites.json` missing from chrome package → copied to `gecko/browser/content/umbra/`

## Still Needs
- `./mach build faster` (front-end, skips C++) to compile `jar.mn` → `omni.ja` → makes `chrome://umbra/` self-contained (no localhost server)
- After build: restart Firefox; it will open `chrome://umbra/content/index.html` directly

## Not Working (current)
- Window renders but stars may need mouse interaction / rebuild to fully draw (DB loads async; embedded seed is backup)
- `userChrome.css` may need refresh after restart (already restarted once)

## Next
1. Run `./mach build faster` in `D:rowser\gecko` (binary exists; just front-end jar)
2. Restart Firefox with `profile-umbra` — should load packaged home directly
3. Verify bubbles, shader, stars visually
