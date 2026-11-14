// Checks the music (music.js) in a real browser: nothing before a tap, playing after one, the button,
// the saved choice, silence during the opening and in the background, data saver, the loop's join in the
// decoded file, offline after one play, and the button's place at 320, 390 and 1440 px.
//   node tools/test-music.cjs               (serves the repo's parent folder on port 8779)
//   node tools/test-music.cjs --shots DIR   also saves screenshots into DIR
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8779/${path.basename(path.resolve(__dirname, '..'))}/`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(8779, r));
  const browser = await chromium.launch();
  const errors = [];

  async function phone({ url = '?intro=0', width = 390, height = 844, keys = {}, saver = false, worker = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: shots ? 2 : 1, serviceWorkers: worker ? 'allow' : 'block' });
    const page = await ctx.newPage();
    const asked = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (r.url().includes('assets/sounds/')) asked.push(r.url()); });
    await page.addInitScript(([k, s]) => {
      if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); for (const [a, b] of Object.entries(k)) localStorage.setItem('cfb-' + a, b); }
      if (s) Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    }, [keys, saver]);
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    return { ctx, page, asked };
  }
  const state = (page) => page.evaluate(() => window.CFB.music.state());
  const playing = async (page) => { await page.waitForFunction(() => window.CFB.music.state().playing, null, { timeout: 8000 }).catch(() => {}); return (await state(page)).playing; };
  const btn = '.tabbar [data-music]';

  // 1. Nothing before a tap; playing after one; the button turns it off and the choice is kept.
  {
    const { ctx, page, asked } = await phone();
    await wait(1800);
    let s = await state(page);
    check(s.context === 'none' && !s.playing, `before any tap: no sound output made (${s.context})`);
    check(await page.isVisible(btn) && await page.getAttribute(btn, 'aria-pressed') === 'true', 'the music button is in the tab bar and shows on');
    check(asked.length === 1, `the file is fetched ahead of the first touch, once (${asked.length})`);
    await page.click('.qt-tile[href="#learn"]');
    check(await playing(page), 'after the first tap anywhere: playing');
    await wait(2000);
    s = await state(page);
    check(s.context === 'running' && s.level > 0.6, `it has faded in (level ${s.level.toFixed(2)})`);
    await page.click('.tabbar .tab[data-tab="brands"]'); await page.click('.tabbar .tab[data-tab="home"]');
    check((await state(page)).playing && asked.length === 1, 'it keeps playing across screens, without asking for the file again');
    if (shots) await page.screenshot({ path: path.join(shots, 'music-on-390.png') });

    // in the background: silent; back in view: playing again
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await wait(700);
    s = await state(page);
    check(!s.playing && s.context === 'suspended', `app in the background: stopped (${s.context})`);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    check(await playing(page), 'back in view: playing again');

    await page.click(btn); await page.click(btn); await page.click(btn);   // off, on, off in a hurry
    await wait(600);
    s = await state(page);
    check(!s.playing && await page.getAttribute(btn, 'aria-pressed') === 'false', 'the button turns it off (three quick taps end on off)');
    check(await page.evaluate(() => localStorage.getItem('cfb-music')) === 'off', 'off is saved on the phone');
    if (shots) await page.screenshot({ path: path.join(shots, 'music-off-390.png') });
    await page.click('.tabbar .tab[data-tab="learn"]'); await wait(400);
    check(!(await state(page)).playing, 'off stays off through other taps');

    asked.length = 0;
    await page.reload({ waitUntil: 'networkidle' }); await wait(1500);
    await page.click('.tabbar .tab[data-tab="brands"]'); await wait(500);
    s = await state(page);
    check(!s.playing && s.context === 'none' && asked.length === 0 && await page.getAttribute(btn, 'aria-pressed') === 'false', 'after a reload: still off, nothing downloaded, no sound output made');
    await page.click(btn);
    check(await playing(page) && await page.evaluate(() => localStorage.getItem('cfb-music')) === 'on', 'the button turns it back on, and that is saved');
    await ctx.close();
  }

  // 2. The join: in the decoded file, what plays up to the loop's end runs straight into its start.
  {
    const { ctx, page } = await phone();
    const j = await page.evaluate(async () => {
      const { FILE, LOOP, PAD } = window.CFB.music;
      const bytes = await (await fetch(FILE)).arrayBuffer();
      const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(bytes);
      const d = buf.getChannelData(0), sr = buf.sampleRate;
      const a = Math.round(PAD / 2 * sr), b = Math.round((PAD / 2 + LOOP) * sr), n = Math.round(0.2 * sr);
      // the 0.2 s before the loop's start against the 0.2 s before its end, and the same after: one piece of music if these match
      const corr = (p, q) => { let x = 0, pp = 0, qq = 0; for (let i = 0; i < n; i++) { x += d[p + i] * d[q + i]; pp += d[p + i] ** 2; qq += d[q + i] ** 2; } return x / Math.sqrt(pp * qq); };
      let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      let step = 0; for (let i = -64; i < 64; i++) step = Math.max(step, Math.abs(d[b + i] - d[b + i - 1]));
      return { seconds: buf.duration, before: corr(a - n, b - n), after: corr(a, b), jump: Math.abs(d[b - 1] - d[a - 1]), step, peak, LOOP, PAD };
    });
    check(Math.abs(j.seconds - (j.LOOP + 2 * j.PAD)) < 0.08, `the file is the loop plus its two pads (${j.seconds.toFixed(3)} s for a loop of ${j.LOOP} s)`);
    check(j.before > 0.97 && j.after > 0.97, `the music either side of the loop's end is the music either side of its start (match ${j.before.toFixed(3)} and ${j.after.toFixed(3)})`);
    check(j.jump < 0.02, `no click at the join (the wave moves ${j.jump.toFixed(4)} there; its peak is ${j.peak.toFixed(2)})`);
    check(j.peak < 0.95, `the track never clips (peak ${j.peak.toFixed(2)})`);
    await ctx.close();
  }

  // 3. The opening: silent while it plays, music once Home is on view. "Enter quietly" on a first visit turns it off.
  {
    const { ctx, page } = await phone({ url: '?intro=1' });
    await page.click('.in-gate [data-sound=on]');
    await wait(1500);
    check(!(await state(page)).playing, 'no app music while the opening plays');
    await page.click('.in-skip').catch(() => {});
    await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), null, { timeout: 30000 });
    check(await playing(page), 'once the opening has ended: playing, with no further tap');
    await ctx.close();
  }
  {
    const { ctx, page } = await phone({ url: '?intro=1' });
    await page.click('.in-gate [data-sound=off]');
    await page.click('.in-skip').catch(() => {});
    await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), null, { timeout: 30000 });
    await page.click('.tabbar .tab[data-tab="learn"]'); await wait(600);
    check(!(await state(page)).playing && await page.evaluate(() => localStorage.getItem('cfb-music')) === 'off' && await page.getAttribute(btn, 'aria-pressed') === 'false', '"Enter quietly" on the first visit: music off, saved, and the button shows off');
    await ctx.close();
  }
  {
    const { ctx, page } = await phone({ url: '?intro=1', keys: { 'intro-seen': '1' } });   // a replay: the gate's choice is about the film only
    await page.click('.in-gate [data-sound=off]');
    await page.click('.in-skip').catch(() => {});
    await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), null, { timeout: 30000 });
    await page.click('.tabbar .tab[data-tab="learn"]');
    check(await playing(page), 'a quiet replay of the opening leaves the music choice alone');
    await ctx.close();
  }

  // 4. Data saver: no download and no music unless she turns it on herself.
  {
    const { ctx, page, asked } = await phone({ saver: true });
    await wait(1500);
    await page.click('.tabbar .tab[data-tab="brands"]'); await wait(600);
    check(asked.length === 0 && !(await state(page)).playing && await page.getAttribute(btn, 'aria-pressed') === 'false', 'data saver: nothing downloaded, nothing played, and the button shows off');
    await page.click(btn);
    check(await playing(page) && asked.length === 1 && await page.getAttribute(btn, 'aria-pressed') === 'true', 'data saver: one tap on the button and it plays');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.tabbar .tab[data-tab="learn"]');
    check(await playing(page), 'data saver: her choice is remembered after a reload');
    await ctx.close();
  }

  // 5. Offline after one visit, the very first (the real worker keeps the file, though it was not in charge when the page fetched it).
  {
    const { ctx, page } = await phone({ worker: true });
    await page.click('.tabbar .tab[data-tab="learn"]');
    check(await playing(page), 'first visit, with the offline worker: playing');
    await page.waitForFunction(async () => { for (const k of await caches.keys()) if (k.includes('media') && (await (await caches.open(k)).keys()).length) return true; return false; }, null, { timeout: 20000 }).catch(() => {});
    const kept = await page.evaluate(async () => { for (const k of await caches.keys()) if (k.includes('media')) return (await (await caches.open(k)).keys()).map((r) => r.url); return []; });
    check(kept.some((u) => u.endsWith('assets/sounds/music.mp3')), 'the worker kept the music file');
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.click('.tabbar .tab[data-tab="brands"]');
    check(await playing(page), 'offline, after a reload: playing');
    await ctx.close();
  }

  // 6. The button's place.
  for (const [width, height] of [[320, 568], [390, 844], [1440, 900]]) {
    const { ctx, page } = await phone({ width, height });
    const sel = width >= 900 ? '.rail [data-music]' : btn;
    const box = await page.locator(sel).boundingBox();
    const bar = await page.locator(width >= 900 ? '.rail' : '.tabbar').boundingBox();
    check(!!box && box.width >= 44 && box.height >= 44, `${width} px: the button is at least 44 px (${box && Math.round(box.width)} x ${box && Math.round(box.height)})`);
    check(bar.x >= 0 && bar.x + bar.width <= width && box.x >= bar.x && box.x + box.width <= bar.x + bar.width + 0.5, `${width} px: it sits inside the ${width >= 900 ? 'side rail' : 'tab bar'}, which fits the screen (${Math.round(bar.x)} to ${Math.round(bar.x + bar.width)})`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width} px: no sideways scroll`);
    check((await page.locator('[data-music]:visible').count()) === 1, `${width} px: one music button on view`);
    const name = await page.locator(sel).evaluate((b) => b.getAttribute('aria-label') || b.textContent.trim());
    check(/Music/.test(name), `${width} px: it is named for screen readers ("${name}")`);
    if (shots) await page.screenshot({ path: path.join(shots, `music-${width}.png`) });
    await ctx.close();
  }

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
