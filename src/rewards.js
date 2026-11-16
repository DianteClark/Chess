// Rewards: XP and levels, achievements, and unlockable board themes, piece sets and avatars.
'use strict';

// ---------- XP & levels ----------
const LEVEL_TITLES = ['Newcomer', 'Pawn Pusher', 'Board Explorer', 'Square Scout', 'Fork Finder', 'Pin Master', 'Tactician', 'Strategist', 'Endgame Artist', 'Club Champion', 'Grand Thinker', 'Legend'];
const xpForLevel = lvl => 100 + (lvl - 1) * 60; // XP needed to go from lvl to lvl+1
function levelInfo(xp) {
  let lvl = 1, left = xp;
  while (left >= xpForLevel(lvl)) { left -= xpForLevel(lvl); lvl++; }
  return { lvl, into: left, need: xpForLevel(lvl), title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((lvl - 1) / 3))] };
}
function stats() { profile.stats = profile.stats || {}; return profile.stats; }
function inc(k, n = 1) { const s = stats(); s[k] = (s[k] || 0) + n; return s[k]; }

// ---------- unlockables ----------
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
];
const AVATAR_CHOICES = [
  { id: 'you', name: 'Player', req: null }, { id: 'friend', name: 'Pal', req: null },
  { id: 'pip', name: 'Pip', req: { beat: 1 } }, { id: 'bea', name: 'Bea', req: { beat: 2 } }, { id: 'milo', name: 'Milo', req: { beat: 3 } }, { id: 'rosa', name: 'Rosa', req: { beat: 4 } },
  { id: 'knight', name: 'Sir Knight', req: { beat: 5 } }, { id: 'bo', name: 'Bishop Bo', req: { beat: 6 } }, { id: 'vera', name: 'Queen Vera', req: { beat: 7 } }, { id: 'tower', name: 'The Tower', req: { beat: 8 } },
];

// ---------- achievements ----------
// tier: 1 bronze, 2 silver, 3 gold. test(s, p) runs against stats + profile.
const ACHIEVEMENTS = [
  { id: 'lesson1', name: 'First Steps', desc: 'Finish your first lesson.', icon: 'learn', tier: 1, test: (s, p) => Object.keys(p.lessons).length >= 1 },
  { id: 'lessons5', name: 'Eager Student', desc: 'Finish 5 lessons.', icon: 'book', tier: 1, test: (s, p) => Object.keys(p.lessons).length >= 5 },
  { id: 'lessonsAll', name: 'Graduate', desc: 'Finish every beginner lesson.', icon: 'learn', tier: 2, test: (s, p) => LESSONS.every(l => p.lessons[l.id]) },
  { id: 'course1', name: 'Course Complete', desc: 'Finish a whole course.', icon: 'medal', tier: 2, test: s => (s.coursesDone || 0) >= 1 },
  { id: 'win1', name: 'First Victory', desc: 'Win a game against a bot.', icon: 'trophy', tier: 1, test: s => (s.wins || 0) >= 1 },
  { id: 'win25', name: 'Seasoned', desc: 'Win 25 games against bots.', icon: 'trophy', tier: 2, test: s => (s.wins || 0) >= 25 },
  { id: 'win_mate10', name: 'Checkmate Artist', desc: 'Win 10 games by checkmate.', icon: 'crown', tier: 2, test: s => (s.mates || 0) >= 10 },
  { id: 'beat4', name: 'Bot Hunter', desc: 'Beat 4 different bots.', icon: 'target', tier: 2, test: s => Object.keys(s.beaten || {}).length >= 4 },
  { id: 'beat_tower', name: 'Tower Toppler', desc: 'Beat The Tower.', icon: 'castle', tier: 3, test: s => (s.beaten || {})[8] },
  { id: 'league_knight', name: 'Knight League', desc: 'Reach the Knight League.', icon: 'shield', tier: 1, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 600 },
  { id: 'league_bishop', name: 'Bishop League', desc: 'Reach the Bishop League.', icon: 'shield', tier: 1, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 900 },
  { id: 'league_rook', name: 'Rook League', desc: 'Reach the Rook League.', icon: 'shield', tier: 2, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1200 },
  { id: 'league_queen', name: 'Queen League', desc: 'Reach the Queen League.', icon: 'shield', tier: 2, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1500 },
  { id: 'league_king', name: 'King League', desc: 'Reach the King League.', icon: 'crown', tier: 3, test: (s, p) => p.ladder.games > 0 && (p.ladder.peak || 0) >= 1800 },
  { id: 'bullet', name: 'Lightning Hands', desc: 'Win a 1 minute game.', icon: 'bolt', tier: 2, test: s => (s.bulletWins || 0) >= 1 },
  { id: 'comeback', name: 'Never Give Up', desc: 'Win after being down 5 points of material.', icon: 'muscle', tier: 2, test: s => (s.comebacks || 0) >= 1 },
  { id: 'enpassant', name: 'Sneaky Pawn', desc: 'Capture en passant in a game.', icon: 'ninja', tier: 1, test: s => (s.enPassant || 0) >= 1 },
  { id: 'underpromo', name: 'Surprise!', desc: 'Promote a pawn to something other than a queen.', icon: 'sparkle', tier: 2, test: s => (s.underpromo || 0) >= 1 },
  { id: 'castleq', name: 'Long Castle', desc: 'Castle queenside in a game.', icon: 'castle', tier: 1, test: s => (s.castleQ || 0) >= 1 },
  { id: 'puzzles10', name: 'Puzzle Solver', desc: 'Solve 10 puzzles.', icon: 'puzzle', tier: 1, test: s => (s.puzzles || 0) >= 10 },
  { id: 'puzzles25', name: 'Puzzle Fan', desc: 'Solve 25 puzzles.', icon: 'puzzle', tier: 1, test: s => (s.puzzles || 0) >= 25 },
  { id: 'puzzles100', name: 'Puzzle Master', desc: 'Solve 100 puzzles.', icon: 'puzzle', tier: 3, test: s => (s.puzzles || 0) >= 100 },
  { id: 'patterns', name: 'Museum of Mates', desc: 'Solve every famous checkmate pattern.', icon: 'crown', tier: 2, test: (s, p) => PUZZLES.filter(z => z.cat === 'pattern').every(z => p.tried[z.id] === 1) },
  { id: 'rush10', name: 'Quick Thinker', desc: 'Score 10 in Puzzle Rush.', icon: 'bolt', tier: 1, test: (s, p) => Math.max(0, ...Object.values(p.rushBest || {})) >= 10 },
  { id: 'rush20', name: 'Rush Hour', desc: 'Score 20 in Puzzle Rush.', icon: 'bolt', tier: 2, test: (s, p) => Math.max(0, ...Object.values(p.rushBest || {})) >= 20 },
  { id: 'rush30', name: 'Unstoppable', desc: 'Score 30 in Puzzle Rush.', icon: 'flame', tier: 3, test: (s, p) => Math.max(0, ...Object.values(p.rushBest || {})) >= 30 },
  { id: 'daily3', name: 'Habit Forming', desc: 'Keep a 3 day Daily Puzzle streak.', icon: 'calendar', tier: 1, test: (s, p) => ((p.daily || {}).best || 0) >= 3 },
  { id: 'daily7', name: 'Week Warrior', desc: 'Keep a 7 day Daily Puzzle streak.', icon: 'calendar', tier: 2, test: (s, p) => ((p.daily || {}).best || 0) >= 7 },
  { id: 'daily30', name: 'Unbreakable', desc: 'Keep a 30 day Daily Puzzle streak.', icon: 'flame', tier: 3, test: (s, p) => ((p.daily || {}).best || 0) >= 30 },
  { id: 'review1', name: 'Self Reflection', desc: 'Review a game with the coach.', icon: 'search', tier: 1, test: s => (s.reviews || 0) >= 1 },
  { id: 'review10', name: 'Student of the Game', desc: 'Review 10 games with the coach.', icon: 'search', tier: 2, test: s => (s.reviews || 0) >= 10 },
  { id: 'brilliant', name: 'Brilliant!', desc: 'Play a brilliant move.', icon: 'sparkle', tier: 3, test: s => (s.brilliants || 0) >= 1 },
  { id: 'accuracy90', name: 'Precision', desc: 'Score 90% accuracy in a game of 20+ moves.', icon: 'target', tier: 3, test: s => (s.acc90 || 0) >= 1 },
  { id: 'online1', name: 'Hello, World', desc: 'Play an online game.', icon: 'globe', tier: 1, test: s => (s.onlineGames || 0) >= 1 },
  { id: 'onlinewin', name: 'Worthy Opponent', desc: 'Win an online game.', icon: 'globe', tier: 2, test: s => (s.onlineWins || 0) >= 1 },
  { id: 'stalemate', name: 'So Close', desc: 'Draw a game by stalemate.', icon: 'half', tier: 1, test: s => (s.stalemates || 0) >= 1 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Finish a game between midnight and 5 am.', icon: 'clock', tier: 1, test: s => (s.nightGames || 0) >= 1 },
  { id: 'level5', name: 'Rising Star', desc: 'Reach level 5.', icon: 'star', tier: 1, test: (s, p) => levelInfo(p.xp || 0).lvl >= 5 },
  { id: 'level10', name: 'Shining Star', desc: 'Reach level 10.', icon: 'star', tier: 2, test: (s, p) => levelInfo(p.xp || 0).lvl >= 10 },
  { id: 'level20', name: 'Superstar', desc: 'Reach level 20.', icon: 'star', tier: 3, test: (s, p) => levelInfo(p.xp || 0).lvl >= 20 },
  { id: 'login7', name: 'Loyal Member', desc: 'Claim all 7 daily rewards in a row.', icon: 'calendar', tier: 2, test: (s, p) => ((p.login || {}).best || 0) >= 7 },
  { id: 'login30', name: 'Clubhouse Regular', desc: 'Keep a 30 day login streak.', icon: 'flame', tier: 3, test: (s, p) => ((p.login || {}).best || 0) >= 30 },
  { id: 'world1', name: 'Passport', desc: 'Play a World Games game.', icon: 'globe', tier: 1, test: s => (s.worldGames || 0) >= 1 },
  { id: 'world3', name: 'World Traveler', desc: 'Play 3 different World Games.', icon: 'globe', tier: 2, test: s => Object.keys(s.worldPlayed || {}).length >= 3 },
  { id: 'world6', name: 'Globetrotter', desc: 'Play 6 different World Games.', icon: 'route', tier: 3, test: s => Object.keys(s.worldPlayed || {}).length >= 6 },
  { id: 'worldwin', name: 'Far From Home', desc: 'Beat a bot in a World Game.', icon: 'trophy', tier: 1, test: s => (s.worldWins || 0) >= 1 },
  { id: 'worldmaster', name: 'Grandmaster Abroad', desc: 'Beat a level 8 bot in a World Game.', icon: 'crown', tier: 3, test: s => (s.worldMaster || 0) >= 1 },
  { id: 'chess960', name: 'Shuffled', desc: 'Finish a game of Chess960.', icon: 'dice', tier: 1, test: s => (s.games960 || 0) >= 1 },
];
const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold'];
// how close a locked achievement is: (stats, profile) => [have, need]. One-off feats have no entry.
const ACH_PROG = {
  lessons5: (s, p) => [Object.keys(p.lessons).length, 5], lessonsAll: (s, p) => [LESSONS.filter(l => p.lessons[l.id]).length, LESSONS.length],
  win25: s => [s.wins || 0, 25], win_mate10: s => [s.mates || 0, 10], beat4: s => [Object.keys(s.beaten || {}).length, 4],
  league_knight: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 600], league_bishop: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 900], league_rook: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1200],
  league_queen: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1500], league_king: (s, p) => [p.ladder.games ? p.ladder.peak || 0 : 0, 1800],
  puzzles10: s => [s.puzzles || 0, 10], puzzles25: s => [s.puzzles || 0, 25], puzzles100: s => [s.puzzles || 0, 100],
  patterns: (s, p) => { const z = PUZZLES.filter(q => q.cat === 'pattern'); return [z.filter(q => p.tried[q.id] === 1).length, z.length]; },
  rush10: (s, p) => [Math.max(0, ...Object.values(p.rushBest || {})), 10], rush20: (s, p) => [Math.max(0, ...Object.values(p.rushBest || {})), 20], rush30: (s, p) => [Math.max(0, ...Object.values(p.rushBest || {})), 30],
  daily3: (s, p) => [(p.daily || {}).best || 0, 3], daily7: (s, p) => [(p.daily || {}).best || 0, 7], daily30: (s, p) => [(p.daily || {}).best || 0, 30],
  review10: s => [s.reviews || 0, 10], level5: (s, p) => [levelInfo(p.xp || 0).lvl, 5], level10: (s, p) => [levelInfo(p.xp || 0).lvl, 10], level20: (s, p) => [levelInfo(p.xp || 0).lvl, 20],
  login7: (s, p) => [(p.login || {}).best || 0, 7], login30: (s, p) => [(p.login || {}).best || 0, 30],
  world3: s => [Object.keys(s.worldPlayed || {}).length, 3], world6: s => [Object.keys(s.worldPlayed || {}).length, 6],
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
  return false;
}
function reqText(req) {
  if (!req) return 'Unlocked';
  if (req.level) return `Reach level ${req.level}`;
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? `Achievement: ${a.name}` : 'Achievement'; }
  if (req.beat) return `Beat ${BOT_LEVELS[req.beat - 1].name}`;
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
    for (const t of BOARD_THEMES.concat(PIECE_SETS)) if (t.req && t.req.level && t.req.level > before && t.req.level <= after) queueReward({ kind: 'unlock', item: t });
  }
}
function checkAchievements() {
  profile.ach = profile.ach || {};
  const s = stats(); let any = false;
  for (const a of ACHIEVEMENTS) {
    if (profile.ach[a.id]) continue;
    let ok = false; try { ok = a.test(s, profile); } catch (e) { }
    if (ok) {
      profile.ach[a.id] = Date.now(); any = true;
      queueReward({ kind: 'ach', a });
      for (const t of BOARD_THEMES.concat(PIECE_SETS)) if (t.req && t.req.ach === a.id) queueReward({ kind: 'unlock', item: t });
      grantXP(a.tier * 40, a.name);
    }
  }
  if (any) saveProfile();
}
// central event hook used by the rest of the app
function rewardEvent(type, d = {}) {
  const s = stats();
  const hr = new Date().getHours();
  if (type === 'botGame') {
    const lvlIdx = d.botIndex + 1;
    if (d.score === 1) { inc('wins'); s.beaten = s.beaten || {}; if (!s.beaten[lvlIdx]) { s.beaten[lvlIdx] = Date.now(); const av = AVATAR_CHOICES.find(x => x.req && x.req.beat === lvlIdx); if (av) queueReward({ kind: 'avatar', item: av }); } if (d.reason === 'checkmate') inc('mates'); if (d.tc === '60+0') inc('bulletWins'); }
    if (d.reason === 'stalemate') inc('stalemates');
    inc('botGames');
    grantXP(Math.round((d.score === 1 ? 25 + 6 * lvlIdx : d.score === 0.5 ? 14 : 8) * (d.rated ? 1 : 0.6)), d.score === 1 ? 'Win' : d.score === 0.5 ? 'Draw' : 'Good effort');
    gameFeats(d.moves, d.color, d.score);
  } else if (type === 'onlineGame') {
    inc('onlineGames'); if (d.score === 1) inc('onlineWins');
    grantXP(d.score === 1 ? 45 : d.score === 0.5 ? 25 : 15, 'Online game');
    gameFeats(d.moves, d.color, d.score);
  } else if (type === 'localGame') { grantXP(10, 'Friendly game'); gameFeats(d.moves, null, null); if (d.reason === 'stalemate') inc('stalemates'); }
  else if (type === 'puzzle') { if (d.solved) { inc('puzzles'); grantXP(d.clean ? 12 : 6, 'Puzzle'); } }
  else if (type === 'rush') { grantXP(Math.min(80, d.score * 3), 'Puzzle Rush'); }
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
  if (['botGame', 'onlineGame', 'localGame'].includes(type)) { questEvent('gamePlayed'); if (castledIn(d.moves, d.color)) questEvent('castled'); }
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
    if (mine && (fl & E.F_CASTLE) && (E.mTo(m) & 7) === 2) inc('castleQ');
    pos.make(m);
    if (color) { const c = captured(pos.board); const mineAdv = color === 'w' ? c.diff : -c.diff; worst = Math.min(worst, mineAdv); }
  }
  if (color && score === 1 && worst <= -5) inc('comebacks');
}
function queueReward(r) { rewardQueue.push(r); }
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
  const showNext = () => {
    const r = rewardQueue.shift(); if (!r) { rewardShowing = false; return; }
    rewardShowing = true;
    if (r.kind === 'level') celebrateLevel(r.lvl);
    else if (r.kind === 'ach') rewardToast(icon(r.a.icon, 18), `${TIER_NAME[r.a.tier]} achievement: ${r.a.name}`, r.a.desc, ['', 'bronze', 'silver', 'gold'][r.a.tier]);
    else if (r.kind === 'unlock') rewardToast(icon('sparkle', 18), `Unlocked: ${r.item.name}`, 'Try it in Me > Style', 'gold');
    else if (r.kind === 'avatar') rewardToast(avatar(r.item.id, 22), `New avatar: ${r.item.name}`, 'Pick it in Me > Style', 'gold');
    else if (r.kind === 'quest') rewardToast(icon('check', 18), 'Quest complete!', r.def.text, 'silver');
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
// Level badge + XP bar (used on the player card in Me)
function levelCard() {
  const li = levelInfo(profile.xp || 0);
  return h('div', { class: 'me-lvl' },
    h('div', { class: 'me-lvl-badge', 'aria-label': `Level ${li.lvl}` }, h('b', null, String(li.lvl))),
    h('div', { class: 'grow' },
      h('div', { class: 'me-xpbar' }, h('div', { style: { width: Math.round(li.into / li.need * 100) + '%' } })),
      h('div', { class: 'me-xptxt' }, `${li.into} / ${li.need} XP to level ${li.lvl + 1}`)));
}
// what a locked item still needs: [have, need] or null
function reqProgress(req) {
  if (!req) return null;
  if (req.level) return [Math.min(levelInfo(profile.xp || 0).lvl, req.level), req.level];
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? achProgress(a) : null; }
  return null;
}
function reqShort(req) {
  if (!req) return '';
  if (req.level) return `Level ${req.level}`;
  if (req.ach) { const a = ACHIEVEMENTS.find(x => x.id === req.ach); return a ? a.name : ''; }
  if (req.beat) return `Beat ${BOT_LEVELS[req.beat - 1].name}`;
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
  if (next) { const pr = achProgress(next); wrap.append(h('button', { class: 'tc-next', onclick: () => trophySheet(next) }, medalEl(next), h('div', { class: 'grow' }, h('small', null, 'Almost there'), h('b', null, next.name), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(pr[0] / pr[1] * 100) + '%' } }))), h('span', { class: 'tc-nnum' }, `${pr[0]} / ${pr[1]}`))); }
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
  const cur = key => st[key] || { board: BOARD_THEMES[0].id, pieces: PIECE_SETS[0].id, avatar: 'you', sound: 'wood' }[key];
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
        h('small', null, ok ? (key === 'sound' ? it.sub : '') : reqShort(it.req)),
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
      paint();
    };
    const refresh = () => cells.forEach(c => { c.classList.toggle('on', c.dataset.id === cur(key)); c.classList.toggle('peek', (key === 'board' || key === 'pieces') && look[key] === c.dataset.id && c.dataset.id !== cur(key)); c.setAttribute('aria-selected', c.dataset.id === cur(key) ? 'true' : 'false'); });
    rows.push(refresh); refresh();
    row.append(...cells);
    main.append(h('section', { class: 'sty-sec' }, h('div', { class: 'sty-head' }, h('h3', null, title), h('span', { class: 'pill' }, `${owned} / ${items.length}`)), row));
    // bring the equipped one into view
    requestAnimationFrame(() => { const on = row.querySelector('.on'); if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2); });
  };
  section('Boards', BOARD_THEMES, 'board', styleSwatch);
  section('Piece sets', PIECE_SETS, 'pieces', pieceArt);
  section('Avatars', AVATAR_CHOICES, 'avatar', t => avatar(t.id, 56));
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
  const li = levelInfo(profile.xp || 0);
  const unlocks = BOARD_THEMES.concat(PIECE_SETS).filter(t => t.req && t.req.level === lvl).map(t => t.name);
  const ov = h('div', { class: 'celebrate', role: 'dialog', 'aria-label': 'Level up' }, h('div', { class: 'rays' }), h('div', { class: 'medal' }, String(lvl)), h('div', { class: 'big' }, 'Level up!'), h('div', { class: 'sub' }, li.title),
    unlocks.length ? h('div', { class: 'sub', style: { color: 'var(--brass-light)' } }, 'Unlocked: ' + unlocks.join(', ')) : null, h('div', { class: 'small muted', style: { position: 'relative', marginTop: '10px' } }, 'Tap to continue'));
  const close = () => { if (!ov.isConnected) return; ov.style.opacity = '0'; ov.style.transition = 'opacity .25s'; setTimeout(() => ov.remove(), 260); };
  ov.addEventListener('click', close); setTimeout(close, 4500);
  document.body.append(ov); beep('win'); confetti(1800); haptic(30);
}
// The end of anything worth celebrating: results screen with the XP bar, then a chest with whatever
// was unlocked or earned (boards, piece sets, avatars, trophies), then the button's own action.
function presentResults(o) {
  const R = o.rewards || takeRewards();
  const items = [];
  for (const u of R.unlocks) {
    if (u.kind === 'avatar') items.push({ label: u.item.name, sub: 'New avatar', art: avatar(u.item.id, 72) });
    else { const t = u.item, isBoard = !!t.light; items.push({ label: t.name, sub: isBoard ? 'New board' : 'New piece set', art: isBoard ? `<svg viewBox="0 0 4 4" width="72" height="72">${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(f => `<rect x="${f}" y="${r}" width="1" height="1" fill="${(r + f) % 2 ? t.dark : t.light}"/>`).join('')).join('')}</svg>` : h('img', { src: PIECE_URL.wn, width: 72, height: 72 }) }); }
  }
  for (const a of R.achs) items.push({ label: a.name, sub: `${TIER_NAME[a.tier]} trophy: ${a.desc}`, art: badge(a.icon, ['', 'bronze', 'silver', 'gold'][a.tier] === 'bronze' ? 'red' : ['', 'bronze', 'silver', 'gold'][a.tier] === 'silver' ? 'blue' : 'gold') });
  const after = fn => () => { if (items.length && typeof chestReveal === 'function') { const list = items.splice(0); chestReveal({ title: list.length > 1 ? 'Rewards!' : 'Reward!', items: list, onDone: () => { if (R.quests.length) { rewardQueue.push(...R.quests); R.quests = []; } fn && fn(); } }); } else { if (R.quests.length) { rewardQueue.push(...R.quests); R.quests = []; } fn && fn(); } };
  if (typeof resultsScreen !== 'function') { modal((box, close) => box.append(h('h2', { class: 'center' }, o.title), h('p', { class: 'center muted' }, o.subtitle || ''), R.xpGain ? h('p', { class: 'center' }, `+${R.xpGain} XP`) : null, h('div', { class: 'row' }, (o.buttons || []).map(b => h('button', { class: 'btn grow' + (b.primary ? ' primary' : ''), onclick: () => { close(); after(b.on)(); } }, b.label))))); return; }
  return resultsScreen({ mood: o.mood || 'happy', title: o.title, subtitle: o.subtitle, stats: o.stats || [], stars: o.stars, xp: R.xpGain > 0 ? { from: R.xpFrom, to: R.xpTo, levelInfo } : null,
    buttons: (o.buttons || []).map(b => ({ label: b.label, primary: b.primary, on: after(b.on) })) });
}
