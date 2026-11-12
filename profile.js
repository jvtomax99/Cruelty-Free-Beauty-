/* C.F.B. beauty profile: an 8-question quiz, the profile, and a routine of brands per step.
   Answers stay on this phone (localStorage "cfb-profile"); nothing is sent anywhere.
   The routine suggests brands, not products: we hold no sourced product data (SPEC, 2026-11-11). */
(function () {
  "use strict";
  const { store } = window.CFB;
  const app = document.getElementById("profile-app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const QUESTIONS = [
    { key: "skin", q: "What's your skin type?", options: [["dry", "Dry"], ["oily", "Oily"], ["combination", "Combination"], ["normal", "Normal"]] },
    { key: "depth", q: "How light or deep is your skin?", options: [["fair", "Fair"], ["light", "Light"], ["medium", "Medium"], ["tan", "Tan"], ["deep", "Deep"]] },
    { key: "veins", q: "Look at the veins on your inner wrist in daylight. What colour are they?", options: [["cool", "Blue or purple"], ["warm", "Green"], ["neutral", "Can't tell, or both"]] },
    { key: "jewelry", q: "Which jewelry looks better on you?", options: [["warm", "Gold"], ["cool", "Silver"], ["neutral", "Both"]] },
    { key: "sun", q: "What does your skin do in the sun?", options: [["cool", "Burns"], ["warm", "Tans"], ["neutral", "A bit of both"]] },
    { key: "finish", q: "What finish do you like?", options: [["matte", "Matte"], ["natural", "Natural"], ["dewy", "Dewy"]] },
    { key: "budget", q: "What do you usually spend?", options: [["$", "$ Drugstore"], ["$$", "$$ Mid"], ["$$$", "$$$ Luxury"], ["any", "Any"]] },
    { key: "vegan", q: "Only brands whose whole range is vegan?", options: [["yes", "Yes"], ["no", "No, either is fine"]] },
  ];
  const LABEL = Object.fromEntries(QUESTIONS.map((q) => [q.key, Object.fromEntries(q.options)]));
  const STEPS = [["foundation", "Foundation"], ["concealer", "Concealer"], ["blush", "Blush"], ["bronzer", "Bronzer"], ["lip", "Lip"]];
  const UNDERTONE = { cool: "Cool", warm: "Warm", neutral: "Neutral" };
  const pin = (key, size) => `<img class="rt-pin" src="assets/pins/${key}.webp" alt="" width="${size}" height="${size}">`;
  const allPins = (size) => `<div class="rt-pins" aria-hidden="true">${STEPS.map(([k]) => pin(k, size)).join("")}</div>`;

  // Majority of the three tests; a tie (or no majority) is neutral.
  function undertoneFrom(a) {
    const votes = [a.veins, a.jewelry, a.sun];
    for (const t of ["cool", "warm", "neutral"]) if (votes.filter((v) => v === t).length >= 2) return t;
    return "neutral";
  }

  // A saved profile is used only if every answer is one we know; anything else starts the quiz fresh.
  function valid(p) {
    return p && typeof p === "object" && QUESTIONS.every((q) => Object.prototype.hasOwnProperty.call(LABEL[q.key], p[q.key])) && UNDERTONE[p.undertone];
  }
  function load() { try { const p = JSON.parse(store.get("profile", "null")); return valid(p) ? p : null; } catch (_) { return null; } }
  function save(p) { store.set("profile", JSON.stringify(p)); }
  function clear() { try { localStorage.removeItem("cfb-profile"); } catch (_) {} }

  let answers = {};
  let step = 0;
  let inQuiz = false;   // a quiz in progress survives switching screens

  /* ---------- Quiz ---------- */
  function renderQuestion() {
    const Q = QUESTIONS[step];
    app.innerHTML = `
      <div class="quiz">
        <p class="quiz-progress">${step + 1} of ${QUESTIONS.length}</p>
        <div class="quiz-bar" aria-hidden="true"><span style="width:${((step) / QUESTIONS.length) * 100}%"></span></div>
        <fieldset>
          <legend class="quiz-q" tabindex="-1">${esc(Q.q)}</legend>
          ${step >= 2 && step <= 4 ? '<p class="quiz-hint">One of three quick undertone tests. A starting point, not a measurement.</p>' : ""}
          <div class="quiz-options">
            ${Q.options.map(([v, l]) => `<button type="button" class="quiz-opt" data-v="${esc(v)}" aria-pressed="${answers[Q.key] === v}">${esc(l)}</button>`).join("")}
          </div>
        </fieldset>
        ${step > 0 ? '<button type="button" class="quiz-back">Back</button>' : ""}
      </div>`;
    app.querySelectorAll(".quiz-opt").forEach((b) => b.addEventListener("click", () => {
      answers[Q.key] = b.dataset.v;
      if (step < QUESTIONS.length - 1) { step++; renderQuestion(); focusQuestion(); }
      else finish();
    }));
    const back = app.querySelector(".quiz-back");
    if (back) back.addEventListener("click", () => { step--; renderQuestion(); focusQuestion(); });
  }
  const focusQuestion = () => { const l = app.querySelector(".quiz-q"); if (l) l.focus({ preventScroll: true }); window.scrollTo(0, 0); };

  function start() { answers = {}; step = 0; inQuiz = true; renderQuestion(); focusQuestion(); }

  function finish() {
    const p = { ...answers, undertone: undertoneFrom(answers), undertoneSet: false, saved: new Date().toISOString().slice(0, 10) };
    save(p);
    inQuiz = false;
    renderProfile(p, true);
    window.scrollTo(0, 0);
  }

  /* ---------- Profile and routine ---------- */
  function pick(brands, p, stepKey) {
    const mode = window.CFB.mode();
    return brands
      .filter((b) => b.sells && b.sells[stepKey])
      .filter((b) => window.CFB.verdict(b, mode).pass)
      .filter((b) => p.budget === "any" || b.price === p.budget)
      .filter((b) => p.vegan !== "yes" || b.vegan === "all")
      .sort((x, y) => {
        const both = (b) => (b.peta.status === "yes" && b.leapingBunny.status === "yes" ? 0 : 1);
        return both(x) - both(y) || x.name.localeCompare(y.name);
      })
      .slice(0, 3);
  }

  function why(b, mode) {
    const parts = [`Passes ${mode === "strict" ? "Strict" : "Certified"}`];
    if (b.price) parts.push(b.price);
    if (b.vegan === "all") parts.push("vegan, per PETA");
    return parts.join(" · ");
  }

  async function renderProfile(p, focus) {
    const brands = await window.CFB.brands;
    if (!brands.length) {
      app.innerHTML = `<div class="pf-card"><h2 tabindex="-1">Your profile</h2><p class="pf-sum">Couldn't load the brand list. Check your connection and reopen the app.</p></div>`;
      return;
    }
    const mode = window.CFB.mode();
    const modeName = mode === "strict" ? "Strict" : "Certified";
    const unchecked = brands.filter((b) => !b.sells && window.CFB.verdict(b, mode).pass).length;
    const depth = LABEL.depth[p.depth], tone = UNDERTONE[p.undertone];
    const summary = [`${LABEL.skin[p.skin]} skin`, depth, `${tone} undertone`, `${LABEL.finish[p.finish]} finish`, p.budget === "any" ? "Any budget" : LABEL.budget[p.budget], p.vegan === "yes" ? "Vegan only" : ""].filter(Boolean);

    // When every step gives the same brands (most brands sell all five), show them once.
    const lists = STEPS.map(([key]) => pick(brands, p, key));
    const same = lists.every((l) => l.map((b) => b.id).join() === lists[0].map((b) => b.id).join());
    const groups = same ? [[["foundation", "Your whole routine: foundation, concealer, blush, bronzer and lip"], lists[0]]] : STEPS.map((s, i) => [s, lists[i]]);
    const blocks = groups.map(([[key, name], list]) => {
      const shadeTip = key === "foundation" || key === "concealer";
      const items = list.length ? list.map((b) => {
        const f = b.shadeFinder;
        const finder = shadeTip && f ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${f.label === "Brand's site" ? "Brand's site" : "Find your shade"}</a>` : "";
        return `<li>
          <a class="rt-brand" href="#brand/${encodeURIComponent(b.id)}">${esc(b.name)}</a>
          <span class="rt-why">${esc(why(b, mode))}</span>
          ${finder ? `<span class="rt-links">${finder}${f.label !== "Shade finder" && f.label !== "Brand's site" ? ` <span class="rt-kind">(${esc(f.label.toLowerCase())})</span>` : ""}</span>` : ""}
        </li>`;
      }).join("") : `<li class="rt-none">No brand on our list fits ${same ? "your routine" : "this step"}${p.budget !== "any" ? " at this budget. Try “Any” budget." : "."}</li>`;
      return `<div class="rt-step">
        <div class="rt-top">${same ? "" : pin(key, 44)}<h3>${name}</h3>${list.length ? `<span class="rt-count">${list.length} ${list.length === 1 ? "brand" : "brands"}</span>` : ""}</div>
        ${same ? allPins(40) : ""}
        ${shadeTip && list.length ? `<p class="rt-tip">Tell the shade finder: ${esc(depth.toLowerCase())} depth, ${esc(tone.toLowerCase())} undertone.</p>` : ""}
        <ul>${items}</ul>
      </div>`;
    }).join("");

    app.innerHTML = `
      <div class="pf-card pf-hero">
        <img class="pf-pin" src="assets/pins/profile.webp" alt="" width="84" height="84">
        <div class="pf-eyebrow">Your beauty profile</div>
        <h2 tabindex="-1" id="pf-h">Your profile</h2>
        <ul class="pf-sum">${summary.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="pf-tone">Undertone ${p.undertoneSet ? "set by you" : "from your three tests"}. A starting point; check in daylight.</p>
        <div class="pf-tones" role="group" aria-label="Change undertone">
          ${Object.entries(UNDERTONE).map(([v, l]) => `<button type="button" class="chip" data-tone="${v}" aria-pressed="${p.undertone === v}">${l}</button>`).join("")}
        </div>
      </div>
      <h2 class="rt-head">Your routine</h2>
      <p class="rt-intro">Brands that pass ${modeName} (change it on the Brands screen), fit your budget${p.vegan === "yes" ? ", are fully vegan" : ""} and sell each step. We suggest brands, not products: shades and formulas are on each brand's own site. Your skin type and finish don't change the picks yet: we don't have sourced data on which products suit them.${unchecked ? ` ${unchecked} brand${unchecked === 1 ? "'s" : "s'"} ranges aren't checked yet, so they're left out.` : ""}</p>
      ${blocks}
      <div class="pf-actions">
        <button type="button" class="more" id="pf-retake">Retake the quiz</button>
        <button type="button" class="more" id="pf-clear">Clear my answers</button>
      </div>
      <p class="pf-private">Your answers are saved only on this phone.</p>`;

    app.querySelectorAll("[data-tone]").forEach((b) => b.addEventListener("click", () => {
      const next = { ...p, undertone: b.dataset.tone, undertoneSet: true };
      save(next); renderProfile(next, true);
    }));
    document.getElementById("pf-retake").addEventListener("click", start);
    document.getElementById("pf-clear").addEventListener("click", () => { clear(); renderIntro(); const s = document.getElementById("pf-start"); if (s) s.focus(); });
    if (focus) document.getElementById("pf-h").focus({ preventScroll: true });
  }

  function renderIntro() {
    app.innerHTML = `
      <div class="pf-intro pf-hero">
        <div class="pf-eyebrow">Eight questions, five steps</div>
        ${allPins(52)}
        <p>Eight quick questions: skin type, depth, three undertone tests, finish, budget and vegan. Then a routine from brands that pass your setting.</p>
        <button type="button" class="pf-start" id="pf-start">Start the quiz</button>
        <p class="pf-private">Your answers stay on this phone. Nothing is sent anywhere.</p>
      </div>`;
    document.getElementById("pf-start").addEventListener("click", start);
  }

  // Redraw on each visit, so a strictness change on the Brands screen shows up here.
  function show() {
    if (inQuiz) { if (!app.querySelector(".quiz")) renderQuestion(); return; }
    const p = load(); if (p) renderProfile(p); else renderIntro();
  }
  /* ---------- Saved brands (hearts on brand pages and scan results) ---------- */
  const savedApp = document.getElementById("saved-app");
  let refocus = false;
  async function renderSaved() {
    const brands = await window.CFB.brands;
    const ids = window.CFB.saved.list();
    const list = ids.map((id) => brands.find((b) => b.id === id)).filter(Boolean);
    const mode = window.CFB.mode();
    const rows = list.map((b) => {
      const v = window.CFB.verdict(b, mode);
      return `<li class="sv-row">
        <a class="brand-row" href="#brand/${encodeURIComponent(b.id)}"><span class="brand-name">${esc(b.name)}</span><span class="brand-meta"><span class="verdict v-${v.kind}">${window.CFB.CHIP[v.kind]}</span></span></a>
        <button type="button" class="sv-remove" data-unsave="${esc(b.id)}">Remove<span class="sr-only"> ${esc(b.name)}</span></button>
      </li>`;
    }).join("");
    savedApp.innerHTML = `
      <h2 class="rt-head" id="sv-h" tabindex="-1">Saved brands</h2>
      ${list.length
        ? `<p class="rt-intro">Verdicts under ${mode === "strict" ? "Strict" : "Certified"}, as of today's data.</p><ul class="brand-list sv-list">${rows}</ul>`
        : `<p class="sv-empty">Tap Save on a brand's page or after a scan, and it shows here.</p>`}`;
    savedApp.querySelectorAll("[data-unsave]").forEach((x) => x.addEventListener("click", () => {
      refocus = true;
      window.CFB.saved.toggle(x.dataset.unsave);   // fires cfb:saved, which redraws
    }));
    if (refocus) {   // after Remove, keep focus in the list rather than losing it to the page
      refocus = false;
      (savedApp.querySelector("[data-unsave]") || document.getElementById("sv-h")).focus({ preventScroll: true });
    }
  }
  document.addEventListener("cfb:saved", renderSaved);

  document.addEventListener("cfb:screen", (e) => { if (e.detail.name === "profile") { show(); renderSaved(); } });
  show();
  renderSaved();
})();
