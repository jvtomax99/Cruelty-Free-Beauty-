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
const cfi = (name, slug) => ({ name, url: `https://www.crueltyfreeinternational.org/approved-brands/listing/${slug}/`, regions: 'Europe' });
const lb = (name, id, parentTests = false) => ({ company: name, tradingName: name, url: `https://www.leapingbunny.org/ShopBrandDetail?BrandId=${id}`, parentTests });
fs.writeFileSync(path.join(dir, 'fake.json'), JSON.stringify({
  peta: [peta('Kaja Beauty', 'yes', 'kaja-beauty'), peta('Testco', 'no', 'testco')],
  leapingBunny: [lb('Juice Beauty', 5), lb('Bunnyco', 6, true), lb('Twin', 7), lb('Twin', 8)],
  cfi: [cfi('Euroglow', 'euroglow')],
  fail: ['Flaky'],
}));
const form = (name, site = '_No response_', proof = '_No response_') => `### Brand name\n\n${name}\n\n### Brand's website (if you have it)\n\n${site}\n\n### Certifier page, from PETA, Leaping Bunny or Cruelty Free International (if you have it)\n\n${proof}`;
// The optional details boxes, as the form writes them.
const box = (label, v) => `\n\n### ${label}\n\n${v || '_No response_'}`;
const more = (d) => box('Parent company (who owns the brand)', d.parent) + box('Link that shows who owns it', d.parentLink)
  + box('Sold in mainland China stores? (yes or no)', d.china) + box('Link that shows where it sells', d.chinaLink)
  + box('Price ($ drugstore, $$ mid, $$$ luxury)', d.price) + box('A store that carries it', d.store) + box('Store link (the brand\'s page at that store)', d.storeLink);
const detailsForm = (name, d) => `### Brand name\n\n${name}` + more(d);
fs.writeFileSync(path.join(dir, 'details.json'), JSON.stringify({
  pages: {
    'https://glowholdings.example/our-brands': 'Our brands. Glow Holdings is proud to own Celavi and two other labels.',
    'https://www.ulta.com/brand/celavi': 'Shop Celavi at Ulta Beauty. Celavi lipstick, Celavi blush.',
    'https://credobeauty.com/brands/juice-beauty': 'Juice Beauty at Credo: clean makeup.',
    'https://nopage.example/about': 'About us. We make many things.',
    'https://kindgroup.example/brands': 'The Kind Group family: Milani, and more.',
    'https://store.example/milani': { text: 'Milani at our store.', url: 'https://shopmy.us/redirected' },
    'https://news.example/self-care': "L'Oréal news: treat yourself to a shelf of self-care.",
  },
  peta: {
    'Glow Holdings': [{ title: 'Glow Holdings', url: 'https://crueltyfree.peta.org/company/glow-holdings/', status: 'no', verdict: 'PETA: does test on animals' }],
    'The Kind Group Inc.': [{ title: 'Kind Group', url: 'https://crueltyfree.peta.org/company/kind-group/', status: 'yes', verdict: "PETA: company that doesn't test" }],
    'Nearby': [{ title: 'Nearby Labs', url: 'https://crueltyfree.peta.org/company/nearby-labs/', status: 'yes', verdict: "PETA: company that doesn't test" }],
  },
}));
// The form as it was before Cruelty Free International was added: issues sent then still work.
const oldForm = (name, proof) => `### Brand name\n\n${name}\n\n### Brand's website (if you have it)\n\n_No response_\n\n### PETA or Leaping Bunny page (if you have it)\n\n${proof}`;
const issue = (number, login, body, labels = ['add-brand'], title = 'Add brand: x') => ({ number, title, body, user: { login }, labels: labels.map((name) => ({ name })) });
fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([
  issue(1, 'cfbbeauty', form('Kaja', 'https://www.kajabeauty.com/').replace(/\n/g, '\r\n')),
  issue(2, 'cfbbeauty', form('Juice Beauty', 'javascript:alert(1)') + more({ store: 'Credo', storeLink: 'https://credobeauty.com/brands/juice-beauty' })),
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
  issue(16, 'cfbbeauty', oldForm('Hidden Gem', 'https://crueltyfree.peta.org/company/hidden-gem/')),
  issue(17, 'cfbbeauty', form('Euroglow', 'https://euroglow.example/')),
  issue(18, 'cfbbeauty', form('Lost Euro', '_No response_', 'https://www.crueltyfreeinternational.org/approved-brands/listing/lost-euro/')),
  issue(19, 'cfbbeauty', detailsForm('Celavi', { parent: 'Glow Holdings', parentLink: 'https://glowholdings.example/our-brands', china: 'yes', chinaLink: 'https://cn.example/celavi', price: '$', store: 'Ulta', storeLink: 'https://www.ulta.com/brand/celavi' }), ['add-brand'], 'Details: Celavi'),
  issue(20, 'cfbbeauty', form('Milani') + more({ price: '$$', store: 'My picks', storeLink: 'https://shopmy.us/collections/123', parent: 'Nopage Inc', parentLink: 'https://nopage.example/about' })),
  issue(21, 'cfbbeauty', detailsForm('Notabrand Zz', { price: '$' }), ['add-brand'], 'Details: Notabrand Zz'),
  issue(22, 'cfbbeauty', detailsForm('Milani', {}), ['add-brand'], 'Details: Milani'),
  issue(23, 'cfbbeauty', detailsForm('Milani', { parent: 'The Kind Group Inc.', parentLink: 'https://kindgroup.example/brands', store: 'Our store', storeLink: 'https://store.example/milani' }), ['add-brand'], 'Details: Milani'),
  issue(24, 'cfbbeauty', detailsForm('e.l.f. Cosmetics', { parent: "L'Oréal", parentLink: 'https://news.example/self-care' }), ['add-brand'], 'Details: e.l.f.'),
]));

const r = spawnSync(process.execPath, [path.join(__dirname, 'process-brand-requests.cjs')], {
  encoding: 'utf8',
  env: { ...process.env, DRY_RUN: '1', ISSUES_FILE: path.join(dir, 'issues.json'), ADD_BRAND_FAKE: path.join(dir, 'fake.json'), BRAND_DETAILS_FAKE: path.join(dir, 'details.json'), BRANDS_FILE: DATA, NO_LINK_CHECK: '1', SKIP_SITE_CHECK: '1' },
});
const out = r.stdout + r.stderr;
const calls = (n) => out.split('\n').filter((l) => l.includes(`/issues/${n}`));
const said = (n, re) => calls(n).some((l) => l.includes('/comments') && re.test(l));
const closed = (n, reason) => calls(n).some((l) => l.startsWith('[dry run] PATCH') && l.includes(`"state_reason":"${reason}"`));
const labelled = (n, name) => calls(n).some((l) => l.includes('/labels') && l.includes(name));

check(r.status === 1, `the run ends with exit 1, because some requests need Jose (exit ${r.status})`);
check(/21 request\(s\) to check/.test(out), 'it skips the untrusted author, the one left for Jose and the pull request (21 to check)');
check(calls(3).length === 0 && calls(9).length === 0 && calls(12).length === 0, 'no GitHub call at all for the untrusted issue, the held one or the pull request');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const kaja = data.brands.find((b) => b.id === 'kaja-beauty'), juice = data.brands.find((b) => b.id === 'juice-beauty');
check(!!kaja && !!juice, 'Kaja Beauty and Juice Beauty are written to the data');
check(kaja && kaja.whereToBuy[0] && kaja.whereToBuy[0].url === 'https://www.kajabeauty.com/', "the website from her form becomes Kaja's buy link (form sent with Windows line endings)");
check(juice && juice.whereToBuy.length === 1 && juice.whereToBuy[0].store === 'Credo' && juice.whereToBuy[0].linkType === 'plain', 'a javascript: website is dropped, never a buy link; the store she sent (its page names the brand) is the one buy link');
check(said(1, /Added to C\.F\.B\.: \*\*Kaja Beauty\*\*, listed as cruelty-free by PETA/) && said(1, /#brand\/kaja-beauty/) && closed(1, 'completed'), '#1: "Added", with its certifier and link, closed');
check(said(2, /Leaping Bunny/) && said(2, /No buy link yet/) && closed(2, 'completed'), '#2: added from Leaping Bunny, and told a website gives it a buy link');
check(/bump CACHE_VERSION/.test(out) && /git commit and push: Add Kaja Beauty, Juice Beauty, Euroglow; details for Celavi, Milani \(the founder's requests #1, #2, #17, #19, #23\)/.test(out), 'one commit for all three, with CACHE_VERSION bumped');
check(said(4, /already in the app/) && said(4, /#brand\/milani/) && closed(4, 'completed'), '#4 Milani: already in the app, with its link, closed');
check(said(5, /couldn't find \*\*Zzqx Glow Lab\*\* on PETA's, Leaping Bunny's or Cruelty Free International's/) && said(5, /send it again with its PETA, Leaping Bunny or Cruelty Free International page/) && closed(5, 'not_planned'), '#5: not listed, closed as not planned, told how to ask again');
check(said(6, /PETA says \*\*Testco\*\* tests on animals/) && closed(6, 'not_planned'), '#6: PETA says it tests, closed as not planned');
check(said(7, /@jvtomax99 will check which one/) && labelled(7, 'needs-jose') && !closed(7, 'completed'), '#7: two matches, left open for Jose, who is mentioned');
check(said(8, /parent company tests/) && labelled(8, 'needs-jose') && !closed(8, 'completed'), '#8: a parent that tests, left open for Jose');
check(!fs.existsSync('/tmp/cfb-pwned2') && closed(10, 'not_planned'), '#10: a name with $(...) is only text; a javascript: link is dropped');
const at = (re) => out.split('\n').findIndex((l) => re.test(l));
check(said(11, /is in the app now/) && said(11, /kaja-beauty/) && closed(11, 'completed') && at(/\/issues\/11\/comments/) > at(/git commit and push/), '#11: a duplicate of a brand added in this run (title only, no form) is answered only after it goes live');
check(said(13, /couldn't find a brand name/) && labelled(13, 'needs-jose'), '#13: no name at all: left for Jose');
check(said(14, /couldn't reach the certifiers' sites/) && said(14, /@jvtomax99/) && labelled(14, 'retrying') && !closed(14, 'completed'), '#14: a failed lookup: said once, mentions Jose, labelled retrying, left open');
check(calls(15).length === 0, '#15: a failed lookup already labelled retrying: tried again silently');
check(said(16, /you sent https:\/\/crueltyfree\.peta\.org\/company\/hidden-gem\//) && labelled(16, 'needs-jose') && !closed(16, 'not_planned'), '#16: not found, but she sent a certifier page (on the old form): left for Jose, not closed');
const euro = data.brands.find((b) => b.id === 'euroglow');
check(!!euro && euro.cfi.status === 'yes' && said(17, /listed as cruelty-free by Cruelty Free International/) && closed(17, 'completed'), '#17: approved by Cruelty Free International only: added, and the answer names it');
check(said(18, /you sent https:\/\/www\.crueltyfreeinternational\.org\/approved-brands\/listing\/lost-euro\//) && labelled(18, 'needs-jose'), '#18: a Cruelty Free International page she sent counts as a certifier page');
check(!/Hidden Gem|Flaky/.test(JSON.stringify(data.brands.map((b) => b.name))), 'nothing unconfirmed was written to the data');
check(said(2, /Your details:/) && said(2, /Store:\*\* saved: Credo/), '#2: the answer lists the details she sent with the new brand');
const celavi = data.brands.find((b) => b.id === 'celavi');
check(celavi && celavi.parent.name === null && said(19, /PETA says Glow Holdings tests on animals/) && said(19, /Jose checks it before it goes in/), '#19: a parent PETA says tests is never saved by the bot (it would fail the brand): left for Jose');
check(celavi && celavi.price === '$' && celavi.priceSource.url === 'https://mycelavi.com' && /founder/i.test(celavi.priceSource.note), "#19: her price is saved for a brand with none, pointing at the brand's own site");
check(celavi && celavi.whereToBuy.some((w) => w.store === 'Ulta' && w.linkType === 'plain'), '#19: the store whose page names the brand is added as a plain link');
check(celavi && celavi.chinaRetail.status === 'unknown' && said(19, /Jose checks this one by hand/) && labelled(19, 'needs-jose') && !closed(19, 'completed'), '#19: China is never saved by the bot: left for Jose');
check(said(19, /Details saved for \*\*Celavi\*\*/) && at(/\/issues\/19\/comments/) > at(/git commit and push/), '#19: answered once the details are live');
const milani = data.brands.find((b) => b.id === 'milani');
check(milani && milani.price === '$' && milani.parent.name !== 'Nopage Inc' && !milani.whereToBuy.some((w) => /shopmy/.test(w.url)), "#20: Milani unchanged: its own price kept, a commission link refused, a parent page that doesn't name both not saved");
check(said(20, /already in the app, so I looked at the details/) && said(20, /commission link/) && said(20, /Nothing was changed/) && labelled(20, 'needs-jose'), '#20: the answer says why for each, and leaves the parent for Jose');
check(said(21, /isn't in the app/) && closed(21, 'not_planned'), '#21: details for a brand not in the app: told to add it first, closed');
check(said(22, /No details came/) && closed(22, 'not_planned'), '#22: a details form with every box empty: said so, closed');
check(/git commit and push: Add Kaja Beauty, Juice Beauty, Euroglow; details for Celavi, Milani/.test(out), 'the details go out in the same commit as the new brands');
check(milani && milani.parent.name === 'The Kind Group Inc.' && milani.parent.testsOnAnimals === 'no' && milani.parent.url === 'https://kindgroup.example/brands' && /crueltyfree\.peta\.org\/company\/kind-group/.test(milani.parent.note), '#23: "The Kind Group Inc." matches PETA\'s "Kind Group"; her ownership link stays the source, PETA\'s page is named in the note');
check(data.changes.some((c) => c.id === 'milani' && c.claim === 'parent' && c.from === 'unknown' && c.to === 'no'), '#23: a newly confirmed parent that doesn\'t test gets a "What changed" entry');
check(milani && !milani.whereToBuy.some((w) => /store\.example|shopmy/.test(w.url)) && said(23, /leads to a commission link/), '#23: a store link that redirects to a commission link is refused');
const elf = data.brands.find((b) => b.id === 'elf');
check(elf && elf.parent.name !== "L'Oréal" && said(24, /doesn't name both/), '#24: "elf" inside "shelf" and "self" is not e.l.f.: nothing saved');
const { mentions, AFFILIATE } = require('./brand-details.cjs');
check(mentions('Shop e.l.f. today', 'e.l.f.') && mentions('ELF Beauty owns it', 'e.l.f.') && !mentions('a shelf of self-care', 'elf') && !mentions('rarely seen', 'Rare Beauty') && mentions("L'Oréal Groupe brands", "L'Oréal"), 'names match as whole words only');
check(['https://liketk.it/4abc', 'https://ulta.pxf.io/x', 'https://sephora.sjv.io/y', 'https://www.amazon.com/dp/B0?tag=me-20', 'https://www.amazon.com/dp/B0?linkCode=ll1'].every((u) => AFFILIATE.test(u)) && !AFFILIATE.test('https://www.ulta.com/brand/milani'), 'commission links from LTK, Impact and Amazon are caught; a plain store page is not');
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
