// Validates every step of every course in src/worldcourses.js with ffish
// (the WebAssembly build of Fairy-Stockfish's move generator / rules).
//
// Setup (ffish is NOT a dependency of the repo; install it outside the repo):
//   npm i ffish --prefix /tmp/wc
//   node tools/validate_worldcourses.mjs            check everything
//   node tools/validate_worldcourses.mjs shogi      only one game
//   FFISH_DIR=/some/dir node tools/validate_worldcourses.mjs
//
// Checks:
//  - no emoji characters anywhere in the file; only <b>, </b>, <br> markup in texts
//  - every course has title/intro/lessons; lesson ids unique and well formed
//  - every FEN is valid for its variant (ffish.validateFen === 1) and the side NOT to move is not in check
//  - marks / arrows name real squares of that variant's board
//  - text steps: optional `legal` / `illegal` move lists are verified (rule demos such as
//    "the elephant cannot cross the river"); optional `losing` lists moves that end the game at
//    once in a loss for the mover (ffish models the shogi pawn-drop-mate ban this way)
//  - goal steps: every listed move is legal and achieves the goal
//      check   -> the opponent is in check afterwards
//      mate    -> the opponent is checkmated; listed moves must be EXACTLY the set of mating moves
//      capture -> the move captures something
//      drop    -> the move is a drop (X@sq)
//      promote -> the move is a promotion (shogi '+', or a promotion piece letter)
//      move    -> listed moves are legal
//    options: wins:true  -> the game is over after the move and the mover has won
//             best:true  -> every listed move is better than every unlisted legal move by at least
//                           `margin` (default 1.5) in a small material/mate negamax (`depth` plies,
//                           default 3). Used wherever the text claims "the only good move".
//  - line steps: `side` matches the side to move, every move legal in sequence,
//    optional result:'1-0'|'0-1'|'1/2-1/2' checked at the end
// Prints PASS/FAIL per step and a summary; exit code 1 on any failure.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.WORLD_COURSES_FILE || path.join(__dirname, '../src/worldcourses.js');
const FFISH_DIR = process.env.FFISH_DIR || '/tmp/wc';
const require = createRequire(import.meta.url);

// ffish's emscripten loader prefers fetch() when it exists, which fails for file paths in Node.
const savedFetch = globalThis.fetch;
delete globalThis.fetch;
let ff;
try {
  ff = require(path.join(FFISH_DIR, 'node_modules/ffish/ffish.js'));
} catch (e) {
  console.error('Could not load ffish from ' + FFISH_DIR + '. Run: npm i ffish --prefix ' + FFISH_DIR);
  process.exit(2);
}
await new Promise(res => { if (ff.Board) res(); else ff.onRuntimeInitialized = res; });
globalThis.fetch = savedFetch;

// validateFen only knows a variant after a Board of that variant has been created once.
for (const v of ['xiangqi', 'shogi', 'janggi', 'makruk', 'shatranj', 'sittuyin', 'crazyhouse', '3check', 'kingofthehill', 'atomic', 'horde', 'antichess']) new ff.Board(v).delete();

const src = fs.readFileSync(FILE, 'utf8');
const WORLD = require(FILE);
const only = process.argv[2];

let pass = 0, fail = 0, warn = 0;
const failures = [];
function FAIL(where, msg) { fail++; failures.push(where + ': ' + msg); console.log('FAIL ' + where + ': ' + msg); }

// ---------- file-level checks ----------
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}\u{3030}\u{303D}\u{3297}\u{3299}\u{E0020}-\u{E007F}]/u;
src.split('\n').forEach((line, i) => {
  const m = line.match(EMOJI);
  if (m) FAIL('file line ' + (i + 1), 'emoji / pictograph character U+' + m[0].codePointAt(0).toString(16).toUpperCase());
});

const EXPECTED = ['xiangqi', 'shogi', 'janggi', 'makruk', 'shatranj', 'sittuyin', 'crazyhouse', '3check', 'kingofthehill', 'atomic', 'horde', 'antichess'];
for (const k of EXPECTED) if (!WORLD[k]) FAIL('courses', 'missing course ' + k);
for (const k of Object.keys(WORLD)) if (!EXPECTED.includes(k)) FAIL('courses', 'unexpected course key ' + k);

// ---------- helpers ----------
function boardDims(fen) {
  const rows = fen.split(' ')[0].replace(/\[.*\]/, '').split('/');
  let files = 0;
  for (const ch of rows[0].match(/\d+|\+?[A-Za-z]~?|\*/g) || []) files += /^\d+$/.test(ch) ? parseInt(ch, 10) : 1;
  return { files, ranks: rows.length };
}
function squareOk(sq, dims) {
  const m = /^([a-z])(\d+)$/.exec(sq);
  if (!m) return false;
  const f = m[1].charCodeAt(0) - 97, r = parseInt(m[2], 10);
  return f >= 0 && f < dims.files && r >= 1 && r <= dims.ranks;
}
function checkMarkup(where, text) {
  if (typeof text !== 'string' || !text.trim()) { FAIL(where, 'missing text'); return false; }
  const tags = text.match(/<[^>]*>/g) || [];
  for (const t of tags) if (!['<b>', '</b>', '<br>'].includes(t)) { FAIL(where, 'disallowed markup ' + t); return false; }
  const open = (text.match(/<b>/g) || []).length, close = (text.match(/<\/b>/g) || []).length;
  if (open !== close) { FAIL(where, 'unbalanced <b>'); return false; }
  return true;
}
const VALUES = {
  xiangqi: { r: 9, c: 4.5, n: 4, b: 2, a: 2, p: 1, k: 0 },
  janggi: { r: 13, c: 7, n: 5, b: 3, a: 3, p: 2, k: 0 },
  shogi: { p: 1, l: 3, n: 4, s: 5, g: 6, b: 8, r: 10, k: 0, '+p': 6, '+l': 6, '+n': 6, '+s': 6, '+b': 10, '+r': 12 },
  makruk: { r: 5, n: 3, s: 2.5, m: 1.5, p: 1, k: 0 },
  shatranj: { r: 5, n: 3, b: 1, q: 1.5, p: 1, k: 0 },
  sittuyin: { r: 5, n: 3, s: 2, f: 1.5, p: 1, k: 0 },
  chess: { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 },
};
function material(variant, fen) {
  const V = VALUES[variant] || VALUES.chess;
  const boardPart = fen.split(' ')[0];
  let score = 0; // white minus black
  const toks = boardPart.match(/\+?[A-Za-z]/g) || [];
  for (const t of toks) {
    const lower = t.toLowerCase();
    const v = V[lower] !== undefined ? V[lower] : (V[lower.replace('+', '')] || 0);
    score += (t.replace('+', '') === t.replace('+', '').toUpperCase()) ? v : -v;
  }
  return score;
}
function resultScore(res, whiteToMove) {
  if (res === '1-0') return whiteToMove ? 1000 : -1000;
  if (res === '0-1') return whiteToMove ? -1000 : 1000;
  return 0;
}
function negamax(b, variant, depth) {
  const white = b.turn();
  const moves = b.legalMoves().trim();
  if (!moves || b.isGameOver(false)) {
    const r = b.result(false);
    if (r && r !== '*') return resultScore(r, white) * (1 + depth / 100);
    return 0;
  }
  if (depth === 0) { const m = material(variant, b.fen()); return white ? m : -m; }
  let best = -Infinity;
  for (const mv of moves.split(' ')) {
    b.push(mv);
    const s = -negamax(b, variant, depth - 1);
    b.pop();
    if (s > best) best = s;
  }
  return best;
}
function evalMoves(variant, fen, depth) {
  const b = new ff.Board(variant, fen);
  const out = {};
  for (const mv of b.legalMoves().trim().split(' ').filter(Boolean)) {
    b.push(mv); out[mv] = -negamax(b, variant, depth - 1); b.pop();
  }
  b.delete();
  return out;
}
function isPromotion(mv) { return /\+$/.test(mv) || /^[a-z]\d+[a-z]\d+[a-z]$/.test(mv); }
function legalSet(b) { return new Set(b.legalMoves().trim().split(' ').filter(Boolean)); }
function checkFen(where, variant, fen) {
  if (typeof fen !== 'string') { FAIL(where, 'missing fen'); return false; }
  const v = ff.validateFen(fen, variant);
  if (v !== 1) { FAIL(where, 'invalid FEN for ' + variant + ' (code ' + v + '): ' + fen); return false; }
  const parts = fen.split(' ');
  if (variant !== 'antichess') {
    const flipped = parts.slice(); flipped[1] = parts[1] === 'w' ? 'b' : 'w';
    const fb = new ff.Board(variant, flipped.join(' '));
    const inCheck = fb.isCheck();
    fb.delete();
    if (inCheck) { FAIL(where, 'side not to move is in check: ' + fen); return false; }
  }
  return true;
}
function checkSquares(where, step, dims) {
  let ok = true;
  for (const sq of step.marks || []) if (!squareOk(sq, dims)) { FAIL(where, 'bad mark square ' + sq); ok = false; }
  for (const a of step.arrows || []) {
    if (!Array.isArray(a) || a.length !== 2 || !squareOk(a[0], dims) || !squareOk(a[1], dims)) { FAIL(where, 'bad arrow ' + JSON.stringify(a)); ok = false; }
  }
  return ok;
}

// ---------- per-step validation ----------
function validateStep(variant, where, step) {
  if (!checkMarkup(where, step.text)) return false;
  const dims = step.fen ? boardDims(step.fen) : null;
  if (step.type === 'text') {
    if (step.fen === undefined) {
      if (step.marks || step.arrows) { FAIL(where, 'marks/arrows without fen'); return false; }
      return true;
    }
    if (!checkFen(where, variant, step.fen) || !checkSquares(where, step, dims)) return false;
    const b = new ff.Board(variant, step.fen);
    const legal = legalSet(b);
    b.delete();
    for (const m of step.legal || []) if (!legal.has(m)) { FAIL(where, 'move claimed legal is not: ' + m); return false; }
    for (const m of step.illegal || []) if (legal.has(m)) { FAIL(where, 'move claimed illegal is legal: ' + m); return false; }
    for (const m of step.losing || []) {
      // moves that the engine allows but that immediately lose (shogi pawn-drop mate)
      const lb = new ff.Board(variant, step.fen);
      const moverWhite = lb.turn();
      if (!legalSet(lb).has(m)) { FAIL(where, 'losing move is not even playable: ' + m); lb.delete(); return false; }
      lb.push(m);
      const res = lb.isGameOver(false) ? lb.result(false) : '*';
      lb.delete();
      if (res !== (moverWhite ? '0-1' : '1-0')) { FAIL(where, 'move ' + m + ' does not lose at once (result ' + res + ')'); return false; }
    }
    return true;
  }
  if (step.type === 'goal') {
    if (!checkFen(where, variant, step.fen) || !checkSquares(where, step, dims)) return false;
    if (!step.success || !step.fail) { FAIL(where, 'goal needs success and fail text'); return false; }
    if (!checkMarkup(where + ' success', step.success) || !checkMarkup(where + ' fail', step.fail)) return false;
    const goal = step.goal;
    if (!['move', 'mate', 'check', 'capture', 'drop', 'promote'].includes(goal)) { FAIL(where, 'unknown goal ' + goal); return false; }
    if (!Array.isArray(step.moves) || !step.moves.length) { FAIL(where, 'goal needs a non-empty moves list'); return false; }
    const b = new ff.Board(variant, step.fen);
    const legal = legalSet(b);
    const achieves = mv => {
      const cap = b.isCapture(mv);
      const moverWhite = b.turn();
      b.push(mv);
      let ok = true;
      const over = b.isGameOver(false), res = b.result(false);
      if (goal === 'check') ok = b.isCheck() || (step.wins && over);
      if (goal === 'mate') ok = b.isCheck() && b.legalMoves().trim() === '' && res === (moverWhite ? '1-0' : '0-1');
      if (goal === 'capture') ok = cap;
      if (goal === 'drop') ok = mv.includes('@');
      if (goal === 'promote') ok = isPromotion(mv);
      if (ok && step.wins) ok = over && res === (moverWhite ? '1-0' : '0-1');
      b.pop();
      return ok;
    };
    for (const mv of step.moves) {
      if (!legal.has(mv)) { FAIL(where, 'listed move ' + mv + ' is illegal. Legal: ' + [...legal].join(' ')); b.delete(); return false; }
      if (!achieves(mv)) { FAIL(where, 'listed move ' + mv + ' does not achieve goal ' + goal + (step.wins ? ' (+wins)' : '')); b.delete(); return false; }
    }
    if (goal === 'mate') {
      const all = [...legal].filter(achieves);
      const missing = all.filter(m => !step.moves.includes(m));
      if (missing.length) { FAIL(where, 'other mating moves exist and are not listed: ' + missing.join(' ')); b.delete(); return false; }
    }
    b.delete();
    if (step.best) {
      const depth = step.depth || 3, margin = step.margin || 1.5;
      const sc = evalMoves(variant, step.fen, depth);
      const listedMin = Math.min(...step.moves.map(m => sc[m]));
      const others = Object.keys(sc).filter(m => !step.moves.includes(m));
      const bestOther = others.length ? Math.max(...others.map(m => sc[m])) : -Infinity;
      if (!(listedMin >= bestOther + margin)) {
        const top = others.sort((x, y) => sc[y] - sc[x]).slice(0, 4).map(m => m + '=' + sc[m].toFixed(1)).join(' ');
        FAIL(where, 'best-move claim not confirmed (depth ' + depth + '): listed min ' + listedMin.toFixed(1) + ', best other ' + top);
        return false;
      }
    }
    return true;
  }
  if (step.type === 'line') {
    if (!checkFen(where, variant, step.fen) || !checkSquares(where, step, dims)) return false;
    if (!checkMarkup(where + ' success', step.success)) return false;
    const turn = step.fen.split(' ')[1];
    if (step.side !== turn) { FAIL(where, 'side ' + step.side + ' does not match side to move ' + turn); return false; }
    if (!Array.isArray(step.moves) || step.moves.length < 1) { FAIL(where, 'line needs moves'); return false; }
    const b = new ff.Board(variant, step.fen);
    for (let i = 0; i < step.moves.length; i++) {
      const mv = step.moves[i];
      if (!legalSet(b).has(mv)) { FAIL(where, 'move ' + (i + 1) + ' (' + mv + ') illegal in ' + b.fen()); b.delete(); return false; }
      b.push(mv);
    }
    if (step.result) {
      const res = b.isGameOver(false) ? b.result(false) : '*';
      if (res !== step.result) { FAIL(where, 'expected result ' + step.result + ' got ' + res); b.delete(); return false; }
    }
    b.delete();
    return true;
  }
  FAIL(where, 'unknown step type ' + step.type);
  return false;
}

// ---------- main ----------
const counts = [];
for (const key of EXPECTED) {
  const course = WORLD[key];
  if (!course || (only && only !== key)) continue;
  if (!course.title || !course.intro || !Array.isArray(course.lessons) || !course.lessons.length) { FAIL(key, 'course needs title, intro, lessons'); continue; }
  checkMarkup(key + ' intro', course.intro);
  const ids = new Set();
  let nSteps = 0;
  for (const lesson of course.lessons) {
    const lw = key + '/' + lesson.id;
    if (!/^[a-z0-9-]+$/.test(lesson.id || '')) FAIL(lw, 'bad lesson id');
    if (ids.has(lesson.id)) FAIL(lw, 'duplicate lesson id');
    ids.add(lesson.id);
    if (!lesson.title || !lesson.desc || !Array.isArray(lesson.steps) || !lesson.steps.length) { FAIL(lw, 'lesson needs title, desc, steps'); continue; }
    lesson.steps.forEach((step, i) => {
      nSteps++;
      const where = lw + ' #' + (i + 1) + ' (' + step.type + (step.goal ? ':' + step.goal : '') + ')';
      let ok;
      try { ok = validateStep(key, where, step); } catch (e) { FAIL(where, 'exception ' + e.message); ok = false; }
      if (ok) { pass++; console.log('PASS ' + where); }
    });
  }
  counts.push(key + ': ' + course.lessons.length + ' lessons, ' + nSteps + ' steps');
}
console.log('\n' + counts.join('\n'));
console.log('\nSummary: ' + pass + ' steps passed, ' + fail + ' failures' + (warn ? ', ' + warn + ' warnings' : ''));
if (fail) { console.log(failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
