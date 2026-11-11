/* C.F.B. barcode scanner (#scan).
   Camera or photo -> barcode -> Open Beauty Facts (barcode to brand) -> our brand data.
   Android Chrome has a built-in reader (BarcodeDetector); iPhone Safari doesn't, so there we
   load the vendored one (assets/vendor/barcode-detector, MIT; reader zxing-cpp, Apache 2.0).
   Only the barcode number leaves the phone. Scans stay in localStorage. */
(function () {
  "use strict";
  const { store } = window.CFB;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
  const VENDOR = "assets/vendor/barcode-detector/";
  const OBF = "https://world.openbeautyfacts.org";
  const PETA_SEARCH = "https://crueltyfree.peta.org/?s=";
  const LB_GUIDE = "https://www.leapingbunny.org/Web/Shopping-Guide/Brands.aspx";
  const TIMEOUT_MS = 9000;

  const video = $("scan-video"), cam = $("scan-cam"), startBtn = $("scan-start"), status = $("scan-status"), out = $("scan-result");
  let detector = null, stream = null, running = false, timer = 0, busy = false;

  /* ---------- Saved lists (always parsed defensively: storage can hold anything) ---------- */
  const readList = (k) => { try { const a = JSON.parse(store.get(k, "[]")); return Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : []; } catch (_) { return []; } };
  function remember(entry) {
    const list = readList("scans").filter((s) => s.code !== entry.code || !entry.code);
    store.set("scans", JSON.stringify([entry, ...list].slice(0, 10)));
    if (!entry.brand && entry.name) {
      const key = entry.name.toLowerCase();
      const un = readList("unlisted").filter((u) => String(u.name).toLowerCase() !== key);
      store.set("unlisted", JSON.stringify([{ name: entry.name, code: entry.code || "", t: entry.t }, ...un].slice(0, 50)));
    }
    renderRecent();
  }

  /* ---------- The reader ---------- */
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = () => fail(new Error("load " + src));
      document.head.appendChild(s);
    });
  }
  async function getDetector() {
    if (detector) return detector;
    if ("BarcodeDetector" in window) {
      try {
        const have = await window.BarcodeDetector.getSupportedFormats();
        if (FORMATS.every((f) => have.includes(f))) return (detector = new window.BarcodeDetector({ formats: FORMATS }));
      } catch (_) { /* fall through to the vendored reader */ }
    }
    if (!window.BarcodeDetectionAPI) await loadScript(VENDOR + "barcode-detector.js");
    const api = window.BarcodeDetectionAPI;
    // Never the CDN: the reader comes from our own folder, so it's precached and works offline.
    const wasm = new URL(VENDOR + "zxing_reader.wasm", document.baseURI).href;
    api.setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasm : prefix + path) });
    return (detector = new api.BarcodeDetector({ formats: FORMATS }));
  }

  /* ---------- Camera ---------- */
  async function startCamera() {
    if (running) { stopCamera(); return; }
    out.innerHTML = "";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say("This browser can't open the camera here. Take a photo of the barcode, or type its numbers below.");
      return;
    }
    say("Opening the camera…");
    try {
      const [s] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
        getDetector(),
      ]);
      stream = s;
    } catch (err) {
      stopCamera();
      say(err && err.name === "NotAllowedError"
        ? "Camera access is off for C.F.B. You can allow it in your phone's settings, or take a photo of the barcode instead."
        : err && /load/.test(err.message || "") ? "Couldn't load the barcode reader. Check your connection, or type the numbers below."
        : "Couldn't open the camera. Take a photo of the barcode, or type its numbers below.");
      return;
    }
    video.srcObject = stream;
    cam.hidden = false;
    try { await video.play(); } catch (_) {}
    running = true;
    startBtn.textContent = "Stop camera";
    say("Hold the barcode inside the frame.");
    tick();
  }
  function stopCamera() {
    running = false;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    cam.hidden = true;
    startBtn.textContent = "Start camera";
  }
  async function tick() {
    if (!running) return;
    if (!busy && video.readyState >= 2) {
      busy = true;
      try {
        const found = await detector.detect(video);
        const code = found.map((f) => f.rawValue).find(validCode);
        if (code && running) {
          stopCamera();
          if (navigator.vibrate) navigator.vibrate(40);
          busy = false;
          lookup(code);
          return;
        }
      } catch (_) { /* a frame that can't be read; try the next */ }
      busy = false;
    }
    timer = setTimeout(tick, 220);
  }

  /* ---------- Photo ---------- */
  async function fromPhoto(file) {
    if (!file) return;
    stopCamera();
    out.innerHTML = "";
    say("Reading the photo…");
    try {
      const d = await getDetector();
      const img = await createImageBitmap(file);
      const found = await d.detect(img);
      if (img.close) img.close();
      const code = found.map((f) => f.rawValue).find(validCode);
      if (code) { lookup(code); return; }
      say("Couldn't find a barcode in that photo. Try closer, in good light, or type the numbers below.");
    } catch (_) {
      say("Couldn't read that photo. Try again, or type the numbers below.");
    }
  }

  /* ---------- Lookup ---------- */
  const validCode = (c) => /^\d{8}$|^\d{12,14}$/.test(String(c || "").trim());
  function say(msg) { status.textContent = msg; }

  async function lookup(code) {
    code = String(code).trim();
    say(`Barcode ${code}. Looking it up…`);
    out.innerHTML = "";
    const brands = await window.CFB.brands;
    if (!brands.length) { say("Couldn't load our brand list. Check your connection and reopen the app."); return; }
    let product = null, reached = false;
    const ctl = new AbortController();
    const stop = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${OBF}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,brands_tags`, { signal: ctl.signal });
      if (r.ok || r.status === 404) {
        reached = true;
        const j = await r.json().catch(() => ({}));
        if (j && j.status === 1 && j.product) product = j.product;
      }
    } catch (_) { /* offline or Open Beauty Facts is down */ }
    clearTimeout(stop);
    say("");

    if (!reached) { showAskBrand(code, "offline"); return; }
    const brandText = product ? String(product.brands || "").trim() : "";
    if (!product || !brandText) { showAskBrand(code, product ? "nobrand" : "unknown", product); return; }
    const b = window.CFB.match([brandText, ...(product.brands_tags || [])]);
    const name = product.product_name ? String(product.product_name).trim() : "";
    if (b) showBrand(b, { code, product: name });
    else showUnlisted(brandText.split(",")[0].trim(), { code, product: name });
  }

  /* ---------- Results ---------- */
  function obfLine(code) {
    return `<p class="src">Product from <a href="${OBF}/product/${encodeURIComponent(code)}" target="_blank" rel="noopener">Open Beauty Facts</a>, a free product database anyone can edit.</p>`;
  }
  function showBrand(b, { code, product }) {
    const mode = window.CFB.mode();
    const v = window.CFB.verdict(b, mode);
    const modeName = mode === "strict" ? "Strict" : "Certified";
    out.innerHTML = `
      <div class="scan-card">
        ${product ? `<p class="scan-product">${esc(product)}</p>` : ""}
        <h2 class="scan-brand" tabindex="-1" id="scan-h">${esc(b.name)}</h2>
        <div class="verdict-box v-${v.kind}">
          <p class="verdict-title">${v.pass ? `Passes ${modeName}` : window.CFB.CHIP[v.kind]}</p>
          <p>${esc(v.reason)}</p>
          ${v.notes.length ? `<p class="verdict-notes">${esc(v.notes.join(" "))}</p>` : ""}
        </div>
        <div class="scan-actions">
          <a class="pf-start scan-go" href="#brand/${encodeURIComponent(b.id)}">See the proof</a>
          ${window.CFB.saveButton(b)}
        </div>
        ${code ? obfLine(code) : ""}
        <p class="src">The verdict is for the brand, not this one product.</p>
      </div>`;
    focusResult();
    remember({ code: code || "", product: product || "", brand: b.id, name: b.name, t: Date.now() });
  }
  function showUnlisted(name, { code, product }) {
    const total = window.CFB.brandCount || 0;
    out.innerHTML = `
      <div class="scan-card">
        ${product ? `<p class="scan-product">${esc(product)}</p>` : ""}
        <h2 class="scan-brand" tabindex="-1" id="scan-h">We haven't checked ${esc(name)} yet</h2>
        <p class="scan-text">It isn't one of the${total ? ` ${total}` : ""} brands we've verified, so we can't say whether it's cruelty-free. Look it up on the certifiers' own lists:</p>
        <ul class="buy">
          <li><a href="${PETA_SEARCH}${encodeURIComponent(name)}" target="_blank" rel="noopener">Search PETA for ${esc(name)}</a></li>
          <li><a href="${LB_GUIDE}" target="_blank" rel="noopener">Leaping Bunny's shopping guide</a> <span>search ${esc(name)} there</span></li>
        </ul>
        <p class="src">Noted on this phone, so it's easy to ask us to add it.</p>
        ${code ? obfLine(code) : ""}
      </div>`;
    focusResult();
    remember({ code: code || "", product: product || "", brand: null, name, t: Date.now() });
  }
  function showAskBrand(code, why, product) {
    const lead = why === "offline" ? "Can't reach Open Beauty Facts right now (you may be offline)."
      : why === "nobrand" ? "Open Beauty Facts has this product but not its brand."
      : "This barcode isn't in Open Beauty Facts yet.";
    out.innerHTML = `
      <div class="scan-card">
        ${product && product.product_name ? `<p class="scan-product">${esc(product.product_name)}</p>` : ""}
        <h2 class="scan-brand" tabindex="-1" id="scan-h">Which brand is on the box?</h2>
        <p class="scan-text">${lead} Type the brand and we'll check it.</p>
        <form class="scan-form" id="scan-brand-form">
          <label class="search search-field">
            <span class="sr-only">Brand name</span>
            <input id="scan-brand-q" type="text" list="scan-brand-names" placeholder="Brand name" autocomplete="off" spellcheck="false" required>
          </label>
          <button type="submit" class="pf-start">Check this brand</button>
        </form>
        ${why === "unknown" ? `<p class="src">Barcode ${esc(code)}. You can add it at <a href="${OBF}/contribute" target="_blank" rel="noopener">Open Beauty Facts</a>, so the next scan finds it.</p>` : ""}
      </div>`;
    $("scan-brand-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const typed = $("scan-brand-q").value.trim();
      if (!typed) return;
      const b = window.CFB.match(typed);
      if (b) showBrand(b, { code: "", product: "" });
      else showUnlisted(typed, { code: "", product: "" });
    });
    focusResult();
  }
  function focusResult() {
    const h = $("scan-h");
    if (h) { h.focus({ preventScroll: true }); h.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  }

  /* ---------- Recent scans ---------- */
  function renderRecent() {
    const list = readList("scans"), un = readList("unlisted");
    const box = $("scan-recent-box");
    box.hidden = !list.length;
    $("scan-recent").innerHTML = list.map((s) => {
      const label = s.product ? `${esc(s.product)}` : s.code ? `Barcode ${esc(s.code)}` : "Typed brand";
      return s.brand
        ? `<li><a class="brand-row" href="#brand/${encodeURIComponent(s.brand)}"><span class="brand-name">${esc(s.name)}</span><span class="brand-why">${label}</span></a></li>`
        : `<li><div class="brand-row scan-row-off"><span class="brand-name">${esc(s.name)}</span><span class="brand-why">${label} · not checked yet</span></div></li>`;
    }).join("");
    $("scan-unlisted").textContent = un.length ? `Brands you looked up that we haven't checked: ${un.slice(0, 8).map((u) => u.name).join(", ")}${un.length > 8 ? ` and ${un.length - 8} more` : ""}.` : "";
  }

  /* ---------- Wiring ---------- */
  startBtn.addEventListener("click", startCamera);
  $("scan-photo").addEventListener("change", (e) => { fromPhoto(e.target.files && e.target.files[0]); e.target.value = ""; });
  $("scan-code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("scan-code").value.replace(/\D/g, "");
    if (!validCode(v)) { say("A barcode has 8, 12 or 13 numbers. Check and try again."); return; }
    stopCamera();
    lookup(v);
  });
  $("scan-clear").addEventListener("click", () => {
    try { localStorage.removeItem("cfb-scans"); localStorage.removeItem("cfb-unlisted"); } catch (_) {}
    renderRecent();
  });
  // Never leave the camera on behind another screen or app.
  document.addEventListener("cfb:screen", (e) => { if (e.detail.name !== "scan") stopCamera(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopCamera(); });

  window.CFB.brands.then((list) => {
    window.CFB.brandCount = list.length;
    $("scan-brand-names").innerHTML = list.map((b) => `<option value="${esc(b.name)}"></option>`).join("");
  });
  renderRecent();
})();
