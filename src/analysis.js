// Analysis board: explore any position with live engine lines, an eval bar and opening names.
// Includes a position editor and FEN / PGN import and export.
'use strict';
let ANA = null;
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
    if (!m) throw new Error('Could not read move "' + tok + '"');
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
function renderAnalysis(main) {
  const A = ANA; if (!A) { route = 'play'; return render(); }
  if (A.editing) return renderEditor(main);
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { ANA = null; route = A.back || 'play'; render(); } }, icon('back', 18), 'Done'), h('h2', { class: 'grow' }, 'Analysis')));
  const g = new Game(A.startFen, A.moves.slice(0, A.ply));
  const evalBar = h('div', { class: 'evalbar' }, h('div', { class: 'fill' }), h('span', null, ''));
  const bv = new BoardView({
    orient: A.orient || 'w',
    getTargets: sq => g.targetsFrom(sq),
    onMove: (from, to) => {
      const play = uci => { const res = g.play(uci); if (!res) return; playSound(res); A.moves = A.moves.slice(0, A.ply).concat([uci]); A.ply++; render(); };
      if (g.needsPromo(from, to)) return modal((box, close) => { const c = g.turn(); box.append(h('h2', null, 'Promote to'), h('div', { class: 'promo' }, ['q', 'r', 'b', 'n'].map(t => h('button', { style: { backgroundImage: `url(${PIECE_URL[c + t]})` }, onclick: () => { close(); play(sqName(from) + sqName(to) + t); } })))); });
      play(sqName(from) + sqName(to));
    },
  });
  main.append(h('div', { class: 'anaboard' }, evalBar, h('div', { class: 'grow' }, bv.el)));
  const st = g.viewState();
  const op = openingName(A.moves.slice(0, A.ply).concat()) && A.startFen === START_FEN ? openingName(A.moves.slice(0, A.ply)) : null;
  const linesEl = h('div', { class: 'lines' });
  main.append(h('div', { class: 'row' }, h('span', { class: 'pill' }, op || (A.ply ? 'Custom line' : 'Start')), h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { A.engine = !A.engine; render(); } }, icon('cpu' in ICON_PATHS ? 'cpu' : 'bolt', 16), A.engine ? 'Engine on' : 'Engine off')));
  main.append(linesEl);
  // move list
  const movesEl = h('div', { class: 'moves' });
  const full = new Game(A.startFen, A.moves);
  full.sans.forEach((s, i) => { if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.')); movesEl.append(h('span', { class: 'm' + (i + 1 === A.ply ? ' cur' : ''), onclick: () => { A.ply = i + 1; render(); } }, s)); });
  if (!full.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Make moves for either side to explore.'));
  main.append(movesEl, h('div', { class: 'nav' },
    h('button', { class: 'btn sm', onclick: () => { A.ply = 0; render(); } }, icon('first', 20)), h('button', { class: 'btn sm', onclick: () => { A.ply = Math.max(0, A.ply - 1); render(); } }, icon('prev', 20)),
    h('button', { class: 'btn sm', onclick: () => { A.ply = Math.min(A.moves.length, A.ply + 1); render(); } }, icon('next', 20)), h('button', { class: 'btn sm', onclick: () => { A.ply = A.moves.length; render(); } }, icon('last', 20))));
  main.append(h('div', { class: 'controls', style: { gridTemplateColumns: 'repeat(5,1fr)' } },
    h('button', { class: 'btn', onclick: () => { A.orient = (A.orient || 'w') === 'w' ? 'b' : 'w'; render(); } }, icon('flip', 22), 'Flip'),
    h('button', { class: 'btn', onclick: () => { A.editing = true; A.edit = Array.from(new E.Position(g.pos.fen()).board); A.editTurn = g.turn(); render(); } }, icon('edit', 22), 'Edit'),
    h('button', { class: 'btn', onclick: importDialog }, icon('download', 22), 'Import'),
    h('button', { class: 'btn', onclick: () => modal((box, close) => box.append(h('h2', null, 'Export'), h('button', { class: 'btn block', onclick: () => copyText(g.pos.fen()) }, icon('copy', 18), 'Copy FEN'), h('div', { style: { height: '8px' } }), h('button', { class: 'btn block', onclick: () => copyText(toPgn(A.startFen, A.moves)) }, icon('copy', 18), 'Copy PGN'), h('pre', { class: 'pgn' }, toPgn(A.startFen, A.moves)), h('button', { class: 'btn primary block', onclick: close }, 'Done'))) }, icon('upload', 22), 'Export'),
    h('button', { class: 'btn', onclick: () => { A.moves = A.moves.slice(0, A.ply); render(); } }, icon('trash', 22), 'Cut')));
  // engine lines
  const drawLines = (lines, depth) => {
    linesEl.innerHTML = '';
    if (!A.engine) { linesEl.append(h('div', { class: 'small muted' }, 'Engine is off.')); evalBar.classList.add('off'); return; }
    if (!lines) { linesEl.append(h('div', { class: 'small muted' }, 'Thinking…')); return; }
    if (!lines.length) { const s = g.status(); linesEl.append(h('div', { class: 'small muted' }, s.over ? `Game over: ${s.reason}.` : 'No lines.')); return; }
    const sgn = g.turn() === 'w' ? 1 : -1;
    const top = lines[0].cp * sgn;
    evalBar.querySelector('.fill').style.height = (100 - winPct(top)) + '%'; evalBar.querySelector('span').textContent = fmtEval(top);
    const arrows = [];
    lines.forEach((l, k) => {
      const san = pvSan(g.pos.fen(), [], l.pv, 8);
      linesEl.append(h('button', { class: 'line', onclick: () => { if (!l.pv[0]) return; A.moves = A.moves.slice(0, A.ply).concat([l.pv[0]]); A.ply++; render(); } }, h('span', { class: 'pill' }, fmtEval(l.cp * sgn)), h('span', null, san.join(' '))));
      if (l.pv[0]) arrows.push([sqFromName(l.pv[0].slice(0, 2)), sqFromName(l.pv[0].slice(2, 4)), k === 0 ? '#7cc04a' : '#6fb3ffaa']);
    });
    bv.set(Object.assign(st, { arrows }));
    if (depth) linesEl.append(h('div', { class: 'small muted' }, `${engineName()}, depth ${depth}`));
  };
  bv.set(st);
  if (A.engine && !g.status().over) {
    const myReq = ++A.req;
    drawLines(null);
    (async () => {
      for (const d of [8, 12, 16]) {
        const lines = await analyzePos(g.pos.fen(), 3, d);
        if (ANA !== A || A.req !== myReq || route !== 'analysis') return;
        drawLines(lines, sfState === true ? d : null);
        if (sfState !== true) break;
      }
    })();
  } else drawLines(g.status().over ? [] : null);
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
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { A.editing = false; render(); } }, icon('back', 18), 'Cancel'), h('h2', { class: 'grow' }, 'Edit position')));
  const board = Int8Array.from(A.edit);
  const bv = new BoardView({ orient: A.orient || 'w' });
  bv.el.addEventListener('pointerdown', e => {
    const sq = bv.sqAt(e); if (sq < 0) return;
    if (pick === 'x') board[sq] = 0;
    else { const code = E.PIECE_CHARS.indexOf(pick[0] === 'w' ? pick[1].toUpperCase() : pick[1]); if (code === 6 || code === 14) for (let s = 0; s < 128; s++) if (board[s] === code) board[s] = 0; board[sq] = board[sq] === code ? 0 : code; }
    A.edit = Array.from(board); bv.set({ board });
  });
  bv.set({ board });
  const pal = h('div', { class: 'palette' });
  const drawPal = () => { pal.innerHTML = ''; for (const c of ['w', 'b']) for (const t of 'kqrbnp') pal.append(h('button', { class: pick === c + t ? 'on' : '', style: { backgroundImage: `url(${PIECE_URL[c + t]})` }, onclick: () => { pick = A.pick = c + t; drawPal(); } })); pal.append(h('button', { class: 'erase' + (pick === 'x' ? ' on' : ''), onclick: () => { pick = A.pick = 'x'; drawPal(); } }, icon('trash', 20))); };
  drawPal();
  const turnSeg = h('div', { class: 'seg' });
  const drawTurn = () => { turnSeg.innerHTML = ''; [['w', 'White to move'], ['b', 'Black to move']].forEach(([v, l]) => turnSeg.append(h('button', { class: A.editTurn === v ? 'on' : '', onclick: () => { A.editTurn = v; drawTurn(); } }, l))); };
  drawTurn();
  main.append(bv.el, pal, turnSeg, h('div', { class: 'row' },
    h('button', { class: 'btn grow', onclick: () => { A.edit = Array.from(new E.Position().board); render(); } }, 'Start position'),
    h('button', { class: 'btn grow', onclick: () => { A.edit = Array.from(new Int8Array(128)); render(); } }, 'Clear')),
    h('button', { class: 'btn primary block', onclick: () => {
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
    } }, icon('check', 18), 'Analyze this position'));
}
