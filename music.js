/* C.F.B. music: one soft track on repeat while the app is open (Jose, 2026-11-14).
   - Phones only start sound from a tap, so it begins at the first touch, key or click, then fades in.
   - A sound button stays in view (tab bar on phones, side rail on computers). The choice is saved as
     cfb-music ("off"; anything else is on).
   - Silent while the opening plays (it has its own music), and paused while the app is in the background.
   - "Enter quietly" on the very first visit turns it off: she has just said she wants no sound.
   - Data saver: the file is not downloaded unless she turns the music on herself.
   The file is cut by tools/make-music-loop.py, which prints LOOP. It carries PAD seconds of the loop's
   end before the loop and PAD seconds of its start after it, and the player repeats a stretch of exactly
   LOOP seconds inside that. Wherever the decoder puts the MP3's leading silence, it stays outside. */
(function () {
  "use strict";
  const FILE = "assets/sounds/music.mp3";
  const LOOP = 59.979660;   // seconds, printed by tools/make-music-loop.py
  const PAD = 0.5;          // the same number as PAD in the tool
  const LEVEL = 0.7, FADE_IN = 1.6, FADE_OUT = 0.35;

  const store = (window.CFB && window.CFB.store) || { get: (k, d) => d, set() {} };
  const root = document.documentElement;
  const buttons = Array.from(document.querySelectorAll("[data-music]"));
  const AC = window.AudioContext || window.webkitAudioContext;
  const saver = () => !!(navigator.connection && navigator.connection.saveData);

  let on = store.get("music", "on") !== "off";
  let asked = false;        // she turned it on herself this visit (beats data saver)
  let ctx = null, gain = null, src = null, buffer = null;
  let bytes = null, loading = null, failed = false;

  const inShow = () => root.classList.contains("intro-on");
  const wanted = () => on && !failed && !document.hidden && !inShow() && (asked || !saver());

  function paint() {
    buttons.forEach(b => {
      b.setAttribute("aria-pressed", String(on));
      b.hidden = !AC || failed;                             // no button for a sound that cannot play
      const s = b.querySelector("[data-music-state]"); if (s) s.textContent = on ? "On" : "Off";
    });
  }

  function load() {
    if (loading || bytes || buffer) return loading;
    loading = fetch(FILE).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(b => { bytes = b; }).catch(() => { loading = null; });   // offline before it was ever saved: try again later
    return loading;
  }

  /* Called inside a tap: makes (or wakes) the sound output, which phones allow nowhere else. */
  function wake() {
    if (!AC) return;
    try {
      if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    } catch (_) { failed = true; paint(); }
  }

  function begin() {
    if (src || !buffer || !ctx || !wanted()) return;
    src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    src.loopStart = PAD / 2; src.loopEnd = PAD / 2 + LOOP;
    src.connect(gain);
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(LEVEL, t + FADE_IN);
    src.start(0, PAD / 2);
  }

  function stop() {
    if (!src) return;
    const s = src, t = ctx.currentTime; src = null;
    gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
    try { s.stop(t + FADE_OUT + 0.05); } catch (_) {}
  }

  /* Brings what is playing in line with what is wanted. Safe to call at any time. */
  function sync() {
    if (!ctx) return;
    if (!wanted()) {
      stop();
      if (document.hidden && ctx.state === "running") setTimeout(() => { if (document.hidden && ctx.state === "running") ctx.suspend().catch(() => {}); }, (FADE_OUT + 0.1) * 1000);
      return;
    }
    if (ctx.state !== "running") { ctx.resume().catch(() => {}); }
    if (buffer) return begin();
    Promise.resolve(load()).then(() => {
      if (!bytes || buffer) return buffer ? begin() : null;
      const b = bytes; bytes = null;
      const done = (buf) => { buffer = buf; begin(); };
      const bad = () => { failed = true; paint(); };
      try { const p = ctx.decodeAudioData(b, done, bad); if (p && p.catch) p.catch(() => {}); } catch (_) { bad(); }
    });
  }

  /* Any touch, key or click: the moment sound is allowed. Kept for the whole visit, because a phone can
     put the sound output back to sleep after the app has been in the background. */
  function touched(e) {
    if (!on || (saver() && !asked)) return;
    // during the opening only "Enter with sound" may wake it: "Enter quietly" and taps on a quiet film make no sound output at all
    if (inShow() && !(e.target && e.target.closest && e.target.closest(".in-gate [data-sound=on]"))) return;
    wake(); sync();
  }
  ["pointerup", "touchend", "click", "keydown"].forEach(ev => document.addEventListener(ev, touched, { capture: true, passive: true }));

  buttons.forEach(b => b.addEventListener("click", () => {
    on = !on; asked = on;
    store.set("music", on ? "on" : "off");
    paint();
    if (on) wake();
    sync();
  }));

  // the opening's gate: "Enter quietly" on the first visit means no sound at all
  document.querySelectorAll(".in-gate [data-sound=off]").forEach(b => b.addEventListener("click", () => {
    if (store.get("intro-seen", "") === "1" || store.get("music", "") !== "") return;
    on = false; store.set("music", "off"); paint(); sync();
  }, true));

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => { if (ctx) stop(); });
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });   // the opening starting or ending

  // fetch the file ahead of the first touch, once the page is settled
  if (AC && on && !saver()) {
    const soon = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    window.addEventListener("load", () => soon(() => { if (on) load(); }));
  }
  paint();

  window.CFB.music = {   // for tests
    state: () => ({ on, playing: !!src, ready: !!buffer, context: ctx ? ctx.state : "none", level: gain ? gain.gain.value : 0, failed }),
    LOOP, PAD, FILE
  };
})();
