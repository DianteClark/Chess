// The clubhouse: home screen. Compact plaque, a hero "Continue" card that follows what you were doing,
// the season card, the Daily row (daily puzzle, quests, login chest), today's quests, then the illustrated rooms.
// Brand-new players first get a 3 step welcome (name + avatar, chess level, a tour of the dock), once.
'use strict';
function suggestedBot() {
  const ob = profile.onboarded;
  if (ob && ob.bot != null && !profile.ladder.games && BOTS[ob.bot]) return ob.bot; // picked in the welcome
  let best = 0; BOTS.forEach((b, i) => { if (Math.abs(b.rating - profile.ladder.r) < Math.abs(BOTS[best].rating - profile.ladder.r)) best = i; }); return best;
}
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
  const from = profile.onboarded && profile.onboarded.lesson != null ? profile.onboarded.lesson : 0;
  const next = from < 0 ? null : LESSONS.slice(from).find(l => !profile.lessons[l.id]);
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
  if (!profile.onboarded) {
    // players who already have progress never see the welcome
    if (profile.games.length || Object.keys(profile.lessons).length || profile.xp) profile.onboarded = { at: Date.now(), auto: true };
    else return homeWelcome(main);
  }
  const li = levelInfo(profile.xp || 0), lg = leagueOf(profile.ladder.r);
  const wrap = h('div', { class: 'home' }); main.append(wrap);
  // ---- plaque: framed avatar with the level badge, name, title, XP, Bot League badge; banner color behind
  const pct = li.into / li.need, bn = myBanner();
  const plaque = h('button', { class: 'hm-plaque', onclick: () => { haptic(6); meView = null; go('me'); }, 'aria-label': 'Your profile' },
    h('div', { class: 'hm-ring' }, playerBadgeEl(58), h('span', { class: 'hm-lv' }, String(li.lvl))),
    h('div', { class: 'hm-who' }, h('b', { class: profile.name ? 'no-i18n' : '' }, profile.name || 'Player'), h('small', null, playerTitle()), h('div', { class: 'hm-xp' }, h('i', { style: { width: Math.round(pct * 100) + '%' } }), h('span', null, `${li.into} / ${li.need} XP`))),
    h('div', { class: 'hm-league' }, h('img', { src: PIECE_URL['w' + lg.piece], alt: '' }), h('div', null, h('b', null, String(Math.round(profile.ladder.r))), h('small', null, lg.name.replace(' League', '')))));
  plaque.style.setProperty('--bn1', bn.c[0]); plaque.style.setProperty('--bn2', bn.c[1]); plaque.style.setProperty('--bn3', bn.c[2]);
  wrap.append(plaque);
  // ---- hero: continue what you were doing
  wrap.append(homeHero());
  // ---- season
  if (typeof seasonHomeCard === 'function') wrap.append(seasonHomeCard());
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
    homeTrophyNudge(got),
    room('den', 'r-den', 'Puzzle Den', `${solved} solved · ${fmtR(profile.puzzle)}`, () => { puzMode = dDone ? null : 'daily'; go('puzzles'); }, { tag: dDone ? null : 'Daily ready', hot: true }),
    room('library', 'r-lib', 'Library', `${lessonsDone} of ${LESSONS.length} lessons`, () => go('learn'), { bar: lessonsDone / LESSONS.length, extra: h('div', { class: 'room-hoot' }, hoot(44)) }),
    room('atlas', 'r-atlas', 'World Games', wp ? `${wp} of ${wTotal} games played` : 'Xiangqi, shogi, janggi and more', () => { worldView = null; go('world'); }, { tag: wp ? null : 'New' }),
    room('world', 'r-hall', 'World Hall', `Online ${fmtR(profile.human)}`, () => { friendView = 'world'; lobbyView = 'home'; go('friend'); }),
    room('courtyard', 'r-court', 'Courtyard', 'Friends, Pass & Play', () => { friendView = 'menu'; go('friend'); })));
  if (typeof seasonSummaryCheck === 'function') setTimeout(() => { if (route === 'home') seasonSummaryCheck(); }, 900);
}
// the trophies you are closest to (locked, with progress), best first
function nextTrophies(n = 3) {
  const A = profile.ach || {}, pct = a => { const p = achProgress(a); return p ? p[0] / p[1] : 0; };
  return ACHIEVEMENTS.filter(a => !A[a.id] && achProgress(a) && pct(a) > 0 && pct(a) < 1).sort((a, b) => pct(b) - pct(a) || a.tier - b.tier).slice(0, n);
}
// Trophy shelf on Home: count, plus a nudge toward the closest trophy
function homeTrophyNudge(got) {
  const nx = nextTrophies(1)[0], pr = nx ? achProgress(nx) : null;
  const openCab = () => { haptic(8); beep('tap'); meView = 'trophies'; go('me'); if (nx) setTimeout(() => trophySheet(nx), 380); };
  return h('button', { class: 'room hm-room r-trophy slim', onclick: openCab }, roomArt('trophy'),
    h('div', { class: 'lab' }, h('b', null, 'Trophies'), h('small', null, `${got} of ${ACHIEVEMENTS.length}`)),
    nx ? h('div', { class: 'hm-tn' }, medalEl(nx), h('div', { class: 'hm-tn-t' }, h('small', null, 'Next trophy'), h('b', null, nx.name), h('div', { class: 'hm-rbar' }, h('i', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } }))), h('span', { class: 'hm-tn-n' }, `${pr[0]}/${pr[1]}`)) : null);
}

// ---------- first-time welcome: 3 steps, shown once, skippable ----------
const OB_LEVELS = [
  { id: 'new', icon: 'p', title: 'New to chess', sub: 'Teach me how the pieces move.', bot: 0, lesson: 0 },
  { id: 'rules', icon: 'n', title: 'I know the rules', sub: 'I can play a game, I want to get better.', bot: 1, lesson: 9 },
  { id: 'club', icon: 'q', title: 'Club player', sub: 'I play often. Give me a real challenge.', bot: 3, lesson: -1 },
];
const OB_DOCK = [['home', 'home', 'Club', 'Your clubhouse: quests, the daily chest and the season.'], ['puzzles', 'puzzle', 'Puzzles', 'Daily Puzzle, rated puzzles and Puzzle Rush.'], ['play', 'play', 'Play', 'Bots for every level, friends and players online.'], ['learn', 'learn', 'Learn', 'Lessons with Professor Hoot, from the first move up.'], ['me', 'user', 'Me', 'Your trophies, style, stats and settings.']];
let obStep = 0;
function homeWelcome(main) {
  const st = profile.style = profile.style || {};
  const finish = (skipped) => {
    profile.onboarded = Object.assign({ at: Date.now() }, profile.obChoice || {}, skipped ? { skipped: true } : {}); delete profile.obChoice;
    saveProfile(); obStep = 0; beep(skipped ? 'tap' : 'win'); haptic(12);
    render(); if (!skipped) setTimeout(() => { confetti(1200); checkAchievements(); flushRewards(); }, 250);
  };
  const box = h('div', { class: 'ob' }); main.append(box);
  const dots = h('div', { class: 'ob-dots' }, [0, 1, 2].map(i => h('i', { class: i === obStep ? 'on' : i < obStep ? 'done' : '' })));
  const head = h('div', { class: 'ob-head' }, dots, h('button', { class: 'ob-skip', onclick: () => finish(true) }, 'Skip'));
  const next = () => { obStep++; beep('confirm'); haptic(8); render(); };
  box.append(head);
  if (obStep === 0) {
    const preview = () => h('div', { class: 'ob-plaque' }, playerBadgeEl(64), h('div', { class: 'grow' }, profile.name ? h('b', { class: 'no-i18n' }, profile.name) : h('b', { class: 'ph' }, 'Player'), h('small', null, playerTitle())));
    let pv = preview();
    const repaint = () => { const n = preview(); pv.replaceWith(n); pv = n; const bn = myBanner(); pv.style.setProperty('--bn1', bn.c[0]); pv.style.setProperty('--bn2', bn.c[1]); pv.style.setProperty('--bn3', bn.c[2]); };
    const inp = h('input', { class: 'ob-name', value: profile.name || '', maxlength: 20, placeholder: 'Your name', 'aria-label': 'Your name', enterkeyhint: 'done', autocomplete: 'off' });
    inp.addEventListener('input', () => { profile.name = inp.value.trim(); repaint(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    const pick = (list, key, art) => h('div', { class: 'ob-picks' }, list.filter(t => !t.req).map(t => {
      const b = h('button', { class: 'ob-pick' + ((st[key] || list[0].id) === t.id ? ' on' : ''), 'aria-label': t.name, onclick: () => { st[key] = t.id; beep('pop'); haptic(6); b.parentNode.querySelectorAll('.ob-pick').forEach(x => x.classList.toggle('on', x === b)); repaint(); } }, art(t));
      return b;
    }));
    box.append(h('div', { class: 'ob-body' },
      h('div', { class: 'ob-hoot' }, typeof hootEl === 'function' ? hootEl('wave', 76) : hoot(64)),
      h('h2', null, 'Welcome to Knight Club!'), h('p', { class: 'muted' }, 'A free chess club with no ads. First, how should we call you?'),
      pv, inp,
      h('small', { class: 'ob-lab' }, 'Avatar and banner color'),
      h('div', { class: 'ob-looks' }, pick(AVATAR_CHOICES, 'avatar', t => avatar(t.id, 44)), h('i', { class: 'ob-sep' }), pick(BANNERS, 'banner', t => h('span', { class: 'ob-ban', style: { background: bannerBg(t) } })))),
      h('button', { class: 'btn primary block ob-go', onclick: () => { profile.name = inp.value.trim(); saveProfile(); next(); } }, 'Next'));
    repaint();
  } else if (obStep === 1) {
    box.append(h('div', { class: 'ob-body' },
      h('div', { class: 'ob-hoot' }, typeof hootEl === 'function' ? hootEl('think', 76) : hoot(64)),
      h('h2', null, 'How well do you know chess?'), h('p', { class: 'muted' }, 'We will pick your first opponent and lesson. You can change everything later.'),
      h('div', { class: 'ob-levels' }, OB_LEVELS.map(L => h('button', { class: 'ob-level' + (profile.obChoice && profile.obChoice.level === L.id ? ' on' : ''), onclick: () => {
        profile.obChoice = { level: L.id, bot: L.bot, lesson: L.lesson }; saveProfile(); next();
      } }, h('img', { src: PIECE_URL['w' + L.icon], alt: '' }), h('div', { class: 'grow' }, h('b', null, L.title), h('small', null, L.sub)),
        h('span', { class: 'ob-lv-bot' }, avatar(BOTS[L.bot].avatar, 34)))))),
      h('button', { class: 'btn ghost block ob-back', onclick: () => { obStep--; beep('back'); render(); } }, 'Back'));
  } else {
    const L = OB_LEVELS.find(x => profile.obChoice && x.id === profile.obChoice.level) || OB_LEVELS[0];
    const rows = OB_DOCK.map(([r, ic, name, d]) => h('div', { class: 'ob-dk', 'data-r': r }, h('span', { class: 'ob-dk-ic' }, icon(ic, 20)), h('div', { class: 'grow' }, h('b', null, name), h('small', null, d))));
    const cap = h('p', { class: 'ob-cap' });
    box.append(h('div', { class: 'ob-body' },
      h('div', { class: 'ob-hoot' }, typeof hootEl === 'function' ? hootEl('cheer', 76) : hoot(64)),
      h('h2', null, 'Your clubhouse'), h('p', { class: 'muted' }, 'Everything is one tap away in the dock at the bottom.'),
      h('div', { class: 'ob-dock' }, rows), cap,
      h('div', { class: 'ob-first' }, avatar(BOTS[L.bot].avatar, 36), h('small', null, L.lesson >= 0 ? `First up: lesson "${LESSONS[L.lesson].title}", then a game with ${BOTS[L.bot].name}.` : `First up: a game with ${BOTS[L.bot].name}, rated ${BOTS[L.bot].rating}.`))),
      h('button', { class: 'btn primary block ob-go', onclick: () => finish(false) }, "Let's go!"));
    // light up each dock button in turn, in step with its row
    let k = 0; const dockBtns = () => [...document.querySelectorAll('.tabs button')];
    const tick = () => { const r = OB_DOCK[k % OB_DOCK.length][0]; dockBtns().forEach(b => b.classList.toggle('ob-hi', b.dataset.r === r)); rows.forEach(x => x.classList.toggle('on', x.dataset.r === r)); cap.textContent = tr(OB_DOCK[k % OB_DOCK.length][3]); k++; };
    tick(); const iv = setInterval(tick, 1400);
    const stop = () => { clearInterval(iv); dockBtns().forEach(b => b.classList.remove('ob-hi')); };
    if (typeof cleanups !== 'undefined') cleanups.push(stop);
  }
  box.classList.add('ob-s' + obStep);
}
