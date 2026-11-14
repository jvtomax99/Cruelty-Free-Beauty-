// Drafts a record for a brand the founder asked for (her Add a brand box opens a GitHub issue;
// the daily scheduled check runs this for each one). Looks the name up on PETA and Leaping Bunny
// with the same code as tools/lookup-certifiers.cjs and builds a record whose every claim links
// its certifier page and today's date. Parent company and China are left "not yet researched",
// unless Leaping Bunny flags a parent that tests.
//
//   node tools/add-brand.cjs "Milani"                         print the draft, change nothing
//   node tools/add-brand.cjs "Milani" --site https://... --write
//       also add it to data/brands.json (the person running it opens both pages first)
//
// Exit codes: 0 a record was drafted (or written), 2 neither certifier lists the brand,
// 3 it is already in the app, 4 several different certifier entries match (say which),
// 1 a lookup failed.

const fs = require('fs');

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set (cloud
// sessions reach the web only through a proxy). Re-run once with it on.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require('child_process').spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status === null ? 1 : r.status);
}
const path = require('path');
const { peta, leapingBunny, fold, LB } = require('./lookup-certifiers.cjs');

const FILE = process.env.BRANDS_FILE || path.join(__dirname, '..', 'data', 'brands.json');
const today = new Date().toISOString().slice(0, 10);
const bare = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '');   // PETA titles carry "(parent)" notes

function arg(flag) { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; }
const httpsLink = (u) => (typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u : null);

// The same keys the app's search uses: the whole name folded, and without a trailing
// "cosmetics", "beauty" or "makeup", so "Milani Cosmetics" and "Milani" are one brand.
const keysOf = (n) => { const f = fold(n); return [f, f.replace(/(cosmetics|beauty|makeup|cosmetic)$/, '')].filter(Boolean); };
const same = (a, b) => keysOf(a).some((k) => keysOf(b).includes(k));

async function main() {
  const name = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !['--site'].includes(all[i - 1]));
  if (!name || !name.trim()) { console.error('Usage: node tools/add-brand.cjs "Brand name" [--site https://...] [--write]'); process.exit(1); }
  const site = httpsLink(arg('--site'));
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(raw);

  const have = data.brands.find((b) => [b.name, ...(b.search || [])].some((n) => same(n, name)));
  if (have) { console.log(`Already in the app: ${have.name} (${have.id}).`); process.exit(3); }

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  let petaHits, lbHits;
  try {
    const page = await browser.newPage();
    await page.goto(`${LB}/Web/Shopping-Guide/Brands.aspx`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    petaHits = await peta(name);
    lbHits = await leapingBunny(page, name);
  } finally { await browser.close(); }

  // Only an exact name counts: a search for "Kiko" also returns "Kikori", and that is not her brand.
  const p = petaHits.filter((h) => same(bare(h.title), name) && h.verdict !== 'no verdict found');
  const l = lbHits.filter((h) => same(h.tradingName || '', name) || same(h.company || '', name));
  const near = [...petaHits.map((h) => `PETA: ${h.title}`), ...lbHits.map((h) => `Leaping Bunny: ${h.tradingName || h.company}`)];
  const pListed = p.filter((h) => h.status !== 'unknown');

  if (!pListed.length && !l.length) {
    console.log(`Not listed: neither PETA nor Leaping Bunny lists "${name}" (searched ${today}).`);
    if (near.length) console.log('Close names they do list:\n  ' + near.slice(0, 8).join('\n  '));
    process.exit(2);
  }
  if (new Set(pListed.map((h) => h.url)).size > 1 || new Set(l.map((h) => h.url)).size > 1) {
    console.log(`Unclear: more than one certifier entry is called "${name}". Ask which one:\n  ` + [...pListed.map((h) => `PETA: ${h.title} ${h.url}`), ...l.map((h) => `Leaping Bunny: ${h.tradingName || h.company} ${h.url}`)].join('\n  '));
    process.exit(4);
  }

  const ph = pListed[0] || p[0] || null;   // p[0]: PETA's page saying "may not be cruelty-free" is still a source
  const lh = l[0] || null;
  const display = (lh && (lh.tradingName || lh.company)) || (ph && bare(ph.title)) || name.trim();
  let id = display.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';
  while (data.brands.some((b) => b.id === id)) id += '-2';

  const record = {
    id,
    name: display,
    search: [...new Set([display, name.trim()])],
    peta: ph
      ? { status: ph.status, note: ph.verdict, url: ph.url, checked: today }
      : { status: 'unknown', note: "Not found on PETA's list", url: 'https://crueltyfree.peta.org/', checked: today },
    leapingBunny: lh
      ? { status: 'yes', note: 'Leaping Bunny certified', url: lh.url, checked: today }
      : { status: 'unknown', note: "Not found in Leaping Bunny's Shopping Guide", url: `${LB}/Web/Shopping-Guide/Brands.aspx`, checked: today },
    parent: lh && lh.parentTests
      ? { name: null, testsOnAnimals: 'yes', url: lh.url, note: 'Leaping Bunny: its parent company tests on animals', checked: today }
      : { name: null, testsOnAnimals: 'unknown', url: null, note: 'Not yet researched', checked: null },
    chinaRetail: { status: 'unknown', url: null, note: 'Not yet researched', checked: null },
    vegan: ph && ph.vegan ? 'all' : 'unknown',
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
    console.log(`\nAdded ${display} (${id}) to ${path.relative(process.cwd(), FILE)}. Bump CACHE_VERSION in sw.js, then run check-brands --links.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
