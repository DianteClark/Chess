// The chess board: drawing, dragging, tapping, arrows, highlights and animations.
//
// new BoardView(opts)
//   orient: 'w' | 'b'
//   getTargets(sq) -> array of target squares for a piece you may move now, [] (selectable, no moves) or null
//   onMove(from, to, dragged, promo)    promo is 'q' | 'r' | 'b' | 'n' when the board picked a promotion piece
//   needsPromo(from, to) -> bool         when given, the board shows its own promotion picker over the file
//   onPromoCancel()                      the player closed the picker without choosing
//   premove: { enabled: bool | () => bool, getTargets(sq) | color: 'w'|'b' }   queue one move while it is not your turn
//   onPremove(from, to, promo)           a queued premove became legal (default: goes through onMove)
//   onPremoveSet(from, to), onPremoveCancel()
//   drawable: bool                       right-drag / long-press arrows and circles (default: on for boards you can move on)
//   onShapes(shapes)                     the player's own arrows/circles changed
//   animate: false                       never slide pieces
// set(state, animFromTo): state {board, last, check, marks, stars, arrows, badge}
// Pieces are kept per square between set() calls and slide (by diff) to their new squares.
'use strict';
class BoardView {
  constructor(opts = {}) {
    this.opts = opts;
    this.orient = opts.orient || 'w';
    this.uid = BoardView._uid = (BoardView._uid || 0) + 1;
    this.live = !!(opts.getTargets || opts.premove || opts.drawable);
    this.drawable = opts.drawable != null ? !!opts.drawable : !!opts.getTargets;
    this.el = h('div', { class: 'board-wrap' + (this.live ? ' bd-live' : '') });
    this.boardEl = h('div', { class: 'board' });
    this.layer = h('div', { class: 'pieces' });
    this.fx = h('div', { class: 'fx' });
    this.el.append(this.boardEl, this.layer, this.fx);
    if (this.live) {
      this.el.setAttribute('tabindex', '0'); this.el.setAttribute('role', 'application');
      this.el.setAttribute('aria-roledescription', 'chess board');
      this.el.setAttribute('aria-label', 'Chess board. Arrow keys move around, Enter picks a piece and moves it.');
      this.sr = h('div', { class: 'bd-sr', 'aria-live': 'polite' }); this.el.append(this.sr);
    }
    this.sqEls = {}; this._sq = {};
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const s = r * 16 + f;
      const el = h('div', { class: 'sq ' + ((r + f) % 2 ? 'l' : 'd') });
      if (this.live) { el.id = `bd${this.uid}-${'abcdefgh'[f]}${r + 1}`; el.setAttribute('role', 'button'); }
      this.sqEls[s] = el; this._sq[s] = { k: '', mark: '', tg: '', tgEl: null, star: null, lab: null }; this.boardEl.append(el);
    }
    this.board = new Int8Array(128);
    this.sel = -1; this.targets = []; this.preSel = false; this.marks = {};
    this.last = null; this.check = -1; this.stars = null; this.arrows = []; this.badge = null;
    this.pieceEls = {};
    this.premoved = null;            // [from, to, piece] queued while it is not your turn
    this.shapes = { arrows: [], circles: [] };
    this.kf = -1; this.kbd = false;  // keyboard focus square
    this._tp = (window.CSS && CSS.supports && CSS.supports('translate', '1px')) ? 'translate' : 'transform';
    this.layout();
    this.el.addEventListener('pointerdown', e => this.down(e));
    this.el.addEventListener('pointermove', e => this.move(e));
    this.el.addEventListener('pointerup', e => this.up(e));
    this.el.addEventListener('pointercancel', e => this.cancel(e));
    this.el.addEventListener('lostpointercapture', e => { if (this._g && this._g.id === e.pointerId && this._g.drag) this.cancel(e); });
    this.el.addEventListener('contextmenu', e => { if (this.live) e.preventDefault(); });
    if (this.live) {
      this.el.addEventListener('keydown', e => this.key(e));
      this.el.addEventListener('focus', () => { if (performance.now() - (this._ptrT || -1e9) > 500) this._kbdOn(); });
      this.el.addEventListener('blur', () => { if (this.kbd) { this.kbd = false; this.el.classList.remove('kbd'); this.draw(); } });
    }
  }
  // ---------- geometry ----------
  pos(s) { const f = s & 7, r = s >> 4; return this.orient === 'w' ? [f, 7 - r] : [7 - f, r]; }
  sqXY(x, y) { return x < 0 || x > 7 || y < 0 || y > 7 ? -1 : this.orient === 'w' ? (7 - y) * 16 + x : y * 16 + (7 - x); }
  sqAt(e, rect) {
    const r = rect || this.el.getBoundingClientRect();
    return this.sqXY(Math.floor((e.clientX - r.left) / r.width * 8), Math.floor((e.clientY - r.top) / r.height * 8));
  }
  _t(x, y, u = '%') { return this._tp === 'translate' ? `${x}${u} ${y}${u}` : `translate(${x}${u},${y}${u})`; }
  _sqT(sq) { const [x, y] = this.pos(sq); return this._t(x * 100, y * 100); }
  _place(el, sq) { el.style[this._tp] = this._sqT(sq); el._sq = sq; }
  static reduced() {
    if (document.body.classList.contains('no-anim')) return true;
    const mq = BoardView._mq || (BoardView._mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null);
    return !!(mq && mq.matches);
  }
  layout() {
    for (const s in this.sqEls) {
      const [x, y] = this.pos(+s), el = this.sqEls[s];
      el.style.left = x * 12.5 + '%'; el.style.top = y * 12.5 + '%';
      el.querySelectorAll('.co').forEach(c => c.remove());
      if (y === 7) el.append(h('span', { class: 'co f' }, 'abcdefgh'[+s & 7]));
      if (x === 0) el.append(h('span', { class: 'co r' }, String((+s >> 4) + 1)));
    }
  }
  _reorient() {
    this._closePromo(); this.layout();
    for (const el of Object.values(this.pieceEls)) { if (el._anim) el._anim.cancel(); this._place(el, el._sq); }
    this._arrKey = this._badgeKey = null; this.draw();
  }
  flip() { this.orient = this.orient === 'w' ? 'b' : 'w'; this._reorient(); }
  setOrient(o) { if (o !== this.orient) { this.orient = o; this._reorient(); } }
  get dragging() { const g = this._g; return !!(g && (g.drag || g.drawing)) || performance.now() - (this._endT || -1e9) < 150; }

  // ---------- state ----------
  // state: {board:Int8Array, last:[from,to], check:sq, stars:Set, marks:{sq:cls}, arrows:[[from,to,color]], badge:{sq,cls}}
  set(state, animate) {
    const prev = this.board;
    if (state.board) this.board = Int8Array.from(state.board);
    let changed = false;
    for (let s = 0; s < 128; s++) if (prev[s] !== this.board[s]) { changed = true; break; }
    // juice: when a new move appears, the piece lands with a bounce, captures puff, phones buzz
    const lk = state.last ? state.last.join('-') + ':' + this.board[state.last[1]] : null;
    const isNewMove = lk && lk !== this.lastKey && this.lastKey !== undefined;
    this.lastKey = lk;
    this.last = state.last || null; this.check = state.check ?? -1;
    this.stars = state.stars || null; this.marks = state.marks || {};
    this.arrows = state.arrows || []; this.badge = state.badge || null;
    if (changed) {
      this._closePromo();
      if (this.shapes.arrows.length || this.shapes.circles.length) this.clearShapes();
    }
    // keep a selection (or a drag in progress) while its piece is still there; it may switch between premove and real moves
    const g = this._g, keepSq = g && g.drag ? g.sq : this.sel;
    if (keepSq >= 0 && (!changed || prev[keepSq] === this.board[keepSq]) && this.board[keepSq]) {
      const m = this._modeFor(keepSq);
      if (m && (m.t.length || !g || !g.drag)) { this.sel = keepSq; this.targets = m.t; this.preSel = m.pre; }
      else { this._abortGesture(); this.sel = -1; this.targets = []; this.preSel = false; }
    } else { if (g && g.drag) this._abortGesture(); this.sel = -1; this.targets = []; this.preSel = false; }
    this._slid = false;
    this.draw(animate);
    if (isNewMove) {
      const to = state.last[1], from = state.last[0], moved = this.board[to], was = prev[to];
      const captured = was && moved && ((was & 8) !== (moved & 8));
      const el = this.pieceEls[to];
      setTimeout(() => { if (el && el.isConnected) { el.classList.remove('land'); void el.offsetWidth; el.classList.add('land'); } if (captured) this.puff(to); }, this._slid ? 175 : 0);
      haptic(captured ? 18 : 7);
      if (this.sr && moved) this._say(`${BoardView.pieceName(moved)} ${sqName(from)} to ${sqName(to)}${captured ? ', capture' : ''}${this.check >= 0 ? ', check' : ''}`);
    }
    this._checkPremove();
  }
  puff(sq) {
    if (BoardView.reduced()) return;
    const [x, y] = this.pos(sq), p = h('div', { class: 'puff' });
    p.style.left = x * 12.5 + '%'; p.style.top = y * 12.5 + '%';
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + Math.random() * .5, d = 18 + Math.random() * 14; const i = h('i'); i.style.setProperty('--dx', Math.cos(a) * d + 'px'); i.style.setProperty('--dy', Math.sin(a) * d + 'px'); i.style.animationDelay = (Math.random() * 60) + 'ms'; p.append(i); }
    this.layer.append(p); setTimeout(() => p.remove(), 650);
  }
  static pieceName(p) { return `${p & 8 ? 'black' : 'white'} ${['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][p & 7]}`; }

  // ---------- drawing ----------
  draw(animate) {
    const dots = !(typeof profile !== 'undefined' && profile.style && profile.style.dots === false);
    const pm = this.premoved, kf = this.kbd ? this.kf : -1;
    for (let i = 0; i < 64; i++) {
      const sq = (i >> 3) * 16 + (i & 7), el = this.sqEls[sq], st = this._sq[sq];
      const k = (this.last && (this.last[0] === sq || this.last[1] === sq) ? 'L' : '') + (this.sel === sq ? 'S' : '') + (this.check === sq ? 'C' : '') + (pm && (pm[0] === sq || pm[1] === sq) ? 'P' : '') + (kf === sq ? 'K' : '');
      if (k !== st.k) {
        st.k = k;
        el.classList.toggle('last', k.includes('L')); el.classList.toggle('sel', k.includes('S'));
        el.classList.toggle('check', k.includes('C')); el.classList.toggle('pre', k.includes('P')); el.classList.toggle('kf', k.includes('K'));
      }
      const mark = this.marks[sq] || '';
      if (mark !== st.mark) { if (st.mark) el.classList.remove(...st.mark.split(' ')); if (mark) el.classList.add(...mark.split(' ')); st.mark = mark; }
      const tg = dots && this.targets.includes(sq) ? (this.board[sq] ? 'ring' : 'dot') : '';
      if (tg !== st.tg) { if (st.tgEl) st.tgEl.remove(); st.tgEl = tg ? h('div', { class: tg }) : null; if (st.tgEl) el.append(st.tgEl); st.tg = tg; }
      const star = !!(this.stars && this.stars.has(sq));
      if (star !== !!st.star) { if (st.star) st.star.remove(); st.star = star ? h('div', { class: 'star' }, icon('star', 34)) : null; if (st.star) el.append(st.star); }
      if (this.live) {
        const p = this.board[sq], lab = sqName(sq) + (p ? ', ' + BoardView.pieceName(p) : '') + (tg ? ', can move here' : '') + (this.sel === sq ? ', selected' : '');
        if (lab !== st.lab) { el.setAttribute('aria-label', lab); st.lab = lab; }
      }
    }
    this.el.classList.toggle('pm', this.preSel && this.sel >= 0);
    // a see-through copy of the premoved piece waits on its target square
    if (pm) {
      if (!this._pmEl) { this._pmEl = h('div', { class: 'bd-pmghost' }); this.layer.append(this._pmEl); }
      this._pmEl.style.backgroundImage = `url(${pieceUrl(pm[2])})`; this._place(this._pmEl, pm[1]);
    } else if (this._pmEl) { this._pmEl.remove(); this._pmEl = null; }
    this._syncPieces(animate);
    this._drawArrows(); this._drawBadge(); this._drawShapes();
  }
  // Diff the piece elements against the board: keep what stayed, slide what moved, fade what left or arrived.
  _syncPieces(hint) {
    const B = this.board, olds = new Set(Object.values(this.pieceEls)), next = {}, need = [];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = B[s]; if (!p) continue;
      let hit = null; for (const el of olds) if (el._sq === s && el._p === p) { hit = el; break; }
      if (hit) { olds.delete(hit); next[s] = hit; } else need.push(s);
    }
    const moves = [], born = [];
    const dist = (a, b) => Math.hypot((a & 7) - (b & 7), (a >> 4) - (b >> 4));
    for (const s of need.slice()) {
      const p = B[s]; let best = null, bd = 99;
      for (const el of olds) {
        if (el._p !== p) continue;
        const d = hint && hint[1] === s && el._sq === hint[0] ? -1 : dist(el._sq, s);
        if (d < bd) { bd = d; best = el; }
      }
      if (best) { olds.delete(best); next[s] = best; moves.push([best, best._sq, s, false]); need.splice(need.indexOf(s), 1); }
    }
    // promotion: a pawn that vanished next to a new piece on the last rank becomes that piece
    for (const s of need.slice()) {
      const p = B[s], r = s >> 4; if ((p & 7) === 1 || (r !== 0 && r !== 7)) continue;
      let best = null;
      for (const el of olds) if ((el._p & 7) === 1 && (el._p & 8) === (p & 8) && Math.abs((el._sq >> 4) - r) === 1 && Math.abs((el._sq & 7) - (s & 7)) <= 1 && (!hint || hint[1] !== s || el._sq === hint[0])) { best = el; break; }
      if (best) { olds.delete(best); next[s] = best; moves.push([best, best._sq, s, true]); need.splice(need.indexOf(s), 1); }
    }
    for (const s of need) { const el = h('div', { class: 'piece' }); el.addEventListener('animationend', () => el.classList.remove('bd-in', 'bd-prom')); el._p = B[s]; this._setImg(el); this._place(el, s); this.layer.append(el); next[s] = el; born.push(el); }
    const anim = !BoardView.reduced() && this.opts.animate !== false && moves.length + olds.size <= (hint ? 8 : 5) && moves.length + born.length + olds.size < 12;
    for (const [el, from, to, promo] of moves) {
      let fromT = null;
      if (anim) fromT = el._anim ? getComputedStyle(el)[this._tp] : this._sqT(from);
      if (el._anim) el._anim.cancel();
      this._place(el, to);
      if (promo) { el._p = B[to]; }
      if (anim && fromT && fromT !== 'none') {
        el.classList.add('moving');
        const a = el.animate([{ [this._tp]: fromT }, { [this._tp]: this._sqT(to) }], { duration: 170, easing: 'cubic-bezier(.2,.75,.25,1)' });
        el._anim = a; this._slid = true;
        a.onfinish = a.oncancel = () => { if (el._anim === a) { el._anim = null; el.classList.remove('moving'); } };
        if (promo) setTimeout(() => { if (el._p === B[to]) { this._setImg(el); el.classList.remove('bd-prom'); void el.offsetWidth; el.classList.add('bd-prom'); } }, 150);
      }
      if (promo && !anim) this._setImg(el);
    }
    for (const el of Object.values(next)) { this._setImg(el); if (el._hid) { el._hid = false; el.classList.remove('bd-hide'); } }
    for (const el of olds) {
      if (el._anim) el._anim.cancel();
      if (anim) { el.classList.add('bd-out'); el._dead = true; setTimeout(() => el.remove(), 260); } else el.remove();
    }
    if (anim) for (const el of born) el.classList.add('bd-in');
    this.pieceEls = next;
  }
  _setImg(el) { if (el._dead) return; const u = pieceUrl(el._p); if (el._u !== u) { el._u = u; el.style.backgroundImage = `url(${u})`; } }
  _arrowSvg(list, cls, width, opacity) {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 8 8'); svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true');
    const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
    for (const [a, b, col, op] of list) {
      const c = col || '#7cc04a', o = op ?? opacity;
      if (a === b) { const [x, y] = this.pos(a); svg.append(mk('circle', { cx: x + .5, cy: y + .5, r: .44, fill: 'none', stroke: c, 'stroke-width': .075, opacity: o })); continue; }
      const [x1, y1] = this.pos(a), [x2, y2] = this.pos(b);
      const ax = x1 + .5, ay = y1 + .5, bx = x2 + .5, by = y2 + .5;
      // knight moves get an L-shaped arrow (long leg first)
      const dx = x2 - x1, dy = y2 - y1, isN = cls === 'bd-shapes' && ((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1));
      const mx = isN ? (Math.abs(dx) === 2 ? bx : ax) : ax, my = isN ? (Math.abs(dx) === 2 ? ay : by) : ay;
      const len = Math.hypot(bx - mx, by - my), ux = (bx - mx) / len, uy = (by - my) / len;
      const hl = width * 1.9, ex = bx - ux * hl, ey = by - uy * hl, px = -uy, py = ux, hw = width * 1.5;
      const sx = isN ? ax : ax + ux * .18, sy = isN ? ay : ay + uy * .18;
      svg.append(mk('path', { d: isN ? `M${sx} ${sy}L${mx} ${my}L${ex} ${ey}` : `M${sx} ${sy}L${ex} ${ey}`, fill: 'none', stroke: c, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o }));
      svg.append(mk('polygon', { points: `${bx - ux * .04},${by - uy * .04} ${ex + px * hw},${ey + py * hw} ${ex - px * hw},${ey - py * hw}`, fill: c, opacity: o }));
    }
    return svg;
  }
  // arrows from the app (e.g. best move in Game Review)
  _drawArrows() {
    const key = this.orient + JSON.stringify(this.arrows || []);
    if (key === this._arrKey) return; this._arrKey = key;
    if (this._arrEl) { this._arrEl.remove(); this._arrEl = null; }
    if (this.arrows && this.arrows.length) { this._arrEl = this._arrowSvg(this.arrows, 'arrows', .17, .85); this.layer.append(this._arrEl); }
  }
  _drawBadge() {
    const b0 = this.badge, key = b0 ? this.orient + b0.sq + b0.cls : '';
    if (key === this._badgeKey) return; this._badgeKey = key;
    if (this._badgeEl) { this._badgeEl.remove(); this._badgeEl = null; }
    if (b0 && typeof CLASSES !== 'undefined' && CLASSES[b0.cls]) {
      const [x, y] = this.pos(b0.sq);
      const b = classBadge(b0.cls, 20); b.classList.add('sqbadge');
      b.style.left = `calc(${(x + 1) * 12.5}% - 14px)`; b.style.top = `calc(${y * 12.5}% - 6px)`;
      this.layer.append(b); this._badgeEl = b;
    }
  }
  // the player's own arrows and circles (plus the one being drawn)
  _drawShapes() {
    const C = BoardView.COLORS, d = this._drawS;
    const list = this.shapes.circles.map(([s, c]) => [s, s, C[c]]).concat(this.shapes.arrows.map(([a, b, c]) => [a, b, C[c]]));
    if (d && d.to >= 0) list.push([d.from, d.to, C[d.color], .5]);
    const key = this.orient + JSON.stringify(list);
    if (key === this._shKey) return; this._shKey = key;
    if (this._shEl) { this._shEl.remove(); this._shEl = null; }
    if (list.length) { this._shEl = this._arrowSvg(list, 'bd-shapes', .15, .8); this.layer.append(this._shEl); }
  }
  clearShapes() { this.shapes = { arrows: [], circles: [] }; this._drawShapes(); if (this.opts.onShapes) this.opts.onShapes(this.shapes); }

  // ---------- selecting and moving ----------
  _modeFor(sq) {
    const t = this.opts.getTargets ? this.opts.getTargets(sq) : null;
    if (t) return { t, pre: false };
    const pm = this.opts.premove;
    if (pm && this.board[sq] && (typeof pm.enabled === 'function' ? pm.enabled() : pm.enabled !== false)) {
      const pt = pm.getTargets ? pm.getTargets(sq) : pm.color ? BoardView.premoveTargets(this.board, sq, pm.color) : null;
      if (pt && pt.length) return { t: pt, pre: true };
    }
    return null;
  }
  select(sq, targets, pre = false) { this.sel = sq; this.targets = targets; this.preSel = pre; this.draw(); }
  clearSel() { if (this.sel >= 0 || this.targets.length) { this.sel = -1; this.targets = []; this.preSel = false; this.draw(); } }
  // one tap / Enter on a square. Returns {piece, wasSel} when a piece got picked up (so a drag may follow).
  _tap(sq) {
    if (this.sel >= 0 && this.sel !== sq && this.targets.includes(sq)) { this._choose(this.sel, sq, false); return null; }
    const m = this._modeFor(sq);
    if (m) { const wasSel = this.sel === sq; this.select(sq, m.t, m.pre); return { piece: m.t.length > 0, wasSel }; }
    if (this.premoved) this.cancelPremove();
    this.clearSel(); return null;
  }
  _choose(from, to, dragged) {
    if (this.preSel) { this._setPremove(from, to); return; }
    this.commit(from, to, dragged);
  }
  commit(from, to, dragged) {
    this.sel = -1; this.targets = []; this.preSel = false;
    if (this.opts.needsPromo && this.opts.needsPromo(from, to)) { this.draw(); this._promo(from, to, dragged); return; }
    if (this.opts.onMove) this.opts.onMove(from, to, dragged);
  }
  // move a piece element on screen before the app confirms (drops, the promotion picker)
  _showMove(from, to, slide) {
    const el = Object.values(this.pieceEls).find(x => x._sq === from); if (!el) return;
    for (const o of Object.values(this.pieceEls)) if (o !== el && o._sq === to) { o._hid = true; o.classList.add('bd-hide'); }
    const fromT = this._sqT(from); if (el._anim) { el._anim.cancel(); el._anim = null; } el.classList.remove('moving'); this._place(el, to);
    if (slide && !BoardView.reduced()) { if (el._anim) el._anim.cancel(); el._anim = el.animate([{ [this._tp]: fromT }, { [this._tp]: this._sqT(to) }], { duration: 150, easing: 'cubic-bezier(.2,.75,.25,1)' }); el._anim.onfinish = () => { el._anim = null; }; }
  }

  // ---------- promotion picker (over the promotion file) ----------
  _promo(from, to, dragged) {
    const p = this.board[from], c = p & 8 ? 'b' : 'w';
    this._showMove(from, to, !dragged);
    const [x, y] = this.pos(to), down = y < 4;
    const names = { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' };
    const done = t => {
      this._closePromo();
      if (!t) { this.draw(); if (this.opts.onPromoCancel) this.opts.onPromoCancel(); return; }
      haptic(10);
      if (this.opts.onMove) this.opts.onMove(from, to, dragged, t);
    };
    const col = h('div', { class: 'bd-promo-col' + (down ? ' down' : ' up'), style: { left: x * 12.5 + '%', top: (down ? y : y - 3) * 12.5 + '%' } },
      ['q', 'n', 'r', 'b'].map((t, i) => h('button', { class: 'bd-pp', 'data-p': t, 'aria-label': `Promote to ${names[t]}`, style: { backgroundImage: `url(${PIECE_URL[c + t]})`, animationDelay: i * 35 + 'ms' }, onclick: e => { e.stopPropagation(); done(t); } })),
      h('button', { class: 'bd-pp-x', 'aria-label': 'Cancel', onclick: e => { e.stopPropagation(); done(null); } }, icon('x', 16)));
    const box = h('div', { class: 'bd-promo', role: 'dialog', 'aria-label': 'Choose a piece', onclick: e => { if (e.target === box) done(null); } }, col);
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); this.el.focus(); }
      const bs = [...col.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && i >= 0) { e.preventDefault(); e.stopPropagation(); bs[(i + ((e.key === 'ArrowDown') === down ? 1 : bs.length - 1)) % bs.length].focus(); }
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); e.stopPropagation(); }
    });
    this.promoEl = box; this.el.append(box); this._promoDone = done;
    if (typeof beep === 'function') beep('pop');
    if (this.kbd) setTimeout(() => { const b = col.querySelector('button'); if (b) b.focus(); }, 0);
  }
  _closePromo() { if (this.promoEl) { this.promoEl.remove(); this.promoEl = null; this._promoDone = null; } }

  // ---------- premoves ----------
  _setPremove(from, to) {
    this.premoved = [from, to, this.board[from]];
    this.sel = -1; this.targets = []; this.preSel = false; this.draw(); haptic(6);
    if (this._pmEl && !BoardView.reduced()) this._pmEl.animate([{ opacity: 0, scale: .6 }, { opacity: .55, scale: 1 }], { duration: 160, easing: 'ease-out' });
    if (this.opts.onPremoveSet) this.opts.onPremoveSet(from, to);
  }
  cancelPremove() {
    if (!this.premoved) return; this.premoved = null; this.draw();
    if (this.opts.onPremoveCancel) this.opts.onPremoveCancel();
  }
  _checkPremove() {
    const pm = this.premoved; if (!pm) return;
    const [from, to, p] = pm;
    if (this.board[from] !== p) { this.cancelPremove(); return; }
    const t = this.opts.getTargets ? this.opts.getTargets(from) : null;
    if (!t) return; // still not your turn
    this.premoved = null; this.draw();
    if (!t.includes(to)) { if (this.opts.onPremoveCancel) this.opts.onPremoveCancel(); return; }
    setTimeout(() => {
      const t2 = this.opts.getTargets ? this.opts.getTargets(from) : null;
      if (!t2 || !t2.includes(to) || this.board[from] !== p) return;
      const promo = this.opts.needsPromo && this.opts.needsPromo(from, to) ? 'q' : undefined;
      if (this.opts.onPremove) this.opts.onPremove(from, to, promo);
      else if (this.opts.onMove) this.opts.onMove(from, to, false, promo);
    }, 0);
  }
  // pseudo-legal targets for premoves: piece geometry only, ignoring blockers (they may be gone by then)
  static premoveTargets(board, sq, color) {
    const p = board[sq]; if (!p || (color && ((p & 8) ? 'b' : 'w') !== color)) return null;
    const t = p & 7, black = !!(p & 8), out = [];
    const ray = (d, slide) => { let s = sq + d; while (!(s & 0x88)) { out.push(s); if (!slide) break; s += d; } };
    if (t === 1) { const f = black ? -16 : 16, r = sq >> 4; [f, f - 1, f + 1].forEach(d => ray(d, false)); if (r === (black ? 6 : 1)) ray(2 * f, false); }
    else if (t === 2) [33, 31, 18, 14, -33, -31, -18, -14].forEach(d => ray(d, false));
    else if (t === 6) { [1, -1, 16, -16, 15, 17, -15, -17].forEach(d => ray(d, false)); if (sq === (black ? 0x74 : 0x04)) { out.push(sq + 2, sq - 2); } }
    else { if (t !== 4) [15, 17, -15, -17].forEach(d => ray(d, true)); if (t !== 3) [1, -1, 16, -16].forEach(d => ray(d, true)); }
    return out;
  }

  // ---------- pointer input ----------
  down(e) {
    this._ptrT = performance.now();
    if (this.kbd) { this.kbd = false; this.el.classList.remove('kbd'); }
    if (this.promoEl) return;
    if (!this.live) { this.clearSel(); return; }
    if (!this._ptrs || !this._g) this._ptrs = new Set();
    this._ptrs.add(e.pointerId);
    if (this._ptrs.size > 1) { this._abortGesture(); this.clearSel(); return; } // a second finger cancels
    const rect = this.el.getBoundingClientRect(), sq = this.sqAt(e, rect); if (sq < 0) return;
    if (e.pointerType === 'mouse' && e.button === 2) {
      if (this.premoved) this.cancelPremove();
      if (this.drawable) { this.clearSel(); this._g = { id: e.pointerId, sq, rect, drawing: true }; this._drawS = { from: sq, to: sq, color: BoardView.colorFor(e) }; this._capture(e); this._drawShapes(); }
      return;
    }
    if (e.button > 0) return;
    const g = this._g = { id: e.pointerId, sq, rect, x: e.clientX, y: e.clientY, type: e.pointerType };
    this._capture(e);
    const r = this._tap(sq);
    if (r && r.piece && this.pieceEls[sq]) { g.piece = this.pieceEls[sq]; g.wasSel = r.wasSel; }
    if (this.drawable && e.pointerType !== 'mouse') g.lp = setTimeout(() => this._longPress(g), 430);
  }
  _capture(e) { try { this.el.setPointerCapture(e.pointerId); } catch (_) { } }
  _longPress(g) {
    g.lp = null; if (this._g !== g || g.drag) return;
    haptic(12);
    if (g.piece) { g.lpFired = true; return; }
    g.drawing = true; this.clearSel(); this._drawS = { from: g.sq, to: g.sq, color: 'g' }; this._drawShapes();
  }
  move(e) {
    const g = this._g; if (!g || e.pointerId !== g.id) return;
    if (g.drawing) {
      const to = this.sqAt(e, g.rect);
      if (this._drawS && to !== this._drawS.to) { this._drawS.to = to; this._drawShapes(); }
      return;
    }
    const dist = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (g.lp && dist > 9) { clearTimeout(g.lp); g.lp = null; }
    if (!g.piece) return;
    if (!g.drag) { if (dist < (g.type === 'mouse' ? 3 : 7)) return; this._startDrag(g); }
    g.cx = e.clientX; g.cy = e.clientY;
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this._paintDrag(); });
  }
  _startDrag(g) {
    g.drag = true; g.lpFired = false; if (g.lp) { clearTimeout(g.lp); g.lp = null; }
    g.rect = this.el.getBoundingClientRect(); g.w = g.rect.width / 8;
    const el = g.piece; if (el._anim) { el._anim.cancel(); }
    el.classList.add('drag'); this.el.classList.add('bd-dragging'); this.el.classList.toggle('bd-touch', g.type === 'touch');
    g.ghost = h('div', { class: 'bd-ghost' }); g.ghost.style.backgroundImage = el.style.backgroundImage; this._place(g.ghost, g.sq); el._sq = g.sq;
    g.hov = h('div', { class: 'bd-hov' }); g.hov.style.display = 'none';
    this.layer.append(g.ghost, g.hov);
    haptic(5);
  }
  _paintDrag() {
    const g = this._g; if (!g || !g.drag) return;
    const r = g.rect, w = g.w, lift = g.type === 'touch' ? w * .42 : 0;
    g.lx = g.cx - r.left - w / 2; g.ly = g.cy - r.top - w / 2 - lift;
    g.piece.style[this._tp] = this._t(g.lx, g.ly, 'px');
    const sq = this.sqXY(Math.floor((g.cx - r.left) / w), Math.floor((g.cy - r.top) / w));
    if (sq !== g.hsq) {
      g.hsq = sq;
      if (sq < 0) g.hov.style.display = 'none';
      else { g.hov.style.display = ''; this._place(g.hov, sq); g.hov.classList.toggle('ok', sq !== g.sq && this.targets.includes(sq)); }
    }
  }
  _endDrag(g) {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    g.piece.classList.remove('drag'); this.el.classList.remove('bd-dragging', 'bd-touch');
    if (g.ghost) g.ghost.remove(); if (g.hov) g.hov.remove();
    this._endT = performance.now();
  }
  _snapBack(g) {
    const el = g.piece, fromT = g.lx != null ? this._t(g.lx, g.ly, 'px') : null;
    this._place(el, g.sq);
    if (fromT && !BoardView.reduced()) {
      el.classList.add('moving');
      const a = el._anim = el.animate([{ [this._tp]: fromT }, { [this._tp]: this._sqT(g.sq) }], { duration: 180, easing: 'cubic-bezier(.2,.75,.25,1)' });
      a.onfinish = a.oncancel = () => { if (el._anim === a) { el._anim = null; el.classList.remove('moving'); } };
    }
  }
  up(e) {
    if (this._ptrs) this._ptrs.delete(e.pointerId);
    const g = this._g; if (!g || e.pointerId !== g.id) return;
    this._g = null; if (g.lp) clearTimeout(g.lp);
    if (g.drawing) { this._endDraw(); this._endT = performance.now(); return; }
    if (g.drag) {
      const sq = this.sqAt(e, g.rect);
      this._endDrag(g);
      if (sq >= 0 && sq !== g.sq && this.targets.includes(sq)) {
        if (this.preSel) { this._snapBack(g); this._setPremove(g.sq, sq); }
        else { this._showMove(g.sq, sq, false); this.commit(g.sq, sq, true); }
      } else { this._snapBack(g); if (sq !== g.sq) this.clearSel(); }
      return;
    }
    if (g.lpFired) { this.clearSel(); this._toggleShape(g.sq, g.sq, 'g'); return; }
    if (g.wasSel) this.clearSel(); // tap the selected piece again to put it down
  }
  cancel(e) {
    if (this._ptrs && e) this._ptrs.delete(e.pointerId);
    if (this._g && (!e || e.pointerId === this._g.id)) this._abortGesture();
  }
  _abortGesture() {
    const g = this._g; if (!g) return; this._g = null;
    if (g.lp) clearTimeout(g.lp);
    if (g.drawing) { this._drawS = null; this._drawShapes(); }
    if (g.drag) { this._endDrag(g); this._snapBack(g); }
  }
  static colorFor(e) { const alt = e.altKey || e.ctrlKey || e.metaKey; return e.shiftKey && alt ? 'y' : e.shiftKey ? 'r' : alt ? 'b' : 'g'; }
  _endDraw() {
    const d = this._drawS; this._drawS = null;
    if (!d || d.to < 0) { this._drawShapes(); return; }
    this._toggleShape(d.from, d.to, d.color);
  }
  _toggleShape(from, to, color) {
    const S = this.shapes;
    if (from === to) {
      const i = S.circles.findIndex(c => c[0] === from);
      if (i >= 0) { const same = S.circles[i][1] === color; S.circles.splice(i, 1); if (!same) S.circles.push([from, color]); } else S.circles.push([from, color]);
    } else {
      const i = S.arrows.findIndex(a => a[0] === from && a[1] === to);
      if (i >= 0) { const same = S.arrows[i][2] === color; S.arrows.splice(i, 1); if (!same) S.arrows.push([from, to, color]); } else S.arrows.push([from, to, color]);
    }
    this._drawShapes(); haptic(4);
    if (this.opts.onShapes) this.opts.onShapes(S);
  }

  // ---------- keyboard ----------
  _kbdOn() {
    this.kbd = true; this.el.classList.add('kbd');
    if (this.kf < 0) this.kf = this.sel >= 0 ? this.sel : this.orient === 'w' ? 0x14 : 0x64;
    this.el.setAttribute('aria-activedescendant', this.sqEls[this.kf].id); this.draw();
  }
  key(e) {
    if (this.promoEl || e.target !== this.el || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'Escape') {
      if (this.sel >= 0 || this.premoved || this.shapes.arrows.length || this.shapes.circles.length) { e.preventDefault(); e.stopPropagation(); this.clearSel(); this.cancelPremove(); this.clearShapes(); }
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!this.kbd) { if (k === 'Enter' || k === ' ') { e.preventDefault(); this._kbdOn(); } return; } // arrows stay with the page until keyboard mode
    if (dir) {
      e.preventDefault(); e.stopPropagation();
      const [x, y] = this.pos(this.kf), nx = Math.max(0, Math.min(7, x + dir[0])), ny = Math.max(0, Math.min(7, y + dir[1]));
      this.kf = this.sqXY(nx, ny); this.el.setAttribute('aria-activedescendant', this.sqEls[this.kf].id); this.draw();
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault(); e.stopPropagation();
      const r = this._tap(this.kf); if (r && r.wasSel) this.clearSel();
    }
  }
  _say(t) { if (this.sr) { this.sr.textContent = ''; setTimeout(() => { if (this.sr) this.sr.textContent = t; }, 30); } }

  burst(name) {
    const b = h('div', { class: 'burst' }, icon(name || 'star', 90, 'burst-ic ' + (name || 'star'))); this.fx.append(b); setTimeout(() => b.remove(), 800);
  }
}
BoardView.COLORS = { g: '#4fb83f', r: '#e5483a', b: '#3a8ee6', y: '#f2b632' };

// ======================= GAME MODEL =======================
