// The World Games wing: xiangqi, shogi, janggi, makruk, sittuyin, shatranj and chess variants.
// Rules and bots come from Fairy-Stockfish (src/variants.js, loaded on first use).
// Each game has a course (WORLD_COURSES), bots at 8 levels, Pass & Play and a short game review.
'use strict';
const WORLD_REGIONAL = ['xiangqi', 'shogi', 'janggi', 'makruk', 'sittuyin', 'shatranj'];
const WORLD_TWISTS = ['crazyhouse', '3check', 'kingofthehill', 'atomic', 'horde', 'antichess'];
// the token shown on each game's card
const WORLD_FACE = { xiangqi: 'K', shogi: 'K', janggi: 'K', makruk: 'K', sittuyin: 'K', shatranj: 'K' };
let worldView = null; // null = hall; {g} = game page; {g, play} = playing; {g, lesson, step} = lesson
let worldCur = null;  // the game in progress
function worldPrefs() { profile.world = profile.world || { style: 'eng', games: {}, lessons: {}, played: {} }; return profile.world; }
function worldMeta(id) { return (typeof VARIANTS !== 'undefined' && VARIANTS[id]) || { id, name: id }; }
function worldStyle() { return worldPrefs().style || 'eng'; }
function isChessBoardVariant(id) { return WORLD_TWISTS.includes(id) || id === 'chess'; }

// ---------- square names and move strings ----------
function vsqParse(sq) { const m = /^([a-z])(\d+)$/.exec(sq); return m ? [m[1].charCodeAt(0) - 97, +m[2] - 1] : null; }
function vsqName(f, r) { return String.fromCharCode(97 + f) + (r + 1); }
function isPass(v, uci) { const m = /^([a-z]\d+)([a-z]\d+)$/.exec(uci); return v === 'janggi' && !!m && m[1] === m[2]; }
function vmoveParse(uci) {
  let m = /^([A-Za-z+]+)@([a-z]\d+)$/.exec(uci); if (m) return { drop: m[1].replace('+', '').toUpperCase(), to: m[2] };
  m = /^([a-z]\d+)([a-z]\d+)(.*)$/.exec(uci); if (m) return { from: m[1], to: m[2], extra: m[3] || '' };
  return null;
}

// ---------- the board ----------
class VariantBoard {
  constructor(variant, opts = {}) {
    this.v = variant; this.meta = worldMeta(variant); this.opts = opts;
    this.files = this.meta.files || 8; this.ranks = this.meta.ranks || 8;
    this.inter = this.meta.grid === 'intersections';
    this.flipped = !!opts.flipped; this.sel = null; this.legal = []; this.interactive = false;
    this.el = h('div', { class: 'vboard-wrap' + (this.inter ? ' inter' : '') + ' v-' + variant });
    this.pocketTop = h('div', { class: 'vpocket' }); this.pocketBot = h('div', { class: 'vpocket' });
    this.boardEl = h('div', { class: 'vboard', style: { aspectRatio: `${this.files} / ${this.ranks}` } });
    this.bg = h('div', { class: 'vbg' }); this.layer = h('div', { class: 'vlayer' });
    this.boardEl.append(this.bg, this.layer);
    this.frame = h('div', { class: 'vframe' }, this.boardEl); this.coords = h('div', { class: 'vcoords' }); this.frame.append(this.coords);
    this.el.append(this.pocketTop, this.frame, this.pocketBot);
    this.boardEl.addEventListener('click', e => this.onClick(e));
    this.drawBg();
  }
  drawBg() {
    const F = this.files, R = this.ranks, W = F * 100, H = R * 100, v = this.v, trad = worldStyle() === 'trad';
    let s = '';
    if (isChessBoardVariant(v)) {
      for (let f = 0; f < F; f++) for (let r = 0; r < R; r++) s += `<rect x="${f * 100}" y="${r * 100}" width="100" height="100" fill="${(f + r) % 2 ? 'var(--dark)' : 'var(--light)'}"/>`;
    } else if (this.inter) {
      const x = f => f * 100 + 50, y = r => r * 100 + 50, ln = 'stroke="#5a3a1c" stroke-width="3"';
      s += `<rect width="${W}" height="${H}" fill="#e8c88e"/>`;
      for (let r = 0; r < R; r++) s += `<line x1="${x(0)}" y1="${y(r)}" x2="${x(F - 1)}" y2="${y(r)}" ${ln}/>`;
      for (let f = 0; f < F; f++) {
        if (v === 'xiangqi' && f > 0 && f < F - 1) { s += `<line x1="${x(f)}" y1="${y(0)}" x2="${x(f)}" y2="${y(4)}" ${ln}/><line x1="${x(f)}" y1="${y(5)}" x2="${x(f)}" y2="${y(9)}" ${ln}/>`; }
        else s += `<line x1="${x(f)}" y1="${y(0)}" x2="${x(f)}" y2="${y(R - 1)}" ${ln}/>`;
      }
      for (const top of [0, R - 3]) s += `<line x1="${x(3)}" y1="${y(top)}" x2="${x(5)}" y2="${y(top + 2)}" ${ln}/><line x1="${x(5)}" y1="${y(top)}" x2="${x(3)}" y2="${y(top + 2)}" ${ln}/>`;
      s += `<rect x="${x(0)}" y="${y(0)}" width="${x(F - 1) - x(0)}" height="${y(R - 1) - y(0)}" fill="none" stroke="#5a3a1c" stroke-width="7"/>`;
      if (v === 'xiangqi') {
        const words = trad ? ['楚 河', '漢 界'] : [tr('River'), tr('River')];
        s += `<text x="${x(2)}" y="${(y(4) + y(5)) / 2}" font-size="${trad ? 54 : 40}" fill="#7a4f25" text-anchor="middle" dominant-baseline="central" font-family="${trad ? "'Noto Serif CJK SC',serif" : 'var(--display)'}">${words[0]}</text><text x="${x(6)}" y="${(y(4) + y(5)) / 2}" font-size="${trad ? 54 : 40}" fill="#7a4f25" text-anchor="middle" dominant-baseline="central" font-family="${trad ? "'Noto Serif CJK SC',serif" : 'var(--display)'}" transform="rotate(180 ${x(6)} ${(y(4) + y(5)) / 2})">${words[1]}</text>`;
      }
    } else {
      s += `<rect width="${W}" height="${H}" fill="${v === 'shogi' ? '#e9c27c' : '#d9b27a'}"/>`;
      for (let i = 0; i <= F; i++) s += `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="${H}" stroke="#5a3a1c" stroke-width="${i === 0 || i === F ? 6 : 2.5}"/>`;
      for (let i = 0; i <= R; i++) s += `<line x1="0" y1="${i * 100}" x2="${W}" y2="${i * 100}" stroke="#5a3a1c" stroke-width="${i === 0 || i === R ? 6 : 2.5}"/>`;
      if (v === 'shogi') for (const [a, b] of [[3, 3], [6, 3], [3, 6], [6, 6]]) s += `<circle cx="${a * 100}" cy="${b * 100}" r="8" fill="#5a3a1c"/>`;
      if (v === 'makruk') for (const r of [3, 5]) s += `<line x1="0" y1="${r * 100}" x2="${W}" y2="${r * 100}" stroke="#5a3a1c" stroke-width="2.5" stroke-dasharray="0"/>`;
      if (v === 'sittuyin') s += `<line x1="0" y1="0" x2="${W}" y2="${H}" stroke="#5a3a1c" stroke-width="3"/><line x1="${W}" y1="0" x2="0" y2="${H}" stroke="#5a3a1c" stroke-width="3"/>`;
    }
    this.bg.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
    // coordinates live on the wooden frame, never on top of the pieces
    this.coords.innerHTML = '';
    for (let f = 0; f < F; f++) { const ff = this.flipped ? F - 1 - f : f; this.coords.append(h('span', { class: 'cf', style: { left: `calc(var(--vf) + (100% - 2 * var(--vf)) * ${(f + .5) / F})` } }, String.fromCharCode(97 + ff))); }
    for (let r = 0; r < R; r++) { const rr = this.flipped ? r + 1 : R - r; this.coords.append(h('span', { class: 'cr', style: { top: `calc(var(--vf) + (100% - 2 * var(--vf)) * ${(r + .5) / R})` } }, String(rr))); }
  }
  // percentage position of a square's center
  pos(sq) { const p = vsqParse(sq); if (!p) return null; let [f, r] = p; if (this.flipped) { f = this.files - 1 - f; r = this.ranks - 1 - r; } return [(f + .5) / this.files * 100, (this.ranks - 1 - r + .5) / this.ranks * 100]; }
  sqAt(e) {
    const b = this.boardEl.getBoundingClientRect(); let f = Math.floor((e.clientX - b.left) / b.width * this.files), r = this.ranks - 1 - Math.floor((e.clientY - b.top) / b.height * this.ranks);
    if (f < 0 || r < 0 || f >= this.files || r >= this.ranks) return null;
    if (this.flipped) { f = this.files - 1 - f; r = this.ranks - 1 - r; }
    return vsqName(f, r);
  }
  // state: {pieces:[{sq,type,color,promoted}], pockets, last:[from,to], check: sq, turn}
  set(state, legal) {
    this.state = state; this.legal = legal || []; this.sel = null; this.draw();
  }
  pieceHtml(p) {
    if (isChessBoardVariant(this.v)) return `<img src="${PIECE_URL[p.color + p.type.toLowerCase()]}" alt="" draggable="false">`;
    return wpSvg(this.v, p.type, p.color, p.promoted, worldStyle(), this.flipped);
  }
  draw() {
    const st = this.state || { pieces: [] }; this.layer.innerHTML = '';
    const cw = 100 / this.files, ch = 100 / this.ranks, size = this.inter ? .9 : .94;
    const put = (sq, cls, inner) => { const p = this.pos(sq); if (!p) return null; const d = h('div', { class: cls, style: { left: (p[0] - cw * size / 2) + '%', top: (p[1] - ch * size / 2) + '%', width: cw * size + '%', height: ch * size + '%' } }); if (inner) d.innerHTML = inner; this.layer.append(d); return d; };
    for (const sq of st.last || []) if (sq) put(sq, 'vmark last');
    if (st.check) put(st.check, 'vmark check');
    if (this.sel && this.sel.sq) put(this.sel.sq, 'vmark sel');
    for (const p of st.pieces) { const d = put(p.sq, 'vpiece', this.pieceHtml(p)); if (d) d.title = isChessBoardVariant(this.v) ? '' : tr(wpName(this.v, p.type, p.promoted)); }
    if (this.sel) {
      const occ = new Set(st.pieces.map(p => p.sq));
      for (const t of this.targets()) put(t, 'vdot' + (occ.has(t) ? ' cap' : ''));
    }
    this.drawPockets();
  }
  drawPockets() {
    const st = this.state || {}; const pk = st.pockets;
    for (const el of [this.pocketTop, this.pocketBot]) { el.innerHTML = ''; el.style.display = pk ? '' : 'none'; }
    if (!pk) return;
    if (this.opts.hideEmptyPockets && !['w', 'b'].some(c => Object.values(pk[c] || {}).some(n => n > 0))) { this.pocketTop.style.display = this.pocketBot.style.display = 'none'; return; }
    const bottom = this.flipped ? 'b' : 'w';
    for (const side of ['w', 'b']) {
      const el = side === bottom ? this.pocketBot : this.pocketTop;
      const hand = pk[side] || {}; const keys = Object.keys(hand).filter(k => hand[k] > 0);
      if (!keys.length) el.append(h('span', { class: 'muted small' }, tr('No captured pieces yet')));
      for (const k of keys) {
        const on = this.sel && this.sel.drop === k && side === st.turn;
        const b = h('button', { class: 'vhand' + (on ? ' on' : ''), onclick: () => { if (!this.interactive || side !== st.turn) return; this.sel = on ? null : { drop: k }; this.draw(); } });
        b.innerHTML = this.pieceHtml({ type: k, color: side, promoted: false }); b.append(h('b', null, String(hand[k])));
        el.append(b);
      }
    }
  }
  targets() {
    if (!this.sel) return [];
    const out = new Set();
    for (const m of this.legal) { const mv = vmoveParse(m); if (!mv || isPass(this.v, m)) continue; if (this.sel.drop ? mv.drop === this.sel.drop : mv.from === this.sel.sq) out.add(mv.to); }
    return [...out];
  }
  onClick(e) {
    if (!this.interactive) return;
    const sq = this.sqAt(e); if (!sq) return;
    const st = this.state; const mine = st.pieces.find(p => p.sq === sq && p.color === st.turn);
    if (this.sel) {
      const cands = this.legal.filter(m => { const mv = vmoveParse(m); return mv && !isPass(this.v, m) && mv.to === sq && (this.sel.drop ? mv.drop === this.sel.drop : mv.from === this.sel.sq); });
      if (cands.length) { this.sel = null; this.choose(cands); return; }
    }
    if (mine && this.legal.some(m => { const mv = vmoveParse(m); return mv && mv.from === sq; })) { this.sel = this.sel && this.sel.sq === sq ? null : { sq }; haptic(4); }
    else this.sel = null;
    this.draw();
  }
  choose(cands) {
    if (cands.length === 1) { this.opts.onMove && this.opts.onMove(cands[0]); return; }
    // promotion choice: show each option as its piece
    const mv0 = vmoveParse(cands[0]); const mover = this.state.pieces.find(p => p.sq === mv0.from);
    modal((box, close) => {
      box.append(h('h3', { class: 'center' }, tr('Promote this piece?')));
      box.append(h('div', { class: 'row', style: { justifyContent: 'center', gap: '12px' } }, cands.map(c => {
        const ex = vmoveParse(c).extra; const promoted = ex === '+' ;
        const type = ex && ex !== '+' && ex !== '=' ? ex.toUpperCase() : mover.type;
        const b = h('button', { class: 'vhand big', onclick: () => { close(); this.opts.onMove && this.opts.onMove(c); } });
        b.innerHTML = this.pieceHtml({ type, color: mover.color, promoted: promoted || (!!ex && ex !== '-' && ex !== '=' && this.v !== 'shogi') });
        b.append(h('small', null, ex === '+' ? tr('Promote') : ex === '' || ex === '=' || ex === '-' ? tr('Keep') : tr(wpName(this.v, type, false))));
        return b;
      })));
    });
  }
}

// ---------- game state helpers ----------
function vState(g, variant) {
  const pcs = g.pieces(); const last = g.moves.length ? vmoveParse(g.moves[g.moves.length - 1]) : null;
  let check = null; if (g.inCheck()) { const k = pcs.find(p => p.type === 'K' && p.color === g.turn()); if (k) check = k.sq; }
  const meta = worldMeta(variant || g.variant);
  return { pieces: pcs, pockets: meta.pockets ? g.pockets() : null, last: last ? [last.from || null, last.to] : [], check, turn: g.turn() };
}
function sideName(variant, side) {
  return ({ xiangqi: { w: 'Red', b: 'Black' }, janggi: { w: 'Blue', b: 'Red' }, shogi: { w: 'Sente', b: 'Gote' } }[variant] || { w: 'White', b: 'Black' })[side];
}
function worldLoading(main, what) {
  const box = h('div', { class: 'card center' }, h('div', { class: 'thinking' }, h('i'), h('i'), h('i')), h('p', { class: 'muted' }, what || tr('Setting up the board...')));
  main.append(box); return box;
}
function ensureVariants(main, then) {
  if (typeof Variants === 'undefined') { main.append(h('div', { class: 'banner bad' }, tr('World Games could not load.'))); return; }
  if (Variants._ok || Variants.loaded) return then();
  const ld = worldLoading(main, tr('Opening the World Games cabinet...'));
  Variants.ready().then(() => { Variants._ok = true; ld.remove(); if (route === 'world') render(); })
    .catch(() => { ld.remove(); main.append(h('div', { class: 'banner bad' }, tr('World Games need a one-time download. Check your connection and try again.'))); });
}

// ---------- screens ----------
function renderWorldGames(main) {
  if (worldView && worldView.play) return ensureVariants(main, () => renderWorldGame(main));
  if (worldView && worldView.lesson) return ensureVariants(main, () => renderWorldLesson(main));
  if (worldView && worldView.g) return renderWorldGamePage(main);
  const wp = worldPrefs();
  main.append(stageBanner('atlas', tr('World Games'), tr('Chess has cousins all over the world. Learn them and play them here.')));
  main.append(h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(56)), h('div', { class: 'txt' }, tr('Hoo! Every game here comes from the same old ancestor as chess. Each one has a lesson course, bots to play, and an English piece set so the pieces are easy to read.'))));
  const card = id => {
    const m = worldMeta(id), lessons = (typeof WORLD_COURSES !== 'undefined' && WORLD_COURSES[id]) ? WORLD_COURSES[id].lessons : [];
    const done = lessons.filter(l => wp.lessons[id + '/' + l.id]).length;
    const face = h('div', { class: 'wface' });
    if (isChessBoardVariant(id)) face.append(h('img', { src: PIECE_URL[{ crazyhouse: 'wn', '3check': 'wq', kingofthehill: 'wk', atomic: 'wr', horde: 'wp', antichess: 'wb' }[id]], alt: '' }));
    else face.innerHTML = wpSvg(id, WORLD_FACE[id], 'w', false, wp.style === 'trad' ? 'trad' : 'trad');
    return h('button', { class: 'wgame', onclick: () => { haptic(8); worldView = { g: id }; render(); window.scrollTo(0, 0); } }, face,
      h('div', { class: 'grow' }, h('b', null, tr(m.name)), h('small', null, [m.english ? tr(m.english) : null, m.origin ? tr(m.origin) : null].filter(Boolean).join(', ')),
        lessons.length ? h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(done / lessons.length * 100) + '%' } })) : null),
      icon('next', 20));
  };
  main.append(h('h3', { class: 'sect' }, tr('Games from around the world')), h('div', { class: 'wgames' }, WORLD_REGIONAL.map(card)));
  main.append(h('h3', { class: 'sect' }, tr('Chess with a twist')), h('div', { class: 'wgames' }, WORLD_TWISTS.map(card)));
}
function styleToggle(onChange) {
  const seg = h('div', { class: 'seg' });
  const d = () => { seg.innerHTML = ''; [['eng', tr('English pieces')], ['trad', tr('Traditional')]].forEach(([v, l]) => seg.append(h('button', { class: worldStyle() === v ? 'on' : '', onclick: () => { worldPrefs().style = v; saveProfile(); d(); onChange && onChange(); } }, l))); };
  d(); return seg;
}
function renderWorldGamePage(main) {
  const id = worldView.g, m = worldMeta(id), wp = worldPrefs(), rec = wp.games[id] || {};
  const course = typeof WORLD_COURSES !== 'undefined' ? WORLD_COURSES[id] : null;
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { worldView = null; render(); } }, icon('back', 18), tr('World Games')), h('div', { class: 'grow' })));
  main.append(h('div', { class: 'card paper whead' }, h('h2', null, tr(m.name)), m.english ? h('div', { class: 'muted' }, tr(m.english)) : null, m.blurb ? h('p', null, tr(m.blurb)) : null));
  if (course) {
    const done = course.lessons.filter(l => wp.lessons[id + '/' + l.id]).length;
    const next = course.lessons.find(l => !wp.lessons[id + '/' + l.id]) || course.lessons[0];
    main.append(h('div', { class: 'lgroup' }, h('h3', null, tr('Learn to play')), h('div', { class: 'lessons' }, course.lessons.map(l => h('button', { class: 'lesson' + (l === next && done < course.lessons.length ? ' hero' : ''), onclick: () => { worldView = { g: id, lesson: l, step: 0 }; render(); window.scrollTo(0, 0); } },
      h('div', { class: 'lesson-ic' }, icon('learn', 22)), h('div', { class: 'grow' }, h('div', { class: 't' }, tr(l.title)), h('div', { class: 'd' }, tr(l.desc || ''))), h('span', { class: 'ck' + (wp.lessons[id + '/' + l.id] ? ' done' : '') }, icon(wp.lessons[id + '/' + l.id] ? 'check' : 'next', 20)))))));
  }
  // play
  const sel = worldView.sel = worldView.sel || { lvl: Math.min(8, (rec.best || 0) + 1), color: 'w' };
  const grid = h('div', { class: 'bots' });
  const drawGrid = () => { grid.innerHTML = ''; BOTS.forEach((b, i) => grid.append(h('button', { class: 'bot' + (sel.lvl === i + 1 ? ' on' : ''), onclick: () => { sel.lvl = i + 1; drawGrid(); } }, h('div', { class: 'av' }, avatar(b.avatar, 46)), h('div', { class: 'nm' }, b.name), h('div', { class: 'rt' }, tr('Level') + ' ' + (i + 1)), (rec.beat || {})[i + 1] ? h('div', { class: 'bl' }, icon('check', 14), ' ' + tr('Beaten')) : null))); };
  drawGrid();
  const colSeg = h('div', { class: 'seg' }); const dc = () => { colSeg.innerHTML = ''; [['w', tr(sideName(id, 'w')) + ' ' + tr('(moves first)')], ['b', tr(sideName(id, 'b'))]].forEach(([v, l]) => colSeg.append(h('button', { class: sel.color === v ? 'on' : '', onclick: () => { sel.color = v; dc(); } }, l))); }; dc();
  main.append(h('div', { class: 'card' }, h('h3', null, tr('Play a bot')), grid, h('div', { class: 'lbl' }, tr('You play')), colSeg,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn primary grow', onclick: () => startWorldGame(id, { bot: sel.lvl, color: sel.color }) }, icon('play', 18), tr('Play') + ' ' + BOTS[sel.lvl - 1].name),
      h('button', { class: 'btn grow', onclick: () => startWorldGame(id, { local: true }) }, icon('friends', 18), tr('Pass & Play')))));
  main.append(h('div', { class: 'card' }, h('h3', null, tr('Piece style')), styleToggle(() => render())));
  if (!isChessBoardVariant(id)) main.append(pieceGuide(id));
}
function pieceGuide(id) {
  const map = WP_KIND[id] || {}; const rows = [];
  for (const L in map) {
    const t = h('span', { class: 'wtok' }); t.innerHTML = wpSvg(id, L, 'w', false, 'trad');
    const e = h('span', { class: 'wtok' }); e.innerHTML = wpSvg(id, L, 'w', false, 'eng');
    rows.push(h('div', { class: 'wguide-row' }, t, e, h('b', null, tr(wpName(id, L, false)))));
    if (id === 'shogi' && !['K', 'G'].includes(L)) {
      const t2 = h('span', { class: 'wtok' }); t2.innerHTML = wpSvg(id, L, 'w', true, 'trad'); const e2 = h('span', { class: 'wtok' }); e2.innerHTML = wpSvg(id, L, 'w', true, 'eng');
      rows.push(h('div', { class: 'wguide-row sub' }, t2, e2, h('span', null, tr(wpName(id, L, true)))));
    }
  }
  return h('div', { class: 'card' }, h('h3', null, tr('Piece guide')), h('div', { class: 'muted small' }, tr('Traditional and English side by side.')), h('div', { class: 'wguide' }, rows));
}
function startWorldGame(id, opts) {
  worldCur = { v: id, bot: opts.bot || 0, color: opts.local ? 'w' : opts.color || 'w', local: !!opts.local, moves: [], over: null, started: Date.now() };
  worldView = { g: id, play: true }; render(); window.scrollTo(0, 0);
}
function renderWorldGame(main) {
  const cur = worldCur; if (!cur) { worldView = { g: worldView.g }; return render(); }
  const g = new VGame(cur.v); cur.moves.forEach(m => g.play(m));
  const m = worldMeta(cur.v);
  let flipped = cur.local ? false : cur.color === 'b'; if (cur.flip) flipped = !flipped;
  const vb = new VariantBoard(cur.v, { flipped, onMove: uci => userMove(uci) });
  const bot = cur.bot ? BOTS[cur.bot - 1] : null;
  const bar = (side) => h('div', { class: 'pbar' + (g.turn() === side && !cur.over ? ' on' : '') }, bot && side !== cur.color ? avatar(bot.avatar, 34) : avatar(side === cur.color || cur.local ? myAvatar() : 'friend', 34),
    h('div', { class: 'grow' }, h('div', { class: 'pname' }, bot && side !== cur.color ? bot.name + ' (' + tr('Level') + ' ' + cur.bot + ')' : cur.local ? tr(sideName(cur.v, side)) : profile.name || tr('You')), h('div', { class: 'prating muted' }, cur.local ? tr('Pass & Play') : tr(sideName(cur.v, side)))));
  const topSide = flipped ? 'w' : 'b';
  const topBar = h('div'), botBar = h('div');
  const msg = h('div', { class: 'taskmsg' });
  const movesEl = h('div', { class: 'moves vmoves' });
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { worldView = { g: cur.v }; render(); } }, icon('back', 18), tr(m.name)), h('div', { class: 'grow' }), h('button', { class: 'btn sm ghost', 'aria-label': tr('Turn board'), onclick: () => { cur.flip = !cur.flip; render(); } }, icon('flip', 18))));
  main.append(topBar, vb.el, botBar, msg);
  const ctrl = h('div', { class: 'row controls' });
  main.append(ctrl, movesEl);
  let thinking = false;
  const refresh = () => {
    topBar.innerHTML = ''; topBar.append(bar(topSide)); botBar.innerHTML = ''; botBar.append(bar(topSide === 'w' ? 'b' : 'w'));
    const st = g.status();
    if (st.over && !cur.over) finish(st);
    const myTurn = !cur.over && (cur.local || g.turn() === cur.color) && !thinking;
    vb.interactive = myTurn; vb.set(vState(g, cur.v), myTurn ? g.legalMoves() : []);
    msg.className = 'taskmsg' + (cur.over ? ' good' : '');
    msg.textContent = cur.over ? resultText(cur.over) : thinking ? tr('Thinking...') : g.inCheck() ? tr('Check!') + ' ' + tr(sideName(cur.v, g.turn())) + ' ' + tr('to move') : tr(sideName(cur.v, g.turn())) + ' ' + tr('to move');
    movesEl.innerHTML = ''; cur.sans = cur.sans || [];
    cur.sans.forEach((s, i) => movesEl.append(h('span', { class: 'mv' }, (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s)));
    ctrl.innerHTML = '';
    if (!cur.over) {
      ctrl.append(h('button', { class: 'btn sm grow', disabled: !cur.moves.length || thinking, onclick: () => { const n = cur.local ? 1 : (g.turn() === cur.color ? 2 : 1); for (let i = 0; i < n && cur.moves.length; i++) { cur.moves.pop(); cur.sans.pop(); g.undo(); } cur.undos = (cur.undos || 0) + 1; refresh(); } }, icon('undo', 16), tr('Undo')));
      const pass = myTurn && g.legalMoves().find(mm => isPass(cur.v, mm));
      if (pass) ctrl.append(h('button', { class: 'btn sm grow', onclick: () => userMove(pass) }, icon('next', 16), tr('Pass')));
      ctrl.append(h('button', { class: 'btn sm grow', disabled: thinking || !myTurn, onclick: () => hint() }, icon('bulb', 16), tr('Hint')));
      ctrl.append(h('button', { class: 'btn sm grow', onclick: () => { if (confirmResign()) { cur.over = { result: cur.local ? (g.turn() === 'w' ? '0-1' : '1-0') : cur.color === 'w' ? '0-1' : '1-0', reason: 'resign' }; onOver(); refresh(); } } }, icon('flag', 16), tr('Resign')));
    } else {
      ctrl.append(h('button', { class: 'btn sm grow primary', onclick: () => startWorldGame(cur.v, { bot: cur.bot, color: cur.color, local: cur.local }) }, icon('repeat', 16), tr('Play again')));
      if (cur.moves.length >= 4) ctrl.append(h('button', { class: 'btn sm grow', onclick: () => worldReview(g, cur) }, icon('search', 16), tr('Review')));
    }
  };
  const confirmResign = () => { try { return window.confirm(tr('Resign this game?')); } catch (e) { return true; } };
  const resultText = o => { const who = o.result === '1/2-1/2' ? null : o.result === '1-0' ? 'w' : 'b'; const why = tr(({ checkmate: 'checkmate', stalemate: 'stalemate', resign: 'resignation', repetition: 'repetition', 'insufficient-material': 'not enough pieces to win', 'move-rule': 'move limit', 'counting-rule': 'counting rule', 'three-checks': 'three checks', 'king-of-the-hill': 'king reached the hill', 'king-exploded': 'king exploded', 'horde-destroyed': 'the horde is gone', 'no-pieces': 'no pieces left', 'variant-end': 'game over' }[o.reason]) || o.reason || ''); return who ? tr(sideName(cur.v, who)) + ' ' + tr('wins') + (why ? ' (' + why + ')' : '') : tr('Draw') + (why ? ' (' + why + ')' : ''); };
  const finish = st => { cur.over = { result: st.result, reason: st.reason }; onOver(); };
  const onOver = () => {
    const wp = worldPrefs(); const rec = wp.games[cur.v] = wp.games[cur.v] || { played: 0, wins: 0, beat: {} };
    rec.played++; wp.played[cur.v] = 1;
    const score = cur.over.result === '1/2-1/2' ? .5 : (cur.over.result === '1-0') === (cur.color === 'w') ? 1 : 0;
    if (!cur.local && score === 1) { rec.wins++; rec.beat = rec.beat || {}; rec.beat[cur.bot] = 1; rec.best = Math.max(rec.best || 0, cur.bot); }
    saveProfile(); beep(score === 1 || cur.local ? 'win' : 'move'); if (score === 1 && !cur.local) { confetti(); haptic([10, 40, 10]); }
    setTimeout(() => rewardEvent('worldGame', { variant: cur.v, score: cur.local ? null : score, level: cur.bot, local: cur.local, moves: cur.moves.length }), 900);
  };
  const userMove = uci => {
    const r = g.play(uci); if (!r) return;
    cur.moves.push(uci); cur.sans = cur.sans || []; cur.sans.push(r.san || uci);
    beep(r.check ? 'check' : r.capture ? 'capture' : 'move'); haptic(r.capture ? 12 : 5);
    refresh();
    if (!cur.over && !cur.local && g.turn() !== cur.color) botMove();
  };
  const botMove = () => {
    thinking = true; refresh();
    const t0 = Date.now(), token = cur;
    Variants.engine.bestMove(cur.v, g.startFen(), cur.moves.slice(), { level: cur.bot }).then(res => {
      const wait = Math.max(0, 450 - (Date.now() - t0));
      setTimeout(() => {
        if (worldCur !== token || !worldView || !worldView.play) return;
        thinking = false;
        if (res && res.uci) { const r = g.play(res.uci); if (r) { cur.moves.push(res.uci); cur.sans.push(r.san || res.uci); beep(r.check ? 'check' : r.capture ? 'capture' : 'move'); } }
        refresh();
      }, wait);
    }).catch(() => { thinking = false; refresh(); toast(tr('The bot could not move. Try again.')); });
  };
  const hint = () => {
    thinking = true; refresh();
    Variants.engine.bestMove(cur.v, g.startFen(), cur.moves.slice(), { level: 8, timeMs: 800 }).then(res => {
      thinking = false; refresh(); if (!res || !res.uci) return;
      const mv = vmoveParse(res.uci); cur.hints = (cur.hints || 0) + 1;
      vb.sel = mv.drop ? { drop: mv.drop } : { sq: mv.from }; vb.draw();
      toast(tr('Hoot suggests:') + ' ' + (g.san(res.uci) || res.uci), 3000);
    }).catch(() => { thinking = false; refresh(); });
  };
  refresh();
  if (!cur.over && !cur.local && g.turn() !== cur.color) botMove();
  cleanups.push(() => { thinking = false; });
}
// short review: find the three moves that lost the most, and what was better
function worldReview(g0, cur) {
  modal((box, close) => {
    box.append(h('h2', { class: 'center' }, tr('Game review')));
    const body = h('div', null, h('div', { class: 'thinking' }, h('i'), h('i'), h('i')), h('p', { class: 'muted center' }, tr('Hoot is looking over your moves...')));
    box.append(body, h('button', { class: 'btn block', onclick: close }, tr('Close')));
    (async () => {
      const moves = cur.moves.slice(), evals = [];
      const startFen = new VGame(cur.v).startFen();
      for (let i = 0; i <= moves.length; i++) {
        const r = await Variants.engine.analyze(cur.v, startFen, moves.slice(0, i), { timeMs: 220, multipv: 1 }).catch(() => null);
        const l = r && r.lines && r.lines[0]; let cp = l ? (l.mate != null ? (l.mate > 0 ? 3000 : -3000) : l.cp || 0) : 0;
        evals.push({ cp: i % 2 === 0 ? cp : -cp, best: l && l.pv && l.pv[0] }); // from first player's view
        if (!body.isConnected) return;
      }
      const g = new VGame(cur.v); const items = [];
      for (let i = 0; i < moves.length; i++) {
        const side = i % 2 === 0 ? 'w' : 'b'; const sign = side === 'w' ? 1 : -1;
        const loss = (evals[i].cp - evals[i + 1].cp) * sign;
        const bestSan = evals[i].best ? g.san(evals[i].best) : null; const playedSan = g.san(moves[i]);
        if ((cur.local || side === cur.color) && loss > 120 && evals[i].best && evals[i].best !== moves[i]) items.push({ i, side, loss, playedSan, bestSan });
        g.play(moves[i]);
      }
      items.sort((a, b) => b.loss - a.loss);
      body.innerHTML = '';
      if (!items.length) body.append(h('div', { class: 'banner good' }, icon('check', 20), h('span', null, tr('No big mistakes found. Well played!'))));
      else {
        body.append(h('p', null, tr('These moments changed the game the most:')));
        items.slice(0, 3).forEach(it => body.append(h('div', { class: 'card' }, h('b', null, (Math.floor(it.i / 2) + 1) + (it.side === 'w' ? '. ' : '... ') + it.playedSan), h('div', { class: 'muted small' }, it.loss > 600 ? tr('Blunder') : it.loss > 250 ? tr('Mistake') : tr('Inaccuracy')), h('div', null, tr('Better was') + ' ', h('b', null, it.bestSan)))));
      }
      rewardEvent('review', {});
    })();
  });
}
// ---------- lessons ----------
function renderWorldLesson(main) {
  const id = worldView.g, L = worldView.lesson, steps = L.steps, step = steps[worldView.step];
  const course = WORLD_COURSES[id];
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { worldView = { g: id }; render(); } }, icon('back', 18), tr(worldMeta(id).name)), h('div', { class: 'grow' }, h('h2', null, tr(L.title)))));
  main.append(h('div', { class: 'dots' }, steps.map((_, i) => h('i', { class: i < worldView.step ? 'done' : i === worldView.step ? 'on' : '' }))));
  main.append(h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(56)), h('div', { class: 'txt', html: step.text })));
  const msg = h('div', { class: 'taskmsg' });
  let complete = step.type === 'text';
  const nextBtn = h('button', { class: 'btn primary grow', disabled: !complete, onclick: () => {
    if (worldView.step < steps.length - 1) { worldView.step++; render(); window.scrollTo(0, 0); return; }
    const wp = worldPrefs(), key = id + '/' + L.id, first = !wp.lessons[key]; wp.lessons[key] = 1; saveProfile(); beep('win');
    if (first) setTimeout(() => { rewardEvent('lesson'); if (course.lessons.every(x => wp.lessons[id + '/' + x.id])) rewardEvent('course'); }, 900);
    const nxt = course.lessons[course.lessons.indexOf(L) + 1];
    modal((box, close) => box.append(badge('learn', 'gold'), h('h2', { class: 'center' }, tr('Lesson complete!')), h('p', { class: 'center muted' }, tr(L.title)),
      h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => { close(); worldView = { g: id }; render(); } }, tr('All lessons')),
        nxt ? h('button', { class: 'btn primary grow', onclick: () => { close(); worldView = { g: id, lesson: nxt, step: 0 }; render(); window.scrollTo(0, 0); } }, tr('Next lesson'))
          : h('button', { class: 'btn primary grow', onclick: () => { close(); startWorldGame(id, { bot: 1, color: 'w' }); } }, tr("Let's play!")))));
  } }, worldView.step < steps.length - 1 ? tr('Next') : tr('Finish'), icon(worldView.step < steps.length - 1 ? 'next' : 'check', 18));
  const finishTask = text => { complete = true; nextBtn.disabled = false; msg.className = 'taskmsg good'; msg.textContent = tr(text || 'Great job!'); beep('win'); haptic([8, 30, 8]); };
  { // every step shows a board: its own position, or the starting position for general explanations
    const g = step.fen ? new VGame(id, step.fen) : new VGame(id);
    const side = step.side || g.turn();
    const vb = new VariantBoard(id, { flipped: side === 'b' && step.type !== 'text', hideEmptyPockets: true, onMove: uci => onMove(uci) });
    const show = (extra) => { const st = vState(g, id); vb.set(Object.assign(st, extra || {}), complete || step.type === 'text' ? [] : g.legalMoves()); vb.interactive = !complete && step.type !== 'text'; };
    const marks = () => { (step.marks || []).forEach(sq => { const p = vb.pos(sq); if (!p) return; }); };
    let k = 0;
    const onMove = uci => {
      if (step.type === 'goal') {
        const ok = goalMet(step, g, uci);
        if (ok) { g.play(uci); show(); finishTask(step.success); }
        else { const r = g.play(uci); show(); msg.className = 'taskmsg bad'; msg.textContent = tr(step.fail || 'Not quite. Try again!'); beep('move'); setTimeout(() => { if (r) g.undo(); show(); }, 900); }
      } else if (step.type === 'line') {
        if (uci !== step.moves[k]) { msg.className = 'taskmsg bad'; msg.textContent = tr('Not this time. Look again!'); show(); return; }
        g.play(uci); k++; show();
        const reply = () => { if (k < step.moves.length && g.turn() !== side) { const r = g.play(step.moves[k]); k++; beep(r && r.capture ? 'capture' : 'move'); show(); } if (k >= step.moves.length) finishTask(step.success); };
        setTimeout(reply, 450);
      }
    };
    show(); marks();
    // marks and arrows from the lesson
    vb.drawExtra = () => {};
    const origDraw = vb.draw.bind(vb);
    vb.draw = () => { origDraw(); for (const sq of step.marks || []) { const p = vb.pos(sq); if (!p) continue; const cw = 100 / vb.files, ch = 100 / vb.ranks; vb.layer.prepend(h('div', { class: 'vmark lmark', style: { left: (p[0] - cw * .47) + '%', top: (p[1] - ch * .47) + '%', width: cw * .94 + '%', height: ch * .94 + '%' } })); }
      if (step.arrows && step.arrows.length) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'varrows');
        for (const [a, b] of step.arrows) { const p = vb.pos(a), q = vb.pos(b); if (!p || !q) continue; const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('x1', p[0]); ln.setAttribute('y1', p[1]); ln.setAttribute('x2', q[0]); ln.setAttribute('y2', q[1]); svg.append(ln); }
        vb.layer.append(svg); } };
    vb.draw();
    main.append(vb.el);
    if (step.type !== 'text') msg.textContent = step.type === 'line' ? tr('Play the moves. The other side will answer.') : tr('Your move!');
  }
  main.append(msg, h('div', { class: 'row' }, worldView.step > 0 ? h('button', { class: 'btn', onclick: () => { worldView.step--; render(); } }, icon('back', 18)) : null, nextBtn));
}
function goalMet(step, g, uci) {
  if (step.goal === 'move' || !step.goal) return (step.moves || []).includes(uci);
  if ((step.moves || []).includes(uci)) return true;
  if (step.goal === 'capture' && step.moves && step.moves.length) return false; // a particular capture was asked for
  const before = g.pieces().length; const r = g.play(uci); if (!r) return false;
  let ok = false; const st = g.status();
  if (step.goal === 'mate') ok = st.over && st.reason === 'checkmate';
  else if (step.goal === 'check') ok = g.inCheck();
  else if (step.goal === 'capture') ok = !!r.capture;
  else if (step.goal === 'drop') ok = uci.includes('@');
  else if (step.goal === 'promote') ok = /\+$|[a-z]\d+[a-z]\d+[a-zA-Z]$/.test(uci);
  g.undo(); void before; return ok;
}
