// Checks that the app updates itself (app.js, "Updates on their own") in a real browser, with the real
// offline worker: a new version found on returning to the app reloads the page on its own, but waits
// while a quiz, a Sanctuary round, the Scan screen or a typed-in field is in use.
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  const mark = () => page.evaluate(() => { window.__mark = 1; });
  const marked = () => page.evaluate(() => window.__mark === 1).catch(() => false);
  const reloaded = (ms = 8000) => page.waitForFunction(() => window.__mark !== 1 && !!window.CFB && !!window.CFB.update, null, { timeout: ms }).then(() => true, () => false);
  // coming back to the app: more than a minute later, the page is shown again
  const comeBack = async () => { await page.clock.fastForward(61e3); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); };
  const cacheName = () => page.evaluate(async () => (await caches.keys()).find((k) => /^cfb-v\d/.test(k)));

  // First visit: the worker installs and takes over; that is not an update, so no reload.
  await page.goto(APP);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
  await mark();
  await page.clock.fastForward(2000); await page.waitForTimeout(800);
  check(await marked(), 'first visit: the worker takes over without reloading the page');
  await page.reload(); await page.waitForFunction(() => !!window.CFB.update && navigator.serviceWorker.controller !== null);
  const v1 = await cacheName();

  // Nothing new: coming back changes nothing.
  await mark(); await comeBack(); await page.waitForTimeout(1500);
  check(await marked() && await cacheName() === v1, 'coming back with nothing new: no reload');

  // A new version goes live while the app sits on Home: coming back fetches it and the page reloads itself.
  version = 2;
  await mark(); await comeBack();
  check(await reloaded(20000), 'a new version, on Home: found on coming back, and the page reloads on its own');
  const v2 = await cacheName();
  check(v2 !== v1 && /-t2$/.test(v2), `the reloaded page runs the new version (${v1} -> ${v2})`);

  // Mid Sanctuary round: it waits, then reloads on leaving the round.
  await page.evaluate(() => { location.hash = '#practice/all'; });
  await page.waitForSelector('#practice-box .quiz-opt');
  version = 3;
  await mark(); await comeBack();
  await page.waitForFunction(() => window.CFB.update.waiting(), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  check(await marked() && await page.evaluate(() => window.CFB.update.waiting()), 'a new version during a Sanctuary round: downloaded, but the round is left alone');
  await page.locator('#practice-box .quiz-opt').first().click();
  await page.waitForTimeout(300);
  check(await marked(), 'answering a question does not trigger the reload');
  await page.evaluate(() => { location.hash = '#home'; });
  check(await reloaded(), 'back on Home: the page reloads on its own');
  await page.clock.fastForward(31e3);

  // Mid profile quiz, the Scan screen and a field being typed in: each waits.
  for (const [what, enter, leave] of [
    ['the profile quiz', async () => { await page.evaluate(() => { localStorage.removeItem('cfb-profile'); location.hash = '#profile'; }); await page.waitForSelector('#pf-start'); await page.click('#pf-start'); await page.waitForSelector('.quiz-opt'); }, null],
    ['the Scan screen', async () => { await page.evaluate(() => { location.hash = '#scan'; }); await page.waitForSelector('[data-screen=scan]:not([hidden])'); }, null],
    ['typing in the Brands search', async () => { await page.evaluate(() => { location.hash = '#brands'; }); await page.waitForSelector('[data-screen=brands]:not([hidden]) input'); await page.locator('[data-screen=brands]:not([hidden]) input').first().fill('mil'); }, async () => { await page.evaluate(() => document.activeElement && document.activeElement.blur()).catch(() => {}); }]
  ]) {
    await page.waitForFunction(() => !!window.CFB && !!window.CFB.update);
    await enter();
    version++;
    await mark(); await comeBack();
    await page.waitForFunction(() => window.CFB.update.waiting(), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    check(await marked() && await page.evaluate(() => window.CFB.update.waiting()), `a new version during ${what}: it waits`);
    if (what === 'the profile quiz') {
      // a quiz left half-done for another screen is still a quiz: no reload there either
      await page.evaluate(() => { location.hash = '#learn'; });
      await page.waitForTimeout(500);
      check(await marked(), 'the quiz left half-done for Learn: still waits, the answers are safe');
      await page.evaluate(() => { location.hash = '#profile'; });
      for (let i = 0; i < 8; i++) { await page.waitForSelector('.quiz-opt'); const q = await page.textContent('.quiz-q'); await page.locator('.quiz-opt').first().click(); await page.waitForFunction((q) => !document.querySelector('.quiz-q') || document.querySelector('.quiz-q').textContent !== q, q); }
      await page.waitForSelector('#pf-h');
      check(await marked() && await page.evaluate(() => !!localStorage.getItem('cfb-profile')), 'the quiz finished: the profile is saved and on view, not reloaded under the reader');
      await page.evaluate(() => { location.hash = '#home'; });
    } else if (leave) await leave(); else await page.evaluate(() => { location.hash = '#home'; });
    check(await reloaded(), `after ${what}: the page reloads on its own`);
    await page.clock.fastForward(31e3);
  }
  // No loop: within 30 s of a reload, another new version waits for the next chance.
  await page.waitForFunction(() => !!window.CFB && !!window.CFB.update);
  version++; await mark(); await comeBack();
  check(await reloaded(20000), 'another new version: reloads');
  await page.waitForFunction(() => !!window.CFB && !!window.CFB.update);
  await page.evaluate(() => sessionStorage.setItem('cfb-renewed', String(Date.now() + 61e3)));   // as if that reload were a moment before coming back
  version++; await mark(); await comeBack();
  await page.waitForFunction(() => window.CFB.update.waiting(), null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => { location.hash = '#learn'; });
  await page.waitForTimeout(500);
  check(await marked(), 'a further one within 30 s of a reload: held back (no loop of reloads)');
  await page.clock.fastForward(31e3);
  await page.evaluate(() => { location.hash = '#brands'; });
  check(await reloaded(), 'and taken at the next change of screen');

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
