// Estimates each puzzle's difficulty from how much search the engine needs before it
// settles on the solution's first move, plus the mate length. Writes data/puzzles.json.
const E = require('../src/engine.js')();
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync(__dirname + '/../data/puzzles_raw.json', 'utf8'));
const s = new E.Searcher();
function nodesToFind(p) {
  for (let budget = 64; budget <= 2e6; budget *= 2) {
    s.clear();
    const pos = new E.Position(p.fen);
    const r = s.search(pos, { maxNodes: budget });
    const mv = r.move && pos.uci(r.move);
    let ok = mv === p.line[0];
    if (!ok && p.n === 1 && mv) { pos.make(r.move); ok = pos.status().reason === 'checkmate'; }
    if (ok && r.score > E.MATE - 100) return budget;
  }
  return 4e6;
}
// also count "tempting" moves: checks and captures that do not mate
function tempting(p) {
  const pos = new E.Position(p.fen); let t = 0;
  for (const m of pos.legalMoves()) { const cap = E.mFlags(m) & E.F_CAP; pos.make(m); const chk = pos.inCheck(); pos.unmake(); if (chk || cap) t++; }
  return t;
}
const out = raw.map(p => {
  const nodes = nodesToFind(p), t = tempting(p);
  const score = Math.log2(nodes / 64) * 120 + Math.max(0, t - 2) * 25 + (p.n - 1) * 220;
  return Object.assign({}, p, { rating: Math.round(Math.min(2300, Math.max(300, 350 + score)) / 10) * 10 });
});
out.sort((a, b) => a.rating - b.rating);
fs.writeFileSync(__dirname + '/../data/puzzles.json', JSON.stringify(out));
const by = {}; out.forEach(p => { const k = p.cat; (by[k] = by[k] || []).push(p.rating); });
for (const k in by) { const v = by[k]; console.log(k, v.length, 'min', v[0], 'median', v[v.length >> 1], 'max', v[v.length - 1]); }
