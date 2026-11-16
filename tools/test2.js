const E = require('../src/engine.js')();
const assert = (c, msg) => { if (!c) { console.log('FAIL', msg); process.exitCode = 1; } };
let p = new E.Position();
// Scholar's mate via SAN
for (const s of ['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']) { const m = p.moveFromSan(s); assert(m, 'san '+s); const legal=p.legalMoves(); const back=p.san(m,legal); assert(back===s, s+' vs '+back); p.make(m); }
assert(p.status().reason === 'checkmate' && p.status().result === '1-0', 'mate status');
// stalemate
p = new E.Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); assert(p.status().reason === 'stalemate', 'stalemate');
// insufficient
p = new E.Position('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1'); assert(p.status().reason === 'insufficient material', 'insuff KB');
p = new E.Position('8/8/4k3/8/8/2B5/4K3/6b1 w - - 0 1'); assert(p.status().over, 'same color bishops');
p = new E.Position('8/8/4k3/8/8/2B5/4K3/5b2 w - - 0 1'); assert(!p.status().over, 'opposite bishops not draw');
// threefold
p = new E.Position();
for (const s of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) p.make(p.moveFromSan(s));
assert(p.status().reason === 'threefold repetition', 'threefold ' + JSON.stringify(p.status()));
// disambiguation
p = new E.Position('4k3/8/8/8/8/8/8/R4RK1 w - - 0 1');
assert(p.san(p.moveFromUci('a1d1')) === 'Rad1', 'Rad1');
p = new E.Position('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
assert(p.san(p.moveFromUci('a1a3')) === 'R1a3', 'R1a3');
// en passant + promotion SAN
p = new E.Position('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
assert(p.san(p.moveFromUci('e5d6')) === 'exd6', 'ep san');
p = new E.Position('8/1P2k3/8/8/8/8/8/4K3 w - - 0 1');
assert(p.san(p.moveFromUci('b7b8q')) === 'b8=Q', 'promo');
assert(p.san(p.moveFromUci('b7b8n')) === 'b8=N', 'underpromo');
// castling SAN, castle through check forbidden
p = new E.Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
assert(p.san(p.moveFromUci('e1g1')) === 'O-O' && p.san(p.moveFromUci('e1c1')) === 'O-O-O', 'castle san');
p = new E.Position('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
assert(!p.moveFromUci('e1g1'), 'no castle while f-file attacked? (f2 rook attacks f1)');
// search: find mate in 2
const s = new E.Searcher();
p = new E.Position('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
let r = s.search(p, {maxDepth: 6});
assert(p.uci(r.move) === 'd1d8', 'back rank mate found: ' + p.uci(r.move));
// speed test from start
p = new E.Position();
let t0 = Date.now(); r = s.search(p, {timeMs: 2000});
console.log('start depth', r.depth, 'nodes', r.nodes, 'nps', Math.round(r.nodes / ((Date.now()-t0)/1000)), p.san(r.move));
p = new E.Position('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
r = s.search(p, {maxDepth: 3}); console.log('scholar', p.san(r.move), r.score);
console.log(process.exitCode ? 'SOME FAILED' : 'ALL OK');
