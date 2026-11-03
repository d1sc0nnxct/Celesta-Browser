/* ============================================================
   space.js — WebGL fullscreen background for the home page
   Realistic procedural sky: domain-warped fbm nebulae with dark
   dust lanes, a tilted galactic band (haze + dense star field),
   three colored star layers (temperature, twinkle, diffraction
   spikes on the brightest), and dithering to keep OLED blacks
   free of banding. Earlier version adapted from Rye Terrell's
   "Procedural 2D Space Scenes in WebGL" (wwwtyro.net, 2016) —
   completely free license (attribution appreciated, not
   required). Pan parallax keeps the sky locked to the view; the sky
   never rescales on zoom (infinite distance), and a final contrast
   pass deepens the void without touching true black.
   ============================================================ */

"use strict";

const Space = (() => {
  const VS = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FS = `
precision highp float;

uniform vec2  uRes;     // canvas size, device px
uniform float uTime;    // seconds
uniform vec2  uPan;     // view pan in device px (DOM orientation, y down)
uniform float uZoom;    // view zoom
uniform float uNebula;  // 1 = nebulae and galactic band, 0 = stars only

/* ---- hash / noise (trig-free Hoskins style) ---- */
float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash2(vec2 p) {
  float n = hash1(p);
  return vec2(n, hash1(p + n + 7.77));
}
/* gradient noise, roughly (-1, 1) */
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i) * 2.0 - 1.0, f);
  float b = dot(hash2(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4;
}
/* 4-octave fbm, rotated per octave (4th is sub-pixel at half-res render,
   so the saved fill rate costs nothing visible) */
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
  for (int i = 0; i < 4; i++) {
    s += a * gnoise(p);
    p = m * p;
    a *= 0.52;
  }
  return s;
}
/* 3-octave fbm for large soft fields (void coverage, hue drift) */
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
  for (int i = 0; i < 3; i++) {
    s += a * gnoise(p);
    p = m * p;
    a *= 0.52;
  }
  return s;
}

/* Same camera as the scene: screen = pan + world * zoom. Because the scene
   pan is cursor-anchored during a wheel zoom, dividing by uZoom makes the
   sky zoom in exactly where the mouse is, like the graph. Deeper layers
   move less with the pan (parallax) but share the zoom. */
vec2 layerUV(vec2 px, float parallax) {
  vec2 c = uRes * 0.5;
  vec2 focus = c + (uPan - c) * parallax;
  return (px - focus) / (uRes.y * uZoom);
}
/* Stars belong to the page: zooming spreads them out and grows them like
   everything else on it (panning still moves them, with parallax). */
float starZoom() { return uZoom; }
vec2 starUV(vec2 px, float parallax) {
  vec2 c = uRes * 0.5;
  vec2 focus = c + (uPan - c) * parallax;
  return (px - focus) / (uRes.y * starZoom());
}

/* grid point stars: color temperature, twinkle, optional diffraction spikes.
   Sizes are in page pixels (screen pixels at zoom 1); a layer fades out
   once its cells shrink to a few pixels. */
vec3 starLayer(vec2 uv, float grid, float density, float gain, float twinkle, float spikes) {
  float cellPx = uRes.y * starZoom() / grid;
  float vis = smoothstep(3.0, 10.0, cellPx);
  if (vis <= 0.0) return vec3(0.0);
  vec2 g = uv * grid;
  vec2 id = floor(g), f = fract(g);
  vec3 acc = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cid = id + vec2(float(x), float(y));
      vec2 r = hash2(cid);
      if (r.x > density) continue;
      vec2 sp = hash2(cid + 13.1);
      vec2 off = (vec2(float(x), float(y)) + sp - f) * cellPx;   /* px */
      float d2 = dot(off, off) / (starZoom() * starZoom());
      float b = pow(hash1(cid + 41.7), 5.0);   /* few bright, many dim */
      float tw = 1.0 - twinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (0.5 + hash1(cid + 9.3) * 2.2) + hash1(cid) * 6.2831));
      /* realistic spectral colors: mostly cool red/orange dwarfs, rarer
         yellow to blue-white, very rare hot blue; luminous stars run hot */
      float h1 = hash1(cid + 77.7);
      vec3 tint;
      if      (h1 < 0.34) tint = vec3(1.00, 0.56, 0.40);   /* M red dwarf */
      else if (h1 < 0.58) tint = vec3(1.00, 0.74, 0.55);   /* K orange */
      else if (h1 < 0.78) tint = vec3(1.00, 0.90, 0.74);   /* G yellow */
      else if (h1 < 0.90) tint = vec3(1.00, 0.97, 0.89);   /* F yellow-white */
      else if (h1 < 0.97) tint = vec3(0.85, 0.91, 1.00);   /* A/B blue-white */
      else                tint = vec3(0.64, 0.77, 1.00);   /* O blue */
      if (b > 0.40) tint = mix(tint, vec3(0.82, 0.89, 1.00), 0.60);
      float s = gain * b * tw;
      vec3 c = tint * s * (exp(-d2 * 0.55) + 0.10 * exp(-d2 * 0.014));
      if (spikes > 0.0 && b > 0.45) {
        vec2 ao = abs(off);
        float sp1 = exp(-ao.x * 1.1) * exp(-ao.y * 0.11)
                  + exp(-ao.y * 1.1) * exp(-ao.x * 0.11);
        c += tint * s * sp1 * 0.35 * spikes;
      }
      acc += c;
    }
  }
  return acc * vis;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   /* DOM orientation, y down */
  float t = uTime;

  vec3 col = vec3(0.0);                                      /* true black base */

  /* galactic band: tilted soft haze with a brighter core */
  vec2 buv = layerUV(px, 0.10);
  buv = mat2(0.90, 0.44, -0.44, 0.90) * buv;
  float band = exp(-buv.y * buv.y * 26.0);
  col += vec3(0.55, 0.60, 0.85) * band * 0.050 * uNebula;
  float bulge = exp(-buv.x * buv.x * 1.4) * exp(-buv.y * buv.y * 70.0);
  col += vec3(1.00, 0.78, 0.55) * bulge * 0.040 * uNebula;

  /* primary stardust: domain-warped fbm with dark lanes, large empty
     voids from a low-frequency coverage field, and region-varying
     realistic color — H-alpha crimson/magenta, O-III teal, reflection
     blue (amber comes from the secondary layer) */
  vec2 uv1 = layerUV(px, 0.20) * 4.6;
  vec2 q1 = vec2(fbm(uv1 + vec2(0.0, 3.1) + t * 0.010),
                 fbm(uv1 + vec2(4.7, 1.2) - t * 0.008));
  vec2 r1 = vec2(fbm(uv1 + 2.6 * q1 + vec2(1.7, 9.2) + t * 0.012),
                 fbm(uv1 + 2.6 * q1 + vec2(8.3, 2.8) - t * 0.010));
  float n1 = fbm(uv1 + 3.2 * r1);
  float d1 = clamp(n1 * 0.5 + 0.5, 0.0, 1.0);
  float lanes = smoothstep(-0.55, 0.45, r1.y);
  float cov1 = smoothstep(0.40, 0.68, fbm3(uv1 * 0.30 + 3.7) * 0.5 + 0.5);   /* voids */
  float dens1 = pow(d1, 4.4) * mix(0.22, 1.0, lanes) * cov1;
  float hue1 = fbm3(uv1 * 0.40 + 9.1) * 0.5 + 0.5;
  vec3 tint1 = mix(vec3(0.88, 0.20, 0.26), vec3(0.92, 0.30, 0.60), smoothstep(0.20, 0.46, hue1));
  tint1 = mix(tint1, vec3(0.16, 0.70, 0.63), smoothstep(0.46, 0.70, hue1));
  tint1 = mix(tint1, vec3(0.28, 0.44, 0.98), smoothstep(0.70, 0.92, hue1));
  col += tint1 * dens1 * 0.55 * uNebula;

  /* secondary stardust: reflection-blue with amber dust patches, also voided */
  vec2 uv2 = layerUV(px, 0.36) * 3.1 + 7.7;
  vec2 q2 = vec2(fbm3(uv2 + t * 0.008), fbm3(uv2 + vec2(6.1, 2.4) - t * 0.006));
  float n2 = fbm(uv2 + 2.4 * q2);
  float cov2 = smoothstep(0.44, 0.70, fbm3(uv2 * 0.34 + 12.3) * 0.5 + 0.5);
  float dens2 = pow(clamp(n2 * 0.5 + 0.5, 0.0, 1.0), 4.6) * cov2;
  float hue2 = fbm3(uv2 * 0.50 + 21.0) * 0.5 + 0.5;
  vec3 tint2 = mix(vec3(0.26, 0.42, 0.96), vec3(0.55, 0.62, 1.00), hue2);
  tint2 = mix(tint2, vec3(0.88, 0.56, 0.28), smoothstep(0.62, 0.85, hue2) * 0.7);
  col += tint2 * dens2 * 0.44 * uNebula;

  /* star layers, far -> near (band field shares the band transform so
     stars crowd along the galactic band; per-star color inside) */
  float dust = 1.0 - 0.60 * (1.0 - lanes) * (0.35 + 0.65 * band) * cov1;
  vec2 sbuv = mat2(0.90, 0.44, -0.44, 0.90) * starUV(px, 0.10);
  col += starLayer(sbuv, 46.0, 0.50, 0.60, 0.35, 0.0) * (0.35 + 1.30 * band) * dust;
  col += starLayer(starUV(px, 0.38), 28.0, 0.35, 0.75, 0.55, 0.0) * mix(1.0, dust, 0.6);
  col += starLayer(starUV(px, 0.62), 13.0, 0.22, 0.95, 0.85, 1.0);

  /* contrast pass: deepen the void, punch the dust and stars — pure
     black stays pure black, mid tones separate from the background */
  col = max((col - 0.014) * 1.26, 0.0);
  col = 1.0 - exp(-col * 1.12);
  vec2 sc = (px - uRes * 0.5) / uRes.y;
  col *= 1.0 - 0.30 * smoothstep(0.45, 1.05, length(sc));

  /* dither to prevent banding on OLED; keep untouched pixels pure black */
  float lum = dot(col, vec3(0.30, 0.60, 0.10));
  col += (hash1(px + fract(t) * 7.0) - 0.5) * 0.012 * smoothstep(0.0, 0.02, lum);

  gl_FragColor = vec4(col, 1.0);
}
`;

  /* The renderer lives in a worker on an OffscreenCanvas: Gecko has no
     KHR_parallel_shader_compile, so linking this shader blocks its thread for
     seconds — on the page that would freeze every Start page sharing the
     privileged-about process. */
  function rendererMain() {
    let gl = null, U = {};
    onmessage = ({ data: m }) => {
      if (m.canvas) {
        gl = m.canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false,
                                            powerPreference: "low-power" });
        if (!gl) { postMessage({ ok: false }); return; }
        const vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vs, VS); gl.compileShader(vs);
        gl.shaderSource(fs, FS); gl.compileShader(fs);
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
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ["uRes", "uTime", "uPan", "uZoom", "uNebula"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1f(U.uNebula, 1);
        postMessage({ ok: true });
        return;
      }
      if (!gl) return;
      if (m.size) {
        gl.canvas.width = m.size[0]; gl.canvas.height = m.size[1];
        gl.viewport(0, 0, m.size[0], m.size[1]);
        return;
      }
      if ("nebula" in m) {
        gl.uniform1f(U.uNebula, m.nebula);
        return;
      }
      gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(U.uTime, m.t * 0.001);
      gl.uniform2f(U.uPan, m.pan[0], m.pan[1]);
      gl.uniform1f(U.uZoom, m.zoom);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  let worker = null, canvas = null, ok = false, dpr = 1;
  const RENDER = 1.0;   /* near-native sky resolution (the 30fps throttle carries the
                           GPU budget now); was 0.5 — the half-res stretch looked soft */
  let last = { t: 0, pan: { x: 0, y: 0 }, zoom: 1 };

  function fail() {
    if (canvas) canvas.remove();
    if (worker) worker.terminate();
    ok = false;
    return false;
  }

  /* canvasEl: defaults to #space. workerURL: pages whose CSP forbids blob:
     workers (Settings and other built-in pages) load space-worker.js instead */
  /* A custom background shader (Settings > Home). Shadertoy code (it defines
     mainImage) gets the Shadertoy inputs; other code is used as written and
     may read uRes, uTime, uPan and uZoom. */
  function wrapShader(code) {
    if (!/\bmainImage\s*\(/.test(code)) return code;
    return `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uPan; uniform float uZoom;
#define iResolution vec3(uRes, 1.0)
#define iTime uTime
#define iMouse vec4(0.0)
${code}
void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }`;
  }

  /* customFS: a custom shader's source; if it does not compile, the built-in
     sky takes its place on a fresh canvas (a used one cannot be reused) */
  function init(canvasEl, workerURL, customFS) {
    canvas = canvasEl || document.getElementById("space");
    if (!canvas || !canvas.transferControlToOffscreen) return fail();
    const fs = customFS ? wrapShader(customFS) : FS;
    const src = `"use strict"; const VS = ${JSON.stringify(VS)}, FS = ${JSON.stringify(fs)}; (${rendererMain})();`;
    try {
      worker = new Worker(workerURL || URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    } catch (e) { return fail(); }
    worker.onmessage = ({ data }) => {
      if (!data.ok) {
        if (data.log) console.error("space shader:", data.log);
        if (customFS) {
          const fresh = canvas.cloneNode(false);
          canvas.replaceWith(fresh);
          worker.terminate();
          init(fresh, workerURL);
        } else {
          fail();
        }
        return;
      }
      ok = true;
      resize();
      worker.postMessage({ nebula });
      draw(last.t, last.pan, last.zoom);
    };
    worker.onerror = (e) => { console.error("space worker:", e.message); fail(); };
    const off = canvas.transferControlToOffscreen();
    worker.postMessage({ canvas: off }, [off]);
    return true;
  }

  function resize() {
    if (!ok) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.25) * RENDER;
    worker.postMessage({ size: [Math.max(1, Math.round(innerWidth * dpr)), Math.max(1, Math.round(innerHeight * dpr))] });
  }

  function draw(t, pan, zoom) {
    last = { t, pan: { x: pan.x, y: pan.y }, zoom };   // snapshot, pan mutates
    if (!ok) return;
    worker.postMessage({ t, pan: [pan.x * dpr, pan.y * dpr], zoom });
  }

  /* 1 = nebulae and galactic band, 0 = stars only */
  let nebula = 1;
  function setNebula(value) {
    nebula = value;
    if (ok) worker.postMessage({ nebula });
  }

  /* pixel read-back is not possible synchronously from the worker renderer */
  function sample() { return -1; }

  return { init, resize, draw, sample, setNebula, rendererMain, get last() { return last; }, get ok() { return ok; } };
})();
