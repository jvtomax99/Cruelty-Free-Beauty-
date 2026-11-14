// Handles the founder's "Add a brand" requests (GitHub issues labelled add-brand). Run by
// .github/workflows/add-brand.yml when an issue is opened, once a day as a retry, or by hand.
//
// For every open add-brand issue opened by a trusted login (and not already left for Jose):
// read the brand name and website from the issue form, run tools/add-brand.cjs on it, and
//   - listed by PETA ("doesn't test") or Leaping Bunny, links alive: queue it. All queued brands
//     go out together: start again from the latest main, add them, bump CACHE_VERSION, run the
//     data and site checks, commit, push (up to 3 tries, each from a fresh main), ask for a Pages
//     build and wait for the live data. Only then: "Added" with its link, and the issue closes.
//   - not listed, or PETA says it tests: say so and close it (not planned), unless she sent a
//     certifier page, which a person then checks
//   - already in the app: say so with its link and close it (a duplicate of a brand queued in
//     this same run waits for that brand to go live)
//   - more than one match, a parent company that tests, a dead link, or anything that kept it
//     from going live: mention Jose and label needs-jose, which this script then skips
//   - a lookup that failed: say so once, mentioning Jose (label retrying), and try again next run
// Issue text is only data: the name reaches add-brand.cjs through a file, never a command line.
// Exit 1 when something needs a look (the workflow run turns red).
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (set by Actions). For tests: ISSUES_FILE (issues as JSON
// instead of the API), DRY_RUN=1 (no GitHub writes, no git), NO_GITHUB=1 (no GitHub, real git), SKIP_SITE_CHECK=1, NO_LINK_CHECK=1,
// plus ADD_BRAND_FAKE and BRANDS_FILE, which pass through to add-brand.cjs.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TRUSTED = ['jvtomax99', 'cfbbeauty'];   // CLAUDE.md; also in .github/workflows/add-brand.yml
const JOSE = '@jvtomax99';
const LABEL = 'add-brand', HOLD = 'needs-jose', RETRY = 'retrying';
const ROOT = path.join(__dirname, '..');
const FILE = process.env.BRANDS_FILE || path.join(ROOT, 'data', 'brands.json');
const REPO = process.env.GITHUB_REPOSITORY || 'jvtomax99/Cruelty-Free-Beauty-';
const SITE = 'https://jvtomax99.github.io/Cruelty-Free-Beauty-/';
const DRY = process.env.DRY_RUN === '1';
// NO_GITHUB=1 (tests): GitHub calls are printed, not made, and the live-site wait is skipped, but git runs for real.
const OFFLINE = DRY || process.env.NO_GITHUB === '1';
const API = 'https://api.github.com';
const SIGN = '\n\n_C.F.B. brand check (automatic)_';

const log = (...a) => console.log(...a);
const brandLink = (b) => `${SITE}#brand/${encodeURIComponent(b.id)}`;
const headers = () => ({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'cfb-brand-check' });

async function gh(method, url, body) {
  if (OFFLINE) { log(`[dry run] ${method} ${url}${body ? ' ' + JSON.stringify(body) : ''}`); return null; }
  const r = await fetch(API + url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok && !(method === 'DELETE' && r.status === 404)) throw new Error(`${method} ${url}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
const comment = (n, text) => gh('POST', `/repos/${REPO}/issues/${n}/comments`, { body: text + SIGN });
const close = (n, reason) => gh('PATCH', `/repos/${REPO}/issues/${n}`, { state: 'closed', state_reason: reason });
const label = (n, name) => gh('POST', `/repos/${REPO}/issues/${n}/labels`, { labels: [name] });
const unlabel = (n, name) => gh('DELETE', `/repos/${REPO}/issues/${n}/labels/${encodeURIComponent(name)}`);
const hold = async (n, text) => { await comment(n, text); await label(n, HOLD); };

async function openIssues() {
  if (process.env.ISSUES_FILE) return JSON.parse(fs.readFileSync(process.env.ISSUES_FILE, 'utf8'));
  const r = await fetch(`${API}/repos/${REPO}/issues?labels=${LABEL}&state=open&per_page=100`, { headers: headers() });
  if (!r.ok) throw new Error(`list issues: ${r.status}`);
  return r.json();
}

// The issue form writes "### Brand name\n\nKaja\n\n### Brand's website ...\n\n_No response_".
const httpsLink = (u) => (/^https:\/\/[^\s]+$/.test(u || '') && u.length <= 300 ? u : null);
function fields(issue) {
  const body = String(issue.body || '').replace(/\r\n?/g, '\n');
  const section = (re) => {
    const m = body.match(new RegExp(`^###\\s*${re}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###\\s|$(?![\\s\\S]))`, 'im'));
    const v = m ? m[1].trim() : '';
    return v === '_No response_' ? '' : v;
  };
  let name = section('Brand name');
  if (!name) name = String(issue.title || '').replace(/^\s*add brand:\s*/i, '');
  name = name.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 80);
  const proof = httpsLink(section('PETA or Leaping Bunny page').split(/\s+/)[0]);
  return {
    name,
    site: httpsLink(section("Brand's website").split(/\s+/)[0]),
    proof: proof && /^https:\/\/(crueltyfree\.peta\.org|(www\.)?leapingbunny\.org)\//.test(proof) ? proof : null,
  };
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function addBrand(name, site) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-req-'));
  const nameFile = path.join(dir, 'name.txt'), out = path.join(dir, 'result.json');
  fs.writeFileSync(nameFile, name);
  // --write puts it in the working copy, so a second request for it in this run is "already in".
  const args = [path.join(__dirname, 'add-brand.cjs'), '--name-file', nameFile, '--json-out', out, '--write'];
  if (site) args.push('--site', site);
  const r = run(process.execPath, args);
  let res = { code: r.code === null ? 1 : r.code, message: r.out.trim().split('\n').pop() || 'no output' };
  try { res = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (_) {}
  fs.rmSync(dir, { recursive: true, force: true });
  log(r.out.trim());
  return res;
}

// Brands file helpers that keep its one-space formatting.
const readData = () => { const raw = fs.readFileSync(FILE, 'utf8'); return { raw, data: JSON.parse(raw) }; };
const writeData = (data, raw) => fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + (raw.endsWith('\n') ? '\n' : ''));
function removeBrand(id) { const { raw, data } = readData(); data.brands = data.brands.filter((b) => b.id !== id); writeData(data, raw); }

// A new brand's own links only (the whole file's 200-odd links are the monthly recheck's job).
async function deadLinks(record) {
  if (process.env.NO_LINK_CHECK === '1') return [];
  const urls = [record.peta && record.peta.url, record.leapingBunny && record.leapingBunny.url, ...(record.whereToBuy || []).map((w) => w.url)].filter(Boolean);
  const dead = [];
  for (const u of new Set(urls)) {
    try { const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (C.F.B. link check)' } }); if (r.status === 404 || r.status === 410) dead.push(`${u} (${r.status})`); }
    catch (_) { /* unreachable from here is not dead */ }
  }
  return dead;
}

function bumpCache() {
  if (DRY) { log('[dry run] bump CACHE_VERSION in sw.js'); return; }
  const f = path.join(ROOT, 'sw.js');
  const s = fs.readFileSync(f, 'utf8');
  const next = s.replace(/const CACHE_VERSION = "cfb-v(\d+)";/, (_, n) => `const CACHE_VERSION = "cfb-v${Number(n) + 1}";`);
  if (next === s) throw new Error('CACHE_VERSION not found in sw.js');
  fs.writeFileSync(f, next);
}

// Each try starts from the latest main, so a change merged meanwhile is never lost or undone,
// the cache bump is always one more than main's, and the checks run on exactly what is pushed.
function publish(queued) {
  const msg = `Add ${queued.map((q) => q.brand.name).join(', ')} (the founder's request${queued.length > 1 ? 's' : ''} ${queued.map((q) => '#' + q.issue).join(', ')})`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!DRY) {
      const f = run('git', ['fetch', 'origin', 'main']);
      const r = run('git', ['reset', '--hard', 'origin/main']);
      if (f.code !== 0 || r.code !== 0) return { ok: false, reason: 'git could not fetch main' };
    }
    const { raw, data } = readData();
    for (const q of queued) if (!data.brands.some((b) => b.id === q.record.id)) data.brands.push(q.record);
    writeData(data, raw);
    bumpCache();
    const cb = run(process.execPath, [path.join(__dirname, 'check-brands.cjs')]);
    if (cb.code !== 0) return { ok: false, reason: 'the brand data check failed: ' + ((cb.out.split('Errors')[1] || cb.out).trim().split('\n').slice(1, 4).join('; ')) };
    if (process.env.SKIP_SITE_CHECK !== '1') {
      const sc = run(process.execPath, [path.join(ROOT, '.github', 'site-check.cjs'), 'index.html']);
      if (sc.code !== 0) return { ok: false, reason: 'the site check failed: ' + sc.out.trim().split('\n').slice(-3).join('; ') };
    }
    if (DRY) { log(`[dry run] git commit and push: ${msg}`); return { ok: true }; }
    run('git', ['add', 'data/brands.json', 'sw.js']);
    const c = run('git', ['commit', '-m', msg]);
    if (c.code !== 0) return { ok: false, reason: 'git commit failed: ' + c.out.trim().split('\n').pop() };
    const p = run('git', ['push', 'origin', 'HEAD:main']);
    if (p.code === 0) return { ok: true };
    log(`push try ${attempt} failed:\n${p.out}`);
  }
  return { ok: false, reason: 'pushing to main failed three times (main may be protected, or busy)' };
}

// A push with the workflow's token doesn't start a Pages build by itself, so ask for one, then
// wait (up to 6 minutes) until the live data has every new brand.
async function goLive(queued) {
  if (OFFLINE) { log('[dry run] request a Pages build and wait for the live data'); return true; }
  try { await gh('POST', `/repos/${REPO}/pages/builds`); } catch (e) { log('Pages build request: ' + e.message); }
  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const live = await fetch(`${SITE}data/brands.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json());
      if (queued.every((q) => live.brands.some((b) => b.id === q.brand.id))) return true;
    } catch (_) {}
  }
  return false;
}

async function main() {
  const has = (issue, name) => (issue.labels || []).some((l) => (l.name || l) === name);
  const issues = (await openIssues()).filter((i) => !i.pull_request && TRUSTED.includes(i.user && i.user.login) && has(i, LABEL) && !has(i, HOLD));
  log(`${issues.length} request(s) to check.`);
  const queued = [];
  let trouble = 0;

  for (const issue of issues) {
    const n = issue.number;
    try {
      const { name, site, proof } = fields(issue);
      log(`\n#${n}: "${name}"${site ? ' ' + site : ''}`);
      if (!name) { await hold(n, `I couldn't find a brand name in this request. ${JOSE} will take a look.`); trouble++; continue; }
      const res = addBrand(name, site);
      if (res.code === 0) {
        const dead = await deadLinks(res.record);
        if (dead.length) {
          removeBrand(res.record.id);
          await hold(n, `**${res.brand.name}** is on the certifiers' list, but a link for it doesn't open: ${dead.join(', ')}. ${JOSE} will take a look.`);
          trouble++;
        } else queued.push({ issue: n, brand: res.brand, record: res.record, site, retried: has(issue, RETRY), dups: [] });
        continue;
      }
      if (res.code === 3) {
        const q = res.brand && queued.find((x) => x.brand.id === res.brand.id);
        if (q) { q.dups.push(n); continue; }   // answered once that brand is live
        await comment(n, `**${res.brand ? res.brand.name : name}** is already in the app: ${res.brand ? brandLink(res.brand) : SITE}`);
        await close(n, 'completed');
      } else if (res.code === 2 && proof && !res.tests) {
        await hold(n, `I couldn't find **${name}** on PETA's or Leaping Bunny's cruelty-free lists, but you sent ${proof}. ${JOSE} will check that page.`);
        trouble++;
      } else if (res.code === 2) {
        await comment(n, (res.tests
          ? `PETA says **${name}** tests on animals (${res.url}), and Leaping Bunny doesn't certify it, so it stays out of the app.`
          : `I couldn't find **${name}** on PETA's or Leaping Bunny's cruelty-free lists, so it stays out of the app.\n\n${res.message.split('\n').slice(1).join('\n')}`.trim())
          + `\n\nIf it is on one of their lists, send it again with its PETA or Leaping Bunny page and ${JOSE} will check.`);
        await close(n, 'not_planned');
      } else if (res.code === 4) {
        await hold(n, `More than one brand on the certifiers' lists matches **${name}**, so ${JOSE} will check which one you mean.\n\n${res.message.split('\n').slice(1).join('\n')}`);
        trouble++;
      } else if (res.code === 5) {
        await hold(n, `Leaping Bunny certifies **${name}**, but says its parent company tests on animals. ${JOSE} needs to look up the parent company before it goes in, so the app can show it correctly.`);
        trouble++;
      } else {
        log(`lookup failed for #${n}: ${res.message}`);
        trouble++;
        if (!has(issue, RETRY)) { await comment(n, `I couldn't reach PETA or Leaping Bunny just now (${String(res.message).slice(0, 120)}). I'll try again tomorrow. ${JOSE} for a look if it keeps happening.`); await label(n, RETRY); }
      }
    } catch (e) {
      console.error(`#${n}: ${e.message}`);   // one issue's GitHub error never stops the others
      trouble++;
    }
  }

  if (!queued.length) { log('\nNothing to add.'); return trouble ? 1 : 0; }
  const pub = publish(queued);
  const everyone = (fn) => Promise.all(queued.flatMap((q) => [q.issue, ...q.dups].map((n) => fn(q, n).catch((e) => { console.error(`#${n}: ${e.message}`); trouble++; }))));
  if (!pub.ok) {
    log(`\nNot published: ${pub.reason}`);
    if (!DRY) run('git', ['reset', '--hard', 'origin/main']);
    await everyone((q, n) => hold(n, `**${q.brand.name}** checks out with the certifiers, but it couldn't go live: ${pub.reason}. ${JOSE} will take a look.`));
    return 1;
  }
  const live = await goLive(queued);
  if (!live) {
    log('\nPushed, but the live site did not show the new brands within 6 minutes.');
    await everyone((q, n) => hold(n, `**${q.brand.name}** is saved, but the live app hasn't updated yet. ${JOSE} will check the site's build.`));
    return 1;
  }
  await everyone(async (q, n) => {
    if (n !== q.issue) { await comment(n, `**${q.brand.name}** is in the app now: ${brandLink(q.brand)}`); await close(n, 'completed'); return; }
    const r = q.record;
    const by = [r.peta.status === 'yes' && 'PETA', r.leapingBunny.status === 'yes' && 'Leaping Bunny'].filter(Boolean).join(' and ');
    await comment(n, `Added to C.F.B.: **${q.brand.name}**, listed as cruelty-free by ${by}. It's in the app now: ${brandLink(q.brand)}`
      + (q.site ? '' : "\n\nNo website was given, so its page says \"No buy link yet\". Add the brand's website next time and it gets a buy link."));
    if (q.retried) await unlabel(n, RETRY);
    await close(n, 'completed');
  });
  log(`\nPublished ${queued.length} brand(s).`);
  return trouble ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
