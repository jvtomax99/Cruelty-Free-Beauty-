/* C.F.B. "What changed": certification changes we saw on a recheck (data/brands.json, "changes").
   Home shows the ones this phone hasn't seen (hearted brands first), the Brands screen keeps the
   last 12 months, and a brand page shows its own. The words only ever say what the certifier's
   list showed on the date we looked, never why (SPEC "Brand rules" 2: absence is unknown). */
(function () {
  "use strict";
  const CFB = window.CFB, store = CFB.store;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const KEEP_DAYS = 365, HOME_MAX = 5;

  const SOURCE = { peta: "PETA's page", leapingBunny: "Leaping Bunny", parent: "Source", chinaRetail: "Brand's page" };
  /* What we saw, in plain words. "from" and "to" are the stored values (yes / no / unknown / n/a). */
  function words(c) {
    const t = c.to, was = c.from;
    if (c.claim === "peta") {
      if (t === "yes") return "Now on PETA's cruelty-free list";
      if (t === "no") return "PETA now lists it as testing on animals" + (c.law === true ? " when the law requires it" : "");
      return was === "yes" ? "No longer on PETA's cruelty-free list" : "No longer on PETA's list of companies that test";
    }
    if (c.claim === "leapingBunny") return t === "yes" ? "Now in Leaping Bunny's guide" : "No longer in Leaping Bunny's guide";
    // From "unknown" we only learned something; nothing is known to have changed.
    if (c.claim === "parent") {
      if (t === "yes") return was === "unknown" ? "Newly confirmed: its parent company tests on animals" : "Its parent company is now one that tests on animals";
      if (t === "no") return was === "unknown" ? "Newly confirmed: its parent company doesn't test on animals" : "Its parent company is now one that doesn't test on animals";
      return "Its parent company changed";
    }
    if (c.claim === "chinaRetail") {
      if (t === "yes") return was === "unknown" ? "Newly confirmed: sold in mainland China stores" : "Now sold in mainland China stores";
      if (t === "no" && was === "unknown") return "Newly confirmed: not sold in mainland China stores";
      if (t === "no") return "No longer sold in mainland China stores";
      return "Where it sells is no longer clear";
    }
    return "Something changed";
  }

  let brands = [], changes = [];
  const key = (c) => `${c.id}|${c.claim}|${c.date}`;
  let seenNow = [];   // also kept here, so "Got it" works for this visit when the phone refuses to save
  const seen = () => { try { const a = JSON.parse(store.get("changes-seen", "[]")); return Array.isArray(a) ? a.concat(seenNow) : seenNow; } catch (_) { return seenNow; } };
  const name = (id) => (brands.find((b) => b.id === id) || {}).name;

  // Only well-formed entries about a brand we list, from the last 12 months, newest first.
  function load(list) {
    const today = Date.now();
    return (Array.isArray(list) ? list : []).filter((c) => {
      if (!c || !name(c.id) || !Object.hasOwn(SOURCE, c.claim) || !/^\d{4}-\d{2}-\d{2}$/.test(c.date || "")) return false;
      if (c.claim === "leapingBunny" && c.from !== "yes" && c.to !== "yes") return false;   // it was never in the guide
      const age = (today - new Date(c.date + "T00:00:00Z").getTime()) / 864e5;   // UTC, like the tools
      return age >= 0 && age <= KEEP_DAYS;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  function row(c, isSaved) {
    const link = /^https:\/\//.test(c.url || "") ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">${SOURCE[c.claim]}</a>` : "";
    return `<li class="change">
      <a class="brand-row" href="#brand/${encodeURIComponent(c.id)}">
        <span class="brand-name">${esc(name(c.id))}</span>
        ${isSaved ? '<span class="brand-meta"><span class="tag">You saved this</span></span>' : ""}
        <span class="brand-why">${esc(words(c))}.${c.note ? " " + esc(c.note) : ""}</span>
      </a>
      <p class="src">Checked ${day(c.date)}${link}</p>
    </li>`;
  }

  function render() {
    const mine = new Set(CFB.saved.list());
    const old = new Set(seen());
    const fresh = changes.filter((c) => !old.has(key(c)))
      .sort((a, b) => (mine.has(b.id) - mine.has(a.id)) || b.date.localeCompare(a.date));

    const card = $("changes-card");
    card.hidden = !fresh.length;
    if (fresh.length) {
      $("changes-new").innerHTML = fresh.slice(0, HOME_MAX).map((c) => row(c, mine.has(c.id))).join("");
      const rest = fresh.length - HOME_MAX;
      $("changes-rest").hidden = rest <= 0;
      $("changes-rest").textContent = rest > 0 ? `And ${rest} more under Brands, in Recent changes.` : "";
    }
    const all = $("changes-all");
    all.hidden = !changes.length;
    if (changes.length) $("changes-list").innerHTML = changes.map((c) => row(c, mine.has(c.id))).join("");
  }

  // brands.js puts this at the top of a brand page.
  CFB.changeLine = (id) => changes.filter((c) => c.id === id).map((c) => {
    const link = /^https:\/\//.test(c.url || "") ? ` <a href="${esc(c.url)}" target="_blank" rel="noopener">${SOURCE[c.claim]}</a>` : "";
    return `<p class="change-note"><strong>Checked ${day(c.date)}.</strong> ${esc(words(c))}.${c.note ? " " + esc(c.note) : ""}${link}</p>`;
  }).join("");

  $("changes-ok").addEventListener("click", () => {
    seenNow = changes.map(key);
    store.set("changes-seen", JSON.stringify(seenNow));   // also drops keys of entries that aged out
    render();
    $("hello-line").focus();
  });
  document.addEventListener("cfb:saved", render);

  CFB.data.then((d) => {
    brands = d.brands || [];
    changes = load(d.changes);
    render();
    if (changes.length && location.hash.startsWith("#brand/")) CFB.show();   // a brand link opened directly: add its line
  });
})();
