// Generates data/tactics.json: themed, non-mate "win material" puzzles, verified with Stockfish.
//
//   node tools/gen_tactics.js [targetCount=400] [timeBudgetSec=2100] [seed=1] [workers=2] [out=data/tactics.json]
//
// Positions come from games between the app's own bots (src/bots.js) and from shallow,
// randomised Stockfish self-play; the side that blunders creates a real tactic for the other.
// Every candidate is re-searched with Stockfish 19 Lite (vendor/stockfish, the same build the
// app ships) at a fixed depth with a fresh hash, so tools/verify_tactics.js can reproduce it.
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const E = require('../src/engine.js')();
const { BOT_LEVELS, OPENINGS, botChooseMove } = require('../src/bots.js');

const ENGINE = path.join(__dirname, '..', 'vendor', 'stockfish', 'stockfish-19-lite-single.js');
const DEPTH = 16;          // verification depth (verify_tactics.js uses the same)
const DEPTH_CONFIRM = 20;  // extra confirmation of the first move
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
  let minGainAfterReply = 0, firstCapHanging = false;
  const states = [];
  for (let i = 0; i < line.length; i++) {
    const m = pos.moveFromUci(line[i]);
    const before = { board: Int8Array.from(pos.board), checkers: null };
    const from = E.mFrom(m), to = E.mTo(m), mover = pos.board[from], capt = pos.board[to];
    if (i === 0 && capt && attackersOf(pos.board, to, D).length === 0) firstCapHanging = true;
    pos.make(m);
    states.push({ i, from, to, mover, capt, before, after: Int8Array.from(pos.board), promo: E.mPromo(m) });
    if (i % 2 === 1) minGainAfterReply = Math.min(minGainAfterReply, balance(pos, S) - start);
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
          const won = later.includes(h[0].sq) || (st.capt && st.to === h[0].sq && st.i > 0);
          // newly created pin whose piece gets won, or the moved piece attacks a pinned piece
          const attackPinned = sq !== st.to && attacksFrom(b, st.to).includes(h[0].sq) && VAL[moverT] < VAL[a];
          if ((isNew && sq === st.to && won) || (attackPinned && later.includes(h[0].sq))) themes.add('pin');
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
  }
  // promotion threat in the line is also a theme if a pawn reaches the 7th
  // sacrifice: solver is at least 2 points down after some defender reply
  if (minGainAfterReply <= -2) themes.add('sacrifice');
  // deflection: the defender's piece that captured the bait was guarding a square the solver later takes
  for (let i = 1; i < line.length; i += 2) {
    const st = states[i], prev = states[i - 1];
    if (!st.capt || st.to !== prev.to) continue;   // defender took the solver's piece
    const guarded = attacksFrom(st.before.board, st.from);
    const caps = capturesAfter(i);
    if (caps.some(q => guarded.includes(q) && q !== st.to)) themes.add('deflection');
  }
  // trapped piece: after the first (quiet) solver move a defender piece is attacked and every
  // move of it lands on a square where it can be taken by something cheaper or for free; it is won.
  {
    const p = new E.Position(fen); p.make(p.moveFromUci(line[0]));
    if (!states[0].capt && !p.inCheck()) {
      const capsLater = capturesAfter(0);
      for (const tgt of capsLater) {
        const piece = new E.Position(fen); piece.make(piece.moveFromUci(line[0]));
        const pt = piece.board[tgt];
        if (!pt || side(pt) !== D || VAL[pt & 7] < 3 || (pt & 7) === 6) continue;
        if (!attackersOf(piece.board, tgt, S).length) continue;
        const moves = piece.legalMoves().filter(m => E.mFrom(m) === tgt);
        const safe = moves.some(m => {
          piece.make(m); const to = E.mTo(m);
          const att = attackersOf(piece.board, to, S).map(q => VAL[piece.board[q] & 7] || 100);
          const def = attackersOf(piece.board, to, D).length;
          piece.unmake();
          return !att.length || (def && Math.min(...att) >= VAL[pt & 7]);
        });
        if (!safe) { themes.add('trappedPiece'); break; }
      }
    }
  }
  if (n === 1 && firstCapHanging) themes.add('hangingPiece');
  const p0 = new E.Position(fen);
  themes.add(nonPawnTotal(p0) <= 14 ? 'endgame' : 'middlegame');
  return [...themes];
}

// ---------------- puzzle extraction ----------------
const scoreOf = l => l ? l.score : -1e9;
async function extract(eng, fen, prevMove) {
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
  for (let budget = 256; budget <= (1 << 20); budget *= 2) {
    s.clear();
    const r = s.search(new E.Position(pz.fen), { maxNodes: budget });
    if (r.move && pos.uci(r.move) === pz.line[0]) { nodes = budget; break; }
  }
  const legal = pos.legalMoves();
  const m1 = pos.moveFromUci(pz.line[0]);
  let tempting = 0;
  for (const m of legal) { const cap = E.mFlags(m) & E.F_CAP; pos.make(m); const chk = pos.inCheck(); pos.unmake(); if (cap || chk) tempting++; }
  pos.make(m1); const isCheck = pos.inCheck(); pos.unmake();
  const isCapture = !!(E.mFlags(m1) & E.F_CAP);
  const quiet = !isCheck && !isCapture;
  const th = pz.themes;
  let r = 500
    + 95 * Math.log2(nodes / 256)              // JS engine effort: 0..~1100
    + 45 * Math.max(0, info.findDepth - 2)     // Stockfish depth needed
    + 230 * (pz.n - 1)                         // longer lines
    + 15 * Math.max(0, tempting - 3)           // distracting checks/captures
    + (quiet ? 180 : 0)                        // quiet first moves are harder to see
    + (th.includes('sacrifice') ? 160 : 0)
    + (th.includes('hangingPiece') ? -220 : 0)
    + (isCapture && th.includes('hangingPiece') && pz.n === 1 ? -60 : 0);
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
          stats.candidates++;
          seen.add(key);
          const r = await extract(eng, fen, prevMove);
          if (r.line) {
            const pz = { fen, line: r.line, n: (r.line.length + 1) >> 1, cat: 'tactic', themes: detectThemes(fen, r.line), goal: 'material' };
            Object.assign(pz, rate(pz, r.info));
            pz._info = r.info;
            out.push(pz); stats.accepted++;
          } else stats.rejects[r.why.split(' ')[0]] = (stats.rejects[r.why.split(' ')[0]] || 0) + 1;
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
  const t0 = Date.now();
  const shared = { out: [], seen: new Set(), stats: { games: 0, candidates: 0, accepted: 0, rejects: {} },
    deadline: t0 + budget, target, seed, nextGame: 0 };
  const engines = await Promise.all(Array.from({ length: nw }, () => new UCI().init()));
  const tick = setInterval(() => {
    const th = {}; shared.out.forEach(p => p.themes.forEach(t => th[t] = (th[t] || 0) + 1));
    console.error(`[${Math.round((Date.now() - t0) / 1000)}s] games ${shared.stats.games} cand ${shared.stats.candidates} ok ${shared.out.length}`, JSON.stringify(shared.stats.rejects), JSON.stringify(th));
    fs.writeFileSync(outFile + '.partial', JSON.stringify(shared.out));
  }, 30000);
  await Promise.all(engines.map((e, i) => runWorker(i, e, shared)));
  clearInterval(tick);
  engines.forEach(e => e.quit());
  const out = shared.out.slice(0, target);
  out.sort((a, b) => a.rating - b.rating);
  fs.writeFileSync(outFile + '.raw.json', JSON.stringify(out));
  const clean = out.map(p => ({ fen: p.fen, line: p.line, n: p.n, cat: p.cat, themes: p.themes, rating: p.rating, goal: p.goal }));
  fs.writeFileSync(outFile, JSON.stringify(clean));
  const th = {}; clean.forEach(p => p.themes.forEach(t => th[t] = (th[t] || 0) + 1));
  console.log('puzzles', clean.length, 'games', shared.stats.games, 'time', Math.round((Date.now() - t0) / 1000) + 's');
  console.log('themes', JSON.stringify(th));
  const hist = {}; clean.forEach(p => { const k = Math.floor(p.rating / 200) * 200; hist[k] = (hist[k] || 0) + 1; });
  console.log('ratings', JSON.stringify(hist));
  try { fs.unlinkSync(outFile + '.partial'); } catch (e) {}
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { detectThemes, rate, UCI };
