/* C.F.B. Home's host: the girl on the hello banner and what her bubble says.
   One line, picked from what this phone already knows; the bubble links to the matching place.
   It reads what the other scripts saved and saves nothing itself. She never words a verdict and
   never says what a certifier's list showed: only CFB.verdict and "What changed" do.
   The lines speak for the founder's brand: Jose signs off every change to LINES. */
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
    scanned: (b) => ({ soft: `You scanned ${b.name}.`, bold: "See its proof again.", href: "#brand/" + encodeURIComponent(b.id) }),
    morning: () => ({ soft: "Shopping today?", bold: "Scan it first.", href: "#scan" }),
    afternoon: () => ({ soft: "In the aisle?", bold: "Scan the barcode.", href: "#scan" }),
    evening: () => ({ soft: "Curious about what you own?", bold: "Scan it tonight.", href: "#scan" })
  };

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

  /* The first that applies wins. */
  function pick() {
    if (CFB.hasProfile && !CFB.hasProfile()) return LINES.quiz();
    const changed = CFB.unseenSaved ? CFB.unseenSaved() : [];
    if (changed.length) return LINES.changed(changed);
    const due = CFB.garden && CFB.garden.tally ? CFB.garden.tally().due : 0;
    if (due > 0) return LINES.review(due);
    const b = lastScan();
    if (b) return LINES.scanned(b);
    const h = new Date().getHours();
    return (h < 12 ? LINES.morning : h < 17 ? LINES.afternoon : LINES.evening)();
  }

  function draw() {
    const l = pick();
    const b = document.createElement("b");
    b.textContent = l.bold;
    say.replaceChildren(l.soft + " ", b);
    pal.setAttribute("href", l.href);
    if (l.go) pal.dataset.go = l.go; else delete pal.dataset.go;
  }

  /* "What changed" is a card further down Home, not a screen of its own: go to it. */
  pal.addEventListener("click", (e) => {
    const card = document.getElementById("changes-card");
    if (pal.dataset.go !== "changes" || !card || card.hidden) return;
    e.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    document.getElementById("changes-h").focus({ preventScroll: true });
  });

  draw();
  CFB.brands.then((list) => { brands = list || []; draw(); });
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "home") draw(); });
  ["cfb:saved", "cfb:changes", "cfb:garden"].forEach((n) => document.addEventListener(n, draw));
  CFB.host = { pick, LINES };
})();
