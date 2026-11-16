// Builds the translation catalog: every user-visible English string in the app, extracted
// from the source with a JS parser. Run: NODE_PATH=<dir with acorn> node tools/extract_strings.mjs
// (npm i acorn acorn-walk). Writes data/i18n/catalog.json.
// Template literals become patterns: `Win ${n} games` -> "Win {0} games".
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const acorn = require('acorn'), walk = require('acorn-walk');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const FILES = ['src/app.js', 'src/puzzles2.js', 'src/rewards.js', 'src/insights.js', 'src/lobby-ui.js', 'src/review.js', 'src/analysis.js',
  'src/home.js', 'src/boot.js', 'src/lessons.js', 'src/courses.js', 'src/bots.js', 'src/worldcourses.js', 'src/variants.js', 'src/world.js', 'src/i18n.js', 'src/me.js', 'src/daily.js', 'src/fx.js', 'src/layout.js', 'src/board.js', 'src/play.js', 'src/friends.js', 'src/learn.js', 'src/home.js', 'src/lobby-client.js', 'src/daily.js'];
// calls whose string arguments are never shown to people
const SKIP_CALLS = new Set(['icon', 'iconSvgInline', 'querySelector', 'querySelectorAll', 'getElementById', 'addEventListener', 'removeEventListener', 'setAttribute', 'getAttribute',
  'beep', 'go', 'haptic', 'badge', 'avatar', 'pieceImg', 'classBadge', 'sqFromName', 'moveFromUci', 'moveFromSan', 'play', 'roomArt', 'stageBanner_key', 'matchMedia', 'getItem', 'setItem',
  'removeItem', 'postMessage', 'emit', 'on', 'createElement', 'createElementNS', 'setProperty', 'add', 'remove', 'contains', 'startsWith', 'endsWith', 'includes', 'split', 'join',
  'replace', 'indexOf', 'test', 'match', 'parseTc', 'tcKey', 'newClock', 'fetch', 'require', 'leagueIcon', 'rewardEvent', 'questEvent', 'inc', 'setOption', 'analyzePos', 'engineRequest', 'padStart', 'toFixed', 'Worker', 'Blob', 'RegExp', 'Error']);
// object keys whose values are never shown
const SKIP_KEYS = new Set(['class', 'style', 'id', 'type', 'href', 'src', 'data-r', 'data-i', 'role', 'alt_', 'fen', 'moves', 'goal', 'icon', 'piece', 'avatar', 'kind', 'cls', 'color', 'side', 'sym',
  'marks', 'stars', 'pieces', 'fixed', 'mode', 'id_', 'key', 'path', 'uci', 'best', 'line', 'cat', 'themes', 'variant', 'grid', 'tc', 'reason_', 'background', 'width', 'height', 'left', 'top',
  'maxlength', 'autocapitalize', 'autocomplete', 'rel', 'as', 'crossorigin', 'viewBox', 'fill', 'stroke', 'light', 'dark', 'w', 'b', 'req', 'ach', 'level', 'sound', 'board', 'ev', 'show', 'showMoves', 'arrows', 'ffish']);
const looksLikeSan = s => /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?)[+#]?[!?]*$/.test(s);
const looksLikeCode = s => looksLikeSan(s) || /^-?[\d.]+(px|em|rem|%|deg|ms|s)\b/.test(s) || /^[#.\[]|^[a-z0-9_-]+$|^[A-Z_0-9]+$|=>|[{}]|;$|https?:|^data:|^M[\d.-]|\b(px|rgba?|var\()\b|^\s*$|^[\d\s.,:+\-/%]+$|^[a-h][1-8]/.test(s) || !/[A-Za-z]{2}/.test(s);
const out = new Map();
const addForce = (s, where) => { s = s.replace(/\s+/g, ' ').trim(); if (s && !out.has(s)) out.set(s, where); };
const add = (s, where) => { s = s.replace(/\s+/g, ' ').trim(); const bare = s.replace(/\{\d\}/g, ' ').trim(); if (s.length < 2 || !bare || (looksLikeCode(bare) && !(/\{\d\}/.test(s) && /^[a-z][a-z ]+$/.test(bare) && bare.length > 3)) || /<(?!\/?(b|br|i|em)\b)[a-zA-Z\/]|class=/.test(s)) return; if (!out.has(s)) out.set(s, where); };
for (const f of FILES) {
  const fp = path.join(root, f); if (!fs.existsSync(fp)) continue;
  const src = fs.readFileSync(fp, 'utf8');
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); } catch (e) { console.error('parse fail', f, e.message); continue; }
  walk.fullAncestor(ast, (node, ancestors) => {
    if (node.type !== 'Literal' && node.type !== 'TemplateLiteral') return;
    if (node.type === 'Literal' && typeof node.value !== 'string') return;
    const parent = ancestors[ancestors.length - 2], grand = ancestors[ancestors.length - 3];
    if (parent && parent.type === 'Property' && parent.key === node) return;               // object key
    if (parent && parent.type === 'Property' && SKIP_KEYS.has(parent.key.name || parent.key.value)) return;
    if (parent && parent.type === 'MemberExpression') return;                               // obj['x']
    if (parent && (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in'].includes(parent.operator))) return;
    if (parent && parent.type === 'SwitchCase') return;
    for (const a of ancestors) if (a.type === 'CallExpression') { const c = a.callee; const nm = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : ''; if (SKIP_CALLS.has(nm) && a.arguments.some(x => x === node || (x.start <= node.start && x.end >= node.end))) { if (nm !== 'h' ) return; } }
    // h(tag, attrs, ...): the tag name is not text
    if (parent && parent.type === 'CallExpression' && parent.callee.name === 'h' && parent.arguments[0] === node) return;
    if (parent && parent.type === 'ImportDeclaration') return;
    if (node.type === 'Literal') add(node.value, f);
    else { let s = ''; node.quasis.forEach((q, i) => { s += q.value.cooked; if (i < node.expressions.length) s += '{' + i + '}'; }); if (node.expressions.length > 4) return; add(s, f); }
  });
}
// strings named in comments as tr('...') (for words the parser skips, like object values under short keys)
for (const f of FILES) { const fp = path.join(root, f); if (!fs.existsSync(fp)) continue; for (const m of fs.readFileSync(fp, 'utf8').matchAll(/tr\('([^']+)'\)/g)) addForce(m[1], f); }
// puzzle names and tips from data
for (const p of JSON.parse(fs.readFileSync(path.join(root, 'data/puzzles.json'), 'utf8'))) { if (p.name) add(p.name, 'data'); if (p.tip) add(p.tip, 'data'); }
const strings = [...out.keys()].sort((a, b) => a.localeCompare(b));
fs.mkdirSync(path.join(root, 'data/i18n'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/i18n/catalog.json'), JSON.stringify({ count: strings.length, note: 'English source strings. {0},{1} are placeholders. Keep <b>, <br> and placeholders unchanged.', strings }, null, 1));
console.log('catalog strings:', strings.length);
