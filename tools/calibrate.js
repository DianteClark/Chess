// Round-robin-ish calibration tournament between bot levels, using 2 worker threads.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const E = require('../src/engine.js')();
const { BOT_LEVELS, OPENINGS, botChooseMove } = require('../src/bots.js');

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function playGame(wLv, bLv, seed) {
  const rng = mulberry(seed);
  const pos = new E.Position();
  const s = [new E.Searcher(), new E.Searcher()];
  const line = OPENINGS[Math.floor(rng() * OPENINGS.length)];
  const salts = [Math.floor(rng() * 1e9), Math.floor(rng() * 1e9)];
  let adjSide = -1, adjCount = 0;
  for (let ply = 0; ply < 300; ply++) {
    const st = pos.status();
    if (st.over) return st.result;
    const side = pos.turn, lv = side === 0 ? wLv : bLv;
    const mv = botChooseMove(E, s[side], pos, lv, rng, salts[side], ply, line);
    if (mv.score !== undefined && Math.abs(mv.score) > 1200 && lv.blunder === 0) {
      const ws = mv.score > 0 ? side : side ^ 1;
      if (ws === adjSide) adjCount++; else { adjSide = ws; adjCount = 1; }
    } else if (mv.score !== undefined) { adjCount = 0; adjSide = -1; }
    pos.make(pos.moveFromUci(mv.uci));
    if (adjCount >= 5) return adjSide === 0 ? '1-0' : '0-1';
  }
  return '1/2-1/2';
}

if (isMainThread) {
  const pairs = [];
  const L = BOT_LEVELS.length;
  const GAMES = +process.argv[2] || 24;
  for (let i = 0; i < L; i++) for (let j = i + 1; j < L && j <= i + 2; j++) pairs.push([i, j]);
  const jobs = [];
  let seed = 1;
  for (const [i, j] of pairs) for (let g = 0; g < GAMES; g++) jobs.push({ w: g % 2 ? j : i, b: g % 2 ? i : j, seed: seed++ });
  // shuffle so heavy jobs spread
  jobs.sort((a, b) => (a.seed * 7919 % 101) - (b.seed * 7919 % 101));
  const results = [];
  let next = 0, done = 0;
  const t0 = Date.now();
  const nW = 2;
  for (let k = 0; k < nW; k++) {
    const w = new Worker(__filename, { workerData: {} });
    const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else w.terminate(); };
    w.on('message', r => { results.push(r); done++; if (done % 25 === 0) console.error(done + '/' + jobs.length, Math.round((Date.now() - t0) / 1000) + 's'); if (done === jobs.length) finish(); feed(); });
    feed();
  }
  function finish() {
    require('fs').writeFileSync(__dirname + '/../data/calib_results.json', JSON.stringify(results));
    console.log('games', results.length, 'time', Math.round((Date.now() - t0) / 1000) + 's');
  }
} else {
  parentPort.on('message', job => {
    const res = playGame(BOT_LEVELS[job.w], BOT_LEVELS[job.b], job.seed);
    parentPort.postMessage({ ...job, res });
  });
}
