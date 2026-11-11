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
  if (!Array.isArray(b.productTypes)) err(id, 'productTypes must be a list');
  else if (!b.productTypes.length) warn(id, 'productTypes not filled in');
  if (!Array.isArray(b.whereToBuy)) err(id, 'whereToBuy must be a list');
  else {
    if (!b.whereToBuy.length) warn(id, 'whereToBuy not filled in');
    b.whereToBuy.forEach((w, i) => {
      if (!w.store) err(id, `whereToBuy ${i + 1} has no store name`);
      if (!isUrl(w.url)) err(id, `whereToBuy ${i + 1} link is not an https link`);
      if (!LINK_TYPES.includes(w.linkType)) err(id, `whereToBuy ${i + 1} linkType must be plain or affiliate`);
    });
  }
  if (!REVIEW.includes(b.review)) err(id, `review "${b.review}" is not one of ${REVIEW.join(', ')}`);
}

async function checkLinks(brands) {
  const links = new Map(); // url -> brand ids
  for (const b of brands) {
    const urls = [...Object.keys(CLAIMS).map((k) => b[k] && b[k].url), ...(b.whereToBuy || []).map((w) => w.url)];
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
  let linkCount = 0;
  if (process.argv.includes('--links')) linkCount = await checkLinks(data.brands);

  console.log(`${data.brands.length} brands checked${linkCount ? `, ${linkCount} links opened` : ''}.`);
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + warnings.join('\n  '));
  if (errors.length) console.log(`\nErrors (${errors.length}):\n  ` + errors.join('\n  '));
  else console.log('\nNo errors.');
  process.exit(errors.length ? 1 : 0);
}

main();
