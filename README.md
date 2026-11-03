# Custom Firefox Client (Gecko)

A custom browser built by forking Gecko (`mozilla-central`, via the `gecko-dev` git mirror).

## Repository contents

This repo holds the Celesta work only — not the 1 GB Firefox clone or its 34 GB build output.

| Path | Purpose |
|---|---|
| `home/` | Standalone OLED start-page prototype (run: `python -m http.server 8742`) |
| `patches/firefox-celesta.patch` | Full diff against `mozilla-firefox/firefox` `main`: branding, newtab redirect, `browser/content/Celesta/` chrome, prefs |
| `sites-radar.backup.js` | Traffic database: Cloudflare Radar worldwide top 100, 56 country top-100 lists, ranking sets to top 100k, CrUX top 200k origins |
| `mozconfig` | Build configuration (`--with-branding=browser/branding/celesta`) |
| `launch-gecko.ps1` | Launches the built `firefox.exe` with `profile-celesta` |
| `HANDOFF.md` | Current state, what is broken, next steps |

Apply the patch to a fresh clone:

```powershell
git clone https://github.com/mozilla-firefox/firefox.git Celesta-src
cd Celesta-src
git apply --3way ..\browser\patches\Celesta.patch
```

Two large generated files (`browser/content/Celesta/sites-radar.js`, `sites-radar.js`/`sites-layout.js`) are excluded from the patch and regenerated from the dataset.

## Layout


| Path | Purpose |
|---|---|
| `D:\browser\gecko\` | Firefox source tree (shallow clone of **mozilla-firefox/firefox**, official repo, branch `main`) |
| `D:\browser\gecko\obj-ff\` | Build output directory (created by `mach`) |
| `D:\browser\mozconfig\` → file `mozconfig` | Build configuration (see `mozconfig`) |
| `D:\.mozbuild\` | Mozilla toolchain state: clang, rust sysroot, node, venv |
| `D:\browser\home\` | Home page UX prototype (OLED star network) — port to `chrome://` later |

> **Lesson learned:** `github.com/mozilla/gecko-dev` froze on 2025-07-08 when Mozilla
> moved to the official `github.com/mozilla-firefox/firefox` repo. Always clone from the
> official repo — `mach bootstrap` validates revision freshness against the toolchain
> artifact index and fails on stale checkouts.

## Environment

Set at User level (new terminals get these automatically; current shells must set them manually):

- `MOZCONFIG = D:\browser\mozconfig`
- `MOZBUILD_STATE_PATH = D:\.mozbuild`

## Build commands

Run from the source tree:

```powershell
$env:MOZCONFIG = 'D:\browser\mozconfig'          # only needed if env not picked up
$env:MOZBUILD_STATE_PATH = 'D:\.mozbuild'
cd D:\browser\gecko
./mach bootstrap                                  # one-time: toolchains + VS check
./mach build                                      # first build: 1-2 h on Ryzen 5 3600
./mach run                                        # build + launch
```

Incremental builds after a code change: `./mach build` (only rebuilds what changed).

## Milestones

- [x] M0: Environment assessment (VS 2022 + Win11 SDK, Rust, Python 3.12, MozillaBuild)
- [x] M0b: Home page UX prototype built (`home/`), spec locked: OLED black, star network,
      right-click floating omnibox (edge-clamped), curated seed list
- [x] M0c: `mach bootstrap` succeeded on official repo (all toolchains: clang, rust, sccache…)
- [x] M0d: Prototype iterated to feature-complete UX — floating glass bubble chrome (tabs +
      bookmarks, hover-reveal text), warp lock-on transition, per-site sub bubbles, WebGL
      space shader (domain-warped nebulae + galactic band, parallax pan/zoom), proximity
      icon reveal, shooting stars for unvisited sites, smooth cursor-anchored zoom,
      right-click toggle omnibox, favicon fallback chain, lock-on persists across Back
- [x] M0e: Refinement batch verified on `?v=15` — zoom 0.25–4.0 with dt-snappy ease (settles
      in ~7 frames), shader strictly pan-parallax (zoom-independent at fixed time), popularity
      sizing (54/43/37 px), related-only clustered links (38), named sublinks for 16 popular
      sites (32 subs w/ hover labels + path URLs), letter-only-when-no-logo (`has-img`),
      logo-averaged bubble tint via icon.horse CORS queue (22/36 tinted, monochrome logos
      keep static hue), more/slower shooting stars (cap 3, 2.6–3.4 s), camera eases home on
      Back, composited halo+scene (`will-change`) for zoom FPS
- [x] M0f: Final UX batch verified on `?v=20` — shooting stars: edge-to-edge chords (start
      AND end on a screen edge, 36 px lead-out), uniform random direction, constant
      335-405 px/s independent of window size, per-star `--tl` trail length (0.55 s of
      path) with hue-to-white gradient + glow, no duplicate site on screen; warp dive
      anchored at the clicked bubble's screen position (pinned during flight, never
      screen centre); force-directed layout: related-only springs with adaptive clearance
      (shrinks on small windows so 30 bubbles always fit), gravity fills the centre,
      per-iteration bounds clamp + collision polish (measured medLinked 152 vs
      medUnlinked 369, minGap 53 px, no overlap); right-click bubble dropdown (`#ctxmenu`:
      Open / Open in new tab / Copy link / Search this site with `site:domain ` prefill,
      hue inherits from bubble, toggle/outside-press/Escape/wheel close, right-click
      elsewhere swaps it for the omnibox); darker bubbles (#060608) + full contrast pass
      (text 0.62, edges 0.13, chrome/omnibox brighter, shader contrast before dither)
- [x] M0g: Readability + world-space batch verified on `?v=30` — shooting stars: `.face` is
      a sibling of the rotated `.aim`, so it must never rotate (the old counter-rotation
      turned labels vertical); icon now fills the 30 px head (26 px favicon) with the label
      at 24 px below; trail `box-shadow` removed (it drew a glowing blunt cap around the
      transparent tail) — glow is now a blurred twin of the same gradient, so it fades with
      the tail; bright leading tip moved to `.aim::after`; star endpoints are computed in
      world space and projected through pan/zoom at spawn (also fixed the animation using
      raw world coords, which centred paths on the world origin instead of the viewport) —
      each path spans 1.4× the viewport diagonal and crosses the page; background shader:
      the canvas is a replaced element, so `inset: 0` left it at its 500×350 backing size
      (the black-rectangle "broken shader" bug) — now `width/height: 100vw/100vh`, and all
      `backdrop-filter` layers over WebGL were removed; popularity layout: post-sim radial
      remap (blend 0.75 toward a popularity target radius, pop 5 innermost → pop 2 near the
      rim) + collision polish + fill-scale (r = −0.49, pop 5 at 126 px vs pop 2 at 251 px;
      clustering kept: linked 109 px vs unlinked 296 px, min gap 54 px); harness updated to
      51/51 green (upright `.face`, 30/26 px head, 24 px label, clean trail, page-spanning
      paths, canvas cover, no backdrop-filter)
- [x] M0h: Batch verified on `?v=31` — warp ends dead-centre (anchor eases from click to screen
      centre); sub-bubble lock-on resolves to sub id; `fetch` connection during lock-on;
      sub bubbles magnetic to cursor (spring within ~150 px); popularity sizing 30–62 px;
      shooting stars fixed 30/120 px, 190–265 px/s, trail starts at bubble rear edge, fade
      bubble-first / trail-second (reverse on exit), world-anchored via live pan/zoom,
      48 px `.grab`; shader `RENDER=1.0` / `layerUV` with `uZoom` / 100vw/100vh canvas;
      harness 69/69 green — reload your Start tab (do not steal focus)
- [x] M1: Vanilla build compiles and launches — Firefox 161.0a1, built 2026-10-22 (~2h40m,
      optimized, no tests; binary at `gecko\obj-ff\dist\bin\firefox.exe`)
- [ ] M2: Custom identity — name, icon, branding, clean default prefs (no telemetry/pocket/firstrun)
- [ ] M3: Port `home/` into the browser as its startup page

## Notes

- Firefox requires pinned toolchain versions — `mach bootstrap` downloads Mozilla's own
  clang/Rust into `D:\.mozbuild` (does not use your system clang).
- First `./mach build` is the expensive one; later builds are incremental.
