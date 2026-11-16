// The Me tab: a player card (framed avatar, name, title, level, three ratings, banner color) and five sections
// switched in place: Season | Trophies | Style | Stats | Settings. Season lives in daily.js, Style in rewards.js,
// Stats in insights.js. meView picks the section: 'season', 'trophies', 'style', 'insights' (Stats) or 'settings';
// null means Trophies.
'use strict';
const ME_TABS = [['season', 'flag', 'Season'], ['trophies', 'trophy', 'Trophies'], ['style', 'palette', 'Style'], ['insights', 'chart', 'Stats'], ['settings', 'gear', 'Settings']];
const meTabOf = v => ME_TABS.some(t => t[0] === v) ? v : 'trophies';
function renderMe(main) {
  let tab = meTabOf(meView);
  main.classList.add('me');
  main.append(mePlayerCard());
  const ind = h('i', { class: 'me-tab-ind' });
  const btns = ME_TABS.map(([id, ic, label]) => h('button', { role: 'tab', 'data-t': id, onclick: () => show(id) }, icon(ic, 20), h('span', null, label)));
  const tabs = h('div', { class: 'me-tabs', role: 'tablist' }, ind, btns);
  const panel = h('div', { class: 'me-panel', role: 'tabpanel' });
  main.append(tabs, panel);
  const mark = () => {
    const i = ME_TABS.findIndex(t => t[0] === tab);
    tabs.style.setProperty('--i', i);
    btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
  };
  const draw = dir => {
    panel.innerHTML = '';
    panel.className = 'me-panel' + (dir ? ' in-' + dir : '');
    if (tab === 'trophies') panel.append(trophyCard());
    else if (tab === 'season') renderSeason(panel);
    else if (tab === 'style') renderStyle(panel);
    else if (tab === 'insights') renderInsights(panel);
    else meSettings(panel);
  };
  const show = id => {
    if (id === tab) return;
    const from = ME_TABS.findIndex(t => t[0] === tab), to = ME_TABS.findIndex(t => t[0] === id);
    tab = id; meView = id; beep('tap'); haptic(6);
    try { lastRoute = route + '|' + subView(); } catch (e) { } // an in-place switch, not a new screen
    mark(); draw(to > from ? 'r' : 'l');
    // keep the tabs where they are: if the page was scrolled past them, bring the new section's top up
    const top = tabs.getBoundingClientRect().top + window.scrollY - meTopbarH();
    if (window.scrollY > top) window.scrollTo(0, top);
  };
  mark(); draw('');
  requestAnimationFrame(() => tabs.style.setProperty('--top', meTopbarH() + 'px'));
}
function meTopbarH() { const t = document.querySelector('.topbar'); return t ? t.offsetHeight : 0; }
// redraw the player card in place (after a new avatar, frame, title or banner)
function meRefreshCard() { const old = document.querySelector('.me-card'); if (old) { const n = mePlayerCard(); old.replaceWith(n); n.classList.add('pop'); } }

// ---------- player card ----------
function mePlayerCard() {
  const li = levelInfo(profile.xp || 0), L = profile.ladder, lg = leagueOf(L.r), pr = profile.puzzle;
  const A = profile.ach || {};
  const best = ACHIEVEMENTS.filter(a => A[a.id]).sort((a, b) => b.tier - a.tier || A[b.id] - A[a.id]).slice(0, 3);
  const av = h('button', { class: 'me-av', 'aria-label': 'Change avatar', onclick: () => meAvatarSheet() }, playerBadgeEl(84), h('span', { class: 'me-av-edit' }, icon('edit', 13)));
  const bn = myBanner();
  const srv = profile.server;
  const tile = (cls, head, label, val, sub, hist, color, kind) => h('button', { class: 'me-rt ' + cls, onclick: () => meRatingSheet(kind) },
    h('div', { class: 'me-rt-h' }, head, h('span', null, label)),
    h('div', { class: 'me-rt-v' }, h('b', null, val), meDelta(hist)),
    h('small', null, sub), meSpark(hist, color));
  const card = h('div', { class: 'me-card banner-' + bn.id },
    h('div', { class: 'me-top' }, av,
      h('div', { class: 'me-id' },
        meNameEl(),
        h('div', { class: 'me-title-row' }, h('button', { class: 'me-title', 'aria-label': 'Change title', onclick: () => { meView = 'style'; const b = document.querySelector('.me-tabs [data-t="style"]'); if (b) { b.click(); setTimeout(() => { const s = document.querySelector('.sty-sec[data-k="title"]'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); } } }, playerTitle()),
          best.length ? h('button', { class: 'me-show', 'aria-label': 'Trophies', onclick: () => { const b = document.querySelector('.me-tabs [data-t="trophies"]'); if (b) b.click(); } }, best.map(a => h('span', { class: 'me-mini t' + a.tier }, icon(a.icon, 12)))) : null),
        levelCard())),
    h('div', { class: 'me-rts' },
      tile('rb', leagueIcon(L.r, 16), 'Bot League', String(L.r), lg.name, profile.rHist || [], '#ffc56b', 'bot'),
      tile('ro', icon('globe', 15), 'Online', srv ? Math.round(srv.r) + (srv.provisional ? '?' : '') : '800?', srv && srv.games ? `${srv.games} games` : 'Not played yet', profile.hHist || [], '#93dc98', 'online'),
      tile('rp', icon('puzzle', 15), 'Puzzles', fmtR(pr), `Best streak ${profile.best}`, profile.pHist || [], '#9ccfff', 'puzzle')));
  card.style.setProperty('--bn1', bn.c[0]); card.style.setProperty('--bn2', bn.c[1]); card.style.setProperty('--bn3', bn.c[2]);
  return card;
}
// tap the name to edit it in place
function meNameEl() {
  const box = h('div', { class: 'me-name' });
  const show = () => {
    box.innerHTML = '';
    box.append(h('button', { class: 'me-name-btn', 'aria-label': 'Edit your name', onclick: edit },
      profile.name ? h('span', { class: 'no-i18n nm' }, profile.name) : h('span', { class: 'nm ph' }, 'Add your name'), icon('edit', 15)));
  };
  const edit = () => {
    beep('tap'); box.innerHTML = '';
    const inp = h('input', { class: 'me-name-inp', value: profile.name || '', maxlength: 20, placeholder: 'Your name', 'aria-label': 'Your name', enterkeyhint: 'done', autocomplete: 'off' });
    let done = false;
    const save = () => { if (done) return; done = true; const v = inp.value.trim(); if (v !== profile.name) { profile.name = v; saveProfile(); beep('confirm'); } show(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } else if (e.key === 'Escape') { inp.value = profile.name || ''; inp.blur(); } });
    inp.addEventListener('blur', save);
    box.append(inp); inp.focus(); inp.select();
  };
  show();
  return box;
}
function meSpark(arr, color) {
  const d = (arr || []).slice(-30), W = 100, H = 26, el = h('div', { class: 'me-spark' });
  if (d.length < 2) { el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="M0 ${H - 6}H${W}" stroke="${color}" stroke-width="2" stroke-dasharray="3 5" opacity=".45" vector-effect="non-scaling-stroke"/></svg>`; return el; }
  const min = Math.min(...d), max = Math.max(...d), span = Math.max(30, max - min);
  const pts = d.map((v, i) => [i / (d.length - 1) * W, H - 3 - (v - min) / span * (H - 6)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const gid = 'msg' + Math.random().toString(36).slice(2, 7), last = pts[pts.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><i style="left:${Math.min(96, last[0])}%;top:${(last[1] / H * 100).toFixed(1)}%;background:${color}"></i>`;
  return el;
}
function meDelta(arr) {
  if (!arr || arr.length < 2) return null;
  const d = Math.round(arr[arr.length - 1] - arr[arr.length - 2]); if (!d) return null;
  return h('span', { class: 'me-delta ' + (d > 0 ? 'up' : 'dn') }, (d > 0 ? '+' : '') + d);
}

// ---------- sheets ----------
function meAvatarSheet() {
  beep('open');
  const st = profile.style = profile.style || {};
  modal((box, close) => {
    const grid = h('div', { class: 'me-avgrid' }, AVATAR_CHOICES.map(it => {
      const ok = reqMet(it.req), on = myAvatar() === it.id;
      const b = h('button', { class: 'me-avc' + (on ? ' on' : '') + (ok ? '' : ' locked'), onclick: () => {
        if (!ok) { beep('error'); if (typeof fxShake === 'function') fxShake(b); return; }
        st.avatar = it.id; saveProfile(); beep('pop'); haptic(10);
        grid.querySelectorAll('.me-avc').forEach(x => x.classList.remove('on')); b.classList.add('on');
        meRefreshCard();
        const big = document.querySelector('.me-av'); if (big) { big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); }
        setTimeout(close, 260);
      } }, avatar(it.id, 58), h('b', null, it.name), ok ? null : h('small', null, reqShort(it.req)), ok ? null : h('span', { class: 'lock' }, icon('key', 12)));
      return b;
    }));
    box.append(h('h2', { class: 'center' }, 'Choose your avatar'), h('p', { class: 'center muted small', style: { margin: '0 0 12px' } }, 'Beat a bot to add its portrait to your collection.'), grid);
  });
}
function meRatingSheet(kind) {
  beep('open');
  const L = profile.ladder, lg = leagueOf(L.r), srv = profile.server, pr = profile.puzzle;
  modal((box, close) => {
    const how = h('button', { class: 'btn block', onclick: () => { close(); ratingsHelpSheet(); } }, icon('book', 18), 'How ratings work');
    if (kind === 'bot') {
      const bg = profile.games.filter(g => !g.online);
      const w = bg.filter(g => g.score === 1).length, l = bg.filter(g => g.score === 0).length, d = bg.filter(g => g.score === 0.5).length;
      box.append(
        h('div', { class: 'me-sh-head' }, h('img', { class: 'me-sh-piece', src: PIECE_URL['w' + lg.piece], alt: '' }), h('div', { class: 'grow' }, h('small', null, 'Bot League'), h('h2', null, lg.name)), h('b', { class: 'me-sh-r' }, String(L.r))),
        h('div', { class: 'qbar me-sh-bar' }, h('div', { style: { width: Math.round(lg.pct * 100) + '%' } })),
        h('p', { class: 'small muted', style: { margin: '6px 0 0' } }, lg.next ? `${lg.next - L.r} points to the ${lg.nextName}` : 'Top league reached!'),
        h('div', { class: 'me-sh-graph' }, sparkline(profile.rHist, '#ffc56b')),
        h('div', { class: 'me-sh-stats' },
          h('div', null, h('b', null, String(w)), h('small', null, 'Won')), h('div', null, h('b', null, String(d)), h('small', null, 'Drawn')), h('div', null, h('b', null, String(l)), h('small', null, 'Lost')),
          h('div', null, h('b', null, String(L.peak || L.r)), h('small', null, 'Peak'))),
        h('p', { class: 'small muted center', style: { margin: '8px 0 12px' } }, L.games < PLACEMENT_GAMES ? `Placement: ${L.games}/${PLACEMENT_GAMES} games` : `${L.games} rated games · peak ${L.peak}`),
        h('div', { class: 'me-leagues' }, LEAGUES.map((x, i) => h('div', { class: 'me-lg' + (i === lg.i ? ' on' : i < lg.i ? ' past' : '') }, h('img', { src: PIECE_URL['w' + x[2]], alt: '' }), h('small', null, String(x[0]))))),
        how);
    } else if (kind === 'online') {
      box.append(
        h('div', { class: 'me-sh-head' }, h('div', { class: 'me-sh-ic' }, icon('globe', 30)), h('div', { class: 'grow' }, h('small', null, 'Online rating'), h('h2', null, 'Play the World')), h('b', { class: 'me-sh-r' }, srv ? Math.round(srv.r) + (srv.provisional ? '?' : '') : '800?')),
        h('p', { class: 'small muted', style: { margin: '10px 0 0' } }, srv && srv.games ? `${srv.games} lobby games` : 'Play the World to start'),
        (profile.human && profile.human.games) ? h('div', { class: 'me-sh-graph' }, sparkline(profile.hHist, '#93dc98')) : null,
        h('p', { class: 'small muted' }, 'Rated games against people. The server checks every move, so nobody can fake a result.'),
        typeof lobbyView !== 'undefined' ? h('button', { class: 'btn primary block', style: { marginBottom: '10px' }, onclick: () => { close(); friendView = 'world'; lobbyView = 'home'; go('friend'); } }, icon('globe', 18), 'Play the World') : null,
        how);
    } else {
      box.append(
        h('div', { class: 'me-sh-head' }, h('div', { class: 'me-sh-ic puz' }, icon('puzzle', 30)), h('div', { class: 'grow' }, h('small', null, 'Puzzle rating'), h('h2', null, band(pr.r)[1])), h('b', { class: 'me-sh-r' }, fmtR(pr))),
        h('div', { class: 'me-sh-graph' }, sparkline(profile.pHist, '#9ccfff')),
        h('div', { class: 'me-sh-stats' },
          h('div', null, h('b', null, String((stats().puzzles) || 0)), h('small', null, 'Solved')), h('div', null, h('b', null, String(profile.best || 0)), h('small', null, 'Best streak')),
          h('div', null, h('b', null, String(Math.max(0, ...Object.values(profile.rushBest || {})))), h('small', null, 'Rush best'))),
        h('button', { class: 'btn primary block', style: { margin: '12px 0 10px' }, onclick: () => { close(); go('puzzles'); } }, icon('puzzle', 18), 'Solve puzzles'),
        how);
    }
  });
}
function ratingsHelpSheet() {
  beep('open');
  modal((box, close) => box.append(h('h2', null, 'How ratings work'), h('div', { class: 'stack me-help' },
    h('p', { class: 'small muted' }, h('b', null, 'You have three separate ratings. '), 'Bots, people and puzzles are different skills, so each one is tracked on its own.'),
    h('p', { class: 'small muted' }, h('b', null, 'Bot League: '), `climb from the Pawn League to the King League by beating bots. It uses the Elo system with strict limits: one game moves you at most ${40} points during your first ${PLACEMENT_GAMES} placement games, then at most 20. Beating a bot far below your level earns almost nothing, so climbing takes real wins against strong bots.`),
    h('table', { class: 'tbl' }, LEAGUES.map((x, i) => h('tr', null, h('td', null, h('img', { src: PIECE_URL['w' + x[2]], style: { width: '18px', verticalAlign: '-3px' } }), ' ' + x[1]), h('td', null, i < LEAGUES.length - 1 ? `${x[0]}–${LEAGUES[i + 1][0] - 1}` : `${x[0]}+`)))),
    h('p', { class: 'small muted' }, `The bots' ratings were measured, not guessed: they played ${CALIB.games} games against each other, and their ratings were fitted from the results. These numbers compare fairly inside Knight Club, but they're estimates, not official FIDE or chess.com ratings.`),
    h('table', { class: 'tbl' }, BOTS.map(bt => h('tr', null, h('td', { class: 'tbl-bot' }, avatar(bt.avatar, 24), h('span', null, bt.name)), h('td', null, bt.rating)))),
    h('p', { class: 'small muted' }, h('b', null, 'Online rating: '), 'for rated games in Play the World. The server checks every move and keeps the rating, so nobody can fake a result. It uses Glicko-2, a system many chess sites use, and moves at most 50 points per game while it is provisional ("?"), then at most 30. Games shorter than 4 moves are not rated.'),
    h('p', { class: 'small muted' }, h('b', null, 'Puzzle rating: '), "also Glicko-2, moving at most 30 points per puzzle while provisional, then 15. Only your first try at each puzzle counts. Each puzzle's difficulty is estimated from how long the engine has to search to find the answer and how many tempting wrong moves there are."),
    h('button', { class: 'btn primary block', onclick: () => { beep('close'); close(); } }, 'Got it'))));
}

// ---------- settings ----------
const meSfx = () => (typeof SFX !== 'undefined' && SFX) ? SFX : null;
function meMusicStyle() { return (profile.music && profile.music.style) || 'club'; }
function meSettings(panel) {
  const st = profile.style = profile.style || {};
  const redraw = () => { panel.innerHTML = ''; meSettings(panel); };
  const sw = (on, label) => h('span', { class: 'me-sw' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label }, h('i'));
  const row = (ic, label, sub, control, onTap, cls) => h(onTap ? 'button' : 'div', { class: 'me-set' + (cls ? ' ' + cls : ''), onclick: onTap || null },
    h('div', { class: 'me-set-ic' }, ic), h('div', { class: 'grow' }, h('b', null, label), sub ? h('small', null, sub) : null), control || null);
  const toggleRow = (ic, label, sub, on, flip) => { const r = row(icon(ic, 19), label, sub, sw(on, label), () => { flip(); haptic(10); beep('toggle'); redraw(); }); return r; };
  const slider = (val, onInput, onDone, label, disabled) => {
    const s = h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(val * 100), class: 'me-range', 'aria-label': label });
    if (disabled) s.disabled = true;
    const fill = () => s.style.setProperty('--v', s.value + '%'); fill();
    s.addEventListener('input', () => { fill(); onInput(s.value / 100); });
    s.addEventListener('change', () => onDone && onDone());
    return s;
  };
  const group = (title, ...rows) => h('section', { class: 'me-group' }, h('h3', null, title), h('div', { class: 'me-group-box' }, rows));
  const S = meSfx(), mOn = !!(profile.music && profile.music.on);
  const noteIc = h('span', { class: 'icn', html: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>' });
  const volIc = icon('soundOn', 19);
  // Sound
  panel.append(group('Sound',
    toggleRow(soundOn ? 'soundOn' : 'soundOff', 'Sound effects', 'Moves, taps and rewards', soundOn, () => { soundOn = !soundOn; profile.sound = soundOn; saveProfile(); }),
    S ? row(volIc, 'Effects volume', null, slider(S.volume, v => S.setVolume(v), () => beep('pop'), 'Effects volume', !soundOn), null, 'slide' + (soundOn ? '' : ' off')) : null,
    S ? row(noteIc, 'Music', 'Relaxed background music', sw(mOn, 'Music'), () => {
      profile.music = Object.assign({ style: 'club' }, profile.music, { on: !mOn }); saveProfile();
      if (profile.music.on) S.music.start(meMusicStyle()); else S.music.stop();
      haptic(10); beep('toggle'); redraw();
    }) : null,
    S && mOn ? h('div', { class: 'me-set sub' }, h('div', { class: 'seg grow' }, [['club', 'Clubhouse'], ['focus', 'Focus']].map(([v, l]) => h('button', { class: meMusicStyle() === v ? 'on' : '', onclick: () => { profile.music.style = v; saveProfile(); S.music.start(v); beep('tap'); redraw(); } }, l)))) : null,
    S && mOn ? row(noteIc.cloneNode(true), 'Music volume', null, slider(S.music.volume, v => S.music.setVolume(v), null, 'Music volume'), null, 'slide') : null));
  // Board
  const flipSt = k => () => { st[k] = st[k] === false; saveProfile(); applyStyle(); };
  panel.append(group('Board and feel',
    toggleRow('board', 'Show coordinates', 'Letters and numbers on the board edge', st.coords !== false, flipSt('coords')),
    toggleRow('sparkle', 'Animate moves', 'Pieces slide, rewards burst', st.anim !== false, flipSt('anim')),
    toggleRow('target', 'Show legal move dots', 'Dots where the piece you picked can go', st.dots !== false, flipSt('dots')),
    navigator.vibrate ? toggleRow('phone', 'Vibration', 'A little buzz on moves and taps', st.haptics !== false, flipSt('haptics')) : null));
  // Language
  panel.append(group('Language', h('div', { class: 'me-set' }, h('div', { class: 'me-set-ic' }, icon('globe', 19)), h('div', { class: 'grow' }, h('b', null, 'Language'), h('small', null, 'Menus, lessons and coach tips')), h('div', { class: 'me-lang' }, languagePicker()))));
  // App
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const install = async () => { if (typeof installPrompt !== 'undefined' && installPrompt) { installPrompt.prompt(); installPrompt = null; } else modal((box, close) => box.append(h('h2', null, 'Install the app'), h('p', null, h('b', null, 'iPhone / iPad: '), 'open this page in Safari, tap the Share button, then "Add to Home Screen".'), h('p', null, h('b', null, 'Android: '), 'open the browser menu and tap "Install app" or "Add to Home screen".'), h('p', { class: 'muted small' }, 'Once installed, puzzles, lessons and bot games work without internet.'), h('button', { class: 'btn primary block', onclick: close }, 'Got it'))); };
  const chev = () => h('span', { class: 'me-chev' }, icon('next', 18));
  panel.append(group('App',
    standalone ? null : row(icon('download', 19), 'Install Knight Club', 'Add it to your home screen. It works offline too.', h('span', { class: 'btn sm primary me-inst' }, 'Install'), install),
    row(icon('book', 19), 'How ratings work', 'Bot League, Online and Puzzle ratings', chev(), ratingsHelpSheet),
    row(icon('sparkle', 19), "What's new", `Knight Club ${APP_VERSION}`, chev(), () => whatsNew(true)),
    row(icon('trash', 19), 'Reset progress', 'Erase everything on this device', null, () => confirmBox('Reset everything?', 'This erases your ratings, games, puzzles and lessons.', 'Reset', () => { profile = DEFAULT_PROFILE(); saveProfile(); render(); }), 'danger')));
  panel.append(h('p', { class: 'small muted center me-foot' }, 'Your progress is saved in this browser on this device.', h('br'),
    h('a', { href: '#', onclick: e => { e.preventDefault(); whatsNew(true); } }, `Knight Club ${APP_VERSION}`), h('br'), 'Free and open source (GPL-3.0), with Stockfish 19 and Fairy-Stockfish.'));
}
// Background music: if it was on last time, it starts again on the first tap (browsers block audio until then).
(function meMusicOnGesture() {
  const evs = ['pointerdown', 'keydown'];
  const once = () => {
    evs.forEach(ev => window.removeEventListener(ev, once, true));
    try { const S = meSfx(); if (S && profile.music && profile.music.on && !S.music.playing) setTimeout(() => S.music.start(meMusicStyle()), 0); } catch (e) { }
  };
  evs.forEach(ev => window.addEventListener(ev, once, true));
})();
