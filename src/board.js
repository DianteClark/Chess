// The chess board: drawing, dragging, tapping, arrows, highlights and animations.
'use strict';
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
    const prev = this.board;
    if (state.board) this.board = Int8Array.from(state.board);
    // juice: when a new move appears, the piece lands with a bounce, captures puff, phones buzz
    const lk = state.last ? state.last.join('-') + ':' + this.board[state.last[1]] : null;
    const isNewMove = lk && lk !== this.lastKey && this.lastKey !== undefined;
    this.lastKey = lk;
    this.last = state.last || null; this.check = state.check ?? -1;
    this.stars = state.stars || null; this.marks = state.marks || {};
    this.arrows = state.arrows || []; this.badge = state.badge || null;
    this.sel = -1; this.targets = [];
    this.draw(animate);
    if (isNewMove) {
      const to = state.last[1], moved = this.board[to], was = prev[to];
      const captured = was && moved && ((was & 8) !== (moved & 8));
      const el = this.pieceEls[to];
      setTimeout(() => { if (el && el.isConnected) { el.classList.remove('land'); void el.offsetWidth; el.classList.add('land'); } if (captured) this.puff(to); }, animate ? 190 : 0);
      haptic(captured ? 18 : 7);
    }
  }
  puff(sq) {
    if (document.body.classList.contains('no-anim')) return;
    const [x, y] = this.pos(sq), p = h('div', { class: 'puff' });
    p.style.left = x * 12.5 + '%'; p.style.top = y * 12.5 + '%';
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + Math.random() * .5, d = 18 + Math.random() * 14; const i = h('i'); i.style.setProperty('--dx', Math.cos(a) * d + 'px'); i.style.setProperty('--dy', Math.sin(a) * d + 'px'); i.style.animationDelay = (Math.random() * 60) + 'ms'; p.append(i); }
    this.layer.append(p); setTimeout(() => p.remove(), 650);
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
      if (this.targets.includes(sq) && !(profile.style && profile.style.dots === false)) el.append(h('div', { class: this.board[sq] ? 'ring' : 'dot' }));
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
    // arrows (e.g. best move in Game Review) and a grade badge on a square
    if (this.arrows && this.arrows.length) {
      const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 8 8'); svg.setAttribute('class', 'arrows');
      for (const [a, b, col] of this.arrows) {
        const [x1, y1] = this.pos(a), [x2, y2] = this.pos(b);
        const ax = x1 + .5, ay = y1 + .5, bx = x2 + .5, by = y2 + .5, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
        const ex = bx - ux * .32, ey = by - uy * .32;
        const line = document.createElementNS(NS, 'line');
        Object.entries({ x1: ax, y1: ay, x2: ex, y2: ey, stroke: col || '#7cc04a', 'stroke-width': .17, 'stroke-linecap': 'round', opacity: .85 }).forEach(([k, v]) => line.setAttribute(k, v));
        const head = document.createElementNS(NS, 'polygon');
        const px = -uy, py = ux;
        head.setAttribute('points', `${bx - ux * .05},${by - uy * .05} ${ex + px * .25},${ey + py * .25} ${ex - px * .25},${ey - py * .25}`);
        head.setAttribute('fill', col || '#7cc04a'); head.setAttribute('opacity', .85);
        svg.append(line, head);
      }
      this.layer.append(svg);
    }
    if (this.badge && typeof CLASSES !== 'undefined' && CLASSES[this.badge.cls]) {
      const [x, y] = this.pos(this.badge.sq);
      const b = classBadge(this.badge.cls, 20); b.classList.add('sqbadge');
      b.style.left = `calc(${(x + 1) * 12.5}% - 14px)`; b.style.top = `calc(${y * 12.5}% - 6px)`;
      this.layer.append(b);
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
