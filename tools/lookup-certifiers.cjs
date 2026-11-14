// Looks up brands on PETA's and Leaping Bunny's own sites and prints what
// each certifier says, with the page to cite. It does not edit brands.json:
// a person (or the monthly scheduled run) reads the output and decides.
//
//   node tools/lookup-certifiers.cjs "Milani" "e.l.f."      (names to search)
//   node tools/lookup-certifiers.cjs --file data/brands.json (every brand's search names)
//   node tools/lookup-certifiers.cjs --file data/brands.json --diff
//       (also compares with what the file says and prints what looks changed, with a
//        "changes" entry to paste once a person has opened the page and agrees)
//
// Needs Playwright (Leaping Bunny's list only answers from inside its page).
// PETA: WordPress JSON search, then the company page for its verdict line.
// Leaping Bunny: the query its Shopping Guide page uses, then the brand page.

const fs = require('fs');

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set (cloud
// sessions reach the web only through a proxy). Re-run once with it on.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require('child_process').spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status === null ? 1 : r.status);
}

const PETA = 'https://crueltyfree.peta.org';
const LB = 'https://www.leapingbunny.org';
const UA = 'Mozilla/5.0 (C.F.B. brand check)';

const decode = (s) => s
  .replace(/&#8217;|&#039;|&rsquo;/g, "'").replace(/&#038;|&amp;/g, '&')
  .replace(/&#8211;/g, '-').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '');
const text = (html) => decode(html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

// What one PETA company page says.
function petaRead(html) {
  const page = text(html);
  // PETA marks each listing with icons: is-cf-logo ("Company That Doesn't
  // Test"), is-vegan ("All products are vegan"). Pages without them say
  // either "does test on animals" or "may not be cruelty-free" (not listed).
  const icons = [...html.matchAll(/peta-icons__item--([a-z-]+)[^>]*title="([^"]*)"/g)]
    .map((m) => ({ cls: m[1], title: decode(m[2]) }));
  const has = (re) => icons.some((i) => re.test(i.title));
  let status = 'unknown';
  let verdict = 'no verdict found';
  // The is-cf-logo class is shared: its title tells "doesn't test" apart from
  // "Working for Regulatory Change" (tests when the law requires it).
  if (has(/Regulatory Change/i)) { status = 'no'; verdict = 'PETA: working for regulatory change (tests only when required by law)'; }
  else if (has(/Doesn.t Test/i)) { status = 'yes'; verdict = "PETA: company that doesn't test"; }
  else if (/does test on animals/i.test(page)) { status = 'no'; verdict = 'PETA: does test on animals'; }
  else if (/may not be cruelty-free/i.test(page)) { status = 'unknown'; verdict = 'PETA: may not be cruelty-free (not on its list)'; }
  return { status, verdict, vegan: icons.some((i) => i.cls === 'is-vegan') };
}

// One PETA page by its link (for --diff, when a search didn't return it). null: the page is gone.
async function petaPage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (r.status === 404 || r.status === 410) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { url, ...petaRead(await r.text()) };
}

async function peta(name) {
  const q = `${PETA}/wp-json/wp/v2/company?search=${encodeURIComponent(name)}&per_page=10&_fields=link,title,class_list`;
  const hits = JSON.parse(await get(q));
  const out = [];
  for (const h of hits.slice(0, 10)) {
    const read = petaRead(await get(h.link));
    out.push({
      title: decode(h.title.rendered),
      url: h.link,
      status: read.status,
      verdict: read.verdict,
      vegan: read.vegan,
      countries: (h.class_list || []).filter((c) => c.startsWith('country-availability-')).map((c) => c.slice(21)),
    });
    await sleep(400);
  }
  return out;
}

async function leapingBunny(page, name) {
  const items = await page.evaluate(async (q) => {
    const tok = document.querySelector('#__RequestVerificationToken')?.value;
    const u = '/api/Query?QueryName=$/_LeapingBunny/Shopping Guide/List of Brands'
      + '&cosmetics=&personalcare=&household=&animalcare=&Alpha=&Company=' + encodeURIComponent(q)
      + '&canadian=&noncertified=&limit=20&offset=0';
    const r = await fetch(u, { headers: { RequestVerificationToken: tok, Accept: 'application/json' } });
    if (!r.ok) return { error: r.status };
    return (await r.json()).Items.$values;
  }, name);
  if (items.error) throw new Error(`Leaping Bunny query ${items.error}`);
  return items.map((i) => ({
    company: i.CompanyName,
    tradingName: i.TradingName,
    url: `${LB}/ShopBrandDetail?BrandId=${i.BrandId}`,
    parentTests: i.IsDirtyParent, // Leaping Bunny's flag for a parent company that tests
  }));
}

async function main() {
  const args = process.argv.slice(2);
  let names;
  const wantDiff = args.includes('--diff');
  const fileAt = args.indexOf('--file');
  const file = fileAt >= 0 ? args[fileAt + 1] : null;
  if ((fileAt >= 0 && (!file || file.startsWith('--'))) || (wantDiff && !file)) { console.error('Usage: --file data/brands.json [--diff]'); process.exit(1); }
  if (file) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    names = data.brands.map((b) => ({ id: b.id, search: b.search || [b.name] }));
  } else {
    names = args.filter((a) => !a.startsWith('--')).map((n) => ({ id: n, search: [n] }));
  }
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${LB}/Web/Shopping-Guide/Brands.aspx`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const results = [];
  for (const n of names) {
    const row = { id: n.id, checked: new Date().toISOString().slice(0, 10), peta: [], leapingBunny: [], errors: [] };
    for (const s of n.search) {
      try { row.peta.push(...await peta(s)); } catch (e) { row.errors.push(`PETA ${s}: ${e.message}`); }
      try { row.leapingBunny.push(...await leapingBunny(page, s)); } catch (e) { row.errors.push(`LB ${s}: ${e.message}`); }
    }
    const uniq = (a) => a.filter((x, i) => a.findIndex((y) => y.url === x.url) === i);
    row.peta = uniq(row.peta); row.leapingBunny = uniq(row.leapingBunny);
    results.push(row);
    process.stderr.write(`${n.id}: PETA ${row.peta.length}, LB ${row.leapingBunny.length}\n`);
  }
  await browser.close();
  if (wantDiff) return diff(JSON.parse(fs.readFileSync(file, 'utf8')).brands, results);
  console.log(JSON.stringify(results, null, 2));
}

// Compares a fresh lookup with the stored statuses. A search can miss a page that still exists
// (a parent company's own page is often not among the hits), so "not found" for a stored yes/no
// is fetched directly before it counts. Everything printed is for a person to confirm.
const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
async function diff(brands, results) {
  const out = [], unsure = [];
  for (const b of brands) {
    const r = results.find((x) => x.id === b.id);
    if (!r) continue;
    if (r.errors.length) { unsure.push(`${b.name}: lookup errors (${r.errors.join('; ')})`); continue; }
    const names = [b.name, ...(b.search || [])].map(fold);
    const entry = (claim, to, url) => ({ id: b.id, claim, from: b[claim].status, to, date: r.checked, url });

    // PETA
    const stored = b.peta.status;
    let hit = r.peta.find((x) => x.url === b.peta.url);
    // The brand's own PETA page, when the record links one, is read directly: a search can miss it.
    if (!hit && /\/company\//.test(b.peta.url || '')) {
      try { hit = await petaPage(b.peta.url); } catch (e) { unsure.push(`${b.name}: could not open its PETA page (${e.message})`); continue; }
      if (hit === null) {
        if (stored !== 'unknown') out.push({ why: `${b.name}: its PETA page is gone`, entry: entry('peta', 'unknown', PETA + '/') });
        hit = undefined;
      }
    }
    // A page we couldn't read a verdict from is not a change: PETA may have changed its page.
    if (hit && hit.verdict === 'no verdict found') { unsure.push(`${b.name}: no verdict found on ${hit.url}; read it by hand`); hit = undefined; }
    if (!hit && stored === 'unknown') hit = r.peta.find((x) => x.status !== 'unknown' && names.includes(fold(x.title.replace(/\s*\(.*\)\s*$/, ''))));
    if (hit && hit.status !== stored) {
      const e = entry('peta', hit.status, hit.url);
      if (/regulatory change/i.test(hit.verdict)) e.law = true;
      out.push({ why: `${b.name}: PETA says "${hit.verdict}" (stored: ${stored})`, entry: e });
    }

    // Leaping Bunny
    const lbStored = b.leapingBunny.status;
    if (lbStored === 'yes' && !r.leapingBunny.some((x) => x.url === b.leapingBunny.url)) {
      out.push({ why: `${b.name}: not found in Leaping Bunny's guide (stored: yes)`, entry: entry('leapingBunny', 'unknown', LB + '/Web/Shopping-Guide/Brands.aspx') });
    } else if (lbStored !== 'yes') {
      const lb = r.leapingBunny.find((x) => names.includes(fold(x.tradingName || '')) || names.includes(fold(x.company || '')));
      if (lb) out.push({ why: `${b.name}: found in Leaping Bunny's guide as "${lb.tradingName || lb.company}" (stored: ${lbStored})`, entry: entry('leapingBunny', 'yes', lb.url) });
    }
  }
  console.log('Compared PETA and Leaping Bunny only. Parent company and China changes are found and entered by hand.\n');
  console.log(out.length ? `${out.length} possible change(s). Open each link and confirm before editing data/brands.json:\n` : 'No changes: every stored PETA and Leaping Bunny status matches a fresh lookup.');
  for (const o of out) console.log(`- ${o.why}\n  ${JSON.stringify(o.entry)}\n`);
  if (unsure.length) console.log(`Could not check (${unsure.length}):\n  ` + unsure.join('\n  '));
}

// tools/add-brand.cjs reuses the two lookups; run directly, this prints them.
module.exports = { peta, leapingBunny, petaPage, fold, LB, PETA };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
