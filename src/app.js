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
    else if (k === 'html') el.innerHTML = tr(v);
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
// Sound packs, all synthesized (no audio files): wood (default), soft, retro
let noiseBuf = null;
function beep(kind, opts) {
  if (!soundOn) return;
  if (typeof sfx === 'function') { try { sfx(kind, opts); } catch (e) { } return; }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const pack = (profile.style && profile.style.sound) || 'wood';
    const t = audioCtx.currentTime, out = audioCtx.createGain(); out.gain.value = 0.9; out.connect(audioCtx.destination);
    const tone = (freq, dur, type = 'sine', vol = .12, at = 0, slide = 0) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t + at); if (slide) o.frequency.linearRampToValueAtTime(freq * slide, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + .008); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + dur + .02);
    };
    const knock = (freq, dur, vol, at = 0) => {
      if (!noiseBuf) { noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * .2, audioCtx.sampleRate); const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, 3); }
      const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
      src.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4;
      g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      src.connect(bp); bp.connect(g); g.connect(out); src.start(t + at); src.stop(t + at + dur + .02);
      tone(freq / 4, dur * .8, 'sine', vol * .25, at);
    };
    const chord = (base, type, vol) => { [1, 1.25, 1.5, 2].forEach((m, k) => tone(base * m, .45, type, vol, k * .07)); };
    if (pack === 'wood') {
      if (kind === 'move') knock(1700, .07, .9);
      else if (kind === 'capture') { knock(900, .11, 1.2); knock(1500, .05, .5, .02); }
      else if (kind === 'check') { knock(1600, .06, .8); tone(880, .14, 'triangle', .08, .04); }
      else if (kind === 'star') tone(1320, .12, 'sine', .1, 0, 1.15);
      else if (kind === 'bad') tone(220, .2, 'triangle', .1, 0, .8);
      else if (kind === 'win') chord(523, 'triangle', .07);
      else knock(1400, .05, .6);
    } else if (pack === 'retro') {
      const cfg = { move: [520, .05], capture: [300, .09], check: [880, .12], star: [990, .1], bad: [160, .2] }[kind];
      if (kind === 'win') chord(392, 'square', .04); else if (cfg) tone(cfg[0], cfg[1], 'square', .07);
    } else {
      const cfg = { move: [660, .06], capture: [440, .1], check: [990, .14], star: [1320, .1], bad: [200, .2] }[kind];
      if (kind === 'win') chord(523, 'sine', .07); else if (cfg) tone(cfg[0], cfg[1], 'sine', .1);
    }
  } catch (e) { }
}

// ======================= UI HELPERS =======================
function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg); document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
function modal(build, { dismiss = true } = {}) {
  const bg = h('div', { class: 'modal-bg' });
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
  box.append = (...a) => Element.prototype.append.apply(box, a.filter(x => x != null && x !== false));
  bg.append(box); document.body.append(bg);
  const prevFocus = document.activeElement;
  let closed = false;
  const close = () => { if (closed) return; closed = true; document.removeEventListener('keydown', onKey, true); bg.classList.add('closing'); beep('close'); setTimeout(() => bg.remove(), 180); try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (e) { } };
  const onKey = e => { if (e.key === 'Escape' && dismiss) { e.preventDefault(); close(); } else if (e.key === 'Tab') { const f = [...box.querySelectorAll('button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } };
  document.addEventListener('keydown', onKey, true);
  if (dismiss) {
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    // swipe the sheet down to dismiss it
    let y0 = null; box.addEventListener('touchstart', e => { y0 = box.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    box.addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) box.style.transform = `translateY(${dy}px)`; }, { passive: true });
    box.addEventListener('touchend', e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; box.style.transition = 'transform .2s'; if (dy > 90) close(); else box.style.transform = ''; setTimeout(() => { box.style.transition = ''; }, 220); }, { passive: true });
  }
  build(box, close);
  const t = box.querySelector('h2,h3'); if (t) { t.id = t.id || 'dlg' + Math.random().toString(36).slice(2, 8); box.setAttribute('aria-labelledby', t.id); }
  beep('open'); requestAnimationFrame(() => { try { box.focus({ preventScroll: true }); } catch (e) { } });
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
let route = 'home';
const appEl = () => $('#app');
const ROUTES = { home: m => renderHome(m), play: renderPlay, friend: renderFriend, puzzles: renderPuzzles, learn: renderLearn, me: renderMe, review: m => renderReview(m), analysis: m => renderAnalysis(m), world: m => renderWorldGames(m) };
let navDir = '';
const TAB_ORDER = ['home', 'puzzles', 'play', 'learn', 'me'];
function go(r) { if (!ROUTES[r]) r = 'home'; { const a = TAB_ORDER.indexOf(route), b = TAB_ORDER.indexOf(r); navDir = a >= 0 && b >= 0 && b < a ? 'back' : ''; } route = r; try { if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r); } catch (e) { } render(); window.scrollTo(0, 0); }
let cleanups = [];
function cleanup() { cleanups.forEach(f => { try { f(); } catch (e) { } }); cleanups = []; }
let lastRoute = null;
function render() {
  cleanup(); leaveFocus();
  const app = appEl(); app.innerHTML = '';
  const logo = h('img', { src: 'icon.svg', alt: '', onerror: e => { e.target.src = PIECE_URL.wn; } });
  app.append(h('div', { class: 'topbar' },
    h('button', { class: 'logo', onclick: () => go('home'), 'aria-label': 'Clubhouse' }, logo, 'Knight Club'),
    typeof inboxButton === 'function' ? inboxButton() : null,
    h('button', { class: 'chip', id: 'rchip', 'aria-label': 'Your ratings', onclick: () => go('me') })));
  refreshChip();
  // a fresh view animates in when you move between screens (not on in-place refreshes)
  const changed = lastRoute !== route + '|' + subView();
  const main = h('div', { class: 'stack' + (changed ? ' view' + (navDir === 'back' ? ' back' : '') : '') }); app.append(main);
  lastRoute = route + '|' + subView(); navDir = '';
  ROUTES[route](main);
  if (!focusOn) setTimeout(() => { if (!focusOn) flushRewards(); }, 500);
  const tabFor = { friend: 'home', review: 'me', analysis: 'play' }[route] || route;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.r === tabFor));
}
function subView() { return [typeof friendView !== 'undefined' ? friendView : '', typeof puzMode !== 'undefined' ? puzMode : '', typeof lessonOpen !== 'undefined' && lessonOpen ? lessonOpen.id + lessonStep : '', typeof courseOpen !== 'undefined' && courseOpen ? courseOpen.id : '', typeof meView !== 'undefined' ? meView : '', profile.current ? 'g' : '', typeof worldView !== 'undefined' && worldView ? [worldView.g, worldView.play ? 'p' : '', worldView.lesson ? worldView.lesson.id + worldView.step : ''].join(':') : ''].join('/'); }
// small taps get a soft click: dock tabs and segmented switches
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.tabs button'); if (b) beep('tap'); }, true);
function buildTabs() {
  const items = [['home', 'home', 'Club'], ['puzzles', 'puzzle', 'Puzzles'], ['play', null, 'Play'], ['learn', 'learn', 'Learn'], ['me', 'user', 'Me']];
  const inner = h('div', { class: 'inner' }, items.map(([r, ic, l]) => ic ? h('button', { 'data-r': r, onclick: () => { haptic(6); go(r); } }, icon(ic, 25), l)
    : h('button', { 'data-r': r, class: 'medal', 'aria-label': 'Play', onclick: () => { haptic(10); go(r); } }, h('div', { class: 'disc' }, h('img', { src: PIECE_URL.bn, alt: '' })), h('span', { class: 'lab' }, l))));
  document.body.append(h('nav', { class: 'tabs' }, inner));
}
function haptic(ms) { try { if (navigator.vibrate && !(profile.style && profile.style.haptics === false)) navigator.vibrate(ms); } catch (e) { } }

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

function stageBanner(key, title, sub, extra) {
  return h('div', { class: 'stage short' }, roomArt(key), extra || null, h('div', { class: 'stage-lab' }, h('h2', null, title), sub ? h('small', null, sub) : null));
}
function myAvatar() { return (profile.style && profile.style.avatar) || 'you'; }
function playSound(res) { if (!res) return; beep(res.check ? 'check' : res.cap ? 'capture' : 'move'); }

// ======================= ME / PROFILE =======================
function sparkline(arr, color, emptyMsg) {
  const data = arr.slice(-60); if (data.length < 2) return h('div', { class: 'small muted' }, emptyMsg || 'Play rated games to see your graph.');
  const min = Math.min(...data) - 20, max = Math.max(...data) + 20, W = 300, H = 70;
  const pts = data.map((v, i) => [i / (data.length - 1) * W, H - (v - min) / (max - min) * H]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const el = h('div'); el.innerHTML = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d} L${W} ${H} L0 ${H} Z" fill="${color}" opacity=".15"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  return el;
}
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

const APP_VERSION = '13.0';
function whatsNew(force, freshAtBoot) {
  if (!force && profile.seenVersion === APP_VERSION) return;
  const firstEver = freshAtBoot != null ? freshAtBoot : (!profile.seenVersion && !profile.games.length && !Object.keys(profile.lessons).length);
  profile.seenVersion = APP_VERSION; saveProfile();
  if (firstEver && !force) return; // brand-new players go straight in
  const items = [
    ['board', 'A brand new board', 'Pieces lift under your finger, slide smoothly, promote right on the board. Premoves, and draw your own arrows.'],
    ['play', 'Games with character', 'A versus intro, bots that talk back, a game menu, a full move list and clocks with real tension.'],
    ['puzzle', 'Puzzle Battle and Streak', 'Race a bot through puzzles, go for your longest streak, and replay the puzzles you missed.'],
    ['trophy', 'Season 1: The Opening', 'A 30-tier reward track, avatar frames, titles, 100 trophies and your full game history.'],
    ['phone', 'Locked to your screen', 'No more zooming or shifting, a landscape layout, and bigger boards on tablets.'],
  ];

  modal((box, close) => box.append(h('div', { class: 'center' }, typeof hootEl === 'function' ? hootEl('cheer', 84) : hoot(72)), h('h2', { class: 'center' }, `Knight Club 13 is here!`), h('p', { class: 'center muted small' }, `Knight Club ${APP_VERSION} is here. This is what changed:`),
    h('div', { class: 'stack' }, items.map(([ic, t, d]) => h('div', { class: 'quest' }, h('div', { class: 'qi' }, icon(ic, 18)), h('div', { class: 'grow' }, h('div', { class: 'qt' }, t), h('div', { class: 'small muted' }, d))))),
    h('div', { style: { height: '12px' } }), h('button', { class: 'btn primary block', onclick: () => { close(); confetti(); } }, "Let's play!")));
}

// ======================= BOOT =======================
function boot() {
  const saved = loadLocal();
  if (saved) { const wasOld = !saved.v; profile = Object.assign(DEFAULT_PROFILE(), saved); if (wasOld) profile.v = 1; profile = migrate(profile); }
  soundOn = profile.sound !== false;
  if (typeof applyLoginGifts === 'function') applyLoginGifts();
  applyStyle();
  buildTabs();
  const hr = (location.hash || '').slice(1); if (ROUTES[hr]) route = hr;
  window.addEventListener('hashchange', () => { const hs = location.hash; const jm = hs.match(/^#join=(.+)$/); if (jm) { pendingJoin = jm[1]; friendView = 'online'; leaveOnline(); go('friend'); return; } const r = hs.slice(1); if (ROUTES[r] && r !== route) go(r); });
  initWorker();
  const jm = (location.hash || '').match(/^#join=(.+)$/);
  if (jm) { pendingJoin = jm[1]; route = 'friend'; friendView = 'online'; try { history.replaceState(null, '', '#friend'); } catch (e) { } }
  render();
  const freshAtBoot = !profile.seenVersion && !profile.games.length && !Object.keys(profile.lessons).length;
  setTimeout(() => whatsNew(false, freshAtBoot), 600);
}
