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
  const F = focusScreen(main, { title: 'Daily Puzzle', sub: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), back: () => { puzMode = null; render(); },
    right: [h('div', { class: 'streak-chip' + (d.streak >= 3 ? ' hot' : '') }, icon('flame', 16), h('b', null, String(d.streak)))] });
  const banner = h('div', { class: 'banner' }, h('span', { class: 'tomove', style: { background: side === 'White' ? '#fff' : '#222' } }), h('span', null, `${side} to move: `, h('b', null, goal)));
  const msg = h('div', { class: 'fs-msg' });
  const pb = new PuzzleBoard(p, {
    onSolved: clean => {
      pb.board.burst('star'); haptic([8, 30, 8]); markDaily(clean); rewardEvent('daily'); const st = dailyState();
      msg.className = 'fs-msg good'; msg.textContent = st.streak === 1 ? 'Solved! Daily streak: 1 day.' : `Solved! Daily streak: ${st.streak} days.`;
      setTimeout(() => presentResults({ mood: 'cheer', title: 'Daily solved!', subtitle: st.streak === 1 ? 'Daily streak: 1 day' : `Daily streak: ${st.streak} days`, stars: clean ? 3 : 2, stats: [{ label: 'Streak', value: st.streak }, { label: 'Best', value: st.best }], buttons: [{ label: 'Puzzle Den', on: () => { puzMode = null; render(); } }, { label: 'More puzzles', primary: true, on: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; render(); } }] }), 700);
      F.setActions([{ ic: 'next', label: 'More puzzles', primary: true, on: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; render(); } }]);
    },
    onWrong: () => { msg.className = 'fs-msg bad'; msg.textContent = 'Not that one. Try again!'; beep('wrong'); haptic(25); },
    onProgress: () => { msg.className = 'fs-msg good'; msg.textContent = 'Good move! Keep going…'; beep('correct'); },
  });
  F.above.append(banner); F.stage.append(pb.el); F.below.append(msg);
  if (status) msg.textContent = status === 1 ? "You already solved today's puzzle. Play it again for fun!" : "You finished today's puzzle.";
  F.setActions([{ ic: 'bulb', label: 'Hint', on: () => { beep('hint'); pb.hint(); } }, { ic: 'eye', label: 'Solution', on: () => { markDaily(false); pb.playSolution(); } }]);
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
function rushStart(mode) { rush = { phase: 'play', mode, queue: rushQueue(), i: 0, score: 0, strikes: 0, start: Date.now(), limit: mode === '3min' ? 180000 : mode === '5min' ? 300000 : 0, log: [] }; render(); }
function renderRush(main) {
  if (!rush || rush.phase === 'menu') {
    main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { puzMode = null; rush = null; render(); } }, icon('back', 18), 'Puzzles'), h('h2', { class: 'grow' }, 'Puzzle Rush')));
    main.append(h('div', { class: 'rush-hero' }, icon('bolt', 40), h('p', null, 'Solve as many puzzles as you can. They start easy and get harder. Three wrong answers and the run is over.')));
    main.append(h('div', { class: 'rush-modes' }, [['3min', '3 minutes', 'Race the clock', 'clock'], ['5min', '5 minutes', 'A little more time', 'hourglass'], ['survival', 'Survival', 'No clock, three strikes', 'shield']].map(([mode, title, desc, ic]) =>
      h('button', { class: 'rmode', onclick: () => { beep('start'); haptic(12); rushStart(mode); } }, icon(ic, 28), h('b', null, title), h('small', null, desc), h('span', { class: 'pill' }, 'Best ' + rushBest(mode))))));
    return;
  }
  if (rush.phase === 'over') {
    const best = rushBest(rush.mode), isBest = rush.score > best;
    if (isBest) { profile.rushBest[rush.mode] = rush.score; saveProfile(); }
    if (!rush.rewarded) { rush.rewarded = true; rewardEvent('rush', { score: rush.score }); }
    rush.phase = 'menu'; rush.lastMode = rush.mode;
    presentResults({ mood: isBest ? 'cheer' : rush.score >= 8 ? 'happy' : 'talk', title: isBest ? 'New best!' : `Score ${rush.score}`, subtitle: 'Puzzle Rush', stats: [{ label: 'Score', value: rush.score }, { label: 'Best', value: Math.max(best, rush.score) }, { label: 'Top puzzle', value: Math.max(0, ...rush.log.filter(x => x.ok).map(x => x.rating)) }],
      buttons: [{ label: 'Modes', on: () => render() }, { label: 'Play again', primary: true, on: () => rushStart(rush.lastMode) }] });
    return renderRush(main);
  }
  const p = rush.queue[rush.i];
  if (!p) { rush.phase = 'over'; render(); return; }
  const { side, goal } = puzzlePrompt(p);
  const timer = h('div', { class: 'clock on' });
  const strikes = h('div', { class: 'strikes' }, [0, 1, 2].map(k => icon('x', 18, k < rush.strikes ? 'hit' : '')));
  const F = focusScreen(main, { title: 'Puzzle Rush', sub: { '3min': '3 minutes', '5min': '5 minutes', survival: 'Survival' }[rush.mode], back: () => confirmBox('End this run?', 'Your score so far still counts.', 'End run', () => { rush.phase = 'over'; render(); }), right: [rush.limit ? timer : null].filter(Boolean) });
  const scoreEl = h('div', { class: 'rush-score' }, h('small', null, 'Score'), h('b', null, String(rush.score)));
  F.above.append(h('div', { class: 'rush-bar' }, scoreEl, strikes), h('div', { class: 'banner' }, h('span', { class: 'tomove', style: { background: side === 'White' ? '#fff' : '#222' } }), h('span', null, `${side} to move: `, h('b', null, goal))));
  const next = ok => {
    rush.log.push({ rating: p.rating, ok });
    if (ok) { rush.score++; beep('combo', { n: Math.min(rush.score, 12) }); if (typeof fxPop === 'function') fxPop(scoreEl); scoreEl.querySelector('b').textContent = String(rush.score); } else { rush.strikes++; beep('wrong'); haptic(30); if (typeof fxShake === 'function') fxShake(strikes); }
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

// ======================= PUZZLE DEN (hub and rated solving) =======================
let puzCat = 'rated', puzState = null, puzMode = null;
function pickPuzzle() {
  const pool = PUZZLES.filter(p => puzCat === 'rated' ? true : puzCat === 'pattern' ? p.cat === 'pattern' : puzCat.startsWith('t:') ? (p.themes || []).includes(puzCat.slice(2)) : p.n === +puzCat.slice(-1) && p.cat !== 'pattern' && p.cat !== 'tactic');
  const fresh = pool.filter(p => !profile.tried[p.id]);
  if (puzCat === 'pattern' && fresh.length) return fresh[0]; // learn the famous mates in order, easiest first
  const use = (fresh.length ? fresh : pool).slice();
  const pr = profile.puzzle.r;
  use.sort((a, b) => Math.abs(a.rating - pr) - Math.abs(b.rating - pr));
  const top = use.slice(0, Math.min(6, use.length));
  return top[Math.floor(rand() * top.length)];
}
const PUZ_CAT_ICON = { rated: 'target', m1: 'crown', m2: 'crown', m3: 'crown', pattern: 'book', 't:fork': 'fork', 't:pin': 'pin', 't:skewer': 'skewer', 't:discoveredAttack': 'eye', 't:hangingPiece': 'alert', 't:trappedPiece': 'key', 't:sacrifice': 'flame', 't:endgame': 'castle', 't:middlegame': 'sword', 't:backRank': 'shield', 't:deflection': 'route', 't:promotion': 'arrowUp', 't:doubleCheck': 'bolt' };
function puzCats() {
  const themeCounts = {}; PUZZLES.forEach(p => (p.themes || []).forEach(t => themeCounts[t] = (themeCounts[t] || 0) + 1));
  return [['rated', 'For you'], ['m1', 'Mate in 1'], ['m2', 'Mate in 2'], ['m3', 'Mate in 3'], ['pattern', 'Famous mates']]
    .concat(Object.keys(THEME_NAMES).filter(t => (themeCounts[t] || 0) >= 8).map(t => ['t:' + t, THEME_NAMES[t]]));
}
function puzPool(cat) { return PUZZLES.filter(p => cat === 'rated' ? true : cat === 'pattern' ? p.cat === 'pattern' : cat.startsWith('t:') ? (p.themes || []).includes(cat.slice(2)) : p.n === +cat.slice(-1) && p.cat !== 'pattern' && p.cat !== 'tactic'); }
function renderPuzzles(main) {
  if (puzMode === 'daily') return renderDaily(main);
  if (puzMode === 'rush') return renderRush(main);
  if (puzMode === 'solve') return renderPuzzleSolve(main);
  const dState = dailyState(), dDone = dState.history[todayKey()];
  const solvedCount = Object.values(profile.tried).filter(x => x === 1).length;
  main.append(stageBanner('den', 'Puzzle Den', `${solvedCount} of ${PUZZLES.length} solved`));
  // your rating and the big button
  main.append(h('button', { class: 'puz-hero', onclick: () => { puzCat = 'rated'; puzState = null; puzMode = 'solve'; haptic(10); beep('confirm'); render(); } },
    h('div', { class: 'ph-l' }, h('small', null, 'Puzzle rating'), h('b', { class: 'ph-r' }, fmtR(profile.puzzle)), h('small', null, profile.streak ? `Streak ${profile.streak}, best ${profile.best}` : `Best streak ${profile.best}`)),
    h('div', { class: 'ph-go' }, icon('play', 26), h('span', null, 'Solve'))));
  const week = h('div', { class: 'week' }); for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const k = d.toISOString().slice(0, 10); const v = dState.history[k]; week.append(h('i', { class: v === 1 ? 'ok' : v ? 'meh' : i === 0 ? 'today' : '' })); }
  main.append(h('div', { class: 'puz-modes' },
    h('button', { class: 'pmode daily' + (dDone ? '' : ' hot'), onclick: () => { puzMode = 'daily'; beep('confirm'); render(); } }, icon('calendar', 26), h('b', null, 'Daily'), h('small', null, dDone ? 'Done for today' : 'New puzzle ready'), week),
    h('button', { class: 'pmode rush', onclick: () => { puzMode = 'rush'; rush = { phase: 'menu' }; beep('confirm'); render(); } }, icon('bolt', 26), h('b', null, 'Rush'), h('small', null, `Best ${Math.max(0, ...Object.values(profile.rushBest || { a: 0 }))}`), h('span', { class: 'pm-sub' }, 'Beat the clock'))));
  main.append(h('h3', { class: 'sect' }, 'Practice by theme'));
  main.append(h('div', { class: 'puz-themes' }, puzCats().filter(([k]) => k !== 'rated').map(([k, l]) => { const pool = puzPool(k), done = pool.filter(p => profile.tried[p.id] === 1).length;
    return h('button', { class: 'ptheme', onclick: () => { puzCat = k; puzState = null; puzMode = 'solve'; beep('tap'); render(); } }, h('span', { class: 'pt-ic' }, icon(PUZ_CAT_ICON[k] || 'puzzle', 20)), h('b', null, l), h('small', null, `${done} / ${pool.length}`), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(done / pool.length * 100) + '%' } }))); })));
}
function renderPuzzleSolve(main) {
  const catName = (puzCats().find(c => c[0] === puzCat) || [0, 'Puzzles'])[1];
  const streakChip = h('div', { class: 'streak-chip' + (profile.streak >= 3 ? ' hot' : '') }, icon('flame', 16), h('b', null, String(profile.streak || 0)));
  const F = focusScreen(main, { title: catName, sub: `Puzzle rating ${fmtR(profile.puzzle)}`, back: () => { puzMode = null; puzState = null; render(); }, right: [streakChip] });
  if (!puzState) { const p = pickPuzzle(); puzState = { p, step: 0, failed: false, done: false, rated: !profile.tried[p.id] }; }
  const ps = puzState, p = ps.p;
  const g = new Game(p.fen);
  for (let i = 0; i < ps.step; i++) g.play(p.line[i]);
  const side = new E.Position(p.fen).turn === 0 ? 'w' : 'b';
  const banner = h('div', { class: 'banner' });
  const setBanner = (cls, html) => { banner.className = 'banner ' + (cls || ''); banner.innerHTML = tr(html); };
  const prompt = () => `<span class="tomove" style="background:${side === 'w' ? '#fff' : '#222'}"></span><span>${side === 'w' ? 'White' : 'Black'} to move: <b>${puzzlePrompt(p).goal}</b>${p.name ? ' · ' + p.name : ''}</span><span class="grow"></span><span class="pill">${p.rating}</span>`;
  setBanner('', prompt());
  let busy = false;
  const board = new BoardView({
    orient: side,
    getTargets: sq => (!ps.done && !busy && g.turn() === side) ? g.targetsFrom(sq) : null,
    onMove: (from, to, dragged) => {
      const needs = g.needsPromo(from, to);
      const uci = sqName(from) + sqName(to) + (needs ? 'q' : '');
      attempt(uci, dragged);
    }
  });
  F.above.append(banner); F.stage.append(board.el);
  const msg = h('div', { class: 'fs-msg' }); F.below.append(msg);
  const show = (anim) => board.set(g.viewState(), anim);
  show();
  function rate(success) {
    if (!ps.rated) return null;
    ps.rated = false;
    const before = profile.puzzle.r;
    profile.puzzle = cappedGlicko(profile.puzzle, { r: p.rating, rd: 80 }, success ? 1 : 0, 30, 15);
    profile.pHist.push(Math.round(profile.puzzle.r)); if (profile.pHist.length > 300) profile.pHist.shift();
    profile.tried[p.id] = success ? 1 : 2;
    profile.streak = success ? profile.streak + 1 : 0; profile.best = Math.max(profile.best, profile.streak);
    saveProfile();
    return Math.round(profile.puzzle.r) - Math.round(before);
  }
  function attempt(uci, dragged) {
    const expected = p.line[ps.step];
    const isLast = ps.step === p.line.length - 1;
    const test = new Game(g.startFen, g.moves); const r = test.play(uci);
    const mates = r && test.status().reason === 'checkmate';
    if (uci === expected || (isLast && mates)) {
      const res = g.play(uci); playSound(res); show(dragged ? null : g.lastFromTo);
      ps.step++;
      if (ps.step >= p.line.length) return solved();
      msg.className = 'fs-msg good'; msg.textContent = 'Good move! Keep going…'; beep('correct');
      busy = true;
      setTimeout(() => { const rr = g.play(p.line[ps.step]); ps.step++; playSound(rr); show(g.lastFromTo); busy = false; msg.textContent = 'Your move'; }, 650);
    } else {
      // wrong: show briefly then reset
      if (r) { const tmp = new Game(g.startFen, g.moves); tmp.play(uci); board.set(tmp.viewState(), dragged ? null : tmp.lastFromTo); }
      beep('wrong'); haptic(25); ps.failed = true;
      const d = rate(false); streakChip.querySelector('b').textContent = String(profile.streak || 0); streakChip.classList.remove('hot');
      msg.className = 'fs-msg bad'; msg.textContent = 'Not that one.' + (d !== null ? ` Rating ${d}` : '') + ' Try again!';
      busy = true; setTimeout(() => { busy = false; show(); }, 900);
      buttons();
    }
  }
  function solved() {
    ps.done = true; board.burst('star'); haptic([8, 30, 8]);
    rewardEvent('puzzle', { solved: true, clean: !ps.failed });
    const d = ps.failed ? null : rate(true);
    streakChip.querySelector('b').textContent = String(profile.streak || 0);
    if (!ps.failed && profile.streak >= 2) { beep('combo', { n: Math.min(profile.streak, 12) }); streakChip.classList.add('hot'); if (typeof fxPop === 'function') fxPop(streakChip); } else beep('win');
    const R = takeRewards(); if (R.xpGain && typeof fxFloat === 'function') fxFloat(board.el, `+${R.xpGain} XP`); rewardQueue.push(...[].concat(R.levels.map(l => ({ kind: 'level', lvl: l })), R.unlocks, R.achs.map(a => ({ kind: 'ach', a })), R.quests));
    if (!ps.failed && d === null && !profile.tried[p.id]) { profile.tried[p.id] = 1; saveProfile(); }
    setBanner('good', `${iconSvgInline('check')}<span><b>Solved!</b> ${p.tip ? p.tip : (p.themes && p.themes.length ? 'Theme: ' + p.themes.filter(t => THEME_NAMES[t] && t !== 'middlegame' && t !== 'endgame').map(t => THEME_NAMES[t]).join(', ') + '.' : '')}</span>`);
    msg.className = 'fs-msg good'; msg.textContent = d !== null ? `Puzzle rating ${Math.round(profile.puzzle.r)} (${d >= 0 ? '+' : ''}${d})` : (ps.failed ? 'Solved after a miss. No rating change.' : 'Solved!');
    buttons();
  }
  function buttons() {
    F.setActions([
      !ps.done ? { ic: 'bulb', label: 'Hint', on: () => { const exp = p.line[ps.step]; const marks = {}; marks[sqFromName(exp.slice(0, 2))] = 'hint'; board.set(Object.assign(g.viewState(), { marks })); beep('hint'); if (ps.rated) { const d = rate(false); ps.failed = true; msg.className = 'fs-msg bad'; msg.textContent = `Hint used (${d})`; } } } : null,
      !ps.done ? { ic: 'eye', label: 'Solution', on: () => { rate(false); ps.failed = true; ps.done = true; showSolution(); } } : null,
      { ic: 'next', label: ps.done ? 'Next puzzle' : 'Skip', primary: ps.done, on: () => { puzState = null; render(); } }]);
  }
  async function showSolution() {
    buttons(); busy = true;
    for (let i = ps.step; i < p.line.length; i++) { await new Promise(r => setTimeout(r, 700)); const rr = g.play(p.line[i]); playSound(rr); show(g.lastFromTo); }
    setBanner('', `${iconSvgInline('bulb')}<span>That's the solution${p.tip ? ': ' + p.tip : '.'}</span>`);
    msg.textContent = '';
  }
  buttons();
}

