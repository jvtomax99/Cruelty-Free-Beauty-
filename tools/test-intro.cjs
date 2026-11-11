// Checks the launch show in a real browser (its "Done when" line in SPEC.md).
//   node tools/test-intro.cjs           (serves the repo's parent folder on port 8767)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8767/${path.basename(path.resolve(__dirname, '..'))}/`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8767, r));
  const browser = await chromium.launch();
  const errors = [];
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    return [ctx, page];
  };
  const showing = (p) => p.evaluate(() => document.documentElement.classList.contains('intro-on'));
  const gone = (p, ms) => p.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), null, { timeout: ms }).then(() => true, () => false);

  for (const [width, height, btn] of [[390, 844, 'on'], [1440, 900, 'off']]) {
    const [ctx, page] = await open({ viewport: { width, height } });
    await page.goto(BASE, { waitUntil: 'load' });
    check(await showing(page) && await page.isVisible(`[data-sound=${btn}]`), `${width} px: the gate shows on launch`);
    const t0 = Date.now();
    await page.click(`[data-sound=${btn}]`);
    check(await gone(page, 7000), `${width} px: "${btn === 'on' ? 'Enter with sound' : 'Enter quietly'}" plays the show and lands on Home in under 7 s (${Date.now() - t0} ms)`);
    const r = await page.evaluate(() => ({ inert: document.querySelector('.app').inert, hit: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.app') }));
    check(!r.inert && r.hit, `${width} px: Home takes taps afterwards`);
    await ctx.close();
  }

  const [ctx, page] = await open();
  await page.goto(BASE);
  await page.click('[data-sound=off]');
  await page.waitForTimeout(1800);
  const hit = await page.evaluate(() => { const r = document.querySelector('.in-skip').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).className; });
  check(hit === 'in-skip', 'Skip is the element that gets the tap');
  await page.click('.in-skip');
  check(await gone(page, 1500), 'Skip mid-show reaches Home in under 1.5 s');

  await page.goto(BASE + '?intro=0');
  check(!await showing(page), '?intro=0 skips the show');
  await page.goto(BASE + '#brand/tarte'); await page.reload();
  check(!await showing(page), 'a link to one brand skips the show');
  await page.goto(BASE + '?intro=0#profile');
  await page.click('#intro-switch');
  await page.goto(BASE + '#home'); await page.reload();
  check(!await showing(page), 'Profile switch off: no show at launch');
  await page.goto(BASE + '?intro=1');
  check(await showing(page), '?intro=1 forces it even when switched off');
  await page.evaluate(() => localStorage.removeItem('cfb-intro'));
  await page.goto(BASE + '?intro=0#profile');
  await page.click('#intro-replay');
  check(await showing(page), 'Replay the opening shows the gate again');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape');
  check(await gone(page, 2000), 'Esc on the gate, then Esc again, reaches the app');
  await ctx.close();

  const [ctx2, page2] = await open({ reducedMotion: 'reduce' });
  await page2.goto(BASE);
  await page2.click('[data-sound=on]');
  check(await gone(page2, 3000), 'reduced motion: a still pose, then Home in under 3 s');
  await ctx2.close();

  // a slow first visit: the logo takes 15 s to arrive
  const [ctx3, page3] = await open();
  await page3.addInitScript(() => { const A = window.AudioContext; window.__ctxs = 0; window.AudioContext = function () { window.__ctxs++; return new A(); }; });
  await page3.route('**/assets/logo.svg', (r) => setTimeout(() => r.continue().catch(() => {}), 15000));
  await page3.goto(BASE);
  await page3.click('[data-sound=off]');
  await page3.mouse.click(195, 200); await page3.keyboard.press('Escape');
  check(await gone(page3, 2500), 'slow logo: the app opens anyway, and taps meanwhile skip');
  check(await page3.evaluate(() => window.__ctxs) === 0, '"Enter quietly" stays quiet even after more taps');
  await ctx3.close();

  // focus: Skip during the show, the heading after it, the Replay button after a replay
  const [ctx4, page4] = await open();
  await page4.goto(BASE);
  await page4.click('[data-sound=on]'); await page4.waitForTimeout(400);
  check(await page4.evaluate(() => document.activeElement.className) === 'in-skip', 'focus moves to Skip when the show starts');
  await page4.keyboard.press('Enter');
  await gone(page4, 2000);
  check(await page4.evaluate(() => document.activeElement.id) === 'hello-line', 'after the show, focus is on the screen heading');
  await ctx4.close();

  // reduced motion: Skip, then Replay at once: the old fade timers must not close the replay
  const [ctx5, page5] = await open({ reducedMotion: 'reduce' });
  await page5.goto(BASE + '#profile');
  await page5.click('[data-sound=off]'); await page5.waitForTimeout(300);
  await page5.click('.in-skip'); await gone(page5, 1000);
  await page5.click('#intro-replay'); await page5.waitForTimeout(2600);
  check(await showing(page5) && await page5.evaluate(() => getComputedStyle(document.getElementById('intro')).opacity) === '1', 'reduced motion: Skip then Replay keeps the replayed gate up');
  await page5.click('[data-sound=off]'); await gone(page5, 3000);
  check(await page5.evaluate(() => document.activeElement.id) === 'intro-replay', 'after a replay, focus returns to Replay');
  await ctx5.close();

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
