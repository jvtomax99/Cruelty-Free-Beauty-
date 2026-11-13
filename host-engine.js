/* C.F.B. Home's host: how the girl on the hello banner moves (after Dr Smiley in Jose's Interpreter Hub).
   She is one base picture (assets/host/base.webp) and a strip of face frames (assets/host/face.webp:
   eyes, brows and mouth only) shown through a window over the base and swapped outright, never faded.
   One controller owns her face. Priorities: a reaction beats a gaze beats a blink.
   She blinks at random, her eyes follow a finger or the mouse, a tap on her plays a smile or a wink,
   and she reacts to a scan result (cfb:scan) and a Sanctuary answer (cfb:answer). Those happen on other
   screens, so the newest one is kept in memory and played when Home is next on view.
   She only makes faces: she never words a verdict (CFB.verdict does) and nothing is stored.
   Reduced motion: she rests on the base. Data saver: the page never asks for the strip (the offline
   worker still saves it with the rest of the app, as it saved the old loop). */
(function () {
  "use strict";
  const CFB = window.CFB;
  const el = document.querySelector(".hb-host");
  if (!el) return;
  const face = el.querySelector(".hb-face");

  /* The strip's frames, left to right: the same list as FRAMES in tools/make-host.py. */
  const FRAMES = ["rest", "half", "shut", "wink", "smile", "laugh", "love", "surprised", "sad", "worried",
    "lookL", "lookR", "lookU", "lookD"];
  const STRIP = "assets/host/face.webp";
  const P = { IDLE: 0, GAZE: 1, REACT: 2 };

  /* A sequence is [frame, how long it holds in ms]; she goes back to her resting look after the last. */
  const SEQ = {
    blink: [["half", 45], ["shut", 80], ["half", 45]],
    blink2: [["half", 45], ["shut", 70], ["half", 40], ["rest", 110], ["half", 40], ["shut", 70], ["half", 45]],
    wink: [["half", 40], ["wink", 620], ["half", 40]],
    smile: [["smile", 950]],
    happy: [["smile", 240], ["laugh", 900], ["smile", 320]],
    love: [["smile", 200], ["love", 1000], ["smile", 220]],
    surprised: [["surprised", 1100]],
    sad: [["half", 60], ["sad", 1400], ["half", 60]],
    worried: [["worried", 1150]]
  };
  const ON_SCAN = { pass: "happy", fail: "sad", none: "surprised", unlisted: "surprised" };   // from CFB.verdict's kind
  const KEEP_MS = 10 * 60e3;        // a reaction waiting for Home is dropped after this
  const GAZE_HOLD = 1500;           // she looks back at you this long after the pointer last moved
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const saver = () => { const c = navigator.connection; return !!(c && c.saveData); };

  let live = false, shown = "rest";
  let run = null;                   // the sequence playing: { name, pri, steps, t0, timer }
  let gaze = "rest", gazeTimer = 0, blinkTimer = 0, waiting = null, lastTap = "wink";
  let rand = Math.random, home = true;   // home: Home is the screen on view

  const seen = () => live && home && !document.hidden && el.offsetParent !== null && !document.documentElement.classList.contains("intro-on");
  function show(name) {
    const i = FRAMES.indexOf(name);
    if (i < 0 || !face) return;
    shown = name;
    face.style.backgroundPositionX = (i / (FRAMES.length - 1) * 100) + "%";
    if (window.__hostProbe) window.__hostProbe.push({ name, at: performance.now(), due: run ? run.t0 + run.due : null });
  }

  /* Each frame is due at a fixed time from the sequence's start, and the next timer aims at the next due
     time, never "so long after this one fired": a late timer doesn't push the rest back, and a stall
     skips the frames whose time has passed (never the last) instead of stretching the performance. */
  function play(name, pri) {
    const steps = SEQ[name];
    if (!steps || !seen() || still.matches) return false;
    if (run && run.pri > pri) return false;
    stop();
    let t = 0;
    const at = steps.map(([frame, ms]) => { const s = { frame, due: t }; t += ms; return s; });
    run = { name, pri, at, end: t, t0: performance.now(), due: 0, timer: 0 };
    step();
    return true;
  }
  function step() {
    const r = run; if (!r) return;
    const now = performance.now() - r.t0;
    if (now >= r.end) { run = null; show(gaze); return; }
    let i = 0;
    while (i + 1 < r.at.length && r.at[i + 1].due <= now) i++;
    r.due = r.at[i].due;
    if (shown !== r.at[i].frame || now === 0) show(r.at[i].frame);
    const next = i + 1 < r.at.length ? r.at[i + 1].due : r.end;
    r.timer = setTimeout(step, Math.max(0, r.t0 + next - performance.now()));
  }
  function stop() { if (run) { clearTimeout(run.timer); run = null; } }
  function rest() { stop(); clearTimeout(gazeTimer); gaze = "rest"; show("rest"); }

  /* Blinks: 2 to 6 s apart, picked afresh each time, so never on a beat. Now and then a double one. */
  function blinkSoon() {
    clearTimeout(blinkTimer);
    if (!home || document.hidden || still.matches) return;      // started again when Home or the page comes back
    blinkTimer = setTimeout(() => {
      if (seen() && !still.matches && gaze === "rest") play(rand() < 0.15 ? "blink2" : "blink", P.IDLE);
      blinkSoon();
    }, 2000 + rand() * 4000);
  }

  /* Gaze: towards the pointer, by the stronger axis; on her own face she looks at you. */
  function look(x, y) {
    if (!home || !seen() || still.matches) return;
    const r = el.getBoundingClientRect();
    const dx = x - (r.left + r.width * 0.5), dy = y - (r.top + r.height * 0.36);
    const near = Math.hypot(dx, dy) < r.width * 0.3;
    const to = near ? "rest" : Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? "lookL" : "lookR") : (dy < 0 ? "lookU" : "lookD");
    clearTimeout(gazeTimer);
    gazeTimer = setTimeout(() => { gaze = "rest"; if (!run) show("rest"); }, GAZE_HOLD);
    if (to === gaze) return;
    gaze = to;
    if (!run || run.pri < P.GAZE) { stop(); show(gaze); }
  }

  function react(name) {
    if (!SEQ[name]) return;
    if (!play(name, P.REACT)) waiting = { name, t: Date.now() };   // not on view: Home plays it when it opens
  }
  function arrive() {
    if (!waiting) return;
    const w = waiting;
    if (Date.now() - w.t > KEEP_MS) { waiting = null; return; }
    setTimeout(() => { if (waiting === w && play(w.name, P.REACT)) waiting = null; }, 450);
  }

  function start() {
    if (live || still.matches || saver() || !face) return;
    const im = new Image();
    im.onload = () => {
      if (still.matches) return;
      live = true; el.classList.add("is-live"); show("rest"); blinkSoon(); arrive();
    };
    im.src = STRIP;
  }

  document.addEventListener("pointermove", (e) => look(e.clientX, e.clientY), { passive: true });
  document.addEventListener("pointerdown", (e) => look(e.clientX, e.clientY), { passive: true });
  /* A tap on her (not on her bubble) plays a smile or a wink, turn about, and doesn't follow the link. */
  el.addEventListener("click", (e) => {
    if (!seen() || still.matches || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    lastTap = lastTap === "wink" ? "smile" : "wink";
    play(lastTap, P.REACT);
  });
  document.addEventListener("cfb:scan", (e) => { const n = ON_SCAN[e.detail && e.detail.kind]; if (n) react(n); });
  document.addEventListener("cfb:answer", (e) => react(e.detail && e.detail.right ? "smile" : "worried"));
  document.addEventListener("cfb:screen", (e) => {
    home = e.detail.name === "home";
    if (!live) return;
    if (home) { blinkSoon(); arrive(); } else { rest(); clearTimeout(blinkTimer); }
  });
  document.addEventListener("cfb:intro-done", arrive);
  document.addEventListener("visibilitychange", () => { if (!live) return; if (document.hidden) { rest(); clearTimeout(blinkTimer); } else blinkSoon(); });
  const calm = () => { if (still.matches) { rest(); clearTimeout(blinkTimer); } else if (live) blinkSoon(); else start(); };
  if (still.addEventListener) still.addEventListener("change", calm);

  home = !!(el.closest("[data-screen]") && !el.closest("[data-screen]").hidden);
  start();
  CFB.hostFace = {
    FRAMES, SEQ, play: (name) => play(name, P.REACT), look, rest,
    state: () => ({ live, shown, playing: run ? run.name : null, gaze, waiting: waiting ? waiting.name : null }),
    seed(n) { let s = n >>> 0; rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); blinkSoon(); }
  };
})();
