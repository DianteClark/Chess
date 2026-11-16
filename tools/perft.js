const E = require('../src/engine.js')();
function perft(pos, d) {
  if (d === 0) return 1;
  let n = 0;
  for (const m of pos.genMoves()) { if (!pos.tryMake(m)) continue; n += d === 1 ? 1 : perft(pos, d - 1); pos.unmake(); }
  return n;
}
const tests = [
 ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20,400,8902,197281,4865609]],
 ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48,2039,97862,4085603]],
 ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14,191,2812,43238,674624]],
 ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6,264,9467,422333]],
 ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44,1486,62379,2103487]],
 ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46,2079,89890,3894594]],
];
let ok = true; const t0 = Date.now(); let total = 0;
for (const [fen, exp] of tests) {
  const pos = new E.Position(fen);
  exp.forEach((e, i) => { const r = perft(pos, i + 1); total += r; if (r !== e) { ok = false; console.log('FAIL', fen, i + 1, r, e); } });
  if (pos.fen().split(' ')[0] !== fen.split(' ')[0]) { ok = false; console.log('FEN roundtrip fail'); }
}
console.log(ok ? 'ALL PERFT PASS' : 'FAILURES', total, 'nodes', (Date.now() - t0) + 'ms');
