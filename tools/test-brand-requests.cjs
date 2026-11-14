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
  fail: ['Flaky'],
}));
const form = (name, site = '_No response_', proof = '_No response_') => `### Brand name\n\n${name}\n\n### Brand's website (if you have it)\n\n${site}\n\n### PETA or Leaping Bunny page (if you have it)\n\n${proof}`;
const issue = (number, login, body, labels = ['add-brand'], title = 'Add brand: x') => ({ number, title, body, user: { login }, labels: labels.map((name) => ({ name })) });
fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([
  issue(1, 'cfbbeauty', form('Kaja', 'https://www.kajabeauty.com/').replace(/\n/g, '\r\n')),
  issue(2, 'cfbbeauty', form('Juice Beauty', 'javascript:alert(1)')),
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
  issue(13, 'cfbbeauty', '', ['add-brand'], ''),
  issue(14, 'cfbbeauty', form('Flaky')),
  issue(15, 'cfbbeauty', form('Flaky'), ['add-brand', 'retrying']),
  issue(16, 'cfbbeauty', form('Hidden Gem', '_No response_', 'https://crueltyfree.peta.org/company/hidden-gem/')),
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

check(r.status === 1, `the run ends with exit 1, because some requests need Jose (exit ${r.status})`);
check(/13 request\(s\) to check/.test(out), 'it skips the untrusted author, the one left for Jose and the pull request (13 to check)');
check(calls(3).length === 0 && calls(9).length === 0 && calls(12).length === 0, 'no GitHub call at all for the untrusted issue, the held one or the pull request');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const kaja = data.brands.find((b) => b.id === 'kaja-beauty'), juice = data.brands.find((b) => b.id === 'juice-beauty');
check(!!kaja && !!juice, 'Kaja Beauty and Juice Beauty are written to the data');
check(kaja && kaja.whereToBuy[0] && kaja.whereToBuy[0].url === 'https://www.kajabeauty.com/', "the website from her form becomes Kaja's buy link (form sent with Windows line endings)");
check(juice && juice.whereToBuy.length === 0, 'a javascript: website is dropped, never a buy link');
check(said(1, /Added to C\.F\.B\.: \*\*Kaja Beauty\*\*, listed as cruelty-free by PETA/) && said(1, /#brand\/kaja-beauty/) && closed(1, 'completed'), '#1: "Added", with its certifier and link, closed');
check(said(2, /Leaping Bunny/) && said(2, /No buy link yet/) && closed(2, 'completed'), '#2: added from Leaping Bunny, and told a website gives it a buy link');
check(/bump CACHE_VERSION/.test(out) && /git commit and push: Add Kaja Beauty, Juice Beauty \(the founder's requests #1, #2\)/.test(out), 'one commit for both, with CACHE_VERSION bumped');
check(said(4, /already in the app/) && said(4, /#brand\/milani/) && closed(4, 'completed'), '#4 Milani: already in the app, with its link, closed');
check(said(5, /couldn't find \*\*Zzqx Glow Lab\*\* on PETA's or Leaping Bunny's/) && said(5, /send it again with its PETA or Leaping Bunny page/) && closed(5, 'not_planned'), '#5: not listed, closed as not planned, told how to ask again');
check(said(6, /PETA says \*\*Testco\*\* tests on animals/) && closed(6, 'not_planned'), '#6: PETA says it tests, closed as not planned');
check(said(7, /@jvtomax99 will check which one/) && labelled(7, 'needs-jose') && !closed(7, 'completed'), '#7: two matches, left open for Jose, who is mentioned');
check(said(8, /parent company tests/) && labelled(8, 'needs-jose') && !closed(8, 'completed'), '#8: a parent that tests, left open for Jose');
check(!fs.existsSync('/tmp/cfb-pwned2') && closed(10, 'not_planned'), '#10: a name with $(...) is only text; a javascript: link is dropped');
const at = (re) => out.split('\n').findIndex((l) => re.test(l));
check(said(11, /is in the app now/) && said(11, /kaja-beauty/) && closed(11, 'completed') && at(/\/issues\/11\/comments/) > at(/git commit and push/), '#11: a duplicate of a brand added in this run (title only, no form) is answered only after it goes live');
check(said(13, /couldn't find a brand name/) && labelled(13, 'needs-jose'), '#13: no name at all: left for Jose');
check(said(14, /couldn't reach PETA or Leaping Bunny/) && said(14, /@jvtomax99/) && labelled(14, 'retrying') && !closed(14, 'completed'), '#14: a failed lookup: said once, mentions Jose, labelled retrying, left open');
check(calls(15).length === 0, '#15: a failed lookup already labelled retrying: tried again silently');
check(said(16, /you sent https:\/\/crueltyfree\.peta\.org\/company\/hidden-gem\//) && labelled(16, 'needs-jose') && !closed(16, 'not_planned'), '#16: not found, but she sent a certifier page: left for Jose, not closed');
check(!/Hidden Gem|Flaky/.test(JSON.stringify(data.brands.map((b) => b.name))), 'nothing unconfirmed was written to the data');
check(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8') === swBefore, "a dry run never touches the real sw.js");
const cb = spawnSync(process.execPath, [path.join(__dirname, 'check-brands.cjs')], { encoding: 'utf8', env: { ...process.env, BRANDS_FILE: DATA, NODE_USE_ENV_PROXY: '1' } });
check(cb.status === 0, 'the data with both new brands passes check-brands');

// ---- Part 2: the real git steps, against a throwaway copy of the repo ----
// A bare "origin", a stale working clone, and a change merged to main meanwhile (it bumps
// CACHE_VERSION too). The run must keep that change, bump once more, and push one commit.
const sh = (cwd, cmd, args) => { const x = spawnSync(cmd, args, { cwd, encoding: 'utf8' }); if (x.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${x.stderr}`); return x.stdout.trim(); };
const g = path.join(dir, 'git');
fs.mkdirSync(g);
const seed = path.join(g, 'seed'), origin = path.join(g, 'origin.git'), work = path.join(g, 'work');
fs.cpSync(path.join(__dirname, '..'), seed, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src.slice(path.join(__dirname, '..').length)) });
sh(g, 'git', ['init', '-q', '--bare', '-b', 'main', origin]);
for (const [cwd, args] of [[seed, ['init', '-q', '-b', 'main']], [seed, ['add', '-A']], [seed, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'seed']], [seed, ['push', '-q', origin, 'main']]]) sh(cwd, 'git', args);
sh(g, 'git', ['clone', '-q', origin, work]);
sh(work, 'git', ['config', 'user.name', 'brand check']); sh(work, 'git', ['config', 'user.email', 'b@c']);
const vOf = (txt) => Number(txt.match(/cfb-v(\d+)/)[1]);
const v0 = vOf(fs.readFileSync(path.join(seed, 'sw.js'), 'utf8'));
fs.writeFileSync(path.join(seed, 'sw.js'), fs.readFileSync(path.join(seed, 'sw.js'), 'utf8').replace(`cfb-v${v0}"`, `cfb-v${v0 + 1}"`));
fs.appendFileSync(path.join(seed, 'README.md'), '\nMerged meanwhile.\n');
sh(seed, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'a change merged meanwhile']);
sh(seed, 'git', ['push', '-q', origin, 'main']);
fs.writeFileSync(path.join(dir, 'one.json'), JSON.stringify([issue(1, 'cfbbeauty', form('Kaja', 'https://www.kajabeauty.com/'))]));
const live = (extra = {}) => spawnSync(process.execPath, [path.join(work, 'tools', 'process-brand-requests.cjs')], { cwd: work, encoding: 'utf8', env: { ...process.env, NO_GITHUB: '1', ISSUES_FILE: path.join(dir, 'one.json'), ADD_BRAND_FAKE: path.join(dir, 'fake.json'), NO_LINK_CHECK: '1', SKIP_SITE_CHECK: '1', BRANDS_FILE: '', ...extra } });
const r2 = live();
const shown = (file) => sh(origin, 'git', ['show', `main:${file}`]);
check(r2.status === 0, `real git: the run publishes (exit ${r2.status})${r2.status ? '\n' + r2.stdout + r2.stderr : ''}`);
check(sh(origin, 'git', ['log', '-1', '--format=%s', 'main']) === "Add Kaja Beauty (the founder's request #1)", 'real git: one commit on main, named for the brand and her request');
check(/Merged meanwhile/.test(shown('README.md')), 'real git: the change merged meanwhile is kept');
check(vOf(shown('sw.js')) === v0 + 2, `real git: CACHE_VERSION is one more than main's (v${v0 + 2}), not a clash with it`);
check(JSON.parse(shown('data/brands.json')).brands.some((b) => b.id === 'kaja-beauty'), 'real git: Kaja Beauty is in the data on main');
check(sh(work, 'git', ['status', '--porcelain']) === '', 'real git: the working copy is clean afterwards');
check(/issues\/1\/comments.*Added to C\.F\.B\./.test(r2.stdout), 'real git: "Added" is said only after the push');

// A check that fails (dates read as if today were 2020): nothing is pushed, the copy is put back.
fs.writeFileSync(path.join(dir, 'one.json'), JSON.stringify([issue(2, 'cfbbeauty', form('Juice Beauty'))]));
const before = sh(origin, 'git', ['rev-parse', 'main']);
const r3 = live({ CHECK_DATE: '2020-01-01' });
check(r3.status === 1 && sh(origin, 'git', ['rev-parse', 'main']) === before, 'real git: a failing check pushes nothing');
check(/issues\/2\/comments.*couldn't go live: the brand data check failed/.test(r3.stdout) && /issues\/2\/labels.*needs-jose/.test(r3.stdout), 'real git: she is told it could not go live, with the reason, and it is left for Jose');
check(sh(work, 'git', ['status', '--porcelain']) === '', 'real git: the working copy is clean after a failed check');

if (failures) console.log('\n--- output ---\n' + out);
fs.rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} failed.` : '\nAll passed.');
process.exit(failures ? 1 : 0);
