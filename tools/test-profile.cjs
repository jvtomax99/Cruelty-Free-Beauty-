// Checks the beauty profile quiz and routine in a real browser (phase 4 "Done when").
//   node tools/test-profile.cjs      (serves the repo's parent folder on port 8768)
// Expected routine picks are worked out here from data/brands.json, independently of profile.js.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = `http://localhost:8768/${path.basename(path.resolve(__dirname, '..'))}/`;
const APP = BASE + '?intro=0';   // skip the launch show: this test is about the profile
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); } });
});

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'brands.json'), 'utf8')).brands;
const certified = (b) => b.peta.status === 'yes' || b.leapingBunny.status === 'yes';
const strict = (b) => certified(b) && !(b.parent.testsOnAnimals === 'yes' && b.parent.name !== b.name) && b.chinaRetail.status !== 'yes';
function expected(step, { budget, vegan }, pass) {
  return data.filter((b) => b.sells && b.sells[step] && pass(b) && (budget === 'any' || b.price === budget) && (vegan !== 'yes' || b.vegan === 'all'))
    .sort((x, y) => ((x.peta.status === 'yes' && x.leapingBunny.status === 'yes' ? 0 : 1) - (y.peta.status === 'yes' && y.leapingBunny.status === 'yes' ? 0 : 1)) || x.name.localeCompare(y.name))
    .slice(0, 3).map((b) => b.name);
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  await new Promise((r) => server.listen(8768, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  async function takeQuiz(labels) {
    await page.click('#pf-start');
    for (const l of labels) await page.click(`.quiz-opt >> text="${l}"`);
    await page.waitForSelector('.pf-card');
  }
  const stepNames = (step) => page.$$eval('.rt-step', (els, s) => {
    const el = els.find((e) => e.querySelector('h3').textContent.toLowerCase().includes(s));
    return el ? [...el.querySelectorAll('.rt-brand')].map((a) => a.textContent) : null;
  }, step);

  await page.goto(APP + '#profile', { waitUntil: 'networkidle' });
  check(/Eight quick questions/.test(await page.textContent('#profile-app')), 'Profile opens on the quiz intro');

  // Quiz 1: warm by majority (green veins, gold, burns), $$ budget, not vegan-only
  await takeQuiz(['Combination', 'Medium', 'Green', 'Gold', 'Burns', 'Natural', '$$ Mid', 'No, either is fine']);
  const sum = await page.textContent('.pf-sum');
  check(/Combination skin · Medium · Warm undertone · Natural finish · \$\$ Mid/.test(sum), `profile summary: "${sum}"`);
  for (const step of ['foundation', 'concealer', 'blush', 'bronzer', 'lip']) {
    const got = await stepNames(step), want = expected(step, { budget: '$$', vegan: 'no' }, strict);
    check(JSON.stringify(got) === JSON.stringify(want), `${step} under Strict, $$: ${JSON.stringify(got)}`);
  }
  check(/Tell the shade finder: medium depth, warm undertone/.test(await page.textContent('#profile-app')), 'shade-finder tip uses depth and undertone');
  check(!/in stock/i.test(await page.textContent('#profile-app')), 'never says "in stock"');

  check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'pf-h', 'after the last answer, focus is on the profile heading');
  check(/don't change the picks yet/.test(await page.textContent('#profile-app')), 'says plainly that skin type and finish do not change the picks');
  const tiny = await page.$$eval('.rt-step a', (as) => as.filter((a) => a.getBoundingClientRect().height < 44).length);
  check(tiny === 0, 'every routine link is at least 44 px tall');

  // Answers survive a reload; undertone can be changed by hand
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.pf-card');
  check(/Warm undertone/.test(await page.textContent('.pf-sum')), 'profile survives a reload');
  await page.click('[data-tone=cool]');
  check(/Cool undertone/.test(await page.textContent('.pf-sum')) && /set by you/.test(await page.textContent('.pf-tone')), 'undertone can be set by hand');

  // Strictness from the Brands screen carries over
  await page.goto(APP + '#brands'); await page.click('.mode-btn[data-mode=certified]');
  await page.goto(APP + '#profile'); await page.waitForSelector('.pf-card');
  const fC = await stepNames('foundation'), fCwant = expected('foundation', { budget: '$$', vegan: 'no' }, certified);
  check(JSON.stringify(fC) === JSON.stringify(fCwant), `foundation under Certified follows the Brands switch: ${JSON.stringify(fC)}`);
  await page.goto(APP + '#brands'); await page.click('.mode-btn[data-mode=strict]');
  await page.goto(APP + '#profile'); await page.waitForSelector('.pf-card');

  // Quiz 2: tie gives neutral; vegan-only and any budget
  await page.click('#pf-retake');
  await page.click('.quiz-opt >> text="Dry"'); await page.click('.quiz-opt >> text="Deep"');
  await page.click('.quiz-opt >> text="Blue or purple"'); await page.click('.quiz-opt >> text="Gold"');
  await page.click('.quiz-back'); // Back works mid-quiz
  check(/Which jewelry/.test(await page.textContent('.quiz-q')), 'Back returns to the previous question');
  await page.click('.quiz-opt >> text="Gold"'); await page.click('.quiz-opt >> text="A bit of both"');
  await page.click('.quiz-opt >> text="Dewy"'); await page.click('.quiz-opt >> text="Any"'); await page.click('.quiz-opt >> text="Yes"');
  await page.waitForSelector('.pf-card');
  check(/Neutral undertone/.test(await page.textContent('.pf-sum')), 'a cool / warm / neutral split gives Neutral');
  const v = await stepNames('foundation'), vwant = expected('foundation', { budget: 'any', vegan: 'yes' }, strict);
  check(JSON.stringify(v) === JSON.stringify(vwant), `vegan-only foundation: ${JSON.stringify(v)}`);

  // Clear wipes the phone's copy
  await page.click('#pf-clear');
  check(await page.evaluate(() => localStorage.getItem('cfb-profile')) === null, '"Clear my answers" removes them from the phone');
  check(/Eight quick questions/.test(await page.textContent('#profile-app')), 'after clearing, the quiz intro shows again');

  // A damaged saved profile falls back to the quiz intro instead of a blank screen
  await page.evaluate(() => localStorage.setItem('cfb-profile', '{"skin":"dry","budget":"any"}'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(APP + '#profile');
  await page.waitForTimeout(500);
  check(/Eight quick questions/.test(await page.textContent('#profile-app')), 'a damaged saved profile shows the quiz intro');

  // A retake left halfway is still there after visiting another screen
  await page.click('#pf-start'); await page.click('.quiz-opt >> text="Oily"');
  await page.goto(APP + '#brands'); await page.goto(APP + '#profile'); await page.waitForTimeout(300);
  check(/2 of 8/.test(await page.textContent('#profile-app')), 'a quiz in progress survives switching screens');

  // Offline
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#pf-start', { timeout: 8000 }).catch(() => {});
  check(!!(await page.$('#pf-start')), 'offline: the quiz still opens');
  await ctx.setOffline(false);

  check(errors.length === 0, `no script errors${errors.length ? ': ' + errors.join('; ') : ''}`);
  await browser.close(); server.close();
  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
