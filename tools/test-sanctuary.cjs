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
const MEADOW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8')).questions.filter((q) => q.topic === 'meadow').map((q) => q.id);

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

(async () => {
  await new Promise((r) => server.listen(8772, r));
  const browser = await chromium.launch({ args: GL });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [], asked = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push(r.url()));
  const world3d = (u) => /sanctuary3d\.js|vendor\/three|assets\/sanctuary\/.*\.glb/.test(u);
  const setLearned = (n) => page.evaluate(([ids, k]) => { const s = { v: 1, items: {}, best: {} }; ids.slice(0, k).forEach((id) => { s.items[id] = { s: 2, due: Date.now() + 9e8, k: 'w' }; }); localStorage.setItem('cfb-garden', JSON.stringify(s)); }, [MEADOW, n]);
  const ready = () => page.waitForSelector('.sx.is-ready', { timeout: 120000 });
  const seen = () => page.evaluate(() => { const w = window.CFB.garden.world.debug; return { rabbits: w.rabbits.filter((r) => r && r.g.visible).length, blooms: w.blooms.reduce((n, m) => n + m.count, 0), missing: w.failed }; });

  // Home, Brands and Scan never load the 3D world
  await page.goto(BASE + '?intro=0#home'); await page.waitForTimeout(600);
  for (const h of ['#brands', '#scan', '#learn', '#home']) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(250); }
  check(!asked.some(world3d), 'Home, Brands, Scan and Learn load no 3D code or models');

  // A new sanctuary: Clover alone, a third of the flowers
  await page.click('.gd-home'); await ready();
  check(asked.some(world3d), 'opening the Sanctuary loads the 3D world');
  const empty = await seen();
  check(empty.missing === 0, 'every model loaded');
  check(empty.rabbits === 1, 'a new sanctuary has one rabbit, Clover');
  check((await page.textContent('#sx-card')).includes('Bunny Meadow') && (await page.textContent('#sx-card')).includes(`0 of ${MEADOW.length} learned`), 'the card names the habitat and its progress');
  const box = await page.$eval('#sx', (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  check(box.w === box.vw && box.h > box.vh * 0.85, 'the world fills the screen');
  // the card's button is tappable, clear of the tab bar
  const tappable = (sel) => page.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return b.height >= 44 && !!hit && !!hit.closest(q); }, sel);
  check(await tappable('#sx-visit'), 'Visit is at least 44 px tall and not under the tab bar');

  // Visit, hello, practise, back
  await page.click('#sx-visit');
  check(await page.evaluate(() => document.getElementById('sx').classList.contains('is-meet')) && (await page.textContent('.sx-name')) === 'Meet Clover', 'Visit goes to Clover');
  check(await tappable('#sx-hello') && await tappable('.sx-btn-2'), 'Say hello and Practise are tappable');
  await page.click('#sx-hello');
  check((await page.textContent('#sx-desc')) === 'Clover says hello.', 'Say hello answers');
  await page.click('#sx-back');
  check(await page.evaluate(() => !document.getElementById('sx').classList.contains('is-meet')), 'the arrow goes back to the whole sanctuary');
  // a tap on Clover in the world goes to the meadow too
  await page.evaluate(() => window.CFB.garden.world.debug.snap());
  const at = await page.evaluate(() => { const w = window.CFB.garden.world.debug, r = w.rabbits[0], p = w.project(r.x, r.g.position.y + 1.4, r.z), b = document.getElementById('sx-canvas').getBoundingClientRect(); return { x: b.left + p.x, y: b.top + p.y }; });
  await page.mouse.click(at.x, at.y);
  await page.waitForFunction(() => document.getElementById('sx').classList.contains('is-meet'), null, { timeout: 5000 }).catch(() => {});
  check(await page.evaluate(() => document.getElementById('sx').classList.contains('is-meet')), 'tapping Clover in the world opens her card');
  await page.click('.sx-btn-2'); await page.waitForSelector('#practice-q');
  check((await page.textContent('#practice-h')) === 'Bunny Meadow', 'Practise starts the Meadow\'s round');
  await page.goBack(); await page.waitForSelector('.sx.is-ready');

  // Learning changes the world: more flowers, and friends move in
  await setLearned(3); await page.reload(); await ready();
  const some = await seen();
  check(some.rabbits === 2 && some.blooms > empty.blooms, `a third learned: a second rabbit and more flowers (${empty.blooms} to ${some.blooms})`);
  await setLearned(MEADOW.length); await page.reload(); await ready();
  const full = await seen();
  check(full.rabbits === 3 && full.blooms > some.blooms, `all learned: three rabbits and the meadow in full bloom (${full.blooms} flowers)`);

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

  // Where 3D can't run, the cards carry the screen
  const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p2 = await plain.newPage(); const asked2 = []; p2.on('request', (r) => asked2.push(r.url()));
  await p2.goto(BASE + '?intro=0&3d=0#garden'); await p2.waitForSelector('.gd-card');
  check(!asked2.some(world3d) && !(await p2.isVisible('#sx-canvas')) && (await p2.isVisible('#garden-h')), 'with 3D off: no world is loaded, the heading and the cards show');
  await plain.close();

  // Desktop: as wide as the space beside the rail, and no sideways scroll
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const p3 = await wide.newPage();
  await p3.goto(BASE + '?intro=0#garden'); await p3.waitForSelector('.sx.is-ready', { timeout: 120000 });
  const d = await p3.evaluate(() => { const b = document.getElementById('sx').getBoundingClientRect(); return { left: b.left, right: b.right, sx: document.documentElement.scrollWidth, vw: innerWidth }; });
  check(Math.abs(d.left - 248) < 2 && d.right >= d.vw - 20 && d.sx <= d.vw, `desktop: the world runs from the side rail to the window's edge (${Math.round(d.left)} to ${Math.round(d.right)} of ${d.vw})`);
  await wide.close();

  await browser.close(); server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
