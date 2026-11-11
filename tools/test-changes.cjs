// Checks the "What changed" notices in a real browser, with made-up changes served in place of
// data/brands.json (the real list is empty until a recheck finds a change).
//   node tools/test-changes.cjs           (serves the repo's parent folder on port 8769)
//   node tools/test-changes.cjs --shots DIR   also saves screenshots (390 px and 1440 px) into DIR
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8769/${path.basename(path.resolve(__dirname, '..'))}/`;
const APP = BASE + '?intro=0';   // skip the launch show
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8'));
const ago = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const LB = 'https://www.leapingbunny.org/Web/Shopping-Guide/Brands.aspx', PETA = 'https://crueltyfree.peta.org/';
// Six that count (Home shows five), plus three that must be ignored.
const MADE_UP = [
  { id: 'milani', claim: 'peta', from: 'yes', to: 'unknown', date: ago(3), url: PETA },
  { id: 'glossier', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(5), url: LB },
  { id: 'fenty-beauty', claim: 'peta', from: 'unknown', to: 'yes', date: ago(8), url: PETA },
  { id: 'pacifica', claim: 'parent', from: 'unknown', to: 'yes', date: ago(12), url: PETA, note: 'Made-up note <b>bold</b>.' },
  { id: 'colourpop', claim: 'chinaRetail', from: 'unknown', to: 'yes', date: ago(20), url: 'https://example.com/' },
  { id: 'kosas', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(40), url: LB },
  { id: 'morphe', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(400), url: LB },     // over 12 months
  { id: 'not-a-brand', claim: 'peta', from: 'yes', to: 'no', date: ago(2), url: PETA },             // unknown brand
  { id: 'elf', claim: 'peta', from: 'yes', to: 'no', date: ago(-5), url: PETA },                    // in the future
];
const LATER = { id: 'rare-beauty', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(1), url: LB };

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;

(async () => {
  await new Promise((r) => server.listen(8769, r));
  const browser = await chromium.launch();
  const errors = [];

  // 1. The real data (no changes yet): nothing shows.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(APP, { waitUntil: 'networkidle' });
    check(real.changes.length > 0 || await page.isHidden('#changes-card'), 'no changes in the data: no card on Home');
    await page.goto(APP + '#brands'); await page.waitForSelector('#brand-list .brand-row');
    check(real.changes.length > 0 || await page.isHidden('#changes-all'), 'no changes in the data: no "Recent changes" on Brands');
    await ctx.close();
  }

  // 2. Made-up changes.
  let changes = MADE_UP;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1, serviceWorkers: 'block' });
  await ctx.route('**/data/brands.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...real, changes }) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.CFB.saved.toggle('kosas'));   // heart Kosas the way the app does
  await page.reload({ waitUntil: 'networkidle' });

  check(await page.isVisible('#changes-card'), 'Home shows the "What changed" card');
  const names = await page.$$eval('#changes-new .brand-name', (a) => a.map((x) => x.textContent));
  check(names.length === 5, `Home shows 5 changes at most (got ${names.length})`);
  check(names[0] === 'Kosas', `the hearted brand comes first, though its change is the oldest (first: ${names[0]})`);
  check(/You saved this/.test(await page.textContent('#changes-new .change:first-child')), 'the hearted brand says "You saved this"');
  check(names.join() === 'Kosas,Milani,Glossier,Fenty Beauty,Pacifica', `the rest are newest first (${names.join(', ')})`);
  check(/And 1 more/.test(await page.textContent('#changes-rest')), 'says one more is under Brands');
  const card = await page.textContent('#changes-card');
  check(!/Morphe|e\.l\.f\./.test(card), 'ignores a change over 12 months old, one dated in the future and an unknown brand');
  check(/No longer on PETA's cruelty-free list/.test(card) && /No longer in Leaping Bunny's guide/.test(card) && /Now on PETA's cruelty-free list/.test(card), 'says what the list showed, good news included');
  check(!/dropped|removed|quit|abandon|lost/i.test(card), 'never says why (no "dropped", "removed", "lost")');
  const src = await page.$$eval('#changes-new .src', (a) => a.map((p) => ({ t: p.textContent, href: (p.querySelector('a') || {}).href })));
  check(src.every((s) => /^Checked \d{1,2} [A-Z][a-z]{2} \d{4}/.test(s.t) && /^https:\/\//.test(s.href || '')), 'every change has its date and a source link');
  check(await page.$eval('#changes-new', (el) => !el.querySelector('b')), 'a note is shown as text, never as markup');
  if (shots) await page.screenshot({ path: path.join(shots, 'changes-home-phone.png'), fullPage: true });

  // The brand page carries the change.
  await page.click('#changes-new a[href="#brand/kosas"]');
  await page.waitForSelector('#brand-page .facts');
  const note = await page.textContent('#brand-page .change-note');
  check(/^Changed \d{1,2} [A-Z][a-z]{2} \d{4}\. No longer in Leaping Bunny's guide\./.test(note), `Kosas's page says it: "${note}"`);
  if (shots) await page.screenshot({ path: path.join(shots, 'changes-brand-phone.png') });
  await page.goto(APP + '#brand/milani'); await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#brand-page .facts');
  check(await page.isVisible('#brand-page .change-note'), 'a brand page opened by direct link shows its change too');
  await page.goto(APP + '#brand/elf'); await page.waitForSelector('#brand-page .facts');
  check(await page.$('#brand-page .change-note') === null, 'a brand with no change has no such line');

  // Got it.
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.click('#changes-ok');
  check(await page.isHidden('#changes-card'), '"Got it" hides the card');
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.isHidden('#changes-card'), 'it stays hidden after a reload');
  await page.goto(APP + '#brands'); await page.waitForSelector('#brand-list .brand-row');
  check(await page.$$eval('#changes-list .change', (a) => a.length) === 6, '"Recent changes" on Brands still lists all 6');
  const order = await page.$$eval('#changes-list .brand-name', (a) => a.map((x) => x.textContent));
  check(order[0] === 'Milani' && order[5] === 'Kosas', 'that list is newest first');
  if (shots) await page.locator('#changes-all').screenshot({ path: path.join(shots, 'changes-brands-phone.png') });

  // A change found by a later recheck shows on its own.
  changes = [LATER, ...MADE_UP];
  await page.goto(APP, { waitUntil: 'networkidle' }); await page.reload({ waitUntil: 'networkidle' });
  const again = await page.$$eval('#changes-new .brand-name', (a) => a.map((x) => x.textContent));
  check(again.join() === 'Rare Beauty', `a later change shows alone (${again.join(', ')})`);

  // Desktop width.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.isVisible('#changes-card') && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'desktop: the card shows and nothing overflows sideways');
  if (shots) {
    await page.evaluate(() => localStorage.removeItem('cfb-changes-seen')); await page.reload({ waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(shots, 'changes-home-desktop.png'), fullPage: true });
  }
  await ctx.close();

  check(errors.length === 0, errors.length ? `script errors: ${errors.join(' | ')}` : 'no script errors');
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
