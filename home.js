/* C.F.B. Home: the rail of brands that pass. The verdict and its words are brands.js's
   (CFB.verdict); this file only lays them out. Hearted brands come first. */
(function () {
  "use strict";
  const MAX = 8;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initial = (name) => window.CFB.initial(name);   // brands.js's, shared with the Brands list
  const box = document.getElementById("home-rail");
  let brands = [];
  let drawn = "", drawnAt = 0;   // the rail as last drawn, and when

  // `arriving`: the cards fade up one after another when Home opens, not when a heart redraws them.
  function draw(arriving) {
    if (!brands.length) { box.hidden = true; return; }
    const mode = window.CFB.mode();
    const saved = window.CFB.saved;
    const hearted = (b) => (saved && saved.has && saved.has(b.id) ? 1 : 0);
    const pass = brands.map((b) => ({ b, v: window.CFB.verdict(b, mode) })).filter((r) => r.v.pass)
      .sort((x, y) => (hearted(y.b) - hearted(x.b)) || x.b.name.localeCompare(y.b.name));
    if (!pass.length) { box.hidden = true; return; }
    document.getElementById("home-rail-count").textContent = `${pass.length} · ${mode === "strict" ? "Strict" : "Certified"}`;
    const list = document.getElementById("home-rail-list");
    const html = pass.slice(0, MAX).map(({ b, v }) => `
      <li><a class="hr-card" href="#brand/${encodeURIComponent(b.id)}">
        <span class="hr-mono br-f${window.CFB.finish(b.name)}" aria-hidden="true">${esc(initial(b.name))}</span>
        <span class="hr-name">${esc(b.name)}</span>
        ${b.price ? `<span class="hr-price"><span class="sr-only">Price: </span><span aria-hidden="true">${esc(b.price)}</span> ${window.CFB.PRICE[b.price]}</span>` : ""}
        <span class="hr-chips">${window.CFB.certChips(v)}</span>
      </a></li>`).join("") +
      (pass.length > MAX ? `<li><a class="hr-card hr-more" href="#brands"><span class="hr-name">See all ${pass.length}</span></a></li>` : "");
    box.hidden = false;
    // First load asks twice in a row (data arrives, Home opens): the second, within a second and
    // with nothing changed, would only restart the fade.
    if (html === drawn && Date.now() - drawnAt < 1000) return;
    drawn = html; drawnAt = Date.now();
    list.classList.toggle("is-arriving", arriving === true);
    list.innerHTML = html;
  }

  window.CFB.brands.then((list) => { brands = list || []; draw(true); });
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "home") draw(true); });   // the strictness may have changed
  document.addEventListener("cfb:saved", () => draw());
})();
