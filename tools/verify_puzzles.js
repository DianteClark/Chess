// Independent re-check of every shipped puzzle: legal line, ends in checkmate, exact mate length,
// and the solver's first move is the only one that mates in time (for mate-in-2/3).
const E = require('../src/engine.js')();
const P = require('../data/puzzles.json');
let bad = 0;
for (const [i, p] of P.entries()) {
  const pos = new E.Position(p.fen);
  const n = E.mateLength(pos, p.n);
  let ok = n === p.n;
  if (p.n > 1 && E.matingMoves(pos, p.n).length !== 1) ok = false;
  for (const u of p.line) { const m = pos.moveFromUci(u); if (!m) { ok = false; break; } pos.make(m); }
  if (pos.status().reason !== 'checkmate' || p.line.length !== 2 * p.n - 1) ok = false;
  if (!ok) { bad++; console.log('BAD', i, p.fen, p.line); }
}
console.log(bad ? bad + ' BAD PUZZLES' : `ALL ${P.length} PUZZLES VERIFIED`);
