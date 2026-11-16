'use strict';
const E = ChessEngineFactory();
const $ = (s, el = document) => el.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const sqName = E.sqName, sqFromName = E.sqFromName;
const rand = () => Math.random();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ======================= PIECE ART (original SVG) =======================
const PIECE_SVG = {
  p: '<path d="M22.5 9.5a5 5 0 0 0-3.2 8.85A6.8 6.8 0 0 0 15.8 24.5c0 2.3 1.1 4.3 2.8 5.6C15 31.6 12 35 12 39.5h21c0-4.5-3-7.9-6.6-9.4 1.7-1.3 2.8-3.3 2.8-5.6a6.8 6.8 0 0 0-3.5-6.15A5 5 0 0 0 22.5 9.5z"/>',
  r: '<path d="M11 39.5h23V36H11z"/><path d="M13.5 36l1.5-4.5h15l1.5 4.5z"/><path d="M15 31.5l.8-13h13.4l.8 13z"/><path d="M13 18.5l2.5-3h14l2.5 3z"/><path d="M12.5 15.5V9.5h4V12h4V9.5h4V12h4V9.5h4v6z"/>',
  b: '<path d="M11 39.5c1.5-3 6-4.5 11.5-4.5S32.5 36.5 34 39.5z"/><path d="M16.5 35l1-4h10l1 4z"/><path d="M22.5 11.5c-5 3.5-8.5 8.5-8.5 13.5 0 3.5 2.5 6 8.5 6s8.5-2.5 8.5-6c0-5-3.5-10-8.5-13.5z"/><circle cx="22.5" cy="9" r="2.6"/><path d="M25.5 17.5l-5.5 6" fill="none"/>',
  q: '<path d="M11.5 39.5h22V36h-22z"/><path d="M13 36c.5-2 .5-3.5 0-5.5h19c-.5 2-.5 3.5 0 5.5z"/><path d="M13 30.5L9 15l6 8.5.5-11 4.5 10 2.5-11.5 2.5 11.5 4.5-10 .5 11 6-8.5-4 15.5z"/><circle cx="9" cy="13.2" r="2"/><circle cx="15.5" cy="10.7" r="2"/><circle cx="22.5" cy="9.2" r="2"/><circle cx="29.5" cy="10.7" r="2"/><circle cx="36" cy="13.2" r="2"/>',
  k: '<path d="M22.5 5.5v7M19 9h7" fill="none"/><path d="M11.5 39.5h22V36h-22z"/><path d="M13 36c0-2 0-3.5-.5-5h20c-.5 1.5-.5 3-.5 5z"/><path d="M12.5 31c-3-3-4-7-1.5-10 3-3.5 8-2 11.5 2.5 3.5-4.5 8.5-6 11.5-2.5 2.5 3 1.5 7-1.5 10z"/><path d="M22.5 23.5c-1.5-3-2.5-5-2.5-6.5a2.5 2.5 0 0 1 5 0c0 1.5-1 3.5-2.5 6.5z"/>',
  n: '<path d="M11 39.5h23v-3H11z"/><path d="M13 36.5h19C33 31 34 24 31 18c-1-2.5-2-4-3-5V7.5l-3.5 3.5C21 10.5 17 12 14 15c-2 2.5-3.5 5-4.5 8-.2 1.7 1.1 3.2 2.8 3 1.7-.2 3.7-1.2 6.2-2.5 1 2.5-2.5 5.5-4 8-1.1 2-1.5 3-1.5 5z"/><circle cx="19.5" cy="16.5" r="1.3" class="eye"/>',
};
const PIECE_URL = {};
for (const c of ['w', 'b']) for (const t in PIECE_SVG) {
  const fill = c === 'w' ? '#fffdf6' : '#2b2730', stroke = c === 'w' ? '#272320' : '#f4ecdc';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${PIECE_SVG[t].replace('class="eye"', `fill="${stroke}" stroke="none"`)}</g></svg>`;
  PIECE_URL[c + t] = 'data:image/svg+xml;base64,' + btoa(svg);
}
const pieceKey = p => ((p & 8) ? 'b' : 'w') + ' pnbrqk'[p & 7];
const pieceUrl = p => PIECE_URL[pieceKey(p)];

// ======================= SOUND =======================
let audioCtx = null, soundOn = true;
function beep(kind) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const cfg = { move: [520, .05, 'triangle'], capture: [300, .09, 'square'], check: [880, .12, 'sine'], win: [660, .35, 'sine'], bad: [180, .2, 'sawtooth'], star: [990, .1, 'sine'] }[kind] || [500, .05, 'sine'];
    o.type = cfg[2]; o.frequency.setValueAtTime(cfg[0], t);
    if (kind === 'win') o.frequency.linearRampToValueAtTime(cfg[0] * 1.5, t + .3);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + cfg[1] + .05);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + cfg[1] + .06);
  } catch (e) { }
}

// ======================= UI HELPERS =======================
function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg); document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
function modal(build, { dismiss = true } = {}) {
  const bg = h('div', { class: 'modal-bg' });
  const box = h('div', { class: 'modal' });
  box.append = (...a) => Element.prototype.append.apply(box, a.filter(x => x != null && x !== false));
  bg.append(box); document.body.append(bg);
  const close = () => bg.remove();
  if (dismiss) bg.addEventListener('click', e => { if (e.target === bg) close(); });
  build(box, close);
  return close;
}
function confirmBox(title, text, okLabel, onOk) {
  modal((box, close) => box.append(
    h('h2', null, title), h('p', { class: 'muted' }, text),
    h('div', { class: 'row', style: { marginTop: '14px' } },
      h('button', { class: 'btn grow', onclick: close }, 'Cancel'),
      h('button', { class: 'btn primary grow', onclick: () => { close(); onOk(); } }, okLabel))));
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied!'); return true; }
  catch (e) {
    modal((box, close) => box.append(h('h2', null, 'Copy this'), h('textarea', { class: 'input', style: { height: '110px' }, readonly: true }, text), h('button', { class: 'btn block', style: { marginTop: '10px' }, onclick: close }, 'Done')));
    return false;
  }
}

// ======================= BOARD VIEW =======================
class BoardView {
  constructor(opts = {}) {
    this.opts = opts;
    this.orient = opts.orient || 'w';
    this.el = h('div', { class: 'board-wrap' });
    this.boardEl = h('div', { class: 'board' });
    this.layer = h('div', { class: 'pieces' });
    this.fx = h('div', { class: 'fx' });
    this.el.append(this.boardEl, this.layer, this.fx);
    this.sqEls = {};
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const s = r * 16 + f;
      const el = h('div', { class: 'sq ' + ((r + f) % 2 ? 'l' : 'd') });
      this.sqEls[s] = el; this.boardEl.append(el);
    }
    this.board = new Int8Array(128);
    this.sel = -1; this.targets = []; this.marks = {};
    this.pieceEls = {};
    this.layout();
    this.el.addEventListener('pointerdown', e => this.down(e));
    this.el.addEventListener('pointermove', e => this.move(e));
    this.el.addEventListener('pointerup', e => this.up(e));
    this.el.addEventListener('pointercancel', () => { this.drag = null; this.draw(); });
  }
  pos(s) { const f = s & 7, r = s >> 4; return this.orient === 'w' ? [f, 7 - r] : [7 - f, r]; }
  layout() {
    for (const s in this.sqEls) {
      const [x, y] = this.pos(+s), el = this.sqEls[s];
      el.style.left = x * 12.5 + '%'; el.style.top = y * 12.5 + '%';
      el.querySelectorAll('.co').forEach(c => c.remove());
      if (y === 7) el.append(h('span', { class: 'co f' }, 'abcdefgh'[+s & 7]));
      if (x === 0) el.append(h('span', { class: 'co r' }, String((+s >> 4) + 1)));
    }
  }
  flip() { this.orient = this.orient === 'w' ? 'b' : 'w'; this.layout(); this.draw(); }
  setOrient(o) { if (o !== this.orient) { this.orient = o; this.layout(); this.draw(); } }
  // state: {board:Int8Array, last:[from,to], check:sq, stars:Set, marks:{sq:cls}}
  set(state, animate) {
    if (state.board) this.board = Int8Array.from(state.board);
    this.last = state.last || null; this.check = state.check ?? -1;
    this.stars = state.stars || null; this.marks = state.marks || {};
    this.sel = -1; this.targets = [];
    this.draw(animate);
  }
  sqAt(e) {
    const r = this.el.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return this.orient === 'w' ? (7 - y) * 16 + x : y * 16 + (7 - x);
  }
  draw(animate) {
    for (const s in this.sqEls) {
      const el = this.sqEls[s], sq = +s;
      el.classList.toggle('last', !!this.last && (this.last[0] === sq || this.last[1] === sq));
      el.classList.toggle('sel', this.sel === sq);
      el.classList.toggle('check', this.check === sq);
      el.classList.remove('hint', 'mark');
      if (this.marks[sq]) el.classList.add(this.marks[sq]);
      el.querySelectorAll('.dot,.ring,.star').forEach(c => c.remove());
      if (this.targets.includes(sq)) el.append(h('div', { class: this.board[sq] ? 'ring' : 'dot' }));
      if (this.stars && this.stars.has(sq)) el.append(h('div', { class: 'star' }, icon('star', 34)));
    }
    this.layer.innerHTML = ''; this.pieceEls = {};
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = this.board[s]; if (!p) continue;
      const el = h('div', { class: 'piece' });
      el.style.backgroundImage = `url(${pieceUrl(p)})`;
      let [x, y] = this.pos(s);
      if (animate && animate[1] === s) {
        const [fx, fy] = this.pos(animate[0]);
        el.classList.add('noanim'); el.style.left = fx * 12.5 + '%'; el.style.top = fy * 12.5 + '%';
        requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.remove('noanim'); el.style.left = x * 12.5 + '%'; el.style.top = y * 12.5 + '%'; }));
      } else { el.style.left = x * 12.5 + '%'; el.style.top = y * 12.5 + '%'; }
      this.layer.append(el); this.pieceEls[s] = el;
    }
  }
  select(sq, targets) { this.sel = sq; this.targets = targets; this.draw(); }
  clearSel() { if (this.sel >= 0 || this.targets.length) { this.sel = -1; this.targets = []; this.draw(); } }
  down(e) {
    const sq = this.sqAt(e); if (sq < 0) return;
    if (this.sel >= 0 && this.targets.includes(sq)) { this.commit(this.sel, sq, false); return; }
    const t = this.opts.getTargets ? this.opts.getTargets(sq) : null;
    if (t && t.length) {
      this.select(sq, t);
      const el = this.pieceEls[sq];
      if (el) {
        this.drag = { sq, el, x: e.clientX, y: e.clientY, moved: false };
        try { this.el.setPointerCapture(e.pointerId); } catch (_) { }
      }
    } else if (t) { this.select(sq, []); }
    else this.clearSel();
  }
  move(e) {
    const d = this.drag; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.moved = true;
    const r = this.el.getBoundingClientRect(), w = r.width / 8;
    d.el.classList.add('drag');
    d.el.style.left = (e.clientX - r.left - w / 2) + 'px'; d.el.style.top = (e.clientY - r.top - w / 2) + 'px';
  }
  up(e) {
    const d = this.drag; this.drag = null;
    if (!d || !d.moved) return;
    const sq = this.sqAt(e);
    if (sq >= 0 && sq !== d.sq && this.targets.includes(sq)) this.commit(d.sq, sq, true);
    else { this.draw(); }
  }
  commit(from, to, dragged) {
    this.sel = -1; this.targets = [];
    if (this.opts.onMove) this.opts.onMove(from, to, dragged);
  }
  burst(name) {
    const b = h('div', { class: 'burst' }, icon(name || 'star', 90, 'burst-ic ' + (name || 'star'))); this.fx.append(b); setTimeout(() => b.remove(), 800);
  }
}

// ======================= GAME MODEL =======================
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
class Game {
  constructor(fen = START_FEN, moves = []) { this.startFen = fen; this.moves = []; this.sans = []; this.pos = new E.Position(fen); this.lastFromTo = null; for (const u of moves) this.play(u); }
  legal() { return this.pos.legalMoves(); }
  play(uci) {
    const legal = this.legal(), m = this.pos.moveFromUci(uci, legal);
    if (!m) return null;
    const san = this.pos.san(m, legal);
    const cap = !!(E.mFlags(m) & E.F_CAP);
    this.pos.make(m); this.moves.push(uci); this.sans.push(san);
    this.lastFromTo = [E.mFrom(m), E.mTo(m)];
    return { san, cap, check: this.pos.inCheck(), m };
  }
  undo() { if (!this.moves.length) return; const mv = this.moves.slice(0, -1); const g = new Game(this.startFen, mv); Object.assign(this, g); }
  status() { return this.pos.status(); }
  turn() { return this.pos.turn === 0 ? 'w' : 'b'; }
  targetsFrom(sq) {
    const p = this.pos.board[sq];
    if (!p || ((p & 8) ? 1 : 0) !== this.pos.turn) return null;
    return [...new Set(this.legal().filter(m => E.mFrom(m) === sq).map(m => E.mTo(m)))];
  }
  needsPromo(from, to) { return this.legal().some(m => E.mFrom(m) === from && E.mTo(m) === to && E.mPromo(m)); }
  boardAt(ply) {
    const g = new Game(this.startFen, this.moves.slice(0, ply));
    return { board: g.pos.board, last: g.lastFromTo, check: g.pos.inCheck() ? g.pos.kings[g.pos.turn] : -1 };
  }
  viewState() { return { board: this.pos.board, last: this.lastFromTo, check: this.pos.inCheck() ? this.pos.kings[this.pos.turn] : -1 }; }
  pgnMoves() { let s = ''; this.sans.forEach((x, i) => { if (i % 2 === 0) s += (i / 2 + 1) + '. '; s += x + ' '; }); return s.trim(); }
}
function captured(board) {
  const start = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 }, cnt = [{}, {}];
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = board[s]; if (!p) continue; const c = (p & 8) ? 1 : 0, t = p & 7; cnt[c][t] = (cnt[c][t] || 0) + 1; }
  const val = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9 };
  const lost = [[], []]; let mat = [0, 0];
  for (const c of [0, 1]) for (const t of [5, 4, 3, 2, 1]) { const n = Math.max(0, start[t] - (cnt[c][t] || 0)); for (let i = 0; i < n; i++) lost[c].push(t | (c ? 8 : 0)); mat[c] += (cnt[c][t] || 0) * val[t]; }
  return { lostBy: lost, diff: mat[0] - mat[1] };
}

// ======================= ENGINE WORKER =======================
let worker = null, workerReqs = {}, workerId = 0;
function initWorker() {
  try {
    const src = `${ChessEngineFactory.toString()}\n${mulberry.toString()}\n${botChooseMove.toString()}\n
      const E = ChessEngineFactory(); const S = new E.Searcher();
      self.onmessage = e => { const d = e.data; let r;
        try { const pos = new E.Position(d.fen); for (const u of d.moves) pos.make(pos.moveFromUci(u));
          if (d.kind === 'bot') r = botChooseMove(E, S, pos, d.level, mulberry(d.seed), d.salt, d.ply, d.book);
          else { const s = S.search(pos, { maxNodes: d.nodes || 150000, maxDepth: d.depth || 64 }); r = { uci: s.move ? pos.uci(s.move) : null, score: s.score }; }
        } catch (err) { r = { error: String(err) }; }
        self.postMessage(Object.assign({ id: d.id }, r)); };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = e => { const cb = workerReqs[e.data.id]; delete workerReqs[e.data.id]; if (cb) cb(e.data); };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }
}
const mainSearcher = new E.Searcher();
function engineRequest(req) {
  return new Promise(res => {
    req.id = ++workerId;
    if (worker) { workerReqs[req.id] = res; worker.postMessage(req); return; }
    setTimeout(() => {
      const pos = new E.Position(req.fen); for (const u of req.moves) pos.make(pos.moveFromUci(u));
      if (req.kind === 'bot') res(botChooseMove(E, mainSearcher, pos, req.level, mulberry(req.seed), req.salt, req.ply, req.book));
      else { const s = mainSearcher.search(pos, { maxNodes: req.nodes || 100000 }); res({ uci: s.move ? pos.uci(s.move) : null, score: s.score }); }
    }, 30);
  });
}

// ======================= RATINGS (Glicko-2) =======================
function glicko2(pl, games) {
  const S = 173.7178, tau = 0.5;
  let mu = (pl.r - 1500) / S, phi = pl.rd / S; const sigma = pl.vol;
  const g = ph => 1 / Math.sqrt(1 + 3 * ph * ph / (Math.PI * Math.PI));
  let vInv = 0, dSum = 0;
  for (const gm of games) {
    const muj = (gm.r - 1500) / S, phj = gm.rd / S, gj = g(phj), Ej = 1 / (1 + Math.exp(-gj * (mu - muj)));
    vInv += gj * gj * Ej * (1 - Ej); dSum += gj * (gm.s - Ej);
  }
  const v = 1 / vInv, delta = v * dSum;
  const a = Math.log(sigma * sigma), eps = 1e-6;
  const f = x => { const ex = Math.exp(x); return ex * (delta * delta - phi * phi - v - ex) / (2 * Math.pow(phi * phi + v + ex, 2)) - (x - a) / (tau * tau); };
  let A = a, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * tau) < 0) k++; B = a - k * tau; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 60 && Math.abs(B - A) > eps; i++) {
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const sig2 = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + sig2 * sig2);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * dSum;
  return { r: Math.max(100, Math.round((muNew * S + 1500) * 10) / 10), rd: Math.max(45, Math.min(350, phiNew * S)), vol: sig2 };
}
// ---- Bot League ladder: Elo with small K so no game moves you more than 40 (placement) / 20 points ----
const LEAGUES = [[0, 'Pawn League', 'p'], [600, 'Knight League', 'n'], [900, 'Bishop League', 'b'], [1200, 'Rook League', 'r'], [1500, 'Queen League', 'q'], [1800, 'King League', 'k']];
const PLACEMENT_GAMES = 10;
function leagueOf(r) {
  let i = 0; LEAGUES.forEach((L, j) => { if (r >= L[0]) i = j; });
  const L = LEAGUES[i], next = LEAGUES[i + 1];
  return { i, name: L[1], piece: L[2], min: L[0], next: next ? next[0] : null, nextName: next ? next[1] : null, pct: next ? Math.max(0, Math.min(1, (r - L[0]) / (next[0] - L[0]))) : 1 };
}
const ladderK = lad => lad.games < PLACEMENT_GAMES ? 40 : 20;
function eloDelta(r, opp, score, K) { const e = 1 / (1 + Math.pow(10, (opp - r) / 400)); return Math.round(K * (score - e)); }
const leagueIcon = (r, size = 18) => h('img', { src: PIECE_URL['w' + leagueOf(r).piece], style: { width: size + 'px', height: size + 'px', verticalAlign: '-3px' } });
// Glicko-2 with a hard cap on how far one result can move you
function cappedGlicko(cur, opp, score, capProv, capEst) {
  const nr = glicko2(cur, [{ r: opp.r, rd: opp.rd, s: score }]);
  const cap = cur.rd > 110 ? capProv : capEst;
  nr.r = Math.max(cur.r - cap, Math.min(cur.r + cap, nr.r));
  nr.games = (cur.games || 0) + 1;
  return nr;
}
const BANDS = [[0, 'Beginner'], [600, 'Novice'], [1000, 'Intermediate'], [1400, 'Club player'], [1800, 'Expert'], [2200, 'Master level']];
const band = r => { let b = BANDS[0]; for (const x of BANDS) if (r >= x[0]) b = x; return b; };
const fmtR = rt => Math.round(rt.r) + (rt.rd > 110 ? '?' : '');

// ======================= PROFILE STORAGE =======================
const DEFAULT_PROFILE = () => ({ name: '', v: 2, ladder: { r: 800, games: 0, peak: 800 }, human: { r: 800, rd: 250, vol: 0.06, games: 0 }, puzzle: { r: 800, rd: 200, vol: 0.06, games: 0 }, games: [], rHist: [800], hHist: [800], pHist: [800], rated: {}, tried: {}, lessons: {}, current: null, sound: true, streak: 0, best: 0, updated: 0 });
let profile = DEFAULT_PROFILE();
function loadLocal() { try { const s = localStorage.getItem('kc-profile'); if (s) return JSON.parse(s); } catch (e) { } return null; }
function saveProfile() { profile.updated = Date.now(); try { localStorage.setItem('kc-profile', JSON.stringify(profile)); } catch (e) { } refreshChip(); }
function refreshChip() {
  const c = document.getElementById('rchip'); if (!c) return;
  c.innerHTML = ''; c.append(leagueIcon(profile.ladder.r), ' ' + profile.ladder.r, h('small', null, icon('puzzle', 14), ' ' + fmtR(profile.puzzle)));
}

// ======================= DATA =======================
const BOTS = BOT_LEVELS.map(b => Object.assign({}, b, { rating: CALIB.ratings[b.id] }));
const PUZZLES = PUZZLE_DATA.map((p, i) => Object.assign({ id: 'p' + i }, p));

// ======================= APP SHELL =======================
let route = 'play';
const appEl = () => $('#app');
const ROUTES = { play: renderPlay, friend: renderFriend, puzzles: renderPuzzles, learn: renderLearn, me: renderMe };
function go(r) { if (!ROUTES[r]) r = 'play'; route = r; try { if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r); } catch (e) { } render(); window.scrollTo(0, 0); }
let cleanups = [];
function cleanup() { cleanups.forEach(f => { try { f(); } catch (e) { } }); cleanups = []; }
function render() {
  cleanup();
  const app = appEl(); app.innerHTML = '';
  const logo = h('img', { src: PIECE_URL.wn, alt: '' });
  app.append(h('div', { class: 'topbar' },
    h('div', { class: 'logo' }, logo, 'Knight Club'),
    h('button', { class: 'chip', id: 'rchip', onclick: () => go('me') })));
  refreshChip();
  const main = h('div', { class: 'stack' }); app.append(main);
  ROUTES[route](main);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.r === route));
}
function buildTabs() {
  const items = [['play', 'play', 'Play'], ['friend', 'friends', 'Friends'], ['puzzles', 'puzzle', 'Puzzles'], ['learn', 'learn', 'Learn'], ['me', 'user', 'Me']];
  const inner = h('div', { class: 'inner' }, items.map(([r, ic, l]) => h('button', { 'data-r': r, onclick: () => go(r) }, icon(ic, 24), l)));
  document.body.append(h('nav', { class: 'tabs' }, inner));
}

// ======================= CLOCKS =======================
// A clock is a plain object so it can be saved and sent: {base, inc, w, b, running:'w'|'b'|null, since}
// Times are in ms. Clocks start once both sides have made their first move (like most chess sites).
const TIME_CONTROLS = [[0, 0, 'Untimed'], [60, 0, 'Bullet'], [180, 0, 'Blitz'], [180, 2, 'Blitz'], [300, 0, 'Blitz'], [600, 0, 'Rapid'], [600, 5, 'Rapid'], [900, 10, 'Rapid'], [1800, 0, 'Classical']];
const tcLabel = (base, inc) => base ? `${base / 60}+${inc}` : 'Untimed';
const tcKey = (base, inc) => base + '+' + inc;
function newClock(base, inc) { return base ? { base: base * 1000, inc: inc * 1000, w: base * 1000, b: base * 1000, running: null, since: 0 } : null; }
const clk = {
  rem(c, color) { let t = c[color]; if (c.running === color) t -= Date.now() - c.since; return Math.max(0, t); },
  // call right after `mover` has moved; plies = number of moves played so far
  press(c, mover, plies) {
    if (!c) return;
    if (c.running === mover) c[mover] = clk.rem(c, mover) + c.inc;
    c.running = null;
    if (plies >= 2) { c.running = mover === 'w' ? 'b' : 'w'; c.since = Date.now(); }
  },
  stop(c) { if (c && c.running) { c[c.running] = clk.rem(c, c.running); c.running = null; } },
  flagged(c) { return c && c.running && clk.rem(c, c.running) <= 0 ? c.running : null; },
  fmt(ms) {
    if (ms >= 3600000) { const hh = Math.floor(ms / 3600000); return hh + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0'); }
    const sec = Math.floor(ms / 1000);
    if (ms < 10000) return '0:0' + sec + '.' + Math.floor(ms / 100) % 10;
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  },
  // for sending over the network: freeze elapsed time into the message
  wire(c) { if (!c) return null; const o = Object.assign({}, c); if (c.running) o.elapsed = Date.now() - c.since; delete o.since; return o; },
  unwire(o) { if (!o) return null; const c = Object.assign({}, o); c.since = Date.now() - (o.elapsed || 0); delete c.elapsed; return c; },
};
// can `color` still deliver checkmate with its remaining material? (FIDE: flag vs lone king/minor = draw)
function canStillMate(pos, color) {
  let minors = 0; const side = color === 'w' ? 0 : 8;
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.board[s]; if (!p || (p & 8) !== side) continue; const t = p & 7; if (t === 1 || t === 4 || t === 5) return true; if (t === 2 || t === 3) minors++; }
  return minors >= 2;
}
function timeoutResult(pos, flagged) {
  const winner = flagged === 'w' ? 'b' : 'w';
  if (!canStillMate(pos, winner)) return { result: '1/2-1/2', reason: 'timeout vs. insufficient material' };
  return { result: winner === 'w' ? '1-0' : '0-1', reason: 'time' };
}
function tcPicker(sel, onChange) {
  const el = h('div', { class: 'tcs' });
  const draw = () => { el.innerHTML = ''; TIME_CONTROLS.forEach(([b, i, kind]) => { const k = tcKey(b, i); el.append(h('button', { class: sel.tc === k ? 'on' : '', onclick: () => { sel.tc = k; draw(); onChange && onChange(); } }, h('b', null, tcLabel(b, i)), b ? h('small', null, kind) : null)); }); };
  draw(); return el;
}
const parseTc = k => { const [b, i] = (k || '0+0').split('+').map(Number); return [b, i]; };

// ======================= GAME SCREEN (shared) =======================
// cfg: {game, bottom:{name,rating,avatar}, top:{...}, orient, canMove(color), onUserMove(uci), buttons:[...], onBoardReady}
function gameScreen(main, cfg) {
  const g = cfg.game;
  let viewPly = null; // null = live
  const board = new BoardView({
    orient: cfg.orient,
    getTargets: sq => (viewPly === null && cfg.canMove(g.turn())) ? g.targetsFrom(sq) : null,
    onMove: (from, to, dragged) => {
      if (g.needsPromo(from, to)) {
        modal((box, close) => {
          const c = g.turn();
          box.append(h('h2', null, 'Promote your pawn!'), h('p', { class: 'muted' }, 'Pick a new piece:'),
            h('div', { class: 'promo' }, ['q', 'r', 'b', 'n'].map(t => h('button', { style: { backgroundImage: `url(${PIECE_URL[c + t]})` }, onclick: () => { close(); cfg.onUserMove(sqName(from) + sqName(to) + t, dragged); } }))));
        }, { dismiss: true });
        board.draw();
        return;
      }
      cfg.onUserMove(sqName(from) + sqName(to), dragged);
    }
  });
  const bar = (who, colorIdx) => {
    const capEl = h('div', { class: 'caps' });
    const turnEl = h('div', { class: 'turnmark hidden' });
    const status = h('div', { class: 'thinking' });
    const clockEl = cfg.getClock ? h('div', { class: 'clock' }) : null;
    const el = h('div', { class: 'pbar' }, h('div', { class: 'avatar' }, avatar(who.avatar || 'you', 38)),
      h('div', { class: 'grow' }, h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'pname' }, who.name), h('span', { class: 'prating' }, who.rating ? '(' + who.rating + ')' : ''), turnEl), capEl), status, clockEl);
    return { el, capEl, turnEl, status, colorIdx, clockEl };
  };
  const bottomColor = cfg.orient === 'w' ? 0 : 1;
  const topBar = bar(cfg.players[bottomColor ? 'w' : 'b'], bottomColor ^ 1), botBar = bar(cfg.players[bottomColor ? 'b' : 'w'], bottomColor);
  const movesEl = h('div', { class: 'moves' });
  const navEl = h('div', { class: 'nav' },
    h('button', { class: 'btn sm', 'aria-label': 'First move', onclick: () => setView(0) }, icon('first', 20)),
    h('button', { class: 'btn sm', 'aria-label': 'Previous move', onclick: () => setView(Math.max(0, (viewPly ?? g.moves.length) - 1)) }, icon('prev', 20)),
    h('button', { class: 'btn sm', 'aria-label': 'Next move', onclick: () => setView((viewPly ?? g.moves.length) + 1) }, icon('next', 20)),
    h('button', { class: 'btn sm', 'aria-label': 'Last move', onclick: () => setView(null) }, icon('last', 20)));
  const ctrl = h('div', { class: 'controls' });
  main.append(h('div', null, topBar.el, board.el, botBar.el), movesEl, navEl, ctrl);
  function setView(p) { if (p !== null && p >= g.moves.length) p = null; viewPly = p; refresh(); }
  function refreshBars(boardArr) {
    const c = captured(boardArr);
    for (const b of [topBar, botBar]) {
      b.capEl.innerHTML = '';
      const theirs = c.lostBy[b.colorIdx ^ 1];
      theirs.forEach(p => b.capEl.append(h('img', { src: pieceUrl(p) })));
      const adv = b.colorIdx === 0 ? c.diff : -c.diff;
      if (adv > 0) b.capEl.append(h('b', null, '+' + adv));
      b.turnEl.classList.toggle('hidden', g.status().over || (g.pos.turn !== b.colorIdx));
    }
  }
  function refreshMoves() {
    movesEl.innerHTML = '';
    g.sans.forEach((s, i) => {
      if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.'));
      const cur = (viewPly === null ? g.moves.length : viewPly) === i + 1;
      movesEl.append(h('span', { class: 'm' + (cur ? ' cur' : ''), onclick: () => setView(i + 1) }, s));
    });
    if (!g.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Moves will appear here'));
    const cur = movesEl.querySelector('.cur'); if (cur) cur.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
  function refresh(animate) {
    const st = viewPly === null ? g.viewState() : g.boardAt(viewPly);
    board.set(st, viewPly === null ? animate : null);
    refreshBars(st.board); refreshMoves();
  }
  function setButtons(list) {
    ctrl.innerHTML = '';
    ctrl.style.gridTemplateColumns = `repeat(${list.length},1fr)`;
    for (const b of list) ctrl.append(h('button', { class: 'btn', onclick: b.on, disabled: b.disabled }, icon(b.ic, 22), b.label));
  }
  function tickClocks() {
    const c = cfg.getClock && cfg.getClock();
    for (const b of [topBar, botBar]) {
      if (!b.clockEl) continue;
      if (!c) { b.clockEl.classList.add('hidden'); continue; }
      const color = b.colorIdx ? 'b' : 'w', ms = clk.rem(c, color);
      b.clockEl.classList.remove('hidden');
      b.clockEl.textContent = clk.fmt(ms);
      b.clockEl.classList.toggle('on', c.running === color);
      b.clockEl.classList.toggle('low', ms < Math.min(20000, c.base * 0.1 + 5000));
    }
    if (cfg.onTick) cfg.onTick();
  }
  if (cfg.getClock) { const iv = setInterval(tickClocks, 100); cleanups.push(() => clearInterval(iv)); }
  refresh();
  tickClocks();
  return {
    board, refresh, setButtons, setView, tickClocks,
    setStatus(which, txt) { (which === 'top' ? topBar : botBar).status.textContent = txt || ''; },
    flip() {
      board.flip();
      const parent = board.el.parentNode, first = parent.firstChild, last = parent.lastChild;
      parent.insertBefore(last, board.el); parent.append(first);
      refresh();
    },
    get viewing() { return viewPly !== null; },
  };
}
function playSound(res) { if (!res) return; beep(res.check ? 'check' : res.cap ? 'capture' : 'move'); }

// ======================= PLAY VS BOT =======================
let playSel = { bot: 0, color: 'w', rated: true, tc: '0+0' };
function renderPlay(main) {
  if (profile.current && profile.current.mode === 'bot') return renderBotGame(main);
  const r = { r: profile.ladder.r };
  // suggest the bot closest to the player's rating
  if (playSel.bot === null || playSel.auto !== true) { let best = 0; BOTS.forEach((b, i) => { if (Math.abs(b.rating - r.r) < Math.abs(BOTS[best].rating - r.r)) best = i; }); playSel.bot = best; playSel.auto = true; }
  const grid = h('div', { class: 'bots' });
  const playBtn = h('button', { class: 'btn primary block', onclick: () => startBotGame() });
  const stakes = h('div', { class: 'small muted center' });
  const drawStakes = () => {
    const L = profile.ladder, K = ladderK(L), br = BOTS[playSel.bot].rating, f = d => (d >= 0 ? '+' : '') + d;
    stakes.textContent = playSel.rated ? `Win ${f(eloDelta(L.r, br, 1, K))} · Draw ${f(eloDelta(L.r, br, .5, K))} · Loss ${f(eloDelta(L.r, br, 0, K))}` + (L.games < PLACEMENT_GAMES ? `  (placement game ${L.games + 1}/${PLACEMENT_GAMES})` : '') : 'Casual: your rating will not change';
  };
  const drawGrid = () => { playBtn.innerHTML = ''; playBtn.append(icon('play', 18), 'Play ' + BOTS[playSel.bot].name); drawStakes(); grid.innerHTML = ''; BOTS.forEach((b, i) => grid.append(h('button', { class: 'bot' + (playSel.bot === i ? ' on' : ''), onclick: () => { playSel.bot = i; drawGrid(); } }, h('div', { class: 'av' }, avatar(b.avatar, 46)), h('div', { class: 'nm' }, b.name), h('div', { class: 'rt' }, icon('star', 14), ' ' + b.rating), h('div', { class: 'bl' }, b.blurb)))); };
  drawGrid();
  const seg = (opts, key) => { const el = h('div', { class: 'seg' }); const d = () => { el.innerHTML = ''; opts.forEach(([v, l]) => el.append(h('button', { class: playSel[key] === v ? 'on' : '', onclick: () => { playSel[key] = v; d(); drawStakes(); } }, l))); }; d(); return el; };
  main.append(
    h('div', null, h('h2', null, 'Choose your opponent'), h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, leagueIcon(r.r, 16), ` ${leagueOf(r.r).name} · ${r.r}. The highlighted bot is your best match.`)),
    grid,
    h('div', { class: 'card stack' },
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px', fontWeight: 800 } }, 'PLAY AS'), seg([['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]], 'color')),
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px', fontWeight: 800 } }, 'TIME'), tcPicker(playSel)),
      h('div', null, h('div', { class: 'small muted', style: { marginBottom: '6px', fontWeight: 800 } }, 'MODE'), seg([[true, [icon('trophy', 16), ' Rated']], [false, 'Casual (undo + hints)']], 'rated')),
      playBtn, stakes));
}
function startBotGame(botIdx = playSel.bot, color = playSel.color, rated = playSel.rated, tc = playSel.tc) {
  const c = color === 'r' ? (rand() < .5 ? 'w' : 'b') : color;
  const [tb, ti] = parseTc(tc);
  profile.current = { mode: 'bot', bot: botIdx, color: c, rated, tc, clock: newClock(tb, ti), moves: [], salt: Math.floor(rand() * 1e9), seed: Math.floor(rand() * 1e9), book: Math.floor(rand() * OPENINGS.length), result: null, hints: 0 };
  saveProfile(); go('play'); render();
}
function renderBotGame(main) {
  const cur = profile.current, bot = BOTS[cur.bot];
  const g = new Game(START_FEN, cur.moves);
  let thinking = false, alive = true;
  cleanups.push(() => { alive = false; });
  const you = { name: profile.name || 'You', rating: profile.ladder.r, avatar: 'you' };
  const them = { name: bot.name, rating: bot.rating, avatar: bot.avatar };
  const scr = gameScreen(main, {
    game: g, orient: cur.color, players: cur.color === 'w' ? { w: you, b: them } : { w: them, b: you },
    canMove: turn => !thinking && !cur.result && turn === cur.color,
    onUserMove: (uci, dragged) => { const res = g.play(uci); if (!res) return; playSound(res); clk.press(cur.clock, cur.color, g.moves.length); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(dragged ? null : g.lastFromTo); afterMove(); },
    getClock: cur.clock ? () => cur.clock : null,
    onTick: () => { if (cur.result) return; const f = clk.flagged(cur.clock); if (f) { const r = timeoutResult(g.pos, f); finish(r.result, r.reason); } },
  });
  main.append(h('div', { class: 'center small muted' }, cur.rated ? 'Rated game' : 'Casual game: undo and hints allowed'));
  function buttons() {
    const over = !!cur.result;
    const list = [{ ic: 'flip', label: 'Flip', on: () => scr.flip() }];
    if (!cur.rated) {
      list.push({ ic: 'undo', label: 'Undo', disabled: over || thinking || g.moves.length < 1, on: () => { g.undo(); if (g.turn() !== cur.color) g.undo(); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); } });
      list.push({ ic: 'bulb', label: 'Hint', disabled: over || thinking || g.turn() !== cur.color, on: hint });
    }
    if (over) {
      list.push({ ic: 'repeat', label: 'Rematch', on: () => startBotGame(cur.bot, cur.color === 'w' ? 'b' : 'w', cur.rated, cur.tc) });
      list.push({ ic: 'plus', label: 'New', on: () => { profile.current = null; saveProfile(); render(); } });
    } else {
      list.push({ ic: 'half', label: 'Draw?', disabled: thinking, on: offerDraw });
      list.push({ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', cur.rated && g.moves.length >= 2 ? 'This counts as a loss for your rating.' : 'End this game?', 'Resign', () => finish(cur.color === 'w' ? '0-1' : '1-0', 'resignation')) });
    }
    scr.setButtons(list);
  }
  async function hint() {
    scr.setStatus('bottom', 'thinking…');
    const r = await engineRequest({ kind: 'best', fen: START_FEN, moves: g.moves, nodes: 120000 });
    scr.setStatus('bottom', '');
    if (!alive || !r.uci) return;
    cur.hints++;
    const marks = {}; marks[sqFromName(r.uci.slice(0, 2))] = 'hint'; marks[sqFromName(r.uci.slice(2, 4))] = 'hint';
    scr.board.set(Object.assign(g.viewState(), { marks }));
  }
  let lastBotScore = 0;
  function offerDraw() {
    // Bot accepts when it is not better, or the position is dead-even late in the game
    const accept = lastBotScore <= -60 || (g.moves.length > 70 && Math.abs(lastBotScore) < 25);
    if (accept) { toast(bot.name + ' accepts the draw.'); finish('1/2-1/2', 'agreement'); }
    else toast(bot.name + ' wants to keep playing!');
  }
  function afterMove() {
    const st = g.status();
    if (st.over) return finish(st.result, st.reason);
    buttons();
    if (g.turn() !== cur.color) botTurn();
  }
  async function botTurn() {
    thinking = true; buttons(); scr.setStatus('top', 'thinking…');
    const t0 = Date.now();
    let level = bot;
    if (cur.clock) { const left = clk.rem(cur.clock, cur.color === 'w' ? 'b' : 'w'); const cap = left < 10000 ? 6000 : left < 30000 ? 25000 : left < 60000 ? 80000 : Infinity; if (cap < bot.nodes) level = Object.assign({}, bot, { nodes: cap }); }
    const r = await engineRequest({ kind: 'bot', fen: START_FEN, moves: g.moves, level, seed: cur.seed + g.moves.length, salt: cur.salt, ply: g.moves.length, book: OPENINGS[cur.book] });
    const wait = cur.clock && clk.rem(cur.clock, cur.color === 'w' ? 'b' : 'w') < 30000 ? 0 : Math.max(0, 450 + Math.random() * 400 - (Date.now() - t0));
    await new Promise(res => setTimeout(res, wait));
    if (!alive || profile.current !== cur) return;
    thinking = false; scr.setStatus('top', '');
    if (r.score !== undefined) lastBotScore = r.score;
    if (cur.result) return; // e.g. the bot ran out of time while thinking
    const res = g.play(r.uci); playSound(res);
    clk.press(cur.clock, cur.color === 'w' ? 'b' : 'w', g.moves.length);
    cur.moves = g.moves.slice(); saveProfile();
    if (!scr.viewing) scr.refresh(g.lastFromTo);
    afterMove();
  }
  function finish(result, reason) {
    if (cur.result) return;
    cur.result = { result, reason };
    clk.stop(cur.clock);
    const youWhite = cur.color === 'w';
    const score = result === '1/2-1/2' ? 0.5 : ((result === '1-0') === youWhite ? 1 : 0);
    const L = profile.ladder;
    let before = L.r, after = before, counted = false, promo = null;
    if (cur.rated && g.moves.length >= 2) {
      const oldLeague = leagueOf(L.r);
      const d = eloDelta(L.r, bot.rating, score, ladderK(L));
      L.r = Math.max(100, L.r + d); L.games++; L.peak = Math.max(L.peak || 0, L.r);
      after = L.r; counted = true;
      const nl = leagueOf(L.r);
      if (nl.i !== oldLeague.i) promo = { up: nl.i > oldLeague.i, name: nl.name, piece: nl.piece };
      profile.rHist.push(L.r); if (profile.rHist.length > 200) profile.rHist.shift();
    }
    profile.games.unshift({ t: Date.now(), opp: bot.name, oppR: bot.rating, color: cur.color, score, reason, rated: counted, before: Math.round(before), after: Math.round(after), pgn: g.pgnMoves() });
    profile.games = profile.games.slice(0, 50);
    saveProfile();
    buttons(); scr.refresh();
    if (score === 1) { beep('win'); scr.board.burst('trophy'); }
    setTimeout(() => showResult(score, reason, counted, before, after, promo), score === 1 ? 600 : 250);
  }
  function showResult(score, reason, counted, before, after, promo) {
    const d = Math.round(after) - Math.round(before);
    modal((box, close) => box.append(
      badge(score === 1 ? 'trophy' : score === 0.5 ? 'half' : 'shield', score === 1 ? 'gold' : score === 0.5 ? 'blue' : 'red'),
      h('h2', { class: 'center' }, score === 1 ? 'You win!' : score === 0.5 ? 'Draw!' : bot.name + ' wins'),
      h('p', { class: 'center muted' }, 'by ' + reason),
      counted ? h('p', { class: 'center' }, leagueIcon(after), ' ', h('b', null, Math.round(before)), ' ', icon('arrowRight', 16), ' ', h('b', null, Math.round(after)), ' ', h('span', { class: 'delta ' + (d >= 0 ? 'up' : 'down') }, (d >= 0 ? '+' : '') + d)) : h('p', { class: 'center muted small' }, cur.rated ? 'Too short to be rated.' : 'Casual game: rating unchanged.'),
      counted && d === 0 && score === 1 ? h('p', { class: 'center small muted' }, 'This bot is far below your level, so wins no longer count. Try a stronger bot!') : null,
      promo ? h('div', { class: 'banner ' + (promo.up ? 'good' : 'bad'), style: { justifyContent: 'center' } }, h('img', { src: PIECE_URL['w' + promo.piece], style: { width: '28px' } }), promo.up ? `Promoted to the ${promo.name}!` : `Moved down to the ${promo.name}. You'll climb back!`) : null,
      score === 0 ? h('p', { class: 'center small muted' }, 'Tip: tap the moves above to replay the game and spot the turning point.') : null,
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn grow', onclick: close }, 'Review'),
        h('button', { class: 'btn primary grow', onclick: () => { close(); startBotGame(cur.bot, cur.color === 'w' ? 'b' : 'w', cur.rated, cur.tc); } }, 'Rematch'))));
  }
  buttons();
  if (!cur.result) { const st = g.status(); if (st.over) finish(st.result, st.reason); else if (g.turn() !== cur.color) botTurn(); }
}

// ======================= FRIENDS =======================
let friendView = 'menu';
function renderFriend(main) {
  if (friendView === 'local') return renderLocalGame(main);
  if (friendView === 'online') return renderOnline(main);
  main.append(
    h('h2', null, 'Play with a friend'),
    h('button', { class: 'card lesson', onclick: () => { friendView = 'local'; render(); } }, h('div', { class: 'ic dark' }, icon('phone', 24)), h('div', null, h('div', { class: 't' }, 'Pass & Play'), h('div', { class: 'd' }, 'Two players, one device. Take turns!')), h('span', { class: 'ck' }, '›')),
    h('button', { class: 'card lesson', onclick: () => { friendView = 'online'; render(); } }, h('div', { class: 'ic dark' }, icon('globe', 24)), h('div', null, h('div', { class: 't' }, 'Play Online'), h('div', { class: 'd' }, 'Each player on their own device, with a game code.')), h('span', { class: 'ck' }, '›')),
    h('p', { class: 'small muted' }, `Online games count toward your Online rating (${fmtR(profile.human)}), which is separate from your Bot League rating. Pass & Play is just for fun.`));
}
function newLocalGame() {
  const st = profile.localGame || {}; const sel = { tc: st.tc || '0+0' };
  modal((box, close) => box.append(h('h2', null, 'New game'), h('p', { class: 'muted small' }, 'Pick a time control. Each player gets this much time.'), tcPicker(sel),
    h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn grow', onclick: close }, 'Cancel'),
      h('button', { class: 'btn primary grow', onclick: () => { close(); const [b, i] = parseTc(sel.tc); profile.localGame = { moves: [], autoFlip: st.autoFlip !== false, tc: sel.tc, clock: newClock(b, i), result: null }; saveProfile(); render(); } }, 'Start'))));
}
function renderLocalGame(main) {
  const st = profile.localGame || (profile.localGame = { moves: [], autoFlip: true, tc: '0+0', clock: null });
  const g = new Game(START_FEN, st.moves);
  const scr = gameScreen(main, {
    game: g, orient: st.autoFlip ? g.turn() : 'w', players: { w: { name: 'White', avatar: 'white' }, b: { name: 'Black', avatar: 'black' } },
    canMove: () => !g.status().over && !st.result,
    getClock: () => st.clock,
    onTick: () => { if (st.result || g.status().over) return; const f = clk.flagged(st.clock); if (f) { clk.stop(st.clock); const r = timeoutResult(g.pos, f); st.result = r; saveProfile(); showLocalEnd(r); buttons(); } },
    onUserMove: (uci, dragged) => {
      const mover = g.turn();
      const res = g.play(uci); if (!res) return; playSound(res);
      clk.press(st.clock, mover, g.moves.length);
      st.moves = g.moves.slice(); saveProfile(); scr.refresh(dragged ? null : g.lastFromTo);
      const s = g.status();
      if (s.over) { clk.stop(st.clock); showLocalEnd(s); }
      else if (st.autoFlip) setTimeout(() => { if (scr.board.orient !== g.turn()) scr.flip(); }, 450);
      buttons();
    },
  });
  function showLocalEnd(s) {
      beep('win'); setTimeout(() => modal((box, close) => box.append(badge(s.result === '1/2-1/2' ? 'half' : 'trophy', s.result === '1/2-1/2' ? 'blue' : 'gold'), h('h2', { class: 'center' }, s.result === '1-0' ? 'White wins!' : s.result === '0-1' ? 'Black wins!' : 'Draw!'), h('p', { class: 'center muted' }, 'by ' + s.reason), h('button', { class: 'btn primary block', onclick: close }, 'OK'))), 400); 
  }
  function buttons() {
    scr.setButtons([
      { ic: 'back', label: 'Back', on: () => { friendView = 'menu'; render(); } },
      { ic: 'flip', label: 'Flip', on: () => scr.flip() },
      { ic: st.autoFlip ? 'repeat' : 'x', label: st.autoFlip ? 'Auto-flip' : 'No flip', on: () => { st.autoFlip = !st.autoFlip; saveProfile(); buttons(); toast(st.autoFlip ? 'Board turns after each move' : 'Board stays put'); } },
      { ic: 'undo', label: 'Undo', disabled: !g.moves.length, on: () => { g.undo(); st.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); } },
      { ic: 'plus', label: 'New', on: () => newLocalGame() },
    ]);
  }
  buttons();
}

// ---------- online: true peer-to-peer over WebRTC ----------
// Signaling is copy/paste (or a link): the host's "invite" holds its WebRTC offer, the guest
// replies with an "answer" code. After that the two browsers talk directly over a data channel.
const myId = (() => { try { let v = sessionStorage.getItem('kc-id'); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('kc-id', v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
let online = null; // {role, pc, dc, phase, code, state, ...}
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
async function packCode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    const cs = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer()));
  }
  return 'j' + b64u(raw);
}
async function unpackCode(code) {
  code = code.trim().replace(/^.*#join=/, '').replace(/\s+/g, '');
  let bytes = unb64u(code.slice(1));
  if (code[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
function waitIce(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
function leaveOnline() { if (online) { clearInterval(online.timer); try { online.dc && online.dc.close(); online.pc && online.pc.close(); } catch (e) { } } online = null; }
function inviteLink(code) { return location.href.split('#')[0] + '#join=' + code; }
function newPc() { return new RTCPeerConnection({ iceServers: ICE }); }
function wireChannel(dc) {
  online.dc = dc;
  dc.onopen = () => {
    online.phase = 'live'; online.connected = true;
    if (online.role === 'host') {
      const me = { id: myId, name: profile.name || 'Host', r: Math.round(profile.human.r), rd: Math.round(profile.human.rd) };
      if (!online.state) {
        const hostWhite = online.wantColor === 'w' ? true : online.wantColor === 'b' ? false : rand() < .5;
        const gu = { id: online.guestId || 'guest', name: online.guestName || 'Friend' };
        const [tb, ti] = parseTc(online.tc);
        online.state = { v: 1, white: hostWhite ? me : gu, black: hostWhite ? gu : me, moves: [], result: null, drawOffer: null, rematch: null, tc: online.tc || '0+0', clock: newClock(tb, ti) };
      }
      sendState();
    } else sendRaw({ t: 'hi', id: myId, name: profile.name || 'Friend', r: Math.round(profile.human.r), rd: Math.round(profile.human.rd) });
    clearInterval(online.timer);
    online.timer = setInterval(sendState, 5000);
    if (route === 'friend') render();
  };
  dc.onclose = () => { if (!online) return; online.connected = false; online.phase = 'lost'; if (online.onState) online.onState(-1); else if (route === 'friend') render(); };
  dc.onmessage = e => { let d; try { d = JSON.parse(e.data); } catch (_) { return; } onPeerMessage(d); };
}
function sendRaw(obj) { try { if (online && online.dc && online.dc.readyState === 'open') online.dc.send(JSON.stringify(obj)); } catch (e) { } }
function sendState() { if (online && online.state) sendRaw(Object.assign({ t: 'state' }, online.state, { clock: clk.wire(online.state.clock) })); }
function onPeerMessage(d) {
  if (!online) return;
  if (d.t === 'hi' && online.role === 'host') {
    // guest introduces itself: fix up its id/name in the seat it was given
    const st = online.state;
    for (const k of ['white', 'black']) if (st[k] && st[k].id !== myId) { st[k] = { id: d.id, name: d.name || 'Friend', r: d.r, rd: d.rd }; }
    st.v++; sendState(); if (online.onState) online.onState(-2); return;
  }
  if (d.t !== 'state' || typeof d.v !== 'number' || !Array.isArray(d.moves)) return;
  const test = new Game(); for (const u of d.moves) if (!test.play(u)) return; // untrusted: replay to validate
  const cur = online.state;
  if (!cur || d.v > cur.v || (d.v === cur.v && online.role === 'guest')) {
    const prevLen = cur ? cur.moves.length : 0;
    const wasStarted = !!cur;
    online.state = { v: d.v, white: d.white, black: d.black, moves: d.moves.slice(), result: d.result, drawOffer: d.drawOffer, rematch: d.rematch, tc: d.tc, clock: clk.unwire(d.clock) };
    if (wasStarted && online.onState) online.onState(prevLen);
    else if (route === 'friend') render();
  }
}
async function hostCreate(color, tc) {
  leaveOnline();
  online = { role: 'host', phase: 'making', wantColor: color, tc: tc || '0+0', state: profile.onlineResume || null };
  render();
  try {
    const pc = newPc(); online.pc = pc;
    wireChannel(pc.createDataChannel('chess', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    online.code = await packCode({ k: 'o', sdp: pc.localDescription.sdp, n: profile.name || '' });
    online.phase = 'invite';
  } catch (e) { online.phase = 'error'; online.err = String(e.message || e); }
  render();
}
async function hostAccept(answerCode) {
  try {
    const a = await unpackCode(answerCode);
    if (a.k !== 'a') throw new Error('That is not a reply code. Ask your friend for the code their screen shows after joining.');
    online.guestName = a.n; online.guestId = a.id;
    await online.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
    online.phase = 'connecting'; render();
    setTimeout(() => { if (online && online.phase === 'connecting') { online.phase = 'error'; online.err = 'Could not connect directly. Some networks (like school or work Wi-Fi) block peer-to-peer. Try again, or switch one device to mobile data.'; render(); } }, 20000);
  } catch (e) { toast(e.message || 'Invalid code'); }
}
async function guestJoin(inviteCode) {
  leaveOnline();
  online = { role: 'guest', phase: 'making' };
  render();
  try {
    const o = await unpackCode(inviteCode);
    if (o.k !== 'o') throw new Error('That is not an invite code.');
    online.hostName = o.n;
    const pc = newPc(); online.pc = pc;
    pc.ondatachannel = e => wireChannel(e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    online.code = await packCode({ k: 'a', sdp: pc.localDescription.sdp, n: profile.name || '', id: myId });
    online.phase = 'answer';
  } catch (e) { online.phase = 'error'; online.err = 'That invite did not work: ' + (e.message || e) + ' Ask your friend for a fresh invite.'; }
  render();
}
let pendingJoin = null;
function renderOnline(main) {
  if (online && online.state && (online.phase === 'live' || online.phase === 'lost')) return renderOnlineGame(main);
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { leaveOnline(); friendView = 'menu'; render(); } }, icon('back', 18), 'Back'), h('h2', null, 'Play Online')));
  if (!window.RTCPeerConnection) { main.append(h('div', { class: 'card' }, 'This browser does not support peer-to-peer connections. Try Chrome, Safari or Firefox.')); return; }
  const card = h('div', { class: 'card stack' }); main.append(card);
  const ph = online && online.phase;
  if (!online) {
    let color = 'r';
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => { seg.innerHTML = ''; [['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]].forEach(([v, l]) => seg.append(h('button', { class: color === v ? 'on' : '', onclick: () => { color = v; drawSeg(); } }, l))); };
    drawSeg();
    const inp = h('textarea', { class: 'input', rows: 3, placeholder: 'Paste the invite link or code here' });
    if (pendingJoin) { inp.value = pendingJoin; }
    const tcSel = { tc: '0+0' };
    card.append(h('h3', null, '1. Host a game'), h('div', { class: 'small muted' }, 'You play as:'), seg, h('div', { class: 'small muted' }, 'Time control:'), tcPicker(tcSel),
      h('button', { class: 'btn primary block', onclick: () => hostCreate(color, tcSel.tc) }, icon('sparkle', 18), 'Create invite'));
    main.append(h('div', { class: 'card stack' }, h('h3', null, '2. Or join a friend'), inp,
      h('button', { class: 'btn block', onclick: () => { const v = inp.value.trim(); if (!v) return toast('Paste the invite first'); pendingJoin = null; guestJoin(v); } }, 'Join game')),
      h('p', { class: 'small muted' }, 'How it works: the host sends an invite link. The friend opens it and sends back a reply code. Once the host pastes that code in, the two devices connect directly, with no server in between.'));
    return;
  }
  if (ph === 'making' || ph === 'connecting') { card.append(h('div', { class: 'center' }, icon('hourglass', 18), ' ', ph === 'making' ? 'Preparing connection…' : 'Connecting to your friend…')); }
  else if (ph === 'invite') {
    const link = inviteLink(online.code);
    const ans = h('textarea', { class: 'input', rows: 3, placeholder: "Paste your friend's reply code here" });
    card.append(h('h3', null, 'Step 1: Send this invite'),
      h('div', { class: 'small muted' }, 'Text or message this link to your friend:'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => shareOrCopy(link, 'Join my chess game!') }, icon('share', 18), 'Share invite'), h('button', { class: 'btn', onclick: () => copyText(link) }, icon('copy', 18), 'Copy')),
      h('h3', null, 'Step 2: Paste their reply'), ans,
      h('button', { class: 'btn block', onclick: () => { const v = ans.value.trim(); if (!v) return toast('Paste the reply code first'); hostAccept(v); } }, icon('link', 18), 'Connect'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'answer') {
    card.append(h('h3', null, 'Almost there!'),
      h('div', { class: 'small muted' }, `Send this reply code back to ${online.hostName || 'your friend'}. The game starts as soon as they paste it in.`),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => shareOrCopy(online.code, 'My chess reply code') }, icon('share', 18), 'Share reply'), h('button', { class: 'btn', onclick: () => copyText(online.code) }, icon('copy', 18), 'Copy')),
      h('div', { class: 'center muted small' }, icon('hourglass', 16), ' Waiting for the connection…'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'error' || ph === 'lost') {
    card.append(h('h3', null, (ph === 'lost' ? 'Connection lost' : 'Something went wrong')), h('p', { class: 'small muted' }, online.err || 'The connection closed.'),
      h('button', { class: 'btn primary block', onclick: () => { leaveOnline(); render(); } }, 'Start over'));
  }
}
// Online (human) rating: Glicko-2, capped at ±50 per game while provisional, ±30 after.
// Each game is rated once, and only if at least 4 moves were played.
function rateOnline(st, opp, score) {
  if (!opp || st.moves.length < 4) return null;
  const key = [st.white.id, st.black.id, st.moves.join('')].join('|');
  profile.ratedKeys = profile.ratedKeys || [];
  if (profile.ratedKeys.includes(key)) return null;
  profile.ratedKeys.push(key); if (profile.ratedKeys.length > 100) profile.ratedKeys.shift();
  const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v)) ? Math.max(a, Math.min(b, v)) : d; // opponent data is untrusted
  const before = Math.round(profile.human.r);
  profile.human = cappedGlicko(profile.human, { r: clamp(opp.r, 100, 3000, 800), rd: clamp(opp.rd, 50, 350, 250) }, score, 50, 30);
  const after = Math.round(profile.human.r);
  profile.hHist.push(after); if (profile.hHist.length > 200) profile.hHist.shift();
  profile.games.unshift({ t: Date.now(), opp: (opp.name || 'Friend') + ' (online)', score, reason: st.result.reason, rated: true, before, after, online: true });
  profile.games = profile.games.slice(0, 50);
  saveProfile();
  return { before, after };
}
async function shareOrCopy(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text: title + ' ' + text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyText(text);
}
function renderOnlineGame(main) {
  const o = online, st = o.state;
  const myColor = st.white.id === myId ? 'w' : st.black.id === myId ? 'b' : (o.role === 'host' ? (st.white.id !== 'guest' && st.white.name === (profile.name || 'Host') ? 'w' : 'b') : null);
  const g = new Game(START_FEN, st.moves);
  const oppInfo = myColor === 'w' ? st.black : st.white, meInfo = myColor === 'w' ? st.white : st.black;
  const live = h('span', { class: 'pill' });
  const setLive = () => { live.className = 'pill' + (o.connected ? ' live' : ''); live.textContent = o.connected ? '● connected (peer-to-peer)' : '○ disconnected'; };
  setLive();
  main.append(h('div', { class: 'row' }, live, h('span', { class: 'grow' })));
  const scr = gameScreen(main, {
    game: g, orient: myColor || 'w', players: (() => { const opp = { name: (oppInfo && oppInfo.name) || 'Friend', avatar: 'friend', rating: oppInfo && oppInfo.r ? Math.round(oppInfo.r) : null }, mine = { name: 'You', avatar: 'you', rating: fmtR(profile.human) }; return myColor === 'b' ? { w: opp, b: mine } : { w: mine, b: opp }; })(),
    canMove: turn => o.connected && !o.state.result && turn === myColor,
    getClock: () => o.state.clock,
    onTick: () => {
      const s = o.state; if (s.result || !s.clock) return;
      const f = clk.flagged(s.clock);
      if (f) { clk.stop(s.clock); s.result = timeoutResult(g.pos, f); s.v++; sendState(); buttons(); checkOver(); }
    },
    onUserMove: (uci, dragged) => {
      const res = g.play(uci); if (!res) return; playSound(res);
      clk.press(o.state.clock, myColor, g.moves.length);
      o.state.moves = g.moves.slice(); o.state.drawOffer = null; o.state.v++;
      const s = g.status(); if (s.over) { clk.stop(o.state.clock); o.state.result = { result: s.result, reason: s.reason }; }
      if (o.role === 'host') { profile.onlineResume = o.state.result ? null : o.state; saveProfile(); }
      sendState(); scr.refresh(dragged ? null : g.lastFromTo); buttons(); checkOver();
    },
  });
  let shownOver = !!st.result;
  function checkOver() {
    const r = o.state.result; if (!r || shownOver) return; shownOver = true;
    const win = (r.result === '1-0' && myColor === 'w') || (r.result === '0-1' && myColor === 'b');
    const score = r.result === '1/2-1/2' ? .5 : win ? 1 : 0;
    const rc = rateOnline(o.state, oppInfo, score);
    if (win) { beep('win'); scr.board.burst('trophy'); }
    setTimeout(() => modal((box, close) => box.append(badge(r.result === '1/2-1/2' ? 'half' : win ? 'trophy' : 'shield', r.result === '1/2-1/2' ? 'blue' : win ? 'gold' : 'red'), h('h2', { class: 'center' }, r.result === '1/2-1/2' ? 'Draw!' : win ? 'You win!' : 'Your friend wins!'), h('p', { class: 'center muted' }, 'by ' + r.reason),
      rc ? h('p', { class: 'center' }, icon('globe', 16), ' Online rating ', h('b', null, rc.before), ' ', icon('arrowRight', 16), ' ', h('b', null, rc.after), ' ', h('span', { class: 'delta ' + (rc.after >= rc.before ? 'up' : 'down') }, (rc.after >= rc.before ? '+' : '') + (rc.after - rc.before))) : h('p', { class: 'center small muted' }, 'Too short to be rated.'),
      h('button', { class: 'btn primary block', onclick: close }, 'OK'))), 400);
  }
  o.onState = (prevLen) => {
    if (prevLen === -2) { render(); return; } // seats changed
    setLive();
    if (prevLen === -1) { toast('Connection lost. Your friend may have closed the page.', 3500); buttons(); return; }
    const s2 = o.state;
    if (s2.moves.length < g.moves.length || s2.moves.length === 0 && g.moves.length) { render(); return; } // rematch / reset
    Object.assign(g, new Game(START_FEN, s2.moves));
    if (s2.moves.length > prevLen) { beep(g.pos.inCheck() ? 'check' : 'move'); scr.refresh(g.lastFromTo); } else scr.refresh();
    if (o.role === 'host') { profile.onlineResume = s2.result ? null : s2; saveProfile(); }
    if (s2.drawOffer && s2.drawOffer !== myId && !s2.result) toast('Your friend offers a draw. Tap Accept to agree.', 3500);
    if (s2.rematch && s2.rematch !== myId && s2.result) toast('Your friend wants a rematch! Tap Accept.', 3500);
    buttons(); checkOver();
  };
  function buttons() {
    const s = o.state, over = !!s.result;
    const list = [{ ic: 'back', label: 'Leave', on: () => confirmBox('Leave game?', 'This closes the connection to your friend.', 'Leave', () => { leaveOnline(); friendView = 'menu'; render(); }) },
    { ic: 'flip', label: 'Flip', on: () => scr.flip() }];
    if (!o.connected) list.push({ ic: 'plug', label: 'Reconnect', on: () => { const keep = o.role === 'host' ? o.state : null; leaveOnline(); if (keep) { profile.onlineResume = keep; saveProfile(); } render(); toast(keep ? 'Create a new invite. The game will continue where you left off.' : 'Ask the host for a new invite link.', 4000); } });
    else if (!over) {
      list.push({ ic: 'half', label: s.drawOffer && s.drawOffer !== myId ? 'Accept' : 'Draw?', disabled: s.drawOffer === myId, on: () => { if (s.drawOffer && s.drawOffer !== myId) { clk.stop(s.clock); s.result = { result: '1/2-1/2', reason: 'agreement' }; } else { s.drawOffer = myId; toast('Draw offered'); } s.v++; sendState(); buttons(); checkOver(); } });
      list.push({ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', 'Your friend wins this game.', 'Resign', () => { clk.stop(s.clock); s.result = { result: myColor === 'w' ? '0-1' : '1-0', reason: 'resignation' }; s.v++; sendState(); buttons(); checkOver(); }) });
    } else {
      list.push({ ic: 'repeat', label: s.rematch && s.rematch !== myId ? 'Accept' : 'Rematch', disabled: s.rematch === myId, on: () => {
        if (s.rematch && s.rematch !== myId) { const w = s.white; s.white = s.black; s.black = w; s.moves = []; s.result = null; s.drawOffer = null; s.rematch = null; const [tb, ti] = parseTc(s.tc); s.clock = newClock(tb, ti); s.v++; sendState(); render(); }
        else { s.rematch = myId; s.v++; sendState(); toast('Rematch requested'); buttons(); }
      } });
    }
    scr.setButtons(list);
  }
  buttons();
  cleanups.push(() => { if (online) online.onState = null; });
}

// ======================= PUZZLES =======================
let puzCat = 'rated', puzState = null;
function pickPuzzle() {
  const pool = PUZZLES.filter(p => puzCat === 'rated' ? true : puzCat === 'pattern' ? p.cat === 'pattern' : p.n === +puzCat.slice(-1) && p.cat !== 'pattern');
  const fresh = pool.filter(p => !profile.tried[p.id]);
  if (puzCat === 'pattern' && fresh.length) return fresh[0]; // learn the famous mates in order, easiest first
  const use = (fresh.length ? fresh : pool).slice();
  const pr = profile.puzzle.r;
  use.sort((a, b) => Math.abs(a.rating - pr) - Math.abs(b.rating - pr));
  const top = use.slice(0, Math.min(6, use.length));
  return top[Math.floor(rand() * top.length)];
}
function renderPuzzles(main) {
  const cats = [['rated', 'For you'], ['m1', 'Mate in 1'], ['m2', 'Mate in 2'], ['m3', 'Mate in 3'], ['pattern', 'Famous mates']];
  const solvedCount = Object.values(profile.tried).filter(x => x === 1).length;
  main.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('h2', null, 'Puzzles'), h('div', { class: 'small muted' }, `Rating ${fmtR(profile.puzzle)} · Streak ${profile.streak} · Solved ${solvedCount}/${PUZZLES.length}`))));
  main.append(h('div', { class: 'cats' }, cats.map(([k, l]) => h('button', { class: puzCat === k ? 'on' : '', onclick: () => { puzCat = k; puzState = null; render(); } }, l))));
  if (!puzState) { const p = pickPuzzle(); puzState = { p, step: 0, failed: false, done: false, rated: !profile.tried[p.id] }; }
  const ps = puzState, p = ps.p;
  const g = new Game(p.fen);
  for (let i = 0; i < ps.step; i++) g.play(p.line[i]);
  const side = new E.Position(p.fen).turn === 0 ? 'w' : 'b';
  const banner = h('div', { class: 'banner' });
  const setBanner = (cls, html) => { banner.className = 'banner ' + (cls || ''); banner.innerHTML = html; };
  const prompt = () => `<span class="tomove" style="background:${side === 'w' ? '#fff' : '#222'}"></span><span>${side === 'w' ? 'White' : 'Black'} to move: <b>checkmate in ${p.n}</b>${p.name ? ' · ' + p.name : ''}</span><span class="grow"></span><span class="pill">${p.rating}</span>`;
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
  main.append(banner, board.el);
  const msg = h('div', { class: 'taskmsg' }); main.append(msg);
  const btnRow = h('div', { class: 'row' }); main.append(btnRow);
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
      msg.className = 'taskmsg good'; msg.textContent = 'Good move! Keep going…';
      busy = true;
      setTimeout(() => { const rr = g.play(p.line[ps.step]); ps.step++; playSound(rr); show(g.lastFromTo); busy = false; msg.textContent = 'Your move'; }, 650);
    } else {
      // wrong: show briefly then reset
      if (r) { const tmp = new Game(g.startFen, g.moves); tmp.play(uci); board.set(tmp.viewState(), dragged ? null : tmp.lastFromTo); }
      beep('bad'); ps.failed = true;
      const d = rate(false);
      msg.className = 'taskmsg bad'; msg.textContent = 'Not that one.' + (d !== null ? ` Rating ${d}` : '') + ' Try again!';
      busy = true; setTimeout(() => { busy = false; show(); }, 900);
      buttons();
    }
  }
  function solved() {
    ps.done = true; beep('win'); board.burst('star');
    const d = ps.failed ? null : rate(true);
    if (!ps.failed && d === null && !profile.tried[p.id]) { profile.tried[p.id] = 1; saveProfile(); }
    setBanner('good', `${iconSvgInline('check')}<span><b>Solved!</b> ${p.tip ? p.tip : ''}</span>`);
    msg.className = 'taskmsg good'; msg.textContent = d !== null ? `Puzzle rating ${Math.round(profile.puzzle.r)} (${d >= 0 ? '+' : ''}${d})` : (ps.failed ? 'Solved after a miss. No rating change.' : 'Solved!');
    buttons();
  }
  function buttons() {
    btnRow.innerHTML = '';
    if (!ps.done) {
      btnRow.append(h('button', { class: 'btn grow', onclick: () => { const exp = p.line[ps.step]; const marks = {}; marks[sqFromName(exp.slice(0, 2))] = 'hint'; board.set(Object.assign(g.viewState(), { marks })); if (ps.rated) { const d = rate(false); ps.failed = true; msg.className = 'taskmsg bad'; msg.textContent = `Hint used (${d})`; } } }, icon('bulb', 18), 'Hint'));
      btnRow.append(h('button', { class: 'btn grow', onclick: () => { rate(false); ps.failed = true; ps.done = true; showSolution(); } }, icon('eye', 18), 'Solution'));
    }
    btnRow.append(h('button', { class: 'btn primary grow', onclick: () => { puzState = null; render(); } }, ps.done ? 'Next' : 'Skip', icon('next', 18)));
  }
  async function showSolution() {
    buttons(); busy = true;
    for (let i = ps.step; i < p.line.length; i++) { await new Promise(r => setTimeout(r, 700)); const rr = g.play(p.line[i]); playSound(rr); show(g.lastFromTo); }
    setBanner('', `${iconSvgInline('bulb')}<span>That's the solution${p.tip ? ': ' + p.tip : '.'}</span>`);
    msg.textContent = '';
  }
  buttons();
}

// ======================= LEARN =======================
let lessonOpen = null, lessonStep = 0;
function lessonIcon(l) { return l.piece ? h('div', { class: 'ic', style: { backgroundImage: `url(${PIECE_URL['w' + l.piece]})` } }) : h('div', { class: 'ic dark' }, icon(l.icon, 24)); }
function renderLearn(main) {
  if (lessonOpen) return renderLesson(main);
  const done = LESSONS.filter(l => profile.lessons[l.id]).length;
  main.append(h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(56)), h('div', { class: 'txt' }, done === 0 ? "Hoo-hoo! I'm Professor Hoot. Let's learn chess together, one step at a time! Start at the top." : done === LESSONS.length ? 'You finished every lesson! You are ready to play. Try the Puzzles too!' : `Great work! You've finished ${done} of ${LESSONS.length} lessons. Keep going!`)));
  let groupEl = null, lastGroup = null;
  for (const l of LESSONS) {
    if (l.group !== lastGroup) { lastGroup = l.group; groupEl = h('div', { class: 'lgroup' }, h('h3', null, l.group), h('div', { class: 'lessons' })); main.append(groupEl); }
    $('.lessons', groupEl).append(h('button', { class: 'lesson', onclick: () => { lessonOpen = l; lessonStep = 0; render(); window.scrollTo(0, 0); } }, lessonIcon(l), h('div', null, h('div', { class: 't' }, l.title), h('div', { class: 'd' }, l.desc)), h('span', { class: 'ck' + (profile.lessons[l.id] ? ' done' : '') }, icon(profile.lessons[l.id] ? 'check' : 'next', 20))));
  }
}
function fenToBoard(fen) { return new E.Position(fen.includes(' ') ? fen : fen + ' w - - 0 1').board; }
function boardFromPieces(spec) { // spec: {'d4':'R', 'e5':'p'}
  const b = new Int8Array(128);
  for (const k in spec) b[sqFromName(k)] = E.PIECE_CHARS.indexOf(spec[k]);
  return b;
}
// movement on a lesson board, ignoring check: used for "collect the stars"
function lessonTargets(b, sq) {
  const p = b[sq]; if (!p || (p & 8)) return [];
  const t = p & 7, out = [];
  const add = to => { if (to & 0x88) return false; const q = b[to]; if (!q) { out.push(to); return true; } if (q & 8) out.push(to); return false; };
  if (t === 1) {
    const one = sq + 16; if (!(one & 0x88) && !b[one]) { out.push(one); if ((sq >> 4) === 1 && !b[one + 16]) out.push(one + 16); }
    for (const d of [15, 17]) { const to = sq + d; if (!(to & 0x88) && (b[to] & 8)) out.push(to); }
  } else if (t === 2 || t === 6) {
    for (const d of (t === 2 ? [33, 31, 18, 14, -33, -31, -18, -14] : [1, -1, 16, -16, 17, 15, -17, -15])) add(sq + d);
  } else {
    const dirs = t === 3 ? [17, 15, -17, -15] : t === 4 ? [1, -1, 16, -16] : [1, -1, 16, -16, 17, 15, -17, -15];
    for (const d of dirs) { let to = sq + d; while (add(to)) to += d; }
  }
  return out;
}
function renderLesson(main) {
  const L = lessonOpen, steps = L.steps, step = steps[lessonStep];
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { lessonOpen = null; render(); } }, icon('back', 18), 'Lessons'), h('div', { class: 'grow' }, h('h2', null, L.title))));
  main.append(h('div', { class: 'dots' }, steps.map((_, i) => h('i', { class: i < lessonStep ? 'done' : i === lessonStep ? 'on' : '' }))));
  const txt = h('div', { class: 'txt', html: step.text });
  main.append(h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(56)), txt));
  const msg = h('div', { class: 'taskmsg' });
  let complete = step.type === 'text';
  const nextBtn = h('button', { class: 'btn primary grow', disabled: !complete, onclick: () => {
    if (lessonStep < steps.length - 1) { lessonStep++; render(); window.scrollTo(0, 0); }
    else { profile.lessons[L.id] = 1; saveProfile(); beep('win'); const idx = LESSONS.indexOf(L); const nxt = LESSONS[idx + 1];
      modal((box, close) => box.append(badge('learn', 'gold'), h('h2', { class: 'center' }, 'Lesson complete!'), h('p', { class: 'center muted' }, L.title),
        h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => { close(); lessonOpen = null; render(); } }, 'All lessons'), nxt ? h('button', { class: 'btn primary grow', onclick: () => { close(); lessonOpen = nxt; lessonStep = 0; render(); window.scrollTo(0, 0); } }, 'Next lesson') : h('button', { class: 'btn primary grow', onclick: () => { close(); lessonOpen = null; go('play'); } }, "Let's play!")))); }
  } }, lessonStep < steps.length - 1 ? 'Next' : 'Finish', icon(lessonStep < steps.length - 1 ? 'next' : 'check', 18));
  const finishTask = (text) => { complete = true; nextBtn.disabled = false; msg.className = 'taskmsg good'; msg.textContent = text || 'Great job!'; beep('win'); };

  if (step.type === 'text' && step.board) {
    const bv = new BoardView({ orient: step.orient || 'w' });
    const marks = {}; (step.marks || []).forEach(s => marks[sqFromName(s)] = 'mark');
    const showTargets = step.showMoves ? lessonTargets(fenToBoard(step.board), sqFromName(step.showMoves)) : [];
    bv.set({ board: fenToBoard(step.board), marks });
    if (showTargets.length) { bv.targets = showTargets; bv.draw(); }
    main.append(bv.el);
  } else if (step.type === 'stars') {
    let b = boardFromPieces(step.pieces);
    const stars = new Set((step.stars || []).map(sqFromName));
    const fixed = new Set((step.fixed || []).map(sqFromName));
    let movesUsed = 0;
    const enemiesLeft = () => { let n = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (b[s] & 8) n++; } return n; };
    const bv = new BoardView({
      getTargets: sq => (!complete && b[sq] && !(b[sq] & 8) && !fixed.has(sq)) ? lessonTargets(b, sq) : null,
      onMove: (from, to, dragged) => {
        const cap = !!b[to]; b[to] = b[from]; b[from] = 0; movesUsed++;
        if (step.promote && (b[to] & 7) === 1 && (to >> 4) === 7) b[to] = 5;
        let got = false; if (stars.has(to)) { stars.delete(to); got = true; }
        beep(got ? 'star' : cap ? 'capture' : 'move');
        bv.set({ board: b, stars, last: [from, to] }, dragged ? null : [from, to]);
        const left = stars.size + (step.captureAll ? enemiesLeft() : 0);
        if (!left) { bv.burst('star'); finishTask(movesUsed <= (step.par || 99) ? `Perfect! You did it in ${movesUsed} moves!` : `You did it in ${movesUsed} moves! Can you do it in ${step.par}?`); }
        else msg.textContent = [stars.size ? `${stars.size} star${stars.size > 1 ? 's' : ''} left` : '', step.captureAll && enemiesLeft() ? `${enemiesLeft()} to capture` : ''].filter(Boolean).join(' · ');
      }
    });
    bv.set({ board: b, stars });
    main.append(bv.el);
    msg.textContent = [stars.size ? `${stars.size} star${stars.size > 1 ? 's' : ''} to collect` : '', step.captureAll ? `${enemiesLeft()} to capture` : ''].filter(Boolean).join(' · ');
    main.append(h('button', { class: 'btn sm ghost', onclick: () => render() }, icon('undo', 16), 'Restart'));
  } else if (step.type === 'goal') {
    let g = new Game(step.fen);
    const side = g.turn();
    const bv = new BoardView({
      orient: side,
      getTargets: sq => (!complete && g.turn() === side) ? g.targetsFrom(sq) : null,
      onMove: (from, to, dragged) => {
        const needs = g.needsPromo(from, to);
        const uci = sqName(from) + sqName(to) + (needs ? 'q' : '');
        const legal = g.legal(); const m = g.pos.moveFromUci(uci, legal);
        const res = g.play(uci); playSound(res);
        bv.set(g.viewState(), dragged ? null : g.lastFromTo);
        let ok = false;
        if (step.goal === 'check') ok = g.pos.inCheck();
        else if (step.goal === 'mate') ok = g.status().reason === 'checkmate';
        else if (step.goal === 'castle') ok = !!(E.mFlags(m) & E.F_CASTLE);
        else if (step.goal === 'promote') ok = !!E.mPromo(m);
        else if (step.goal === 'move') ok = step.moves.includes(uci.slice(0, 4));
        if (ok) { bv.burst(step.goal === 'mate' ? 'crown' : 'star'); finishTask(step.success); }
        else {
          const st = g.status();
          msg.className = 'taskmsg bad'; msg.textContent = st.reason === 'stalemate' ? 'Oops, that is stalemate (a draw)! Try again.' : (step.fail || 'Not quite. Try again!');
          beep('bad');
          setTimeout(() => { g = new Game(step.fen); bv.set(g.viewState()); }, 1100);
        }
      }
    });
    bv.set(g.viewState());
    main.append(bv.el);
  }
  main.append(msg);
  main.append(h('div', { class: 'row' }, lessonStep > 0 ? h('button', { class: 'btn', onclick: () => { lessonStep--; render(); } }, icon('back', 18), 'Back') : null, nextBtn));
}

// ======================= ME / PROFILE =======================
function sparkline(arr, color) {
  const data = arr.slice(-60); if (data.length < 2) return h('div', { class: 'small muted' }, 'Play rated games to see your graph.');
  const min = Math.min(...data) - 20, max = Math.max(...data) + 20, W = 300, H = 70;
  const pts = data.map((v, i) => [i / (data.length - 1) * W, H - (v - min) / (max - min) * H]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const el = h('div'); el.innerHTML = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d} L${W} ${H} L0 ${H} Z" fill="${color}" opacity=".15"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  return el;
}
function renderMe(main) {
  const L = profile.ladder, lg = leagueOf(L.r), hu = profile.human, pr = profile.puzzle;
  const nameInp = h('input', { class: 'input', placeholder: 'Your name', value: profile.name, maxlength: 20, onchange: e => { profile.name = e.target.value.trim(); saveProfile(); } });
  const botGames = profile.games.filter(g => !g.online);
  const w = botGames.filter(g => g.score === 1).length, l = botGames.filter(g => g.score === 0).length, d = botGames.filter(g => g.score === 0.5).length;
  main.append(h('div', { class: 'card stack' }, h('div', { class: 'small muted', style: { fontWeight: 800 } }, 'YOUR NAME'), nameInp));
  // Bot League card with progress to the next league
  const bar = h('div', { style: { height: '10px', borderRadius: '6px', background: 'var(--bg2)', overflow: 'hidden', margin: '8px 0 4px' } }, h('div', { style: { height: '100%', width: Math.round(lg.pct * 100) + '%', background: 'linear-gradient(90deg,#ffc56b,#ff9f43)' } }));
  main.append(h('div', { class: 'card' },
    h('div', { class: 'row' }, h('img', { src: PIECE_URL['w' + lg.piece], style: { width: '52px', height: '52px', background: 'var(--light)', borderRadius: '14px', padding: '4px' } }),
      h('div', { class: 'grow' }, h('div', { class: 'small muted', style: { fontWeight: 800 } }, 'BOT LEAGUE'), h('div', { style: { fontSize: '22px', fontWeight: 900 } }, lg.name), h('div', { class: 'small muted' }, L.games < PLACEMENT_GAMES ? `Placement: ${L.games}/${PLACEMENT_GAMES} games` : `${L.games} rated games · peak ${L.peak}`)),
      h('div', { style: { fontSize: '30px', fontWeight: 900 } }, L.r)),
    bar, h('div', { class: 'small muted' }, lg.next ? `${lg.next - L.r} points to the ${lg.nextName}` : 'Top league reached!'),
    sparkline(profile.rHist, '#ffb547'), h('div', { class: 'small muted', style: { textAlign: 'right' } }, `${w}W · ${l}L · ${d}D`)));
  main.append(h('div', { class: 'stats' },
    h('div', { class: 'card stat' }, h('div', { class: 'l' }, icon('globe', 15), ' Online rating'), h('div', { class: 'v' }, fmtR(hu)), h('div', { class: 'l' }, (hu.games || 0) ? `${hu.games} games` + (hu.rd > 110 ? ' · provisional' : '') : 'Play online to start')),
    h('div', { class: 'card stat' }, h('div', { class: 'l' }, icon('puzzle', 15), ' Puzzle rating'), h('div', { class: 'v' }, fmtR(pr)), h('div', { class: 'l' }, `Best streak ${profile.best}`))));
  if ((hu.games || 0) > 0) main.append(h('div', { class: 'card' }, h('div', { class: 'small' }, h('b', null, 'Online rating history')), sparkline(profile.hHist, '#4fd18b')));
  main.append(h('div', { class: 'card' }, h('div', { class: 'small' }, h('b', null, 'Puzzle rating history')), sparkline(profile.pHist, '#6fb3ff')));
  if (profile.games.length) main.append(h('div', { class: 'card' }, h('b', null, 'Recent games'), h('table', { class: 'tbl' }, profile.games.slice(0, 8).map(g => h('tr', null, h('td', { class: 'res ' + (g.score === 1 ? 'w' : g.score === 0.5 ? 'd' : 'l') }, g.score === 1 ? 'Win' : g.score === 0.5 ? 'Draw' : 'Loss'), h('td', null, 'vs ' + g.opp, h('div', { class: 'small muted' }, g.reason)), h('td', null, g.rated ? (g.after - g.before >= 0 ? '+' : '') + (g.after - g.before) : 'casual'))))));
  main.append(h('div', { class: 'card stack' },
    h('h3', null, 'How ratings work'),
    h('p', { class: 'small muted', style: { margin: 0 } }, h('b', null, 'You have three separate ratings. '), 'Bots, people and puzzles are different skills, so each one is tracked on its own.'),
    h('p', { class: 'small muted', style: { margin: 0 } }, h('b', null, 'Bot League: '), `climb from the Pawn League to the King League by beating bots. It uses the Elo system with strict limits: one game moves you at most ${40} points during your first ${PLACEMENT_GAMES} placement games, then at most 20. Beating a bot far below your level earns almost nothing, so climbing takes real wins against strong bots.`),
    h('table', { class: 'tbl' }, LEAGUES.map((x, i) => h('tr', null, h('td', null, h('img', { src: PIECE_URL['w' + x[2]], style: { width: '18px', verticalAlign: '-3px' } }), ' ' + x[1]), h('td', null, i < LEAGUES.length - 1 ? `${x[0]}–${LEAGUES[i + 1][0] - 1}` : `${x[0]}+`)))),
    h('p', { class: 'small muted', style: { margin: 0 } }, `The bots' ratings were measured, not guessed: they played ${CALIB.games} games against each other, and their ratings were fitted from the results. These numbers compare fairly inside Knight Club, but they're estimates, not official FIDE or chess.com ratings.`),
    h('table', { class: 'tbl' }, BOTS.map(bt => h('tr', null, h('td', null, bt.avatar + ' ' + bt.name), h('td', null, bt.rating)))),
    h('p', { class: 'small muted', style: { margin: 0 } }, h('b', null, 'Online rating: '), 'for games against real people. It uses Glicko-2, a system many chess sites use, and moves at most 50 points per game while it is provisional ("?"), then at most 30. Games shorter than 4 moves are not rated.'),
    h('p', { class: 'small muted', style: { margin: 0 } }, h('b', null, 'Puzzle rating: '), "also Glicko-2, moving at most 30 points per puzzle while provisional, then 15. Only your first try at each puzzle counts. Each puzzle's difficulty is estimated from how long the engine has to search to find the answer and how many tempting wrong moves there are.")));
  main.append(h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', null, 'Sound effects')), h('button', { class: 'btn sm', onclick: () => { soundOn = !soundOn; profile.sound = soundOn; saveProfile(); render(); } }, icon(soundOn ? 'soundOn' : 'soundOff', 18), soundOn ? 'On' : 'Off')));
  main.append(h('button', { class: 'btn ghost block small', onclick: () => confirmBox('Reset everything?', 'This erases your ratings, games, puzzles and lessons.', 'Reset', () => { profile = DEFAULT_PROFILE(); saveProfile(); render(); }) }, 'Reset progress'));
  main.append(h('p', { class: 'small muted center' }, 'Your progress is saved in this browser on this device.'));
}

// older saves had one Glicko "rating" for bots; move it onto the new ladder
function migrate(p) {
  if (!p.v || p.v < 2) {
    if (p.rating) p.ladder = { r: Math.max(100, Math.min(3000, Math.round(p.rating.r))), games: p.games.filter(g => g.rated).length, peak: Math.round(p.rating.r) };
    delete p.rating;
    p.puzzle.rd = Math.min(p.puzzle.rd, 200); p.puzzle.games = p.puzzle.games || 0;
    p.v = 2;
  }
  p.human = p.human || { r: 800, rd: 250, vol: 0.06, games: 0 }; p.hHist = p.hHist || [800]; p.rated = p.rated || {};
  return p;
}

// ======================= BOOT =======================
function boot() {
  const saved = loadLocal();
  if (saved) { const wasOld = !saved.v; profile = Object.assign(DEFAULT_PROFILE(), saved); if (wasOld) profile.v = 1; profile = migrate(profile); }
  soundOn = profile.sound !== false;
  buildTabs();
  const hr = (location.hash || '').slice(1); if (ROUTES[hr]) route = hr;
  window.addEventListener('hashchange', () => { const hs = location.hash; const jm = hs.match(/^#join=(.+)$/); if (jm) { pendingJoin = jm[1]; friendView = 'online'; leaveOnline(); go('friend'); return; } const r = hs.slice(1); if (ROUTES[r] && r !== route) go(r); });
  initWorker();
  const jm = (location.hash || '').match(/^#join=(.+)$/);
  if (jm) { pendingJoin = jm[1]; route = 'friend'; friendView = 'online'; try { history.replaceState(null, '', '#friend'); } catch (e) { } }
  render();
}
