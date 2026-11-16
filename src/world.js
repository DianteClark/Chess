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
    const cw = 100 / this.files, ch = 100 / this.ranks, size = this.inter ? .96 : .94;
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
  drawPockets() { this._drawPockets(); requestAnimationFrame(() => { const t = this.pocketTop, b = this.pocketBot; const hgt = (t.style.display === 'none' ? 0 : t.offsetHeight + 8) + (b.style.display === 'none' ? 0 : b.offsetHeight + 8); this.el.style.setProperty('--pk', hgt + 'px'); }); }
  _drawPockets() {
    const st = this.state || {}; const pk = st.pockets;
    for (const el of [this.pocketTop, this.pocketBot]) { el.innerHTML = ''; el.classList.remove('empty'); el.style.display = pk ? '' : 'none'; }
    if (!pk) return;
    if (this.opts.hideEmptyPockets && !['w', 'b'].some(c => Object.values(pk[c] || {}).some(n => n > 0))) { this.pocketTop.style.display = this.pocketBot.style.display = 'none'; return; }
    const bottom = this.flipped ? 'b' : 'w';
    for (const side of ['w', 'b']) {
      const el = side === bottom ? this.pocketBot : this.pocketTop;
      const hand = pk[side] || {}; const keys = Object.keys(hand).filter(k => hand[k] > 0);
      if (!keys.length) el.append(h('span', { class: 'vpocket-empty' }, `${sideName(this.v, side)}: no pieces in hand`)); el.classList.add('empty');
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
// end reasons: tr('checkmate') tr('stalemate') tr('resignation') tr('repetition') tr('move limit') tr('counting rule') tr('three checks') tr('game over')
// side names, listed so the translation catalog picks them up: tr('Red') tr('Blue') tr('Black') tr('White') tr('Sente') tr('Gote')
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
  const tile = (id, small) => {
    const m = worldMeta(id), lessons = (typeof WORLD_COURSES !== 'undefined' && WORLD_COURSES[id]) ? WORLD_COURSES[id].lessons : [];
    const done = lessons.filter(l => wp.lessons[id + '/' + l.id]).length, rec = wp.games[id] || {};
    const face = h('div', { class: 'wface' });
    if (isChessBoardVariant(id)) face.append(h('img', { src: PIECE_URL[{ crazyhouse: 'wn', '3check': 'wq', kingofthehill: 'wk', atomic: 'wr', horde: 'wp', antichess: 'wb' }[id]], alt: '' }));
    else face.innerHTML = { makruk: wpSvg(id, 'R', 'w', false, 'eng'), sittuyin: wpSvg(id, 'S', 'b', false, 'eng'), shatranj: wpSvg(id, 'B', 'w', false, 'eng') }[id] || wpSvg(id, WORLD_FACE[id], 'w', false, 'trad');
    return h('button', { class: 'wtile' + (small ? ' small' : '') + ' wt-' + id, onclick: () => { haptic(8); beep('open'); worldView = { g: id }; render(); window.scrollTo(0, 0); } }, face,
      h('b', null, tr(m.name)), h('small', null, small ? '' : tr(m.english && m.english !== m.name ? m.english : m.origin || '')),
      lessons.length ? h('div', { class: 'wt-prog' }, h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(done / lessons.length * 100) + '%' } })), rec.wins ? h('span', null, icon('trophy', 12), ` ${rec.wins}`) : null) : null);
  };
  main.append(h('h3', { class: 'sect' }, tr('Games from around the world')), h('div', { class: 'wtiles' }, WORLD_REGIONAL.map(id => tile(id))));
  main.append(h('h3', { class: 'sect' }, tr('Chess with a twist')), h('div', { class: 'wtiles small' }, WORLD_TWISTS.map(id => tile(id, true))));
}
function styleToggle(onChange) {
  const seg = h('div', { class: 'seg' });
  const d = () => { seg.innerHTML = ''; [['eng', tr('English pieces')], ['trad', tr('Traditional')]].forEach(([v, l]) => seg.append(h('button', { class: worldStyle() === v ? 'on' : '', onclick: () => { worldPrefs().style = v; saveProfile(); d(); onChange && onChange(); } }, l))); };
  d(); return seg;
}
function renderWorldGamePage(main) {
  const id = worldView.g, m = worldMeta(id), wp = worldPrefs(), rec = wp.games[id] || {};
  const course = typeof WORLD_COURSES !== 'undefined' ? WORLD_COURSES[id] : null;
  const done = course ? course.lessons.filter(l => wp.lessons[id + '/' + l.id]).length : 0;
  if (!worldView.tab) worldView.tab = course && done < Math.min(3, course.lessons.length) ? 'learn' : 'play';
  const strip = h('div', { class: 'wstrip' });
  if (isChessBoardVariant(id)) ['wk', 'wq', 'wr', 'wb', 'wn', 'wp'].forEach(k => strip.append(h('img', { src: PIECE_URL[k], alt: '' })));
  else Object.keys(WP_KIND[id] || {}).forEach((L, i) => { const t = h('span'); t.innerHTML = wpSvg(id, L, i % 2 ? 'b' : 'w', false, worldStyle()); strip.append(t); });
  main.append(h('div', { class: 'course-head' }, h('button', { class: 'icon-btn', 'aria-label': 'World Games', onclick: () => { worldView = null; navDir = 'back'; render(); } }, icon('back', 20)),
    h('div', { class: 'grow' }, h('h2', null, tr(m.name)), h('small', null, [m.english && m.english !== m.name ? tr(m.english) : null, m.origin ? tr(m.origin) : null].filter(Boolean).join(', ')))));
  main.append(h('div', { class: 'card paper whead' }, strip, m.blurb ? h('p', null, tr(m.blurb)) : null,
    h('div', { class: 'wstats' }, course ? h('span', null, icon('learn', 15), ` ${done} / ${course.lessons.length} lessons`) : null, h('span', null, icon('trophy', 15), ` ${rec.wins || 0} wins`), rec.best ? h('span', null, icon('star', 15), ` Beat level ${rec.best}`) : null)));
  const tabs = h('div', { class: 'seg' }); [[course ? 'learn' : null, [icon('learn', 16), ' Learn']], ['play', [icon('play', 16), ' Play']], [isChessBoardVariant(id) ? null : 'pieces', [icon('eye', 16), ' Pieces']]].filter(([v]) => v).forEach(([v, l]) => tabs.append(h('button', { class: worldView.tab === v ? 'on' : '', onclick: () => { worldView.tab = v; beep('toggle'); render(); } }, l)));
  main.append(tabs);
  if (worldView.tab === 'learn' && course) {
    main.append(lessonPath(course.lessons.map((l, li) => ({ key: id + '/' + l.id, title: tr(l.title), done: !!wp.lessons[id + '/' + l.id], stars: (wp.stars || {})[id + '/' + l.id] || (wp.lessons[id + '/' + l.id] ? 1 : 0), art: h('b', { class: 'lp-num' }, String(li + 1)), open: () => { worldView = { g: id, lesson: l, step: 0, tab: 'learn' }; render(); } }))));
    return;
  }
  if (worldView.tab === 'pieces') { main.append(h('div', { class: 'card' }, h('h3', null, tr('Piece style')), styleToggle(() => render()))); main.append(pieceGuide(id)); return; }
  // play: pick a bot like in the Arena
  const sel = worldView.sel = worldView.sel || { lvl: Math.min(8, (rec.best || 0) + 1), color: 'w' };
  const spot = h('div', { class: 'spotlight' }), bstrip = h('div', { class: 'bot-strip' });
  const playBtn = h('button', { class: 'play-big', onclick: () => { haptic(14); beep('start'); startWorldGame(id, { bot: sel.lvl, color: sel.color }); } });
  const draw = () => {
    const b = BOTS[sel.lvl - 1], beaten = (rec.beat || {})[sel.lvl];
    spot.innerHTML = ''; spot.append(h('div', { class: 'sp-av' }, avatar(b.avatar, 86), beaten ? h('span', { class: 'sp-beaten' }, icon('check', 14), 'Beaten') : null),
      h('div', { class: 'sp-info' }, h('div', { class: 'sp-lvl' }, `Level ${sel.lvl}`), h('b', { class: 'sp-name' }, b.name), h('p', null, ['Learning the moves', 'Plays for fun', 'Spots simple tricks', 'A steady player', 'Plans ahead', 'Strong and sharp', 'Expert level', 'Full strength'][sel.lvl - 1])));
    bstrip.innerHTML = ''; BOTS.forEach((bt, i) => bstrip.append(h('button', { class: 'bs' + (sel.lvl === i + 1 ? ' on' : '') + ((rec.beat || {})[i + 1] ? ' beat' : ''), onclick: () => { sel.lvl = i + 1; beep('card'); draw(); } }, avatar(bt.avatar, 40), h('small', null, `Lv ${i + 1}`))));
    playBtn.innerHTML = ''; playBtn.append(icon('play', 22), h('span', null, `Play ${b.name}`));
  };
  draw();
  const colSeg = h('div', { class: 'seg' }); const dc = () => { colSeg.innerHTML = ''; [['w', `${sideName(id, 'w')} (moves first)`], ['b', sideName(id, 'b')]].forEach(([v, l]) => colSeg.append(h('button', { class: sel.color === v ? 'on' : '', onclick: () => { sel.color = v; beep('toggle'); dc(); } }, l))); }; dc();
  main.append(spot, bstrip, h('div', { class: 'card setup2' }, h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Play as'), colSeg)),
    h('button', { class: 'card lesson', onclick: () => startWorldGame(id, { local: true }) }, h('div', { class: 'ic dark' }, icon('friends', 24)), h('div', null, h('div', { class: 't' }, 'Pass & Play'), h('div', { class: 'd' }, 'Two players, one device')), h('span', { class: 'ck' }, icon('next', 20))),
    h('div', { class: 'play-dock' }, playBtn));
}
function pieceGuide(id) {
  const map = WP_KIND[id] || {}; const rows = [];
  for (const L in map) {
    const t = h('span', { class: 'wtok' }); t.innerHTML = wpSvg(id, L, 'w', false, 'trad');
    const e = h('span', { class: 'wtok' }); e.innerHTML = wpSvg(id, L, 'w', false, 'eng');
    const pt = (worldMeta(id).pieceTypes || {})[L];
    rows.push(h('div', { class: 'wguide-row' }, t, e, h('div', null, h('b', null, tr(pt ? pt.name : wpName(id, L, false))), pt && pt.native && pt.native !== pt.name ? h('div', { class: 'muted small' }, pt.native) : null)));
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
  const bar = (side) => h('div', { class: 'pbar wbar' + (g.turn() === side && !cur.over ? ' on' : '') }, bot && side !== cur.color ? avatar(bot.avatar, 34) : avatar(side === cur.color || cur.local ? myAvatar() : 'friend', 34),
    h('div', { class: 'grow row', style: { gap: '8px', alignItems: 'baseline' } }, h('span', { class: 'pname' }, bot && side !== cur.color ? bot.name : cur.local ? tr(sideName(cur.v, side)) : profile.name || tr('You')), h('span', { class: 'prating' }, cur.local ? '' : tr(sideName(cur.v, side)))),
    g.turn() === side && !cur.over ? h('span', { class: 'wturn' }, thinking && side !== cur.color ? 'thinking...' : 'to move') : null);
  const topSide = flipped ? 'w' : 'b';
  const topBar = h('div'), botBar = h('div');
  const F = focusScreen(main, { title: tr(m.name), sub: cur.local ? 'Pass & Play' : `vs ${bot.name}, level ${cur.bot}`, back: () => { worldView = { g: cur.v }; render(); },
    right: [h('button', { class: 'fs-back', 'aria-label': 'Turn board', onclick: () => { cur.flip = !cur.flip; render(); } }, icon('flip', 22))] });
  const msg = h('div', { class: 'fs-msg' });
  const movesEl = h('div', { class: 'moves vmoves strip' });
  vb.el.style.setProperty('--ar', vb.files / vb.ranks);
  F.stage.classList.add('table'); F.stage.append(topBar, vb.el, botBar);
  F.below.append(msg, h('div', { class: 'mstrip' }, movesEl));
  let thinking = false;
  const refresh = () => {
    topBar.innerHTML = ''; topBar.append(bar(topSide)); botBar.innerHTML = ''; botBar.append(bar(topSide === 'w' ? 'b' : 'w'));
    const st = g.status();
    if (st.over && !cur.over) finish(st);
    const myTurn = !cur.over && (cur.local || g.turn() === cur.color) && !thinking;
    vb.interactive = myTurn; vb.set(vState(g, cur.v), myTurn ? g.legalMoves() : []);
    msg.className = 'fs-msg' + (cur.over ? ' good' : '');
    msg.textContent = cur.over ? resultText(cur.over) : thinking ? 'Thinking...' : g.inCheck() ? `Check! ${sideName(cur.v, g.turn())} to move` : '';
    movesEl.innerHTML = ''; cur.sans = cur.sans || [];
    cur.sans.forEach((s, i) => { if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.')); movesEl.append(h('span', { class: 'm' + (i === cur.sans.length - 1 ? ' cur' : '') }, s)); });
    if (!cur.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Your move list will appear here'));
    if (!cur.over) {
      const pass = myTurn && g.legalMoves().find(mm => isPass(cur.v, mm));
      F.setActions([
        { ic: 'undo', label: 'Undo', disabled: !cur.moves.length || thinking, on: () => { const n = cur.local ? 1 : (g.turn() === cur.color ? 2 : 1); for (let i = 0; i < n && cur.moves.length; i++) { cur.moves.pop(); cur.sans.pop(); g.undo(); } cur.undos = (cur.undos || 0) + 1; refresh(); } },
        pass ? { ic: 'next', label: 'Pass', on: () => userMove(pass) } : null,
        { ic: 'bulb', label: 'Hint', disabled: thinking || !myTurn, on: () => hint() },
        { ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', 'End this game?', 'Resign', () => { cur.over = { result: cur.local ? (g.turn() === 'w' ? '0-1' : '1-0') : cur.color === 'w' ? '0-1' : '1-0', reason: 'resign' }; onOver(); refresh(); }) }]);
    } else F.setActions([
      cur.moves.length >= 4 ? { ic: 'search', label: 'Review', on: () => worldReview(g, cur) } : null,
      { ic: 'repeat', label: 'Play again', primary: true, on: () => startWorldGame(cur.v, { bot: cur.bot, color: cur.color, local: cur.local }) }]);
    movesEl.scrollLeft = movesEl.scrollWidth;
  };
  const confirmResign = () => { try { return window.confirm(tr('Resign this game?')); } catch (e) { return true; } };
  const resultText = o => { const who = o.result === '1/2-1/2' ? null : o.result === '1-0' ? 'w' : 'b'; const why = (({ checkmate: 'checkmate', stalemate: 'stalemate', resign: 'resignation', repetition: 'repetition', 'insufficient-material': 'not enough pieces to win', 'move-rule': 'move limit', 'counting-rule': 'counting rule', 'three-checks': 'three checks', 'king-of-the-hill': 'king reached the hill', 'king-exploded': 'king exploded', 'horde-destroyed': 'the horde is gone', 'no-pieces': 'no pieces left', 'variant-end': 'game over' }[o.reason]) || o.reason || ''); return who ? (why ? `${sideName(cur.v, who)} wins (${why})` : `${sideName(cur.v, who)} wins`) : (why ? `Draw (${why})` : 'Draw'); };
  const finish = st => { cur.over = { result: st.result, reason: st.reason }; onOver(); };
  const onOver = () => {
    const wp = worldPrefs(); const rec = wp.games[cur.v] = wp.games[cur.v] || { played: 0, wins: 0, beat: {} };
    rec.played++; wp.played[cur.v] = 1;
    const score = cur.over.result === '1/2-1/2' ? .5 : (cur.over.result === '1-0') === (cur.color === 'w') ? 1 : 0;
    if (!cur.local && score === 1) { rec.wins++; rec.beat = rec.beat || {}; rec.beat[cur.bot] = 1; rec.best = Math.max(rec.best || 0, cur.bot); }
    saveProfile(); beep(score === 1 || cur.local ? 'win' : 'move'); if (score === 1 && !cur.local) { confetti(); haptic([10, 40, 10]); }
    rewardEvent('worldGame', { variant: cur.v, score: cur.local ? null : score, level: cur.bot, local: cur.local, moves: cur.moves.length });
    const token = cur;
    setTimeout(() => { if (worldCur !== token || !worldView || !worldView.play) return; showWorldResult(cur, score, resultText(cur.over), () => worldReview(g, cur)); }, 1300);
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
  if (worldView.step === 0 && !worldView.keepMistakes) worldView.mistakes = 0;
  const F = focusScreen(main, { title: tr(L.title), sub: tr(worldMeta(id).name), back: () => { worldView = { g: id }; render(); }, progress: [worldView.step, steps.length] });
  const bubble = hootSays(step.text, step.type === 'text' ? 'talk' : 'idle'); F.above.append(bubble);
  const hootW = bubble.querySelector('.who').firstChild, react = m => { if (typeof hootReact === 'function') hootReact(hootW, m); };
  const msg = h('div', { class: 'fs-msg' });
  let complete = step.type === 'text';
  const isLast = worldView.step >= steps.length - 1;
  const advance = () => {
    if (!isLast) { worldView.step++; worldView.keepMistakes = true; render(); return; }
    const wp = worldPrefs(), key = id + '/' + L.id, first = !wp.lessons[key]; wp.lessons[key] = 1;
    const stars = !worldView.mistakes ? 3 : worldView.mistakes <= 2 ? 2 : 1; wp.stars = wp.stars || {}; wp.stars[key] = Math.max(wp.stars[key] || 0, stars); saveProfile();
    if (first) { rewardEvent('lesson'); if (course.lessons.every(x => wp.lessons[id + '/' + x.id])) rewardEvent('course'); }
    const nxt = course.lessons[course.lessons.indexOf(L) + 1];
    showLessonResults({ title: 'Lesson complete!', subtitle: tr(L.title), stars, firstTime: first, next: () => { if (nxt) { worldView = { g: id, lesson: nxt, step: 0 }; render(); } else startWorldGame(id, { bot: 1, color: 'w' }); }, nextLabel: nxt ? 'Next lesson' : "Let's play!", done: () => { worldView = { g: id }; render(); } });
  };
  let restartAct = null;
  const navActions = () => F.setActions([worldView.step > 0 ? { ic: 'back', label: 'Back', on: () => { worldView.step--; worldView.keepMistakes = true; render(); } } : null, restartAct,
    { ic: isLast ? 'check' : 'next', label: isLast ? 'Finish' : 'Next', primary: true, disabled: !complete, on: advance }]);
  const nextBtn = { set disabled(v) { navActions(); } };
  const finishTask = text => { complete = true; nextBtn.disabled = false; msg.className = 'fs-msg good'; msg.textContent = tr(text || 'Great job!'); beep('correct'); react('cheer'); haptic([8, 30, 8]); };
  const missTask = () => { worldView.mistakes = (worldView.mistakes || 0) + 1; react('sad'); haptic(20); };
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
        else { const r = g.play(uci); show(); msg.className = 'fs-msg bad'; msg.textContent = tr(step.fail || 'Not quite. Try again!'); beep('wrong'); missTask(); setTimeout(() => { if (r) g.undo(); show(); }, 900); }
      } else if (step.type === 'line') {
        if (uci !== step.moves[k]) { msg.className = 'fs-msg bad'; msg.textContent = tr('Not this time. Look again!'); beep('wrong'); missTask(); show(); return; }
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
      if (step.arrows && step.arrows.length) vb.layer.append(worldArrows(vb, step.arrows)); };
    vb.draw();
    vb.el.style.setProperty('--ar', vb.files / vb.ranks);
    F.stage.append(vb.el);
    if (step.type !== 'text') { msg.textContent = step.type === 'line' ? tr('Play the moves. The other side will answer.') : tr('Your move!'); restartAct = { ic: 'undo', label: 'Restart', on: () => { worldView.keepMistakes = true; render(); } }; }
  }
  F.below.append(msg);
  navActions();
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

// lesson arrows, drawn in board cells so the heads keep their shape on any board
function worldArrows(vb, arrows) {
  const NS = 'http://www.w3.org/2000/svg', F = vb.files, R = vb.ranks, svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${F} ${R}`); svg.setAttribute('class', 'varrows');
  const cell = sq => { const p = vb.pos(sq); return p && [p[0] / 100 * F, p[1] / 100 * R]; };
  for (const [a, b] of arrows) {
    const p = cell(a), q = cell(b); if (!p || !q) continue;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]); if (!len) continue;
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len, sx = p[0] + ux * .3, sy = p[1] + uy * .3, ex = q[0] - ux * .42, ey = q[1] - uy * .42;
    const line = document.createElementNS(NS, 'line');
    Object.entries({ x1: sx, y1: sy, x2: ex, y2: ey, stroke: '#3f9a4a', 'stroke-width': .18, 'stroke-linecap': 'round', opacity: .85 }).forEach(([k, v]) => line.setAttribute(k, v));
    const head = document.createElementNS(NS, 'polygon'), px = -uy, py = ux, hx = q[0] - ux * .12, hy = q[1] - uy * .12;
    head.setAttribute('points', [[hx, hy], [ex - ux * .05 + px * .28, ey - uy * .05 + py * .28], [ex - ux * .05 - px * .28, ey - uy * .05 - py * .28]].map(v => v.join(',')).join(' '));
    head.setAttribute('fill', '#3f9a4a'); head.setAttribute('opacity', .85);
    svg.append(line, head);
  }
  return svg;
}

// end-of-game card for World Games
function showWorldResult(cur, score, detail, review) {
  const bot = cur.bot ? BOTS[cur.bot - 1] : null, m = worldMeta(cur.v), nextLvl = !cur.local && score === 1 && cur.bot < 8;
  presentResults({ mood: cur.local ? 'cheer' : score === 1 ? 'cheer' : score === .5 ? 'happy' : 'sad', title: cur.local ? detail : score === 1 ? 'You win!' : score === .5 ? 'A draw' : `${bot.name} wins`,
    subtitle: cur.local ? tr(m.name) : (nextLvl ? `${detail}. Next up: ${BOTS[cur.bot].name}, level ${cur.bot + 1}` : detail), stats: [{ label: 'Moves', value: Math.ceil(cur.moves.length / 2) }],
    buttons: [cur.moves.length >= 4 ? { label: 'Review', on: review } : null, { label: nextLvl ? 'Next level' : 'Play again', primary: true, on: () => startWorldGame(cur.v, { bot: nextLvl ? cur.bot + 1 : cur.bot, color: cur.color, local: cur.local }) }].filter(Boolean) });
}
