// Checks tools/process-brand-requests.cjs (the "Add a brand" GitHub Action) without the network or
// GitHub: made-up issues (ISSUES_FILE), fake certifier answers (ADD_BRAND_FAKE), a scratch copy of
// the data (BRANDS_FILE), and DRY_RUN, which prints every GitHub call and git step instead.
//   node tools/test-brand-requests.cjs
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-reqs-'));
const DATA = path.join(dir, 'brands.json');
fs.copyFileSync(path.join(__dirname, '..', 'data', 'brands.json'), DATA);
const swBefore = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

const peta = (title, status, slug) => ({ title, url: `https://crueltyfree.peta.org/company/${slug}/`, status, verdict: status === 'yes' ? "PETA: company that doesn't test" : 'PETA: does test on animals', vegan: false, countries: [] });
const lb = (name, id, parentTests = false) => ({ company: name, tradingName: name, url: `https://www.leapingbunny.org/ShopBrandDetail?BrandId=${id}`, parentTests });
fs.writeFileSync(path.join(dir, 'fake.json'), JSON.stringify({
  peta: [peta('Kaja Beauty', 'yes', 'kaja-beauty'), peta('Testco', 'no', 'testco')],
  leapingBunny: [lb('Juice Beauty', 5), lb('Bunnyco', 6, true), lb('Twin', 7), lb('Twin', 8)],
}));
const form = (name, site = '_No response_') => `### Brand name\n\n${name}\n\n### Brand's website (if you have it)\n\n${site}\n\n### PETA or Leaping Bunny page (if you have it)\n\n_No response_`;
const issue = (number, login, body, labels = ['add-brand'], title = 'Add brand: x') => ({ number, title, body, user: { login }, labels: labels.map((name) => ({ name })) });
fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([
  issue(1, 'cfbbeauty', form('Kaja', 'https://www.kajabeauty.com/')),
  issue(2, 'cfbbeauty', form('Juice Beauty')),
  issue(3, 'someone-else', form('Evilco')),
  issue(4, 'cfbbeauty', form('Milani')),
  issue(5, 'cfbbeauty', form('Zzqx Glow Lab')),
  issue(6, 'cfbbeauty', form('Testco')),
  issue(7, 'cfbbeauty', form('Twin')),
  issue(8, 'cfbbeauty', form('Bunnyco')),
  issue(9, 'cfbbeauty', form('Kiko Milano'), ['add-brand', 'needs-jose']),
  issue(10, 'jvtomax99', form('Glow $(touch /tmp/cfb-pwned2) Co', 'javascript:alert(1)')),
  issue(11, 'cfbbeauty', '', ['add-brand'], 'Add brand: kaja beauty'),
  { ...issue(12, 'cfbbeauty', form('Kaja')), pull_request: {} },
]));

const r = spawnSync(process.execPath, [path.join(__dirname, 'process-brand-requests.cjs')], {
  encoding: 'utf8',
  env: { ...process.env, DRY_RUN: '1', ISSUES_FILE: path.join(dir, 'issues.json'), ADD_BRAND_FAKE: path.join(dir, 'fake.json'), BRANDS_FILE: DATA, NO_LINK_CHECK: '1', SKIP_SITE_CHECK: '1' },
});
const out = r.stdout + r.stderr;
const calls = (n) => out.split('\n').filter((l) => l.includes(`/issues/${n}`));
const said = (n, re) => calls(n).some((l) => l.includes('/comments') && re.test(l));
const closed = (n, reason) => calls(n).some((l) => l.startsWith('[dry run] PATCH') && l.includes(`"state_reason":"${reason}"`));
const labelled = (n, name) => calls(n).some((l) => l.includes('/labels') && l.includes(name));

check(r.status === 0, `the run ends cleanly (exit ${r.status})`);
check(/9 request\(s\) to check/.test(out), 'it skips the untrusted author, the one left for Jose and the pull request (9 to check)');
check(calls(3).length === 0 && calls(9).length === 0 && calls(12).length === 0, 'no GitHub call at all for the untrusted issue, the held one or the pull request');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const kaja = data.brands.find((b) => b.id === 'kaja-beauty'), juice = data.brands.find((b) => b.id === 'juice-beauty');
check(!!kaja && !!juice, 'Kaja Beauty and Juice Beauty are written to the data');
check(kaja && kaja.whereToBuy[0] && kaja.whereToBuy[0].url === 'https://www.kajabeauty.com/', "the website from her form becomes Kaja's buy link");
check(said(1, /Added to C\.F\.B\.: \*\*Kaja Beauty\*\*, listed as cruelty-free by PETA/) && said(1, /#brand\/kaja-beauty/) && closed(1, 'completed'), '#1: "Added", with its certifier and link, closed');
check(said(2, /Leaping Bunny/) && said(2, /No buy link yet/) && closed(2, 'completed'), '#2: added from Leaping Bunny, and told a website gives it a buy link');
check(/bump CACHE_VERSION/.test(out) && /git commit and push: Add Kaja Beauty, Juice Beauty \(the founder's requests #1, #2\)/.test(out), 'one commit for both, with CACHE_VERSION bumped');
check(said(4, /already in the app/) && said(4, /#brand\/milani/) && closed(4, 'completed'), '#4 Milani: already in the app, with its link, closed');
check(said(5, /isn't on PETA's or Leaping Bunny's/) && closed(5, 'not_planned'), "#5: not listed, closed as not planned");
check(said(6, /PETA says \*\*Testco\*\* tests on animals/) && closed(6, 'not_planned'), '#6: PETA says it tests, closed as not planned');
check(said(7, /Jose will check which one/) && labelled(7, 'needs-jose') && !closed(7, 'completed'), '#7: two matches, left open for Jose');
check(said(8, /parent company tests/) && labelled(8, 'needs-jose') && !closed(8, 'completed'), '#8: a parent that tests, left open for Jose');
check(!fs.existsSync('/tmp/cfb-pwned2') && closed(10, 'not_planned'), '#10: a name with $(...) is only text; a javascript: link is dropped');
check(said(11, /already in the app/) && said(11, /kaja-beauty/), '#11: a request with no form body uses its title; added earlier in the run, so "already in the app"');
check(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8') === swBefore, "a dry run never touches the real sw.js");
const cb = spawnSync(process.execPath, [path.join(__dirname, 'check-brands.cjs')], { encoding: 'utf8', env: { ...process.env, BRANDS_FILE: DATA, NODE_USE_ENV_PROXY: '1' } });
check(cb.status === 0, 'the data with both new brands passes check-brands');

if (failures) console.log('\n--- output ---\n' + out);
fs.rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
process.exit(failures ? 1 : 0);
