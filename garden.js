/* C.F.B. Your Sanctuary: a study game. Rounds of 5 questions; five habitats grow with what
   the person has learned. Written questions: data/questions.json (each with its source).
   Brand questions are built here from data/brands.json through CFB.verdict, never stored,
   so a recheck can't leave a stale answer. Progress stays on the phone (cfb-garden).
   The 3D world (sanctuary3d.js) is loaded only when this screen opens and only where it can
   run; without it the habitat cards below are the whole screen.
   Rules (SPEC "The Garden"): the sanctuary grows only from learning, never from scanning,
   saving or buying. The learned count is honest and can drop after a miss, but a rabbit that
   has moved in never leaves (state.best is a high-water mark). */
(function () {
  "use strict";
  const store = window.CFB.store;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ""); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ""; };
  const DAY = 864e5;
  const DUE_DAYS = 90;   // a brand whose check is older than this is left out (SPEC brand rule 6)
  const stale = (iso) => !iso || (Date.now() - new Date(iso + "T00:00:00").getTime()) / DAY > DUE_DAYS;

  const TOPICS = [
    { id: "meadow", name: "Bunny Meadow", sub: "Cruelty-free or vegan" },
    { id: "burrow", name: "Burrow hill", sub: "PETA or Leaping Bunny" },
    { id: "oak", name: "Old oak", sub: "Parent companies" },
    { id: "pond", name: "Pond", sub: "China today" },
    { id: "orchard", name: "Orchard", sub: "Read a brand" },
  ];
  const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
  const ROUND = 5;
  /* A right answer comes back after these waits; a miss comes back in the next round. */
  const WAITS = [5 * 60e3, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
  const LEARNED = 2;   // right on two separate occasions

  /* ---------- Progress: { v, items: { id: { s: stage, due: ms, k: answer it was learned with } }, best: { habitat: residents } } ---------- */
  let state = { v: 1, items: {}, best: {} };
  try {
    const raw = JSON.parse(store.get("garden", "null"));
    if (raw && raw.v === 1 && raw.items && typeof raw.items === "object" && !Array.isArray(raw.items)) {
      for (const [id, it] of Object.entries(raw.items)) {   // keep only entries that make sense
        if (it && Number.isInteger(it.s) && it.s >= 0 && it.s <= WAITS.length && Number.isFinite(it.due)) state.items[id] = { s: it.s, due: it.due, k: typeof it.k === "string" ? it.k : "w" };
      }
      if (raw.best && typeof raw.best === "object" && !Array.isArray(raw.best)) for (const t of TOPICS) if ([1, 2, 3].includes(raw.best[t.id])) state.best[t.id] = raw.best[t.id];
    }
  } catch (_) {}
  const save = () => store.set("garden", JSON.stringify(state));

  let bank = [];        // every question that can be asked today
  let loaded = false, failed = false;

  /* ---------- The bank ---------- */
  function brandQuestions(brands) {
    const CHIP = window.CFB.CHIP, out = [];
    for (const b of brands) {
      if (stale(b.peta.checked) || stale(b.leapingBunny.checked)) continue;
      const v = window.CFB.verdict(b, "strict");
      const byParent = v.kind === "fail" && (b.peta.status === "yes" || b.leapingBunny.status === "yes") && b.parent.testsOnAnimals === "yes" && b.parent.name && b.parent.name !== b.name;
      const byChina = v.kind === "fail" && !byParent && b.chinaRetail.status === "yes";
      // the answer rests on that claim, so it needs its own link and a check that isn't due
      if (byParent && (!b.parent.url || stale(b.parent.checked))) continue;
      if (byChina && (!b.chinaRetail.url || stale(b.chinaRetail.checked))) continue;
      const src = [];
      if (b.peta.url) src.push({ t: "PETA: " + b.name, u: b.peta.url, checked: b.peta.checked });
      if (b.leapingBunny.url) src.push({ t: "Leaping Bunny: " + b.name, u: b.leapingBunny.url, checked: b.leapingBunny.checked });
      if (byParent) src.push({ t: "Parent company: " + b.parent.name, u: b.parent.url, checked: b.parent.checked });
      if (byChina) src.push({ t: "Where it sells", u: b.chinaRetail.url, checked: b.chinaRetail.checked });
      if (!src.length) continue;   // no proof to show, so no question
      out.push({
        id: "brand:" + b.id, topic: "orchard", key: v.kind,
        q: `On Strict, how does ${b.name} show in C.F.B.?`,
        options: [CHIP[v.kind], ...["pass", "fail", "none"].filter((k) => k !== v.kind).map((k) => CHIP[k])],
        why: [v.reason, ...v.notes].join(" "), src,
      });
    }
    return out;
  }
  let ready = null;
  function load() {   // tried again each time the screen opens after a failure
    failed = false;
    ready = Promise.all([
      fetch("data/questions.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      window.CFB.data,
    ]).then(([file, data]) => {
      const written = file.questions.map((q) => ({ ...q, key: "w", src: q.src.map((k) => file.sources[k]) }));
      bank = [...written, ...brandQuestions(data.brands || [])];
      // An answer learned under an older verdict no longer counts (a recheck changed the brand).
      for (const q of bank) { const it = state.items[q.id]; if (it && it.k !== q.key) delete state.items[q.id]; }
      loaded = true;
    }).catch(() => { failed = true; });
    return ready;
  }
  const whenReady = () => (failed ? load() : ready);
  load();

  /* ---------- Counting ---------- */
  function tally(topicId) {
    const qs = bank.filter((q) => !topicId || q.topic === topicId);
    const now = Date.now();
    let learned = 0, points = 0, due = 0;
    for (const q of qs) {
      const it = state.items[q.id], s = it ? it.s : 0;
      if (s >= LEARNED) learned++;
      points += Math.min(s, LEARNED);
      if (it && it.due <= now) due++;
    }
    return { total: qs.length, learned, due, p: qs.length ? points / (LEARNED * qs.length) : 0 };
  }
  const WORD = (t) => (t.p >= 1 ? "In bloom" : t.p >= 0.5 ? "Growing" : t.p > 0 ? "Sprouting" : "Bare ground");
  /* Residents of a habitat: one from the start, a second at a third learned, a third at two thirds.
     Kept as a high-water mark: an animal that has moved in stays. */
  function residents(topicId) {
    const n = tally(topicId), now = n.total ? 1 + (n.learned * 3 >= n.total ? 1 : 0) + (n.learned * 3 >= n.total * 2 ? 1 : 0) : 1;
    if (now > (state.best[topicId] || 1)) { state.best[topicId] = now; save(); }
    return state.best[topicId] || 1;
  }

  /* ---------- Picking a round: missed and due first, then new, then the ones due soonest ---------- */
  function pick(topicId) {
    const now = Date.now();
    const pool = bank.filter((q) => topicId === "all" || q.topic === topicId);
    const due = [], fresh = [], waiting = [];
    for (const q of pool) {
      const it = state.items[q.id];
      if (!it) fresh.push(q); else if (it.due <= now) due.push(q); else waiting.push(q);
    }
    due.sort((a, b) => state.items[a.id].due - state.items[b.id].due);
    waiting.sort((a, b) => state.items[a.id].due - state.items[b.id].due);
    if (topicId === "all") shuffle(fresh);   // a mixed round shouldn't always open on the Meadow
    else { const w = fresh.filter((q) => q.key === "w"), br = shuffle(fresh.filter((q) => q.key !== "w")); fresh.length = 0; fresh.push(...w, ...br); }
    return [...due, ...fresh, ...waiting].slice(0, ROUND);
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* Record an answer. A right answer given before the question was due again doesn't count
     twice (no cramming a habitat into bloom in one sitting); a miss always resets it. */
  function record(q, right) {
    const now = Date.now(), it = state.items[q.id];
    if (!right) state.items[q.id] = { s: 0, due: now, k: q.key };
    else if (!it) state.items[q.id] = { s: 1, due: now + WAITS[0], k: q.key };
    else if (it.due <= now) { const s = Math.min(it.s + 1, WAITS.length); state.items[q.id] = { s, due: now + WAITS[s - 1], k: q.key }; }
    save();
  }

  /* ---------- The screen: the 3D world (where it can run), then every habitat as a card ---------- */
  const LOAD_FAIL = `<p class="gd-note">The questions couldn't load. Check your connection, then open this screen again.</p>`;
  function drawGarden() {
    const box = $("garden-list");
    if (!box) return;
    if (failed) { box.innerHTML = LOAD_FAIL; return; }
    if (!loaded) return;
    const all = tally();
    $("garden-total").textContent = `${all.learned} of ${all.total} learned`;
    $("garden-all").hidden = false;
    $("garden-all").textContent = all.due ? `Practise 5 (${all.due} to review)` : "Practise 5";
    box.innerHTML = TOPICS.map((t) => {
      const n = tally(t.id);
      return `<a class="gd-card${n.p >= 1 ? " is-bloom" : ""}" href="#practice/${t.id}">
        <span class="gd-name">${esc(t.name)}</span>
        <span class="gd-state">${WORD(n)}</span>
        <span class="gd-sub">${esc(t.sub)}</span>
        <span class="gd-bar" aria-hidden="true"><span style="width:${Math.round(n.p * 100)}%"></span></span>
        <span class="gd-count">${n.learned} of ${n.total} learned${n.due ? ` · ${n.due} to review` : ""}</span>
      </a>`;
    }).join("");
    syncWorld();
  }
  function drawHome() {
    const line = $("gd-home-line");
    if (!line || !loaded) return;
    const all = tally();
    line.textContent = all.learned || all.due ? `${all.learned} of ${all.total} learned${all.due ? ` · ${all.due} to review` : ""}` : `${all.total} questions, 5 at a time`;
  }

  /* ---------- The 3D world ---------- */
  const sx = $("sx"), reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let world = null, worldAsked = false, view = "world", said = false;
  function canWorld() {
    const q = new URLSearchParams(location.search).get("3d");
    if (q === "0" || !sx) return false;
    if (q !== "1" && navigator.connection && navigator.connection.saveData) return false;   // data saver: the cards are enough
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (_) { return false; }
  }
  function openWorld() {
    if (worldAsked) { if (world) { world.start(); syncWorld(); } return; }
    worldAsked = true;
    if (!canWorld()) return;
    sx.classList.add("is-on", "is-loading");
    import("./sanctuary3d.js")
      .then((m) => m.mount($("sx-canvas"), { reduced, low: (navigator.deviceMemory || 8) <= 3, onPick }))
      .then((w) => {
        world = w; sx.classList.remove("is-loading"); sx.classList.add("is-ready");
        syncWorld(); world.start();
        if (location.hash.slice(1) !== "garden") world.stop();
        window.CFB.garden.world = world;
      })
      .catch(() => { sx.classList.remove("is-on", "is-loading"); world = null; });   // the cards below carry on without it
  }
  function syncWorld() {
    if (!sx || !loaded) return;
    const n = tally("meadow");
    if (world) world.setState({ p: n.p, residents: residents("meadow") });
    drawCard();
  }
  function drawCard() {
    const card = $("sx-card"); if (!card || !loaded) return;
    const n = tally("meadow"), here = residents("meadow"), line = `${esc(TOPIC.meadow.sub)} · ${n.learned} of ${n.total} learned`;
    sx.classList.toggle("is-meet", view === "meet");
    $("sx-back").setAttribute("aria-label", view === "meet" ? "Back to the whole sanctuary" : "Back");
    card.hidden = false;
    card.innerHTML = view === "meet" ? `
      <img class="sx-face" src="assets/sanctuary/clover.webp" alt="" width="72" height="72">
      <div class="sx-text">
        <h2 class="sx-name">Meet Clover</h2>
        <p class="sx-desc" id="sx-desc">${said ? "Clover says hello." : "Curious, playful, and very fond of clover."}</p>
        <p class="sx-line">${line}${here < 3 ? `. ${here === 1 ? "Two friends move" : "One more friend moves"} in as you learn.` : ""}</p>
      </div>
      <div class="sx-actions">
        <button class="sx-btn" type="button" id="sx-hello">Say hello</button>
        <a class="sx-btn sx-btn-2" href="#practice/meadow">Practise</a>
      </div>` : `
      <img class="sx-face" src="assets/sanctuary/clover.webp" alt="" width="56" height="56">
      <div class="sx-text">
        <h2 class="sx-name">${esc(TOPIC.meadow.name)}</h2>
        <p class="sx-line">${line}</p>
      </div>
      <button class="sx-btn" type="button" id="sx-visit">Visit</button>`;
  }
  function go(v) { view = v; said = false; if (world) world.go(v); drawCard(); }
  function onPick(what) {   // a tap in the 3D world
    if (!what) return;
    if (view === "world") go("meet");
    else if (what === "clover") hello();
  }
  function hello() { said = true; if (world) world.hello(); const d = $("sx-desc"); if (d) d.textContent = "Clover says hello."; }
  if (sx) sx.addEventListener("click", (e) => {
    if (e.target.closest("#sx-visit")) { go("meet"); const b = $("sx-hello"); if (b) b.focus({ preventScroll: true }); }
    else if (e.target.closest("#sx-hello")) hello();
    else if (e.target.closest("#sx-back")) { if (view === "meet") go("world"); else if (cameFrom) history.back(); else location.hash = "#home"; }
  });

  /* ---------- A round ---------- */
  let round = null;   // { topic, qs, i, right, shown: options as shuffled, answered }
  function start(topicId) {
    const box = $("practice-box");
    const topic = topicId === "all" || TOPIC[topicId] ? topicId : "all";
    $("practice-h").textContent = topic === "all" ? "Practice" : TOPIC[topic].name;
    document.title = "C.F.B. · " + $("practice-h").textContent;
    if (failed) { box.innerHTML = LOAD_FAIL; return; }
    const qs = pick(topic);
    if (!qs.length) { box.innerHTML = `<p class="gd-note">Nothing to practise here yet.</p>`; return; }
    round = { topic, qs, i: 0, right: 0, before: tally(topic === "all" ? null : topic) };
    ask();
  }
  function ask() {
    const q = round.qs[round.i];
    round.shown = shuffle(q.options.map((text, n) => ({ text, ok: n === 0 })));
    round.answered = false;
    $("practice-box").innerHTML = `
      <p class="quiz-progress">Question ${round.i + 1} of ${round.qs.length}${round.topic === "all" ? " · " + esc(TOPIC[q.topic].name) : ""}</p>
      <div class="quiz-bar" aria-hidden="true"><span style="width:${(round.i / round.qs.length) * 100}%"></span></div>
      <h2 class="quiz-q" id="practice-q" tabindex="-1">${esc(q.q)}</h2>
      <div class="quiz-options gd-options">${round.shown.map((o, n) => `<button class="quiz-opt" type="button" data-n="${n}">${esc(o.text)}</button>`).join("")}</div>
      <div id="practice-result"></div>`;
  }
  /* A source inside the app (our own rule) is named, not linked: a link would leave the round. */
  const source = (s) => `<li>${s.u[0] === "#" ? `<span class="gd-own">${esc(s.t)}</span>` : `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`}${day(s.checked) ? `<span class="gd-date">checked ${day(s.checked)}</span>` : ""}</li>`;
  function answer(n) {
    if (!round || round.answered) return;
    round.answered = true;
    const q = round.qs[round.i], right = round.shown[n].ok;
    record(q, right);
    if (right) round.right++;
    round.lastRight = right;
    document.querySelectorAll("#practice-box .quiz-opt").forEach((b, i) => {
      b.disabled = true;
      if (round.shown[i].ok) b.classList.add("is-right");
      else if (i === n) b.classList.add("is-wrong");
    });
    const last = round.i === round.qs.length - 1;
    $("practice-result").innerHTML = `
      <div class="gd-result ${right ? "is-ok" : "is-no"}">
        <h3 class="gd-verdict" id="practice-verdict" tabindex="-1">${right ? "Right" : "Not quite"}</h3>
        ${right ? "" : `<p class="gd-answer">The answer: ${esc(q.options[0])}</p>`}
        <p>${esc(q.why)}</p>
        <div class="sources">${q.src.length > 1 ? "Sources" : "Source"}:
          <ul>${q.src.map(source).join("")}</ul>
        </div>
      </div>
      <button class="pf-start" type="button" id="practice-next">${last ? "See the round" : "Next"}</button>
      ${right ? `<button class="quiz-back" type="button" id="practice-guess">I guessed</button>` : ""}`;
    $("practice-verdict").focus({ preventScroll: true });
    ($("practice-guess") || $("practice-next")).scrollIntoView({ block: "nearest" });   // their scroll margin keeps them clear of the tab bar
  }
  /* "I guessed" turns a lucky right answer into a miss, so the count stays honest. */
  function guessed() {
    if (!round || !round.answered || !round.lastRight) return;
    record(round.qs[round.i], false);
    round.right--; round.lastRight = false;
    $("practice-guess").outerHTML = `<p class="gd-note" id="practice-guessed">Counted as a miss. It will come back in your next round.</p>`;
    $("practice-next").focus({ preventScroll: true });
  }
  function next() {
    if (!round || !round.answered) return;
    if (round.i < round.qs.length - 1) { round.i++; ask(); $("practice-q").focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    const t = round.topic === "all" ? null : round.topic, now = tally(t), was = round.before;
    const gained = now.learned - was.learned;
    const name = t ? TOPIC[t].name : "The sanctuary";
    $("practice-box").innerHTML = `
      <div class="card gd-done">
        <h2 id="practice-done" tabindex="-1">${round.right} of ${round.qs.length} right</h2>
        <p>${esc(name)}: ${now.learned} of ${now.total} learned${gained > 0 ? ` (${gained} more than before)` : ""}. ${t ? WORD(now) + "." : ""}</p>
        <span class="gd-bar" aria-hidden="true"><span style="width:${Math.round(now.p * 100)}%"></span></span>
        <p class="gd-note">A question counts as learned once you get it right twice, at least 5 minutes apart. Missed ones come back first.</p>
      </div>
      <button class="pf-start" type="button" id="practice-again">Another round</button>
      <a class="quiz-back gd-backlink" href="#garden">Back to the sanctuary</a>`;
    const topic = round.topic; round = null;
    $("practice-again").addEventListener("click", () => { start(topic); window.scrollTo(0, 0); });
    $("practice-done").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  const box = $("practice-box");
  if (box) box.addEventListener("click", (e) => {
    const opt = e.target.closest(".quiz-opt");
    if (opt) return answer(Number(opt.dataset.n));
    if (e.target.closest("#practice-next")) return next();
    if (e.target.closest("#practice-guess")) return guessed();
  });
  /* The round's two ways back to the sanctuary go back in history when that is where the person
     came from, so the phone's Back button doesn't then drop them into a new round. */
  let shown = null, cameFrom = null, roundFromGarden = false;
  document.addEventListener("click", (e) => {
    const a = e.target.closest('[data-screen="practice"] a[href="#garden"]');
    if (a && roundFromGarden) { e.preventDefault(); history.back(); }
  });

  function onScreen(name, id) {
    if (name === "practice") roundFromGarden = shown === "garden";
    if (name === "garden" && shown !== "garden" && shown !== "practice") cameFrom = shown;   // null on a direct link
    if (name !== "garden" && world) world.stop();
    if (name === "garden") { whenReady().then(drawGarden); openWorld(); }
    else if (name === "practice") whenReady().then(() => { if (location.hash.slice(1) === "practice/" + id) start(id); });
    else if (name === "home") whenReady().then(drawHome);
    if (name !== "practice") round = null;
    shown = name;
  }
  document.addEventListener("cfb:screen", (e) => onScreen(e.detail.name, e.detail.id));
  // app.js has already shown the first screen by the time this file runs
  {
    const h = location.hash.slice(1);
    if (h === "garden") onScreen("garden"); else if (h.startsWith("practice/")) onScreen("practice", h.slice(9)); else { shown = h.split("/")[0] || "home"; ready.then(drawHome); }
  }

  window.CFB.garden = { tally, residents, topics: TOPICS, world: null };
})();
