/* C.F.B. the Garden: a study game. Rounds of 5 questions; the five habitats grow with what
   the person has learned. Written questions: data/questions.json (each with its source).
   Brand questions are built here from data/brands.json through CFB.verdict, never stored,
   so a recheck can't leave a stale answer. Progress stays on the phone (cfb-garden).
   Rules (SPEC "The Garden"): the garden grows only from learning, never from scanning,
   saving or buying, and nothing in it is ever lost for a wrong answer except the count. */
(function () {
  "use strict";
  const store = window.CFB.store;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const DAY = 864e5;
  const DUE_DAYS = 90;   // a brand whose check is older than this is left out (SPEC brand rule 6)
  const stale = (iso) => !iso || (Date.now() - new Date(iso + "T00:00:00").getTime()) / DAY > DUE_DAYS;

  const TOPICS = [
    { id: "meadow", name: "Meadow", sub: "Cruelty-free or vegan" },
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

  /* ---------- Progress: { v, items: { id: { s: stage, due: ms, k: answer it was learned with } } } ---------- */
  let state = { v: 1, items: {} };
  try { const raw = JSON.parse(store.get("garden", "null")); if (raw && raw.v === 1 && raw.items && typeof raw.items === "object") state = raw; } catch (_) {}
  const save = () => store.set("garden", JSON.stringify(state));

  let bank = [];        // every question that can be asked today
  let loaded = false, failed = false;

  /* ---------- The bank ---------- */
  function brandQuestions(brands) {
    const CHIP = window.CFB.CHIP, out = [];
    for (const b of brands) {
      if (stale(b.peta.checked) || stale(b.leapingBunny.checked)) continue;
      const v = window.CFB.verdict(b, "strict");
      const src = [];
      if (b.peta.url) src.push({ t: "PETA: " + b.name, u: b.peta.url, checked: b.peta.checked });
      if (b.leapingBunny.url) src.push({ t: "Leaping Bunny: " + b.name, u: b.leapingBunny.url, checked: b.leapingBunny.checked });
      if (v.kind === "fail" && b.parent.testsOnAnimals === "yes" && b.parent.url) src.push({ t: "Parent company: " + b.parent.name, u: b.parent.url, checked: b.parent.checked });
      if (v.kind === "fail" && b.chinaRetail.status === "yes" && b.chinaRetail.url) src.push({ t: "Where it sells", u: b.chinaRetail.url, checked: b.chinaRetail.checked });
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
  const ready = Promise.all([
    fetch("data/questions.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    window.CFB.data,
  ]).then(([file, data]) => {
    const written = file.questions.map((q) => ({ ...q, key: "w", src: q.src.map((k) => file.sources[k]) }));
    bank = [...written, ...brandQuestions(data.brands || [])];
    // An answer learned under an older verdict no longer counts (a recheck changed the brand).
    for (const q of bank) { const it = state.items[q.id]; if (it && it.k && it.k !== q.key) delete state.items[q.id]; }
    loaded = true;
  }).catch(() => { failed = true; });

  /* ---------- Counting ---------- */
  const stage = (q) => (state.items[q.id] ? state.items[q.id].s : 0);
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

  /* ---------- The Garden screen: five habitats ---------- */
  function drawGarden() {
    const box = $("garden-list");
    if (!box) return;
    if (failed) { box.innerHTML = `<p class="gd-note">The questions couldn't load. Check your connection and open the Garden again.</p>`; return; }
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
  }
  function drawHome() {
    const line = $("gd-home-line");
    if (!line || !loaded) return;
    const all = tally();
    line.textContent = all.learned || all.due ? `${all.learned} of ${all.total} learned${all.due ? ` · ${all.due} to review` : ""}` : `${all.total} questions, 5 at a time`;
  }

  /* ---------- A round ---------- */
  let round = null;   // { topic, qs, i, right, shown: options as shuffled, answered }
  function start(topicId) {
    const box = $("practice-box");
    if (failed) { box.innerHTML = `<p class="gd-note">The questions couldn't load. Check your connection and try again.</p>`; return; }
    const topic = topicId === "all" || TOPIC[topicId] ? topicId : "all";
    $("practice-h").textContent = topic === "all" ? "Practice" : TOPIC[topic].name;
    document.title = "C.F.B. · " + $("practice-h").textContent;
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
      <div id="practice-result" aria-live="polite"></div>`;
  }
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
          <ul>${q.src.map((s) => `<li><a href="${esc(s.u)}"${s.u[0] === "#" ? "" : ' target="_blank" rel="noopener"'}>${esc(s.t)}</a><span class="gd-date">checked ${day(s.checked)}</span></li>`).join("")}</ul>
        </div>
      </div>
      <button class="pf-start" type="button" id="practice-next">${last ? "See the round" : "Next"}</button>
      ${right ? `<button class="quiz-back" type="button" id="practice-guess">I guessed</button>` : ""}`;
    $("practice-verdict").focus({ preventScroll: true });
    $("practice-next").scrollIntoView({ block: "nearest" });
  }
  /* "I guessed" turns a lucky right answer into a miss, so the count stays honest. */
  function guessed() {
    if (!round || !round.answered || !round.lastRight) return;
    record(round.qs[round.i], false);
    round.right--; round.lastRight = false;
    const b = $("practice-guess");
    b.outerHTML = `<p class="gd-note" id="practice-guessed">Counted as a miss. It will come back in your next round.</p>`;
  }
  function next() {
    if (!round || !round.answered) return;
    if (round.i < round.qs.length - 1) { round.i++; ask(); $("practice-q").focus({ preventScroll: true }); window.scrollTo(0, 0); return; }
    const t = round.topic === "all" ? null : round.topic, now = tally(t), was = round.before;
    const gained = now.learned - was.learned;
    const name = t ? TOPIC[t].name : "The garden";
    $("practice-box").innerHTML = `
      <div class="card gd-done">
        <h2 id="practice-done" tabindex="-1">${round.right} of ${round.qs.length} right</h2>
        <p>${esc(name)}: ${now.learned} of ${now.total} learned${gained > 0 ? ` (${gained} more than before)` : ""}. ${t ? WORD(now) + "." : ""}</p>
        <span class="gd-bar" aria-hidden="true"><span style="width:${Math.round(now.p * 100)}%"></span></span>
        <p class="gd-note">A question counts as learned once you get it right twice, at least 5 minutes apart. Missed ones come back first.</p>
      </div>
      <button class="pf-start" type="button" id="practice-again">Another round</button>
      <a class="quiz-back gd-backlink" href="#garden">Back to the garden</a>`;
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

  document.addEventListener("cfb:screen", (e) => {
    const { name, id } = e.detail;
    if (name === "garden") ready.then(drawGarden);
    else if (name === "practice") ready.then(() => { if (location.hash.slice(1) === "practice/" + id) start(id); });
    else if (name === "home") ready.then(drawHome);
    if (name !== "practice") round = null;
  });
  // app.js has already shown the first screen by the time this file runs
  ready.then(() => {
    const h = location.hash.slice(1);
    drawHome();
    if (h === "garden") drawGarden();
    else if (h.startsWith("practice/")) start(h.slice(9));
  });

  window.CFB.garden = { tally, topics: TOPICS, ready };   // the 3D garden (later) reads these
})();
