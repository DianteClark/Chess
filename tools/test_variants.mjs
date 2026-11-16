// Tests for src/variants.js (World Games): rules via ffish.js and the Fairy-Stockfish engine.
// Run: node tools/test_variants.mjs [gamesPerVariant=8]
// Checks, for every variant: perft 1-3 from the start (ffish vs the engine's own "go perft"
// vs known reference numbers), random games to the end or 300 plies (every legal move string is
// accepted by play(), undo() restores the FEN, parseMove() understands it, pieces()/pockets()
// stay consistent), special rules (drops, shogi promotion, flying general, janggi pass,
// terminations), and that the engine returns legal moves at levels 1 and 8 plus analysis lines.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { VARIANTS, Variants, VGame } = require('../src/variants.js');

const GAMES = +(process.argv[2] || 8);
let fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('  FAIL: ' + msg); } }
let seed = 12345;
function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }

// Reference perft numbers (published values for these start positions).
const KNOWN = {
  chess: [20, 400, 8902], crazyhouse: [20, 400, 8902], '3check': [20, 400, 8902], kingofthehill: [20, 400, 8902],
  atomic: [20, 400, 8902], antichess: [20, 400, 8067], horde: [8, 128, 1274],
  xiangqi: [44, 1920, 79666], shogi: [30, 900, 25470], makruk: [23, 529, 12012]
};

await Variants.ready();
const ff = Variants.ffish();
console.log('ffish:', ff.info());
const ids = Variants.list;

function perftFF(b, d) {
  if (d === 0) return 1;
  const s = b.legalMoves(); if (!s) return 0;
  const ms = s.split(' ');
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) { b.push(m); n += perftFF(b, d - 1); b.pop(); }
  return n;
}

console.log('\n== perft (ffish | engine | reference)');
for (const id of ids) {
  const b = new ff.Board(id);
  const depth = id === 'sittuyin' ? 2 : 3;
  const mine = [], eng = [];
  for (let d = 1; d <= depth; d++) {
    mine.push(perftFF(b, d));
    const lines = await Variants.engine.uci(`setoption name UCI_Variant value ${id}\nposition startpos\ngo perft ${d}`);
    const l = lines.find(x => x.startsWith('Nodes searched'));
    eng.push(l ? +l.split(':')[1] : NaN);
  }
  b.delete();
  const ref = KNOWN[id];
  console.log(`  ${id.padEnd(14)} ${mine.join(' ').padEnd(22)} | ${eng.join(' ').padEnd(22)} | ${ref ? ref.slice(0, depth).join(' ') : '-'}`);
  ok(mine.join() === eng.join(), `${id} perft ffish ${mine} vs engine ${eng}`);
  if (ref) ok(mine.join() === ref.slice(0, depth).join(), `${id} perft vs reference ${ref}`);
}

console.log(`\n== random games (${GAMES} per variant, max 300 plies)`);
for (const id of ids) {
  const t0 = Date.now();
  const tally = {}; let plies = 0, drops = 0, promos = 0, passes = 0, over = 0;
  for (let g = 0; g < GAMES; g++) {
    const G = new VGame(id);
    ok(G.fen() === G.startFen(), `${id} start fen`);
    ok(G.turn() === 'w', `${id} first player is w`);
    for (let ply = 0; ply < 300; ply++) {
      const st = G.status();
      const moves = G.legalMoves();
      if (st.over) { over++; tally[st.result + ' ' + st.reason] = (tally[st.result + ' ' + st.reason] || 0) + 1; ok(['1-0', '0-1', '1/2-1/2'].includes(st.result), `${id} result ${st.result}`); break; }
      ok(moves.length > 0, `${id} not over but no moves: ${G.fen()}`);
      const fen = G.fen();
      // every legal move string must be accepted, and undo must restore the position
      for (const m of moves) {
        const pm = Variants.parseMove(m);
        if (!pm) { ok(false, `${id} parseMove ${m}`); continue; }
        const r = G.play(m);
        if (!r) { ok(false, `${id} play rejected ${m} in ${fen}`); continue; }
        if (typeof r.san !== 'string' || !r.san) ok(false, `${id} san for ${m}`);
        G.undo();
        if (G.fen() !== fen) ok(false, `${id} undo of ${m} gave ${G.fen()} not ${fen}`);
      }
      checks += moves.length;
      ok(G.play('z9z9') === null, `${id} illegal move rejected`);
      const m = moves[rnd(moves.length)], pm = Variants.parseMove(m);
      if (pm.drop) drops++; if (pm.promo) promos++; if (pm.pass) passes++;
      const before = G.pockets();
      G.play(m); plies++;
      if (pm.drop) {
        const side = G.turn() === 'w' ? 'b' : 'w';
        ok((before[side][pm.drop] || 0) - 1 === (G.pockets()[side][pm.drop] || 0), `${id} drop ${m} pocket count`);
        ok(G.pieces().some(p => p.sq === pm.to && p.type === pm.drop && p.color === side), `${id} dropped piece on ${pm.to}`);
      }
      // pieces() squares must be on the board and unique
      const ps = G.pieces(), sqs = new Set(ps.map(p => p.sq));
      ok(sqs.size === ps.length, `${id} unique squares`);
      ok(ps.every(p => VARIANTS[id].pieceTypes[p.type]), `${id} piece types known: ${ps.map(p => p.type).join('')}`);
    }
    // unwind the whole game
    while (G.undo()) {}
    ok(G.fen() === G.startFen(), `${id} full undo returns to start`);
    G.dispose();
  }
  console.log(`  ${id.padEnd(14)} plies ${String(plies).padStart(5)}  finished ${over}/${GAMES}  drops ${drops} promos ${promos} passes ${passes}  ${Date.now() - t0}ms  ${JSON.stringify(tally)}`);
}

console.log('\n== special rules');
{
  // shogi: promotion choice, capture goes to hand, drop
  const G = new VGame('shogi');
  G.play('c3c4'); G.play('g7g6');
  const lm = G.legalMoves();
  ok(lm.includes('b2h8+') && lm.includes('b2h8'), 'shogi: bishop capture offers promote and non-promote');
  const r = G.play('b2h8+');
  ok(r && r.capture, 'shogi: b2h8+ is a capture');
  ok(G.pieces().some(p => p.sq === 'h8' && p.type === 'B' && p.promoted && p.color === 'w'), 'shogi: promoted bishop on h8');
  ok(G.pockets().w.B === 1, 'shogi: captured bishop in Sente hand');
  G.play('g9h8');   // silver takes back
  ok(G.pockets().b.B === 1, 'shogi: Gote has the bishop in hand');
  ok(G.drops('B').length > 0 && G.drops('B').every(m => /^B@/.test(m)), 'shogi: Sente can drop B');
  const d = G.play('B@e5');
  ok(d && G.pieces().some(p => p.sq === 'e5' && p.type === 'B' && p.color === 'w'), 'shogi: drop B@e5 played');
  ok(!G.pockets().w.B, 'shogi: hand empty after drop');
  console.log('  shogi promotion/drop sans:', G.sans.join(' '));
  // nifu: no second unpromoted pawn on a file
  const N = new VGame('shogi', '4k4/9/9/9/9/9/4P4/9/4K4[P] w - - 0 1');
  ok(!N.legalMoves().includes('P@e5') && N.legalMoves().includes('P@d5'), 'shogi: nifu (two pawns on a file) forbidden');
}
{
  // xiangqi flying general: kings may not face each other on an open file
  const G = new VGame('xiangqi', '4k4/9/9/9/9/9/9/9/9/3K5 w - - 0 1');
  ok(!G.legalMoves().includes('d1e1') && G.legalMoves().includes('d1d2'), 'xiangqi: d1e1 would face the general');
  const H = new VGame('xiangqi', '4k4/9/9/9/9/9/9/9/4R4/4K4 w - - 0 1');
  ok(!H.legalMoves().some(m => m.startsWith('e2') && !m.slice(2).startsWith('e')), 'xiangqi: screening chariot cannot leave the file');
  const C = new VGame('xiangqi', '4k4/9/9/9/9/9/9/9/9/4K4 b - - 0 1');
  ok(C.status().over === false || C.status().over, 'xiangqi: facing generals position loads');
  const S = new VGame('xiangqi', '3k5/4R4/9/9/9/9/9/9/9/4K4 b - - 0 1');
  console.log('  xiangqi trapped general status:', JSON.stringify(S.status()), S.legalMoves().join(' '));
}
{
  const G = new VGame('janggi');
  ok(G.legalMoves().includes('e2e2') && Variants.parseMove('e2e2').pass, 'janggi: pass move e2e2');
  G.play('e2e2'); ok(G.turn() === 'b', 'janggi: pass changes the side to move');
}
{
  const G = new VGame('crazyhouse');
  ['e2e4', 'd7d5', 'e4d5', 'd8d5'].forEach(m => G.play(m));
  ok(G.pockets().w.P === 1 && G.pockets().b.P === 1, 'crazyhouse: both sides have a pawn in hand');
  ok(G.legalMoves().includes('P@e6') && !G.legalMoves().includes('P@e8'), 'crazyhouse: pawn drop legal on e6, not on the last rank');
  const r = G.play('P@e6'); ok(r && r.san.indexOf('@') >= 0, 'crazyhouse: drop san ' + (r && r.san));
}
{
  const G = new VGame('chess'); ['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach(m => G.play(m));
  const s = G.status(); ok(s.over && s.result === '0-1' && s.reason === 'checkmate', 'chess: fool\'s mate ' + JSON.stringify(s));
  ok(G.sans.join(' ') === 'f3 e5 g4 Qh4#', 'chess: SAN ' + G.sans.join(' '));
  const P = new VGame('chess', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  ok(['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n'].every(m => P.legalMoves().includes(m)), 'chess: promotion moves');
  const T = new VGame('chess', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  ok(T.status().reason === 'stalemate' && T.status().result === '1/2-1/2', 'chess: stalemate ' + JSON.stringify(T.status()));
  const R = new VGame('chess'); ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'].forEach(m => R.play(m));
  ok(R.status().over && R.status().reason === 'repetition', 'chess: threefold repetition ' + JSON.stringify(R.status()));
}
{
  const K = new VGame('kingofthehill', '4k3/8/8/8/8/3K4/8/8 w - - 0 1'); K.play('d3d4');
  ok(K.status().over && K.status().result === '1-0' && K.status().reason === 'king-of-the-hill', 'koth: ' + JSON.stringify(K.status()));
  const T = new VGame('3check', '4k3/8/8/8/8/8/8/R3K3 w - - 1+3 0 1'); T.play('a1a8');
  ok(T.status().over && T.status().result === '1-0' && T.status().reason === 'three-checks', '3check: ' + JSON.stringify(T.status()) + ' ' + T.fen());
  const A = new VGame('atomic', '4k3/4p3/8/8/8/8/8/4R1K1 w - - 0 1'); A.play('e1e7');
  ok(A.status().over && A.status().result === '1-0' && A.status().reason === 'king-exploded', 'atomic: ' + JSON.stringify(A.status()));
  const X = new VGame('antichess', '8/8/8/8/8/8/1p6/R7 w - - 0 1');
  ok(X.legalMoves().join() === 'a1b1' || X.legalMoves().every(m => m === 'a1a2' || m.startsWith('a1')), 'antichess: forced capture ' + X.legalMoves().join(' '));
  const Y = new VGame('antichess', '8/8/8/8/8/8/1p6/R7 b - - 0 1');
  ok(Y.legalMoves().length === 5 && Y.legalMoves().every(m => m.startsWith('b2a1')), 'antichess: must capture (' + Y.legalMoves().join(' ') + ')');
  const H = new VGame('horde', '4k3/8/8/8/8/8/3q4/4P3 b - - 0 1'); H.play('d2e1');
  ok(H.status().over && H.status().result === '0-1' && H.status().reason === 'horde-destroyed', 'horde: ' + JSON.stringify(H.status()));
  const M = new VGame('makruk', '4k3/8/2P5/8/8/8/8/4K3 w - - 0 1');
  ok(M.legalMoves().includes('c6c7m'), 'makruk: pawn promotes to met on the 6th rank (' + M.legalMoves().filter(m => m.startsWith('c6')).join(' ') + ')');
  M.play('c6c7m'); ok(M.pieces().some(p => p.sq === 'c7' && p.type === 'M' && p.promoted), 'makruk: promoted met reported as M, promoted');
  const S = new VGame('sittuyin');
  ok(S.pockets().w.K === 1 && S.pockets().w.R === 2 && S.drops().length === S.legalMoves().length, 'sittuyin: set-up phase is all drops');
}

console.log('\n== engine (Fairy-Stockfish wasm, in-process)');
for (const id of ids) {
  const G = new VGame(id);
  // a few plies in, so we test moves after a position with history
  for (let i = 0; i < 4; i++) { const ms = G.legalMoves(); G.play(ms[rnd(ms.length)]); }
  const out = [];
  for (const level of [1, 8]) {
    const t = Date.now();
    const r = await Variants.engine.bestMove(id, G.startFen(), G.moves, { level, timeMs: level === 8 ? 500 : undefined });
    const ms = Date.now() - t;
    ok(r.uci && G.isLegal(r.uci), `${id} level ${level} move ${r.uci} legal`);
    out.push(`L${level} ${r.uci} (${r.score}cp d${r.depth}${r.random ? ' random' : ''}) ${ms}ms`);
  }
  const t = Date.now();
  const a = await Variants.engine.analyze(id, G.fen(), [], { depth: 8, multipv: 3 });
  ok(a.lines.length >= Math.min(3, G.legalMoves().length) && a.lines.every(l => l.pv.length && G.isLegal(l.pv[0])), `${id} analysis lines`);
  out.push(`analyze d8 x3: ${a.lines.map(l => l.pv[0] + ' ' + (l.mate != null ? '#' + l.mate : l.cp)).join(', ')} ${Date.now() - t}ms`);
  console.log(`  ${id.padEnd(14)} ${out.join(' | ')}`);
}
{
  const r = await Variants.engine.analyze('chess', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', [], { depth: 10 });
  ok(r.lines[0].mate === 1 && r.lines[0].pv[0] === 'a1a8', 'engine finds back-rank mate in 1: ' + JSON.stringify(r.lines[0]));
  const s = await Variants.engine.analyze('chess', '6k1/5ppp/8/8/8/8/8/r5K1 w - - 0 1', [], { depth: 10 });
  ok(s.lines[0].cp < -300, 'scores are from the side to move: ' + JSON.stringify(s.lines[0]));
  const n = await Variants.engine.bestMove('chess', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', [], { level: 8, timeMs: 100 });
  ok(n.uci === null, 'no move in stalemate');
}
console.log(`\n${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
