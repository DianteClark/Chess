// Analysis board: explore any position with live engine lines, an eval bar and opening names.
// Includes a position editor and FEN / PGN import and export.
// Both are focus screens: one phone screen, no page scrolling.
'use strict';
let ANA = null, anaLinesOpen = false;
function openAnalysis(src = {}) {
  ANA = { startFen: src.fen || START_FEN, moves: (src.moves || []).slice(), ply: src.ply != null ? src.ply : (src.moves || []).length, engine: true, editing: false, back: route === 'analysis' ? 'play' : route, lines: null, req: 0 };
  route = 'analysis'; render(); window.scrollTo(0, 0);
}
function parsePgn(text) {
  // returns {fen, moves} or throws
  let fen = START_FEN;
  const fm = text.match(/\[FEN\s+"([^"]+)"\]/); if (fm) fen = fm[1];
  let body = text.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, ' '); // drop variations
  body = body.replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ');
  const pos = new E.Position(fen), moves = [];
  for (const tok of body.split(/\s+/).filter(Boolean)) {
    const clean = tok.replace(/[!?]+$/, '').replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
    const m = pos.moveFromSan(clean) || (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(clean) ? pos.moveFromUci(clean) : 0);
    if (!m) throw new Error(`Could not read move "${tok}"`);
    moves.push(pos.uci(m)); pos.make(m);
  }
  return { fen, moves };
}
function toPgn(fen, moves) {
  const g = new Game(fen, moves); const head = [`[Event "Knight Club analysis"]`, `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`];
  if (fen !== START_FEN) head.push(`[SetUp "1"]`, `[FEN "${fen}"]`);
  const st = g.status(); const res = st.over ? st.result : '*';
  head.push(`[Result "${res}"]`);
  let body = ''; const startBlack = new E.Position(fen).turn === 1; let num = +fen.split(' ')[5] || 1;
  g.sans.forEach((s, i) => { const white = startBlack ? i % 2 === 1 : i % 2 === 0; if (white) body += num + '. '; else if (i === 0) body += num + '... '; body += s + ' '; if (!white) num++; });
  return head.join('\n') + '\n\n' + body + res;
}
// a square header button (engine toggle, flip)
function anaHeadBtn(ic, label, on, onclick, extra) {
  return h('button', { class: 'fs-back ana-hb' + (on ? ' on' : '') + (extra ? ' ' + extra : ''), 'aria-label': label, 'aria-pressed': on == null ? null : String(!!on), onclick: () => { haptic(6); beep('toggle'); onclick(); } }, icon(ic, 22));
}
function renderAnalysis(main) {
  const A = ANA; if (!A) { route = 'play'; return render(); }
  if (A.editing) return renderEditor(main);
  const orient = A.orient || 'w';
  const g = new Game(A.startFen, A.moves.slice(0, A.ply));
  const full = new Game(A.startFen, A.moves);
  const op = A.startFen === START_FEN && A.ply ? openingName(A.moves.slice(0, A.ply)) : null;
  const sub = op || (A.startFen !== START_FEN ? 'Custom position' : A.ply ? 'Custom line' : 'Starting position');
  const step = p => { p = Math.max(0, Math.min(A.moves.length, p)); if (p === A.ply) return; A.fwd = p === A.ply + 1; A.ply = p; render(); };
  const F = focusScreen(main, {
    title: 'Analysis', sub,
    back: () => { ANA = null; route = A.back || 'play'; render(); },
    right: [anaHeadBtn('bolt', 'Engine', A.engine, () => { A.engine = !A.engine; render(); }, 'eng'), anaHeadBtn('flip', 'Flip board', null, () => { A.orient = orient === 'w' ? 'b' : 'w'; render(); })],
  });
  F.root.classList.add('ana');
  // stage: thin eval bar beside the board
  const evalBar = h('div', { class: 'evalbar' + (orient === 'b' ? ' flip' : '') + (A.engine ? '' : ' off') }, h('div', { class: 'fill' }), h('span', null, ''));
  if (A.lastEval != null && A.engine) { evalBar.querySelector('.fill').style.height = (100 - winPct(A.lastEval)) + '%'; }
  const bv = new BoardView({
    orient,
    getTargets: sq => g.targetsFrom(sq),
    onMove: (from, to) => {
      const play = uci => { const res = g.play(uci); if (!res) return; playSound(res); A.moves = A.moves.slice(0, A.ply).concat([uci]); A.ply++; A.fwd = false; render(); };
      if (g.needsPromo(from, to)) return modal((box, close) => { const c = g.turn(); box.append(h('h2', null, 'Promote to'), h('div', { class: 'promo' }, ['q', 'r', 'b', 'n'].map(t => h('button', { style: { backgroundImage: `url(${PIECE_URL[c + t]})` }, onclick: () => { close(); play(sqName(from) + sqName(to) + t); } })))); });
      play(sqName(from) + sqName(to));
    },
  });
  F.stage.classList.add('ana-stage');
  F.stage.append(h('div', { class: 'ana-wrap' }, evalBar, bv.el));
  // swipe the board to step through the line (not when the swipe starts on a piece you could move)
  { let sx = null, sy = 0; bv.el.addEventListener('touchstart', e => { if (e.touches.length !== 1) { sx = null; return; } const t = e.touches[0]; const sq = bv.sqAt(t); const tg = sq >= 0 ? g.targetsFrom(sq) : null; sx = tg && tg.length ? null : t.clientX; sy = t.clientY; }, { passive: true });
    bv.el.addEventListener('touchend', e => { if (sx == null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { haptic(5); beep('tap'); step(A.ply + (dx < 0 ? 1 : -1)); } }, { passive: true }); }
  // keyboard: arrows step, Home / End jump
  const onKey = e => { if (e.target && /input|textarea/i.test(e.target.tagName)) return; if (document.querySelector('.modal-bg')) return; const k = { ArrowLeft: A.ply - 1, ArrowRight: A.ply + 1, Home: 0, End: A.moves.length }[e.key]; if (k != null) { e.preventDefault(); step(k); } };
  document.addEventListener('keydown', onKey); cleanups.push(() => document.removeEventListener('keydown', onKey));
  // below: engine lines (top line always, tap the chevron for three) and the move strip
  const linesEl = h('div', { class: 'lines' + (anaLinesOpen ? ' open' : '') });
  const movesEl = h('div', { class: 'moves strip' });
  full.sans.forEach((s, i) => { if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.')); movesEl.append(h('span', { class: 'm' + (i + 1 === A.ply ? ' cur' : '') + (i + 1 > A.ply ? ' after' : ''), onclick: () => { beep('tap'); step(i + 1); } }, s)); });
  if (!full.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Make moves for either side to explore.'));
  const strip = h('div', { class: 'mstrip' },
    h('button', { class: 'mnav', 'aria-label': 'Previous move', disabled: A.ply === 0, onclick: () => { beep('tap'); step(A.ply - 1); } }, icon('prev', 20)),
    movesEl,
    h('button', { class: 'mnav', 'aria-label': 'Next move', disabled: A.ply >= A.moves.length, onclick: () => { beep('tap'); step(A.ply + 1); } }, icon('next', 20)));
  F.below.append(linesEl, strip);
  setTimeout(() => { const cur = movesEl.querySelector('.cur'); movesEl.scrollLeft = cur ? cur.offsetLeft - movesEl.clientWidth / 2 + cur.offsetWidth / 2 : 0; }, 0);
  F.setActions([
    { ic: 'first', label: 'Start', disabled: A.ply === 0, on: () => step(0) },
    { ic: 'prev', label: 'Prev', disabled: A.ply === 0, on: () => step(A.ply - 1) },
    { ic: 'next', label: 'Next', disabled: A.ply >= A.moves.length, on: () => step(A.ply + 1) },
    { ic: 'edit', label: 'Editor', on: () => { A.editing = true; A.edit = Array.from(new E.Position(g.pos.fen()).board); A.editTurn = g.turn(); render(); } },
    { ic: 'share', label: 'Share', on: () => anaShareSheet(g) },
  ]);
  // engine lines
  const toggle = n => h('button', { class: 'ln-more', 'aria-label': anaLinesOpen ? 'Show one line' : 'Show three lines', 'aria-expanded': String(anaLinesOpen), onclick: () => { anaLinesOpen = !anaLinesOpen; beep('toggle'); linesEl.classList.toggle('open', anaLinesOpen); linesEl.querySelector('.ln-more').setAttribute('aria-expanded', String(anaLinesOpen)); } }, n ? h('small', null, n) : null, icon('next', 16));
  const note = txt => { linesEl.innerHTML = ''; linesEl.append(h('div', { class: 'line note' }, h('span', { class: 'grow' }, txt))); };
  const drawLines = (lines, depth) => {
    if (!A.engine) { note('Engine is off. Tap the bolt to turn it on.'); evalBar.classList.add('off'); return; }
    if (!lines) { linesEl.innerHTML = ''; linesEl.append(h('div', { class: 'line note think' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', { class: 'grow' }, 'Thinking…'))); return; }
    if (!lines.length) { const s = g.status(); note(s.over ? `Game over: ${s.reason}.` : 'No lines.'); return; }
    linesEl.innerHTML = '';
    const sgn = g.turn() === 'w' ? 1 : -1;
    const top = lines[0].cp * sgn; A.lastEval = top;
    evalBar.querySelector('.fill').style.height = (100 - winPct(top)) + '%'; evalBar.querySelector('span').textContent = fmtEval(top);
    const arrows = [];
    lines.forEach((l, k) => {
      const san = pvSan(g.pos.fen(), [], l.pv, 8);
      const ev = l.cp * sgn;
      const row = h('div', { class: 'lrow' + (k ? ' alt' : '') },
        h('button', { class: 'line', onclick: () => { if (!l.pv[0]) return; beep('tap'); A.moves = A.moves.slice(0, A.ply).concat([l.pv[0]]); A.ply++; A.fwd = true; render(); } },
          h('span', { class: 'pill ev ' + (ev > 30 ? 'w' : ev < -30 ? 'b' : 'eq') }, fmtEval(ev)), h('span', { class: 'pv' }, h('b', null, san[0] || ''), ' ' + san.slice(1).join(' '))),
        k === 0 && lines.length > 1 ? toggle(depth ? `d${depth}` : '') : null);
      linesEl.append(row);
      if (l.pv[0]) arrows.push([sqFromName(l.pv[0].slice(0, 2)), sqFromName(l.pv[0].slice(2, 4)), k === 0 ? '#7cc04a' : '#6fb3ffaa']);
    });
    linesEl.append(h('div', { class: 'ldepth small muted' }, depth ? `${engineName()}, depth ${depth}` : engineName()));
    bv.set(Object.assign(g.viewState(), { arrows }));
  };
  bv.set(g.viewState(), A.fwd ? g.lastFromTo : null); A.fwd = false;
  if (A.engine && !g.status().over) {
    const myReq = ++A.req;
    drawLines(null);
    (async () => {
      for (const d of [8, 12, 16]) {
        const lines = await analyzePos(g.pos.fen(), 3, d);
        if (ANA !== A || A.req !== myReq || route !== 'analysis' || A.editing) return;
        drawLines(lines, sfState === true ? d : null);
        if (sfState !== true) break;
      }
    })();
  } else drawLines(g.status().over ? [] : null);
}
// Share and export, import, and trimming the line: one bottom sheet
function anaShareSheet(g) {
  const A = ANA; const pgn = toPgn(A.startFen, A.moves), fen = g.pos.fen();
  modal((box, close) => {
    const tile = (ic, label, sub, on) => h('button', { class: 'ana-tile', onclick: () => { beep('tap'); on(); } }, h('span', { class: 'ic' }, icon(ic, 22)), h('span', { class: 'tx' }, h('b', null, label), h('small', null, sub)));
    box.classList.add('ana-sheet');
    box.append(h('h2', null, 'Share & export'),
      h('div', { class: 'ana-tiles' },
        tile('copy', 'Copy FEN', 'This position', () => copyText(fen)),
        tile('copy', 'Copy PGN', `${A.moves.length} moves`, () => copyText(pgn)),
        navigator.share ? tile('share', 'Share', 'Send the game', () => navigator.share({ title: 'Knight Club analysis', text: pgn }).catch(() => { })) : null,
        tile('download', 'Import', 'Paste a FEN or PGN', () => { close(); importDialog(); }),
        A.ply < A.moves.length ? tile('trash', 'Cut here', A.moves.length - A.ply === 1 ? 'Delete the next move' : `Delete the next ${A.moves.length - A.ply} moves`, () => { A.moves = A.moves.slice(0, A.ply); close(); render(); }) : null),
      h('pre', { class: 'pgn' }, pgn),
      h('button', { class: 'btn primary block', onclick: close }, 'Done'));
  });
}
function importDialog() {
  modal((box, close) => {
    const ta = h('textarea', { class: 'input', rows: 6, placeholder: 'Paste a FEN or a PGN game here' });
    box.append(h('h2', null, 'Import'), ta, h('div', { style: { height: '8px' } }), h('button', { class: 'btn primary block', onclick: () => {
      const t = ta.value.trim(); if (!t) return;
      try {
        if (/^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}\s+[wb]/.test(t)) { const p = new E.Position(t); if (!p.kings || p.kings[0] < 0 || p.kings[1] < 0) throw new Error('Both kings are needed.'); ANA.startFen = p.fen(); ANA.moves = []; ANA.ply = 0; }
        else { const r = parsePgn(t); ANA.startFen = r.fen; ANA.moves = r.moves; ANA.ply = r.moves.length; }
        close(); render();
      } catch (e) { toast(e.message || 'Could not read that.'); }
    } }, 'Load'));
  });
}
function renderEditor(main) {
  const A = ANA; let pick = A.pick || 'wp';
  const board = Int8Array.from(A.edit);
  const F = focusScreen(main, {
    title: 'Edit position', sub: 'Pick a piece, then tap squares',
    back: () => { A.editing = false; render(); },
    right: [anaHeadBtn('flip', 'Flip board', null, () => { A.orient = (A.orient || 'w') === 'w' ? 'b' : 'w'; render(); })],
  });
  F.root.classList.add('ana', 'ana-ed');
  const bv = new BoardView({ orient: A.orient || 'w' });
  // tap to place; drag across squares to paint
  let painting = false, lastSq = -1;
  const paint = sq => {
    if (sq < 0 || sq === lastSq) return; lastSq = sq;
    if (pick === 'x') board[sq] = 0;
    else { const code = E.PIECE_CHARS.indexOf(pick[0] === 'w' ? pick[1].toUpperCase() : pick[1]); if (code === 6 || code === 14) for (let s = 0; s < 128; s++) if (board[s] === code && s !== sq) board[s] = 0; board[sq] = board[sq] === code && !painting ? 0 : code; }
    A.edit = Array.from(board); bv.set({ board });
  };
  bv.el.addEventListener('pointerdown', e => { lastSq = -1; paint(bv.sqAt(e)); painting = true; haptic(4); });
  bv.el.addEventListener('pointermove', e => { if (painting && pick !== 'wk' && pick !== 'bk') paint(bv.sqAt(e)); });
  const stop = () => { painting = false; }; bv.el.addEventListener('pointerup', stop); bv.el.addEventListener('pointercancel', stop); bv.el.addEventListener('pointerleave', stop);
  bv.el.style.touchAction = 'none';
  bv.set({ board });
  F.stage.classList.add('ana-stage'); F.stage.append(bv.el);
  const pal = h('div', { class: 'palette' });
  const drawPal = () => { pal.innerHTML = ''; for (const c of ['w', 'b']) { for (const t of 'kqrbnp') pal.append(h('button', { class: pick === c + t ? 'on' : '', 'aria-label': (c === 'w' ? 'White ' : 'Black ') + { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }[t], style: { backgroundImage: `url(${PIECE_URL[c + t]})` }, onclick: () => { beep('tap'); pick = A.pick = c + t; drawPal(); } })); if (c === 'w') pal.append(h('button', { class: 'erase' + (pick === 'x' ? ' on' : ''), 'aria-label': 'Eraser', onclick: () => { beep('tap'); pick = A.pick = 'x'; drawPal(); } }, icon('trash', 20))); } };
  drawPal();
  F.below.append(pal);
  const done = () => {
    // build a FEN from the edited board and validate it
    const p = new E.Position(); p.board.set(board);
    let fen = p.fen().split(' '); fen[1] = A.editTurn; fen[2] = 'KQkq'; fen[3] = '-'; fen[4] = '0'; fen[5] = '1';
    try {
      const q = new E.Position(fen.join(' '));
      if (q.kings[0] < 0 || q.kings[1] < 0) return toast('Each side needs exactly one king.');
      for (let s = 0; s < 8; s++) if ((q.board[s] & 7) === 1 || (q.board[112 + s] & 7) === 1) return toast('Pawns cannot stand on the first or last rank.');
      if (q.attacked(q.kings[q.turn ^ 1], q.turn)) return toast('The side not to move is in check. That position is impossible.');
      A.startFen = q.fen(); A.moves = []; A.ply = 0; A.editing = false; render();
    } catch (e) { toast('That position is not valid.'); }
  };
  const actions = () => { F.setActions([
    { label: A.editTurn === 'w' ? 'White to move' : 'Black to move', on: () => { A.editTurn = A.editTurn === 'w' ? 'b' : 'w'; actions(); } },
    { ic: 'trash', label: 'Clear', on: () => { A.edit = Array.from(new Int8Array(128)); render(); } },
    { ic: 'board', label: 'Start', on: () => { A.edit = Array.from(new E.Position().board); render(); } },
    { ic: 'check', label: 'Done', primary: true, on: done },
  ]); const tb = F.actions.firstChild; tb.classList.add('ana-turn'); tb.prepend(h('img', { class: 'ana-turnpc', alt: '', src: PIECE_URL[A.editTurn + 'k'] })); };
  actions();
}
