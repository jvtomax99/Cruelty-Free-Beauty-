/* C.F.B. Your Sanctuary: the animals. Imported by sanctuary3d.js.
   The models have no bones, so two things here stand in for a skeleton and an animator:
   1. A soft skeleton in the vertex shader (RIG): head, ears, four legs and tail are regions of
      the mesh that turn about a pivot, with weights that fade in over a short distance. Eyes are
      found from the texture (dark patches on the head) and a blink fills them with fur colour.
   2. Behaviour (Animal): each animal has its own clock and random numbers, and alternates
      between resting, looking about, sniffing, grazing, grooming and going somewhere for a
      reason (food, shelter, a friend, a flower in bloom, something that moved). Rabbits travel only in hops and
      move only while in the air, so their feet never slide; walkers' legs step at the pace
      they cover ground; ducks glide on their own pond.
   An animal only ever sets off along a straight line that has been checked: inside its
   habitat, on dry ground (or on water, for ducks), clear of rocks, plants, shelters and the
   others. Life.check() reports any animal that is somewhere it shouldn't be. */
import * as THREE from "three";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- Species. Rig numbers are in the model's own space once stood up: 1 unit tall,
   facing +Z, centred. They were set by eye on posed test renders (tools/test-sanctuary.cjs
   only checks behaviour). size is the height in the world. ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/* neck: [pivot, direction the head lies in, fade]. ear: [pivot, direction, fade, half the gap
   between the ears, how far out from the middle an ear starts (hanging ears), reach, swivel].
   legs: [hip height, fade, front z, hind z, the z that splits front from hind, how far the belly keeps clear, the x between the front pair, and between the hind pair].
   tail: [pivot, direction, fade]. eye: [lowest, highest, radius, how dark counts as an eye]; eyeAt: where the eyes are when the picture can't say. cut: [z, y, to] tucks away
   everything behind z and below y (a tail the animal shouldn't have). */
export const SPECIES = {
  "rabbit-clover": { size: 3.2, r: 0.85, gait: "hop", hop: 1.5, neck: [V(0, 0.5, 0.08), V(0, 0.9, 0.45), 0.1], ear: [V(0, 0.74, 0.03), V(0, 1, -0.1), 0.08, 0.09, 0, 0.36, 0], eye: [0.58, 0.71, 0.045], dip: 0.55 },
  "rabbit-tan": { size: 2.2, r: 0.95, gait: "hop", hop: 1.6, neck: [V(0, 0.4, 0.24), V(0, 0.35, 0.94), 0.12], ear: [V(0, 0.62, 0.3), V(0, 1, -0.1), 0.08, 0.07, 0, 0.46, 0], eye: [0.44, 0.56, 0.045, 0.42], eyeAt: [0.1, 0.5, 0.39], dip: 0.4 },
  "rabbit-grey": { size: 1.9, r: 1.6, gait: "hop", hop: 1.4, lazy: 2.2, neck: [V(-0.045, 0.4, 0.5), V(0, 0.2, 0.98), 0.15], ear: [V(-0.045, 0.67, 0.56), V(0, 1, 0), 0.04, 0.2, 0, 0.5, 0], eye: [0.42, 0.56, 0.06, 0.3], eyeAt: [0.19, 0.49, 0.83], dip: 0.25, turn: 0.3, earK: 0.15 },
  duck: { size: 2.0, r: 1.15, yaw: -Math.PI / 2, gait: "swim", speed: 0.8, neck: [V(0, 0.6, 0.2), V(0, 1, 0.15), 0.08], tail: [V(0, 0.5, -0.4), V(0, 0.3, -1), 0.12], eye: [0.78, 0.92, 0.04, 0.3], draft: 0.25, dip: 0.9 },
  duckling: { size: 0.95, r: 0.55, yaw: -Math.PI / 2, gait: "swim", speed: 0.95, neck: [V(0, 0.6, 0.28), V(0, 1, 0.2), 0.08], eye: [0.76, 0.9, 0.04, 0.3], draft: 0.2, dip: 0.8 },
  "guinea-pig": { size: 1.6, r: 1.05, yaw: -Math.PI / 2, gait: "scurry", speed: 2.4, neck: [V(0, 0.5, 0.38), V(0, 0.15, 1), 0.2], eye: [0.72, 0.88, 0.05], cut: [-0.5, 0.22, V(0, 0.14, -0.44)], dip: 0.22 },
  beagle: { size: 2.6, r: 1.4, yaw: -Math.PI / 2, gait: "walk", speed: 1.7, stride: 1.25, neck: [V(0, 0.56, 0.2), V(0, 0.8, 0.6), 0.1], ear: [V(0, 0.9, 0.2), V(0, -1, 0), 0.16, 0.2, 0.24, 0.37, 0], legs: [0.3, 0.12, 0.18, -0.4, -0.08, 0.24, 0.01, -0.1], tail: [V(0, 0.5, -0.38), V(0, 0.4, -0.9), 0.08], eye: [0.78, 0.89, 0.04], wag: 1, dip: 1.0 },
  deer: { size: 3.8, r: 1.45, yaw: -Math.PI / 2, gait: "walk", speed: 1.3, stride: 1.5, neck: [V(0.04, 0.47, 0.15), V(0, 0.7, 0.7), 0.1], ear: [V(0.04, 0.86, 0.15), V(1, 0, 0), 0.05, 0.12, 0, 0.2, 1], legs: [0.38, 0.12, 0.12, -0.26, -0.07, 0.14, 0, 0.13], tail: [V(0, 0.5, -0.33), V(0, 0.3, -1), 0.05], eye: [0.68, 0.8, 0.035], shy: 1, dip: 1.35 },
};

/* ---------- The soft skeleton ---------- */
const VERT_PARS = `
uniform vec3 uNeck, uNeckDir, uHead; uniform float uNeckLen;
uniform vec3 uEarP, uEarDir; uniform float uEarLen, uEarX, uEarIn, uEarR, uEarY; uniform vec4 uEar;
uniform float uHip, uLegLen, uMidZ, uLegW; uniform vec2 uLegZ, uLegX; uniform vec4 uLeg;
uniform vec3 uTailP, uTailDir; uniform float uTailLen; uniform vec2 uTail;
uniform float uBreath;
attribute float aEye; varying float vEye;
vec3 rgX(vec3 v, vec3 o, float a) { float c = cos(a), s = sin(a); vec3 d = v - o; return o + vec3(d.x, c * d.y - s * d.z, s * d.y + c * d.z); }
vec3 rgY(vec3 v, vec3 o, float a) { float c = cos(a), s = sin(a); vec3 d = v - o; return o + vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z); }
vec3 rgZ(vec3 v, vec3 o, float a) { float c = cos(a), s = sin(a); vec3 d = v - o; return o + vec3(c * d.x - s * d.y, s * d.x + c * d.y, d.z); }
`;
const VERT = `
vEye = aEye;
{
  vec3 p = transformed;
  /* ears first: an ear belongs to the head wherever it hangs */
  float sd = step(uEarP.x, p.x), sg = mix(-1.0, 1.0, sd), we = 0.0, er = 0.0; vec3 eo = uEarP + vec3(sg * uEarX, 0.0, 0.0);
  if (uEarLen > 0.0) {
    float along = dot(p - eo, vec3(uEarDir.x * sg, uEarDir.yz));
    er = step(0.0, along) * (1.0 - smoothstep(uEarR * 0.8, uEarR, distance(p, eo)));
    if (uEarIn > 0.0) er *= smoothstep(uEarIn * 0.55, uEarIn, abs(p.x - uEarP.x));
    we = er * smoothstep(0.0, uEarLen, along);
  }
  float wh = uNeckLen > 0.0 ? max(smoothstep(0.0, uNeckLen, dot(p - uNeck, uNeckDir)), we) : 0.0;
  float wt = uTailLen > 0.0 ? smoothstep(0.0, uTailLen, dot(p - uTailP, uTailDir)) * (1.0 - wh) : 0.0;
  if (uLegLen > 0.0) {
    float f = step(uMidZ, p.z), s = step(mix(uLegX.y, uLegX.x, f), p.x), lz = mix(uLegZ.y, uLegZ.x, f);
    float belly = mix(1.0 - smoothstep(lz + uLegW * 0.6, lz + uLegW, p.z), smoothstep(lz - uLegW, lz - uLegW * 0.6, p.z), f);   // the belly between the legs stays put
    float wl = smoothstep(uHip, uHip - uLegLen, p.y) * belly * (1.0 - wh) * (1.0 - wt);
    p = rgX(p, vec3(p.x, uHip, lz), mix(mix(uLeg.z, uLeg.w, s), mix(uLeg.x, uLeg.y, s), f) * wl);
  }
  p.x *= 1.0 + uBreath * (1.0 - wh) * (1.0 - wt);
  if (we > 0.0) {
    float back = mix(uEar.x, uEar.y, sd) * we;
    if (uEarY > 0.5) p = rgY(p, eo, -back * sg); else p = rgX(p, eo, back);
    p = rgZ(p, eo, mix(uEar.z, uEar.w, sd) * we);
  }
  p = rgZ(p, uNeck, uHead.z * wh); p = rgX(p, uNeck, uHead.x * wh); p = rgY(p, uNeck, uHead.y * wh);
  if (uTailLen > 0.0) { p = rgY(p, uTailP, uTail.x * wt); p = rgX(p, uTailP, uTail.y * wt); }
  transformed = p;
}
`;
export function rigMaterial(base, sp, lid) {
  const m = base.clone();
  const u = m.userData.rig = {
    uNeck: { value: sp.neck[0] }, uNeckDir: { value: sp.neck[1].clone().normalize() }, uNeckLen: { value: sp.neck[2] }, uHead: { value: new THREE.Vector3() },
    uEarP: { value: sp.ear ? sp.ear[0] : V(0, 0, 0) }, uEarDir: { value: sp.ear ? sp.ear[1].clone().normalize() : V(0, 1, 0) }, uEarLen: { value: sp.ear ? sp.ear[2] : 0 }, uEarX: { value: sp.ear ? sp.ear[3] : 0 }, uEarIn: { value: sp.ear ? sp.ear[4] : 0 }, uEarR: { value: sp.ear ? sp.ear[5] : 1 }, uEarY: { value: sp.ear ? sp.ear[6] : 0 }, uEar: { value: new THREE.Vector4() },
    uHip: { value: sp.legs ? sp.legs[0] : 0 }, uLegLen: { value: sp.legs ? sp.legs[1] : 0 }, uLegZ: { value: new THREE.Vector2(sp.legs ? sp.legs[2] : 0, sp.legs ? sp.legs[3] : 0) }, uMidZ: { value: sp.legs ? sp.legs[4] : 0 }, uLegW: { value: sp.legs ? sp.legs[5] : 1 }, uLegX: { value: new THREE.Vector2(sp.legs ? sp.legs[6] : 0, sp.legs ? sp.legs[7] : 0) }, uLeg: { value: new THREE.Vector4() },
    uTailP: { value: sp.tail ? sp.tail[0] : V(0, 0, 0) }, uTailDir: { value: sp.tail ? sp.tail[1].clone().normalize() : V(0, 0, -1) }, uTailLen: { value: sp.tail ? sp.tail[2] : 0 }, uTail: { value: new THREE.Vector2() },
    uBreath: { value: 0 }, uBlink: { value: 0 }, uLid: { value: lid },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + VERT_PARS).replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERT);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vEye; uniform float uBlink; uniform vec3 uLid;").replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uLid, clamp(vEye * uBlink, 0.0, 1.0));");
  };
  m.customProgramCacheKey = () => "cfb-rig";
  return m;
}

/* Load one model and stand it up: one geometry, 1 unit tall, facing +Z, centred, feet at 0.
   Finds the eyes (for blinking) and the fur colour around them. */
const ready = {};
export function prepare(loader, base, name) {
  return ready[name] || (ready[name] = loader.loadAsync(base + name + ".glb").then((g) => {
    const sp = SPECIES[name]; let src = null; g.scene.updateMatrixWorld(true); g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    const sg = src.geometry, n = sg.attributes.position.count, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), v = new THREE.Vector3();
    const mw = src.matrixWorld.clone().premultiply(new THREE.Matrix4().makeRotationY(sp.yaw || 0)), nm = new THREE.Matrix3().getNormalMatrix(mw), map = src.material.map, t2 = new THREE.Vector2();
    const box = new THREE.Box3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(sg.attributes.position, i).applyMatrix4(mw); pos.set([v.x, v.y, v.z], i * 3); box.expandByPoint(v); v.fromBufferAttribute(sg.attributes.normal, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3); t2.fromBufferAttribute(sg.attributes.uv, i); if (map) map.transformUv(t2); uv.set([t2.x, t2.y], i * 2); }
    const k = 1 / (box.max.y - box.min.y), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    for (let i = 0; i < n; i++) { pos[i * 3] = (pos[i * 3] - cx) * k; pos[i * 3 + 1] = (pos[i * 3 + 1] - box.min.y) * k; pos[i * 3 + 2] = (pos[i * 3 + 2] - cz) * k; }
    if (sp.cut) for (let i = 0; i < n; i++) if (pos[i * 3 + 2] < sp.cut[0] && pos[i * 3 + 1] < sp.cut[1]) { pos[i * 3] = sp.cut[2].x; pos[i * 3 + 1] = sp.cut[2].y; pos[i * 3 + 2] = sp.cut[2].z; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); if (sg.index) geo.setIndex(sg.index.clone());
    /* eyes: dark texels on the head, inside the species' eye band; one centre each side */
    const eye = new Float32Array(n), lid = new THREE.Color(0.8, 0.75, 0.7);
    try {
      const img = map.image, S = 256, c = document.createElement("canvas"); c.width = c.height = S; const cx2 = c.getContext("2d", { willReadFrequently: true }); cx2.drawImage(img, 0, 0, S, S); const px = cx2.getImageData(0, 0, S, S).data;
      const at = (i) => { const x = clamp(Math.floor((uv[i * 2] % 1 + 1) % 1 * S), 0, S - 1), y = clamp(Math.floor((uv[i * 2 + 1] % 1 + 1) % 1 * S), 0, S - 1), j = (y * S + x) * 4; return [px[j] / 255, px[j + 1] / 255, px[j + 2] / 255]; };
      const nd = sp.neck[1].clone().normalize(), [y0, y1, rad] = sp.eye, mx = sp.neck[0].x, sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (y < y0 || y > y1 || Math.abs(x - mx) < 0.03) continue;
        if ((x - sp.neck[0].x) * nd.x + (y - sp.neck[0].y) * nd.y + (z - sp.neck[0].z) * nd.z < sp.neck[2] * 0.6) continue;
        const [r, gg, b] = at(i); if (r * 0.3 + gg * 0.59 + b * 0.11 > (sp.eye[3] || 0.16)) continue;
        const s = sum[x > mx ? 1 : 0]; s[0] += x; s[1] += y; s[2] += z; s[3]++;
      }
      /* eyes too small in the picture to find sit where they were measured (eyeAt) */
      let cs = sum.filter((s) => s[3] > 1).map((s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]]); if (cs.length < 2 && sp.eyeAt) cs = [-1, 1].map((sd) => [mx + sp.eyeAt[0] * sd, sp.eyeAt[1], sp.eyeAt[2]]); let lr = 0, lg = 0, lb = 0, ln = 0;
      for (let i = 0; i < n; i++) for (const e of cs) { const d = Math.hypot(pos[i * 3] - e[0], pos[i * 3 + 1] - e[1], pos[i * 3 + 2] - e[2]); if (d < rad) eye[i] = Math.max(eye[i], 1 - smooth(rad * 0.7, rad, d)); else if (d < rad * 1.7) { const q = at(i); if (q[0] + q[1] + q[2] > 0.9) { lr += q[0]; lg += q[1]; lb += q[2]; ln++; } } }
      if (ln) lid.setRGB(lr / ln, lg / ln, lb / ln, THREE.SRGBColorSpace);
      geo.userData.eyes = cs.length;
    } catch (e) { geo.userData.eyes = 0; geo.userData.why = String(e); }   // no blinking is better than no animal
    geo.setAttribute("aEye", new THREE.BufferAttribute(eye, 1)); geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5;   // room for the pose
    const mat = src.material; mat.roughness = Math.max(mat.roughness, 0.85); mat.metalness = 0; mat.envMapIntensity = 0.35; if (mat.map) mat.map.anisotropy = 4;
    return { geo, mat, lid, sp, name };
  }));
}

/* ---------- One animal ---------- */
const POSE = ["hp", "hy", "hr", "eLb", "eRb", "eLs", "eRs", "tail", "tailUp", "pitch", "sq"];
class Animal {
  constructor(life, id, model, hab, o) {
    this.life = life; this.id = id; this.sp = model.sp; this.hab = hab; this.name = o.name; this.line = o.line; this.rand = rng(o.seed); this.k = o.scale || 1;
    this.root = new THREE.Group(); this.mesh = new THREE.Mesh(model.geo, rigMaterial(model.mat, model.sp, model.lid)); if (o.tint) this.mesh.material.color.set(o.tint);
    this.u = this.mesh.material.userData.rig; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.root.add(this.mesh); life.group.add(this.root);
    this.size = this.sp.size * this.k; this.r = this.sp.r * this.k; this.x = o.x; this.z = o.z; this.yaw = o.yaw || 0; this.lift = 0;
    this.pose = {}; this.goal = {}; for (const p of POSE) { this.pose[p] = p === "sq" ? 1 : 0; this.goal[p] = p === "sq" ? 1 : 0; }
    this.legs = [0, 0, 0, 0]; this.phase = this.rand() * 6; this.speed = 0; this.state = "rest"; this.t = 0; this.dur = 1 + this.rand() * 5; this.queue = [];
    this.blinkIn = 1 + this.rand() * 4; this.blink = 0; this.breath = this.rand() * 6; this.lookAt = null; this.follow = o.follow || null; this.visible = true;
    this.shadow = life.shadow(this.r * 2.6); this.place();
  }
  /* ----- where it may stand ----- */
  ok(x, z, self = true) { return this.life.free(this, x, z, self); }
  clear(x, z) {   // a straight line from here to there, checked every third of a body
    const d = Math.hypot(x - this.x, z - this.z), n = Math.max(2, Math.ceil(d / (this.r * 0.35)));
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.ok(mix(this.x, x, t), mix(this.z, z, t))) return false; }
    return true;
  }
  /* a point to go to: near (x,z) if given, else anywhere in the habitat; null when nothing clear is found */
  spot(near, spread = 1.4, tries = 14) {
    for (let i = 0; i < tries; i++) {
      const a = this.rand() * 6.283, d = near ? (0.4 + this.rand()) * spread : Math.sqrt(this.rand()) * (this.hab.r - this.r - 0.3);
      const x = (near ? near[0] : this.hab.x) + Math.cos(a) * d, z = (near ? near[1] : this.hab.z) + Math.sin(a) * d;
      if (Math.hypot(x - this.x, z - this.z) > 0.6 && this.ok(x, z) && this.clear(x, z)) return [x, z];
    }
    return null;
  }
  /* ----- deciding ----- */
  set(state, dur, extra) { this.state = state; this.t = 0; this.dur = dur; this.friend = null; Object.assign(this, extra); }
  next() {
    if (this.queue.length) return this.queue.shift()();
    const R = this.rand, hab = this.hab, lazy = this.sp.lazy || 1, others = this.life.animals.filter((a) => a !== this && a.hab === hab && a.visible);
    if (this.follow && this.follow.visible) return this.trail();
    const roll = R(), nap = Math.min(0.45, 0.24 * lazy);   // a lazy animal rests more often and longer, and still gets up
    if (roll < nap) return this.set("rest", (4 + R() * 9) * lazy, { sleepy: R() < 0.35 * lazy });
    if (roll < nap + 0.13) return this.set("look", 1.6 + R() * 2.6, { lookAt: this.interest(others) });
    if (roll < nap + 0.23) return this.set("sniff", 1.4 + R() * 2);
    if (roll < nap + 0.33) return this.set("groom", 2.4 + R() * 3, { side: R() < 0.5 ? -1 : 1 });
    /* going somewhere, for a reason */
    const why = R(), food = hab.food && hab.food.length ? hab.food[Math.floor(R() * hab.food.length)] : null;
    if (why < 0.46 && food) { const near = Math.hypot(food[0] - this.x, food[1] - this.z) < this.r + 0.9; const to = near ? null : this.spot(food, this.r + 0.5); if (near || to) { if (to) this.go(to); this.queue.push(() => this.face(food), () => this.set("graze", 3.5 + R() * 6)); return near ? this.next() : undefined; } }
    if (why < 0.64 && hab.rest) { const to = this.spot(hab.rest, 1.5); if (to) { this.go(to); this.queue.push(() => this.set("rest", (5 + R() * 9) * lazy, { sleepy: R() < 0.5 })); return; } }
    if (why < 0.84 && others.length) { const f = others[Math.floor(R() * others.length)], to = this.spot([f.x, f.z], this.r + f.r + 0.5); if (to && f.state !== "move") { this.go(to); this.queue.push(() => this.face([f.x, f.z]), () => { if (f.state !== "move" && f.state !== "hello") f.set("look", 2.5 + R() * 1.5, { lookAt: [this.x, this.z] }); this.set("sniff", 2 + R() * 1.6, { friend: f }); }); return; } }
    if (why >= 0.84 && why < 0.94) { const f = this.life.bloom(this); if (f) { const d = Math.hypot(f.x - hab.x, f.z - hab.z) || 1, k = Math.min(1, (hab.r - this.r - 0.5) / d), to = this.spot([hab.x + (f.x - hab.x) * k, hab.z + (f.z - hab.z) * k], 0.9); if (to) { this.go(to); this.queue.push(() => this.face([f.x, f.z]), () => this.set("sniff", 2.2 + R() * 2.2)); return; } } }   // a flower at the edge of its ground: go as near as it may, and smell it
    const to = this.spot(null); if (to) { this.go(to); this.queue.push(() => this.set(R() < 0.5 ? "sniff" : "look", 1.5 + R() * 2.5, { lookAt: this.interest(others) })); return; }
    this.set("rest", 3 + R() * 5, { sleepy: false });
  }
  interest(others) {   // something worth looking at: a friend on the move, a butterfly, the person watching
    const moving = others.find((a) => a.state === "move" || a.state === "hello"); if (moving && this.rand() < 0.7) return [moving.x, moving.z];
    const b = this.life.near(this.x, this.z); if (b && this.rand() < 0.5) return b;
    const f = this.life.bloom(this); if (f && Math.hypot(f.x - this.x, f.z - this.z) < 7 && this.rand() < 0.4) return [f.x, f.z];
    return this.rand() < 0.4 ? "cam" : [this.x + (this.rand() - 0.5) * 8, this.z + (this.rand() - 0.5) * 8];
  }
  go(to) { this.set("move", 30, { to, sub: "turn", st: 0 }); }
  face(p) { this.set("move", 6, { to: null, faceTo: p, sub: "turn", st: 0 }); }
  trail() {   // a duckling keeps behind whoever it follows
    const f = this.follow, bx = f.x - Math.sin(f.yaw) * (f.r + this.r + 0.25), bz = f.z - Math.cos(f.yaw) * (f.r + this.r + 0.25), d = Math.hypot(bx - this.x, bz - this.z);
    if (d > 0.7 && this.ok(bx, bz) && this.clear(bx, bz)) return this.go([bx, bz]);
    const R = this.rand(); if (R < 0.3 && f.state === "graze") return this.set("graze", 2 + this.rand() * 3);
    this.set(R < 0.6 ? "rest" : R < 0.8 ? "look" : "sniff", 1 + this.rand() * 2.2, { sleepy: false, lookAt: [f.x, f.z] });
  }
  /* "Say hello": turn to the person, come a little closer, sniff up at them */
  hello(camX, camZ) {
    const d = Math.hypot(camX - this.x, camZ - this.z) || 1, step = this.sp.gait === "swim" ? 1.6 : this.sp.gait === "hop" ? this.sp.hop * 1.6 : 2.2; let to = null;
    for (const f of [1, 0.6, 0.3]) { const x = this.x + (camX - this.x) / d * step * f, z = this.z + (camZ - this.z) / d * step * f; if (this.ok(x, z) && this.clear(x, z)) { to = [x, z]; break; } }
    const steps = [() => this.face([camX, camZ]), () => this.set("hello", 4.2, { lookAt: "cam" })]; if (to) steps.splice(1, 0, () => this.go(to));
    this.sleepy = false; this.blink = 0;
    /* a rabbit asked in mid-hop lands first, where it was already going to land */
    if (this.state === "move" && this.sp.gait === "hop" && (this.sub === "air" || this.sub === "prep" || this.sub === "down") && this.land) { this.to = [this.land[0], this.land[1]]; this.queue = steps; }
    else { this.queue = steps; this.queue.shift()(); }
  }
  /* ----- moving ----- */
  move(dt) {
    const sp = this.sp, R = this.rand;
    const aim = this.to || this.faceTo, want = aim ? Math.atan2(aim[0] - this.x, aim[1] - this.z) : this.yaw, off = wrap(want - this.yaw), left = this.to ? Math.hypot(this.to[0] - this.x, this.to[1] - this.z) : 0;
    this.st += dt;
    if (sp.gait === "hop") {
      /* crouch, spring, land, pause. The body only travels while it is off the ground. */
      if (this.sub === "turn") { if (Math.abs(off) < 0.12) { if (!this.to) return this.next(); this.sub = "wait"; this.st = 0; this.gap = 0.05; } else { this.sub = "air"; this.st = 0; this.from = [this.x, this.z, this.yaw]; this.land = [this.x, this.z, this.yaw + clamp(off, -1.3, 1.3)]; this.T = 0.24; this.h = 0.16; this.goal.sq = 0.9; } }
      else if (this.sub === "wait") { this.goal.sq = 1; if (this.st > this.gap) { if (left < 0.25) return this.next(); const L = Math.min(left, sp.hop * this.k * (0.75 + R() * 0.4)), x = this.x + Math.sin(want) * L, z = this.z + Math.cos(want) * L; if (!this.ok(x, z) || !this.clear(x, z)) { this.queue = []; return this.set("look", 1.2 + R() * 1.5, { lookAt: [x, z] }); } this.sub = "prep"; this.st = 0; this.land = [x, z, want]; this.T = 0.26 + L * 0.05; this.h = 0.22 + L * 0.2; } }
      else if (this.sub === "prep") { this.goal.sq = 0.84; this.goal.pitch = 0.1; if (this.st > 0.13) { this.sub = "air"; this.st = 0; this.from = [this.x, this.z, this.yaw]; } }
      else if (this.sub === "air") { const u = Math.min(1, this.st / this.T); this.x = mix(this.from[0], this.land[0], u); this.z = mix(this.from[1], this.land[1], u); this.yaw = this.from[2] + wrap(this.land[2] - this.from[2]) * smooth(0, 1, u); this.lift = 4 * this.h * u * (1 - u); this.goal.sq = 1.1; this.goal.pitch = -0.3 * Math.cos(u * Math.PI); this.goal.eLb = this.goal.eRb = 0.5; if (u >= 1) { this.lift = 0; this.sub = "down"; this.st = 0; } }
      else if (this.sub === "down") { this.goal.sq = 0.88; this.goal.pitch = 0.06; if (this.st > 0.11) { this.sub = this.to ? "wait" : "turn"; this.st = 0; this.gap = 0.1 + R() * R() * 0.9; } }
      return;
    }
    /* walkers, scurriers and swimmers turn, then travel nose first; legs step at the pace of the ground covered */
    const top = sp.speed * (sp.gait === "scurry" ? 1 : 0.85 + 0.15 * this.k), turn = sp.gait === "swim" ? 1.5 : 2.6;
    this.yaw += clamp(off, -turn * dt, turn * dt);
    let v = 0;
    if (this.to) { if (left < 0.15) { this.speed = 0; return this.next(); } v = Math.abs(off) < 0.45 ? Math.min(top, 0.35 + left * 1.6) : Math.abs(off) < 1 ? top * 0.3 : 0; }
    else if (Math.abs(off) < 0.06) { this.speed = 0; return this.next(); }
    this.speed += clamp(v - this.speed, -5 * dt, 3.5 * dt);
    const dx = Math.sin(this.yaw) * this.speed * dt, dz = Math.cos(this.yaw) * this.speed * dt;
    if (this.speed > 0.01) { if (this.ok(this.x + dx, this.z + dz)) { this.x += dx; this.z += dz; } else { this.speed = 0; this.queue = []; return this.set("look", 1 + R() * 1.5, { lookAt: [this.x + dx * 40, this.z + dz * 40] }); } }
    const turning = this.to ? 0 : Math.min(1, Math.abs(off) * 2);
    if (sp.gait === "walk") { this.phase += (this.speed / (sp.stride * this.k) + turning * 0.9) * dt * 6.283; const a = Math.min(0.5, 0.16 + this.speed * 0.2) * Math.min(1, this.speed * 1.4 + turning * 0.45), s = Math.sin(this.phase) * a; this.legs = [s, -s, -s, s]; this.lift = Math.abs(Math.cos(this.phase)) * 0.035 * this.size * Math.min(1, this.speed); this.goal.hp = 0.04 + Math.sin(this.phase * 2) * 0.03; }
    else if (sp.gait === "scurry") { this.phase += dt * (8 + this.speed * 7); this.wob = Math.sin(this.phase) * 0.07 * Math.min(1, this.speed); this.lift = Math.abs(Math.sin(this.phase)) * 0.03 * Math.min(1, this.speed); }
    else { this.wob = Math.sin(this.life.time * 1.7 + this.breath) * 0.02; this.goal.tail = Math.sin(this.life.time * 9) * 0.25 * Math.min(1, this.speed); if (this.speed > 0.3 && R() < dt * 1.6) this.life.ripple(this.x, this.z, 0.7); }
  }
  /* ----- every frame ----- */
  update(dt) {
    const g = this.goal, T = this.life.time, R = this.rand, sp = this.sp; this.t += dt; this.breath += dt;
    for (const p of POSE) g[p] = p === "sq" ? 1 : 0; this.wob = 0; if (this.state !== "move") { this.speed = 0; this.lift = 0; this.legs = [0, 0, 0, 0]; }
    if (this.t >= this.dur) { if (this.state === "move") { this.queue = []; this.speed = 0; this.lift = 0; this.set("rest", 2 + R() * 3, { sleepy: false }); } else this.next(); }
    const s = this.state;
    if (s === "move") this.move(dt);
    else if (s === "rest") { g.hp = this.sleepy ? 0.22 : 0.06; g.eLb = g.eRb = this.sleepy ? 0.45 : 0.1; g.sq = 0.97; if (sp.wag && !this.sleepy) g.tail = Math.sin(T * 3) * 0.15; }
    else if (s === "look") { g.eLb = g.eRb = -0.12; g.hp = -0.06; g.eLs = Math.sin(T * 0.9 + this.breath) * 0.12; if (sp.wag) g.tail = Math.sin(T * 9) * 0.4; }
    else if (s === "sniff") { g.hp = 0.14 + Math.sin(T * 17) * 0.035 + (this.friend ? -0.05 : 0.1); g.hy = Math.sin(T * 1.3 + this.breath) * 0.22; g.eLb = g.eRb = 0.1; if (sp.wag) g.tail = Math.sin(T * 12) * 0.5; }
    else if (s === "graze") { const chew = Math.sin(T * 9) * 0.03; g.hp = sp.dip + chew; g.hy = Math.sin(T * 0.6 + this.breath) * 0.15; g.eLb = g.eRb = 0.25; if (sp.gait === "swim") { g.pitch = 0.3; if (R() < dt * 0.8) this.life.ripple(this.x + Math.sin(this.yaw) * this.r, this.z + Math.cos(this.yaw) * this.r, 0.5); } if (this.t > 2.2 && Math.sin(T * 0.7 + this.breath) > 0.93) { g.hp = -0.05; g.eLb = g.eRb = -0.15; } }   // lifts its head now and then to check
    else if (s === "groom") { g.hy = this.side * Math.min(0.95, sp.turn || 0.95); g.hp = 0.45 + Math.sin(T * 11) * 0.06; g.hr = this.side * 0.2; g.eLb = g.eRb = 0.35; g.sq = 0.95; }
    else if (s === "hello") { const u = this.t; g.hp = -0.32 + Math.sin(T * 16) * 0.03 * smooth(0.4, 0.9, u); g.eLb = g.eRb = -0.2; g.eLs = -0.1; g.eRs = 0.1; g.hr = Math.sin(u * 1.8) * 0.12; if (sp.wag) g.tail = Math.sin(T * 14) * 0.7; g.sq = 1 + Math.sin(Math.min(u, 0.5) / 0.5 * Math.PI) * 0.04; }
    /* the head follows what it is looking at, as far as a neck turns; an ear flicks now and then */
    const la = (s === "look" || s === "hello" || (s === "rest" && !this.sleepy && this.lookAt)) ? (this.lookAt === "cam" ? [this.life.cam.position.x, this.life.cam.position.z] : this.lookAt) : null;
    if (la) g.hy = clamp(wrap(Math.atan2(la[0] - this.x, la[1] - this.z) - this.yaw), -(sp.turn || 1.05), sp.turn || 1.05);
    if (s === "sniff" && this.friend) g.hy = clamp(wrap(Math.atan2(this.friend.x - this.x, this.friend.z - this.z) - this.yaw), -0.9, 0.9);
    if (s !== "move" && R() < dt * 0.22) this.flick = [R() < 0.5 ? "eLs" : "eRs", 0.22, (R() - 0.5) * 0.9];
    if (this.flick) { this.flick[1] -= dt; g[this.flick[0]] += this.flick[2]; if (this.flick[1] <= 0) this.flick = null; }
    if (sp.tail && !sp.wag && sp.gait !== "swim" && R() < dt * 0.3) this.twitch = 0.3; if (this.twitch > 0) { this.twitch -= dt; g.tail = Math.sin(T * 30) * 0.5; }
    /* blinking: quick, irregular, sometimes double; long and slow when dozing */
    this.blinkIn -= dt; if (this.blinkIn <= 0) { this.blink = 0.14; this.blinkIn = R() < 0.18 ? 0.3 : 1.8 + R() * 4.5; }
    if (this.blink > 0) this.blink -= dt; const closed = s === "rest" && this.sleepy && this.t > 1.5 ? 1 : this.blink > 0 ? 1 : 0;
    this.u.uBlink.value += (closed - this.u.uBlink.value) * Math.min(1, dt * (closed ? 30 : 16));
    /* ease the pose (fast parts fast, heavy parts slow) and hand it to the shader */
    const P = this.pose, e = (k) => 1 - Math.exp(-k * dt);
    for (const p of POSE) P[p] += (g[p] - P[p]) * e(p === "sq" || p === "pitch" ? 16 : p === "hp" || p === "hy" || p === "hr" ? 7 : 12);
    const U = this.u; U.uHead.value.set(P.hp + (sp.headUp || 0) * 0, P.hy, P.hr); { const ek = sp.earK || 1; U.uEar.value.set(P.eLb * ek, P.eRb * ek, P.eLs * ek, P.eRs * ek); } U.uLeg.value.fromArray(this.legs); U.uTail.value.set(P.tail, P.tailUp);
    U.uBreath.value = Math.sin(this.breath * (s === "rest" ? 1.5 : s === "move" ? 4.5 : 2.4)) * (s === "rest" ? 0.022 : 0.014);
    this.place();
  }
  place() {
    const sq = this.pose.sq, k = this.size * this.life.big, pool = this.hab.pool;
    const y = pool ? pool.L - this.sp.draft * this.size + Math.sin(this.life.time * 1.6 + this.breath) * 0.03 : this.life.height(this.x, this.z);
    this.root.position.set(this.x, y + this.lift, this.z); this.root.rotation.y = this.yaw + (this.wob || 0);
    this.mesh.rotation.x = this.pose.pitch; this.mesh.scale.set(k / Math.sqrt(sq), k * sq, k / Math.sqrt(sq));
    this.shadow.position.set(this.x, y + 0.06, this.z); this.shadow.scale.setScalar(this.life.big * (1 - Math.min(0.5, this.lift * 0.5))); this.shadow.visible = this.visible && !pool; this.root.visible = this.visible;
  }
}

/* ---------- All of them ---------- */
export class Life {
  constructor(o) { Object.assign(this, o); this.animals = []; this.time = 0; this.big = 1; this.flyers = []; this.flowers = []; }
  add(id, model, hab, o) { const a = new Animal(this, id, model, hab, o); this.animals.push(a); return a; }
  /* May `a` stand at (x, z)? Inside its habitat, on the right kind of ground, clear of things and of the others. */
  free(a, x, z) {
    const h = a.hab;
    if (h.pool) { if (Math.hypot(x - h.pool.x, z - h.pool.z) > h.pool.r - a.r - 0.35) return false; for (const p of h.avoid || []) if (Math.hypot(x - p[0], z - p[1]) < p[2] + a.r) return false; }
    else { if (Math.hypot(x - h.x, z - h.z) > h.r - a.r * 0.5) return false; if (this.wet(x, z, a.r * 0.8)) return false; for (const ob of h.obs || this.obstacles) if (Math.hypot(x - ob.x, z - ob.z) < ob.r + a.r) return false; }
    for (const b of this.animals) { if (b === a || b.hab !== h || !b.visible) continue; const sep = a.r + b.r; if (Math.hypot(x - b.x, z - b.z) < sep) return false; if (b.state === "move" && b.land && b.sub !== "wait" && b.sub !== "turn" && Math.hypot(x - b.land[0], z - b.land[1]) < sep) return false; if (b.state === "move" && b.to && Math.hypot(x - b.to[0], z - b.to[1]) < sep * 0.9 && a.id > b.id) return false; }
    return true;
  }
  /* an open flower close enough to an animal's own ground to walk up to (land animals only) */
  bloom(a) { const h = a.hab, list = this.flowers; if (h.pool || !list || !list.length) return null; for (let i = 0; i < 8; i++) { const f = list[Math.floor(a.rand() * list.length)]; if (f.on && Math.hypot(f.x - h.x, f.z - h.z) < h.r + 2.4) return f; } return null; }
  near(x, z) { let best = null, bd = 7; for (const f of this.flyers) { const d = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = [f.x, f.z]; } } return best; }
  update(dt) { this.time += dt; for (const a of this.animals) if (a.visible) a.update(dt); }
  /* Who is somewhere it shouldn't be, right now. Empty means all is well. */
  check() {
    const bad = [];
    for (const a of this.animals) {
      if (!a.visible) continue; const h = a.hab;
      if (h.pool) { if (Math.hypot(a.x - h.pool.x, a.z - h.pool.z) > h.pool.r - a.r * 0.5) bad.push(a.name + " left the water"); }
      else { if (Math.hypot(a.x - h.x, a.z - h.z) > h.r + 0.05) bad.push(a.name + " left " + h.id); if (this.wet(a.x, a.z, 0)) bad.push(a.name + " is in the water"); for (const ob of h.obs || this.obstacles) if (Math.hypot(a.x - ob.x, a.z - ob.z) < ob.r + a.r * 0.45) bad.push(a.name + " is inside " + (ob.what || "something")); }
      for (const b of this.animals) if (b.id > a.id && b.visible && b.hab === h && Math.hypot(a.x - b.x, a.z - b.z) < (a.r + b.r) * 0.62) bad.push(a.name + " and " + b.name + " overlap");
    }
    return bad;
  }
}
