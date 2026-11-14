// Checks that the app updates itself (app.js, "Updates on their own") in a real browser, with the real
// offline worker. A new version is found when the app comes back into view; the page then reloads by
// itself when the app goes into the background or on arriving at Home, and never while something is in use.
//   node tools/test-update.cjs        (serves the repo's parent folder on port 8774)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOT = path.resolve(REPO, '..');
const APP = `http://localhost:8774/${path.basename(REPO)}/?intro=0`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.mp4': 'video/mp4' };
let version = 1;   // each number is "a new version went live": the worker's file differs, as after a real merge
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    if (p.endsWith(path.sep + 'sw.js')) d = Buffer.from(String(d).replace(/const CACHE_VERSION = "([^"]+)"/, `const CACHE_VERSION = "$1-t${version}"`));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d);
  });
});
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8774, r));
  const browser = await chromium.launch();
  const errors = [];
  async function phone({ noSession = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    let loads = 0;                                   // every load of the page, counted from outside it
    await page.exposeFunction('__loaded', () => { loads++; });
    await page.addInitScript((noSession) => {
      window.__loaded();
      if (noSession) Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });
    }, noSession);
    await page.clock.install();
    const ready = () => page.waitForFunction(() => !!window.CFB && !!window.CFB.update && navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
    const settle = async (n) => { for (let i = 0; i < 100 && loads < n; i++) await page.waitForTimeout(100); await ready(); };
    // away for over a minute, then back in view; or into the background
    const show = (hidden) => page.evaluate((hidden) => { Object.defineProperty(document, 'hidden', { value: hidden, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
    const comeBack = async () => { await page.clock.fastForward(61e3); await show(false); };
    const downloaded = () => page.waitForFunction(() => window.CFB.update.waiting(), null, { timeout: 20000 }).then(() => true, () => false);
    const go = (hash) => page.evaluate((hash) => { location.hash = hash; }, hash);
    const cacheName = () => page.evaluate(async () => (await caches.keys()).find((k) => /^cfb-v\d/.test(k)));
    return { ctx, page, ready, settle, show, comeBack, downloaded, go, cacheName, loads: () => loads };
  }

  {
    const p = await phone(); const { page } = p;
    // First visit: the worker installs and takes over. That is not an update: one load only.
    await page.goto(APP); await p.ready();
    await page.clock.fastForward(5000); await page.waitForTimeout(1200);
    check(p.loads() === 1, `first visit: the worker takes over without a reload (${p.loads()} load)`);

    // Nothing new: coming back and leaving change nothing.
    await p.comeBack(); await page.waitForTimeout(1200); await p.show(true); await page.waitForTimeout(500); await p.show(false);
    check(p.loads() === 1, 'coming back and leaving with nothing new: no reload');

    // A new version while reading Home: it downloads, and the page under the reader is left alone...
    const v1 = await p.cacheName();
    version = 2; await p.comeBack();
    check(await p.downloaded() && p.loads() === 1, 'a new version while Home is on view (found from a first-visit page too): downloaded, the page is not pulled from under the reader');
    // ...until the app goes into the background.
    await p.show(true); await p.settle(2);
    const v2 = await p.cacheName();
    check(p.loads() === 2 && v2 !== v1 && /-t2$/.test(v2), `the app goes into the background: it reloads there, onto the new version (${v1} -> ${v2})`);
    await p.show(false); await page.clock.fastForward(40e3); await p.comeBack(); await page.waitForTimeout(1500);
    await p.go('#brands'); await p.go('#home'); await page.waitForTimeout(500);
    check(p.loads() === 2, 'after that reload it stays put: coming back and moving between screens reload nothing');

    // On another screen: it waits for Home.
    await p.go('#learn');
    version = 3; await p.comeBack(); await p.downloaded();
    await p.go('#brands'); await page.waitForTimeout(400);
    check(p.loads() === 2, 'a new version while on Learn, then Brands: no reload on those screens');
    await p.go('#home'); await p.settle(3);
    check(p.loads() === 3, 'arriving at Home: it reloads');

    // Things in use: each holds the reload, even with the app in the background and even via Home.
    let n = 3;
    const cases = [
      ['a Sanctuary round', async () => { await p.go('#practice/all'); await page.waitForSelector('#practice-box .quiz-opt'); }, async () => { await p.go('#home'); }],
      ['the Sanctuary', async () => { await p.go('#garden'); await page.waitForSelector('[data-screen=garden]:not([hidden])'); }, async () => { await p.go('#home'); }],
      ['the Scan screen', async () => { await p.go('#scan'); await page.waitForSelector('[data-screen=scan]:not([hidden])'); }, async () => { await p.go('#home'); }],
      ['a brand search', async () => { await p.go('#brands'); await page.fill('#brand-q', 'mil'); await page.evaluate(() => document.activeElement.blur()); await p.go('#brand/milani'); }, async () => { await p.go('#brands'); await page.fill('#brand-q', ''); await page.evaluate(() => document.activeElement.blur()); await p.go('#home'); }],
      ['the profile quiz, left half-done for Home', async () => { await page.evaluate(() => localStorage.removeItem('cfb-profile')); await p.go('#profile'); await page.waitForSelector('#pf-start'); await page.click('#pf-start'); await page.waitForSelector('.quiz-opt'); await page.locator('.quiz-opt').first().click(); await p.go('#home'); }, async () => {
        await p.go('#profile');
        for (let i = 0; i < 8 && await page.locator('.quiz-q').count(); i++) { const q = await page.textContent('.quiz-q'); await page.locator('.quiz-opt').first().click(); await page.waitForFunction((q) => !document.querySelector('.quiz-q') || document.querySelector('.quiz-q').textContent !== q, q); }
        await page.waitForSelector('#pf-h');
        check(p.loads() === n && await page.evaluate(() => !!localStorage.getItem('cfb-profile')), 'the quiz finished: its profile is saved and on view, with no reload under the reader');
        await p.go('#home');
      }]
    ];
    for (const [what, enter, leave] of cases) {
      await page.clock.fastForward(31e3);
      await enter();
      version++; await p.comeBack(); await p.downloaded();
      await p.show(true); await page.waitForTimeout(400); await p.show(false); await page.waitForTimeout(300);
      check(p.loads() === n && await page.evaluate(() => window.CFB.update.waiting()), `a new version during ${what}: held, even with the app sent to the background`);
      await leave(); n++; await p.settle(n);
      check(p.loads() === n, `after ${what}: it reloads on Home`);
    }

    // No loop: within 30 s of a reload, a further version waits for the next chance.
    await page.evaluate(() => sessionStorage.setItem('cfb-renewed', String(Date.now() + 61e3)));   // as if that reload were a moment before coming back
    version++; await p.comeBack(); await p.downloaded();
    await p.go('#learn'); await p.go('#home'); await page.waitForTimeout(500);
    check(p.loads() === n, 'a further version within 30 s of a reload: held back');
    await page.clock.fastForward(31e3);
    await p.go('#learn'); await p.go('#home'); await p.settle(n + 1);
    check(p.loads() === n + 1, 'and taken at the next arrival on Home');
    await p.ctx.close();
  }
  {
    // Storage for the session blocked (some private modes): one reload per version, no loop.
    const p = await phone({ noSession: true }); const { page } = p;
    await page.goto(APP); await p.ready();
    version++; await p.comeBack(); await p.downloaded(); await p.show(true); await p.settle(2); await p.show(false);
    await page.clock.fastForward(120e3); await p.comeBack(); await page.waitForTimeout(1500);
    await p.go('#learn'); await p.go('#home'); await p.show(true); await page.waitForTimeout(500);
    check(p.loads() === 2, `session storage blocked: one reload for one new version, then it stays put (${p.loads()} loads)`);
    await p.ctx.close();
  }
  {
    // Two tabs open: each reloads once.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const counts = [0, 0], tabs = [];
    for (const i of [0, 1]) {
      const page = await ctx.newPage(); tabs.push(page);
      page.on('pageerror', (e) => errors.push(e.message));
      await page.exposeFunction('__loaded', () => { counts[i]++; });
      await page.addInitScript(() => window.__loaded());
      await page.goto(APP);
      await page.waitForFunction(() => !!window.CFB && !!window.CFB.update && navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
    }
    const base = counts.slice();
    version++;
    await tabs[0].evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    for (const t of tabs) await t.waitForFunction(() => window.CFB.update.waiting(), null, { timeout: 20000 }).catch(() => {});
    for (const t of tabs) await t.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
    await tabs[0].waitForTimeout(3000);
    check(counts[0] - base[0] === 1 && counts[1] - base[1] === 1, `two tabs open: each reloads once (${counts[0] - base[0]} and ${counts[1] - base[1]})`);
    await ctx.close();
  }

  check(errors.filter((e) => !/blocked/.test(e)).length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
