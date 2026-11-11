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

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
