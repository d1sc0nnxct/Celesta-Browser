/* Headless visual capture for the Umbra start page (dev helper only).
   Launches an isolated headless Brave, parks shooting stars, and captures
   full + close-up shots at a deterministic 1000x700 viewport. */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const BRAVE = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const PORT = 9337;
const PROFILE = path.join(process.env.LOCALAPPDATA, "Temp", "umbra-shot-profile");
const OUTDIR = path.join(process.env.LOCALAPPDATA, "Temp", "umbra-shots");
const PAGE = "http://127.0.0.1:8742/index.html?v=32&shot=headless";

await fs.mkdir(OUTDIR, { recursive: true });
const proc = spawn(BRAVE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--window-size=1000,700",
  "--hide-scrollbars",
  "--enable-unsafe-swiftshader",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  PAGE,
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetList() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(120);
  }
  throw new Error("DevTools endpoint did not start");
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++seq;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(method, cb) { listeners.set(method, cb); },
      close() { try { ws.close(); } catch {} },
    });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        if (m.error) p.rej(new Error(JSON.stringify(m.error)));
        else p.res(m.result);
      } else if (m.method && listeners.has(m.method)) listeners.get(m.method)(m.params);
    };
    ws.onerror = (e) => reject(new Error("ws error"));
  });
}

let cdp;
try {
  let targets = await targetList();
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    const created = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE)}`,
      { method: "PUT" });
    if (created.ok) page = await created.json();
    if (!page) throw new Error("no page target: " + JSON.stringify(targets.slice(0, 3)));
  }
  cdp = await connect(page.webSocketDebuggerUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride",
    { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });

  const loaded = new Promise((r) => cdp.on("Page.loadEventFired", r));
  await cdp.send("Page.navigate", { url: PAGE });
  await loaded;
  await sleep(1400);

  const evalJSON = async (expression) => {
    const r = await cdp.send("Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };

  const parkSetup = await evalJSON(`(() => {
    document.querySelectorAll("#shooters .shoot").forEach(el => el._cleanup && el._cleanup());
    activeShots.clear(); activeShotSites.clear(); visited.clear();
    const park = (sx, sy, deg) => {
      if (!spawnShootingStar()) return null;
      const el = [...activeShots].pop();
      const s = el._star;
      s.speed = 0; s.dur = 1e9; s.born = performance.now();
      s.wx = (sx - pan.x) / zoom; s.wy = (sy - pan.y) / zoom;
      el.querySelector(".aim").style.transform = "rotate(" + deg * Math.PI / 180 + "rad)";
      return el.title;
    };
    return { a: park(772, 440, 22), b: park(264, 182, 201) };
  })()`);
  await sleep(350);

  const full = await cdp.send("Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(OUTDIR, "v31-full.png"), Buffer.from(full.data, "base64"));

  // close-up of star A: 300x220 around its head, trail runs left
  const close = await cdp.send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false,
    clip: { x: 472, y: 330, width: 360, height: 230, scale: 1 },
  });
  await fs.writeFile(path.join(OUTDIR, "v31-star.png"), Buffer.from(close.data, "base64"));

  // metrics + a zoomed capture: fixed screen size + sky zoom
  const metrics = await evalJSON(`(() => {
    const el = document.querySelector("#shooters .shoot");
    const head = el.querySelector(".head").getBoundingClientRect();
    const tr = el.querySelector(".trail"), tcs = getComputedStyle(tr);
    const before = { head: head.width, trailW: tcs.width, trailLeft: tcs.left,
                     faceO: el.querySelector(".face").style.opacity,
                     aimO: el.querySelector(".aim").style.opacity };
    zoom = 2.5; pan = { x: innerWidth / 2, y: innerHeight / 2 }; applyScene();
    const s = el._star;
    s.wx = (600 - pan.x) / zoom; s.wy = (350 - pan.y) / zoom;
    const r = el.querySelector(".head").getBoundingClientRect();
    // sky sampling at two zooms (same pan) — must differ if uZoom works
    Space.draw(123456, pan, 1); const sky1 = Space.sample();
    Space.draw(123456, pan, 2.5); const sky2 = Space.sample();
    return { before, afterHead: r.width, scale: el.style.transform,
             sky1, sky2, skyZoomed: sky1 !== sky2,
             canvas: [document.querySelector("#space").width, document.querySelector("#space").height] };
  })()`);
  await sleep(350);
  const zoomShot = await cdp.send("Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false });
  await fs.writeFile(path.join(OUTDIR, "v31-zoom.png"), Buffer.from(zoomShot.data, "base64"));

  console.log(JSON.stringify({ parkSetup, metrics, out: OUTDIR }, null, 2));
} finally {
  try { cdp && cdp.close(); } catch {}
  try { execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
}
