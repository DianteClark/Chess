// Playing games: the shared game screen, the Arena (bots) and Pass & Play.
'use strict';
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
  // one screen: header, opponent, board, you, a one-line move strip with step buttons, actions
  const F = focusScreen(main, { title: cfg.title || 'Game', sub: cfg.sub, back: cfg.back, right: cfg.right });
  const movesEl = h('div', { class: 'moves strip' });
  const navEl = h('div', { class: 'mstrip' },
    h('button', { class: 'mnav', 'aria-label': 'Previous move', onclick: () => { beep('tap'); setView(Math.max(0, (viewPly ?? g.moves.length) - 1)); } }, icon('prev', 20)),
    movesEl,
    h('button', { class: 'mnav', 'aria-label': 'Next move', onclick: () => { beep('tap'); setView((viewPly ?? g.moves.length) + 1); } }, icon('next', 20)));
  const ctrl = F.actions;
  F.stage.classList.add('table'); F.stage.append(topBar.el, board.el, botBar.el); F.below.append(navEl);
  // swipe on the board to step through moves while it is not your move
  { let sx = null; board.el.addEventListener('touchstart', e => { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    board.el.addEventListener('touchend', e => { if (sx == null || board.dragging) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) setView(dx < 0 ? (viewPly ?? g.moves.length) + 1 : Math.max(0, (viewPly ?? g.moves.length) - 1)); }, { passive: true }); }
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
    if (!g.sans.length) movesEl.append(h('span', { class: 'muted small' }, 'Your move list will appear here'));
    if (viewPly !== null) movesEl.append(h('button', { class: 'pill live backlive', onclick: () => setView(null) }, 'Back to game'));
    if (g.startFen === START_FEN && g.moves.length && typeof openingName === 'function') { const op = openingName(g.moves.slice(0, Math.min(g.moves.length, 16))); if (op) movesEl.prepend(h('span', { class: 'pill opn' }, op)); }
    const cur = movesEl.querySelector('.cur'); if (cur) movesEl.scrollLeft = cur.offsetLeft - movesEl.clientWidth / 2 + cur.offsetWidth / 2; else movesEl.scrollLeft = movesEl.scrollWidth;
  }
  function refresh(animate) {
    const st = viewPly === null ? g.viewState() : g.boardAt(viewPly);
    board.set(st, viewPly === null ? animate : null);
    refreshBars(st.board); refreshMoves();
  }
  function setButtons(list) { F.setActions(list); }
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
    board, refresh, setButtons, setView, tickClocks, F,
    addAbove(el) { F.above.prepend(el); }, addBelow(el) { F.below.append(el); }, setTitle: F.setTitle,
    setStatus(which, txt) { (which === 'top' ? topBar : botBar).status.textContent = txt || ''; },
    flip() {
      board.flip();
      const up = F.stage.firstChild, down = F.stage.lastChild;
      F.stage.prepend(down); F.stage.append(up);
      refresh();
    },
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
  if (profile.current && profile.current.mode === 'bot' && !profile.current.result) { const cb = BOTS[profile.current.bot]; main.append(h('button', { class: 'resume-card', onclick: () => { gameHidden = false; haptic(8); beep('confirm'); render(); } }, avatar(cb.avatar, 46), h('div', { class: 'grow' }, h('b', null, `Game vs ${cb.name}`), h('small', null, `${profile.current.moves.length} moves played. Tap to continue.`)), h('span', { class: 'go' }, icon('play', 20)))); }
  main.append(h('div', { class: 'arena-head' }, h('div', { class: 'ah-l' }, h('h2', null, 'The Arena'), h('small', null, 'Pick an opponent and make your move')),
    h('button', { class: 'league-chip', onclick: () => { meView = null; go('me'); } }, leagueIcon(r.r, 22), h('div', null, h('b', null, String(Math.round(r.r))), h('small', null, lg.name))),
    h('button', { class: 'icon-btn', 'aria-label': 'Analysis board', onclick: () => { openAnalysis({}); } }, icon('search', 20))));
  // spotlight: the chosen bot, big
  const spot = h('div', { class: 'spotlight' });
  const recordVs = i => { const n = BOTS[i].name; const gs = profile.games.filter(x => x.opp === n); return { w: gs.filter(x => x.score === 1).length, d: gs.filter(x => x.score === .5).length, l: gs.filter(x => x.score === 0).length }; };
  const strip = h('div', { class: 'bot-strip' });
  const playBtn = h('button', { class: 'play-big', onclick: () => { haptic(14); beep('start'); if (typeof screenWipe === 'function') screenWipe('center', () => startBotGame()); else startBotGame(); } });
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
  profile.current = { mode: 'bot', bot: botIdx, color: c, rated, tc, clock: newClock(tb, ti), coach: !rated && playSel.coach !== false, startFen: v960 ? v960.fen : START_FEN, sp: v960 ? v960.n : null, moves: [], salt: Math.floor(rand() * 1e9), seed: Math.floor(rand() * 1e9), book: Math.floor(rand() * OPENINGS.length), result: null, hints: 0 };
  gameHidden = false; saveProfile(); go('play'); render();
}
function renderBotGame(main) {
  const cur = profile.current, bot = BOTS[cur.bot];
  const SF0 = cur.startFen || START_FEN, is960 = SF0 !== START_FEN;
  const g = new Game(SF0, cur.moves);
  let thinking = false, alive = true;
  cleanups.push(() => { alive = false; });
  const you = { name: profile.name || 'You', rating: profile.ladder.r, avatar: myAvatar() };
  const them = { name: bot.name, rating: bot.rating, avatar: bot.avatar };
  const scr = gameScreen(main, {
    title: `vs ${bot.name}`, sub: (is960 ? `Chess960 #${cur.sp}, ` : '') + (cur.rated ? 'Rated' : cur.coach ? 'Casual with Live Coach' : 'Casual') + (cur.tc && cur.tc !== '0+0' ? ', ' + tcLabel(...parseTc(cur.tc)) : ''),
    back: () => { if (cur.result) { profile.current = null; saveProfile(); } else gameHidden = true; render(); },
    game: g, orient: cur.color, players: cur.color === 'w' ? { w: you, b: them } : { w: them, b: you },
    canMove: turn => !thinking && !cur.result && turn === cur.color,
    onUserMove: async (uci, dragged) => {
      const before = g.moves.slice();
      const res = g.play(uci); if (!res) return; playSound(res); clk.press(cur.clock, cur.color, g.moves.length); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(dragged ? null : g.lastFromTo);
      if (cur.coach && !g.status().over) { thinking = true; buttons(); const ok = await coachAfterUserMove(before, uci); thinking = false; if (ok === 'undo' || ok === false) { buttons(); return; } }
      afterMove();
    },
    getClock: cur.clock ? () => cur.clock : null,
    onTick: () => { if (cur.result) return; const f = clk.flagged(cur.clock); if (f) { const r = timeoutResult(g.pos, f); finish(r.result, r.reason); } },
  });
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
        h('button', { class: 'btn primary grow', onclick: () => { g.undo(); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(); coachHold = null; res('undo'); coachSay([icon('undo', 18), h('b', null, 'Move taken back')], 'Try to find a better move. The green arrow shows my suggestion.'); scr.board.set(Object.assign(g.viewState(), gr.best ? { arrows: [[sqFromName(gr.best.slice(0, 2)), sqFromName(gr.best.slice(2, 4)), '#7cc04a']] } : {})); coachTurnStart(); buttons(); } }, icon('undo', 18), 'Take it back'),
        h('button', { class: 'btn grow', onclick: () => { coachHold = null; res(true); scr.refresh(); } }, 'Keep my move', icon('next', 18))], 'sad');
    });
  }
  function buttons() {
    const over = !!cur.result;
    const list = [];
    if (!cur.rated) {
      list.push({ ic: 'undo', label: 'Undo', disabled: over || thinking || g.moves.length < 1, on: () => { g.undo(); if (g.turn() !== cur.color) g.undo(); cur.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); } });
      list.push({ ic: 'bulb', label: 'Hint', disabled: over || thinking || g.turn() !== cur.color, on: hint });
    }
    if (over) {
      list.push({ ic: 'search', label: 'Review', on: () => openReview({ startFen: SF0, moves: g.moves.slice(), color: cur.color, white: cur.color === 'w' ? (profile.name || 'You') : bot.name, black: cur.color === 'b' ? (profile.name || 'You') : bot.name }) });
      list.push({ ic: 'plus', label: 'New game', on: () => { profile.current = null; saveProfile(); render(); } });
      list.push({ ic: 'repeat', label: 'Rematch', primary: true, on: () => startBotGame(cur.bot, cur.color === 'w' ? 'b' : 'w', cur.rated, cur.tc) });
    } else {
      list.push({ ic: 'half', label: 'Draw?', disabled: thinking, on: offerDraw });
      list.push({ ic: 'flip', label: 'Flip', on: () => scr.flip() });
      list.push({ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', cur.rated && g.moves.length >= 2 ? 'This counts as a loss for your rating.' : 'End this game?', 'Resign', () => finish(cur.color === 'w' ? '0-1' : '1-0', 'resignation')) });
    }
    scr.setButtons(list);
  }
  async function hint() {
    scr.setStatus('bottom', 'thinking…');
    const r = await engineRequest({ kind: 'best', fen: SF0, moves: g.moves, nodes: 120000 });
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
    const r = await engineRequest({ kind: 'bot', fen: SF0, moves: g.moves, level, seed: cur.seed + g.moves.length, salt: cur.salt, ply: g.moves.length, book: is960 ? null : OPENINGS[cur.book] });
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
    profile.games.unshift({ t: Date.now(), opp: bot.name, oppR: bot.rating, color: cur.color, score, reason, rated: counted, before: Math.round(before), after: Math.round(after), pgn: g.pgnMoves(), moves: g.moves.slice(), tc: cur.tc, startFen: is960 ? SF0 : undefined });
    profile.games = profile.games.slice(0, 50);
    saveProfile();
    buttons(); scr.refresh();
    rewardEvent('botGame', { score, reason, botIndex: cur.bot, rated: counted, tc: cur.tc, moves: g.moves.slice(), color: cur.color, botRating: bot.rating, myRating: before });
    if (is960) rewardEvent('game960');
    if (score === 1) { beep('win'); scr.board.burst('trophy'); if (typeof fxBurst === 'function') fxBurst(scr.board.el, 'confetti'); } else beep(score === .5 ? 'draw' : 'lose');
    setTimeout(() => showResult(score, reason, counted, before, after, promo), score === 1 ? 1100 : 700);
  }
  function showResult(score, reason, counted, before, after, promo) {
    const d = Math.round(after) - Math.round(before);
    const review = () => openReview({ startFen: SF0, moves: g.moves.slice(), color: cur.color, white: cur.color === 'w' ? (profile.name || 'You') : bot.name, black: cur.color === 'b' ? (profile.name || 'You') : bot.name });
    const stats = [];
    if (counted) stats.push({ label: 'Bot League', value: Math.round(after) }, { label: 'Change', value: (d >= 0 ? '+' : '') + d });
    stats.push({ label: 'Moves', value: Math.ceil(g.moves.length / 2) });
    presentResults({ mood: score === 1 ? 'cheer' : score === .5 ? 'happy' : 'sad', title: score === 1 ? 'You win!' : score === 0.5 ? 'Draw!' : `${bot.name} wins`,
      subtitle: (promo ? (promo.up ? `Promoted to the ${promo.name}! ` : `Moved down to the ${promo.name}. `) : '') + `by ${reason}` + (counted ? '' : cur.rated ? '. Too short to be rated.' : '. Casual game.'),
      stats, buttons: [{ label: 'Review', on: review }, { label: score === 0 ? 'Try again' : 'Rematch', primary: true, on: () => startBotGame(cur.bot, cur.color === 'w' ? 'b' : 'w', cur.rated, cur.tc) }] });
  }
  buttons();
  if (!cur.result) { const st = g.status(); if (st.over) finish(st.result, st.reason); else if (g.turn() !== cur.color) botTurn(); else coachTurnStart(); }
}


// ======================= PASS & PLAY =======================
function newLocalGame() {
  const st = profile.localGame || {}; const sel = { tc: st.tc || '0+0' };
  sel.variant = st.variant || 'std';
  const vseg = h('div', { class: 'seg' }); const drawV = () => { vseg.innerHTML = ''; [['std', 'Standard'], ['960', [icon('dice', 16), ' Chess960']]].forEach(([v, l]) => vseg.append(h('button', { class: sel.variant === v ? 'on' : '', onclick: () => { sel.variant = v; drawV(); } }, l))); }; drawV();
  modal((box, close) => box.append(h('h2', null, 'New game'), h('p', { class: 'muted small' }, 'Pick a time control. Each player gets this much time.'), tcPicker(sel), h('div', { style: { height: '8px' } }), vseg,
    h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn grow', onclick: close }, 'Cancel'),
      h('button', { class: 'btn primary grow', onclick: () => { close(); const [b, i] = parseTc(sel.tc); const v = sel.variant === '960' ? E.chess960Fen() : null; profile.localGame = { moves: [], autoFlip: st.autoFlip !== false, tc: sel.tc, clock: newClock(b, i), result: null, variant: sel.variant, startFen: v ? v.fen : START_FEN }; saveProfile(); render(); } }, 'Start'))));
}
function renderLocalGame(main) {
  const st = profile.localGame || (profile.localGame = { moves: [], autoFlip: true, tc: '0+0', clock: null });
  const g = new Game(st.startFen || START_FEN, st.moves);
  const scr = gameScreen(main, {
    title: 'Pass & Play', sub: (st.startFen && st.startFen !== START_FEN ? 'Chess960, ' : '') + (st.tc && st.tc !== '0+0' ? tcLabel(...parseTc(st.tc)) : 'Untimed'), back: () => { friendView = 'menu'; render(); },
    right: [h('button', { class: 'fs-back', 'aria-label': 'New game', onclick: () => newLocalGame() }, icon('plus', 22))],
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
    rewardEvent('localGame', { moves: (st.startFen && st.startFen !== START_FEN) ? null : g.moves.slice(), reason: s.reason }); if (st.startFen && st.startFen !== START_FEN) rewardEvent('game960');
    beep('win'); scr.board.burst('trophy');
    setTimeout(() => presentResults({ mood: 'cheer', title: s.result === '1-0' ? 'White wins!' : s.result === '0-1' ? 'Black wins!' : 'Draw!', subtitle: `by ${s.reason}`, stats: [{ label: 'Moves', value: Math.ceil(g.moves.length / 2) }],
      buttons: [{ label: 'Review', on: () => openReview({ startFen: st.startFen || START_FEN, moves: g.moves.slice(), white: 'White', black: 'Black' }) }, { label: 'New game', primary: true, on: () => newLocalGame() }] }), 700);
  }

  function buttons() {
    scr.setButtons([
      { ic: 'flip', label: 'Flip', on: () => scr.flip() },
      { ic: st.autoFlip ? 'repeat' : 'x', label: st.autoFlip ? 'Auto-flip' : 'No flip', on: () => { st.autoFlip = !st.autoFlip; saveProfile(); buttons(); toast(st.autoFlip ? 'Board turns after each move' : 'Board stays put'); } },
      { ic: 'undo', label: 'Undo', disabled: !g.moves.length, on: () => { g.undo(); st.moves = g.moves.slice(); saveProfile(); scr.refresh(); buttons(); } },
      (g.status().over || st.result) ? { ic: 'plus', label: 'New game', primary: true, on: () => newLocalGame() } : null,
    ]);
  }
  buttons();
}

