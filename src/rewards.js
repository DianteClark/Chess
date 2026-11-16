// Rewards: XP and levels, achievements, and unlockable board themes, piece sets and avatars.
'use strict';

// ---------- XP & levels ----------
// a new rank title every few levels; the last one is the top of the club
const LEVEL_TITLES = [[1, 'Newcomer'], [3, 'Apprentice'], [5, 'Pawn Pusher'], [7, 'Board Explorer'], [9, 'Square Scout'], [11, 'Fork Finder'], [13, 'Pin Master'], [15, 'Tactician'],
  [18, 'Strategist'], [21, 'Endgame Artist'], [24, 'Club Champion'], [28, 'Grand Thinker'], [32, 'Legend'], [40, 'Grandmaster of the Club']];
const xpForLevel = lvl => 100 + (lvl - 1) * 60; // XP needed to go from lvl to lvl+1
function levelTitleAt(lvl) { let t = LEVEL_TITLES[0][1]; for (const [m, n] of LEVEL_TITLES) if (lvl >= m) t = n; return t; }
function levelInfo(xp) {
  let lvl = 1, left = xp;
  while (left >= xpForLevel(lvl)) { left -= xpForLevel(lvl); lvl++; }
  const nt = LEVEL_TITLES.find(([m]) => m > lvl);
  return { lvl, into: left, need: xpForLevel(lvl), title: levelTitleAt(lvl), nextTitle: nt ? { lvl: nt[0], name: nt[1] } : null };
}
function stats() { profile.stats = profile.stats || {}; return profile.stats; }
function inc(k, n = 1) { const s = stats(); s[k] = (s[k] || 0) + n; return s[k]; }

// ---------- unlockables ----------
// Everything here is cosmetic and free: earned by playing (levels, trophies, bots beaten, season tiers).
// req: null (free) | {level} | {ach} | {beat} | {season: tier}
// board themes: light, dark, last-move highlight
const BOARD_THEMES = [
  { id: 'wood', name: 'Club Walnut', light: '#ecd9b4', dark: '#a9744a', req: null },
  { id: 'felt', name: 'Tournament', light: '#eeeed2', dark: '#6f9a63', req: null },
  { id: 'meadow', name: 'Meadow', light: '#eef0d8', dark: '#7d9a5c', req: { level: 2 } },
  { id: 'ocean', name: 'Ocean', light: '#dfeaf2', dark: '#5f87a8', req: { level: 3 } },
  { id: 'rose', name: 'Rose Garden', light: '#f6e4e4', dark: '#c27d8a', req: { ach: 'lessons5' } },
  { id: 'slate', name: 'Slate', light: '#d6d9df', dark: '#6b7383', req: { level: 5 } },
  { id: 'candy', name: 'Candy', light: '#fde9f3', dark: '#9b7fd8', req: { ach: 'puzzles25' } },
  { id: 'sand', name: 'Desert Sand', light: '#f5e7c9', dark: '#d19a52', req: { ach: 'daily3' } },
  { id: 'forest', name: 'Deep Forest', light: '#d9e4cf', dark: '#3f6b4a', req: { ach: 'league_bishop' } },
  { id: 'marble', name: 'Marble', light: '#f2f2ef', dark: '#a7a7a2', req: { level: 8 } },
  { id: 'ember', name: 'Ember', light: '#f6dcc4', dark: '#b4553a', req: { ach: 'rush20' } },
  { id: 'midnight', name: 'Midnight', light: '#8a97b8', dark: '#3b4466', req: { ach: 'league_rook' } },
  { id: 'royal', name: 'Royal Gold', light: '#f7ebc5', dark: '#8d6a2b', req: { ach: 'beat_tower' } },
  { id: 'mint', name: 'Mint Tea', light: '#e4f3e8', dark: '#5fa58a', req: { ach: 'review1' } },
  { id: 'atlas', name: 'Atlas', light: '#efe3c8', dark: '#4f7d8f', req: { ach: 'world3' } },
  { id: 'dusk', name: 'Dusk', light: '#f1d9c6', dark: '#6d5a8c', req: { ach: 'nightowl' } },
  { id: 's_harvest', name: 'Harvest Moon', light: '#f6e2c2', dark: '#c27a3e', req: { season: 4 } },
  { id: 's_frost', name: 'First Frost', light: '#eef5fb', dark: '#7fa6c9', req: { season: 12 } },
  { id: 's_lagoon', name: 'Lagoon', light: '#e3f4ef', dark: '#3f9a8f', req: { season: 20 } },
  { id: 's_night', name: 'Opening Night', light: '#e9dcc0', dark: '#4a3f6b', req: { season: 27 } },
];
// piece sets: colors, outline weight and an optional gradient sheen
const PIECE_SETS = [
  { id: 'club', name: 'Club', w: ['#fffaf0', '#3a2a1a'], b: ['#4a404a', '#f3e6cc'], sw: 1.5, grad: true, shine: true, req: null },
  { id: 'classic', name: 'Classic', w: ['#fffdf6', '#272320'], b: ['#2b2730', '#f4ecdc'], sw: 1.6, req: null },
  { id: 'bold', name: 'Bold', w: ['#ffffff', '#111111'], b: ['#111111', '#ffffff'], sw: 2.4, req: { level: 2 } },
  { id: 'ivory', name: 'Ivory & Ebony', w: ['#f6ecd6', '#6d5332'], b: ['#3a2a1e', '#e8d4ae'], sw: 1.6, grad: true, req: { level: 4 } },
  { id: 'sky', name: 'Sky & Storm', w: ['#e3f1ff', '#2b5d8f'], b: ['#2a3550', '#9cc6ff'], sw: 1.7, req: { ach: 'puzzles10' } },
  { id: 'coral', name: 'Coral Reef', w: ['#fff1ea', '#c2533a'], b: ['#1f4f5c', '#9ee3e0'], sw: 1.7, req: { ach: 'win_mate10' } },
  { id: 'gilded', name: 'Gilded', w: ['#ffe9a8', '#8a5a12'], b: ['#5d6470', '#e9edf3'], sw: 1.6, grad: true, req: { ach: 'league_queen' } },
  { id: 'jade', name: 'Jade', w: ['#e6f6ea', '#2f7a4f'], b: ['#5a2f2f', '#f2c9a0'], sw: 1.7, req: { ach: 'daily7' } },
  { id: 'neon', name: 'Neon', w: ['#1b1f2e', '#5ef2c2'], b: ['#1b1f2e', '#ff6fb5'], sw: 2.2, req: { level: 10 } },
  { id: 'scholar', name: 'Scholar', w: ['#fbf4e3', '#7a4a2b'], b: ['#24493b', '#efbb4f'], sw: 1.7, grad: true, req: { ach: 'review10' } },
  { id: 's_copper', name: 'Copper', w: ['#ffd8b0', '#7a3d18'], b: ['#5a2e1a', '#f0b080'], sw: 1.6, grad: true, req: { season: 8 } },
  { id: 's_frostbite', name: 'Frostbite', w: ['#f4fbff', '#3f6f9a'], b: ['#2e4a6a', '#cfe8ff'], sw: 1.7, grad: true, shine: true, req: { season: 17 } },
  { id: 's_opal', name: 'Opal', w: ['#fff4fb', '#8a5aa8'], b: ['#3a2a4a', '#ffd0ea'], sw: 1.7, grad: true, shine: true, req: { season: 24 } },
];
const AVATAR_CHOICES = [
  { id: 'you', name: 'Player', req: null }, { id: 'friend', name: 'Pal', req: null },
  { id: 'pip', name: 'Pip', req: { beat: 1 } }, { id: 'bea', name: 'Bea', req: { beat: 2 } }, { id: 'milo', name: 'Milo', req: { beat: 3 } }, { id: 'rosa', name: 'Rosa', req: { beat: 4 } },
  { id: 'knight', name: 'Sir Knight', req: { beat: 5 } }, { id: 'bo', name: 'Bishop Bo', req: { beat: 6 } }, { id: 'vera', name: 'Queen Vera', req: { beat: 7 } }, { id: 'tower', name: 'The Tower', req: { beat: 8 } },
  { id: 'acorn', name: 'Sir Acorn', req: { season: 5 } }, { id: 'luma', name: 'Luma', req: { season: 15 } }, { id: 'leo', name: 'Leo the Lion', req: { season: 30 } },
];
// season portraits, drawn like the others in icons.js (64x64, same studio lighting)
(function addSeasonAvatars() {
  if (typeof AVATAR_SVG === 'undefined') return;
  const mane = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<circle cx="${(32 + Math.cos(a) * 17).toFixed(1)}" cy="${(36 + Math.sin(a) * 17).toFixed(1)}" r="7" fill="${i % 2 ? '#c4651f' : '#d9822b'}"/>`; }).join('');
  Object.assign(AVATAR_SVG, {
    acorn: `<circle cx="32" cy="32" r="32" fill="#3b6b46"/><ellipse cx="32" cy="40" rx="15" ry="16" fill="#d0924f"/><ellipse cx="27" cy="44" rx="6" ry="8" fill="#e2aa6a" opacity=".6"/><path d="M15 32c0-10 7-15 17-15s17 5 17 15c-5 2.5-11 3.5-17 3.5S20 34.5 15 32z" fill="#7a4a2b"/><path d="M18 29h28M21 24h22" stroke="#5a3219" stroke-width="1.6" opacity=".6"/><path d="M32 17c0-4 2-7 6-8" stroke="#5a3219" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M38 9c4-1 7 1 8 4-4 1-7 0-8-4z" fill="#7cc46f"/><circle cx="27" cy="40" r="2.5" fill="#2b2320"/><circle cx="37" cy="40" r="2.5" fill="#2b2320"/><circle cx="27.8" cy="39.2" r=".85" fill="#fff"/><circle cx="37.8" cy="39.2" r=".85" fill="#fff"/><path d="M29 46q3 2.6 6 0" stroke="#7a2e26" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="22.5" cy="45" r="2.3" fill="#ff8a78" opacity=".45"/><circle cx="41.5" cy="45" r="2.3" fill="#ff8a78" opacity=".45"/>`,
    luma: `<circle cx="32" cy="32" r="32" fill="#1f2a5a"/><circle cx="32" cy="34" r="22" fill="#ffd977" opacity=".16"/><circle cx="12" cy="14" r="1.2" fill="#fff" opacity=".8"/><circle cx="52" cy="12" r="1" fill="#fff" opacity=".7"/><circle cx="55" cy="48" r="1.1" fill="#fff" opacity=".6"/><path d="M30 31C21 13 7 17 9 30s14 11 21 5z" fill="#c9b6ff"/><path d="M34 31c9-18 23-14 21-1s-14 11-21 5z" fill="#c9b6ff"/><path d="M30 37c-8 2-15 8-11 15s11-4 11-11zM34 37c8 2 15 8 11 15s-11-4-11-11z" fill="#9c86e8"/><circle cx="17" cy="27" r="3.4" fill="#ffd977"/><circle cx="47" cy="27" r="3.4" fill="#ffd977"/><circle cx="17" cy="27" r="1.4" fill="#e89b2a"/><circle cx="47" cy="27" r="1.4" fill="#e89b2a"/><ellipse cx="32" cy="37" rx="4.8" ry="12" fill="#f2e6c9"/><path d="M28 41h8M28.5 45h7" stroke="#d9c8a0" stroke-width="1.2"/><circle cx="30.2" cy="30.5" r="1.4" fill="#2b2320"/><circle cx="33.8" cy="30.5" r="1.4" fill="#2b2320"/><path d="M30 26c-2-4-4-7-8-7M34 26c2-4 4-7 8-7" stroke="#f2e6c9" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="22" cy="19" r="1.6" fill="#ffd977"/><circle cx="42" cy="19" r="1.6" fill="#ffd977"/>`,
    leo: `<circle cx="32" cy="32" r="32" fill="#7a3422"/>${mane}<circle cx="32" cy="36" r="17" fill="#d9822b"/><circle cx="32" cy="37" r="13" fill="#f5c45a"/><circle cx="21" cy="26" r="3.5" fill="#f5c45a"/><circle cx="43" cy="26" r="3.5" fill="#f5c45a"/><circle cx="27" cy="35" r="2.3" fill="#2b2320"/><circle cx="37" cy="35" r="2.3" fill="#2b2320"/><circle cx="27.7" cy="34.3" r=".8" fill="#fff"/><circle cx="37.7" cy="34.3" r=".8" fill="#fff"/><path d="M29.5 40h5l-2.5 3z" fill="#5a2e1a"/><path d="M32 43v2M28 46q4 2.5 8 0" stroke="#5a2e1a" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="32" cy="46" rx="6" ry="3.5" fill="#fff3d6" opacity=".55"/><path d="M22 19l3.5-9 4.2 5.4L32 8l2.3 7.4 4.2-5.4 3.5 9z" fill="#ffe08a" stroke="#b07a1a" stroke-width="1.4" stroke-linejoin="round"/><circle cx="32" cy="16" r="1.6" fill="#e2483d"/>`,
  });
  for (const k of ['acorn', 'luma', 'leo']) AVATAR_URL[k] = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${AVATAR_LIGHT}<g clip-path="url(#cc)">${AVATAR_SVG[k]}<circle cx="32" cy="32" r="32" fill="url(#vg)"/><circle cx="32" cy="32" r="32" fill="url(#kl)"/></g></svg>`);
})();
// avatar frames: rings around your portrait (look in 50-me.css, .pf-<id>)
const FRAMES = [
  { id: 'none', name: 'No frame', req: null }, { id: 'brass', name: 'Brass', req: null },
  { id: 'oak', name: 'Oak', req: { level: 3 } }, { id: 'silver', name: 'Silver', req: { ach: 'win25' } },
  { id: 'sapphire', name: 'Sapphire', req: { ach: 'league_rook' } }, { id: 'emerald', name: 'Emerald', req: { ach: 'puzzles100' } },
  { id: 'ruby', name: 'Ruby', req: { ach: 'daily30' } }, { id: 'gold', name: 'Gold', req: { level: 10 } }, { id: 'prism', name: 'Prism', req: { level: 20 } },
  { id: 'sprout', name: 'Sprout', req: { season: 2 } }, { id: 'copper', name: 'Copper Ring', req: { season: 6 } }, { id: 'ivy', name: 'Ivy', req: { season: 10 } },
  { id: 'frost', name: 'Frost', req: { season: 14 } }, { id: 'starlight', name: 'Starlight', req: { season: 19 } }, { id: 'ember', name: 'Ember', req: { season: 23 } },
  { id: 'laurel', name: 'Laurel', req: { season: 26 } }, { id: 'crown', name: 'Opening Crown', req: { season: 29 } },
];
// titles shown under your name; 'rank' shows your level title
const TITLES = [
  { id: 'rank', name: 'Your rank', req: null }, { id: 'member', name: 'Club Member', req: null },
  { id: 'puzzler', name: 'Puzzle Hunter', req: { ach: 'puzzles25' } }, { id: 'slayer', name: 'Bot Slayer', req: { ach: 'beat4' } },
  { id: 'comeback', name: 'Comeback Kid', req: { ach: 'comeback' } }, { id: 'speed', name: 'Speed Demon', req: { ach: 'bullet' } },
  { id: 'owl', name: 'Night Owl', req: { ach: 'nightowl' } }, { id: 'traveler', name: 'World Traveler', req: { ach: 'world3' } },
  { id: 'scholar', name: 'Scholar', req: { ach: 'lessonsAll' } }, { id: 'brilliant', name: 'Brilliant Mind', req: { ach: 'brilliant' } },
  { id: 'sharp', name: 'Sharpshooter', req: { ach: 'accuracy90' } }, { id: 'regular', name: 'Clubhouse Regular', req: { ach: 'login30' } },
  { id: 'opening_act', name: 'Opening Act', req: { season: 1 } }, { id: 'center', name: 'Center Holder', req: { season: 7 } },
  { id: 'developer', name: 'Quick Developer', req: { season: 11 } }, { id: 'gambiteer', name: 'Gambiteer', req: { season: 16 } },
  { id: 'bookworm', name: 'Book Worm', req: { season: 21 } }, { id: 'tempo', name: 'Master of Tempo', req: { season: 25 } },
  { id: 'champion', name: 'Season Champion', req: { season: 28 } },
];
// banner colors for your plaque and player card: [top, bottom, edge]
const BANNERS = [
  { id: 'walnut', name: 'Walnut', c: ['#8a5532', '#6a3d22', '#3a2010'], req: null }, { id: 'felt', name: 'Club Green', c: ['#2f7a5c', '#1b4434', '#0e2a20'], req: null },
  { id: 'burgundy', name: 'Burgundy', c: ['#a33a4e', '#6c1f33', '#3a0f1a'], req: null }, { id: 'navy', name: 'Navy', c: ['#3a5a96', '#1f3260', '#101a38'], req: { level: 4 } },
  { id: 'plum', name: 'Plum', c: ['#74519f', '#43306e', '#22173d'], req: { level: 6 } }, { id: 'slate', name: 'Slate', c: ['#647083', '#3b4352', '#1f242e'], req: { level: 8 } },
  { id: 'harvest', name: 'Harvest', c: ['#d07f35', '#8a4a1a', '#4a240b'], req: { season: 3 } }, { id: 'twilight', name: 'Twilight', c: ['#93579f', '#4a2a6a', '#24123a'], req: { season: 9 } },
  { id: 'lagoon', name: 'Lagoon', c: ['#2fa094', '#1a6a63', '#0b3a36'], req: { season: 13 } }, { id: 'rosewood', name: 'Rosewood', c: ['#bb5a70', '#7a2e42', '#3e1520'], req: { season: 18 } },
  { id: 'aurora', name: 'Aurora', c: ['#3fae80', '#2a5a8a', '#14284a'], req: { season: 22 } },
];
BOARD_THEMES.forEach(t => t.kind = 'board'); PIECE_SETS.forEach(t => t.kind = 'pieces'); AVATAR_CHOICES.forEach(t => t.kind = 'avatar');
FRAMES.forEach(t => t.kind = 'frame'); TITLES.forEach(t => t.kind = 'title'); BANNERS.forEach(t => t.kind = 'banner');
const allCosmetics = () => [].concat(BOARD_THEMES, PIECE_SETS, AVATAR_CHOICES, FRAMES, TITLES, BANNERS);
const NEW_LABEL = { board: 'New board', pieces: 'New piece set', avatar: 'New avatar', frame: 'New avatar frame', title: 'New title', banner: 'New banner' };
const KIND_LABEL = { board: 'Board', pieces: 'Piece set', avatar: 'Avatar', frame: 'Avatar frame', title: 'Title', banner: 'Banner' };

// ---------- achievements ----------
// tier: 1 bronze, 2 silver, 3 gold. test(s, p) runs against stats + profile.
const rushTop = p => Math.max(0, ...Object.values(p.rushBest || {}));
const lessonStarsTotal = p => LESSONS.reduce((a, l) => a + ((p.lessonStars || {})[l.id] || (p.lessons[l.id] ? 1 : 0)), 0);
const totalGames = s => (s.botGames || 0) + (s.onlineGames || 0) + (s.localGames || 0) + (s.worldGames || 0);
const seasonBestTier = p => (p.season && p.season.best) || 0;
const ACHIEVEMENTS = [
  // lessons
  { id: 'lesson1', name: 'First Steps', desc: 'Finish your first lesson.', icon: 'learn', tier: 1, test: (s, p) => Object.keys(p.lessons).length >= 1 },
  { id: 'lessons5', name: 'Eager Student', desc: 'Finish 5 lessons.', icon: 'book', tier: 1, test: (s, p) => Object.keys(p.lessons).length >= 5 },
  { id: 'lessons20', name: 'Bookworm', desc: 'Finish 20 lessons, courses included.', icon: 'book', tier: 2, test: (s, p) => Object.keys(p.lessons).length >= 20 },
  { id: 'lessonsAll', name: 'Graduate', desc: 'Finish every beginner lesson.', icon: 'learn', tier: 2, test: (s, p) => LESSONS.every(l => p.lessons[l.id]) },
  { id: 'stars10', name: 'Star Pupil', desc: 'Earn 10 lesson stars.', icon: 'star', tier: 1, test: (s, p) => lessonStarsTotal(p) >= 10 },
  { id: 'stars30', name: 'Star Collector', desc: 'Earn 30 lesson stars.', icon: 'star', tier: 2, test: (s, p) => lessonStarsTotal(p) >= 30 },
  { id: 'starsAll', name: 'Perfect Student', desc: 'Earn 3 stars on every beginner lesson.', icon: 'crown', tier: 3, test: (s, p) => LESSONS.every(l => ((p.lessonStars || {})[l.id] || 0) >= 3) },
  { id: 'course1', name: 'Course Complete', desc: 'Finish a whole course.', icon: 'medal', tier: 2, test: s => (s.coursesDone || 0) >= 1 },
  { id: 'course3', name: 'Lifelong Learner', desc: 'Finish 3 courses.', icon: 'medal', tier: 3, test: s => (s.coursesDone || 0) >= 3 },
  // bot games
  { id: 'win1', name: 'First Victory', desc: 'Win a game against a bot.', icon: 'trophy', tier: 1, test: s => (s.wins || 0) >= 1 },
  { id: 'win5', name: 'Getting the Hang', desc: 'Win 5 games against bots.', icon: 'trophy', tier: 1, test: s => (s.wins || 0) >= 5 },
  { id: 'win25', name: 'Seasoned', desc: 'Win 25 games against bots.', icon: 'trophy', tier: 2, test: s => (s.wins || 0) >= 25 },
  { id: 'win100', name: 'Centurion', desc: 'Win 100 games against bots.', icon: 'trophy', tier: 3, test: s => (s.wins || 0) >= 100 },
  { id: 'win_mate10', name: 'Checkmate Artist', desc: 'Win 10 games by checkmate.', icon: 'crown', tier: 2, test: s => (s.mates || 0) >= 10 },
  { id: 'quickmate', name: 'Lightning Strike', desc: 'Checkmate a bot in 15 moves or fewer.', icon: 'bolt', tier: 2, test: s => (s.quickMates || 0) >= 1 },
  { id: 'beat4', name: 'Bot Hunter', desc: 'Beat 4 different bots.', icon: 'target', tier: 2, test: s => Object.keys(s.beaten || {}).length >= 4 },
  { id: 'beat_tower', name: 'Tower Toppler', desc: 'Beat The Tower.', icon: 'castle', tier: 3, test: s => (s.beaten || {})[8] },
  { id: 'beatAll', name: 'Bot Collector', desc: 'Beat all 8 bots.', icon: 'medal', tier: 3, test: s => Object.keys(s.beaten || {}).length >= 8 },
  { id: 'upset', name: 'Giant Slayer', desc: 'Beat a bot rated 200 or more above you.', icon: 'arrowUp', tier: 2, test: s => (s.upsets || 0) >= 1 },
  { id: 'streak3', name: 'Hot Streak', desc: 'Win 3 games in a row.', icon: 'flame', tier: 1, test: s => (s.bestStreak || 0) >= 3 },
  { id: 'streak5', name: 'On Fire', desc: 'Win 5 games in a row.', icon: 'flame', tier: 2, test: s => (s.bestStreak || 0) >= 5 },
  { id: 'streak10', name: 'Juggernaut', desc: 'Win 10 games in a row.', icon: 'flame', tier: 3, test: s => (s.bestStreak || 0) >= 10 },
  { id: 'draw1', name: 'Handshake', desc: 'Draw a game.', icon: 'half', tier: 1, test: s => (s.draws || 0) >= 1 },
  { id: 'stalemate', name: 'So Close', desc: 'Draw a game by stalemate.', icon: 'half', tier: 1, test: s => (s.stalemates || 0) >= 1 },
  { id: 'marathon', name: 'Marathon', desc: 'Finish a game that lasts 60 moves or more.', icon: 'hourglass', tier: 1, test: s => (s.marathons || 0) >= 1 },
  { id: 'games50', name: 'Regular', desc: 'Play 50 games of any kind.', icon: 'play', tier: 2, test: s => totalGames(s) >= 50 },
  { id: 'games200', name: 'Club Fixture', desc: 'Play 200 games of any kind.', icon: 'play', tier: 3, test: s => totalGames(s) >= 200 },
  { id: 'bullet', name: 'Lightning Hands', desc: 'Win a 1 minute game.', icon: 'bolt', tier: 2, test: s => (s.bulletWins || 0) >= 1 },
  { id: 'blitz', name: 'Blitz Master', desc: 'Win a 3 or 5 minute game.', icon: 'clock', tier: 1, test: s => (s.blitzWins || 0) >= 1 },
  { id: 'classical', name: 'Patience', desc: 'Win a 30 minute game.', icon: 'hourglass', tier: 2, test: s => (s.classicalWins || 0) >= 1 },
  { id: 'comeback', name: 'Never Give Up', desc: 'Win after being down 5 points of material.', icon: 'muscle', tier: 2, test: s => (s.comebacks || 0) >= 1 },
  { id: 'local1', name: 'Pass & Play', desc: 'Play a game with a friend on one device.', icon: 'friends', tier: 1, test: s => (s.localGames || 0) >= 1 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Finish a game between midnight and 5 am.', icon: 'clock', tier: 1, test: s => (s.nightGames || 0) >= 1 },
  // special moves
  { id: 'castleq', name: 'Long Castle', desc: 'Castle queenside in a game.', icon: 'castle', tier: 1, test: s => (s.castleQ || 0) >= 1 },
  { id: 'castle10', name: 'Safety First', desc: 'Castle in 10 games.', icon: 'shield', tier: 1, test: s => (s.castled || 0) >= 10 },
  { id: 'enpassant', name: 'Sneaky Pawn', desc: 'Capture en passant in a game.', icon: 'ninja', tier: 1, test: s => (s.enPassant || 0) >= 1 },
  { id: 'promote', name: 'Royal Promotion', desc: 'Promote a pawn to a queen.', icon: 'crown', tier: 1, test: s => (s.queenPromo || 0) >= 1 },
  { id: 'underpromo', name: 'Surprise!', desc: 'Promote a pawn to something other than a queen.', icon: 'sparkle', tier: 2, test: s => (s.underpromo || 0) >= 1 },
  // leagues
  { id: 'league_knight', name: 'Knight League', desc: 'Reach the Knight League.', icon: 'shield', tier: 1, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 600 },
  { id: 'league_bishop', name: 'Bishop League', desc: 'Reach the Bishop League.', icon: 'shield', tier: 1, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 900 },
  { id: 'league_rook', name: 'Rook League', desc: 'Reach the Rook League.', icon: 'shield', tier: 2, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1200 },
  { id: 'league_queen', name: 'Queen League', desc: 'Reach the Queen League.', icon: 'shield', tier: 2, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1500 },
  { id: 'league_king', name: 'King League', desc: 'Reach the King League.', icon: 'crown', tier: 3, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1800 },
  // puzzles
  { id: 'puzzles10', name: 'Puzzle Solver', desc: 'Solve 10 puzzles.', icon: 'puzzle', tier: 1, test: s => (s.puzzles || 0) >= 10 },
  { id: 'puzzles25', name: 'Puzzle Fan', desc: 'Solve 25 puzzles.', icon: 'puzzle', tier: 1, test: s => (s.puzzles || 0) >= 25 },
  { id: 'puzzles50', name: 'Puzzle Addict', desc: 'Solve 50 puzzles.', icon: 'puzzle', tier: 2, test: s => (s.puzzles || 0) >= 50 },
  { id: 'puzzles100', name: 'Puzzle Master', desc: 'Solve 100 puzzles.', icon: 'puzzle', tier: 3, test: s => (s.puzzles || 0) >= 100 },
  { id: 'puzzles250', name: 'Puzzle Legend', desc: 'Solve 250 puzzles.', icon: 'gem', tier: 3, test: s => (s.puzzles || 0) >= 250 },
  { id: 'clean10', name: 'Clean Sheet', desc: 'Solve 10 puzzles without a mistake.', icon: 'check', tier: 1, test: s => (s.puzzlesClean || 0) >= 10 },
  { id: 'pstreak10', name: 'In the Zone', desc: 'Solve 10 rated puzzles in a row.', icon: 'flame', tier: 2, test: (s, p) => (p.best || 0) >= 10 },
  { id: 'puzr1200', name: 'Sharp Eye', desc: 'Reach a puzzle rating of 1200.', icon: 'eye', tier: 2, test: (s, p) => Math.max(...(p.pHist || [0])) >= 1200 },
  { id: 'puzr1600', name: 'Tactics Wizard', desc: 'Reach a puzzle rating of 1600.', icon: 'sparkle', tier: 3, test: (s, p) => Math.max(...(p.pHist || [0])) >= 1600 },
  { id: 'patterns', name: 'Museum of Mates', desc: 'Solve every famous checkmate pattern.', icon: 'crown', tier: 2, test: (s, p) => PUZZLES.filter(z => z.cat === 'pattern').every(z => p.tried[z.id] === 1) },
  { id: 'rush10', name: 'Quick Thinker', desc: 'Score 10 in Puzzle Rush.', icon: 'bolt', tier: 1, test: (s, p) => rushTop(p) >= 10 },
  { id: 'rush20', name: 'Rush Hour', desc: 'Score 20 in Puzzle Rush.', icon: 'bolt', tier: 2, test: (s, p) => rushTop(p) >= 20 },
  { id: 'rush30', name: 'Unstoppable', desc: 'Score 30 in Puzzle Rush.', icon: 'flame', tier: 3, test: (s, p) => rushTop(p) >= 30 },
  { id: 'rushModes', name: 'Against the Clock', desc: 'Play all three Puzzle Rush modes.', icon: 'clock', tier: 1, test: (s, p) => Object.keys(p.rushBest || {}).length >= 3 },
  { id: 'survival15', name: 'Survivor', desc: 'Score 15 in Survival Rush.', icon: 'shield', tier: 2, test: (s, p) => ((p.rushBest || {}).survival || 0) >= 15 },
  { id: 'daily1', name: 'Puzzle of the Day', desc: 'Solve a Daily Puzzle.', icon: 'calendar', tier: 1, test: (s, p) => Object.keys((p.daily || {}).history || {}).length >= 1 },
  { id: 'daily3', name: 'Habit Forming', desc: 'Keep a 3 day Daily Puzzle streak.', icon: 'calendar', tier: 1, test: (s, p) => ((p.daily || {}).best || 0) >= 3 },
  { id: 'daily7', name: 'Week Warrior', desc: 'Keep a 7 day Daily Puzzle streak.', icon: 'calendar', tier: 2, test: (s, p) => ((p.daily || {}).best || 0) >= 7 },
  { id: 'dailyTotal20', name: 'Daily Devotion', desc: 'Solve 20 Daily Puzzles.', icon: 'calendar', tier: 2, test: (s, p) => Object.keys((p.daily || {}).history || {}).length >= 20 },
  { id: 'daily30', name: 'Unbreakable', desc: 'Keep a 30 day Daily Puzzle streak.', icon: 'flame', tier: 3, test: (s, p) => ((p.daily || {}).best || 0) >= 30 },
  // review
  { id: 'review1', name: 'Self Reflection', desc: 'Review a game with the coach.', icon: 'search', tier: 1, test: s => (s.reviews || 0) >= 1 },
  { id: 'review10', name: 'Student of the Game', desc: 'Review 10 games with the coach.', icon: 'search', tier: 2, test: s => (s.reviews || 0) >= 10 },
  { id: 'review25', name: 'Analyst', desc: 'Review 25 games with the coach.', icon: 'chart', tier: 3, test: s => (s.reviews || 0) >= 25 },
  { id: 'brilliant', name: 'Brilliant!', desc: 'Play a brilliant move.', icon: 'sparkle', tier: 3, test: s => (s.brilliants || 0) >= 1 },
  { id: 'accuracy90', name: 'Precision', desc: 'Score 90% accuracy in a game of 20+ moves.', icon: 'target', tier: 3, test: s => (s.acc90 || 0) >= 1 },
  // online
  { id: 'online1', name: 'Hello, World', desc: 'Play an online game.', icon: 'globe', tier: 1, test: s => (s.onlineGames || 0) >= 1 },
  { id: 'onlinewin', name: 'Worthy Opponent', desc: 'Win an online game.', icon: 'globe', tier: 2, test: s => (s.onlineWins || 0) >= 1 },
  { id: 'online10', name: 'Social Butterfly', desc: 'Play 10 online games.', icon: 'chat', tier: 2, test: s => (s.onlineGames || 0) >= 10 },
  { id: 'onlinewin10', name: 'Crowd Favorite', desc: 'Win 10 online games.', icon: 'trophy', tier: 3, test: s => (s.onlineWins || 0) >= 10 },
  { id: 'online1000', name: 'Rising Rival', desc: 'Reach an online rating of 1000.', icon: 'arrowUp', tier: 2, test: (s, p) => !!(p.server && p.server.games && p.server.r >= 1000) },
  // World Games
  { id: 'world1', name: 'Passport', desc: 'Play a World Games game.', icon: 'globe', tier: 1, test: s => (s.worldGames || 0) >= 1 },
  { id: 'world3', name: 'World Traveler', desc: 'Play 3 different World Games.', icon: 'globe', tier: 2, test: s => Object.keys(s.worldPlayed || {}).length >= 3 },
  { id: 'world6', name: 'Globetrotter', desc: 'Play 6 different World Games.', icon: 'route', tier: 3, test: s => Object.keys(s.worldPlayed || {}).length >= 6 },
  { id: 'worldRegional', name: 'Ancient Traditions', desc: 'Play xiangqi, shogi, janggi, makruk, sittuyin and shatranj.', icon: 'book', tier: 3, test: s => (typeof WORLD_REGIONAL !== 'undefined' ? WORLD_REGIONAL : []).every(v => (s.worldPlayed || {})[v]) },
  { id: 'worldTwists', name: 'Twisted', desc: 'Play all six chess twists.', icon: 'dice', tier: 3, test: s => (typeof WORLD_TWISTS !== 'undefined' ? WORLD_TWISTS : []).every(v => (s.worldPlayed || {})[v]) },
  { id: 'worldwin', name: 'Far From Home', desc: 'Beat a bot in a World Game.', icon: 'trophy', tier: 1, test: s => (s.worldWins || 0) >= 1 },
  { id: 'worldwin10', name: 'Ambassador', desc: 'Win 10 World Games against bots.', icon: 'flag', tier: 2, test: s => (s.worldWins || 0) >= 10 },
  { id: 'worldmaster', name: 'Grandmaster Abroad', desc: 'Beat a level 8 bot in a World Game.', icon: 'crown', tier: 3, test: s => (s.worldMaster || 0) >= 1 },
  { id: 'worldLesson', name: 'Exchange Student', desc: 'Finish a World Games lesson.', icon: 'learn', tier: 1, test: (s, p) => Object.keys((p.world || {}).lessons || {}).length >= 1 },
  { id: 'chess960', name: 'Shuffled', desc: 'Finish a game of Chess960.', icon: 'dice', tier: 1, test: s => (s.games960 || 0) >= 1 },
  // daily habits and quests
  { id: 'quest1', name: 'Quest Starter', desc: 'Finish all three daily quests in one day.', icon: 'check', tier: 1, test: s => (s.questDays || 0) >= 1 },
  { id: 'quest7', name: 'Quest Hero', desc: 'Finish all daily quests on 7 days.', icon: 'shield', tier: 2, test: s => (s.questDays || 0) >= 7 },
  { id: 'quest30', name: 'Questmaster', desc: 'Finish all daily quests on 30 days.', icon: 'crown', tier: 3, test: s => (s.questDays || 0) >= 30 },
  { id: 'login3', name: 'Welcome Back', desc: 'Claim the daily reward 3 days in a row.', icon: 'gem', tier: 1, test: (s, p) => ((p.login || {}).best || 0) >= 3 },
  { id: 'login7', name: 'Loyal Member', desc: 'Claim all 7 daily rewards in a row.', icon: 'calendar', tier: 2, test: (s, p) => ((p.login || {}).best || 0) >= 7 },
  { id: 'login30', name: 'Clubhouse Regular', desc: 'Keep a 30 day login streak.', icon: 'flame', tier: 3, test: (s, p) => ((p.login || {}).best || 0) >= 30 },
  // levels and seasons
  { id: 'level5', name: 'Rising Star', desc: 'Reach level 5.', icon: 'star', tier: 1, test: (s, p) => levelInfo(p.xp || 0).lvl >= 5 },
  { id: 'level10', name: 'Shining Star', desc: 'Reach level 10.', icon: 'star', tier: 2, test: (s, p) => levelInfo(p.xp || 0).lvl >= 10 },
  { id: 'level20', name: 'Superstar', desc: 'Reach level 20.', icon: 'star', tier: 3, test: (s, p) => levelInfo(p.xp || 0).lvl >= 20 },
  { id: 'level30', name: 'Club Legend', desc: 'Reach level 30.', icon: 'crown', tier: 3, test: (s, p) => levelInfo(p.xp || 0).lvl >= 30 },
  { id: 'season1', name: 'Season Debut', desc: 'Reach tier 1 of a season.', icon: 'flag', tier: 1, test: (s, p) => seasonBestTier(p) >= 1 },
  { id: 'season10', name: 'Climber', desc: 'Reach tier 10 of a season.', icon: 'flag', tier: 1, test: (s, p) => seasonBestTier(p) >= 10 },
  { id: 'season20', name: 'High Climber', desc: 'Reach tier 20 of a season.', icon: 'route', tier: 2, test: (s, p) => seasonBestTier(p) >= 20 },
  { id: 'season30', name: 'Season Legend', desc: 'Complete a whole season track.', icon: 'crown', tier: 3, test: (s, p) => seasonBestTier(p) >= 30 },
  // collection
  { id: 'named', name: 'Nice to Meet You', desc: 'Add your name to your profile.', icon: 'user', tier: 1, test: (s, p) => !!(p.name && p.name.trim()) },
  { id: 'dressed', name: 'Dressed to Impress', desc: 'Wear a frame, a title and a banner of your choice.', icon: 'palette', tier: 1, test: (s, p) => { const st = p.style || {}; return !!(st.frame && st.frame !== 'brass' && st.title && st.title !== 'rank' && st.banner && st.banner !== 'walnut'); } },
  { id: 'collector', name: 'Collector', desc: 'Unlock 10 boards.', icon: 'board', tier: 2, test: () => BOARD_THEMES.filter(t => reqMet(t.req)).length >= 10 },
];
const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold'];
// how close a locked achievement is: (stats, profile) => [have, need]. One-off feats have no entry.
const ACH_PROG = {
  lessons5: (s, p) => [Object.keys(p.lessons).length, 5], lessons20: (s, p) => [Object.keys(p.lessons).length, 20], lessonsAll: (s, p) => [LESSONS.filter(l => p.lessons[l.id]).length, LESSONS.length],
  stars10: (s, p) => [lessonStarsTotal(p), 10], stars30: (s, p) => [lessonStarsTotal(p), 30], starsAll: (s, p) => [LESSONS.filter(l => ((p.lessonStars || {})[l.id] || 0) >= 3).length, LESSONS.length], course3: s => [s.coursesDone || 0, 3],
  win5: s => [s.wins || 0, 5], win25: s => [s.wins || 0, 25], win100: s => [s.wins || 0, 100], win_mate10: s => [s.mates || 0, 10], beat4: s => [Object.keys(s.beaten || {}).length, 4], beatAll: s => [Object.keys(s.beaten || {}).length, 8],
  streak3: s => [s.bestStreak || 0, 3], streak5: s => [s.bestStreak || 0, 5], streak10: s => [s.bestStreak || 0, 10], games50: s => [totalGames(s), 50], games200: s => [totalGames(s), 200], castle10: s => [s.castled || 0, 10],
  league_knight: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 600], league_bishop: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 900], league_rook: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1200],
  league_queen: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1500], league_king: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1800],
  puzzles10: s => [s.puzzles || 0, 10], puzzles25: s => [s.puzzles || 0, 25], puzzles50: s => [s.puzzles || 0, 50], puzzles100: s => [s.puzzles || 0, 100], puzzles250: s => [s.puzzles || 0, 250], clean10: s => [s.puzzlesClean || 0, 10],
  pstreak10: (s, p) => [p.best || 0, 10], puzr1200: (s, p) => [Math.round(Math.max(...(p.pHist || [0]))), 1200], puzr1600: (s, p) => [Math.round(Math.max(...(p.pHist || [0]))), 1600],
  patterns: (s, p) => { const z = PUZZLES.filter(q => q.cat === 'pattern'); return [z.filter(q => p.tried[q.id] === 1).length, z.length]; },
  rush10: (s, p) => [rushTop(p), 10], rush20: (s, p) => [rushTop(p), 20], rush30: (s, p) => [rushTop(p), 30], rushModes: (s, p) => [Object.keys(p.rushBest || {}).length, 3], survival15: (s, p) => [(p.rushBest || {}).survival || 0, 15],
  daily3: (s, p) => [(p.daily || {}).best || 0, 3], daily7: (s, p) => [(p.daily || {}).best || 0, 7], daily30: (s, p) => [(p.daily || {}).best || 0, 30], dailyTotal20: (s, p) => [Object.keys((p.daily || {}).history || {}).length, 20],
  review10: s => [s.reviews || 0, 10], review25: s => [s.reviews || 0, 25], online10: s => [s.onlineGames || 0, 10], onlinewin10: s => [s.onlineWins || 0, 10],
  level5: (s, p) => [levelInfo(p.xp || 0).lvl, 5], level10: (s, p) => [levelInfo(p.xp || 0).lvl, 10], level20: (s, p) => [levelInfo(p.xp || 0).lvl, 20], level30: (s, p) => [levelInfo(p.xp || 0).lvl, 30],
  login3: (s, p) => [(p.login || {}).best || 0, 3], login7: (s, p) => [(p.login || {}).best || 0, 7], login30: (s, p) => [(p.login || {}).best || 0, 30],
  quest7: s => [s.questDays || 0, 7], quest30: s => [s.questDays || 0, 30],
  world3: s => [Object.keys(s.worldPlayed || {}).length, 3], world6: s => [Object.keys(s.worldPlayed || {}).length, 6], worldwin10: s => [s.worldWins || 0, 10],
  worldRegional: s => [WORLD_REGIONAL.filter(v => (s.worldPlayed || {})[v]).length, WORLD_REGIONAL.length], worldTwists: s => [WORLD_TWISTS.filter(v => (s.worldPlayed || {})[v]).length, WORLD_TWISTS.length],
  season10: (s, p) => [seasonBestTier(p), 10], season20: (s, p) => [seasonBestTier(p), 20], season30: (s, p) => [seasonBestTier(p), 30],
  collector: () => [BOARD_THEMES.filter(t => reqMet(t.req)).length, 10],
};
function achProgress(a) {
  const f = ACH_PROG[a.id]; if (!f) return null;
  try { const [n, g] = f(stats(), profile); return [Math.max(0, Math.min(n, g)), g]; } catch (e) { return null; }
}
// sound packs for Me > Style (the synthesized packs live in audio.js)
const SOUND_PACKS = [
  { id: 'wood', name: 'Wooden', sub: 'Wooden clacks', req: null },
  { id: 'soft', name: 'Soft', sub: 'Felt and bells', req: null },
  { id: 'retro', name: 'Retro', sub: 'Chiptune', req: null },
];

function reqMet(req) {
  if (!req) return true;
  const s = stats();
  if (req.level) return levelInfo(profile.xp || 0).lvl >= req.level;
  if (req.ach) return !!(profile.ach || {})[req.ach];
  if (req.beat) return !!(s.beaten || {})[req.beat];
  if (req.season) return seasonBestTier(profile) >= req.season;
  return false;
}
function reqText(req) {
  if (!req) return 'Unlocked';
  if (req.level) return `Reach level ${req.level}`;
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? `Achievement: ${a.name}` : 'Achievement'; }
  if (req.beat) return `Beat ${BOT_LEVELS[req.beat - 1].name}`;
  if (req.season) return `Reach season tier ${req.season}`;
  return '';
}

// ---------- awarding ----------
let rewardQueue = [], rewardShowing = false;
function grantXP(amount, why) {
  if (!amount) return;
  if (xpMark == null && !rewardQueue.some(r => r.kind === 'xp')) xpMark = profile.xp || 0;
  const before = levelInfo(profile.xp || 0).lvl;
  profile.xp = (profile.xp || 0) + amount;
  const after = levelInfo(profile.xp).lvl;
  queueReward({ kind: 'xp', amount, why });
  if (after > before) {
    queueReward({ kind: 'level', lvl: after });
    for (const t of allCosmetics()) if (t.req && t.req.level && t.req.level > before && t.req.level <= after) queueReward({ kind: 'unlock', item: t });
  }
  // every point of XP also climbs the season track (daily.js)
  if (typeof seasonGain === 'function') seasonGain(amount);
}
function checkAchievements() {
  profile.ach = profile.ach || {};
  const s = stats(); let any = false;
  // a trophy's XP can push the season or level over a line that earns another trophy: look again
  for (let pass = 0; pass < 4; pass++) {
    let found = false;
    for (const a of ACHIEVEMENTS) {
      if (profile.ach[a.id]) continue;
      let ok = false; try { ok = a.test(s, profile); } catch (e) { }
      if (ok) {
        profile.ach[a.id] = Date.now(); any = found = true;
        queueReward({ kind: 'ach', a });
        for (const t of allCosmetics()) if (t.req && t.req.ach === a.id) queueReward({ kind: 'unlock', item: t });
        grantXP(a.tier * 40, a.name);
      }
    }
    if (!found) break;
  }
  if (any) saveProfile();
}
// central event hook used by the rest of the app
function rewardEvent(type, d = {}) {
  const s = stats();
  const hr = new Date().getHours();
  if (type === 'botGame' || type === 'onlineGame') {
    // win streaks count bot and online games together
    if (d.score === 1) { s.streakNow = (s.streakNow || 0) + 1; s.bestStreak = Math.max(s.bestStreak || 0, s.streakNow); } else if (d.score != null) s.streakNow = 0;
    if (d.score === 0.5) inc('draws'); else if (d.score === 0) inc('losses');
    const plies = (d.moves || []).length;
    if (plies >= 120) inc('marathons');
    if (d.score === 1 && d.reason === 'checkmate' && plies && plies <= 30) inc('quickMates');
  }
  if (type === 'botGame') {
    const lvlIdx = d.botIndex + 1;
    if (d.score === 1) { if (d.botRating && d.myRating && d.botRating - d.myRating >= 200) inc('upsets'); if (d.tc === '180+0' || d.tc === '180+2' || d.tc === '300+0') inc('blitzWins'); if (d.tc === '1800+0') inc('classicalWins'); }
    if (d.score === 1) { inc('wins'); s.beaten = s.beaten || {}; if (!s.beaten[lvlIdx]) { s.beaten[lvlIdx] = Date.now(); const av = AVATAR_CHOICES.find(x => x.req && x.req.beat === lvlIdx); if (av) queueReward({ kind: 'avatar', item: av }); } if (d.reason === 'checkmate') inc('mates'); if (d.tc === '60+0') inc('bulletWins'); }
    if (d.reason === 'stalemate') inc('stalemates');
    inc('botGames');
    grantXP(Math.round((d.score === 1 ? 25 + 6 * lvlIdx : d.score === 0.5 ? 14 : 8) * (d.rated ? 1 : 0.6)), d.score === 1 ? 'Win' : d.score === 0.5 ? 'Draw' : 'Good effort');
    gameFeats(d.moves, d.color, d.score);
  } else if (type === 'onlineGame') {
    inc('onlineGames'); if (d.score === 1) inc('onlineWins');
    grantXP(d.score === 1 ? 45 : d.score === 0.5 ? 25 : 15, 'Online game');
    gameFeats(d.moves, d.color, d.score);
  } else if (type === 'localGame') { inc('localGames'); grantXP(10, 'Friendly game'); gameFeats(d.moves, null, null); if (d.reason === 'stalemate') inc('stalemates'); }
  else if (type === 'puzzle') { if (d.solved) { inc('puzzles'); if (d.clean) inc('puzzlesClean'); grantXP(d.clean ? 12 : 6, 'Puzzle'); } }
  else if (type === 'rush') { inc('rushRuns'); grantXP(Math.min(80, d.score * 3), 'Puzzle Rush'); }
  else if (type === 'daily') { grantXP(20, 'Daily Puzzle'); }
  else if (type === 'lesson') { grantXP(25, 'Lesson'); }
  else if (type === 'course') { inc('coursesDone'); grantXP(120, 'Course complete'); }
  else if (type === 'review') { inc('reviews'); grantXP(15, 'Game review'); if (d.brilliants) inc('brilliants', d.brilliants); if (d.acc >= 90 && d.moves >= 20) inc('acc90'); }
  else if (type === 'game960') { inc('games960'); }
  else if (type === 'worldGame') {
    s.worldPlayed = s.worldPlayed || {}; s.worldPlayed[d.variant] = 1; inc('worldGames');
    if (d.score === 1) { inc('worldWins'); if (d.level >= 8) inc('worldMaster'); }
    grantXP(d.local ? 10 : d.score === 1 ? 20 + 4 * d.level : d.score === .5 ? 12 : 8, d.score === 1 ? 'World Games win' : 'World Games');
  }
  if (['botGame', 'onlineGame', 'localGame', 'worldGame'].includes(type) && hr < 5) inc('nightGames');
  // daily quests
  if (type === 'worldGame') questEvent('gamePlayed');
  if (['botGame', 'onlineGame', 'localGame'].includes(type)) { questEvent('gamePlayed'); if (castledIn(d.moves, d.color)) { questEvent('castled'); inc('castled'); } }
  if (type === 'botGame' && d.score === 1) { questEvent('botWin'); if (d.reason === 'checkmate') questEvent('mateWin'); if (BOT_LEVELS[d.botIndex] && d.botRating > d.myRating) questEvent('upsetWin'); }
  if (type === 'onlineGame') { questEvent('onlineGame'); if (d.score === 1 && d.reason === 'checkmate') questEvent('mateWin'); }
  if (type === 'puzzle' && d.solved) questEvent('puzzleSolved');
  if (type === 'rush') { questEvent('puzzleSolved', d.score); if (d.score >= 8) questEvent('rush8'); }
  if (type === 'daily') { questEvent('daily'); questEvent('puzzleSolved'); }
  if (type === 'review') questEvent('review');
  if (type === 'lesson') questEvent('lesson');
  checkAchievements();
  saveProfile();
  flushRewards();
}
function castledIn(moves, color) {
  if (!moves) return false; const pos = new E.Position();
  for (const u of moves) { const m = pos.moveFromUci(u); if (!m) return false; const mover = pos.turn === 0 ? 'w' : 'b'; if ((E.mFlags(m) & E.F_CASTLE) && (!color || mover === color)) return true; pos.make(m); }
  return false;
}
// scan a finished game for special moves made by `color` (or by anyone when color is null)
function gameFeats(moves, color, score) {
  if (!moves || !moves.length) return;
  const pos = new E.Position(); let worst = 0;
  for (const u of moves) {
    const mover = pos.turn === 0 ? 'w' : 'b', m = pos.moveFromUci(u); if (!m) break;
    const mine = !color || mover === color, fl = E.mFlags(m);
    if (mine && (fl & E.F_EP)) inc('enPassant');
    if (mine && E.mPromo(m) && E.mPromo(m) !== E.Q) inc('underpromo');
    if (mine && E.mPromo(m) === E.Q) inc('queenPromo');
    if (mine && (fl & E.F_CASTLE) && (E.mTo(m) & 7) === 2) inc('castleQ');
    pos.make(m);
    if (color) { const c = captured(pos.board); const mineAdv = color === 'w' ? c.diff : -c.diff; worst = Math.min(worst, mineAdv); }
  }
  if (color && score === 1 && worst <= -5) inc('comebacks');
}
function queueReward(r) { rewardQueue.push(r); if (typeof inboxFromReward === 'function') inboxFromReward(r); }
// Rewards never interrupt a game, lesson, puzzle or review: while a focus screen is up they wait in
// the queue. Results screens take them with takeRewards(); anything left shows when you are back in a hub.
let xpMark = null; // XP before the rewards that are waiting
function takeRewards() {
  const q = rewardQueue; rewardQueue = [];
  const xpGain = q.filter(r => r.kind === 'xp').reduce((a, r) => a + r.amount, 0);
  const from = xpMark != null ? xpMark : (profile.xp || 0) - xpGain; xpMark = null;
  return { xpFrom: from, xpTo: profile.xp || 0, xpGain, levels: q.filter(r => r.kind === 'level').map(r => r.lvl), unlocks: q.filter(r => r.kind === 'unlock' || r.kind === 'avatar'), achs: q.filter(r => r.kind === 'ach').map(r => r.a), quests: q.filter(r => r.kind === 'quest' || r.kind === 'questsAll'), why: q.filter(r => r.kind === 'xp').map(r => r.why) };
}
function flushRewards() {
  if (typeof focusOn !== 'undefined' && focusOn) return;
  if (rewardShowing || !rewardQueue.length) return;
  // merge xp lines into one toast
  const xp = rewardQueue.filter(r => r.kind === 'xp'), rest = rewardQueue.filter(r => r.kind !== 'xp');
  rewardQueue = rest;
  if (xp.length) rewardToast(icon('star', 18), `+${xp.reduce((a, r) => a + r.amount, 0)} XP`, xp.map(r => r.why).filter(Boolean).slice(0, 2).join(', '));
  // a flood (say, many trophies at once after an update) becomes one toast per kind
  const achs = rewardQueue.filter(r => r.kind === 'ach'), unl = rewardQueue.filter(r => r.kind === 'unlock' || r.kind === 'avatar'), tiers = rewardQueue.filter(r => r.kind === 'seasonTier');
  if (achs.length > 3) rewardQueue = rewardQueue.filter(r => r.kind !== 'ach').concat({ kind: 'achMany', list: achs.map(r => r.a) });
  if (unl.length > 3) rewardQueue = rewardQueue.filter(r => r.kind !== 'unlock' && r.kind !== 'avatar').concat({ kind: 'unlockMany', list: unl.map(r => r.item) });
  if (tiers.length > 1) rewardQueue = rewardQueue.filter(r => r.kind !== 'seasonTier').concat({ kind: 'seasonTier', tier: tiers[tiers.length - 1].tier });
  const showNext = () => {
    const r = rewardQueue.shift(); if (!r) { rewardShowing = false; return; }
    rewardShowing = true;
    if (r.kind === 'level') celebrateLevel(r.lvl);
    else if (r.kind === 'ach') rewardToast(icon(r.a.icon, 18), `${TIER_NAME[r.a.tier]} achievement: ${r.a.name}`, r.a.desc, ['', 'bronze', 'silver', 'gold'][r.a.tier]);
    else if (r.kind === 'unlock') rewardToast(r.item.kind === 'avatar' ? avatar(r.item.id, 22) : icon('sparkle', 18), `Unlocked: ${r.item.name}`, r.tier ? `Season tier ${r.tier} reward. Try it in Me > Style` : 'Try it in Me > Style', 'gold');
    else if (r.kind === 'avatar') rewardToast(avatar(r.item.id, 22), `New avatar: ${r.item.name}`, 'Pick it in Me > Style', 'gold');
    else if (r.kind === 'quest') rewardToast(icon('check', 18), 'Quest complete!', r.def.text, 'silver');
    else if (r.kind === 'achMany') rewardToast(icon('trophy', 18), `${r.list.length} new trophies!`, 'See them in Me > Trophies', 'gold');
    else if (r.kind === 'unlockMany') rewardToast(icon('sparkle', 18), `${r.list.length} new items unlocked!`, 'Try them in Me > Style', 'gold');
    else if (r.kind === 'seasonTier') rewardToast(icon('flag', 18), `Season tier ${r.tier}!`, typeof seasonName === 'function' ? seasonName(seasonInfo().id) : '', 'gold');
    else if (r.kind === 'questsAll') { rewardToast(icon('trophy', 18), 'All quests done!', (r.streak > 1 ? `Quest streak: ${r.streak} days` : `Quest streak: ${r.streak} day`), 'gold'); confetti(); }
    setTimeout(showNext, 1500);
  };
  setTimeout(showNext, xp.length ? 900 : 0);
}
let toastStack = null;
function rewardToast(ic, title, sub, tone = '') {
  if (!toastStack) { toastStack = h('div', { class: 'rtoasts' }); document.body.append(toastStack); }
  const t = h('div', { class: 'rtoast ' + tone }, h('div', { class: 'rti' }, ic), h('div', null, h('b', null, title), sub ? h('small', null, sub) : null));
  toastStack.append(t);
  if (tone) beep('star');
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
}

// ---------- applying styles ----------
function applyStyle() {
  const st = profile.style || {};
  const bt = BOARD_THEMES.find(t => t.id === st.board && reqMet(t.req)) || BOARD_THEMES[0];
  document.documentElement.style.setProperty('--light', bt.light);
  document.documentElement.style.setProperty('--dark', bt.dark);
  const ps = PIECE_SETS.find(t => t.id === st.pieces && reqMet(t.req)) || PIECE_SETS[0];
  buildPieceSet(ps);
  document.body.classList.toggle('no-coords', st.coords === false);
  document.body.classList.toggle('no-anim', st.anim === false);
}
function buildPieceSet(ps, target = PIECE_URL) {
  for (const c of ['w', 'b']) for (const t in PIECE_SVG) {
    const [fill, stroke] = ps[c];
    const g2 = ps.shine ? shade(fill, c === 'w' ? -0.22 : -0.45) : shade(fill, c === 'w' ? -0.18 : 0.18);
    const grad = ps.grad ? `<defs><linearGradient id="g" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${ps.shine && c === 'b' ? shade(fill, 0.18) : fill}"/><stop offset="${ps.shine ? '.55' : '1'}" stop-color="${ps.shine ? fill : g2}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">${grad}<g fill="${ps.grad ? 'url(#g)' : fill}" stroke="${stroke}" stroke-width="${ps.sw}" stroke-linejoin="round" stroke-linecap="round">${PIECE_SVG[t].replace('class="eye"', `fill="${stroke}" stroke="none"`)}</g></svg>`;
    target[c + t] = 'data:image/svg+xml;base64,' + btoa(svg);
  }
  return target;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------- Me tab sections ----------
// Level badge + XP bar (used on the player card in Me), with the next level reward. Tap for the level road.
function levelCard() {
  const li = levelInfo(profile.xp || 0), nx = nextLevelReward(li.lvl);
  return h('button', { class: 'me-lvl', 'aria-label': `Level ${li.lvl}`, onclick: () => levelRoadSheet() },
    h('div', { class: 'me-lvl-badge' }, h('b', null, String(li.lvl))),
    h('div', { class: 'grow' },
      h('div', { class: 'me-xpbar' }, h('div', { style: { width: Math.round(li.into / li.need * 100) + '%' } })),
      h('div', { class: 'me-xptxt' }, `${li.into} / ${li.need} XP to level ${li.lvl + 1}`),
      nx ? h('div', { class: 'me-nextrw' }, h('span', { class: 'me-nr-art' }, cosmeticArt(nx.item, 18)), h('span', null, nx.item.kind === 'rank' ? `Next reward at level ${nx.lvl}: the rank "${nx.item.name}"` : `Next reward at level ${nx.lvl}: ${nx.item.name}`)) : null));
}
// the next cosmetic (or rank title) that a level unlocks after `lvl`
function nextLevelReward(lvl) {
  const items = allCosmetics().filter(t => t.req && t.req.level > lvl).sort((a, b) => a.req.level - b.req.level);
  const it = items[0], nt = LEVEL_TITLES.find(([m]) => m > lvl);
  if (nt && (!it || nt[0] < it.req.level)) return { lvl: nt[0], item: { id: 'rank', kind: 'rank', name: nt[1] } };
  return it ? { lvl: it.req.level, item: it } : null;
}
// all levels with something waiting: rank titles and unlocks
function levelRoadSheet() {
  beep('open');
  const li = levelInfo(profile.xp || 0), rows = [];
  for (const [m, n] of LEVEL_TITLES) rows.push({ lvl: m, art: h('span', { class: 'lr-rank' }, icon('medal', 18)), name: n, sub: 'Rank title' });
  for (const t of allCosmetics()) if (t.req && t.req.level) rows.push({ lvl: t.req.level, art: cosmeticArt(t, 36), name: t.name, sub: KIND_LABEL[t.kind] });
  rows.sort((a, b) => a.lvl - b.lvl);
  modal((box, close) => {
    const list = h('div', { class: 'lr-list' }, rows.map(r => h('div', { class: 'lr-row' + (r.lvl <= li.lvl ? ' got' : r === rows.find(x => x.lvl > li.lvl) ? ' next' : '') },
      h('span', { class: 'lr-lv' }, String(r.lvl)), h('span', { class: 'lr-art' }, r.art), h('div', { class: 'grow' }, h('b', null, r.name), h('small', null, r.sub)),
      r.lvl <= li.lvl ? h('span', { class: 'lr-ok' }, icon('check', 16)) : null)));
    box.append(h('h2', { class: 'center' }, 'Level rewards'), h('p', { class: 'center muted small', style: { margin: '0 0 10px' } }, `You are level ${li.lvl}: ${li.title}`), list,
      h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => { beep('close'); close(); } }, 'OK'));
    requestAnimationFrame(() => { const n = list.querySelector('.next'); if (n) list.scrollTop = Math.max(0, n.offsetTop - list.clientHeight / 2); });
  });
}
// ---------- profile cosmetics: frame, title, banner ----------
const myFrame = () => { const id = (profile.style || {}).frame || 'brass', f = FRAMES.find(x => x.id === id); return f && reqMet(f.req) ? f.id : 'brass'; };
const myBanner = () => { const id = (profile.style || {}).banner || 'walnut', b = BANNERS.find(x => x.id === id); return b && reqMet(b.req) ? b : BANNERS[0]; };
// the line under your name: a chosen title, or your level rank
function playerTitle() {
  const id = (profile.style || {}).title, t = TITLES.find(x => x.id === id);
  return t && t.id !== 'rank' && reqMet(t.req) ? t.name : levelInfo(profile.xp || 0).title;
}
// class names for a framed avatar: 'pframe pf-gold'. Wrap an avatar <img> in an element with these classes.
function playerFrameClass(frameId) { return 'pframe pf-' + (frameId || myFrame()); }
// your avatar inside your frame, as one element. opts: {frame, avatar} to show someone else's look.
function playerBadgeEl(size = 44, opts = {}) {
  const el = h('span', { class: playerFrameClass(opts.frame), style: { '--s': size + 'px' } }, avatar(opts.avatar || myAvatar(), size));
  el.style.setProperty('--s', size + 'px');
  return el;
}
const bannerBg = b => `linear-gradient(180deg,${b.c[0]},${b.c[1]})`;
function titleArt(name) { return h('span', { class: 'ttl-art' }, h('span', null, name)); }
// art for any unlockable, for chests, sheets and the season track
function cosmeticArt(t, size = 72) {
  if (!t) return null;
  if (t.kind === 'board') { const d = h('span', { class: 'cos-art', html: `<svg viewBox="0 0 4 4" width="${size}" height="${size}" style="border-radius:${Math.round(size / 9)}px">${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(f => `<rect x="${f}" y="${r}" width="1" height="1" fill="${(r + f) % 2 ? t.dark : t.light}"/>`).join('')).join('')}</svg>` }); return d; }
  if (t.kind === 'pieces') return h('img', { src: buildPieceSet(t, {}).wn, width: size, height: size, alt: '' });
  if (t.kind === 'avatar') return avatar(t.id, size);
  if (t.kind === 'frame') return playerBadgeEl(size, { frame: t.id });
  if (t.kind === 'banner') return h('span', { class: 'ban-art', style: { width: size + 'px', height: Math.round(size * .78) + 'px', background: bannerBg(t), boxShadow: `0 ${Math.max(2, size / 18)}px 0 ${t.c[2]}` } });
  if (t.kind === 'title') {
    if (size < 48) { const m = h('span', { class: 'ttl-art mini', style: { width: size + 'px', height: Math.round(size * .62) + 'px' } }, icon('star', Math.round(size * .36))); return m; }
    const a = titleArt(t.name); a.style.fontSize = Math.max(10, Math.round(size / 6)) + 'px'; return a;
  }
  if (t.kind === 'rank') return icon('medal', size);
  return null;
}
// what a locked item still needs: [have, need] or null
function reqProgress(req) {
  if (!req) return null;
  if (req.level) return [Math.min(levelInfo(profile.xp || 0).lvl, req.level), req.level];
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? achProgress(a) : null; }
  if (req.season) return [Math.min(seasonBestTier(profile), req.season), req.season];
  return null;
}
function reqShort(req) {
  if (!req) return '';
  if (req.level) return `Level ${req.level}`;
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? a.name : ''; }
  if (req.beat) return `Beat ${BOT_LEVELS[req.beat - 1].name}`;
  if (req.season) return `Season tier ${req.season}`;
  return '';
}
// one medal: ribbon + metal disc. Locked medals are dark, with a ring that fills as you get closer.
function medalEl(a, big) {
  const has = (profile.ach || {})[a.id], pr = has ? null : achProgress(a);
  const disc = h('div', { class: 'tc-disc' }, icon(a.icon, big ? 46 : 22));
  if (pr) disc.style.setProperty('--p', Math.round(pr[0] / pr[1] * 100));
  return h('div', { class: 'tc-medal t' + a.tier + (has ? ' got' : '') + (pr ? ' prog' : '') + (big ? ' big' : '') }, h('i', { class: 'tc-rib' }), disc);
}
function trophySheet(a) {
  const has = (profile.ach || {})[a.id], pr = has ? null : achProgress(a);
  const unlocks = BOARD_THEMES.concat(PIECE_SETS).filter(t => t.req && t.req.ach === a.id);
  beep('open');
  modal((box, close) => box.append(
    h('div', { class: 'tc-sheet' + (has ? ' got' : '') }, h('div', { class: 'tc-rays' }), medalEl(a, true)),
    h('div', { class: 'center' }, h('span', { class: 'tc-tier t' + a.tier }, TIER_NAME[a.tier])),
    h('h2', { class: 'center', style: { marginTop: '8px' } }, a.name),
    h('p', { class: 'center muted', style: { margin: '4px 0 12px' } }, a.desc),
    has ? h('p', { class: 'center small tc-earned' }, icon('check', 16), `Earned ${new Date(has).toLocaleDateString()}`)
      : pr ? h('div', { class: 'tc-progress' }, h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } })), h('div', { class: 'small muted center' }, `${pr[0]} / ${pr[1]}`))
        : h('p', { class: 'center small muted' }, icon('key', 15), ' Not earned yet'),
    unlocks.length ? h('div', { class: 'tc-unlocks' }, unlocks.map(t => h('div', { class: 'tc-unl' }, t.light ? styleSwatch(t) : pieceArt(t), h('div', null, h('small', null, t.light ? 'Unlocks a board' : 'Unlocks a piece set'), h('b', null, t.name))))) : null,
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: () => { beep('close'); close(); } }, 'OK')));
  if (has && typeof fxBurst === 'function') setTimeout(() => { const m = document.querySelector('.tc-sheet .tc-disc'); if (m) fxBurst(m, 'sparks', { count: 18 }); }, 250);
}
// The trophy cabinet: earned medals first (gold to bronze), then the locked ones, closest first.
function trophyCard() {
  const A = profile.ach || {}, got = ACHIEVEMENTS.filter(a => A[a.id]);
  const tiers = [3, 2, 1].map(t => [t, got.filter(a => a.tier === t).length]);
  const pct = a => { const p = achProgress(a); return p ? p[0] / p[1] : 0; };
  const order = got.slice().sort((a, b) => b.tier - a.tier || A[b.id] - A[a.id]).concat(ACHIEVEMENTS.filter(a => !A[a.id]).sort((a, b) => pct(b) - pct(a)));
  const next = ACHIEVEMENTS.filter(a => !A[a.id] && achProgress(a) && pct(a) > 0 && pct(a) < 1).sort((a, b) => pct(b) - pct(a))[0];
  const wrap = h('div', { class: 'tc' });
  wrap.append(h('div', { class: 'tc-sum' },
    h('div', { class: 'tc-count' }, h('b', null, String(got.length)), h('span', null, `/ ${ACHIEVEMENTS.length}`)),
    h('div', { class: 'grow' }, h('div', { class: 'tc-lbl' }, 'Trophies collected'), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(got.length / ACHIEVEMENTS.length * 100) + '%' } }))),
    h('div', { class: 'tc-tiers' }, tiers.map(([t, n]) => h('span', { class: 'tc-coin t' + t, title: TIER_NAME[t] }, h('i'), String(n))))));
  // up next: the three closest trophies
  const nexts = typeof nextTrophies === 'function' ? nextTrophies(3) : next ? [next] : [];
  if (nexts.length) wrap.append(h('div', { class: 'tc-nexts' }, h('div', { class: 'tc-nexts-h' }, h('span', null, 'Up next')), nexts.map(a => { const pr = achProgress(a); return h('button', { class: 'tc-next', onclick: () => trophySheet(a) }, medalEl(a), h('div', { class: 'grow' }, h('b', null, a.name), h('small', null, a.desc), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } }))), h('span', { class: 'tc-nnum' }, `${pr[0]} / ${pr[1]}`)); })));
  let k = 0;
  wrap.append(h('div', { class: 'tc-cab' }, h('div', { class: 'achs tc-shelves' }, order.map(a => {
    const has = A[a.id], b = h('button', { class: 'tc-slot', 'aria-label': a.name, onclick: () => trophySheet(a) }, medalEl(a));
    if (has) b.style.setProperty('--d', (k++ * 0.09).toFixed(2) + 's');
    return b;
  }))));
  return wrap;
}
function styleSwatch(t) { return h('div', { class: 'swatch' }, h('i', { style: { background: t.light } }), h('i', { style: { background: t.dark } }), h('i', { style: { background: t.dark } }), h('i', { style: { background: t.light } })); }
function pieceArt(t) { const urls = buildPieceSet(t, {}); return h('div', { class: 'pset' }, h('img', { src: urls.wn, alt: '' }), h('img', { src: urls.bq, alt: '' })); }
const SOUND_ART = {
  wood: '<svg viewBox="0 0 48 48"><rect x="7" y="17" width="34" height="16" rx="4" fill="#b57a48" stroke="#4a2a16" stroke-width="2.5"/><path d="M11 22h26M11 27h26" stroke="#7a4a2b" stroke-width="1.6" opacity=".7"/><path d="M30 6l6 9" stroke="#4a2a16" stroke-width="3" stroke-linecap="round"/><circle cx="29" cy="5" r="3.5" fill="#efbb4f" stroke="#4a2a16" stroke-width="2"/><path d="M6 39q4-3 8 0M34 39q4-3 8 0" stroke="#ffe39a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  soft: '<svg viewBox="0 0 48 48"><path d="M24 7c-7 0-11 5-11 12v8l-4 6h30l-4-6v-8c0-7-4-12-11-12z" fill="#ffe39a" stroke="#a8741b" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="37" r="4" fill="#efbb4f" stroke="#a8741b" stroke-width="2.5"/><path d="M5 18q-2 6 1 11M43 18q2 6-1 11" stroke="#9ccfff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  retro: '<svg viewBox="0 0 48 48"><rect x="8" y="9" width="32" height="30" rx="5" fill="#3b4466" stroke="#1b1f2e" stroke-width="2.5"/><path d="M14 16h4v4h-4zM22 16h4v4h-4zM30 16h4v4h-4zM18 24h4v4h-4zM26 24h4v4h-4zM14 32h20v2H14z" fill="#5ef2c2"/><path d="M14 16h4v4h-4zM30 24h4v4h-4z" fill="#ff6fb5"/></svg>',
};
// the moves the Style preview board plays, one per tap
const STYLE_LINE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'e1g1', 'd7d6', 'c2c3', 'a7a6'];
let meView = null;
function renderStyle(main) {
  const st = profile.style = profile.style || {};
  const cur = key => st[key] || { board: BOARD_THEMES[0].id, pieces: PIECE_SETS[0].id, avatar: 'you', sound: 'wood', frame: 'brass', title: 'rank', banner: 'walnut' }[key];
  // live preview: a board that plays a move whenever you change something
  const pv = new BoardView({});
  let ply = 6; const posAt = n => { const p = new E.Position(START_FEN); for (let i = 0; i < n; i++) p.make(p.moveFromUci(STYLE_LINE[i])); return p; };
  const look = { board: cur('board'), pieces: cur('pieces') };
  const paint = () => {
    const bt = BOARD_THEMES.find(t => t.id === look.board) || BOARD_THEMES[0];
    pv.el.style.setProperty('--light', bt.light); pv.el.style.setProperty('--dark', bt.dark);
    const ps = PIECE_SETS.find(t => t.id === look.pieces) || PIECE_SETS[0];
    const urls = look.pieces === cur('pieces') ? PIECE_URL : buildPieceSet(ps, {});
    for (const s in pv.pieceEls) pv.pieceEls[s].style.backgroundImage = `url(${urls[pieceKey(pv.board[s])]})`;
  };
  const step = () => {
    if (ply >= STYLE_LINE.length) { ply = 4; pv.set({ board: posAt(ply).board }); }
    const u = STYLE_LINE[ply], from = sqFromName(u.slice(0, 2)), to = sqFromName(u.slice(2, 4));
    ply++; pv.set({ board: posAt(ply).board, last: [from, to] }, [from, to]); paint();
  };
  pv.set({ board: posAt(ply).board, last: [sqFromName('g8'), sqFromName('f6')] });
  const info = h('div', { class: 'sty-info' });
  let infoTimer = null;
  const showInfo = (it, kind) => {
    clearTimeout(infoTimer); info.innerHTML = '';
    if (!it) {
      const bt = BOARD_THEMES.find(t => t.id === cur('board')) || BOARD_THEMES[0], ps = PIECE_SETS.find(t => t.id === cur('pieces')) || PIECE_SETS[0];
      info.className = 'sty-info';
      const av = AVATAR_CHOICES.find(t => t.id === cur('avatar')) || AVATAR_CHOICES[0], sp = SOUND_PACKS.find(t => t.id === cur('sound')) || SOUND_PACKS[0];
      info.append(h('div', { class: 'grow' }, h('small', null, 'Your look'), h('ul', { class: 'sty-look' }, [['board', bt.name], ['crown', ps.name], ['user', av.name], ['soundOn', sp.name]].map(([ic, n]) => h('li', null, icon(ic, 16), h('span', null, n))))));
      return;
    }
    const ok = reqMet(it.req), pr = reqProgress(it.req);
    info.className = 'sty-info' + (ok ? ' ok' : ' locked');
    info.append(h('div', { class: 'sty-ii' }, icon(ok ? 'check' : 'key', 18)), h('div', { class: 'grow' }, h('small', null, ok ? 'Equipped' : 'Preview: locked'), h('b', null, it.name),
      ok ? null : h('div', { class: 'sty-req' }, reqText(it.req), pr ? h('span', null, `${pr[0]} / ${pr[1]}`) : null),
      !ok && pr ? h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } })) : null));
    if (!ok && kind) infoTimer = setTimeout(() => { if (!info.isConnected) return; look.board = cur('board'); look.pieces = cur('pieces'); paint(); showInfo(null); refreshAll(); }, 4200);
  };
  main.append(h('div', { class: 'sty-stage' }, h('div', { class: 'sty-board' }, pv.el), info));
  paint(); showInfo(null);
  const rows = [];
  const refreshAll = () => rows.forEach(f => f());
  const section = (title, items, key, art) => {
    const owned = items.filter(it => reqMet(it.req)).length;
    const row = h('div', { class: 'sty-row', role: 'listbox', 'aria-label': title });
    const cells = items.map(it => {
      const ok = reqMet(it.req), pr = ok ? null : reqProgress(it.req);
      const cell = h('button', { class: 'sty-item' + (ok ? '' : ' locked'), role: 'option', onclick: () => pick(it, cell) },
        h('div', { class: 'sty-art' }, art(it), ok ? null : h('span', { class: 'lock' }, icon('key', 13))),
        h('b', null, it.name),
        h('small', null, ok ? (key === 'sound' ? it.sub : key === 'title' && it.id === 'rank' ? 'Changes as you level up' : '') : reqShort(it.req)),
        pr ? h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } })) : null,
        h('span', { class: 'sty-on' }, icon('check', 13)));
      cell.dataset.id = it.id; return cell;
    });
    const pick = (it, cell) => {
      haptic(8);
      if (!reqMet(it.req)) {
        beep('error');
        if (key === 'board' || key === 'pieces') { look[key] = it.id; paint(); }
        showInfo(it, key); refreshAll(); cell.classList.add('peek');
        if (typeof fxShake === 'function') fxShake(cell.querySelector('.lock') || cell);
        return;
      }
      const same = cur(key) === it.id;
      st[key] = it.id; saveProfile(); applyStyle();
      look.board = cur('board'); look.pieces = cur('pieces');
      showInfo(it); refreshAll();
      cell.classList.remove('pop'); void cell.offsetWidth; cell.classList.add('pop');
      if (key === 'sound') { beep('move'); setTimeout(() => beep('capture'), 260); setTimeout(() => beep('check'), 520); step(); }
      else { beep(same ? 'tap' : 'pop'); if (!same) { step(); if (typeof fxBurst === 'function') fxBurst(cell, 'sparks', { count: 14 }); } }
      if (key === 'avatar') document.querySelectorAll('.me-av img.av-img').forEach(im => { im.src = avatar(it.id, 8).src; });
      if (key === 'avatar' || key === 'frame' || key === 'title' || key === 'banner') { meRefreshCard(); checkAchievements(); flushRewards(); }
      paint();
    };
    const refresh = () => cells.forEach(c => { c.classList.toggle('on', c.dataset.id === cur(key)); c.classList.toggle('peek', (key === 'board' || key === 'pieces') && look[key] === c.dataset.id && c.dataset.id !== cur(key)); c.setAttribute('aria-selected', c.dataset.id === cur(key) ? 'true' : 'false'); });
    rows.push(refresh); refresh();
    row.append(...cells);
    main.append(h('section', { class: 'sty-sec', 'data-k': key }, h('div', { class: 'sty-head' }, h('h3', null, title), h('span', { class: 'pill' }, `${owned} / ${items.length}`)), row));
    // bring the equipped one into view
    requestAnimationFrame(() => { const on = row.querySelector('.on'); if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2); });
  };
  section('Boards', BOARD_THEMES, 'board', styleSwatch);
  section('Piece sets', PIECE_SETS, 'pieces', pieceArt);
  section('Avatars', AVATAR_CHOICES, 'avatar', t => avatar(t.id, 56));
  section('Avatar frames', FRAMES, 'frame', t => playerBadgeEl(58, { frame: t.id }));
  section('Titles', TITLES, 'title', t => titleArt(t.id === 'rank' ? levelInfo(profile.xp || 0).title : t.name));
  section('Banners', BANNERS, 'banner', t => cosmeticArt(t, 58));
  section('Sounds', SOUND_PACKS, 'sound', t => h('div', { class: 'sty-snd', html: SOUND_ART[t.id] }));
}

// ---------- daily quests ----------
const QUEST_POOL = [
  { id: 'win1', text: 'Win a game against any bot', icon: 'trophy', goal: 1, ev: 'botWin', xp: 40 },
  { id: 'play2', text: 'Play 2 games', icon: 'play', goal: 2, ev: 'gamePlayed', xp: 30 },
  { id: 'puz3', text: 'Solve 3 puzzles', icon: 'puzzle', goal: 3, ev: 'puzzleSolved', xp: 30 },
  { id: 'puz5', text: 'Solve 5 puzzles', icon: 'puzzle', goal: 5, ev: 'puzzleSolved', xp: 45 },
  { id: 'rush8', text: 'Score 8 or more in Puzzle Rush', icon: 'bolt', goal: 1, ev: 'rush8', xp: 40 },
  { id: 'daily', text: 'Solve the Daily Puzzle', icon: 'calendar', goal: 1, ev: 'daily', xp: 25 },
  { id: 'review', text: 'Review a game with the coach', icon: 'search', goal: 1, ev: 'review', xp: 30 },
  { id: 'lesson', text: 'Finish a lesson', icon: 'learn', goal: 1, ev: 'lesson', xp: 30 },
  { id: 'mate', text: 'Win a game by checkmate', icon: 'crown', goal: 1, ev: 'mateWin', xp: 45 },
  { id: 'castle', text: 'Castle in a game', icon: 'castle', goal: 1, ev: 'castled', xp: 20 },
  { id: 'stronger', text: 'Beat a bot rated above you', icon: 'arrowUp', goal: 1, ev: 'upsetWin', xp: 60 },
  { id: 'online', text: 'Play a game in Play the World', icon: 'globe', goal: 1, ev: 'onlineGame', xp: 40 },
];
function questsToday() {
  const key = todayKey();
  profile.quests = profile.quests || {};
  if (profile.quests.day !== key) {
    // pick 3 different quests for today, the same for everyone (seeded by the date)
    let hsh = 0; for (const c of key) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const pool = QUEST_POOL.slice(), picked = [];
    const evs = new Set();
    while (picked.length < 3 && pool.length) { hsh = (hsh * 1103515245 + 12345) >>> 0; const q = pool.splice(hsh % pool.length, 1)[0]; if (evs.has(q.ev)) continue; evs.add(q.ev); picked.push({ id: q.id, n: 0, done: false }); }
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    const streak = profile.quests.allDoneDay === yesterday ? (profile.quests.streak || 0) : 0;
    profile.quests = { day: key, list: picked, streak, allDoneDay: profile.quests.allDoneDay, bonus: false };
    saveProfile();
  }
  return profile.quests;
}
function questEvent(ev, n = 1) {
  const Q = questsToday(); let changed = false;
  for (const q of Q.list) {
    const def = QUEST_POOL.find(x => x.id === q.id); if (!def || q.done || def.ev !== ev) continue;
    q.n = Math.min(def.goal, q.n + n); changed = true;
    if (q.n >= def.goal) { q.done = true; queueReward({ kind: 'quest', def }); grantXP(def.xp, 'Quest'); }
  }
  if (changed && Q.list.every(q => q.done) && !Q.bonus) {
    Q.bonus = true; Q.streak = (Q.streak || 0) + 1; Q.allDoneDay = Q.day;
    queueReward({ kind: 'questsAll', streak: Q.streak }); grantXP(50 + Math.min(10, Q.streak) * 10, 'All quests done');
    inc('questDays');
  }
  if (changed) saveProfile();
}
function questCard() {
  const Q = questsToday();
  return h('div', { class: 'card stack questcard' },
    h('div', { class: 'row' }, h('b', { class: 'grow' }, "Today's quests"), Q.streak ? h('span', { class: 'pill live' }, `${Q.streak} day streak`) : null),
    Q.list.map(q => { const def = QUEST_POOL.find(x => x.id === q.id); return h('div', { class: 'quest' + (q.done ? ' done' : '') }, h('div', { class: 'qi' }, icon(q.done ? 'check' : def.icon, 18)), h('div', { class: 'grow' }, h('div', { class: 'qt' }, def.text), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(q.n / def.goal * 100) + '%' } }))), h('div', { class: 'qx' }, `+${def.xp}`)); }),
    Q.bonus ? h('div', { class: 'small muted center' }, 'All done! Come back tomorrow for new quests.') : h('div', { class: 'small muted center' }, 'Finish all three for a bonus.'));
}
// ---------- confetti ----------
function confetti(ms = 1600) {
  if (profile.style && profile.style.anim === false) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.append(c);
  const ctx = c.getContext('2d'), W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  const cols = ['#ffb547', '#4fd18b', '#6fb3ff', '#ff6b6b', '#c99bff', '#fff3c4'];
  const parts = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 6) * devicePixelRatio, s: (4 + Math.random() * 6) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  const step = t => {
    const k = (t - t0) / ms; ctx.clearRect(0, 0, W, H);
    for (const p of parts) { p.vy += .5 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += p.vr; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
    if (k < 1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// ---------- celebrations ----------
function countUp(el, from, to, ms = 900, fmt = v => String(v)) {
  if (document.body.classList.contains('no-anim') || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function celebrateLevel(lvl) {
  const li = levelInfo(profile.xp || 0), newTitle = levelTitleAt(lvl) !== levelTitleAt(lvl - 1);
  const unlocks = allCosmetics().filter(t => t.req && t.req.level === lvl).map(t => t.name);
  const nx = nextLevelReward(lvl);
  const ov = h('div', { class: 'celebrate', role: 'dialog', 'aria-label': 'Level up' }, h('div', { class: 'rays' }), h('div', { class: 'medal' }, String(lvl)), h('div', { class: 'big' }, 'Level up!'),
    h('div', { class: 'sub' }, newTitle ? `New rank: ${li.title}` : li.title),
    unlocks.length ? h('div', { class: 'sub', style: { color: 'var(--brass-light)' } }, `Unlocked: ${unlocks.join(', ')}`) : null,
    nx ? h('div', { class: 'small muted', style: { position: 'relative', marginTop: '6px' } }, `Next reward at level ${nx.lvl}: ${nx.item.name}`) : null,
    h('div', { class: 'small muted', style: { position: 'relative', marginTop: '10px' } }, 'Tap to continue'));
  const close = () => { if (!ov.isConnected) return; ov.style.opacity = '0'; ov.style.transition = 'opacity .25s'; setTimeout(() => ov.remove(), 260); };
  ov.addEventListener('click', close); setTimeout(close, 4500);
  document.body.append(ov); beep('win'); confetti(1800); haptic(30);
}
// The end of anything worth celebrating: results screen with the XP bar, then a chest with whatever
// was unlocked or earned (boards, piece sets, avatars, trophies), then the button's own action.
function presentResults(o) {
  const R = o.rewards || takeRewards();
  const items = [];
  for (const u of R.unlocks) items.push({ label: u.item.name, sub: u.tier ? `Season tier ${u.tier}` : NEW_LABEL[u.item.kind] || 'Unlocked', art: cosmeticArt(u.item, 72) });
  const trophyCard = a => ({ label: a.name, sub: `${TIER_NAME[a.tier]} trophy: ${a.desc}`, art: badge(a.icon, ['', 'red', 'blue', 'gold'][a.tier]) });
  // a chest shows at most 4 cards: extra trophies fold into one card, extra unlocks into a "more" card
  const achs = R.achs.slice().sort((a, b) => b.tier - a.tier);
  if (items.length + achs.length <= 4) achs.forEach(a => items.push(trophyCard(a)));
  else {
    const slots = 4 - (achs.length ? 1 : 0);
    if (items.length > slots) { const extra = items.splice(slots - 1); items.push({ label: extra.length === 1 ? '1 more reward' : `${extra.length} more rewards`, sub: 'See them in Me > Style', art: badge('sparkle', 'gold') }); }
    if (achs.length === 1) items.push(trophyCard(achs[0]));
    else if (achs.length) items.push({ label: `${achs.length} new trophies`, sub: 'See them in Me > Trophies', art: badge(achs[0].icon, ['', 'red', 'blue', 'gold'][achs[0].tier]) });
  }
  const after = fn => () => { if (items.length && typeof chestReveal === 'function') { const list = items.splice(0); chestReveal({ title: list.length > 1 ? 'Rewards!' : 'Reward!', items: list, onDone: () => { if (R.quests.length) { rewardQueue.push(...R.quests); R.quests = []; } fn && fn(); } }); } else { if (R.quests.length) { rewardQueue.push(...R.quests); R.quests = []; } fn && fn(); } };
  if (typeof resultsScreen !== 'function') { modal((box, close) => box.append(h('h2', { class: 'center' }, o.title), h('p', { class: 'center muted' }, o.subtitle || ''), R.xpGain ? h('p', { class: 'center' }, `+${R.xpGain} XP`) : null, h('div', { class: 'row' }, (o.buttons || []).map(b => h('button', { class: 'btn grow' + (b.primary ? ' primary' : ''), onclick: () => { close(); after(b.on)(); } }, b.label))))); return; }
  return resultsScreen({ mood: o.mood || 'happy', title: o.title, subtitle: o.subtitle, stats: o.stats || [], stars: o.stars, xp: R.xpGain > 0 ? { from: R.xpFrom, to: R.xpTo, levelInfo } : null,
    buttons: (o.buttons || []).map(b => ({ label: b.label, primary: b.primary, on: after(b.on) })) });
}
