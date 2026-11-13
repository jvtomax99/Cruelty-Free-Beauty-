/* C.F.B. app: screens, greeting, press feedback. Plain script, no build step. */
(function () {
  "use strict";

  /* ---------- Saved settings (always inside try/catch: private mode can refuse) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("cfb-" + k); return v === null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("cfb-" + k, v); } catch (_) {} }
  };
  window.CFB = { store };

  /* ---------- Screens (hash routing, so the Back button retraces) ---------- */
  const SCREENS = ["home", "brands", "profile", "learn", "scan", "garden"];
  const scrollOf = {};   // each screen keeps its own scroll, like a phone's tab bar
  let current = null;     // screen whose scroll we remember
  let lastShown = null;   // screen on view, for moving focus
  function show() {
    const hash = location.hash.slice(1);
    const isBrand = hash.startsWith("brand/");   // #brand/<id>: one brand's page, under the Brands tab
    const isRound = hash.startsWith("practice/");   // #practice/<habitat>: a round of questions, under the Garden
    const name = isBrand ? "brand" : isRound ? "practice" : SCREENS.includes(hash) ? hash : "home";
    const tab = isBrand ? "brands" : name === "scan" || name === "garden" || isRound ? "home" : name;   // Scan and the Garden open from Home
    if (current) scrollOf[current] = window.scrollY;
    document.querySelectorAll("[data-screen]").forEach(s => { s.hidden = s.dataset.screen !== name; });
    document.querySelectorAll("[data-tab]").forEach(t => {
      if (t.dataset.tab === tab) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    // brands.js draws the brand page; it listens for this and sets the title
    let id = null;
    if (isBrand) { try { id = decodeURIComponent(hash.slice(6)); } catch (_) { id = ""; } }   // a broken link shows "Brand not found"
    if (isRound) id = hash.slice(9);
    document.dispatchEvent(new CustomEvent("cfb:screen", { detail: { name, id } }));
    window.scrollTo(0, isBrand || isRound ? 0 : scrollOf[name] || 0);
    // move focus to the new screen's heading so screen readers announce it (not on first load)
    if (lastShown && lastShown !== name) {
      const h = document.querySelector(`[data-screen="${name}"] h1`);
      if (h) h.focus({ preventScroll: true });
    }
    lastShown = name;
    current = isBrand || isRound ? null : name;   // a brand page or a round keeps no scroll of its own
    if (isBrand || isRound) return;   // brands.js and garden.js set those titles
    document.title = name === "home" ? "C.F.B. · Cruelty-Free Beauty" : "C.F.B. · " + (name === "garden" ? "Your Sanctuary" : name[0].toUpperCase() + name.slice(1));
  }
  window.addEventListener("hashchange", show);
  window.CFB.show = show;   // brands.js calls it once the brand data has loaded

  show();

  /* ---------- Greeting by time of day ---------- */
  const h = new Date().getHours();
  document.getElementById("hello-time").textContent = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  /* ---------- Press feedback on touch ----------
     :hover never fires on a phone, and :active flickers off before the eye sees it,
     so a touched control holds .is-pressed for 260 ms (Interp's pattern). */
  const LIFTS = ".qt-tile, .hr-card, .hb-pal, .tab, .search, .learn summary, .brand-row, .chip, .mode-btn, .quiz-opt, .save-btn, .scan-link, .pf-start, .in-btn, .in-skip, .pill-btn, .gd-card, .gd-home, .gd-go, .sx-btn, .sx-back, .sx-step, .sx-who";
  const HOLD_MS = 260;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    const el = e.target.closest(LIFTS);
    if (!el) return;
    el.classList.add("is-pressed");
    const up = () => setTimeout(() => el.classList.remove("is-pressed"), HOLD_MS);
    const cancel = () => el.classList.remove("is-pressed");
    const off = () => { el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onCancel); };
    const onUp = () => { off(); up(); };
    const onCancel = () => { off(); cancel(); };
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
  }, { passive: true });

  /* ---------- Offline: the worker saves the app so it opens with no signal ---------- */
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
  }
})();
