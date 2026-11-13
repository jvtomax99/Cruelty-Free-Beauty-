// Checks the Sanctuary's quiz in a real browser (SPEC "The Garden", the quiz's "Done when").
//   node tools/test-garden.cjs      (serves the repo's parent folder on port 8771)
// Right answers and brand verdicts are worked out here from the data files, independently of garden.js.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8771/${path.basename(path.resolve(__dirname, '..'))}/`;
const APP = BASE + '?intro=0&3d=0';   // the quiz only; tools/test-sanctuary.cjs covers the 3D world
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

const file = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
const brands = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8')).brands;
const byText = new Map(file.questions.map((q) => [q.q, q]));
// The Strict verdict, from SPEC "Brand rules", written again here on purpose.
function chip(b) {
  if (b.peta.status !== 'yes' && b.leapingBunny.status !== 'yes') return b.peta.status === 'no' ? "Doesn't pass" : 'Not on either list';
  if (b.parent.testsOnAnimals === 'yes' && b.parent.name && b.parent.name !== b.name) return "Doesn't pass";
  if (b.chinaRetail.status === 'yes') return "Doesn't pass";
  return 'Passes';
}
const fresh = (iso) => iso && (Date.now() - new Date(iso + 'T00:00:00').getTime()) / 864e5 <= 90;
const askable = brands.filter((b) => fresh(b.peta.checked) && fresh(b.leapingBunny.checked) && (b.peta.url || b.leapingBunny.url));
const TOTAL = file.questions.length + askable.length;
const MEADOW = file.questions.filter((q) => q.topic === 'meadow').length;

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8771, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cfb-garden') || '{"items":{}}'));
  const question = async () => (await page.textContent('#practice-q')).trim();
  // Answers the question on screen; returns the question and what the right answer is.
  async function answer(right) {
    const text = await question();
    const brand = /^On Strict, how does (.+) show in C\.F\.B\.\?$/.exec(text);
    const q = byText.get(text);
    const good = brand ? chip(brands.find((b) => b.name === brand[1])) : q.options[0];
    const opts = await page.locator('#practice-box .quiz-opt').allTextContents();
    const n = right ? opts.indexOf(good) : opts.findIndex((o) => o !== good);
    await page.locator('#practice-box .quiz-opt').nth(n).click();
    await page.waitForSelector('#practice-next');
    return { text, q, good, id: brand ? 'brand:' + brands.find((b) => b.name === brand[1]).id : q.id };
  }

  await page.goto(APP + '#home');
  await page.waitForFunction(() => document.getElementById('gd-home-line').textContent);
  check((await page.textContent('#gd-home-line')).startsWith(TOTAL + ' questions'), `Home's card counts ${TOTAL} questions`);
  await page.click('.gd-home');
  await page.waitForSelector('.gd-card');
  check((await page.locator('.gd-card').count()) === 5, 'the Garden shows five habitats');
  check((await page.textContent('#garden-total')) === `0 of ${TOTAL} learned`, `a new garden says 0 of ${TOTAL} learned`);
  check((await page.textContent('.gd-card >> nth=0')).includes(`0 of ${MEADOW} learned`), 'the Meadow counts its own questions');

  // A round in the Meadow: right, guessed, wrong, right, right
  await page.click('.gd-card >> nth=0');
  await page.waitForSelector('#practice-q');
  check((await page.textContent('.quiz-progress')).startsWith('Question 1 of 5'), 'a round has 5 questions');
  const a1 = await answer(true);
  check((await page.textContent('#practice-verdict')) === 'Right', 'a right answer says Right');
  const links = await page.$$eval('#practice-result .sources a', (as) => as.map((a) => a.getAttribute('href')));
  check(links.length === a1.q.src.length && a1.q.src.every((k) => links.includes(file.sources[k].u)), 'the answer links every source of the question');
  check(/checked \d+ [A-Z][a-z]{2} \d{4}/.test(await page.textContent('#practice-result .sources')), 'each source shows the date it was checked');
  check((await page.textContent('#practice-result')).includes(a1.q.why), 'the answer explains why');
  // Next and "I guessed" must be on screen and tappable, clear of the floating tab bar
  const tappable = (sel) => page.evaluate((q) => { const b = document.querySelector(q).getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return b.bottom <= innerHeight && !!hit && !!hit.closest(q); }, sel);
  check(await tappable('#practice-next') && await tappable('#practice-guess'), 'Next and "I guessed" are on screen and not under the tab bar');
  await page.click('#practice-next');

  const a2 = await answer(true);
  await page.click('#practice-guess');
  check((await saved()).items[a2.id].s === 0, '"I guessed" turns a right answer into a miss');
  check(!(await page.$('#practice-guess')), '"I guessed" can only be pressed once');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'practice-next'), 'after "I guessed" the keyboard is on Next');
  await page.click('#practice-next');

  const a3 = await answer(false);
  check((await page.textContent('#practice-verdict')) === 'Not quite', 'a wrong answer says Not quite');
  check((await page.textContent('.gd-answer')).includes(a3.good), 'and shows the right answer');
  check(!(await page.$('#practice-guess')), 'no "I guessed" on a wrong answer');
  await page.click('#practice-next');
  const a4 = await answer(true); await page.click('#practice-next');
  const a5 = await answer(true); await page.click('#practice-next');
  await page.waitForSelector('#practice-again');
  check((await page.textContent('#practice-done')) === '3 of 5 right', 'the round ends with the score (3 of 5: a guess is a miss)');

  let st = await saved();
  const now = Date.now();
  check(st.items[a3.id].due <= now && st.items[a2.id].due <= now, 'missed questions are due at once');
  check(st.items[a1.id].due > now + 4 * 60e3 && st.items[a1.id].s === 1, 'a right one waits 5 minutes');

  // The next round opens with the two missed ones
  await page.click('#practice-again');
  await page.waitForSelector('#practice-q');
  const first = await question();
  check([a2.text, a3.text].includes(first), 'the next round starts with a missed question');
  // A right answer before it is due again doesn't count twice
  await page.goto(APP + '#garden'); await page.waitForSelector('.gd-card');
  check((await page.textContent('.gd-card >> nth=0')).includes('2 to review'), 'the Meadow says 2 to review');
  check((await page.textContent('.gd-card >> nth=0')).includes('Sprouting'), 'the Meadow has started to grow');

  // Five minutes later: the right ones are due; right again makes them learned
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cfb-garden')); for (const k in s.items) if (s.items[k].s) s.items[k].due = Date.now() - 1; localStorage.setItem('cfb-garden', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('.gd-card');
  check((await page.textContent('.gd-card >> nth=0')).includes('5 to review'), 'progress survives a reload');
  await page.click('.gd-card >> nth=0'); await page.waitForSelector('#practice-q');
  const seen = [];
  for (let i = 0; i < 5; i++) { seen.push(await answer(true)); await page.click('#practice-next'); }
  await page.waitForSelector('#practice-again');
  st = await saved();
  check([a1, a4, a5].every((a) => st.items[a.id].s === 2), 'right twice, 5 minutes apart: learned');
  check((await page.textContent('.gd-done')).includes(`3 of ${MEADOW} learned (3 more than before)`), 'the round says what was learned');
  check(st.items[a1.id].due > Date.now() + 23 * 3600e3, 'a learned question next comes back after a day');
  // answering again straight away must not push it further
  await page.evaluate(() => { location.hash = '#garden'; }); await page.waitForSelector('.gd-card');
  const before = st.items[a1.id];
  for (let r = 0; r < 2; r++) { if (r) await page.click('#practice-again'); else await page.goto(APP + '#practice/meadow'); await page.waitForSelector('#practice-q'); for (let i = 0; i < 5; i++) { await answer(true); await page.click('#practice-next'); } await page.waitForSelector('#practice-again'); }
  st = await saved();
  check(st.items[a1.id].s === before.s && st.items[a1.id].due === before.due, 'practising early does not count twice');

  // The Orchard asks about brands, from the data
  await page.evaluate((ids) => { const s = JSON.parse(localStorage.getItem('cfb-garden')); for (const id of ids) s.items[id] = { s: 1, due: Date.now() + 9e8, k: 'w' }; localStorage.setItem('cfb-garden', JSON.stringify(s)); }, file.questions.filter((q) => q.topic === 'orchard').map((q) => q.id));
  await page.goto(APP + '#garden'); await page.reload(); await page.waitForSelector('.gd-card');
  check((await page.textContent('.gd-card >> nth=4')).includes(`of ${file.questions.filter((q) => q.topic === 'orchard').length + askable.length} learned`), `the Orchard holds its written questions plus ${askable.length} brands`);
  await page.click('.gd-card >> nth=4'); await page.waitForSelector('#practice-q');
  let brandOk = true, kinds = new Set();
  for (let i = 0; i < 5; i++) {
    const a = await answer(true);
    if (!a.id.startsWith('brand:') || (await page.textContent('#practice-verdict')) !== 'Right') brandOk = false;
    kinds.add(a.good);
    const hrefs = await page.$$eval('#practice-result .sources a', (as) => as.map((x) => x.getAttribute('href')));
    const b = brands.find((x) => 'brand:' + x.id === a.id);
    if (!hrefs.length || !hrefs.every((h) => [b.peta.url, b.leapingBunny.url, b.parent.url, b.chinaRetail.url].includes(h))) brandOk = false;
    await page.click('#practice-next');
  }
  check(brandOk, 'five brand questions: the right answer matches the Strict rule, with that brand\'s own source links');

  // A brand whose verdict changed since it was learned starts over
  const some = askable[0];
  await page.evaluate((id) => { const s = JSON.parse(localStorage.getItem('cfb-garden')); s.items[id] = { s: 3, due: Date.now() + 9e8, k: 'not-a-verdict' }; localStorage.setItem('cfb-garden', JSON.stringify(s)); }, 'brand:' + some.id);
  await page.goto(APP + '#garden'); await page.reload(); await page.waitForSelector('.gd-card');
  await page.click('.gd-card >> nth=0'); await page.waitForSelector('#practice-q'); await answer(true);
  check(!(await saved()).items['brand:' + some.id], 'an answer learned under an old verdict no longer counts');

  // Learn links to the matching habitat
  await page.goto(APP + '#learn'); await page.click('.learn summary >> nth=1');
  await page.click('.learn details >> nth=1 >> .gd-go');
  await page.waitForSelector('#practice-q');
  check((await page.textContent('#practice-h')) === 'Leafy Garden', 'Learn\'s "Practise this" opens that answer\'s habitat');
  await page.goBack();
  check(await page.evaluate(() => location.hash === '#learn'), 'Back returns to Learn');

  // The round's link back goes back in history, so the phone's Back button then leaves the Sanctuary
  await page.goto(APP + '#home'); await page.click('.gd-home'); await page.waitForSelector('.gd-card');
  await page.click('.gd-card >> nth=3'); await page.waitForSelector('#practice-q'); await answer(true);
  await page.click('[data-screen="practice"] .back'); await page.waitForSelector('.gd-card');
  await page.goBack();
  check(await page.evaluate(() => location.hash === '#home'), 'after "The sanctuary", Back goes to Home, not into a new round');

  // An in-app source is named, not linked (a link would leave the round)
  await page.goto(APP + '#practice/oak'); await page.waitForSelector('#practice-q');
  let own = null; for (let i = 0; i < 5 && own === null; i++) { const a = await answer(true); if (a.q && a.q.src.includes('APP')) own = await page.$$eval('#practice-result .sources a', (as) => as.length); else await page.click('#practice-next'); }
  check(own === 0, 'a question about the app\'s own rule names its source without a link');

  // A resident that has moved in stays, even when the count drops
  await page.evaluate((ids) => { const s = { v: 1, items: {}, best: {} }; for (const id of ids) s.items[id] = { s: 2, due: Date.now() + 9e8, k: 'w' }; localStorage.setItem('cfb-garden', JSON.stringify(s)); }, file.questions.filter((q) => q.topic === 'meadow').map((q) => q.id));
  await page.goto(APP + '#garden'); await page.reload(); await page.waitForSelector('.gd-card');
  check(await page.evaluate(() => window.CFB.garden.residents('meadow')) === 3, 'the Meadow fully learned: three residents');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cfb-garden')); for (const k in s.items) s.items[k] = { s: 0, due: Date.now(), k: 'w' }; localStorage.setItem('cfb-garden', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('.gd-card');
  check(await page.evaluate(() => window.CFB.garden.residents('meadow')) === 3 && (await page.textContent('.gd-card >> nth=0')).includes(`0 of ${MEADOW} learned`), 'after missing them all the count says 0, and nobody has left');

  // Saved progress that parses but makes no sense is cleaned, not trusted
  for (const junk of ['{"v":1,"items":[]}', '{"v":1,"items":{"v1":5,"v2":{"s":"x","due":"y"},"v3":{"s":2}}}']) {
    await page.evaluate((j) => localStorage.setItem('cfb-garden', j), junk);
    await page.goto(APP + '#garden'); await page.reload(); await page.waitForSelector('.gd-card');
    const bar = await page.$eval('.gd-card >> nth=0 >> .gd-bar span', (e) => e.style.width);
    await page.click('.gd-card >> nth=0'); await page.waitForSelector('#practice-q'); const a = await answer(true);
    check(bar === '0%' && (await saved()).items[a.id] && (await saved()).items[a.id].s === 1, `damaged progress (${junk.slice(0, 22)}…) starts clean and saves again`);
  }

  // Stored nonsense must not break the screen
  await page.evaluate(() => localStorage.setItem('cfb-garden', '{oops'));
  await page.goto(APP + '#garden'); await page.reload(); await page.waitForSelector('.gd-card');
  check((await page.textContent('#garden-total')) === `0 of ${TOTAL} learned`, 'broken saved progress starts a new garden instead of failing');

  // Offline
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('.gd-card');
  await page.click('.gd-card >> nth=2'); await page.waitForSelector('#practice-q');
  await answer(true);
  check((await page.textContent('#practice-verdict')) === 'Right', 'offline: a round still plays');
  await ctx.setOffline(false);

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
