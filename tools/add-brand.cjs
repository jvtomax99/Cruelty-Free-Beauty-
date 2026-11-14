// Drafts a record for a brand the founder asked for (her Add a brand box opens a GitHub issue;
// the daily scheduled check runs this for each one). Looks the name up on PETA and Leaping Bunny
// with the same code as tools/lookup-certifiers.cjs and builds a record whose every claim links
// its certifier page and today's date. Parent company and China are left "not yet researched".
//
//   node tools/add-brand.cjs --name-file name.txt              print the draft, change nothing
//   node tools/add-brand.cjs --name-file name.txt --site https://... --write
//       also add it to data/brands.json (the person running it opens the pages first)
//   node tools/add-brand.cjs "Milani"                          the name as an argument (typed by hand)
//
// Issue text must reach this tool through --name-file (written with a file tool, never pasted into
// a shell command): a brand name like  $(...)  inside a command line would run.
//
// A brand counts as listed only if PETA says it doesn't test or Leaping Bunny certifies it.
// Exit codes: 0 drafted (or written), 2 not listed (or a certifier says it tests), 3 already in
// the app, 4 more than one certifier entry matches (ask which), 5 Leaping Bunny flags a parent
// company that tests: research its name and run again with --parent "Name", 1 a lookup failed.
// ADD_BRAND_FAKE=answers.json replaces the two lookups ({ "peta": [...], "leapingBunny": [...] },
// shaped like lookup-certifiers' output), for tools/test-add-brand.cjs.

const fs = require('fs');

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set (cloud
// sessions reach the web only through a proxy). Re-run once with it on.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY && !process.env.ADD_BRAND_FAKE) {
  const r = require('child_process').spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status === null ? 1 : r.status);
}
const path = require('path');
const { peta, leapingBunny, LB } = require('./lookup-certifiers.cjs');

const FILE = process.env.BRANDS_FILE || path.join(__dirname, '..', 'data', 'brands.json');
const today = new Date().toISOString().slice(0, 10);
const bare = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '');   // PETA titles carry "(parent)" notes
const VALUE_FLAGS = ['--site', '--name-file', '--parent', '--json-out'];
function arg(flag) { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; }
const httpsLink = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);
// --json-out FILE: the result as data for tools/process-brand-requests.cjs (the GitHub Action):
// { code, message, name, brand: { id, name } | null, record | null }.
const jsonOut = arg('--json-out');
const result = (code, message, extra = {}) => { if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ code, message, brand: null, record: null, ...extra })); };
const done = (code, msg, extra) => { console.log(msg); result(code, msg, extra); process.exit(code); };

// Exactly the app's matching (CFB.match in brands.js): the whole name, ignoring case, accents,
// spaces and punctuation, with or without trailing filler words. So the tool's "already in the
// app" and her list's "In the app" always agree.
const words = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const FILLER = new Set(['cosmetics', 'cosmetic', 'makeup', 'professional', 'paris', 'companies', 'inc', 'new', 'york', 'london', 'usa']);
function trimmed(w) { w = w.slice(); while (w.length > 1 && FILLER.has(w[w.length - 1])) w.pop(); return w.join(''); }
const keysOf = (n) => { const w = words(n); return w.length ? [...new Set([w.join(''), trimmed(w)])] : []; };
const same = (a, b) => keysOf(a).some((k) => keysOf(b).includes(k));
// Certifier entries only: also without a trailing "beauty", so "Kaja" finds PETA's "Kaja Beauty".
// The record then keeps her typed name as a search name, so the app matches it too.
const looseKeys = (n) => { const w = words(n); return [...new Set([...keysOf(n), ...(w.length > 1 && w[w.length - 1] === 'beauty' ? keysOf(w.slice(0, -1).join(' ')) : [])])]; };
const loose = (a, b) => looseKeys(a).some((k) => looseKeys(b).includes(k));
const slug = (n) => words(n).join('-') || 'brand';

async function lookups(name) {
  if (process.env.ADD_BRAND_FAKE) {
    const f = JSON.parse(fs.readFileSync(process.env.ADD_BRAND_FAKE, 'utf8'));
    return [f.peta || [], f.leapingBunny || []];
  }
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${LB}/Web/Shopping-Guide/Brands.aspx`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return [await peta(name), await leapingBunny(page, name)];
  } finally { await browser.close(); }
}

async function main() {
  const nameFile = arg('--name-file');
  const given = nameFile
    ? fs.readFileSync(nameFile, 'utf8')
    : process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !VALUE_FLAGS.includes(all[i - 1]));
  const name = String(given || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) { console.error('Usage: node tools/add-brand.cjs --name-file name.txt [--site https://...] [--parent "Name"] [--write]'); process.exit(1); }
  const site = httpsLink(arg('--site'));
  const parentName = (arg('--parent') || '').trim() || null;
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(raw);
  const inApp = (n) => data.brands.find((b) => [b.name, ...(b.search || [])].some((x) => same(x, n)));

  const have = inApp(name);
  if (have) done(3, `Already in the app: ${have.name} (${have.id}).`, { brand: { id: have.id, name: have.name } });

  const [petaHits, lbHits] = await lookups(name);

  // Only an exact name counts: a search for "Kiko" also returns "Kikori", and that is not her brand.
  const p = petaHits.filter((h) => loose(bare(h.title), name) && h.verdict !== 'no verdict found');
  const l = lbHits.filter((h) => loose(h.tradingName || '', name) || loose(h.company || '', name));
  const pYes = p.filter((h) => h.status === 'yes');
  const pNo = p.filter((h) => h.status === 'no');
  const near = [...petaHits.map((h) => `PETA: ${h.title}`), ...lbHits.map((h) => `Leaping Bunny: ${h.tradingName || h.company}`)];

  if (!pYes.length && !l.length) {
    if (pNo.length) done(2, `Not added: PETA says "${name}" tests on animals (${pNo[0].verdict}, ${pNo[0].url}), and Leaping Bunny doesn't certify it.`, { tests: true, url: pNo[0].url });
    done(2, `Not listed: neither PETA nor Leaping Bunny lists "${name}" as cruelty-free (searched ${today}).`
      + (near.length ? '\nClose names they do list:\n  ' + near.slice(0, 8).join('\n  ') : ''));
  }
  if (new Set(p.filter((h) => h.status !== 'unknown').map((h) => h.url)).size > 1 || new Set(l.map((h) => h.url)).size > 1) {
    done(4, `Unclear: more than one certifier entry is called "${name}". Ask which one:\n  `
      + [...p.map((h) => `PETA: ${h.title} ${h.url}`), ...l.map((h) => `Leaping Bunny: ${h.tradingName || h.company} ${h.url}`)].join('\n  '));
  }

  const ph = pYes[0] || pNo[0] || p[0] || null;   // a PETA page saying "may not be cruelty-free" is still a source
  const lh = l[0] || null;
  const display = (lh && (lh.tradingName || lh.company)) || (ph && bare(ph.title)) || name;
  // The certifier's own name may be one we already have (she typed the company's legal name).
  const dup = inApp(display) || data.brands.find((b) => b.id === slug(display));
  if (dup) done(3, `Already in the app: ${dup.name} (${dup.id}); the certifiers call it "${display}".`, { brand: { id: dup.id, name: dup.name } });
  if (lh && lh.parentTests && !parentName) {
    done(5, `Leaping Bunny certifies "${display}" but flags a parent company that tests (${lh.url}). Find the parent's name on that page or a primary source, then run again with --parent "Name". Without the name the app can't fail it under Strict.`);
  }

  const record = {
    id: slug(display),
    name: display,
    search: [...new Set([display, name])],
    peta: ph
      ? { status: ph.status, note: ph.verdict, url: ph.url, checked: today }
      : { status: 'unknown', note: "Not found on PETA's list", url: 'https://crueltyfree.peta.org/', checked: today },
    leapingBunny: lh
      ? { status: 'yes', note: 'Leaping Bunny certified', url: lh.url, checked: today }
      : { status: 'unknown', note: "Not found in Leaping Bunny's Shopping Guide", url: `${LB}/Web/Shopping-Guide/Brands.aspx`, checked: today },
    parent: lh && lh.parentTests
      ? { name: parentName, testsOnAnimals: 'yes', url: lh.url, note: 'Leaping Bunny: its parent company tests on animals', checked: today }
      : { name: null, testsOnAnimals: 'unknown', url: null, note: 'Not yet researched', checked: null },
    chinaRetail: { status: 'unknown', url: null, note: 'Not yet researched', checked: null },
    vegan: ph && ph.status === 'yes' && ph.vegan ? 'all' : 'unknown',
    price: null,
    productTypes: [],
    whereToBuy: site ? [{ store: 'Official site', url: site, linkType: 'plain' }] : [],
    review: 'needs-review',
    sells: null,
    shadeFinder: null,
    added: today,
  };

  console.log(JSON.stringify(record, null, 1));
  console.log(`\nOpen before adding:\n  ${record.peta.url}\n  ${record.leapingBunny.url}${site ? `\n  ${site}` : '\n  (no official site given: find it on the brand\'s own site for whereToBuy)'}`);
  if (process.argv.includes('--write')) {
    data.brands.push(record);
    fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + (raw.endsWith('\n') ? '\n' : ''));
    console.log(`\nAdded ${display} (${record.id}) to ${path.relative(process.cwd(), FILE)}. Bump CACHE_VERSION in sw.js, then run check-brands --links.`);
  }
  result(0, `Drafted ${display}`, { brand: { id: record.id, name: display }, record });
}

main().catch((e) => { console.error(e); result(1, `Lookup failed: ${e.message}`); process.exit(1); });
