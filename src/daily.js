// Daily login reward: a 7 day calendar. One claim per calendar day; missing a day starts the week over.
// Day 7 is a big chest that may unlock a random locked board, piece set or avatar (otherwise extra XP).
// State: profile.login = { last: 'YYYY-MM-DD', day: 1..7 (last day claimed), streak, best }, profile.gifts = [ids].
// Public globals: dailyRewardCard(), dailyRewardAvailable(), claimDailyReward(fromEl, onDone), applyLoginGifts(), loginState().
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
  for (const t of BOARD_THEMES.concat(PIECE_SETS, AVATAR_CHOICES)) if (g.includes(t.id) && t.req) t.req = null;
}
function loginLockedPool() {
  const tag = (list, kind) => list.filter(t => !reqMet(t.req)).map(t => ({ t, kind }));
  return tag(BOARD_THEMES, 'board').concat(tag(PIECE_SETS, 'pieces'), tag(AVATAR_CHOICES, 'avatar'));
}
function giftArt(g) {
  const t = g.t;
  if (g.kind === 'avatar') return avatar(t.id, 72);
  if (g.kind === 'board') return `<svg viewBox="0 0 4 4" width="72" height="72">${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(f => `<rect x="${f}" y="${r}" width="1" height="1" fill="${(r + f) % 2 ? t.dark : t.light}"/>`).join('')).join('')}</svg>`;
  return h('img', { src: buildPieceSet(t, {}).wn, width: 72, height: 72, alt: '' });
}
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
  if (gift) { profile.gifts = (profile.gifts || []).concat(gift.t.id); applyLoginGifts(); }
  saveProfile();
  haptic(12); beep('open');
  const items = [{ label: `+${xp} XP`, sub: T.day === 7 ? 'Day 7 grand prize' : `Day ${T.day} reward`, art: xpCoinSvg(72) }];
  if (gift) items.push({ label: gift.t.name, sub: gift.kind === 'avatar' ? 'New avatar' : gift.kind === 'board' ? 'New board' : 'New piece set', art: giftArt(gift) });
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
    h('div', { class: 'small muted center' }, 'Miss a day and the week starts over. Day 7 can unlock a new board, piece set or avatar.'));
  return card;
}
