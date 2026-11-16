// Puzzles 2.0: a reusable puzzle board, Puzzle Rush, the Daily Puzzle and theme filters.
'use strict';

// Plays one puzzle on a board. Accepts the exact solution move, or for checkmate puzzles any
// mating move on the final step. opts: {speed, onSolved(cleanSolve), onWrong(uci), orientFlip}
class PuzzleBoard {
  constructor(p, opts = {}) {
    this.p = p; this.opts = opts; this.step = 0; this.failed = false; this.done = false; this.busy = false;
    this.g = new Game(p.fen);
    this.side = this.g.turn();
    this.board = new BoardView({
      orient: this.side,
      getTargets: sq => (!this.done && !this.busy && this.g.turn() === this.side) ? this.g.targetsFrom(sq) : null,
      onMove: (from, to, dragged) => {
        if (this.g.needsPromo(from, to)) {
          const exp = this.p.line[this.step];
          const pr = exp && exp.slice(0, 4) === sqName(from) + sqName(to) && exp[4] ? exp[4] : 'q';
          return this.attempt(sqName(from) + sqName(to) + pr, dragged);
        }
        this.attempt(sqName(from) + sqName(to), dragged);
      },
    });
    this.el = this.board.el;
    this.show();
  }
  show(anim) { this.board.set(this.g.viewState(), anim); }
  attempt(uci, dragged) {
    const p = this.p, expected = p.line[this.step], isLast = this.step === p.line.length - 1;
    const test = new Game(this.g.startFen, this.g.moves); const r = test.play(uci);
    const mates = r && test.status().reason === 'checkmate';
    const ok = uci === expected || (uci.length === 4 && expected.length === 5 && expected.startsWith(uci) && expected[4] === 'q') || (isLast && mates && (p.goal || 'mate') === 'mate');
    if (ok) {
      const res = this.g.play(uci); playSound(res); this.show(dragged ? null : this.g.lastFromTo);
      this.step++;
      if (this.step >= p.line.length) { this.done = true; this.opts.onSolved && this.opts.onSolved(!this.failed); return; }
      this.opts.onProgress && this.opts.onProgress();
      this.busy = true;
      setTimeout(() => { const rr = this.g.play(p.line[this.step]); this.step++; playSound(rr); this.show(this.g.lastFromTo); this.busy = false; }, this.opts.speed || 600);
    } else {
      if (r) { const tmp = new Game(this.g.startFen, this.g.moves); tmp.play(uci); this.board.set(tmp.viewState(), dragged ? null : tmp.lastFromTo); }
      beep('bad'); this.failed = true;
      this.busy = true; setTimeout(() => { this.busy = false; if (!this.done) this.show(); }, this.opts.wrongDelay || 800);
      this.opts.onWrong && this.opts.onWrong(uci);
    }
  }
  hint() { const exp = this.p.line[this.step]; if (!exp) return; const marks = {}; marks[sqFromName(exp.slice(0, 2))] = 'hint'; this.board.set(Object.assign(this.g.viewState(), { marks })); }
  async playSolution() {
    this.done = true; this.busy = true;
    for (let i = this.step; i < this.p.line.length; i++) { await new Promise(r => setTimeout(r, 650)); const rr = this.g.play(this.p.line[i]); playSound(rr); this.show(this.g.lastFromTo); }
    this.step = this.p.line.length;
  }
}
function puzzlePrompt(p) {
  const side = new E.Position(p.fen).turn === 0 ? 'White' : 'Black';
  const goal = (p.goal || 'mate') === 'mate' ? `checkmate in ${p.n}` : (p.n > 1 ? `win material (${p.n} moves)` : 'win material');
  return { side, goal };
}
const THEME_NAMES = { fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack', doubleCheck: 'Double check', hangingPiece: 'Hanging piece', trappedPiece: 'Trapped piece', promotion: 'Promotion', backRank: 'Back rank', deflection: 'Deflection', sacrifice: 'Sacrifice', endgame: 'Endgame', middlegame: 'Middlegame' };

// ---------- Daily puzzle ----------
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailyPuzzle() {
  const key = todayKey();
  let hsh = 2166136261; for (const c of 'knightclub' + key) { hsh ^= c.charCodeAt(0); hsh = Math.imul(hsh, 16777619) >>> 0; }
  const pool = PUZZLES.filter(p => p.rating >= 700 && p.rating <= 1700);
  return pool[hsh % pool.length];
}
function dailyState() { profile.daily = profile.daily || { last: null, streak: 0, best: 0, history: {} }; return profile.daily; }
function markDaily(solvedClean) {
  const d = dailyState(), key = todayKey();
  if (d.history[key]) return;
  d.history[key] = solvedClean ? 1 : 2;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yKey = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  d.streak = (d.last === yKey ? d.streak : 0) + 1; d.last = key; d.best = Math.max(d.best, d.streak);
  saveProfile();
  if (solvedClean) setTimeout(() => rewardEvent('daily'), 700);
}
function renderDaily(main) {
  const p = dailyPuzzle(), d = dailyState(), key = todayKey(), status = d.history[key];
  const { side, goal } = puzzlePrompt(p);
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { puzMode = null; render(); } }, icon('back', 18), 'Puzzles'), h('h2', { class: 'grow' }, 'Daily Puzzle')));
  const banner = h('div', { class: 'banner' }, icon('calendar', 20), h('span', null, `${side} to move: `, h('b', null, goal)), h('span', { class: 'grow' }), h('span', { class: 'pill' }, `Streak ${d.streak}`));
  const msg = h('div', { class: 'taskmsg' });
  const pb = new PuzzleBoard(p, {
    onSolved: clean => { beep('win'); pb.board.burst('star'); markDaily(clean); banner.className = 'banner good'; banner.innerHTML = ''; banner.append(icon('check', 20), h('span', null, h('b', null, 'Solved! '), (dailyState().streak === 1 ? `Daily streak: ${dailyState().streak} day. Come back tomorrow for a new one.` : `Daily streak: ${dailyState().streak} days. Come back tomorrow for a new one.`))); msg.textContent = ''; },
    onWrong: () => { msg.className = 'taskmsg bad'; msg.textContent = 'Not that one. Try again!'; },
    onProgress: () => { msg.className = 'taskmsg good'; msg.textContent = 'Good move! Keep going…'; },
  });
  main.append(banner, pb.el, msg);
  if (status) msg.textContent = status === 1 ? 'You already solved today\'s puzzle. Play it again for fun!' : 'You finished today\'s puzzle.';
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => pb.hint() }, icon('bulb', 18), 'Hint'), h('button', { class: 'btn grow', onclick: () => { markDaily(false); pb.playSolution(); } }, icon('eye', 18), 'Solution')));
}

// ---------- Puzzle Rush ----------
let rush = null;
function rushBest(mode) { profile.rushBest = profile.rushBest || {}; return profile.rushBest[mode] || 0; }
function rushQueue() {
  // ladder of puzzles: starts easy and climbs ~45 rating points per puzzle, with a little randomness
  const pool = PUZZLES.slice().sort((a, b) => a.rating - b.rating);
  const used = new Set(), out = [];
  for (let i = 0; i < 80; i++) {
    const target = 350 + i * 45 + (Math.random() * 120 - 60);
    let best = null, bd = 1e9;
    for (const p of pool) { if (used.has(p.id)) continue; const d = Math.abs(p.rating - target); if (d < bd) { bd = d; best = p; } }
    if (!best) break; used.add(best.id); out.push(best);
  }
  return out;
}
function renderRush(main) {
  if (!rush || rush.phase === 'menu') {
    main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { puzMode = null; rush = null; render(); } }, icon('back', 18), 'Puzzles'), h('h2', { class: 'grow' }, 'Puzzle Rush')));
    main.append(h('p', { class: 'muted' }, 'Solve as many puzzles as you can. They start easy and get harder. Three wrong answers and the run is over.'));
    for (const [mode, title, desc, ic] of [['3min', '3 minutes', 'Race the clock. Three strikes still end the run.', 'clock'], ['5min', '5 minutes', 'A little more time to think.', 'hourglass'], ['survival', 'Survival', 'No clock at all. Only three strikes.', 'shield']])
      main.append(h('button', { class: 'card lesson', onclick: () => { rush = { phase: 'play', mode, queue: rushQueue(), i: 0, score: 0, strikes: 0, start: Date.now(), limit: mode === '3min' ? 180000 : mode === '5min' ? 300000 : 0, log: [] }; render(); } },
        h('div', { class: 'ic dark' }, icon(ic, 24)), h('div', null, h('div', { class: 't' }, title), h('div', { class: 'd' }, desc)), h('span', { class: 'ck' }, h('span', { class: 'pill' }, 'Best ' + rushBest(mode)))));
    return;
  }
  if (rush.phase === 'over') {
    const best = rushBest(rush.mode), isBest = rush.score > best;
    if (isBest) { profile.rushBest[rush.mode] = rush.score; saveProfile(); }
    if (!rush.rewarded) { rush.rewarded = true; setTimeout(() => rewardEvent('rush', { score: rush.score }), 500); }
    main.append(badge(isBest ? 'trophy' : 'bolt', isBest ? 'gold' : 'blue'), h('h2', { class: 'center' }, `Score: ${rush.score}`), h('p', { class: 'center muted' }, isBest ? 'New personal best!' : `Personal best: ${best}`));
    main.append(h('div', { class: 'card' }, h('b', null, 'Your run'), h('div', { class: 'rushlog' }, rush.log.map(x => h('span', { class: 'rl ' + (x.ok ? 'ok' : 'bad') }, String(x.rating))))));
    main.append(h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => { rush = { phase: 'menu' }; render(); } }, 'Modes'), h('button', { class: 'btn primary grow', onclick: () => { const m = rush.mode; rush = { phase: 'play', mode: m, queue: rushQueue(), i: 0, score: 0, strikes: 0, start: Date.now(), limit: m === '3min' ? 180000 : m === '5min' ? 300000 : 0, log: [] }; render(); } }, icon('repeat', 18), 'Play again')));
    return;
  }
  const p = rush.queue[rush.i];
  if (!p) { rush.phase = 'over'; render(); return; }
  const { side, goal } = puzzlePrompt(p);
  const timer = h('div', { class: 'clock on' });
  const strikes = h('div', { class: 'strikes' }, [0, 1, 2].map(k => icon('x', 18, k < rush.strikes ? 'hit' : '')));
  main.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'lbl', style: { marginBottom: 0 } }, 'Score'), h('div', { style: { fontSize: '30px', fontWeight: 900, lineHeight: 1 } }, rush.score)), strikes, rush.limit ? timer : null));
  main.append(h('div', { class: 'banner' }, h('span', { class: 'tomove', style: { background: side === 'White' ? '#fff' : '#222' } }), h('span', null, `${side} to move: `, h('b', null, goal))));
  const next = ok => {
    rush.log.push({ rating: p.rating, ok });
    if (ok) rush.score++; else rush.strikes++;
    rush.i++;
    if (rush.strikes >= 3) { rush.phase = 'over'; }
    setTimeout(() => render(), ok ? 350 : 700);
  };
  const pb = new PuzzleBoard(p, { speed: 280, wrongDelay: 600, onSolved: () => { beep('star'); inc('puzzles'); next(true); }, onWrong: () => { if (!pb.counted) { pb.counted = true; pb.done = true; next(false); } } });
  main.append(pb.el);
  main.append(h('button', { class: 'btn block ghost', onclick: () => { rush.phase = 'over'; render(); } }, 'End run'));
  if (rush.limit) {
    const tick = () => { const left = rush.limit - (Date.now() - rush.start); timer.textContent = clk.fmt(Math.max(0, left)); timer.classList.toggle('low', left < 20000); if (left <= 0 && rush.phase === 'play') { rush.phase = 'over'; render(); } };
    tick(); const iv = setInterval(tick, 100); cleanups.push(() => clearInterval(iv));
  }
}
