/* C.F.B. Your Sanctuary: the 3D world behind the Garden's quiz. Loaded only when the Garden
   screen opens (garden.js imports it), never by Home, Brands or Scan.
   One island: sculpted terrain with an earth-and-stone edge, a pond fed by a two-step
   waterfall, stone paths, a cottage, trees, and the rabbits' clover meadow. Everything except
   the four models in assets/sanctuary/ (three rabbits and the cottage) is made here in code (terrain, water, rocks, flowers,
   grass), so the download stays small.
   The world grows only with what was learned: garden.js passes the Meadow's progress in
   setState({ p, residents }). More flowers bloom with p; residents (1 to 3) is a high-water
   mark, so a rabbit that moved in never leaves. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const BASE = new URL("./assets/sanctuary/", import.meta.url).href;

/* ---------- Small maths ---------- */
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (dx, dz, s) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const h2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return mix(mix(h2(ix, iy), h2(ix + 1, iy), u), mix(h2(ix, iy + 1), h2(ix + 1, iy + 1), u), v); }
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s / (1 - Math.pow(0.5, o)); }

/* ---------- The lie of the land ---------- */
const R0 = 29;                                   // the island's mean radius
const edgeR = (th) => R0 + 3.2 * (fbm(Math.cos(th) * 1.3 + 5, Math.sin(th) * 1.3 + 9, 3) - 0.5) * 2 + 1.2 * Math.sin(th * 3 + 0.6);
/* Three pools, each lower than the last; water runs A to B to C. L is the water level. */
const POOLS = [
  { x: 17, z: -12.5, r: 3.0, L: 5.2 },
  { x: 14, z: -5, r: 3.0, L: 2.6 },
  { x: 10.5, z: 8.5, r: 6.8, L: 0.55 },
];
const RUNS = [[0, 1], [1, 2]].map(([a, b]) => {
  const A = POOLS[a], B = POOLS[b], len = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
  const s0 = A.r + 0.2, s1 = Math.min(s0 + 1.5, len - B.r + 0.4);
  // the water's height s metres along the run: level, then the fall, then level again
  const w = (s) => mix(A.L, B.L, smooth(s0, s1, s));
  return { A, B, len, dx, dz, s0, s1, w };
});
const MEADOW = { x: -5, z: 9, r: 7.5 };
const PATHS = [
  [[-8.6, -6.6], [-6.5, -3.2], [-3, -0.2], [0, 1.5], [4, 0.6], [7.6, -0.5], [9.9, -0.1]],
  [[15.3, 1.4], [18, 2.8], [20.5, 5.2], [22, 8.5]],
  [[0, 1.5], [-0.6, 4.2], [-1.8, 6.4]],
];
function natural(x, z) {
  let h = 1.1 + (fbm(x * 0.07 + 3, z * 0.07 + 1) - 0.5) * 1.7;
  h += 4.8 * gauss(x - 2, z + 19, 8.5);          // the oak's hill, back centre
  h += 6.6 * gauss(x - 19.5, z + 14.5, 6.6);     // the rocky height the water comes from
  h += 3.8 * gauss(x + 21, z + 2, 6.5);            // a rise on the left
  h += 2.2 * gauss(x - 23, z - 9, 5);
  h += 1.6 * gauss(x + 12, z - 19, 5);
  const t = 1 - smooth(5.5, 10.5, Math.hypot(x + 10, z + 11)); h = mix(h, 2.9, t);          // the cottage's terrace
  const m = 1 - smooth(5, 11, Math.hypot(x - MEADOW.x, z - MEADOW.z)); h = mix(h, 1.2 + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 0.35, m * 0.85);
  return h;
}
function height(x, z) {
  let h = natural(x, z);
  for (const p of POOLS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > p.r + 4.2) continue;
    if (d <= p.r) { const k = d / p.r; h = p.L - 0.2 - 1.15 * (1 - k * k); }
    else {
      const rim = h + Math.max(0, p.L + 0.32 - h) * (1 - smooth(p.r + 1.2, p.r + 4.2, d));   // a low bank where the ground falls away
      h = mix(p.L - 0.2, rim, smooth(p.r, p.r + 1.3, d));
    }
  }
  for (const r of RUNS) {   // the stream bed between two pools
    const px = x - r.A.x, pz = z - r.A.z, s = px * r.dx + pz * r.dz;
    if (s < r.A.r - 0.5 || s > r.len - r.B.r + 0.5) continue;
    const off = Math.abs(px * r.dz - pz * r.dx);
    if (off < 2.2) h = mix(Math.min(h, r.w(s) - 0.3), h, smooth(0.7, 2.2, off));
  }
  const rn = Math.hypot(x, z) / edgeR(Math.atan2(z, x));
  return h - smooth(0.86, 1, rn) * 1.1;
}
function distToPaths(x, z) {
  let best = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
    const ax = p[i][0], az = p[i][1], bx = p[i + 1][0], bz = p[i + 1][1], vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}
function wet(x, z, margin = 0) {   // in a pool or the stream
  for (const p of POOLS) if (Math.hypot(x - p.x, z - p.z) < p.r + margin) return true;
  for (const r of RUNS) { const px = x - r.A.x, pz = z - r.A.z, s = px * r.dx + pz * r.dz; if (s > 0 && s < r.len && Math.abs(px * r.dz - pz * r.dx) < 1.3 + margin) return true; }
  return false;
}
const slopeAt = (x, z) => Math.hypot(height(x + 0.4, z) - height(x - 0.4, z), height(x, z + 0.4) - height(x, z - 0.4)) / 0.8;

/* ---------- Colours (the app's blush, cream, sage and berry, lit warm) ---------- */
const C = (hex) => new THREE.Color(hex);
const PAL = {
  grassA: C(0x9ccb6a), grassB: C(0x7fb656), grassC: C(0xbfdc86), grassShade: C(0x6fa252),
  sand: C(0xdccfa6), bed: C(0x5f9f98), earth: C(0x9a6f52), earthDark: C(0x7a543d), earthLight: C(0xba8f6c), stone: C(0xb9aa98), stoneDark: C(0x93857a), moss: C(0x8fb565),
  path: C(0xe6d6bd), water: C(0x3fb2b6), sun: C(0xffe3bf), sky: C(0xfff1e6), ground: C(0xb7c79a),
};

/* ---------- Textures drawn in code ---------- */
function canvasTex(size, draw, opts = {}) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
  t.anisotropy = 4; return t;
}
function mottleTex() {   // soft light-and-dark flecks that break up the grass
  return canvasTex(256, (g, n) => {
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const tile = (fx, fy) => fbm((x / n) * fx, (y / n) * fy, 3);   // close enough to seamless at this softness
      const v = 205 + 50 * (tile(9, 9) - 0.5) * 2 + 18 * (h2(x, y) - 0.5), i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(v, 0, 255); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: 9 });
}
function rippleNormalTex() {
  return canvasTex(256, (g, n) => {
    const img = g.createImageData(n, n), hgt = (x, y) => fbm(((x + n) % n) / n * 7, ((y + n) % n) / n * 7, 3);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 3.2, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 3.2, i = (y * n + x) * 4;
      img.data[i] = 128 + dx * 127; img.data[i + 1] = 128 + dy * 127; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: 3, data: true });
}
function streakTex() {   // falling water: soft white streaks
  return canvasTex(128, (g, n) => {
    g.clearRect(0, 0, n, n); const r = rng(11);
    for (let i = 0; i < 120; i++) { const x = r() * n, w = 2 + r() * 7, y = r() * n, l = 30 + r() * 70; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${0.35 + r() * 0.5})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x, y, w, l); g.fillRect(x, y - n, w, l); }
  }, { repeat: 1 });
}
function bladeTex() {   // a tuft of grass blades on a clear ground
  return canvasTex(128, (g, n) => {
    const r = rng(5);
    for (let i = 0; i < 15; i++) {
      const x = 14 + r() * (n - 28), lean = (r() - 0.5) * 44, top = 8 + r() * 50, w = 5 + r() * 5;
      const gr = g.createLinearGradient(0, n, 0, top); gr.addColorStop(0, "#9dc86c"); gr.addColorStop(1, "#e6f3bf");
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, n); g.quadraticCurveTo(x + lean * 0.3, n * 0.55, x + lean, top); g.quadraticCurveTo(x + lean * 0.5, n * 0.6, x + w, n); g.fill();
    }
  });
}
function blobTex() {   // the soft dark patch under an animal
  return canvasTex(128, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n / 2); gr.addColorStop(0, "rgba(40,50,25,.55)"); gr.addColorStop(0.6, "rgba(40,50,25,.22)"); gr.addColorStop(1, "rgba(40,50,25,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
}
function heartTex() {
  return canvasTex(64, (g, n) => { g.fillStyle = "#c9506e"; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 34, 8, 10, 22, 10); g.bezierCurveTo(28, 10, 32, 15, 32, 20); g.bezierCurveTo(32, 15, 36, 10, 42, 10); g.bezierCurveTo(56, 10, 60, 34, 32, 54); g.fill(); });
}
function skyEnv(renderer) {   // what shiny things reflect: a warm sky over green ground
  const s = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 32, 16), col = [], p = geo.attributes.position;
  const top = C(0xbfe0ee), mid = C(0xfff0df), low = C(0xa9c48a), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; if (y > 0) c.copy(mid).lerp(top, smooth(0, 0.8, y)); else c.copy(mid).lerp(low, smooth(0, 0.4, -y)); col.push(c.r, c.g, c.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6dd })); sun.position.set(-5, 6.5, 4); s.add(sun);
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(s, 0.04).texture; pm.dispose(); geo.dispose(); return env;
}

/* ---------- Building blocks ---------- */
function terrain(mottle) {
  const RINGS = 110, SEGS = 256, pos = [], col = [], uv = [], idx = [], c = new THREE.Color();
  const add = (x, z) => {
    const y = height(x, z); pos.push(x, y, z); uv.push(x / 60 + 0.5, z / 60 + 0.5);
    const n = fbm(x * 0.16 + 20, z * 0.16 + 7, 3), sl = slopeAt(x, z);
    c.copy(PAL.grassA).lerp(PAL.grassB, smooth(0.35, 0.65, n)).lerp(PAL.grassC, smooth(0.6, 0.85, fbm(x * 0.09 + 40, z * 0.09, 2)) * 0.7);
    c.lerp(PAL.grassShade, smooth(0.25, 0.7, sl) * 0.5);
    c.lerp(PAL.earthLight, smooth(0.75, 1.5, sl) * 0.85);                         // steep ground shows earth
    const dp = distToPaths(x, z); c.lerp(PAL.path, (1 - smooth(0.5, 1.5, dp)) * 0.55);   // worn ground along the paths
    for (const p of POOLS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 1.2) { c.lerp(PAL.sand, 1 - smooth(p.r - 0.4, p.r + 1.2, d)); c.lerp(PAL.bed, 1 - smooth(0, p.r * 0.75, d)); } }
    for (const r of RUNS) { const px = x - r.A.x, pz = z - r.A.z, s = px * r.dx + pz * r.dz; if (s > r.A.r - 0.5 && s < r.len - r.B.r + 0.5) c.lerp(PAL.stone, 1 - smooth(0.9, 2, Math.abs(px * r.dz - pz * r.dx))); }
    const rn = Math.hypot(x, z) / edgeR(Math.atan2(z, x)); c.lerp(PAL.grassShade, smooth(0.9, 1, rn) * 0.6);
    col.push(c.r, c.g, c.b);
  };
  add(0, 0);
  for (let i = 1; i <= RINGS; i++) for (let j = 0; j < SEGS; j++) { const th = (j / SEGS) * Math.PI * 2, r = Math.pow(i / RINGS, 0.92) * edgeR(th); add(Math.cos(th) * r, Math.sin(th) * r); }
  for (let j = 0; j < SEGS; j++) idx.push(0, 1 + ((j + 1) % SEGS), 1 + j);
  for (let i = 1; i < RINGS; i++) for (let j = 0; j < SEGS; j++) { const a = 1 + (i - 1) * SEGS + j, b = 1 + (i - 1) * SEGS + ((j + 1) % SEGS), d = a + SEGS, e = b + SEGS; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: mottle, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 }));
  m.receiveShadow = true; return m;
}
function skirt() {   // the island's side: turf, then earth with bands of stone, tapering to a rough underside
  const SEGS = 256, ROWS = 14, DEPTH = 9, pos = [], col = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= ROWS; i++) for (let j = 0; j < SEGS; j++) {
    const th = (j / SEGS) * Math.PI * 2, t = i / ROWS, er = edgeR(th), top = height(Math.cos(th) * er, Math.sin(th) * er);
    const lump = (fbm(Math.cos(th) * 9 + t * 5, Math.sin(th) * 9 + t * 3, 3) - 0.5) * 2.0 * smooth(0, 0.15, t);
    const r = er * (1 - 0.34 * Math.pow(smooth(0.35, 1, t), 1.4)) + lump + 0.35 * smooth(0, 0.08, t), y = top - DEPTH * (0.75 + 0.5 * fbm(Math.cos(th) * 2, Math.sin(th) * 2, 2)) * t;
    pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
    const band = fbm(th * 6, t * 9, 3), rocky = smooth(0.52, 0.66, fbm(Math.cos(th) * 7 + 3, Math.sin(th) * 7 + t * 6, 3));
    c.copy(PAL.earth).lerp(PAL.earthLight, smooth(0.4, 0.7, band)).lerp(PAL.earthDark, smooth(0.5, 1, t) * 0.7).lerp(PAL.stone, rocky * 0.8);
    if (t < 0.09) c.lerp(PAL.grassShade, 1 - t / 0.09);
    col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < SEGS; j++) { const a = i * SEGS + j, b = i * SEGS + ((j + 1) % SEGS), d = a + SEGS, e = b + SEGS; idx.push(a, d, b, b, d, e); }
  const last = pos.length / 3; pos.push(0, -DEPTH - 0.5, 0); col.push(PAL.earthDark.r, PAL.earthDark.g, PAL.earthDark.b);
  for (let j = 0; j < SEGS; j++) idx.push(ROWS * SEGS + j, last, ROWS * SEGS + ((j + 1) % SEGS));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: 0.2 }));
}
/* A rounded rock: a sphere pushed about by noise, mossy on top. One geometry per seed. */
function rockGeo(seed, moss = 0.6, detail = 2) {
  let g = mergeVertices(new THREE.IcosahedronGeometry(1, detail)); const p = g.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 1.3 + seed, v.y * 1.3 + seed * 2 + v.z, 3); v.multiplyScalar(0.72 + n * 0.56); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 3 + seed, v.z * 3, 2); c.copy(PAL.stone).lerp(PAL.stoneDark, smooth(0.35, 0.7, n)); c.lerp(PAL.moss, smooth(0.45, 0.85, nr.getY(i)) * smooth(0.3, 0.6, fbm(v.x * 2 + 9, v.z * 2 + seed, 2)) * moss); col.push(c.r, c.g, c.b); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return g;
}
/* A flower: stem, a ring of rounded petals, a centre. Colours live in the vertices. */
function flowerGeo(petal, centre, petals = 6, cup = 0.35, size = 1) {
  const parts = [], paint = (g, hex) => { const c = C(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
  const stem = new THREE.CylinderGeometry(0.018, 0.024, 0.62, 5); stem.translate(0, 0.31, 0); parts.push(paint(stem, 0x6ea24e));
  const leaf = new THREE.SphereGeometry(0.09, 6, 4); leaf.scale(1, 0.18, 0.45); leaf.translate(0.09, 0.2, 0); parts.push(paint(leaf, 0x7fb256));
  for (let i = 0; i < petals; i++) { const g = new THREE.CircleGeometry(0.1 * size, 7); g.rotateX(-Math.PI / 2); g.scale(1, 1, 0.62); g.translate(0.105 * size, 0, 0); /* flat petals: a thousand flowers have to stay cheap */ g.rotateZ(cup); g.rotateY((i / petals) * Math.PI * 2); g.translate(0, 0.63, 0); parts.push(paint(g, petal)); }
  const mid = new THREE.SphereGeometry(0.058 * size, 6, 4); mid.scale(1, 0.7, 1); mid.translate(0, 0.65, 0); parts.push(paint(mid, centre));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
function spikeGeo(hex, tip) {   // lavender and foxglove: a stem beaded with small blooms
  const parts = [], paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
  const stem = new THREE.CylinderGeometry(0.016, 0.022, 0.6, 5); stem.translate(0, 0.3, 0); parts.push(paint(stem, C(0x6ea24e)));
  for (let i = 0; i < 9; i++) { const t = i / 8, g = new THREE.SphereGeometry(0.062 * (1 - t * 0.55), 5, 3); g.translate(Math.cos(i * 2.4) * 0.045 * (1 - t), 0.5 + t * 0.52, Math.sin(i * 2.4) * 0.045 * (1 - t)); parts.push(paint(g, C(hex).lerp(C(tip), t))); }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
function cloverGeo() {   // three round leaves lying almost flat
  const parts = [];
  for (let i = 0; i < 3; i++) { const g = new THREE.CircleGeometry(0.13, 8); g.rotateX(-Math.PI / 2 + 0.25); g.translate(0.115, 0.05, 0); g.rotateY((i / 3) * Math.PI * 2); parts.push(g); }
  return mergeGeometries(parts);
}
function tuftGeo() {   // two crossed cards carrying the blade picture
  const parts = [];
  for (let i = 0; i < 4; i++) { const g = new THREE.PlaneGeometry(0.9, 0.62); g.translate(0, 0.31, 0); g.rotateY(i * Math.PI / 2 + 0.4); parts.push(g); }   // four, so each card has a front both ways (a back face would light from below)
  const g = mergeGeometries(parts), n = g.attributes.position.count, nr = new Float32Array(n * 3); for (let i = 0; i < n; i++) nr[i * 3 + 1] = 1;   // lit like the ground they stand on
  g.setAttribute("normal", new THREE.BufferAttribute(nr, 3)); return g;
}
function bushGeo(seed) {   // a rounded shrub: several soft lumps merged
  const r = rng(seed), parts = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.IcosahedronGeometry(0.55 + r() * 0.35, 2); g.translate((r() - 0.5) * 1.3, 0.45 + r() * 0.5, (r() - 0.5) * 1.3); parts.push(g); }
  let g = mergeVertices(mergeGeometries(parts)); const p = g.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * 2.2 + seed, v.y * 2.2 + v.z * 2.2, 2); v.multiplyScalar(1 + (n - 0.5) * 0.22); p.setXYZ(i, v.x, Math.max(0, v.y), v.z); c.copy(C(0x6f9f52)).lerp(C(0xa5cf7a), smooth(0.2, 1.3, v.y) * 0.9 + (n - 0.5) * 0.3); col.push(c.r, c.g, c.b); }
  g.computeVertexNormals(); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return g;
}
function dabTex(light, dark) {   // leaf-sized dabs of light and shade, so a canopy reads as foliage and not as a balloon
  return canvasTex(256, (g, n) => {
    g.fillStyle = "#ececec"; g.fillRect(0, 0, n, n); const r = rng(8);
    for (let i = 0; i < 900; i++) { const x = r() * n, y = r() * n, w = 5 + r() * 9; g.fillStyle = r() < 0.55 ? light : dark; g.globalAlpha = 0.12 + r() * 0.2; for (const [ox, oy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) { g.beginPath(); g.ellipse(x + ox, y + oy, w, w * 0.6, r() * 3.14, 0, 6.28); g.fill(); } }
  }, { repeat: 1 });
}
/* A tree with a rounded crown: many soft lumps, each pushed about by noise, sunlit on top.
   kind "oak": broad, green. kind "blossom": smaller, pink. Returns { trunk, crown } geometries about 1 unit tall. */
function treeGeo(seed, kind) {
  const r = rng(seed), parts = [], oak = kind === "oak";
  const lean = (r() - 0.5) * 0.16, trunkH = oak ? 0.46 : 0.5, tw = oak ? 0.05 : 0.03;
  const tg = new THREE.CylinderGeometry(tw * 0.55, tw * 1.35, trunkH, 9, 6); tg.translate(0, trunkH / 2, 0);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / trunkH; p.setX(i, p.getX(i) * (1 + 0.35 * Math.pow(1 - y, 5)) + Math.sin(y * 2.6 + seed) * 0.03 + lean * y); p.setZ(i, p.getZ(i) * (1 + 0.35 * Math.pow(1 - y, 5)) + Math.cos(y * 2.1 + seed) * 0.02); } }
  const trunkParts = [tg];
  for (let i = 0; i < (oak ? 4 : 3); i++) { const a = (i / (oak ? 4 : 3)) * 6.28 + r(), b = new THREE.CylinderGeometry(tw * 0.22, tw * 0.5, 0.3, 6); b.translate(0, 0.15, 0); b.rotateZ(0.75 + r() * 0.3); b.rotateY(a); b.translate(lean * 0.9, trunkH * 0.9, 0); trunkParts.push(b); }
  const trunk = mergeGeometries(trunkParts); trunk.computeVertexNormals();
  const lumps = oak ? 13 : 9, spread = oak ? 0.36 : 0.26;
  for (let i = 0; i < lumps; i++) {
    const a = r() * 6.28, d = i === 0 ? 0 : (0.35 + r() * 0.65) * spread, y = trunkH + (oak ? 0.2 : 0.16) + (i === 0 ? 0.14 : (r() - 0.35) * 0.22), g = mergeVertices(new THREE.IcosahedronGeometry((oak ? 0.17 : 0.13) + r() * 0.08, 2));
    g.scale(1, 0.82, 1); g.translate(Math.cos(a) * d + lean, y, Math.sin(a) * d); parts.push(g);
  }
  const crown = mergeGeometries(parts), p = crown.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3(), mid = trunkH + 0.24;
  const lo = oak ? C(0x5f9a45) : C(0xe58cab), hi = oak ? C(0xc3e07a) : C(0xffe3ec), midC = oak ? C(0x8cc25a) : C(0xf7b6cb);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = fbm(v.x * 9 + seed, v.y * 9 + v.z * 9, 3), n2 = fbm(v.x * 26 + 3, v.z * 26 + v.y * 26 + seed, 2);
    const cx = v.x - lean, cy = v.y - mid, len = Math.hypot(cx, cy, v.z) || 1, push = (n - 0.5) * 0.07 + (n2 - 0.5) * 0.022;
    p.setXYZ(i, v.x + (cx / len) * push, v.y + (cy / len) * push, v.z + (v.z / len) * push);
    const up = smooth(-0.16, 0.26, cy); c.copy(lo).lerp(midC, smooth(0, 0.55, up)).lerp(hi, smooth(0.5, 1, up) * (0.55 + n2 * 0.6)); c.lerp(lo, smooth(0.55, 0.35, n) * 0.35); col.push(c.r, c.g, c.b);
  }
  crown.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); crown.computeVertexNormals();
  return { trunk, crown };
}
/* The footbridge: planks on a low arch, a rail each side on round posts. Long axis is X, about 1 unit long. */
function bridgeGeo() {
  const parts = [], arc = (t) => 0.13 * Math.sin(t * Math.PI), N = 13;
  for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, g = new THREE.BoxGeometry(1 / N * 0.9, 0.022, 0.3); g.rotateZ(Math.atan(0.13 * Math.PI * Math.cos(t * Math.PI))); g.translate(t - 0.5, arc(t), 0); parts.push(g); }
  for (const sd of [-1, 1]) {
    for (const t of [0.02, 0.26, 0.5, 0.74, 0.98]) { const g = new THREE.CylinderGeometry(0.014, 0.016, 0.15, 8); g.translate(t - 0.5, arc(t) + 0.07, sd * 0.145); parts.push(g); const k = new THREE.SphereGeometry(0.02, 8, 6); k.translate(t - 0.5, arc(t) + 0.155, sd * 0.145); parts.push(k); }
    for (const up of [0.07, 0.125]) { const pts = []; for (let i = 0; i <= 14; i++) { const t = 0.02 + (i / 14) * 0.96; pts.push(new THREE.Vector3(t - 0.5, arc(t) + up, sd * 0.145)); } parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.009, 6)); }
    const beam = []; for (let i = 0; i <= 12; i++) { const t = i / 12; beam.push(new THREE.Vector3(t - 0.5, arc(t) - 0.02, sd * 0.13)); } parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beam), 14, 0.016, 6));
  }
  return mergeGeometries(parts.map((g) => { const n = g.toNonIndexed(); n.deleteAttribute("uv"); return n; }));
}
function instanced(geo, mat, list, shadow = false) {   // list: [{x,y,z,ry,s,sy?,tilt?,color?}]
  const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(it.tilt || 0, it.ry || 0, it.tz || 0); o.scale.set(it.s, it.s * (it.sy || 1), it.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (it.color) m.setColorAt(i, it.color); });
  m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; return m;
}

/* ---------- The scene ---------- */
export async function mount(canvas, opts = {}) {
  const reduced = !!opts.reduced, low = !!opts.low;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;   // redrawn only when a rabbit moves (see tick)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xfbe9e2, 90, 260);
  scene.environment = skyEnv(renderer);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.5, 500);

  scene.add(new THREE.HemisphereLight(PAL.sky, PAL.ground, 0.62));
  const sun = new THREE.DirectionalLight(PAL.sun, 3.2); sun.position.set(-30, 44, 26); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 5, far: 130 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffd9e0, 0.35); fill.position.set(24, 14, 20); scene.add(fill);   // a blush bounce from the right

  const mottle = mottleTex(), world = new THREE.Group(); scene.add(world);
  const land = terrain(mottle); world.add(land);
  const side = skirt(); side.castShadow = false; world.add(side);
  const r = rng(2026), Y = height;

  /* rocks: round the pools and falls, the big mossy one by the meadow, the island's rim, and strays */
  const rocks = [[], [], []], rock = (x, z, s, sink = 0.3, sy = 1) => rocks[Math.floor(r() * 3)].push({ x, y: Y(x, z) - s * sink + 0.05, z, ry: r() * 6.28, s, sy });
  for (const p of POOLS) { const n = Math.round(p.r * 3.4); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r() * 0.4, d = p.r + 0.5 + r() * 0.8; if (p === POOLS[2] && r() < 0.45) continue; rock(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.45 + r() * 0.75); } }
  for (const run of RUNS) for (let s = run.A.r - 0.2; s < run.len - run.B.r + 0.6; s += 0.8) for (const sd of [-1, 1]) { const o = sd * (1.45 + r() * 0.5); rock(run.A.x + run.dx * s + run.dz * o, run.A.z + run.dz * s - run.dx * o, 0.55 + r() * 0.7, 0.25, 1.1); }
  for (let i = 0; i < 16; i++) { const a = -0.9 + r() * 1.5, d = 3 + r() * 6; rock(19.5 + Math.cos(a) * d * 0.9, -14.5 + Math.sin(a) * d, 0.9 + r() * 1.5, 0.35, 1.15); }   // the height behind the falls
  rock(-11.4, 10.4, 2.3, 0.42, 0.95); rock(-12.9, 8.6, 1.0); rock(-10.6, 13.4, 0.7);
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 6 + r() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!wet(x, z, 1.5) && distToPaths(x, z) > 1.6 && Math.hypot(x - MEADOW.x + 1, z - MEADOW.z) > 5) rock(x, z, 0.25 + r() * 0.5); }
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 });
  rocks.forEach((list, i) => world.add(instanced(rockGeo(3 + i * 7), rockMat, list, true)));
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe9ddd2, vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 });
  const rim = [[], []]; for (let i = 0; i < 40; i++) { const th = r() * 6.28, dn = r(), er = edgeR(th) * (0.985 - 0.2 * Math.pow(smooth(0.35, 1, dn * 0.8), 1.4)), x = Math.cos(th) * er, z = Math.sin(th) * er, s = 0.6 + r() * 1.0; rim[i % 2].push({ x, y: Y(Math.cos(th) * edgeR(th), Math.sin(th) * edgeR(th)) - 0.8 - dn * 6, z, ry: r() * 6.28, s, sy: 0.85 }); }
  rim.forEach((list, i) => world.add(instanced(rockGeo(40 + i * 5, 0.2, 3), rimMat, list, false)));

  /* stepping stones along the paths */
  const stones = []; const stoneGeo = rockGeo(77, 0);
  for (const p of PATHS) { const curve = new THREE.CatmullRomCurve3(p.map(([x, z]) => new THREE.Vector3(x, 0, z))), n = Math.round(curve.getLength() / 1.02); for (let i = 0; i <= n; i++) { const q = curve.getPointAt(i / n), x = q.x + (r() - 0.5) * 0.3, z = q.z + (r() - 0.5) * 0.3; stones.push({ x, y: Y(x, z) + 0.02, z, ry: r() * 6.28, s: 0.5 + r() * 0.16, sy: 0.16 }); } }
  world.add(instanced(stoneGeo, new THREE.MeshStandardMaterial({ color: 0xf3e7d3, vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 }), stones, false));

  /* water */
  const ripple = rippleNormalTex(), waterMat = new THREE.MeshStandardMaterial({ color: PAL.water, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.05, normalMap: ripple, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.6 });
  for (const p of POOLS) { const g = new THREE.CircleGeometry(p.r + 0.25, 40); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, waterMat); m.position.set(p.x, p.L, p.z); m.receiveShadow = true; world.add(m); }
  const streak = streakTex(); streak.wrapS = streak.wrapT = THREE.RepeatWrapping;
  const fallMat = new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const foam = [];
  for (const run of RUNS) {
    const pos = [], uv = [], idx = [], N = 26, from = run.A.r - 0.6, to = run.len - run.B.r + 0.8;
    for (let i = 0; i <= N; i++) { const s = mix(from, to, i / N), cx = run.A.x + run.dx * s, cz = run.A.z + run.dz * s, w = 0.8 + 0.3 * smooth(run.s0, run.s1, s), y = run.w(s) + 0.05; pos.push(cx + run.dz * w, y, cz - run.dx * w, cx - run.dz * w, y, cz + run.dx * w); uv.push(0, s * 0.3, 1, s * 0.3); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, waterMat)); const top = new THREE.Mesh(g, fallMat); top.position.y = 0.03; world.add(top);
    const fg = new THREE.RingGeometry(0.25, 1.25, 24); fg.rotateX(-Math.PI / 2); const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    f.position.set(run.A.x + run.dx * (run.s1 + 0.35), run.B.L + 0.04, run.A.z + run.dz * (run.s1 + 0.35)); world.add(f); foam.push(f);
  }
  /* lily pads and two lilies on the pond */
  { const P = POOLS[2], pads = [], lil = []; const pg = new THREE.CircleGeometry(0.42, 12, 0.35, 5.6); pg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 9; i++) { const a = 0.6 + r() * 3.6, d = 1.4 + r() * 3.6, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; pads.push({ x, y: P.L + 0.025, z, ry: r() * 6.28, s: 0.8 + r() * 0.7 }); if (i % 4 === 1) lil.push({ x: x + 0.1, y: P.L - 0.52, z, ry: r() * 6.28, s: 1.5 }); }
    world.add(instanced(pg, new THREE.MeshStandardMaterial({ color: 0x86bd6a, roughness: 0.7, side: THREE.DoubleSide }), pads));
    world.add(instanced(flowerGeo(0xf7b4c6, 0xf6d86b, 9, 0.75, 1.5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), lil)); }

  /* flowers: in drifts, never a carpet; the middle of the meadow stays open for the rabbits */
  const SPOTS = [[-3.2, 9.4], [-8.2, 12.2], [-7.2, 6.0]];   // where the rabbits sit
  const okGround = (x, z, pathGap = 0.9) => Math.hypot(x, z) < edgeR(Math.atan2(z, x)) - 1.6 && !wet(x, z, 0.5) && distToPaths(x, z) > pathGap && slopeAt(x, z) < 0.75 && SPOTS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 2.4) && Math.hypot(x + 10, z + 11) > 5.2;
  const drifts = [   // [x, z, radius, how many, kind]
    [-9.5, 6.2, 2.4, 34, "cosmos"], [-11.5, 12.5, 2.6, 30, "daisy"], [-5.2, 14.6, 2.6, 34, "cosmos"], [-0.6, 12.6, 2.2, 26, "daisy"], [0.4, 9.2, 1.3, 12, "daisy"], [-10.6, 9.4, 1.6, 12, "spike"],
    [1.6, 15.4, 2.4, 24, "spike"], [-14.5, 8.5, 2.6, 26, "pinkspike"], [3.6, 4.6, 2.0, 22, "cosmos"], [5.8, 13.6, 1.8, 16, "daisy"], [-15, 0.5, 3, 30, "daisy"], [-4, -3.2, 2.2, 22, "cosmos"],
    [-13.6, -5.4, 2.4, 26, "pinkspike"], [-5.6, -8.4, 2.0, 20, "spike"], [-15.6, -12.6, 2.4, 22, "cosmos"], [7.5, -6.5, 2.8, 26, "daisy"], [6.2, -12.4, 2.6, 24, "spike"], [-3, -13, 2.4, 22, "cosmos"],
    [-8, 19.5, 2.6, 26, "pinkspike"], [-1.5, 21.5, 2.4, 24, "daisy"], [6.5, 22.5, 2.4, 22, "cosmos"], [13.5, 21, 2.2, 20, "spike"], [-17, 13.5, 2.2, 20, "cosmos"], [19, 18, 2.0, 18, "daisy"], [-22, 11, 1.8, 14, "daisy"],
    [18.6, 4.8, 2.0, 20, "pinkspike"], [20.5, 12.4, 2.4, 24, "cosmos"], [14.6, 16.8, 2.4, 24, "daisy"], [5.5, 18.5, 2.4, 22, "pinkspike"], [22.4, -3.4, 2.2, 18, "spike"], [10.6, -1.8, 1.4, 12, "cosmos"], [-20.5, 6.5, 2.4, 22, "spike"], [-21, -6, 2.2, 18, "daisy"],
  ];
  const kinds = { daisy: [], cosmos: [], cosmos2: [], spike: [], pinkspike: [] };
  for (const [cx, cz, rad, n, kind] of drifts) for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d * 1.25, z = cz + Math.sin(a) * d * 0.85; if (!okGround(x, z)) continue;
    const k = kind === "cosmos" && r() < 0.4 ? "cosmos2" : kind;
    kinds[k].push({ x, y: Y(x, z) - 0.03, z, ry: r() * 6.28, s: (kind.includes("spike") ? 1.6 : 1.15) + r() * 0.6, tilt: (r() - 0.5) * 0.25, tz: (r() - 0.5) * 0.25, u: r() });
  }
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.35, side: THREE.DoubleSide });
  const blooms = [];
  for (const [k, geo] of [["daisy", flowerGeo(0xffffff, 0xf4cf52, 9, 0.2)], ["cosmos", flowerGeo(0xf59ab8, 0xf7d766, 7, 0.32, 1.15)], ["cosmos2", flowerGeo(0xfbd3df, 0xf2c14e, 7, 0.4, 1.05)], ["spike", spikeGeo(0x9b7fd1, 0xc9b6ee)], ["pinkspike", spikeGeo(0xe77fa4, 0xf8c6d6)]]) {
    kinds[k].sort((a, b) => a.u - b.u);   // the first third is there from the start; the rest bloom as the topic is learned
    const m = instanced(geo, flowerMat, kinds[k], false); m.userData.all = kinds[k].length; blooms.push(m); world.add(m);
  }

  /* clover in the meadow, grass tufts everywhere there is grass */
  const clover = [], cc = new THREE.Color();
  for (let i = 0; i < 1500; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * (MEADOW.r + 1), x = MEADOW.x + Math.cos(a) * d * 1.15, z = MEADOW.z + Math.sin(a) * d * 0.9; if (!okGround(x, z, 0.6) && SPOTS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 1.5)) continue; if (vnoise(x * 0.9, z * 0.9) < 0.42) continue; clover.push({ x, y: Y(x, z) + 0.03, z, ry: r() * 6.28, s: 0.8 + r() * 0.8, color: cc.set(0x5f9a4a).lerp(C(0x86bd5c), r()).clone() }); }
  world.add(instanced(cloverGeo(), new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.2 }), clover));
  const tufts = [];
  for (let i = 0; i < (low ? 2200 : 4200); i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * (R0 + 2), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!okGround(x, z, 0.75)) continue;
    const inMeadow = Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r - 1; if (inMeadow && r() < 0.6) continue;
    if (vnoise(x * 0.35 + 9, z * 0.35) < 0.3) continue;   // tufts gather in patches
    tufts.push({ x, y: Y(x, z) - 0.02, z, ry: r() * 6.28, s: (inMeadow ? 0.55 : 0.8) + r() * 0.7, color: cc.set(0xcfe6a4).lerp(C(0xffffff), r() * 0.6).clone() });
  }
  const tuftMesh = instanced(tuftGeo(), new THREE.MeshStandardMaterial({ map: bladeTex(), alphaTest: 0.45, roughness: 1, envMapIntensity: 0.15 }), tufts); tuftMesh.receiveShadow = false; world.add(tuftMesh);

  /* shrubs, some in bloom */
  const bushes = [[], []], dots = [];
  for (const [x, z, s, bloom] of [[-13.6, -8.2, 1.5, 1], [-6.2, -12.6, 1.3, 2], [-12.8, -14.2, 1.6, 0], [-7.2, -6.2, 0.9, 1], [-17.5, 4.5, 1.5, 0], [-13.5, 14.5, 1.3, 2], [8.5, 15.8, 1.2, 1], [17.6, 12.6, 1.4, 0], [19.5, -1.4, 1.5, 2], [8.6, -9.4, 1.6, 0], [-2.5, -8.5, 1.2, 0], [23, 3.4, 1.2, 1], [3.4, 5.2, 0.8, 2], [-18.5, -9.5, 1.7, 0], [11.5, -14.5, 1.5, 1], [-1.5, 17.6, 1.1, 0], [-11.5, 20.5, 1.4, 1], [2.5, 23.5, 1.2, 0], [10.5, 22.5, 1.3, 2], [-19.5, 9.5, 1.3, 0], [16.5, 20.5, 1.1, 0]]) {
    const y = Y(x, z) - 0.1; bushes[Math.floor(r() * 2)].push({ x, y, z, ry: r() * 6.28, s });
    if (bloom) for (let i = 0; i < 26; i++) { const a = r() * 6.28, e = r() * 1.2, rad = 1.05 * s; dots.push({ x: x + Math.cos(a) * Math.sin(e) * rad, y: y + (0.75 + Math.cos(e) * 0.72) * s, z: z + Math.sin(a) * Math.sin(e) * rad, s: (0.09 + r() * 0.07) * s, ry: 0, color: C(bloom === 1 ? 0xf7a8c0 : 0xfffaf2).lerp(C(0xfbd9e4), r() * 0.5) }); }
  }
  const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 });
  bushes.forEach((list, i) => world.add(instanced(bushGeo(60 + i * 9), bushMat, list, true)));
  world.add(instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), dots));

  /* trees: three oaks and four blossom trees, no two the same shape */
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x8a6248, roughness: 1, envMapIntensity: 0.15 });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: dabTex("#ffffff", "#a8a8a8"), roughness: 0.9, envMapIntensity: 0.25 });
  for (const [x, z, tall, kind, seed] of [[2.5, -18, 14.5, "oak", 3], [-21.5, -12.5, 10.5, "oak", 9], [22.5, 13.5, 9, "oak", 14], [-19.8, -0.5, 7.6, "blossom", 21], [8.8, -15.8, 6.8, "blossom", 27], [-21.5, 14.2, 5.6, "blossom", 33], [23.5, -6.5, 6.4, "blossom", 38], [-3.5, -19.5, 8.5, "oak", 44], [-16.5, 19, 7.4, "oak", 51], [15.5, 22.5, 5.2, "blossom", 57]]) {
    const t = treeGeo(seed, kind), g = new THREE.Group(), a = new THREE.Mesh(t.trunk, barkMat), b = new THREE.Mesh(t.crown, leafMat);
    a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true; g.add(a, b); g.scale.setScalar(tall); g.position.set(x, Y(x, z) - 0.15, z); g.rotation.y = seed; world.add(g);
  }
  { const run = RUNS[1], s = 5.9, x = POOLS[1].x + run.dx * s, z = POOLS[1].z + run.dz * s, m = new THREE.Mesh(bridgeGeo(), new THREE.MeshStandardMaterial({ color: 0xc8935e, roughness: 0.85, envMapIntensity: 0.3 }));
    m.scale.setScalar(7.6); m.position.set(x, POOLS[2].L + 0.5, z); m.rotation.y = Math.atan2(run.dx, -run.dz) ; m.castShadow = m.receiveShadow = true; world.add(m); }

  /* ---------- Models (Meshy; see CREDITS.md). Each is stood on the ground at a set height. ---------- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  const load = (name) => cache[name] || (cache[name] = loader.loadAsync(BASE + name + ".glb").then((g) => {
    const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    g.scene.position.set(-mid.x, -box.min.y, -mid.z);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.roughness = Math.max(o.material.roughness, 0.82); o.material.metalness = 0; o.material.envMapIntensity = 0.35; if (o.material.map) o.material.map.anisotropy = 4; } });
    return { scene: g.scene, size };
  }));
  async function place(name, x, z, tall, ry = 0, o = {}) {
    const m = await load(name), inner = o.clone ? m.scene.clone(true) : m.scene, g = new THREE.Group(); g.add(inner);
    const k = o.long ? tall / Math.max(m.size.x, m.size.z) : tall / m.size.y; g.scale.setScalar(k);
    g.position.set(x, (o.y ?? Y(x, z)) - (o.sink || 0), z); g.rotation.y = ry; world.add(g); return g;
  }
  const blob = blobTex(), blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const contact = (x, z, s) => { const g = new THREE.PlaneGeometry(s, s); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, blobMat); m.position.set(x, Y(x, z) + 0.05, z); m.renderOrder = 2; world.add(m); return m; };

  const rabbits = [];   // [0] Clover, [1] the tan one, [2] the grey one
  const jobs = [
    place("cottage", -10, -11.2, 9.4, 0.42, { sink: 0.12 }),
    place("rabbit-clover", SPOTS[0][0], SPOTS[0][1], 3.3, 0.5).then((g) => { rabbits[0] = { g, x: SPOTS[0][0], z: SPOTS[0][1], ry: 0.5, shadow: contact(SPOTS[0][0], SPOTS[0][1], 3.6), t: 0 }; }),
    place("rabbit-tan", SPOTS[2][0], SPOTS[2][1], 2.3, 1.9).then((g) => { rabbits[1] = { g, x: SPOTS[2][0], z: SPOTS[2][1], ry: 1.9, shadow: contact(SPOTS[2][0], SPOTS[2][1], 3.4), t: 2 }; }),
    place("rabbit-grey", SPOTS[1][0], SPOTS[1][1], 4.2, 0.9, { long: true }).then((g) => { rabbits[2] = { g, x: SPOTS[1][0], z: SPOTS[1][1], ry: 0.9, shadow: contact(SPOTS[1][0], SPOTS[1][1], 4.6), t: 4 }; }),
  ];
  const failed = (await Promise.allSettled(jobs)).filter((j) => j.status === "rejected");
  if (failed.length && !rabbits[0]) throw failed[0].reason;   // without Clover there is no habitat; a missing tree is survivable

  /* butterflies and the hearts of a hello */
  const flyers = [];
  if (!reduced) for (const [x, z, hex] of [[-1.5, 11.5, 0xf6a23c], [-9, 7.5, 0xfdf6e9]]) {
    const g = new THREE.Group(), wg = new THREE.CircleGeometry(0.2, 8); wg.scale(1, 1.25, 1); wg.translate(0.2, 0, 0); const wm = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide });
    const a = new THREE.Mesh(wg, wm), b = new THREE.Mesh(wg, wm); b.scale.x = -1; a.rotation.x = b.rotation.x = -Math.PI / 2; g.add(a, b); world.add(g); flyers.push({ g, a, b, x, z, ph: r() * 6 });
  }
  const heartMat = new THREE.SpriteMaterial({ map: heartTex(), transparent: true, depthWrite: false }), hearts = [];

  /* ---------- Camera: a turn-and-zoom view with two set places ---------- */
  const view = { tx: 1, ty: 1, tz: 2, az: 0.18, pol: 0.93, dist: 90 }, goal = { ...view };
  let mode = "world", wide = true;
  function frameFor(m) {
    const a = cam.aspect, tan = Math.tan((cam.fov * Math.PI) / 360);
    if (m === "meet") return { tx: -4.2, ty: 2.5, tz: 8.2, az: 0.3, pol: 1.3, dist: clamp(8.6 / (tan * Math.min(a, 1.25)) * 0.36, 12, 30) };
    wide = a > 1.05;
    // landscape: the whole island. portrait: the meadow, pond and cottage fill the screen and the rest is a turn away.
    return wide ? { tx: 0, ty: 0.5, tz: 0, az: 0.2, pol: 1.0, dist: Math.max(34 / (tan * a), 30 / tan * 0.92) } : { tx: 0.5, ty: 1, tz: 1.5, az: 0.16, pol: 0.98, dist: 15.5 / (tan * a) };
  }
  function limits() { const f = frameFor("world"); return mode === "meet" ? { dMin: 7, dMax: 34, pMin: 0.75, pMax: 1.45 } : { dMin: f.dist * 0.34, dMax: f.dist * 1.25, pMin: 0.45, pMax: 1.3 }; }
  function applyCam() {
    const sp = Math.sin(view.pol), cp = Math.cos(view.pol);
    cam.position.set(view.tx + Math.sin(view.az) * sp * view.dist, view.ty + cp * view.dist, view.tz + Math.cos(view.az) * sp * view.dist);
    const floor = Math.hypot(cam.position.x, cam.position.z) < R0 + 2 ? height(cam.position.x, cam.position.z) + 0.8 : -40; if (cam.position.y < floor) cam.position.y = floor;
    cam.lookAt(view.tx, view.ty, view.tz);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    Object.assign(goal, frameFor(mode)); if (!started) Object.assign(view, goal); dirty = true;
  }

  /* ---------- State from the quiz ---------- */
  let state = { p: 0, residents: 1 };
  function setState(s) {
    state = { p: clamp(s.p || 0, 0, 1), residents: clamp(s.residents || 1, 1, 3) };
    for (const m of blooms) m.count = Math.round(m.userData.all * (0.34 + 0.66 * state.p));
    rabbits.forEach((rb, i) => { if (rb) { rb.g.visible = rb.shadow.visible = i < state.residents; } });
    dirty = true; renderer.shadowMap.needsUpdate = true;
  }

  /* ---------- Picking: a tap on a rabbit or on the meadow ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    const b = canvas.getBoundingClientRect(); ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    for (let i = 0; i < rabbits.length; i++) if (rabbits[i] && rabbits[i].g.visible && ray.intersectObject(rabbits[i].g, true).length) return i === 0 ? "clover" : "meadow";
    const hit = ray.intersectObject(land, false)[0];
    return hit && Math.hypot(hit.point.x - MEADOW.x, hit.point.z - MEADOW.z) < MEADOW.r + 0.5 ? "meadow" : null;
  }
  const ptr = new Map(); let pinch = 0, moved = 0, downAt = 0;
  const onDown = (e) => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 1) { moved = 0; downAt = performance.now(); } if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
  const onMove = (e) => {
    const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; const L = limits();
    if (ptr.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { goal.az -= dx * 0.0055; goal.pol = clamp(goal.pol - dy * 0.004, L.pMin, L.pMax); wake(); } }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) goal.dist = clamp(goal.dist * (pinch / d), L.dMin, L.dMax); pinch = d; moved = 99; wake(); }
  };
  const onUp = (e) => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); pinch = 0; if (e.type === "pointerup" && !ptr.size && moved <= 6 && performance.now() - downAt < 500 && opts.onPick) opts.onPick(pick(e.clientX, e.clientY)); };
  const onWheel = (e) => { e.preventDefault(); const L = limits(); goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), L.dMin, L.dMax); wake(); };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("wheel", onWheel, { passive: false });

  /* ---------- The loop. With reduced motion nothing idles: it draws only when something changes. ---------- */
  let raf = 0, running = false, started = false, dirty = true, last = 0, time = 0, hello = -1, settle = 0;
  const wake = () => { dirty = true; settle = 1.2; if (running && !raf) raf = requestAnimationFrame(tick); };
  function tick(now) {
    raf = 0; if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt); let moving = false;
    for (const key in view) { const d = goal[key] - view[key]; if (Math.abs(d) > 1e-4) { view[key] += d * k; moving = true; } }
    applyCam();
    if (!reduced) {
      ripple.offset.set(time * 0.012, time * 0.008); streak.offset.y = time * 0.9;
      foam.forEach((f, i) => { const s = 1 + 0.12 * Math.sin(time * 3 + i); f.scale.set(s, 1, s); f.material.opacity = 0.42 + 0.12 * Math.sin(time * 2.3 + i); });
      rabbits.forEach((rb, i) => {
        if (!rb || !rb.g.visible) return; const t = time + rb.t;
        let hop = 0, turn = 0;
        if (i === 0 && hello >= 0) { hello += dt; const ph = hello / 0.42; hop = ph < 3 ? Math.abs(Math.sin(ph * Math.PI)) * 0.55 * (1 - ph / 3.6) : 0; turn = smooth(0, 0.5, hello); if (hello > 2.6) hello = -1; }
        else if (i === 1) { const c = t % 7; if (c < 0.5) hop = Math.sin((c / 0.5) * Math.PI) * 0.16; }
        const face = i === 0 ? mix(rb.ry, Math.atan2(cam.position.x - rb.x, cam.position.z - rb.z), hello >= 0 ? turn : 0) : rb.ry;
        if (hop > 0 || rb.wasUp) renderer.shadowMap.needsUpdate = true; rb.wasUp = hop > 0;
        rb.g.position.y = height(rb.x, rb.z) + hop; rb.g.rotation.y = face + (i === 0 ? Math.sin(t * 0.5) * 0.12 : 0);
        const breathe = 1 + Math.sin(t * (i === 2 ? 1.3 : 2.2)) * 0.012; rb.g.children[0].scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));
        rb.shadow.material.opacity = 1; rb.shadow.scale.setScalar(1 - hop * 0.5);
      });
      flyers.forEach((f) => { const t = time * 0.45 + f.ph, x = f.x + Math.sin(t) * 2.6 + Math.sin(t * 2.7) * 0.6, z = f.z + Math.cos(t * 0.8) * 2.2; f.g.position.set(x, height(x, z) + 1.5 + Math.sin(t * 3.1) * 0.35, z); f.g.rotation.y = Math.atan2(Math.cos(t) * 2.6, -Math.sin(t * 0.8) * 1.76); const w = Math.sin(time * 16 + f.ph) * 0.9; f.a.rotation.y = w; f.b.rotation.y = -w; });
      for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i]; h.age += dt; h.s.position.y += dt * 1.1; h.s.position.x += Math.sin(h.age * 4 + i) * dt * 0.3; h.s.material.opacity = 1 - smooth(0.9, 1.7, h.age); const sc = 0.5 * smooth(0, 0.25, h.age); h.s.scale.set(sc, sc, 1); if (h.age > 1.7) { world.remove(h.s); h.s.material.dispose(); hearts.splice(i, 1); } }
    }
    if (!started) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, cam); dirty = false; started = true;
    if (reduced) { if (moving) raf = requestAnimationFrame(tick); return; }
    raf = requestAnimationFrame(tick);
  }
  const ro = new ResizeObserver(() => { resize(); wake(); }); ro.observe(canvas);
  resize(); setState(state);

  return {
    setState,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); raf = 0; },
    /* "world": the island. "meet": close to Clover, low, the cottage behind. */
    go(m) { mode = m; const az = view.az; Object.assign(goal, frameFor(m)); goal.az += Math.round((az - goal.az) / (Math.PI * 2)) * Math.PI * 2; wake(); },
    mode: () => mode,
    hello() {
      const rb = rabbits[0]; if (!rb) return; wake();
      if (reduced) return;   // the card answers in words instead
      hello = 0;
      for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(heartMat.clone()); s.position.set(rb.x + (i - 1.5) * 0.3, height(rb.x, rb.z) + 2.2 + i * 0.12, rb.z + 0.2); s.scale.set(0.01, 0.01, 1); world.add(s); hearts.push({ s, age: -i * 0.18 }); }
    },
    /* for the tests and the screenshots */
    debug: { view, goal, cam, rabbits, blooms, failed: failed.length, snap() { Object.assign(view, goal); applyCam(); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); }, project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight }; }, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls }) },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("wheel", onWheel);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); });
      renderer.dispose();
    },
  };
}
