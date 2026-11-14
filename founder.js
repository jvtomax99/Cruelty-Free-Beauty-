/* C.F.B. founder tools: her add-a-brand box (#add) and her storefront card on Profile.
   The add box sends nothing itself: Send opens GitHub's "Add a brand" issue form, filled in,
   and she taps Submit there. A daily scheduled check reads those issues (only from trusted
   logins, CLAUDE.md), checks PETA and Leaping Bunny, and adds the brand with its proof.
   Hidden, not secured: the Founder tools row shows only on a phone that turned it on (cfb-founder),
   by tapping the C.F.B. logo 5 times (inside the installed app too, whose storage on an iPhone is
   apart from Safari's) or by opening the app with ?founder=1; the same 5 taps or ?founder=0 turn it
   off. The security is on GitHub.
   The storefront card shows only when data/brands.json has picks.url. */
(function () {
  "use strict";
  const { store } = window.CFB;
  const REPO = "https://github.com/jvtomax99/Cruelty-Free-Beauty-";
  const MAX_SENT = 20;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);

  // ?founder=1 turns the row on for this phone, ?founder=0 off.
  try {
    const f = new URLSearchParams(location.search).get("founder");
    if (f === "1") store.set("founder", "1");
    if (f === "0") localStorage.removeItem("cfb-founder");
  } catch (_) {}
  const isFounder = () => store.get("founder", "") === "1";

  /* ---------- 5 taps on the logo (Home's brand bar or the side rail) turn the tools on or off ---------- */
  const TAPS = 5, WINDOW_MS = 3000;
  let taps = [];
  let toastTimer = 0;
  function toast(text) {
    let t = $("fd-toast");
    if (!t) { t = document.createElement("p"); t.id = "fd-toast"; t.className = "fd-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 3500);
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".brandbar")) return;
    const now = Date.now();
    taps = taps.filter((t) => now - t < WINDOW_MS);
    taps.push(now);
    if (taps.length < TAPS) return;
    taps = [];
    if (isFounder()) { try { localStorage.removeItem("cfb-founder"); } catch (_) {} toast("Founder tools are off on this phone."); }
    else { store.set("founder", "1"); toast("Founder tools are on. Find them on your Profile."); }
    renderRow();
  });

  /* ---------- The issue link ---------- */
  // Only a web address is passed on; anything else in a link field is dropped.
  const webLink = (s) => { const t = String(s || "").trim(); return /^https?:\/\/\S+$/i.test(t) && t.length <= 300 ? t : ""; };
  function issueUrl(name, site, link) {
    const q = new URLSearchParams({ template: "add-brand.yml", title: "Add brand: " + name, brand: name });
    if (site) q.set("site", site);
    if (link) q.set("proof", link);
    return REPO + "/issues/new?" + q.toString();
  }
  window.CFB.issueUrl = issueUrl;   // the test checks the encoding

  /* ---------- Names opened on GitHub from this phone (saved at Send, before she taps Submit there) ---------- */
  function sentList() {
    try { const a = JSON.parse(store.get("sent-brands", "[]")); return Array.isArray(a) ? a.filter((x) => x && typeof x.name === "string").slice(0, MAX_SENT) : []; }
    catch (_) { return []; }
  }
  function remember(name) {
    const rest = sentList().filter((x) => x.name.toLowerCase() !== name.toLowerCase());
    store.set("sent-brands", JSON.stringify([{ name, at: new Date().toISOString().slice(0, 10) }, ...rest].slice(0, MAX_SENT)));
  }
  const day = (iso) => { const d = new Date(iso + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

  async function renderSent() {
    const box = $("add-sent");
    if (!box) return;
    const list = sentList();
    if (!list.length) { box.innerHTML = ""; return; }
    await window.CFB.brands.catch(() => []);
    const rows = list.map((x) => {
      const b = window.CFB.match(x.name) || window.CFB.match(x.name + " beauty");   // "Rare" is in as Rare Beauty
      return `<li class="ad-row"><span class="ad-name">${esc(x.name)}</span>${b
        ? `<a class="ad-state is-in" href="#brand/${encodeURIComponent(b.id)}">In the app</a>`
        : `<span class="ad-state">Opened ${esc(day(x.at))}</span>`}</li>`;
    }).join("");
    box.innerHTML = `<h2 class="rt-head">Your brands</h2>
      <p class="rt-intro">A brand moves to "In the app" once it's checked. If neither PETA nor Leaping Bunny lists it as cruelty-free, it stays out, and GitHub tells you why on your issue. If you closed GitHub without tapping Submit, send it again.</p>
      <ul class="ad-list">${rows}</ul>`;
  }

  /* ---------- The add screen ---------- */
  const form = $("add-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("add-name").value.replace(/\s+/g, " ").trim().slice(0, 80);
    const msg = $("add-msg");
    if (!name) { msg.textContent = "Type the brand's name first."; $("add-name").focus(); return; }
    const site = webLink($("add-site").value);
    const link = webLink($("add-proof").value);
    remember(name);
    window.open(issueUrl(name, site, link), "_blank", "noopener");
    form.reset();
    msg.textContent = `GitHub opened with ${name} filled in. Tap "Submit new issue" there to send it.`;
    renderSent();
  });

  /* ---------- Profile: Founder tools row and the storefront card ---------- */
  function renderRow() {
    const box = $("founder-row");
    if (!box) return;
    box.innerHTML = isFounder()
      ? `<div class="card fd-card"><h2>Founder tools</h2><p>Only on this phone. Add a brand you found and we'll check it.</p>
         <a class="pf-start" href="#add">Add a brand</a></div>`
      : "";
  }
  async function renderPicks() {
    const box = $("picks-app");
    if (!box) return;
    const d = await window.CFB.data;
    const url = d && d.picks ? webLink(d.picks.url) : "";
    box.innerHTML = url
      ? `<div class="card pk-card">
          <h2>Shop my picks</h2>
          <p>My cruelty-free favorites. I earn a small commission if you buy, at no extra cost to you.</p>
          <a class="pf-start" href="${esc(url)}" target="_blank" rel="sponsored noopener">Open my picks</a>
        </div>`
      : "";
  }

  document.addEventListener("cfb:screen", (e) => {
    if (e.detail.name === "profile") { renderRow(); renderPicks(); }
    if (e.detail.name === "add") renderSent();
  });
  renderRow();
  renderPicks();
  renderSent();
})();
