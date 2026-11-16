// The clubhouse: home screen. Compact plaque, a hero "Continue" card that follows what you were doing,
// the Daily row (daily puzzle, quests, login chest), today's quests, then the illustrated rooms.
'use strict';
function suggestedBot() { let best = 0; BOTS.forEach((b, i) => { if (Math.abs(b.rating - profile.ladder.r) < Math.abs(BOTS[best].rating - profile.ladder.r)) best = i; }); return best; }
// progress ring (p = 0..1)
function ringSvg(p, size = 44, sw = 5, cls = '') {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, k = Math.max(0, Math.min(1, p));
  return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(0,0,0,.32)" stroke-width="${sw}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c * k).toFixed(2)} ${c.toFixed(2)}" opacity="${k > 0 ? 1 : 0}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
let homeQuestsOpen = null; // null = open until all quests are done
function homeHero() {
  const cur = profile.current, lg = leagueOf(profile.ladder.r);
  const hero = (kind, art, kicker, title, sub, label, on) => h('button', { class: 'hm-hero ' + kind, onclick: () => { haptic(10); beep('confirm'); on(); } },
    h('div', { class: 'hm-hero-art' }, art),
    h('div', { class: 'hm-hero-txt' }, h('small', null, kicker), h('b', null, title), h('span', null, sub)),
    h('span', { class: 'hm-go' }, icon('play', 18), h('span', null, label)));
  if (cur && cur.mode === 'bot' && !cur.result && BOTS[cur.bot]) {
    const bot = BOTS[cur.bot], n = Math.ceil((cur.moves || []).length / 2);
    return hero('resume', h('div', { class: 'hm-av' }, avatar(bot.avatar, 62), h('i', { class: 'hm-live' })), 'Game in progress', `vs ${bot.name}`, n === 1 ? '1 move played' : `${n} moves played`, 'Resume', () => { gameHidden = false; go('play'); });
  }
  const next = LESSONS.find(l => !profile.lessons[l.id]);
  if (next) {
    const done = LESSONS.filter(l => profile.lessons[l.id]).length, i = LESSONS.indexOf(next);
    const art = h('div', { class: 'hm-lesson-art' }, typeof hootEl === 'function' ? hootEl(done ? 'wave' : 'talk', 66) : hoot(62));
    return hero('lesson', art, `Lesson ${i + 1} of ${LESSONS.length}`, next.title, next.desc || `Lesson ${i + 1}`, done ? 'Continue' : 'Start', () => { lessonOpen = next; lessonStep = 0; go('learn'); });
  }
  const si = suggestedBot(), sb = BOTS[si];
  return hero('play', h('div', { class: 'hm-av' }, avatar(sb.avatar, 62)), `Your match · ${lg.name}`, `Play ${sb.name}`, `Rated ${sb.rating} · Level ${si + 1}`, 'Play', () => { playSel.bot = si; playSel.auto = true; go('play'); });
}
function homeQuestRows(Q) {
  const bonus = 50 + Math.min(10, (Q.streak || 0) + 1) * 10;
  return h('div', { class: 'hm-quests' },
    Q.list.map(q => {
      const def = QUEST_POOL.find(x => x.id === q.id); if (!def) return null;
      return h('div', { class: 'hm-q' + (q.done ? ' done' : '') },
        h('div', { class: 'hm-qring' }, h('span', { html: ringSvg(q.n / def.goal, 34, 4) }), icon(q.done ? 'check' : def.icon, 16)),
        h('b', { class: 'hm-qt' }, def.text), h('small', { class: 'hm-qn' }, q.done ? 'Done' : `${q.n}/${def.goal}`),
        h('span', { class: 'hm-qx' }, `+${def.xp}`));
    }),
    h('div', { class: 'hm-qbonus' + (Q.bonus ? ' got' : '') }, icon(Q.bonus ? 'trophy' : 'gem', 16),
      h('span', { class: 'grow' }, Q.bonus ? 'Bonus earned. New quests tomorrow.' : 'Finish all three for a bonus'),
      Q.bonus ? (Q.streak > 1 ? h('span', { class: 'pill live' }, `${Q.streak} day streak`) : null) : h('b', null, `+${bonus} XP`)));
}
function renderHome(main) {
  if (typeof applyLoginGifts === 'function') applyLoginGifts();
  const li = levelInfo(profile.xp || 0), lg = leagueOf(profile.ladder.r);
  const wrap = h('div', { class: 'home' }); main.append(wrap);
  // ---- plaque: level ring around the avatar, name, XP, Bot League badge
  const pct = li.into / li.need;
  wrap.append(h('button', { class: 'hm-plaque', onclick: () => { haptic(6); meView = null; go('me'); }, 'aria-label': 'Your profile' },
    h('div', { class: 'hm-ring' }, h('span', { html: ringSvg(pct, 58, 5, 'xp') }), h('img', { src: AVATAR_URL[myAvatar()] || AVATAR_URL.you, alt: '' }), h('span', { class: 'hm-lv' }, String(li.lvl))),
    h('div', { class: 'hm-who' }, h('b', null, profile.name || 'Player'), h('small', null, li.title), h('div', { class: 'hm-xp' }, h('i', { style: { width: Math.round(pct * 100) + '%' } }), h('span', null, `${li.into} / ${li.need} XP`))),
    h('div', { class: 'hm-league' }, h('img', { src: PIECE_URL['w' + lg.piece], alt: '' }), h('div', null, h('b', null, String(Math.round(profile.ladder.r))), h('small', null, lg.name.replace(' League', ''))))));
  // ---- hero: continue what you were doing
  wrap.append(homeHero());
  // ---- daily row
  const ds = dailyState(), dDone = ds.history[todayKey()];
  const Q = questsToday(), qDone = Q.list.filter(q => q.done).length;
  const T = typeof loginToday === 'function' ? loginToday() : { day: 1, claimed: true };
  const avail = typeof dailyRewardAvailable === 'function' && dailyRewardAvailable();
  if (homeQuestsOpen === null) homeQuestsOpen = !Q.bonus && innerHeight >= 700; // short phones: rooms first, quests one tap away
  const qList = homeQuestRows(Q); if (!homeQuestsOpen) qList.classList.add('shut');
  const qTile = h('button', { class: 'hm-tile quests' + (Q.bonus ? ' done' : ''), 'aria-expanded': String(homeQuestsOpen), onclick: () => { homeQuestsOpen = !homeQuestsOpen; qList.classList.toggle('shut', !homeQuestsOpen); qTile.setAttribute('aria-expanded', String(homeQuestsOpen)); beep('toggle'); haptic(5); } },
    h('div', { class: 'hm-tart hm-qbig' }, h('span', { html: ringSvg(qDone / 3, 46, 5) }), h('em', null, `${qDone}/3`)),
    h('b', null, 'Quests'), h('small', null, Q.bonus ? 'All done' : `${3 - qDone} to go`));
  const chest = h('button', { class: 'hm-tile hm-chest' + (avail ? ' ready' : ''), onclick: e => {
      if (avail) claimDailyReward(e.currentTarget);
      else modal((box, close) => box.append(dailyRewardCard({ onDone: () => { close(); render(); } }), h('div', { style: { height: '10px' } }), h('button', { class: 'btn block', onclick: close }, 'Close')));
    } },
    h('div', { class: 'hm-tart', html: miniChestSvg(avail) }),
    h('b', null, avail ? 'Claim!' : 'Reward'),
    h('div', { class: 'hm-pips', 'aria-label': `Day ${T.day} of 7` }, Array.from({ length: 7 }, (_, i) => h('i', { class: (i + 1 < T.day || (T.claimed && i + 1 === T.day)) ? 'on' : (i + 1 === T.day ? 'now' : '') }))));
  wrap.append(h('div', { class: 'hm-daily' },
    h('button', { class: 'hm-tile puz' + (dDone ? ' done' : ' ready'), onclick: () => { haptic(6); puzMode = dDone ? null : 'daily'; go('puzzles'); } },
      h('div', { class: 'hm-tart' }, h('div', { class: 'hm-cal' }, h('small', null, new Date().toLocaleDateString(undefined, { month: 'short' })), h('b', null, String(new Date().getDate()))), dDone ? h('span', { class: 'hm-tick' }, icon('check', 12)) : null),
      h('b', null, 'Daily Puzzle'), h('small', null, dDone ? (ds.streak > 1 ? `${ds.streak} day streak` : 'Solved') : 'Ready')),
    qTile, chest));
  wrap.append(qList);
  // ---- rooms
  const sb = BOTS[suggestedBot()];
  const solved = Object.values(profile.tried).filter(x => x === 1).length;
  const lessonsDone = LESSONS.filter(l => profile.lessons[l.id]).length;
  const got = ACHIEVEMENTS.filter(a => (profile.ach || {})[a.id]).length;
  const wp = Object.keys((stats().worldPlayed) || {}).length, wTotal = (typeof WORLD_REGIONAL !== 'undefined' ? WORLD_REGIONAL.length + WORLD_TWISTS.length : 12);
  const room = (key, cls, title, sub, onclick, opts = {}) => h('button', { class: 'room hm-room ' + cls, onclick: () => { haptic(8); beep('tap'); onclick(); } },
    roomArt(key), opts.extra || null, opts.tag ? h('span', { class: 'tag' + (opts.hot ? ' hot' : '') }, opts.tag) : null,
    h('div', { class: 'lab' }, h('b', null, title), sub ? h('small', null, sub) : null, opts.bar != null ? h('div', { class: 'hm-rbar' }, h('i', { style: { width: Math.round(opts.bar * 100) + '%' } })) : null));
  wrap.append(h('div', { class: 'hm-rooms' },
    room('arena', 'r-arena', 'The Arena', `${lg.name} · ${Math.round(profile.ladder.r)}`, () => go('play'), { tag: `Next: ${sb.name}`, extra: h('div', { class: 'room-bot' }, avatar(sb.avatar, 50)) }),
    room('den', 'r-den', 'Puzzle Den', `${solved} solved · ${fmtR(profile.puzzle)}`, () => { puzMode = dDone ? null : 'daily'; go('puzzles'); }, { tag: dDone ? null : 'Daily ready', hot: true }),
    room('library', 'r-lib', 'Library', `${lessonsDone} of ${LESSONS.length} lessons`, () => go('learn'), { bar: lessonsDone / LESSONS.length, extra: h('div', { class: 'room-hoot' }, hoot(44)) }),
    room('trophy', 'r-trophy slim', 'Trophies', `${got} of ${ACHIEVEMENTS.length}`, () => { meView = null; go('me'); setTimeout(() => { const t = document.querySelector('.achs'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350); }),
    room('atlas', 'r-atlas', 'World Games', wp ? `${wp} of ${wTotal} games played` : 'Xiangqi, shogi, janggi and more', () => { worldView = null; go('world'); }, { tag: wp ? null : 'New' }),
    room('world', 'r-hall', 'World Hall', `Online ${fmtR(profile.human)}`, () => { friendView = 'world'; lobbyView = 'home'; go('friend'); }),
    room('courtyard', 'r-court', 'Courtyard', 'Friends, Pass & Play', () => { friendView = 'menu'; go('friend'); })));
}
