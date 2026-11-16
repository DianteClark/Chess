// Bot personalities + opening book. Shared by the app and the calibration script.
const BOT_LEVELS = [
  { id: 1, name: 'Pip',        avatar: '🐣', blurb: 'Just learned how the pieces move.',         depth: 1, nodes: 2000,   noise: 160, blunder: 0.45, book: 0 },
  { id: 2, name: 'Bea',        avatar: '🐝', blurb: 'Likes grabbing pieces. Forgets to defend.', depth: 1, nodes: 3000,   noise: 100, blunder: 0.27, book: 0 },
  { id: 3, name: 'Milo',       avatar: '🦊', blurb: 'Spots free pieces, misses traps.',          depth: 1, nodes: 5000,   noise: 60,  blunder: 0.13, book: 2 },
  { id: 4, name: 'Rosa',       avatar: '🦉', blurb: 'Careful, but misses tricks.',               depth: 2, nodes: 10000,  noise: 45,  blunder: 0.08, book: 4 },
  { id: 5, name: 'Sir Knight', avatar: '🐴', blurb: 'Plays solid, loves forks.',                 depth: 2, nodes: 20000,  noise: 25,  blunder: 0.03, book: 6 },
  { id: 6, name: 'Bishop Bo',  avatar: '🧙', blurb: 'Thinks a few moves deep.',                  depth: 3, nodes: 40000,  noise: 15,  blunder: 0.01, book: 8 },
  { id: 7, name: 'Queen Vera', avatar: '👑', blurb: 'Strong club player.',                       depth: 5, nodes: 80000,  noise: 6,   blunder: 0.0,  book: 10 },
  { id: 8, name: 'The Tower',  avatar: '🏰', blurb: 'Full strength. Good luck!',                depth: 64, nodes: 350000, noise: 0,   blunder: 0.0,  book: 12 },
];
// A small book of sound openings (SAN). Bots follow a random line for `book` plies.
const OPENINGS = [
  ['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6'], ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6'],
  ['e4','e5','Nf3','Nc6','d4','exd4','Nxd4','Nf6'], ['e4','e5','Nf3','Nf6','Nxe5','d6','Nf3','Nxe4'],
  ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6'], ['e4','c5','Nf3','Nc6','d4','cxd4','Nxd4','g6'],
  ['e4','c5','Nc3','Nc6','g3','g6','Bg2','Bg7'], ['e4','e6','d4','d5','Nc3','Nf6','Bg5','Be7'],
  ['e4','e6','d4','d5','e5','c5','c3','Nc6'], ['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5'],
  ['e4','d5','exd5','Qxd5','Nc3','Qa5','d4','Nf6'], ['e4','d6','d4','Nf6','Nc3','g6','Nf3','Bg7'],
  ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7'], ['d4','d5','c4','c6','Nf3','Nf6','Nc3','dxc4'],
  ['d4','d5','c4','dxc4','Nf3','Nf6','e3','e6'], ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6'],
  ['d4','Nf6','c4','e6','Nc3','Bb4','e3','O-O'], ['d4','Nf6','c4','e6','Nf3','b6','g3','Bb7'],
  ['d4','d5','Nf3','Nf6','Bf4','e6','e3','c5'], ['d4','f5','g3','Nf6','Bg2','g6','Nf3','Bg7'],
  ['c4','e5','Nc3','Nf6','Nf3','Nc6','g3','d5'], ['c4','c5','Nc3','Nc6','g3','g6','Bg2','Bg7'],
  ['Nf3','d5','g3','Nf6','Bg2','e6','O-O','Be7'], ['Nf3','Nf6','c4','b6','g3','Bb7','Bg2','e6'],
  ['e4','e5','Nc3','Nf6','f4','d5','fxe5','Nxe4'], ['e4','e5','f4','exf4','Nf3','g5','h4','g4'],
  ['e4','Nf6','e5','Nd5','d4','d6','Nf3','Bg4'], ['e4','g6','d4','Bg7','Nc3','d6','Be3','a6'],
  ['d4','e6','c4','Bb4+','Bd2','Qe7','Nf3','Nf6'], ['e4','e5','Nf3','d6','d4','Nf6','Nc3','Nbd7'],
];
// pick a bot move. rng: () => [0,1). salt: per-game number. Returns uci string.
function botChooseMove(E, searcher, pos, level, rng, salt, plyIndex, bookLine) {
  const legal = pos.legalMoves();
  if (!legal.length) return null;
  if (bookLine && plyIndex < level.book && plyIndex < bookLine.length) {
    const m = pos.moveFromSan(bookLine[plyIndex]);
    if (m) return { uci: pos.uci(m), book: true };
  }
  if (level.blunder && rng() < level.blunder) {
    const m = legal[Math.floor(rng() * legal.length)];
    return { uci: pos.uci(m), blunder: true };
  }
  const r = searcher.search(pos, { maxDepth: level.depth, maxNodes: level.nodes, noise: level.noise, salt });
  return { uci: pos.uci(r.move || legal[0]), score: r.score, depth: r.depth };
}
if (typeof module !== 'undefined') module.exports = { BOT_LEVELS, OPENINGS, botChooseMove };
