// Handles the founder's "Add a brand" requests (GitHub issues labelled add-brand). Run by
// .github/workflows/add-brand.yml when an issue is opened, once a day as a retry, or by hand.
//
// For every open add-brand issue opened by a trusted login (and not already left for Jose):
// read the brand name and website from the issue form, run tools/add-brand.cjs on it, and
//   - listed by PETA ("doesn't test") or Leaping Bunny: add it, and once every brand of this run
//     is in, bump CACHE_VERSION, run check-brands --links and the site check, commit to main and
//     push; then say "Added" on the issue with the brand's link and close it
//   - not listed, or PETA says it tests: say so and close it (not planned)
//   - already in the app: say so with its link and close it
//   - more than one match, or a parent company that tests: say Jose will look, label needs-jose
//   - a lookup that failed: say so once (label retrying) and try again next run
// Issue text is only data: the name reaches add-brand.cjs through a file, never a command line.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (set by Actions). For tests: ISSUES_FILE (issues as JSON
// instead of the API), DRY_RUN=1 (no GitHub writes, no git), SKIP_SITE_CHECK=1, NO_LINK_CHECK=1,
// plus ADD_BRAND_FAKE and BRANDS_FILE, which pass through to add-brand.cjs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TRUSTED = ['jvtomax99', 'cfbbeauty'];   // CLAUDE.md, "The founder's brand requests"
const LABEL = 'add-brand', HOLD = 'needs-jose', RETRY = 'retrying';
const ROOT = path.join(__dirname, '..');
const REPO = process.env.GITHUB_REPOSITORY || 'jvtomax99/Cruelty-Free-Beauty-';
const SITE = 'https://jvtomax99.github.io/Cruelty-Free-Beauty-/';
const DRY = process.env.DRY_RUN === '1';
const API = 'https://api.github.com';
const SIGN = '\n\n_C.F.B. brand check (automatic)_';

const log = (...a) => console.log(...a);
const brandLink = (b) => `${SITE}#brand/${encodeURIComponent(b.id)}`;

async function gh(method, url, body) {
  if (DRY) { log(`[dry run] ${method} ${url}${body ? ' ' + JSON.stringify(body) : ''}`); return null; }
  const r = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'cfb-brand-check' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && !(method === 'DELETE' && r.status === 404)) throw new Error(`${method} ${url}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
const comment = (n, text) => gh('POST', `/repos/${REPO}/issues/${n}/comments`, { body: text + SIGN });
const close = (n, reason) => gh('PATCH', `/repos/${REPO}/issues/${n}`, { state: 'closed', state_reason: reason });
const label = (n, name) => gh('POST', `/repos/${REPO}/issues/${n}/labels`, { labels: [name] });
const unlabel = (n, name) => gh('DELETE', `/repos/${REPO}/issues/${n}/labels/${encodeURIComponent(name)}`);

async function openIssues() {
  if (process.env.ISSUES_FILE) return JSON.parse(fs.readFileSync(process.env.ISSUES_FILE, 'utf8'));
  return (await fetch(`${API}/repos/${REPO}/issues?labels=${LABEL}&state=open&per_page=100`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'cfb-brand-check' },
  }).then((r) => { if (!r.ok) throw new Error(`list issues: ${r.status}`); return r.json(); }));
}

// The issue form writes "### Brand name\n\nKaja\n\n### Brand's website ...\n\n_No response_".
function fields(issue) {
  const body = String(issue.body || '');
  const section = (re) => {
    const m = body.match(new RegExp(`^###\\s*${re}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###\\s|$)`, 'im'));
    const v = m ? m[1].trim() : '';
    return v === '_No response_' ? '' : v;
  };
  let name = section('Brand name');
  if (!name) name = String(issue.title || '').replace(/^\s*add brand:\s*/i, '');
  name = name.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 80);
  const site = section("Brand's website").split(/\s+/)[0];
  return { name, site: /^https:\/\/[^\s]+$/.test(site) && site.length <= 300 ? site : null };
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function addBrand(name, site) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-req-'));
  const nameFile = path.join(dir, 'name.txt'), out = path.join(dir, 'result.json');
  fs.writeFileSync(nameFile, name);
  const args = [path.join(__dirname, 'add-brand.cjs'), '--name-file', nameFile, '--json-out', out, '--write'];
  if (site) args.push('--site', site);
  const r = run(process.execPath, args);
  let res = { code: r.code, message: r.out.trim().split('\n').pop() };
  try { res = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (_) {}
  fs.rmSync(dir, { recursive: true, force: true });
  log(r.out.trim());
  return res;
}

function bumpCache() {
  if (DRY) { log('[dry run] bump CACHE_VERSION in sw.js'); return; }
  const f = path.join(ROOT, 'sw.js');
  const s = fs.readFileSync(f, 'utf8');
  const next = s.replace(/const CACHE_VERSION = "cfb-v(\d+)";/, (_, n) => `const CACHE_VERSION = "cfb-v${Number(n) + 1}";`);
  if (next === s) throw new Error('CACHE_VERSION not found in sw.js');
  fs.writeFileSync(f, next);
}

// A push with the workflow's token doesn't start a Pages build by itself, so ask for one, then
// wait (up to 6 minutes) until the live data has every new brand. Returns true once live.
async function goLive(added) {
  if (DRY) { log('[dry run] request a Pages build and wait for the live data'); return true; }
  try { await gh('POST', `/repos/${REPO}/pages/builds`); } catch (e) { log('Pages build request: ' + e.message); }
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const live = await fetch(`${SITE}data/brands.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json());
      if (added.every((a) => live.brands.some((b) => b.id === a.brand.id))) return true;
    } catch (_) {}
  }
  return false;
}

function publish(added) {
  const names = added.map((a) => a.brand.name);
  const msg = `Add ${names.join(', ')} (the founder's request${added.length > 1 ? 's' : ''} ${added.map((a) => '#' + a.issue).join(', ')})`;
  if (DRY) { log(`[dry run] git commit and push: ${msg}`); return true; }
  run('git', ['add', 'data/brands.json', 'sw.js']);
  const c = run('git', ['commit', '-m', msg]);
  if (c.code !== 0) { log(c.out); return false; }
  for (let i = 0; i < 3; i++) {
    const p = run('git', ['push', 'origin', 'HEAD:main']);
    if (p.code === 0) return true;
    log(p.out);
    run('git', ['pull', '--rebase', 'origin', 'main']);
  }
  return false;
}

async function main() {
  const issues = (await openIssues()).filter((i) => !i.pull_request
    && TRUSTED.includes(i.user && i.user.login)
    && (i.labels || []).some((l) => (l.name || l) === LABEL)
    && !(i.labels || []).some((l) => (l.name || l) === HOLD));
  log(`${issues.length} request(s) to check.`);
  const added = [];

  for (const issue of issues) {
    const n = issue.number;
    const has = (name) => (issue.labels || []).some((l) => (l.name || l) === name);
    const { name, site } = fields(issue);
    log(`\n#${n}: "${name}"${site ? ' ' + site : ''}`);
    if (!name) { await comment(n, "I couldn't find a brand name in this request. Jose will take a look."); await label(n, HOLD); continue; }
    const res = addBrand(name, site);
    if (res.code === 0) { added.push({ issue: n, brand: res.brand, record: res.record, retried: has(RETRY), site }); continue; }
    if (res.code === 2) {
      await comment(n, res.tests
        ? `PETA says **${name}** tests on animals (${res.url}), and Leaping Bunny doesn't certify it, so it stays out of the app.`
        : `**${name}** isn't on PETA's or Leaping Bunny's cruelty-free lists, so it stays out of the app.\n\n${res.message.split('\n').slice(1).join('\n')}`.trim());
      await close(n, 'not_planned');
    } else if (res.code === 3) {
      await comment(n, `**${res.brand ? res.brand.name : name}** is already in the app: ${res.brand ? brandLink(res.brand) : SITE}`);
      await close(n, 'completed');
    } else if (res.code === 4) {
      await comment(n, `More than one brand on the certifiers' lists matches **${name}**, so Jose will check which one you mean.\n\n${res.message.split('\n').slice(1).join('\n')}`);
      await label(n, HOLD);
    } else if (res.code === 5) {
      await comment(n, `Leaping Bunny certifies **${name}**, but says its parent company tests on animals. Jose needs to look up the parent company before it goes in, so the app can show it correctly.`);
      await label(n, HOLD);
    } else {
      log(`lookup failed for #${n}: ${res.message}`);
      if (!has(RETRY)) { await comment(n, `I couldn't reach PETA or Leaping Bunny just now. I'll try again tomorrow.`); await label(n, RETRY); }
    }
  }

  if (!added.length) { log('\nNothing to add.'); return 0; }
  bumpCache();
  const checks = [];
  const cb = run(process.execPath, [path.join(__dirname, 'check-brands.cjs'), ...(process.env.NO_LINK_CHECK === '1' ? [] : ['--links'])]);
  if (cb.code !== 0) checks.push('brand data check:\n' + cb.out);
  if (process.env.SKIP_SITE_CHECK !== '1') {
    const sc = run(process.execPath, [path.join(ROOT, '.github', 'site-check.cjs'), 'index.html']);
    if (sc.code !== 0) checks.push('site check:\n' + sc.out);
  }
  if (checks.length || !publish(added)) {
    log('\nNot published:\n' + (checks.join('\n') || 'git push failed'));
    if (!DRY) run('git', ['checkout', '--', 'data/brands.json', 'sw.js']);
    for (const a of added) { await comment(a.issue, `**${a.brand.name}** checks out with the certifiers, but the app's own checks didn't pass, so it isn't live yet. Jose will take a look.`); await label(a.issue, HOLD); }
    return 1;
  }
  const live = await goLive(added);
  if (!live) log('The live site did not show the new brands within 6 minutes.');
  for (const a of added) {
    const r = a.record || {};
    const by = [r.peta && r.peta.status === 'yes' && 'PETA', r.leapingBunny && r.leapingBunny.status === 'yes' && 'Leaping Bunny'].filter(Boolean).join(' and ');
    await comment(a.issue, `Added to C.F.B.: **${a.brand.name}**${by ? `, listed as cruelty-free by ${by}` : ''}. ${live ? "It's in the app now" : "It's saved and will show in the app shortly"}: ${brandLink(a.brand)}${a.site ? '' : "\n\nNo website was given, so its page says \"No buy link yet\". Add the brand's website next time and it gets a buy link."}`);
    if (a.retried) await unlabel(a.issue, RETRY);
    await close(a.issue, 'completed');
  }
  log(`\nPublished ${added.length} brand(s).`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
