// Checks the scanner and saved list in a real browser (phase 5 "Done when" lines).
//   node tools/test-scan.cjs            (serves the repo's parent folder on port 8767)
//   node tools/test-scan.cjs --live     (also looks up three real barcodes on Open Beauty Facts)
// The built-in BarcodeDetector is removed, so the vendored reader (the iPhone path) is what runs.
// A barcode is drawn here (EAN-13), then read three ways: a photo, a fake camera, typed numbers.
// Open Beauty Facts answers are faked, except with --live.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LIVE = process.argv.includes('--live');
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8767/${path.basename(path.resolve(__dirname, '..'))}/?intro=0`;   // skip the launch show: this test is about the scanner
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

/* ---------- EAN-13, drawn from the standard's tables ---------- */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => c.replace(/./g, (b) => (b === '0' ? '1' : '0')));
const G = R.map((c) => [...c].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function ean13Bits(code) {
  const d = [...code].map(Number);
  const left = d.slice(1, 7).map((n, i) => (PARITY[d[0]][i] === 'L' ? L : G)[n]).join('');
  const right = d.slice(7).map((n) => R[n]).join('');
  return '101' + left + '01010' + right + '101';
}
const MAYBELLINE = '6902395706113';   // real: Maybelline Super Stay Matte Ink, on Open Beauty Facts 2026-11-11
const ELF = '0609332820050';          // real: e.l.f. Glow Reviver lip oil
const MILANI = '0717489950015';       // real: Milani Rose Powder Blush

// Real brand strings from Open Beauty Facts (2026-11-11) and how they must match.
const OBF_NAMES = [
  ['e.l.f. Cosmetics', 'elf'], ['E.l.f.', 'elf'], ['MILANI', 'milani'], ['Fenty beauty', 'fenty-beauty'], ['tarte', 'tarte'],
  ['Too Faced', 'too-faced'], ['Urban Decay', 'urban-decay'], ['Kylie Cosmetics', 'kylie-cosmetics'], ['Morphe', 'morphe'],
  ['Wet n wild', 'wet-n-wild'], ['Pacifica', 'pacifica'], ['Charlotte tilbury', 'charlotte-tilbury'], ['huda beauty', 'huda-beauty'],
  ['Anastasia Beverly Hills', 'anastasia-beverly-hills'], ['REVOLUTION', 'makeup-revolution'], ['Makeup Revolution', 'makeup-revolution'],
  ['Thrive', 'thrive-causemetics'], ['NYX Professional Makeup', 'nyx'], ['Nyx', 'nyx'], ['Maybelline', 'maybelline'],
  ["L'Oréal Paris", 'loreal-paris'], ["L'Oréal", 'loreal-paris'], ['Maybelline, L\'Oréal', 'maybelline'], ['MAC cosmetics', 'mac'],
  ['M.A.C', 'mac'], ['Estée Lauder', 'estee-lauder'], ['estee lauder', 'estee-lauder'], ['Clinique', 'clinique'], ['benefit', 'benefit'],
  ["Juvia's Place", 'juvias-place'], ['Rare Beauty', 'rare-beauty'], ['Physicians Formula', 'physicians-formula'],
  ['Maybelline New York', 'maybelline'], ['elf', 'elf'],
  // Must NOT match (a wrong match shows a wrong verdict): other brands that start with one of ours,
  // and lists where only the owner company is ours (reviewer, 2026-11-11).
  ['Garnier', null], ['Rare Earth Naturals', null], ['Macadamia', null], ['', null],
  ['Thrive Natural Care', null], ['Thrive Market', null], ['Revolution Skincare', null], ['Kylie Minogue', null],
  ['Mac Paul', null], ["Mac's", null], ['Benefit Lab', null], ['Elf Bar', null], ['Fenty Skin', null],
  ['Naturium, e.l.f. Beauty', null], ["Lancôme, L'Oréal", null], ["La Roche-Posay, L'Oréal", null], ['Smashbox, Estée Lauder', null],
];

(async () => {
  await new Promise((r) => server.listen(8767, r));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-scan-'));

  // 1. Draw the barcode in a browser: a PNG for the photo test, raw pixels for the fake camera.
  let browser = await chromium.launch();
  let page = await browser.newPage();
  const W = 640, H = 480;
  const drawn = await page.evaluate(({ bits, W, H }) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#000';
    const m = 4, left = (W - bits.length * m) / 2;
    [...bits].forEach((b, i) => { if (b === '1') x.fillRect(left + i * m, 140, m, 200); });
    return { png: c.toDataURL('image/png').split(',')[1], rgba: Array.from(x.getImageData(0, 0, W, H).data) };
  }, { bits: ean13Bits(MAYBELLINE), W, H });
  await browser.close();
  const pngPath = path.join(tmp, 'barcode.png');
  fs.writeFileSync(pngPath, Buffer.from(drawn.png, 'base64'));
  // Y4M (the fake camera's file format): 4:2:0, grey only, so U and V are flat 128.
  const yPlane = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) yPlane[i] = drawn.rgba[i * 4];
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frames = [Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`)];
  for (let f = 0; f < 15; f++) frames.push(Buffer.from('FRAME\n'), yPlane, uv);
  const y4m = path.join(tmp, 'barcode.y4m');
  fs.writeFileSync(y4m, Buffer.concat(frames));

  browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  await ctx.addInitScript(() => {
    delete window.BarcodeDetector;
    // Keep every camera stream the page opens, to check none is left running.
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__streams = [];
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
  });
  const liveTracks = () => page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);
  const errors = [];
  const OBF_FAKE = {
    [MAYBELLINE]: { status: 1, product: { product_name: 'Super Stay Matte Ink', brands: 'Maybelline', brands_tags: ['maybelline'] } },
    '0000000000017': { status: 1, product: { product_name: 'Glow Serum', brands: 'Glowfield Labs', brands_tags: ['glowfield-labs'] } },
    '0000000000024': { status: 1, product: { product_name: 'Mystery Balm', brands: '' } },
  };
  let obfOffline = false, obfCalls = [], slowCode = null;
  if (!LIVE) {
    await ctx.route('https://world.openbeautyfacts.org/**', async (route) => {
      const code = (route.request().url().match(/product\/(\d+)\.json/) || [])[1];
      obfCalls.push(code);
      if (obfOffline) return route.abort('internetdisconnected');
      if (code === slowCode) await new Promise((r) => setTimeout(r, 1500));
      const body = OBF_FAKE[code] || { status: 0, status_verbose: 'product not found' };
      route.fulfill({ status: OBF_FAKE[code] ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
  }
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('.tile[href="#scan"]');
  await page.waitForSelector('[data-screen=scan]:not([hidden])');
  const scanTitle = await page.title();
  check(scanTitle === 'C.F.B. · Scan', `Home tile "Scan a product" opens the Scan screen (title "${scanTitle}")`);

  // 2. Brand matching against real Open Beauty Facts names.
  const got = await page.evaluate(async (names) => { await window.CFB.brands; return names.map(([n]) => (window.CFB.match(n) || {}).id || null); }, OBF_NAMES);
  const wrong = OBF_NAMES.filter(([, want], i) => got[i] !== want).map(([n, want], i) => `${n} -> ${got[OBF_NAMES.findIndex((x) => x[0] === n)]} (want ${want})`);
  check(!wrong.length, `${OBF_NAMES.length} real Open Beauty Facts brand names match the right brand${wrong.length ? ': ' + wrong.join('; ') : ''}`);

  // 3. Photo -> vendored reader -> lookup -> verdict.
  await page.setInputFiles('#scan-photo', pngPath);
  await page.waitForSelector('#scan-h', { timeout: 20000 });
  let card = await page.textContent('#scan-result');
  check(/Maybelline/.test(card) && /Doesn't pass/.test(card) && /Open Beauty Facts/.test(card), `photo of a Maybelline barcode reads it and says "Doesn't pass" (${LIVE ? 'live' : 'faked'} lookup)`);
  check(await page.isVisible('#scan-result a[href="#brand/maybelline"]'), '"See the proof" links to the Maybelline brand page');
  check(await page.evaluate(() => !!window.BarcodeDetectionAPI), 'the vendored reader was used (no built-in BarcodeDetector)');

  // 4. Fake camera: the live loop finds the same barcode and turns the camera off.
  await page.click('#scan-clear');
  await page.evaluate(() => { document.getElementById('scan-result').innerHTML = ''; });
  await page.evaluate(() => { const b = document.getElementById('scan-start'); b.click(); b.click(); });   // a double tap
  await page.waitForSelector('#scan-h', { timeout: 20000 });
  check(/Maybelline/.test(await page.textContent('#scan-result')), 'camera scan reads the barcode and shows Maybelline');
  check(await page.isHidden('#scan-cam') && (await page.textContent('#scan-start')) === 'Start camera', 'camera turns off after a read');
  check(await page.evaluate(() => window.__streams.length) === 1 && await liveTracks() === 0, 'a double tap opens one camera, and it is fully off after the read');
  // Leave the screen while the camera is still opening: it must not start behind another screen.
  await page.evaluate(() => { document.getElementById('scan-start').click(); location.hash = '#learn'; });
  await page.waitForTimeout(1500);
  check(await liveTracks() === 0, 'leaving while the camera opens leaves no camera running');
  await page.goto(BASE + '#scan');
  await page.waitForSelector('[data-screen=scan]:not([hidden])');

  if (!LIVE) {
    // 5. Unknown barcode -> brand box -> typed brand.
    await page.fill('#scan-code', '0000000000000');
    await page.click('#scan-code-form button');
    await page.waitForSelector('#scan-brand-form');
    check(/isn't in Open Beauty Facts yet/.test(await page.textContent('#scan-result')), 'unknown barcode asks which brand is on the box');
    await page.fill('#scan-brand-q', 'nyx professional makeup');
    await page.click('#scan-brand-form button');
    await page.waitForSelector('#scan-result a[href="#brand/nyx"]');
    check(true, 'typing "nyx professional makeup" finds NYX');

    // 6. Brand we haven't checked.
    await page.fill('#scan-code', '0000000000017');
    await page.click('#scan-code-form button');
    await page.waitForFunction(() => /haven't checked/.test(document.getElementById('scan-result').textContent));
    card = await page.textContent('#scan-result');
    check(/We haven't checked Glowfield Labs yet/.test(card) && await page.isVisible('#scan-result a[href*="crueltyfree.peta.org/?s=Glowfield"]'), 'unlisted brand says "We haven\'t checked" and links a PETA search');
    check(/Glowfield Labs/.test(await page.textContent('#scan-unlisted')), 'unlisted brand is noted on the phone');

    // 7. Product with no brand, and offline.
    await page.fill('#scan-code', '0000000000024');
    await page.click('#scan-code-form button');
    await page.waitForFunction(() => /but not its brand/.test(document.getElementById('scan-result').textContent));
    check(true, 'product with no brand asks for the brand');
    obfOffline = true;
    await page.fill('#scan-code', MAYBELLINE);
    await page.click('#scan-code-form button');
    await page.waitForFunction(() => /isn't answering|offline/.test(document.getElementById('scan-result').textContent));
    check(true, 'failed lookup says so and asks for the brand');
    obfOffline = false;

    // An older, slower lookup must not replace a newer result.
    slowCode = MAYBELLINE;
    await page.fill('#scan-code', MAYBELLINE);
    await page.click('#scan-code-form button');
    await page.fill('#scan-code', '0000000000017');
    await page.click('#scan-code-form button');
    await page.waitForTimeout(2500);
    check(/Glowfield/.test(await page.textContent('#scan-result')) && !/Super Stay/.test(await page.textContent('#scan-result')), 'a slow earlier lookup doesn\'t overwrite the newer result');
    slowCode = null;

    await page.fill('#scan-code', '12ab');
    await page.click('#scan-code-form button');
    check(/8, 12 or 13 numbers/.test(await page.textContent('#scan-status')), 'a too-short code is refused before any lookup');
    check(obfCalls.every((c) => /^\d+$/.test(c)), 'only barcode numbers were sent to Open Beauty Facts');
  } else {
    // Live: three real barcodes.
    for (const [code, want] of [[ELF, 'e.l.f.'], [MILANI, 'Milani'], [MAYBELLINE, 'Maybelline']]) {
      await page.fill('#scan-code', code);
      await page.click('#scan-code-form button');
      await page.waitForFunction((w) => document.getElementById('scan-h') && document.getElementById('scan-h').textContent.includes(w), want, { timeout: 15000 }).catch(() => {});
      check((await page.textContent('#scan-result')).includes(want), `live: ${code} finds ${want}`);
    }
  }

  const recent = await page.$$eval('#scan-recent li', (a) => a.length);
  check(recent > 0 && recent <= 10, `recent scans listed (${recent})`);

  // 8. Saved list: from a scan, from a brand page, across reload, both strictness settings, offline.
  await page.fill('#scan-code', MAYBELLINE);
  await page.click('#scan-code-form button');
  await page.waitForSelector('#scan-result [data-save=maybelline]');
  await page.click('#scan-result [data-save=maybelline]');
  check((await page.getAttribute('#scan-result [data-save=maybelline]', 'aria-pressed')) === 'true', 'Save on a scan result turns on');
  await page.goto(BASE + '#brand/elf');
  await page.waitForSelector('#brand-page [data-save=elf]');
  await page.click('#brand-page [data-save=elf]');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#brand-page [data-save=elf][aria-pressed=true]');
  check(true, 'Save on a brand page stays on after a reload');
  await page.goto(BASE + '#profile');
  await page.waitForSelector('.sv-list');
  const names = await page.$$eval('.sv-list .brand-name', (a) => a.map((x) => x.textContent));
  check(names.join() === 'e.l.f. Cosmetics,Maybelline', `Profile lists saved brands, newest first (${names.join(', ')})`);
  const strictV = await page.textContent('.sv-list');
  await page.goto(BASE + '#brands');
  await page.click('.mode-btn[data-mode=certified]');
  await page.goto(BASE + '#profile');
  await page.waitForSelector('.sv-list');
  check(/Doesn't pass/.test(strictV) && /Certified/.test(await page.textContent('#saved-app')), 'saved verdicts follow the Strict / Certified switch');
  await page.click('[data-unsave=maybelline]');
  await page.waitForFunction(() => document.querySelectorAll('.sv-list .sv-row').length === 1);
  check((await page.evaluate(() => document.activeElement && document.activeElement.dataset.unsave)) === 'elf', 'Remove takes the brand off and keeps focus in the list');

  // 9. Offline: the worker has the reader, so a photo still reads with no signal.
  await page.goto(BASE + '#scan', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('[data-screen=scan]:not([hidden])');
  await page.setInputFiles('#scan-photo', pngPath);
  await page.waitForSelector('#scan-h', { timeout: 20000 });
  card = await page.textContent('#scan-result');
  check(/Which brand is on the box/.test(card) || /Maybelline/.test(card), 'offline: the photo still reads (reader from the cache) and asks for the brand');
  await page.goto(BASE + '#profile');
  await page.waitForSelector('.sv-list');
  check(/e\.l\.f\./.test(await page.textContent('.sv-list')), 'offline: saved brands still show on Profile');
  await ctx.setOffline(false);

  check(!errors.length, `no script errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
