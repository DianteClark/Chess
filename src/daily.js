// Daily login reward: a 7 day calendar. One claim per calendar day; missing a day starts the week over.
// Day 7 is a big chest that may unlock a random locked board, piece set or avatar (otherwise extra XP).
// State: profile.login = { last: 'YYYY-MM-DD', day: 1..7 (last day claimed), streak, best }, profile.gifts = [ids].
// Public globals: dailyRewardCard(), dailyRewardAvailable(), claimDailyReward(fromEl, onDone), applyLoginGifts(), loginState().
// Also here: Seasons (a free 30 day reward track fed by all XP) and the in-app Inbox (bell in the top bar).
'use strict';
const LOGIN_XP = [20, 30, 40, 50, 60, 80, 150];
const LOGIN_GIFT_CHANCE = 0.6, LOGIN_GIFT_FALLBACK_XP = 100;
function loginState() { profile.login = profile.login || { last: null, day: 0, streak: 0, best: 0 }; return profile.login; }
function loginDayKey(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailyRewardAvailable() { return loginState().last !== loginDayKey(0); }
// the day of the week-long calendar that is (or was) claimed today, and whether the streak holds
function loginToday() {
  const L = loginState();
  if (L.last === loginDayKey(0)) return { day: L.day || 1, streak: L.streak || 1, claimed: true };
  const keeps = L.last === loginDayKey(-1);
  return { day: keeps ? (L.day % 7) + 1 : 1, streak: keeps ? (L.streak || 0) + 1 : 1, claimed: false };
}
// gifted items lose their requirement, so reqMet() treats them as unlocked everywhere
function applyLoginGifts() {
  const g = profile.gifts || [];
  for (const t of allCosmetics()) if (g.includes(t.kind + ':' + t.id) || (g.includes(t.id) && ['board', 'pieces', 'avatar'].includes(t.kind))) if (t.req) t.req = null;
}
function loginLockedPool() {
  // season rewards stay on the season track; everything else can come out of the day 7 chest
  const tag = (list, kind) => list.filter(t => !reqMet(t.req) && !t.req.season).map(t => ({ t, kind }));
  return tag(BOARD_THEMES, 'board').concat(tag(PIECE_SETS, 'pieces'), tag(AVATAR_CHOICES, 'avatar'), tag(FRAMES, 'frame'), tag(BANNERS, 'banner'));
}
function giftArt(g) { return cosmeticArt(g.t, 72); }
// coin art for an XP reward (big = the day 7 chest)
function xpCoinSvg(size = 72) {
  return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="36" cy="39" r="30" fill="#a8741c"/><circle cx="36" cy="35" r="30" fill="#efbb4f"/><circle cx="36" cy="35" r="23" fill="#ffd977" stroke="#c48a22" stroke-width="2"/><path d="M36 20l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L36 43.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fff3c4" stroke="#b07a1a" stroke-width="2" stroke-linejoin="round"/><path d="M18 22a22 22 0 0 1 14-9" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6" fill="none"/></svg>`;
}
let loginClaiming = false;
// claim today's reward: chest reveal, then XP (and maybe an unlock); fromEl is where the XP flies from
function claimDailyReward(fromEl, onDone) {
  if (loginClaiming || !dailyRewardAvailable()) return;
  loginClaiming = true;
  const T = loginToday(), L = loginState();
  let xp = LOGIN_XP[T.day - 1], gift = null;
  if (T.day === 7) {
    const pool = loginLockedPool();
    if (pool.length && Math.random() < LOGIN_GIFT_CHANCE) gift = pool[Math.floor(Math.random() * pool.length)];
    else xp += LOGIN_GIFT_FALLBACK_XP;
  }
  // write the claim first so a second tap can never claim twice
  Object.assign(L, { last: loginDayKey(0), day: T.day, streak: T.streak, best: Math.max(L.best || 0, T.streak) });
  if (gift) { profile.gifts = (profile.gifts || []).concat(gift.t.kind + ':' + gift.t.id); applyLoginGifts(); inboxPush({ kind: 'unlock', title: `Unlocked: ${gift.t.name}`, sub: 'From the day 7 chest', to: 'style', item: gift.t.kind + ':' + gift.t.id }); }
  inboxMarkRead('chest');
  saveProfile();
  haptic(12); beep('open');
  const items = [{ label: `+${xp} XP`, sub: T.day === 7 ? 'Day 7 grand prize' : `Day ${T.day} reward`, art: xpCoinSvg(72) }];
  if (gift) items.push({ label: gift.t.name, sub: NEW_LABEL[gift.t.kind] || 'Unlocked', art: giftArt(gift) });
  const finish = () => {
    loginClaiming = false;
    grantXP(xp, 'Daily reward');
    checkAchievements(); saveProfile();
    if (onDone) onDone(xp, gift); else render();
    const ring = document.querySelector('.hm-ring') || document.querySelector('#rchip');
    const from = fromEl && fromEl.isConnected ? fromEl : document.querySelector('.hm-chest') || ring;
    if (typeof fxFloat === 'function') fxFloat(from, `+${xp} XP`, 'xp');
    if (typeof fxBurst === 'function') fxBurst(from, 'xp', { count: 10, to: ring });
    beep('xp');
  };
  if (typeof chestReveal === 'function') chestReveal({ title: T.day === 7 ? 'Grand prize!' : 'Daily reward!', items, onDone: finish });
  else finish();
}
// the 7 day calendar strip, with a claim button when today's reward is waiting
function dailyRewardCard(opts = {}) {
  const T = loginToday();
  const cells = LOGIN_XP.map((x, i) => {
    const d = i + 1, got = d < T.day || (T.claimed && d === T.day), now = !T.claimed && d === T.day, big = d === 7;
    return h('div', { class: 'lg-day' + (got ? ' got' : '') + (now ? ' now' : '') + (big ? ' big' : '') },
      h('small', null, `Day ${d}`),
      h('div', { class: 'lg-art', html: big ? miniChestSvg(now) : xpCoinSvg(26) }),
      h('b', null, got ? icon('check', 14) : `+${x}`));
  });
  const card = h('div', { class: 'card lg-card' },
    h('div', { class: 'lg-head' }, h('b', null, 'Daily reward'), T.streak > 1 || T.claimed ? h('span', { class: 'pill' }, icon('flame', 14), ` ${T.claimed ? T.streak : T.streak - 1} day streak`) : null),
    h('div', { class: 'lg-strip' }, cells),
    T.claimed
      ? h('div', { class: 'small muted center' }, T.day === 7 ? 'Week complete! A new week starts tomorrow.' : 'Come back tomorrow for the next reward.')
      : h('button', { class: 'btn primary block lg-claim', onclick: e => { if (opts.onClaim) opts.onClaim(); claimDailyReward(e.currentTarget, opts.onDone); } }, icon('gem', 18), T.day === 7 ? 'Open the grand chest' : `Claim +${LOGIN_XP[T.day - 1]} XP`),
    h('div', { class: 'small muted center' }, 'Miss a day and the week starts over. Day 7 can unlock a new board, piece set, avatar, frame or banner.'));
  return card;
}

// ======================= SEASONS =======================
// A season lasts 30 days. All XP you earn also fills the season track: 30 tiers, each with a free cosmetic
// (boards, piece sets, avatars, frames, titles, banners; never boosts). Season 1 is "The Opening".
// Tier rewards are earned once and kept; a later season's track gives anything you missed.
// State: profile.season = { id, xp, best (highest tier ever), history: [{id, xp, tier}], summary: {..} | null }
const SEASON_EPOCH = [2026, 10, 10], SEASON_DAYS = 30, SEASON_TIERS = 30;
const SEASON_NAMES = ['The Opening', 'The Middlegame', 'The Endgame', 'Gambit', 'Fianchetto', 'Zugzwang', 'Promotion', 'The Long Castle', 'En Passant', 'Checkmate'];
const seasonName = id => SEASON_NAMES[(id - 1) % SEASON_NAMES.length];
const seasonTierCost = t => t <= 10 ? 100 : t <= 20 ? 125 : 150;
function seasonInfo(now = new Date()) {
  const ep = new Date(SEASON_EPOCH[0], SEASON_EPOCH[1], SEASON_EPOCH[2]), day = 86400000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((today - ep) / day)), id = Math.floor(days / SEASON_DAYS) + 1;
  const start = new Date(ep.getFullYear(), ep.getMonth(), ep.getDate() + (id - 1) * SEASON_DAYS), end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + SEASON_DAYS);
  return { id, name: seasonName(id), start, end, daysLeft: Math.max(1, Math.round((end - today) / day)), dayOf: days - (id - 1) * SEASON_DAYS + 1 };
}
// tier reached with `xp` season XP, and progress into the next tier
function seasonTierOf(xp) {
  let t = 0, left = xp;
  while (t < SEASON_TIERS && left >= seasonTierCost(t + 1)) { left -= seasonTierCost(t + 1); t++; }
  return { tier: t, into: t >= SEASON_TIERS ? 0 : left, need: t >= SEASON_TIERS ? 0 : seasonTierCost(t + 1), max: t >= SEASON_TIERS };
}
function seasonState() {
  const cur = seasonInfo();
  const S = profile.season = profile.season || { id: cur.id, xp: 0, best: 0, history: [], summary: null };
  if (S.id !== cur.id) {
    // a new season: keep a record of the old one and show its summary once
    const old = { id: S.id, xp: S.xp, tier: seasonTierOf(S.xp).tier };
    S.history = (S.history || []).concat(old).slice(-12);
    if (S.xp > 0) S.summary = old;
    S.id = cur.id; S.xp = 0;
    saveProfile();
  }
  return S;
}
// the reward on a tier (one cosmetic per tier)
function seasonReward(tier) { return allCosmetics().find(t => t.req && t.req.season === tier) || null; }
function seasonGain(amount) {
  if (!amount || amount < 0) return;
  const S = seasonState(), before = seasonTierOf(S.xp).tier;
  S.xp += amount;
  const after = seasonTierOf(S.xp).tier;
  for (let t = before + 1; t <= after; t++) {
    const it = seasonReward(t);
    if (t > (S.best || 0) && it) queueReward({ kind: 'unlock', item: it, tier: t });
    else queueReward({ kind: 'seasonTier', tier: t });
  }
  S.best = Math.max(S.best || 0, after);
}
// tier shield: the number on a small banner
function seasonShield(tier, size = 46, cls = '') {
  return h('span', { class: 'ss-shield ' + cls, style: { width: size + 'px', height: Math.round(size * 1.12) + 'px' }, html: `<svg viewBox="0 0 40 45" width="100%" height="100%" aria-hidden="true"><path d="M3 4h34v22c0 9-8 14-17 18C11 40 3 35 3 26z" fill="#2c1a0c" opacity=".35" transform="translate(0 2)"/><path d="M3 3h34v22c0 9-8 14-17 18C11 39 3 34 3 25z" fill="url(#ssg)" stroke="#7a4f12" stroke-width="1.6"/><path d="M7 7h26v17c0 7-6 11-13 14C13 35 7 31 7 24z" fill="#5a2e1a" opacity=".9"/><defs><linearGradient id="ssg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe39a"/><stop offset="1" stop-color="#c88a26"/></linearGradient></defs></svg>` }, h('b', null, String(tier)));
}
// Home: the season at a glance
function seasonHomeCard() {
  const si = seasonInfo(), S = seasonState(), T = seasonTierOf(S.xp);
  const nextTier = Math.min(SEASON_TIERS, T.tier + 1), nx = T.max ? null : seasonReward(nextTier);
  return h('button', { class: 'hm-season', onclick: () => { haptic(8); beep('tap'); meView = 'season'; go('me'); }, 'aria-label': `Season ${si.id}: ${si.name}` },
    seasonShield(T.tier, 40),
    h('div', { class: 'hm-ss-mid' },
      h('div', { class: 'hm-ss-top' }, h('small', null, si.daysLeft === 1 ? `Season ${si.id} · last day` : `Season ${si.id} · ${si.daysLeft} days left`), h('b', null, si.name)),
      h('div', { class: 'hm-ss-bar' }, h('i', { style: { width: (T.max ? 100 : Math.round(T.into / T.need * 100)) + '%' } }), h('span', null, T.max ? 'Track complete!' : `${T.into} / ${T.need} XP`))),
    nx ? h('div', { class: 'hm-ss-next' + (reqMet(nx.req) ? ' owned' : '') }, h('span', { class: 'hm-ss-art' }, cosmeticArt(nx, 34)), h('small', null, `Tier ${nextTier}`)) : h('div', { class: 'hm-ss-next' }, icon('crown', 30)));
}
// Me > Season: the reward track
function renderSeason(panel) {
  const si = seasonInfo(), S = seasonState(), T = seasonTierOf(S.xp);
  const art = typeof roomArt === 'function' && ROOM_ART.season ? roomArt('season') : null;
  panel.append(h('div', { class: 'ss-hero' }, art,
    h('div', { class: 'ss-hero-lab' }, h('small', null, `Season ${si.id}`), h('h2', null, si.name), h('span', { class: 'ss-days' }, icon('clock', 13), si.daysLeft === 1 ? 'Last day' : `${si.daysLeft} days left`)),
    h('span', { class: 'ss-free' }, icon('gem', 13), 'Free for everyone')));
  // progress
  const owned = Array.from({ length: SEASON_TIERS }, (_, i) => seasonReward(i + 1)).filter(t => t && reqMet(t.req)).length;
  panel.append(h('div', { class: 'card ss-prog' },
    seasonShield(T.tier, 56, 'big'),
    h('div', { class: 'grow' },
      h('div', { class: 'ss-prog-h' }, h('b', null, T.max ? 'Track complete!' : `Tier ${T.tier} of ${SEASON_TIERS}`), h('span', { class: 'pill' }, `${owned} / ${SEASON_TIERS} rewards`)),
      h('div', { class: 'qbar ss-bar' }, h('div', { style: { width: (T.max ? 100 : Math.round(T.into / T.need * 100)) + '%' } })),
      h('small', { class: 'muted' }, T.max ? `${S.xp} season XP. You earned everything this season.` : `${T.need - T.into} XP to tier ${T.tier + 1} · ${S.xp} season XP`))));
  // the track
  const track = h('div', { class: 'ss-track', role: 'list' });
  for (let t = 1; t <= SEASON_TIERS; t++) {
    const it = seasonReward(t), reached = T.tier >= t, has = it && reqMet(it.req), isNext = t === T.tier + 1;
    const cell = h('button', { class: 'ss-tier' + (reached ? ' reached' : '') + (has ? ' has' : '') + (isNext ? ' next' : '') + (t % 10 === 0 ? ' big' : ''), role: 'listitem', onclick: () => seasonTierSheet(t) },
      h('span', { class: 'ss-tn' }, String(t)),
      h('div', { class: 'ss-tart' }, it ? cosmeticArt(it, 50) : icon('star', 30), has ? null : h('span', { class: 'lock' }, icon('key', 12))),
      h('b', null, it ? it.name : `Tier ${t}`), h('small', null, it ? KIND_LABEL[it.kind] : ''),
      has ? h('span', { class: 'ss-ok' }, icon('check', 13)) : null);
    track.append(cell);
  }
  panel.append(h('section', { class: 'sty-sec' }, h('div', { class: 'sty-head' }, h('h3', null, 'Reward track'), h('small', { class: 'muted' }, 'Swipe to see every tier')), track));
  requestAnimationFrame(() => { const n = track.querySelector('.next') || track.lastElementChild; if (n) track.scrollLeft = Math.max(0, n.offsetLeft - track.clientWidth / 2 + n.offsetWidth / 2); });
  // how to earn
  const how = [['play', 'Play games', 'Every game earns XP, wins earn more'], ['puzzle', 'Solve puzzles', 'Rated puzzles, Rush and the Daily Puzzle'], ['check', 'Finish quests', 'Three new quests every day, plus a bonus'], ['learn', 'Take lessons', 'Every first finish counts'], ['gem', 'Claim the daily chest', 'Grows all week long'], ['trophy', 'Earn trophies', 'Each trophy gives XP too']];
  panel.append(h('div', { class: 'card ss-how' }, h('div', { class: 'ins-h' }, h('b', null, 'How to climb')), h('p', { class: 'small muted', style: { margin: '0 0 6px' } }, 'All the XP you earn counts toward the season. No passes, no purchases.'),
    h('div', { class: 'ss-how-grid' }, how.map(([ic, t, d]) => h('div', { class: 'ss-how-i' }, h('span', { class: 'ss-how-ic' }, icon(ic, 18)), h('div', null, h('b', null, t), h('small', null, d)))))));
  const past = (S.history || []).slice().reverse();
  if (past.length) panel.append(h('div', { class: 'card ss-past' }, h('div', { class: 'ins-h' }, h('b', null, 'Past seasons')),
    past.map(p => h('div', { class: 'ss-past-r' }, seasonShield(p.tier, 30), h('div', { class: 'grow' }, h('b', null, `Season ${p.id}: ${seasonName(p.id)}`), h('small', null, `Tier ${p.tier} · ${p.xp} XP`))))));
}
function seasonTierSheet(t) {
  const it = seasonReward(t), S = seasonState(), T = seasonTierOf(S.xp), has = it && reqMet(it.req);
  beep('open');
  modal((box, close) => box.append(
    h('div', { class: 'ss-sheet' + (has ? ' got' : '') }, h('div', { class: 'tc-rays' }), h('div', { class: 'ss-sheet-art' }, it ? cosmeticArt(it, 96) : icon('star', 60))),
    h('div', { class: 'center' }, h('span', { class: 'tc-tier t3' }, `Season tier ${t}`)),
    h('h2', { class: 'center', style: { marginTop: '8px' } }, it ? it.name : `Tier ${t}`),
    h('p', { class: 'center muted', style: { margin: '4px 0 12px' } }, it ? KIND_LABEL[it.kind] : ''),
    has ? h('p', { class: 'center small tc-earned' }, icon('check', 16), 'Yours to keep. Wear it in Me > Style.')
      : h('div', { class: 'tc-progress' }, h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(Math.min(1, S.xp / seasonXpFor(t)) * 100) + '%' } })), h('div', { class: 'small muted center' }, `${Math.min(S.xp, seasonXpFor(t))} / ${seasonXpFor(t)} season XP`)),
    has && it ? h('button', { class: 'btn block', style: { marginTop: '12px' }, onclick: () => { close(); meView = 'style'; go('me'); } }, icon('palette', 18), 'Open Style') : null,
    h('button', { class: 'btn primary block', style: { marginTop: '10px' }, onclick: () => { beep('close'); close(); } }, 'OK')));
}
const seasonXpFor = t => { let x = 0; for (let k = 1; k <= t; k++) x += seasonTierCost(k); return x; };
// shown once on Home after a season ends
function seasonSummaryCheck() {
  const S = seasonState(); if (!S.summary || (typeof focusOn !== 'undefined' && focusOn) || document.querySelector('.modal-bg,.kx-chest-ov,.kx-res')) return;
  const p = S.summary; S.summary = null; saveProfile();
  const si = seasonInfo(), got = Array.from({ length: p.tier }, (_, i) => seasonReward(i + 1)).filter(Boolean);
  beep('open');
  modal((box, close) => box.append(
    h('div', { class: 'ss-sum-top' }, seasonShield(p.tier, 76, 'big')),
    h('h2', { class: 'center' }, `Season ${p.id} is over!`), h('p', { class: 'center muted small', style: { margin: '0 0 10px' } }, seasonName(p.id)),
    h('div', { class: 'me-sh-stats' }, h('div', null, h('b', null, String(p.tier)), h('small', null, 'Tier reached')), h('div', null, h('b', null, String(p.xp)), h('small', null, 'Season XP')), h('div', null, h('b', null, String(got.length)), h('small', null, 'Rewards'))),
    got.length ? h('div', { class: 'ss-sum-items' }, got.slice(-8).map(t => h('span', { class: 'ss-sum-it' }, cosmeticArt(t, 36)))) : null,
    h('p', { class: 'center small', style: { margin: '12px 0' } }, `Season ${si.id}: ${si.name} starts now. Fresh track, same rules: everything is free.`),
    h('button', { class: 'btn primary block', onclick: () => { close(); confetti(); meView = 'season'; go('me'); } }, 'See the new season')));
}

// ======================= INBOX =======================
// In-app notifications only: unlocks, new trophies, season tiers, level ups and the daily chest.
// State: profile.inbox = { items: [{ id, t, kind, title, sub, to, read }], chestDay }
function inboxState() { profile.inbox = profile.inbox || { items: [], chestDay: null }; return profile.inbox; }
function inboxPush(o) {
  const I = inboxState();
  I.items.unshift(Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), read: false }, o));
  I.items = I.items.slice(0, 40);
  inboxRefresh();
}
function inboxFromReward(r) {
  if (r.kind === 'unlock' || r.kind === 'avatar') inboxPush({ kind: 'unlock', title: `Unlocked: ${r.item.name}`, sub: r.tier ? `Season tier ${r.tier} reward` : NEW_LABEL[r.item.kind] || 'New avatar', to: 'style', item: (r.item.kind || 'avatar') + ':' + r.item.id });
  else if (r.kind === 'ach') inboxPush({ kind: 'ach', title: `New trophy: ${r.a.name}`, sub: r.a.desc, to: 'trophies', ach: r.a.id, tier: r.a.tier });
  else if (r.kind === 'level') inboxPush({ kind: 'level', title: `Level ${r.lvl} reached`, sub: levelTitleAt(r.lvl), to: 'me', lvl: r.lvl });
  else if (r.kind === 'seasonTier') inboxPush({ kind: 'season', title: `Season tier ${r.tier} reached`, sub: seasonName(seasonInfo().id), to: 'season', tier: r.tier });
}
function inboxDailyCheck() {
  const I = inboxState(), day = loginDayKey(0);
  if (I.chestDay !== day && dailyRewardAvailable()) { I.chestDay = day; inboxPush({ kind: 'chest', title: 'Your daily chest is ready', sub: `Day ${loginToday().day} of 7`, to: 'chest' }); saveProfile(); }
}
function inboxMarkRead(kind) { const I = inboxState(); I.items.forEach(x => { if (!kind || x.kind === kind) x.read = true; }); inboxRefresh(); }
const inboxUnread = () => inboxState().items.filter(x => !x.read).length;
function inboxRefresh() {
  const n = inboxUnread();
  document.querySelectorAll('.ib-btn').forEach(b => {
    const c = b.querySelector('.ib-n'); c.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('has', n > 0);
    b.setAttribute('aria-label', n ? `Inbox, ${n} new` : 'Inbox');
  });
}
const BELL_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" fill="currentColor" fill-opacity=".18"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>';
// the bell for the top bar: place it between the logo and the rating chip
function inboxButton() {
  inboxDailyCheck();
  const b = h('button', { class: 'ib-btn', 'aria-label': 'Inbox', onclick: () => { haptic(6); inboxSheet(); } }, h('span', { class: 'ib-bell', html: BELL_SVG }), h('span', { class: 'ib-n' }, '0'));
  setTimeout(inboxRefresh, 0);
  return b;
}
function inboxAgo(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'Just now'; if (m < 60) return `${m} min ago`;
  const hr = Math.floor(m / 60); if (hr < 24) return `${hr} h ago`;
  const d = Math.floor(hr / 24); return d === 1 ? 'Yesterday' : `${d} days ago`;
}
function inboxArt(x) {
  if (x.kind === 'unlock' && x.item) { const [k, id] = x.item.split(':'), t = allCosmetics().find(c => c.kind === k && c.id === id); if (t) return cosmeticArt(t, 34); }
  if (x.kind === 'ach') { const a = ACHIEVEMENTS.find(z => z.id === x.ach); if (a) return medalEl(a); }
  if (x.kind === 'season') return seasonShield(x.tier || 1, 30);
  if (x.kind === 'level') return h('span', { class: 'ib-lv' }, String(x.lvl || ''));
  if (x.kind === 'chest') return h('span', { class: 'ib-chest', html: miniChestSvg(true) });
  return icon('sparkle', 20);
}
function inboxOpen(x) {
  if (x.to === 'chest') { go('home'); setTimeout(() => { if (dailyRewardAvailable()) claimDailyReward(document.querySelector('.hm-chest')); }, 350); return; }
  if (x.to === 'trophies') { meView = 'trophies'; go('me'); const a = ACHIEVEMENTS.find(z => z.id === x.ach); if (a) setTimeout(() => trophySheet(a), 300); return; }
  meView = x.to === 'me' ? null : x.to; go('me');
}
function inboxSheet() {
  inboxDailyCheck();
  const I = inboxState(); beep('open');
  modal((box, close) => {
    const list = h('div', { class: 'ib-list' }, I.items.length ? I.items.map(x => h('button', { class: 'ib-row' + (x.read ? '' : ' new'), onclick: () => { close(); beep('tap'); inboxOpen(x); } },
      h('span', { class: 'ib-art' }, inboxArt(x)), h('div', { class: 'grow' }, h('b', null, x.title), h('small', null, x.sub || '')), h('span', { class: 'ib-t' }, inboxAgo(x.t))))
      : h('div', { class: 'ib-empty' }, typeof hootEl === 'function' ? hootEl('idle', 64) : hoot(56), h('b', null, 'All caught up'), h('small', { class: 'muted' }, 'Unlocks, trophies, season tiers and your daily chest show up here.')));
    box.classList.add('ib-modal');
    box.append(h('div', { class: 'ib-head' }, h('h2', null, 'Inbox'), I.items.length ? h('button', { class: 'btn sm ghost', onclick: () => { I.items = []; saveProfile(); inboxRefresh(); close(); inboxSheet(); } }, 'Clear') : null), list,
      h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => { beep('close'); close(); } }, 'Close'));
  });
  // opening the inbox reads everything in it
  I.items.forEach(x => { x.read = true; }); saveProfile(); inboxRefresh();
}
