// Looks up brands on PETA's and Leaping Bunny's own sites and prints what
// each certifier says, with the page to cite. It does not edit brands.json:
// a person (or the monthly scheduled run) reads the output and decides.
//
//   node tools/lookup-certifiers.cjs "Milani" "e.l.f."      (names to search)
//   node tools/lookup-certifiers.cjs --file data/brands.json (every brand's search names)
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

async function peta(name) {
  const q = `${PETA}/wp-json/wp/v2/company?search=${encodeURIComponent(name)}&per_page=10&_fields=link,title,class_list`;
  const hits = JSON.parse(await get(q));
  const out = [];
  for (const h of hits.slice(0, 6)) {
    const html = await get(h.link);
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
    out.push({
      title: decode(h.title.rendered),
      url: h.link,
      status,
      verdict,
      vegan: icons.some((i) => i.cls === 'is-vegan'),
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
  if (args[0] === '--file' && !args[1]) { console.error('Usage: --file data/brands.json'); process.exit(1); }
  if (args[0] === '--file') {
    const data = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    names = data.brands.map((b) => ({ id: b.id, search: b.search || [b.name] }));
  } else {
    names = args.map((n) => ({ id: n, search: [n] }));
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
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
