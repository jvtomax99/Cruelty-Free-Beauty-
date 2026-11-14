// Checks how Home's host moves (host-engine.js) in a real browser.
//   node tools/test-host-engine.cjs                (serves the repo's parent folder on port 8772)
//   node tools/test-host-engine.cjs --shots DIR    also saves a picture of every face frame into DIR
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOT = path.resolve(REPO, '..');
const APP = `http://localhost:8772/${path.basename(REPO)}/?intro=0`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
const PROFILE = { skin: 'dry', depth: 'fair', veins: 'cool', jewelry: 'cool', sun: 'cool', finish: 'matte', budget: 'any', vegan: 'no', undertone: 'cool' };
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const list = (src) => src.match(/FRAMES = \[([^\]]+)\]/)[1].match(/"(\w+)"/g).map((s) => s.slice(1, -1));

(async () => {
  await new Promise((r) => server.listen(8772, r));
  const browser = await chromium.launch();
  const errors = [];
  const asked = [];
  async function phone({ width = 390, height = 844, reduced = false, saver = false, clock = false, alive = false, at = null, keys = { profile: PROFILE } } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: false, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => asked.push(r.url()));
    if (clock) await page.clock.install(at ? { time: at } : undefined);
    await page.addInitScript(([k, saver, alive]) => {
      window.__hostProbe = [];
      if (!alive) {   // the older checks want her still between the things they ask of her: no idle acts, no hello, no breath
        window.__hostQuiet = true;
        document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.hb-host.is-live{animation:none!important}'; document.head.appendChild(s); });
      }
      if (saver) Object.defineProperty(navigator, 'connection', { value: { saveData: true } });
      if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); for (const [a, b] of Object.entries(k)) localStorage.setItem('cfb-' + a, JSON.stringify(b)); }
    }, [keys, saver, alive]);
    await page.goto(APP, { waitUntil: 'networkidle' });
    return { ctx, page };
  }
  const state = (page) => page.evaluate(() => window.CFB.hostFace.state());
  const live = (page) => page.waitForFunction(() => window.CFB.hostFace.state().live);
  const idle = (page) => page.waitForFunction(() => { const s = window.CFB.hostFace.state(); return !s.playing && s.shown === 'rest'; }, null, { timeout: 8000 });
  const frames = (page) => page.evaluate(() => window.__hostProbe.map((p) => p.name));
  const clear = (page) => page.evaluate(() => { window.__hostProbe.length = 0; });

  // 1. The art and the code agree.
  const FRAMES = list(read('host-engine.js'));
  {
    check(JSON.stringify(FRAMES) === JSON.stringify(list(read('tools/make-host.py'))), `host-engine.js and make-host.py list the same ${FRAMES.length} frames`);
    const css = read('app.css');
    const n = +css.match(/--host-n: (\d+)/)[1];
    check(n === FRAMES.length, `app.css steps through ${n} frames`);
    const { ctx, page } = await phone();
    await live(page);
    const size = await page.evaluate(async () => {
      const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = u; });
      return { base: await load('assets/host/base.webp'), face: await load('assets/host/face.webp') };
    });
    const win = css.match(/left: calc\((\d+) \/ (\d+) \* 100%\); top: calc\((\d+) \/ (\d+) \* 100%\); width: calc\((\d+) \/ \d+ \* 100%\); height: calc\((\d+) \/ \d+ \* 100%\)/).slice(1).map(Number);
    check(size.base[0] === win[1] && size.base[1] === win[3], `the base is ${size.base.join(' x ')}, as app.css says`);
    check(size.face[0] === win[4] * FRAMES.length && size.face[1] === win[5], `the strip is ${FRAMES.length} frames of ${win[4]} x ${win[5]}`);
    const kb = (f) => fs.statSync(path.join(REPO, f)).size / 1024;
    const total = kb('assets/host/base.webp') + kb('assets/host/face.webp');
    check(total < 412, `her pictures are ${Math.round(total)} KB together (the old loop was 412 KB)`);

    // 2. Nothing but her face changes between frames: every frame against rest, outside the window.
    const box = await page.$eval('.hb-host', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const fr = await page.$eval('.hb-face', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.evaluate(() => window.CFB.hostFace.seed(1));
    const snap = async (name) => {
      await page.evaluate((name) => { const F = window.CFB.hostFace.FRAMES; document.querySelector('.hb-face').style.backgroundPositionX = (F.indexOf(name) / (F.length - 1) * 100) + '%'; }, name);
      const buf = await page.screenshot({ clip: box });
      if (shots) fs.writeFileSync(path.join(shots, `face-${name}.png`), buf);
      return buf;
    };
    const restShot = await snap('rest');
    // the rest frame over the base against the base alone: no seam where the window sits
    await page.evaluate(() => document.querySelector('.hb-host').classList.remove('is-live'));
    const bare = await page.screenshot({ clip: box });
    await page.evaluate(() => document.querySelector('.hb-host').classList.add('is-live'));
    const differ = async (a, b) => page.evaluate(async ([a, b, fx, fy, fw, fh]) => {
      const px = async (u) => { const i = new Image(); await new Promise((r) => { i.onload = r; i.src = u; }); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const A = await px(a), B = await px(b); let out = 0, inn = 0, rim = 0, worst = 0;
      for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
        const k = (y * A.width + x) * 4;
        const d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]);
        const edge = Math.min(Math.abs(x - fx), Math.abs(x - (fx + fw - 1)), Math.abs(y - fy), Math.abs(y - (fy + fh - 1))) <= 2 && x >= fx - 2 && x <= fx + fw + 1 && y >= fy - 2 && y <= fy + fh + 1;
        if (edge) { worst = Math.max(worst, d); if (d >= 24) rim++; }
        if (d < 24) continue;
        if (x >= fx - 1 && x <= fx + fw && y >= fy - 1 && y <= fy + fh) inn++; else out++;
      }
      return { out, inn, rim, worst };
    }, ['data:image/png;base64,' + a.toString('base64'), 'data:image/png;base64,' + b.toString('base64'), fr.x - box.x, fr.y - box.y, fr.w, fr.h]);
    const seam = await differ(bare, restShot);
    // (inside the window the two are the same face saved twice, so a few pixels differ by the saving alone)
    check(seam.rim === 0 && seam.out === 0, `no seam where her face window sits: along its edge the rest frame and the base alone differ by at most ${seam.worst} of 765`);
    let moved = [], same = [];
    for (const name of FRAMES.slice(1)) {
      const d = await differ(restShot, await snap(name));
      if (d.out) moved.push(`${name} (${d.out} px)`);
      if (!d.inn) same.push(name);
    }
    check(!moved.length, `hair, outline and shoulders are the same in all ${FRAMES.length} frames${moved.length ? ': moved in ' + moved.join(', ') : ''}`);
    check(!same.length, `every frame is its own face${same.length ? ': same as rest: ' + same.join(', ') : ''}`);
    await page.evaluate(() => window.CFB.hostFace.rest());

    // 3. Her eyes follow the pointer, then come back.
    const c = { x: box.x + box.width / 2, y: box.y + box.height * 0.36 };
    for (const [dx, dy, want] of [[-85, 0, 'lookL'], [200, 0, 'lookR'], [0, -220, 'lookU'], [0, 300, 'lookD'], [0, 0, 'rest']]) {
      await page.mouse.move(c.x + dx, c.y + dy);
      const s = await state(page);
      check(s.shown === want, `pointer ${dx || dy ? `at ${dx}, ${dy} from her face` : 'on her face'}: she shows ${s.shown}`);
    }
    await page.mouse.move(c.x + 200, c.y);
    await page.waitForFunction(() => window.CFB.hostFace.state().shown === 'rest', null, { timeout: 4000 });
    check(true, 'with the pointer still, she looks back at you');

    // 4. A tap on her plays a smile or a wink, turn about, and stays on Home; her bubble still links.
    const taps = [];
    for (let i = 0; i < 2; i++) {
      await clear(page);
      await page.mouse.click(c.x, c.y);
      taps.push((await state(page)).playing);
      await idle(page);
    }
    check(taps.sort().join() === 'smile,wink' && new URL(page.url()).hash === '', `two taps on her: ${taps.join(' and ')}, still on Home, back at rest`);

    await page.click('#host-say');
    await page.waitForFunction(() => location.hash !== '');
    check(true, `her bubble still links (${new URL(page.url()).hash})`);
    await page.goto(APP); await live(page);

    // 5. A reaction beats a gaze: the pointer moves while she laughs, and she finishes laughing first.
    await clear(page);
    await page.evaluate(() => window.CFB.hostFace.play('happy'));
    await page.mouse.move(c.x - 85, c.y);
    check((await state(page)).playing === 'happy', 'the pointer moving does not cut a reaction short');
    await page.waitForFunction(() => !window.CFB.hostFace.state().playing);
    check((await state(page)).shown === 'lookL', 'afterwards she looks where the pointer went');
    await page.mouse.move(c.x, c.y);

    // 6. Frames keep the sequence's own clock.
    await clear(page);
    await page.evaluate(() => window.CFB.hostFace.play('happy'));
    await idle(page);
    const late = await page.evaluate(() => Math.max(...window.__hostProbe.filter((p) => p.due !== null).map((p) => p.at - p.due)));
    check(late < 40, `no frame of a reaction was more than ${Math.round(late)} ms late`);

    // 7. A real scan: her face on Home afterwards, by the verdict's kind. She says nothing about it.
    const kinds = await page.evaluate(async () => { const all = await window.CFB.brands, out = {}; for (const b of all) { const k = window.CFB.verdict(b, window.CFB.mode()).kind; if (!out[k]) out[k] = b.name; } return out; });
    const OBF = { 1: kinds.pass, 2: kinds.fail, 3: 'Glowfield Labs', 4: kinds.none };
    await ctx.route('https://world.openbeautyfacts.org/**', (route) => {
      const code = +(route.request().url().match(/product\/(\d+)\.json/) || [])[1];
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 1, product: { product_name: 'Thing', brands: OBF[code] } }) });
    });
    for (const [code, want, peak] of [[1, 'happy', 'laugh'], [2, 'sad', 'sad'], [3, 'surprised', 'surprised'], [4, 'surprised', 'surprised']]) {
      await page.goto(APP + '#scan'); await live(page);
      await page.fill('#scan-code', '000000000000' + code);
      await page.click('#scan-code-form button');
      await page.waitForSelector('#scan-h');
      const w = (await state(page)).waiting;
      await clear(page);
      await page.evaluate(() => { location.hash = '#home'; });
      await page.waitForFunction((peak) => window.__hostProbe.some((p) => p.name === peak), peak, { timeout: 5000 }).catch(() => {});
      const saw = await frames(page);
      const words = await page.$eval('#host-say', (e) => e.textContent);
      check(w === want && saw.includes(peak), `a scan of ${OBF[code]} (${['', 'passes', "doesn't pass", 'not listed', 'on no list'][code]}): she waits with "${w}" and plays it on Home (${saw.join(' ')})`);
      check(!/cruelty|passes|doesn't pass|certified|tests on animals|approved|safe|not on/i.test(words), `her bubble words no verdict: "${words.replace(/\s+/g, ' ').trim()}"`);
      await idle(page);
    }

    // 8. A real Sanctuary answer: a smile for right, a worried look for a miss.
    const bank = JSON.parse(read('data/questions.json')).questions;
    for (const want of [true, false]) {
      let done = false;
      for (let tries = 0; tries < 6 && !done; tries++) {   // some questions are made from the brand data: those are answered blind
        await page.goto(APP + '#practice/all'); await live(page);
        await page.waitForSelector('#practice-box .quiz-opt');
        const texts = await page.locator('#practice-box .quiz-opt').allTextContents();
        const q = (await page.textContent('#practice-q')).trim();
        const item = bank.find((x) => x.q === q);
        const idx = item ? texts.findIndex((t) => t.trim() === item.options[0]) : 0;
        await page.locator('#practice-box .quiz-opt').nth(want ? Math.max(idx, 0) : (Math.max(idx, 0) + 1) % texts.length).click();
        await page.waitForSelector('#practice-next');
        const right = (await page.textContent('#practice-verdict')) === 'Right';
        const peak = right ? 'smile' : 'worried';
        const w = (await state(page)).waiting;
        await clear(page);
        await page.evaluate(() => { location.hash = '#home'; });
        await page.waitForFunction((peak) => window.__hostProbe.some((p) => p.name === peak), peak, { timeout: 5000 }).catch(() => {});
        const ok = w === peak && (await frames(page)).includes(peak);
        await idle(page);
        if (right === want || !ok) { check(ok && right === want, `a ${want ? 'right' : 'wrong'} Sanctuary answer: "${w}" plays when Home opens`); done = true; }
      }
      if (!done) check(false, `no ${want ? 'right' : 'wrong'} answer in 6 tries`);
    }
    check(await page.evaluate(() => Object.keys(localStorage).every((k) => !/host|face/.test(k))), 'she stores nothing on the phone');
    await ctx.close();
  }

  // 9. Blinks come at random, 2 to 6 s apart, never on a beat.
  {
    const { ctx, page } = await phone({ clock: true });
    await page.clock.runFor(500); await live(page);
    await page.evaluate(() => window.CFB.hostFace.seed(7));
    await clear(page);
    await page.clock.runFor(120000);
    const shut = await page.evaluate(() => window.__hostProbe.filter((p, i, a) => p.name === 'shut' && !(a[i - 2] && a[i - 2].name === 'rest' && a[i - 4] && a[i - 4].name === 'shut' && p.at - a[i - 4].at < 400)).map((p) => p.at));
    const gaps = shut.slice(1).map((t, i) => Math.round(t - shut[i]));
    const spread = Math.max(...gaps) - Math.min(...gaps);
    check(gaps.length >= 15 && Math.min(...gaps) >= 1900 && Math.max(...gaps) <= 6800, `${gaps.length + 1} blinks in 2 minutes, ${Math.min(...gaps)} to ${Math.max(...gaps)} ms apart`);
    check(spread > 1500 && new Set(gaps.map((g) => Math.round(g / 100))).size > 8, 'no two stretches alike: not on a beat');
    // off Home she does nothing
    await page.evaluate(() => { location.hash = '#brands'; });
    await page.clock.runFor(300); await clear(page);
    await page.clock.runFor(30000);
    check((await frames(page)).length === 0, 'on another screen she plays nothing');
    await ctx.close();
  }

  // 9b. Alive: she breathes, leans, says hello, has a small life of her own, looks at her bubble, beams at a heart.
  {
    const { ctx, page } = await phone({ clock: true, alive: true, at: new Date('2026-11-14T10:00:00') });
    await page.clock.runFor(600); await live(page);
    await page.clock.runFor(4500);
    const upTo = (list) => list.slice(0, list.lastIndexOf('smile') + 2);   // what she did, without the blinks after it
    const hello = upTo(await frames(page));
    const mouths = (list) => list.filter((n) => /^talk/.test(n));
    check(hello.join(' ').includes('half shut half rest smile') && mouths(hello).length === 0, `Home first shows her: a slow blink, then a smile, and she does not talk (${hello.join(' ')})`);
    check(await page.$eval('.hb-host', (e) => getComputedStyle(e).animationName) === 'hostBreathe', 'she breathes (a slow rise and fall of her whole picture)');
    const box = await page.$eval('.hb-host', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.36 }; });
    const lean = () => page.$eval('.hb-host', (e) => parseFloat(e.style.rotate) || 0);
    await page.mouse.move(box.x - 85, box.y); const l = await lean();
    await page.mouse.move(box.x + 250, box.y); const r = await lean();
    await page.mouse.move(box.x, box.y); const c = await lean();
    check(l < -0.3 && l >= -0.9 && r > 0.3 && r <= 0.9 && c === 0, `she leans towards the pointer (${l.toFixed(1)} and ${r.toFixed(1)} degrees) and straightens when it is on her`);
    await page.clock.runFor(2000);
    check(await lean() === 0, 'with the pointer still she straightens');
    // left alone for three minutes
    await page.evaluate(() => window.CFB.hostFace.seed(11)); await clear(page);
    await page.clock.runFor(300000);
    const acts = await page.evaluate(() => { const p = window.__hostProbe, out = []; p.forEach((f, i) => { const before = p[i - 1] ? p[i - 1].name : 'rest'; if (/^look|^smile$/.test(f.name) && before === 'rest') out.push(f.name); }); return out; });
    check(acts.length >= 5 && acts.length <= 17 && new Set(acts).size >= 3, `left alone 5 minutes (one every 18 to 40 s): ${acts.length} small things of ${new Set(acts).size} kinds (${[...new Set(acts)].join(', ')})`);
    const shut = await page.evaluate(() => window.__hostProbe.filter((p) => p.name === 'shut').map((p) => p.at));
    const gaps = shut.slice(1).map((t, i) => t - shut[i]).filter((g) => g > 400);
    check(gaps.length >= 40 && Math.max(...gaps) <= 8600, `she keeps blinking through it (${gaps.length + 1} blinks, never more than ${Math.round(Math.max(...gaps))} ms apart)`);
    // her bubble says something new: she looks at it, then smiles
    await idle(page); await clear(page);
    await page.evaluate(() => { localStorage.setItem('cfb-scans', JSON.stringify([{ code: '1', brand: 'milani', name: 'Milani', t: Date.now() }])); document.dispatchEvent(new CustomEvent('cfb:changes')); });
    await page.clock.runFor(3500);
    const said = upTo(await frames(page));
    const line = (await page.textContent('#host-say')).replace(/\s+/g, ' ').trim();
    const twice = said.some((n, i) => /^talk/.test(n) && n === said[i - 1]);
    check(/You scanned Milani/.test(line) && said[0] === 'lookR' && mouths(said).length === Math.max(3, Math.min(10, Math.round(line.length / 5))) && new Set(mouths(said)).size >= 2 && !twice && said[said.length - 2] === 'smile' && said[said.length - 1] === 'rest',
      `her bubble changes to the scan line (${line.length} letters): she looks at it, mouths it in ${mouths(said).length} shapes, never the same twice running, smiles, rests (${said.join(' ')})`);
    const took = await page.evaluate((n) => { const p = window.__hostProbe; return Math.round(p[n - 1].at - p[0].at); }, said.length);
    check(took < 2900, `the whole of it takes ${took} ms`);
    // a brand is hearted on Home
    await idle(page); await clear(page);
    await page.evaluate(() => window.CFB.saved.toggle('milani'));
    await page.clock.runFor(1700);
    check((await frames(page)).includes('love'), 'a brand is hearted: she beams');
    await clear(page);
    await page.evaluate(() => window.CFB.saved.toggle('milani'));
    await page.clock.runFor(1700);
    check(!(await frames(page)).includes('love'), 'the heart is taken back: no face for that');
    await ctx.close();
  }
  {   // late at night: the long drowsy blink
    const { ctx, page } = await phone({ clock: true, alive: true, at: new Date('2026-11-14T23:30:00') });
    await page.clock.runFor(600); await live(page); await page.clock.runFor(4500);
    await page.evaluate(() => window.CFB.hostFace.seed(5)); await clear(page);
    await page.clock.runFor(120000);
    const long = await page.evaluate(() => { const p = window.__hostProbe; return p.filter((f, i) => f.name === 'shut' && p[i + 1] && p[i + 1].at - f.at > 550).length; });
    check(long >= 2, `at 11:30 at night: ${long} long, drowsy blinks in two minutes`);
    await ctx.close();
  }
  {   // by day there are none
    const { ctx, page } = await phone({ clock: true, alive: true, at: new Date('2026-11-14T15:00:00') });
    await page.clock.runFor(600); await live(page); await page.clock.runFor(4500);
    await page.evaluate(() => window.CFB.hostFace.seed(5)); await clear(page);
    await page.clock.runFor(120000);
    const long = await page.evaluate(() => { const p = window.__hostProbe; return p.filter((f, i) => f.name === 'shut' && p[i + 1] && p[i + 1].at - f.at > 550).length; });
    check(long === 0, 'at 3 in the afternoon: no drowsy blinks');
    await ctx.close();
  }

  // 10. Reduced motion: she rests on the base; the strip is never asked for; a tap on her follows the link.
  {
    asked.length = 0;
    const { ctx, page } = await phone({ reduced: true });
    await page.waitForTimeout(600);
    const s = await state(page);
    check(!s.live && await page.isHidden('.hb-face') && !asked.some((u) => u.includes('face.webp')), 'reduced motion: the base picture alone, no strip downloaded');
    check(await page.$eval('.hb-host', (e) => getComputedStyle(e).animationName) === 'none' && await page.$eval('.hb-host', (e) => !e.style.rotate), 'reduced motion: no breath, no lean');
    const box = await page.$eval('.hb-host', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.36 }; });
    await page.mouse.click(box.x, box.y);
    await page.waitForFunction(() => location.hash !== '');
    check(true, `reduced motion: a tap on her opens ${new URL(page.url()).hash}, as her bubble does`);
    await ctx.close();
  }
  // 11. Data saver: no extra art.
  {
    asked.length = 0;
    const { ctx, page } = await phone({ saver: true });
    await page.waitForTimeout(600);
    check(!(await state(page)).live && !asked.some((u) => u.includes('face.webp')), 'data saver: the strip is not downloaded');
    await ctx.close();
  }
  // 12. A computer: same place over the base.
  {
    const { ctx, page } = await phone({ width: 1440, height: 900 });
    await live(page);
    const r = await page.evaluate(() => { const a = document.querySelector('.hb-host').getBoundingClientRect(), b = document.querySelector('.hb-face').getBoundingClientRect(); return [(b.x - a.x) / a.width, (b.y - a.y) / a.height, b.width / a.width]; });
    check(Math.abs(r[0] - 114 / 480) < 0.004 && Math.abs(r[1] - 117 / 540) < 0.004 && Math.abs(r[2] - 252 / 480) < 0.004, 'at 1440 px her face sits in the same place over the base');
    await ctx.close();
  }

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
