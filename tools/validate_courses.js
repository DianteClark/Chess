// Validates every step of every course in src/courses.js with the real engine.
//   node tools/validate_courses.js            check everything
//   node tools/validate_courses.js tactics    only courses/lessons whose id contains "tactics"
// Checks:
//  - no emoji characters anywhere in courses.js; icons/levels/ids well formed
//  - text boards are well-formed; marks/showMoves are real squares
//  - stars: solvable, and par equals the true minimum (BFS with the app's own movement code)
//  - goal: legal FEN (one king each, side not to move not in check, no pawns on rank 1/8),
//          goal reachable in one move; 'move' goals: listed moves legal and UNIQUELY best:
//          each listed move beats every other legal move by >= 200 cp, or forces a mate
//          that no unlisted move matches
//  - line: all moves legal in sequence; each learner move (and each `alt`) is the engine's best,
//          within 30 cp of best, or keeps a forced mate. Opponent replies that look like
//          blunders are reported as warnings.
// Exit code 1 if anything fails.
const fs = require('fs'), vm = require('vm');
const E = require('../src/engine.js')();
const COURSES = require('../src/courses.js');
const MATE = E.MATE;

// ---- pull lessonTargets/boardFromPieces out of app.js so we test the real code ----
const app = fs.readFileSync(__dirname + '/../src/app.js', 'utf8');
const grab = name => { const i = app.indexOf('function ' + name); let d = 0, j = app.indexOf('{', i); for (; j < app.length; j++) { if (app[j] === '{') d++; else if (app[j] === '}' && --d === 0) break; } return app.slice(i, j + 1); };
const ctx = { E, sqFromName: E.sqFromName, Int8Array };
vm.createContext(ctx); vm.runInContext(grab('lessonTargets') + grab('boardFromPieces'), ctx);

const ICONS = new Set(['book', 'sword', 'crown', 'castle', 'target', 'fork', 'pin', 'skewer', 'bolt', 'shield', 'route', 'key', 'flag', 'pawn', 'king', 'rook', 'queen', 'knight', 'bishop', 'gem', 'bulb', 'half', 'alert']);
const LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const SQ = /^[a-h][1-8]$/, UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const filter = process.argv[2] || '';

let fails = 0, warns = 0, passes = 0;
const fail = (tag, msg) => { fails++; console.log('FAIL ', tag, '-', msg); };
const warn = (tag, msg) => { warns++; console.log('WARN ', tag, '-', msg); };
const pass = (tag, msg) => { passes++; console.log('PASS ', tag, '-', msg); };

// ---- emoji scan ----
const src = fs.readFileSync(__dirname + '/../src/courses.js', 'utf8');
const EMOJI = /[←-⇿⌀-⏿①-⓿■-◿☀-➿⬀-⯿〰〽㊗㊙️‍]|[\u{1F000}-\u{1FFFF}]/u;
src.split('\n').forEach((line, i) => { if (EMOJI.test(line)) fail('courses.js:' + (i + 1), 'emoji/pictograph character: ' + line.trim().slice(0, 60)); });
if (/[^\x00-\x7F]/.test(src)) src.split('\n').forEach((line, i) => { if (/[^\x00-\x7F]/.test(line) && !EMOJI.test(line)) warn('courses.js:' + (i + 1), 'non-ASCII character'); });

// ---- helpers ----
const moveByUci = (pos, u) => pos.legalMoves().find(m => pos.uci(m) === u || (u.length === 4 && pos.uci(m).slice(0, 4) === u && (!E.mPromo(m) || E.mPromo(m) === E.Q))) || 0;
function checkFen(fen) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2 || !/^[wb]$/.test(parts[1])) return 'FEN needs side to move';
  const rows = parts[0].split('/');
  if (rows.length !== 8) return 'FEN needs 8 ranks';
  for (const [i, r] of rows.entries()) {
    let n = 0; for (const c of r) { if (/[1-8]/.test(c)) n += +c; else if (/[pnbrqkPNBRQK]/.test(c)) { n++; if (/[pP]/.test(c) && (i === 0 || i === 7)) return 'pawn on back rank'; } else return 'bad char ' + c; }
    if (n !== 8) return 'rank ' + (8 - i) + ' has ' + n + ' squares';
  }
  if ((parts[0].match(/K/g) || []).length !== 1 || (parts[0].match(/k/g) || []).length !== 1) return 'need exactly one king per side';
  const pos = new E.Position(fen);
  if (pos.attacked(pos.kings[pos.turn ^ 1], pos.turn)) return 'side not to move is in check';
  return null;
}
function checkPlacement(b) {
  const rows = b.split('/'); if (rows.length !== 8) return 'board needs 8 ranks';
  for (const r of rows) { let n = 0; for (const c of r) { if (/[1-8]/.test(c)) n += +c; else if (/[pnbrqkPNBRQK]/.test(c)) n++; else return 'bad char ' + c; } if (n !== 8) return 'bad rank length'; }
  return null;
}
// Score every legal move from the mover's point of view (cp; mate = MATE - plies).
function scoreMoves(pos, opts) {
  const S = new E.Searcher(), out = [];
  for (const m of pos.legalMoves()) {
    pos.make(m);
    let sc; const st = pos.status();
    if (st.reason === 'checkmate') sc = MATE; else if (st.over) sc = 0;
    else sc = -S.search(pos, opts).score;
    pos.unmake();
    out.push({ m, uci: pos.uci(m), san: pos.san(m), sc });
  }
  return out.sort((a, b) => b.sc - a.sc);
}
const isMate = s => s > MATE - 300;
const mateIn = s => Math.round((MATE - s + 2) / 2);
const fmt = s => isMate(s) ? '#' + mateIn(s) : isMate(-s) ? '-#' + mateIn(-s) : (s > 0 ? '+' : '') + s;
const pieceCount = fen => (fen.split(' ')[0].match(/[a-zA-Z]/g) || []).length;
const searchOpts = (fen, kind) => {
  const n = pieceCount(fen);
  if (n <= 4) return { maxDepth: 30, maxNodes: 1500000 };          // K+P / K+Q / K+R endings: search deep
  if (n <= 6) return { maxDepth: 20, maxNodes: 600000 };
  return kind === 'line' ? { maxDepth: 6, maxNodes: 200000 } : { maxDepth: 7, maxNodes: 300000 };
};

function checkStars(tag, st) {
  const b0 = ctx.boardFromPieces(st.pieces), fixed = new Set((st.fixed || []).map(E.sqFromName));
  const stars0 = (st.stars || []).map(E.sqFromName);
  const key = (b, s) => Array.from(b).join(',') + '|' + s.join(',');
  let frontier = [[b0, stars0]], seen = new Set([key(b0, stars0)]), depth = 0, found = -1;
  const done = (b, s) => !s.length && (!st.captureAll || !Array.from(b).some(p => p & 8));
  if (done(b0, stars0)) found = 0;
  while (found < 0 && frontier.length && depth < 14) {
    depth++; const next = [];
    for (const [b, s] of frontier) {
      for (let sq = 0; sq < 128 && found < 0; sq++) {
        if (sq & 0x88 || !b[sq] || (b[sq] & 8) || fixed.has(sq)) continue;
        for (const to of ctx.lessonTargets(b, sq)) {
          const nb = Int8Array.from(b); nb[to] = nb[sq]; nb[sq] = 0;
          if (st.promote && (nb[to] & 7) === 1 && (to >> 4) === 7) nb[to] = 5;
          const ns = s.filter(x => x !== to), k = key(nb, ns);
          if (seen.has(k)) continue; seen.add(k);
          if (done(nb, ns)) { found = depth; break; }
          next.push([nb, ns]);
        }
      }
      if (found >= 0) break;
    }
    frontier = next;
  }
  if (found < 0) fail(tag, 'stars unsolvable');
  else if (found !== st.par) fail(tag, `par is ${st.par}, true minimum is ${found}`);
  else pass(tag, `stars solvable in par ${found}`);
}

function checkGoal(tag, st) {
  const e = checkFen(st.fen); if (e) return fail(tag, 'bad FEN: ' + e);
  if (!st.success) fail(tag, 'missing success message');
  const pos = new E.Position(st.fen);
  const legal = pos.legalMoves();
  if (!['check', 'mate', 'castle', 'promote', 'move'].includes(st.goal)) return fail(tag, 'unknown goal ' + st.goal);
  const hits = legal.filter(m => {
    pos.make(m); let ok;
    if (st.goal === 'check') ok = pos.inCheck(); else if (st.goal === 'mate') ok = pos.status().reason === 'checkmate';
    else if (st.goal === 'castle') ok = !!(E.mFlags(m) & E.F_CASTLE); else if (st.goal === 'promote') ok = !!E.mPromo(m);
    else ok = st.moves.includes(E.sqName(E.mFrom(m)) + E.sqName(E.mTo(m)));
    pos.unmake(); return ok;
  });
  if (!hits.length) return fail(tag, 'goal ' + st.goal + ' impossible');
  if (st.goal !== 'move') return pass(tag, `${st.goal}: ${hits.length} solution(s) [${hits.map(m => pos.san(m)).join(' ')}]`);
  for (const u of st.moves) if (!UCI.test(u) || !moveByUci(pos, u)) return fail(tag, 'listed move not legal: ' + u);
  if (!st.fail) warn(tag, 'move goal without a fail message');
  const scored = scoreMoves(pos, searchOpts(st.fen, 'goal'));
  const listed = scored.filter(x => st.moves.includes(x.uci.slice(0, 4))), other = scored.filter(x => !st.moves.includes(x.uci.slice(0, 4)));
  const worstListed = Math.min(...listed.map(x => x.sc)), bestOther = other.length ? other[0] : null;
  const desc = `${listed.map(x => x.san + ' ' + fmt(x.sc)).join(', ')}; next best ${bestOther ? bestOther.san + ' ' + fmt(bestOther.sc) : 'none'}`;
  let ok;
  if (!bestOther) ok = true;
  else if (isMate(worstListed)) ok = !(isMate(bestOther.sc) && mateIn(bestOther.sc) <= mateIn(worstListed));
  else ok = worstListed - bestOther.sc >= 200;
  if (ok) pass(tag, 'unique: ' + desc); else fail(tag, 'not uniquely best: ' + desc);
}

function checkLine(tag, st) {
  const e = checkFen(st.fen); if (e) return fail(tag, 'bad FEN: ' + e);
  if (!st.success) fail(tag, 'missing success message');
  if (!Array.isArray(st.moves) || !st.moves.length) return fail(tag, 'no moves');
  const pos = new E.Position(st.fen), side = st.side === 'b' ? 1 : 0;
  if (st.side !== 'w' && st.side !== 'b') return fail(tag, 'side must be w or b');
  const first = pos.turn === side ? 0 : 1; // index parity of learner moves
  const opts = searchOpts(st.fen, 'line');
  const notes = []; let bad = false;
  const judge = (i, u) => {
    const sc = scoreMoves(pos, opts), best = sc[0], mine = sc.find(x => x.uci === u || x.uci.slice(0, 4) === u);
    if (!mine) { bad = true; fail(tag, `move ${i} ${u} illegal`); return; }
    const ok = mine.sc >= best.sc - 30 || (isMate(best.sc) && isMate(mine.sc));
    notes.push(`${mine.san}(${fmt(mine.sc)}${mine === best ? '' : ' best ' + best.san + ' ' + fmt(best.sc)})`);
    if (!ok) { bad = true; fail(tag, `learner move ${i} ${mine.san} ${fmt(mine.sc)} vs best ${best.san} ${fmt(best.sc)}`); }
  };
  for (const [i, u] of st.moves.entries()) {
    if (!UCI.test(u)) { fail(tag, 'bad uci ' + u); return; }
    const learner = (i % 2) === first;
    if (learner) {
      judge(i, u);
      const alts = (st.alt && st.alt[i]) || [];
      for (const a of alts) {
        const m = moveByUci(pos, a); if (!m) { bad = true; fail(tag, `alt ${a} at ${i} illegal`); continue; }
        judge(i, a);
        if (i + 1 < st.moves.length) { pos.make(m); const r = moveByUci(pos, st.moves[i + 1]); pos.unmake(); if (!r) { bad = true; fail(tag, `after alt ${a}, reply ${st.moves[i + 1]} illegal`); } }
      }
    } else {
      const m0 = moveByUci(pos, u); if (!m0) { fail(tag, `opponent move ${i} ${u} illegal`); return; }
      const sc = scoreMoves(pos, opts), mine = sc.find(x => x.m === m0);
      if (!isMate(-sc[0].sc) && mine.sc < sc[0].sc - 150) warn(tag, `opponent move ${i} ${mine.san} ${fmt(mine.sc)} is a blunder vs ${sc[0].san} ${fmt(sc[0].sc)}`);
      notes.push(mine.san);
    }
    const m = moveByUci(pos, u); if (!m) { fail(tag, `move ${i} ${u} illegal`); return; }
    pos.make(m);
  }
  if (st.alt) for (const k in st.alt) if ((+k % 2) !== first) { bad = true; fail(tag, `alt index ${k} is not a learner move`); }
  if (!bad) pass(tag, 'line ok: ' + notes.join(' '));
}

const ids = new Set();
let nC = 0, nL = 0, nS = 0;
for (const C of COURSES) {
  nC++;
  const ctag = 'course ' + C.id;
  for (const k of ['id', 'title', 'desc', 'icon', 'level', 'lessons']) if (!C[k]) fail(ctag, 'missing ' + k);
  if (!ICONS.has(C.icon)) fail(ctag, 'bad icon ' + C.icon);
  if (!LEVELS.has(C.level)) fail(ctag, 'bad level ' + C.level);
  if (ids.has(C.id)) fail(ctag, 'duplicate id'); ids.add(C.id);
  for (const L of C.lessons) {
    nL++;
    for (const k of ['id', 'title', 'desc', 'steps']) if (!L[k]) fail(ctag + '/' + L.id, 'missing ' + k);
    if (L.icon && !ICONS.has(L.icon)) fail(ctag + '/' + L.id, 'bad icon ' + L.icon);
    if (ids.has(L.id)) fail(L.id, 'duplicate id'); ids.add(L.id);
    for (const [i, st] of L.steps.entries()) {
      nS++;
      const tag = `${C.id}/${L.id}#${i}`;
      if (filter && !tag.includes(filter)) continue;
      if (!st.text) fail(tag, 'missing text');
      if (st.type === 'text') {
        if (st.board) { const e2 = checkPlacement(st.board); if (e2) { fail(tag, e2); continue; } }
        if ((st.marks || []).some(s => !SQ.test(s))) { fail(tag, 'bad mark'); continue; }
        if (st.showMoves && (!SQ.test(st.showMoves) || !st.board || !new E.Position(st.board + ' w - - 0 1').pieceAt(st.showMoves))) { fail(tag, 'showMoves square empty'); continue; }
        pass(tag, 'text');
      } else if (st.type === 'stars') checkStars(tag, st);
      else if (st.type === 'goal') checkGoal(tag, st);
      else if (st.type === 'line') checkLine(tag, st);
      else fail(tag, 'unknown step type ' + st.type);
    }
  }
}
console.log(`\n${nC} courses, ${nL} lessons, ${nS} steps. ${passes} passed, ${fails} failed, ${warns} warnings.`);
console.log(fails ? 'COURSES INVALID' : 'ALL COURSES VALID');
process.exit(fails ? 1 : 0);
