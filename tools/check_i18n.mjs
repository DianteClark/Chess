// Checks the translation dictionaries in data/i18n/<code>.json against data/i18n/catalog.json.
// Usage:
//   node tools/check_i18n.mjs                 check every language, print coverage
//   node tools/check_i18n.mjs --missing <code> print the untranslated catalog strings for <code> as JSON
//   node tools/check_i18n.mjs --min 97        fail if any language is below this coverage (default 97)
// Checks per file: valid JSON object of strings, every key is in the catalog, placeholder sets
// ({0}, {1}, ...) match and each appears exactly once, <b> / </b> / <br> counts match, no emoji.
// Exit code 1 if any check fails.
import fs from 'fs';
import path from 'path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'data', 'i18n');
const LANGS = ['es', 'pt', 'fr', 'de', 'zh', 'ja', 'hi', 'ar'];
const args = process.argv.slice(2);

const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
const strings = catalog.strings;
const inCatalog = new Set(strings);

function load(code) {
  const file = path.join(dir, code + '.json');
  if (!fs.existsSync(file)) return { error: 'file missing' };
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { error: 'not a JSON object' };
    return { dict: d };
  } catch (e) { return { error: 'invalid JSON: ' + e.message }; }
}

if (args[0] === '--missing') {
  const code = args[1];
  if (!code) { console.error('usage: --missing <code>'); process.exit(2); }
  const { dict } = load(code);
  const have = dict || {};
  console.log(JSON.stringify(strings.filter(s => !(s in have)), null, 1));
  process.exit(0);
}
const minIdx = args.indexOf('--min');
const MIN = minIdx >= 0 ? +args[minIdx + 1] : 97;

const placeholders = s => (s.match(/\{\d+\}/g) || []);
const count = (s, re) => (s.match(re) || []).length;
// Extended_Pictographic catches emoji; also flag variation selector 16 and regional indicators
const EMOJI = /\p{Extended_Pictographic}|️|[\u{1F1E6}-\u{1F1FF}]/u;

let failed = false;
const rows = [];
for (const code of LANGS) {
  const { dict, error } = load(code);
  if (error) { console.log(`[${code}] ERROR ${error}`); failed = true; rows.push([code, 0, strings.length]); continue; }
  const problems = [];
  for (const [k, v] of Object.entries(dict)) {
    const where = JSON.stringify(k.length > 60 ? k.slice(0, 60) + '...' : k);
    if (typeof v !== 'string') { problems.push(`${where}: value is not a string`); continue; }
    if (!inCatalog.has(k)) { problems.push(`${where}: key not in catalog`); continue; }
    if (!v.trim()) problems.push(`${where}: empty translation`);
    const pk = placeholders(k), pv = placeholders(v);
    const setK = [...new Set(pk)].sort().join(','), setV = [...new Set(pv)].sort().join(',');
    if (setK !== setV) problems.push(`${where}: placeholders ${setK || '-'} vs ${setV || '-'}`);
    else if (pv.length !== new Set(pv).size) problems.push(`${where}: a placeholder appears more than once`);
    for (const [name, re] of [['<b>', /<b>/g], ['</b>', /<\/b>/g], ['<br>', /<br>/g]]) {
      if (count(k, re) !== count(v, re)) problems.push(`${where}: ${name} count ${count(k, re)} vs ${count(v, re)}`);
    }
    if (EMOJI.test(v)) problems.push(`${where}: contains emoji`);
  }
  const n = strings.filter(s => s in dict).length;
  const pct = 100 * n / strings.length;
  rows.push([code, n, strings.length]);
  if (problems.length) { failed = true; console.log(`[${code}] ${problems.length} problem(s):`); problems.forEach(p => console.log('   ' + p)); }
  if (pct < MIN) { failed = true; console.log(`[${code}] coverage ${pct.toFixed(1)}% is below ${MIN}%`); }
}
console.log('\nlang  translated  missing  coverage');
for (const [code, n, total] of rows) console.log(`${code.padEnd(5)} ${String(n).padStart(6)}/${total}  ${String(total - n).padStart(7)}  ${(100 * n / total).toFixed(1)}%`);
console.log(failed ? '\nFAIL' : '\nOK: all languages pass');
process.exit(failed ? 1 : 0);
