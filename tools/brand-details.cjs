// The founder's details for a brand (parent company, mainland China, price, a store), from the
// optional boxes on her Add a brand and Add details forms. Used by tools/process-brand-requests.cjs.
// Each detail is saved only when its link shows it (CLAUDE.md: claims need sources):
//   - parent: her page must name both the brand and the parent; then PETA says whether the parent
//     tests (its page becomes the source), and a parent that tests gets a "changes" entry
//   - China: never saved by the bot (a page can mention China without proving mainland store
//     sales, and a wrong "yes" fails a brand); it goes to Jose with her link
//   - price: only for a brand with no price yet, with the brand's own site as where to check it
//   - store: a plain link (never an affiliate one) to a page that names the brand
// details(brand, d) returns { patch, change, lines, jose }: the fields to set on the brand, an
// optional "changes" entry, one line per box for her issue, and whether Jose is needed.
// BRAND_DETAILS_FAKE=file.json ({ "pages": { url: text }, "peta": { name: [hits] } }) replaces the
// network, for tools/test-brand-requests.cjs.

const fs = require('fs');

const today = () => new Date().toISOString().slice(0, 10);
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// "Benefit Cosmetics" is called "Benefit" on most pages; "LVMH, Inc." is "LVMH".
const core = (s) => fold(String(s || '').replace(/\s*\(.*\)\s*$/, '').replace(/[,.]?\s+(cosmetics|beauty|makeup|inc|llc|ltd|group|corp|corporation|company|co|sa|plc)\.?$/i, ''));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return 'her link'; } };
const httpsLink = (u) => (/^https:\/\/[^\s]+$/.test(u || '') && u.length <= 300 ? u : null);
// Shopping links that pay a commission are not allowed on brands (CLAUDE.md "Her storefront").
const AFFILIATE = /shopmy\.us|shop\.app\/|rstyle\.me|howl\.(me|link)|linksynergy|skimresources|shareasale|awin1|anrdoezrs|amzn\.to|bit\.ly|tinyurl|liketoknow|ltk\.app|[?&](tag|aff|affiliate|affid|ref|rfsn|irclickid|clickid)=/i;

function fakeData() { return process.env.BRAND_DETAILS_FAKE ? JSON.parse(fs.readFileSync(process.env.BRAND_DETAILS_FAKE, 'utf8')) : null; }

// A page's words, or null when it won't open. Brand and store sites often refuse plain requests,
// so a real browser is tried next (CLAUDE.md "Brand sites").
async function pageText(url) {
  const fake = fakeData();
  if (fake) return Object.hasOwn(fake.pages || {}, url) ? fake.pages[url] : null;
  const strip = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (C.F.B. brand check)' } });
    if (r.ok) { const t = strip(await r.text()); if (t.length > 400) return t; }
  } catch (_) {}
  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!r || !r.ok()) return null;
    await page.waitForTimeout(2000);
    return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  } catch (_) { return null; } finally { if (browser) await browser.close().catch(() => {}); }
}

async function petaHits(name) {
  const fake = fakeData();
  if (fake) return (fake.peta || {})[name] || [];
  return require('./lookup-certifiers.cjs').peta(name);
}

const names = (b) => [...new Set([b.name, ...(b.search || [])].map(core).filter((k) => k.length >= 3))];
const mentions = (text, keys) => { const t = fold(text); return keys.some((k) => t.includes(k)); };

async function details(brand, d) {
  const patch = {}, lines = [];
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
      const text = await pageText(link);
      if (text === null) say('Parent company', `${link} didn't open for the check. Jose will read it.`, true);
      else if (!mentions(text, names(brand)) || !mentions(text, [core(parent)].filter((k) => k.length >= 2))) {
        say('Parent company', `${link} doesn't name both ${brand.name} and ${parent}, so nothing was saved. Jose will take a look.`, true);
      } else {
        let hits = [];
        try { hits = await petaHits(parent); } catch (_) { hits = null; }
        if (hits === null) say('Parent company', `PETA's site didn't answer, so whether ${parent} tests wasn't checked. Jose will finish it.`, true);
        else {
          const hit = hits.find((h) => core(h.title) === core(parent) && h.verdict !== 'no verdict found');
          const tests = hit && hit.status === 'no' ? 'yes' : hit && hit.status === 'yes' ? 'no' : 'unknown';
          const law = hit && /regulatory/i.test(hit.verdict || '');
          patch.parent = tests === 'unknown'
            ? { name: parent, testsOnAnimals: 'unknown', url: link, note: `${host(link)} names ${parent} as the owner. PETA doesn't list ${parent} as cruelty-free or as testing`, checked: T }
            : { name: parent, testsOnAnimals: tests, url: hit.url, note: `${host(link)} names ${parent} as the owner. ${hit.verdict}`, checked: T };
          const from = was.testsOnAnimals || 'unknown';
          if (from !== tests) change = { id: brand.id, claim: 'parent', from, to: tests, date: T, url: patch.parent.url };
          say('Parent company', `saved: **${parent}**, from ${link}. ${tests === 'yes' ? `PETA says it tests on animals${law ? ' when the law requires it' : ''}, so ${brand.name} now fails Strict` : tests === 'no' ? "PETA says it doesn't test" : "PETA doesn't list it either way, so its testing shows as unknown"}.`);
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
    else if (brand.price && brand.priceSource && httpsLink(brand.priceSource.url) && !/founder/i.test(brand.priceSource.note || '')) say('Price', `kept ${brand.price}: it already comes from the brand's own prices (${brand.priceSource.url}).`);
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
    const have = (brand.whereToBuy || []).concat(patch.whereToBuy || []);
    if (!link) say('Store', `${store || 'the store'} needs a link to the brand's page there, so nothing was saved.`);
    else if (AFFILIATE.test(link)) say('Store', `${link} looks like a commission link, and the app never puts those on a brand. Send the store's plain page for the brand.`);
    else if (have.some((w) => w.url === link)) say('Store', `${store} is already on its page.`);
    else {
      const text = await pageText(link);
      if (text === null) say('Store', `${link} didn't open for the check. Jose will read it.`, true);
      else if (!mentions(text, names(brand))) say('Store', `${link} doesn't name ${brand.name}, so nothing was saved.`);
      else {
        patch.whereToBuy = [...(brand.whereToBuy || []), { store, url: link, linkType: 'plain' }];
        say('Store', `saved: ${store}.`);
      }
    }
  }

  return { patch, change, lines, jose };
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

// Puts a patch on the brand with that id in a brands file's data (each publish try starts from main).
function apply(data, id, patch, change) {
  const b = data.brands.find((x) => x.id === id);
  if (!b) return false;
  Object.assign(b, JSON.parse(JSON.stringify(patch)));
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
function find(data, name) {
  const want = keys(name);
  const hits = data.brands.filter((b) => [b.name, ...(b.search || [])].some((n) => keys(n).some((k) => want.includes(k))));
  return hits.length === 1 ? hits[0] : null;
}

module.exports = { details, fromIssue, any, apply, find, AFFILIATE };
