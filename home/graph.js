/* ============================================================
   Star network graph + right-click floating omnibox
   World coordinates: (0,0) = viewport center at scale 1
   ============================================================ */

"use strict";

/* ---------------- popular sites network ----------------
   Every site in the database (sites.js) is a bubble: pop (1-100) sets its
   size and how close to the middle it sits, cat groups related sites.
   links are filled in by the layout (each site to its nearest more popular
   neighbour in the same category). */
const CAT_HUE = Object.fromEntries(SITE_CATEGORIES.map((c, i) =>
  [c.id, c.id === "other" ? 225 : Math.round((12 + i * 137.508) % 360)]));
const hueJitter = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 25) - 12;
};
/* settings from Settings > Home, set on the root element by CELESTAHomeChild
   before this script runs (missing when the page is opened as a plain file) */
const SETTINGS = document.documentElement.dataset;
const setting = (key, fallback) => (SETTINGS[key] ?? String(fallback));
if (setting("CELESTALogos", "hover") === "always") document.documentElement.classList.add("logos-always");
// hiding uncategorized sites keeps everyone else's positions: the layout
// is still computed (and cached) for the whole database
// si: the site's index in SITES, which is how the cached layout stores it
const showOther = setting("CELESTAUncategorized", true) === "true";
const SEED = {
  nodes: SITES.flatMap((s, si) => showOther || s.cat !== "other"
    ? [{ ...s, si, hue: s.hue ?? (CAT_HUE[s.cat] ?? 255) + hueJitter(s.id), pos: { x: 0, y: 0 } }] : []),
  links: [],
};

/* visited sites + lock-on target persist across reloads / back navigation */
const VISITED_KEY = "CELESTA.visited", LOCK_KEY = "CELESTA.lock.target";
function safeSSGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function safeSSSet(k,v){ try { sessionStorage.setItem(k, v); } catch (e) {} }
// sites opened from a shooting star; privileged pages have no localStorage
let visited = new Set();
function markVisited(id) { visited.add(id); kvPut(VISITED_KEY, [...visited]); }

const $ = (s) => document.querySelector(s);
const nodesEl = $("#nodes"), edgesEl = $("#edges"), sceneEl = $("#scene");

/* ---------------- state ---------------- */
let ZMIN = 0.25;                             // lowered by fitCamera() to show the whole network
const ZMAX = 4.0;                            // wide zoom range — the sky never rescales
let homeZoom = 1;                            // fitCamera(): frames the most popular sites
let pan = { x: innerWidth / 2, y: innerHeight / 2 + 45 };   // nudge scene down below the chrome cluster
let zoom = 1;
let zoomTarget = 1;          // eased toward by frame(); wheel drives this
let zoomAnchor = null;       // { wx, wy, sx, sy } keeps cursor point fixed while easing
let camReset = null;         // { from, t0, dur } eases the camera home (Back button)
let lastT = 0;               // for dt-based easing in frame()
let pointerScreen = { x: -1e5, y: -1e5 };  // for proximity icon reveal
let pointerMoved = true;      // proximity checks only rerun when the pointer or camera moves
let lastCam = "";
let panDrag = null;           // { startX, startY, panX, panY } when panning background
let moved = 0;                // pointer travel of current gesture (click vs drag)
let hovered = null;
let lockedNode = null;        // node marked by the current/last lock-on
let warp = null;              // { target, url, t0, dur, from } while flying into a site
const warpEl = document.getElementById("warp");

/* ---------------- build nodes & edges ---------------- */
const graphNodes = SEED.nodes;
const ringNodes = [...graphNodes];

/* Popularity -> bubble diameter (single source of truth: layout clearance,
   DOM size and culling all read this). The most popular site in the
   database is 10x the diameter of the least popular: 18 px … 180 px. */
let POP_LO = Infinity, POP_HI = -Infinity;
for (const s of SITES) { POP_LO = Math.min(POP_LO, s.pop); POP_HI = Math.max(POP_HI, s.pop); }
function bubbleSize(n) {
  const t = POP_HI > POP_LO ? ((n.pop ?? POP_LO) - POP_LO) / (POP_HI - POP_LO) : 1;
  return 18 * (1 + 9 * t);
}
const effR = (n) => bubbleSize(n) / 2;
const GAP = 36;                                 // clearance between bubbles, room for labels

/* Nebula layout, grown by a physics simulation. Every genre is a cloud;
   clouds attract their neighbours on the genre ring (SITE_CATEGORIES order),
   repel overlapping clouds, and genres with the most popular sites settle
   nearest the centre. Then every site is a particle: pulled toward its
   cloud's core (popular sites pull hardest, so they form the bright core),
   pushed apart on contact, with a few seeded lobes per cloud weakening the
   pull in some directions so clouds grow arms instead of discs.
   Uncategorized sites are pulled to a dust halo around everything.
   Deterministic (seeded) and computed once per database, then cached. */
function computeLayout() {
  const order = [...ringNodes].sort((a, b) => b.pop - a.pop || a.id.localeCompare(b.id));
  const N = order.length;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const popT = (n) => (POP_HI > POP_LO ? (n.pop - POP_LO) / (POP_HI - POP_LO) : 1);
  const area = (n) => Math.PI * (effR(n) + GAP / 2) ** 2;

  const cats = {};
  for (const n of order) {
    const c = cats[n.cat] || (cats[n.cat] = { id: n.cat, area: 0, top: n.pop, count: 0, placed: 0 });
    c.area += area(n); c.count++;
  }
  const totalR = Math.sqrt(order.reduce((t, n) => t + area(n), 0) / Math.PI);
  const ring = SITE_CATEGORIES.map((c) => c.id).filter((id) => id !== "other" && cats[id]);
  const clouds = ring.map((id, i) => {
    const c = cats[id];
    const t = popT({ pop: c.top });
    const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const d = totalR * 0.5 * (1 - t) + totalR * 0.1;
    c.R = Math.sqrt(c.area / Math.PI);
    c.home = { x: Math.cos(a) * d, y: Math.sin(a) * d };
    c.x = c.home.x; c.y = c.home.y;
    c.lobes = [2, 3, 5].map((k) => ({ k, ph: rand() * Math.PI * 2, amp: 0.12 + rand() * 0.18 }));
    c.twist = (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.9);
    return c;
  });

  // clouds: springs between ring neighbours, contact repulsion, pull home
  for (let it = 0; it < 400; it++) {
    const alpha = 1 - it / 400;
    for (let i = 0; i < clouds.length; i++) {
      const A = clouds[i], B = clouds[(i + 1) % clouds.length];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01;
      const f = ((d - (A.R + B.R) * 1.05) / d) * 0.02 * alpha;
      A.x += dx * f; A.y += dy * f; B.x -= dx * f; B.y -= dy * f;
      for (let j = i + 1; j < clouds.length; j++) {
        const C = clouds[j];
        const ex = C.x - A.x, ey = C.y - A.y, e = Math.hypot(ex, ey) || 0.01;
        const min = (A.R + C.R) * 1.1;
        if (e < min) {
          const push = (min - e) / 2 / e;
          A.x -= ex * push; A.y -= ey * push; C.x += ex * push; C.y += ey * push;
        }
      }
    }
    for (const c of clouds) { c.x += (c.home.x - c.x) * 0.01 * alpha; c.y += (c.home.y - c.y) * 0.01 * alpha; }
  }
  const haloStart = Math.max(totalR * 0.4, ...clouds.map((c) => Math.hypot(c.x, c.y) + c.R * 0.8));
  if (cats.other) Object.assign(cats.other, { x: 0, y: 0, R: Math.sqrt(haloStart ** 2 + cats.other.area / Math.PI) - haloStart, lobes: [2, 3, 7].map((k) => ({ k, ph: rand() * Math.PI * 2, amp: 0.1 + rand() * 0.15 })) });
  const shape = (c, a) => {
    let s = 1;
    for (const l of c.lobes) s += l.amp * Math.sin(l.k * a + l.ph);
    return Math.max(0.35, s);
  };

  // particles: start where they will roughly end (rank sets radius), then relax
  const X = new Float64Array(N), Y = new Float64Array(N), R = new Float64Array(N);
  const TX = new Float64Array(N), TY = new Float64Array(N), K = new Float64Array(N), M = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const n = order[i], c = cats[n.cat];
    const f = Math.sqrt((c.placed++ + 0.5) / c.count);
    const a = rand() * Math.PI * 2;
    R[i] = effR(n) + GAP / 2;
    M[i] = R[i] * R[i];
    K[i] = 0.02 + 0.1 * popT(n) ** 2;
    // each site is anchored inside its cloud's lobed outline, twisted with
    // distance from the core so the arms curl like a spiral nebula
    if (n.cat === "other") {
      const rad = haloStart * (0.8 + 0.2 * shape(c, a)) + f * c.R * 2;
      const tw = a + 0.5 * f;
      TX[i] = Math.cos(tw) * rad; TY[i] = Math.sin(tw) * rad;
    } else {
      const rad = f * c.R * 1.15 * shape(c, a) ** 1.6;
      const tw = a + c.twist * f;
      TX[i] = c.x + Math.cos(tw) * rad; TY[i] = c.y + Math.sin(tw) * rad;
    }
    X[i] = TX[i]; Y[i] = TY[i];
  }
  // collisions on a flat grid rebuilt each pass (counting sort into typed
  // arrays); a big bubble is listed in every cell it covers
  const CELL = 48;
  const stamp = new Int32Array(N).fill(-1);
  const C0 = new Int32Array(N), C1 = new Int32Array(N), D0 = new Int32Array(N), D1 = new Int32Array(N);
  let start = new Int32Array(0), items = new Int32Array(0);
  const collide = (strength) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, X[i] - R[i]); maxX = Math.max(maxX, X[i] + R[i]);
      minY = Math.min(minY, Y[i] - R[i]); maxY = Math.max(maxY, Y[i] + R[i]);
    }
    const gw = Math.floor((maxX - minX) / CELL) + 1, gh = Math.floor((maxY - minY) / CELL) + 1;
    if (start.length < gw * gh + 1) start = new Int32Array(gw * gh + 1);
    else start.fill(0, 0, gw * gh + 1);
    let total = 0;
    for (let i = 0; i < N; i++) {
      C0[i] = Math.floor((X[i] - R[i] - minX) / CELL); C1[i] = Math.floor((X[i] + R[i] - minX) / CELL);
      D0[i] = Math.floor((Y[i] - R[i] - minY) / CELL); D1[i] = Math.floor((Y[i] + R[i] - minY) / CELL);
      for (let cy = D0[i]; cy <= D1[i]; cy++) for (let cx = C0[i]; cx <= C1[i]; cx++) { start[cy * gw + cx + 1]++; total++; }
    }
    for (let k = 1; k <= gw * gh; k++) start[k] += start[k - 1];
    if (items.length < total) items = new Int32Array(total);
    const fill = start.slice(0, gw * gh);
    for (let i = 0; i < N; i++) {
      for (let cy = D0[i]; cy <= D1[i]; cy++) for (let cx = C0[i]; cx <= C1[i]; cx++) items[fill[cy * gw + cx]++] = i;
    }
    let overlaps = 0;
    stamp.fill(-1);
    for (let i = 0; i < N; i++) {
      for (let cy = D0[i]; cy <= D1[i]; cy++) for (let cx = C0[i]; cx <= C1[i]; cx++) {
        const c = cy * gw + cx;
        for (let q = start[c], end = start[c + 1]; q < end; q++) {
          const j = items[q];
          if (j <= i || stamp[j] === i) continue;
          stamp[j] = i;
          const dx = X[j] - X[i], dy = Y[j] - Y[i], min = R[i] + R[j];
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          overlaps++;
          const d = Math.sqrt(d2) || 0.01;
          const push = ((min - d) / d) * strength;
          const wi = M[j] / (M[i] + M[j]), wj = 1 - wi;
          X[i] -= dx * push * wi; Y[i] -= dy * push * wi;
          X[j] += dx * push * wj; Y[j] += dy * push * wj;
        }
      }
    }
    return overlaps;
  };
  const ITER = 220;
  for (let it = 0; it < ITER; it++) {
    const alpha = 1 - it / ITER;
    for (let i = 0; i < N; i++) {
      X[i] += (TX[i] - X[i]) * K[i] * alpha;
      Y[i] += (TY[i] - Y[i]) * K[i] * alpha;
    }
    collide(0.5 + 0.4 * (1 - alpha));
  }
  for (let it = 0; it < 400 && collide(1); it++);
  for (let i = 0; i < N; i++) order[i].home = { x: X[i], y: Y[i] };

  // related = same category: link each site to the nearest more popular one
  const links = [];
  const seen = {};
  for (const n of order) {
    if (n.cat === "other") continue;               // unknown genre: no relation to guess
    const prev = seen[n.cat] || (seen[n.cat] = []);
    let best = null, bd = Infinity;
    for (const p of prev) {
      const d = (p.home.x - n.home.x) ** 2 + (p.home.y - n.home.y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) links.push([best.id, n.id]);
    prev.push(n);
  }
  return { pos: order.map((n) => [n.id, Math.round(n.home.x), Math.round(n.home.y)]), links };
}

/* A large database takes seconds to lay out, and every Start page shares one
   process, so a cache miss computes in a worker; inline only as a fallback. */
function computeLayoutOffThread() {
  const src = `"use strict";
    const SITES = ${JSON.stringify(SITES)}, SITE_CATEGORIES = ${JSON.stringify(SITE_CATEGORIES)};
    const GAP = ${GAP}, POP_LO = ${POP_LO}, POP_HI = ${POP_HI};
    const ringNodes = SITES.map((s) => ({ ...s }));
    ${bubbleSize}
    const effR = ${effR};
    ${computeLayout}
    postMessage(computeLayout());`;
  return new Promise((res) => {
    try {
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      w.onmessage = ({ data }) => { w.terminate(); res(data); };
      w.onerror = (e) => { e.preventDefault(); w.terminate(); res(computeLayout()); };
    } catch { res(computeLayout()); }
  });
}

/* Positions are cached in IndexedDB keyed by the database contents, so a new
   tab skips the layout entirely; any change to sites.js recomputes it. */
const LAYOUT_VERSION = 8;
function layoutKey() {
  let h = 0;
  const str = LAYOUT_VERSION + "|" + SITES.map((s) => s.id + s.pop + s.cat).join(",");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return "layout:" + h;
}
async function loadLayout() {
  const key = layoutKey();
  // the build ships the layout for its own database (tools/build-layout.mjs)
  const shipped = typeof SITES_LAYOUT !== "undefined" && SITES_LAYOUT.key === key;
  const decode = (b64) => new Int32Array((Uint8Array.fromBase64 ? Uint8Array.fromBase64(b64) : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).buffer);
  let cached = shipped ? { xy: decode(SITES_LAYOUT.xy), links: decode(SITES_LAYOUT.links) } : await kvGet(key);
  // stored as typed arrays indexed by SITES position: reading them back is a
  // copy, not tens of thousands of small arrays to rebuild
  if (!(cached?.xy instanceof Int32Array)) {
    const raw = await computeLayoutOffThread();
    const index = new Map(SITES.map((s, i) => [s.id, i]));
    const xy = new Int32Array(SITES.length * 2);
    for (const [id, x, y] of raw.pos) {
      const i = index.get(id);
      if (i !== undefined) { xy[2 * i] = x; xy[2 * i + 1] = y; }
    }
    const links = new Int32Array(raw.links.length * 2).fill(-1);
    raw.links.forEach(([a, b], k) => { links[2 * k] = index.get(a) ?? -1; links[2 * k + 1] = index.get(b) ?? -1; });
    cached = { xy, links };
    kvPut(key, cached);
  }
  const { xy, links } = cached;
  for (const n of ringNodes) n.home = { x: xy[2 * n.si], y: xy[2 * n.si + 1] };
  SEED.links = links;
}

/* Small key/value store for the start page. Privileged about: pages have no
   localStorage, so this is IndexedDB. */
const kvDB = new Promise((res) => {
  try {
    const rq = indexedDB.open("CELESTA", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => res(null);
  } catch { res(null); }
});
function kvGet(key) {
  return kvDB.then((db) => db && new Promise((res) => {
    try {
      const rq = db.transaction("kv").objectStore("kv").get(key);
      rq.onsuccess = () => res(rq.result ?? null);
      rq.onerror = () => res(null);
    } catch { res(null); }
  }));
}
function kvPut(key, value) {
  kvDB.then((db) => { try { db?.transaction("kv", "readwrite").objectStore("kv").put(value, key); } catch {} });
}

/* favicon sources tried in order; letter monogram is the last resort */
// big bubbles ask for a large icon first so the logo stays sharp
const ICON_SRCS = (d, big) => [
  ...(big ? [`https://www.google.com/s2/favicons?domain=${d}&sz=256`] : []),
  `https://icons.duckduckgo.com/ip3/${d}.ico`,
  `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
  `https://icon.horse/icon/${d}`,
  `https://${d}/favicon.ico`,
];
function iconImg(domain, lazy = false, big = false) {   // build an <img> that walks the chain
  const img = document.createElement("img");
  img.alt = ""; img.dataset.si = 0; img.dataset.domain = domain;
  if (big) img.dataset.big = "1";
  if (!lazy) img.src = ICON_SRCS(domain, big)[0];
  img.onerror = () => iconNext(img);
  return img;
}
function loadIcon(n) {
  if (n._img && !n._img.src) n._img.src = ICON_SRCS(n.domain, !!n._img.dataset.big)[0];
}
function iconNext(img) {                         // called from the delegated error listener and iconImg
  const srcs = ICON_SRCS(img.dataset.domain, !!img.dataset.big);
  const i = (+img.dataset.si || 0) + 1;
  if (i < srcs.length) { img.dataset.si = i; img.src = srcs[i]; }
  else { img.remove(); img.closest?.(".orb")?.classList.remove("has-img"); }   // letter last resort
}
function iconTag(d) {                            // same chain, as an HTML fragment
  return `<img data-si="0" data-chain data-domain="${d}" src="${ICON_SRCS(d)[0]}" alt="">`;
}
// privileged about: pages strip inline on* attributes from innerHTML, so delegate
document.addEventListener("error", (e) => { if (e.target.matches?.("img[data-chain]")) iconNext(e.target); }, true);
document.addEventListener("load", (e) => { if (e.target.matches?.("img[data-chain]")) applyLogoTint(e.target); }, true);

/* bubble color = hue of the logo's averaged color (static hue stays as fallback) */
function rgb2hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}
/* icon.horse is the only favicon source that sends ACAO (DDG/Google/
   direct do not). Requests are serialized through a spaced queue —
   a page-load burst of ~30 made it drop connections. */
let tintChain = Promise.resolve();
function avgLogoHSL(url, domain) {
  const src = url && url.startsWith("data:") ? url
            : domain ? "https://icon.horse/icon/" + domain
            : url;
  const read = (im) => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(im, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;                 // skip transparent pixels
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < 30 || lum > 245) continue;          // skip near-black / near-white fill
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      if (!n) return null;
      r /= n; g /= n; b /= n;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 34) return null;   // greyish -> keep hue
      return rgb2hsl(r / 255, g / 255, b / 255);
    } catch (e) { return null; }                      // tainted canvas etc.
  };
  if (!src.startsWith("https://icon.horse/")) {       // data: URLs (tests) — no queue needed
    return new Promise((res) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(read(im));
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  const p = tintChain.then(() => new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";                     // separate CORS copy; visible icon unaffected
    im.onload = () => res(read(im));
    im.onerror = () => res(null);
    im.src = src;
  }));
  tintChain = p.then(() => new Promise((r) => setTimeout(r, 200)));   // pace icon.horse
  return p;
}
// domain -> averaged hue (null = known un-tintable). Hits persist across page
// loads so a new tab skips the paced icon.horse queue entirely.
const TINT_CACHE = new Map();
kvGet(VISITED_KEY).then((v) => { for (const id of v || []) visited.add(id); });
const tintsReady = kvGet("tints").then((t) => { for (const [d, h] of Object.entries(t || {})) TINT_CACHE.set(d, h); });
function saveTints() {
  kvPut("tints", Object.fromEntries([...TINT_CACHE].filter(([, v]) => v != null)));
}
function applyLogoTint(img) {
  const host = img.closest(".node, .shoot, #suggestions li");
  if (!host) return;
  const domain = img.dataset.domain;
  const set = (h) => {
    host.style.setProperty("--hue", h);
    if (host._n) Bubbles.setHue(host._n.idx, h);     // the GPU circle takes the logo's color too
  };
  tintsReady.then(() => {
    if (domain && TINT_CACHE.has(domain)) {
      const h = TINT_CACHE.get(domain);
      if (h != null) set(h);
      return;
    }
    avgLogoHSL(img.src, domain).then((hsl) => {
      const h = hsl ? Math.round(hsl.h) : null;
      if (domain) TINT_CACHE.set(domain, h);      // cache misses too — retry next page load
      if (h != null) { set(h); saveTints(); }
    });
  });
}

/* A site gets a DOM bubble only once it is on screen and big enough to
   read (see frame()); the GPU layer (bubbles.js) draws every site. With
   any number of sites the page holds a few hundred elements at most. */
function createNodeEl(n) {
  const el = document.createElement("div");
  el.className = "node" + (n.risk ? " risky" : "");
  el.style.setProperty("--hue", n.hue ?? 255);
  el.style.setProperty("--sz", Math.round(bubbleSize(n)) + "px");    // popularity -> star size
  el.innerHTML = `<div class="orb"><span class="mono"></span></div><div class="label"></div>`;
  el.style.translate = `${n.home.x}px ${n.home.y}px`;
  el._n = n;
  el.querySelector(".mono").textContent = n.name[0];
  const label = el.querySelector(".label");
  label.textContent = n.name;
  if (n.en) {
    const en = document.createElement("small");
    en.textContent = n.en;
    label.append(en);
  }
  if (n.risk) el.title = `${n.domain} — flagged: ${n.risk.split("|").join(", ")}`;
  const orb = el.querySelector(".orb");
  const img = iconImg(n.domain, true, bubbleSize(n) >= 72);   // src is set when it first comes on screen
  orb.classList.add("has-img");            // letter stays hidden while an icon may still load
  orb.appendChild(img);
  img.addEventListener("load", () => applyLogoTint(img), { once: true });
  n._img = img;
  bindNode(el, n);
  n.el = el;
  if (lockedNode === n) el.classList.add("locked");
  nodesEl.appendChild(el);
}

function buildDOM() {
  nodesEl.innerHTML = ""; edgesEl.innerHTML = "";
  // edges: related-site links, drawn as two paths (plain / lit) so a redraw
  // is two attribute writes
  const bySite = [];
  for (const n of graphNodes) bySite[n.si] = n;
  const pairs = [];
  if (setting("CELESTALinks", true) === "true") {
    for (let k = 0; k < SEED.links.length; k += 2) {
      const a = bySite[SEED.links[k]], b = bySite[SEED.links[k + 1]];
      if (a && b) pairs.push([a, b]);
    }
  }
  EDGES.length = 0;
  for (const [a, b] of pairs) {
    const e = { a, b };
    EDGES.push(e);
    a.lines = (a.lines || []).concat(e);
    b.lines = (b.lines || []).concat(e);
  }
  for (const cls of ["edge", "edge lit"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", cls);
    edgesEl.appendChild(path);
  }
  edgesDirty = true;
}
const EDGES = [];
let edgesDirty = true;
let litEdges = new Set();

/* ---------------- interactions: nodes ---------------- */
function bindNode(el, n) {
  el.addEventListener("click", (e) => {
    if (e.button !== 0 || moved >= 5 || warp) return;
    openURL("https://" + n.domain + (n.path || ""), { node: n });
  });
  // middle-click opens the site in a new tab; mouseup, because Firefox's
  // autoscroll handles the middle press first and suppresses auxclick
  el.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
  el.addEventListener("mouseup", (e) => {
    if (e.button !== 1) return;
    const url = "https://" + n.domain + (n.path || "");
    guardRisk(url, () => window.open(url, "_blank", "noopener"));
  });
  el.addEventListener("mouseenter", () => { hovered = n; refreshLit(); });
  el.addEventListener("mouseleave", () => { hovered = null; refreshLit(); });
  el.addEventListener("contextmenu", (e) => {     // bubbles get their own dropdown, not search
    if (warp) { e.preventDefault(); return; }
    e.stopPropagation();
    e.preventDefault();
    if (ctxMenuOpen() && ctxNode === n) { closeCtxMenu(); return; }   // right-click again closes
    openCtxMenu(n, e.clientX, e.clientY);
  });
}

/* edges glow for the hovered node and the locked target (both survive hover-outs) */
function refreshLit() {
  litEdges = new Set([...(hovered?.lines || []), ...(lockedNode?.lines || [])]);
  edgesDirty = true;
  kick();
}

/* while the warp owns the camera, swallow every press before it reaches anything */
document.addEventListener("pointerdown", (e) => {
  if (warp) { e.stopPropagation(); e.preventDefault(); }
}, true);

/* ---------------- interactions: pan & zoom ---------------- */
document.addEventListener("pointerdown", (e) => {
  if (e.button === 2) {                     // right button: grab the omnibox if it's open
    rightMoved = false; rightTravel = 0;
    if (omniboxOpen()) {
      const r = omnibox.getBoundingClientRect();
      omniDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    }
  }
  if (e.button !== 0) return;
  // left press removes the cursor-anchored search bar and any open bubble menu
  if (omniboxOpen() && !e.target.closest?.("#omnibox")) hideOmnibox();
  if (ctxMenuOpen() && !e.target.closest?.("#ctxmenu")) closeCtxMenu();
  if (e.target.closest?.("#chrome, #riskdlg, #omnibox, #ctxmenu, .shoot")) return;
  panDrag = { locked: false };
  moved = 0;
  document.body.classList.add("dragging");
});
document.addEventListener("pointermove", (e) => {
  pointerScreen = { x: e.clientX, y: e.clientY };
  pointerMoved = true;
  kick();
  if (e.buttons & 2) {                      // right button held: search box follows the cursor
    rightTravel += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (rightTravel > 6) rightMoved = true;
    if (omniDrag && rightMoved && omniboxOpen()) placeBox(e.clientX - omniDrag.dx, e.clientY - omniDrag.dy);
  }
});
// pans by relative motion, and locks the pointer once a drag starts so the
// drag never runs into the edge of the screen
document.addEventListener("mousemove", (e) => {
  if (!panDrag) return;
  if (!(e.buttons & 1)) { endPan(e); return; }   // the release happened where we could not see it
  if (panDrag.skipNext) { panDrag.skipNext = false; return; }   // first move after locking jumps
  camReset = null;
  moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  if (zoomAnchor) {
    // zooming while dragging: the pan moves the zoom's anchor along, so the
    // zoom keeps easing instead of being cut off by every mouse move
    zoomAnchor.sx += e.movementX;
    zoomAnchor.sy += e.movementY;
  } else {
    pan.x += e.movementX;
    pan.y += e.movementY;
  }
  applyScene();
  if (moved > 6 && !panDrag.locked) {
    panDrag.locked = true;
    document.documentElement.requestPointerLock?.()?.catch?.(() => {});
  }
});
function endPan(e) {
  if (!panDrag) return;
  if (moved < 5 && !e.target.closest?.("#omnibox")) hideOmnibox();
  if (panDrag.locked) document.exitPointerLock?.();
  panDrag = null;
  document.body.classList.remove("dragging");
}
document.addEventListener("pointerup", (e) => {
  if (e.button === 2) omniDrag = null;      // released: box stays where it was dropped
  if (e.button === 0) endPan(e);
});
document.addEventListener("mouseup", (e) => { if (e.button === 0) endPan(e); });
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) {
    // the lock can arrive after the button is already up
    if (!panDrag) document.exitPointerLock();
    else panDrag.skipNext = true;
  } else if (panDrag?.locked) endPan({ target: document.body });
});
document.addEventListener("wheel", (e) => {
  if (warp) return;                         // the warp owns the camera
  if (e.target.closest?.("#omnibox")) return;   // let suggestion list scroll natively
  e.preventDefault();
  if (ctxMenuOpen()) closeCtxMenu();        // zooming dismisses the bubble menu
  camReset = null;                          // manual zoom takes over from the home tween
  zoomTarget = Math.min(ZMAX, Math.max(ZMIN, zoomTarget * Math.exp(-e.deltaY * 0.0015)));
  // keep the world point under the cursor pinned for the whole ease; while
  // the pointer is locked for a drag it has no position, so: the centre
  const [sx, sy] = document.pointerLockElement ? [innerWidth / 2, innerHeight / 2] : [e.clientX, e.clientY];
  const w = toWorld(sx, sy);
  zoomAnchor = { wx: w.x, wy: w.y, sx, sy };
  kick();
}, { passive: false });

function toWorld(sx, sy) { return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom }; }
/* sites smaller than this on screen are drawn only by the GPU layer
   (bubbles.js); bigger ones also get a DOM bubble with logo and name */
const DUST_PX = 30;

/* spatial index: sites bucketed by world position, each cell biggest first,
   so a camera move only visits sites in view that are big enough for a DOM
   bubble, however many sites there are */
const GRID = 2048;
const grid = new Map();
let shown = new Set();
let maxBubble = 0;
function buildIndex() {
  const data = new Float32Array(graphNodes.length * Bubbles.STRIDE);
  graphNodes.forEach((n, i) => {
    n.idx = i;
    n.pos.x = n.home.x; n.pos.y = n.home.y;
    data.set([n.home.x, n.home.y, bubbleSize(n) / 2, n.hue ?? 230, n.risk ? 1 : n.cat === "other" ? 2 : 0], i * Bubbles.STRIDE);
    const k = Math.floor(n.home.x / GRID) + "," + Math.floor(n.home.y / GRID);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(n);
    maxBubble = Math.max(maxBubble, bubbleSize(n));
  });
  for (const list of grid.values()) list.sort((a, b) => b.pop - a.pop);
  Bubbles.setSites(data);
}
/* sites that need a DOM bubble at this zoom and whose circle or name touches
   the visible world rect. A name is ~6.5 px per character wide and ~32 px
   tall on screen (smaller below zoom 0.5, where names stop counter-scaling). */
function bubblesInView(x0, x1, y0, y1) {
  const out = new Set(), min = DUST_PX / zoom;
  if (maxBubble < min) return out;
  const textScale = Math.min(1, zoom / 0.5) / zoom;          // screen px of a name -> world px
  const below = 32 * textScale, reach = maxBubble / 2 + 200 * textScale;
  for (let cx = Math.floor((x0 - reach) / GRID); cx <= Math.floor((x1 + reach) / GRID); cx++) {
    for (let cy = Math.floor((y0 - reach) / GRID); cy <= Math.floor((y1 + reach) / GRID); cy++) {
      for (const n of grid.get(cx + "," + cy) || []) {
        if (bubbleSize(n) < min) break;
        const h = n.home, r = bubbleSize(n) / 2, w = Math.max(r, (n.name.length * 3.3 + 6) * textScale);
        if (h.x + w >= x0 && h.x - w <= x1 && h.y + r + below >= y0 && h.y - r <= y1) out.add(n);
      }
    }
  }
  return out;
}

let sceneZ = null;
function applyScene() {
  kick();
  sceneEl.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  // names keep their size during a dive, and only follow the zoom in 2% steps:
  // each re-scale is a style pass over every name on screen
  if (!warp && (sceneZ === null || Math.abs(zoom / sceneZ - 1) > 0.02 || (!zoomAnchor && !camReset && zoom !== sceneZ))) { sceneZ = zoom; sceneEl.style.setProperty("--z", zoom.toFixed(3)); }
}

/* ---------------- right-click: floating omnibox ---------------- */
const omnibox = $("#omnibox"), omni = $("#omni"), suggEl = $("#suggestions");
let suggIndex = -1, suggItems = [];
let omniDrag = null;      // {dx, dy} cursor offset inside the box while right-dragging
let rightMoved = false;   // right-button travel exceeded threshold since press
let rightTravel = 0;

document.addEventListener("contextmenu", (e) => {
  if (warp) { e.preventDefault(); return; }      // no menus mid-warp
  if (e.target === omni) { omniDrag = null; return; }   // native menu allowed in the input (paste)
  e.preventDefault();
  if (e.target.closest?.(".node")) return;              // bubbles own their right-click (dropdown)
  if (e.target.closest?.("#ctxmenu")) { closeCtxMenu(); return; }  // right-click on menu closes it
  if (ctxMenuOpen()) closeCtxMenu();                    // elsewhere: swap the menu for search
  const afterDrag = omniboxOpen() && rightMoved;
  rightMoved = false;                                    // consumed — keyboard Menu key must still reposition
  if (afterDrag) return;                                 // just finished a drag: keep the dropped spot
  if (omniboxOpen()) { hideOmnibox(); return; }          // right-click again closes the search bar
  showOmnibox(e.clientX, e.clientY);
});

function placeBox(left, top) {
  const r = omnibox.getBoundingClientRect();
  const pad = 10;
  omnibox.style.left = Math.min(Math.max(pad, left), innerWidth - r.width - pad) + "px";
  omnibox.style.top = Math.min(Math.max(pad, top), innerHeight - r.height - pad) + "px";
}
function showOmnibox(x, y) {
  omnibox.classList.remove("hidden");
  renderSuggestions("");
  const r = omnibox.getBoundingClientRect();   // anchor: center-top on cursor, clamped in window
  placeBox(x - r.width / 2, y);
  omniDrag = { dx: r.width / 2, dy: 0 };       // right-hold from here drags the box with the cursor
  omni.focus();
  omni.select();
}
function hideOmnibox() {
  omnibox.classList.add("hidden");
  suggEl.classList.add("hidden");
  omni.value = "";
  suggIndex = -1;
}
function omniboxOpen() { return !omnibox.classList.contains("hidden"); }

/* ---------------- right-click dropdown menu for bubbles ---------------- */
const ctxEl = $("#ctxmenu");
let ctxNode = null;

/* pages about a site, opened in a new tab without visiting the site itself */
const LOOKUPS = {
  wiki: (n) => "https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(n.en || n.name),
  archive: (n) => "https://web.archive.org/web/*/" + n.domain,
  safety: (n) => "https://transparencyreport.google.com/safe-browsing/search?url=" + encodeURIComponent(n.domain),
};
function ctxURL(n) { return "https://" + n.domain + (n.path || ""); }
function ctxMenuOpen() { return !ctxEl.classList.contains("hidden"); }
function closeCtxMenu() { ctxNode = null; ctxEl.classList.add("hidden"); }

function openCtxMenu(n, x, y) {
  ctxNode = n;
  omniDrag = null;                                  // no ghost omnibox drag from this press
  ctxEl.style.setProperty("--hue",
    (n.el && n.el.style.getPropertyValue("--hue")) || n.hue || 220);
  ctxEl.innerHTML =
    `<div class="ctx-head"><b>${escapeHTML(n.name)}</b>
       <span>${escapeHTML(n.domain + (n.path || ""))}</span></div>
     <button class="ctx-item" data-a="open">Open</button>
     <button class="ctx-item" data-a="newtab">Open in new tab</button>
     <button class="ctx-item" data-a="newwin">Open in new window</button>
     <button class="ctx-item" data-a="copy">Copy link</button>
     <button class="ctx-item" data-a="copydomain">Copy domain</button>
     <button class="ctx-item" data-a="search">Search this site</button>
     <button class="ctx-item" data-a="wiki">Look up on Wikipedia</button>
     <button class="ctx-item" data-a="archive">Past versions (Wayback Machine)</button>
     <button class="ctx-item" data-a="safety">Safety report</button>`;
  ctxEl.classList.remove("hidden");
  const r = ctxEl.getBoundingClientRect(), pad = 8;
  ctxEl.style.left = Math.min(Math.max(pad, x), innerWidth - r.width - pad) + "px";
  ctxEl.style.top  = Math.min(Math.max(pad, y), innerHeight - r.height - pad) + "px";
  if (omniboxOpen()) hideOmnibox();
}

ctxEl.addEventListener("pointerdown", (e) => e.stopPropagation());   // menu presses are its own
ctxEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".ctx-item");
  if (!btn || !ctxNode) return;
  const n = ctxNode, url = ctxURL(n), a = btn.dataset.a;
  if (a === "copy" || a === "copydomain") {
    try { navigator.clipboard.writeText(a === "copy" ? url : n.domain); } catch {}
    btn.textContent = "Copied ✓";
    btn.classList.add("done");
    setTimeout(() => { if (ctxNode === n) closeCtxMenu(); }, 500);   // brief confirm, then close
    return;
  }
  closeCtxMenu();
  if (a === "open") openURL(url, { node: n });
  else if (a === "newtab") guardRisk(url, () => window.open(url, "_blank", "noopener"));
  else if (a === "newwin") guardRisk(url, () => window.open(url, "_blank", "noopener,popup"));
  else if (a in LOOKUPS) window.open(LOOKUPS[a](n), "_blank", "noopener");
  else if (a === "search") {
    showOmnibox(innerWidth / 2, Math.min(innerHeight / 3, innerHeight - 220));
    omni.value = "site:" + n.domain + " ";
    renderSuggestions(omni.value);
    omni.focus();
    omni.setSelectionRange(omni.value.length, omni.value.length);
    if (n.pos) openURL("https://" + n.domain, { node: n }); // lock-on to site
  }
});

/* ---------------- suggestions + navigation ---------------- */
function looksLikeURL(t) {
  if (/^https?:\/\//i.test(t)) return true;
  if (/^localhost(:\d+)?([/?#]|$)/i.test(t)) return true;
  return /^[\w-]+(\.[\w-]{2,})+([/?#]\S*)?$/.test(t) && !t.includes(" ");
}
function parseIntent(t) {
  if (/^https?:\/\//i.test(t)) return t;
  if (/^localhost/i.test(t)) return "http://" + t;
  if (looksLikeURL(t)) return "https://" + t;
  return "https://duckduckgo.com/?q=" + encodeURIComponent(t);
}

/* ---------------- warp: lock on to a bubble, zoom, fade into the site ---------------- */
function warpTo(url, opts) {
  if (warp) return;
  saveCamera();                                // Back returns to this view
  let host = "";
  try { host = new URL(url, location.href).hostname.replace(/^www\./, ""); } catch {}
  // opts.node = the exact bubble clicked (main OR sub); opts.x/y = a world
  // point (shooting-star head); otherwise match the URL host to a main node.
  let target;
  if (opts && opts.node && opts.node.pos) {
    target = opts.node;
  } else if (opts && typeof opts.x === "number") {
    target = { id: "*" + host, name: host, pos: { x: opts.x, y: opts.y } };
  } else {
    target = (host && graphNodes.find((n) =>
        n.domain === host || host.endsWith("." + n.domain)))
      || graphNodes[0];
  }
  hideOmnibox();
  startConnecting(url);                        // begin the network handshake now, not after the fade
  document.body.classList.add("warping");
  document.querySelectorAll(".node.locked").forEach((el) => el.classList.remove("locked"));
  lockedNode = target.el ? target : null;
  if (target.el) target.el.classList.add("locked");
  refreshLit();
  safeSSSet(LOCK_KEY, target.id);              // lock-on survives back/forward navigation
  zoomAnchor = null;
  camReset = null;
  closeCtxMenu();
  // dive starts FROM the clicked bubble's own screen position — never from the
  // middle of the menu, so the background parallaxes out from where you clicked
  const anchor = { x: pan.x + target.pos.x * zoom, y: pan.y + target.pos.y * zoom };
  // a bubble out of view is flown to first: the camera pulls back while it travels
  const off = Math.max(Math.abs(anchor.x - innerWidth / 2) / innerWidth, Math.abs(anchor.y - innerHeight / 2) / innerHeight);
  const far = off > 0.5 ? { from: toWorld(innerWidth / 2, innerHeight / 2), dip: Math.min(6, off * 1.5) } : null;
  warp = { target, url, t0: performance.now(), dur: far ? 950 + Math.min(700, off * 150) : 950, anchor, far,
           from: { x: pan.x, y: pan.y, z: zoom }, noNavigate: !!opts?.noNavigate };
  try { history.replaceState({ ...history.state, CELESTADive: { x: target.pos.x, y: target.pos.y } }, ""); } catch {}
  kick();
}
function openURL(url, opts) { guardRisk(url, () => warpTo(url, opts)); }

/* The camera is kept in this history entry, so Back returns to the same view
   (also after a full reload, when the page is not kept in the bfcache). */
function saveCamera() {
  try {
    const cam = { cx: (innerWidth / 2 - pan.x) / zoom, cy: (innerHeight / 2 - pan.y) / zoom, z: zoom };
    history.replaceState({ ...history.state, CELESTACam: cam }, "");
  } catch {}
}
function clearDive() {
  try { const { CELESTADive, ...rest } = history.state || {}; history.replaceState(rest, ""); } catch {}
}
function savedCamera() {
  const c = history.state?.CELESTACam;
  return c && Number.isFinite(c.z) ? { x: innerWidth / 2 - c.cx * c.z, y: innerHeight / 2 - c.cy * c.z, z: c.z } : null;
}
addEventListener("pagehide", () => { if (!warp && !document.body.classList.contains("warping")) saveCamera(); });

/* Sites Cloudflare or the Block List Project flag as malware, phishing or
   similar stay on the map (nothing is filtered out), but opening one asks
   first, lists every danger it is flagged for, and points to extensions that
   protect against them. "Open anyway" is remembered for that site until the
   page reloads. */
const RISK_INFO = [
  [/malware|ransomware|spyware|unwanted/i, "may install harmful software"],
  [/phishing/i, "may imitate other sites to steal passwords or payment details"],
  [/scam|fraud|deceptive/i, "may trick you into paying or handing over personal data"],
  [/botnet|command and control|dga/i, "linked to networks of infected computers"],
  [/cryptomin/i, "may use your computer to mine cryptocurrency"],
  [/spam/i, "sends or hosts spam"],
  [/parked|new/i, "a new or parked domain, often used briefly for abuse"],
];
const SITE_RISK = new Map(SITES.filter((s) => s.risk).map((s) => [s.domain, s.risk]));
const riskAllowed = new Set();
function riskOf(url) {
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  for (const [d, why] of SITE_RISK) if (host === d || host.endsWith("." + d)) return { domain: d, why };
  return null;
}
function guardRisk(url, go) {
  const risk = setting("CELESTAWarn", true) === "true" && riskOf(url);
  if (!risk || riskAllowed.has(risk.domain)) { go(); return; }
  document.getElementById("riskdlg")?.remove();
  const dlg = document.createElement("div");
  dlg.id = "riskdlg";
  dlg.setAttribute("role", "alertdialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-labelledby", "riskdlg-title");
  dlg.innerHTML = `<div class="risk-box">
      <h2 id="riskdlg-title">Possible security risk</h2>
      <p><b class="dom"></b> is flagged by Cloudflare or the Block List Project for:</p>
      <ul class="tags"></ul>
      <p>Firefox Safe Browsing still blocks pages it knows are dangerous. For extra
        protection, consider installing:</p>
      <ul>
        <li><a href="https://addons.mozilla.org/firefox/addon/ublock-origin/" target="_blank" rel="noopener">uBlock Origin</a>
          blocks ads, trackers and known malware domains</li>
        <li><a href="https://addons.mozilla.org/firefox/addon/malwarebytes/" target="_blank" rel="noopener">Malwarebytes Browser Guard</a>
          blocks scams, phishing and malicious sites</li>
      </ul>
      <div class="risk-actions"><button class="back">Go back</button><button class="go">Open anyway</button></div>
    </div>`;
  dlg.querySelector(".dom").textContent = risk.domain;
  for (const tag of risk.why.split("|")) {
    const li = document.createElement("li"), b = document.createElement("b");
    b.textContent = tag;
    li.append(b, " — " + (RISK_INFO.find(([re]) => re.test(tag))?.[1] || "flagged as a security risk"));
    dlg.querySelector(".tags").append(li);
  }
  const close = () => dlg.remove();
  dlg.querySelector(".back").addEventListener("click", close);
  dlg.querySelector(".go").addEventListener("click", () => { close(); riskAllowed.add(risk.domain); go(); });
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  for (const type of ["pointerdown", "wheel", "contextmenu"]) dlg.addEventListener(type, (e) => e.stopPropagation());
  document.body.appendChild(dlg);
  dlg.querySelector(".back").focus();
}

/* warm the connection + prefetch the document in a hidden sandboxed iframe
   so navigation at the end of the warp lands on an already-warm socket */
function startConnecting(url) {
  try {
    const origin = new URL(url, location.href).origin;
    for (const rel of ["preconnect", "dns-prefetch"]) {
      const l = document.createElement("link");
      l.rel = rel; l.href = origin;
      document.head.appendChild(l);
    }
    // A real (opaque) request warms DNS + socket + TLS while the warp plays.
    // The hidden iframe alone is often refused by X-Frame-Options, so this is
    // what actually starts the connection during the lock-on animation.
    fetch(url, { mode: "no-cors", credentials: "include", cache: "no-store" }).catch(() => {});
  } catch {}
  try {
    const f = document.createElement("iframe");
    f.className = "prefetch"; f.setAttribute("sandbox", "");
    f.setAttribute("aria-hidden", "true");
    f.src = url;
    document.body.appendChild(f);
  } catch {}
}

/* re-mark the previous target after Back/Forward brings the page back */
function applyLock(id) {
  lockedNode = id ? (graphNodes.find((n) => n.id === id && n.el) || null) : null;
  document.querySelectorAll(".node.locked").forEach((el) => el.classList.remove("locked"));
  if (lockedNode) lockedNode.el.classList.add("locked");
  refreshLit();
}

/* ease the camera to frame a target node at screen centre (or home if null) */
function resetCamera(node = null, dur = 750, to = null) {
  camReset = { node, to, from: { x: pan.x, y: pan.y, z: zoom }, t0: performance.now(), dur };
  kick();
}

function stepWarp(t) {
  const p = Math.min(1, (t - warp.t0) / warp.dur);
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
  zoom = warp.from.z + (2.6 - warp.from.z) * e;
  const cx = innerWidth / 2, cy = innerHeight / 2;
  if (warp.far) {
    const { from, dip } = warp.far, tp = warp.target.pos;
    zoom /= 1 + dip * Math.sin(Math.PI * Math.min(1, e * 1.15));
    pan.x = cx - (from.x + (tp.x - from.x) * e) * zoom;
    pan.y = cy - (from.y + (tp.y - from.y) * e) * zoom;
  } else {
    // The dive originates at the clicked bubble but the anchor eases to the
    // screen centre, so the lock-on ends with the bubble dead-centre.
    const ax = warp.anchor.x + (cx - warp.anchor.x) * e;
    const ay = warp.anchor.y + (cy - warp.anchor.y) * e;
    pan.x = ax - warp.target.pos.x * zoom;
    pan.y = ay - warp.target.pos.y * zoom;
  }
  applyScene();
  const f = Math.max(0, (p - 0.35) / 0.65);
  warpEl.style.opacity = (f * f).toFixed(3);
  if (p >= 1) {
    const { url, noNavigate } = warp;
    warp = null;
    dispatchEvent(new Event("CELESTA-warped"));
    // the address bar loads the page itself once the dive is over; the page
    // stays black until then and the browser fades the new site in
    if (!noNavigate) location.href = url;
  }
}

/* The address bar asks for the same dive before it loads a page from this
   tab (CELESTAHomeChild relays it): onto the site's bubble if it has one in
   map, wherever it is, else into the middle of the screen. */
addEventListener("CELESTA-warp", (e) => {
  const url = e.detail?.url || "";
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const hit = host && graphNodes.find((n) => (n.domain === host || host.endsWith("." + n.domain)));
  const c = toWorld(innerWidth / 2, innerHeight / 2);
  warpTo(url, hit ? { node: hit, noNavigate: true } : { x: c.x, y: c.y, noNavigate: true });
});

/* sites most popular first, each with its lowercased name + domain, built on
   first use; a search stops at the fifth distinct match */
let searchIndex = null;
function searchSites(q, limit) {
  searchIndex ??= [...SEED.nodes].sort((a, b) => b.pop - a.pop).map((n) => [n.name.toLowerCase() + " " + n.domain, n]);
  const out = [], seen = new Set();
  for (const [key, n] of searchIndex) {
    if (key.includes(q) && !seen.has(n.domain)) {
      seen.add(n.domain);
      out.push(n);
      if (out.length === limit) break;
    }
  }
  return out;
}
function renderSuggestions(text) {
  const q = text.trim().toLowerCase();
  suggItems = [];
  let html = "";
  if (q) {
    searchSites(q, 5)
      .forEach((n) => {
        suggItems.push({ url: "https://" + n.domain });
        html += `<li data-i="${suggItems.length - 1}" style="--hue:${n.hue}">
            <span class="dot">${iconTag(n.domain)}</span>
            <span class="nm">${n.name}</span><span class="dm">${n.domain}</span></li>`;
      });
    suggItems.push({ search: true, text });
    html += `<li class="search" data-i="${suggItems.length - 1}">
        <span class="dot"></span><span class="nm">Search for “${escapeHTML(text)}”</span>
        <span class="dm">duckduckgo</span></li>`;
  }
  suggEl.innerHTML = html;
  suggEl.classList.toggle("hidden", !html);
  suggIndex = -1;
  [...suggEl.children].forEach((li) => {
    li.addEventListener("pointerdown", (e) => { e.preventDefault(); chooseSuggestion(+li.dataset.i); });
    li.addEventListener("mouseenter", () => setSuggIndex(+li.dataset.i));
  });
}
function escapeHTML(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function setSuggIndex(i) {
  suggIndex = i;
  [...suggEl.children].forEach((li) => li.classList.toggle("sel", +li.dataset.i === i));
}
function chooseSuggestion(i) {
  const s = suggItems[i];
  if (!s) return;
  if (s.search) openURL(parseIntent(s.text));
  else openURL(s.url);
}

let suggQueued = false;
omni.addEventListener("input", () => {
  if (suggQueued) return;
  suggQueued = true;
  requestAnimationFrame(() => { suggQueued = false; renderSuggestions(omni.value); });
});
omni.addEventListener("keydown", (e) => {
  const n = suggEl.classList.contains("hidden") ? 0 : suggEl.children.length;
  if (e.key === "Enter") {
    if (suggIndex >= 0) chooseSuggestion(suggIndex);
    else if (omni.value.trim()) openURL(parseIntent(omni.value.trim()));
  } else if (e.key === "ArrowDown" && n) {
    e.preventDefault();
    setSuggIndex(Math.min(suggIndex + 1, n - 1));
  } else if (e.key === "ArrowUp" && n) {
    e.preventDefault();
    setSuggIndex(Math.max(suggIndex - 1, -1));
  }
});

// Escape dismisses the bubble menu or the omnibox regardless of focus
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (ctxMenuOpen()) closeCtxMenu();
  else if (omniboxOpen()) hideOmnibox();
});

/* ---------------- animation loop ----------------
   Runs only while something changes (camera, warp, pointer, hover): an idle
   page schedules no frames at all. kick() starts it again. */
let framePending = false, lastCamMoveAt = 0;
const MAX_FPS = Number(setting("CELESTAMaxFps", 120));
function kick() {
  if (!framePending) { framePending = true; requestAnimationFrame(frame); }
}
function frame(t) {
  framePending = false;
  // at most MAX_FPS updates a second: on a 240 Hz screen every update is a
  // full redraw, and 120 already moves smoothly (setting: data-CELESTA-max-fps)
  if (MAX_FPS && lastT && t - lastT < 1000 / MAX_FPS - 1) { kick(); return; }
  const dt = Math.min(80, Math.max(1, t - (lastT || t)));
  lastT = t;
  if (!warp && camReset) {
    // ease the camera to frame the node the Back button returned to
    const p = Math.min(1, (t - camReset.t0) / camReset.dur);
    const e = 1 - Math.pow(1 - p, 3);                       // easeOutCubic
    const tgt = camReset.to ? camReset.to
      : camReset.node && camReset.node.pos
      ? { x: innerWidth / 2 - camReset.node.pos.x, y: innerHeight / 2 - camReset.node.pos.y }
      : { x: innerWidth / 2, y: innerHeight / 2 + 45 };
    const tz = camReset.to ? camReset.to.z : homeZoom;
    zoom = camReset.from.z + (tz - camReset.from.z) * e;
    pan.x = camReset.from.x + (tgt.x - camReset.from.x) * e;
    pan.y = camReset.from.y + (tgt.y - camReset.from.y) * e;
    applyScene();
    if (p >= 1) { camReset = null; zoomTarget = zoom; zoomAnchor = null; }
  } else if (!warp && zoomAnchor) {
    // smooth zoom: snappy dt-based ease while pinning the cursor's world point
    zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 0.040));
    pan.x = zoomAnchor.sx - zoomAnchor.wx * zoom;
    pan.y = zoomAnchor.sy - zoomAnchor.wy * zoom;
    if (Math.abs(zoomTarget - zoom) < 0.0005) { zoom = zoomTarget; zoomAnchor = null; }
    applyScene();
  }
  const camKey = pan.x.toFixed(1) + "," + pan.y.toFixed(1) + "," + zoom.toFixed(4);
  const camMoved = camKey !== lastCam;
  lastCam = camKey;
  if (camMoved) lastCamMoveAt = t;
  // world-space view rect (bubblesInView adds each bubble's own reach)
  const vx0 = -pan.x / zoom, vx1 = (innerWidth - pan.x) / zoom;
  const vy0 = -pan.y / zoom, vy1 = (innerHeight - pan.y) / zoom;
  const checkNear = !warp && (camMoved || pointerMoved);
  const nearR2 = (110 * Math.min(1, Math.max(0.3, zoom / homeZoom))) ** 2;
  // logos show around the pointer, or the screen's centre while the pointer
  // is locked for an endless drag (it is hidden and does not move)
  const reveal = document.pointerLockElement ? { x: innerWidth / 2, y: innerHeight / 2 } : pointerScreen;
  pointerMoved = false;
  if (camMoved && warp) {
    Bubbles.draw(pan, zoom);
  } else if (camMoved) {
    const next = bubblesInView(vx0, vx1, vy0, vy1);
    for (const n of shown) if (!next.has(n)) { n._vis = false; n.el.style.display = "none"; edgesDirty = true; }
    for (const n of next) {
      if (n._vis) continue;
      n._vis = true;
      if (!n.el) createNodeEl(n);
      n.el.style.display = "";
      loadIcon(n);
      edgesDirty = true;
    }
    shown = next;
    Bubbles.draw(pan, zoom);
  }
  for (const n of checkNear ? shown : []) {
    // site icons only show when the cursor is near
    const sx = pan.x + n.pos.x * zoom, sy = pan.y + n.pos.y * zoom;
    // the reveal radius shrinks as you zoom out, so a zoomed-out view does
    // not show (and fetch) hundreds of logos
    const near = (sx - reveal.x) ** 2 + (sy - reveal.y) ** 2 < nearR2;
    if (near !== n._near) { n._near = near; n.el.classList.toggle("near", near); if (near) loadIcon(n); }
  }
  if (camMoved && !warp) reaimStars();
  if (warp) stepWarp(t);
  updateLines();
  if (camMoved || warp || camReset || zoomAnchor) kick();
}

function updateLines() {
  if (!edgesDirty || edgesEl.children.length < 2) return;
  edgesDirty = false;
  const d = ["", ""];
  for (const e of EDGES) {
    if (!e.a._vis && !e.b._vis) continue;
    const k = litEdges.has(e) ? 1 : 0;
    d[k] += `M${e.a.pos.x.toFixed(1)} ${e.a.pos.y.toFixed(1)}L${e.b.pos.x.toFixed(1)} ${e.b.pos.y.toFixed(1)}`;
  }
  [...edgesEl.children].forEach((path, i) => path.setAttribute("d", d[i]));
}

/* ---------------- floating bubble chrome: tabs + bookmarks ---------------- */
/* Start / home — clean seed, no default tabs/bookmarks — population from traffic DB */
const CHROME = {
  tabs: [
    { id: "home", name: "Start", glyph: "✦", active: true },
  ],
  bookmarks: [],
};
const seedById = (id) => SEED.nodes.find((n) => n.id === id || (id && (n.domain === id || id.endsWith("." + n.domain))));

function buildChrome() {
  const bar = $("#tabbar"), bms = $("#bookmarks");
  bar.innerHTML = ""; bms.innerHTML = "";

  for (const t of CHROME.tabs) {
    const s = t.id && seedById(t.id);
    const el = document.createElement("button");
    el.className = "tab" + (t.active ? " active" : "");
    el.innerHTML =
      (t.glyph ? `<span class="tglyph">${t.glyph}</span>`
       : s ? iconTag(s.domain)
           : `<span class="tglyph">◦</span>`) +
      `<span class="tl">${t.name}</span><span class="x" title="Close">×</span>`;
    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("x")) {
        const i = CHROME.tabs.indexOf(t);
        CHROME.tabs.splice(i, 1);
        if (t.active && CHROME.tabs.length)
          CHROME.tabs[Math.min(i, CHROME.tabs.length - 1)].active = true;
      } else {
        CHROME.tabs.forEach((x) => (x.active = false));
        t.active = true;
        // Actually open / switch to the tab content
        if (t.id && seedById(t.id)) {
          openURL("https://" + seedById(t.id).domain, { node: seedById(t.id) });
        } else if (t.id === "home") {
          // Start / home already open; just rebuild chrome
          buildChrome();
        }
      }
      buildChrome();
    });
    bar.appendChild(el);
  }

  const add = document.createElement("button");
  add.className = "tab add";
  add.textContent = "+";
  add.title = "New tab (mock)";
  add.addEventListener("click", () => {
    CHROME.tabs.forEach((x) => (x.active = false));
    CHROME.tabs.push({ id: null, name: "New tab", active: true });
    buildChrome();
  });
  bar.appendChild(add);

  for (const id of CHROME.bookmarks) {
    const s = seedById(id);
    if (!s) continue;
    const el = document.createElement("button");
    el.className = "bm";
    el.innerHTML = `${iconTag(s.domain)}<span>${s.name}</span>`;
    el.title = s.domain;
    el.addEventListener("click", () => openURL("https://" + s.domain));
    bms.appendChild(el);
  }
}

/* ---------------- shooting stars: unvisited sites ----------------
   They are WORLD objects: the head holds a world position and is projected
   through the live pan/zoom every frame, so panning or zooming moves them
   with the rest of the home page instead of with the screen. Screen speed
   stays constant (the world step is divided by zoom), their size is fixed
   (inverse-scaled on zoom), and one site can never be on screen twice. */
const shootersEl = $("#shooters");
const activeShots = new Set();          // live elements (each carries el._star)
const activeShotSites = new Set();      // domains on screen — never duplicated
const STAR_MAX = 5;

/* Any categorized site can streak past: mostly well-known ones, sometimes a
   deep cut from the long tail. Opened ones stop appearing; flagged and
   uncategorized ones (often ad or infrastructure domains) never do. */
let starPool = null;
function pickStarSite() {
  if (!starPool) {
    const ok = graphNodes.filter((n) => !n.risk && n.cat !== "other");
    starPool = { top: [...ok].sort((a, b) => b.pop - a.pop).slice(0, 1500), all: ok };
  }
  for (let tries = 0; tries < 20; tries++) {
    const list = Math.random() < 0.65 ? starPool.top : starPool.all;
    const n = list[(Math.random() * list.length) | 0];
    if (n && !visited.has(n.domain) && !activeShotSites.has(n.domain)) return n;
  }
  return null;
}

function spawnShootingStar() {
  if (warp || document.hidden || document.body.classList.contains("idle") || activeShots.size >= STAR_MAX) return false;
  const site = pickStarSite();
  if (!site) return false;

  // A meteor: it appears somewhere in view, streaks a random direction for a
  // random distance and burns out. Speed, length and trail all vary.
  const diag = Math.hypot(innerWidth, innerHeight);
  const sx = innerWidth * (0.08 + Math.random() * 0.84), sy = innerHeight * (0.08 + Math.random() * 0.84);
  const th = Math.random() * Math.PI * 2;
  const dir = { x: Math.cos(th), y: Math.sin(th) };
  const speed = 140 + Math.random() ** 1.5 * 360;          // px/s on screen
  const travel = diag * (0.25 + Math.random() * 0.4);
  const dur = (travel / speed) * 1000;
  const w0 = toWorld(sx, sy);
  const w1 = { x: w0.x + (dir.x * travel) / zoom, y: w0.y + (dir.y * travel) / zoom };

  const el = document.createElement("div");
  el.className = "shoot";
  el.style.setProperty("--hue", site.hue ?? 230);
  const tail = Math.round(50 + speed * 0.35);
  el.style.setProperty("--tl", tail + "px");
  el.innerHTML = `<div class="aim">
      <div class="hit"></div>
      <div class="trail"></div>
    </div>
    <div class="face">
      <div class="grab"></div>
      <div class="head">${iconTag(site.domain)}</div>
      <div class="nm"></div>
    </div>`;
  el.querySelector(".nm").textContent = site.name;
  el.title = site.domain;
  el.querySelector(".aim").style.transform = `rotate(${th}rad)`;
  shootersEl.appendChild(el);

  const star = { site, el, dir, speed, f0: 0 };
  el._star = star;
  activeShots.add(el);
  activeShotSites.add(site.domain);

  const cleanup = () => {
    if (!activeShots.has(el)) return;
    activeShots.delete(el); activeShotSites.delete(site.domain); el.remove();
  };
  el._cleanup = cleanup;
  flyStar(el, w0, w1, dur);
  // the trail grows out of the point where the star ignited, at its speed
  el.querySelector(".trail").animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    { duration: (tail / speed) * 1000, easing: "linear", fill: "both" });

  const visit = (e) => {
    e.stopPropagation(); e.preventDefault();
    const at = e.clientX != null ? toWorld(e.clientX, e.clientY) : starWorld(star);
    cleanup();
    markVisited(site.domain);
    openURL("https://" + site.domain, { x: at.x, y: at.y });   // lock onto the star itself
  };
  for (const sel of [".grab", ".head", ".nm", ".hit"]) {
    const part = el.querySelector(sel);
    part.addEventListener("pointerdown", (e) => e.stopPropagation());
    part.addEventListener("click", visit);
  }
  return true;
}

/* Stars fly a straight chord at constant screen speed, so the flight and the
   fades are compositor animations (no per-frame script; per-frame style
   changes would rebuild the whole page's display list every frame). The path
   is world-anchored: a pan or zoom re-aims each star from where it is now.
   A star fades in as it ignites and out as it burns away (trail first on the
   way in, last on the way out), and also fades at the edges of the screen. */
function flyStar(el, w0, w1, dur) {
  const s = el._star;
  s.w0 = w0; s.w1 = w1;
  const a = { x: pan.x + w0.x * zoom, y: pan.y + w0.y * zoom };
  const b = { x: pan.x + w1.x * zoom, y: pan.y + w1.y * zoom };
  const N = 24, face = [], aim = [];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const f0 = s.f0;
  const k = (zoom / homeZoom).toFixed(3);
  for (let i = 0; i <= N; i++) {
    const f = i / N, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    const life = f0 + (1 - f0) * f;                                   // 0 = ignition, 1 = burnt out
    const inside = clamp((Math.min(x, innerWidth - x, y, innerHeight - y) + 14) / 52);
    face.push({ offset: f, opacity: inside * clamp(Math.min(life / 0.12, (1 - life) / 0.3)) });
    aim.push({ offset: f, opacity: inside * clamp(Math.min((life - 0.04) / 0.18, (1 - life) / 0.2)) });
  }
  for (const an of s.anims || []) an.cancel();
  const opts = { duration: dur, easing: "linear", fill: "forwards" };
  s.anims = [
    // stars are page-sized: they grow and shrink with the zoom (as seen at the home view)
    el.animate([{ transform: `translate(${a.x}px, ${a.y}px) scale(${k})` }, { transform: `translate(${b.x}px, ${b.y}px) scale(${k})` }], opts),
    el.querySelector(".face").animate(face, opts),
    el.querySelector(".aim").animate(aim, opts),
  ];
  s.anims[0].finished.then(() => el._cleanup?.(), () => {});   // a re-aim cancels: ignore
}
function starWorld(s) {
  const an = s.anims?.[0];
  const p = an ? Math.min(1, (an.currentTime || 0) / an.effect.getTiming().duration) : 0;
  return { x: s.w0.x + (s.w1.x - s.w0.x) * p, y: s.w0.y + (s.w1.y - s.w0.y) * p };
}
function reaimStars() {
  for (const el of activeShots) {
    const s = el._star;
    if (!s?.anims) continue;
    const cur = starWorld(s);
    const an = s.anims[0];
    s.f0 += (1 - s.f0) * Math.min(1, (an.currentTime || 0) / an.effect.getTiming().duration);
    const remainPx = Math.hypot(s.w1.x - cur.x, s.w1.y - cur.y) * zoom;
    flyStar(el, cur, s.w1, Math.max(50, (remainPx / s.speed) * 1000));
  }
}

function shooterLoop() {
  if (setting("CELESTAStars", true) !== "true") return;
  spawnShootingStar();
  setTimeout(shooterLoop, 250 + Math.random() * 900);
}
setTimeout(shooterLoop, 400);

/* Ambient motion (drift, twinkle, shooting stars) pauses after a while
   without input: any running animation makes the compositor redraw the whole
   page on every display refresh, which is most of the page's GPU cost. */
const IDLE_MS = 10000;
let lastInput = performance.now();
for (const type of ["pointermove", "pointerdown", "wheel", "keydown"]) {
  addEventListener(type, () => { lastInput = performance.now(); document.body.classList.remove("idle"); }, { capture: true, passive: true });
}
setInterval(() => { if (performance.now() - lastInput > IDLE_MS) document.body.classList.add("idle"); }, 1000);

/* ---------------- init ---------------- */
// The sky starts once the bubbles are on screen: compiling its shader keeps
// the GPU busy for seconds, and the page's first paint would wait behind it.
// A custom shader (Settings > Home) arrives from CELESTAHomeChild a moment
// after this script runs; the built-in sky starts if it never comes.
const bubblesShown = new Promise((res) => { addEventListener("CELESTA-ready", res, { once: true }); setTimeout(res, 6000); });
bubblesShown.then(() => {
if (setting("CELESTABg", "nebula") === "shader") {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    Space.init(null, null, SETTINGS.CELESTAShader || null);
  };
  addEventListener("CELESTA-background", start, { once: true });
  setTimeout(start, 2000);
} else {
  Space.init();
}
});

/* Background (Settings > Home): the sky shader with or without nebulae, a
   plain color, or a picture, GIF or video. CELESTAHomeChild delivers a file as
   a blob: URL, possibly after this script has run (the CELESTA-background
   event). */
let skyOn = true;
function applyBackground() {
  const kind = setting("CELESTABg", "nebula");
  skyOn = kind === "nebula" || kind === "stars" || kind === "shader";
  $("#space").style.display = skyOn ? "" : "none";
  document.body.style.background = kind === "color" ? setting("CELESTABgColor", "#000") : "#000";
  if (skyOn) {
    if (kind !== "shader") Space.setNebula(kind === "nebula" ? 1 : 0);
    return;
  }
  const url = SETTINGS.CELESTABgUrl;
  if (!url || $("#bgmedia")?.src === url) return;
  $("#bgmedia")?.remove();
  const video = (SETTINGS.CELESTABgType || "").startsWith("video/");
  const media = document.createElement(video ? "video" : "img");
  media.id = "bgmedia";
  if (video) Object.assign(media, { muted: true, loop: true, autoplay: true, playsInline: true });
  media.src = url;
  document.body.prepend(media);
}
applyBackground();
addEventListener("CELESTA-background", applyBackground);

// the sky gets the live camera (parallax pan, cursor-anchored zoom) at ~30 fps
// while the view moves, and drifts at ~15 fps when it is still
(function skyLoop() {
  const now = performance.now();
  if (!document.hidden && skyOn) Space.draw(now, pan, zoom);
  setTimeout(skyLoop, now - lastCamMoveAt < 1000 ? 33 : 66);
})();
// layout is in world space, independent of the window: a resize only shifts the
// camera so the same world point stays in the middle
let lastW = innerWidth, lastH = innerHeight;
addEventListener("resize", () => {
  pan.x += (innerWidth - lastW) / 2; pan.y += (innerHeight - lastH) / 2;
  lastW = innerWidth; lastH = innerHeight;
  zoomAnchor = null; applyScene(); Space.resize(); Bubbles.resize();
});

/* frame the most popular sites at home zoom; ZMIN lets the whole network fit */
let allExtent = null;
function extent(list) {
  let max = 0;
  for (const n of list) max = Math.max(max, Math.max(Math.abs(n.home.x), Math.abs(n.home.y) / 0.8) + bubbleSize(n));
  return max;
}
function fitCamera() {
  // the whole network is measured once; the home view frames the 40 most popular
  allExtent ??= extent(ringNodes);
  const top = ringNodes.length > 40 ? [...ringNodes].sort((a, b) => b.pop - a.pop).slice(0, 40) : ringNodes;
  const view = Math.min(innerWidth, innerHeight - 90) / 2;
  homeZoom = Math.min(1, Math.max(0.4, view / extent(top)));
  ZMIN = Math.min(0.25, view / allExtent);
  zoom = zoomTarget = homeZoom;
  pan = { x: innerWidth / 2, y: innerHeight / 2 + 45 };
  lastW = innerWidth; lastH = innerHeight;
}

if (location.protocol === "about:") $("#chrome").style.display = "none";   // the browser draws the real tab/bookmark bubbles
$("#sitecount").textContent = graphNodes.length.toLocaleString() + " sites";
let touched = false;
for (const type of ["pointerdown", "wheel", "keydown"]) addEventListener(type, () => { touched = true; }, { capture: true });
// new tabs can be preloaded in the background at another window size: when
// one is first shown untouched, it starts from the home view
document.addEventListener("visibilitychange", () => {
  if (document.hidden || touched || warp || !graphNodes[0]?.home || savedCamera()) return;
  fitCamera();
  applyScene();
});

performance.mark("CELESTA-script");
loadLayout().then(() => {
  performance.mark("CELESTA-layout");
  fitCamera();
  const cam = savedCamera(), dive = history.state?.CELESTADive;
  if (cam) { pan = { x: cam.x, y: cam.y }; zoom = zoomTarget = cam.z; }
  if (cam && dive) {
    // Back from a site: start inside the bubble it was opened from and pull out
    zoom = 2.6;
    pan = { x: innerWidth / 2 - dive.x * zoom, y: innerHeight / 2 - dive.y * zoom };
    resetCamera(null, 900, cam);
    clearDive();
  }
  buildDOM();
  buildChrome();
  applyScene();
  buildIndex();
  // creating the first WebGL context on this thread can take up to a second:
  // only after the page has painted once
  requestAnimationFrame(() => setTimeout(() => { Bubbles.init(); Bubbles.draw(pan, zoom); performance.mark("CELESTA-ready"); dispatchEvent(new Event("CELESTA-ready")); }, 0));
  kick();
});
addEventListener("pageshow", (e) => {  // bfcache: clear warp residue, drop the highlight, reframe
  if (!e.persisted) return;
  warp = null;
  document.body.classList.remove("warping");
  warpEl.style.opacity = "0";
  const lockId = safeSSGet(LOCK_KEY);
  const lockNode = graphNodes.find((n) => n.id === lockId && n.el) || null;
  applyLock(null);                              // returning clears the highlight…
  safeSSSet(LOCK_KEY, "");                      // …and the lock is spent, not sticky
  const cam = savedCamera();
  clearDive();
  resetCamera(lockNode, 900, cam);              // …and the view eases back to where it was
});
document.addEventListener("pointerleave", () => { pointerScreen = { x: -1e5, y: -1e5 }; pointerMoved = true; kick(); });
