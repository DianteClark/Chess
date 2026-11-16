// Chess960 perft against published reference counts (Chess960 perft suite),
// plus sanity checks on all 960 start positions.
const E = require('../src/engine.js')();
function perft(pos, d) { if (!d) return 1; let n = 0; for (const m of pos.genMoves()) { if (!pos.tryMake(m)) continue; n += d === 1 ? 1 : perft(pos, d - 1); pos.unmake(); } return n; }
const T = [
  ['bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9', [21, 528, 12189, 326672]],
  ['2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9', [21, 807, 18002, 667366]],
  ['b1q1rrkb/pppppppp/3nn3/8/P7/1PPP4/4PPPP/BQNNRKRB w GE - 1 9', [20, 479, 10471, 273318]],
];
let ok = true;
for (const [fen, exp] of T) {
  const p = new E.Position(fen);
  exp.forEach((e, i) => { const r = perft(p, i + 1); if (r !== e) { ok = false; console.log('MISMATCH', fen, 'd' + (i + 1), r, 'expected', e); } });
}
for (let n = 0; n < 960; n++) {
  const { fen } = E.chess960Fen(n), p = new E.Position(fen);
  // 16 pawn moves plus a few knight moves (and castling when king and rook start side by side)
  const d1 = perft(p, 1);
  if (d1 < 16 || d1 > 24) { ok = false; console.log("start", n, fen, d1); break; }
  if (new E.Position(p.fen()).fen() !== p.fen()) { ok = false; console.log('fen roundtrip', n); break; }
}
if (E.chess960Fen(518).fen.split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') { ok = false; console.log('SP 518 is not the standard position'); }
console.log(ok ? 'CHESS960 PERFT PASS' : 'CHESS960 FAILURES');
process.exitCode = ok ? 0 : 1;
