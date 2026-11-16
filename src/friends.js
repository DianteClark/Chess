// The Courtyard: friend menu and peer-to-peer invites over WebRTC.
'use strict';
// ======================= FRIENDS =======================
let friendView = 'menu';
function renderFriend(main) {
  if (friendView === 'local') return renderLocalGame(main);
  if (friendView === 'online') return renderOnline(main);
  if (friendView === 'world') return renderWorld(main);
  main.append(stageBanner('courtyard', 'Courtyard', 'Play people near and far'));
  // a Pass & Play game that is not finished yet
  const lg = profile.localGame;
  if (lg && lg.moves && lg.moves.length && !lg.result) {
    const nm = localNames(), turnW = lg.moves.length % 2 === 0;
    main.append(h('button', { class: 'resume-card', onclick: () => { haptic(8); beep('confirm'); friendView = 'local'; render(); } }, h('span', { class: 'rc-av' }, avatar(turnW ? 'white' : 'black', 46), h('i', { class: 'rc-live' })),
      h('div', { class: 'grow' }, h('b', null, 'Pass & Play'), h('small', null, `${nm.w} vs ${nm.b}. ${turnW ? nm.w : nm.b} to move.`)), h('span', { class: 'go' }, icon('play', 20))));
  }
  const srv = profile.server;
  main.append(h('button', { class: 'cy-card cy-world', onclick: () => { haptic(8); beep('card'); friendView = 'world'; lobbyView = 'home'; render(); } },
    courtArt('world'),
    h('div', { class: 'cy-txt' }, h('span', { class: 'cy-kick' }, icon('globe', 14), 'Online'), h('b', null, 'Play the World'), h('small', null, 'Quick match with players near your rating. Rated and checked by the server.'),
      h('span', { class: 'cy-chip' }, icon('star', 13), srv ? `Online ${Math.round(srv.r)}${srv.provisional ? '?' : ''}` : 'Online 800?')),
    h('span', { class: 'cy-go' }, icon('next', 20))));
  main.append(h('div', { class: 'cy-pair' },
    h('button', { class: 'cy-card cy-small', onclick: () => { haptic(8); beep('card'); if (lg && lg.moves && lg.moves.length && !lg.result) { friendView = 'local'; render(); } else newLocalGame(); } },
      courtArt('local'), h('div', { class: 'cy-txt' }, h('b', null, 'Pass & Play'), h('small', null, 'Two players, one device'))),
    h('button', { class: 'cy-card cy-small', onclick: () => { haptic(8); beep('card'); friendView = 'online'; render(); } },
      courtArt('invite'), h('div', { class: 'cy-txt' }, h('b', null, 'Invite a Friend'), h('small', null, 'Send a link, play phone to phone')))));
  main.append(h('div', { class: 'cy-note' }, icon('shield', 16), h('span', null, 'Play the World games count toward your Online rating. Friend invites and Pass & Play are just for fun.')));
}
// Courtyard illustrations (original SVG): a globe of players, a phone with a board, two linked phones
function courtArt(kind) {
  const pc = (t, c, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c === 'w' ? '#fffdf6' : '#2b2730'}" stroke="${c === 'w' ? '#272320' : '#f4ecdc'}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${PIECE_SVG[t].replace('class="eye"', `fill="${c === 'w' ? '#272320' : '#f4ecdc'}" stroke="none"`)}</g>`;
  const board4 = (x, y, q) => { let r = ''; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r += `<rect x="${x + j * q}" y="${y + i * q}" width="${q}" height="${q}" fill="${(i + j) % 2 ? '#b58863' : '#f0d9b5'}"/>`; return r; };
  const phone = (x, y, w, hh, rot, inner) => `<g transform="rotate(${rot} ${x + w / 2} ${y + hh / 2})"><rect x="${x}" y="${y + 3}" width="${w}" height="${hh}" rx="9" fill="rgba(0,0,0,.3)"/><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="9" fill="#2a2219"/><rect x="${x + 4}" y="${y + 8}" width="${w - 8}" height="${hh - 16}" rx="3" fill="#1b4434"/>${inner}<rect x="${x + w / 2 - 6}" y="${y + 3}" width="12" height="2.4" rx="1.2" fill="#4a3c2e"/></g>`;
  let svg = '';
  if (kind === 'world') svg = `<svg viewBox="0 0 140 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="cyg" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#7fd0c0"/><stop offset=".6" stop-color="#2f8f84"/><stop offset="1" stop-color="#1c5d57"/></radialGradient></defs>
    <circle cx="70" cy="62" r="54" fill="rgba(239,187,79,.16)"/><circle cx="70" cy="62" r="44" fill="url(#cyg)" stroke="#efbb4f" stroke-width="3"/>
    <g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6"><ellipse cx="70" cy="62" rx="18" ry="44"/><ellipse cx="70" cy="62" rx="36" ry="44"/><path d="M26 62h88M31 40h78M31 84h78"/></g>
    <path d="M48 38c8-4 14 2 20-2s10 4 6 9-12 2-15 8-9 4-11-2-6-9 0-13zM82 66c6-3 12 0 14 5s-3 10-9 9-10-11-5-14z" fill="#93dc98" opacity=".85"/>
    <g fill="#efbb4f"><circle cx="34" cy="30" r="3.4"/><circle cx="110" cy="44" r="3"/><circle cx="104" cy="96" r="3.4"/><circle cx="30" cy="88" r="2.6"/></g>
    ${pc('n', 'w', 0, 54, 1.25)}${pc('q', 'b', 86, 62, 1.12)}</svg>`;
  else if (kind === 'local') svg = `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="70" cy="100" rx="52" ry="7" fill="rgba(0,0,0,.25)"/>
    ${phone(44, 8, 52, 88, -8, board4(50, 32, 10) + pc('k', 'b', 59.5, 30, .48) + pc('k', 'w', 69.5, 50, .48))}
    <g fill="none" stroke="#efbb4f" stroke-width="3" stroke-linecap="round"><path d="M22 42a26 26 0 0 1 14-18"/><path d="M118 70a26 26 0 0 1-14 18"/></g><path d="M30 20l8 3-5 7z M110 92l-8-3 5-7z" fill="#efbb4f"/></svg>`;
  else svg = `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="70" cy="100" rx="58" ry="7" fill="rgba(0,0,0,.25)"/>
    ${phone(8, 20, 40, 70, -10, pc('k', 'w', 13, 38, .68))}${phone(92, 20, 40, 70, 10, pc('k', 'b', 97, 38, .68))}
    <path d="M44 34C60 6 80 6 96 34" fill="none" stroke="#efbb4f" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
    <circle cx="70" cy="18" r="13" fill="#efbb4f"/><g fill="none" stroke="#2a2219" stroke-width="2.6" stroke-linecap="round"><path d="M66 20.5l-2 2a3.4 3.4 0 0 1-4.8-4.8l3-3a3.4 3.4 0 0 1 4.8 0"/><path d="M74 15.5l2-2a3.4 3.4 0 0 1 4.8 4.8l-3 3a3.4 3.4 0 0 1-4.8 0"/><path d="M66.5 21.5l7-7"/></g></svg>`;
  const d = document.createElement('div'); d.className = 'cy-art'; d.innerHTML = svg; return d;
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
// step tracker for the invite flow: 1 make or open the invite, 2 swap codes, 3 play
function p2pStepper(active, role) {
  const steps = role === 'guest' ? [['link', 'Open invite'], ['share', 'Send reply'], ['play', 'Play!']] : [['sparkle', 'Make a link'], ['share', 'Swap codes'], ['play', 'Play!']];
  return h('div', { class: 'p2p-stepper' }, steps.map(([ic, t], i) => h('div', { class: 'ps' + (i + 1 < active ? ' done' : i + 1 === active ? ' on' : '') }, h('span', { class: 'ps-dot' }, i + 1 < active ? icon('check', 16) : icon(ic, 16)), h('small', null, t))));
}
function p2pCodeChip(code) { return h('div', { class: 'p2p-code', 'aria-label': 'Code preview' }, icon('key', 15), h('code', null, code.slice(0, 10) + '…' + code.slice(-6)), h('small', null, `${code.length} characters`)); }
function renderOnline(main) {
  if (online && online.state && (online.phase === 'live' || online.phase === 'lost')) return renderOnlineGame(main);
  main.append(h('div', { class: 'course-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => { leaveOnline(); friendView = 'menu'; navDir = 'back'; render(); } }, icon('back', 20)), h('div', { class: 'grow' }, h('h2', null, 'Invite a Friend'), h('small', null, 'Two phones, one game, no account needed'))));
  if (!window.RTCPeerConnection) { main.append(h('div', { class: 'card' }, 'This browser does not support peer-to-peer connections. Try Chrome, Safari or Firefox.')); return; }
  const ph = online && online.phase;
  if (!online) {
    let color = 'r';
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => { seg.innerHTML = ''; [['w', [pieceImg('wk'), ' White']], ['r', [icon('dice', 16), ' Random']], ['b', [pieceImg('bk'), ' Black']]].forEach(([v, l]) => seg.append(h('button', { class: color === v ? 'on' : '', onclick: () => { color = v; beep('toggle'); drawSeg(); } }, l))); };
    drawSeg();
    const inp = h('textarea', { class: 'input', rows: 3, placeholder: 'Paste the invite link or code here' });
    if (pendingJoin) { inp.value = pendingJoin; onlineTab = 'join'; }
    const tcSel = { tc: '0+0' };
    const tabs = h('div', { class: 'seg p2p-tabs' }); [['host', [icon('sparkle', 16), ' Host a game']], ['join', [icon('link', 16), ' Join a friend']]].forEach(([v, l]) => tabs.append(h('button', { class: onlineTab === v ? 'on' : '', onclick: () => { onlineTab = v; beep('toggle'); render(); } }, l)));
    main.append(tabs, p2pStepper(1, onlineTab === 'join' ? 'guest' : 'host'));
    if (onlineTab === 'host') main.append(h('div', { class: 'card setup2 p2p-card' }, h('div', { class: 'p2p-hero' }, courtArt('invite'), h('div', null, h('b', null, 'Host a game'), h('small', null, 'Make an invite link, then send it to your friend.'))),
      h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Play as'), seg), h('div', { class: 'srow col' }, h('span', { class: 'lbl' }, 'Clock'), tcPicker(tcSel)),
      h('button', { class: 'play-big', onclick: () => { beep('confirm'); hostCreate(color, tcSel.tc); } }, icon('sparkle', 20), h('span', null, 'Create invite'))));
    else main.append(h('div', { class: 'card stack p2p-card' }, h('div', { class: 'p2p-hero' }, courtArt('invite'), h('div', null, h('b', null, 'Join a friend'), h('small', null, 'Opened an invite link? It is already pasted below.'))),
      h('b', null, 'Paste the invite from your friend'), inp,
      h('button', { class: 'play-big', onclick: () => { const v = inp.value.trim(); if (!v) return toast('Paste the invite first'); pendingJoin = null; beep('confirm'); guestJoin(v); } }, icon('link', 20), h('span', null, 'Join game'))));
    main.append(h('p', { class: 'small muted p2p-foot' }, icon('shield', 14), ' Your devices connect directly. Nothing goes through a server, and nothing is rated.'));
    return;
  }
  const role = online.role;
  const waiting = txt => h('div', { class: 'p2p-wait' }, h('span', { class: 'p2p-ring' }, h('i'), h('i'), icon(role === 'guest' ? 'link' : 'sparkle', 22)), h('b', null, txt));
  const card = h('div', { class: 'card stack p2p-card' });
  if (ph === 'making' || ph === 'connecting') {
    main.append(p2pStepper(ph === 'making' ? 1 : 3, role));
    card.append(waiting(ph === 'making' ? 'Preparing connection…' : 'Connecting to your friend…'), h('p', { class: 'small muted center' }, ph === 'making' ? 'This takes a few seconds.' : 'Hang on, the board appears as soon as both phones are linked.'));
  } else if (ph === 'invite') {
    main.append(p2pStepper(2, role));
    const link = inviteLink(online.code);
    const ans = h('textarea', { class: 'input', rows: 3, placeholder: "Paste your friend's reply code here" });
    card.append(h('div', { class: 'p2p-sh' }, h('span', { class: 'p2p-n' }, '1'), h('h3', null, 'Step 1: Send this invite')),
      h('div', { class: 'small muted' }, 'Text or message this link to your friend:'), p2pCodeChip(link),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => { beep('confirm'); shareOrCopy(link, 'Join my chess game!'); } }, icon('share', 18), 'Share invite'), h('button', { class: 'btn', onclick: () => { beep('tap'); copyText(link); } }, icon('copy', 18), 'Copy')),
      h('div', { class: 'p2p-sep' }),
      h('div', { class: 'p2p-sh' }, h('span', { class: 'p2p-n' }, '2'), h('h3', null, 'Step 2: Paste their reply')), h('div', { class: 'small muted' }, 'Your friend gets a reply code after opening the link.'), ans,
      h('button', { class: 'btn block', onclick: () => { const v = ans.value.trim(); if (!v) return toast('Paste the reply code first'); beep('confirm'); hostAccept(v); } }, icon('link', 18), 'Connect'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'answer') {
    main.append(p2pStepper(2, role));
    card.append(h('div', { class: 'p2p-sh' }, h('span', { class: 'p2p-n' }, icon('check', 16)), h('h3', null, 'Almost there!')),
      h('div', { class: 'small muted' }, `Send this reply code back to ${online.hostName || 'your friend'}. The game starts as soon as they paste it in.`), p2pCodeChip(online.code),
      h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: () => { beep('confirm'); shareOrCopy(online.code, 'My chess reply code'); } }, icon('share', 18), 'Share reply'), h('button', { class: 'btn', onclick: () => { beep('tap'); copyText(online.code); } }, icon('copy', 18), 'Copy')),
      waiting('Waiting for the connection…'),
      h('button', { class: 'btn ghost', onclick: () => { leaveOnline(); render(); } }, 'Cancel'));
  } else if (ph === 'error' || ph === 'lost') {
    card.append(h('div', { class: 'p2p-err' }, icon(ph === 'lost' ? 'plug' : 'alert', 26)), h('h3', { class: 'center' }, (ph === 'lost' ? 'Connection lost' : 'Something went wrong')), h('p', { class: 'small muted center' }, online.err || 'The connection closed.'),
      h('button', { class: 'btn primary block', onclick: () => { leaveOnline(); render(); } }, 'Start over'));
  }
  main.append(card);
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
  const liveText = () => o.connected ? '● connected (peer-to-peer)' : '○ disconnected';
  const oppName = (oppInfo && oppInfo.name) || 'Friend', myName = profile.name || 'You';
  const scr = gameScreen(main, {
    title: `vs ${oppName}`, sub: liveText(), back: () => confirmBox('Leave this game?', 'This closes the connection to your friend.', 'Leave', () => { leaveOnline(); friendView = 'menu'; render(); }),
    mine: myColor ? [myColor] : [], premove: !!myColor, names: { w: st.white.name || 'White', b: st.black.name || 'Black' },
    result: () => o.state.result ? o.state.result.result : '*',
    canAnalyze: () => !!o.state.result,
    menu: () => {
      const s = o.state; if (s.result || !o.connected) return [];
      return [{ ic: 'half', label: s.drawOffer && s.drawOffer !== myId ? 'Accept draw' : 'Offer draw', disabled: s.drawOffer === myId, on: drawAction },
        { ic: 'flag', label: 'Resign', danger: true, on: resignAction }];
    },
    game: g, orient: myColor || 'w', players: (() => { const opp = { name: oppName, avatar: 'friend', rating: oppInfo && oppInfo.r ? Math.round(oppInfo.r) : null }, mine = { name: 'You', avatar: myAvatar(), rating: fmtR(profile.human), self: true }; return myColor === 'b' ? { w: opp, b: mine } : { w: mine, b: opp }; })(),
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
  const setLive = () => scr.setTitle(`vs ${oppName}`, liveText());
  let shownOver = !!st.result;
  // the versus card once per new game
  const introKey = [st.white.id, st.black.id, st.v].join('|');
  if (!st.moves.length && !st.result && o.connected && online.introKey !== introKey && myColor) {
    online.introKey = introKey;
    versusIntro({ me: { name: myName, avatar: myAvatar(), rating: fmtR(profile.human), self: true }, opp: { name: oppName, avatar: 'friend', rating: oppInfo && oppInfo.r ? Math.round(oppInfo.r) : null }, tag: st.tc && st.tc !== '0+0' ? `Friend game, ${tcLabel(...parseTc(st.tc))}` : 'Friend game', line: myColor === 'w' ? 'You play White' : 'You play Black' });
  }
  function drawAction() { const s = o.state; if (s.drawOffer && s.drawOffer !== myId) { clk.stop(s.clock); s.result = { result: '1/2-1/2', reason: 'agreement' }; } else { s.drawOffer = myId; toast('Draw offered'); } s.v++; sendState(); buttons(); checkOver(); }
  function resignAction() { confirmBox('Resign?', 'Your friend wins this game.', 'Resign', () => { const s = o.state; clk.stop(s.clock); s.result = { result: myColor === 'w' ? '0-1' : '1-0', reason: 'resignation' }; s.v++; sendState(); buttons(); checkOver(); }); }
  function checkOver() {
    const r = o.state.result; if (!r || shownOver) return; shownOver = true;
    const win = (r.result === '1-0' && myColor === 'w') || (r.result === '0-1' && myColor === 'b');
    const score = r.result === '1/2-1/2' ? .5 : win ? 1 : 0;
    const rc = rateOnline(o.state, oppInfo, score);
    if (o.state.moves.length >= 2) saveGameRecord({ kind: 'friend', online: true, opp: oppName, oppR: oppInfo && oppInfo.r ? Math.round(oppInfo.r) : undefined, oppAvatar: 'friend', color: myColor, score, result: r.result, reason: r.reason, rated: false,
      pgn: g.pgnMoves(), moves: o.state.moves.slice(), tc: o.state.tc || '0+0', white: o.state.white.name || 'White', black: o.state.black.name || 'Black', role: o.role });
    if (o.state.moves.length >= 4) rewardEvent('localGame', { moves: o.state.moves.slice(), reason: o.state.result.reason });
    if (win) { beep('win'); scr.board.burst('trophy'); } else beep(score === .5 ? 'draw' : 'lose');
    void rc;
    setTimeout(() => presentResults({ mood: win ? 'cheer' : score === .5 ? 'happy' : 'sad', title: r.result === '1/2-1/2' ? 'Draw!' : win ? 'You win!' : `${oppName} wins!`, subtitle: `by ${r.reason}. Friendly game: no rating change.`, stats: [{ label: 'Moves', value: Math.ceil(o.state.moves.length / 2) }],
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
    { ic: 'flip', label: 'Flip', on: () => scr.flip(true) }];
    if (!o.connected) list.push({ ic: 'plug', label: 'Reconnect', on: () => { const keep = o.role === 'host' ? o.state : null; leaveOnline(); if (keep) { profile.onlineResume = keep; saveProfile(); } render(); toast(keep ? 'Create a new invite. The game will continue where you left off.' : 'Ask the host for a new invite link.', 4000); } });
    else if (!over) {
      list.push({ ic: 'half', label: s.drawOffer && s.drawOffer !== myId ? 'Accept' : 'Draw?', disabled: s.drawOffer === myId, on: drawAction });
      list.push({ ic: 'flag', label: 'Resign', on: resignAction });
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
