// Checks the brand directory in a real browser (phase 3 "Done when" lines).
//   node tools/test-directory.cjs           (serves the repo's parent folder on port 8766)
// Expected counts come from data/brands.json, worked out here independently of brands.js.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8766/${path.basename(path.resolve(__dirname, '..'))}/`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8')).brands;
const certified = data.filter((b) => b.peta.status === 'yes' || b.leapingBunny.status === 'yes');
const strict = certified.filter((b) => !(b.parent.testsOnAnimals === 'yes' && b.parent.name !== b.name) && b.chinaRetail.status !== 'yes');
const veganStrict = strict.filter((b) => b.vegan === 'all');

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8766, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const rows = () => page.$$eval('#brand-list .brand-row', (a) => a.length);
  const count = () => page.textContent('#brand-count');

  await page.goto(BASE + '#brands', { waitUntil: 'networkidle' });
  await page.waitForSelector('#brand-list .brand-row');
  check((await count()).startsWith(`${strict.length} of 30 brands pass Strict`), `Strict count is ${strict.length}: "${await count()}"`);
  check(await rows() === strict.length, `browsing Strict lists ${strict.length} brands (got ${await rows()})`);

  await page.click('.mode-btn[data-mode=certified]');
  check((await count()).startsWith(`${certified.length} of 30 brands pass Certified`), `Certified count is ${certified.length}: "${await count()}"`);
  check(await rows() === certified.length, `browsing Certified lists ${certified.length} brands`);
  await page.click('.mode-btn[data-mode=strict]');

  await page.fill('#brand-q', 'estee');
  const estee = await page.textContent('#brand-list');
  check(/Estée Lauder/.test(estee) && /Doesn't pass/.test(estee), 'search "estee" finds Estée Lauder marked "Doesn\'t pass"');
  await page.fill('#brand-q', 'maybelline');
  check(/tests on animals/.test(await page.textContent('#brand-list')), 'search "maybelline" says why it fails');
  await page.fill('#brand-q', 'zzznotabrand');
  check(/No brand called/.test(await page.textContent('#brand-list')), 'unknown search says so plainly');
  await page.fill('#brand-q', '');

  await page.click('.chip[data-filter=vegan]');
  check(await rows() === veganStrict.length, `Vegan filter under Strict shows ${veganStrict.length} (got ${await rows()})`);
  await page.click('.chip[data-filter=vegan]');

  await page.click('#brand-more');
  check(await rows() === 30, '"Show the brands that don\'t pass" lists all 30');
  await page.click('#brand-more');

  // Brand page: Tarte passes Certified but fails Strict over its parent
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.click('.mode-btn[data-mode=certified]');
  await page.click('a[href="#brand/tarte"]');
  await page.waitForSelector('#brand-page .facts');
  const tarte = await page.textContent('#brand-page');
  for (const t of ['PETA', 'Leaping Bunny', 'Parent company', 'Mainland China', 'Vegan', 'Price', 'Where to buy', 'Checked 11 Nov 2026', 'Unknown', 'carries this brand']) check(tarte.includes(t), `Tarte page shows "${t}"`);
  check(/Passes Certified/.test(tarte), 'Tarte passes Certified');
  check(!/in stock/i.test(tarte), 'never says "in stock"');
  check((await page.title()) === 'C.F.B. · Tarte', 'page title names the brand');
  await page.goBack();
  await page.waitForSelector('[data-screen=brands]:not([hidden])');
  check(true, 'Back returns to the list');
  await page.click('.mode-btn[data-mode=strict]');
  await page.goto(BASE + '#brand/tarte');
  await page.waitForSelector('#brand-page .facts');
  check(/Kosé, tests on animals/.test(await page.textContent('#brand-page')), 'Tarte under Strict: fails over its parent, Kosé (opened by direct link)');

  // Offline: after the worker installs, the list still loads with no network
  await page.goto(BASE + '#brands', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#brand-list .brand-row', { timeout: 8000 }).catch(() => {});
  check(await rows() === strict.length, 'offline: the brand list still loads');
  await ctx.setOffline(false);

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
