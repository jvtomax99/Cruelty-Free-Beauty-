// Checks the launch show in a real browser (its "Done when" line in SPEC.md).
//   node tools/test-intro.cjs           (serves the repo's parent folder on port 8767)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8767/${path.basename(path.resolve(__dirname, '..'))}/`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const type = TYPES[path.extname(p)] || 'application/octet-stream';
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');      // video needs pieces, like a real host gives
    if (!m) { res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': d.length }); return res.end(d); }
    const from = +m[1], to = m[2] ? Math.min(+m[2], d.length - 1) : d.length - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${from}-${to}/${d.length}`, 'Content-Length': to - from + 1 });
    res.end(d.subarray(from, to + 1));
  });
});

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8767, r));
  const browser = await chromium.launch();
  const errors = [];
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...opts });   // no offline worker: it would fetch past the block below
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    // the checks below are for the drawn show, which is what plays when the film can't: so the film is blocked
    await page.route('**/assets/video/**', (r) => r.abort());
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

  /* ---------- the film (version 2) ---------- */
  const openFilm = async (opts = {}) => { const [c, p] = await open({ serviceWorkers: 'allow', ...opts }); await p.unroute('**/assets/video/**'); return [c, p]; };
  const film = (p) => p.evaluate(() => window.CFBIntro.film());
  const filmReady = (p) => p.waitForFunction(() => window.CFBIntro && window.CFBIntro.film().ready, null, { timeout: 15000 }).then(() => true, () => false);
  const countCtx = (p) => p.addInitScript(() => { const A = window.AudioContext; window.__ctxs = 0; window.AudioContext = function () { window.__ctxs++; return new A(); }; });

  // first open: the whole film with sound, then Home; the next open: only the ending, and quiet stays quiet
  const [fc, fp] = await openFilm();
  await countCtx(fp);
  await fp.goto(BASE);
  check(await filmReady(fp), 'film: ready to play while the gate is up');
  let f0 = Date.now();
  await fp.click('[data-sound=on]'); await fp.waitForTimeout(1200);
  let f = await film(fp);
  check(f.on && !f.muted && !f.paused && f.time > 0.5 && f.time < 3, `film: "Enter with sound" plays it from the start, with sound (at ${f.time.toFixed(1)} s)`);
  check(await fp.evaluate(() => getComputedStyle(document.querySelector('.in-film')).opacity) === '1', 'film: it is on screen');
  check(await fp.evaluate(() => document.activeElement.className) === 'in-skip', 'film: focus is on Skip');
  check(await gone(fp, 24000), `film: the whole film plays and lands on Home (${((Date.now() - f0) / 1000).toFixed(1)} s)`);
  const fr = await fp.evaluate(() => ({ inert: document.querySelector('.app').inert, hit: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.app'), seen: localStorage.getItem('cfb-intro-seen'), focus: document.activeElement.id }));
  check(!fr.inert && fr.hit && fr.focus === 'hello-line', 'film: Home takes taps afterwards and focus is on its heading');
  check(fr.seen === '1', 'film: the first full play is remembered');
  await fp.reload();
  check(await filmReady(fp), 'film, later open: ready at the ending');
  f0 = Date.now();
  await fp.click('[data-sound=off]'); await fp.waitForTimeout(600);
  f = await film(fp);
  check(f.on && f.muted && f.time >= 14, `film, later open: starts at the ending (${f.time.toFixed(1)} s), muted for "Enter quietly"`);
  check(await gone(fp, 9000), `film, later open: lands on Home (${((Date.now() - f0) / 1000).toFixed(1)} s)`);
  check(await fp.evaluate(() => window.__ctxs) === 0, 'film: "Enter quietly" makes no sound object');
  // Replay always plays the whole film; Skip leaves it at once
  await fp.goto(BASE + '?intro=0#profile');
  await fp.click('#intro-replay');
  await filmReady(fp);
  await fp.click('[data-sound=on]'); await fp.waitForTimeout(1500);
  f = await film(fp);
  check(f.on && f.time < 3, `film: Replay plays it from the start (${f.time.toFixed(1)} s)`);
  await fp.click('.in-skip');
  check(await gone(fp, 1500), 'film: Skip reaches Home in under 1.5 s');
  f = await film(fp);
  check(f.paused && f.muted && await fp.evaluate(() => document.activeElement.id) === 'intro-replay', 'film: after Skip it is stopped and silent, focus back on Replay');
  await fc.close();

  // the film gets stuck part-way (a dead connection): the app must still open
  const [sc, sp] = await openFilm();
  await sp.goto(BASE); await filmReady(sp);
  await sp.click('[data-sound=off]'); await sp.waitForTimeout(800);
  await sp.evaluate(() => { const v = document.querySelector('.in-film'); v.pause(); v.dispatchEvent(new Event('waiting')); });
  check(await gone(sp, 3500), 'film: stuck for 1.5 s mid-play, the app opens anyway');
  await sc.close();

  // the film is still downloading at the tap: the drawn show plays instead
  const [dc, dp] = await openFilm({ serviceWorkers: 'block' });
  await dp.route('**/assets/video/**', (r) => setTimeout(() => r.continue().catch(() => {}), 15000));
  await dp.goto(BASE);
  await dp.click('[data-sound=off]'); await dp.waitForTimeout(600);
  check(!(await film(dp)).on, 'film not loaded at the tap: the drawn show plays');
  check(await gone(dp, 7000), 'film not loaded at the tap: Home in under 7 s');
  await dc.close();

  // reduced motion and data saver never download the film
  for (const [name, opts, init] of [['reduced motion', { reducedMotion: 'reduce' }, null], ['data saver', {}, () => Object.defineProperty(navigator, 'connection', { value: { saveData: true } })]]) {
    const [rc, rp] = await openFilm(opts);
    if (init) await rp.addInitScript(init);
    let asked = 0; rp.on('request', (q) => { if (q.url().includes('/assets/video/')) asked++; });
    await rp.goto(BASE); await rp.waitForTimeout(800);
    await rp.click('[data-sound=off]');
    check(await gone(rp, 7000) && asked === 0, `${name}: the film is never downloaded, the drawn show lands on Home`);
    await rc.close();
  }

  // a computer screen: the film is a centred column, and it still lands
  const [wc, wp] = await openFilm({ viewport: { width: 1440, height: 900 } });
  await wp.goto(BASE); await filmReady(wp);
  await wp.click('[data-sound=off]'); await wp.waitForTimeout(700);
  const box = await wp.evaluate(() => { const r = document.querySelector('.in-film').getBoundingClientRect(); return { w: r.width, h: r.height, mid: r.left + r.width / 2 }; });
  check(Math.abs(box.mid - 720) < 2 && Math.abs(box.h - 900) < 2 && Math.abs(box.w - 900 * 9 / 16) < 3, `1440 px: the film is a centred column (${Math.round(box.w)} by ${Math.round(box.h)})`);
  await wp.click('.in-skip');
  check(await gone(wp, 1500), '1440 px: Skip lands on Home');
  // offline worker: once saved, the film is served in pieces (phones need that) and survives going offline
  const saved = await wp.waitForFunction(async () => { const c = await caches.open('cfb-media-v1'); return (await c.keys()).length > 0 && !!navigator.serviceWorker.controller; }, null, { timeout: 15000 }).then(() => true, () => false);
  check(saved, 'offline worker: the film is saved after the first play');
  await wc.setOffline(true);
  const piece = await wp.evaluate(async () => { const r = await fetch('assets/video/launch.mp4', { headers: { Range: 'bytes=100-299' } }); return { status: r.status, len: (await r.arrayBuffer()).byteLength, range: r.headers.get('Content-Range') }; }).catch((e) => ({ status: 0, len: 0, range: String(e) }));
  check(piece.status === 206 && piece.len === 200 && /^bytes 100-299\//.test(piece.range || ''), `offline worker: serves a piece of the film with no network (${piece.status}, ${piece.len} bytes)`);
  await wc.close();

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
