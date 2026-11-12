/* C.F.B. Home: the rail of brands that pass. The verdict and its words are brands.js's
   (CFB.verdict); this file only lays them out. Hearted brands come first. */
(function () {
  "use strict";
  const MAX = 8;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const box = document.getElementById("home-rail");
  let brands = [];

  function draw() {
    if (!brands.length) { box.hidden = true; return; }
    const mode = window.CFB.mode();
    const saved = window.CFB.saved;
    const hearted = (b) => (saved && saved.has && saved.has(b.id) ? 1 : 0);
    const pass = brands.map((b) => ({ b, v: window.CFB.verdict(b, mode) })).filter((r) => r.v.pass)
      .sort((x, y) => (hearted(y.b) - hearted(x.b)) || x.b.name.localeCompare(y.b.name));
    if (!pass.length) { box.hidden = true; return; }
    document.getElementById("home-rail-count").textContent = `${pass.length} · ${mode === "strict" ? "Strict" : "Certified"}`;
    document.getElementById("home-rail-list").innerHTML = pass.slice(0, MAX).map(({ b, v }) => `
      <li><a class="hr-card" href="#brand/${encodeURIComponent(b.id)}">
        <span class="hr-mono" aria-hidden="true">${esc(b.name.trim()[0].toUpperCase())}</span>
        <span class="hr-name">${esc(b.name)}</span>
        <span class="hr-chips">${v.certs.map((c) => `<span class="verdict v-pass"><span aria-hidden="true">✓&nbsp;</span><span class="sr-only">Certified by </span>${c}</span>`).join("")}</span>
      </a></li>`).join("") +
      (pass.length > MAX ? `<li><a class="hr-card hr-more" href="#brands"><span class="hr-name">See all ${pass.length}</span></a></li>` : "");
    box.hidden = false;
  }

  window.CFB.brands.then((list) => { brands = list || []; draw(); });
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "home") draw(); });   // the strictness may have changed
  document.addEventListener("cfb:saved", draw);
})();
