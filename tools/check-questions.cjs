// Checks data/questions.json (the Garden's written questions).
//   node tools/check-questions.cjs
// Errors (exit code 1): a question without a source, a source without a link
// or date, a repeated id or option, an unknown habitat, fewer than 2 options,
// or a source checked over 90 days ago (reread the page, then update the date).
const fs = require('fs');
const path = require('path');
const file = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.json'), 'utf8'));
const TOPICS = ['meadow', 'burrow', 'oak', 'pond', 'orchard'];
const MAX_AGE_DAYS = 90;
let errors = 0;
const bad = (m) => { console.log('ERROR  ' + m); errors++; };

for (const [k, s] of Object.entries(file.sources)) {
  if (!s.t || !s.u) bad(`source ${k}: needs a title and a link`);
  if (!/^\d{4}-\d\d-\d\d$/.test(s.checked || '')) bad(`source ${k}: needs a checked date (YYYY-MM-DD)`);
  else if ((Date.now() - new Date(s.checked + 'T00:00:00').getTime()) / 864e5 > MAX_AGE_DAYS) bad(`source ${k}: checked over ${MAX_AGE_DAYS} days ago`);
  if (s.u && !/^https:\/\//.test(s.u) && s.u[0] !== '#') bad(`source ${k}: link must be https or a screen of the app`);
}
const ids = new Set(), used = new Set(), per = {};
for (const q of file.questions) {
  const at = `question ${q.id || '(no id)'}`;
  if (!q.id || ids.has(q.id)) bad(`${at}: id missing or repeated`);
  ids.add(q.id);
  if (/^brand:/.test(q.id || '')) bad(`${at}: "brand:" ids belong to the questions the app builds`);
  if (!TOPICS.includes(q.topic)) bad(`${at}: unknown habitat "${q.topic}"`);
  per[q.topic] = (per[q.topic] || 0) + 1;
  if (!q.q || !q.why) bad(`${at}: needs the question and the "why" line`);
  if (!Array.isArray(q.options) || q.options.length < 2) bad(`${at}: needs at least 2 options (the first is the right one)`);
  else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) bad(`${at}: two options are the same`);
  if (!Array.isArray(q.src) || !q.src.length) bad(`${at}: no source`);
  for (const k of q.src || []) { if (!file.sources[k]) bad(`${at}: source "${k}" isn't in the sources table`); used.add(k); }
}
for (const k of Object.keys(file.sources)) if (!used.has(k)) bad(`source ${k}: no question uses it`);
for (const t of TOPICS) if (!per[t]) bad(`habitat ${t}: has no questions`);

console.log(`${file.questions.length} questions: ${TOPICS.map((t) => `${t} ${per[t] || 0}`).join(', ')}`);
console.log(errors ? `\n${errors} error(s)` : 'All good');
process.exit(errors ? 1 : 0);
