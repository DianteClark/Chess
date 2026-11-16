// The clubhouse: home screen with the player's plaque and illustrated rooms.
'use strict';
function suggestedBot() { let best = 0; BOTS.forEach((b, i) => { if (Math.abs(b.rating - profile.ladder.r) < Math.abs(BOTS[best].rating - profile.ladder.r)) best = i; }); return best; }
function renderHome(main) {
  const li = levelInfo(profile.xp || 0), lg = leagueOf(profile.ladder.r);
  // player plaque
  main.append(h('button', { class: 'plaque', onclick: () => go('me') },
    h('div', { class: 'frame' }, h('img', { src: AVATAR_URL[myAvatar()] || AVATAR_URL.you, alt: '' })),
    h('div', { class: 'grow', style: { textAlign: 'left' } },
      h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'nm' }, profile.name || 'Player'), h('span', { class: 'lv' }, 'Lv ' + li.lvl)),
      h('div', { class: 'ttl' }, li.title),
      h('div', { class: 'xp' }, h('div', { style: { width: Math.round(li.into / li.need * 100) + '%' } }))),
    h('div', { class: 'league' }, h('img', { src: PIECE_URL['w' + lg.piece], alt: '' }), h('b', null, profile.ladder.r), h('small', null, lg.name.replace(' League', '')))));
  // resume an unfinished game
  const cur = profile.current;
  if (cur && cur.mode === 'bot' && !cur.result) {
    const bot = BOTS[cur.bot];
    main.append(h('button', { class: 'resume', onclick: () => go('play') }, avatar(bot.avatar, 46), h('div', { class: 'grow' }, h('b', null, `Your game with ${bot.name}`), h('small', null, `${Math.ceil(cur.moves.length / 2)} moves played. Tap to continue.`)), icon('play', 22)));
  }
  const sb = BOTS[suggestedBot()];
  const dDone = dailyState().history[todayKey()];
  const lessonsDone = LESSONS.filter(l => profile.lessons[l.id]).length;
  const got = ACHIEVEMENTS.filter(a => (profile.ach || {})[a.id]).length;
  const room = (key, title, sub, onclick, opts = {}) => h('button', { class: 'room' + (opts.wide ? ' wide' : ''), onclick: () => { haptic(8); onclick(); } }, roomArt(key), opts.extra || null, opts.tag ? h('span', { class: 'tag' + (opts.hot ? ' hot' : '') }, opts.tag) : null, h('div', { class: 'lab' }, h('b', null, title), h('small', null, sub)));
  main.append(h('div', { class: 'rooms' },
    room('arena', 'The Arena', 'Play the bots and climb the Bot League', () => go('play'), { wide: true, tag: `Your match: ${sb.name}`, extra: h('div', { class: 'room-bot' }, avatar(sb.avatar, 64)) }),
    room('den', 'Puzzle Den', `${Object.values(profile.tried).filter(x => x === 1).length} puzzles solved`, () => { puzMode = dDone ? null : 'daily'; go('puzzles'); }, { tag: dDone ? null : 'Daily puzzle ready', hot: true }),
    room('library', 'The Library', `${lessonsDone} of ${LESSONS.length} lessons done`, () => go('learn'), { extra: h('div', { class: 'room-hoot' }, hoot(58)) }),
    room('world', 'World Hall', 'Play people near your rating', () => { friendView = 'world'; lobbyView = 'home'; go('friend'); }),
    room('courtyard', 'Courtyard', 'Friends and Pass & Play', () => { friendView = 'menu'; go('friend'); }),
    room('trophy', 'Trophy Hall', `${got} of ${ACHIEVEMENTS.length} trophies`, () => { meView = null; go('me'); setTimeout(() => { const t = document.querySelector('.achs'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350); }, { wide: true })));
  main.append(questCard());
}
