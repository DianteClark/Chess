// The Courtyard: friend menu and peer-to-peer invites over WebRTC.
'use strict';
// ======================= FRIENDS =======================
let friendView = 'menu';
function renderFriend(main) {
  if (friendView === 'local') return renderLocalGame(main);
  if (friendView === 'online') return renderOnline(main);
  if (friendView === 'world') return renderWorld(main);
  main.append(
    stageBanner('courtyard', 'Courtyard', 'Play people near and far'),
    h('button', { class: 'card lesson hero', onclick: () => { friendView = 'world'; lobbyView = 'home'; render(); } }, h('div', { class: 'ic gold' }, icon('globe', 24)), h('div', null, h('div', { class: 't' }, 'Play the World'), h('div', { class: 'd' }, 'Quick match with players near your rating. Rated and checked by the server.')), h('span', { class: 'ck' }, icon('next', 20))),
    h('button', { class: 'card lesson', onclick: () => { friendView = 'local'; render(); } }, h('div', { class: 'ic dark' }, icon('phone', 24)), h('div', null, h('div', { class: 't' }, 'Pass & Play'), h('div', { class: 'd' }, 'Two players, one device. Take turns!')), h('span', { class: 'ck' }, '›')),
    h('button', { class: 'card lesson', onclick: () => { friendView = 'online'; render(); } }, h('div', { class: 'ic dark' }, icon('link', 24)), h('div', null, h('div', { class: 't' }, 'Invite a Friend'), h('div', { class: 'd' }, 'Send a link. Your devices connect directly (peer-to-peer).')), h('span', { class: 'ck' }, icon('next', 20))),
    h('p', { class: 'small muted' }, 'Play the World games count toward your Online rating, which is separate from your Bot League rating. Friend invites and Pass & Play are just for fun.'));
}
// ---------- online: true peer-to-peer over WebRTC ----------
// Signaling is copy/paste (or a link): the host's "invite" holds its WebRTC offer, the guest
// replies with an "answer" code. After that the two browsers talk directly over a data channel.
const myId = (() => { try { let v = sessionStorage.getItem('kc-id'); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('kc-id', v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
let online = null; // {role, pc, dc, phase, code, state, ...}
let onlineTab = 'host';
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
async function packCode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) {
    const cs = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer()));
  }
  return 'j' + b64u(raw);
}
async function unpackCode(code) {
  code = code.trim().replace(/^.*#join=/, '').replace(/\s+/g, '');
  let bytes = unb64u(code.slice(1));
  if (code[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
function waitIce(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
function leaveOnline() { if (online) { clearInterval(online.timer); try { online.dc && online.dc.close(); online.pc && online.pc.close(); } catch (e) { } } online = null; }
function inviteLink(code) { return location.href.split('#')[0] + '#join=' + code; }
function newPc() { return new RTCPeerConnection({ iceServers: ICE }); }
function wireChannel(dc) {
  online.dc = dc;
  dc.onopen = () => {
    online.phase = 'live'; online.connected = true;
    if (online.role === 'host') {
      const me = { id: myId, name: profile.name || 'Host', r: Math.round(profile.human.r), rd: Math.round(profile.human.rd) };
      if (!online.state) {
        const hostWhite = online.wantColor === 'w' ? true : online.wantColor === 'b' ? false : rand() < .5;
        const gu = { id: online.guestId || 'guest', name: online.guestName || 'Friend' };
        const [tb, ti] = parseTc(online.tc);
        online.state = { v: 1, white: hostWhite ? me : gu, black: hostWhite ? gu : me, moves: [], result: null, drawOffer: null, rematch: null, tc: online.tc || '0+0', clock: newClock(tb, ti) };
      }
      sendState();
    } else sendRaw({ t: 'hi', id: myId, name: profile.name || 'Friend', r: Math.round(profile.human.r), rd: Math.round(profile.human.rd) });
    clearInterval(online.timer);
    online.timer = setInterval(sendState, 5000);
    if (route === 'friend') render();
  };
  dc.onclose = () => { if (!online) return; online.connected = false; online.phase = 'lost'; if (online.onState) online.onState(-1); else if (route === 'friend') render(); };
  dc.onmessage = e => { let d; try { d = JSON.parse(e.data); } catch (_) { return; } onPeerMessage(d); };
}
function sendRaw(obj) { try { if (online && online.dc && online.dc.readyState === 'open') online.dc.send(JSON.stringify(obj)); } catch (e) { } }
function sendState() { if (online && online.state) sendRaw(Object.assign({ t: 'state' }, online.state, { clock: clk.wire(online.state.clock) })); }
function onPeerMessage(d) {
  if (!online) return;
  if (d.t === 'hi' && online.role === 'host') {
    // guest introduces itself: fix up its id/name in the seat it was given
    const st = online.state;
    for (const k of ['white', 'black']) if (st[k] && st[k].id !== myId) { st[k] = { id: d.id, name: d.name || 'Friend', r: d.r, rd: d.rd }; }
    st.v++; sendState(); if (online.onState) online.onState(-2); return;
  }
  if (d.t !== 'state' || typeof d.v !== 'number' || !Array.isArray(d.moves)) return;
  const test = new Game(); for (const u of d.moves) if (!test.play(u)) return; // untrusted: replay to validate
  const cur = online.state;
  if (!cur || d.v > cur.v || (d.v === cur.v && online.role === 'guest')) {
    const prevLen = cur ? cur.moves.length : 0;
    const wasStarted = !!cur;
    online.state = { v: d.v, white: d.white, black: d.black, moves: d.moves.slice(), result: d.result, drawOffer: d.drawOffer, rematch: d.rematch, tc: d.tc, clock: clk.unwire(d.clock) };
    if (wasStarted && online.onState) online.onState(prevLen);
    else if (route === 'friend') render();
  }
}
async function hostCreate(color, tc) {
  leaveOnline();
  online = { role: 'host', phase: 'making', wantColor: color, tc: tc || '0+0', state: profile.onlineResume || null };
  render();
  try {
    const pc = newPc(); online.pc = pc;
    wireChannel(pc.createDataChannel('chess', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    online.code = await packCode({ k: 'o', sdp: pc.localDescription.sdp, n: profile.name || '' });
    online.phase = 'invite';
  } catch (e) { online.phase = 'error'; online.err = String(e.message || e); }
  render();
}
async function hostAccept(answerCode) {
  try {
    const a = await unpackCode(answerCode);
    if (a.k !== 'a') throw new Error('That is not a reply code. Ask your friend for the code their screen shows after joining.');
    online.guestName = a.n; online.guestId = a.id;
    await online.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
    online.phase = 'connecting'; render();
    setTimeout(() => { if (online && online.phase === 'connecting') { online.phase = 'error'; online.err = 'Could not connect directly. Some networks (like school or work Wi-Fi) block peer-to-peer. Try again, or switch one device to mobile data.'; render(); } }, 20000);
  } catch (e) { toast(e.message || 'Invalid code'); }
}
async function guestJoin(inviteCode) {
  leaveOnline();
  online = { role: 'guest', phase: 'making' };
  render();
  try {
    const o = await unpackCode(inviteCode);
    if (o.k !== 'o') throw new Error('That is not an invite code.');
    online.hostName = o.n;
    const pc = newPc(); online.pc = pc;
    pc.ondatachannel = e => wireChannel(e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    online.code = await packCode({ k: 'a', sdp: pc.localDescription.sdp, n: profile.name || '', id: myId });
    online.phase = 'answer';
  } catch (e) { online.phase = 'error'; online.err = 'That invite did not work: ' + (e.message || e) + ' Ask your friend for a fresh invite.'; }
  render();
}
let pendingJoin = null;
function renderOnline(main) {
  if (online && online.state && (online.phase === 'live' || online.phase === 'lost')) return renderOnlineGame(main);
  main.append(h('div', { class: 'course-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => { leaveOnline(); friendView = 'menu'; navDir = 'back'; render(); } }, icon('back', 20)), h('div', { class: 'grow' }, h('h2', null, 'Invite a Friend'), h('small', null, 'Two phones, one game, no account needed'))));
  if (!window.RTCPeerConnection) { main.append(h('div', { class: 'card' }, 'This browser does not support peer-to-peer connections. Try Chrome, Safari or Firefox.')); return; }
  const card = h('div', { class: 'card stack' }); main.append(card);
  const ph = online && online.phase;
  if (!online) {
    let color = 'r';
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => { seg.innerHTML = ''; [['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]].forEach(([v, l]) => seg.append(h('button', { class: color === v ? 'on' : '', onclick: () => { color = v; beep('toggle'); drawSeg(); } }, l))); };
    drawSeg();
    const inp = h('textarea', { class: 'input', rows: 3, placeholder: 'Paste the invite link or code here' });
    if (pendingJoin) { inp.value = pendingJoin; onlineTab = 'join'; }
    const tcSel = { tc: '0+0' };
    const tabs = h('div', { class: 'seg' }); [['host', [icon('sparkle', 16), ' Host a game']], ['join', [icon('link', 16), ' Join a friend']]].forEach(([v, l]) => tabs.append(h('button', { class: onlineTab === v ? 'on' : '', onclick: () => { onlineTab = v; beep('toggle'); render(); } }, l)));
    card.remove(); main.append(tabs);
    const steps = h('div', { class: 'p2p-steps' }, [['1', 'Host makes an invite link'], ['2', 'Friend opens it and sends a reply code'], ['3', 'Host pastes the reply: play!']].map(([n, t]) => h('div', { class: 'p2p-step' }, h('b', null, n), h('span', null, t))));
    if (onlineTab === 'host') main.append(h('div', { class: 'card setup2' }, h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Play as'), seg), h('div', { class: 'srow col' }, h('span', { class: 'lbl' }, 'Clock'), tcPicker(tcSel)),
      h('button', { class: 'play-big', onclick: () => { beep('confirm'); hostCreate(color, tcSel.tc); } }, icon('sparkle', 20), h('span', null, 'Create invite'))), steps);
    else main.append(h('div', { class: 'card stack' }, h('b', null, 'Paste the invite from your friend'), inp,
      h('button', { class: 'play-big', onclick: () => { const v = inp.value.trim(); if (!v) return toast('Paste the invite first'); pendingJoin = null; beep('confirm'); guestJoin(v); } }, icon('link', 20), h('span', null, 'Join game'))), steps);
    return;
  }
  if (ph === 'making' || ph === 'connecting') { card.append(h('div', { class: 'center' }, icon('hourglass', 18), ' ', ph === 'making' ? 'Preparing connection…' : 'Connecting to your friend…')); }
  else if (ph === 'invite') {
    const link = inviteLink(online.code);
    const ans = h('textarea', { class: 'input', rows: 3, placeholder: "Paste your friend's reply code here" });
    card.append(h('h3', null, 'Step 1: Send this invite'),
      h('div', { class: 'small muted' }, 'Text or message this link to your friend:'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => shareOrCopy(link, 'Join my chess game!') }, icon('share', 18), 'Share invite'), h('button', { class: 'btn', onclick: () => copyText(link) }, icon('copy', 18), 'Copy')),
      h('h3', null, 'Step 2: Paste their reply'), ans,
      h('button', { class: 'btn block', onclick: () => { const v = ans.value.trim(); if (!v) return toast('Paste the reply code first'); hostAccept(v); } }, icon('link', 18), 'Connect'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'answer') {
    card.append(h('h3', null, 'Almost there!'),
      h('div', { class: 'small muted' }, `Send this reply code back to ${online.hostName || 'your friend'}. The game starts as soon as they paste it in.`),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => shareOrCopy(online.code, 'My chess reply code') }, icon('share', 18), 'Share reply'), h('button', { class: 'btn', onclick: () => copyText(online.code) }, icon('copy', 18), 'Copy')),
      h('div', { class: 'center muted small' }, icon('hourglass', 16), ' Waiting for the connection…'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'error' || ph === 'lost') {
    card.append(h('h3', null, (ph === 'lost' ? 'Connection lost' : 'Something went wrong')), h('p', { class: 'small muted' }, online.err || 'The connection closed.'),
      h('button', { class: 'btn primary block', onclick: () => { leaveOnline(); render(); } }, 'Start over'));
  }
}
// Online (human) rating: Glicko-2, capped at ±50 per game while provisional, ±30 after.
// Each game is rated once, and only if at least 4 moves were played.
function rateOnline(st, opp, score) {
  return null; // friend invite games are friendly; the Online rating comes from the lobby server
  if (!opp || st.moves.length < 4) return null;
  const key = [st.white.id, st.black.id, st.moves.join('')].join('|');
  profile.ratedKeys = profile.ratedKeys || [];
  if (profile.ratedKeys.includes(key)) return null;
  profile.ratedKeys.push(key); if (profile.ratedKeys.length > 100) profile.ratedKeys.shift();
  const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v)) ? Math.max(a, Math.min(b, v)) : d; // opponent data is untrusted
  const before = Math.round(profile.human.r);
  profile.human = cappedGlicko(profile.human, { r: clamp(opp.r, 100, 3000, 800), rd: clamp(opp.rd, 50, 350, 250) }, score, 50, 30);
  const after = Math.round(profile.human.r);
  profile.hHist.push(after); if (profile.hHist.length > 200) profile.hHist.shift();
  profile.games.unshift({ t: Date.now(), opp: (opp.name || 'Friend') + ' (online)', score, reason: st.result.reason, rated: true, before, after, online: true });
  profile.games = profile.games.slice(0, 50);
  saveProfile();
  return { before, after };
}
async function shareOrCopy(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text: title + ' ' + text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyText(text);
}
function renderOnlineGame(main) {
  const o = online, st = o.state;
  const myColor = st.white.id === myId ? 'w' : st.black.id === myId ? 'b' : (o.role === 'host' ? (st.white.id !== 'guest' && st.white.name === (profile.name || 'Host') ? 'w' : 'b') : null);
  const g = new Game(START_FEN, st.moves);
  const oppInfo = myColor === 'w' ? st.black : st.white, meInfo = myColor === 'w' ? st.white : st.black;
  const live = h('span', { class: 'pill' });
  const setLive = () => { live.className = 'pill' + (o.connected ? ' live' : ''); live.textContent = o.connected ? '● connected (peer-to-peer)' : '○ disconnected'; };
  setLive();
  const scr = gameScreen(main, {
    title: 'Friend game', sub: 'Peer-to-peer', right: [live], back: () => confirmBox('Leave this game?', 'This closes the connection to your friend.', 'Leave', () => { leaveOnline(); friendView = 'menu'; render(); }),
    game: g, orient: myColor || 'w', players: (() => { const opp = { name: (oppInfo && oppInfo.name) || 'Friend', avatar: 'friend', rating: oppInfo && oppInfo.r ? Math.round(oppInfo.r) : null }, mine = { name: 'You', avatar: myAvatar(), rating: fmtR(profile.human) }; return myColor === 'b' ? { w: opp, b: mine } : { w: mine, b: opp }; })(),
    canMove: turn => o.connected && !o.state.result && turn === myColor,
    getClock: () => o.state.clock,
    onTick: () => {
      const s = o.state; if (s.result || !s.clock) return;
      const f = clk.flagged(s.clock);
      if (f) { clk.stop(s.clock); s.result = timeoutResult(g.pos, f); s.v++; sendState(); buttons(); checkOver(); }
    },
    onUserMove: (uci, dragged) => {
      const res = g.play(uci); if (!res) return; playSound(res);
      clk.press(o.state.clock, myColor, g.moves.length);
      o.state.moves = g.moves.slice(); o.state.drawOffer = null; o.state.v++;
      const s = g.status(); if (s.over) { clk.stop(o.state.clock); o.state.result = { result: s.result, reason: s.reason }; }
      if (o.role === 'host') { profile.onlineResume = o.state.result ? null : o.state; saveProfile(); }
      sendState(); scr.refresh(dragged ? null : g.lastFromTo); buttons(); checkOver();
    },
  });
  let shownOver = !!st.result;
  function checkOver() {
    const r = o.state.result; if (!r || shownOver) return; shownOver = true;
    const win = (r.result === '1-0' && myColor === 'w') || (r.result === '0-1' && myColor === 'b');
    const score = r.result === '1/2-1/2' ? .5 : win ? 1 : 0;
    const rc = rateOnline(o.state, oppInfo, score);
    if (o.state.moves.length >= 4) rewardEvent('localGame', { moves: o.state.moves.slice(), reason: o.state.result.reason });
    if (win) { beep('win'); scr.board.burst('trophy'); } else beep(score === .5 ? 'draw' : 'lose');
    void rc;
    setTimeout(() => presentResults({ mood: win ? 'cheer' : score === .5 ? 'happy' : 'sad', title: r.result === '1/2-1/2' ? 'Draw!' : win ? 'You win!' : 'Your friend wins!', subtitle: `by ${r.reason}. Friendly game: no rating change.`,
      buttons: [{ label: 'Review', on: () => openReview({ moves: o.state.moves.slice(), color: myColor, white: o.state.white.name, black: o.state.black.name }) }, { label: 'OK', primary: true, on: () => { } }] }), 600);
  }
  o.onState = (prevLen) => {
    if (prevLen === -2) { render(); return; } // seats changed
    setLive();
    if (prevLen === -1) { toast('Connection lost. Your friend may have closed the page.', 3500); buttons(); return; }
    const s2 = o.state;
    if (s2.moves.length < g.moves.length || s2.moves.length === 0 && g.moves.length) { render(); return; } // rematch / reset
    Object.assign(g, new Game(START_FEN, s2.moves));
    if (s2.moves.length > prevLen) { beep(g.pos.inCheck() ? 'check' : 'move'); scr.refresh(g.lastFromTo); } else scr.refresh();
    if (o.role === 'host') { profile.onlineResume = s2.result ? null : s2; saveProfile(); }
    if (s2.drawOffer && s2.drawOffer !== myId && !s2.result) toast('Your friend offers a draw. Tap Accept to agree.', 3500);
    if (s2.rematch && s2.rematch !== myId && s2.result) toast('Your friend wants a rematch! Tap Accept.', 3500);
    buttons(); checkOver();
  };
  function buttons() {
    const s = o.state, over = !!s.result;
    const list = [
    { ic: 'flip', label: 'Flip', on: () => scr.flip() }];
    if (!o.connected) list.push({ ic: 'plug', label: 'Reconnect', on: () => { const keep = o.role === 'host' ? o.state : null; leaveOnline(); if (keep) { profile.onlineResume = keep; saveProfile(); } render(); toast(keep ? 'Create a new invite. The game will continue where you left off.' : 'Ask the host for a new invite link.', 4000); } });
    else if (!over) {
      list.push({ ic: 'half', label: s.drawOffer && s.drawOffer !== myId ? 'Accept' : 'Draw?', disabled: s.drawOffer === myId, on: () => { if (s.drawOffer && s.drawOffer !== myId) { clk.stop(s.clock); s.result = { result: '1/2-1/2', reason: 'agreement' }; } else { s.drawOffer = myId; toast('Draw offered'); } s.v++; sendState(); buttons(); checkOver(); } });
      list.push({ ic: 'flag', label: 'Resign', on: () => confirmBox('Resign?', 'Your friend wins this game.', 'Resign', () => { clk.stop(s.clock); s.result = { result: myColor === 'w' ? '0-1' : '1-0', reason: 'resignation' }; s.v++; sendState(); buttons(); checkOver(); }) });
    } else {
      list.push({ ic: 'repeat', label: s.rematch && s.rematch !== myId ? 'Accept' : 'Rematch', disabled: s.rematch === myId, on: () => {
        if (s.rematch && s.rematch !== myId) { const w = s.white; s.white = s.black; s.black = w; s.moves = []; s.result = null; s.drawOffer = null; s.rematch = null; const [tb, ti] = parseTc(s.tc); s.clock = newClock(tb, ti); s.v++; sendState(); render(); }
        else { s.rematch = myId; s.v++; sendState(); toast('Rematch requested'); buttons(); }
      } });
    }
    scr.setButtons(list);
  }
  buttons();
  cleanups.push(() => { if (online) online.onState = null; });
}

// ======================= PUZZLES =======================
