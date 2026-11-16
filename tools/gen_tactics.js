// Generates data/tactics.json: themed, non-mate "win material" puzzles, verified with Stockfish.
//
//   node tools/gen_tactics.js [targetCount=400] [timeBudgetSec=2100] [seed=1] [workers=2] [out=data/tactics.json] [raw=$TMPDIR/tactics.seed<seed>.raw.json]
//   node tools/gen_tactics.js --retag <out.json> <raw1.json> [raw2.json ...]   (merge runs, recompute themes + ratings)
//
// Positions come from games between the app's own bots (src/bots.js) and from shallow,
// randomised Stockfish self-play; the side that blunders creates a real tactic for the other.
// Every candidate is re-searched with Stockfish 19 Lite (vendor/stockfish, the same build the
// app ships) at a fixed depth with a fresh hash, so tools/verify_tactics.js can reproduce it.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const E = require('../src/engine.js')();
const { BOT_LEVELS, OPENINGS, botChooseMove } = require('../src/bots.js');

const ENGINE = path.join(__dirname, '..', 'vendor', 'stockfish', 'stockfish-19-lite-single.js');
const DEPTH = 16;          // verification depth (verify_tactics.js uses the same)
const PRE_DEPTH = 12;      // cheap pre-check with the same rules before the full-depth run
const QUICK_DEPTH = 10;    // scan depth while playing games
const FIRST_GAP = 200, NEXT_GAP = 150, MIN_BEST = 150, BALANCED = 150, MIN_GAIN = 2;
const VAL = [0, 1, 3, 3, 5, 9, 0];

// ---------------- UCI engine over a child process ----------------
class UCI {
  constructor(file) {
    this.proc = spawn(process.execPath, [file || ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.buf = ''; this.waiter = null; this.onInfo = null;
    this.proc.stdout.on('data', d => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        if (this.onInfo && line.startsWith('info ')) this.onInfo(line);
        if (this.waiter && this.waiter.pred(line)) { const w = this.waiter; this.waiter = null; w.res(line); }
      }
    });
  }
  send(c) { this.proc.stdin.write(c + '\n'); }
  wait(pred) { return new Promise(res => { this.waiter = { pred, res }; }); }
  async init() {
    this.send('uci'); await this.wait(l => l === 'uciok');
    this.send('setoption name Hash value 16'); this.multipv = 1;
    this.send('isready'); await this.wait(l => l === 'readyok');
    return this;
  }
  // returns {lines:[{multipv,depth,score,mate?,pv}], bestmove, byDepth:[first move of multipv 1 per depth]}
  // score is from the side to move's view; mates map to +-(100000 - plies).
  async analyze(fen, moves, depth, multipv, fresh) {
    if (fresh) { this.send('ucinewgame'); this.send('isready'); await this.wait(l => l === 'readyok'); }
    if (multipv !== this.multipv) { this.send('setoption name MultiPV value ' + multipv); this.multipv = multipv; }
    const lines = {}, byDepth = [];
    this.onInfo = line => {
      const t = line.split(' ');
      if (t.indexOf('pv') < 0 || t.indexOf('lowerbound') >= 0 || t.indexOf('upperbound') >= 0) return;
      const g = k => t[t.indexOf(k) + 1];
      const d = +g('depth'), mpv = t.indexOf('multipv') >= 0 ? +g('multipv') : 1;
      const si = t.indexOf('score'), kind = t[si + 1], v = +t[si + 2];
      const pv = t.slice(t.indexOf('pv') + 1);
      const o = { multipv: mpv, depth: d, pv, score: kind === 'mate' ? (v > 0 ? 100000 - v : -100000 - v) : v };
      if (kind === 'mate') o.mate = v;
      if (!lines[mpv] || d >= lines[mpv].depth) lines[mpv] = o;
      if (mpv === 1) byDepth[d] = pv[0];
    };
    this.send('position fen ' + fen + (moves && moves.length ? ' moves ' + moves.join(' ') : ''));
    this.send('go depth ' + depth);
    const bm = await this.wait(l => l.startsWith('bestmove'));
    this.onInfo = null;
    const best = bm.split(' ')[1];
    return { lines: Object.keys(lines).map(k => lines[k]).sort((a, b) => a.multipv - b.multipv),
      bestmove: best === '(none)' ? null : best, byDepth };
  }
  quit() { try { this.send('quit'); } catch (e) {} setTimeout(() => this.proc.kill(), 200); }
}

// ---------------- board helpers ----------------
const side = p => (p & 8) ? 1 : 0;
function material(pos, s) {
  let m = 0;
  for (let q = 0; q < 128; q++) { if (q & 0x88) { q += 7; continue; } const p = pos.board[q]; if (p && side(p) === s) m += VAL[p & 7]; }
  return m;
}
const balance = (pos, s) => material(pos, s) - material(pos, s ^ 1);
function nonPawnTotal(pos) {
  let m = 0;
  for (let q = 0; q < 128; q++) { if (q & 0x88) { q += 7; continue; } const t = pos.board[q] & 7; if (t >= 2 && t <= 5) m += VAL[t]; }
  return m;
}
const DIRS = { 2: [33, 31, 18, 14, -33, -31, -18, -14], 3: [17, 15, -17, -15], 4: [1, -1, 16, -16], 5: [1, -1, 16, -16, 17, 15, -17, -15], 6: [1, -1, 16, -16, 17, 15, -17, -15] };
// squares attacked by the piece on sq
function attacksFrom(b, sq) {
  const p = b[sq], t = p & 7, out = [];
  if (!p) return out;
  if (t === 1) {
    const d = side(p) ? -16 : 16;
    for (const x of [d - 1, d + 1]) { const to = sq + x; if (!(to & 0x88)) out.push(to); }
    return out;
  }
  const slide = t === 3 || t === 4 || t === 5;
  for (const d of DIRS[t]) {
    let to = sq + d;
    while (!(to & 0x88)) { out.push(to); if (!slide || b[to]) break; to += d; }
  }
  return out;
}
function attackersOf(b, target, s) {
  const out = [];
  for (let q = 0; q < 128; q++) { if (q & 0x88) { q += 7; continue; } const p = b[q]; if (p && side(p) === s && attacksFrom(b, q).includes(target)) out.push(q); }
  return out;
}
function isSliderDir(t, d) {
  const diag = Math.abs(d) === 15 || Math.abs(d) === 17;
  return (t === 5) || (t === 3 && diag) || (t === 4 && !diag);
}
// along a ray from a slider on sq: list of first two pieces hit [{sq,p}]
function rayHits(b, sq, d) {
  const hits = []; let to = sq + d;
  while (!(to & 0x88) && hits.length < 2) { if (b[to]) hits.push({ sq: to, p: b[to] }); to += d; }
  return hits;
}
const sqn = E.sqName, sqf = E.sqFromName;

// ---------------- theme detection ----------------
// line: [solver, reply, solver, ...]. Works on a Position at the puzzle start.
function detectThemes(fen, line) {
  const pos = new E.Position(fen), S = pos.turn, D = S ^ 1;
  const themes = new Set();
  const start = balance(pos, S);
  const solverIdx = line.map((_, i) => i).filter(i => i % 2 === 0);
  // squares where solver later captures, with move index
  const capturesAfter = (i) => {
    const p = new E.Position(fen); const caps = [];
    line.forEach((u, j) => { const m = p.moveFromUci(u); if (j > i && j % 2 === 0 && p.board[E.mTo(m)]) caps.push(E.mTo(m)); p.make(m); });
    return caps;
  };
  // track gains for sacrifice
  const gainsAfterReply = {}; let firstCapHanging = false;
  const states = [];
  for (let i = 0; i < line.length; i++) {
    const m = pos.moveFromUci(line[i]);
    const before = { board: Int8Array.from(pos.board), checkers: null };
    const from = E.mFrom(m), to = E.mTo(m), mover = pos.board[from], capt = pos.board[to];
    if (i === 0 && capt && attackersOf(pos.board, to, D).length === 0) firstCapHanging = true;
    pos.make(m);
    states.push({ i, from, to, mover, capt, before, after: Int8Array.from(pos.board), promo: E.mPromo(m) });
    if (i % 2 === 1) gainsAfterReply[i] = balance(pos, S) - start;
  }
  const n = solverIdx.length;
  for (const st of states) {
    if (st.i % 2) continue;
    const b = st.after, k = st.before.board;
    const dk = (() => { for (let q = 0; q < 128; q++) { if (q & 0x88) { q += 7; continue; } if (b[q] === (6 | (D ? 8 : 0))) return q; } return -1; })();
    const later = capturesAfter(st.i);
    const laterOrNow = later.concat(st.capt ? [st.to] : []);
    const moverT = (st.promo ? st.promo : st.mover & 7);
    // checks
    const checkers = attackersOf(b, dk, S);
    if (checkers.length >= 2) themes.add('doubleCheck');
    // fork: moved piece attacks >= 2 valuable targets (king, higher value, or undefended), one later won
    {
      const targets = attacksFrom(b, st.to).filter(q => b[q] && side(b[q]) === D && (
        (b[q] & 7) === 6 || VAL[b[q] & 7] > VAL[moverT] || ((b[q] & 7) !== 1 && attackersOf(b, q, D).length === 0)));
      if (targets.length >= 2 && targets.some(q => later.includes(q) || (b[q] & 7) === 6 && later.length)) {
        const wonOne = targets.some(q => later.includes(q));
        if (wonOne) themes.add('fork');
      }
    }
    // discovered attack: a solver slider behind the from-square now hits a valuable target
    for (const d of [1, -1, 16, -16, 17, 15, -17, -15]) {
      let q = st.from - d;
      while (!(q & 0x88) && !k[q]) q -= d;
      if ((q & 0x88) || !k[q] || side(k[q]) !== S || q === st.from) continue;
      if (!isSliderDir(k[q] & 7, d)) continue;
      const hit = rayHits(b, q, d)[0];
      if (hit && side(hit.p) === D && hit.sq !== st.to && ((hit.p & 7) === 6 || VAL[hit.p & 7] >= 3) && hit.sq !== st.to) {
        if ((hit.p & 7) === 6 || later.includes(hit.sq)) themes.add('discoveredAttack');
      }
    }
    // pin / skewer created by the moved slider (or by any slider after the move, with the target won)
    const sliders = [];
    for (let q = 0; q < 128; q++) { if (q & 0x88) { q += 7; continue; } const p = b[q]; if (p && side(p) === S && [3, 4, 5].includes(p & 7)) sliders.push(q); }
    for (const sq of sliders) {
      const t = b[sq] & 7;
      for (const d of DIRS[t]) {
        const h = rayHits(b, sq, d);
        if (h.length < 2 || side(h[0].p) !== D || side(h[1].p) !== D) continue;
        const a = h[0].p & 7, c = h[1].p & 7;
        const isNew = sq === st.to || (() => { const hb = rayHits(k, sq, d); return !(k[sq] === b[sq] && hb.length === 2 && hb[0].sq === h[0].sq && hb[1].sq === h[1].sq); })();
        // pin: front piece less valuable than the one behind (or king behind)
        if (a !== 6 && (c === 6 || VAL[c] > VAL[a]) && VAL[t] <= VAL[c] + (c === 6 ? 99 : 0)) {
          const raySq = []; for (let q = sq + d; !(q & 0x88); q += d) { raySq.push(q); if (q === h[1].sq) break; }
          // newly created pin that wins material on the pin line, or the moved piece attacks a pinned piece
          const attackPinned = sq !== st.to && attacksFrom(b, st.to).includes(h[0].sq) && VAL[moverT] < VAL[a];
          if ((isNew && sq === st.to && raySq.some(q => later.includes(q))) || (attackPinned && later.includes(h[0].sq))) themes.add('pin');
        }
        // skewer: front piece is king or more valuable; the piece behind is won
        if (sq === st.to && (a === 6 || VAL[a] > VAL[c]) && c !== 6 && later.includes(h[1].sq)) themes.add('skewer');
      }
    }
    // back rank: rook/queen check along the defender's back rank with the king hemmed in
    if (checkers.includes(st.to) && [4, 5].includes(moverT)) {
      const rank = D ? 7 : 0;
      if ((dk >> 4) === rank && (st.to >> 4) === rank) {
        const fwd = D ? -16 : 16; let blocked = true;
        for (const df of [-1, 0, 1]) { const q = dk + fwd + df; if (!(q & 0x88) && (!b[q] || side(b[q]) !== D)) { if (!b[q]) blocked = false; } }
        if (blocked) themes.add('backRank');
      }
    }
    if (st.promo) themes.add('promotion');
    // the solver captures a piece that was pinned (to its king, or to a more valuable piece)
    if (st.capt && (st.capt & 7) !== 1) {
      for (let q = 0; q < 128 && !themes.has('pin'); q++) {
        if (q & 0x88) { q += 7; continue; }
        const p = k[q]; if (!p || side(p) !== S || ![3, 4, 5].includes(p & 7)) continue;
        for (const d of DIRS[p & 7]) {
          const h = rayHits(k, q, d);
          if (h.length === 2 && h[0].sq === st.to && side(h[1].p) === D && ((h[1].p & 7) === 6 || VAL[h[1].p & 7] > VAL[st.capt & 7])) { themes.add('pin'); break; }
        }
      }
    }
  }
  // sacrifice: solver is at least 2 points down after some defender reply
  // (a trade where the solver immediately recaptures on the same square does not count)
  for (let i = 1; i < line.length; i += 2) {
    const nxt = states[i + 1];
    if (gainsAfterReply[i] <= -2 && !(nxt && nxt.capt && nxt.to === states[i].to)) { themes.add('sacrifice'); break; }
  }
  // deflection: the defender's piece that captured the bait was guarding a square the solver later takes
  for (let i = 1; i < line.length; i += 2) {
    const st = states[i], prev = states[i - 1];
    if (!st.capt || st.to !== prev.to) continue;   // defender took the solver's piece
    const guarded = attacksFrom(st.before.board, st.from);
    const caps = capturesAfter(i);
    if (caps.some(q => guarded.includes(q) && q !== st.to)) themes.add('deflection');
  }
  // trapped piece: after the first (quiet) solver move a defender piece is threatened, every move
  // of it lands on a square where it can be taken by something cheaper or for free, and the solver
  // wins that piece later in the line (wherever it went).
  if (!states[0].capt && line.length >= 3) {
    const p = new E.Position(fen); p.make(p.moveFromUci(line[0]));
    if (!p.inCheck()) {
      for (let q = 0; q < 128; q++) {
        if (q & 0x88) { q += 7; continue; }
        const pt = p.board[q];
        if (!pt || side(pt) !== D || VAL[pt & 7] < 3 || (pt & 7) === 6) continue;
        const att = attackersOf(p.board, q, S).map(x => VAL[p.board[x] & 7] || 100);
        if (!att.length) continue;
        if (attackersOf(p.board, q, D).length && Math.min(...att) >= VAL[pt & 7]) continue;  // not threatened
        const moves = p.legalMoves().filter(m => E.mFrom(m) === q);
        const safe = moves.some(m => {
          p.make(m); const to = E.mTo(m);
          const a2 = attackersOf(p.board, to, S).map(x => VAL[p.board[x] & 7] || 100);
          const def = attackersOf(p.board, to, D).length;
          p.unmake();
          return !a2.length || (def && Math.min(...a2) >= VAL[pt & 7]);
        });
        if (safe) continue;
        // follow the piece through the line
        let cur = q, won = false;
        for (let i = 1; i < line.length; i++) {
          const st = states[i];
          if (i % 2 === 1 && st.from === cur) cur = st.to;
          else if (i % 2 === 0 && st.to === cur) { won = true; break; }
        }
        if (won) { themes.add('trappedPiece'); break; }
      }
    }
  }
  // a single move that simply collects material that was left (insufficiently) defended
  if (n === 1 && (firstCapHanging || states[0].capt)) themes.add('hangingPiece');
  const p0 = new E.Position(fen);
  themes.add(nonPawnTotal(p0) <= 20 ? 'endgame' : 'middlegame');
  return [...themes];
}

// ---------------- puzzle extraction ----------------
const scoreOf = l => l ? l.score : -1e9;
async function extract(eng, fen, prevMove, DEPTH) {
  const deep = await eng.analyze(fen, [], DEPTH, 2, true);
  const L = deep.lines;
  if (!L.length || L[0].mate !== undefined) return { why: 'mate/none' };
  const b = L[0].score, s = L.length > 1 ? L[1].score : -1e9;
  if (b < MIN_BEST || b - s < FIRST_GAP) return { why: 'gap ' + b + ' ' + s };
  const m1 = L[0].pv[0];
  if (prevMove && prevMove.capture && m1.slice(2, 4) === prevMove.to) return { why: 'recapture' };
  const pos = new E.Position(fen), S = pos.turn, start = balance(pos, S);
  const line = [m1], info = { findDepth: 1, gaps: [b - s], evals: [b] };
  // depth at which m1 becomes (and stays) the engine's choice
  for (let d = DEPTH; d >= 1; d--) { if (deep.byDepth[d] && deep.byDepth[d] !== m1) { info.findDepth = d + 1; break; } }
  for (let k = 1; k <= 3; k++) {
    const p = new E.Position(fen); for (const u of line) p.make(p.moveFromUci(u));
    const gainS = balance(p, S) - start;
    if (p.status().over) return { why: 'game over in line' };
    const rep = await eng.analyze(fen, line, DEPTH, 1, true);
    if (!rep.bestmove || !rep.lines.length) return { why: 'no reply' };
    if (rep.lines[0].mate !== undefined) return { why: 'mate in line' };
    const reply = rep.bestmove;
    p.make(p.moveFromUci(reply));
    const gainR = balance(p, S) - start;
    if (gainS >= MIN_GAIN && gainR >= MIN_GAIN && -rep.lines[0].score >= MIN_BEST) {
      info.finalGain = gainS; info.gainAfterReply = gainR;
      return { line, info };
    }
    if (k === 3) return { why: 'too long' };
    line.push(reply);
    const nx = await eng.analyze(fen, line, DEPTH, 2, true);
    if (!nx.lines.length || nx.lines[0].mate !== undefined) return { why: 'mate later' };
    const nb = nx.lines[0].score, ns = nx.lines.length > 1 ? nx.lines[1].score : -1e9;
    if (nb - ns < NEXT_GAP) return { why: 'ambiguous move ' + (k + 1) };
    info.gaps.push(nb - ns); info.evals.push(nb);
    line.push(nx.lines[0].pv[0]);
  }
  return { why: 'unreachable' };
}

// ---------------- rating ----------------
// see vendor/README.md "Tactics ratings"
function rate(pz, info) {
  const pos = new E.Position(pz.fen);
  // how much search the app's own (club-strength) engine needs to find the first move
  const s = new E.Searcher();
  let nodes = 1 << 21;
  for (let budget = 64; budget <= (1 << 20); budget *= 2) {
    s.clear();
    const r = s.search(new E.Position(pz.fen), { maxNodes: budget });
    if (r.move && pos.uci(r.move) === pz.line[0]) { nodes = budget; break; }
  }
  const legal = pos.legalMoves();
  const m1 = pos.moveFromUci(pz.line[0]);
  let tempting = 0;
  for (const m of legal) { const cap = E.mFlags(m) & E.F_CAP; pos.make(m); const chk = pos.inCheck(); pos.unmake(); if (cap || chk) tempting++; }
  const capSq = E.mTo(m1), isCapture = !!(E.mFlags(m1) & E.F_CAP);
  const undefended = isCapture && attackersOf(pos.board, capSq, pos.turn ^ 1).length === 0;
  pos.make(m1); const isCheck = pos.inCheck(); pos.unmake();
  const quiet = !isCheck && !isCapture;
  const th = pz.themes;
  let r = 450
    + 90 * Math.min(12, Math.log2(nodes / 64)) // effort for the app's own engine: 0..1080
    + 60 * Math.max(0, info.findDepth - 1)     // Stockfish depth before the move becomes best
    + 220 * (pz.n - 1)                         // longer lines
    + 15 * Math.max(0, tempting - 3)           // distracting checks/captures
    + (quiet ? 150 : 0)                        // quiet first moves are harder to see
    + (th.includes('sacrifice') ? 150 : 0)     // giving material away is counter-intuitive
    - (pz.n === 1 && undefended ? 150 : 0);    // simply taking a free piece
  r = Math.round(Math.min(2400, Math.max(400, r)) / 10) * 10;
  return { rating: r, nodes, tempting, quiet };
}

// ---------------- game play ----------------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function sfShallowMove(eng, pos, rng) {
  const d = 1 + Math.floor(rng() * rng() * 7);  // mostly shallow
  const r = await eng.analyze(pos.fen(), [], d, 3, false);
  if (!r.lines.length) return null;
  const best = r.lines[0].score;
  const ok = r.lines.filter(l => l.score >= best - 60);
  const pick = rng() < 0.6 ? ok[0] : ok[Math.floor(rng() * ok.length)];
  return pick.pv[0];
}

async function consider(eng, fen, prevMove, shared) {
  const { out, stats } = shared;
  stats.candidates++;
  let r = await extract(eng, fen, prevMove, PRE_DEPTH);
  if (r.line) { stats.pre++; r = await extract(eng, fen, prevMove, DEPTH); }
  if (r.line) {
    const pz = { fen, line: r.line, n: (r.line.length + 1) >> 1, cat: 'tactic', themes: detectThemes(fen, r.line), goal: 'material' };
    pz._info = r.info;   // rated at the end (keeps the game loop fast)
    out.push(pz); stats.accepted++;
  } else { const w = r.why.split(' ')[0]; stats.rejects[w] = (stats.rejects[w] || 0) + 1; }
}

const plausSearcher = new E.Searcher();
async function plausibleBlunders(eng, pos, rng) {
  const fen = pos.fen();
  const legal = pos.legalMoves();
  if (legal.length < 2) return [];
  const plaus = {};
  let bestP = -1e9;
  for (const m of legal) {
    const c = new E.Position(fen); c.make(m);
    const r = plausSearcher.search(c, { maxDepth: 1, maxNodes: 3000 });
    const v = -r.score; plaus[pos.uci(m)] = v; if (v > bestP) bestP = v;
  }
  const sf = await eng.analyze(fen, [], 8, 64, false);
  if (!sf.lines.length) return [];
  const best = sf.lines[0].score;
  const cands = sf.lines.filter(l => l.pv[0] in plaus && plaus[l.pv[0]] >= bestP - 100 && l.score <= best - 250 && l.score <= -120 && l.score > -3000)
    .map(l => l.pv[0]);
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  return cands.slice(0, 2);
}

async function runWorker(id, eng, shared) {
  const { out, seen, stats, deadline, target } = shared;
  while (Date.now() < deadline && out.length < target) {
    const g = shared.nextGame++;
    const rng = mulberry(shared.seed * 100003 + g);
    const useBots = rng() < 0.5;
    const wl = BOT_LEVELS[3 + Math.floor(rng() * 4)], bl = BOT_LEVELS[3 + Math.floor(rng() * 4)];
    const book = OPENINGS[Math.floor(rng() * OPENINGS.length)];
    const bookPlies = 2 + Math.floor(rng() * 7);
    const pos = new E.Position();
    const s2 = new E.Searcher();
    let prevEval = null, prevMove = null, lopsided = 0;
    stats.games++;
    for (let ply = 0; ply < 150 && Date.now() < deadline && out.length < target; ply++) {
      if (pos.status().over) break;
      const fen = pos.fen();
      let q = null;
      if (ply >= 8) {
        q = await eng.analyze(fen, [], QUICK_DEPTH, 2, false);
        if (!q.lines.length) break;
        const s1 = q.lines[0].score, s2s = q.lines.length > 1 ? q.lines[1].score : -1e9;
        const key = fen.split(' ').slice(0, 4).join(' ');
        if (prevEval !== null && Math.abs(prevEval) <= BALANCED && s1 >= 120 && s1 < 5000 && s1 - s2s >= 150 && !seen.has(key)) {
          seen.add(key);
          await consider(eng, fen, prevMove, shared);
        }
        // inject plausible blunders: moves a 1-ply thinker likes that Stockfish says lose material
        if (Math.abs(s1) <= BALANCED && rng() < 0.6) {
          for (const bl of await plausibleBlunders(eng, pos, rng)) {
            const p2 = new E.Position(fen); const bm = p2.moveFromUci(bl);
            const pm = { capture: !!p2.board[E.mTo(bm)], to: bl.slice(2, 4) };
            p2.make(bm);
            const f2 = p2.fen(), k2 = f2.split(' ').slice(0, 4).join(' ');
            if (seen.has(k2) || p2.status().over) continue;
            seen.add(k2);
            const q2 = await eng.analyze(f2, [], QUICK_DEPTH, 2, false);
            if (!q2.lines.length) continue;
            const a = q2.lines[0].score, c = q2.lines.length > 1 ? q2.lines[1].score : -1e9;
            if (a >= 120 && a < 5000 && a - c >= 150) await consider(eng, f2, pm, shared);
          }
        }
        lopsided = Math.abs(s1) > 400 ? lopsided + 1 : 0;
        if (lopsided >= 4) break;
        prevEval = s1;
      }
      let uci;
      if (ply < bookPlies && ply < book.length) { const m = pos.moveFromSan(book[ply]); uci = m ? pos.uci(m) : null; }
      if (!uci) {
        if (useBots) { const mv = botChooseMove(E, s2, pos, pos.turn === 0 ? wl : bl, rng, g * 7 + pos.turn, ply, null); uci = mv && mv.uci; }
        else uci = await sfShallowMove(eng, pos, rng);
      }
      if (!uci) break;
      const m = pos.moveFromUci(uci);
      if (!m) break;
      prevMove = { capture: !!pos.board[E.mTo(m)] || !!(E.mFlags(m) & E.F_EP), to: uci.slice(2, 4) };
      pos.make(m);
    }
  }
}

async function main() {
  const target = +process.argv[2] || 400;
  const budget = (+process.argv[3] || 2100) * 1000;
  const seed = +process.argv[4] || 1;
  const nw = +process.argv[5] || 2;
  const outFile = process.argv[6] || path.join(__dirname, '..', 'data', 'tactics.json');
  const rawFile = process.argv[7] || path.join(os.tmpdir(), 'tactics.seed' + seed + '.raw.json');
  const t0 = Date.now();
  const shared = { out: [], seen: new Set(), stats: { games: 0, candidates: 0, pre: 0, accepted: 0, rejects: {} },
    deadline: t0 + budget, target, seed, nextGame: 0 };
  const engines = await Promise.all(Array.from({ length: nw }, () => new UCI().init()));
  const tick = setInterval(() => {
    const th = {}; shared.out.forEach(p => p.themes.forEach(t => th[t] = (th[t] || 0) + 1));
    console.error(`[${Math.round((Date.now() - t0) / 1000)}s] games ${shared.stats.games} cand ${shared.stats.candidates} pre ${shared.stats.pre} ok ${shared.out.length}`, JSON.stringify(shared.stats.rejects), JSON.stringify(th));
    fs.writeFileSync(rawFile + '.partial', JSON.stringify(shared.out));
  }, 30000);
  await Promise.all(engines.map((e, i) => runWorker(i, e, shared)));
  clearInterval(tick);
  engines.forEach(e => e.quit());
  const out = shared.out.slice(0, target);
  for (const p of out) Object.assign(p, rate(p, p._info));
  out.sort((a, b) => a.rating - b.rating);
  fs.writeFileSync(rawFile, JSON.stringify(out));
  console.log('raw data (with search info, for --retag):', rawFile);
  const clean = out.map(p => ({ fen: p.fen, line: p.line, n: p.n, cat: p.cat, themes: p.themes, rating: p.rating, goal: p.goal }));
  fs.writeFileSync(outFile, JSON.stringify(clean));
  console.log('games', shared.stats.games, 'time', Math.round((Date.now() - t0) / 1000) + 's');
  report(clean);
  try { fs.unlinkSync(rawFile + '.partial'); } catch (e) {}
}

// Re-derive themes and ratings from one or more raw files written by earlier runs (merging and
// de-duplicating them) without re-running any search:
//   node tools/gen_tactics.js --retag <out.json> <raw1.json> [raw2.json ...]
function retag(outFile, rawFiles) {
  const seen = new Set(), raw = [];
  for (const f of rawFiles) for (const p of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const key = p.fen.split(' ').slice(0, 4).join(' ');
    if (!seen.has(key)) { seen.add(key); raw.push(p); }
  }
  for (const p of raw) { p.themes = detectThemes(p.fen, p.line); Object.assign(p, rate(p, p._info)); }
  raw.sort((a, b) => a.rating - b.rating || (a.fen < b.fen ? -1 : 1));
  const clean = raw.map(p => ({ fen: p.fen, line: p.line, n: p.n, cat: p.cat, themes: p.themes, rating: p.rating, goal: p.goal }));
  fs.writeFileSync(outFile, JSON.stringify(clean));
  report(clean);
}
function report(clean) {
  const th = {}; clean.forEach(p => p.themes.forEach(t => th[t] = (th[t] || 0) + 1));
  console.log('puzzles', clean.length);
  console.log('themes', JSON.stringify(th));
  const hist = {}; clean.forEach(p => { const k = Math.floor(p.rating / 200) * 200; hist[k] = (hist[k] || 0) + 1; });
  console.log('ratings', JSON.stringify(hist), 'n:', JSON.stringify(clean.reduce((a, p) => (a[p.n] = (a[p.n] || 0) + 1, a), {})));
}

if (require.main === module) {
  if (process.argv[2] === '--retag') retag(process.argv[3], process.argv.slice(4));
  else main().catch(e => { console.error(e); process.exit(1); });
}
module.exports = { detectThemes, rate, UCI };
