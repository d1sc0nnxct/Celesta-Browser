/* Capture the start page without browser chrome, for docs.
   Usage: node home/capture.mjs   (requires the dev server on :8742) */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const BRAVE = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const PORT = 9341;
const OUT = path.resolve(import.meta.dirname, "..", "docs", "home.png");
const W = 1600, H = 1000;

const proc = spawn(BRAVE, [
  "--headless=new", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(process.env.LOCALAPPDATA, "Temp", "celesta-capture")}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--force-device-scale-factor=1",
  "--enable-unsafe-swiftshader", "--no-first-run", "--disable-extensions", "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageWs() {
  for (let i = 0; i < 300; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(120);
  }
  throw new Error("DevTools page never appeared");
}

const ws = new WebSocket(await pageWs());
const pending = new Map();
let seq = 0;
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((r) => {
  const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params }));
});

await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:8742/index.html?v=34" });

const ready = `(() => ({
  nodes: document.querySelectorAll("#nodes .node").length,
  bubbles: document.querySelector("#bubbles")?.width || 0,
}))()`;

let state = { nodes: 0, bubbles: 0 };
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const r = await send("Runtime.evaluate", { expression: ready, returnByValue: true });
  state = r.result?.value || state;
  if (state.nodes > 40 && state.bubbles > 1000) break;
}

// no cursor, no chrome: a clean view of the network itself
await send("Runtime.evaluate", {
  expression: `(() => {
    for (const sel of ["#chrome", "#hint", "#sitecount", ".nm", ".slbl"]) {
      const el = document.querySelector(sel); if (el) el.style.display = "none";
    }
    pointerScreen = { x: -1e5, y: -1e5 };
    document.body.classList.remove("dragging");
    document.querySelectorAll("#shooters .shoot").forEach(el => el._cleanup && el._cleanup());
  })()`, returnByValue: true,
});
await sleep(1500);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, Buffer.from(shot.data, "base64"));
console.log(JSON.stringify({ state, out: OUT }));
ws.close();
try { execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}



