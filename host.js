/* C.F.B. Home's host: the girl on the hello banner and what her bubble says.
   One line, picked from what this phone already knows; the bubble links to the matching place.
   It reads what the other scripts saved and saves nothing itself. She never words a verdict and
   never says what a certifier's list showed: only CFB.verdict and "What changed" do.
   The lines speak for the founder's brand: Jose signs off every change to LINES and PLACES. */
(function () {
  "use strict";
  const CFB = window.CFB;
  const pal = document.getElementById("host"), say = document.getElementById("host-say");
  if (!pal || !say) return;
  const SCAN_DAYS = 7;   // a scan older than this is no longer "recent"

  /* soft: the first, quieter line. bold: the second, in rose. Names are put in as text. */
  const LINES = {
    quiz: () => ({ soft: "New here?", bold: "Find your match in 8 questions.", href: "#profile" }),
    changed: (list) => ({
      soft: list.length === 1 ? `${list[0].name} has news.` : `${list.length} brands you saved have news.`,
      bold: "See what changed.", href: "#home", go: "changes"
    }),
    review: (n) => ({ soft: "Your Sanctuary is waiting.", bold: n === 1 ? "1 question to review." : `${n} questions to review.`, href: "#practice/all" }),
    scanned: (b) => ({ soft: `You scanned ${b.name}.`, bold: "See its page again.", href: "#brand/" + encodeURIComponent(b.id) }),
    morning: () => ({ soft: "Shopping today?", bold: "Scan it first.", href: "#scan" }),
    afternoon: () => ({ soft: "In the aisle?", bold: "Scan the barcode.", href: "#scan" }),
    evening: () => ({ soft: "Curious about what you own?", bold: "Scan it tonight.", href: "#scan" })
  };

  /* Her small copies on other screens (Jose signed these off, 2026-11-13): a still of her, 72 px, and one
     line that links somewhere useful. One per screen, never beside another copy of her. `face` is a frame
     of her strip (host-engine.js lists them); `go` is the id of something on the same screen to move to. */
  const PLACES = {
    scanned: (b) => ({ soft: "Want to see why?", bold: "Read the proof.", href: "#brand/" + encodeURIComponent(b.id) }),
    unchecked: () => ({ soft: "New to us.", bold: "Look it up on the certifiers' lists.", href: "#scan", go: "scan-lists" }),
    quizDone: () => ({ soft: "That's your match.", bold: "Now scan what's in your bag.", href: "#scan", face: "smile" }),
    noSaved: () => ({ soft: "Nothing saved yet.", bold: "Find a brand to heart.", href: "#brands" }),
    noScans: () => ({ soft: "No scans yet.", bold: "Try one from your bag.", href: "#scan", go: "scan-start" })
  };
  const FACE_OF = { pass: "smile", fail: "sad", none: "surprised", unlisted: "surprised" };   // her look beside a scan result, never words
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function mini(place, arg, kind) {
    const l = PLACES[place](arg);
    const frames = CFB.hostFace ? CFB.hostFace.FRAMES : [];
    const i = frames.indexOf(kind ? FACE_OF[kind] : l.face);
    const look = i > 0 ? `<i style="background-position-x:${i / (frames.length - 1) * 100}%"></i>` : "";
    return `<a class="hm" href="${esc(l.href)}"${l.go ? ` data-go="${l.go}"` : ""}><span class="hm-face" aria-hidden="true">${look}</span><span class="hm-say">${esc(l.soft)} <b>${esc(l.bold)}</b></span></a>`;
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest(".hm[data-go]") : null;
    const to = a && document.getElementById(a.dataset.go);
    if (!to || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    to.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    (to.matches("a, button") ? to : to.querySelector("a, button") || to).focus({ preventScroll: true });
  });

  let brands = [];
  function lastScan() {
    let list = [];
    try { list = JSON.parse(CFB.store.get("scans", "[]")); } catch (_) {}
    const s = Array.isArray(list) ? list[0] : null;   // the newest; one we haven't checked has no page to open
    if (!s || typeof s !== "object" || typeof s.brand !== "string" || !Number.isFinite(s.t)) return null;
    const age = Date.now() - s.t;
    if (age < 0 || age > SCAN_DAYS * 864e5) return null;
    return brands.find((b) => b.id === s.brand) || null;
  }

  /* Someone who skipped the quiz on purpose shouldn't hear about it at every visit: the quiz line
     has every other day (counted in the phone's own time), and the other lines get the days between. */
  const quizDay = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5) % 2 === 0; };

  /* The first that applies wins. */
  function pick() {
    if (CFB.hasProfile && !CFB.hasProfile() && quizDay()) return LINES.quiz();
    const changed = CFB.unseenSaved ? CFB.unseenSaved() : [];
    if (changed.length) return LINES.changed(changed);
    const due = CFB.garden && CFB.garden.tally ? CFB.garden.tally().due : 0;
    if (due > 0) return LINES.review(due);
    const b = lastScan();
    if (b) return LINES.scanned(b);
    const h = new Date().getHours();
    return (h < 12 ? LINES.morning : h < 17 ? LINES.afternoon : LINES.evening)();
  }

  let said = null;   // the line on show
  function draw() {
    const l = pick();
    const key = l.soft + "|" + l.bold;
    const fresh = said !== null && said !== key;
    said = key;
    const b = document.createElement("b");
    b.textContent = l.bold;
    say.replaceChildren(l.soft + " ", b);
    pal.setAttribute("href", l.href);
    if (l.go) pal.dataset.go = l.go; else delete pal.dataset.go;
    if (fresh) document.dispatchEvent(new CustomEvent("cfb:host-line"));   // host-engine.js: she looks at it and says it
  }

  /* "What changed" is a card further down Home, not a screen of its own: go to it. */
  pal.addEventListener("click", (e) => {
    const card = document.getElementById("changes-card");
    if (pal.dataset.go !== "changes" || !card || card.hidden) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // "open in a new tab" stays the browser's
    e.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    document.getElementById("changes-h").focus({ preventScroll: true });
  });

  draw();
  CFB.brands.then((list) => { brands = list || []; draw(); });
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "home") draw(); });
  ["cfb:saved", "cfb:changes", "cfb:garden"].forEach((n) => document.addEventListener(n, draw));
  CFB.host = { pick, LINES, PLACES, mini };
  /* scan.js and profile.js load before this file and may have drawn without her: once every script has
     run (host-engine.js, with her faces, comes after this one) they draw again. */
  const ready = () => document.dispatchEvent(new CustomEvent("cfb:host"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else setTimeout(ready, 0);
})();
