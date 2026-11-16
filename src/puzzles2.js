// Puzzles 2.0: the Puzzle Den hub, rated solving, the Daily Puzzle (with a calendar), Puzzle Rush,
// Puzzle Battle against a bot, Streak mode, puzzle history and a light spaced-repetition review.
'use strict';

const PZ_PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PZ_HINTS = { p: 'Look at your pawn.', n: 'Look at your knight.', b: 'Look at your bishop.', r: 'Look at your rook.', q: 'Look at your queen.', k: 'Look at your king.' };
const PZ_REVIEW_GAPS = [10 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3]; // retry after 10 min, 1 day, 3 days, 7 days

// Plays one puzzle on a board. Accepts the exact solution move, or for checkmate puzzles any
// mating move on the final step. opts: {speed, wrongDelay, startStep, onSolved(cleanSolve), onWrong(uci), onProgress()}
class PuzzleBoard {
  constructor(p, opts = {}) {
    this.p = p; this.opts = opts; this.step = 0; this.failed = false; this.done = false; this.busy = false;
    this.g = new Game(p.fen);
    this.side = this.g.turn();
    for (let i = 0; i < Math.min(opts.startStep || 0, p.line.length); i++) { this.g.play(p.line[i]); this.step++; }
    if (this.step >= p.line.length) this.done = true;
    this.hintLv = 0; this.hintFor = -1;
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
    this.el.classList.add('pz-board');
    this.show();
  }
  show(anim) { this.board.set(this.g.viewState(), anim); }
  // a green or red wash over the board
  flash(kind) {
    if (document.body.classList.contains('no-anim')) return;
    this.el.querySelectorAll('.pz-flash').forEach(x => x.remove());
    const f = h('div', { class: 'pz-flash ' + kind }); this.el.append(f); setTimeout(() => f.remove(), 750);
  }
  attempt(uci, dragged) {
    const p = this.p, expected = p.line[this.step], isLast = this.step === p.line.length - 1;
    const test = new Game(this.g.startFen, this.g.moves); const r = test.play(uci);
    const mates = r && test.status().reason === 'checkmate';
    const ok = uci === expected || (uci.length === 4 && expected.length === 5 && expected.startsWith(uci) && expected[4] === 'q') || (isLast && mates && (p.goal || 'mate') === 'mate');
    if (ok) {
      const res = this.g.play(uci); playSound(res); this.show(dragged ? null : this.g.lastFromTo);
      this.step++; this.hintLv = 0;
      if (this.step >= p.line.length) { this.done = true; this.flash('ok'); this.opts.onSolved && this.opts.onSolved(!this.failed); return; }
      this.opts.onProgress && this.opts.onProgress();
      this.busy = true;
      setTimeout(() => { if (!this.el.isConnected) return; const rr = this.g.play(p.line[this.step]); this.step++; playSound(rr); this.show(this.g.lastFromTo); this.busy = false; }, this.opts.speed || 600);
    } else {
      if (r) {
        const tmp = new Game(this.g.startFen, this.g.moves); tmp.play(uci); this.board.set(tmp.viewState(), dragged ? null : tmp.lastFromTo);
        const to = tmp.lastFromTo && tmp.lastFromTo[1];
        setTimeout(() => { const el = this.board.pieceEls[to]; if (el && el.isConnected) { el.classList.remove('land'); el.classList.add('pz-shake'); } }, dragged ? 30 : 230);
      }
      this.flash('bad'); this.failed = true;
      this.busy = true; setTimeout(() => { this.busy = false; if (!this.done && this.el.isConnected) this.show(); }, this.opts.wrongDelay || 800);
      this.opts.onWrong && this.opts.onWrong(uci);
    }
  }
  // progressive hint: 1 the piece, 2 the square, 3 the move as an arrow. Returns {lv, text}.
  hint() {
    const exp = this.p.line[this.step]; if (!exp || this.done || this.busy) return null;
    if (this.hintFor !== this.step) { this.hintFor = this.step; this.hintLv = 0; }
    this.hintLv = Math.min(3, this.hintLv + 1);
    const from = sqFromName(exp.slice(0, 2)), to = sqFromName(exp.slice(2, 4));
    const st = this.g.viewState(), kind = pieceKey(st.board[from])[1], name = PZ_PIECE_NAMES[kind];
    const marks = {}; marks[from] = 'hint'; if (this.hintLv >= 2) marks[to] = 'mark';
    const arrows = this.hintLv >= 3 ? [[from, to, '#7cc04a']] : [];
    this.board.set(Object.assign({}, st, { marks, arrows }));
    let text;
    if (this.hintLv === 1) text = PZ_HINTS[kind];
    else if (this.hintLv === 2) text = `Your ${name} goes to ${exp.slice(2, 4)}.`;
    else { const t = new Game(this.g.startFen, this.g.moves); t.play(exp); text = `Play ${t.sans[t.sans.length - 1]}!`; }
    return { lv: this.hintLv, text };
  }
  async playSolution() {
    this.done = true; this.busy = true;
    for (let i = this.step; i < this.p.line.length; i++) { await new Promise(r => setTimeout(r, 650)); if (!this.el.isConnected) return; const rr = this.g.play(this.p.line[i]); playSound(rr); this.show(this.g.lastFromTo); }
    this.step = this.p.line.length;
  }
}
function puzzlePrompt(p) {
  const side = new E.Position(p.fen).turn === 0 ? 'White' : 'Black';
  const goal = (p.goal || 'mate') === 'mate' ? `checkmate in ${p.n}` : (p.n > 1 ? `win material (${p.n} moves)` : 'win material');
  return { side, goal };
}
function puzGoal(p) { return (p.goal || 'mate') === 'mate' ? (p.n === 1 ? 'Checkmate in 1' : `Checkmate in ${p.n}`) : (p.n > 1 ? `Win material in ${p.n} moves` : 'Win material'); }
const THEME_NAMES = { fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack', doubleCheck: 'Double check', hangingPiece: 'Hanging piece', trappedPiece: 'Trapped piece', promotion: 'Promotion', backRank: 'Back rank', deflection: 'Deflection', sacrifice: 'Sacrifice', endgame: 'Endgame', middlegame: 'Middlegame' };

// ---------- shared pieces of puzzle UI ----------
// the prompt: a king of the side to move, who moves and the goal, and the puzzle's rating
function pzBanner(p) {
  const side = new E.Position(p.fen).turn === 0 ? 'w' : 'b';
  const el = h('div', { class: 'banner pz-prompt ' + side });
  pzBannerPrompt(el, p);
  return el;
}
function pzBannerPrompt(el, p) {
  const side = new E.Position(p.fen).turn === 0 ? 'w' : 'b';
  el.className = 'banner pz-prompt ' + side; el.innerHTML = '';
  el.append(h('span', { class: 'pz-k' }, h('img', { src: PIECE_URL[side + 'k'], alt: '' })),
    h('span', { class: 'pz-pt' }, h('b', null, side === 'w' ? 'White to move' : 'Black to move'), h('small', null, p.name ? `${puzGoal(p)} · ${p.name}` : puzGoal(p))),
    h('span', { class: 'pz-rt' }, String(p.rating)));
}
function pzBannerSay(el, kind, ic, title, text) {
  el.className = 'banner pz-prompt ' + kind; el.innerHTML = '';
  el.append(h('span', { class: 'pz-k ic' }, icon(ic, 22)), h('span', { class: 'pz-pt' }, h('b', null, title), text ? h('small', null, text) : null));
}
// Professor Hoot under the board: one line of feedback, hints and praise
function pzCoach(text) {
  const owl = typeof hootEl === 'function' ? hootEl('idle', 46) : hoot(46);
  const msg = h('div', { class: 'fs-msg' }, text || '');
  const el = h('div', { class: 'pz-coach' }, h('div', { class: 'pz-owl' }, owl), h('div', { class: 'pz-say' }, msg));
  return { el, msg, owl, say(t, kind, mood) {
    msg.className = 'fs-msg' + (kind ? ' ' + kind : ''); msg.textContent = t;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (mood && typeof hootReact === 'function') hootReact(owl, mood, 1600);
  } };
}
// a small static picture of a puzzle position (side to move at the bottom)
function puzThumb(p, size = 44) {
  const pos = new E.Position(p.fen), flip = pos.turn === 1;
  let s = `<svg viewBox="0 0 8 8" width="${size}" height="${size}" class="pz-thumb" aria-hidden="true">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const x = flip ? 7 - f : f, y = flip ? r : 7 - r;
    s += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:var(${(r + f) % 2 ? '--light' : '--dark'})"/>`;
    const pc = pos.board[r * 16 + f];
    if (pc) s += `<image href="${PIECE_URL[pieceKey(pc)]}" x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return h('span', { class: 'pz-thumbw', html: s + '</svg>' });
}
const PZ_BY_ID = {};
function puzById(id) { if (!PZ_BY_ID.ready) { PUZZLES.forEach(p => PZ_BY_ID[p.id] = p); PZ_BY_ID.ready = true; } return PZ_BY_ID[id]; }
function pzEnsure() {
  profile.puzLog = profile.puzLog || []; profile.puzReview = profile.puzReview || {};
  profile.puzBattle = profile.puzBattle || { w: 0, l: 0, d: 0, beat: {} }; profile.puzStreakBest = profile.puzStreakBest || 0;
  profile.pHist = profile.pHist || [];
}
// every attempt worth remembering: history, and misses go to the review queue
function pzLog(p, ok, mode, extra = {}) {
  pzEnsure();
  if (mode !== 'rush' && mode !== 'battle') {
    profile.puzLog.unshift(Object.assign({ id: p.id, ok: ok ? 1 : 0, m: mode, t: Date.now() }, extra));
    if (profile.puzLog.length > 80) profile.puzLog.length = 80;
  }
  const rv = profile.puzReview[p.id];
  if (!ok) profile.puzReview[p.id] = { box: 0, due: Date.now() + PZ_REVIEW_GAPS[0], miss: ((rv && rv.miss) || 0) + 1 };
  else if (rv && mode === 'review') { if (rv.box >= 2) delete profile.puzReview[p.id]; else { rv.box++; rv.due = Date.now() + PZ_REVIEW_GAPS[rv.box]; } }
  saveProfile();
}
function pzReviewList() { pzEnsure(); return Object.entries(profile.puzReview).filter(([id]) => puzById(id)).sort((a, b) => a[1].due - b[1].due); }
function pzReviewDue() { const now = Date.now(); return pzReviewList().filter(([, v]) => v.due <= now); }
function pzAgo(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const hh = Math.floor(m / 60); if (hh < 24) return `${hh} h ago`;
  const d = Math.floor(hh / 24); return d === 1 ? 'yesterday' : `${d} days ago`;
}
function pzIn(t) {
  const m = Math.max(1, Math.ceil((t - Date.now()) / 60000));
  if (m < 60) return `in ${m} min`; const hh = Math.round(m / 60); if (hh < 24) return `in ${hh} h`; const d = Math.round(hh / 24); return d === 1 ? 'tomorrow' : `in ${d} days`;
}
// open one specific puzzle in the solving screen (replay, review, retry from a run)
function pzOpen(p, o = {}) {
  puzState = Object.assign({ p, step: 0, failed: false, done: false, rated: !profile.tried[p.id] && !o.unrated }, o);
  puzMode = 'solve'; haptic(8); beep('confirm'); render();
}
const PZ_MODE_NAMES = { rated: 'Rated', daily: 'Daily', review: 'Review', streak: 'Streak', replay: 'Replay', theme: 'Theme' };

// ---------- Daily puzzle ----------
function pzDayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function todayKey() { return pzDayKey(new Date()); }
function dailyPuzzle() {
  const key = todayKey();
  let hsh = 2166136261; for (const c of 'knightclub' + key) { hsh ^= c.charCodeAt(0); hsh = Math.imul(hsh, 16777619) >>> 0; }
  const pool = PUZZLES.filter(p => p.rating >= 700 && p.rating <= 1700);
  return pool[hsh % pool.length];
}
function dailyState() { profile.daily = profile.daily || { last: null, streak: 0, best: 0, history: {} }; return profile.daily; }
// the streak still counts if you solved yesterday and have not played today yet
function dailyStreakNow() { const d = dailyState(); const y = new Date(); y.setDate(y.getDate() - 1); return d.last === todayKey() || d.last === pzDayKey(y) ? d.streak : 0; }
function markDaily(solvedClean) {
  const d = dailyState(), key = todayKey();
  if (d.history[key]) return false;
  d.history[key] = solvedClean ? 1 : 2;
  const y = new Date(); y.setDate(y.getDate() - 1);
  d.streak = (d.last === pzDayKey(y) ? d.streak : 0) + 1; d.last = key; d.best = Math.max(d.best, d.streak);
  saveProfile();
  return true;
}
function pzFlame(n) { return h('div', { class: 'streak-chip' + (n >= 3 ? ' hot' : '') + (n >= 7 ? ' blaze' : '') }, icon('flame', 16 + Math.min(6, Math.floor(n / 3))), h('b', null, String(n))); }
// month calendar of daily puzzles: green solved, brass solved after a miss, ring today
function dailyCalendar() {
  let off = 0;
  modal((box, close) => {
    const body = h('div', { class: 'pz-cal' }); box.classList.add('pz-cal-modal');
    const draw = () => {
      body.innerHTML = '';
      const d = dailyState(), now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
      const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const solvedHere = Object.keys(d.history).filter(k => k.startsWith(pzDayKey(first).slice(0, 7))).length;
      body.append(h('div', { class: 'pz-cal-top' },
        h('div', { class: 'pz-cal-flame' + (dailyStreakNow() >= 3 ? ' hot' : '') }, icon('flame', 30), h('div', null, h('b', null, String(dailyStreakNow())), h('small', null, 'streak'))),
        h('div', { class: 'pz-cal-best' }, h('b', null, String(d.best || 0)), h('small', null, 'best')),
        h('div', { class: 'pz-cal-best' }, h('b', null, String(Object.keys(d.history).length)), h('small', null, 'solved'))));
      body.append(h('div', { class: 'pz-cal-nav' },
        h('button', { class: 'pz-hb', 'aria-label': 'Previous month', onclick: () => { off--; beep('tap'); draw(); } }, icon('prev', 20)),
        h('b', null, monthName), h('small', null, `${solvedHere} of ${days}`),
        h('button', { class: 'pz-hb', 'aria-label': 'Next month', disabled: off >= 0, onclick: () => { if (off < 0) { off++; beep('tap'); draw(); } } }, icon('next', 20))));
      const grid = h('div', { class: 'pz-cal-grid' });
      for (let k = 0; k < 7; k++) grid.append(h('i', { class: 'wd' }, new Date(2024, 0, 1 + k).toLocaleDateString(undefined, { weekday: 'narrow' })));
      for (let i = 0; i < lead; i++) grid.append(h('i'));
      const tk = todayKey();
      for (let day = 1; day <= days; day++) {
        const k = pzDayKey(new Date(first.getFullYear(), first.getMonth(), day)), v = d.history[k];
        const future = k > tk;
        grid.append(h('i', { class: 'day' + (v === 1 ? ' ok' : v ? ' meh' : '') + (k === tk ? ' today' : '') + (future ? ' fut' : '') }, v ? icon('check', 14) : String(day)));
      }
      body.append(grid, h('div', { class: 'pz-cal-key' }, h('span', null, h('i', { class: 'ok' }), 'Solved'), h('span', null, h('i', { class: 'meh' }), 'With help'), h('span', null, h('i', { class: 'today' }), 'Today')));
    };
    draw();
    box.append(h('h2', { class: 'center' }, 'Daily calendar'), body, h('button', { class: 'btn primary block', onclick: close }, 'Close'));
  });
}
function renderDaily(main) {
  const p = dailyPuzzle(), d = dailyState(), key = todayKey(), status = d.history[key];
  const flame = pzFlame(dailyStreakNow());
  const F = focusScreen(main, { title: 'Daily Puzzle', sub: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), back: () => { puzMode = null; render(); },
    right: [h('button', { class: 'pz-hb', 'aria-label': 'Daily calendar', onclick: () => { beep('open'); dailyCalendar(); } }, icon('calendar', 20)), flame] });
  const banner = pzBanner(p);
  const coach = pzCoach(status ? (status === 1 ? "You already solved today's puzzle. Play it again for fun!" : "You finished today's puzzle.") : 'A new puzzle every day. Keep your streak alive!');
  let helped = false;
  const pb = new PuzzleBoard(p, {
    onSolved: clean => {
      clean = clean && !helped;
      pb.board.burst('star'); haptic([8, 30, 8]); beep('win');
      const first = markDaily(clean); if (first) { rewardEvent('daily'); pzLog(p, clean, 'daily'); }
      const st = dailyState(), n = dailyStreakNow();
      flame.replaceWith(pzFlame(n));
      pzBannerSay(banner, 'good', 'check', 'Solved!', n === 1 ? 'Daily streak: 1 day' : `Daily streak: ${n} days`);
      coach.say(clean ? 'Brilliant! See you tomorrow.' : 'Solved! Come back tomorrow for a new one.', 'good', 'cheer');
      if (first) setTimeout(() => presentResults({ mood: 'cheer', title: 'Daily solved!', subtitle: n === 1 ? 'Daily streak: 1 day' : `Daily streak: ${n} days`, stars: clean ? 3 : 2, stats: [{ label: 'Streak', value: n }, { label: 'Best', value: st.best }, { label: 'Rating', value: p.rating }], buttons: [{ label: 'Calendar', on: () => dailyCalendar() }, { label: 'More puzzles', primary: true, on: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; render(); } }] }), 900);
      F.setActions([{ ic: 'calendar', label: 'Calendar', on: () => dailyCalendar() }, { ic: 'search', label: 'Analyze', on: () => openAnalysis({ fen: p.fen, moves: p.line, ply: 0 }) }, { ic: 'next', label: 'More puzzles', primary: true, on: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; render(); } }]);
    },
    onWrong: () => { coach.say('Not that one. Try again!', 'bad', 'sad'); beep('wrong'); haptic(25); },
    onProgress: () => { coach.say('Good move! Keep going…', 'good', 'happy'); beep('correct'); },
  });
  F.above.append(banner); F.stage.append(pb.el); F.below.append(coach.el);
  F.setActions([{ ic: 'bulb', label: 'Hint', on: () => { const r = pb.hint(); if (r) { helped = true; beep('hint'); coach.say(r.text, '', 'think'); } } }, { ic: 'eye', label: 'Solution', on: () => { if (pb.done) return; helped = true; if (markDaily(false)) pzLog(p, false, 'daily'); flame.replaceWith(pzFlame(dailyStreakNow())); coach.say('Watch the solution.', '', 'talk'); pb.playSolution(); } }]);
}

// ---------- Puzzle Rush ----------
let rush = null;
function rushBest(mode) { profile.rushBest = profile.rushBest || {}; return profile.rushBest[mode] || 0; }
function rushQueue(start = 350, stepR = 45) {
  // ladder of puzzles: starts easy and climbs ~45 rating points per puzzle, with a little randomness
  const pool = PUZZLES.slice().sort((a, b) => a.rating - b.rating);
  const used = new Set(), out = [];
  for (let i = 0; i < 80; i++) {
    const target = start + i * stepR + (Math.random() * 120 - 60);
    let best = null, bd = 1e9;
    for (const p of pool) { if (used.has(p.id)) continue; const d = Math.abs(p.rating - target); if (d < bd) { bd = d; best = p; } }
    if (!best) break; used.add(best.id); out.push(best);
  }
  return out;
}
const RUSH_MODES = [['3min', '3 minutes', 'Race the clock', 'clock'], ['5min', '5 minutes', 'A little more time', 'hourglass'], ['survival', 'Survival', 'No clock, three strikes', 'shield']];
function rushStart(mode) { puzMode = 'rush'; rush = { phase: 'play', mode, queue: rushQueue(), i: 0, score: 0, strikes: 0, combo: 0, bonus: 0, start: Date.now(), limit: mode === '3min' ? 180000 : mode === '5min' ? 300000 : 0, log: [] }; render(); }
// a sub page header for hub pages inside the den (Rush modes, Battle setup, History)
function pzSubHead(main, title, sub, back) {
  main.append(h('div', { class: 'pz-subhead' }, h('button', { class: 'pz-hb', 'aria-label': 'Back', onclick: () => { haptic(6); beep('back'); navDir = 'back'; back(); } }, icon('back', 22)),
    h('div', { class: 'grow' }, h('h2', null, title), sub ? h('small', null, sub) : null)));
}
// a strip of the puzzles in a finished run: green solved, red missed (tap a miss to retry it)
function pzRunStrip(log, back) {
  const wrap = h('div', { class: 'pz-run' });
  log.forEach((x, i) => { const p = puzById(x.id); if (!p) return;
    wrap.append(h('button', { class: 'pz-run-i ' + (x.ok ? 'ok' : 'bad'), 'aria-label': x.ok ? `Puzzle ${i + 1}: solved` : `Puzzle ${i + 1}: missed, tap to retry`, onclick: () => pzOpen(p, { unrated: true, back, title: 'Retry' }) },
      puzThumb(p, 52), h('span', { class: 'pz-run-n' }, String(p.rating)), h('span', { class: 'pz-run-b' }, icon(x.ok ? 'check' : 'repeat', 12)))); });
  return wrap;
}
function renderRush(main) {
  if (!rush || rush.phase === 'menu') {
    rush = rush || { phase: 'menu' };
    pzSubHead(main, 'Puzzle Rush', 'Puzzles get harder as you go', () => { puzMode = null; rush = null; render(); });
    main.append(h('div', { class: 'rush-hero' }, h('span', { class: 'rh-ic' }, icon('bolt', 34)), h('p', null, 'Solve as many puzzles as you can. Chain solves for a combo: every 5 in a row adds 5 seconds. Three wrong answers and the run is over.')));
    main.append(h('div', { class: 'rush-modes' }, RUSH_MODES.map(([mode, title, desc, ic]) =>
      h('button', { class: 'rmode' + (rush.lastMode === mode ? ' last' : ''), onclick: () => { beep('start'); haptic(12); rushStart(mode); } }, h('span', { class: 'rm-ic' }, icon(ic, 26)), h('b', null, title), h('small', null, desc), h('span', { class: 'pill' }, icon('trophy', 12), String(rushBest(mode)))))));
    if (rush.last) {
      const L = rush.last, missed = L.log.filter(x => !x.ok).length;
      main.append(h('h3', { class: 'sect' }, 'Last run'));
      main.append(h('div', { class: 'card pz-last' },
        h('div', { class: 'pz-last-top' }, h('div', null, h('b', null, String(L.score)), h('small', null, 'Score')), h('div', null, h('b', null, String(L.maxCombo || 0)), h('small', null, 'Best combo')), h('div', null, h('b', null, String(L.top || 0)), h('small', null, 'Top puzzle'))),
        missed ? h('p', { class: 'small muted' }, 'Tap a red puzzle to try it again.') : null,
        pzRunStrip(L.log, 'rush')));
    }
    return;
  }
  if (rush.phase === 'over') {
    const best = rushBest(rush.mode), isBest = rush.score > best;
    if (isBest) { profile.rushBest[rush.mode] = rush.score; saveProfile(); }
    if (!rush.rewarded) { rush.rewarded = true; rewardEvent('rush', { score: rush.score }); }
    const top = Math.max(0, ...rush.log.filter(x => x.ok).map(x => x.rating));
    rush.phase = 'menu'; rush.lastMode = rush.mode;
    rush.last = { mode: rush.mode, score: rush.score, log: rush.log, maxCombo: rush.maxCombo || 0, top };
    presentResults({ mood: isBest ? 'cheer' : rush.score >= 8 ? 'happy' : 'talk', title: isBest ? 'New best!' : `Score ${rush.score}`, subtitle: 'Puzzle Rush', stats: [{ label: 'Score', value: rush.score }, { label: 'Best', value: Math.max(best, rush.score) }, { label: 'Best combo', value: rush.maxCombo || 0 }, { label: 'Top puzzle', value: top }],
      buttons: [{ label: 'Review run', on: () => render() }, { label: 'Play again', primary: true, on: () => rushStart(rush.lastMode) }] });
    return renderRush(main);
  }
  const p = rush.queue[rush.i];
  if (!p) { rush.phase = 'over'; render(); return; }
  const timer = h('div', { class: 'clock on' });
  const strikes = h('div', { class: 'strikes' }, [0, 1, 2].map(k => icon('x', 20, k < rush.strikes ? 'hit' : '')));
  const F = focusScreen(main, { title: 'Puzzle Rush', sub: { '3min': '3 minutes', '5min': '5 minutes', survival: 'Survival' }[rush.mode], back: () => confirmBox('End this run?', 'Your score so far still counts.', 'End run', () => { rush.phase = 'over'; render(); }), right: [rush.limit ? timer : null].filter(Boolean) });
  const scoreB = h('b', null, String(rush.score));
  const scoreEl = h('div', { class: 'rush-score' }, h('small', null, 'Score'), scoreB);
  const heat = rush.combo >= 10 ? ' blaze' : rush.combo >= 5 ? ' hot' : '';
  const combo = h('div', { class: 'rush-combo' + (rush.combo >= 2 ? ' on' : '') + heat }, icon('flame', 16), h('b', null, `x${rush.combo}`), h('small', null, 'combo'));
  const nextBonus = 5 - (rush.combo % 5);
  const meter = h('div', { class: 'rush-meter', title: 'Combo meter' }, [0, 1, 2, 3, 4].map(k => h('i', { class: k < rush.combo % 5 ? 'on' : '' })));
  F.above.append(h('div', { class: 'rush-bar' }, scoreEl, h('div', { class: 'rush-mid' }, combo, rush.limit ? meter : null), strikes), pzBanner(p));
  if (rush.limit && rush.combo >= 1) meter.setAttribute('aria-label', `${nextBonus} more for +5 seconds`);
  const next = ok => {
    rush.log.push({ id: p.id, rating: p.rating, ok });
    if (ok) {
      rush.score++; rush.combo++; rush.maxCombo = Math.max(rush.maxCombo || 0, rush.combo);
      beep('combo', { n: Math.min(rush.combo, 12) }); fxPop(scoreEl); scoreB.textContent = String(rush.score);
      fxFloat(scoreEl, '+1', 'good');
      if (rush.limit && rush.combo % 5 === 0) { rush.limit += 5000; rush.bonus += 5; setTimeout(() => { fxFloat(timer, '+5s', 'good big'); fxPop(timer); beep('coin'); }, 120); }
      else if (rush.combo >= 2) setTimeout(() => fxFloat(combo, `x${rush.combo}`, 'xp'), 60);
    } else {
      rush.strikes++; rush.combo = 0; beep('wrong'); haptic(30); fxShake(strikes);
      strikes.querySelectorAll('.icn').forEach((e, k) => e.classList.toggle('hit', k < rush.strikes));
      pzLog(p, false, 'rush');
    }
    rush.i++;
    if (rush.strikes >= 3) { rush.phase = 'over'; }
    setTimeout(() => render(), ok ? 350 : 700);
  };
  const pb = new PuzzleBoard(p, { speed: 280, wrongDelay: 600, onSolved: () => { inc('puzzles'); next(true); }, onWrong: () => { if (!pb.counted) { pb.counted = true; pb.done = true; next(false); } } });
  F.stage.append(pb.el);
  F.setActions([{ ic: 'flag', label: 'End run', on: () => { rush.phase = 'over'; render(); } }]);
  if (rush.limit) {
    const tick = () => { const left = rush.limit - (Date.now() - rush.start); timer.textContent = clk.fmt(Math.max(0, left)); timer.classList.toggle('low', left < 20000); if (left <= 0 && rush.phase === 'play') { rush.phase = 'over'; render(); } };
    tick(); const iv = setInterval(tick, 100); cleanups.push(() => clearInterval(iv));
  }
}

// ---------- Puzzle Battle: race a bot up the same ladder for 3 minutes ----------
let battle = null;
const BATTLE_MS = 180000;
function battleBotStrength(i) { return BOTS[i].rating + 250; }
// how long the bot takes on a puzzle, and whether it gets it right
function battleBotTurn(i, p) {
  const r = battleBotStrength(i), hard = Math.max(0, p.rating - r) / 500;
  const ms = (12.5 - i * 1.2) * (1 + hard) * (0.7 + Math.random() * 0.6) * 1000;
  const e = 1 / (1 + Math.pow(10, (p.rating - r) / 400));
  return { ms: Math.max(2200, ms), ok: Math.random() < Math.max(0.25, Math.min(0.97, 0.15 + e)) };
}
function battleBotNext(B, from) { const p = B.queue[B.opp.i]; if (!p) { B.opp.done = true; return; } const t = battleBotTurn(B.bot, p); B.opp.cur = { from, at: from + t.ms, ok: t.ok }; }
// move the bot forward to time `now`; returns how many puzzles it finished
function battleAdvance(B, now) {
  let n = 0; const end = B.start + BATTLE_MS;
  while (!B.opp.done && B.opp.cur && B.opp.cur.at <= Math.min(now, end)) {
    const c = B.opp.cur; n++;
    if (c.ok) B.opp.score++; else B.opp.strikes++;
    B.opp.i++;
    if (B.opp.strikes >= 3) { B.opp.done = true; break; }
    battleBotNext(B, c.at);
  }
  return n;
}
function battleStart(bot) { puzMode = 'battle'; battle = { phase: 'play', bot, queue: rushQueue(), start: Date.now(), you: { i: 0, score: 0, strikes: 0 }, opp: { i: 0, score: 0, strikes: 0, done: false }, log: [] }; battleBotNext(battle, battle.start); render(); }
function battleFinish() {
  const B = battle; if (B.phase !== 'play') return;
  battleAdvance(B, B.start + BATTLE_MS); // the bot plays out its remaining time
  B.phase = 'over';
  const you = B.you.score, them = B.opp.score, bot = BOTS[B.bot], res = you > them ? 1 : you < them ? 0 : 0.5;
  pzEnsure(); const R = profile.puzBattle; if (res === 1) { R.w++; R.beat[B.bot] = (R.beat[B.bot] || 0) + 1; } else if (res === 0) R.l++; else R.d++;
  saveProfile();
  rewardEvent('rush', { score: you });
  B.last = { you, them, res, log: B.log };
  const top = Math.max(0, ...B.log.filter(x => x.ok).map(x => x.rating));
  presentResults({ mood: res === 1 ? 'cheer' : res === 0.5 ? 'happy' : 'talk', title: res === 1 ? 'You win!' : res === 0.5 ? 'Tie game' : `${bot.name} wins`, subtitle: `Puzzle Battle: ${you} to ${them}`, stars: res === 1 ? (you - them >= 5 ? 3 : 2) : res === 0.5 ? 1 : 0,
    stats: [{ label: 'You', value: you }, { label: bot.name, value: them }, { label: 'Top puzzle', value: top }],
    buttons: [{ label: 'Opponents', on: () => { battle = { phase: 'menu', bot: B.bot, last: B.last }; render(); } }, { label: 'Rematch', primary: true, on: () => battleStart(B.bot) }] });
}
function battleRecord(i) { pzEnsure(); return profile.puzBattle.beat[i] || 0; }
function renderBattle(main) {
  if (!battle || battle.phase === 'menu' || battle.phase === 'over') {
    if (!battle || battle.bot == null) { let best = 0; const pr = profile.puzzle.r; BOTS.forEach((b, i) => { if (Math.abs(battleBotStrength(i) - pr) < Math.abs(battleBotStrength(best) - pr)) best = i; }); battle = Object.assign(battle || {}, { phase: 'menu', bot: best }); }
    if (battle.phase === 'over') battle = { phase: 'menu', bot: battle.bot, last: battle.last };
    pzEnsure(); const R = profile.puzBattle;
    pzSubHead(main, 'Puzzle Battle', `Won ${R.w} · Lost ${R.l}`, () => { puzMode = null; battle = null; render(); });
    const sel = BOTS[battle.bot];
    const spot = h('div', { class: 'pb-spot' },
      h('div', { class: 'pb-vs' }, h('div', { class: 'pb-side' }, avatar(myAvatar(), 64), h('b', null, 'You'), h('small', null, fmtR(profile.puzzle))),
        h('span', { class: 'pb-vs-t' }, 'VS'),
        h('div', { class: 'pb-side' }, avatar(sel.avatar, 64), h('b', null, sel.name), h('small', null, String(battleBotStrength(battle.bot))))),
      h('p', null, 'Race through the same puzzles for 3 minutes. Three misses and you are out. Most solved wins!'),
      h('button', { class: 'btn primary block pb-go', onclick: () => { beep('start'); haptic(14); battleStart(battle.bot); } }, icon('sword', 20), `Battle ${sel.name}`));
    main.append(spot);
    main.append(h('h3', { class: 'sect' }, 'Choose your opponent'));
    main.append(h('div', { class: 'pb-bots' }, BOTS.map((b, i) => h('button', { class: 'pb-bot' + (i === battle.bot ? ' on' : '') + (battleRecord(i) ? ' beat' : ''), 'aria-pressed': String(i === battle.bot), onclick: () => { if (battle.bot !== i) { battle.bot = i; beep('card'); haptic(5); render(); } } },
      avatar(b.avatar, 44), h('span', { class: 'pb-bn' }, h('b', null, b.name), h('small', null, String(battleBotStrength(i)))), battleRecord(i) ? h('span', { class: 'pb-win' }, icon('trophy', 13), String(battleRecord(i))) : null))));
    if (battle.last && battle.last.log.length) {
      main.append(h('h3', { class: 'sect' }, 'Last battle'));
      main.append(h('div', { class: 'card pz-last' }, h('p', { class: 'small muted' }, `You ${battle.last.you}, ${BOTS[battle.bot].name} ${battle.last.them}. Tap a red puzzle to try it again.`), pzRunStrip(battle.last.log, 'battle')));
    }
    return;
  }
  const B = battle, bot = BOTS[B.bot], p = B.queue[B.you.i];
  if (!p) { battleFinish(); return; }
  const timer = h('div', { class: 'clock on' });
  const F = focusScreen(main, { title: 'Puzzle Battle', sub: `vs ${bot.name}`, back: () => confirmBox('Leave the battle?', 'Leaving counts as a loss.', 'Leave', () => { B.you.strikes = 3; battleFinish(); }), right: [timer] });
  const strikes = who => h('div', { class: 'strikes' }, [0, 1, 2].map(k => icon('x', 14, k < who.strikes ? 'hit' : '')));
  const yS = h('b', { class: 'pb-n' }, String(B.you.score)), oS = h('b', { class: 'pb-n' }, String(B.opp.score));
  const yStr = strikes(B.you), oStr = strikes(B.opp);
  const tug = h('div', { class: 'pb-tug-y' }), pip = h('div', { class: 'pb-pip' }), pipFill = h('div', { class: 'pb-pip-f' });
  const oppSide = h('div', { class: 'pb-me opp' + (B.opp.done ? ' out' : '') }, h('div', { class: 'pb-who' }, h('small', null, bot.name), oStr), oS, avatar(bot.avatar, 38));
  F.above.append(h('div', { class: 'pb-bar' },
    h('div', { class: 'pb-row' }, h('div', { class: 'pb-me' }, avatar(myAvatar(), 38), yS, h('div', { class: 'pb-who' }, h('small', null, 'You'), yStr)), oppSide),
    h('div', { class: 'pb-tug' }, tug), h('div', { class: 'pb-think' }, pipFill, pip)), pzBanner(p));
  const sync = () => {
    const tot = B.you.score + B.opp.score; tug.style.width = (tot ? Math.round(B.you.score / tot * 100) : 50) + '%';
    oS.textContent = String(B.opp.score); oStr.querySelectorAll('.icn').forEach((e, k) => e.classList.toggle('hit', k < B.opp.strikes));
    oppSide.classList.toggle('out', B.opp.done);
  };
  sync();
  const next = ok => {
    B.log.push({ id: p.id, rating: p.rating, ok });
    if (ok) { B.you.score++; beep('combo', { n: Math.min(B.you.score, 12) }); yS.textContent = String(B.you.score); fxPop(yS); fxFloat(yS, '+1', 'good'); }
    else { B.you.strikes++; beep('wrong'); haptic(30); fxShake(yStr); yStr.querySelectorAll('.icn').forEach((e, k) => e.classList.toggle('hit', k < B.you.strikes)); pzLog(p, false, 'battle'); }
    sync(); B.you.i++;
    setTimeout(() => { if (battle !== B || B.phase !== 'play') return; if (B.you.strikes >= 3) battleFinish(); else render(); }, ok ? 350 : 700);
  };
  const pb = new PuzzleBoard(p, { speed: 280, wrongDelay: 600, onSolved: () => { inc('puzzles'); next(true); }, onWrong: () => { if (!pb.counted) { pb.counted = true; pb.done = true; next(false); } } });
  F.stage.append(pb.el);
  F.setActions([{ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign the battle?', 'This counts as a loss.', 'Resign', () => { B.you.strikes = 3; battleFinish(); }) }]);
  const tick = () => {
    if (battle !== B || B.phase !== 'play') return;
    const now = Date.now(), left = B.start + BATTLE_MS - now;
    timer.textContent = clk.fmt(Math.max(0, left)); timer.classList.toggle('low', left < 20000);
    const before = B.opp.score;
    if (battleAdvance(B, now)) { sync(); if (B.opp.score > before) { fxPop(oS); beep('pop'); } else fxShake(oStr); }
    const c = B.opp.cur, k = !B.opp.done && c ? Math.max(0, Math.min(1, (now - c.from) / (c.at - c.from))) : 0;
    pip.style.left = (k * 100) + '%'; pipFill.style.width = (k * 100) + '%';
    // the bot is out and you are ahead: no need to wait for the clock
    if (left <= 0 || (B.opp.done && B.you.score > B.opp.score)) battleFinish();
  };
  tick(); const iv = setInterval(tick, 100); cleanups.push(() => clearInterval(iv));
}

// ---------- Streak: one mistake ends the run, puzzles keep getting harder ----------
let pzStreak = null;
function pzStreakPick(S) {
  const target = 420 + S.n * 50 + (Math.random() * 100 - 50);
  let best = null, bd = 1e9;
  for (const p of PUZZLES) { if (S.used.has(p.id)) continue; const d = Math.abs(p.rating - target); if (d < bd) { bd = d; best = p; } }
  if (best) S.used.add(best.id);
  return best;
}
function pzStreakNew() { const S = { phase: 'play', n: 0, used: new Set(), top: 0 }; S.p = pzStreakPick(S); return S; }
function pzStreakStart() { pzStreak = pzStreakNew(); puzMode = 'streak'; render(); }
function pzStreakOver(missed) {
  const S = pzStreak; if (!S || S.phase !== 'play') return; S.phase = 'over';
  pzEnsure(); const best = profile.puzStreakBest, isBest = S.n > best;
  if (isBest) { profile.puzStreakBest = S.n; saveProfile(); }
  rewardEvent('rush', { score: S.n });
  presentResults({ mood: isBest ? 'cheer' : S.n >= 5 ? 'happy' : 'talk', title: isBest ? 'New best streak!' : `Streak ${S.n}`, subtitle: missed ? 'The streak ends on a miss' : 'Puzzle Streak',
    stats: [{ label: 'Streak', value: S.n }, { label: 'Best', value: Math.max(best, S.n) }, { label: 'Top puzzle', value: S.top }],
    buttons: [missed ? { label: 'See the miss', on: () => { pzStreak = null; pzOpen(missed, { unrated: true, title: 'Retry' }); } } : { label: 'Puzzle Den', on: () => { puzMode = null; pzStreak = null; render(); } }, { label: 'Try again', primary: true, on: () => pzStreakStart() }] });
}
function renderStreak(main) {
  if (!pzStreak || pzStreak.phase !== 'play') pzStreak = pzStreakNew();
  const S = pzStreak, p = S.p;
  if (!p) { pzStreakOver(null); puzMode = null; return render(); }
  pzEnsure();
  const counter = h('div', { class: 'pz-scount' + (S.n >= 5 ? ' hot' : '') }, icon('flame', 18), h('b', null, String(S.n)));
  const F = focusScreen(main, { title: 'Puzzle Streak', sub: `Best ${profile.puzStreakBest}`, back: () => { if (S.n) confirmBox('End this streak?', 'Your streak so far still counts.', 'End streak', () => { pzStreakOver(null); puzMode = null; pzStreak = null; render(); }); else { puzMode = null; pzStreak = null; render(); } }, right: [counter] });
  const goal = profile.puzStreakBest > S.n ? profile.puzStreakBest + 1 : S.n + 1;
  const ladder = h('div', { class: 'pz-ladder' }, h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(Math.min(1, S.n / Math.max(1, goal)) * 100) + '%' } })), h('small', null, profile.puzStreakBest > S.n ? `${goal - S.n} to a new best` : 'New best territory!'));
  F.above.append(ladder, pzBanner(p));
  const coach = pzCoach(S.n ? `${S.n} in a row. One miss ends the streak.` : 'One miss ends the streak. How far can you go?');
  const pb = new PuzzleBoard(p, {
    speed: 380, wrongDelay: 700,
    onProgress: () => { coach.say('Good move! Keep going…', 'good', 'happy'); beep('correct'); },
    onSolved: () => { S.n++; S.top = Math.max(S.top, p.rating); inc('puzzles'); pzLog(p, true, 'streak'); counter.querySelector('b').textContent = String(S.n); fxPop(counter); fxFloat(counter, '+1', 'good'); beep('combo', { n: Math.min(S.n, 12) }); coach.say('Correct!', 'good', 'cheer'); S.p = pzStreakPick(S); setTimeout(() => { if (pzStreak === S && puzMode === 'streak') render(); }, 650); },
    onWrong: () => { if (pb.counted) return; pb.counted = true; pb.done = true; beep('wrong'); haptic(30); pzLog(p, false, 'streak'); coach.say('Missed it! Here is the answer.', 'bad', 'sad');
      setTimeout(() => { if (pzStreak !== S) return; pb.playSolution().then(() => setTimeout(() => pzStreakOver(p), 500)); }, 750); },
  });
  F.stage.append(pb.el); F.below.append(coach.el);
  F.setActions([{ ic: 'flag', label: 'End streak', on: () => { pzStreakOver(null); } }]);
}

// ======================= PUZZLE DEN (hub and rated solving) =======================
let puzCat = 'rated', puzState = null, puzMode = null;
function pickPuzzle() {
  if (puzCat === 'review') { const e = pzReviewDue()[0]; return e ? puzById(e[0]) : null; }
  const pool = puzPool(puzCat);
  const fresh = pool.filter(p => !profile.tried[p.id]);
  if (puzCat === 'pattern' && fresh.length) return fresh[0]; // learn the famous mates in order, easiest first
  const use = (fresh.length ? fresh : pool).slice();
  const pr = profile.puzzle.r;
  use.sort((a, b) => Math.abs(a.rating - pr) - Math.abs(b.rating - pr));
  const top = use.slice(0, Math.min(6, use.length));
  return top[Math.floor(rand() * top.length)];
}
const PUZ_CAT_ICON = { rated: 'target', review: 'repeat', m1: 'crown', m2: 'crown', m3: 'crown', pattern: 'book', 't:fork': 'fork', 't:pin': 'pin', 't:skewer': 'skewer', 't:discoveredAttack': 'eye', 't:hangingPiece': 'alert', 't:trappedPiece': 'key', 't:sacrifice': 'flame', 't:endgame': 'castle', 't:middlegame': 'sword', 't:backRank': 'shield', 't:deflection': 'route', 't:promotion': 'arrowUp', 't:doubleCheck': 'bolt' };
function puzCats() {
  const themeCounts = {}; PUZZLES.forEach(p => (p.themes || []).forEach(t => themeCounts[t] = (themeCounts[t] || 0) + 1));
  return [['rated', 'For you'], ['m1', 'Mate in 1'], ['m2', 'Mate in 2'], ['m3', 'Mate in 3'], ['pattern', 'Famous mates']]
    .concat(Object.keys(THEME_NAMES).filter(t => (themeCounts[t] || 0) >= 8).map(t => ['t:' + t, THEME_NAMES[t]]));
}
function puzPool(cat) { return PUZZLES.filter(p => cat === 'rated' ? true : cat === 'pattern' ? p.cat === 'pattern' : cat.startsWith('t:') ? (p.themes || []).includes(cat.slice(2)) : p.n === +cat.slice(-1) && p.cat !== 'pattern' && p.cat !== 'tactic'); }
// mastery of a theme: bronze, silver, gold by puzzles solved and accuracy
function puzMastery(cat) {
  const pool = puzPool(cat); let ok = 0, bad = 0; for (const p of pool) { const t = profile.tried[p.id]; if (t === 1) ok++; else if (t === 2) bad++; }
  const acc = ok + bad ? ok / (ok + bad) : 0, n = pool.length;
  const need = [Math.min(5, Math.ceil(n * .15)), Math.min(15, Math.ceil(n * .35)), Math.min(30, Math.ceil(n * .6))], accNeed = [0, .65, .8];
  let lv = 0; for (let i = 0; i < 3; i++) if (ok >= need[i] && acc >= accNeed[i]) lv = i + 1;
  const nxt = lv < 3 ? need[lv] : n;
  return { pool: n, ok, bad, acc, lv, pct: lv >= 3 ? 1 : Math.min(1, ok / nxt), nxt, accNeed: lv < 3 ? accNeed[lv] : 0 };
}
const PZ_MEDALS = ['', 'bronze', 'silver', 'gold'];
// rating history as a small area chart
function pzGraph(hist) {
  const pts = (hist || []).slice(-60); if (pts.length < 2) pts.unshift(pts[0] || 800);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = Math.max(40, hi - lo), W = 300, H = 64;
  const xy = pts.map((v, i) => [i / (pts.length - 1) * W, H - 6 - (v - lo) / span * (H - 14)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="pzg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ccfff" stop-opacity=".45"/><stop offset="1" stop-color="#9ccfff" stop-opacity="0"/></linearGradient></defs>`
    + `<polygon points="0,${H} ${line} ${W},${H}" fill="url(#pzg)"/><polyline points="${line}" fill="none" stroke="#9ccfff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  const dot = h('i', { class: 'pz-gdot', style: { left: (lx / W * 100) + '%', top: (ly / H * 100) + '%' } });
  const gs = h('div', { class: 'pz-gsvg', html: svg }); gs.append(dot);
  return h('div', { class: 'pz-graph' }, gs, h('span', { class: 'pz-ghi' }, String(hi)), h('span', { class: 'pz-glo' }, String(lo)));
}
function pzHistoryRow(x) {
  const p = puzById(x.id); if (!p) return null;
  return h('button', { class: 'pz-hrow', onclick: () => pzOpen(p, { unrated: true, back: puzMode === 'history' ? 'history' : null, title: 'Replay' }) },
    puzThumb(p, 46),
    h('span', { class: 'pz-hmid' }, h('b', null, puzGoal(p)), h('small', null, `${PZ_MODE_NAMES[x.m] || 'Puzzle'} · ${pzAgo(x.t)}`)),
    h('span', { class: 'pz-hr' }, h('b', null, String(p.rating)), x.d != null ? h('small', { class: x.d >= 0 ? 'pz-up' : 'pz-down' }, x.d >= 0 ? `+${x.d}` : String(x.d)) : null),
    h('span', { class: 'pz-hres ' + (x.ok ? 'ok' : 'bad') }, icon(x.ok ? 'check' : 'x', 16)));
}
function renderPuzHistory(main) {
  pzEnsure();
  const L = profile.puzLog, ok = L.filter(x => x.ok).length;
  pzSubHead(main, 'Puzzle history', L.length ? `${ok} of ${L.length} solved first try` : 'Your recent puzzles', () => { puzMode = null; render(); });
  if (!L.length) { main.append(h('div', { class: 'card center muted' }, 'Puzzles you play show up here. Tap one to play it again.')); return; }
  main.append(h('div', { class: 'pz-hlist' }, L.map(pzHistoryRow)));
}
function renderPuzzles(main) {
  if (puzMode === 'daily') return renderDaily(main);
  if (puzMode === 'rush') return renderRush(main);
  if (puzMode === 'battle') return renderBattle(main);
  if (puzMode === 'streak') return renderStreak(main);
  if (puzMode === 'history') return renderPuzHistory(main);
  if (puzMode === 'solve') return renderPuzzleSolve(main);
  pzEnsure();
  const dState = dailyState(), dDone = dState.history[todayKey()], dStreak = dailyStreakNow();
  const solvedCount = Object.values(profile.tried).filter(x => x === 1).length;
  main.append(stageBanner('den', 'Puzzle Den', `${solvedCount} of ${PUZZLES.length} solved`));
  // your rating with its history, and the big button
  const H = profile.pHist, recent = H.length > 1 ? H[H.length - 1] - H[Math.max(0, H.length - 11)] : 0;
  main.append(h('button', { class: 'puz-hero', onclick: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; haptic(10); beep('confirm'); render(); } },
    h('div', { class: 'ph-top' },
      h('div', { class: 'ph-l' }, h('small', null, 'Puzzle rating'),
        h('div', { class: 'ph-rr' }, h('b', { class: 'ph-r' }, fmtR(profile.puzzle)), recent ? h('span', { class: 'ph-d ' + (recent > 0 ? 'pz-up' : 'pz-down'), title: 'Last 10 puzzles' }, icon(recent > 0 ? 'arrowUp' : 'arrowRight', 12), recent > 0 ? `+${recent}` : String(recent)) : null),
        h('small', null, profile.streak ? `Streak ${profile.streak} · best ${profile.best}` : `Best streak ${profile.best}`)),
      h('div', { class: 'ph-go' }, icon('play', 26), h('span', null, 'Solve'))),
    H.length > 1 ? pzGraph(H) : null));
  const week = h('div', { class: 'week' });
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const v = dState.history[pzDayKey(d)]; week.append(h('i', { class: v === 1 ? 'ok' : v ? 'meh' : i === 0 ? 'today' : '' })); }
  pzEnsure(); const B = profile.puzBattle;
  main.append(h('div', { class: 'puz-modes' },
    h('button', { class: 'pmode daily' + (dDone ? '' : ' hot'), onclick: () => { puzMode = 'daily'; beep('confirm'); render(); } }, h('span', { class: 'pm-ic' }, icon('calendar', 24)), h('b', null, 'Daily'), h('small', null, dDone ? 'Done for today' : 'New puzzle ready'), h('div', { class: 'pm-foot' }, week, dStreak ? h('span', { class: 'pm-fl' + (dStreak >= 3 ? ' hot' : '') }, icon('flame', 14), String(dStreak)) : null)),
    h('button', { class: 'pmode rush', onclick: () => { puzMode = 'rush'; rush = Object.assign(rush && rush.phase === 'menu' ? rush : {}, { phase: 'menu' }); beep('confirm'); render(); } }, h('span', { class: 'pm-ic' }, icon('bolt', 24)), h('b', null, 'Rush'), h('small', null, 'Beat the clock'), h('span', { class: 'pm-sub' }, icon('trophy', 13), `Best ${Math.max(0, ...Object.values(profile.rushBest || { a: 0 }))}`)),
    h('button', { class: 'pmode battle', onclick: () => { puzMode = 'battle'; battle = battle && battle.phase !== 'play' ? battle : null; beep('confirm'); render(); } }, h('span', { class: 'pm-ic' }, icon('sword', 24)), h('b', null, 'Battle'), h('small', null, 'Race a bot'), h('span', { class: 'pm-sub' }, icon('trophy', 13), `${B.w} won`)),
    h('button', { class: 'pmode streak', onclick: () => { puzMode = 'streak'; pzStreak = null; beep('start'); render(); } }, h('span', { class: 'pm-ic' }, icon('flame', 24)), h('b', null, 'Streak'), h('small', null, 'One miss ends it'), h('span', { class: 'pm-sub' }, icon('trophy', 13), `Best ${profile.puzStreakBest}`))));
  // learn from mistakes
  const rq = pzReviewList(), due = pzReviewDue();
  if (rq.length) {
    main.append(h('button', { class: 'pz-review' + (due.length ? ' due' : ''), disabled: !due.length, onclick: () => { puzCat = 'review'; puzState = null; puzMode = 'solve'; beep('confirm'); haptic(8); render(); } },
      h('span', { class: 'pr-ic' }, icon('repeat', 22), due.length ? h('i', null, String(due.length)) : null),
      h('span', { class: 'grow' }, h('b', null, 'Learn from mistakes'), h('small', null, due.length ? (due.length === 1 ? '1 puzzle ready to retry' : `${due.length} puzzles ready to retry`) : `Next retry ${pzIn(rq[0][1].due)}`)),
      h('span', { class: 'pr-stack' }, rq.slice(0, 3).map(([id]) => puzThumb(puzById(id), 34)))));
  }
  main.append(h('h3', { class: 'sect' }, 'Practice by theme'));
  main.append(h('div', { class: 'puz-themes' }, puzCats().filter(([k]) => k !== 'rated').map(([k, l]) => {
    const M = puzMastery(k);
    return h('button', { class: 'ptheme' + (M.lv ? ' m' + M.lv : ''), onclick: () => { puzCat = k; puzState = null; puzMode = 'solve'; beep('tap'); render(); } },
      h('span', { class: 'pt-ic' }, icon(PUZ_CAT_ICON[k] || 'puzzle', 20)), h('b', null, l),
      h('small', null, M.ok + M.bad ? `${M.ok} / ${M.pool} · ${Math.round(M.acc * 100)}%` : `${M.ok} / ${M.pool}`),
      h('span', { class: 'pt-medal ' + (PZ_MEDALS[M.lv] || 'none'), 'aria-label': M.lv ? `${PZ_MEDALS[M.lv]} mastery` : 'Not mastered yet' }, icon(M.lv ? 'medal' : 'star', 14)),
      h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(M.pct * 100) + '%' } })));
  })));
  // recent attempts
  const L = profile.puzLog;
  if (L.length) {
    main.append(h('div', { class: 'pz-secthead' }, h('h3', { class: 'sect' }, 'Recent puzzles'), h('button', { class: 'pz-more', onclick: () => { puzMode = 'history'; beep('tap'); render(); } }, 'See all', icon('next', 14))));
    main.append(h('div', { class: 'pz-hlist' }, L.slice(0, 4).map(pzHistoryRow)));
  }
}
function renderPuzzleSolve(main) {
  pzEnsure();
  if (!puzState) { const p = pickPuzzle(); if (!p) { puzMode = null; return render(); } puzState = { p, step: 0, failed: false, done: false, rated: !profile.tried[p.id] && puzCat !== 'review', mode: puzCat === 'review' ? 'review' : puzCat === 'rated' ? 'rated' : 'theme' }; }
  const ps = puzState, p = ps.p;
  const mode = ps.mode || (ps.title ? 'replay' : 'rated');
  const catName = ps.title || (puzCat === 'review' ? 'Review' : (puzCats().find(c => c[0] === puzCat) || [0, 'Puzzles'])[1]);
  const streakChip = pzFlame(profile.streak || 0);
  const autoBtn = h('button', { class: 'pz-auto' + (profile.puzAuto ? ' on' : ''), 'aria-pressed': String(!!profile.puzAuto), 'aria-label': 'Auto-next', onclick: () => { profile.puzAuto = !profile.puzAuto; saveProfile(); beep('toggle'); haptic(6); autoBtn.classList.toggle('on', !!profile.puzAuto); autoBtn.setAttribute('aria-pressed', String(!!profile.puzAuto)); if (profile.puzAuto && ps.done) scheduleNext(); } }, h('small', null, 'Auto'), h('i'));
  const backTo = () => { puzMode = ps.back || null; puzState = null; render(); };
  const F = focusScreen(main, { title: catName, sub: ps.rated ? `Rated · ${fmtR(profile.puzzle)}` : `Rating ${fmtR(profile.puzzle)}`, back: backTo, right: [autoBtn, streakChip] });
  const banner = pzBanner(p);
  const reviewLeft = puzCat === 'review' ? pzReviewDue().length : 0;
  const coach = pzCoach(mode === 'review' ? `You missed this one before. ${reviewLeft > 1 ? `${reviewLeft} to review.` : 'Last one!'}` : ps.rated ? 'Find the best move.' : 'Practice puzzle. No rating change.');
  const pb = new PuzzleBoard(p, {
    startStep: ps.step, speed: 650, wrongDelay: 900,
    onProgress: () => { ps.step = pb.step + 1; coach.say('Good move! Keep going…', 'good', 'happy'); beep('correct'); },
    onWrong: () => {
      beep('wrong'); haptic(25); const first = !ps.failed; ps.failed = true;
      const d = rate(false); if (first && !ps.logged) { ps.logged = true; pzLog(p, false, mode, d != null ? { d, r: Math.round(profile.puzzle.r) } : {}); }
      streakChip.querySelector('b').textContent = String(profile.streak || 0); streakChip.classList.remove('hot', 'blaze');
      coach.say(d !== null ? `Not that one. Rating ${d}. Try again!` : 'Not that one. Try again!', 'bad', 'sad');
    },
    onSolved: () => solved(),
  });
  F.above.append(banner); F.stage.append(pb.el); F.below.append(coach.el);
  // rating change: the number in the header counts to its new value and the change floats up
  function showDelta(before, d) {
    F.setTitle(catName, `Rating ${fmtR(profile.puzzle)}`);
    const sub = F.head.querySelector('.fs-title small');
    if (sub && d) { countUp(sub, before, Math.round(profile.puzzle.r), 900, v => `Rating ${v}`); fxPop(sub); fxFloat(coach.el, d > 0 ? `+${d}` : String(d), (d > 0 ? 'good' : 'bad') + ' big'); }
  }
  function rate(success) {
    if (!ps.rated) return null;
    ps.rated = false;
    const before = profile.puzzle.r;
    profile.puzzle = cappedGlicko(profile.puzzle, { r: p.rating, rd: 80 }, success ? 1 : 0, 30, 15);
    profile.pHist.push(Math.round(profile.puzzle.r)); if (profile.pHist.length > 300) profile.pHist.shift();
    profile.tried[p.id] = success ? 1 : 2;
    profile.streak = success ? profile.streak + 1 : 0; profile.best = Math.max(profile.best, profile.streak);
    saveProfile();
    const d = Math.round(profile.puzzle.r) - Math.round(before);
    showDelta(Math.round(before), d);
    return d;
  }
  function solved() {
    ps.done = true; ps.step = p.line.length; pb.board.burst('star'); haptic([8, 30, 8]);
    rewardEvent('puzzle', { solved: true, clean: !ps.failed });
    const d = ps.failed ? null : rate(true);
    if (!ps.logged) { ps.logged = true; pzLog(p, !ps.failed, mode, d != null ? { d, r: Math.round(profile.puzzle.r) } : {}); }
    streakChip.querySelector('b').textContent = String(profile.streak || 0);
    if (!ps.failed && profile.streak >= 2) { beep('combo', { n: Math.min(profile.streak, 12) }); streakChip.classList.toggle('hot', profile.streak >= 3); fxPop(streakChip); } else beep('win');
    const R = takeRewards(); if (R.xpGain) setTimeout(() => fxFloat(pb.el, `+${R.xpGain} XP`, 'xp'), d ? 450 : 0); rewardQueue.push(...[].concat(R.levels.map(l => ({ kind: 'level', lvl: l })), R.unlocks, R.achs.map(a => ({ kind: 'ach', a })), R.quests));
    if (!ps.failed && d === null && !profile.tried[p.id]) { profile.tried[p.id] = 1; saveProfile(); }
    ps.msg = d !== null ? `Puzzle rating ${Math.round(profile.puzzle.r)} (${d >= 0 ? '+' : ''}${d})` : (ps.failed ? 'Solved after a miss. It will come back for a retry.' : mode === 'review' ? 'Nailed it this time!' : 'Solved!');
    coach.say(ps.msg, 'good', 'cheer');
    doneView();
    if (profile.puzAuto) scheduleNext();
  }
  function doneView() {
    const themes = (p.themes || []).filter(t => THEME_NAMES[t] && t !== 'middlegame' && t !== 'endgame').map(t => THEME_NAMES[t]);
    if (ps.showedSolution) pzBannerSay(banner, '', 'bulb', "That's the solution", p.tip || (themes.length ? `Theme: ${themes.join(', ')}` : ''));
    else pzBannerSay(banner, 'good', 'check', 'Solved!', p.tip ? p.tip : themes.length ? `Theme: ${themes.join(', ')}.` : `${puzGoal(p)} · ${p.rating}`);
    buttons();
  }
  let autoT = 0;
  function scheduleNext() {
    clearTimeout(autoT); coach.say('Next puzzle coming up…', 'good');
    autoT = setTimeout(() => { if (puzState === ps && puzMode === 'solve' && profile.puzAuto) { puzState = null; render(); } }, 1800);
  }
  cleanups.push(() => clearTimeout(autoT));
  const nextPuzzle = () => { if (ps.back) return backTo(); puzState = null; render(); };
  function buttons() {
    if (ps.done) {
      F.setActions([
        { ic: 'repeat', label: 'Retry', on: () => { clearTimeout(autoT); puzState = Object.assign({}, ps, { step: 0, failed: false, done: false, rated: false, logged: true, showedSolution: false, mode: ps.mode === 'review' ? 'review' : 'replay' }); render(); } },
        { ic: 'search', label: 'Analyze', on: () => { clearTimeout(autoT); openAnalysis({ fen: p.fen, moves: p.line, ply: 0 }); } },
        { ic: 'next', label: ps.back ? 'Done' : 'Next puzzle', primary: true, on: () => { clearTimeout(autoT); nextPuzzle(); } }]);
      return;
    }
    F.setActions([
      { ic: 'bulb', label: 'Hint', on: () => { const r = pb.hint(); if (!r) return; beep('hint'); let d = null; if (ps.rated) { ps.failed = true; d = rate(false); if (!ps.logged) { ps.logged = true; pzLog(p, false, mode, { d, r: Math.round(profile.puzzle.r) }); } } else ps.failed = true; coach.say(d != null ? `${r.text} (rating ${d})` : r.text, '', 'think'); } },
      { ic: 'eye', label: 'Solution', on: () => { if (pb.done || pb.busy) return; rate(false); if (!ps.logged) { ps.logged = true; pzLog(p, false, mode); } ps.failed = true; ps.done = true; ps.showedSolution = true; coach.say('Watch the solution.', '', 'talk'); F.setActions([]); pb.playSolution().then(() => { ps.step = p.line.length; doneView(); coach.say(mode === 'review' ? 'It will come back for another try.' : 'This one will come back for a retry later.', '', 'talk'); }); } },
      { ic: 'next', label: 'Skip', on: () => { puzState = null; render(); } }]);
  }
  if (ps.done) { coach.say(ps.msg || 'Solved!', 'good'); doneView(); } else buttons();
}
