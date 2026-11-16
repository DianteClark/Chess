// "Play the World": the online lobby (Cloudflare server). Matchmaking, server-checked games,
// verified ratings, leaderboard and preset-only chat (safe for kids).
'use strict';
const LOBBY_URL = (() => { try { return localStorage.getItem('kc.lobbyUrl'); } catch (e) { return null; } })() || 'https://knightclub-lobby.chesscomplex.workers.dev'; // override only for local testing
const CHAT_TEXT = { hi: 'Hello!', gl: 'Good luck!', gg: 'Good game!', wp: 'Well played!', ty: 'Thank you!', oops: 'Oops!', thinking: 'Let me think...', 'rematch?': 'Rematch?' };
let lobby = null, lobbyView = 'home', lobbyChat = {}, lobbyLb = null, lobbyStats = null, lobbySel = { tc: '300+0', color: 'r', rated: true };
function getLobby() {
  if (lobby) return lobby;
  if (typeof LobbyClient === 'undefined' || typeof WebSocket === 'undefined') return null;
  lobby = new LobbyClient(LOBBY_URL);
  const rerender = () => { if (route === 'friend' && friendView === 'world') render(); };
  lobby.on('status', rerender);
  lobby.on('welcome', me => { profile.server = { r: me.r, rd: me.rd, games: me.games, provisional: me.provisional, id: me.id }; saveProfile(); rerender(); });
  lobby.on('me', me => { profile.server = { r: me.r, rd: me.rd, games: me.games, provisional: me.provisional, id: me.id }; saveProfile(); });
  lobby.on('seeks', rerender);
  lobby.on('mySeek', rerender);
  lobby.on('stats', st => { lobbyStats = st; });
  lobby.on('leaderboard', pl => { lobbyLb = pl; rerender(); });
  lobby.on('chat', c => { (lobbyChat[c.gameId] = lobbyChat[c.gameId] || []).push(c); if (lobbyGameHook) lobbyGameHook('chat', c); });
  lobby.on('error', e => { const msg = { inGame: 'Finish your current game first.', seekGone: 'That game was already taken.', badName: 'That name is not allowed, so a default name is used.', rateLimit: 'Slow down a little!', noCrypto: 'This browser cannot create a secure player key.', illegal: 'That move is not legal.', notYourTurn: 'Not your turn.' }[e.code]; if (msg) toast(msg); });
  lobby.on('game', gm => {
    const mine = lobby.myColor(gm);
    if (!mine) return;
    if (lobbyGameHook) lobbyGameHook('game', gm);
    else if (!gm.status.over) { lobbyView = 'game'; lobbyCurrent = gm.id; friendView = 'world'; if (route !== 'friend') go('friend'); else render(); }
  });
  return lobby;
}
let lobbyGameHook = null, lobbyCurrent = null;
function lobbyName() { return (profile.name || '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 20) || null; }
// lobby states shown in the status pill: tr('connecting') tr('online') tr('offline')
function renderWorld(main) {
  const lb = getLobby();
  if (lobbyView === 'game' && lb && lb.games[lobbyCurrent]) return renderLobbyGame(main, lb);
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { friendView = 'menu'; render(); } }, icon('back', 18), 'Back'), h('h2', { class: 'grow' }, 'Play the World'), lb && lb.state === 'online' ? h('span', { class: 'pill live' }, 'online') : h('span', { class: 'pill' }, lb ? lb.state : 'offline')));
  if (!lb) { main.append(h('div', { class: 'card' }, 'This browser cannot connect to the lobby.')); return; }
  if (lb.state === 'offline') lb.connect(lobbyName());
  if (lobbyView === 'leaderboard') return renderLeaderboard(main, lb);
  const me = lb.me;
  main.append(h('div', { class: 'card row' }, avatar(myAvatar(), 44), h('div', { class: 'grow' }, h('b', null, me ? me.name : 'Connecting…'), h('div', { class: 'small muted' }, me ? `Online rating ${Math.round(me.r)}${me.provisional ? '?' : ''} · ${me.games} games` : 'Setting up your secure player key')),
    h('button', { class: 'btn sm', onclick: () => { lobbyView = 'leaderboard'; lb.leaderboard(); render(); } }, icon('medal', 18), 'Top 50')));
  if (lb.state !== 'online') { main.append(h('div', { class: 'card center muted' }, icon('hourglass', 18), ' Connecting to the lobby…')); return; }
  if (!profile.name) main.append(h('p', { class: 'small muted' }, 'Tip: set your name in the Me tab so opponents know who you are.'));
  // my open seek
  if (lb.mySeek) {
    const s = lb.mySeek;
    main.append(h('div', { class: 'card stack center' }, icon('hourglass', 26), h('b', null, s.quick ? 'Finding an opponent…' : 'Waiting for someone to accept your game…'), h('div', { class: 'muted small' }, `${tcLabel(s.tc.base, s.tc.inc)} · ${s.rated ? 'Rated' : 'Casual'}`), h('button', { class: 'btn', onclick: () => lb.cancelSeek() }, 'Cancel')));
  } else {
    main.append(h('h3', { class: 'sect' }, 'Quick play'));
    main.append(h('div', { class: 'tcs' }, LobbyClient.TIME_CONTROLS.map(([b, i]) => h('button', { onclick: () => lb.quick({ base: b, inc: i }, true) }, h('b', null, tcLabel(b, i)), h('small', null, TIME_CONTROLS.find(t => t[0] === b && t[1] === i)[2])))));
    main.append(h('p', { class: 'small muted' }, 'Quick play pairs you with someone near your rating. All lobby games are checked by the server, so the ratings can be trusted.'));
    const sel = lobbySel;
    const colorSeg = h('div', { class: 'seg' }); const drawC = () => { colorSeg.innerHTML = ''; [['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]].forEach(([v, l]) => colorSeg.append(h('button', { class: sel.color === v ? 'on' : '', onclick: () => { sel.color = v; drawC(); } }, l))); }; drawC();
    const ratedSeg = h('div', { class: 'seg' }); const drawR = () => { ratedSeg.innerHTML = ''; [[true, 'Rated'], [false, 'Casual']].forEach(([v, l]) => ratedSeg.append(h('button', { class: sel.rated === v ? 'on' : '', onclick: () => { sel.rated = v; drawR(); } }, l))); }; drawR();
    const tcSel = { tc: sel.tc }; const tcs = tcPicker(tcSel, () => { sel.tc = tcSel.tc; });
    tcs.firstChild && tcs.firstChild.remove(); // no untimed games in the lobby
    main.append(h('details', { class: 'card' }, h('summary', null, h('b', null, 'Create a custom game')), h('div', { class: 'stack', style: { marginTop: '10px' } }, tcs, colorSeg, ratedSeg,
      h('button', { class: 'btn primary block', onclick: () => { const [b, i] = parseTc(sel.tc === '0+0' ? '300+0' : sel.tc); lb.seek({ base: b, inc: i }, sel.color, sel.rated); } }, icon('plus', 18), 'Post game'))));
  }
  main.append(h('h3', { class: 'sect' }, 'Open games'));
  if (!lb._subs.seeks) lb.subscribeSeeks();
  const list = (lb.seeks || []).filter(s => !me || s.pid !== me.id);
  if (!list.length) main.append(h('div', { class: 'card muted small center' }, 'No open games right now. Use Quick play or post your own!'));
  else main.append(h('div', { class: 'card' }, h('table', { class: 'tbl' }, list.map(s => h('tr', null, h('td', null, h('b', null, s.name), h('div', { class: 'small muted' }, `${Math.round(s.r)}${s.provisional ? '?' : ''}`)), h('td', null, tcLabel(s.tc.base, s.tc.inc), h('div', { class: 'small muted' }, s.rated ? 'Rated' : 'Casual')), h('td', null, h('button', { class: 'btn sm primary', onclick: () => lb.accept(s.id) }, 'Play')))))));
}
function renderLeaderboard(main, lb) {
  main.append(h('button', { class: 'btn sm', onclick: () => { lobbyView = 'home'; render(); } }, icon('back', 18), 'Lobby'));
  main.append(h('h3', { class: 'sect' }, 'Top 50 players'));
  if (!lobbyLb) { main.append(h('div', { class: 'card muted center' }, 'Loading…')); lb.fetchLeaderboard().then(p => { lobbyLb = p; render(); }).catch(() => { }); return; }
  if (!lobbyLb.length) { main.append(h('div', { class: 'card muted center small' }, 'No ranked players yet. Play 5 rated lobby games to appear here!')); return; }
  main.append(h('div', { class: 'card' }, h('table', { class: 'tbl' }, lobbyLb.map((p, i) => h('tr', { class: lb.me && p.id === lb.me.id ? 'me' : '' }, h('td', null, h('b', null, (i + 1) + '.')), h('td', null, p.name, h('div', { class: 'small muted' }, `${p.wins}W ${p.losses}L ${p.draws}D`)), h('td', null, Math.round(p.r)))))));
}
function renderLobbyGame(main, lb) {
  let gm = lb.games[lobbyCurrent];
  const myColor = lb.myColor(gm);
  const g = new Game(START_FEN, gm.moves);
  const opp = myColor === 'w' ? gm.black : gm.white, mine = myColor === 'w' ? gm.white : gm.black;
  // a clock view object compatible with clk.rem()
  const clockView = () => {
    const toMove = gm.moves.length % 2 === 0 ? 'w' : 'b';
    return { base: gm.tc.base * 1000, inc: gm.tc.inc * 1000, w: gm.clocks.w, b: gm.clocks.b, running: gm.clockRunning && !gm.status.over ? toMove : null, since: gm.turnStartedAt - lb.offset };
  };
  const players = { [myColor]: { name: 'You', avatar: myAvatar(), rating: Math.round(mine.r) }, [myColor === 'w' ? 'b' : 'w']: { name: opp.name, avatar: 'friend', rating: Math.round(opp.r) } };
  let pending = false;
  const scr = gameScreen(main, {
    title: `vs ${opp.name}`, sub: `${tcLabel(gm.tc.base, gm.tc.inc)}, ${gm.rated ? 'Rated' : 'Casual'}` + (gm.disconnected && gm.disconnected[myColor === 'w' ? 'b' : 'w'] ? ', opponent disconnected' : ''),
    back: () => { if (!gm.status.over) return confirmBox('Leave this game?', 'Your clock keeps running. Come back from the lobby to continue.', 'Leave', () => { lobbyView = 'home'; render(); }); lobbyView = 'home'; render(); },
    game: g, orient: myColor, players,
    canMove: turn => !gm.status.over && turn === myColor && !pending,
    getClock: () => clockView(),
    onUserMove: (uci, dragged) => {
      const ply = g.moves.length; const res = g.play(uci); if (!res) return; playSound(res);
      pending = true; lb.move(gm.id, uci, ply); scr.refresh(dragged ? null : g.lastFromTo); setTimeout(() => { pending = false; }, 3000);
    },
  });
  const chatEl = h('div', { class: 'chatlog' });
  const drawChat = () => { chatEl.innerHTML = ''; (lobbyChat[gm.id] || []).slice(-4).forEach(c => chatEl.append(h('div', { class: 'chatmsg ' + (c.from === myColor ? 'me' : '') }, h('b', null, c.from === myColor ? 'You' : c.name), ' ', CHAT_TEXT[c.code] || ''))); };
  scr.addBelow(h('div', { class: 'chatwrap' }, chatEl, h('div', { class: 'chatbar' }, LobbyClient.CHAT_CODES.map(code => h('button', { onclick: () => { beep('tap'); lb.chat(gm.id, code); } }, CHAT_TEXT[code])))));
  drawChat();
  let shownOver = gm.status.over;
  function buttons() {
    const over = gm.status.over, oc = myColor === 'w' ? 'b' : 'w';
    const list = [{ ic: 'flip', label: 'Flip', on: () => scr.flip() }];
    if (!over) {
      if (gm.moves.length < 2) list.push({ ic: 'x', label: 'Abort', on: () => lb.abort(gm.id) });
      list.push({ ic: 'half', label: gm.drawOfferBy === oc ? 'Accept' : 'Draw?', disabled: gm.drawOfferBy === myColor, on: () => gm.drawOfferBy === oc ? lb.acceptDraw(gm.id) : (lb.offerDraw(gm.id), toast('Draw offered')) });
      list.push({ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', 'Your opponent wins this game.', 'Resign', () => lb.resign(gm.id)) });
    } else {
      list.push({ ic: 'repeat', label: gm.rematchBy === oc ? 'Accept' : 'Rematch', disabled: gm.rematchBy === myColor || gm.rematchBy === 'both', on: () => lb.rematch(gm.id) });
      list.push({ ic: 'search', label: 'Review', on: () => openReview({ moves: gm.moves.slice(), color: myColor, white: gm.white.name, black: gm.black.name }) });
    }
    scr.setButtons(list);
  }
  function showOver() {
    const st = gm.status; if (!st.over || shownOver) return; shownOver = true;
    if (st.result === '*') { toast('Game aborted.'); return; }
    const win = (st.result === '1-0' && myColor === 'w') || (st.result === '0-1' && myColor === 'b');
    const score = st.result === '1/2-1/2' ? .5 : win ? 1 : 0;
    const rc = gm.ratingChange ? gm.ratingChange[myColor] : null;
    if (win) { beep('win'); scr.board.burst('trophy'); }
    setTimeout(() => modal((box, close) => box.append(badge(score === .5 ? 'half' : win ? 'trophy' : 'shield', score === .5 ? 'blue' : win ? 'gold' : 'red'), h('h2', { class: 'center' }, score === .5 ? 'Draw!' : win ? 'You win!' : `${opp.name} wins`), h('p', { class: 'center muted' }, 'by ' + st.reason),
      rc != null ? h('p', { class: 'center' }, icon('globe', 16), ' Online rating ', h('span', { class: 'delta ' + (rc >= 0 ? 'up' : 'down') }, (rc >= 0 ? '+' : '') + Math.round(rc))) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => { close(); openReview({ moves: gm.moves.slice(), color: myColor, white: gm.white.name, black: gm.black.name }); } }, icon('search', 18), 'Review'), h('button', { class: 'btn primary grow', onclick: () => { close(); lb.rematch(gm.id); } }, icon('repeat', 18), 'Rematch')))), 500);
    if (gm.moves.length >= 4) setTimeout(() => rewardEvent('onlineGame', { score, moves: gm.moves.slice(), color: myColor, reason: st.reason }), 1800);
    if (win) setTimeout(() => confetti(), 400);
  }
  lobbyGameHook = (kind, data) => {
    if (kind === 'chat') { if (data.gameId === gm.id) { drawChat(); if (data.from !== myColor) beep('move'); } return; }
    if (data.id !== gm.id) { if (!data.status.over && lb.myColor(data)) { lobbyCurrent = data.id; render(); } return; } // rematch started
    const prevLen = g.moves.length; gm = data; pending = false;
    if (gm.moves.join() !== g.moves.join()) { Object.assign(g, new Game(START_FEN, gm.moves)); if (gm.moves.length > prevLen) beep(g.pos.inCheck() ? 'check' : 'move'); scr.refresh(gm.moves.length > prevLen ? g.lastFromTo : null); }
    if (gm.drawOfferBy && gm.drawOfferBy !== myColor && !gm.status.over) toast(`${opp.name} offers a draw. Tap Accept to agree.`, 3000);
    buttons(); showOver();
  };
  cleanups.push(() => { lobbyGameHook = null; });
  buttons();
}
