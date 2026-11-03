/* ============================================================
   Every site as a GPU circle (outline, faint fill, soft glow): one
   instanced draw call, redrawn only when the camera moves. It draws on the
   page's own thread, in the same frame as the DOM labels and logos, so the
   two never drift apart (a worker canvas lands a frame late). The cost of a
   frame barely depends on how many sites there are or how far the view is
   zoomed. The page keeps DOM elements only
   for the bubbles big enough on screen to show a logo and a name.
   ============================================================ */

"use strict";

const Bubbles = (() => {
  const VS = `#version 300 es
in vec2 aCorner;
in vec4 aSite;        // world x, world y, radius (world px), hue (degrees)
in float aRisk;       // 1 = flagged site, 2 = uncategorized
uniform vec2 uRes;    // canvas size, CSS px
uniform vec2 uPan;
uniform float uZoom;
out vec2 vP;
out float vR;
out vec3 vCol;
out float vRisk;
vec3 hsl(float h, float s, float l) {
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
  float a = s * min(l, 1.0 - l);
  return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}
void main() {
  float r = max(aSite.z * uZoom, 0.7);
  float ext = r * 1.5 + 3.0;          // the quad reaches past the outline for the glow
  vec2 s = uPan + aSite.xy * uZoom + aCorner * ext;
  gl_Position = vec4(s.x / uRes.x * 2.0 - 1.0, 1.0 - s.y / uRes.y * 2.0, 0.0, 1.0);
  vP = aCorner * ext;
  vR = r;
  vRisk = aRisk;
  vCol = aRisk > 1.5 ? vec3(0.42, 0.45, 0.55) : aRisk > 0.5 ? vec3(1.0, 0.36, 0.36) : hsl(aSite.w, 0.65, 0.62);
}`;
  const FS = `#version 300 es
precision mediump float;
in vec2 vP;
in float vR;
in vec3 vCol;
in float vRisk;
out vec4 o;
void main() {
  float d = length(vP);
  float a;
  if (vR < 1.5) {
    a = (1.0 - smoothstep(vR, vR + 1.0, d)) * 0.42;               // too small for an outline: a dot
  } else {
    float ring = 1.0 - smoothstep(0.0, 1.0, abs(d - vR));
    float fill = (1.0 - smoothstep(vR - 1.0, vR, d)) * 0.07;
    float glow = d > vR ? exp(-(d - vR) / max(vR * 0.35, 1.5)) * 0.16 : 0.0;
    a = ring * (vRisk > 0.5 && vRisk < 1.5 ? 0.65 : 0.4) + fill + glow;
  }
  o = vec4(vCol * a, a);                                           // premultiplied alpha
}`;
  const STRIDE = 5;   // floats per site: x, y, radius, hue, flag (1 flagged, 2 uncategorized)

  // the shader is tiny, so linking it on the page thread takes milliseconds
  // (unlike the sky's, which is why space.js uses a worker)
  function rendererMain(postMessage) {
    let gl = null, U = {}, count = 0, inst = null;
    return (m) => {
      if (m.canvas) {
        gl = m.canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: true, depth: false, stencil: false,
                                             powerPreference: "low-power" });
        if (!gl) { postMessage({ ok: false }); return; }
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          postMessage({ ok: false, log: gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog) });
          gl = null;
          return;
        }
        gl.useProgram(prog);
        gl.bindVertexArray(gl.createVertexArray());
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const corner = gl.getAttribLocation(prog, "aCorner");
        gl.enableVertexAttribArray(corner);
        gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
        inst = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        const site = gl.getAttribLocation(prog, "aSite"), risk = gl.getAttribLocation(prog, "aRisk");
        gl.enableVertexAttribArray(site);
        gl.vertexAttribPointer(site, 4, gl.FLOAT, false, STRIDE * 4, 0);
        gl.vertexAttribDivisor(site, 1);
        gl.enableVertexAttribArray(risk);
        gl.vertexAttribPointer(risk, 1, gl.FLOAT, false, STRIDE * 4, 16);
        gl.vertexAttribDivisor(risk, 1);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        ["uRes", "uPan", "uZoom"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
        postMessage({ ok: true });
        return;
      }
      if (!gl) return;
      if (m.size) {
        gl.canvas.width = m.size[0]; gl.canvas.height = m.size[1];
        gl.viewport(0, 0, m.size[0], m.size[1]);
        gl.uniform2f(U.uRes, m.css[0], m.css[1]);
        return;
      }
      if (m.sites) {
        gl.bufferData(gl.ARRAY_BUFFER, m.sites, gl.DYNAMIC_DRAW);
        count = m.sites.length / STRIDE;
        return;
      }
      if (m.hue) {
        gl.bufferSubData(gl.ARRAY_BUFFER, (m.hue[0] * STRIDE + 3) * 4, new Float32Array([m.hue[1]]));
        return;
      }
      gl.uniform2f(U.uPan, m.pan[0], m.pan[1]);
      gl.uniform1f(U.uZoom, m.zoom);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    };
  }

  let send = null, ok = false, sites = null, last = null;

  function init() {
    const canvas = document.getElementById("bubbles");
    if (!canvas) return false;
    send = rendererMain((data) => {
      if (!data.ok) { if (data.log) console.error("bubbles shader:", data.log); return; }
      ok = true;
    });
    send({ canvas });
    if (!ok) return false;
    resize();
    if (sites) send({ sites });
    if (last) draw(last.pan, last.zoom);
    return true;
  }

  function resize() {
    if (!ok) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    send({ size: [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)], css: [innerWidth, innerHeight] });
    if (last) draw(last.pan, last.zoom);
  }

  /* data: Float32Array of STRIDE floats per site */
  function setSites(data) {
    sites = data;
    if (ok) send({ sites });
  }

  function setHue(i, hue) {
    if (sites) sites[i * STRIDE + 3] = hue;
    if (ok) send({ hue: [i, hue] });
  }

  function draw(pan, zoom) {
    last = { pan: { x: pan.x, y: pan.y }, zoom };
    if (ok) send({ pan: [pan.x, pan.y], zoom });
  }

  return { init, resize, setSites, setHue, draw, STRIDE };
})();
