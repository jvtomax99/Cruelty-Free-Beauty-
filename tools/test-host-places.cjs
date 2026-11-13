// Checks the host's small copies (host.js, PLACES) in a real browser: each named place shows her once,
// with its signed-off line and a link that goes somewhere, and never two of her on one screen.
//   node tools/test-host-places.cjs                (serves the repo's parent folder on port 8773)
//   node tools/test-host-places.cjs --shots DIR    also saves screenshots (390 px and 1440 px) into DIR
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOT = path.resolve(REPO, '..');
const APP = `http://localhost:8773/${path.basename(REPO)}/?intro=0`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});
const PROFILE = { skin: 'dry', depth: 'fair', veins: 'cool', jewelry: 'cool', sun: 'cool', finish: 'matte', budget: 'any', vegan: 'no', undertone: 'cool' };
const VERDICT = /cruelty|passes|doesn't pass|certified|tests on animals|approved|safe|not on/i;
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8773, r));
  const browser = await chromium.launch();
  const errors = [], said = [];
  for (const width of [390, 1440]) {
    const tag = `${width} px`;
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, deviceScaleFactor: shots ? 2 : 1, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}-${width}.png`) }); };
    // her copies on view (the big one on Home counts), and the small one's words, link and face
    const here = () => page.evaluate(() => {
      const vis = (e) => e.offsetParent !== null;
      const ms = [...document.querySelectorAll('.hm')].filter(vis);
      const m = ms[0];
      const F = window.CFB.hostFace.FRAMES;
      const i = m && m.querySelector('.hm-face i');
      return {
        count: ms.length + [...document.querySelectorAll('.hb-host')].filter(vis).length,
        text: m ? m.textContent.replace(/\s+/g, ' ').trim() : '', href: m ? m.getAttribute('href') : '',
        face: i ? F[Math.round(parseFloat(i.style.backgroundPositionX) / 100 * (F.length - 1))] : 'rest',
        inside: m ? (() => { const r = m.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })() : false,
        size: m ? Math.round(m.querySelector('.hm-face').getBoundingClientRect().width) : 0
      };
    });
    const expect = async (what, text, href, face) => {
      const h = await here(); said.push(h.text);
      check(h.count === 1 && h.text === text && h.href === href && h.face === face && h.inside && h.size === 72, `${tag}, ${what}: one of her (72 px, ${h.face}), "${h.text}" -> ${h.href}${h.count !== 1 ? ` [${h.count} copies]` : ''}`);
    };
    const kinds = await (async () => { await page.goto(APP); return page.evaluate(async () => { const all = await window.CFB.brands, out = {}; for (const b of all) { const k = window.CFB.verdict(b, window.CFB.mode()).kind; if (!out[k]) out[k] = { id: b.id, name: b.name }; } return out; }); })();
    const OBF = { 1: kinds.pass.name, 2: kinds.fail.name, 3: 'Glowfield Labs', 4: kinds.none.name };
    await ctx.route('https://world.openbeautyfacts.org/**', (route) => {
      const code = +(route.request().url().match(/product\/(\d+)\.json/) || [])[1];
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 1, product: { product_name: 'Thing', brands: OBF[code] } }) });
    });
    check((await here()).count === 1, `${tag}, Home: only the big one`);

    // Scan with nothing scanned: the empty line, which leads to the camera button.
    await page.goto(APP + '#scan');
    await page.waitForSelector('#scan-empty .hm');
    await expect('no scans yet', 'No scans yet. Try one from your bag.', '#scan', 'rest');
    await shot('places-noscans');
    await page.click('#scan-empty .hm');
    check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'scan-start'), `${tag}, its link moves to the Start camera button`);

    // A result of each kind: her face follows it, the empty line goes, the link opens the proof.
    for (const [code, kind, face] of [[1, 'pass', 'smile'], [2, 'fail', 'sad'], [4, 'none', 'surprised']]) {
      await page.fill('#scan-code', '000000000000' + code);
      await page.click('#scan-code-form button');
      await page.waitForSelector('#scan-result .hm');
      await expect(`a scan that ${kind === 'pass' ? 'passes' : kind === 'fail' ? "doesn't pass" : 'is on no list'}`, 'Want to see why? Read the proof.', '#brand/' + encodeURIComponent(kinds[kind].id), face);
      await page.locator('#scan-result .hm').scrollIntoViewIfNeeded();
      await shot('places-scan-' + kind);
    }
    await page.click('#scan-result .hm');
    await page.waitForSelector('#brand-page .facts');
    check((await page.textContent('#brand-page h1')).includes(kinds.none.name) && (await here()).count === 0, `${tag}, the scan line opens that brand's page (none of her there)`);
    await page.goto(APP + '#scan');
    await page.fill('#scan-code', '0000000000003');
    await page.click('#scan-code-form button');
    await page.waitForSelector('#scan-result .hm');
    await expect("a brand we haven't checked", "New to us. Look it up on the certifiers' lists.", '#scan', 'surprised');
    await page.locator('#scan-result .hm').scrollIntoViewIfNeeded();
    await shot('places-scan-unchecked');
    await page.click('#scan-result .hm');
    check(await page.evaluate(() => !!document.activeElement.closest('#scan-lists')), `${tag}, its link moves to the certifiers' links on the card`);
    await page.click('#scan-clear');
    check((await here()).count === 1, `${tag}, recent scans cleared with a result on view: still one of her`);

    // Profile: no saved brands (and no quiz yet), then the end of the quiz, then back to the saved line.
    await page.goto(APP + '#profile');
    await page.waitForSelector('#saved-app .hm');
    await expect('no saved brands', 'Nothing saved yet. Find a brand to heart.', '#brands', 'rest');
    await page.locator('#saved-app .hm').scrollIntoViewIfNeeded();
    await shot('places-nosaved');
    await page.click('#pf-start');
    for (let i = 0; i < 8; i++) { await page.waitForSelector('.quiz-opt'); const q = await page.textContent('.quiz-q'); await page.locator('.quiz-opt').first().click(); await page.waitForFunction((q) => !document.querySelector('.quiz-q') || document.querySelector('.quiz-q').textContent !== q, q); }
    await page.waitForSelector('#profile-app .hm, .pf-hero .hm');
    await expect('the end of the quiz', "That's your match. Now scan what's in your bag.", '#scan', 'smile');
    await shot('places-quizdone');
    await page.click('.pf-hero .hm');
    await page.waitForSelector('[data-screen=scan]:not([hidden])');
    check(true, `${tag}, the quiz line opens Scan`);
    await page.evaluate(() => { location.hash = '#profile'; });
    await page.waitForSelector('#saved-app .hm');
    await expect('Profile on a later visit', 'Nothing saved yet. Find a brand to heart.', '#brands', 'rest');
    await page.click('#saved-app .hm');
    await page.waitForSelector('[data-screen=brands]:not([hidden])');
    check((await here()).count === 0, `${tag}, the saved line opens Brands (none of her there)`);
    // with a brand saved, the empty line is gone
    await page.evaluate((id) => window.CFB.saved.toggle(id), kinds.pass.id);
    await page.evaluate(() => { location.hash = '#profile'; });
    await page.waitForSelector('#saved-app .sv-list');
    check((await here()).count === 0, `${tag}, with a brand saved: no empty line`);
    await ctx.close();
  }
  const bad = [...new Set(said)].filter((t) => VERDICT.test(t));
  check(!bad.length, `none of her ${new Set(said).size} lines words a verdict${bad.length ? ': ' + bad.join(' | ') : ''}`);
  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
