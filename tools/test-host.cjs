// Checks Home's host (the girl's bubble) in a real browser: each case shows its line and its link
// opens the right place, with made-up phone data and made-up changes.
//   node tools/test-host.cjs                (serves the repo's parent folder on port 8771)
//   node tools/test-host.cjs --shots DIR    also saves screenshots (390 px and 1440 px) into DIR
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8771/${path.basename(path.resolve(__dirname, '..'))}/`;
const APP = BASE + '?intro=0';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8'));
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
const Q = questions.questions.slice(0, 3).map((q) => q.id);
const ago = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const LB = 'https://www.leapingbunny.org/Web/Shopping-Guide/Brands.aspx';
const PROFILE = { skin: 'dry', depth: 'fair', veins: 'cool', jewelry: 'cool', sun: 'cool', finish: 'matte', budget: 'any', vegan: 'no', undertone: 'cool' };
const VERDICT = /cruelty|passes|doesn't pass|certified|tests on animals|approved|safe|not on/i;

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;

(async () => {
  await new Promise((r) => server.listen(8771, r));
  const browser = await chromium.launch();
  const errors = [];
  let changes = [];

  // A fresh phone each time: `keys` is what it has stored, `hour` the time of day.
  async function phone(keys, { hour = 10, width = 390, height = 844, reduced = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: shots ? 2 : 1, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.route('**/data/brands.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...real, changes }) }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const at = new Date(); at.setHours(hour, 0, 0, 0);
    await page.clock.setFixedTime(at);
    await page.addInitScript((k) => { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); for (const [a, b] of Object.entries(k)) localStorage.setItem('cfb-' + a, JSON.stringify(b)); } }, keys);
    await page.goto(APP, { waitUntil: 'networkidle' });
    return { ctx, page };
  }
  const line = (page) => page.$eval('#host-say', (el) => el.textContent.replace(/\s+/g, ' ').trim());
  const href = (page) => page.getAttribute('#host', 'href');
  const stored = (page) => page.evaluate(() => Object.keys(localStorage).sort().join());
  const said = [];

  // 1. No profile: the quiz, whatever else is true.
  {
    const { ctx, page } = await phone({ scans: [{ code: '1', brand: 'milani', name: 'Milani', t: Date.now() }] });
    const t = await line(page); said.push(t);
    check(t === 'New here? Find your match in 8 questions.' && await href(page) === '#profile', `no profile: "${t}" -> ${await href(page)}`);
    const before = await stored(page);
    await page.click('#host');
    check(await page.waitForSelector('[data-screen="profile"]', { state: 'visible', timeout: 3000 }).then(() => true, () => false), 'the bubble opens Profile');
    check(await stored(page) === before, `she stores nothing (${before})`);
    if (shots) { await page.goBack(); await page.screenshot({ path: path.join(shots, 'host-quiz-390.png') }); }
    await ctx.close();
  }

  // 2. A hearted brand changed: goes to the "What changed" card; "Got it" moves her on.
  {
    changes = [{ id: 'kosas', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(3), url: LB },
      { id: 'milani', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(3), url: LB }];
    const { ctx, page } = await phone({ profile: PROFILE, saved: ['kosas'], garden: { v: 1, items: { [Q[0]]: { s: 1, due: 1, k: 'w' } }, best: {}, shelter: {} } });
    let t = await line(page); said.push(t);
    check(t === 'Kosas has news. See what changed.', `one hearted brand changed: "${t}"`);
    if (shots) await page.screenshot({ path: path.join(shots, 'host-changed-390.png') });
    await page.click('#host');
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'changes-h');
    check(await page.isVisible('[data-screen="home"]') && await page.isVisible('#changes-card'), 'the bubble stays on Home and goes to the "What changed" card');
    await page.evaluate(() => window.CFB.saved.toggle('milani'));
    t = await line(page); said.push(t);
    check(t === '2 brands you saved have news. See what changed.', `a second heart: "${t}"`);
    await page.click('#changes-ok');
    t = await line(page); said.push(t);
    check(t === 'Your Sanctuary is waiting. 1 question to review.' && await href(page) === '#practice/all', `after "Got it", the next case: "${t}" -> ${await href(page)}`);
    await page.click('#host');
    await page.waitForSelector('#practice-box .quiz-opt');
    check(true, 'the bubble opens a round of questions');
    await ctx.close();
    changes = [];
  }

  // 3. A change to a brand that is not hearted says nothing here.
  {
    changes = [{ id: 'milani', claim: 'leapingBunny', from: 'yes', to: 'unknown', date: ago(3), url: LB }];
    const { ctx, page } = await phone({ profile: PROFILE, saved: ['kosas'] });
    check(!/news/.test(await line(page)), 'a change to a brand that is not hearted: no "news" line');
    await ctx.close();
    changes = [];
  }

  // 4. Questions due, several.
  {
    const items = Object.fromEntries(Q.map((id) => [id, { s: 1, due: 1, k: 'w' }]));
    const { ctx, page } = await phone({ profile: PROFILE, garden: { v: 1, items, best: {}, shelter: {} } });
    const t = await line(page); said.push(t);
    check(t === 'Your Sanctuary is waiting. 3 questions to review.', `three due: "${t}"`);
    if (shots) await page.screenshot({ path: path.join(shots, 'host-review-390.png') });
    await ctx.close();
  }

  // 5. A recent scan; an old one, and one of a brand we haven't checked, don't count.
  {
    const long = real.brands.reduce((a, b) => (b.name.length > a.name.length ? b : a));
    const { ctx, page } = await phone({ profile: PROFILE, scans: [{ code: '1', brand: long.id, name: long.name, t: Date.now() - 864e5 }] });
    const t = await line(page); said.push(t);
    check(t === `You scanned ${long.name}. See its page again.` && await href(page) === '#brand/' + encodeURIComponent(long.id), `scanned yesterday (the longest name): "${t}" -> ${await href(page)}`);
    const box = await page.$eval('#host-say', (el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; });
    check(box, 'the longest line stays inside the screen at 390 px');
    if (shots) await page.screenshot({ path: path.join(shots, 'host-scanned-390.png') });
    await page.click('#host');
    await page.waitForSelector('#brand-page .facts');
    check((await page.textContent('#brand-page h1')).includes(long.name), "the bubble opens that brand's page");
    await ctx.close();
  }
  {
    const { ctx, page } = await phone({ profile: PROFILE, scans: [{ code: '1', brand: 'milani', name: 'Milani', t: Date.now() - 9 * 864e5 }] });
    check(!/scanned/.test(await line(page)), 'a scan 9 days old: no "You scanned" line');
    await ctx.close();
  }
  {
    const { ctx, page } = await phone({ profile: PROFILE, scans: [{ code: '1', brand: null, name: 'Unknown Co', t: Date.now() }, { code: '2', brand: 'milani', name: 'Milani', t: Date.now() - 5000 }] });
    check(!/scanned/.test(await line(page)), "the newest scan is a brand we haven't checked: no \"You scanned\" line");
    await ctx.close();
  }

  // 6. Nothing else to say: time of day, pointing to Scan. Broken stored data counts as nothing.
  for (const [hour, want] of [[9, 'Shopping today? Scan it first.'], [14, 'In the aisle? Scan the barcode.'], [20, 'Curious about what you own? Scan it tonight.']]) {
    const { ctx, page } = await phone({ profile: PROFILE, scans: 'nonsense', garden: [1, 2], saved: { a: 1 } }, { hour });
    const t = await line(page); said.push(t);
    check(t === want && await href(page) === '#scan', `${hour}:00 with nothing else (and broken stored data): "${t}"`);
    await ctx.close();
  }

  // 7. Finishing the quiz during a visit moves her on.
  {
    const { ctx, page } = await phone({});
    await page.evaluate((p) => localStorage.setItem('cfb-profile', JSON.stringify(p)), PROFILE);
    await page.goto(APP + '#profile'); await page.goBack();
    check(!/New here/.test(await line(page)), 'once the quiz is done she no longer asks for it');
    await ctx.close();
  }

  check(said.every((t) => !VERDICT.test(t)), 'no line words a verdict');

  // Screenshots: phone and computer, the default line.
  if (shots) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const { ctx, page } = await phone({ profile: PROFILE }, { width: w, height: h, hour: 14 });
      await page.screenshot({ path: path.join(shots, `host-home-${w}.png`) });
      await ctx.close();
    }
    const { ctx, page } = await phone({}, { width: 1440, height: 900 });
    await page.screenshot({ path: path.join(shots, 'host-quiz-1440.png') });
    await ctx.close();
  }

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
