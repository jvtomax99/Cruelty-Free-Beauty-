// The founder's details for a brand (parent company, mainland China, price, a store), from the
// optional boxes on her Add a brand and Add details forms. Used by tools/process-brand-requests.cjs.
// Each detail is saved only when its link shows it (CLAUDE.md: claims need sources):
//   - parent: her page must name both the brand and the parent, as whole words; it stays the
//     source. PETA then says whether the parent tests. A parent PETA says tests would make the
//     brand fail Strict, so that one goes to Jose, as does a PETA answer that doesn't clearly match
//   - China: never saved by the bot (a page can mention China without proving mainland store
//     sales, and a wrong "yes" fails a brand); it goes to Jose with her link
//   - price: only for a brand with no price yet, with the brand's own site as where to check it
//   - store: a plain link (never an affiliate one) to a page that names the brand
// details(brand, d) returns { patch, stores, change, lines, jose }: the fields to set on the brand,
// stores to add to its buy links, an optional "changes" entry, one line per box for her issue, and
// whether Jose is needed.
// BRAND_DETAILS_FAKE=file.json ({ "pages": { url: text or { text, url } }, "peta": { name: [hits] } })
// replaces the
// network, for tools/test-brand-requests.cjs.

const fs = require('fs');

const today = () => new Date().toISOString().slice(0, 10);
// Words of a name or a page: no accents, no apostrophes ("L'Oréal" is one word, "loreal").
const wordsOf = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
// A company's name without what pages leave off: a leading "The", trailing "Cosmetics", "Inc",
// "Groupe", "Companies" and the like, and a "(...)" note. "The Estée Lauder Companies Inc." is "estee lauder".
const TRAIL = new Set(['cosmetics', 'cosmetic', 'beauty', 'makeup', 'inc', 'llc', 'ltd', 'limited', 'group', 'groupe', 'corp', 'corporation', 'company', 'companies', 'co', 'sa', 'plc', 'ag', 'gmbh', 'holdings', 'brands', 'international', 'usa']);
function nameWords(s) {
  const w = wordsOf(String(s || '').replace(/\s*\(.*\)\s*$/, ''));
  if (w[0] === 'the' && w.length > 1) w.shift();
  while (w.length > 1 && TRAIL.has(w[w.length - 1])) w.pop();
  return w;
}
const core = (s) => nameWords(s).join('');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return 'her link'; } };
const httpsLink = (u) => (/^https:\/\/[^\s]+$/.test(u || '') && u.length <= 300 ? u : null);
// Shopping links that pay a commission are not allowed on brands (CLAUDE.md "Her storefront").
// Checked on her link and on wherever it ends up after redirects.
const AFFILIATE = /shopmy\.us|shop\.app\/|rstyle\.me|howl\.(me|link)|liketoknow|liketk\.it|ltk\.app|shopltk|linksynergy|skimresources|skimlinks|shareasale|awin1|anrdoezrs|dpbolvw|jdoqocy|tkqlhce|kqzyfj|amzn\.to|bit\.ly|tinyurl|geni\.us|pxf\.io|sjv\.io|ojrq\.net|evyy\.net|shopstyle\.it|prf\.hn|go\.magik\.ly|[?&](tag|aff|affiliate|affid|aff_id|ref|rfsn|irclickid|irgwc|clickid|linkcode|ranmid|raneaid|ransiteid|sscid|cjevent|utm_medium=affiliate)\b/i;

function fakeData() { return process.env.BRAND_DETAILS_FAKE ? JSON.parse(fs.readFileSync(process.env.BRAND_DETAILS_FAKE, 'utf8')) : null; }

// A page's words and where it ended up ({ text, url }), or null when it won't open. Brand and
// store sites often refuse plain requests, so a real browser is tried next (CLAUDE.md "Brand sites").
async function pageText(url) {
  const fake = fakeData();
  if (fake) { const f = (fake.pages || {})[url]; return f === undefined ? null : typeof f === 'string' ? { text: f, url } : f; }
  const strip = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (C.F.B. brand check)' } });
    if (r.ok) { const t = strip(await r.text()); if (t.length > 400) return { text: t, url: r.url || url }; }
  } catch (_) {}
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!r || !r.ok()) return null;
    await page.waitForTimeout(2000);
    return { text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '), url: page.url() };
  } catch (_) { return null; } finally { if (browser) await browser.close().catch(() => {}); }
}

async function petaHits(name) {
  const fake = fakeData();
  if (fake) return (fake.peta || {})[name] || [];
  return require('./lookup-certifiers.cjs').peta(name);
}

// Does the page name it, as whole words? "elf" is not in "shelf", "Rare" not in "rarely".
// A name written as letters ("e.l.f.") also counts when the page writes it as one word ("elf").
function mentions(text, name) {
  const page = wordsOf(text), want = nameWords(name);
  if (!want.length || want.join('').length < 2) return false;
  const joined = want.join('');
  for (let i = 0; i < page.length; i++) {
    if (page[i] === joined) return true;
    if (want.length > 1 && want.every((w, k) => page[i + k] === w)) return true;
  }
  return false;
}
const namesBrand = (text, b) => [b.name, ...(b.search || [])].some((n) => mentions(text, n));

async function details(brand, d) {
  const patch = {}, lines = [], stores = [];
  let change = null, jose = false;
  const say = (box, text, needsJose = false) => { lines.push(`**${box}:** ${text}`); if (needsJose) jose = true; };
  const T = today();

  // Parent company
  if (d.parent || d.parentLink) {
    const was = brand.parent || {};
    const link = httpsLink(d.parentLink);
    const parent = String(d.parent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!parent) say('Parent company', 'a link came without the company\'s name, so nothing was saved. Send the name with it.');
    else if (!link) say('Parent company', `"${parent}" needs a link that shows it owns ${brand.name}, so nothing was saved.`);
    else if (core(parent) === core(brand.name)) say('Parent company', `"${parent}" is the brand itself, so nothing was saved.`);
    else if (was.testsOnAnimals === 'n/a' || (was.name && core(was.name) !== core(parent))) {
      say('Parent company', `the app already lists ${was.testsOnAnimals === 'n/a' ? 'the brand as its own parent' : `**${was.name}**`}, and you sent **${parent}** (${link}). Jose will check which is right.`, true);
    } else if (was.name && was.checked && was.url) {
      say('Parent company', `**${was.name}** is already on its page, with its source (${was.url}).`);
    } else {
      const page = await pageText(link);
      if (page === null) say('Parent company', `${link} didn't open for the check. Jose will read it.`, true);
      else if (!namesBrand(page.text, brand) || !mentions(page.text, parent)) {
        say('Parent company', `${link} doesn't name both ${brand.name} and ${parent}, so nothing was saved. Jose will take a look.`, true);
      } else {
        let hits = [];
        try { hits = await petaHits(parent); } catch (_) { hits = null; }
        const bare = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '');
        const hit = hits && hits.find((h) => core(bare(h.title)) === core(parent) && h.verdict !== 'no verdict found');
        if (hits === null) say('Parent company', `PETA's site didn't answer, so whether ${parent} tests wasn't checked. Jose will finish it.`, true);
        else if (hits.length && !hit) say('Parent company', `PETA lists names close to ${parent} (${hits.slice(0, 3).map((h) => bare(h.title)).join(', ')}) but not exactly it, so nothing was saved. Jose will check which one it is.`, true);
        else if (hit && hit.status === 'no') {
          // A parent that tests fails the brand under Strict: a person reads her link first.
          say('Parent company', `${link} names ${parent}, and PETA says ${parent} tests on animals${/regulatory/i.test(hit.verdict || '') ? ' when the law requires it' : ''} (${hit.url}). That would make ${brand.name} fail Strict, so Jose checks it before it goes in.`, true);
        } else {
          const tests = hit && hit.status === 'yes' ? 'no' : 'unknown';
          patch.parent = { name: parent, testsOnAnimals: tests, url: link,
            note: `The founder's link (${host(link)}) names ${parent} with ${brand.name}. ${tests === 'no' ? `PETA: company that doesn't test (${hit.url})` : `PETA doesn't list ${parent} as cruelty-free or as testing`}`, checked: T };
          const from = was.testsOnAnimals || 'unknown';
          if (from !== tests) change = { id: brand.id, claim: 'parent', from, to: tests, date: T, url: link };
          say('Parent company', `saved: **${parent}**, from ${link}. ${tests === 'no' ? "PETA says it doesn't test." : "PETA doesn't list it either way, so its testing shows as unknown."}`);
        }
      }
    }
  }

  // Mainland China: always a person's call.
  if (d.china || d.chinaLink) {
    const said = /^\s*y/i.test(d.china || '') ? 'sold there' : /^\s*n/i.test(d.china || '') ? 'not sold there' : 'unclear';
    say('Mainland China', `you said ${said}${httpsLink(d.chinaLink) ? ` (${d.chinaLink})` : ' with no link'}. A wrong answer here changes Strict, so Jose checks this one by hand.`, true);
  }

  // Price
  if (d.price) {
    const m = String(d.price).trim().match(/^(\${1,3})(?!\$)/);
    const site = (brand.whereToBuy || []).find((w) => /official site/i.test(w.store || '') && httpsLink(w.url));
    if (!m) say('Price', `"${String(d.price).slice(0, 20)}" isn't $, $$ or $$$, so nothing was saved.`);
    else if (brand.price) say('Price', `kept ${brand.price}: it already has a price${brand.priceSource && brand.priceSource.url ? ` (${brand.priceSource.url})` : ''}.`);
    else if (!site) say('Price', `${m[1]} wasn't saved because the app has no brand website to show next to it. Send the brand's site and it can be.`);
    else {
      patch.price = m[1];
      patch.priceSource = { note: "The founder's check of its prices", url: site.url, checked: T };
      say('Price', `saved: ${m[1]}.`);
    }
  }

  // A store that carries it
  if (d.store || d.storeLink) {
    const link = httpsLink(d.storeLink);
    const store = String(d.store || '').replace(/\s+/g, ' ').trim().slice(0, 40) || (link ? host(link) : '');
    const have = brand.whereToBuy || [];
    if (!link) say('Store', `${store || 'the store'} needs a link to the brand's page there, so nothing was saved.`);
    else if (AFFILIATE.test(link)) say('Store', `${link} looks like a commission link, and the app never puts those on a brand. Send the store's plain page for the brand.`);
    else if (have.some((w) => w.url === link)) say('Store', `${store} is already on its page.`);
    else {
      const page = await pageText(link);
      if (page === null) say('Store', `${link} didn't open for the check. Jose will read it.`, true);
      else if (AFFILIATE.test(page.url || '')) say('Store', `${link} leads to a commission link, and the app never puts those on a brand. Send the store's plain page for the brand.`);
      else if (!namesBrand(page.text, brand)) say('Store', `${link} doesn't name ${brand.name}, so nothing was saved.`);
      else {
        stores.push({ store, url: link, linkType: 'plain' });
        say('Store', `saved: ${store}.`);
      }
    }
  }

  return { patch, stores, change, lines, jose };
}

// The form's boxes, from an issue body ("### Label\n\nvalue"); '' for an empty box.
function fromIssue(section) {
  return {
    parent: section('Parent company').split('\n')[0],
    parentLink: section('Link that shows who owns').split(/\s+/)[0],
    china: section('Sold in mainland China').split('\n')[0],
    chinaLink: section('Link that shows where it sells').split(/\s+/)[0],
    price: section('Price').split('\n')[0],
    store: section('A store that carries it').split('\n')[0],
    storeLink: section('Store link').split(/\s+/)[0],
  };
}
const any = (d) => Object.values(d).some(Boolean);

// Puts details on the brand with that id in a brands file's data (each publish try starts from
// main): fields set, stores added to what main has now (never the list as it was read earlier).
function apply(data, id, patch, change, stores = []) {
  const b = data.brands.find((x) => x.id === id);
  if (!b) return false;
  Object.assign(b, JSON.parse(JSON.stringify(patch)));
  b.whereToBuy = b.whereToBuy || [];
  for (const w of stores) if (!b.whereToBuy.some((x) => x.url === w.url)) b.whereToBuy.push({ ...w });
  if (change) {
    data.changes = (data.changes || []).filter((c) => !(c.id === change.id && c.claim === change.claim && c.date === change.date));
    data.changes.push(change);
  }
  return true;
}

// The brand in the app with that name: the app's own matching (CFB.match in brands.js), the whole
// name, with or without trailing words like "Cosmetics", and also without a trailing "Beauty".
const words = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const FILLER = new Set(['cosmetics', 'cosmetic', 'makeup', 'professional', 'paris', 'companies', 'inc', 'new', 'york', 'london', 'usa', 'beauty']);
function keys(n) { const w = words(n); if (!w.length) return []; const t = w.slice(); while (t.length > 1 && FILLER.has(t[t.length - 1])) t.pop(); return [...new Set([w.join(''), t.join('')])]; }
// { brand } for one match, { many: true } for more than one, {} for none.
function find(data, name) {
  const want = keys(name);
  const hits = data.brands.filter((b) => [b.name, ...(b.search || [])].some((n) => keys(n).some((k) => want.includes(k))));
  return hits.length === 1 ? { brand: hits[0] } : hits.length ? { many: true } : {};
}

module.exports = { details, fromIssue, any, apply, find, mentions, AFFILIATE };
