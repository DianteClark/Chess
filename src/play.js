// Playing games: the shared game screen, the Arena (bots) and Pass & Play.
'use strict';
// ======================= MATCH HELPERS (shared) =======================
const matchCalm = () => document.body.classList.contains('no-anim') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// A dotted "more" icon for the game menu button (three dots in a row)
const MENU_DOTS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>';
function matchIcon(svg) { return h('span', { class: 'icn', html: svg }); }
// count queens of one colour (0 white, 1 black) on a 0x88 board
function queenCount(board, c) { let n = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = board[s]; if (p && (p & 7) === 5 && ((p & 8) ? 1 : 0) === c) n++; } return n; }
// Versus card shown for ~1.2s when a game starts. Taps go straight through to the board and skip it.
// o: {me:{name,rating,avatar}, opp:{...}, line, tag}
function versusIntro(o) {
  document.querySelectorAll('.vs-ov').forEach(x => x.remove());
  const side = (p, cls) => h('div', { class: 'vs-side ' + cls }, h('div', { class: 'vs-av' }, p.self && typeof playerBadgeEl === 'function' ? playerBadgeEl(84) : avatar(p.avatar || 'you', 84)), h('b', { class: 'vs-name' }, p.name || ''),
    p.self && typeof playerTitle === 'function' ? h('small', { class: 'vs-title' }, playerTitle()) : null, p.rating ? h('small', { class: 'vs-r' }, String(p.rating)) : h('small', { class: 'vs-r none' }, ' '));
  const ov = h('div', { class: 'vs-ov' + (matchCalm() ? ' calm' : ''), 'aria-hidden': 'true' },
    h('div', { class: 'vs-card' }, o.tag ? h('div', { class: 'vs-tag' }, o.tag) : null,
      h('div', { class: 'vs-row' }, side(o.me, 'l'), h('div', { class: 'vs-mid' }, h('span', null, 'VS')), side(o.opp, 'r')),
      o.line ? h('div', { class: 'vs-line' }, o.line) : null));
  document.body.append(ov);
  let gone = false;
  const close = () => { if (gone) return; gone = true; document.removeEventListener('pointerdown', close, true); ov.classList.add('out'); setTimeout(() => ov.remove(), 260); };
  document.addEventListener('pointerdown', close, true);
  setTimeout(close, matchCalm() ? 900 : 1250);
  beep('whoosh');
  return close;
}
// PGN with headers, for copying and sharing
function matchPgn(g, white, black, result) {
  const d = new Date(), head = [`[Event "Knight Club"]`, `[Date "${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}"]`, `[White "${white || 'White'}"]`, `[Black "${black || 'Black'}"]`, `[Result "${result || '*'}"]`];
  if (g.startFen !== START_FEN) head.push(`[SetUp "1"]`, `[FEN "${g.startFen}"]`, `[Variant "Chess960"]`);
  return head.join('\n') + '\n\n' + (g.pgnMoves() + ' ' + (result || '*')).trim();
}
// ---- game archive: every finished game writes one record into profile.games (newest first) ----
// Old records only had {t, opp, oppR, color, score, reason, rated, before, after, pgn, moves, tc, startFen, online}.
// New records add: id, kind ('bot' | 'local' | 'friend'), result ('1-0' | '0-1' | '1/2-1/2'), white, black, oppAvatar,
// delta, variant ('std' | '960'), plies, dur (ms), opening, key (moves joined, same key Game Review uses), and per kind:
// bot: bot (level index), coach, hints, takebacks; acc is filled in by linkReviewToGame() once the game is reviewed.
const GAME_ARCHIVE_MAX = 100;
function saveGameRecord(rec) {
  const moves = rec.moves || [];
  const base = { id: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), t: Date.now(), plies: moves.length, key: moves.join(''),
    variant: rec.startFen && rec.startFen !== START_FEN ? '960' : 'std' };
  if (!rec.opening && moves.length && (!rec.startFen || rec.startFen === START_FEN) && typeof openingName === 'function') { try { base.opening = openingName(moves.slice(0, 16)) || undefined; } catch (e) { } }
  const r = Object.assign(base, rec);
  if (r.startFen === START_FEN) delete r.startFen; // standard games keep the old shape (no startFen)
  r.mode = r.mode || r.kind; // the Me archive reads mode
  if (r.before != null && r.after != null) { r.delta = r.after - r.before; if (r.rated) r.ratingDelta = r.delta; }
  profile.games = profile.games || [];
  profile.games.unshift(r);
  profile.games = profile.games.slice(0, GAME_ARCHIVE_MAX);
  saveProfile();
  return r;
}
// Game Review can call this when it finishes, so the archive shows accuracy: linkReviewToGame(key, acc)
function linkReviewToGame(key, acc) { const r = (profile.games || []).find(x => x.key === key); if (r && acc != null) { r.acc = Math.round(acc * 10) / 10; saveProfile(); } return !!r; }
// A bottom sheet of big tiles. items: [{ic | svg, label, sub, on, disabled, danger, on_: bool (toggle state)}]
function gameMenuSheet(title, items) {
  beep('open');
  modal((box, close) => {
    box.classList.add('gm-sheet');
    box.append(h('h2', null, title), h('div', { class: 'gm-grid' }, items.filter(Boolean).map(it => h('button', { class: 'gm-tile' + (it.danger ? ' danger' : '') + (it.toggle != null ? ' tog' + (it.toggle ? ' on' : '') : ''), disabled: !!it.disabled,
      onclick: () => { haptic(6); beep(it.toggle != null ? 'toggle' : 'tap'); if (!it.keep) close(); it.on(); } },
      h('span', { class: 'gm-ic' }, it.svg ? matchIcon(it.svg) : icon(it.ic, 22)), h('b', null, it.label), it.sub ? h('small', null, it.sub) : null))),
      h('button', { class: 'btn block gm-close', onclick: () => { beep('close'); close(); } }, 'Close'));
  });
}

// ======================= GAME SCREEN (shared) =======================
// cfg: {game, players:{w,b}, orient, canMove(color), onUserMove(uci), getClock, onTick, title, sub, back, right,
//       menu(): extra menu tiles, canAnalyze(): bool, names:{w,b} for PGN, mine:[colors this device plays]}
function gameScreen(main, cfg) {
  const g = cfg.game;
  let viewPly = null; // null = live
  const mine = cfg.mine || [cfg.orient];
  const isOver = () => g.status().over || !!(cfg.result && cfg.result() !== '*');
  const board = new BoardView({
    orient: cfg.orient,
    getTargets: sq => (viewPly === null && cfg.canMove(g.turn())) ? g.targetsFrom(sq) : null,
    // the board shows its own promotion picker over the file (Board Engineer API)
    needsPromo: (from, to) => g.needsPromo(from, to),
    // premoves: queue one move while the other side is thinking (games against one opponent only)
    premove: cfg.premove ? { enabled: () => viewPly === null && !isOver() && mine.length === 1 && g.turn() !== mine[0], color: mine[0] } : null,
    onPremoveSet: () => beep('tap'),
    onMove: (from, to, dragged, promo) => cfg.onUserMove(sqName(from) + sqName(to) + (promo || ''), dragged),
  });
  const bar = (who, colorIdx) => {
    const capEl = h('div', { class: 'caps' });
    const turnEl = h('div', { class: 'turnmark hidden' });
    const status = h('div', { class: 'thinking' });
    const dots = h('div', { class: 'pthink hidden', 'aria-label': 'Thinking' }, h('i'), h('i'), h('i'));
    const clockTxt = h('span', { class: 'ct' });
    const clockEl = cfg.getClock ? h('div', { class: 'clock' }, h('span', { class: 'cflag' }, icon('flag', 16)), clockTxt) : null;
    const nameEl = h('span', { class: 'pname' }, who.name), ratingEl = h('span', { class: 'prating' }, who.rating ? '(' + who.rating + ')' : '');
    const av = who.self && typeof playerBadgeEl === 'function' ? playerBadgeEl(38) : avatar(who.avatar || 'you', 38);
    const el = h('div', { class: 'pbar' + (colorIdx ? ' pb-b' : ' pb-w') }, h('div', { class: 'avatar' }, av, h('i', { class: 'pside' })),
      h('div', { class: 'grow pinfo' }, h('div', { class: 'row', style: { gap: '6px' } }, nameEl, ratingEl, turnEl), capEl), status, dots, clockEl);
    return { el, capEl, turnEl, status, dots, colorIdx, clockEl, clockTxt, nameEl, ratingEl, bubble: null, bubT: 0, lastSec: null, flagged: false, lowRung: false };
  };
  const bottomColor = cfg.orient === 'w' ? 0 : 1;
  const topBar = bar(cfg.players[bottomColor ? 'w' : 'b'], bottomColor ^ 1), botBar = bar(cfg.players[bottomColor ? 'b' : 'w'], bottomColor);
  const barOf = color => (color === 'w' || color === 0) ? (topBar.colorIdx === 0 ? topBar : botBar) : (topBar.colorIdx === 1 ? topBar : botBar);
  // header: title, then the game menu button on the right
  const menuBtn = h('button', { class: 'fs-back gm-btn', 'aria-label': 'Game menu', onclick: () => openMenu() }, matchIcon(MENU_DOTS_SVG));
  const F = focusScreen(main, { title: cfg.title || 'Game', sub: cfg.sub, back: cfg.back, right: [...(cfg.right || []), menuBtn] });
  F.root.classList.add('gs');
  const movesEl = h('div', { class: 'moves strip', role: 'button', 'aria-label': 'All moves', onclick: e => { if (e.target.closest('.m,.backlive')) return; openMoves(); } });
  const navEl = h('div', { class: 'mstrip' },
    h('button', { class: 'mnav', 'aria-label': 'Previous move', onclick: () => { beep('tap'); setView(Math.max(0, (viewPly ?? g.moves.length) - 1)); } }, icon('prev', 20)),
    movesEl,
    h('button', { class: 'mnav', 'aria-label': 'Next move', onclick: () => { beep('tap'); setView((viewPly ?? g.moves.length) + 1); } }, icon('next', 20)),
    h('button', { class: 'mnav mlist', 'aria-label': 'Move list', onclick: () => openMoves() }, icon('list', 19)));
  F.stage.classList.add('table'); F.stage.append(topBar.el, board.el, botBar.el, navEl);
  // swipe on the board to step through moves while it is not your move
  { let sx = null; board.el.addEventListener('touchstart', e => { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    board.el.addEventListener('touchend', e => { if (sx == null || board.dragging) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) setView(dx < 0 ? (viewPly ?? g.moves.length) + 1 : Math.max(0, (viewPly ?? g.moves.length) - 1)); }, { passive: true }); }
  function setView(p) { if (p !== null && p >= g.moves.length) p = null; viewPly = p; refresh(); }
  function refreshBars(boardArr) {
    const c = captured(boardArr);
    for (const b of [topBar, botBar]) {
      b.capEl.innerHTML = '';
      const theirs = c.lostBy[b.colorIdx ^ 1];
      theirs.forEach(p => b.capEl.append(h('img', { src: pieceUrl(p), alt: '' })));
      const adv = b.colorIdx === 0 ? c.diff : -c.diff;
      if (adv > 0) b.capEl.append(h('b', null, '+' + adv));
      const myTurn = !isOver() && g.pos.turn === b.colorIdx;
      b.turnEl.classList.toggle('hidden', !myTurn);
      b.el.classList.toggle('turn', myTurn);
    }
  }
  function refreshMoves() {
    movesEl.innerHTML = '';
    g.sans.forEach((s, i) => {
      if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.'));
      const cur = (viewPly === null ? g.moves.length : viewPly) === i + 1;
      movesEl.append(h('span', { class: 'm' + (cur ? ' cur' : ''), onclick: () => setView(i + 1) }, s));
    });
    if (!g.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Your move list will appear here'));
    if (viewPly !== null) movesEl.append(h('button', { class: 'pill live backlive', onclick: () => setView(null) }, 'Back to game'));
    const op = currentOpening(); if (op) movesEl.prepend(h('span', { class: 'pill opn' }, op));
    const cur = movesEl.querySelector('.cur'); if (cur) movesEl.scrollLeft = cur.offsetLeft - movesEl.clientWidth / 2 + cur.offsetWidth / 2; else movesEl.scrollLeft = movesEl.scrollWidth;
  }
  function currentOpening() { if (g.startFen === START_FEN && g.moves.length && typeof openingName === 'function') { try { return openingName(g.moves.slice(0, Math.min(g.moves.length, 16))); } catch (e) { } } return g.startFen !== START_FEN ? 'Chess960' : null; }
  let extra = null; // extra board decorations (hint arrow) until the next refresh
  function refresh(animate) {
    const st = viewPly === null ? g.viewState() : g.boardAt(viewPly);
    extra = null;
    board.set(st, viewPly === null ? animate : null);
    refreshBars(st.board); refreshMoves();
    F.root.classList.toggle('gs-past', viewPly !== null);
  }
  function setButtons(list) { F.setActions(list); }
  function tickClocks() {
    const c = cfg.getClock && cfg.getClock();
    for (const b of [topBar, botBar]) {
      if (!b.clockEl) continue;
      if (!c) { b.clockEl.classList.add('hidden'); continue; }
      const color = b.colorIdx ? 'b' : 'w', ms = clk.rem(c, color), running = c.running === color;
      b.clockEl.classList.remove('hidden');
      b.clockTxt.textContent = clk.fmt(ms);
      b.clockEl.classList.toggle('on', running);
      const low = ms < Math.min(20000, c.base * 0.1 + 5000);
      b.clockEl.classList.toggle('low', low);
      b.clockEl.classList.toggle('crit', running && ms < 10000 && ms > 0);
      // sound: one warning when your time gets low, then a tick every second under 10 seconds
      if (running && mine.includes(color)) {
        if (low && !b.lowRung && ms > 0) { b.lowRung = true; beep('lowtime'); }
        if (ms < 10000 && ms > 0) { const sec = Math.ceil(ms / 1000); if (sec !== b.lastSec) { b.lastSec = sec; beep('countdown'); } }
      }
      if (ms <= 0 && !b.flagged && (running || c[color] <= 0)) { b.flagged = true; b.clockEl.classList.add('flag'); b.el.classList.add('flagged'); beep('timeup'); haptic(40); }
    }
    if (cfg.onTick) cfg.onTick();
  }
  if (cfg.getClock) { const iv = setInterval(tickClocks, 100); cleanups.push(() => clearInterval(iv)); }
  // ---- speech bubbles next to a player bar (bots talk) ----
  function say(color, text, ms = 3400) {
    const b = barOf(color); if (!text) return;
    if (b.bubble) b.bubble.remove();
    clearTimeout(b.bubT);
    const bub = h('div', { class: 'pbub', role: 'status', 'aria-live': 'polite' }, text);
    b.bubble = bub; b.el.append(bub);
    b.bubT = setTimeout(() => { bub.classList.add('out'); setTimeout(() => bub.remove(), 260); if (b.bubble === bub) b.bubble = null; }, ms);
  }
  // ---- smooth flip: the board turns on the table, then the bars swap ----
  let flipping = false;
  function flipNow() {
    board.flip();
    const up = board.el.previousSibling, down = board.el.nextSibling;
    board.el.before(down); board.el.after(up);
    const keep = extra; refresh();
    if (keep && viewPly === null) { extra = keep; board.set(Object.assign(g.viewState(), keep)); }
  }
  function flip(smooth) {
    if (flipping) return;
    if (!smooth || matchCalm() || !board.el.animate) { flipNow(); return; }
    flipping = true; beep('whoosh');
    const a = board.el.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(90deg) scale(.88)', offset: .5 }, { transform: 'rotate(180deg) scale(1)' }], { duration: 480, easing: 'cubic-bezier(.45,0,.25,1)' });
    [topBar.el, botBar.el].forEach(el => el.animate([{ opacity: 1 }, { opacity: 0, offset: .4 }, { opacity: 0, offset: .9 }, { opacity: 1 }], { duration: 520 }));
    a.onfinish = () => { flipNow(); flipping = false; };
  }
  // ---- the game menu ----
  function openMenu() {
    const st = profile.style = profile.style || {};
    const analyze = cfg.canAnalyze ? cfg.canAnalyze() : g.status().over;
    const names = cfg.names || { w: cfg.players.w.name, b: cfg.players.b.name };
    const result = cfg.result ? cfg.result() : (g.status().over ? g.status().result : '*');
    const pgn = () => matchPgn(g, names.w, names.b, result);
    const items = [...(cfg.menu ? cfg.menu() : []),
      { ic: 'flip', label: 'Flip board', on: () => flip(true) },
      { ic: soundOn ? 'soundOn' : 'soundOff', label: 'Sound', sub: soundOn ? 'On' : 'Off', toggle: soundOn, on: () => { soundOn = !soundOn; profile.sound = soundOn; saveProfile(); if (soundOn) beep('toggle'); toast(soundOn ? 'Sound on' : 'Sound off'); } },
      { ic: 'board', label: 'Coordinates', sub: st.coords !== false ? 'Shown' : 'Hidden', toggle: st.coords !== false, on: () => { st.coords = st.coords === false; saveProfile(); applyStyle(); } },
      { ic: 'palette', label: 'Board style', sub: 'Boards and pieces', on: () => { if (cfg.onLeave) cfg.onLeave(); meView = 'style'; go('me'); } },
      { ic: 'share', label: 'Share PGN', on: () => shareOrCopy(pgn(), 'My Knight Club game') },
      { ic: 'copy', label: 'Copy FEN', on: () => copyText(new Game(g.startFen, viewPly === null ? g.moves : g.moves.slice(0, viewPly)).pos.fen()) },
      { ic: 'search', label: 'Analysis', sub: analyze ? 'Open this game' : 'After the game', disabled: !analyze, on: () => { if (cfg.onLeave) cfg.onLeave(); openAnalysis({ fen: g.startFen, moves: g.moves.slice() }); } }];
    gameMenuSheet('Game menu', items);
  }
  // ---- the full move list ----
  function openMoves() {
    beep('open');
    modal((box, close) => {
      box.classList.add('ml-sheet');
      const op = currentOpening();
      const list = h('div', { class: 'ml-list' });
      const at = viewPly === null ? g.moves.length : viewPly;
      const off = g.startFen !== START_FEN && / b /.test(g.startFen) ? 1 : 0;
      for (let i = 0; i < g.sans.length; i += 2) {
        const cell = k => k < g.sans.length ? h('button', { class: 'ml-m' + (at === k + 1 ? ' cur' : ''), onclick: () => { beep('tap'); close(); setView(k + 1); } }, g.sans[k]) : h('span', { class: 'ml-m none' });
        list.append(h('div', { class: 'ml-row' + (i / 2 % 2 ? ' alt' : '') }, h('span', { class: 'ml-n' }, String(i / 2 + 1 + off)), cell(i), cell(i + 1)));
      }
      if (!g.sans.length) list.append(h('p', { class: 'muted center small' }, 'No moves yet'));
      box.append(h('div', { class: 'ml-head' }, h('h2', null, 'Moves'), h('span', { class: 'pill' }, `${g.sans.length} plies`)),
        op ? h('div', { class: 'ml-op' }, icon('book', 16), h('span', null, op)) : null, list,
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', { class: 'btn grow', onclick: () => { beep('tap'); close(); setView(0); } }, icon('first', 18), 'Start'),
          h('button', { class: 'btn primary grow', onclick: () => { beep('tap'); close(); setView(null); } }, 'Live', icon('last', 18))));
      setTimeout(() => { const c = list.querySelector('.cur'); if (c) c.scrollIntoView({ block: 'center' }); }, 30);
    });
  }
  refresh();
  tickClocks();
  return {
    board, refresh, setButtons, setView, tickClocks, F, say, openMenu, openMoves,
    addAbove(el) { F.above.prepend(el); }, addBelow(el) { F.below.append(el); }, setTitle: F.setTitle,
    setStatus(which, txt) { (which === 'top' ? topBar : botBar).status.textContent = txt || ''; },
    // animated "thinking" dots on a player's bar (which: 'top' | 'bottom' | 'w' | 'b')
    setThinking(which, on) { const b = which === 'top' ? topBar : which === 'bottom' ? botBar : barOf(which); b.dots.classList.toggle('hidden', !on); b.el.classList.toggle('busy', !!on); },
    // decorate the live board (e.g. a hint arrow) until the next refresh
    decorate(d) { extra = d; board.set(Object.assign(g.viewState(), d)); },
    setNames(names) { for (const b of [topBar, botBar]) { const p = names[b.colorIdx ? 'b' : 'w']; if (p) b.nameEl.textContent = p; } },
    flip(smooth) { flip(smooth); },
    get viewing() { return viewPly !== null; },
  };
}

// ======================= PLAY VS BOT =======================
let playSel = { bot: 0, color: 'w', rated: true, tc: '0+0', coach: true, variant: 'std' };
let gameHidden = false; // the game in progress stays alive while you look around the hub
function renderPlay(main) {
  if (profile.current && profile.current.mode === 'bot' && !gameHidden) return renderBotGame(main);
  const r = { r: profile.ladder.r };
  // suggest the bot closest to the player's rating
  if (playSel.bot === null || playSel.auto !== true) { let best = 0; BOTS.forEach((b, i) => { if (Math.abs(b.rating - r.r) < Math.abs(BOTS[best].rating - r.r)) best = i; }); playSel.bot = best; playSel.auto = true; }
  const lg = leagueOf(r.r);
  // resume a game in progress
  const inProgress = profile.current && profile.current.mode === 'bot' && !profile.current.result ? profile.current : null;
  if (inProgress) {
    const cb = BOTS[inProgress.bot], n = inProgress.moves.length, timed = !!(inProgress.clock && inProgress.clock.running);
    main.append(h('button', { class: 'resume-card', onclick: () => { gameHidden = false; haptic(8); beep('confirm'); render(); } }, h('span', { class: 'rc-av' }, avatar(cb.avatar, 46), h('i', { class: 'rc-live' })),
      h('div', { class: 'grow' }, h('b', null, `Game vs ${cb.name}`), h('small', null, n === 1 ? `${inProgress.rated ? 'Rated' : 'Casual'}, 1 move played. Tap to continue.` : `${inProgress.rated ? 'Rated' : 'Casual'}, ${n} moves played. Tap to continue.`),
        timed ? h('small', { class: 'rc-warn' }, icon('clock', 13), ' Your clock is running') : null), h('span', { class: 'go' }, icon('play', 20))));
  }
  main.append(h('div', { class: 'arena-head' }, h('div', { class: 'ah-l' }, h('h2', null, 'The Arena'), h('small', null, 'Pick an opponent and make your move')),
    h('button', { class: 'league-chip', onclick: () => { meView = null; go('me'); } }, leagueIcon(r.r, 22), h('div', null, h('b', null, String(Math.round(r.r))), h('small', null, lg.name))),
    h('button', { class: 'icon-btn', 'aria-label': 'Analysis board', onclick: () => { openAnalysis({}); } }, icon('search', 20))));
  // spotlight: the chosen bot, big
  const spot = h('div', { class: 'spotlight' });
  const recordVs = i => { const n = BOTS[i].name; const gs = profile.games.filter(x => x.opp === n && (!x.kind || x.kind === 'bot')); return { w: gs.filter(x => x.score === 1).length, d: gs.filter(x => x.score === .5).length, l: gs.filter(x => x.score === 0).length }; };
  const strip = h('div', { class: 'bot-strip' });
  const launch = () => { haptic(14); beep('start'); if (typeof screenWipe === 'function') screenWipe('center', () => startBotGame()); else startBotGame(); };
  const playBtn = h('button', { class: 'play-big', onclick: () => {
    // starting a new game throws away the unfinished one: ask first
    if (inProgress && inProgress.moves.length) return confirmBox('Start a new game?', `Your unfinished game vs ${BOTS[inProgress.bot].name} will be discarded.`, 'New game', launch);
    launch();
  } });
  const stakes = h('div', { class: 'stakes' });
  const drawStakes = () => {
    const L = profile.ladder, K = ladderK(L), br = BOTS[playSel.bot].rating, f = d => (d >= 0 ? '+' : '') + d;
    stakes.innerHTML = '';
    if (playSel.rated) { stakes.append(h('span', { class: 'st win' }, `Win ${f(eloDelta(L.r, br, 1, K))}`), h('span', { class: 'st' }, `Draw ${f(eloDelta(L.r, br, .5, K))}`), h('span', { class: 'st loss' }, `Loss ${f(eloDelta(L.r, br, 0, K))}`)); if (L.games < PLACEMENT_GAMES) stakes.append(h('span', { class: 'st' }, `Placement ${L.games + 1} of ${PLACEMENT_GAMES}`)); }
    else stakes.append(h('span', { class: 'st' }, 'Casual: your rating stays the same'));
  };
  const drawAll = () => {
    const b = BOTS[playSel.bot], rec = recordVs(playSel.bot), beaten = (stats().beaten || {})[playSel.bot + 1];
    spot.innerHTML = '';
    spot.append(h('div', { class: 'sp-av' }, avatar(b.avatar, 96), beaten ? h('span', { class: 'sp-beaten' }, icon('check', 14), 'Beaten') : null),
      h('div', { class: 'sp-info' }, h('div', { class: 'sp-lvl' }, `Level ${playSel.bot + 1}`), h('b', { class: 'sp-name' }, b.name), h('div', { class: 'sp-rt' }, icon('star', 14), ` ${b.rating}`), h('p', null, b.blurb),
        rec.w + rec.d + rec.l ? h('div', { class: 'sp-rec' }, h('span', { class: 'w' }, `${rec.w} won`), h('span', null, `${rec.d} drawn`), h('span', { class: 'l' }, `${rec.l} lost`)) : h('div', { class: 'sp-rec muted' }, 'First meeting')));
    strip.innerHTML = '';
    BOTS.forEach((bt, i) => strip.append(h('button', { class: 'bs' + (i === playSel.bot ? ' on' : '') + ((stats().beaten || {})[i + 1] ? ' beat' : ''), 'aria-label': bt.name, onclick: () => { if (playSel.bot !== i) { playSel.bot = i; beep('card'); haptic(5); drawAll(); if (typeof fxPop === 'function') fxPop(spot); } } }, avatar(bt.avatar, 40), h('small', null, String(bt.rating)))));
    playBtn.innerHTML = ''; playBtn.append(icon('play', 22), h('span', null, `Play ${b.name}`));
    drawStakes();
    const on = strip.querySelector('.bs.on'); if (on) setTimeout(() => strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' }), 0);
  };
  const seg = (opts, key) => { const el = h('div', { class: 'seg' }); const d = () => { el.innerHTML = ''; opts.forEach(([v, l]) => el.append(h('button', { class: playSel[key] === v ? 'on' : '', onclick: () => { playSel[key] = v; beep('toggle'); d(); drawStakes(); } }, l))); }; d(); return el; };
  drawAll();
  main.append(spot, strip);
  main.append(h('div', { class: 'card setup2' },
    h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Play as'), seg([['w', [pieceImg('wk')]], ['r', [icon('dice', 18)]], ['b', [pieceImg('bk')]]], 'color')),
    h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Game'), seg([[true, [icon('trophy', 16), ' Rated']], [false, [icon('learn', 16), ' Coach']]], 'rated')),
    h('div', { class: 'srow col' }, h('span', { class: 'lbl' }, 'Clock'), tcPicker(playSel)),
    h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Start'), seg([['std', 'Standard'], ['960', [icon('dice', 16), ' Chess960']]], 'variant'))));
  main.append(h('div', { class: 'play-dock' }, stakes, playBtn));
}
function startBotGame(botIdx = playSel.bot, color = playSel.color, rated = playSel.rated, tc = playSel.tc) {
  const c = color === 'r' ? (rand() < .5 ? 'w' : 'b') : color;
  const [tb, ti] = parseTc(tc);
  const v960 = playSel.variant === '960' ? E.chess960Fen() : null;
  profile.current = { mode: 'bot', bot: botIdx, color: c, rated, tc, clock: newClock(tb, ti), coach: !rated && playSel.coach !== false, startFen: v960 ? v960.fen : START_FEN, sp: v960 ? v960.n : null, moves: [], salt: Math.floor(rand() * 1e9), seed: Math.floor(rand() * 1e9), book: Math.floor(rand() * OPENINGS.length), result: null, hints: 0, takebacks: 0, started: Date.now(), intro: false };
  gameHidden = false; saveProfile(); go('play'); render();
}
function renderBotGame(main) {
  const cur = profile.current, bot = BOTS[cur.bot];
  const SF0 = cur.startFen || START_FEN, is960 = SF0 !== START_FEN;
  const g = new Game(SF0, cur.moves);
  let thinking = false, alive = true, hintBusy = false;
  cleanups.push(() => { alive = false; });
  const myName = profile.name || 'You';
  const you = { name: myName, rating: profile.ladder.r, avatar: myAvatar(), self: true };
  const them = { name: bot.name, rating: bot.rating, avatar: bot.avatar };
  const botColor = cur.color === 'w' ? 'b' : 'w';
  const tcText = cur.tc && cur.tc !== '0+0' ? tcLabel(...parseTc(cur.tc)) : '';
  const kindText = cur.rated ? 'Rated' : cur.coach ? 'Casual with Live Coach' : 'Casual';
  const v960 = cur.sp != null ? `Chess960 #${cur.sp}` : 'Chess960';
  const sub = is960 ? (tcText ? `${v960}, ${kindText}, ${tcText}` : `${v960}, ${kindText}`) : (tcText ? `${kindText}, ${tcText}` : kindText);
  const leave = () => { if (cur.result) { profile.current = null; saveProfile(); } else gameHidden = true; render(); };
  const scr = gameScreen(main, {
    title: `vs ${bot.name}`, sub,
    back: () => {
      // rated games in progress: make sure leaving is on purpose
      if (!cur.result && cur.rated && g.moves.length >= 1) return confirmBox('Leave this game?', cur.clock ? 'Your game is saved, but your clock keeps running while you are away. Come back from the Arena to continue.' : 'Your game is saved. Come back any time from the Arena to continue.', 'Leave', leave);
      leave();
    },
    onLeave: () => { if (!cur.result) gameHidden = true; },
    game: g, orient: cur.color, players: cur.color === 'w' ? { w: you, b: them } : { w: them, b: you }, mine: [cur.color], premove: true,
    names: cur.color === 'w' ? { w: myName, b: bot.name } : { w: bot.name, b: myName },
    result: () => cur.result ? cur.result.result : '*',
    canAnalyze: () => !!cur.result || !cur.rated,
    canMove: turn => !thinking && !cur.result && turn === cur.color,
    menu: () => cur.result ? [
      { ic: 'search', label: 'Game Review', on: review },
      { ic: 'repeat', label: 'Rematch', on: rematch },
    ] : [
      cur.rated ? null : { ic: 'undo', label: 'Takeback', disabled: thinking || g.moves.length < 1, on: takeback },
      cur.rated ? null : { ic: 'bulb', label: 'Hint', disabled: thinking || hintBusy || g.turn() !== cur.color, on: hint },
      { ic: 'half', label: 'Offer draw', disabled: thinking, on: offerDraw },
      { ic: 'flag', label: 'Resign', danger: true, on: resign },
    ],
    onUserMove: async (uci, dragged) => {
      const before = g.moves.slice(), botQ = queenCount(g.pos.board, botColor === 'w' ? 0 : 1);
      const res = g.play(uci); if (!res) return; playSound(res); clk.press(cur.clock, cur.color, g.moves.length); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(dragged ? null : g.lastFromTo);
      if (queenCount(g.pos.board, botColor === 'w' ? 0 : 1) < botQ && !g.status().over) talk('loseQueen');
      if (cur.coach && !g.status().over) { thinking = true; buttons(); const ok = await coachAfterUserMove(before, uci); thinking = false; if (ok === 'undo' || ok === false) { buttons(); return; } }
      afterMove();
    },
    getClock: cur.clock ? () => cur.clock : null,
    onTick: () => { if (cur.result) return; const f = clk.flagged(cur.clock); if (f) { const r = timeoutResult(g.pos, f); finish(r.result, r.reason); } },
  });
  // ----- bot personality: short lines in a bubble next to its bar, at most one every few moves -----
  const lines = (typeof BOT_LINES !== 'undefined' && BOT_LINES[bot.avatar]) || null;
  let lastTalk = -99;
  function talk(moment, force) {
    if (!lines || !lines[moment] || !alive) return;
    if (!force && g.moves.length - lastTalk < 6) return;
    lastTalk = g.moves.length;
    const pool = lines[moment], line = pool[Math.floor(Math.random() * pool.length)];
    scr.say(botColor, line);
  }
  function review() { openReview({ startFen: SF0, moves: g.moves.slice(), color: cur.color, white: cur.color === 'w' ? myName : bot.name, black: cur.color === 'b' ? myName : bot.name }); }
  function rematch() { startBotGame(cur.bot, cur.color === 'w' ? 'b' : 'w', cur.rated, cur.tc); }
  function resign() { confirmBox('Resign?', cur.rated && g.moves.length >= 2 ? 'This counts as a loss for your rating.' : 'End this game?', 'Resign', () => finish(cur.color === 'w' ? '0-1' : '1-0', 'resignation')); }
  function takeback() { if (thinking || !g.moves.length) return; g.undo(); if (g.turn() !== cur.color && g.moves.length) g.undo(); cur.takebacks = (cur.takebacks || 0) + 1; cur.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); coachTurnStart(); if (g.turn() !== cur.color) botTurn(); }
  // ----- live coach: Hoot sits above the board and talks in one compact bubble -----
  const coachTxt = h('div', { class: 'ctext' }), coachHead = h('div', { class: 'chead' }), coachBtns = h('div', { class: 'cbtns' });
  const coachWho = typeof hootEl === 'function' ? hootEl('idle', 44) : hoot(44);
  const coachBox = h('div', { class: 'coachline' + (cur.coach ? '' : ' hidden') }, h('div', { class: 'who' }, coachWho), h('div', { class: 'cbody' }, coachHead, coachTxt, coachBtns));
  scr.addAbove(coachBox);
  const coachMood = m => { if (typeof setHootMood === 'function') setHootMood(coachWho, m); };
  let preLines = null, coachHold = null;
  const coachSay = (headEls, text, btns, mood) => { coachHead.innerHTML = ''; coachHead.append(...headEls); coachTxt.textContent = text; coachBtns.innerHTML = ''; (btns || []).forEach(b => coachBtns.append(b)); coachBox.classList.toggle('has-btns', !!(btns && btns.length)); coachMood(mood || 'talk'); };
  function coachTurnStart() {
    if (!cur.coach || cur.result) return;
    const fen = g.pos.fen();
    preLines = analyzePos(fen, 2, 11);
    const th = threatsTo(fen, cur.color);
    if (th.length && g.moves.length > 1) coachSay([icon('alert', 20), h('b', null, 'Careful!')], `Your ${PNAME[th[0].piece]} on ${E.sqName(th[0].sq)} is under attack${th.length > 1 ? `, and so is your ${PNAME[th[1].piece]} on ${E.sqName(th[1].sq)}` : ''}. Can you save it, or is there something even stronger?`);
    else if (g.moves.length < 2) coachSay([h('b', null, 'Live Coach')], "I'll grade each of your moves and explain what I see. Make a move whenever you are ready!");
    else if (!coachTxt.textContent) coachSay([h('b', null, 'Your move')], 'Look for checks, captures and threats first, for both sides.');
  }
  async function coachAfterUserMove(movesBefore, uci) {
    if (!cur.coach) return true;
    coachSay([icon('hourglass', 18), h('b', null, 'Thinking about your move…')], '', null, 'think');
    let before; try { before = await (preLines || analyzePos(new Game(SF0, movesBefore).pos.fen(), 2, 11)); } catch (e) { before = []; }
    const after = await analyzePos(new Game(SF0, movesBefore.concat([uci])).pos.fen(), 1, 11);
    if (profile.current !== cur) return false;
    const gr = gradeSingle(SF0, movesBefore, uci, before, after, cur.color, bot.name);
    const bad = ['mistake', 'blunder'].includes(gr.cls);
    const head = [classBadge(gr.cls, 22), h('b', null, gr.mv.san), h('span', { class: 'muted' }, ' ' + clsPhrase(gr.cls))];
    if (!bad) { coachSay(head, gr.text, null, ['brilliant', 'great'].includes(gr.cls) ? 'cheer' : ['best', 'excellent', 'book'].includes(gr.cls) ? 'happy' : gr.cls === 'inaccuracy' ? 'think' : 'talk'); return true; }
    if (gr.best) scr.board.set(Object.assign(g.viewState(), { arrows: [[sqFromName(gr.best.slice(0, 2)), sqFromName(gr.best.slice(2, 4)), '#7cc04a']] }));
    return new Promise(res => {
      coachHold = res;
      coachSay(head, gr.text, [
        h('button', { class: 'btn primary grow', onclick: () => { g.undo(); cur.moves = g.moves.slice(); cur.takebacks = (cur.takebacks || 0) + 1; saveProfile(); scr.refresh(); coachHold = null; res('undo'); coachSay([icon('undo', 18), h('b', null, 'Move taken back')], 'Try to find a better move. The green arrow shows my suggestion.'); scr.board.set(Object.assign(g.viewState(), gr.best ? { arrows: [[sqFromName(gr.best.slice(0, 2)), sqFromName(gr.best.slice(2, 4)), '#7cc04a']] } : {})); coachTurnStart(); buttons(); } }, icon('undo', 18), 'Take it back'),
        h('button', { class: 'btn grow', onclick: () => { coachHold = null; res(true); scr.refresh(); } }, 'Keep my move', icon('next', 18))], 'sad');
    });
  }
  function buttons() {
    const over = !!cur.result;
    const list = [];
    if (!cur.rated) {
      list.push({ ic: 'undo', label: 'Takeback', disabled: over || thinking || g.moves.length < 1, on: takeback });
      list.push({ ic: 'bulb', label: cur.hints ? `Hint (${cur.hints})` : 'Hint', disabled: over || thinking || hintBusy || g.turn() !== cur.color, on: hint });
    }
    if (over) {
      list.push({ ic: 'search', label: 'Review', on: review });
      list.push({ ic: 'plus', label: 'New game', on: () => { profile.current = null; saveProfile(); render(); } });
      list.push({ ic: 'repeat', label: 'Rematch', primary: true, on: rematch });
    } else {
      list.push({ ic: 'half', label: 'Draw?', disabled: thinking, on: offerDraw });
      if (cur.rated) list.push({ ic: 'flip', label: 'Flip', on: () => scr.flip(true) });
      list.push({ ic: 'flag', label: 'Resign', on: resign });
    }
    scr.setButtons(list);
  }
  async function hint() {
    if (hintBusy || thinking) return;
    hintBusy = true; buttons(); scr.setThinking(cur.color, true);
    const r = await engineRequest({ kind: 'best', fen: SF0, moves: g.moves, nodes: 120000 });
    hintBusy = false; scr.setThinking(cur.color, false);
    if (!alive || profile.current !== cur) return;
    buttons();
    if (!r.uci || cur.result || g.turn() !== cur.color) return;
    cur.hints++; saveProfile(); buttons();
    const a = sqFromName(r.uci.slice(0, 2)), b = sqFromName(r.uci.slice(2, 4));
    const marks = {}; marks[a] = 'hint'; marks[b] = 'hint';
    beep('hint');
    scr.decorate({ marks, arrows: [[a, b, '#efbb4f']] });
  }
  let lastBotScore = 0, prevBotScore = null;
  function offerDraw() {
    // Bot accepts when it is not better, or the position is dead-even late in the game
    const accept = lastBotScore <= -60 || (g.moves.length > 70 && Math.abs(lastBotScore) < 25);
    if (accept) { toast(`${bot.name} accepts the draw.`); finish('1/2-1/2', 'agreement'); }
    else { toast(`${bot.name} wants to keep playing!`); if (lines) scr.say(botColor, 'No draw. Let us keep playing!', 2400); }
  }
  function afterMove() {
    const st = g.status();
    if (st.over) return finish(st.result, st.reason);
    buttons();
    if (g.turn() !== cur.color) botTurn();
  }
  async function botTurn() {
    thinking = true; buttons(); scr.setThinking(botColor, true);
    const t0 = Date.now();
    let level = bot;
    if (cur.clock) { const left = clk.rem(cur.clock, cur.color === 'w' ? 'b' : 'w'); const cap = left < 10000 ? 6000 : left < 30000 ? 25000 : left < 60000 ? 80000 : Infinity; if (cap < bot.nodes) level = Object.assign({}, bot, { nodes: cap }); }
    const myQ = queenCount(g.pos.board, cur.color === 'w' ? 0 : 1);
    const r = await engineRequest({ kind: 'bot', fen: SF0, moves: g.moves, level, seed: cur.seed + g.moves.length, salt: cur.salt, ply: g.moves.length, book: is960 ? null : OPENINGS[cur.book] });
    const wait = cur.clock && clk.rem(cur.clock, cur.color === 'w' ? 'b' : 'w') < 30000 ? 0 : Math.max(0, 450 + Math.random() * 400 - (Date.now() - t0));
    await new Promise(res => setTimeout(res, wait));
    if (!alive || profile.current !== cur) return;
    thinking = false; scr.setThinking(botColor, false);
    if (r.score !== undefined) { prevBotScore = lastBotScore; lastBotScore = r.score; }
    if (cur.result) return; // e.g. the bot ran out of time while thinking
    const res = g.play(r.uci); playSound(res);
    clk.press(cur.clock, cur.color === 'w' ? 'b' : 'w', g.moves.length);
    cur.moves = g.moves.slice(); saveProfile();
    if (!scr.viewing) scr.refresh(g.lastFromTo);
    // what the bot says about it
    if (!g.status().over) {
      if (queenCount(g.pos.board, cur.color === 'w' ? 0 : 1) < myQ) talk('takeQueen', true);
      else if (r.score !== undefined && !r.book && prevBotScore != null && r.score - prevBotScore >= 280 && r.score >= 200) talk('blunder');
      else if (res && res.check && Math.random() < .5) talk('check');
    }
    afterMove();
    coachTurnStart();
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
    saveGameRecord({ kind: 'bot', opp: bot.name, oppR: bot.rating, oppAvatar: bot.avatar, bot: cur.bot, color: cur.color, score, result, reason, rated: counted, before: Math.round(before), after: Math.round(after),
      pgn: g.pgnMoves(), moves: g.moves.slice(), tc: cur.tc, startFen: SF0, sp: is960 ? cur.sp : undefined, white: youWhite ? myName : bot.name, black: youWhite ? bot.name : myName,
      coach: !!cur.coach, hints: cur.hints || 0, takebacks: cur.takebacks || 0, dur: cur.started ? Date.now() - cur.started : undefined });
    buttons(); scr.refresh();
    rewardEvent('botGame', { score, reason, botIndex: cur.bot, rated: counted, tc: cur.tc, moves: g.moves.slice(), color: cur.color, botRating: bot.rating, myRating: before });
    if (is960) rewardEvent('game960');
    cur.greet = 0; talk(score === 1 ? 'mated' : score === 0 ? 'win' : 'draw', true);
    if (score === 1) { beep('win'); scr.board.burst('trophy'); if (typeof fxBurst === 'function') fxBurst(scr.board.el, 'confetti'); } else beep(score === .5 ? 'draw' : 'lose');
    setTimeout(() => showResult(score, reason, counted, before, after, promo), score === 1 ? 1300 : 900);
  }
  function showResult(score, reason, counted, before, after, promo) {
    if (!alive) return;
    const d = Math.round(after) - Math.round(before);
    const stats = [];
    if (counted) stats.push({ label: 'Bot League', value: Math.round(after) }, { label: 'Change', value: (d >= 0 ? '+' : '') + d });
    stats.push({ label: 'Moves', value: Math.ceil(g.moves.length / 2) });
    if (!cur.rated && cur.hints) stats.push({ label: 'Hints', value: cur.hints });
    const how = counted ? `by ${reason}` : cur.rated ? `by ${reason}. Too short to be rated.` : `by ${reason}. Casual game.`;
    presentResults({ mood: score === 1 ? 'cheer' : score === .5 ? 'happy' : 'sad', title: score === 1 ? 'You win!' : score === 0.5 ? 'Draw!' : `${bot.name} wins`,
      subtitle: promo ? (promo.up ? `Promoted to the ${promo.name}! ${how}` : `Moved down to the ${promo.name}. ${how}`) : how,
      stats, buttons: [{ label: 'Review', on: review }, { label: score === 0 ? 'Try again' : 'Rematch', primary: true, on: rematch }] });
  }
  buttons();
  // the versus card when a fresh game starts, then the bot says hello
  if (!cur.intro && !cur.moves.length && !cur.result) {
    cur.intro = true; cur.greet = Date.now() + 1400; saveProfile();
    const tag = cur.rated ? (cur.clock ? `Rated, ${tcText}` : 'Rated') : (cur.clock ? `Casual, ${tcText}` : 'Casual');
    versusIntro({ me: you, opp: them, tag, line: is960 ? `${v960}. You play ${cur.color === 'w' ? 'White' : 'Black'}.` : (cur.color === 'w' ? 'You play White' : 'You play Black') });
  }
  if (cur.greet && !cur.result) setTimeout(() => { if (alive && profile.current === cur && cur.greet && !cur.result) { cur.greet = 0; talk('start', true); } }, Math.max(150, cur.greet - Date.now()));
  if (!cur.result) { const st = g.status(); if (st.over) finish(st.result, st.reason); else if (g.turn() !== cur.color) botTurn(); else coachTurnStart(); }
}


// ======================= PASS & PLAY =======================
function localNames() { const n = profile.localNames || {}; return { w: (n.w || '').trim() || 'White', b: (n.b || '').trim() || 'Black' }; }
function newLocalGame() {
  const st = profile.localGame || {}; const sel = { tc: st.tc || '0+0' };
  sel.variant = st.variant || 'std';
  let auto = st.autoFlip !== false;
  const nm = localNames();
  const vseg = h('div', { class: 'seg' }); const drawV = () => { vseg.innerHTML = ''; [['std', 'Standard'], ['960', [icon('dice', 16), ' Chess960']]].forEach(([v, l]) => vseg.append(h('button', { class: sel.variant === v ? 'on' : '', onclick: () => { sel.variant = v; beep('toggle'); drawV(); } }, l))); }; drawV();
  const inW = h('input', { class: 'input', maxlength: 16, value: nm.w === 'White' ? '' : nm.w, placeholder: 'White', 'aria-label': 'White player name', autocomplete: 'off' });
  const inB = h('input', { class: 'input', maxlength: 16, value: nm.b === 'Black' ? '' : nm.b, placeholder: 'Black', 'aria-label': 'Black player name', autocomplete: 'off' });
  const autoBtn = h('button', { class: 'pp-auto', role: 'switch' });
  const drawAuto = () => { autoBtn.innerHTML = ''; autoBtn.classList.toggle('on', auto); autoBtn.setAttribute('aria-checked', auto ? 'true' : 'false'); autoBtn.append(icon('flip', 18), h('span', { class: 'grow' }, h('b', null, 'Turn the board'), h('small', null, auto ? 'After every move, for the player to move' : 'The board stays put')), h('span', { class: 'pp-sw' + (auto ? ' on' : '') }, h('i'))); };
  autoBtn.onclick = () => { auto = !auto; beep('toggle'); haptic(6); drawAuto(); }; drawAuto();
  beep('open');
  modal((box, close) => {
    box.classList.add('pp-setup');
    box.append(h('h2', null, 'Pass & Play'), h('p', { class: 'muted small' }, 'Two players, one device. Who is playing?'),
      h('div', { class: 'pp-names' }, h('label', { class: 'pp-name' }, h('span', { class: 'pp-k w' }, pieceImg('wk', 26)), inW), h('div', { class: 'pp-vs' }, 'VS'), h('label', { class: 'pp-name' }, h('span', { class: 'pp-k b' }, pieceImg('bk', 26)), inB)),
      h('div', { class: 'pp-lbl' }, 'Clock: each player gets this much time'), tcPicker(sel), h('div', { style: { height: '8px' } }), vseg, autoBtn,
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn grow', onclick: () => { beep('close'); close(); } }, 'Cancel'),
        h('button', { class: 'btn primary grow', onclick: () => {
          close();
          profile.localNames = { w: inW.value.trim().slice(0, 16), b: inB.value.trim().slice(0, 16) };
          const [b, i] = parseTc(sel.tc); const v = sel.variant === '960' ? E.chess960Fen() : null;
          profile.localGame = { moves: [], autoFlip: auto, tc: sel.tc, clock: newClock(b, i), result: null, variant: sel.variant, startFen: v ? v.fen : START_FEN, started: Date.now(), intro: false };
          saveProfile(); friendView = 'local'; beep('start'); if (route !== 'friend') go('friend'); else render();
        } }, icon('play', 18), 'Start')));
  });
}
function renderLocalGame(main) {
  const st = profile.localGame || (profile.localGame = { moves: [], autoFlip: true, tc: '0+0', clock: null });
  const g = new Game(st.startFen || START_FEN, st.moves);
  const nm = localNames();
  const is960 = !!(st.startFen && st.startFen !== START_FEN);
  const tcText = st.tc && st.tc !== '0+0' ? tcLabel(...parseTc(st.tc)) : 'Untimed';
  const over = () => !!(st.result || g.status().over);
  const scr = gameScreen(main, {
    title: 'Pass & Play', sub: is960 ? `Chess960, ${tcText}` : tcText, back: () => { friendView = 'menu'; render(); },
    game: g, orient: st.autoFlip ? g.turn() : 'w', players: { w: { name: nm.w, avatar: 'white' }, b: { name: nm.b, avatar: 'black' } }, mine: ['w', 'b'],
    names: nm, result: () => st.result ? st.result.result : (g.status().over ? g.status().result : '*'),
    canAnalyze: () => true,
    canMove: () => !over(),
    menu: () => [
      { ic: 'plus', label: 'New game', on: () => newLocalGame() },
      { ic: st.autoFlip ? 'repeat' : 'x', label: 'Auto-flip', sub: st.autoFlip ? 'On' : 'Off', toggle: !!st.autoFlip, on: toggleAuto },
      over() ? null : { ic: 'half', label: 'Agree draw', on: () => confirmBox('Agree to a draw?', 'Both players agree to end the game as a draw.', 'Draw', () => endLocal({ result: '1/2-1/2', reason: 'agreement' })) },
      over() ? null : { ic: 'flag', label: 'Resign', sub: `${g.turn() === 'w' ? nm.w : nm.b} resigns`, danger: true, on: () => confirmBox('Resign?', `${g.turn() === 'w' ? nm.w : nm.b} gives up and ${g.turn() === 'w' ? nm.b : nm.w} wins.`, 'Resign', () => endLocal({ result: g.turn() === 'w' ? '0-1' : '1-0', reason: 'resignation' })) },
    ],
    getClock: () => st.clock,
    onTick: () => { if (over()) return; const f = clk.flagged(st.clock); if (f) endLocal(timeoutResult(g.pos, f)); },
    onUserMove: (uci, dragged) => {
      const mover = g.turn();
      const res = g.play(uci); if (!res) return; playSound(res);
      clk.press(st.clock, mover, g.moves.length);
      st.moves = g.moves.slice(); saveProfile(); scr.refresh(dragged ? null : g.lastFromTo);
      const s = g.status();
      if (s.over) endLocal({ result: s.result, reason: s.reason });
      else if (st.autoFlip) setTimeout(() => { if (scr.board.orient !== g.turn() && !over()) scr.flip(true); }, 380);
      buttons();
    },
  });
  function toggleAuto() { st.autoFlip = !st.autoFlip; saveProfile(); buttons(); toast(st.autoFlip ? 'Board turns after each move' : 'Board stays put'); if (st.autoFlip && scr.board.orient !== g.turn() && !over()) scr.flip(true); }
  function endLocal(r) {
    if (st.result) return;
    clk.stop(st.clock);
    st.result = { result: r.result, reason: r.reason };
    if (!st.recorded && g.moves.length >= 2) {
      st.recorded = true;
      saveGameRecord({ kind: 'local', opp: `${nm.w} vs ${nm.b}`, white: nm.w, black: nm.b, color: null, score: null, result: r.result, reason: r.reason, rated: false, pgn: g.pgnMoves(), moves: g.moves.slice(), tc: st.tc, startFen: st.startFen || START_FEN, dur: st.started ? Date.now() - st.started : undefined });
    }
    saveProfile(); buttons(); scr.refresh();
    showLocalEnd(r);
  }
  function showLocalEnd(s) {
    rewardEvent('localGame', { moves: is960 ? null : g.moves.slice(), reason: s.reason }); if (is960) rewardEvent('game960');
    const winner = s.result === '1-0' ? 'w' : s.result === '0-1' ? 'b' : null;
    beep(winner ? 'win' : 'draw'); scr.board.burst(winner ? 'trophy' : 'half');
    if (winner && typeof fxBurst === 'function') fxBurst(scr.board.el, 'confetti');
    setTimeout(() => presentResults({ mood: winner ? 'cheer' : 'happy', title: winner ? `${nm[winner]} wins!` : 'Draw!', subtitle: winner ? `${winner === 'w' ? 'White' : 'Black'} wins by ${s.reason}` : `by ${s.reason}`,
      stats: [{ label: 'Moves', value: Math.ceil(g.moves.length / 2) }, { label: nm.w, value: s.result === '1-0' ? '1' : s.result === '0-1' ? '0' : '½' }, { label: nm.b, value: s.result === '0-1' ? '1' : s.result === '1-0' ? '0' : '½' }],
      buttons: [{ label: 'Review', on: () => openReview({ startFen: st.startFen || START_FEN, moves: g.moves.slice(), white: nm.w, black: nm.b }) }, { label: 'New game', primary: true, on: () => newLocalGame() }] }), winner ? 1000 : 800);
  }
  function buttons() {
    const done = over();
    scr.setButtons([
      { ic: 'flip', label: 'Flip', on: () => scr.flip(true) },
      { ic: st.autoFlip ? 'repeat' : 'x', label: st.autoFlip ? 'Auto-flip' : 'No flip', on: toggleAuto },
      { ic: 'undo', label: 'Undo', disabled: !g.moves.length || done, on: () => { g.undo(); st.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); if (st.autoFlip && scr.board.orient !== g.turn()) scr.flip(true); } },
      done ? { ic: 'plus', label: 'New game', primary: true, on: () => newLocalGame() } : null,
    ]);
  }
  buttons();
  if (!st.intro && !st.moves.length && !st.result) {
    st.intro = true; saveProfile();
    versusIntro({ me: { name: nm.w, avatar: 'white' }, opp: { name: nm.b, avatar: 'black' }, tag: is960 ? `Pass & Play, Chess960, ${tcText}` : `Pass & Play, ${tcText}`, line: `${nm.w} moves first` });
  }
  // an old game that ended by checkmate before the result was stored
  if (!st.result && g.status().over) { st.result = { result: g.status().result, reason: g.status().reason }; saveProfile(); }
}
