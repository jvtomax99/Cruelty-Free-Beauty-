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
  const SCREENS = ["home", "brands", "profile", "learn"];
  function show() {
    const name = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    document.querySelectorAll("[data-screen]").forEach(s => { s.hidden = s.dataset.screen !== name; });
    document.querySelectorAll("[data-tab]").forEach(t => {
      if (t.dataset.tab === name) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    document.title = name === "home" ? "C.F.B. · Cruelty-Free Beauty" : "C.F.B. · " + name[0].toUpperCase() + name.slice(1);
  }
  window.addEventListener("hashchange", show);
  show();

  /* ---------- Greeting by time of day ---------- */
  const h = new Date().getHours();
  document.getElementById("hello-time").textContent = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  /* ---------- Press feedback on touch ----------
     :hover never fires on a phone, and :active flickers off before the eye sees it,
     so a touched control holds .is-pressed for 260 ms (Interp's pattern). */
  const LIFTS = ".tile, .tab, .search, .learn summary";
  const HOLD_MS = 260;
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    const el = e.target.closest(LIFTS);
    if (!el) return;
    el.classList.add("is-pressed");
    const up = () => setTimeout(() => el.classList.remove("is-pressed"), HOLD_MS);
    const cancel = () => el.classList.remove("is-pressed");
    el.addEventListener("pointerup", up, { once: true });
    el.addEventListener("pointercancel", cancel, { once: true });
  }, { passive: true });

  /* ---------- Offline: the worker saves the app so it opens with no signal ---------- */
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
  }
})();
