/* C.F.B. launch show: a stage reveal for the bunny, about 6 s after one tap.
   The head of index.html decides before paint whether it plays (html.intro-on): every launch,
   unless ?intro=0, the Profile switch is off, or the link opens one brand (#brand/...); ?intro=1 forces it.
   The gate ("Enter with sound" / "Enter quietly") gives the tap phones need before sound.
   Then the shots, as in a character reveal: an empty stage under a spotlight, close-ups that never
   show the whole star (the lipstick twisting up, ears in silhouette against a bright door, the paws,
   the face), one flash, the hero pose with hearts and the name card, and the bunny lands on Home's logo.
   Everything is drawn in code: the logo SVG (assets/logo.svg, every part has an id) is the star,
   the camera is its viewBox, the light is gradients, the sparkles are one canvas, the music is Web Audio.
   Each frame is a pure function of the time t, so CFBIntro.seek(t) shows any moment (tests use it).
   Home is drawn underneath from the start: the show never holds the app up. */
(function () {
  "use strict";
  const root = document.documentElement;
  const el = document.getElementById("intro");
  if (!el) return;
  const app = document.querySelector(".app");
  const $ = s => el.querySelector(s);
  const scene = $(".in-scene"), cv = $(".in-fx"), cx2 = cv.getContext("2d");
  const bg = $(".in-bg"), flash = $(".in-flash"), bars = el.querySelectorAll(".in-bars i");
  const gate = $(".in-gate"), skipBtn = $(".in-skip");
  const card = { box: $(".in-card"), name: $(".in-name"), label: $(".in-label"), slogan: $(".in-slogan") };
  const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const DAY_THEME = themeMeta ? themeMeta.content : "#FBF6F2";

  /* ---------- timing (seconds after the tap) ---------- */
  const T = { lip: 0.7, w1: 1.525, w2: 2.225, w3: 2.9, flash: 3.52, card: 3.85, exit: 5.4, end: 6.2 };

  /* ---------- small helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0 before a, 1 after b
  const eOut = p => 1 - Math.pow(1 - p, 3);
  const eInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const eBack = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const bump = (t, a, m, b) => t <= a || t >= b ? 0 : t < m ? (t - a) / (m - a) : (b - t) / (b - m);
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
  const SVGNS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  /* ---------- the star: the logo SVG, plus the stage around it ---------- */
  let svg = null, P = {};
  const ready = fetch("assets/logo.svg").then(r => r.ok ? r.text() : Promise.reject(r.status)).then(txt => {
    scene.innerHTML = txt;
    svg = scene.querySelector("svg");
    svg.removeAttribute("role"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("preserveAspectRatio", "none");
    const t = svg.querySelector("title"); if (t) t.remove();
    const defs = svg.querySelector("defs");
    defs.insertAdjacentHTML("beforeend", `
      <linearGradient id="gBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3E8" stop-opacity=".7"/><stop offset=".7" stop-color="#F7B7C3" stop-opacity=".22"/><stop offset="1" stop-color="#F28DA0" stop-opacity=".3"/></linearGradient>
      <radialGradient id="gDisc"><stop offset="0" stop-color="#FFE7EB"/><stop offset=".45" stop-color="#F7A9B7" stop-opacity=".85"/><stop offset="1" stop-color="#F28DA0" stop-opacity="0"/></radialGradient>
      <radialGradient id="gHalo"><stop offset="0" stop-color="#FFE8EC" stop-opacity=".9"/><stop offset=".6" stop-color="#F28DA0" stop-opacity=".35"/><stop offset="1" stop-color="#F28DA0" stop-opacity="0"/></radialGradient>
      <radialGradient id="gDoor" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#FFE8EC"/><stop offset=".7" stop-color="#F7A9B7" stop-opacity=".75"/><stop offset="1" stop-color="#F28DA0" stop-opacity="0"/></radialGradient>
      <filter id="fSil" x="-5%" y="-5%" width="110%" height="110%"><feFlood flood-color="#2A151B"/><feComposite in2="SourceAlpha" operator="in"/></filter>
      <filter id="fDim"><feComponentTransfer><feFuncR type="linear" slope=".7"/><feFuncG type="linear" slope=".52"/><feFuncB type="linear" slope=".58"/></feComponentTransfer></filter>`);
    const back = mk("g", { id: "stage" });
    back.append(
      mk("ellipse", { id: "door-halo", cx: 590, cy: 420, rx: 520, ry: 760, fill: "url(#gHalo)", opacity: .5 }),
      mk("rect", { id: "door", x: 410, y: 40, width: 360, height: 980, rx: 30, fill: "url(#gDoor)" }),
      mk("polygon", { id: "beam-soft", points: "520,-800 660,-800 1120,968 60,968", fill: "url(#gBeam)", opacity: .45 }),
      mk("polygon", { id: "beam", points: "565,-800 615,-800 990,968 190,968", fill: "url(#gBeam)" }),
      mk("ellipse", { id: "disc", cx: 590, cy: 968, rx: 470, ry: 78, fill: "url(#gDisc)" }));
    svg.querySelector("#hearts").before(back);
    const rings = mk("g", { id: "rings", fill: "none", stroke: "#FFE3E8" });
    rings.append(mk("ellipse", { id: "ring1", cx: 590, cy: 968, rx: 410, ry: 62, "stroke-width": 5, "stroke-dasharray": "46 22" }),
      mk("ellipse", { id: "ring2", cx: 590, cy: 968, rx: 470, ry: 76, "stroke-width": 3, "stroke-dasharray": "4 20", opacity: .55 }));
    svg.querySelector("#shadow").after(rings);
    ["stage", "door", "door-halo", "beam", "beam-soft", "disc", "rings", "ring1", "ring2", "hearts", "shadow", "bunny", "bullet",
      "cheeks", "eye-l", "eye-r", "mouth"].forEach(id => { P[id] = svg.querySelector("#" + id); });
    P.heartList = [...svg.querySelectorAll("#hearts use")].map(u => {
      const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(u.getAttribute("transform")) || [0, 0, 0, 1];
      return { u, x: +m[1], y: +m[2], s: +m[3] };
    });
    ["eye-l", "eye-r", "mouth"].forEach(id => { const n = P[id], L = n.getTotalLength ? n.getTotalLength() : 100; n.style.strokeDasharray = L; n.dataset.len = L; });
    resize();
  }).catch(() => { svg = null; });

  /* ---------- screen size and the camera ---------- */
  let W = 0, H = 0, D = 0, DPR = 1, wide = false;
  function resize() {
    W = innerWidth; H = innerHeight; D = Math.ceil(Math.hypot(W, H)); DPR = Math.min(2, window.devicePixelRatio || 1);
    wide = W / H > 1.15; el.classList.toggle("is-wide", wide);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    if (svg) Object.assign(svg.style, { width: D + "px", height: D + "px", left: (W - D) / 2 + "px", top: (H - D) / 2 + "px" });
    if (state === "show" && now > T.exit - 0.3) target = logoTarget();   // turned mid-landing: aim at the new spot
    if (state !== "idle") draw();
  }
  addEventListener("resize", resize);
  /* the hero framing: the bunny high on a phone (the card goes under it), left on a wide screen (the card goes right) */
  function heroCam(push) {
    const s = wide ? 1060 : 1000, k = Math.min(W, H) / s * (1 + push);
    const sx = wide ? W * 0.33 : W / 2, sy = wide ? H * 0.5 : H * 0.38;
    return { x: 590 - (sx - W / 2) / k, y: 600 - (sy - H / 2) / k, k };
  }
  /* where Home's logo is now, so the bunny can land on it */
  function logoTarget() {
    let best = null;
    document.querySelectorAll('.app img[src$="logo.svg"]').forEach(i => {
      const r = i.getBoundingClientRect();
      if (r.width > 8 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && (!best || r.width > best.width)) best = r;
    });
    return best;
  }
  let target = null;

  /* ---------- the shots: what the frame looks like at time t ---------- */
  function cameraAt(t) {
    // each shot: a world point at screen centre, a zoom (k = screen px per world unit), a tilt
    const m = Math.min(W, H);
    const shot = (x, y, size, tilt) => ({ x, y, k: m / size, tilt });
    let c;
    if (t < T.lip) {                         // 1. the empty stage, the spot clicks on
      const p = eOut(seg(t, -0.2, T.lip));
      c = shot(590, lerp(660, 640, p), lerp(1180, 1080, p), 0);
    } else if (t < T.w1) {                   // 2. the lipstick, upright, twisting up
      const p = eInOut(seg(t, T.lip, T.w1));
      c = shot(lerp(712, 768, p), lerp(690, 612, p), lerp(340, 250, p), -39);
    } else if (t < T.w2) {                   // 3. the ears against the bright door
      const p = eOut(seg(t, T.w1, T.w2));
      c = shot(590, lerp(360, 310, p), lerp(640, 560, p), lerp(5, 2, p));
    } else if (t < T.w3) {                   // 4. the paws hugging the lipstick
      const p = eOut(seg(t, T.w2, T.w3));
      c = shot(lerp(610, 594, p), lerp(818, 790, p), lerp(480, 400, p), lerp(10, 4, p));
    } else if (t < T.flash) {                // 5. the face: eyes, cheeks, smile
      const p = eOut(seg(t, T.w3, T.flash));
      c = shot(lerp(650, 590, p), lerp(622, 612, p), lerp(400, 350, p), lerp(-4, 0, p));
    } else {                                 // 6. the hero pose, slow push in
      const h = heroCam(0.06 * eOut(seg(t, T.flash, T.exit)));
      c = { x: h.x, y: h.y, k: h.k, tilt: 0 };
      if (t > T.exit && target) {             // 7. the bunny lands on Home's logo
        const p = eInOut(seg(t, T.exit + 0.05, T.end - 0.05));
        const kT = target.width / 880, k = Math.exp(lerp(Math.log(c.k), Math.log(kT), p));
        const a0x = W / 2 + (590 - c.x) * c.k, a0y = H / 2 + (590 - c.y) * c.k;          // the logo's centre on screen
        const a1x = target.left + target.width / 2, a1y = target.top + target.height / 2;
        const ax = lerp(a0x, a1x, p), ay = lerp(a0y, a1y, p);
        c = { x: 590 - (ax - W / 2) / k, y: 590 - (ay - H / 2) / k, k, tilt: 0 };
      }
    }
    // whip pans between close-ups: blur, and the frame flies out one side and in the other
    c.blur = 0; c.dx = 0;
    for (const w of [T.w1, T.w2, T.w3]) {
      const o = seg(t, w - 0.08, w), i = seg(t, w, w + 0.08);
      if (t > w - 0.08 && t < w) { c.dx = -eOut(o) * o * W * 0.55; c.blur = o * 16; }
      if (t >= w && t < w + 0.08) { c.dx = (1 - eOut(i)) * W * 0.55; c.blur = (1 - i) * 16; }
    }
    return c;
  }
  const toScreen = (c, x, y) => {
    const vx = (x - c.x) * c.k, vy = (y - c.y) * c.k, a = c.tilt * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    return [W / 2 + c.dx + vx * cs - vy * sn, H / 2 + vx * sn + vy * cs];
  };

  /* ---------- particles: all pure functions of time ---------- */
  const R = rng(20261111);
  const DUST = Array.from({ length: 70 }, () => ({ u: R(), v: R(), sp: 0.4 + R(), ph: R() * 6.3, r: 0.6 + R() * 1.6 }));
  const SPARK = [];          // {t, x, y (world), r (px), life}
  [[823, 547, 26, 1.33], [800, 590, 12, 1.38], [850, 520, 10, 1.42]].forEach(([x, y, r, t]) => SPARK.push({ t, x, y, r, life: 0.55 }));
  [[430, 760], [770, 740], [600, 700], [710, 880], [470, 880]].forEach(([x, y], i) => SPARK.push({ t: T.w2 + 0.1 + i * 0.11, x, y, r: 14, life: 0.5 }));
  [[468, 650], [712, 650]].forEach(([x, y], i) => SPARK.push({ t: 3.2 + i * 0.05, x: x + (i ? 30 : -30), y: y - 30, r: 16, life: 0.45 }));
  for (let i = 0; i < 26; i++) SPARK.push({ t: T.flash + 0.05 + R() * 1.8, x: 260 + R() * 660, y: 200 + R() * 700, r: 8 + R() * 14, life: 0.5 + R() * 0.4 });
  const FLOAT = Array.from({ length: 16 }, () => ({ t: T.w1 + R() * 0.55, x: 0.2 + R() * 0.6, sp: 0.35 + R() * 0.35, s: 5 + R() * 8, ph: R() * 6.3 }));
  const CONF = Array.from({ length: 48 }, () => ({ t: T.flash + R() * 0.9, x: R(), sp: 0.16 + R() * 0.16, s: 5 + R() * 8, ph: R() * 6.3, c: R() }));
  const BURSTS = [[T.flash + 0.06, 0.22, 0.17, "#FFE3E8"], [T.flash + 0.3, 0.8, 0.12, "#F7B7C3"], [T.flash + 0.68, 0.52, 0.07, "#F6D9C4"]]
    .map(([t, x, y, col]) => ({ t, x, y, col, parts: Array.from({ length: 30 }, (_, i) => ({ a: i / 30 * Math.PI * 2 + R() * 0.15, v: 0.8 + R() * 0.45, heart: i % 3 === 0 })) }));

  function heartPath(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 24, s / 24);
    g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-6, 5, -12, 0, -12, -5); g.bezierCurveTo(-12, -10, -8, -12, -6, -12);
    g.bezierCurveTo(-3, -12, -1, -10, 0, -8); g.bezierCurveTo(1, -10, 3, -12, 6, -12); g.bezierCurveTo(8, -12, 12, -10, 12, -5);
    g.bezierCurveTo(12, 0, 6, 5, 0, 10); g.fill(); g.restore();
  }
  function glint(g, x, y, r, a) {   // a four-point star with a soft glow
    g.globalAlpha = a;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.4); gr.addColorStop(0, "rgba(255,240,243,.9)"); gr.addColorStop(1, "rgba(242,141,160,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.4, 0, 6.3); g.fill();
    g.fillStyle = "#FFF8F7"; g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }

  /* ---------- one frame ---------- */
  let state = "idle", t0 = 0, now = 0, skipAt = null, sound = null, still = false;
  const store = window.CFB && window.CFB.store;

  /* ---------- the film: version 2, a rendered cut played over the scene above ----------
     When the film is ready at the tap it plays; the drawn show stays underneath, parked on its hero pose, and
     takes over for the landing on Home. The drawn show plays alone when the film is not loaded yet, on reduced
     motion, with data saver on, or if the film fails or stalls. */
  const vid = el.querySelector(".in-film");
  const FILM = { src: "assets/video/launch.mp4", card: 15.5, tail: 1.15, hold: 0.4 };
  let filmOn = false, filmAt = -1, filmMoved = 0;
  const saver = () => { const c = navigator.connection; return !!(c && c.saveData); };
  function filmLoad() {                          // called when the gate opens, so the film buffers while it shows
    if (!vid) return;
    vid.pause(); vid.classList.remove("is-on"); filmOn = false; el.classList.remove("is-film", "is-filmcard");
    if (reduce() || saver()) return;
    try {
      if (!vid.getAttribute("src")) { vid.preload = "auto"; vid.src = FILM.src; vid.load(); }
      else if (vid.readyState > 0) vid.currentTime = 0;        // a replay: back to the first frame
    } catch (_) {}
  }
  const filmReady = () => !!vid && !vid.error && !!vid.getAttribute("src") && vid.readyState >= 3 && !vid.seeking && isFinite(vid.duration);
  /* start it inside the tap (phones only start video with sound from one); false means: play the drawn show */
  function filmPlay(withSound) {
    if (!filmReady() || reduce() || saver()) return false;
    let p;
    try { vid.muted = !withSound; vid.volume = 1; p = vid.play(); } catch (_) { return false; }
    filmOn = true; filmAt = -1; filmMoved = performance.now(); vid.classList.add("is-on");
    el.classList.add("is-film", "is-filmcard");               // the drawn scene hides under the film; the card sits on the film
    if (p && p.catch) p.catch(() => { if (filmOn) filmHandover(true); });
    // ask the offline worker to keep the film (on a first visit it was fetched before the worker was in charge)
    try { if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage("save-film"); }).catch(() => {}); } catch (_) {}
    return true;
  }
  /* the film is over, skipped or stuck: the drawn bunny, already in its hero pose underneath, flies to Home */
  function filmHandover(fast) {
    if (!filmOn) return;
    filmOn = false;
    vid.classList.remove("is-on"); el.classList.remove("is-film");
    if (fast) { vid.muted = true; vid.pause(); }               // a natural end lets the last chord ring out
    target = logoTarget(); paused = false;
    const from = fast ? T.exit : T.exit - FILM.hold;
    t0 = performance.now() - from * 1000; now = from; skipAt = fast ? from : null;
  }
  if (vid) {
    vid.addEventListener("error", () => filmHandover(true));
    vid.addEventListener("ended", () => filmHandover(false));
  }
  const BEAM_GATE = 0.32;
  function draw() {
    const t = state === "gate" ? -1 : now;
    const wall = performance.now() / 1000;
    if (!svg) return;
    const c = state === "gate" ? cameraAt(-0.2) : cameraAt(t);
    const vw = D / c.k;
    svg.setAttribute("viewBox", `${c.x - vw / 2} ${c.y - vw / 2} ${vw} ${vw}`);
    svg.style.transform = `translateX(${c.dx}px) rotate(${c.tilt}deg)`;
    svg.style.filter = c.blur > 0.3 ? `blur(${c.blur.toFixed(1)}px)` : "";

    // the spotlight: off, a click and a flicker, on; dimmer in the close-ups, full on the hero; out at the end
    const flick = t < 0 ? BEAM_GATE : t < 0.05 ? 0 : t < 0.3 ? [1, .2, .9, .35, 1][Math.floor((t - 0.05) / 0.05)] || 1 : 1;
    const out = 1 - seg(t, T.exit, T.exit + 0.4);
    const inClose = t >= T.lip && t < T.flash;
    const beam = (inClose ? 0 : flick) * out;
    P.beam.setAttribute("opacity", beam); P["beam-soft"].setAttribute("opacity", 0.45 * beam);
    P.disc.setAttribute("opacity", (t < 0 ? 0.35 : t >= T.flash ? 0.9 + (still ? 0 : 0.1 * Math.sin(wall * 3)) : inClose ? 0 : flick) * out);
    const door = t >= T.w1 && t < T.w2 ? 1 : 0;
    P.door.setAttribute("opacity", door); P["door-halo"].setAttribute("opacity", 0.5 * door);
    // the star: hidden on the empty stage, dim in the lipstick shot, a silhouette at the door
    const showStar = t >= T.lip;
    P.bunny.setAttribute("opacity", showStar ? 1 : 0);
    P.bunny.setAttribute("filter", door ? "url(#fSil)" : t >= T.lip && t < T.w1 ? "url(#fDim)" : "");
    P.shadow.setAttribute("opacity", t >= T.flash ? 1 : t >= T.w2 ? 1 : 0);
    const rings = t >= T.flash ? seg(t, T.flash, T.flash + 0.4) * out : 0;
    P.rings.setAttribute("opacity", rings);
    if (!still) { P.ring1.setAttribute("stroke-dashoffset", (-wall * 60).toFixed(1)); P.ring2.setAttribute("stroke-dashoffset", (wall * 40).toFixed(1)); }
    // the lipstick twists up out of its tube
    const rise = t < T.lip ? 0 : eOut(seg(t, T.lip + 0.15, T.lip + 0.65));
    P.bullet.setAttribute("transform", `translate(0 ${((1 - rise) * 172).toFixed(1)})`);
    // the face: eyes close happy, cheeks pop, the smile draws (before then, a blank face)
    const face = t >= T.flash ? 1 : 0;
    const eyes = Math.max(face, eOut(seg(t, T.w3 + 0.05, T.w3 + 0.25)));
    const line = (n, p) => { n.style.strokeDashoffset = (+n.dataset.len * (1 - p)).toFixed(1); n.style.visibility = p > 0.02 ? "" : "hidden"; };   // hidden at 0: a round cap would leave a dot
    line(P["eye-l"], eyes); line(P["eye-r"], eyes);
    line(P.mouth, Math.max(face, eOut(seg(t, 3.22, 3.42))));
    const ck = Math.max(face, eBack(seg(t, 3.12, 3.3)));
    P.cheeks.setAttribute("transform", `translate(590 650) scale(${ck.toFixed(3)}) translate(-590 -650)`);
    P.cheeks.setAttribute("opacity", ck > 0.01 ? 1 : 0);
    // the logo's hearts pop in around the hero
    P.heartList.forEach((h, i) => {
      const p = t >= T.end ? 1 : eBack(seg(t, T.flash + 0.12 + i * 0.07, T.flash + 0.42 + i * 0.07));
      h.u.setAttribute("transform", `translate(${h.x} ${h.y}) scale(${(h.s * p).toFixed(3)})`);
    });

    // the flash, the letterbox bars, the name card
    flash.style.opacity = Math.max(bump(t, T.flash - 0.07, T.flash, T.flash + 0.38), 0).toFixed(3);
    const barIn = state === "gate" ? 0 : eOut(seg(t, 0, 0.4)) * (1 - eOut(seg(t, T.exit, T.exit + 0.35)));
    bars.forEach(b => { b.style.transform = `scaleY(${barIn.toFixed(3)})`; });
    const cardOut = 1 - seg(t, T.exit, T.exit + 0.25);
    const slam = seg(t, T.card, T.card + 0.18);
    card.box.style.opacity = (t >= T.card ? 1 : 0) * cardOut;
    card.name.style.opacity = slam; card.name.style.transform = `scale(${lerp(1.5, 1, eOut(slam)).toFixed(3)})`;
    card.label.style.opacity = seg(t, T.card + 0.2, T.card + 0.45);
    const wr = eInOut(seg(t, T.card + 0.4, T.card + 1.05));
    card.slogan.style.clipPath = `inset(-10% ${((1 - wr) * 100).toFixed(1)}% -10% 0)`;
    if (filmOn) {                                 // over the film the same card arrives on the film's own beat
      const ft = vid.currentTime, a = seg(ft, FILM.card, FILM.card + 0.18);
      card.box.style.opacity = ft >= FILM.card ? 1 : 0;
      card.name.style.opacity = a; card.name.style.transform = `scale(${lerp(1.5, 1, eOut(a)).toFixed(3)})`;
      card.label.style.opacity = seg(ft, FILM.card + 0.2, FILM.card + 0.45);
      card.slogan.style.clipPath = `inset(-10% ${((1 - eInOut(seg(ft, FILM.card + 0.4, FILM.card + 1.05))) * 100).toFixed(1)}% -10% 0)`;
      flash.style.opacity = 0;
    }

    const sk = 1 - seg(t, T.exit, T.exit + 0.2);
    skipBtn.style.opacity = sk; skipBtn.style.pointerEvents = sk < 1 ? "none" : "";

    // the iris: the night opens around the bunny onto Home
    const iris = eInOut(seg(t, T.exit + 0.05, T.end - 0.1));
    if (iris > 0) {
      const [ax, ay] = toScreen(c, 590, 590), r = iris * Math.hypot(W, H) * 1.1;
      const m = `radial-gradient(circle at ${ax.toFixed(0)}px ${ay.toFixed(0)}px, transparent ${r.toFixed(0)}px, #000 ${(r + 80).toFixed(0)}px)`;
      bg.style.webkitMaskImage = bg.style.maskImage = m;
    } else bg.style.webkitMaskImage = bg.style.maskImage = "";
    svg.style.opacity = t > T.exit && !target ? (1 - iris).toFixed(3) : "";   // nowhere to land: the bunny fades with the night

    // the canvas: dust in the beam, sparkles, hearts in the door light, fireworks, confetti
    const g = cx2; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    if (still || filmOn) return;
    g.globalCompositeOperation = "lighter";
    if (beam > 0.05) {
      for (const d of DUST) {
        const y = -200 + ((d.v * 1170 - wall * d.sp * 22) % 1170 + 1170) % 1170, half = lerp(25, 400, (y + 800) / 1768);
        const x = 590 + (d.u * 2 - 1) * half * 0.9 + Math.sin(wall * 0.7 + d.ph) * 14;
        const [sx, sy] = toScreen(c, x, y); g.globalAlpha = beam * 0.55 * (0.5 + 0.5 * Math.sin(wall * 2 + d.ph));
        g.fillStyle = "#FFE3E8"; g.beginPath(); g.arc(sx, sy, d.r, 0, 6.3); g.fill();
      }
    }
    for (const s of SPARK) {
      const p = (t - s.t) / s.life; if (p <= 0 || p >= 1) continue;
      const [sx, sy] = toScreen(c, s.x, s.y); glint(g, sx, sy, s.r * Math.sin(Math.PI * p), Math.sin(Math.PI * p) * out);
    }
    // the lipstick's glint: a long horizontal flare across the frame
    const fl = bump(t, 1.3, 1.36, 1.55);
    if (fl > 0) {
      const [sx, sy] = toScreen(c, 823, 547), gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, "rgba(242,141,160,0)"); gr.addColorStop(clamp(sx / W, 0.01, 0.99), "rgba(255,244,246,.95)"); gr.addColorStop(1, "rgba(242,141,160,0)");
      g.globalAlpha = fl; g.fillStyle = gr; g.fillRect(0, sy - 1.5, W, 3); glint(g, sx, sy, 34 * fl, fl);
    }
    g.fillStyle = "#FFF4F6";
    for (const f of FLOAT) {
      const dt = t - f.t; if (dt <= 0 || t > T.w2) continue;
      g.globalAlpha = Math.min(1, dt * 4) * 0.85;
      heartPath(g, (f.x + Math.sin(dt * 3 + f.ph) * 0.03) * W, H * (0.95 - dt * f.sp), f.s, Math.sin(dt * 2 + f.ph) * 0.4);
    }
    for (const b of BURSTS) {
      const dt = t - b.t; if (dt <= 0 || dt > 1.3) continue;
      const m = Math.min(W, H) * 0.42, cxp = b.x * W, cyp = b.y * H;
      g.fillStyle = b.col; g.strokeStyle = b.col; g.lineWidth = 1.4;
      for (const q of b.parts) {
        const reach = m * q.v * (1 - Math.exp(-3 * dt)), fall = 0.5 * 0.12 * H * dt * dt;
        const px = cxp + Math.cos(q.a) * reach, py = cyp + Math.sin(q.a) * reach + fall;
        const a = (1 - dt / 1.3) * out; g.globalAlpha = a;
        const r2 = m * q.v * (1 - Math.exp(-3 * Math.max(0, dt - 0.07))), tx = cxp + Math.cos(q.a) * r2, ty = cyp + Math.sin(q.a) * r2 + 0.5 * 0.12 * H * (dt - 0.07) ** 2;
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(px, py); g.globalAlpha = a * 0.5; g.stroke(); g.globalAlpha = a;
        if (q.heart) heartPath(g, px, py, 9, q.a); else { g.beginPath(); g.arc(px, py, 1.8, 0, 6.3); g.fill(); }
      }
    }
    g.globalCompositeOperation = "source-over";
    const COLS = ["#FFF4F6", "#F7B7C3", "#EFA9AE", "#F6D9C4"];
    for (const f of CONF) {
      const dt = t - f.t; if (dt <= 0) continue;
      g.globalAlpha = Math.min(1, dt * 5) * out; g.fillStyle = COLS[Math.floor(f.c * 4)];
      heartPath(g, (f.x + Math.sin(dt * 2.2 + f.ph) * 0.04) * W, -20 + dt * f.sp * H, f.s, f.ph + dt * 1.6);
    }
    g.globalAlpha = 1;
  }

  /* ---------- the clock ---------- */
  let raf = 0, paused = false;
  function loop() {
    raf = 0;
    if (state === "idle") return;
    if (state === "show" && filmOn) {
      // the film's own clock: near its end the drawn show takes over; frozen for 1.5 s (a dead connection), the same, fast
      const ft = vid.currentTime, wall = performance.now();
      if (ft !== filmAt) { filmAt = ft; filmMoved = wall; }
      if (ft >= vid.duration - FILM.tail) filmHandover(false);
      else if (wall - filmMoved > 1500) filmHandover(true);
    }
    if (state === "show" && !paused) {
      now = (performance.now() - t0) / 1000;
      if (skipAt !== null) now = T.exit + (now - skipAt) * 1.6;    // a skip runs the landing a little faster
      if (now >= T.end) return finish(true);
    }
    try { draw(); } catch (e) { return finish(); }   // a drawing error must never trap anyone behind the show
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  /* every pending timer, so a skip or a replay never inherits an old one */
  let timers = [], replayed = false, pendingCtx = null;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function open(fromReplay) {
    clearTimers(); replayed = !!fromReplay;
    state = "gate"; now = -1; skipAt = null; still = false; gate.inert = false;
    root.classList.add("intro-on");
    el.style.opacity = ""; el.hidden = false;
    gate.classList.remove("is-gone"); skipBtn.hidden = true;
    if (app) app.inert = true;
    if (themeMeta) themeMeta.content = "#1C0F13";
    filmLoad();
    resize(); kick();
    const b = gate.querySelector("[data-sound=on]"); if (b) b.focus({ preventScroll: true });
  }
  function start(withSound) {
    if (state !== "gate") return;
    state = "starting";                                     // further taps now skip; they can't start it twice
    gate.classList.add("is-gone"); gate.inert = true;
    if (svg && filmPlay(withSound)) {                       // the film is ready: it plays, the drawn show waits under it
      target = null; state = "show"; skipBtn.hidden = false; skipBtn.focus({ preventScroll: true });
      paused = true; now = T.exit - FILM.hold; kick();
      return;
    }
    pendingCtx = withSound ? Sound.context() : null;        // made inside the tap: iOS only starts sound from one
    const go = () => {
      if (state !== "starting") return;
      const ctx = pendingCtx; pendingCtx = null;
      if (!svg) { if (ctx) ctx.close().catch(() => {}); return finish(); }   // no star to show: straight to Home
      target = null; state = "show"; skipBtn.hidden = false; skipBtn.focus({ preventScroll: true });
      if (reduce()) return stillShow(ctx);
      const lead = 0.08;
      if (ctx) sound = Sound.play(ctx, lead, 0);
      t0 = performance.now() + lead * 1000; now = -lead;
      later(() => { target = logoTarget(); }, (T.exit - 0.3 + lead) * 1000);
      kick();
    };
    // the logo is normally loaded long before the tap; on a slow first visit, wait at most 1.5 s
    if (svg) go(); else Promise.race([ready, new Promise(r => setTimeout(r, 1500))]).then(go);
  }
  /* reduced motion: the finished hero pose, held, then a soft fade to Home */
  function stillShow(ctx) {
    still = true; paused = true; now = T.exit - 0.01; draw();
    if (ctx) sound = Sound.play(ctx, 0.05, T.flash - 0.05);
    later(() => { el.style.transition = "opacity .6s ease"; el.style.opacity = "0"; later(finish, 620); }, 1600);
  }
  function skip() {
    if (state !== "show") return;
    if (filmOn) return filmHandover(true);
    if (still) return finish();
    if (sound) { sound.fade(); sound = null; }
    if (now < T.exit) { target = logoTarget(); skipAt = (performance.now() - t0) / 1000; }
  }
  function finish(natural) {
    if (state === "idle") return;
    clearTimers();
    state = "idle"; paused = false; still = false;
    if (vid) { if (filmOn || !natural) { vid.muted = true; vid.pause(); } filmOn = false; vid.classList.remove("is-on"); el.classList.remove("is-film", "is-filmcard"); }
    if (sound && !natural) sound.fade();                   // at the natural end the landing chime rings out on its own
    sound = null;
    if (pendingCtx) { pendingCtx.close().catch(() => {}); pendingCtx = null; }
    root.classList.remove("intro-on");
    el.style.transition = ""; el.style.opacity = "";
    bg.style.webkitMaskImage = bg.style.maskImage = "";
    if (app) app.inert = false;
    if (themeMeta) themeMeta.content = DAY_THEME;
    // focus back into the app: the Replay button after a replay, else the screen's heading
    const f = replayed ? document.getElementById("intro-replay") : document.querySelector(".app [data-screen]:not([hidden]) h1");
    if (f) f.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("cfb:intro-done"));
  }

  /* ---------- taps ---------- */
  gate.querySelectorAll("[data-sound]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); start(b.dataset.sound === "on"); }));
  skipBtn.addEventListener("click", e => { e.stopPropagation(); skip(); });
  // a tap anywhere: with sound on the gate, skip after it
  el.addEventListener("click", () => { if (state === "gate") start(true); else if (state === "starting") finish(); else skip(); });
  addEventListener("keydown", e => { if (e.key !== "Escape") return; if (state === "gate") start(false); else if (state === "starting") finish(); else skip(); });

  /* ---------- the music: made in code (Web Audio), original ----------
     A spot click and a low swell, the lipstick's twist (ticks), a sparkle, whooshes on the cuts, a four-beat build
     at 120 bpm, a boom on the flash, then a bright D major 9 chord with a bell run up, which fades as Home opens. */
  const Sound = {
    context() {
      try { const c = new (window.AudioContext || window.webkitAudioContext)(); if (c.state === "suspended") c.resume(); return c; } catch (_) { return null; }
    },
    play(ctx, lead, from) {
      const base = ctx.currentTime + lead - from;
      const at = s => base + s;
      const master = ctx.createGain(); master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
      const ir = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
      const rev = ctx.createConvolver(); rev.buffer = ir; const revG = ctx.createGain(); revG.gain.value = 0.32; rev.connect(revG); revG.connect(master);
      const skipBefore = from - 0.05;
      const ok = s => s >= skipBefore;
      const env = (g, s, a, peak, d, sus = 0.0001) => { g.gain.setValueAtTime(0.0001, at(s)); g.gain.exponentialRampToValueAtTime(peak, at(s) + a); g.gain.exponentialRampToValueAtTime(sus, at(s) + a + d); };
      const noise = (s, dur, type, f0, f1, peak, q = 1, wet = 0) => {
        if (!ok(s)) return;
        const src = ctx.createBufferSource(); src.buffer = nb; const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(f0, at(s)); f.frequency.exponentialRampToValueAtTime(f1, at(s) + dur);
        const g = ctx.createGain(); env(g, s, Math.min(0.02, dur / 3), peak, dur);
        src.connect(f); f.connect(g); g.connect(master); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(rev); }
        src.start(at(s)); src.stop(at(s) + dur + 0.05);
      };
      const tone = (s, dur, type, f0, f1, peak, a = 0.005, wet = 0, cut = 0) => {
        if (!ok(s)) return;
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at(s)); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at(s) + dur * 0.6);
        const g = ctx.createGain(); env(g, s, a, peak, dur); let node = o;
        if (cut) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cut; o.connect(f); node = f; }
        node.connect(g); g.connect(master); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(rev); }
        o.start(at(s)); o.stop(at(s) + a + dur + 0.05);
      };
      const bell = (s, f, peak = 0.12) => { tone(s, 1.4, "sine", f, f, peak, 0.004, 0.8); tone(s, 0.5, "sine", f * 2.76, f * 2.76, peak * 0.25, 0.002, 0.8); };
      const kick = (s, peak = 0.9) => tone(s, 0.4, "sine", 150, 42, peak, 0.002);
      const hat = (s, peak = 0.08) => noise(s, 0.05, "highpass", 7000, 9000, peak);
      // 1. the spot: a click, a thump, a low swell
      noise(0.05, 0.04, "highpass", 2500, 2500, 0.5); tone(0.05, 0.14, "sine", 95, 40, 0.5);
      if (ok(0.1)) {
        [73.42, 110, 146.83].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = (i - 1) * 7;
          const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(220, at(0.1)); lp.frequency.exponentialRampToValueAtTime(1600, at(1.45));
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(0.1)); g.gain.exponentialRampToValueAtTime(0.07, at(1.2)); g.gain.exponentialRampToValueAtTime(0.0001, at(1.6));
          o.connect(lp); lp.connect(g); g.connect(master); o.start(at(0.1)); o.stop(at(1.7));
        });
      }
      // 2. the lipstick twists up (ticks), then a sparkle
      for (let i = 0; i < 9; i++) noise(0.86 + i * 0.055, 0.025, "bandpass", 3200 + i * 120, 3200 + i * 120, 0.18, 6);
      bell(1.34, 1760, 0.14); bell(1.4, 2349.3, 0.08);
      // 3. whooshes on the cuts
      [T.w1, T.w2, T.w3].forEach(w => noise(w - 0.12, 0.24, "bandpass", 500, 5000, 0.35, 1.2, 0.3));
      // 4. the build: kick and bass on the beat, hats getting faster
      [[1.52, 73.42], [2.02, 73.42], [2.52, 61.74], [3.02, 55]].forEach(([s, f]) => { kick(s); tone(s, 0.42, "sawtooth", f, f, 0.12, 0.01, 0, 400); });
      for (let s = 1.77; s < 2.5; s += 0.5) hat(s);
      for (let s = 2.52; s < 3.0; s += 0.125) hat(s, 0.07);
      for (let s = 3.02; s < 3.48; s += 0.0625) hat(s, 0.05 + (s - 3) * 0.12);
      noise(2.9, 0.6, "bandpass", 400, 6000, 0.12, 1.5);                       // riser into the flash
      tone(3.15, 0.12, "sine", 600, 1300, 0.12);                                  // the cheeks pop
      // 5. the flash: a boom, a crash, the hero chord, a bell run up
      kick(T.flash, 1); tone(T.flash, 1.1, "sine", 55, 38, 0.6, 0.004);
      noise(T.flash, 1.5, "lowpass", 9000, 1800, 0.35, 0.7, 0.6);
      [146.83, 185, 220, 277.18, 329.63, 440].forEach((f, i) => { tone(T.flash, 4.2, "sawtooth", f, f, 0.045, 0.02, 0.5, 2600); tone(T.flash, 4.2, "triangle", f * 2, f * 2, 0.03, 0.02, 0.5); });
      [587.33, 739.99, 880, 1108.73, 1318.51, 1760, 2217.46].forEach((f, i) => bell(T.flash + 0.08 + i * 0.07, f, 0.1));
      tone(T.card, 0.3, "sine", 120, 60, 0.4, 0.003); noise(T.card, 0.5, "highpass", 6000, 9000, 0.06, 1, 0.6);
      [1318.51, 1760, 2217.46].forEach((f, i) => bell(T.card + 0.45 + i * 0.12, f, 0.06));
      // a chime as the bunny lands on the logo, then out
      bell(T.end - 0.18, 1760, 0.09); bell(T.end - 0.1, 2637.02, 0.06);
      master.gain.setValueAtTime(0.8, at(T.end)); master.gain.exponentialRampToValueAtTime(0.0001, at(T.end + 0.9));
      setTimeout(() => ctx.close().catch(() => {}), (T.end + 1.5 - from + lead) * 1000);
      return { fade() { try { const n = ctx.currentTime; master.gain.cancelScheduledValues(n); master.gain.setValueAtTime(master.gain.value, n); master.gain.exponentialRampToValueAtTime(0.0001, n + 0.3); setTimeout(() => ctx.close().catch(() => {}), 500); } catch (_) {} } };
    }
  };

  /* ---------- Profile: replay, and the launch switch ---------- */
  const sw = document.getElementById("intro-switch");
  if (sw && store) {
    sw.checked = store.get("intro", "on") !== "off";
    sw.addEventListener("change", () => store.set("intro", sw.checked ? "on" : "off"));
  }
  const rp = document.getElementById("intro-replay");
  if (rp) rp.addEventListener("click", () => { if (state === "idle") open(true); });

  /* tests and the Profile replay */
  window.CFBIntro = {
    replay: () => { if (state === "idle") open(true); },
    film: () => ({ on: filmOn, ready: filmReady(), time: vid ? vid.currentTime : 0, muted: vid ? vid.muted : true, paused: vid ? vid.paused : true }),
    seek: s => ready.then(() => { if (state === "idle") open(); state = "show"; paused = true; gate.classList.add("is-gone"); now = s; if (s > T.exit) target = target || logoTarget(); draw(); }),
    T
  };
  if (root.classList.contains("intro-on")) open();
})();
