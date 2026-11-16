// Builds the puzzle set. Every puzzle is verified by an exhaustive mate solver:
// the solver's moves must be the ONLY moves that keep a forced mate (last move: any mate accepted in-app).
const E = require('../src/engine.js')();
const { BOT_LEVELS, OPENINGS, botChooseMove } = require('../src/bots.js');
const fs = require('fs');

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// returns solution line (uci list) or null if not a clean puzzle
function buildLine(fen, n, prefer) {
  const pos = new E.Position(fen);
  if (E.mateLength(pos, n) !== n) return null;
  const line = [];
  for (let k = n; k >= 1; k--) {
    const mates = E.matingMoves(pos, k);
    if (!mates.length) return null;
    if (k > 1 && mates.length !== 1) return null;
    if (k === n && n === 1 && mates.length > 2) return null; // keep mate-in-1s fairly focused
    const m = (prefer && k === n && mates.find(x => pos.uci(x) === prefer)) || mates[0];
    line.push(pos.uci(m)); pos.make(m);
    if (k === 1) break;
    // defender: choose the reply that survives longest; tie-break by engine eval
    let bestReply = 0, bestLen = -1, bestEval = -Infinity;
    for (const r of pos.legalMoves()) {
      pos.make(r);
      const len = E.mateLength(pos, k - 1);
      const ev = -E.evaluate(pos, 0, 0);
      pos.unmake();
      if (len > bestLen || (len === bestLen && ev > bestEval)) { bestLen = len; bestReply = r; bestEval = ev; }
    }
    if (!bestReply || bestLen !== k - 1) return null; // a reply allows a shorter mate -> still fine, but keep lines exact
    line.push(pos.uci(bestReply)); pos.make(bestReply);
  }
  return line;
}

const HAND = [
  { name: 'Back-Rank Mate', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', n: 1, tip: 'The king is trapped behind its own pawns.' },
  { name: "Scholar's Mate", fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', n: 1, tip: 'f7 is only defended by the king.' },
  { name: "Fool's Mate", fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', n: 1, tip: 'White opened the diagonal to their own king.' },
  { name: 'Smothered Mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', n: 1, tip: "The king's own pieces block every escape." },
  { name: "Philidor's Smothered Mate", fen: 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', n: 2, tip: 'Sacrifice the queen to force a piece onto g8.' },
  { name: "Anastasia's Mate", fen: '8/4N1pk/8/8/8/8/2K5/R7 w - - 0 1', n: 1, tip: 'The knight guards g8 and g6.' },
  { name: 'Arabian Mate', fen: '7k/R7/5N2/8/8/8/8/7K w - - 0 1', n: 1, tip: 'Rook and knight work as a team.' },
  { name: 'Ladder Mate', fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', n: 1, tip: 'One rook holds the 7th rank.' },
  { name: 'Queen Kiss', prefer: 'h4e7', fen: '4k3/8/4K3/8/7Q/8/8/8 w - - 0 1', n: 1, tip: 'Your king protects the queen right in front of the enemy king.' },
  { name: "Boden's Mate", fen: '2kr4/p2p4/8/8/5B2/8/4B3/6K1 w - - 0 1', n: 1, tip: 'Two bishops on crossing diagonals.' },
  { name: 'Corridor Mate', fen: '1k6/ppp5/8/8/8/8/8/K3R3 w - - 0 1', n: 1, tip: 'A king stuck on the edge behind pawns.' },
  { name: "Damiano's Mate", fen: '5rk1/6p1/6P1/7Q/8/8/8/6K1 w - - 0 1', n: 1, tip: 'Your pawn protects the queen.' },
  { name: 'Epaulette Mate', fen: '3rkr2/8/8/8/2Q5/8/8/6K1 w - - 0 1', n: 1, tip: 'The rooks on each side are like shoulder pads.' },
  { name: 'Opera Mate', fen: '4k3/5p2/8/6B1/8/8/8/3R2K1 w - - 0 1', n: 1, tip: 'Rook checks on the file; bishop guards the escape.' },
  { name: 'Lolli Mate', fen: '6k1/5p1p/5PpQ/8/8/8/8/6K1 w - - 0 1', n: 1, tip: 'The f6 pawn supports the queen on g7.' },
  { name: "Blackburne's Mate", fen: '5rk1/7p/8/6N1/8/3B4/1B6/6K1 w - - 0 1', n: 1, tip: 'Bishops and a knight cover every square.' },
];

const out = [];
for (const h of HAND) {
  const line = buildLine(h.fen, h.n, h.prefer);
  if (!line) { console.log('REJECT hand', h.name); continue; }
  out.push({ fen: h.fen, line, n: h.n, cat: 'pattern', name: h.name, tip: h.tip });
}
console.log('hand-made accepted', out.length, '/', HAND.length);

// ---------- generated from bot games ----------
const target = { 1: +process.argv[2] || 70, 2: +process.argv[3] || 70, 3: +process.argv[4] || 35 };
const have = { 1: 0, 2: 0, 3: 0 };
const seen = new Set(out.map(p => p.fen.split(' ').slice(0, 2).join(' ')));
const searcher = new E.Searcher();
let seed = +process.argv[6] || 777, games = 0;
const t0 = Date.now();
while ((have[1] < target[1] || have[2] < target[2] || have[3] < target[3]) && Date.now() - t0 < (+process.argv[5] || 900) * 1000) {
  const rng = mulberry(seed++); games++;
  const wl = BOT_LEVELS[2 + Math.floor(rng() * 5)], bl = BOT_LEVELS[2 + Math.floor(rng() * 5)];
  const pos = new E.Position();
  const line = OPENINGS[Math.floor(rng() * OPENINGS.length)];
  const s2 = new E.Searcher();
  for (let ply = 0; ply < 160; ply++) {
    if (pos.status().over) break;
    if (ply >= 8) {
      const r = searcher.search(pos, { maxDepth: 5, maxNodes: 40000 });
      if (r.score >= E.MATE - 6) {
        const n = Math.ceil((E.MATE - r.score) / 2);
        const key = pos.fen().split(' ').slice(0, 2).join(' ');
        if (n >= 1 && n <= 3 && have[n] < target[n] && !seen.has(key)) {
          // quality filters: defender keeps some material; not a hopeless blowout
          const ev = E.evaluate(pos, 0, 0);
          let defMat = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.board[s]; if (p && ((p & 8) ? 1 : 0) !== pos.turn && (p & 7) !== 6 && (p & 7) !== 1) defMat++; }
          if (defMat >= 1 && ev < 1500) {
            const fen = pos.fen();
            const sol = buildLine(fen, n);
            if (sol) { seen.add(key); have[n]++; out.push({ fen, line: sol, n, cat: 'mate' + n }); }
          }
        }
      }
    }
    const side = pos.turn, lv = side === 0 ? wl : bl;
    const mv = botChooseMove(E, s2, pos, lv, rng, seed * (side + 1), ply, line);
    pos.make(pos.moveFromUci(mv.uci));
  }
  if (games % 10 === 0) console.error('games', games, have, Math.round((Date.now() - t0) / 1000) + 's');
}
console.log('generated', have, 'from', games, 'games');
fs.writeFileSync(process.argv[7] || (__dirname + '/../data/puzzles_raw.json'), JSON.stringify(out));
