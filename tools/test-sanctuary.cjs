// Checks the Sanctuary's 3D world in a real browser (SPEC "The Garden", the 3D "Done when").
//   node tools/test-sanctuary.cjs      (serves the repo's parent folder on port 8772)
// The cloud browser draws 3D in software, so this is slow (about a minute) and says nothing
// about speed on a phone.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8772/${path.basename(path.resolve(__dirname, '..'))}/`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
const QUESTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8')).questions;
const MEADOW = QUESTIONS.filter((q) => q.topic === 'meadow').map((q) => q.id);
const ANSWER = Object.fromEntries(QUESTIONS.map((q) => [q.q, q.options[0]]));
const HABITATS = ['meadow', 'pond', 'orchard', 'burrow', 'oak'];

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const W = () => window.CFB.garden.world;

(async () => {
  await new Promise((r) => server.listen(8772, r));
  const browser = await chromium.launch({ args: GL });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [], asked = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push(r.url()));
  const world3d = (u) => /sanctuary3d[\w-]*\.js|vendor\/three|assets\/sanctuary\/.*\.glb/.test(u);
  const setLearned = (pg, n) => pg.evaluate(([ids, k]) => { const s = { v: 1, items: {}, best: {}, shelter: {} }; ids.slice(0, k).forEach((id) => { s.items[id] = { s: 2, due: Date.now() + 9e8, k: 'w' }; }); localStorage.setItem('cfb-garden', JSON.stringify(s)); }, [MEADOW, n]);
  const ready = (pg = page) => pg.waitForSelector('.sx.is-ready', { timeout: 180000 }).then(() => pg.evaluate(() => window.CFB.garden.world.debug.quality(1)));
  const seen = (pg = page) => pg.evaluate(() => { const w = window.CFB.garden.world, d = w.debug; return { rabbits: w.animals().filter((a) => a.habitat === 'meadow' && a.visible).length, all: w.animals().filter((a) => a.visible).map((a) => a.id), blooms: d.blooms('meadow'), shelter: d.shelter('meadow'), missing: d.failed }; });
  const snap = (pg = page) => pg.evaluate(() => window.CFB.garden.world.debug.snap());
  /* where an animal is on the screen right now */
  const whereIs = (id, pg = page) => pg.evaluate((k) => { const d = window.CFB.garden.world.debug, a = d.byId[k], p = d.project(a.x, a.root.position.y + a.size * d.life.big * 0.5, a.z), b = document.getElementById('sx-canvas').getBoundingClientRect(); return { x: b.left + p.x, y: b.top + p.y }; }, id);
  const tappable = (sel, pg = page) => pg.evaluate((q) => { const el = document.querySelector(q); if (!el) return false; const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return b.height >= 44 && b.left >= 0 && b.right <= innerWidth && !!hit && !!hit.closest(q); }, sel);
  const cls = (name, pg = page) => pg.evaluate((n) => document.getElementById('sx').classList.contains(n), name);

  // Home, Brands and Scan never load the 3D world
  await page.goto(BASE + '?intro=0#home'); await page.waitForTimeout(600);
  for (const h of ['#brands', '#scan', '#learn', '#home']) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(250); }
  check(!asked.some(world3d), 'Home, Brands, Scan and Learn load no 3D code or models');

  // A new sanctuary: one resident in each habitat (the pond's duck has her first duckling), a third of the flowers, plain shelters
  await page.click('.gd-home'); await ready();
  check(asked.some(world3d), 'opening the Sanctuary loads the 3D world');
  const empty = await seen();
  check(empty.missing === 0, 'every model loaded');
  check(empty.rabbits === 1 && empty.all.join() === 'clover,willow,pip,biscuit,poppy,fern', `a new sanctuary has the first resident of each habitat (${empty.all.join(', ')})`);
  check(!empty.shelter, 'a new habitat has its plain shelter');
  check((await page.textContent('#sx-card')).includes('Bunny Meadow') && (await page.textContent('#sx-card')).includes(`0 of ${MEADOW.length} learned`), 'the card names the habitat and its progress');
  const names = await page.evaluate(() => { const g = window.CFB.garden, out = {}; for (const a of g.world.animals()) (out[a.habitat] = out[a.habitat] || []).push(a.name); return { world: out, cards: Object.fromEntries(Object.entries(g.home).map(([k, v]) => [k, v.who.join(' and ').split(' and ')])) }; });
  check(HABITATS.every((h) => names.world[h].join() === names.cards[h].join()), 'the names on the cards are the names in the world');
  const box = await page.$eval('#sx', (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  check(box.w === box.vw && box.h > box.vh * 0.85, 'the world fills the screen');
  check(await tappable('#sx-visit') && await tappable('#sx-prev') && await tappable('#sx-next'), 'Visit and the two arrows are at least 44 px tall and not under the tab bar');
  check(await page.isVisible('.tabbar a[href="#learn"]') && await page.isVisible('.tabbar a[href="#brands"]'), 'Learn and Brands stay within reach under the world');

  // The arrows step through the five habitats
  const stepped = [];
  for (let i = 0; i < 5; i++) { await page.click('#sx-next'); stepped.push(await page.textContent('.sx-name')); }
  check(new Set(stepped).size === 5 && stepped[4] === 'Bunny Meadow', `the arrows step through five habitats and come back (${stepped.join(', ')})`);

  // Camera: a drag turns, the wheel zooms, and neither is a tap
  await snap();
  const cv = await page.$eval('#sx-canvas', (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.42 }; });
  const g0 = await page.evaluate(() => ({ ...window.CFB.garden.world.debug.goal }));
  await page.mouse.move(cv.x, cv.y); await page.mouse.down(); await page.mouse.move(cv.x + 90, cv.y + 10, { steps: 6 }); await page.mouse.up();
  const g1 = await page.evaluate(() => ({ ...window.CFB.garden.world.debug.goal }));
  check(Math.abs(g1.az - g0.az) > 0.2 && !(await cls('is-meet')), 'a drag turns the island and does not open anything');
  await page.mouse.wheel(0, -400);
  const g2 = await page.evaluate(() => ({ ...window.CFB.garden.world.debug.goal }));
  check(g2.dist < g1.dist * 0.8, `the wheel zooms in (${Math.round(g1.dist)} to ${Math.round(g2.dist)})`);
  await page.evaluate(() => { const w = window.CFB.garden.world; w.visit(null); w.debug.snap(); });

  // A tap on a habitat goes to it; a tap on an animal opens its card; "Say hello" is answered in the world
  const ground = await page.evaluate(() => { const d = window.CFB.garden.world.debug, p = d.project(-3, 1.3, 12.6), b = document.getElementById('sx-canvas').getBoundingClientRect(); return { x: b.left + p.x, y: b.top + p.y }; });
  await page.mouse.click(ground.x, ground.y);
  check(await cls('is-meet') && (await page.textContent('.sx-name')) === 'Bunny Meadow' && (await page.evaluate(() => window.CFB.garden.world.where().mode)) === 'meadow', 'tapping the meadow visits it');
  check((await page.textContent('#sx-card')).includes('At home here: Clover') && /more learned: /.test(await page.textContent('#sx-card')), 'the visit card says who is at home and what the next lesson brings');
  check(await tappable('#sx-practise'), 'Practise is tappable on a visit');
  await snap();
  let at = await whereIs('clover');
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 3, at.y + 2); await page.mouse.up();   // a slightly shaky press is still a tap
  check((await page.textContent('.sx-name')) === 'Meet Clover' && (await page.evaluate(() => window.CFB.garden.world.where().animal)) === 'clover', 'tapping Clover opens her card, even with a shaky finger');
  check((await page.textContent('#sx-desc')).includes('fond of clover'), 'her card shows her personality');
  check(await tappable('#sx-hello') && await tappable('.sx-btn-2'), 'Say hello and Practise are tappable');
  await snap();
  const before = await page.evaluate(() => { const d = window.CFB.garden.world.debug, a = d.byId.clover; return { d: Math.hypot(d.cam.position.x - a.x, d.cam.position.z - a.z) }; });
  await page.click('#sx-hello');
  check((await page.textContent('#sx-desc')) === 'Clover says hello.', 'Say hello answers in words');
  const after = await page.evaluate(() => { const d = window.CFB.garden.world.debug, a = d.byId.clover, did = {}; for (let i = 0; i < 150; i++) { d.life.update(1 / 30); did[a.state] = 1; } const want = Math.atan2(d.cam.position.x - a.x, d.cam.position.z - a.z); let off = want - a.yaw; while (off > Math.PI) off -= 6.283; while (off < -Math.PI) off += 6.283; return { d: Math.hypot(d.cam.position.x - a.x, d.cam.position.z - a.z), off: Math.abs(off), did: Object.keys(did), bad: d.life.check() }; });
  check(after.did.includes('hello') && after.off < 0.5 && after.d < before.d - 0.3 && after.bad.length === 0, `Clover turns to the camera, comes closer and sniffs (${before.d.toFixed(1)} to ${after.d.toFixed(1)} away, ${after.off.toFixed(2)} rad off)`);
  const kept = await page.evaluate(() => { const d = window.CFB.garden.world.debug; for (let i = 0; i < 90; i++) d.life.update(1 / 30); d.snap(); const a = d.byId.clover, p = d.project(a.x, a.root.position.y + a.size * 0.5, a.z), c = document.getElementById('sx-canvas'); return { x: p.x / c.clientWidth, y: p.y / c.clientHeight }; });
  check(kept.x > 0.25 && kept.x < 0.75 && kept.y > 0.15 && kept.y < 0.7, `the view keeps Clover in sight (${kept.x.toFixed(2)}, ${kept.y.toFixed(2)} of the screen)`);
  await page.click('#sx-back');
  check((await page.textContent('.sx-name')) === 'Bunny Meadow' && await cls('is-meet'), 'the arrow goes back from Clover to her meadow');
  await page.click('#sx-back');
  check(!(await cls('is-meet')), 'and from the meadow to the whole sanctuary');

  // A lesson improves the habitat: play the Meadow's round right, twice (5 minutes apart), and Hazel moves in
  const playRound = async () => {
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('#practice-q'); const q = await page.textContent('#practice-q');
      const n = await page.$$eval('#practice-box .quiz-opt', (bs, want) => bs.findIndex((b) => b.textContent === want), ANSWER[q]);
      await page.click(`#practice-box .quiz-opt[data-n="${n}"]`); await page.click('#practice-next');
    }
  };
  await page.click('#sx-visit'); await page.click('#sx-practise'); await page.waitForSelector('#practice-q');
  check((await page.textContent('#practice-h')) === 'Bunny Meadow', 'Practise starts the Meadow\'s round');
  await playRound();
  check(/5 of 5 right/.test(await page.textContent('#practice-box')), 'a round of five, all right');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cfb-garden')); for (const k in s.items) s.items[k].due = Date.now() - 1000; localStorage.setItem('cfb-garden', JSON.stringify(s)); });   // five minutes later
  await page.reload(); await page.evaluate(() => { location.hash = '#practice/meadow'; }); await page.waitForSelector('#practice-q');
  await playRound();
  const told = await page.textContent('#practice-box');
  check(/Hazel moved in to Bunny Meadow\./.test(told) && /a doorway and flowers for the burrow/.test(told), 'the round\'s summary says what improved: Hazel moved in, and the burrow got its doorway');
  check(!/rescu|saved|donat/i.test(told), 'the summary never says rescued, saved or donated');
  await page.click('.gd-backlink'); await ready();
  const grown = await seen();
  check(grown.rabbits === 2 && grown.blooms > empty.blooms && grown.shelter, `back in the sanctuary: a second rabbit, more flowers (${empty.blooms} to ${grown.blooms}) and the better burrow`);
  await page.reload(); await ready();
  const again = await seen();
  check(again.rabbits === 2 && again.blooms === grown.blooms && again.shelter, 'after a reload the progress is still there');

  // More learning, more change; nothing that arrived ever leaves
  await setLearned(page, MEADOW.length); await page.reload(); await ready();
  const full = await seen();
  check(full.rabbits === 3 && full.blooms > grown.blooms, `all learned: three rabbits and the meadow in full bloom (${full.blooms} flowers)`);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cfb-garden')); s.items = {}; localStorage.setItem('cfb-garden', JSON.stringify(s)); });
  await page.reload(); await ready();
  const lost = await seen();
  check(lost.rabbits === 3 && lost.shelter && lost.blooms < full.blooms, 'when the learned count drops, the flowers thin but the rabbits and the better burrow stay');

  // Every animal stays where it belongs: ten minutes of their lives, all sixteen at home
  await page.evaluate((ids) => window.CFB.garden.world.setState(Object.fromEntries(ids.map((k) => [k, { p: 1, residents: 3, shelter: true }]))), HABITATS);
  const lives = await page.evaluate(() => window.CFB.garden.world.debug.simulate(600));
  check(lives.animals.length === 16 && Object.keys(lives.bad).length === 0, `ten minutes with all 16 animals: none leaves its habitat, enters the water, or passes through a rock, plant, shelter or another animal${Object.keys(lives.bad).length ? ' (' + Object.keys(lives.bad).slice(0, 6).join('; ') + ')' : ''}`);
  check(lives.animals.every((a) => a.far > 1 && a.did.split(' ').length >= 4), 'every animal moved about and did at least four different things');
  const sync = await page.evaluate(() => { const d = window.CFB.garden.world.debug, same = []; let n = 0; for (let t = 0; t < 900; t++) { d.life.update(1 / 30); const s = d.life.animals.map((a) => a.state + ':' + Math.round(a.t * 2)); if (new Set(s).size < 9) n++; } return n; });
  check(sync === 0, 'they are never in step: at no moment are most of them doing the same thing at the same point');

  // The page under the world still lists every habitat
  check((await page.locator('.gd-card').count()) === 5, 'the five habitats are listed under the world');

  // Offline after one visit
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(2500);
  await page.reload(); await ready(); await page.waitForTimeout(1500);   // this load goes through the worker, which saves the world
  await ctx.setOffline(true);
  await page.reload();
  const off = await ready().then(() => true, () => false);
  check(off && (await seen()).missing === 0, 'offline after one visit: the world opens, every model there');
  await ctx.setOffline(false);
  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await ctx.close();

  // Touch, on a narrow phone and on a phone held sideways
  for (const [w, h, what] of [[320, 568, 'narrow portrait'], [844, 390, 'landscape']]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '?intro=0#garden'); await ready(p);
    check(await tappable('#sx-visit', p) && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), `${what}: Visit is tappable and nothing spills sideways`);
    await p.tap('#sx-visit'); await snap(p);
    const t = await whereIs('clover', p);
    await p.touchscreen.tap(t.x, t.y);
    check((await p.textContent('.sx-name')) === 'Meet Clover', `${what}: a finger tap on Clover opens her card`);
    check(await tappable('#sx-hello', p) && await tappable('.sx-btn-2', p), `${what}: Say hello and Practise are tappable`);
    await snap(p);
    const on = await p.evaluate(() => { const d = window.CFB.garden.world.debug, a = d.byId.clover, q = d.project(a.x, a.root.position.y + a.size * 0.5, a.z), cv = document.getElementById('sx-canvas').getBoundingClientRect(), card = document.getElementById('sx-card').getBoundingClientRect(); return { x: q.x / cv.width, clear: cv.top + q.y < card.top && q.y > 0 }; });
    check(on.x > 0.2 && on.x < 0.8 && on.clear, `${what}: Clover is in view, clear of the card`);
    await p.tap('#sx-hello');
    check((await p.textContent('#sx-desc')) === 'Clover says hello.' && errs.length === 0, `${what}: Say hello answers, no script errors`);
    await c.close();
  }

  // Where 3D can't run, the cards carry the screen
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p2 = await plain.newPage(); const asked2 = []; p2.on('request', (r) => asked2.push(r.url()));
  await p2.goto(BASE + '?intro=0&3d=0#garden'); await p2.waitForSelector('.gd-card');
  check(!asked2.some(world3d) && !(await p2.isVisible('#sx-canvas')) && (await p2.isVisible('#garden-h')), 'with 3D off: no world is loaded, the heading and the cards show');
  await plain.close();

  // Reduced motion: the world is shown and usable, and the card still answers
  const calm = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const p4 = await calm.newPage(); await p4.goto(BASE + '?intro=0#garden'); await p4.waitForSelector('.sx.is-ready', { timeout: 180000 });
  await p4.click('#sx-visit'); await p4.evaluate(() => { window.CFB.garden.world.debug.snap(); });
  const t4 = await whereIs('clover', p4); await p4.mouse.click(t4.x, t4.y);
  const hadCard = (await p4.textContent('.sx-name')) === 'Meet Clover'; if (hadCard) await p4.click('#sx-hello');
  check(hadCard && (await p4.textContent('#sx-desc')) === 'Clover says hello.', 'with reduced motion: the world shows, and Say hello answers in words');
  await calm.close();

  // Desktop: as wide as the space beside the rail, and no sideways scroll
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const p3 = await wide.newPage();
  await p3.goto(BASE + '?intro=0#garden'); await p3.waitForSelector('.sx.is-ready', { timeout: 180000 });
  const d = await p3.evaluate(() => { const b = document.getElementById('sx').getBoundingClientRect(); return { left: b.left, right: b.right, sx: document.documentElement.scrollWidth, vw: innerWidth }; });
  check(Math.abs(d.left - 248) < 2 && d.right >= d.vw - 20 && d.sx <= d.vw, `desktop: the world runs from the side rail to the window's edge (${Math.round(d.left)} to ${Math.round(d.right)} of ${d.vw})`);
  await wide.close();

  await browser.close(); server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
