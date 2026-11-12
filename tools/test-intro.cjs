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
  const open = async ({ film = false, ...opts } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', ...opts });   // no offline worker: it would fetch past the block below
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    // the checks below are for the drawn show, which is what plays when the film can't: so the film is blocked
    if (!film) await page.route('**/assets/video/**', (r) => r.abort());
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

  await page.evaluate(() => localStorage.clear());        // as on a first visit, so the next two checks test their own rule
  await page.goto(BASE + '?intro=0');
  check(!await showing(page), '?intro=0 skips the show');
  await page.goto(BASE + '#brand/tarte'); await page.reload();
  check(!await showing(page), 'a link to one brand skips the show');
  await page.goto(BASE); await page.click('[data-sound=off]'); await page.waitForTimeout(500); await page.click('.in-skip'); await gone(page, 1500);
  await page.goto(BASE + '#home'); await page.reload();
  check(!await showing(page) && await page.evaluate(() => localStorage.getItem('cfb-intro-seen')) === '1', 'after the first visit the opening does not play again at launch');
  await page.goto(BASE + '?intro=1');
  check(await showing(page), '?intro=1 forces it on a later visit');
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
  const openFilm = (opts = {}) => open({ film: true, serviceWorkers: 'allow', ...opts });
  const film = (p) => p.evaluate(() => window.CFBIntro.film());
  const filmReady = (p) => p.waitForFunction(() => window.CFBIntro && window.CFBIntro.film().ready, null, { timeout: 15000 }).then(() => true, () => false);
  const countCtx = (p) => p.addInitScript(() => { const A = window.AudioContext; window.__ctxs = 0; window.AudioContext = function () { window.__ctxs++; return new A(); }; });

  // a first visit: the whole film with sound, its words on their beats, then Home
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
  const at = async (t) => { await fp.evaluate((x) => { document.querySelector('.in-film').currentTime = x; }, t); await fp.waitForFunction((x) => { const v = document.querySelector('.in-film'); return !v.seeking && v.currentTime >= x; }, t); await fp.waitForTimeout(450); };
  const vis = (q) => fp.evaluate((x) => { const n = document.querySelector(x), c = getComputedStyle(n); return c.visibility === 'visible' && +c.opacity > 0.9 ? n.innerText.replace(/\s+/g, ' ').trim() : ''; }, q);
  check(await vis('.in-ask') === '' && await vis('.in-phone') === '' && await vis('.in-go') === '', 'film: no words, phone or button on the first shot');
  await at(2.2);
  check(await vis('.in-ask') === 'Was this tested on animals?', 'film: the question is on screen as real text while she reads the lipstick');
  await at(4.4);
  let cardText = await vis('.in-phone');
  check(/Example/i.test(cardText) && /Doesn't pass/.test(cardText) && /Brand Certified cruelty-free/i.test(cardText) && /Parent company Tests on animals/i.test(cardText) && /See why/.test(cardText) && await vis('.in-ask') === '', `film: the phone shows the example card with brand and parent company apart, and "See why" (${cardText.slice(0, 90)})`);
  const c1 = await fp.evaluate(() => { const r = document.querySelector('.in-c1').getBoundingClientRect(), s = document.querySelector('.in-screen').getBoundingClientRect(), t = document.querySelector('.in-c1 dd').getBoundingClientRect(); return { inside: r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom, type: t.height }; });
  check(c1.inside && c1.type >= 16, `film: the card sits inside the phone and its status lines are at least 16 px tall (${Math.round(c1.type)} px)`);
  await at(6.8);
  const c2 = await fp.evaluate(() => { const r = document.querySelector('.in-c2').getBoundingClientRect(), o = document.querySelector('.in-c1').getBoundingClientRect(), s = document.querySelector('.in-screen').getBoundingClientRect(); return { in: r.left >= s.left && r.right <= s.right, out: o.right <= s.left + 1, text: document.querySelector('.in-c2').innerText.replace(/\s+/g, ' '), picked: document.querySelector('.in-c2').classList.contains('is-picked') }; });
  check(c2.in && c2.out && /Try instead/i.test(c2.text) && /Passes/.test(c2.text) && !c2.picked, 'film: the alternative that passes has slid in, not yet chosen');
  await at(7.6);
  check(await fp.evaluate(() => document.querySelector('.in-c2').classList.contains('is-picked')), 'film: her tap visibly selects the alternative');
  await at(9.7);
  check(await vis('.in-kind') === "Beauty that's kind to them." && await vis('.in-phone') === '', 'film: the garden line is up and the phone is gone');
  await at(12.4);
  check(await vis('.in-line') === 'Cruelty-free looks beautiful on you' && await vis('.in-go') === 'Find cruelty-free makeup' && await vis('.in-kind') === '', 'film: the closing line and the "Find cruelty-free makeup" button are up');
  const lay = await fp.evaluate(() => { const b = document.querySelector('.in-go').getBoundingClientRect(), l = document.querySelector('.in-line').getBoundingClientRect(), k = document.querySelector('.in-skip').getBoundingClientRect(); return { btnH: b.height, btnIn: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, lineAbove: l.bottom < b.top, skipClear: k.bottom < b.top, skipOn: getComputedStyle(document.querySelector('.in-skip')).opacity === '1' }; });
  check(lay.btnH >= 44 && lay.btnIn && lay.lineAbove && lay.skipClear && lay.skipOn, `film: the button is a full tap target on screen, the line is above it, Skip is still there (${JSON.stringify(lay)})`);
  // the film ends: its last frame holds with the button, then Home opens by itself
  await fp.waitForFunction(() => window.CFBIntro.film().ended, null, { timeout: 5000 }).catch(() => {});
  const hold = await fp.evaluate(() => ({ showing: document.documentElement.classList.contains('intro-on'), film: +getComputedStyle(document.querySelector('.in-film')).opacity, tab: document.querySelector('.in-go').tabIndex }));
  check(hold.showing && hold.film === 1 && hold.tab === 0 && await vis('.in-go') !== '', 'film: at its end the last frame is held with the button, which the keyboard can now reach');
  check(await gone(fp, 8000), `film: the whole film plays and lands on Home (${((Date.now() - f0) / 1000).toFixed(1)} s)`);
  const fr = await fp.evaluate(() => ({ inert: document.querySelector('.app').inert, hit: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.app'), focus: document.activeElement.id }));
  check(!fr.inert && fr.hit && fr.focus === 'hello-line', 'film: Home takes taps afterwards and focus is on its heading');
  // a later open goes straight to Home; forced with ?intro=1 it plays again, and quiet stays quiet
  await fp.reload();
  check(!await showing(fp), 'film, next open: straight to Home, the opening is for the first visit');
  await fp.goto(BASE + '?intro=1');
  check(await filmReady(fp), 'film, forced with ?intro=1: ready again');
  await fp.click('[data-sound=off]'); await fp.waitForTimeout(900);
  f = await film(fp);
  check(f.on && f.muted && f.time < 3, `film, forced again: plays from the start (${f.time.toFixed(1)} s), muted for "Enter quietly"`);
  await fp.evaluate(() => { document.querySelector('.in-film').currentTime = 9; }); await fp.waitForTimeout(400);   // well into the film, so the Replay check below means something
  await fp.click('.in-skip'); await gone(fp, 1500);
  check(await fp.evaluate(() => window.__ctxs) === 0, 'film: "Enter quietly" makes no sound object');
  // Replay plays the whole film; Skip leaves it at once
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

  // the button at the end opens Home at once
  const [bc, bp] = await openFilm();
  await bp.goto(BASE); await filmReady(bp);
  await bp.click('[data-sound=off]'); await bp.waitForTimeout(600);
  await bp.evaluate(() => { document.querySelector('.in-film').currentTime = 12.2; }); await bp.waitForTimeout(700);
  await bp.click('.in-go');
  check(await gone(bp, 1000), 'film: "Find cruelty-free makeup" opens Home in under 1 s');
  check(await bp.evaluate(() => ({ hit: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.app'), slogan: document.getElementById('hello-line').innerText.replace(/\s+/g, ' ').trim() })).then((r) => r.hit && r.slogan === 'Cruelty-free looks beautiful on you.'), 'Home takes taps and carries the same line: "Cruelty-free looks beautiful on you."');
  await bc.close();

  // Skip during the held ending
  const [hc, hp] = await openFilm();
  await hp.goto(BASE); await filmReady(hp);
  await hp.click('[data-sound=off]'); await hp.waitForTimeout(600);
  await hp.evaluate(() => { document.querySelector('.in-film').currentTime = 13.4; });
  await hp.waitForFunction(() => window.CFBIntro.film().ended, null, { timeout: 5000 }).catch(() => {});
  await hp.click('.in-skip');
  check(await gone(hp, 1000), 'film: Skip during the held ending reaches Home in under 1 s');
  await hc.close();

  // the film gets stuck part-way (a dead connection): the app must still open
  const [sc, sp] = await openFilm();
  await sp.goto(BASE); await filmReady(sp);
  await sp.click('[data-sound=off]'); await sp.waitForTimeout(800);
  await sp.evaluate(() => document.querySelector('.in-film').pause());
  check(await gone(sp, 3500), 'film: stuck for 1.5 s mid-play, the app opens anyway');
  await sc.close();

  // the film is still downloading at the tap: the drawn show plays instead
  const [dc, dp] = await openFilm({ serviceWorkers: 'block' });
  await dp.route('**/assets/video/**', (r) => setTimeout(() => r.continue().catch(() => {}), 15000));
  await dp.goto(BASE);
  await dp.click('[data-sound=off]'); await dp.waitForTimeout(600);
  check(!(await film(dp)).on, 'film not loaded at the tap: the drawn show plays');
  check(await gone(dp, 8000), 'film not loaded at the tap: Home in under 8 s');
  check(await dp.evaluate(() => localStorage.getItem('cfb-intro-seen')) === null, 'film not loaded at the tap: the next visit may try the film again');
  await dc.close();

  // like an iPhone: nothing of the film loads until the tap; it must still start, a moment later
  const [ic, ip] = await openFilm({ serviceWorkers: 'block' });
  let tapped = false; const held = [];
  await ip.route('**/assets/video/**', (r) => { if (tapped) r.continue().catch(() => {}); else held.push(r); });
  await ip.goto(BASE); await ip.waitForTimeout(600);
  check(!(await film(ip)).ready, 'film held back until the tap (as on an iPhone): not ready at the gate');
  await ip.click('[data-sound=on]'); tapped = true; held.forEach((r) => r.continue().catch(() => {}));
  await ip.waitForTimeout(1500);
  f = await film(ip);
  check(f.on && !f.muted && f.time > 0.2, `film held back until the tap: it still starts, with sound (at ${f.time.toFixed(1)} s)`);
  // a double tap on the gate must not skip the film
  await ip.goto(BASE + '?intro=1'); await filmReady(ip);
  await ip.dblclick('[data-sound=off]', { delay: 30 }); await ip.mouse.click(195, 300); await ip.waitForTimeout(100);
  await ip.waitForTimeout(1200);
  f = await film(ip);
  check(f.on && await showing(ip), 'film: a double tap on the gate does not skip it');
  await ic.close();

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
  let saved = false;
  for (let i = 0; i < 30 && !saved; i++) {
    saved = await wp.evaluate(async () => (await (await caches.open('cfb-media-v3')).keys()).length > 0 && !!navigator.serviceWorker.controller);
    if (!saved) await wp.waitForTimeout(500);
  }
  check(saved, 'offline worker: the film is saved after the first play');
  await wc.setOffline(true);
  const piece = await wp.evaluate(async () => { const r = await fetch('assets/video/launch.mp4', { headers: { Range: 'bytes=100-299' } }); return { status: r.status, len: (await r.arrayBuffer()).byteLength, range: r.headers.get('Content-Range') }; }).catch((e) => ({ status: 0, len: 0, range: String(e) }));
  check(piece.status === 206 && piece.len === 200 && /^bytes 100-299\//.test(piece.range || ''), `offline worker: serves a piece of the film with no network (${piece.status}, ${piece.len} bytes${piece.status ? '' : ', ' + piece.range})`);
  await wc.close();

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
