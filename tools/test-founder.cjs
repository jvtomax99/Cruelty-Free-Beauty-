// Checks the founder tools in a real browser: the hidden Founder tools row on Profile, the Add a
// brand screen and the GitHub issue link it opens, the names sent from this phone, and the
// "Shop my picks" storefront card (off while data/brands.json has no picks url).
//   node tools/test-founder.cjs                 (serves the repo's parent folder on port 8771)
//   node tools/test-founder.cjs --shots DIR     (also saves pictures at 390 and 1440 px)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8771/${path.basename(path.resolve(__dirname, '..'))}/`;
const APP = BASE + '?intro=0';
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8'));
const PICKS = 'https://shopmy.us/example-storefront';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8771, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const opened = [];
  await page.exposeFunction('__opened', (u) => opened.push(u));
  await page.addInitScript(() => { window.open = (u) => { window.__opened(String(u)); return null; }; });

  // A fresh phone: no Founder tools row, no picks card (picks.url is null in the data).
  check(DATA.picks && DATA.picks.url === null, 'data/brands.json ships with picks.url null');
  await page.goto(APP + '#profile', { waitUntil: 'networkidle' });
  check(!(await page.$('#founder-row .fd-card')), 'fresh phone: no Founder tools row on Profile');
  check(!(await page.$('#picks-app .pk-card')), 'picks url null: no "Shop my picks" card');

  // ?founder=1 once turns the row on, and it stays after a plain reload.
  await page.goto(BASE + '?intro=0&founder=1#profile', { waitUntil: 'networkidle' });
  await page.goto(APP + '#profile', { waitUntil: 'networkidle' });
  check(!!(await page.$('#founder-row .fd-card')), 'after ?founder=1: the Founder tools row shows, and stays');
  await page.click('#founder-row a[href="#add"]');
  await page.waitForSelector('[data-screen="add"]:not([hidden])');
  check(await page.title() === 'C.F.B. · Add a brand', `Add a brand screen opens with its title ("${await page.title()}")`);
  check(await page.$eval('[data-tab="profile"]', (t) => t.getAttribute('aria-current')) === 'page', 'Add a brand sits under the Profile tab');
  if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, 'add-390.png') }); }

  // Empty name: nothing opens, she's told why.
  await page.click('#add-form button[type=submit]');
  check(opened.length === 0 && /Type the brand/.test(await page.textContent('#add-msg')), 'Send with no name opens nothing and says so');

  // A name with an ampersand, an apostrophe and an accent, plus both links.
  const NAME = "Rose & Crème L'Atelier";
  await page.fill('#add-name', NAME);
  await page.fill('#add-site', 'https://example.com/shop?a=1&b=2');
  await page.fill('#add-proof', 'javascript:alert(1)');
  await page.click('#add-form button[type=submit]');
  await page.waitForTimeout(200);
  const u = opened[0] ? new URL(opened[0]) : null;
  check(!!u && u.origin + u.pathname === 'https://github.com/jvtomax99/Cruelty-Free-Beauty-/issues/new', `Send opens the repo's new-issue page (${opened[0] || 'nothing'})`);
  if (u) {
    const q = u.searchParams;
    check(q.get('template') === 'add-brand.yml', 'it uses the add-brand issue form');
    check(q.get('brand') === NAME && q.get('title') === 'Add brand: ' + NAME, 'name with &, \' and an accent arrives whole');
    check(q.get('site') === 'https://example.com/shop?a=1&b=2', 'website link arrives whole');
    check(!q.has('proof'), 'a link field that is not a web address is dropped');
  }
  check(await page.inputValue('#add-name') === '', 'the form clears after Send');
  await page.fill('#add-name', 'Kaja');
  await page.fill('#add-proof', 'https://crueltyfree.peta.org/company/kaja-beauty/?x=1&y=2');
  await page.click('#add-form button[type=submit]');
  await page.waitForTimeout(200);
  check(opened[1] && new URL(opened[1]).searchParams.get('proof') === 'https://crueltyfree.peta.org/company/kaja-beauty/?x=1&y=2', 'a certifier link arrives whole');
  check(/Submit new issue/.test(await page.textContent('#add-msg')), 'she is told to tap Submit on GitHub');

  // The issue form's field ids match what the app fills in.
  const form = fs.readFileSync(path.join(__dirname, '..', '.github', 'ISSUE_TEMPLATE', 'add-brand.yml'), 'utf8');
  check(['brand', 'site', 'proof'].every((id) => new RegExp(`id: ${id}\\b`).test(form)) && /labels: \["add-brand"\]/.test(form), 'issue form has the brand, site and proof fields and the add-brand label');

  // Sent list: the new name is waiting; a name already in the app links to its page; both survive a reload.
  await page.fill('#add-name', 'milani');
  await page.click('#add-form button[type=submit]');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#add-sent .ad-row');
  const rows = await page.$$eval('#add-sent .ad-row', (a) => a.map((r) => [r.querySelector('.ad-name').textContent, r.querySelector('.ad-state').textContent]));
  check(rows.length === 3 && rows[0][0] === 'milani' && rows[0][1] === 'In the app' && rows[1][0] === 'Kaja' && rows[2][0] === NAME && /^Opened /.test(rows[2][1]), `sent list after reload: ${JSON.stringify(rows)}`);
  check(await page.$eval('#add-sent .ad-state.is-in', (a) => a.getAttribute('href')) === '#brand/milani', '"In the app" links to the brand page');
  if (SHOTS) { await page.$eval('#add-sent', (e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, 'add-sent-390.png') }); }

  // Broken saved data doesn't break the screen.
  await page.evaluate(() => localStorage.setItem('cfb-sent-brands', '{not json'));
  await page.reload({ waitUntil: 'networkidle' });
  check(!!(await page.$('#add-form')) && !(await page.$('#add-sent .ad-row')), 'broken saved list: the screen still works, list empty');

  // ?founder=0 hides the row again.
  await page.goto(BASE + '?intro=0&founder=0#profile', { waitUntil: 'networkidle' });
  check(!(await page.$('#founder-row .fd-card')), '?founder=0 hides the row');

  // Picks card on, with a storefront link in the data.
  await page.route('**/data/brands.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...DATA, picks: { url: PICKS, checked: '2026-11-14' } }) }));
  await page.goto(APP + '#profile', { waitUntil: 'networkidle' });
  await page.waitForSelector('#picks-app .pk-card');
  const a = await page.$eval('#picks-app a', (x) => ({ href: x.href, rel: x.rel, target: x.target }));
  check(a.href === PICKS && /sponsored/.test(a.rel) && /noopener/.test(a.rel) && a.target === '_blank', `picks card links the storefront, new tab, rel="${a.rel}"`);
  check(/earn a small commission/.test(await page.textContent('#picks-app')), 'picks card always says she earns a commission');
  if (SHOTS) { await page.$eval('#picks-app', (e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, 'picks-390.png') }); }

  // A picks link that isn't a web address never becomes a link.
  await page.unroute('**/data/brands.json');
  await page.route('**/data/brands.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...DATA, picks: { url: 'javascript:alert(1)', checked: '2026-11-14' } }) }));
  await page.reload({ waitUntil: 'networkidle' });
  check(!(await page.$('#picks-app .pk-card')), 'a picks url that is not a web address shows no card');
  await page.unroute('**/data/brands.json');

  // Desktop width.
  if (SHOTS) {
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const w = await wide.newPage();
    await w.route('**/data/brands.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...DATA, picks: { url: PICKS, checked: '2026-11-14' } }) }));
    await w.goto(BASE + '?intro=0&founder=1#profile', { waitUntil: 'networkidle' });
    await w.$eval('#picks-app', (e) => e.scrollIntoView({ block: 'center' })); await w.waitForTimeout(700);
    await w.screenshot({ path: path.join(SHOTS, 'profile-1440.png') });
    await w.goto(APP + '#add', { waitUntil: 'networkidle' }); await w.waitForTimeout(700);
    await w.screenshot({ path: path.join(SHOTS, 'add-1440.png') });
    await wide.close();
  }

  // Offline: with the real worker, Add a brand opens with no signal after one visit.
  const off = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const o = await off.newPage();
  await o.goto(APP + '#add', { waitUntil: 'networkidle' });
  await o.evaluate(() => navigator.serviceWorker.ready);
  await o.reload({ waitUntil: 'networkidle' });
  await off.setOffline(true);
  await o.reload({ waitUntil: 'domcontentloaded' });
  await o.waitForSelector('#add-form', { timeout: 10000 }).catch(() => {});
  check(!!(await o.$('[data-screen="add"]:not([hidden]) #add-form')), 'offline: Add a brand opens from the saved app');
  await off.close();

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
  process.exit(failures ? 1 : 0);
})();
