// Independent re-check of data/tactics.json with Stockfish 19 Lite (vendor/stockfish).
//
//   node tools/verify_tactics.js [file=data/tactics.json] [workers=2] [depth=16]
//
// For every puzzle:
//  - schema: cat 'tactic', goal 'material', n = number of solver moves, rating 400..2400, themes
//  - the whole line is legal (checked with src/engine.js)
//  - every solver move is Stockfish's best at the stated depth (fresh hash, MultiPV 2), with a
//    margin over the second-best move of >= 200cp for the first move and >= 150cp afterwards;
//    the first move scores >= +150 and is not a forced mate (these are material puzzles)
//  - every defender move in the line is Stockfish's best reply (or within 30cp of it)
//  - after the last solver move the solver is >= 2 pawns of material up versus the puzzle start,
//    still >= 2 up after Stockfish's best reply, and still evaluated >= +150
//  - no duplicate positions
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const E = require('../src/engine.js')();

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'tactics.json');
const NW = +process.argv[3] || 2;
const DEPTH = +process.argv[4] || 16;
const ENGINE = path.join(__dirname, '..', 'vendor', 'stockfish', 'stockfish-19-lite-single.js');
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function engine() {
  const proc = spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '', want = null, sink = null;
  proc.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (sink && l.startsWith('info ')) sink(l);
      if (want && want.f(l)) { const w = want; want = null; w.r(l); }
    }
  });
  const send = c => proc.stdin.write(c + '\n');
  const until = f => new Promise(r => { want = { f, r }; });
  let mpv = 1;
  return {
    async init() { send('uci'); await until(l => l === 'uciok'); send('setoption name Hash value 16'); send('isready'); await until(l => l === 'readyok'); },
    // fresh-hash search; returns per-multipv final lines with scores from the side to move
    async go(fen, moves, multipv, extra) {
      send('ucinewgame'); send('isready'); await until(l => l === 'readyok');
      if (multipv !== mpv) { send('setoption name MultiPV value ' + multipv); mpv = multipv; }
      const lines = {};
      sink = l => {
        const t = l.split(' '); const pi = t.indexOf('pv');
        if (pi < 0 || t.includes('lowerbound') || t.includes('upperbound')) return;
        const d = +t[t.indexOf('depth') + 1], k = t.includes('multipv') ? +t[t.indexOf('multipv') + 1] : 1;
        const si = t.indexOf('score'), mate = t[si + 1] === 'mate', v = +t[si + 2];
        if (!lines[k] || d >= lines[k].depth) lines[k] = { depth: d, mate, cp: mate ? (v > 0 ? 100000 - v : -100000 - v) : v, move: t[pi + 1] };
      };
      send('position fen ' + fen + (moves.length ? ' moves ' + moves.join(' ') : ''));
      send('go depth ' + DEPTH + (extra || ''));
      const bm = await until(l => l.startsWith('bestmove'));
      sink = null;
      return { best: bm.split(' ')[1], lines: Object.keys(lines).sort().map(k => lines[k]) };
    },
    quit() { send('quit'); setTimeout(() => proc.kill(), 200); }
  };
}

function materialBalance(fen, white) {
  let w = 0, b = 0;
  for (const c of fen.split(' ')[0]) { const v = VAL[c.toLowerCase()]; if (v === undefined) continue; if (c === c.toUpperCase()) w += v; else b += v; }
  return white ? w - b : b - w;
}

async function check(eng, pz) {
  const errs = [];
  if (pz.cat !== 'tactic') errs.push('cat');
  if (pz.goal !== 'material') errs.push('goal');
  if (!Array.isArray(pz.themes) || !pz.themes.length) errs.push('themes');
  if (!(pz.rating >= 400 && pz.rating <= 2400)) errs.push('rating');
  if (!Array.isArray(pz.line) || pz.line.length % 2 !== 1 || pz.n !== (pz.line.length + 1) / 2 || pz.n > 3) errs.push('line length / n');
  if (errs.length) return errs;
  // legality
  const pos = new E.Position(pz.fen);
  const white = pos.turn === 0;
  for (const u of pz.line) { const m = pos.moveFromUci(u); if (!m) return ['illegal move ' + u]; pos.make(m); }
  const endFen = pos.fen();
  // engine checks
  for (let i = 0; i < pz.line.length; i++) {
    const pre = pz.line.slice(0, i);
    if (i % 2 === 0) {
      const r = await eng.go(pz.fen, pre, 2);
      const a = r.lines[0], b = r.lines[1];
      if (!a || a.move !== pz.line[i]) { errs.push(`move ${i}: engine prefers ${a && a.move}`); break; }
      const gap = b ? a.cp - b.cp : Infinity;
      const need = i === 0 ? 200 : 150;
      if (gap < need) errs.push(`move ${i}: margin ${gap} < ${need}`);
      if (i === 0 && (a.mate || a.cp < 150)) errs.push(`first move score ${a.mate ? 'mate' : a.cp}`);
    } else {
      const r = await eng.go(pz.fen, pre, 1);
      if (r.best !== pz.line[i]) {
        const alt = await eng.go(pz.fen, pre, 1, ' searchmoves ' + pz.line[i]);
        if (!alt.lines[0] || r.lines[0].cp - alt.lines[0].cp > 30) errs.push(`reply ${i}: engine prefers ${r.best}`);
      }
    }
  }
  // material at the end of the line, and after the best reply
  const start = materialBalance(pz.fen, white);
  const gain = materialBalance(endFen, white) - start;
  if (gain < 2) errs.push('final material gain ' + gain);
  const r = await eng.go(pz.fen, pz.line, 1);
  if (r.best && r.best !== '(none)') {
    const p2 = new E.Position(endFen); p2.make(p2.moveFromUci(r.best));
    const g2 = materialBalance(p2.fen(), white) - start;
    if (g2 < 2) errs.push('gain after best reply ' + g2);
    if (r.lines[0] && -r.lines[0].cp < 150) errs.push('eval after line ' + -r.lines[0].cp);
  }
  return errs;
}

(async () => {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t0 = Date.now();
  const seen = new Set(); let dup = 0;
  list.forEach(p => { const k = p.fen.split(' ').slice(0, 4).join(' '); if (seen.has(k)) dup++; seen.add(k); });
  const engines = [];
  for (let i = 0; i < NW; i++) { const e = engine(); await e.init(); engines.push(e); }
  let next = 0, done = 0; const bad = [];
  await Promise.all(engines.map(async eng => {
    while (next < list.length) {
      const idx = next++;
      const errs = await check(eng, list[idx]);
      if (errs.length) bad.push({ idx, fen: list[idx].fen, line: list[idx].line.join(' '), errs });
      if (++done % 50 === 0) console.error(`checked ${done}/${list.length} (${Math.round((Date.now() - t0) / 1000)}s), failures ${bad.length}`);
    }
  }));
  engines.forEach(e => e.quit());
  bad.sort((a, b) => a.idx - b.idx);
  bad.forEach(b => console.log('FAIL #' + b.idx, b.fen, '|', b.line, '|', b.errs.join('; ')));
  if (dup) console.log('FAIL duplicates:', dup);
  console.log(`${list.length - bad.length}/${list.length} puzzles passed at depth ${DEPTH}` + (dup ? `, ${dup} duplicates` : '') + ` in ${Math.round((Date.now() - t0) / 1000)}s`);
  process.exit(bad.length || dup ? 1 : 0);
})();
