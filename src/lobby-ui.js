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
  lobby.on('stats', st => { lobbyStats = st; const el = document.getElementById('lw-sub'); if (el && lobbyView === 'home') el.textContent = lobbyOnlineText(); });
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
let lobbyStatsAt = 0, lobbyQuickAt = 0;
const LOBBY_TC_KIND = { 60: 'Bullet', 180: 'Blitz', 300: 'Blitz', 600: 'Rapid', 900: 'Rapid', 1800: 'Classical' };
function lobbyStatusPill(lb) {
  const st = lb ? lb.state : 'offline';
  return h('span', { class: 'lw-status ' + st, role: 'status' }, h('i'), st);
}
function lobbyHead(title, sub, back, lb) {
  return h('div', { class: 'lw-head' },
    h('button', { class: 'fs-back', 'aria-label': 'Back', onclick: () => { haptic(6); beep('back'); navDir = 'back'; back(); } }, icon('back', 22)),
    h('div', { class: 'lw-title' }, h('b', null, title), sub ? h('small', { id: 'lw-sub' }, sub) : null),
    lobbyStatusPill(lb));
}
function lobbyOnlineText() { return lobbyStats ? `${lobbyStats.online} online · ${lobbyStats.games} games live` : 'Players from around the world'; }
// initials badge for other players (their avatars are not shared, names only)
function lobbyInitial(name, size) {
  const n = (name || '?').trim(); let hsh = 0; for (const c of n) hsh = (hsh * 31 + c.charCodeAt(0)) % 360;
  return h('span', { class: 'lw-init', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * .45) + 'px', background: `hsl(${hsh},45%,42%)` } }, n[0].toUpperCase());
}
function lobbyFmtTime(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function renderWorld(main) {
  const lb = getLobby();
  if (lobbyView === 'game' && lb && lb.games[lobbyCurrent]) return renderLobbyGame(main, lb);
  if (lobbyView === 'leaderboard') return renderLeaderboard(main, lb);
  const root = h('div', { class: 'lw' }); main.append(root);
  root.append(lobbyHead('Play the World', lobbyOnlineText(), () => { friendView = 'menu'; render(); }, lb));
  if (!lb) { root.append(h('div', { class: 'card center' }, 'This browser cannot connect to the lobby.')); return; }
  if (lb.state === 'offline') lb.connect(lobbyName());
  const online = lb.state === 'online', me = lb.me, sel = lobbySel;
  if (online && Date.now() - lobbyStatsAt > 15000) { lobbyStatsAt = Date.now(); lb.stats(); }
  // your online rating card
  const r = me ? Math.round(me.r) : profile.server ? Math.round(profile.server.r) : null;
  const prov = me ? me.provisional : profile.server ? profile.server.provisional : true;
  const games = me ? me.games : profile.server ? profile.server.games : 0;
  root.append(h('div', { class: 'lw-me' },
    h('div', { class: 'av' }, avatar(myAvatar(), 50)),
    h('div', { class: 'who' }, h('b', null, me ? me.name : (lobbyName() || 'You')), h('small', null, me ? (prov ? `Placement: ${games} of 5 games` : `${games} games played`) : 'Setting up your secure player key')),
    h('div', { class: 'rt' }, h('small', null, icon('globe', 13), ' Online'), h('b', null, r != null ? `${r}${prov ? '?' : ''}` : '–')),
    h('button', { class: 'lw-lbbtn', 'aria-label': 'Top 50', onclick: () => { beep('open'); lobbyView = 'leaderboard'; if (online) lb.leaderboard(); render(); } }, icon('medal', 22), h('small', null, 'Top 50'))));
  if (!profile.name) root.append(h('p', { class: 'small muted lw-tip' }, 'Tip: set your name in the Me tab so opponents know who you are.'));
  // matchmaking: big Quick Play button, or the radar while searching
  const s = lb.mySeek;
  const hero = h('div', { class: 'lw-hero' + (s ? ' searching' : '') });
  root.append(hero);
  if (s) {
    const startAt = s.created ? s.created - lb.offset : (lobbyQuickAt || Date.now());
    const el = h('b', { class: 'lw-time' }, lobbyFmtTime(Date.now() - startAt));
    const radar = h('div', { class: 'lw-radar' }, h('i'), h('i'), h('i'), h('div', { class: 'sweep' }), h('div', { class: 'core' }, avatar(myAvatar(), 64)));
    radar.style.setProperty('--t0', `-${((Date.now() - startAt) % 2400) / 1000}s`);
    hero.append(radar, h('div', { class: 'lw-find' }, h('b', null, s.quick ? 'Finding an opponent…' : 'Waiting for someone to accept your game…'), h('div', { class: 'lw-meta' }, h('span', { class: 'pill' }, icon('clock', 14), tcLabel(s.tc.base, s.tc.inc)), h('span', { class: 'pill' }, s.rated ? 'Rated' : 'Casual'), el)),
      h('button', { class: 'btn lw-cancel', onclick: () => { beep('back'); lb.cancelSeek(); } }, icon('x', 18), 'Cancel'));
    const iv = setInterval(() => { if (!el.isConnected) return clearInterval(iv); el.textContent = lobbyFmtTime(Date.now() - startAt); }, 1000);
    cleanups.push(() => clearInterval(iv));
  } else {
    const [qb, qi] = parseTc(sel.qtc || '180+2');
    const chips = h('div', { class: 'lw-tcs', role: 'radiogroup', 'aria-label': 'Time control' });
    const qbtn = h('button', { class: 'lw-quick', disabled: !online, onclick: () => { haptic(12); beep('confirm'); lobbyQuickAt = Date.now(); const [b, i] = parseTc(sel.qtc || '180+2'); lb.quick({ base: b, inc: i }, sel.rated); } },
      h('span', { class: 'ring' }), h('span', { class: 'lab' }, icon('play', 30), h('b', null, 'Quick Play'), h('small', { class: 'lw-qtc' }, online ? `${tcLabel(qb, qi)} · ${sel.rated ? 'Rated' : 'Casual'}` : 'Connecting…')));
    const label = () => { const [b, i] = parseTc(sel.qtc || '180+2'); qbtn.querySelector('.lw-qtc').textContent = online ? `${tcLabel(b, i)} · ${sel.rated ? 'Rated' : 'Casual'}` : 'Connecting…'; };
    const drawChips = () => { chips.innerHTML = ''; LobbyClient.TIME_CONTROLS.forEach(([b, i]) => { const k = `${b}+${i}`; chips.append(h('button', { class: (sel.qtc || '180+2') === k ? 'on' : '', role: 'radio', 'aria-checked': String((sel.qtc || '180+2') === k), onclick: () => { beep('tap'); sel.qtc = k; drawChips(); label(); } }, h('b', null, tcLabel(b, i)), h('small', null, LOBBY_TC_KIND[b] || ''))); }); };
    drawChips();
    const ratedSeg = h('div', { class: 'seg lw-rated' }); const drawR = () => { ratedSeg.innerHTML = ''; [[true, 'Rated'], [false, 'Casual']].forEach(([v, l]) => ratedSeg.append(h('button', { class: sel.rated === v ? 'on' : '', onclick: () => { beep('toggle'); sel.rated = v; drawR(); label(); } }, l))); }; drawR();
    hero.append(qbtn, chips, h('div', { class: 'lw-row' }, ratedSeg, h('button', { class: 'btn sm lw-custom', disabled: !online, onclick: () => lobbyCustomSheet(lb) }, icon('plus', 18), 'Custom game')));
    setTimeout(() => { const on = chips.querySelector('.on'); if (on) chips.scrollLeft = on.offsetLeft - chips.clientWidth / 2 + on.offsetWidth / 2; }, 0);
  }
  // open games, as compact rows
  root.append(h('div', { class: 'lw-sect' }, h('h3', { class: 'sect' }, 'Open games'), h('small', { class: 'muted' }, 'Server-checked, so ratings can be trusted')));
  if (!online) { root.append(h('div', { class: 'lw-empty' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), 'Connecting to the lobby…')); return; }
  if (!lb._subs.seeks) lb.subscribeSeeks();
  const list = (lb.seeks || []).filter(x => !me || x.pid !== me.id);
  if (!list.length) { root.append(h('div', { class: 'lw-empty' }, icon('hourglass', 20), 'No open games right now. Use Quick Play or post your own!')); return; }
  root.append(h('div', { class: 'lw-list' }, list.map(x => h('div', { class: 'lw-seek' },
    lobbyInitial(x.name, 38),
    h('div', { class: 'who' }, h('b', null, x.name), h('small', null, `${Math.round(x.r)}${x.provisional ? '?' : ''}`)),
    h('span', { class: 'lw-tc' }, h('b', null, tcLabel(x.tc.base, x.tc.inc)), h('small', null, x.rated ? 'Rated' : 'Casual')),
    x.color && x.color !== 'r' ? h('span', { class: 'lw-col', title: x.color === 'w' ? 'They play White' : 'They play Black' }, pieceImg(x.color + 'k', 20)) : null,
    h('button', { class: 'btn sm primary', onclick: () => { haptic(10); beep('confirm'); lb.accept(x.id); } }, 'Play')))));
}
// custom game: a bottom sheet with time control, color and rated
function lobbyCustomSheet(lb) {
  const sel = lobbySel;
  modal((box, close) => {
    const colorSeg = h('div', { class: 'seg' }); const drawC = () => { colorSeg.innerHTML = ''; [['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]].forEach(([v, l]) => colorSeg.append(h('button', { class: sel.color === v ? 'on' : '', onclick: () => { sel.color = v; drawC(); } }, l))); }; drawC();
    const ratedSeg = h('div', { class: 'seg' }); const drawR = () => { ratedSeg.innerHTML = ''; [[true, 'Rated'], [false, 'Casual']].forEach(([v, l]) => ratedSeg.append(h('button', { class: sel.rated === v ? 'on' : '', onclick: () => { sel.rated = v; drawR(); } }, l))); }; drawR();
    const tcSel = { tc: sel.tc }; const tcs = tcPicker(tcSel, () => { sel.tc = tcSel.tc; });
    tcs.firstChild && tcs.firstChild.remove(); // no untimed games in the lobby
    box.append(h('h2', null, 'Custom game'), h('p', { class: 'muted small' }, 'Post a game to the lobby. Anyone can accept it.'), h('div', { class: 'stack', style: { gap: '10px' } }, tcs, colorSeg, ratedSeg,
      h('button', { class: 'btn primary block', onclick: () => { close(); const [b, i] = parseTc(sel.tc === '0+0' ? '300+0' : sel.tc); lobbyQuickAt = Date.now(); lb.seek({ base: b, inc: i }, sel.color, sel.rated); } }, icon('plus', 18), 'Post game')));
  });
}
function renderLeaderboard(main, lb) {
  const root = h('div', { class: 'lw' }); main.append(root);
  root.append(lobbyHead('Top 50 players', 'Rated lobby games only', () => { lobbyView = 'home'; render(); }, lb));
  if (!lb) return;
  if (!lobbyLb) { root.append(h('div', { class: 'lw-empty' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), 'Loading…')); lb.fetchLeaderboard().then(p => { lobbyLb = p; if (lobbyView === 'leaderboard') render(); }).catch(() => { }); return; }
  if (!lobbyLb.length) { root.append(h('div', { class: 'lw-empty' }, icon('medal', 20), 'No ranked players yet. Play 5 rated lobby games to appear here!')); return; }
  const meId = lb.me && lb.me.id;
  const top = lobbyLb.slice(0, 3);
  const spot = (p, place) => p ? h('div', { class: `lw-pod p${place}` + (p.id === meId ? ' me' : '') },
    place === 1 ? h('span', { class: 'crown' }, icon('crown', 22)) : null,
    lobbyInitial(p.name, place === 1 ? 58 : 46),
    h('b', { class: 'nm' }, p.name), h('span', { class: 'r' }, Math.round(p.r)),
    h('div', { class: 'step' }, h('span', null, place))) : h('div', { class: `lw-pod p${place} none` });
  root.append(h('div', { class: 'lw-podium' }, spot(top[1], 2), spot(top[0], 1), spot(top[2], 3)));
  const rest = lobbyLb.slice(3);
  if (rest.length) root.append(h('div', { class: 'lw-list lw-lb' }, rest.map((p, i) => h('div', { class: 'lw-lrow' + (p.id === meId ? ' me' : '') },
    h('span', { class: 'rk' }, i + 4), lobbyInitial(p.name, 32),
    h('div', { class: 'who' }, h('b', null, p.name), h('small', null, `${p.wins}W ${p.losses}L ${p.draws}D`)),
    h('b', { class: 'r' }, Math.round(p.r))))));
  const mine = meId ? lobbyLb.findIndex(p => p.id === meId) : -1;
  if (lb.me && mine < 0) root.append(h('div', { class: 'lw-you' }, avatar(myAvatar(), 36), h('div', { class: 'who' }, h('b', null, 'You'), h('small', null, lb.me.provisional ? 'Play 5 rated games to get ranked' : 'Not in the top 50 yet. Keep playing!')), h('b', { class: 'r' }, Math.round(lb.me.r))));
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
    profile.games.unshift({ t: Date.now(), mode: 'online', opp: opp.name, oppR: Math.round(opp.r), oppAvatar: 'friend', color: myColor, score, reason: st.reason, rated: !!gm.rated, ratingDelta: rc != null ? Math.round(rc) : undefined, moves: gm.moves.slice(), tc: `${gm.tc.base}+${gm.tc.inc}` }); profile.games = profile.games.slice(0, 200); saveProfile();
    if (gm.moves.length >= 4) rewardEvent('onlineGame', { score, moves: gm.moves.slice(), color: myColor, reason: st.reason });
    if (win) { beep('win'); scr.board.burst('trophy'); } else beep(score === .5 ? 'draw' : 'lose');
    setTimeout(() => presentResults({ mood: win ? 'cheer' : score === .5 ? 'happy' : 'sad', title: score === .5 ? 'Draw!' : win ? 'You win!' : `${opp.name} wins`, subtitle: `by ${st.reason}`,
      stats: rc != null ? [{ label: 'Online rating', value: (rc >= 0 ? '+' : '') + Math.round(rc) }] : [],
      buttons: [{ label: 'Review', on: () => openReview({ moves: gm.moves.slice(), color: myColor, white: gm.white.name, black: gm.black.name }) }, { label: 'Rematch', primary: true, on: () => lb.rematch(gm.id) }] }), 700);
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
