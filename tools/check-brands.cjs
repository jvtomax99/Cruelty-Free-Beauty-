// Checks data/brands.json: missing or invalid fields, claims without a
// source or date, checks older than 90 days, and (with --links) dead links.
//
//   node tools/check-brands.cjs            fields and dates only (no network)
//   node tools/check-brands.cjs --links    also opens every source link
//
// Errors (exit code 1): a broken record, or a yes/no claim with no source
// link or date, or a dead link. Warnings: a field not researched yet, or a
// check that is due (over 90 days old). The app shows "check due" for those.

const fs = require('fs');

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set (cloud
// sessions reach the web only through a proxy). Re-run once with it on.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = require('child_process').spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status === null ? 1 : r.status);
}
const path = require('path');

const FILE = process.env.BRANDS_FILE || path.join(__dirname, '..', 'data', 'brands.json');
const MAX_AGE_DAYS = 90;
const STATUS = ['yes', 'no', 'unknown'];
const PARENT_STATUS = ['yes', 'no', 'unknown', 'n/a'];
const VEGAN = ['all', 'some', 'none', 'unknown'];
const PRICE = ['$', '$$', '$$$', null];
const REVIEW = ['verified', 'needs-review'];
const LINK_TYPES = ['plain', 'affiliate'];
const CLAIMS = { peta: STATUS, leapingBunny: STATUS, parent: PARENT_STATUS, chinaRetail: STATUS };

const OWN_SITE = { peta: /^https:\/\/(crueltyfree\.)?peta\.org\//, leapingBunny: /^https:\/\/(www\.)?leapingbunny\.org\// };

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const today = new Date(process.env.CHECK_DATE || new Date().toISOString().slice(0, 10));
const ageDays = (d) => Math.floor((today - new Date(d)) / 86400000);
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d));
const isUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);

function checkClaim(id, key, c, allowed) {
  if (!c || typeof c !== 'object') return err(id, `${key} is missing`);
  const status = key === 'parent' ? c.testsOnAnimals : c.status;
  if (!allowed.includes(status)) return err(id, `${key} status "${status}" is not one of ${allowed.join(', ')}`);
  const researched = c.checked !== null && c.checked !== undefined;
  if (!researched) {
    if (status === 'yes' || status === 'no') err(id, `${key} says "${status}" but has no checked date`);
    else warn(id, `${key} not researched yet`);
    return;
  }
  if (!isDate(c.checked)) return err(id, `${key} checked date "${c.checked}" is not YYYY-MM-DD`);
  if (ageDays(c.checked) < 0) err(id, `${key} checked date ${c.checked} is in the future`);
  if ((status === 'yes' || status === 'no') && !isUrl(c.url)) err(id, `${key} says "${status}" but has no https source link`);
  if (c.url !== null && c.url !== undefined && !isUrl(c.url)) err(id, `${key} link "${c.url}" is not an https link`);
  if (ageDays(c.checked) > MAX_AGE_DAYS) warn(id, `${key} check due (last checked ${c.checked}, ${ageDays(c.checked)} days ago)`);
}

function checkBrand(b, seen) {
  if (!b || typeof b !== 'object') return err('(empty entry)', 'brand entry is not an object');
  const id = b && b.id ? b.id : '(no id)';
  if (!b.id || !/^[a-z0-9-]+$/.test(b.id)) err(id, 'id must be lowercase letters, digits and dashes');
  if (seen.has(b.id)) err(id, 'duplicate id');
  seen.add(b.id);
  if (!b.name || typeof b.name !== 'string') err(id, 'name is missing');
  if (!Array.isArray(b.search) || !b.search.length) err(id, 'search names are missing (used by the recheck)');
  for (const [key, allowed] of Object.entries(CLAIMS)) checkClaim(id, key, b[key], allowed);
  if (!VEGAN.includes(b.vegan)) err(id, `vegan "${b.vegan}" is not one of ${VEGAN.join(', ')}`);
  if (!PRICE.includes(b.price)) err(id, `price "${b.price}" is not one of $, $$, $$$ or null`);
  if (b.price === null) warn(id, 'price not filled in');
  else if (!b.priceSource || !isUrl(b.priceSource.url) || !isDate(b.priceSource.checked)) err(id, 'price has no priceSource with an https link and checked date');
  else if (ageDays(b.priceSource.checked) > MAX_AGE_DAYS) warn(id, `price check due (last checked ${b.priceSource.checked})`);
  if (!Array.isArray(b.productTypes)) err(id, 'productTypes must be a list');
  else if (!b.productTypes.length) warn(id, 'productTypes not filled in');
  if (!Array.isArray(b.whereToBuy)) err(id, 'whereToBuy must be a list');
  else {
    if (!b.whereToBuy.length) warn(id, 'whereToBuy not filled in');
    b.whereToBuy.forEach((w, i) => {
      if (!w || typeof w !== 'object') return err(id, `whereToBuy ${i + 1} is not an object`);
      if (!w.store) err(id, `whereToBuy ${i + 1} has no store name`);
      if (!isUrl(w.url)) err(id, `whereToBuy ${i + 1} link is not an https link`);
      if (!LINK_TYPES.includes(w.linkType)) err(id, `whereToBuy ${i + 1} linkType must be plain or affiliate`);
    });
  }
  const STEPS = ['foundation', 'concealer', 'blush', 'bronzer', 'lip'];
  if (b.sells !== null && b.sells !== undefined) {
    if (typeof b.sells !== 'object') err(id, 'sells must be an object or null');
    else {
      for (const k of STEPS) if (typeof b.sells[k] !== 'boolean') err(id, `sells.${k} must be true or false`);
      const s = b.sells.source;
      if (!s || !isUrl(s.url) || !isDate(s.checked)) err(id, 'sells has no source with an https link and checked date');
      else if (ageDays(s.checked) > MAX_AGE_DAYS) warn(id, `sells check due (last checked ${s.checked})`);
    }
  }
  if (b.shadeFinder !== null && b.shadeFinder !== undefined) {
    const f = b.shadeFinder;
    if (!f || !isUrl(f.url) || !f.label || !isDate(f.checked)) err(id, 'shadeFinder needs an https url, a label and a checked date');
    else if (ageDays(f.checked) > MAX_AGE_DAYS) warn(id, `shadeFinder check due (last checked ${f.checked})`);
  }
  if (!REVIEW.includes(b.review)) err(id, `review "${b.review}" is not one of ${REVIEW.join(', ')}`);
  // Brand rule 3: a certifier's status must link that certifier's own site.
  for (const [k, re] of Object.entries(OWN_SITE)) {
    const c = b[k];
    if (c && (c.status === 'yes' || c.status === 'no') && !re.test(c.url || '')) err(id, `${k} says "${c.status}" but does not link ${k === 'peta' ? 'PETA' : 'Leaping Bunny'}'s own site`);
  }
  if (b.review === 'verified') {
    const open = Object.keys(CLAIMS).filter((k) => b[k] && (b[k].checked === null || b[k].checked === undefined));
    if (open.length) err(id, `review is "verified" but ${open.join(', ')} not researched`);
  }
}

// The "changes" list feeds the app's "What changed" notices, so a wrong entry is a wrong public
// claim about a brand: each needs a known brand, a real before and after, a date and a source.
function checkChanges(list, brands) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return err('changes', 'must be a list');
  const newest = new Map();
  list.forEach((c, i) => {
    const at = `changes ${i + 1}`;
    if (!c || typeof c !== 'object') return err(at, 'is not an object');
    const b = brands.find((x) => x && x.id === c.id);
    if (!b) return err(at, `brand id "${c.id}" is not in the list`);
    const allowed = CLAIMS[c.claim];
    if (!allowed) return err(at, `claim "${c.claim}" is not one of ${Object.keys(CLAIMS).join(', ')}`);
    if (!allowed.includes(c.from) || !allowed.includes(c.to)) err(at, `from "${c.from}" and to "${c.to}" must each be one of ${allowed.join(', ')}`);
    if (c.from === c.to) err(at, 'from and to are the same, so nothing changed');
    if (!isDate(c.date)) return err(at, `date "${c.date}" is not YYYY-MM-DD`);
    if (ageDays(c.date) < 0) err(at, `date ${c.date} is in the future`);
    if (!isUrl(c.url)) err(at, 'has no https source link');
    else if (OWN_SITE[c.claim] && !OWN_SITE[c.claim].test(c.url)) err(at, `a ${c.claim} change must link the certifier's own site`);
    if (c.note !== undefined && (typeof c.note !== 'string' || c.note.length > 120)) err(at, 'note must be text of at most 120 characters');
    const k = `${c.id}|${c.claim}`;
    if (!newest.has(k) || newest.get(k).date < c.date) newest.set(k, c);
  });
  // The newest change to a claim must agree with what the brand record says now.
  for (const c of newest.values()) {
    const b = brands.find((x) => x.id === c.id);
    const now = c.claim === 'parent' ? b.parent && b.parent.testsOnAnimals : b[c.claim] && b[c.claim].status;
    if (now !== c.to) err(`changes (${c.id})`, `says ${c.claim} became "${c.to}" on ${c.date}, but the brand record says "${now}"`);
  }
}

async function checkLinks(brands) {
  const links = new Map(); // url -> brand ids
  for (const b of brands) {
    if (!b || typeof b !== 'object') continue;
    const urls = [...Object.keys(CLAIMS).map((k) => b[k] && b[k].url), b.priceSource && b.priceSource.url, b.shadeFinder && b.shadeFinder.url, b.sells && b.sells.source && b.sells.source.url, ...(b.whereToBuy || []).map((w) => w && w.url)];
    for (const u of urls) if (isUrl(u)) links.set(u, [...(links.get(u) || []), b.id]);
  }
  for (const [url, ids] of links) {
    let res;
    try {
      res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (C.F.B. link check)' } });
    } catch (e) {
      warn(ids.join(', '), `could not reach ${url} (${e.cause ? e.cause.code || e.cause.message : e.message}); network block or site down`);
      continue;
    }
    if (res.status === 404 || res.status === 410) err(ids.join(', '), `dead link (${res.status}): ${url}`);
    else if (!res.ok) warn(ids.join(', '), `link answered ${res.status}: ${url}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  return links.size;
}

async function main() {
  let data;
  try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {
    console.error(`Cannot read ${FILE}: ${e.message}`); process.exit(1);
  }
  if (!Array.isArray(data.brands)) { console.error('brands.json has no "brands" list'); process.exit(1); }
  const seen = new Set();
  data.brands.forEach((b) => checkBrand(b, seen));
  checkChanges(data.changes, data.brands);
  let linkCount = 0;
  if (process.argv.includes('--links')) linkCount = await checkLinks(data.brands);

  console.log(`${data.brands.length} brands and ${(data.changes || []).length} changes checked${linkCount ? `, ${linkCount} links opened` : ''}.`);
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
  if (errors.length) console.log(`\nErrors (${errors.length}):\n  ` + errors.join('\n  '));
  else console.log('\nNo errors.');
  process.exit(errors.length ? 1 : 0);
}

main();
