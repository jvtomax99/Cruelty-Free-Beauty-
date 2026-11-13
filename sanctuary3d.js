/* C.F.B. Your Sanctuary: the 3D world behind the Garden's quiz. Loaded only when the Garden
   screen opens (garden.js imports it), never by Home, Brands or Scan.
   One floating island: sculpted terrain on a deep mass of earth and stone (ledges, a hollow,
   an off-centre tip), one great blossom tree whose roots go down the cliff, a stream into the
   pond and a waterfall from the pond down the outside, stone paths, a cottage on a raised
   lawn, trees, and five habitats (HABS), one per quiz topic:
   the rabbits' clover meadow, the ducks' willow pond, the guinea pigs' orchard, the beagles'
   leafy garden and the deer's wooded meadow. Everything except the models in
   assets/sanctuary/ (the animals and the cottage) is made here in code (terrain, water,
   rocks, plants, shelters), so the download stays small. The animals themselves, how they
   move and what they decide to do, are in sanctuary3d-life.js.
   The world grows only with what was learned: garden.js passes each habitat's progress in
   setState({ id: { p, residents, shelter } }). More flowers bloom with p; residents (1 to 3)
   and the better shelter are high-water marks, so nothing that arrived ever leaves. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { Life, prepare } from "./sanctuary3d-life.js";

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
const R0 = 31;                                   // the island's mean radius
const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));   // the angle from b round to a, the short way
/* The outline seen from above. edge0 is the land's own wandering edge; edgeR adds the three
   things that make its front: a cove cut back to the pond's bank (COVE, where the water leaves),
   a prow under the blossom tree and a blunter one front left. th is atan2(z, x); the first
   view looks from the +z side (th about 1.4), so the front of the island is th 0.5 to 2.3. */
const COVE = { th: 1.0, r: 20.8 }, HERO = { x: 18.6, z: 15.4 };
const edge0 = (th) => R0 + 3.2 * (fbm(Math.cos(th) * 1.3 + 5, Math.sin(th) * 1.3 + 9, 3) - 0.5) * 2 + 1.2 * Math.sin(th * 3 + 0.6);
const coveAt = (th) => Math.exp(-Math.pow(turn(th, COVE.th) / 0.2, 4));
const edgeR = (th) => mix(edge0(th) + 2.6 * Math.exp(-Math.pow(turn(th, 0.5) / 0.3, 2)) + 2.4 * Math.exp(-Math.pow(turn(th, 2.3) / 0.26, 2)) - 1.6 * Math.exp(-Math.pow(turn(th, 2.85) / 0.2, 2)), COVE.r, coveAt(th));
/* Three pools, each lower than the last; water runs A to B to C. L is the water level. */
const POOLS = [
  { x: 17, z: -12.5, r: 3.0, L: 5.2 },
  { x: 14, z: -5, r: 3.0, L: 2.6 },
  { x: 10.5, z: 8.5, r: 6.8, L: 0.55 },
];
const POND = POOLS[2];
/* Where the pond overflows: a channel through its bank to the lip of the cove. */
const OUT = (() => { const ex = Math.cos(COVE.th) * COVE.r, ez = Math.sin(COVE.th) * COVE.r, len = Math.hypot(ex - POND.x, ez - POND.z); return { dx: (ex - POND.x) / len, dz: (ez - POND.z) / len, len, ex, ez }; })();
const outS = (x, z) => (x - POND.x) * OUT.dx + (z - POND.z) * OUT.dz, outOff = (x, z) => Math.abs((x - POND.x) * OUT.dz - (z - POND.z) * OUT.dx);   // how far along the way out, and how far to the side of it
const RUNS = [[0, 1], [1, 2]].map(([a, b]) => {
  const A = POOLS[a], B = POOLS[b], len = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
  const s0 = A.r + 0.2, s1 = Math.min(s0 + 1.5, len - B.r + 0.4);
  // the water's height s metres along the run: level, then the fall, then level again
  const w = (s) => mix(A.L, B.L, smooth(s0, s1, s));
  return { A, B, len, dx, dz, s0, s1, w };
});
/* The habitats. r: how far the animals roam from (x, z). base: the height of its terrace.
   az: the side the camera comes from on a visit (trees and the shelter stand on the far side).
   sh: the shelter [x, z, radius]. rest: where they settle beside it. food: what they go to. */
export const HABS = [
  { id: "meadow", x: -5, z: 9.5, r: 6.6, base: 1.2, az: 0.3, sh: [-9.8, 5.3, 2.3], rest: [-7.0, 7.7], food: [[-3.2, 12], [-6.6, 13], [-1.6, 7.6]] },
  { id: "pond", x: 10.5, z: 8.5, r: 6.8, az: -0.25, pool: POOLS[2], sh: [3.5, 3.7, 1.6], rest: [6.3, 5.6], food: [[8, 11], [12.6, 11.4], [13.6, 6.6]] },
  { id: "orchard", x: -18.5, z: 0.5, r: 5.6, base: 3.0, az: 0.95, sh: [-23.6, -1.1, 1.8], rest: [-21, -0.3], food: [[-17, 3], [-19.4, -2.4], [-15.8, -0.8]] },
  { id: "burrow", x: 4.5, z: -8.5, r: 5.6, base: 2.4, az: 0.2, sh: [5.8, -13.5, 2.9], rest: [4.9, -10.2], food: [[2.2, -7.0], [6.9, -6.2]] },
  { id: "oak", x: 0, z: -20, r: 5.4, base: 4.9, az: 0.02, sh: [-1.7, -24.5, 2.2], rest: [-0.8, -22], food: [[2.8, -18.6], [-3, -18], [2, -22.6]] },
];
const HAB = Object.fromEntries(HABS.map((h) => [h.id, h])), MEADOW = HAB.meadow, LAND = HABS.filter((h) => !h.pool);
/* Who lives where. The first of each habitat is there from the start; the next two move in
   as the topic is learned (the pond's first is Willow with one duckling). Names and lines
   speak for the founder: Jose's to approve (SPEC "Open questions"). */
export const ROSTER = [
  { id: "clover", hab: "meadow", model: "rabbit-clover", name: "Clover", line: "Curious, playful, and very fond of clover.", at: [-3.6, 9.6, 0.5], n: 1 },
  { id: "hazel", hab: "meadow", model: "rabbit-tan", name: "Hazel", line: "Quick on her feet, and first to every new flower.", at: [-6.9, 11.8, 1.9], n: 2 },
  { id: "ash", hab: "meadow", model: "rabbit-grey", name: "Ash", line: "Calm and sleepy. Likes the warm spot by the burrow.", at: [-6.4, 8.2, 0.9], n: 3 },
  { id: "willow", hab: "pond", model: "duck", name: "Willow", line: "Patient and steady. Never lets the little ones out of sight.", at: [10, 9, 0.6], n: 1 },
  { id: "pip", hab: "pond", model: "duckling", name: "Pip", line: "Always first in line.", at: [8.6, 8, 0.6], n: 1, follow: "willow", scale: 1 },
  { id: "dot", hab: "pond", model: "duckling", name: "Dot", line: "Small, round and fearless.", at: [11.8, 7.2, 2], n: 2, follow: "pip", scale: 0.9 },
  { id: "puddle", hab: "pond", model: "duckling", name: "Puddle", line: "Stops to look at everything.", at: [9, 10.8, 4], n: 3, follow: "dot", scale: 1.06 },
  { id: "biscuit", hab: "orchard", model: "guinea-pig", name: "Biscuit", line: "Talkative, and always asking about lunch.", at: [-17.6, 1.2, 1], n: 1 },
  { id: "nutmeg", hab: "orchard", model: "guinea-pig", name: "Nutmeg", line: "Shy at first, then a friend for good.", at: [-20, 2.6, 2.4], n: 2, scale: 0.9, tint: 0xd8b592 },
  { id: "pear", hab: "orchard", model: "guinea-pig", name: "Pear", line: "The smallest, and the fastest.", at: [-18.8, -1.8, 0.2], n: 3, scale: 0.78, tint: 0xf2e6d2 },
  { id: "poppy", hab: "burrow", model: "beagle", name: "Poppy", line: "Nose down, tail up, following a story only she can smell.", at: [3.6, -8, 0.4], n: 1 },
  { id: "scout", hab: "burrow", model: "beagle", name: "Scout", line: "Greets everyone, then checks every corner.", at: [6.6, -9.2, 5.6], n: 2, scale: 0.9, tint: 0xf3e3d0 },
  { id: "juniper", hab: "burrow", model: "beagle", name: "Juniper", line: "Gentle, and never far from the pergola.", at: [4.2, -11, 0.2], n: 3, scale: 1.06, tint: 0xe2cfba },
  { id: "fern", hab: "oak", model: "deer", name: "Fern", line: "Quiet and watchful, with the softest step.", at: [0.6, -19.4, 0.3], n: 1 },
  { id: "bramble", hab: "oak", model: "deer", name: "Bramble", line: "Brave enough to come and say hello.", at: [-2.4, -20.6, 1.2], n: 2, scale: 0.84 },
  { id: "rowan", hab: "oak", model: "deer", name: "Rowan", line: "Likes the shade and the tall grass.", at: [2, -22, 5.2], n: 3, scale: 0.92, tint: 0xe8d6c2 },
];
const PATHS = [
  [[-11.2, -9.4], [-9.4, -8.8], [-8.2, -7.6], [-8.6, -6.6], [-6.5, -3.2], [-3, -0.2], [0, 1.5], [4, 0.6], [7.6, -0.5], [9.9, -0.1]],
  [[15.3, 1.4], [18, 2.8], [20.5, 5.2], [22, 8.5]],
  [[0, 1.5], [-0.6, 4.2], [-1.8, 6.4]],                 // to the meadow
  [[0, 1.5], [1.3, 2.6], [2.2, 3.2]],                   // to the duck house
  [[-3, -0.2], [-7.5, 1], [-12.4, 0.6]],                // to the orchard
  [[4, 0.6], [4.3, -1.2], [4.4, -2.5]],                 // to the leafy garden
  [[2.4, -13.6], [1.6, -14.4], [1.0, -15.2]],           // on to the wooded meadow
];
const TERRACE = 5.2;
function natural(x, z) {
  let h = 1.1 + (fbm(x * 0.07 + 3, z * 0.07 + 1) - 0.5) * 1.7;
  h += 4.8 * gauss(x - 2, z + 19, 8.5);          // the oak's hill, back centre
  h += 6.6 * gauss(x - 19.5, z + 14.5, 6.6);     // the rocky height the water comes from
  h += 3.8 * gauss(x + 21, z + 2, 6.5);            // a rise on the left
  h += 2.2 * gauss(x - 23, z - 9, 5);
  h += 1.6 * gauss(x + 12, z - 19, 5);
  { const d = Math.hypot(x + 10, z + 11) + (fbm(x * 0.22 + 7, z * 0.22, 2) - 0.5) * 1.6, ax = x + 8.6, az = z + 6.6, k = clamp((ax * 3.2 + az * 5.2) / 37.28, 0, 1), ramp = 1 - smooth(1.3, 3.2, Math.hypot(ax - 3.2 * k, az - 5.2 * k));   // ramp: near the path's way down, the bank eases out into a slope for steps
    h = mix(h, TERRACE, 1 - smooth(mix(7.5, 4.4, ramp), mix(10, 11, ramp), d)); }   // the cottage's terrace: a raised lawn with a firm bank
  for (const b of LAND) { const m = 1 - smooth(b.r * 0.78, b.r + 4.2, Math.hypot(x - b.x, z - b.z)); if (m > 0) h = mix(h, b.base + (fbm(x * 0.2, z * 0.2, 2) - 0.5) * 0.3, m * 0.9); }   // each habitat's terrace
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
  let ch = 0; { const s = outS(x, z); if (s > POND.r - 1.2) { const off = outOff(x, z); if (off < 2.6) { ch = 1 - smooth(1.0, 2.6, off); h = mix(h, Math.min(h, POND.L - 0.32), ch); } } }   // the way out of the pond
  const rn = Math.hypot(x, z) / edgeR(Math.atan2(z, x));
  return h - smooth(0.92, 1, rn) * 1.1 * (1 - ch);   // the turf rounds off at the edge, except where the water runs over it
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
  const s = outS(x, z); if (s > 0 && s < OUT.len + 2 && outOff(x, z) < 1.4 + margin) return true;
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
/* ---------- The mass under the garden ----------
   Not a bowl: a deep body of earth and stone, broad under the turf and tapering unevenly to a
   point that sits off centre (TIP), so every side has its own outline. It is one continuous
   surface, a ring of points per level whose radius is worked out from a few big forms:
   SHELVES (a mass that juts out with a flat mossy top and fades back into the cliff below it),
   DENTS (recesses), the cove's floor (the basin the waterfall lands on) and one HOLLOW with a
   rock lip round its mouth. Nothing is stuck on: ledges and hollows are the same skin.
   Everything comes from fixed numbers and the same noise, so it is the same island every time. */
const DEEP = 36, TIP = [4.5, 6.5], BASIN_U = 0.25;
const PAL2 = { soil: C(0x8d6346), soilDark: C(0x5f4330), soilLight: C(0xb3855f) };
const SHELVES = [   // th, u (depth, 0 turf to 1 tip), how far out, half-width in radians, how far down it fades
  { th: 1.0, u: BASIN_U, out: 2.4, w: 0.34, fade: 0.2 },      // the basin's own lip, on the cove's floor
  { th: 1.9, u: 0.39, out: 6.5, w: 0.32, fade: 0.26 },        // the porch of the hollow
  { th: 1.52, u: 0.6, out: 5.5, w: 0.38, fade: 0.22 },        // low, front and centre
  { th: 0.16, u: 0.44, out: 5.5, w: 0.32, fade: 0.25 },
  { th: -1.0, u: 0.3, out: 5, w: 0.3, fade: 0.25 },
  { th: -2.3, u: 0.5, out: 6, w: 0.36, fade: 0.22 },
  { th: 3.05, u: 0.42, out: 5, w: 0.3, fade: 0.25 },
];
const DENTS = [[1.5, 0.3, 0.26, 0.13, 3.2], [2.62, 0.5, 0.3, 0.16, 4], [-0.4, 0.32, 0.3, 0.15, 3.5], [-1.7, 0.56, 0.34, 0.16, 4], [0.62, 0.62, 0.3, 0.14, 3], [-2.9, 0.26, 0.26, 0.12, 3]];   // th, u, half-width, half-height, depth
const HOLLOW = { th: 1.9, u: 0.3, w: 0.15, hu: 0.11, deep: 7.5 };
const hollowAt = (th, u) => { const a = turn(th, HOLLOW.th) / HOLLOW.w, b = u < HOLLOW.u ? (HOLLOW.u - u) / HOLLOW.hu : 0; return u > SHELVES[1].u ? 9 : a * a + b * b; };   // under 1: inside the mouth (an arch: round above, flat on the porch)
function massAt(th, u) {
  const ct = Math.cos(th), st = Math.sin(th), eTop = edgeR(th), cove = coveAt(th);
  const eP = (eTop - COVE.r * cove) / Math.max(1e-3, 1 - cove), wide = mix(cove > 0.98 ? edge0(th) : eP, edge0(th), smooth(0.05, 0.45, u));   // the prows fade with depth
  const e = u < BASIN_U ? mix(wide, COVE.r, cove) : wide;                                           // the cove ends at the basin
  const taper = u < 0.1 ? 1 : 1 - 0.88 * Math.pow((u - 0.1) / 0.9, 0.95);
  const lobe = 1 + mix(0.04, 0.44, smooth(0.08, 0.85, u)) * (fbm(ct * 1.15 + u * 2 + 11, st * 1.15 + u * 2 + 4, 3) - 0.5) * 2;
  let r = e * taper * lobe;
  { const q = fbm(ct * 6 + u * 9 + 3, st * 6 + u * 7, 3) * 4.4, f = q - Math.floor(q); r += ((Math.floor(q) + smooth(0.34, 0.66, f)) / 4.4 - 0.5) * (3.4 + 2.6 * smooth(0.2, 0.8, u)) * smooth(0.03, 0.12, u); }   // blocks of rock: flat faces with steps between
  { const q = fbm(ct * 13 + u * 17 + 8, st * 13 + u * 15 + 2, 2) * 3, f = q - Math.floor(q); r += ((Math.floor(q) + smooth(0.36, 0.64, f)) / 3 - 0.5) * 1.5 * smooth(0.05, 0.16, u); }   // and smaller steps across them
  r += 0.5 * Math.sin(Math.min(1, u / 0.05) * Math.PI) - 0.7 * smooth(0.04, 0.09, u) * (1 - smooth(0.2, 0.4, u));   // turf hangs over the soil under it
  for (const s of SHELVES) if (u >= s.u) { const a = Math.abs(turn(th, s.th)); if (a < s.w) r += s.out * (1 - smooth(s.w * 0.5, s.w, a)) * (1 - smooth(0, s.fade, u - s.u)) * (0.8 + 0.4 * fbm(ct * 4 + 1, st * 4 + s.u * 9, 2)); }
  for (const [dt, du, w, hu, deep] of DENTS) { const a = turn(th, dt) / w, b = (u - du) / hu, k = a * a + b * b; if (k < 1) r -= deep * (1 - k) * (1 - k); }
  const k = hollowAt(th, u); if (k < 1) r -= HOLLOW.deep * Math.sqrt(1 - k * k); else if (k < 2.2) r += 0.9 * Math.exp(-Math.pow((Math.sqrt(k) - 1.16) / 0.16, 2));   // the hollow, and the lip of rock round it
  r = Math.max(0.5, r);
  const yTop = height(ct * eTop, st * eTop), dv = 1 + 0.22 * (fbm(ct * 1.7 + 2, st * 1.7 + 8, 2) - 0.5) * 2 * smooth(0.3, 1, u);
  const k0 = smooth(0, 0.03, u), ax = Math.pow(u, 1.3); r = mix(eTop, r, k0);
  return [TIP[0] * ax + ct * r, yTop - u * (yTop + DEEP) * dv, TIP[1] * ax + st * r];
}
function mass(low) {
  const SEGS = low ? 256 : 320, ROWS = low ? 46 : 60, N = (ROWS + 1) * SEGS, pos = new Float32Array(N * 3 + 3), col = new Float32Array(N * 3 + 3), idx = [], c = new THREE.Color();
  const uOf = (i) => Math.pow(i / ROWS, 1.12), rad = new Float32Array(N);
  for (let i = 0; i <= ROWS; i++) for (let j = 0; j < SEGS; j++) { const u = uOf(i), p = massAt((j / SEGS) * Math.PI * 2, u), n = i * SEGS + j; pos.set(p, n * 3); rad[n] = Math.hypot(p[0] - TIP[0] * Math.pow(u, 1.3), p[2] - TIP[1] * Math.pow(u, 1.3)); }
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < SEGS; j++) { const a = i * SEGS + j, b = i * SEGS + ((j + 1) % SEGS), d = a + SEGS, e = b + SEGS; idx.push(a, b, d, b, e, d); }
  { let y = 0; for (let j = 0; j < SEGS; j++) y = Math.min(y, pos[(ROWS * SEGS + j) * 3 + 1]); pos.set([TIP[0], y - 1.5, TIP[1]], N * 3); for (let j = 0; j < SEGS; j++) idx.push(ROWS * SEGS + j, ROWS * SEGS + ((j + 1) % SEGS), N); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nor = g.attributes.normal.array, glow = C(0xffc56a), dark = C(0x3d2a20), R = (i, j) => rad[clamp(i, 0, ROWS) * SEGS + ((j + SEGS) % SEGS)];
  for (let i = 0; i <= ROWS; i++) for (let j = 0; j < SEGS; j++) {
    const n = i * SEGS + j, u = uOf(i), th = (j / SEGS) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th), ny = nor[n * 3 + 1];
    const band = fbm(th * 5, u * 14, 3), rocky = smooth(0.46, 0.6, fbm(ct * 6 + u * 9 + 3, st * 6 + u * 7, 3)) * smooth(0.05, 0.16, u);   // the blocks that stand proud are stone, the rest soil
    c.copy(PAL2.soil).lerp(PAL2.soilLight, smooth(0.35, 0.7, band) * (1 - smooth(0.1, 0.5, u) * 0.6)).lerp(PAL.stone, rocky * 0.85).lerp(PAL.stoneDark, rocky * smooth(0.5, 0.75, band) * 0.6);
    c.lerp(PAL2.soilDark, smooth(0.2, 0.95, u) * 0.72);
    const up = smooth(0.68, 0.93, ny) * mix(0.25, 1, 1 - smooth(0.02, 0.22, u)) * (0.45 + 0.55 * smooth(0.4, 0.68, fbm(ct * 7 + 5, st * 7 + u * 16, 2)));   // moss gathers under the turf and on what lies flat, not over the whole cliff
    c.lerp(PAL.moss, up * 0.6).lerp(PAL2.soilDark, up * 0.18);
    if (u < 0.016) c.lerp(PAL.grassShade, 1 - u / 0.016);
    const cav = (R(i, j - 3) + R(i, j + 3) + R(i - 2, j) + R(i + 2, j)) / 4 - rad[n]; c.multiplyScalar(1 - clamp(cav * 0.16, -0.12, 0.5));   // darker in the folds, paler on the edges
    if (ny < -0.2) c.multiplyScalar(1 + ny * 0.22);
    const k = hollowAt(th, u); if (k < 1.1) { const inn = 1 - smooth(0.55, 1.1, k); c.lerp(dark, inn * 0.82); c.lerp(glow, inn * 0.5 * smooth(HOLLOW.u - 0.02, SHELVES[1].u, u) * (1 - smooth(0.3, 0.9, Math.abs(turn(th, HOLLOW.th)) / HOLLOW.w))); }   // the mushrooms' light on the floor and back wall
    col.set([c.r, c.g, c.b], n * 3);
  }
  col.set([PAL.earthDark.r * 0.7, PAL.earthDark.g * 0.7, PAL.earthDark.b * 0.7], N * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: 0.2, flatShading: true }));
  /* A point on the skin and the way out of it there, for whatever grows on the mass: surf(th, u) */
  const surf = (th, u) => {
    const fi = clamp(Math.pow(clamp(u, 0, 1), 1 / 1.12) * ROWS, 0, ROWS - 1e-4), i = Math.floor(fi), a = fi - i, fj = ((th / (Math.PI * 2)) % 1 + 1) % 1 * SEGS, j = Math.floor(fj) % SEGS, b = fj - Math.floor(fj), j2 = (j + 1) % SEGS;
    const at = (arr, k) => mix(mix(arr[(i * SEGS + j) * 3 + k], arr[(i * SEGS + j2) * 3 + k], b), mix(arr[((i + 1) * SEGS + j) * 3 + k], arr[((i + 1) * SEGS + j2) * 3 + k], b), a);
    return { x: at(pos, 0), y: at(pos, 1), z: at(pos, 2), nx: at(nor, 0), ny: at(nor, 1), nz: at(nor, 2) };
  };
  /* a point on the flat top of whatever juts out at depth u: f = 0 at the wall behind it, 1 at its front edge */
  const ledge = (th, u, f) => { const i = Math.ceil(Math.pow(u, 1 / 1.12) * ROWS - 1e-6); return surf(th, mix(uOf(i - 1), uOf(i), f)); };
  return { mesh, surf, ledge, tip: [pos[N * 3], pos[N * 3 + 1], pos[N * 3 + 2]] };
}
/* A limb: a tube along `pts` whose radius follows `rad` (one per point), added to `out`. Few
   sides, not quite round, pale on top and dark underneath in its own vertices, so trunk and
   roots read as round and solid at any size. */
function limb(out, pts, rad, sides, light, dark, seed = 0) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), n = Math.max(2, (pts.length - 1) * 2), base = out.pos.length / 3;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), prev = new THREE.Vector3(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const t = i / n; curve.getPoint(t, P); curve.getTangent(t, T);
    if (i === 0) { N.set(0, 1, 0); if (Math.abs(T.y) > 0.9) N.set(1, 0, 0); N.cross(T).normalize(); } else { q.setFromUnitVectors(prev, T); N.applyQuaternion(q).normalize(); }
    prev.copy(T); B.crossVectors(T, N).normalize();
    const f = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = mix(rad[k], rad[k + 1], f - k);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * 6.2832, ca = Math.cos(a), sa = Math.sin(a), nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa, rr = r * (1 + 0.14 * Math.sin(a * 2 + t * 7 + seed));
      out.pos.push(P.x + nx * rr, P.y + ny * rr, P.z + nz * rr); out.nor.push(nx, ny, nz);
      c.copy(dark).lerp(light, clamp(0.52 + ny * 0.55 + (h2(i * 0.37 + seed, s * 1.7) - 0.5) * 0.3, 0, 1)); out.col.push(c.r, c.g, c.b);
    }
    if (i < n) for (let s = 0; s < sides; s++) { const a = base + i * sides + s, b = base + i * sides + ((s + 1) % sides); out.idx.push(a, b, a + sides, b, b + sides, a + sides); }
  }
}
const limbs = () => ({ pos: [], nor: [], col: [], idx: [] });
const limbMesh = (o, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(o.nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(o.col, 3)); g.setIndex(o.idx); return new THREE.Mesh(g, mat); };
/* A root on the mass, from depth u0 to u1 starting at angle th. It wanders (drift is where it
   ends up, wig the wobble on the way), tapers from r0 to r1, lies half sunk in the skin, can
   start buried (it came through the earth), dive under and come out again, end hanging free,
   and throws off thinner roots of its own (kids). `lead` are points before it reaches the cliff. */
function root(out, surf, o, R, lead = [], leadRad = []) {
  const pts = [...lead], rad = [...leadRad], n = Math.max(4, Math.round((o.u1 - o.u0) * DEEP / 1.6)), at = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, u = mix(o.u0, o.u1, s), th = o.th + o.drift * s + o.wig * (vnoise(s * 3.3 + o.seed * 7.13, o.seed * 1.7) - 0.5) * 2 * Math.sin(Math.min(1, s * 3) * 1.571), r = mix(o.r0, o.r1, Math.pow(s, 0.8)), p = surf(th, u);
    const sink = (o.bury ? (1 - smooth(0, o.bury, s)) * r * 2.6 : 0) + (o.dive && s > o.dive[0] && s < o.dive[1] ? Math.sin(((s - o.dive[0]) / (o.dive[1] - o.dive[0])) * Math.PI) * r * 3 : 0), off = r * 0.45 - sink;
    pts.push(new THREE.Vector3(p.x + p.nx * off, p.y + p.ny * off, p.z + p.nz * off)); rad.push(r); at.push([th, u, r]);
  }
  if (o.hang) { const e = pts[pts.length - 1], d = pts[pts.length - 2]; pts.push(new THREE.Vector3(e.x + (e.x - d.x) * 0.3, e.y - o.hang * 0.5, e.z + (e.z - d.z) * 0.3), new THREE.Vector3(e.x + (e.x - d.x) * 0.35 + (R() - 0.5), e.y - o.hang, e.z + (e.z - d.z) * 0.35 + (R() - 0.5))); rad.push(o.r1 * 0.8, 0.03); }
  limb(out, pts, rad, o.r0 > 0.75 ? 7 : o.r0 > 0.4 ? 6 : 5, ROOT_LIGHT, ROOT_DARK, o.seed);
  for (let k = 0; k < (o.kids || 0); k++) {
    const i = Math.round(n * (0.18 + 0.6 * ((k + R()) / o.kids))), [th, u, r] = at[clamp(i, 1, n - 1)], side = (k % 2 ? 1 : -1) * (R() < 0.8 ? 1 : -1), len = (0.12 + R() * 0.2) * (o.r0 > 0.7 ? 1.3 : 1);
    if (r < 0.16 || u > 0.93) continue;
    root(out, surf, { th, u0: u, u1: Math.min(0.99, u + len), r0: r * 0.62, r1: 0.05, drift: side * (0.1 + R() * 0.28) / Math.max(0.35, 1 - u), wig: 0.06 + R() * 0.08, seed: o.seed * 3.1 + k * 17.7 + 1, kids: o.r0 > 0.7 ? 1 : 0, hang: R() < 0.4 ? 1 + R() * 2 : 0 }, R);
  }
}
const ROOT_LIGHT = C(0xdcbd94), ROOT_DARK = C(0x7b573d);
/* A ribbon of falling water along `pts` (each [Vector3, half-width, how solid 0 to 1]), bowed a little so it has body from the side. */
function fallGeo(pts) {
  const pos = [], uv = [], col = [], idx = [], ACROSS = 4, d = new THREE.Vector3(); let len = 0;
  pts.forEach(([p, w, a], i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)][0], o = pts[Math.max(i - 1, 0)][0]; d.subVectors(q, o); if (i) len += p.distanceTo(o);
    const hl = Math.hypot(d.x, d.z) || 1, sx = -d.z / hl, sz = d.x / hl, fx = d.x / hl, fz = d.z / hl;   // across the flow, and the way it is heading
    for (let k = 0; k <= ACROSS; k++) { const t = k / ACROSS * 2 - 1, bow = (1 - t * t) * w * 0.28; pos.push(p.x + sx * w * t + fx * bow, p.y, p.z + sz * w * t + fz * bow); uv.push(k / ACROSS, -len * 0.11); col.push(1, 1, 1, a * (1 - 0.35 * t * t)); }
    if (i < pts.length - 1) for (let k = 0; k < ACROSS; k++) { const a0 = i * (ACROSS + 1) + k; idx.push(a0, a0 + 1, a0 + ACROSS + 1, a0 + 1, a0 + ACROSS + 2, a0 + ACROSS + 1); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
}
function mistTex() { return canvasTex(64, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 1, n / 2, n / 2, n / 2); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.45, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); }); }
/* The blossom tree's crown: clusters of soft lumps in blush, a few sage ones at the fringe. World units, about the tree's foot. */
const HERO_CROWN = [[-4.6, 10.9, 1.0, 1], [0.2, 12.6, -1.2, 1.1], [3.3, 10.7, 1.5, 0.95], [-1.6, 11.4, 2.0, 1]];   // its clusters: x, y, z from the tree's foot, and size
function heroCrown() {
  const r = rng(77), parts = [], tint = [];
  const lump = (x, y, z, s, green) => { const g = mergeVertices(new THREE.IcosahedronGeometry(s, 2)); g.scale(1, 0.8, 1); g.translate(x, y, z); parts.push(g); tint.push([g.attributes.position.count, green]); };
  for (const [cx, cy, cz, k] of HERO_CROWN) {
    lump(cx, cy + 0.5, cz, 2.5 * k); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28 + r(), d = (1.5 + r() * 1.2) * k; lump(cx + Math.cos(a) * d, cy + (r() - 0.55) * 1.6, cz + Math.sin(a) * d * 0.9, (1.5 + r() * 0.8) * k); }
    for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = 2.9 * k; lump(cx + Math.cos(a) * d, cy - 1.1 - r() * 0.5, cz + Math.sin(a) * d, 0.75 + r() * 0.35, true); }
  }
  const g = mergeGeometries(parts), p = g.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3(), lo = C(0xe58cab), mid = C(0xf7b6cb), hi = C(0xffe3ec), gl = C(0x7fa860), gh = C(0xb5d68a);
  let i = 0; for (const [count, green] of tint) for (let k = 0; k < count; k++, i++) {
    v.fromBufferAttribute(p, i); const n = fbm(v.x * 0.9, v.y * 0.9 + v.z * 0.9, 3), n2 = fbm(v.x * 2.6 + 3, v.z * 2.6 + v.y * 2.6, 2), up = smooth(9.2, 13.6, v.y + (n - 0.5) * 2);
    if (green) c.copy(gl).lerp(gh, up + n2 * 0.5); else { c.copy(lo).lerp(mid, smooth(0, 0.55, up)).lerp(hi, smooth(0.5, 1, up) * (0.55 + n2 * 0.6)); c.lerp(lo, smooth(0.55, 0.35, n) * 0.3); }
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
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
  const stem = new THREE.CylinderGeometry(0.018, 0.024, 0.62, 3, 1, true); stem.translate(0, 0.31, 0); parts.push(paint(stem, 0x6ea24e));   // a thousand flowers have to stay cheap: about 70 triangles each
  const leaf = new THREE.CircleGeometry(0.09, 4); leaf.rotateX(-Math.PI / 2 + 0.5); leaf.scale(1, 1, 0.5); leaf.translate(0.09, 0.2, 0); parts.push(paint(leaf, 0x7fb256));
  for (let i = 0; i < petals; i++) { const g = new THREE.CircleGeometry(0.1 * size, 5); g.rotateX(-Math.PI / 2); g.scale(1, 1, 0.62); g.translate(0.105 * size, 0, 0); g.rotateZ(cup); g.rotateY((i / petals) * Math.PI * 2); g.translate(0, 0.63, 0); parts.push(paint(g, petal)); }
  const mid = new THREE.SphereGeometry(0.058 * size, 5, 3); mid.scale(1, 0.7, 1); mid.translate(0, 0.65, 0); parts.push(paint(mid, centre));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
function spikeGeo(hex, tip) {   // lavender and foxglove: a stem beaded with small blooms
  const parts = [], paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
  const stem = new THREE.CylinderGeometry(0.016, 0.022, 0.6, 3, 1, true); stem.translate(0, 0.3, 0); parts.push(paint(stem, C(0x6ea24e)));
  for (let i = 0; i < 7; i++) { const t = i / 6, g = new THREE.OctahedronGeometry(0.075 * (1 - t * 0.55), 0); g.translate(Math.cos(i * 2.4) * 0.045 * (1 - t), 0.5 + t * 0.52, Math.sin(i * 2.4) * 0.045 * (1 - t)); parts.push(paint(g, C(hex).lerp(C(tip), t))); }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
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
  const r = rng(seed), parts = [], oak = kind === "oak" || kind === "willow";
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
  if (kind === "willow") for (let i = 0; i < 15; i++) {   // hanging curtains of leaves
    const a = (i / 15) * 6.28 + r() * 0.3, d = 0.3 + r() * 0.09;
    for (let j = 0; j < 4; j++) { const g = mergeVertices(new THREE.IcosahedronGeometry(0.075, 1)); g.scale(0.85, 1.9, 0.85); g.translate(Math.cos(a) * d + lean, trunkH + 0.26 - j * 0.125 - r() * 0.03, Math.sin(a) * d); parts.push(g); }
  }
  const crown = mergeGeometries(parts), p = crown.attributes.position, col = [], c = new THREE.Color(), v = new THREE.Vector3(), mid = trunkH + 0.24;
  const tone = { oak: [0x5f9a45, 0x8cc25a, 0xc3e07a], willow: [0x86b455, 0xb0d472, 0xe0efa4], apple: [0x5c9848, 0x84bb5a, 0xb6da7a], blossom: [0xe58cab, 0xf7b6cb, 0xffe3ec] }[kind];
  const lo = C(tone[0]), midC = C(tone[1]), hi = C(tone[2]);
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
/* Small painted solids for the shelters. Colours live in the vertices, so one material does them all. */
const tinted = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); const c = C(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
const turned = (g, x, y, z, rx, ry, rz) => { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const box = (w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) => tinted(turned(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), hex);
const cyl = (r1, r2, h, x, y, z, hex, rx = 0, ry = 0, rz = 0) => tinted(turned(new THREE.CylinderGeometry(r1, r2, h, 9), x, y, z, rx, ry, rz), hex);
const ball = (r, x, y, z, hex, sx = 1, sy = 1, sz = 1) => { const g = new THREE.IcosahedronGeometry(r, r < 0.25 ? 1 : 2); g.scale(sx, sy, sz); g.translate(x, y, z); return tinted(g, hex); };   // small ones (flowers, leaves) need fewer faces
const WOOD = 0xc8935e, WOOD2 = 0xa9774c, CREAM = 0xf3e7d3, ROSE = 0xd89aa4, STRAW = 0xe3cc82, LEAF = 0x7fb256, BARK = 0x8a6248;
/* Each shelter faces +Z, stands on y = 0, and comes in two parts: what is there from the
   start, and what is added once half the habitat's topic is learned. No doors, no fences. */
const SHELTERS = {
  meadow(r) {   // a burrow under a grassy mound; later a timber doorway and flowers on top
    const base = [ball(1.5, 0, 0.1, 0, 0x8cbf5f, 1, 0.66, 0.95), ball(0.78, 0, 0.3, 0.98, 0x9a6f52, 1, 0.95, 0.5), ball(0.56, 0, 0.34, 1.14, 0x4a3528, 1, 1, 0.5)];
    const extra = [cyl(0.07, 0.08, 0.95, -0.62, 0.45, 1.32, WOOD), cyl(0.07, 0.08, 0.95, 0.62, 0.45, 1.32, WOOD), box(1.5, 0.11, 0.16, 0, 0.95, 1.32, WOOD2), ball(0.3, 0.9, 0.2, 1.3, 0xb9aa98, 1, 0.7, 1)];
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = r() * 0.95; extra.push(ball(0.08 + r() * 0.04, Math.cos(a) * d, 1.06 - d * d * 0.42, Math.sin(a) * d * 0.9 - 0.1, i % 3 ? 0xf7a8c0 : 0xfffaf2)); }
    return { base, extra, scale: 1.6 };
  },
  pond(r) {   // a straw nest on the bank; later a little cream house with a rose roof and a ramp
    const base = [cyl(0.95, 1.05, 0.2, 0, 0.1, 0, STRAW), cyl(0.7, 0.8, 0.16, 0, 0.24, 0, 0xcdb467)];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; base.push(cyl(0.035, 0.05, 0.5, Math.cos(a) * 0.98, 0.2, Math.sin(a) * 0.98, 0xbfa55a, 0.5 * Math.sin(a), 0, -0.5 * Math.cos(a))); }
    const extra = [box(1.25, 0.85, 1.1, 0, 0.74, -0.1, CREAM), box(0.95, 0.07, 1.4, -0.36, 1.36, -0.1, ROSE, 0, 0, 0.72), box(0.95, 0.07, 1.4, 0.36, 1.36, -0.1, ROSE, 0, 0, -0.72), ball(0.3, 0, 0.66, 0.46, 0x4a3528, 1, 1.15, 0.3), box(0.6, 0.06, 1.3, 0, 0.16, 1.15, WOOD, 0.22), box(0.1, 0.5, 0.1, -0.5, 1.2, -0.1, CREAM), box(0.1, 0.5, 0.1, 0.5, 1.2, -0.1, CREAM)];
    return { base, extra, scale: 1.5 };
  },
  orchard(r) {   // a timber hide with hay inside; later a log to run through and more hay
    const base = [box(1.9, 0.09, 1.7, -0.56, 0.72, 0, WOOD, 0, 0, 0.9), box(1.9, 0.09, 1.7, 0.56, 0.72, 0, WOOD, 0, 0, -0.9), cyl(0.07, 0.07, 1.8, 0, 1.44, 0, WOOD2, Math.PI / 2), ball(0.6, 0, 0.12, -0.25, STRAW, 1.2, 0.5, 1.1)];
    const extra = [cyl(0.5, 0.5, 1.5, 1.75, 0.5, 0.25, BARK, Math.PI / 2, 0.5), ball(0.36, 1.4, 0.5, 0.88, 0x3e2c22, 1, 1, 0.3), ball(0.55, -1.55, 0.14, 0.5, STRAW, 1.1, 0.6, 1), ball(0.3, -1.25, 0.42, 0.42, 0xedd993, 1, 0.7, 1)];
    for (let i = 0; i < 4; i++) extra.push(ball(0.13, -0.5 + i * 0.33, 1.52, (r() - 0.5) * 1.2, i % 2 ? 0xf7a8c0 : 0xfffaf2));
    return { base, extra, scale: 1.25 };
  },
  burrow(r) {   // a low deck with a big cushion; later a pergola over it with climbing flowers
    const base = [box(2.6, 0.14, 2.1, 0, 0.07, 0, WOOD), ball(0.95, 0, 0.3, 0, ROSE, 1, 0.3, 0.82), ball(0.75, 0, 0.36, 0, 0xe6b3bb, 1, 0.22, 0.8)];
    const extra = [];
    for (const [x, z] of [[-1.2, -0.95], [1.2, -0.95], [-1.2, 0.95], [1.2, 0.95]]) extra.push(cyl(0.075, 0.09, 2.1, x, 1.12, z, CREAM));
    for (const z of [-0.95, 0.95]) extra.push(box(2.9, 0.12, 0.14, 0, 2.2, z, CREAM));
    for (let i = 0; i < 6; i++) extra.push(box(0.1, 0.09, 2.4, -1.25 + i * 0.5, 2.3, 0, CREAM));
    for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 2.8, z = r() < 0.6 ? (r() < 0.5 ? -0.95 : 0.95) + (r() - 0.5) * 0.25 : (r() - 0.5) * 2; extra.push(ball(0.11 + r() * 0.07, x, 2.36 + r() * 0.1, z, i % 4 === 0 ? LEAF : i % 4 === 1 ? 0xfffaf2 : 0xf7a8c0, 1, 0.8, 1)); }
    for (let i = 0; i < 7; i++) extra.push(ball(0.12, -1.2 + (r() - 0.5) * 0.12, 0.3 + i * 0.28, -0.95 + (r() - 0.5) * 0.12, i % 3 ? LEAF : 0xf7a8c0, 1, 0.8, 1));
    return { base, extra, scale: 1.75 };
  },
  oak(r) {   // a lean-to of branches against a pole; later a thatch of leaves and a bed of bracken
    const base = [cyl(0.08, 0.1, 1.7, -1.3, 0.85, -0.5, BARK), cyl(0.08, 0.1, 1.7, 1.3, 0.85, -0.5, BARK), cyl(0.065, 0.065, 3, 0, 1.66, -0.5, BARK, 0, 0, Math.PI / 2)];
    for (let i = 0; i < 9; i++) base.push(cyl(0.04, 0.055, 2.5, -1.25 + i * 0.31 + (r() - 0.5) * 0.08, 0.86, -1.26, i % 2 ? BARK : WOOD2, -0.72 + (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.1));
    const extra = [ball(1.05, 0, 0.06, 0.1, 0xc9a15a, 1.15, 0.2, 0.9)];
    for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 2.7, t = r(); extra.push(ball(0.3 + r() * 0.14, x, 1.72 - t * 1.45, -0.56 - t * 1.45, r() < 0.5 ? 0x6f9f52 : 0x8cbf5f, 1, 0.35, 1)); }
    return { base, extra, scale: 1.45 };
  },
};
function instanced(geo, mat, list, shadow = false) {   // list: [{x,y,z,ry,s,sy?,tilt?,color?}]
  const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach((it, i) => { o.position.set(it.x, it.y, it.z); o.rotation.set(it.tilt || 0, it.ry || 0, it.tz || 0); o.scale.set(it.s, it.s * (it.sy || 1), it.s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (it.color) m.setColorAt(i, it.color); });
  m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; return m;
}
/* One breeze for every plant: a slow gust that travels across the island, so neighbours lean
   together and far plants lean a moment later. k is how far the top moves; a tree only moves its crown. */
function sway(mat, wind, k, tree) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;").replace("#include <begin_vertex>", `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  vec3 wo = instanceMatrix[3].xyz;
  #else
  vec3 wo = modelMatrix[3].xyz;
  #endif
  float wh = ${tree === "hang" ? "max(0.0, -transformed.y)" : "max(0.0, transformed.y - " + (tree === true ? 0.5 : +tree || 0).toFixed(2) + ")"}, wp = wo.x * 0.17 + wo.z * 0.12;
  float wg = sin(uWind * 1.1 - wp) * 0.62 + sin(uWind * 2.6 - wp * 2.3 + transformed.y * 3.0) * 0.38;
  transformed.x += wg * wh * wh * ${k.toFixed(4)}; transformed.z += wg * wh * wh * ${(k * 0.6).toFixed(4)};
}`);
  };
  mat.customProgramCacheKey = () => "cfb-sway" + k + (tree ? "t" : "");
  return mat;
}

/* ---------- The scene ---------- */
export async function mount(canvas, opts = {}) {
  const reduced = !!opts.reduced, low = !!opts.low;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true, powerPreference: "high-performance" });
  let ratio = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2); renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;   // drawn once, and again when the world changes (setState): nothing that casts a shadow moves
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xfbe9e2, 170, 560);
  scene.environment = skyEnv(renderer);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.5, 500);

  scene.add(new THREE.HemisphereLight(PAL.sky, PAL.ground, 0.62));
  const sun = new THREE.DirectionalLight(PAL.sun, 3.2); sun.position.set(-30, 44, 26); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 5, far: 130 }); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffd9e0, 0.35); fill.position.set(24, 14, 20); scene.add(fill);   // a blush bounce from the right

  const mottle = mottleTex(), world = new THREE.Group(); scene.add(world);
  const land = terrain(mottle); world.add(land);
  const body = mass(low), side = body.mesh, surf = body.surf; side.castShadow = side.receiveShadow = true; world.add(side);
  const r = rng(2026), Y = height, wind = { value: 0 };
  /* Everything an animal must walk round: { x, z, r, what } */
  const obstacles = [];
  const nearShelter = (x, z, gap = 0.4) => HABS.some((h) => Math.hypot(x - h.sh[0], z - h.sh[1]) < h.sh[2] + gap);
  const inHabitat = (x, z, inset = 0) => LAND.some((h) => Math.hypot(x - h.x, z - h.z) < h.r - inset);
  const homeOf = (x, z) => { let best = 0, bd = 1e9; HABS.forEach((h, i) => { const d = Math.hypot(x - h.x, z - h.z) - h.r; if (d < bd) { bd = d; best = i; } }); return best; };
  const inside = (x, z, gap = 1.6) => Math.hypot(x, z) < edgeR(Math.atan2(z, x)) - gap;

  /* rocks: round the pools and falls, either side of the pond's way out, the big mossy one by the meadow, and strays */
  const rocks = [[], [], []], rock = (x, z, s, sink = 0.3, sy = 1) => { if (nearShelter(x, z, s)) return; rocks[Math.floor(r() * 3)].push({ x, y: Y(x, z) - s * sink + 0.05, z, ry: r() * 6.28, s, sy }); if (s > 0.4) obstacles.push({ x, z, r: s * 0.85, what: "a rock" }); };
  for (const p of POOLS) { const n = Math.round(p.r * 3.4); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r() * 0.4, d = p.r + 0.5 + r() * 0.8; if (p === POND && (r() < 0.45 || outOff(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d) < 2.3 && outS(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d) > 0)) continue; rock(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0.45 + r() * 0.75); } }
  for (const run of RUNS) for (let s = run.A.r - 0.2; s < run.len - run.B.r + 0.6; s += 0.8) for (const sd of [-1, 1]) { const o = sd * (1.45 + r() * 0.5); rock(run.A.x + run.dx * s + run.dz * o, run.A.z + run.dz * s - run.dx * o, 0.55 + r() * 0.7, 0.25, 1.1); }
  for (let i = 0; i < 16; i++) { const a = -0.9 + r() * 1.5, d = 3 + r() * 6; rock(19.5 + Math.cos(a) * d * 0.9, -14.5 + Math.sin(a) * d, 0.9 + r() * 1.5, 0.35, 1.15); }   // the height behind the falls
  for (const sd of [-1, 1]) rock(OUT.ex - OUT.dx * 1.5 + OUT.dz * sd * 2.5, OUT.ez - OUT.dz * 1.5 - OUT.dx * sd * 2.5, sd > 0 ? 1.5 : 1.25, 0.4, 1.1);   // the gateposts of the waterfall
  rock(-11.9, 10.9, 2.2, 0.42, 0.95); rock(-12.9, 8.6, 1.0); rock(-10.6, 14.6, 0.7);                 // the meadow's mossy rock
  for (let i = 0; i < 9; i++) { const a = -1.1 + (i / 8) * 4.2, d = 7.4 + r() * 1.1, x = -10 + Math.cos(a) * d, z = -11.2 + Math.sin(a) * d; if (distToPaths(x, z) > 1.5) rock(x, z, 0.5 + r() * 0.7, 0.55, 0.8); }   // the terrace's exposed edge
  rock(-14.4, 5.2, 1.3, 0.4); rock(-13.2, -3.6, 1.0); rock(9.9, -11.6, 1.2, 0.4); rock(-0.9, -4.6, 0.8); rock(5.9, -18.6, 1.5, 0.4); rock(-5.6, -17.4, 1.1); rock(6.2, -21.5, 0.8);   // one or two at each habitat's edge
  for (let i = 0; i < 46; i++) { const a = r() * 6.28, d = 6 + r() * 22, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!wet(x, z, 1.5) && distToPaths(x, z) > 1.6 && !inHabitat(x, z, -0.8) && inside(x, z)) rock(x, z, 0.25 + r() * 0.5); }
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 });
  rocks.forEach((list, i) => world.add(instanced(rockGeo(3 + i * 7), rockMat, list, true)));
  /* stepping stones along the paths */
  const stones = []; const stoneGeo = rockGeo(77, 0);
  for (const p of PATHS) { const curve = new THREE.CatmullRomCurve3(p.map(([x, z]) => new THREE.Vector3(x, 0, z))), n = Math.round(curve.getLength() / 1.02); for (let i = 0; i <= n; i++) { const q = curve.getPointAt(i / n), x = q.x + (r() - 0.5) * 0.3, z = q.z + (r() - 0.5) * 0.3; stones.push({ x, y: Y(x, z) + 0.02, z, ry: r() * 6.28, s: 0.5 + r() * 0.16, sy: 0.16 }); } }
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xf3e7d3, vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 });
  world.add(instanced(stoneGeo, pathMat, stones, false));
  /* shallow steps where a path drops down a bank: a slab per step, sunk into the slope */
  { const steps = [], first = PATHS[0], curve = new THREE.CatmullRomCurve3(first.map(([x, z]) => new THREE.Vector3(x, 0, z))), n = Math.round(curve.getLength() / 0.8);
    for (let i = 0; i <= n; i++) { const q = curve.getPointAt(i / n); const t = curve.getTangentAt(i / n); if (i / n > 0.5 || Math.abs(Y(q.x + t.x * 0.5, q.z + t.z * 0.5) - Y(q.x - t.x * 0.5, q.z - t.z * 0.5)) < 0.22) continue; steps.push({ x: q.x, y: Y(q.x, q.z) - 0.1, z: q.z, ry: Math.atan2(t.x, t.z), s: 1 }); }
    const sg = new THREE.BoxGeometry(2.3, 0.3, 0.78); sg.translate(0, 0, 0.1); const sc = new Float32Array(sg.attributes.position.count * 3).fill(1); sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    if (steps.length) world.add(instanced(sg, pathMat, steps, false)); }

  /* water: still pools, a running stream, foam under each fall, and rings that spread and fade */
  const rippleTex = rippleNormalTex(), waterMat = new THREE.MeshStandardMaterial({ color: PAL.water, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.05, normalMap: rippleTex, normalScale: new THREE.Vector2(0.28, 0.28), envMapIntensity: 1.6 });
  for (const p of POOLS) { const g = new THREE.CircleGeometry(p.r + 0.25, 40); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, waterMat); m.position.set(p.x, p.L, p.z); m.receiveShadow = true; world.add(m); }
  const streak = streakTex(); streak.wrapS = streak.wrapT = THREE.RepeatWrapping;
  const fallMat = new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const foam = [];
  for (const run of RUNS) {
    const pos = [], uv = [], idx = [], N = 26, from = run.A.r - 0.6, to = run.len - run.B.r + 0.8;
    for (let i = 0; i <= N; i++) { const s = mix(from, to, i / N), cx = run.A.x + run.dx * s, cz = run.A.z + run.dz * s, w = 0.8 + 0.3 * smooth(run.s0, run.s1, s), y = run.w(s) + 0.05; pos.push(cx + run.dz * w, y, cz - run.dx * w, cx - run.dz * w, y, cz + run.dx * w); uv.push(0, -s * 0.3, 1, -s * 0.3); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    world.add(new THREE.Mesh(g, waterMat)); const top = new THREE.Mesh(g, fallMat); top.position.y = 0.03; world.add(top);
    const fg = new THREE.RingGeometry(0.25, 1.25, 24); fg.rotateX(-Math.PI / 2); const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    f.position.set(run.A.x + run.dx * (run.s1 + 0.35), run.B.L + 0.04, run.A.z + run.dz * (run.s1 + 0.35)); world.add(f); foam.push(f);
  }

  /* the way out: through the pond's bank, over the lip of the cove, down to the basin on the
     cove's floor, across it at a slant, and off its front edge past the tapering base */
  const basin = body.ledge(COVE.th, BASIN_U, 0.4), spill = body.ledge(1.2, BASIN_U, 1.02), mist = [], fallEnd = [], falls = [];
  { const strip = (pts, w, lift) => { const pos = [], uv = [], idx = []; pts.forEach((q, i) => { const o = pts[Math.max(0, i - 1)], n = pts[Math.min(pts.length - 1, i + 1)], dx = n.x - o.x, dz = n.z - o.z, l = Math.hypot(dx, dz) || 1; pos.push(q.x + dz / l * w, q.y + lift, q.z - dx / l * w, q.x - dz / l * w, q.y + lift, q.z + dx / l * w); uv.push(0, -i * 0.3, 1, -i * 0.3); if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const fallBody = new THREE.MeshBasicMaterial({ color: 0x8adbd4, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
    const fallTop = new THREE.MeshBasicMaterial({ map: streak, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const pour = (pts) => { const g = fallGeo(pts), a = new THREE.Mesh(g, fallBody), b = new THREE.Mesh(g, fallTop); a.renderOrder = 1; b.renderOrder = 2; world.add(a, b); falls.push(g); };
    const ch = []; for (let i = 0; i <= 6; i++) { const sN = mix(POND.r - 0.9, OUT.len + 0.1, i / 6); ch.push(new THREE.Vector3(POND.x + OUT.dx * sN, POND.L, POND.z + OUT.dz * sN)); }
    world.add(new THREE.Mesh(strip(ch, 1.25, 0.02), waterMat));
    const lip = new THREE.Vector3(OUT.ex, POND.L, OUT.ez), land = new THREE.Vector3(basin.x, basin.y + 0.25, basin.z), up = [[new THREE.Vector3(lip.x - OUT.dx * 1.2, lip.y + 0.04, lip.z - OUT.dz * 1.2), 1.1, 0.5]];
    for (let i = 0; i <= 9; i++) { const f = i / 9; up.push([new THREE.Vector3(mix(lip.x, land.x, f), lip.y + 0.04 - (lip.y - land.y) * f * f, mix(lip.z, land.z, f)), mix(1.1, 1.5, f), 0.95]); }
    pour(up);
    const pool = new THREE.CircleGeometry(2.7, 24); pool.rotateX(-Math.PI / 2); const pm = new THREE.Mesh(pool, waterMat); pm.position.copy(land); pm.scale.set(1.25, 1, 1); pm.rotation.y = -COVE.th + Math.PI / 2; world.add(pm);
    const fg = new THREE.RingGeometry(0.3, 1.7, 20); fg.rotateX(-Math.PI / 2); const f = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); f.position.set(land.x, land.y + 0.04, land.z); world.add(f); foam.push(f);
    const across = []; for (let i = 0; i <= 4; i++) across.push(new THREE.Vector3(mix(land.x, spill.x, i / 4), mix(land.y, spill.y + 0.2, i / 4), mix(land.z, spill.z, i / 4)));
    world.add(new THREE.Mesh(strip(across, 1.0, 0), waterMat));
    const hd = Math.hypot(spill.x - land.x, spill.z - land.z), fx = (spill.x - land.x) / hd, fz = (spill.z - land.z) / hd, drop = spill.y + DEEP + 6, down = [[new THREE.Vector3(spill.x - fx * 1.2, spill.y + 0.24, spill.z - fz * 1.2), 0.95, 0.5]];
    for (let i = 0; i <= 14; i++) { const t = i / 14, o = 3.4 * Math.pow(t, 0.55); down.push([new THREE.Vector3(spill.x + fx * o, spill.y + 0.2 - drop * Math.pow(t, 1.6), spill.z + fz * o), mix(0.95, 2.0, t), 0.95 * (1 - smooth(0.62, 1, t))]); }
    pour(down); fallEnd.push(down[down.length - 1][0].x, down[down.length - 1][0].y + 3, down[down.length - 1][0].z);
    /* a few rocks round the basin, standing in the ledge it lies on */
    const ring = []; for (const [a, s] of [[0.35, 1.0], [1.3, 0.8], [2.5, 1.1], [-0.6, 0.9], [-1.7, 0.7]]) { const an = COVE.th + a, x = land.x + Math.cos(an) * 3.5, z = land.z + Math.sin(an) * 3.0; ring.push({ x, y: land.y - 0.35 - s * 0.2, z, ry: a * 7, s, sy: 0.9 }); }
    world.add(instanced(rockGeo(31), rockMat, ring, true));
    /* mist where the long fall thins out, and a breath of it over the basin */
    const mt = mistTex(), end = down[down.length - 1][0];
    for (const [dx, dy, dz, sc, op] of [[0, 3, 0, 9, 0.34], [-2.5, 0.5, 1, 8, 0.28], [2.6, 1, -0.5, 7, 0.26], [0.5, -2.5, 1.5, 11, 0.24], [-1, 7, 0.5, 6, 0.2]].slice(0, reduced || low ? 3 : 5)) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, opacity: op, depthWrite: false })); sp.position.set(end.x + dx, end.y + dy, end.z + dz); sp.scale.set(sc, sc * 0.8, 1); sp.renderOrder = 4; world.add(sp); mist.push({ sp, x: sp.position.x, y: sp.position.y, sc, op, ph: dx * 3 + dy }); }
    { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, opacity: 0.22, depthWrite: false })); sp.position.set(land.x, land.y + 1, land.z); sp.scale.set(4.5, 3, 1); sp.renderOrder = 4; world.add(sp); mist.push({ sp, x: land.x, y: land.y + 1, sc: 4.5, op: 0.22, ph: 2 }); }
  }
  const inflow = [POND.x - RUNS[1].dx * (POND.r - 0.6), POND.z - RUNS[1].dz * (POND.r - 0.6)];   // where the stream meets the pond
  const rings = [], ringGeo = new THREE.RingGeometry(0.86, 1, 30); ringGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < (low ? 8 : 14); i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 3; world.add(m); rings.push({ m, age: 9, size: 1 }); }
  function ripple(x, z, size = 1) {   // a ring on whichever pool (x, z) is in
    if (reduced) return; const p = POOLS.find((q) => Math.hypot(x - q.x, z - q.z) < q.r - 0.2), g = rings.find((q) => q.age > 2); if (!p || !g) return;
    g.age = 0; g.size = size; g.m.position.set(x, p.L + 0.03, z); g.m.visible = true;
  }
  /* lily pads and two lilies on the pond; the ducks swim round the lilies */
  const pondAvoid = [[inflow[0], inflow[1], 1.2]];
  { const pads = [], lil = []; const pg = new THREE.CircleGeometry(0.42, 12, 0.35, 5.6); pg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 9; i++) { const a = 0.6 + r() * 3.6, d = 3.2 + r() * 2.6, x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d; pads.push({ x, y: POND.L + 0.025, z, ry: r() * 6.28, s: 0.8 + r() * 0.7 }); if (i % 4 === 1) { lil.push({ x: x + 0.1, y: POND.L - 0.52, z, ry: r() * 6.28, s: 1.5 }); pondAvoid.push([x + 0.1, z, 0.45]); } }
    world.add(instanced(pg, new THREE.MeshStandardMaterial({ color: 0x86bd6a, roughness: 0.7, side: THREE.DoubleSide }), pads));
    world.add(instanced(flowerGeo(0xf7b4c6, 0xf6d86b, 9, 0.75, 1.5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), lil)); }
  HAB.pond.avoid = pondAvoid;

  /* flowers: in drifts, never a carpet. Each habitat keeps its middle clear for its animals and
     has its own drifts round the edge, away from the side the camera comes from. Every flower
     belongs to the nearest habitat and blooms as that habitat's topic is learned. */
  const okGround = (x, z, pathGap = 0.9) => inside(x, z) && !wet(x, z, 0.5) && distToPaths(x, z) > pathGap && slopeAt(x, z) < 0.75 && !inHabitat(x, z, 0.2) && !nearShelter(x, z) && Math.hypot(x + 10, z + 11) > 5.2;
  const drifts = [   // [x, z, radius, how many, kind]
    [-0.6, 14.2, 2.2, 26, "daisy"], [1.6, 17.4, 2.4, 24, "spike"], [-14.5, 9.5, 2.4, 24, "pinkspike"], [3.6, 4.6, 1.6, 16, "cosmos"], [5.8, 16.6, 1.8, 16, "daisy"], [-13.5, -5.4, 2.2, 22, "pinkspike"], [-4, -3.2, 2.0, 20, "cosmos"],
    [-15.6, -14.6, 2.4, 22, "cosmos"], [-3.6, -12.4, 2.0, 18, "cosmos"], [-8, 20, 2.6, 26, "pinkspike"], [-1.5, 22.5, 2.4, 24, "daisy"], [6.5, 23, 2.4, 22, "cosmos"], [8.6, 20.4, 2.0, 18, "spike"], [-17, 14.5, 2.2, 20, "cosmos"], [19, 18.5, 2.0, 18, "daisy"], [-23, 12, 1.8, 14, "daisy"],
    [-5.0, -14.2, 1.4, 14, "pinkspike"], [-14.2, -6.8, 1.4, 14, "daisy"], [-2.6, -5.6, 1.6, 16, "cosmos"], [-8.8, -2.6, 1.4, 14, "daisy"], [22.2, 18.4, 1.5, 14, "cosmos"], [22.6, 16.4, 1.4, 12, "daisy"],   // the terrace's edge and foot, the path down, the blossom tree's foot
    [18.8, 3.6, 2.0, 20, "pinkspike"], [20.8, 12.4, 2.4, 24, "cosmos"], [-9.6, 16.4, 2.2, 22, "daisy"], [22.4, -3.4, 2.2, 18, "spike"], [10.6, -1.8, 1.4, 12, "cosmos"], [-12, -1.6, 1.6, 14, "spike"], [-9, -0.6, 1.6, 14, "daisy"], [12, -17, 2.2, 18, "daisy"], [-12, -21, 2.2, 18, "spike"],
  ];
  const KINDS = ["cosmos", "daisy", "spike", "pinkspike"];
  LAND.forEach((h, hi) => { for (let i = 0; i < 6; i++) { const a = Math.atan2(Math.sin(h.az), Math.cos(h.az)) + 1.15 + (i / 5) * (6.283 - 2.3), d = h.r + 1.3 + (i % 2) * 0.5; drifts.push([h.x + Math.sin(a) * d, h.z + Math.cos(a) * d, 1.7, 22, KINDS[(i + hi) % 4]]); } });
  const kinds = { daisy: [], cosmos: [], cosmos2: [], spike: [], pinkspike: [] }, perches = [];
  for (const [cx, cz, rad, n, kind] of drifts) for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d * 1.25, z = cz + Math.sin(a) * d * 0.85; if (!okGround(x, z)) continue;
    const k = kind === "cosmos" && r() < 0.4 ? "cosmos2" : kind, s = (kind.includes("spike") ? 1.6 : 1.15) + r() * 0.6;
    const it = { x, y: Y(x, z) - 0.03, z, ry: r() * 6.28, s, tilt: (r() - 0.5) * 0.25, tz: (r() - 0.5) * 0.25, u: r(), hab: homeOf(x, z), on: true }; kinds[k].push(it); if (!kind.includes("spike")) perches.push(it);
  }
  const flowerMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.35, side: THREE.DoubleSide }), wind, 0.16);
  const blooms = [];
  for (const [k, geo] of [["daisy", flowerGeo(0xffffff, 0xf4cf52, 9, 0.2)], ["cosmos", flowerGeo(0xf59ab8, 0xf7d766, 7, 0.32, 1.15)], ["cosmos2", flowerGeo(0xfbd3df, 0xf2c14e, 7, 0.4, 1.05)], ["spike", spikeGeo(0x9b7fd1, 0xc9b6ee)], ["pinkspike", spikeGeo(0xe77fa4, 0xf8c6d6)]]) {
    const m = instanced(geo, flowerMat, kinds[k], false); m.userData.items = kinds[k]; blooms.push(m); world.add(m);
  }

  /* clover: thick where the rabbits feed, thinner over the rest of their meadow; salad leaves for the guinea pigs */
  const clover = [], cc = new THREE.Color();
  const leafAt = (x, z, s, a, b) => clover.push({ x, y: Y(x, z) + 0.03, z, ry: r() * 6.28, s, color: cc.set(a).lerp(C(b), r()).clone() });
  for (let i = 0; i < 1100; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * (MEADOW.r + 0.6), x = MEADOW.x + Math.cos(a) * d, z = MEADOW.z + Math.sin(a) * d; if (wet(x, z, 0.4) || nearShelter(x, z) || vnoise(x * 0.9, z * 0.9) < 0.46) continue; leafAt(x, z, 0.8 + r() * 0.8, 0x5f9a4a, 0x86bd5c); }
  for (const [fx, fz] of MEADOW.food) for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.25; leafAt(fx + Math.cos(a) * d, fz + Math.sin(a) * d, 0.9 + r() * 0.8, 0x4f8f43, 0x7fb657); }
  for (const [fx, fz] of HAB.orchard.food) for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.0; leafAt(fx + Math.cos(a) * d, fz + Math.sin(a) * d, 1.3 + r() * 0.9, 0x86bf55, 0xc3e07a); }
  const cloverMesh = instanced(cloverGeo(), new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.2 }), clover); world.add(cloverMesh);
  /* grass tufts wherever there is grass, thin inside the habitats. Drawn in a random order, so
     drawing only the first part of the list (from far away, or on a slow phone) thins it evenly. */
  const tufts = [];
  for (let i = 0; i < (low ? 2400 : 4600); i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * (R0 + 2), x = Math.cos(a) * d, z = Math.sin(a) * d, home = inHabitat(x, z, 0.2);
    if (!inside(x, z) || wet(x, z, 0.5) || distToPaths(x, z) < 0.75 || slopeAt(x, z) > 0.75 || nearShelter(x, z) || Math.hypot(x + 10, z + 11) < 5.2) continue;
    if (home && r() < 0.72) continue;
    if (vnoise(x * 0.35 + 9, z * 0.35) < 0.3) continue;   // tufts gather in patches
    tufts.push({ x, y: Y(x, z) - 0.02, z, ry: r() * 6.28, s: (home ? 0.5 : 0.8) + r() * 0.7, color: cc.set(0xcfe6a4).lerp(C(0xffffff), r() * 0.6).clone() });
  }
  const tuftMesh = instanced(tuftGeo(), sway(new THREE.MeshStandardMaterial({ map: bladeTex(), alphaTest: 0.45, roughness: 1, envMapIntensity: 0.15 }), wind, 0.2), tufts); tuftMesh.receiveShadow = false; world.add(tuftMesh);

  const fernG = [];
  /* shrubs, some in bloom: strays over the island, and a leafy border behind each habitat (thickest round the beagles' garden) */
  const bushes = [[], []], dots = [];
  const bush = (x, z, s, bloom) => {
    if (!inside(x, z, 2) || wet(x, z, s) || inHabitat(x, z, -s * 0.6) || nearShelter(x, z, s)) return;
    const y = Y(x, z) - 0.1; bushes[Math.floor(r() * 2)].push({ x, y, z, ry: r() * 6.28, s }); obstacles.push({ x, z, r: s * 1.05, what: "a shrub" });
    if (bloom) for (let i = 0; i < 26; i++) { const a = r() * 6.28, e = r() * 1.2, rad = 1.05 * s; dots.push({ x: x + Math.cos(a) * Math.sin(e) * rad, y: y + (0.75 + Math.cos(e) * 0.72) * s, z: z + Math.sin(a) * Math.sin(e) * rad, s: (0.09 + r() * 0.07) * s, ry: 0, color: C(bloom === 1 ? 0xf7a8c0 : 0xfffaf2).lerp(C(0xfbd9e4), r() * 0.5) }); }
  };
  for (const [x, z, s, bloom] of [[-13.6, -8.2, 1.5, 1], [-6.2, -13.6, 1.3, 2], [-12.8, -15.2, 1.6, 0], [-7.2, -6.2, 0.9, 1], [-13.5, 15.5, 1.3, 2], [5.4, 18.8, 1.2, 1], [24.6, 4.6, 1.2, 1], [-3.4, -10.2, 1.0, 1], [-15.8, -5.4, 1.1, 2], [-18.5, -10.5, 1.7, 0], [12.5, -15.5, 1.5, 1], [-1.5, 18.6, 1.1, 0], [-11.5, 21.5, 1.4, 1], [2.5, 24.5, 1.2, 0], [10.5, 23.5, 1.3, 2], [-20.5, 10.5, 1.3, 0], [16.5, 21.5, 1.1, 0]]) bush(x, z, s, bloom);
  LAND.forEach((h) => { const n = h.id === "burrow" ? 9 : 4; for (let i = 0; i < n; i++) { const a = h.az + Math.PI + (i / (n - 1) - 0.5) * (h.id === "burrow" ? 3.6 : 2.2) + (r() - 0.5) * 0.2, d = h.r + 1.1 + r() * 1.2; bush(h.x + Math.sin(a) * d, h.z + Math.cos(a) * d, (h.id === "burrow" ? 1.15 : 0.9) + r() * 0.5, h.id === "burrow" ? (i % 3) : (i % 2 ? 0 : 1 + (i % 4) / 2)); } });
  const bushMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 }), wind, 0.012);
  bushes.forEach((list, i) => world.add(instanced(bushGeo(60 + i * 9), bushMat, list, true)));
  world.add(instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), dots));
  /* reeds round the pond (not on the side the camera comes from), bracken in the wooded meadow */
  { const reeds = [], P = POND; for (let i = 0; i < 70; i++) { const a = HAB.pond.az + 1.1 + r() * (6.283 - 2.2), d = P.r + 0.25 + r() * 0.9, x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d; if (wet(x, z, 0.1) || nearShelter(x, z) || distToPaths(x, z) < 0.8) continue; reeds.push({ x, y: Y(x, z) - 0.05, z, ry: r() * 6.28, s: 1.5 + r() * 0.9, tilt: (r() - 0.5) * 0.2, tz: (r() - 0.5) * 0.2 }); }
    world.add(instanced(spikeGeo(0x8a6a48, 0x6f5238), sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), wind, 0.2), reeds));
    const fern = []; for (let i = 0; i < 7; i++) { const g = new THREE.CircleGeometry(0.5, 5); g.scale(1, 0.24, 1); g.translate(0.5, 0, 0); g.rotateZ(0.5); g.rotateY((i / 7) * 6.283); fernG.push(g); }
    const H = HAB.oak; for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = H.r - 0.9 + r() * 3.2, x = H.x + Math.cos(a) * d, z = H.z + Math.sin(a) * d; if (!inside(x, z, 1.2) || nearShelter(x, z) || distToPaths(x, z) < 0.8 || (d < H.r && r() < 0.6)) continue; fern.push({ x, y: Y(x, z) + 0.02, z, ry: r() * 6.28, s: 0.8 + r() * 0.8, color: cc.set(0x5f9a45).lerp(C(0x9ccb6a), r()).clone() }); }
    for (const [fx, fz] of H.food) for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.7; fern.push({ x: fx + Math.cos(a) * d, y: Y(fx, fz) + 0.02, z: fz + Math.sin(a) * d, ry: r() * 6.28, s: 0.6 + r() * 0.4, color: cc.set(0x86bf55).lerp(C(0xc3e07a), r()).clone() }); }
    world.add(instanced(mergeGeometries(fernG), sway(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.2 }), wind, 0.5), fern)); }

  /* trees, no two the same shape. Each habitat's stand behind it and beside it, never between it
     and the visiting camera; one that still gets in the way of a close view steps aside (see tick). */
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x8a6248, roughness: 1, envMapIntensity: 0.15 });
  const leafMat = sway(new THREE.MeshStandardMaterial({ vertexColors: true, map: dabTex("#ffffff", "#a8a8a8"), roughness: 0.9, envMapIntensity: 0.25 }), wind, 0.02, true);
  const trees = [], appleGeo = new THREE.IcosahedronGeometry(1, 1), appleMat = new THREE.MeshStandardMaterial({ color: 0xd9475c, roughness: 0.55 });
  for (const [x0, z0, tall, kind, seed] of [
    [8.6, -19.4, 12.5, "oak", 3], [-6.6, -24.6, 9.5, "oak", 44], [5.4, -25.4, 8, "oak", 9], [-8.4, -20.6, 8.5, "oak", 51],                 // the wooded meadow
    [-24.4, -3.4, 6.2, "apple", 21], [-25, 2.4, 5.6, "apple", 27], [-22.6, 6.8, 6, "apple", 33], [-20.4, -6, 5.8, "apple", 38],            // the orchard
    [10.4, -13.6, 6.8, "blossom", 27], [-1.6, -11.6, 6, "blossom", 21], [11.2, -8.6, 5.2, "blossom", 38],                                  // the leafy garden
    [19, 6.6, 9.5, "willow", 60],                                                                               // the willow pond
    [-21.5, -13.5, 10.5, "oak", 19], [-21.5, 15.2, 5.6, "blossom", 33], [-16.5, 20, 7.4, "oak", 52], [-3.5, 25.5, 5.2, "blossom", 57], [24.5, -6.5, 6.4, "blossom", 39], [-12.6, 3.4, 5.4, "blossom", 61],
  ]) {
    let x = x0, z = z0; const lim = edgeR(Math.atan2(z, x)) - 3, d0 = Math.hypot(x, z); if (d0 > lim) { x *= lim / d0; z *= lim / d0; }
    const t = treeGeo(seed, kind), g = new THREE.Group(), a = new THREE.Mesh(t.trunk, barkMat), b = new THREE.Mesh(t.crown, leafMat);
    a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true; g.add(a, b); g.scale.setScalar(tall); g.position.set(x, Y(x, z) - 0.15, z); g.rotation.y = seed; world.add(g);
    if (kind === "apple") { const tr = rng(seed + 5), list = []; for (let i = 0; i < 16; i++) { const an = tr() * 6.28, e = 0.5 + tr() * 1.5; list.push({ x: Math.cos(an) * Math.sin(e) * 0.3, y: 0.76 + Math.cos(e) * 0.2, z: Math.sin(an) * Math.sin(e) * 0.3, s: 0.02 + tr() * 0.006, ry: 0 }); } g.add(instanced(appleGeo, appleMat, list)); }
    trees.push({ g, x, z, rad: tall * (kind === "willow" ? 0.4 : 0.34) }); obstacles.push({ x, z, r: tall * 0.075 + 0.25, what: "a tree" });
  }

  /* the blossom tree: the one great tree, on its prow beside the pond. Its roots are the island's
     other skeleton: over the turf and down the cliff either side of the waterfall, round the
     basin and the ledges, forking as they go; some come out of the earth lower down. */
  const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.2 });
  const hx = HERO.x, hz = HERO.z, hy = Y(hx, hz), V3 = (x, y, z) => new THREE.Vector3(hx + x, hy + y, hz + z);
  { const wood = limbs(), R = rng(404);
    limb(wood, [V3(0.1, -1.2, 0), V3(-0.1, 1.4, 0.1), V3(-0.9, 4, 0.5), V3(-1.6, 6.3, 0.5), V3(-1.2, 8.4, 0.1)], [2.4, 1.5, 1.1, 0.95, 0.75], 9, ROOT_LIGHT, ROOT_DARK, 1);
    for (const [pts, rad] of [[[[-1.5, 6.2, 0.5], [-3.3, 8.4, 0.9], [-4.8, 10.2, 1.0]], [0.75, 0.55, 0.3]], [[[-1.2, 8.2, 0.1], [-0.5, 10.4, -0.8], [0.2, 12, -1.2]], [0.7, 0.5, 0.3]], [[[-1.4, 6.6, 0.4], [0.9, 8.6, 1.1], [3.2, 10.2, 1.5]], [0.7, 0.5, 0.3]], [[[-1.3, 7.6, 0.3], [-1.5, 9.6, 1.4], [-1.6, 11, 2]], [0.55, 0.4, 0.25]]]) limb(wood, pts.map((q) => V3(...q)), rad, 6, ROOT_LIGHT, ROOT_DARK, rad[0] * 9);
    /* over the turf to the edge, then down */
    const over = (thE, r0, wob) => {
      const e = edgeR(thE) - 0.5, ex = Math.cos(thE) * e, ez = Math.sin(thE) * e, d = Math.hypot(ex - hx, ez - hz), n = Math.max(2, Math.round(d / 1.6)), pts = [V3((ex - hx) / d * 0.3, 1.7, (ez - hz) / d * 0.3)], rad = [r0 * 1.2];
      for (let i = 1; i <= n; i++) { const t = i / n, sd = Math.sin(t * 3.1) * wob, x = mix(hx, ex, t) - (ez - hz) / d * sd, z = mix(hz, ez, t) + (ex - hx) / d * sd, rr = mix(r0 * 1.15, r0, t); pts.push(new THREE.Vector3(x, Y(x, z) + rr * (i === 1 ? 0.8 : 0.35), z)); rad.push(rr); }
      return [pts, rad];
    };
    for (const [th, wob, o] of [
      [0.77, 0.8, { u1: 0.86, r0: 1.1, r1: 0.12, drift: 0.44, wig: 0.07, seed: 1, kids: 3, hang: 2 }],        // round the cove's flank and under the basin
      [0.53, -0.5, { u1: 0.96, r0: 1.3, r1: 0.14, drift: -0.06, wig: 0.1, seed: 2, kids: 3, hang: 3 }],       // the great one, straight down the prow
      [0.3, 0.6, { u1: 0.72, r0: 1.0, r1: 0.1, drift: -0.32, wig: 0.08, seed: 3, kids: 2, hang: 1.5 }],
      [0.64, -0.4, { u1: 0.52, r0: 0.75, r1: 0.08, drift: 0.12, wig: 0.09, seed: 4, kids: 1, dive: [0.3, 0.6] }],
      [0.42, 0.4, { u1: 0.6, r0: 0.7, r1: 0.06, drift: 0.1, wig: 0.1, seed: 5, kids: 1 }],
    ]) { const [lp, lr] = over(th, o.r0, wob); root(wood, surf, { th, u0: 0.014, ...o }, R, lp, lr); }
    /* into the garden: a few that cross the grass and go under (one drinks from the pond) */
    for (const [dx, dz, len, r0] of [[-0.97, -0.25, 6.2, 0.9], [-0.55, -0.84, 5, 0.8], [0.35, -0.94, 4.4, 0.7], [-0.88, 0.48, 4.4, 0.75]]) {
      const pts = [V3(dx * 0.3, 1.6, dz * 0.3)], rad = [r0 * 1.2];
      for (let i = 1; i <= 5; i++) { const t = i / 5, sd = Math.sin(t * 2.6 + dx * 9) * 0.7, x = hx + dx * len * t - dz * sd, z = hz + dz * len * t + dx * sd, rr = mix(r0, 0.12, t); pts.push(new THREE.Vector3(x, Y(x, z) + rr * (i === 1 ? 0.8 : 0.35) - smooth(0.6, 1, t) * 0.7, z)); rad.push(rr); }
      limb(wood, pts, rad, 6, ROOT_LIGHT, ROOT_DARK, len);
    }
    /* out of the earth lower down: left of the waterfall, round the hollow, under the basin; and thinner ones on the sides a turn away */
    for (const o of [
      { th: 1.36, u0: 0.05, u1: 0.93, r0: 1.0, r1: 0.12, drift: 0.2, wig: 0.1, seed: 11, kids: 3, bury: 0.12, hang: 2.5 },
      { th: 1.25, u0: 0.3, u1: 0.9, r0: 0.7, r1: 0.08, drift: -0.2, wig: 0.08, seed: 12, kids: 2, bury: 0.15, hang: 2 },
      { th: 1.72, u0: 0.08, u1: 0.74, r0: 0.75, r1: 0.08, drift: 0.42, wig: 0.07, seed: 13, kids: 2, bury: 0.14 },
      { th: 0.92, u0: 0.3, u1: 0.97, r0: 0.65, r1: 0.1, drift: -0.25, wig: 0.1, seed: 14, kids: 2, bury: 0.15, hang: 3 },
      { th: 2.5, u0: 0.07, u1: 0.62, r0: 0.6, r1: 0.06, drift: -0.22, wig: 0.09, seed: 15, kids: 1, bury: 0.15 },
      { th: -0.25, u0: 0.1, u1: 0.8, r0: 0.6, r1: 0.06, drift: 0.2, wig: 0.1, seed: 16, kids: 1, bury: 0.15, hang: 2 },
      { th: -1.35, u0: 0.12, u1: 0.7, r0: 0.55, r1: 0.06, drift: -0.25, wig: 0.1, seed: 17, kids: 1, bury: 0.15 },
      { th: -2.1, u0: 0.2, u1: 0.9, r0: 0.6, r1: 0.06, drift: 0.3, wig: 0.1, seed: 18, kids: 1, bury: 0.15, hang: 2 },
      { th: 3.05, u0: 0.1, u1: 0.75, r0: 0.55, r1: 0.06, drift: 0.25, wig: 0.1, seed: 19, kids: 1, bury: 0.15, hang: 1.5 },
    ].slice(0, low ? 6 : 9)) root(wood, surf, o, R);
    const m = limbMesh(wood, woodMat); m.castShadow = m.receiveShadow = true; world.add(m);
    const crown = new THREE.Mesh(heroCrown(), sway(new THREE.MeshStandardMaterial({ vertexColors: true, map: leafMat.map, roughness: 0.9, envMapIntensity: 0.25 }), wind, 0.0012, 7)); crown.position.set(hx, hy, hz); crown.castShadow = crown.receiveShadow = true; world.add(crown);
    obstacles.push({ x: hx, z: hz, r: 2.4, what: "the blossom tree" });
  }
  { const run = RUNS[1], s = 5.9, x = POOLS[1].x + run.dx * s, z = POOLS[1].z + run.dz * s, m = new THREE.Mesh(bridgeGeo(), new THREE.MeshStandardMaterial({ color: 0xc8935e, roughness: 0.85, envMapIntensity: 0.3 }));
    m.scale.setScalar(7.6); m.position.set(x, POOLS[2].L + 0.5, z); m.rotation.y = Math.atan2(run.dx, -run.dz) ; m.castShadow = m.receiveShadow = true; world.add(m); }


  /* what grows on the cliff: moss tufts and small ferns wherever the mass lies flat enough to
     hold soil, and trails of leaves over the lips of the ledges. All instanced, all placed from
     the same fixed numbers as the mass itself. */
  { const CR = rng(515), mossy = [], hangs = [], up = new THREE.Vector3();
    for (let i = 0; i < (low ? 150 : 280); i++) {
      const th = CR() * 6.2832, u = 0.02 + Math.pow(CR(), 0.8) * 0.72, p = surf(th, u);
      if (hollowAt(th, u) < 1.6) continue;
      if (p.ny > 0.5 && CR() < 0.75) mossy.push({ x: p.x, y: p.y - 0.1, z: p.z, ry: CR() * 6.28, s: 0.6 + CR() * 0.9, color: cc.set(0x5f9a45).lerp(C(0x9ccb6a), CR()).clone() });
      else if (p.ny < 0.1 && p.ny > -0.5 && u < 0.4) hangs.push({ x: p.x, y: p.y, z: p.z, ry: Math.atan2(p.nx, p.nz), s: 0.7 + CR() * 1.1 });
    }
    world.add(instanced(mergeGeometries(fernG), sway(new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.2 }), wind, 0.3), mossy));
    /* a trail of small leaves down the face */
    const trail = []; for (let i = 0; i < 7; i++) { const g = new THREE.IcosahedronGeometry(0.16 - i * 0.012, 0); g.scale(1, 0.7, 1); g.translate(Math.sin(i * 1.9) * 0.22, -i * 0.42, Math.cos(i * 1.7) * 0.1); trail.push(g); }
    const tm = mergeGeometries(trail), tp = tm.attributes.position, tc = []; for (let i = 0; i < tp.count; i++) { const t = clamp(-tp.getY(i) / 2.6, 0, 1); cc.copy(C(0x6f9f52)).lerp(C(0xa5cf7a), 1 - t); tc.push(cc.r, cc.g, cc.b); }
    tm.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
    world.add(instanced(tm, sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.2 }), wind, 0.05, "hang"), hangs)); }

  /* the light in the dark places: a cluster of mushrooms on the hollow's floor, and seed pods
     hanging under the blossom tree. Both are unlit bright material plus one soft sprite: no glow pass. */
  const glowTex = canvasTex(64, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 1, n / 2, n / 2, n / 2); gr.addColorStop(0, "rgba(255,236,176,.85)"); gr.addColorStop(0.4, "rgba(255,214,140,.3)"); gr.addColorStop(1, "rgba(255,200,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  const lamp = (x, y, z, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(x, y, z); sp.scale.set(s, s, 1); sp.renderOrder = 4; world.add(sp); return sp; };
  const glows = [];
  { const MR = rng(606), caps = [], stems = [], hp = body.ledge(HOLLOW.th, SHELVES[1].u, 0.3);
    for (let i = 0; i < 9; i++) {
      const q = body.ledge(HOLLOW.th + (MR() - 0.5) * HOLLOW.w * 1.1, SHELVES[1].u, 0.16 + MR() * 0.3), h = 0.5 + MR() * 0.9;
      stems.push({ x: q.x, y: q.y - 0.05, z: q.z, ry: 0, s: h }); caps.push({ x: q.x, y: q.y - 0.05 + h * 0.95, z: q.z, ry: MR() * 6.28, s: 0.32 + MR() * 0.34 });
    }
    const capG = new THREE.SphereGeometry(1, 7, 4, 0, 6.2832, 0, 1.25); capG.scale(1, 0.72, 1);
    world.add(instanced(capG, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), caps));
    world.add(instanced(new THREE.CylinderGeometry(0.1, 0.14, 1, 5), new THREE.MeshStandardMaterial({ color: 0xf3e2c2, emissive: 0xc99a46, emissiveIntensity: 0.5, roughness: 0.9 }), stems.map((q) => ({ ...q, y: q.y + q.s * 0.5 }))));
    glows.push({ sp: lamp(hp.x, hp.y + 1.6, hp.z, 8, 0.32), o: 0.32, ph: 0 }, { sp: lamp(hp.x, hp.y + 0.8, hp.z, 4, 0.4), o: 0.4, ph: 2.1 }); }
  { const PR = rng(707), pods = [], stalk = [];
    for (let i = 0; i < 11; i++) { const [cx, cy, cz] = HERO_CROWN[i % HERO_CROWN.length], a = PR() * 6.2832, d = 0.4 + PR() * 1.5, x = hx + cx + Math.cos(a) * d, z = hz + cz + Math.sin(a) * d, top = hy + cy - 0.9, y = top - 1.5 - PR() * 0.9; stalk.push({ x, y: (y + top) / 2, z, ry: 0, s: top - y }); pods.push({ x, y, z, ry: PR() * 6.28, s: 0.3 + PR() * 0.16 }); }   // each on a stalk that goes up into the lumps of its cluster
    const podG = new THREE.SphereGeometry(1, 7, 5); podG.scale(0.8, 1.25, 0.8);
    world.add(instanced(podG, new THREE.MeshBasicMaterial({ color: 0xfff0c4 }), pods));
    world.add(instanced(new THREE.CylinderGeometry(0.02, 0.025, 1, 4), new THREE.MeshStandardMaterial({ color: 0xa98a63, roughness: 1 }), stalk));
    if (!low) for (const q of pods.filter((_, i) => i % 3 === 0)) glows.push({ sp: lamp(q.x, q.y, q.z, 2.6, 0.3), o: 0.3, ph: q.x }); }

  /* blossom falling from the big tree: a few petals that drift down and begin again at the top */
  const petals = [];
  if (!reduced) { const PG = new THREE.CircleGeometry(0.13, 4); PG.scale(1, 1.5, 1); const n = low ? 10 : 20, PR = rng(808);
    const m = new THREE.InstancedMesh(PG, new THREE.MeshBasicMaterial({ color: 0xf5a9c0, side: THREE.DoubleSide }), n); m.frustumCulled = false; world.add(m);
    for (let i = 0; i < n; i++) petals.push({ a: PR() * 6.28, d: 1.5 + PR() * 5, y: PR(), sp: 0.5 + PR() * 0.5, ph: PR() * 6.28, sw: 0.5 + PR() });
    const po = new THREE.Object3D();
    var fall = (dt) => { petals.forEach((q, i) => { q.y -= dt * q.sp * 0.1; if (q.y < 0) { q.y = 1; q.a = Math.random() * 6.28; q.d = 1.5 + Math.random() * 5; } const t = 1 - q.y, drop = 12.5 * q.y, dr = q.d + t * 1.6, an = q.a + t * 0.5; po.position.set(hx + Math.cos(an) * dr + Math.sin(time * q.sw + q.ph) * 0.8, hy + 1.2 + drop, hz + Math.sin(an) * dr * 0.9 + Math.cos(time * q.sw * 0.8 + q.ph) * 0.8); po.rotation.set(time * q.sw + q.ph, time * q.sw * 0.7, Math.sin(time + q.ph) * 0.8); po.scale.setScalar(1); po.updateMatrix(); m.setMatrixAt(i, po.matrix); }); m.instanceMatrix.needsUpdate = true; };
  } else var fall = () => {};
  /* shelters: one each, the better half shown once half the topic is learned; and the beagles' ball and bowl */
  const builtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.3 }), shelters = {};
  for (const h of HABS) {
    const sp = SHELTERS[h.id](rng(h.id.length * 31 + 7)), g = new THREE.Group(), mk = (parts) => { const m = new THREE.Mesh(mergeGeometries(parts), builtMat); m.castShadow = m.receiveShadow = true; return m; };
    const base = mk(sp.base), extra = mk(sp.extra); g.add(base, extra); g.scale.setScalar(sp.scale); g.position.set(h.sh[0], Y(h.sh[0], h.sh[1]) - 0.06, h.sh[1]); g.rotation.y = Math.atan2((h.pool ? h.pool.x : h.x) - h.sh[0], (h.pool ? h.pool.z : h.z) - h.sh[1]);   // its open side faces home
    world.add(g); shelters[h.id] = { g, extra }; obstacles.push({ x: h.sh[0], z: h.sh[1], r: h.sh[2], what: "the shelter" });
  }
  { const [b, w] = HAB.burrow.food, toy = new THREE.Mesh(mergeGeometries([ball(0.34, b[0], Y(b[0], b[1]) + 0.32, b[1], 0xc9506e), cyl(0.5, 0.4, 0.22, w[0], Y(w[0], w[1]) + 0.11, w[1], CREAM), cyl(0.4, 0.4, 0.04, w[0], Y(w[0], w[1]) + 0.21, w[1], 0x7cc4c8)]), builtMat); toy.castShadow = toy.receiveShadow = true; world.add(toy);
    obstacles.push({ x: b[0], z: b[1], r: 0.36, what: "the ball" }, { x: w[0], z: w[1], r: 0.5, what: "the bowl" }); }
  obstacles.push({ x: -10, z: -11.2, r: 5.4, what: "the cottage" });
  for (const h of LAND) h.obs = obstacles.filter((o) => Math.hypot(o.x - h.x, o.z - h.z) < h.r + o.r + 2);

  /* ---------- Models (see CREDITS.md): the cottage, and the animals (sanctuary3d-life.js) ---------- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const blob = blobTex(), blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const shadow = (s) => { const g = blobGeo.clone(); g.scale(s, 1, s); const m = new THREE.Mesh(g, blobMat); m.renderOrder = 2; world.add(m); return m; };
  const life = new Life({ group: world, height, wet, obstacles, cam, shadow, ripple });
  const cottage = loader.loadAsync(BASE + "cottage.glb").then((g) => {
    const b = new THREE.Box3().setFromObject(g.scene), size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3()); g.scene.position.set(-mid.x, -b.min.y, -mid.z);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.material.roughness = Math.max(o.material.roughness, 0.82); o.material.metalness = 0; o.material.envMapIntensity = 0.35; if (o.material.map) o.material.map.anisotropy = 4; } });
    const h = new THREE.Group(); h.add(g.scene); h.scale.setScalar(9.4 / size.y); h.position.set(-10, Y(-10, -11.2) - 0.12, -11.2); h.rotation.y = 0.42; world.add(h);
  });
  const names = [...new Set(ROSTER.map((a) => a.model))], got = await Promise.allSettled([cottage, ...names.map((n) => prepare(loader, BASE, n))]);
  const failed = got.filter((j) => j.status === "rejected"), models = {}; names.forEach((n, i) => { if (got[i + 1].status === "fulfilled") models[n] = got[i + 1].value; });
  if (!models["rabbit-clover"]) throw (failed[0] ? failed[0].reason : new Error("no Clover"));   // without Clover there is no sanctuary; a missing cottage is survivable
  const byId = {};
  ROSTER.forEach((who, i) => {
    if (!models[who.model]) return;
    const a = life.add(who.id, models[who.model], HAB[who.hab], { name: who.name, line: who.line, seed: 97 + i * 7919, x: who.at[0], z: who.at[1], yaw: who.at[2], scale: who.scale, tint: who.tint });
    a.n = who.n; a.visible = false; a.place(); byId[who.id] = a;   // not drawn until setState says it has moved in
  });
  for (const who of ROSTER) if (who.follow && byId[who.id]) byId[who.id].follow = byId[who.follow] || null;

  /* butterflies: from one open flower to another, with a rest on each */
  const flyers = [];
  if (!reduced) [[0xf6a23c, 2], [0xfdf6e9, 11], [0xf7b4c6, 23]].slice(0, low ? 2 : 3).forEach(([hex, seed]) => {
    const g = new THREE.Group(), wg = new THREE.CircleGeometry(0.2, 8); wg.scale(1, 1.25, 1); wg.translate(0.2, 0, 0); const wm = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide });
    const a = new THREE.Mesh(wg, wm), b = new THREE.Mesh(wg, wm); b.scale.x = -1; a.rotation.x = b.rotation.x = -Math.PI / 2; g.add(a, b); world.add(g);
    const R = rng(seed), p = perches[Math.floor(R() * perches.length)] || { x: 0, y: 2, z: 0, s: 1 };
    flyers.push({ g, a, b, R, x: p.x, z: p.z, y: p.y + 0.63 * p.s, from: null, to: p, t: 0, dur: 0, rest: 1 + R() * 4, ph: R() * 6 });
  });
  life.flyers = flyers; life.flowers = perches;
  function flutter(f, dt, time) {
    if (f.from) {   // on the wing: a curved, bobbing line to the next flower
      f.t += dt; const u = Math.min(1, f.t / f.dur), e = smooth(0, 1, u), fx = f.from.x, fz = f.from.z, tx = f.to.x, tz = f.to.z, len = Math.hypot(tx - fx, tz - fz) || 1, side = Math.sin(u * Math.PI) * Math.sin(u * 9 + f.ph) * 0.7;
      f.x = mix(fx, tx, e) + (-(tz - fz) / len) * side; f.z = mix(fz, tz, e) + ((tx - fx) / len) * side;
      const top = f.to.y + 0.63 * f.to.s + 0.04; f.y = mix(f.from.y0, top, e) + Math.sin(u * Math.PI) * (1.1 + len * 0.05) + Math.sin(time * 5 + f.ph) * 0.1 * Math.sin(u * Math.PI);
      f.g.rotation.y = Math.atan2(tx - fx, tz - fz) + Math.PI / 2 + side * 0.5; const w = 0.25 + Math.abs(Math.sin(time * 17 + f.ph)) * 1.0; f.a.rotation.y = -w; f.b.rotation.y = w;
      if (u >= 1) { f.from = null; f.rest = 2.5 + f.R() * 6; }
    } else {        // settled: wings open and close slowly
      f.rest -= dt; const w = 0.35 + (Math.sin(time * 2.2 + f.ph) * 0.5 + 0.5) * 0.9; f.a.rotation.y = -w; f.b.rotation.y = w;
      if (f.rest <= 0) { let to = null; for (let i = 0; i < 12 && !to; i++) { const c = perches[Math.floor(f.R() * perches.length)], d = c ? Math.hypot(c.x - f.x, c.z - f.z) : 0; if (c && c.on && c !== f.to && d > 1.5 && d < 16 && !flyers.some((o) => o !== f && o.to === c)) to = c; } if (to) { f.from = { x: f.x, z: f.z, y0: f.y }; f.to = to; f.t = 0; f.dur = 1.2 + Math.hypot(to.x - f.x, to.z - f.z) / 2.4; } else f.rest = 2; }
    }
    f.g.position.set(f.x, f.y, f.z);
  }
  const heartMat = new THREE.SpriteMaterial({ map: heartTex(), transparent: true, depthWrite: false }), hearts = [];
  /* the pin over the habitat chosen on the card, in the whole-island view */
  const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(96, (g) => { g.fillStyle = "#c9506e"; g.beginPath(); g.arc(48, 40, 30, 0, 6.3); g.fill(); g.beginPath(); g.moveTo(30, 62); g.lineTo(48, 92); g.lineTo(66, 62); g.fill(); g.fillStyle = "#fff8f1"; g.beginPath(); g.arc(48, 40, 13, 0, 6.3); g.fill(); }), transparent: true, depthTest: false, sizeAttenuation: false }));
  pin.scale.set(0.05, 0.05, 1); pin.center.set(0.5, 0); pin.visible = false; pin.renderOrder = 5; world.add(pin);

  /* ---------- Camera: turn and zoom anywhere; three kinds of place to be ----------
     "world": the island. A habitat's id: close to that habitat, from its open side.
     An animal chosen: closer still, and the view keeps it in the middle as it moves. */
  const view = { tx: 1, ty: 1, tz: 2, az: 0.18, pol: 0.93, dist: 90 }, goal = { ...view };
  let mode = "world", chosen = null, focus = null, shape = 0;
  const groundOf = (h) => (h.pool ? h.pool.L : h.base);
  /* On a phone held sideways the card takes the right of the screen, so the view looks a little to the right of its subject, which puts the subject left of the middle. */
  const aside = (az, d) => { if (!(cam.aspect > 1.5 && canvas.clientHeight < 500)) return [0, 0]; const k = d * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect * 0.3; return [Math.cos(az) * k, -Math.sin(az) * k]; };
  const shifted = (f) => { const [ox, oz] = aside(f.az, f.dist); f.tx += ox; f.tz += oz; return f; };
  function frameFor() { return shifted(frame0()); }
  function frame0() {
    const a = cam.aspect, tan = Math.tan((cam.fov * Math.PI) / 360), tall = a < 1;
    if (chosen) { const d = clamp(chosen.size * 1.9 / (tan * Math.min(a, 0.9)), 9, 46); return { tx: chosen.x, ty: groundOf(chosen.hab) + chosen.size * 0.45 - d * tan * (tall ? 0.16 : 0.06), tz: chosen.z, az: goal.az, pol: 1.2, dist: d }; }
    if (mode !== "world") { const h = HAB[mode], d = clamp(h.r * 1.08 / (tan * Math.min(a, 1.3)), 16, 72); return { tx: h.x, ty: groundOf(h) + 0.6 - d * tan * (tall ? 0.1 : 0.06), tz: h.z, az: h.az, pol: 1.02, dist: d }; }
    // the whole island, top to tip: garden, roots, waterfall and the deep underside. In portrait it sits above the card.
    return fitWorld(tan);
  }
  /* Portrait: pull back and aim so the whole island, from the tree tops to its tip, sits between the title and the card. */
  const FIT = [[-32, 2, 3], [35.5, 2, 7], [6, 17, -21], [hx, hy + 15.5, hz], [body.tip[0], body.tip[1] - 1, body.tip[2]], [-10, Y(-10, -11.2) + 10, -11.2], fallEnd], probe = new THREE.PerspectiveCamera(), fv = new THREE.Vector3();
  function fitWorld(tan) {
    const H = canvas.clientHeight || 1, side = cam.aspect > 1.5 && H < 500, cover = side ? 34 : (opts.clear && opts.clear()) || 176, top = 1 - (2 * (side ? 56 : 84)) / H, bot = -1 + (2 * (cover + 12)) / H, f = { tx: 3, ty: -11, tz: 3, az: 0.16, pol: 1.1, dist: 200 }, sp = Math.sin(f.pol);
    probe.fov = cam.fov; probe.aspect = cam.aspect; probe.near = 0.5; probe.far = 3000; probe.updateProjectionMatrix();
    for (let k = 0; k < 5; k++) {
      probe.position.set(f.tx + Math.sin(f.az) * sp * f.dist, f.ty + Math.cos(f.pol) * f.dist, f.tz + Math.cos(f.az) * sp * f.dist); probe.lookAt(f.tx, f.ty, f.tz); probe.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of FIT) { fv.set(p[0], p[1], p[2]).project(probe); x0 = Math.min(x0, fv.x); x1 = Math.max(x1, fv.x); y0 = Math.min(y0, fv.y); y1 = Math.max(y1, fv.y); }
      const sc = Math.max((x1 - x0) / 2, (y1 - y0) / Math.max(0.2, top - bot)); f.dist *= sc;
      const dy = (top + bot) / 2 - (y0 + y1) / 2 / sc, dx = -(x0 + x1) / 2 / sc;
      f.ty -= (dy * f.dist * tan) / sp; f.tx -= Math.cos(f.az) * dx * f.dist * tan * cam.aspect; f.tz += Math.sin(f.az) * dx * f.dist * tan * cam.aspect;
    }
    return f;
  }
  const worldDist = () => { const m = mode, c = chosen; mode = "world"; chosen = null; const d = frameFor().dist; mode = m; chosen = c; return d; };
  /* Zooming in on the whole island brings the view up from the middle of the mass to the garden, where the animals are. */
  function aim() { if (mode !== "world") return; const f = frameFor(), k = smooth(f.dist * 0.4, f.dist * 0.95, goal.dist), [ox, oz] = aside(goal.az, goal.dist); goal.tx = mix(1 + ox, f.tx, k); goal.ty = mix(0.5, f.ty, k); goal.tz = mix(2 + oz, f.tz, k); }
  function limits() { return { dMin: mode === "world" ? worldDist() * 0.3 : 7, dMax: worldDist() * 1.25, pMin: 0.45, pMax: mode === "world" ? 1.5 : 1.45 }; }
  function retarget() { const az = view.az, f = frameFor(); Object.assign(goal, f); goal.az += Math.round((az - goal.az) / (Math.PI * 2)) * Math.PI * 2; screen(); wake(); }
  function applyCam() {
    const sp = Math.sin(view.pol), cp = Math.cos(view.pol);
    cam.position.set(view.tx + Math.sin(view.az) * sp * view.dist, view.ty + cp * view.dist, view.tz + Math.cos(view.az) * sp * view.dist);
    const floor = Math.hypot(cam.position.x, cam.position.z) < R0 + 2 ? height(cam.position.x, cam.position.z) + 0.8 : -40; if (cam.position.y < floor) cam.position.y = floor;
    cam.lookAt(view.tx, view.ty, view.tz);
  }
  /* A tree standing between where the camera is going and what it is going to look at steps aside. */
  function screen() {
    const sp = Math.sin(goal.pol), cx = goal.tx + Math.sin(goal.az) * sp * goal.dist, cz = goal.tz + Math.cos(goal.az) * sp * goal.dist, vx = goal.tx - cx, vz = goal.tz - cz, L2 = vx * vx + vz * vz || 1;
    for (const t of trees) { const u = ((t.x - cx) * vx + (t.z - cz) * vz) / L2, off = Math.hypot(t.x - cx - vx * u, t.z - cz - vz * u); const hide = mode !== "world" && u > 0.02 && u < 0.97 && off < t.rad + 1.5; if (t.g.visible === hide) { t.g.visible = !hide; dirty = true; renderer.shadowMap.needsUpdate = true; } }   // its shadow goes with it
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const f = frameFor(), turned = Math.abs(cam.aspect - shape) > 0.08; shape = cam.aspect;
    if (!started) Object.assign(goal, f); else if (turned) { goal.dist = f.dist; goal.ty = f.ty; goal.tx = f.tx; goal.tz = f.tz; }   // a phone turned on its side is framed again; a browser bar sliding away keeps the person's own zoom
    if (!started) Object.assign(view, goal); dirty = true;
  }

  /* ---------- State from the quiz: { habitat id: { p, residents, shelter } } ---------- */
  let state = {};
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), tmp = new THREE.Object3D();
  function setState(s) {
    state = {}; for (const h of HABS) { const v = (s && s[h.id]) || {}; state[h.id] = { p: clamp(v.p || 0, 0, 1), residents: clamp(v.residents || 1, 1, 3), shelter: !!v.shelter }; }
    for (const m of blooms) {   // a third of the flowers from the start; the rest come out as the habitat's topic is learned
      let shown = 0; m.userData.items.forEach((it, i) => { it.on = it.u < 0.34 + 0.66 * state[HABS[it.hab].id].p; if (it.on) { tmp.position.set(it.x, it.y, it.z); tmp.rotation.set(it.tilt, it.ry, it.tz); tmp.scale.setScalar(it.s); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); shown++; } else m.setMatrixAt(i, ZERO); });
      m.userData.shown = shown; m.instanceMatrix.needsUpdate = true;
    }
    for (const h of HABS) shelters[h.id].extra.visible = state[h.id].shelter;
    for (const a of life.animals) {
      const on = a.n <= state[a.hab.id].residents; if (on === a.visible) continue;
      if (on && !life.free(a, a.x, a.z)) for (let i = 0; i < 200; i++) { const an = a.rand() * 6.283, d = Math.sqrt(a.rand()) * a.hab.r, x = a.hab.x + Math.cos(an) * d, z = a.hab.z + Math.sin(an) * d; if (life.free(a, x, z)) { a.x = x; a.z = z; break; } }   // someone is standing where it would arrive
      a.visible = on; a.place();
    }
    if (chosen && !chosen.visible) chosen = null;
    dirty = true; renderer.shadowMap.needsUpdate = true;
  }

  /* ---------- Picking. Animals are small on a phone, so a tap picks the nearest one within a
     thumb's reach on screen; failing that, the habitat the tapped ground belongs to. ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pv = new THREE.Vector3();
  function pick(cx, cy, coarse) {
    const b = canvas.getBoundingClientRect(), tan = Math.tan((cam.fov * Math.PI) / 360); let best = null, bd = 1e9;
    for (const a of life.animals) {
      if (!a.visible) continue; pv.set(a.x, a.root.position.y + a.size * life.big * 0.5, a.z); const dist = pv.distanceTo(cam.position); pv.project(cam); if (pv.z > 1) continue;
      const px = b.left + (pv.x * 0.5 + 0.5) * b.width, py = b.top + (-pv.y * 0.5 + 0.5) * b.height, reach = Math.max(coarse ? 30 : 20, (a.size * life.big * 0.6) / (dist * tan) * (b.height / 2)), d = Math.hypot(px - cx, py - cy);
      if (d < reach && d < bd) { bd = d; best = a; }
    }
    if (best) return { animal: best.id, habitat: best.hab.id };
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(land, false)[0]; if (!hit) return null;
    let near = null, nd = 2.2; for (const h of HABS) { const d = Math.hypot(hit.point.x - h.x, hit.point.z - h.z) - h.r; if (d < nd) { nd = d; near = h; } }
    return near ? { habitat: near.id } : null;
  }
  /* One finger turns, two fingers zoom (or the wheel). A tap is a press that stays put,
     however long it lasts (how far from where it began, not how much it trembled): a finger wobbles more than a mouse, so touch gets more room before it counts as a drag. */
  const ptr = new Map(); let pinch = 0, moved = 0, sx0 = 0, sy0 = 0, multi = false;
  const slack = (e) => (e.pointerType === "mouse" ? 6 : 12);
  const onDown = (e) => { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptr.size === 1) { moved = 0; multi = false; sx0 = e.clientX; sy0 = e.clientY; } if (ptr.size === 2) { multi = true; const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
  const onMove = (e) => {
    const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; const L = limits();
    if (ptr.size === 1 && !multi) { const was = moved; moved = Math.max(moved, Math.hypot(e.clientX - sx0, e.clientY - sy0)); if (moved > slack(e)) { const k = was > slack(e) ? 1 : 0; goal.az -= dx * 0.0055 * k; goal.pol = clamp(goal.pol - dy * 0.004 * k, L.pMin, L.pMax); screen(); wake(); } }   // the wobble that turned a tap into a drag isn't spent on turning
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch && d > 1) { goal.dist = clamp(goal.dist * (pinch / d), L.dMin, L.dMax); aim(); } pinch = d; wake(); }
  };
  const onUp = (e) => { if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); pinch = 0; if (e.type === "pointerup" && !ptr.size && !multi && moved <= slack(e) && opts.onPick) opts.onPick(pick(e.clientX, e.clientY, e.pointerType !== "mouse")); };
  const onWheel = (e) => { e.preventDefault(); const L = limits(); goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), L.dMin, L.dMax); aim(); wake(); };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("lostpointercapture", onUp); canvas.addEventListener("wheel", onWheel, { passive: false });

  /* ---------- The loop. With reduced motion nothing idles: it draws only when something changes. ---------- */
  let raf = 0, running = false, started = false, dirty = true, last = 0, time = 0, spent = 0, frames = 0, hold = false, thin = false, drip = 2;
  let onscreen = true;
  const wake = () => { dirty = true; if (running && onscreen && !raf) raf = requestAnimationFrame(tick); };
  function detail() {   // less of the small stuff from far away; the animals a little larger there, so they still read
    const far = view.dist > 62; tuftMesh.count = Math.round(tufts.length * (thin ? 0.4 : far ? 0.55 : 1)); cloverMesh.visible = view.dist < 85 && !thin;
    life.big = 1 + 0.3 * smooth(40, 95, view.dist) + 0.45 * smooth(120, 210, view.dist);
  }
  function tick(now) {
    raf = 0; if (!running || !onscreen) return;   // nothing is drawn while the world is scrolled out of sight
    const raw = (now - last) / 1000 || 0.016, dt = Math.min(0.05, raw); last = now; time += dt;
    /* quality follows the phone: if frames are slow for a while, draw fewer pixels, then less grass */
    if (!hold && !reduced && raw < 0.5) { spent += raw; frames++; if (spent > 2) { const ms = (spent / frames) * 1000; if (ms > 27) { if (ratio > 1) { ratio = Math.max(1, ratio - 0.25); renderer.setPixelRatio(ratio); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); } else thin = true; } spent = frames = 0; } }
    if (chosen) { const [ox, oz] = aside(goal.az, goal.dist); goal.tx = chosen.x + ox; goal.tz = chosen.z + oz; }
    const k = reduced ? 1 : 1 - Math.pow(0.0025, dt); let moving = false;
    for (const key in view) { const d = goal[key] - view[key]; if (Math.abs(d) > 1e-4) { view[key] += d * k; moving = true; } }
    applyCam(); detail();
    pin.visible = mode === "world" && !!focus; if (pin.visible) { const h = HAB[focus]; pin.position.set(h.x, groundOf(h) + 4.2 + (reduced ? 0 : Math.sin(time * 2.2) * 0.25), h.z); }
    if (!reduced) {
      wind.value = time;
      rippleTex.offset.set(time * 0.012, time * 0.008); streak.offset.y = time * 0.9;
      fall(dt);
      for (const g of glows) g.sp.material.opacity = g.o * (0.8 + 0.2 * Math.sin(time * 1.1 + g.ph));
      for (const m of mist) { const w = Math.sin(time * 0.5 + m.ph); m.sp.position.x = m.x + w * 0.5; m.sp.position.y = m.y + Math.sin(time * 0.37 + m.ph * 2) * 0.4; m.sp.material.opacity = m.op * (0.85 + 0.15 * Math.sin(time * 0.8 + m.ph)); const k = m.sc * (1 + 0.06 * w); m.sp.scale.set(k, k * 0.8, 1); }
      foam.forEach((f, i) => { const s = 1 + 0.12 * Math.sin(time * 3 + i); f.scale.set(s, 1, s); f.material.opacity = 0.42 + 0.12 * Math.sin(time * 2.3 + i); });
      drip -= dt; if (drip <= 0) { drip = 0.9 + Math.random() * 1.6; if (Math.random() < 0.55) ripple(inflow[0] + (Math.random() - 0.5), inflow[1] + (Math.random() - 0.5), 1.1); else { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * (POND.r - 1); ripple(POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d, 0.5 + Math.random() * 0.5); } }
      for (const g of rings) { if (g.age > 2) continue; g.age += dt; const u = g.age / 2; if (u >= 1) { g.m.visible = false; continue; } const s = g.size * (0.25 + u * 1.5); g.m.scale.set(s, 1, s); g.m.material.opacity = 0.55 * (1 - u) * (1 - u); }
      life.update(dt);
      for (const f of flyers) flutter(f, dt, time);
      for (let i = hearts.length - 1; i >= 0; i--) { const h = hearts[i]; h.age += dt; h.s.position.y += dt * 1.1; h.s.position.x += Math.sin(h.age * 4 + i) * dt * 0.3; h.s.material.opacity = 1 - smooth(0.9, 1.7, h.age); const sc = 0.5 * smooth(0, 0.25, h.age); h.s.scale.set(sc, sc, 1); if (h.age > 1.7) { world.remove(h.s); h.s.material.dispose(); hearts.splice(i, 1); } }
    } else for (const a of life.animals) a.place();
    if (!started) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, cam); dirty = false; started = true;
    if (reduced) { if (moving) raf = requestAnimationFrame(tick); return; }
    raf = requestAnimationFrame(tick);
  }
  const ro = new ResizeObserver(() => { resize(); wake(); }); ro.observe(canvas);
  const io = new IntersectionObserver((es) => { onscreen = es[es.length - 1].isIntersecting; if (onscreen) { last = performance.now(); wake(); } }); io.observe(canvas);
  resize(); setState(null);
  const info = (a) => ({ id: a.id, name: a.name, line: a.line, habitat: a.hab.id, visible: a.visible });

  return {
    setState,
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); raf = 0; ptr.clear(); pinch = 0; },
    /* visit("pond") goes close to a habitat; visit(null) goes back to the whole island */
    visit(id) { mode = HAB[id] ? id : "world"; chosen = null; retarget(); },
    /* choose an animal: the view goes to it and stays with it. select(null) lets it go. */
    select(id) { const a = byId[id]; chosen = a && a.visible ? a : null; if (chosen) mode = chosen.hab.id; retarget(); return !!chosen; },
    /* in the whole-island view: mark a habitat and turn the island to bring it forward */
    focus(id) { focus = HAB[id] ? id : null; if (mode === "world" && focus) { const h = HAB[focus], want = Math.atan2(h.x, h.z) * 0.6 + 0.12; goal.az = want + Math.round((goal.az - want) / (Math.PI * 2)) * Math.PI * 2; } wake(); },
    where: () => ({ mode, animal: chosen ? chosen.id : null }),
    animals: () => life.animals.map(info),
    /* "Say hello": it turns to you, comes a little closer and sniffs. With reduced motion the card answers in words. */
    hello(id) {
      const a = byId[id]; if (!a || !a.visible) return false; wake(); if (reduced) return true;
      a.hello(cam.position.x, cam.position.z);
      for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(heartMat.clone()); s.position.set(a.x + (i - 1) * 0.35, a.root.position.y + a.size * 1.05 + i * 0.12, a.z); s.scale.set(0.01, 0.01, 1); world.add(s); hearts.push({ s, age: -1.2 - i * 0.2 }); }
      return true;
    },
    /* for the tests and the screenshots */
    debug: {
      /* per fall: how fast a streak moves down it, in metres a second (positive is downhill). The picture drifts toward smaller v at 0.9 a second. */
      flow: () => falls.map((g) => { const uv = g.attributes.uv, p = g.attributes.position, n = uv.count - 1, dv = uv.getY(n) - uv.getY(0), dy = p.getY(n) - p.getY(0); return (-0.9 / dv) * -dy; }),
      /* the things the first view has to show: [x, y, z] each */
      marks: () => { const h = body.ledge(HOLLOW.th, SHELVES[1].u, 0.3), rt = surf(0.53, 0.45); return { tip: body.tip, basin: [basin.x, basin.y, basin.z], spill: [spill.x, spill.y, spill.z], hollow: [h.x, h.y + 1, h.z], roots: [rt.x, rt.y, rt.z], tree: [hx, hy + 4, hz], crown: [hx, hy + 14, hz], fallEnd, cottage: [-10, Y(-10, -11.2) + 4, -11.2], pond: [POND.x, POND.L, POND.z] }; },
      view, goal, cam, life, byId, trees, flyers, obstacles, pick, failed: failed.length,
      blooms: (hab) => blooms.reduce((n, m) => n + (hab ? m.userData.items.filter((it) => it.on && HABS[it.hab].id === hab).length : m.userData.shown), 0),
      shelter: (id) => shelters[id].extra.visible,
      quality(px) { hold = true; thin = false; ratio = px; renderer.setPixelRatio(px); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); dirty = true; },
      ratio: () => ({ ratio, thin }),
      snap() { Object.assign(view, goal); applyCam(); detail(); for (const a of life.animals) a.place(); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); },
      project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight }; },
      info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls }),
      /* Live the animals' lives fast, with no drawing: `seconds` of it in steps of a thirtieth.
         Returns everything check() ever complained about, and how far each animal got. */
      simulate(seconds) {
        const bad = {}, start = life.animals.map((a) => [a.x, a.z]), far = life.animals.map(() => 0), did = life.animals.map(() => ({}));
        for (let t = 0; t < seconds; t += 1 / 30) { life.update(1 / 30); for (const m of life.check()) bad[m] = (bad[m] || 0) + 1; life.animals.forEach((a, i) => { did[i][a.state] = 1; far[i] = Math.max(far[i], Math.hypot(a.x - start[i][0], a.z - start[i][1])); }); }
        return { bad, animals: life.animals.filter((a) => a.visible).map((a) => ({ id: a.id, far: +far[life.animals.indexOf(a)].toFixed(1), did: Object.keys(did[life.animals.indexOf(a)]).join(" ") })) };
      },
    },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("lostpointercapture", onUp); io.disconnect(); canvas.removeEventListener("wheel", onWheel);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); });
      renderer.dispose();
    },
  };
}
