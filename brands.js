/* C.F.B. brand directory and brand pages. Data: data/brands.json (precached, so it works offline).
   The verdict is never stored: it is worked out here from the sourced fields, per SPEC "Brand rules". */
(function () {
  "use strict";
  const store = window.CFB.store;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const DUE_DAYS = 90;
  const isDue = (iso) => iso && (Date.now() - new Date(iso + "T00:00:00").getTime()) / 864e5 > DUE_DAYS;
  const PRICE = { "$": "Drugstore", "$$": "Mid", "$$$": "Luxury" };

  let brands = [];
  const state = {
    mode: store.get("mode", "strict") === "certified" ? "certified" : "strict",
    q: "", vegan: false, price: new Set(),
  };

  /* ---------- Verdict ----------
     Certified: on PETA's list or Leaping Bunny certified.
     Strict: certified, and not a known problem: a parent that tests, or sold in mainland China
     stores, each with a source. Unknowns pass with a note (SPEC, 2026-11-11). */
  function verdict(b, mode) {
    const peta = b.peta.status, lb = b.leapingBunny.status;
    const notes = [];
    if (peta !== "yes" && lb !== "yes") {
      if (peta === "no") {
        const law = /regulatory/i.test(b.peta.note);
        return { pass: false, kind: "fail", reason: law ? "PETA says it tests on animals when the law requires it." : "PETA says it tests on animals.", notes };
      }
      return { pass: false, kind: "none", reason: "Not on PETA's or Leaping Bunny's list, so its cruelty-free status isn't verified.", notes };
    }
    const certs = [peta === "yes" && "PETA", lb === "yes" && "Leaping Bunny"].filter(Boolean);
    const by = certs.join(" and ");
    if (mode === "strict") {
      if (b.parent.testsOnAnimals === "yes" && b.parent.name && b.parent.name !== b.name) {
        const law = /regulatory/i.test(b.parent.note || "");
        return { pass: false, kind: "fail", reason: `Certified by ${by}, but its parent company, ${b.parent.name}, tests on animals${law ? " when the law requires it" : ""}.`, notes };
      }
      if (b.chinaRetail.status === "yes") {
        return { pass: false, kind: "fail", reason: `Certified by ${by}, but sold in mainland China stores, by its own account.`, notes };
      }
      if (b.parent.testsOnAnimals === "unknown") notes.push("Parent company not confirmed.");
      if (b.chinaRetail.status === "unknown") notes.push(b.chinaRetail.checked ? "Brand doesn't say where it sells." : "Where it sells not checked yet.");
    }
    return { pass: true, kind: "pass", reason: `Certified by ${by}.`, notes, certs };
  }
  const CHIP = { pass: "Passes", fail: "Doesn't pass", none: "Not on either list" };
  // One chip per certifier for a brand that passes; the Brands list and Home's rail both use it.
  const certChips = (v) => v.certs.map((c) => `<span class="verdict v-pass"><span aria-hidden="true">✓&nbsp;</span><span class="sr-only">Certified by </span>${c}</span>`).join("");

  /* ---------- Match a brand name from a label (Open Beauty Facts or typed) ----------
     A wrong match shows a wrong verdict, so this is strict: the WHOLE name must equal one of the
     brand's keys (its name and `search` names), after dropping trailing words like "Cosmetics",
     "Professional Makeup", "Paris" or "New York", and ignoring spaces and punctuation.
     So "NYX Professional Makeup", "M.A.C", "L'Oréal Paris" and "E.l.f." match, while
     "Thrive Natural Care", "Fenty Skin" or "Revolution Skincare" don't.
     Only the first name in a list counts: Open Beauty Facts writes "Naturium, e.l.f. Beauty"
     (brand, then owner), and the owner's verdict isn't the brand's. */
  const words = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const FILLER = new Set(["cosmetics", "cosmetic", "makeup", "professional", "paris", "companies", "inc", "new", "york", "london", "usa"]);
  function trimmed(w) { w = w.slice(); while (w.length > 1 && FILLER.has(w[w.length - 1])) w.pop(); return w.join(""); }
  let keyCache = null;
  function match(text) {
    if (!brands.length) return null;
    if (!keyCache) {
      keyCache = new Map();
      for (const b of brands) for (const n of [b.name, ...(b.search || [])]) {
        for (const k of [words(n).join(""), trimmed(words(n))]) if (k && !keyCache.has(k)) keyCache.set(k, b);
      }
    }
    const first = String(text ?? "").split(/[,;]/)[0];
    const w = words(first);
    if (!w.length) return null;
    return keyCache.get(w.join("")) || keyCache.get(trimmed(w)) || null;
  }

  /* ---------- Saved brands (only on this phone) ---------- */
  const saved = {
    list() { try { const a = JSON.parse(store.get("saved", "[]")); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; } catch (_) { return []; } },
    has(id) { return saved.list().includes(id); },
    toggle(id) {
      const a = saved.list(), on = !a.includes(id);
      store.set("saved", JSON.stringify(on ? [id, ...a] : a.filter((x) => x !== id)));
      document.dispatchEvent(new CustomEvent("cfb:saved", { detail: { id, on } }));
      return on;
    },
  };
  // A heart button: brand pages and scan results use the same one.
  function saveButton(b) {
    const on = saved.has(b.id);
    return `<button type="button" class="save-btn" data-save="${esc(b.id)}" aria-pressed="${on}"><svg aria-hidden="true"><use href="#i-heart"/></svg><span>${on ? "Saved" : "Save"}</span><span class="sr-only"> ${esc(b.name)}</span></button>`;
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save]");
    if (!btn) return;
    const on = saved.toggle(btn.dataset.save);
    document.querySelectorAll(`[data-save="${CSS.escape(btn.dataset.save)}"]`).forEach((x) => {
      x.setAttribute("aria-pressed", on); x.querySelector("span").textContent = on ? "Saved" : "Save";
    });
  });

  /* ---------- List ---------- */
  function matches(b) {
    if (state.vegan && b.vegan !== "all") return false;
    if (state.price.size && !state.price.has(b.price)) return false;
    if (state.q) {
      const q = fold(state.q);
      return [b.name, ...(b.search || [])].some((n) => fold(n).includes(q));
    }
    return true;
  }

  function renderList() {
    const modeName = state.mode === "strict" ? "Strict" : "Certified";
    document.querySelectorAll(".mode-btn").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.mode === state.mode)));
    $("mode-help").textContent = state.mode === "strict"
      ? "Certified, and no known parent that tests or sales in mainland China stores."
      : "On PETA's list or certified by Leaping Bunny.";
    document.querySelectorAll(".chip[data-filter=vegan]").forEach((x) => x.setAttribute("aria-pressed", String(state.vegan)));
    document.querySelectorAll(".chip[data-price]").forEach((x) => x.setAttribute("aria-pressed", String(state.price.has(x.dataset.price))));

    const rows = brands.map((b) => ({ b, v: verdict(b, state.mode) }));
    const passing = rows.filter((r) => r.v.pass).length;
    const hits = rows.filter((r) => matches(r.b));
    // Browsing shows only brands that pass (founder, 2026-11-11); a search shows every match,
    // so "is my brand OK?" always gets an answer, with the reason when it isn't.
    const shown = hits.filter((r) => state.q || r.v.pass)
      .sort((x, y) => (y.v.pass - x.v.pass) || x.b.name.localeCompare(y.b.name));

    const filtered = state.q || state.vegan || state.price.size;
    $("brand-count").textContent = `${passing} brands pass ${modeName}` + (filtered ? `. Showing ${shown.length}.` : ".");

    $("brand-list").innerHTML = shown.length ? shown.map(({ b, v }) => `
      <li><a class="brand-row" href="#brand/${encodeURIComponent(b.id)}">
        <span class="brand-name">${esc(b.name)}</span>
        <span class="brand-meta">
          ${v.pass ? certChips(v) : `<span class="verdict v-${v.kind}">${CHIP[v.kind]}</span>`}
          ${b.vegan === "all" ? '<span class="tag">Vegan</span>' : ""}
          ${b.price ? `<span class="tag" title="${PRICE[b.price]}">${esc(b.price)}</span>` : ""}
        </span>
        ${v.pass ? "" : `<span class="brand-why">${esc(v.reason)}</span>`}
      </a></li>`).join("")
      : `<li class="none">${state.q ? `No brand called “${esc(state.q)}” on our list yet.` : "No brands match these filters."}</li>`;
    $("brand-hint").hidden = !!state.q;
  }

  /* ---------- One brand ---------- */
  function sourceLine(c, label) {
    if (!c || !c.checked) return `<p class="src">Not researched yet.</p>`;
    const link = c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(label)}</a> · ` : "";
    return `<p class="src">${link}Checked ${day(c.checked)}${isDue(c.checked) ? ' · <span class="due">Check due</span>' : ""}</p>`;
  }
  function card(title, status, detail, src) {
    return `<div class="fact"><h2>${esc(title)}</h2><p class="fact-status">${esc(status)}</p>${detail ? `<p class="fact-note">${esc(detail)}</p>` : ""}${src}</div>`;
  }

  function renderBrand(id) {
    const b = brands.find((x) => x.id === id);
    const page = $("brand-page");
    if (!b) {
      page.innerHTML = `<h1 id="brand-h" tabindex="-1">Brand not found</h1><p class="lede">It may have been renamed. Go back to all brands.</p>`;
      document.title = "C.F.B. · Brand not found";
      return;
    }
    document.title = "C.F.B. · " + b.name;
    const v = verdict(b, state.mode);
    const modeName = state.mode === "strict" ? "Strict" : "Certified";
    const p = b.peta, lb = b.leapingBunny, par = b.parent, ch = b.chinaRetail;

    const petaStatus = p.status === "yes" ? "On PETA's cruelty-free list" : p.status === "no" ? (/regulatory/i.test(p.note) ? "Tests on animals when the law requires it, per PETA" : "Tests on animals, per PETA") : "Unknown: not on PETA's cruelty-free list";
    const lbStatus = lb.status === "yes" ? "Leaping Bunny certified" : lb.status === "no" ? "Not certified" : "Unknown: not in Leaping Bunny's guide";
    const parStatus = par.testsOnAnimals === "n/a" ? "This brand is the parent company"
      : par.name ? `${par.name}: ${par.testsOnAnimals === "yes" ? "tests on animals" : par.testsOnAnimals === "no" ? "doesn't test on animals" : "testing unknown"}`
      : par.testsOnAnimals === "unknown" ? "Unknown" : "";
    const chStatus = ch.status === "yes" ? "Sold in mainland China" : ch.status === "no" ? "Not sold in mainland China stores" : "Unknown";
    const veganStatus = b.vegan === "all" ? "All products are vegan, per PETA" : b.vegan === "some" ? "Some products are vegan" : b.vegan === "none" ? "Not vegan" : "Unknown";
    const priceStatus = b.price ? `${b.price} · ${PRICE[b.price]}` : "Price not listed";
    const parNote = par.testsOnAnimals === "n/a" ? "" : par.note && par.note !== "Not yet researched" && !/^Parent named in PETA/.test(par.note) ? par.note : "";
    const chNote = ch.note && ch.note !== "Not yet researched" ? ch.note : "";

    const buy = (b.whereToBuy || []).length
      ? `<ul class="buy">${b.whereToBuy.map((w) => `<li><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.store)}</a> <span>${/other stores/i.test(w.store) ? "lists where to buy" : "carries this brand"}</span></li>`).join("")}</ul>`
      : `<p class="fact-status">No buy link yet.</p>`;

    page.innerHTML = `
      <div class="brand-top"><h1 id="brand-h" tabindex="-1">${esc(b.name)}</h1>${saveButton(b)}</div>
      ${window.CFB.changeLine ? window.CFB.changeLine(b.id) : ""}
      <div class="verdict-box v-${v.kind}">
        <p class="verdict-title">${v.pass ? `Passes ${modeName}` : CHIP[v.kind]}</p>
        <p>${esc(v.reason)}</p>
        ${v.notes.length ? `<p class="verdict-notes">${esc(v.notes.join(" "))}</p>` : ""}
      </div>
      <div class="facts">
        ${card("PETA", petaStatus, "", sourceLine(p, "PETA's page"))}
        ${card("Leaping Bunny", lbStatus, "", sourceLine(lb, "Leaping Bunny"))}
        ${card("Parent company", parStatus, parNote, sourceLine(par, "Source"))}
        ${card("Mainland China", chStatus, chNote, sourceLine(ch, "Brand's page"))}
        ${card("Vegan", veganStatus, "", b.vegan === "all" ? sourceLine(p, "PETA's page") : "")}
        ${card("Price", priceStatus, b.priceSource ? b.priceSource.note : "", b.priceSource ? sourceLine(b.priceSource, "Brand's site") : "")}
        <div class="fact"><h2>Where to buy</h2>${buy}</div>
      </div>`;
  }

  /* ---------- Wiring ---------- */
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "brand" && brands.length) renderBrand(e.detail.id); });

  document.querySelectorAll(".mode-btn").forEach((x) => x.addEventListener("click", () => {
    state.mode = x.dataset.mode; store.set("mode", state.mode); renderList();
  }));
  document.querySelectorAll(".chip").forEach((x) => x.addEventListener("click", () => {
    if (x.dataset.filter === "vegan") state.vegan = !state.vegan;
    else if (state.price.has(x.dataset.price)) state.price.delete(x.dataset.price); else state.price.add(x.dataset.price);
    renderList();
  }));
  $("brand-q").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderList(); });

  // Shared with profile.js: the same verdict, the current strictness, and the data once loaded.
  window.CFB.verdict = verdict;
  window.CFB.mode = () => state.mode;
  window.CFB.match = match;
  window.CFB.saved = saved;
  window.CFB.saveButton = saveButton;
  window.CFB.CHIP = CHIP;
  window.CFB.certChips = certChips;
  // The whole file, for changes.js ("changes"); an empty one if it couldn't load.
  const file = fetch("data/brands.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  window.CFB.data = file.catch(() => ({ brands: [], changes: [] }));
  window.CFB.brands = file
    .then((d) => {
      brands = d.brands;
      renderList();
      if (location.hash.startsWith("#brand/")) window.CFB.show();   // a brand link opened directly
      return brands;
    })
    .catch(() => {
      const msg = "Couldn't load the brand list. Check your connection and reopen the app.";
      $("brand-count").textContent = msg;
      $("brand-page").innerHTML = `<h1 id="brand-h" tabindex="-1">Brand</h1><p class="lede">${msg}</p>`;
      return [];
    });

  // "All brands" goes back in history when we came from the list, so the phone's
  // Back button doesn't reopen the brand page afterwards.
  let cameFromList = false;
  window.addEventListener("hashchange", (e) => {
    const from = new URL(e.oldURL).hash, to = location.hash;
    if (to.startsWith("#brand/")) { if (from === "#brands") cameFromList = true; }
    else cameFromList = false;
  });
  document.querySelector(".back").addEventListener("click", (e) => {
    if (cameFromList) { e.preventDefault(); history.back(); }
  });
})();
