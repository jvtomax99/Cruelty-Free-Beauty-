// Checks tools/add-brand.cjs without the network: fake PETA and Leaping Bunny answers
// (ADD_BRAND_FAKE) against a scratch copy of data/brands.json (BRANDS_FILE).
//   node tools/test-add-brand.cjs
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REAL = path.join(__dirname, '..', 'data', 'brands.json');
const TOOL = path.join(__dirname, 'add-brand.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-add-'));
const DATA = path.join(dir, 'brands.json');
const today = new Date().toISOString().slice(0, 10);

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

const peta = (title, status, slug, vegan = false) => ({ title, url: `https://crueltyfree.peta.org/company/${slug}/`, status, verdict: status === 'yes' ? "PETA: company that doesn't test" : status === 'no' ? 'PETA: does test on animals' : 'PETA: may not be cruelty-free (not on its list)', vegan, countries: [] });
const lb = (tradingName, id, parentTests = false, company = tradingName) => ({ company, tradingName, url: `https://www.leapingbunny.org/ShopBrandDetail?BrandId=${id}`, parentTests });

function run(name, fake, extra = [], viaArg = false) {
  const f = path.join(dir, 'fake.json');
  fs.writeFileSync(f, JSON.stringify(fake));
  const nf = path.join(dir, 'name.txt');
  fs.writeFileSync(nf, name);
  const args = viaArg ? [TOOL, name, ...extra] : [TOOL, '--name-file', nf, ...extra];
  const r = spawnSync(process.execPath, args, { env: { ...process.env, ADD_BRAND_FAKE: f, BRANDS_FILE: DATA }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
const checkData = () => spawnSync(process.execPath, [path.join(__dirname, 'check-brands.cjs')], { env: { ...process.env, BRANDS_FILE: DATA, NODE_USE_ENV_PROXY: '1' }, encoding: 'utf8' });

fs.copyFileSync(REAL, DATA);
const before = fs.readFileSync(DATA, 'utf8');

// Listed by PETA as "doesn't test": drafted, nothing written without --write.
let r = run('Kaja', { peta: [peta('Kaja Beauty', 'yes', 'kaja-beauty', true), peta('Kajal Co', 'yes', 'kajal')], leapingBunny: [] });
check(r.code === 0 && /"id": "kaja-beauty"/.test(r.out) && /"vegan": "all"/.test(r.out), `PETA "doesn't test": drafted as kaja-beauty, vegan from PETA (exit ${r.code})`);
check(fs.readFileSync(DATA, 'utf8') === before, 'without --write the data file is untouched');

// --write adds it, keeps the file's formatting, and the result passes check-brands.
r = run('Kaja', { peta: [peta('Kaja Beauty', 'yes', 'kaja-beauty', true)], leapingBunny: [] }, ['--site', 'https://www.kajabeauty.com/', '--write']);
const after = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const k = after.brands.find((b) => b.id === 'kaja-beauty');
check(r.code === 0 && !!k && after.brands.length === JSON.parse(before).brands.length + 1, '--write appends one brand');
check(k && k.peta.url === 'https://crueltyfree.peta.org/company/kaja-beauty/' && k.peta.checked === today && k.added === today, 'its PETA claim links the page and is dated today');
check(k && k.whereToBuy[0] && k.whereToBuy[0].url === 'https://www.kajabeauty.com/' && k.whereToBuy[0].linkType === 'plain', 'the official site becomes a plain buy link');
check(fs.readFileSync(DATA, 'utf8') === JSON.stringify(after, null, 1) + (before.endsWith('\n') ? '\n' : ''), 'the file keeps its one-space formatting');
const cb = checkData();
check(cb.status === 0, `the new record passes check-brands${cb.status ? ': ' + cb.stdout.split('Errors')[1] : ''}`);

// Second time: already in the app.
r = run('kaja beauty', { peta: [], leapingBunny: [] });
check(r.code === 3, `the same brand again: "already in the app" (exit ${r.code})`);

// The certifier's name is one we have, though she typed the company's legal name.
r = run('Physicians Formula Holdings', { peta: [], leapingBunny: [lb('Physicians Formula', 1, false, 'Physicians Formula Holdings')] });
check(r.code === 3 && after.brands.filter((b) => /physicians/.test(b.id)).length === 1, `legal company name of a brand we have: "already in the app", no second copy (exit ${r.code})`);

// "Rare" finds PETA's "Rare Beauty", which we already have: in the app, named.
r = run('Rare', { peta: [peta('Rare Beauty', 'yes', 'rare-beauty')], leapingBunny: [] });
check(r.code === 3 && /Rare Beauty/.test(r.out), `"Rare": already in the app as Rare Beauty (exit ${r.code})`);
// But "Rare" never matches a different brand that only starts with it.
r = run('Rare', { peta: [peta('Rare Earth Minerals', 'yes', 'rare-earth')], leapingBunny: [] });
check(r.code === 2, `"Rare" is not "Rare Earth Minerals" (exit ${r.code})`);

// Not listed at all.
r = run('Zzqx Glow Lab', { peta: [], leapingBunny: [] });
check(r.code === 2 && /Not listed/.test(r.out), `listed by neither: not added (exit ${r.code})`);

// PETA says it tests, Leaping Bunny doesn't certify it: not added.
r = run('Testco', { peta: [peta('Testco', 'no', 'testco')], leapingBunny: [] });
check(r.code === 2 && /tests on animals/.test(r.out), `PETA says it tests: not added, and says why (exit ${r.code})`);

// PETA "may not be cruelty-free" alone doesn't count.
r = run('Maybeco', { peta: [peta('Maybeco', 'unknown', 'maybeco')], leapingBunny: [] });
check(r.code === 2, `PETA "may not be cruelty-free" alone: not added (exit ${r.code})`);

// Two different Leaping Bunny entries with the name: ask which.
r = run('Twin', { peta: [], leapingBunny: [lb('Twin', 10), lb('Twin', 11)] });
check(r.code === 4 && /Unclear/.test(r.out), `two certifier entries with the name: ask which (exit ${r.code})`);

// Leaping Bunny flags a parent that tests: stop until the parent is named.
r = run('Bunnyco', { peta: [], leapingBunny: [lb('Bunnyco', 20, true)] });
check(r.code === 5 && !/"id"/.test(r.out), `Leaping Bunny flags a parent that tests: stops, asks for its name (exit ${r.code})`);
r = run('Bunnyco', { peta: [], leapingBunny: [lb('Bunnyco', 20, true)] }, ['--parent', 'Big Parent Co']);
check(r.code === 0 && /"name": "Big Parent Co"/.test(r.out) && /"testsOnAnimals": "yes"/.test(r.out), 'with --parent: drafted with the named parent that tests');

// A name with shell characters is only ever text.
r = run('Glow $(touch /tmp/cfb-pwned) & Co', { peta: [], leapingBunny: [] });
check(r.code === 2 && !fs.existsSync('/tmp/cfb-pwned'), 'a name with $(...) from --name-file is only text');

// check-brands rejects a parent that tests with no name.
const bad = JSON.parse(before);
bad.brands[0].parent = { name: null, testsOnAnimals: 'yes', url: 'https://www.leapingbunny.org/ShopBrandDetail?BrandId=1', note: 'x', checked: today };
fs.writeFileSync(DATA, JSON.stringify(bad, null, 1));
const cb2 = checkData();
check(cb2.status === 1 && /has no name/.test(cb2.stdout), 'check-brands rejects a parent that tests with no name');

fs.rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
process.exit(failures ? 1 : 0);
