// Game Review + Coach. Stockfish (vendor/stockfish) grades every move; when Stockfish can't load
// (e.g. the page was opened as a local file) the built-in engine is used instead.
// The coach turns engine numbers into plain-language advice a kid or adult can act on.
'use strict';
const PNAME = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
const PVAL = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
const CLASSES = {
  brilliant: { label: 'Brilliant', sym: '!!', color: '#22c3c3' },
  great: { label: 'Great', sym: '!', color: '#5b8def' },
  best: { label: 'Best', sym: '', color: '#7cc04a', icon: 'star' },
  excellent: { label: 'Excellent', sym: '', color: '#93c45a', icon: 'check' },
  good: { label: 'Good', sym: '', color: '#a0b77c', icon: 'check' },
  book: { label: 'Book', sym: '', color: '#b08a63', icon: 'book' },
  inaccuracy: { label: 'Inaccuracy', sym: '?!', color: '#f2c94c' },
  mistake: { label: 'Mistake', sym: '?', color: '#f2994a' },
  miss: { label: 'Miss', sym: 'x', color: '#ef7d6b' },
  blunder: { label: 'Blunder', sym: '??', color: '#e5484d' },
};
const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
const winPct = cp => 100 / (1 + Math.exp(-0.00368208 * cp));
const moveAccuracy = (before, after) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, before - after)) - 3.1669));
const scoreToCp = l => l.mate != null ? (l.mate > 0 ? 10000 - l.mate * 10 : -10000 - l.mate * 10) : l.scoreCp;

// ---------- engine access ----------
let sfState = null; // null untried, true ok, false failed
let sf960 = false;
async function analyzePos(fen, multipv, depth) {
  if (sfState !== false && typeof SF !== 'undefined') {
    try {
      if (sfState === null) { await SF.ready(); sfState = true; }
      const want960 = /[A-Ha-h]/.test((fen.split(' ')[2]) || '-');
      if (want960 !== sf960) { await SF.setOption('UCI_Chess960', want960 ? 'true' : 'false'); sf960 = want960; }
      const r = await SF.analyze(fen, { depth, multipv, timeout: 15000 });
      if (r && r.lines && r.lines.length) return r.lines.map(l => ({ cp: scoreToCp(l), mate: l.mate, pv: l.pv || [] }));
    } catch (e) { sfState = false; }
  }
  // fallback: built-in engine, single best line
  const r = await engineRequest({ kind: 'best', fen, moves: [], nodes: 60000 });
  if (!r.uci) return [];
  const mate = Math.abs(r.score) > E.MATE - 500 ? Math.sign(r.score) * Math.ceil((E.MATE - Math.abs(r.score)) / 2) : null;
  return [{ cp: mate != null ? (mate > 0 ? 10000 - mate * 10 : -10000 - mate * 10) : r.score, mate, pv: [r.uci] }];
}
const engineName = () => sfState === true ? 'Stockfish 19' : sfState === false ? 'Knight Club engine' : 'engine';

// ---------- small board helpers for the coach ----------
function posWith(fen, moves) { const p = new E.Position(fen); for (const u of moves || []) { const m = p.moveFromUci(u); if (!m) break; p.make(m); } return p; }
function material(pos, side) { let v = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.board[s]; if (p && ((p & 8) ? 1 : 0) === side) v += PVAL[p & 7]; } return v; }
function balance(pos, side) { return material(pos, side) - material(pos, side ^ 1); }
// pseudo moves for any side (switch side to move through FEN)
function movesFor(pos, side) { const f = pos.fen().split(' '); f[1] = side ? 'b' : 'w'; f[3] = '-'; try { const q = new E.Position(f.join(' ')); return q.genMoves().map(m => ({ from: E.mFrom(m), to: E.mTo(m), m })); } catch (e) { return []; } }
function attackersOf(pos, sq, side) {
  // pieces of `side` that can capture on sq (put a dummy enemy piece there if needed)
  const f = pos.fen().split(' '); const q = new E.Position(f.join(' '));
  const orig = q.board[sq];
  if (!orig || (((orig & 8) ? 1 : 0) === side)) q.board[sq] = side ? 1 : 9;
  const arr = movesFor(q, side).filter(x => x.to === sq).map(x => PVAL[q.board[x.from] & 7] || 100);
  return arr.sort((a, b) => a - b);
}
function hanging(pos, sq) {
  // is the piece on sq losing material to a capture? returns piece value lost or 0
  const p = pos.board[sq]; if (!p) return 0; const side = (p & 8) ? 1 : 0, val = PVAL[p & 7];
  if (!val) return 0;
  const att = attackersOf(pos, sq, side ^ 1); if (!att.length) return 0;
  const def = attackersOf(pos, sq, side);
  if (!def.length) return val;
  if (att[0] < val) return val - att[0];
  return 0;
}
function sanAt(fen, moves, uci) { const p = posWith(fen, moves); const m = p.moveFromUci(uci); return m ? p.san(m) : uci; }
function pvSan(fen, moves, pv, n) { const p = posWith(fen, moves), out = []; for (const u of pv.slice(0, n)) { const m = p.moveFromUci(u); if (!m) break; out.push(p.san(m)); p.make(m); } return out; }
// material swing for `side` after playing the first n plies of pv
function pvGain(fen, moves, pv, side, n = 4) {
  const p = posWith(fen, moves), b0 = balance(p, side); let best = b0, last = b0;
  for (const u of pv.slice(0, n)) { const m = p.moveFromUci(u); if (!m) break; p.make(m); last = balance(p, side); }
  return last - b0;
}
function moveFacts(fen, moves, uci) {
  const p = posWith(fen, moves), m = p.moveFromUci(uci); if (!m) return {};
  const side = p.turn, from = E.mFrom(m), to = E.mTo(m), piece = p.board[from] & 7, capt = (E.mFlags(m) & E.F_EP) ? 1 : (p.board[to] & 7);
  p.make(m);
  const check = p.inCheck(), mate = p.status().reason === 'checkmate';
  // fork: the moved piece now attacks 2+ enemy pieces worth more than it, or the king plus something loose
  const targets = [];
  for (const x of movesFor(p, side)) if (x.from === to) { const t = p.board[x.to]; if (t && ((t & 8) ? 1 : 0) !== side) targets.push(t & 7); }
  const valuable = targets.filter(t => t === 6 || PVAL[t] > PVAL[piece] || hanging(p, 0) >= 0 && PVAL[t] >= 3);
  const fork = valuable.length >= 2;
  const leavesHanging = hanging(p, to);
  return { piece, capt, check, mate, fork, targets, leavesHanging, to, from, side };
}
const sqLabel = sq => E.sqName(sq);
function wpWords(wp) {
  if (wp >= 97) return 'completely winning'; if (wp >= 85) return 'winning'; if (wp >= 68) return 'clearly better'; if (wp >= 57) return 'a little better';
  if (wp > 43) return 'about equal'; if (wp > 32) return 'a little worse'; if (wp > 15) return 'clearly worse'; if (wp > 3) return 'losing'; return 'completely lost';
}
const pieceWithArticle = t => (t === 1 ? 'a ' : t === 2 ? 'a ' : t === 3 ? 'a ' : t === 4 ? 'a ' : t === 5 ? 'the ' : 'the ') + PNAME[t];

// ---------- the coach ----------
function coachExplain(R, i) {
  const mv = R.moves[i], fen = R.startFen, before = R.uciMoves.slice(0, i), side = mv.side;
  const you = R.color ? (side === R.color ? 'you' : R.oppName) : (side === 'w' ? 'White' : 'Black');
  const You = you.charAt(0).toUpperCase() + you.slice(1), them = side === 'w' ? 'Black' : 'White';
  const lines = [];
  const bestSan = mv.best ? sanAt(fen, before, mv.best) : null;
  const facts = moveFacts(fen, before, mv.uci);
  const nextLine = R.pos[i + 1] && R.pos[i + 1].lines[0];
  const cls = mv.cls;
  if (cls === 'book') return `${mv.san} is a well-known opening move. ${openingName(R.uciMoves.slice(0, i + 1)) ? 'This is the ' + openingName(R.uciMoves.slice(0, i + 1)) + '.' : 'Good players have played it many times.'}`;
  if (facts.mate) return `${mv.san} is checkmate. Game over!`;
  if (cls === 'brilliant') lines.push(`${mv.san} is brilliant! ${You} gave up material on purpose, and it works: the engine agrees it is the best move.`);
  else if (cls === 'great') lines.push(`${mv.san} is a great find. It was the only good move here; everything else would have been ${wpWords(100 - R.pos[i].second || 50)} at best.`);
  else if (cls === 'best') lines.push(`${mv.san} is the best move here.${facts.fork ? ' It attacks two pieces at once, a fork!' : facts.check ? ' It also gives check, keeping the initiative.' : ''}`);
  else if (cls === 'excellent' || cls === 'good') lines.push(`${mv.san} is ${cls === 'excellent' ? 'an excellent' : 'a good'} move. ${bestSan && bestSan !== mv.san ? `The engine slightly preferred ${bestSan}.` : ''}`);
  if (['inaccuracy', 'mistake', 'blunder', 'miss'].includes(cls)) {
    const art = { inaccuracy: 'an inaccuracy', miss: 'a missed chance', mistake: 'a mistake', blunder: 'a blunder' }[cls] || cls;
    lines.push(`${mv.san} is ${art}.`);
    const after = R.uciMoves.slice(0, i + 1), mySide = side === 'w' ? 0 : 1;
    // 1. what does the move allow?
    if (nextLine && nextLine.mate != null && nextLine.mate > 0) {
      const seq = pvSan(fen, after, nextLine.pv, Math.min(nextLine.mate * 2 - 1, 5));
      lines.push(`It allows checkmate in ${nextLine.mate}: ${seq.join(' ')}.`);
    } else if (facts.leavesHanging >= 2 && nextLine) {
      lines.push(`It leaves the ${PNAME[facts.piece]} on ${sqLabel(facts.to)} ${facts.leavesHanging >= PVAL[facts.piece] ? 'undefended' : 'open to a cheaper attacker'}, so ${them} can win it.`);
    } else if (nextLine && nextLine.pv.length) {
      const loss = -pvGain(fen, after, nextLine.pv, mySide, 4);
      const reply = pvSan(fen, after, nextLine.pv, 1)[0];
      if (loss >= 1) lines.push(`After it, ${them} can play ${reply}, winning ${loss >= 9 ? 'the queen' : loss >= 5 ? 'a rook\'s worth of material' : loss >= 3 ? 'a piece' : loss >= 2 ? 'material' : 'a pawn'}.`);
      else if (mv.wpAfter < 43 && mv.wpBest >= 43) lines.push(`It hands ${them} the better position. Their best reply is ${reply}.`);
      else if (cls === 'inaccuracy') lines.push(mv.wpBest >= 57 ? `It is playable, but it gives away part of ${you === 'you' ? 'your' : 'the'} advantage.` : 'It is playable, but there was a more useful move.');
      else if (reply) lines.push(`${them}'s strongest reply is ${reply}.`);
    }
    // 2. what was better, and why?
    if (mv.best && mv.best !== mv.uci) {
      const bf = moveFacts(fen, before, mv.best);
      const bestLine = R.pos[i].lines[0];
      let guards = null;
      if (nextLine && nextLine.pv[0]) {
        const target = sqFromName(nextLine.pv[0].slice(2, 4));
        const d0 = attackersOf(posWith(fen, before), target, mySide).length;
        const d1 = attackersOf(posWith(fen, before.concat([mv.best])), target, mySide).length;
        if (d1 > d0 || bf.to === target) guards = E.sqName(target);
      }
      const gain = bestLine ? pvGain(fen, before, bestLine.pv, mySide, 4) : 0;
      const capTxt = bf.capt ? `captures the ${PNAME[bf.capt]} on ${sqLabel(bf.to)}${bf.check ? ' with check' : ''}` : '';
      let why;
      if (bestLine && bestLine.mate != null && bestLine.mate > 0) why = `It leads to checkmate in ${bestLine.mate}: ${pvSan(fen, before, bestLine.pv, Math.min(bestLine.mate * 2 - 1, 5)).join(' ')}.`;
      else if (guards && mv.allowedMate) why = `It protects ${guards}, so the checkmate is no longer possible.`;
      else if (bf.capt && gain >= 2) why = `It ${capTxt} and wins material.`;
      else if (bf.capt) why = `It ${capTxt}, keeping the material balance.`;
      else if (bf.fork) why = `It is a fork: the ${PNAME[bf.piece]} attacks two targets at once.`;
      else if (gain >= 2) why = `It wins material by force: ${pvSan(fen, before, bestLine.pv, 4).join(' ')}.`;
      else if (bf.check) why = 'It gives check and keeps the initiative.';
      else if (facts.leavesHanging >= 2) why = `It keeps your pieces protected.`;
      else if (guards && bf.to === sqFromName(guards)) why = `It grabs the ${guards} square before ${them} can use it.`;
      else if (guards) why = `It covers ${guards}, the square ${them} wanted to use.`;
      else { const cont = bestLine ? pvSan(fen, before, bestLine.pv, 3).join(' ') : ''; why = cont ? `The engine's plan was ${cont}.` : ''; }
      lines.push(`Better was ${bestSan}. ${why}`);
    }
    if (cls === 'miss') lines.push(`${them === 'White' || them === 'Black' ? them : 'Your opponent'} had just made a mistake, and this was the moment to punish it.`);
    const w0 = wpWords(mv.wpBest), w1 = wpWords(mv.wpAfter);
    if (w0 !== w1) lines.push(`The position went from ${w0} to ${w1} for ${you}.`);
  }
  return lines.filter(Boolean).join(' ');
}
function coachSummary(R) {
  const side = R.color || 'w';
  const mine = R.moves.filter(m => m.side === side);
  const cnt = k => mine.filter(m => m.cls === k).length;
  const acc = R.acc[side];
  const tips = [];
  const hangs = mine.filter(m => m.leftHanging && ['mistake', 'blunder'].includes(m.cls)).length;
  const missedWins = mine.filter(m => m.cls === 'miss' || (['mistake', 'blunder', 'inaccuracy'].includes(m.cls) && m.bestWasCapture)).length;
  const allowedMates = mine.filter(m => m.allowedMate).length;
  const opening = R.phaseAcc[side].opening, middle = R.phaseAcc[side].middlegame, end = R.phaseAcc[side].endgame;
  let headline;
  if (acc >= 90) headline = 'Outstanding game! You played like a strong club player.';
  else if (acc >= 80 && !cnt('blunder')) headline = 'Very solid game with only a few slips.';
  else if (acc >= 80) headline = 'Mostly strong play, but one big moment changed the game.';
  else if (acc >= 65) headline = 'A decent game. A few moments decided it, and they are easy to learn from.';
  else headline = 'A tough game, but every mistake here is a lesson you can use next time.';
  if (hangs) tips.push((hangs > 1 ? `You left a piece unprotected ${hangs} times. Before each move, check that the piece you move is safe on its new square.` : `You left a piece unprotected ${hangs} time. Before each move, check that the piece you move is safe on its new square.`));
  if (allowedMates) tips.push(`You allowed a checkmate. When your king is near open lines, look at every check your opponent could give.`);
  if (missedWins) tips.push((missedWins > 1 ? `You missed ${missedWins} chances to win material. Each turn, scan for captures, checks and threats: "checks, captures, attacks".` : `You missed ${missedWins} chance to win material. Each turn, scan for captures, checks and threats: "checks, captures, attacks".`));
  const phases = [['opening', opening], ['middlegame', middle], ['endgame', end]].filter(x => x[1] != null).sort((a, b) => a[1] - b[1]);
  if (phases.length > 1 && phases[0][1] < phases[phases.length - 1][1] - 10) tips.push(`Your weakest phase was the ${phases[0][0]} (${Math.round(phases[0][1])}% accuracy). ${phases[0][0] === 'opening' ? 'The Openings course in Learn can help.' : phases[0][0] === 'endgame' ? 'The Endgame course in Learn can help.' : 'Try Puzzle Rush to sharpen your tactics.'}`);
  if (!tips.length) tips.push('Keep playing like this, and try a stronger opponent!');
  return { headline, tips, best: cnt('best') + cnt('great') + cnt('brilliant'), blunders: cnt('blunder') };
}

// ---------- openings (names for book moves) ----------
const OPENING_NAMES = [
  ['e2e4 e7e5 g1f3 b8c6 f1b5', 'Ruy Lopez'], ['e2e4 e7e5 g1f3 b8c6 f1c4', 'Italian Game'], ['e2e4 e7e5 g1f3 b8c6 d2d4', 'Scotch Game'], ['e2e4 e7e5 g1f3 g8f6', 'Petrov Defense'],
  ['e2e4 e7e5 f2f4', "King's Gambit"], ['e2e4 e7e5 b1c3', 'Vienna Game'], ['e2e4 e7e5 g1f3 d7d6', 'Philidor Defense'], ['e2e4 c7c5', 'Sicilian Defense'], ['e2e4 e7e6', 'French Defense'],
  ['e2e4 c7c6', 'Caro-Kann Defense'], ['e2e4 d7d5', 'Scandinavian Defense'], ['e2e4 g8f6', "Alekhine's Defense"], ['e2e4 d7d6', 'Pirc Defense'], ['e2e4 g7g6', 'Modern Defense'],
  ['d2d4 d7d5 c2c4 e7e6', "Queen's Gambit Declined"], ['d2d4 d7d5 c2c4 d5c4', "Queen's Gambit Accepted"], ['d2d4 d7d5 c2c4 c7c6', 'Slav Defense'], ['d2d4 d7d5 c2c4', "Queen's Gambit"],
  ['d2d4 g8f6 c2c4 g7g6', "King's Indian Defense"], ['d2d4 g8f6 c2c4 e7e6 b1c3 f8b4', 'Nimzo-Indian Defense'], ['d2d4 g8f6 c2c4 e7e6 g1f3 b7b6', "Queen's Indian Defense"],
  ['d2d4 d7d5 g1f3 g8f6 c1f4', 'London System'], ['d2d4 g8f6 g1f3 e7e6 c1f4', 'London System'], ['d2d4 f7f5', 'Dutch Defense'], ['c2c4', 'English Opening'], ['g1f3', 'Reti Opening'],
  ['e2e4 e7e5', "King's Pawn Game"], ['d2d4 d7d5', "Queen's Pawn Game"], ['d2d4 g8f6', 'Indian Defense'],
];
function openingName(ucis) {
  const s = ucis.join(' '); let best = null, bl = 0;
  for (const [seq, name] of OPENING_NAMES) if ((s + ' ').startsWith(seq + ' ') && seq.length > bl) { best = name; bl = seq.length; }
  return best;
}
// book: the first moves that follow a line in our opening book
let BOOK_SET = null;
function isBookMove(ucis, i, startFen) {
  if (i >= 12 || (startFen && startFen !== START_FEN)) return false;
  if (!BOOK_SET) {
    BOOK_SET = new Set();
    for (const line of OPENINGS) { const p = new E.Position(); const acc = []; for (const san of line) { const m = p.moveFromSan(san); if (!m) break; acc.push(p.uci(m)); BOOK_SET.add(acc.join(' ')); p.make(m); } }
    for (const [seq] of OPENING_NAMES) { const parts = seq.split(' '); for (let k = 1; k <= parts.length; k++) BOOK_SET.add(parts.slice(0, k).join(' ')); }
  }
  return BOOK_SET.has(ucis.slice(0, i + 1).join(' '));
}

// ---------- running a review ----------
let REV = null; // current review
function openReview(src) {
  // src: {moves, color, white, black, startFen?, title?}
  REV = { src, startFen: src.startFen || START_FEN, uciMoves: src.moves.slice(), color: src.color || null, oppName: (src.color === 'w' ? src.black : src.white) || 'your opponent', pos: [], moves: [], done: false, i: 0, progress: 0 };
  const prevRoute = route; REV.back = prevRoute;
  route = 'review'; render(); window.scrollTo(0, 0);
  runReview(REV);
}
async function runReview(R) {
  const fens = [], p = new E.Position(R.startFen);
  fens.push(p.fen());
  for (const u of R.uciMoves) { const m = p.moveFromUci(u); if (!m) break; p.make(m); fens.push(p.fen()); }
  const depth = 13;
  for (let k = 0; k < fens.length; k++) {
    if (REV !== R) return; // review closed
    const pos = new E.Position(fens[k]);
    let lines;
    if (pos.status().over) lines = [];
    else lines = await analyzePos(fens[k], 2, depth);
    R.pos[k] = { fen: fens[k], lines, turn: pos.turn === 0 ? 'w' : 'b', over: pos.status() };
    R.progress = (k + 1) / fens.length;
    if (reviewProgressHook) reviewProgressHook();
  }
  finalizeReview(R);
}
function evalWhite(P) {
  // eval of a position from White's view, in cp
  if (!P.lines.length) { if (P.over.reason === 'checkmate') return P.turn === 'w' ? -10000 : 10000; return 0; }
  const cp = P.lines[0].cp; return P.turn === 'w' ? cp : -cp;
}
function finalizeReview(R) {
  const N = R.uciMoves.length;
  R.evals = R.pos.map(evalWhite);
  R.moves = [];
  const accs = { w: [], b: [] }, phaseAccs = { w: { opening: [], middlegame: [], endgame: [] }, b: { opening: [], middlegame: [], endgame: [] } };
  for (let i = 0; i < N; i++) {
    const P = R.pos[i], side = P.turn, sgn = side === 'w' ? 1 : -1;
    const uci = R.uciMoves[i];
    const before = R.evals[i] * sgn, after = R.evals[i + 1] * sgn;
    const wpBefore = winPct(before), wpAfter = winPct(after);
    const best = P.lines[0] ? P.lines[0].pv[0] : null;
    const second = P.lines[1] ? winPct(P.lines[1].cp) : null;
    const wpBest = P.lines[0] ? winPct(P.lines[0].cp) : wpBefore;
    let loss = Math.max(0, wpBest - wpAfter);
    if (uci === best) loss = 0;
    const acc = moveAccuracy(wpBest, uci === best ? wpBest : wpAfter);
    accs[side].push(acc);
    const pos = new E.Position(P.fen);
    const nonPawn = (() => { let n = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const t = pos.board[s] & 7; if (t >= 2 && t <= 5) n += PVAL[t]; } return n; })();
    const phase = i < 20 && nonPawn > 50 ? 'opening' : nonPawn <= 26 ? 'endgame' : 'middlegame';
    phaseAccs[side][phase].push(acc);
    const facts = moveFacts(R.startFen, R.uciMoves.slice(0, i), uci);
    let cls;
    if (isBookMove(R.uciMoves, i, R.startFen) && loss < 3) cls = 'book';
    else if (loss <= 0.5) cls = 'best'; else if (loss < 2) cls = 'excellent'; else if (loss < 5) cls = 'good'; else if (loss < 10) cls = 'inaccuracy'; else if (loss < 20) cls = 'mistake'; else cls = 'blunder';
    // great: the only good move
    if ((cls === 'best') && second != null && wpBest - second >= 15 && wpBefore < 92) cls = 'great';
    // brilliant: a correct sacrifice in a position that wasn't already won
    const material0 = balance(pos, side === 'w' ? 0 : 1);
    const sacrificed = facts.leavesHanging >= 2 && (!facts.capt || PVAL[facts.capt] < PVAL[facts.piece]);
    if ((cls === 'best' || cls === 'great' || cls === 'excellent') && sacrificed && wpBefore < 85 && wpAfter >= 45 && facts.piece !== 1) cls = 'brilliant';
    // miss: the opponent just erred and you failed to punish
    const prev = R.moves[i - 1];
    if (prev && ['mistake', 'blunder'].includes(prev.cls) && (cls === 'mistake' || cls === 'blunder' || cls === 'inaccuracy') && wpBest >= 65) cls = 'miss';
    const nextLine = R.pos[i + 1] && R.pos[i + 1].lines[0];
    R.moves.push({ i, uci, side, san: new E.Position(P.fen).san(new E.Position(P.fen).moveFromUci(uci)), best, cls, loss, wpBefore: wpBest, wpAfter, wpBest, acc, phase,
      leftHanging: facts.leavesHanging >= 2, allowedMate: !!(nextLine && nextLine.mate > 0), bestWasCapture: best && best !== uci && moveFacts(R.startFen, R.uciMoves.slice(0, i), best).capt >= 2, material0 });
  }
  // game accuracy: blend of mean and harmonic mean (punishes big blunders, like most sites)
  const gameAcc = a => { if (!a.length) return null; const mean = a.reduce((x, y) => x + y, 0) / a.length; const harm = a.length / a.reduce((x, y) => x + 1 / Math.max(5, y), 0); return Math.round((mean + harm) / 2 * 10) / 10; };
  R.acc = { w: gameAcc(accs.w), b: gameAcc(accs.b) };
  R.phaseAcc = { w: {}, b: {} };
  for (const s of ['w', 'b']) for (const ph of ['opening', 'middlegame', 'endgame']) R.phaseAcc[s][ph] = phaseAccs[s][ph].length >= 2 ? Math.round(phaseAccs[s][ph].reduce((x, y) => x + y, 0) / phaseAccs[s][ph].length) : null;
  // key moments: the biggest swings
  R.key = R.moves.map((m, i) => [i, Math.abs(winPct(R.evals[i + 1]) - winPct(R.evals[i]))]).filter(x => x[1] >= 12).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]).sort((a, b) => a - b);
  R.summary = coachSummary(R);
  R.opening = R.startFen === START_FEN ? openingName(R.uciMoves) : 'Chess960';
  R.done = true;
  // save for insights. The XP reward waits until the player reaches the end of the review (see rvFinish):
  // nothing pops up while the game is being studied or stepped through.
  const side = R.color || 'w';
  profile.reviews = profile.reviews || [];
  const key = R.uciMoves.join('');
  let entry = profile.reviews.find(r => r.key === key);
  if (!entry) {
    const cnt = {}; R.moves.filter(m => m.side === side).forEach(m => cnt[m.cls] = (cnt[m.cls] || 0) + 1);
    entry = { key, t: Date.now(), color: side, acc: R.acc[side], phase: R.phaseAcc[side], cnt, opening: R.opening, hangs: R.moves.filter(m => m.side === side && m.leftHanging && ['mistake', 'blunder'].includes(m.cls)).length, missed: R.moves.filter(m => m.side === side && (m.cls === 'miss' || m.bestWasCapture)).length, moves: R.uciMoves.length, opp: R.oppName, result: R.src.result || null, rw: 0 };
    profile.reviews.unshift(entry);
    profile.reviews = profile.reviews.slice(0, 60);
    saveProfile();
    if (typeof linkReviewToGame === 'function') linkReviewToGame(key, R.acc[side]);
  }
  R.entry = entry; // rw: 0 = reward still owed (older saved reviews have no rw and were rewarded already)
  if (reviewProgressHook) reviewProgressHook(true);
}
// the review counts as done when the player reaches the end card: only then are XP, quests and achievements granted
function rvFinish(R) {
  const e = R.entry; if (!e || e.rw !== 0 || R.rewarded) return;
  R.rewarded = true; e.rw = 1; saveProfile();
  const side = R.color || 'w';
  setTimeout(() => rewardEvent('review', { acc: R.acc[side] || 0, moves: Math.ceil(R.uciMoves.length / 2), brilliants: R.moves.filter(m => m.side === side && m.cls === 'brilliant').length }), 800);
}

// ---------- review screen ----------
let reviewProgressHook = null;
function classBadge(cls, size = 18) {
  const c = CLASSES[cls]; const el = h('span', { class: 'cbadge', style: { background: c.color, width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' } });
  if (c.icon) el.append(icon(c.icon, Math.round(size * 0.7))); else el.textContent = c.sym;
  return el;
}
function evalGraph(R, onPick) {
  const W = 340, H = 70, n = R.evals.length;
  const y = cp => H - winPct(cp) / 100 * H;
  let d = `M0 ${H / 2}`;
  R.evals.forEach((e, k) => { d += ` L${(k / Math.max(1, n - 1) * W).toFixed(1)} ${y(e).toFixed(1)}`; });
  const marks = R.moves.filter(m => ['blunder', 'mistake', 'brilliant', 'great', 'miss'].includes(m.cls)).map(m => `<circle cx="${((m.i + 1) / Math.max(1, n - 1) * W).toFixed(1)}" cy="${y(R.evals[m.i + 1]).toFixed(1)}" r="3.5" fill="${CLASSES[m.cls].color}" stroke="#141a2e" stroke-width="1"/>`).join('');
  const el = h('div', { class: 'evalgraph' });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect width="${W}" height="${H}" fill="#2b2730"/><path d="${d} L${W} ${H} L0 ${H} Z" fill="#f3efe4"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#888" stroke-width=".6" stroke-dasharray="3 3"/>${marks}<line class="cur" x1="0" x2="0" y1="0" y2="${H}" stroke="#ffb547" stroke-width="2"/></svg>`;
  el.addEventListener('click', e => { const r = el.getBoundingClientRect(); const k = Math.round((e.clientX - r.left) / r.width * (n - 1)); onPick(Math.max(0, Math.min(n - 1, k))); });
  el.setCursor = k => { const line = el.querySelector('.cur'); const x = (k / Math.max(1, n - 1) * W).toFixed(1); line.setAttribute('x1', x); line.setAttribute('x2', x); };
  return el;
}
// Review screen: one phone screen, no scrolling. Flow: analyzing -> summary sheet -> step through the game
// from move 1 (Hoot explains each move) -> end card (the moment the review counts as done).
const RV_BAD = ['inaccuracy', 'mistake', 'blunder', 'miss'];
const RV_STOP = ['mistake', 'blunder', 'miss', 'brilliant']; // autoplay pauses here so Hoot can explain
const RV_KEY = ['mistake', 'blunder', 'miss', 'brilliant', 'great'];
function rvMood(cls) { return { brilliant: 'wow', great: 'cheer', best: 'happy', excellent: 'happy', good: 'talk', book: 'talk', inaccuracy: 'think', mistake: 'sad', miss: 'sad', blunder: 'sad' }[cls] || 'talk'; }
function rvSvg(kind, size = 22) {
  const d = kind === 'pause' ? '<rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/>' : '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/>';
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('fill', 'currentColor'); s.setAttribute('class', 'icn'); s.innerHTML = d;
  return s;
}
function rvMoveNo(ply) { return `${Math.floor((ply - 1) / 2) + 1}${(ply - 1) % 2 ? '...' : '.'}`; }
function renderReview(main) {
  const R = REV;
  if (!R) { route = 'play'; return render(); }
  const exit = () => { REV = null; route = R.back || 'play'; render(); };
  const side = R.color || 'w', N = R.uciMoves.length;
  const wName = R.src.white || 'White', bName = R.src.black || 'Black';
  const board = new BoardView({ orient: R.orient || side, drawable: true });
  const flipBtn = h('button', { class: 'fs-back', 'aria-label': 'Flip board', onclick: () => { haptic(6); board.flip(); R.orient = board.orient; } }, icon('flip', 22));
  const F = focusScreen(main, { title: 'Game Review', sub: `${wName} vs ${bName}`, back: exit, right: [flipBtn] });
  F.root.classList.add('rv');
  F.stage.append(board.el);
  // our own action buttons (same look as setActions) so they can update in place and make move sounds
  const btn = (ic, label, on, cls = '') => { const b = h('button', { class: 'fs-btn ' + cls, 'aria-label': label, onclick: e => { haptic(cls.includes('primary') ? 10 : 6); on(e); } }, typeof ic === 'string' ? icon(ic, cls.includes('primary') ? 20 : 22) : ic, h('span', null, label)); return b; };
  const say = (nodes, mood) => {
    const b = hootSays('', mood); b.classList.add('rv-say');
    const t = b.querySelector('.txt'); t.append(...[].concat(nodes).filter(x => x != null)); F.above.replaceChildren(b);
    // long text scrolls inside the bubble: fade the bottom edge while there is more to read
    const more = () => t.classList.toggle('more', t.scrollHeight - t.scrollTop - t.clientHeight > 2);
    t.addEventListener('scroll', more, { passive: true }); requestAnimationFrame(more);
    return b;
  };

  // ---------- 1. analyzing ----------
  if (!R.done) {
    F.root.classList.add('rv-busy');
    say([h('b', null, 'Studying your game...'), ' ', 'I am checking every move with the engine. Your summary appears in a moment.'], 'think');
    const cur = h('b', null, '0'), pct = h('b', { class: 'rv-pct' }, '0%'), fill = h('div');
    F.below.append(h('div', { class: 'rv-prog' },
      h('div', { class: 'rv-prog-top' }, h('span', null, 'Move ', cur, ' of ' + N), pct),
      h('div', { class: 'rv-prog-bar' }, fill), h('small', null, 'Analyzing with ' + engineName())));
    const wait = btn('sparkle', 'Analyzing...', () => { }, 'primary wide'); wait.disabled = true;
    F.actions.append(wait);
    const scan = h('div', { class: 'rv-scan' }); board.el.append(scan);
    let shown = -1;
    const upd = () => {
      const k = R.pos.length, p = Math.round(R.progress * 100);
      cur.textContent = String(Math.min(N, Math.max(0, k - 1))); pct.textContent = p + '%'; fill.style.width = p + '%';
      const ply = Math.min(N, Math.max(0, k - 1));
      if (ply !== shown) { shown = ply; board.lastKey = undefined; board.set(new Game(R.startFen, R.uciMoves.slice(0, ply)).viewState()); }
    };
    upd();
    reviewProgressHook = (doneNow) => { if (doneNow) { reviewProgressHook = null; if (route === 'review' && REV === R) render(); return; } upd(); };
    cleanups.push(() => { reviewProgressHook = (d) => { if (d && route === 'review' && REV === R) render(); }; });
    return;
  }
  if (R.view == null) { R.view = 'summary'; R.ply = 0; }
  const moveCls = ply => ply > 0 ? R.moves[ply - 1].cls : null;

  // ---------- below: thin eval graph + one-line move strip ----------
  const n1 = Math.max(1, N);
  const yOf = cp => (100 - winPct(Math.max(-1500, Math.min(1500, cp)))).toFixed(1);
  let dPath = `M0 50`; R.evals.forEach((e, k) => { dPath += ` L${(k / n1 * 100).toFixed(2)} ${yOf(e)}`; });
  const mkGraph = cls => {
    const el = h('div', { class: 'rv-graph ' + cls, role: 'slider', 'aria-label': 'Evaluation graph, tap to jump', 'aria-valuemin': 0, 'aria-valuemax': N });
    el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${dPath} L100 100 L0 100 Z" fill="#f3efe4"/><line x1="0" x2="100" y1="50" y2="50" stroke="rgba(120,110,100,.6)" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="3 3"/></svg>`;
    R.moves.forEach(m => { if (RV_KEY.includes(m.cls)) el.append(h('i', { class: 'rv-gm', style: { left: ((m.i + 1) / n1 * 100) + '%', top: yOf(R.evals[m.i + 1]) + '%', background: CLASSES[m.cls].color } })); });
    return el;
  };
  const graph = mkGraph('');
  const gcur = h('div', { class: 'rv-gcur' }); graph.append(gcur);
  let scrub = false;
  const pick = e => { const r = graph.getBoundingClientRect(); jump(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * N)); };
  graph.addEventListener('pointerdown', e => { scrub = true; try { graph.setPointerCapture(e.pointerId); } catch (_) { } pick(e); });
  graph.addEventListener('pointermove', e => { if (scrub) pick(e); });
  graph.addEventListener('pointerup', () => { scrub = false; });
  graph.addEventListener('pointercancel', () => { scrub = false; });
  const strip = h('div', { class: 'rv-strip revmoves' });
  R.moves.forEach((m, i) => strip.append(h('button', { class: 'm', 'data-i': i + 1, onclick: () => jump(i + 1) },
    i % 2 === 0 ? h('small', null, (i / 2 + 1) + '.') : null, h('i', { class: 'rv-dot', style: { background: CLASSES[m.cls].color } }), m.san)));
  F.below.append(graph, strip);

  // ---------- actions ----------
  const playIc = h('span', { class: 'rv-pi' }, rvSvg('play'));
  const bPrev = btn('prev', 'Back', () => { stopAuto(); go2(R.ply - 1); });
  const bPlay = btn(playIc, 'Play', () => toggleAuto());
  const bRetry = btn('repeat', 'Retry', () => { stopAuto(); retryMoment(R, R.ply - 1); }, 'rv-retry');
  const bKey = btn('target', 'Key move', () => { stopAuto(); const k = nextKey(); if (k >= 0) go2(k); });
  const bNext = btn('next', 'Next', () => { stopAuto(); if (R.ply >= N) showEnd(); else go2(R.ply + 1); }, 'primary');
  const stepActs = [bPrev, bPlay, bRetry, bKey, bNext];
  function nextKey() { for (let i = R.ply; i < N; i++) if (RV_KEY.includes(R.moves[i].cls)) return i + 1; return -1; }
  function syncActs() {
    bPrev.disabled = R.ply === 0;
    bKey.disabled = nextKey() < 0;
    bRetry.style.display = R.ply > 0 && RV_BAD.includes(moveCls(R.ply)) && R.moves[R.ply - 1].best ? '' : 'none';
    playIc.replaceChildren(rvSvg(timer ? 'pause' : 'play')); bPlay.lastChild.textContent = timer ? 'Pause' : 'Play'; bPlay.setAttribute('aria-label', timer ? 'Pause' : 'Play');
    bPlay.classList.toggle('on', !!timer);
    const end = R.ply >= N;
    bNext.replaceChildren(icon(end ? 'check' : 'next', 20), h('span', null, end ? 'Finish' : 'Next')); bNext.setAttribute('aria-label', end ? 'Finish' : 'Next');
  }

  // ---------- autoplay ----------
  let timer = null;
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; syncActs(); } }
  function tick() {
    if (R.view !== 'step' || R.ply >= N) { stopAuto(); return; }
    go2(R.ply + 1);
    if (RV_STOP.includes(moveCls(R.ply)) || R.ply >= N) stopAuto();
  }
  function toggleAuto() {
    if (timer) return stopAuto();
    if (R.ply >= N) go2(0);
    timer = setInterval(tick, 1600); syncActs(); tick();
  }
  cleanups.push(() => { if (timer) clearInterval(timer); timer = null; });

  // ---------- stepping ----------
  function go2(k) {
    const prev = R.ply;
    R.ply = Math.max(0, Math.min(N, k));
    const ply = R.ply, fwd = ply === prev + 1;
    const g = new Game(R.startFen, R.uciMoves.slice(0, ply));
    const st = g.viewState(), arrows = [];
    const mv = ply > 0 ? R.moves[ply - 1] : null;
    if (mv && mv.best && mv.best !== mv.uci && !['best', 'book', 'great', 'brilliant'].includes(mv.cls)) arrows.push([sqFromName(mv.best.slice(0, 2)), sqFromName(mv.best.slice(2, 4)), '#7cc04a']);
    st.arrows = arrows; st.badge = mv ? { sq: sqFromName(mv.uci.slice(2, 4)), cls: mv.cls } : null;
    if (!fwd) board.lastKey = undefined; // no landing bounce or buzz when jumping around
    const captured = fwd && st.last && R.pos[prev] && new E.Position(R.pos[prev].fen).board[st.last[1]];
    board.set(st, fwd && st.last ? st.last : undefined);
    if (fwd && st.last) beep(st.check >= 0 ? 'check' : captured ? 'capture' : 'move'); else if (ply !== prev && prev >= 0) beep('tap');
    // Hoot explains the move
    const head = mv
      ? h('div', { class: 'rv-mh' }, classBadge(mv.cls, 22), h('b', null, `${rvMoveNo(ply)} ${mv.san}`), h('span', { class: 'rv-cl' }, CLASSES[mv.cls].label), h('span', { class: 'rv-ev' + (R.evals[ply] < 0 ? ' neg' : '') }, fmtEval(R.evals[ply])))
      : h('div', { class: 'rv-mh' }, h('b', null, 'Starting position'), h('span', { class: 'rv-ev' }, fmtEval(R.evals[0])));
    const body = mv ? coachExplain(R, ply - 1) : 'Tap Next or swipe the board. I will explain every move, and green arrows show the engine\'s choice.';
    say([head, h('div', { class: 'rv-body' }, body)], mv ? rvMood(mv.cls) : 'talk');
    // graph cursor + strip
    gcur.style.left = (ply / n1 * 100) + '%'; graph.setAttribute('aria-valuenow', ply);
    strip.querySelectorAll('.m.cur').forEach(e => e.classList.remove('cur'));
    const cur = strip.querySelector(`.m[data-i="${ply}"]`);
    if (cur) { cur.classList.add('cur'); strip.scrollTo({ left: cur.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth / 2, behavior: Math.abs(ply - prev) > 6 ? 'auto' : 'smooth' }); }
    else strip.scrollTo({ left: 0 });
    syncActs();
  }
  function jump(k) { stopAuto(); if (R.view !== 'step') startReview(k); else go2(k); }

  // swipe the board to step, arrows on a keyboard
  let sw = null;
  F.stage.addEventListener('pointerdown', e => { sw = R.view === 'step' ? { x: e.clientX, y: e.clientY } : null; });
  F.stage.addEventListener('pointerup', e => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    stopAuto(); if (dx < 0) { if (R.ply >= N) showEnd(); else go2(R.ply + 1); } else go2(R.ply - 1);
  });
  F.stage.addEventListener('pointercancel', () => { sw = null; });
  const onKey = e => {
    if (route !== 'review' || REV !== R || document.querySelector('.modal-bg,.celebrate') || e.target.closest && e.target.closest('input,textarea')) return;
    if (R.view === 'step') {
      const k = { ArrowRight: R.ply + 1, ArrowLeft: R.ply - 1, Home: 0, End: N, ArrowUp: 0, ArrowDown: N }[e.key];
      if (k != null) { e.preventDefault(); stopAuto(); if (e.key === 'ArrowRight' && R.ply >= N) showEnd(); else go2(k); }
      else if (e.key === ' ') { e.preventDefault(); toggleAuto(); }
    } else if (R.view === 'summary' && (e.key === 'Enter' || e.key === 'ArrowRight')) { e.preventDefault(); startReview(0); }
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  // ---------- sheets over the board: summary + end card ----------
  let sheet = null;
  const closeSheet = () => { const s = sheet; sheet = null; if (!s) return; s.classList.add('out'); setTimeout(() => s.remove(), 320); };
  const openSheet = el => { if (sheet) sheet.remove(); sheet = el; F.stage.append(el); };
  function setMode(mode) { F.root.classList.remove('rv-m-summary', 'rv-m-step', 'rv-m-end'); F.root.classList.add('rv-m-' + mode); }
  const accCard = s => {
    const v = h('b', { class: 'accv' }, '0');
    const acc = R.acc[s];
    if (acc == null) v.textContent = '-';
    else if (typeof countUp === 'function') countUp(v, 0, Math.round(acc * 10), 1100, x => (x / 10).toFixed(1));
    else v.textContent = acc.toFixed(1);
    return h('div', { class: 'rv-acc ' + s + (R.color === s ? ' mine' : '') },
      h('img', { class: 'rv-pc', src: PIECE_URL[s + 'k'], alt: '' }),
      h('div', { class: 'rv-accn' }, h('span', null, s === 'w' ? wName : bName), h('small', null, R.color === s ? 'Your accuracy' : 'Accuracy')),
      h('div', { class: 'rv-accv' }, v, h('i', null, '%')));
  };
  function showSummary() {
    R.view = 'summary'; setMode('summary'); stopAuto();
    const acc = R.acc[side] || 0;
    say([h('b', null, R.summary.headline)], acc >= 85 ? 'cheer' : acc >= 70 ? 'happy' : 'talk');
    const cls = CLASS_ORDER.filter(k => R.moves.some(m => m.cls === k));
    const counts = h('div', { class: 'rv-counts' }, cls.map(k => {
      const cw = R.moves.filter(m => m.side === 'w' && m.cls === k).length, cb = R.moves.filter(m => m.side === 'b' && m.cls === k).length;
      return h('div', { class: 'rv-cnt' }, h('b', { class: 'w' + (cw ? '' : ' z') }, cw), classBadge(k, 20), h('span', { class: 'rv-cn' }, CLASSES[k].label), h('b', { class: 'b' + (cb ? '' : ' z') }, cb));
    }));
    const keys = R.moves.map((m, i) => [m, i]).filter(([m, i]) => RV_KEY.includes(m.cls) || R.key.includes(i)).slice(0, 8);
    openSheet(h('div', { class: 'rv-sheet rv-sum' },
      h('div', { class: 'rv-accs' }, accCard('w'), accCard('b')),
      h('div', { class: 'rv-open' }, icon('book', 18), h('span', null, R.opening || 'Opening'), h('small', null, `${Math.ceil(N / 2)} moves`)),
      counts,
      N > 1 ? h('div', { class: 'rv-keys' }, h('div', { class: 'rv-lbl' }, 'Game flow'), (() => { const g = mkGraph('rv-flow'); g.addEventListener('click', e => { const r = g.getBoundingClientRect(); startReview(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * N)); }); return g; })()) : null,
      keys.length ? h('div', { class: 'rv-keys' }, h('div', { class: 'rv-lbl' }, 'Key moments'),
        h('div', { class: 'rv-chips' }, keys.map(([m, i]) => h('button', { class: 'rv-chip', onclick: () => { haptic(6); beep('tap'); startReview(i + 1); } }, classBadge(m.cls, 18), h('b', null, `${rvMoveNo(i + 1)} ${m.san}`))))) : null));
    const startBtn = btn('play', 'Start review', () => { beep('confirm'); startReview(0); }, 'primary wide');
    F.actions.replaceChildren(startBtn);
    board.lastKey = undefined; board.set(new Game(R.startFen).viewState());
  }
  function startReview(at) {
    R.view = 'step'; setMode('step'); closeSheet();
    F.actions.replaceChildren(...stepActs);
    R.ply = -1; go2(at);
  }
  function showEnd() {
    stopAuto(); R.view = 'end'; setMode('end');
    const S = R.summary, mine = R.moves.filter(m => m.side === side);
    const c = k => mine.filter(m => k.includes(m.cls)).length;
    const acc = R.acc[side];
    const av = h('b', null, '0');
    if (acc == null) av.textContent = '-'; else if (typeof countUp === 'function') countUp(av, 0, Math.round(acc * 10), 1000, x => (x / 10).toFixed(1)); else av.textContent = acc.toFixed(1);
    const stat = (k, n, label) => h('div', { class: 'rv-stat' }, classBadge(k, 22), h('b', null, n), h('small', null, label));
    say([h('b', null, 'Well done!'), ' ', 'You studied every move. ' + (S.tips.length > 1 ? 'Here is what to work on next.' : 'Here is your takeaway.')], (acc || 0) >= 70 ? 'cheer' : 'happy');
    openSheet(h('div', { class: 'rv-sheet rv-end' },
      h('div', { class: 'rv-end-top' }, h('div', { class: 'rv-medal' }, icon('check', 30)),
        h('div', null, h('div', { class: 'rv-end-t' }, 'Review complete'), h('div', { class: 'rv-end-acc' }, av, h('i', null, '%'), h('small', null, R.color ? 'your accuracy' : 'White accuracy')))),
      h('div', { class: 'rv-stats' }, stat('best', c(['best', 'great', 'brilliant']), 'Best'), stat('inaccuracy', c(['inaccuracy']), 'Inaccuracies'), stat('mistake', c(['mistake', 'miss']), 'Mistakes'), stat('blunder', c(['blunder']), 'Blunders')),
      h('div', { class: 'rv-lbl' }, 'What to practice'),
      h('ul', { class: 'rv-tips' }, S.tips.map(t => h('li', null, icon('target', 16), h('span', null, t))))));
    F.actions.replaceChildren(
      btn('search', 'Analyze', () => openAnalysis({ fen: R.startFen, moves: R.uciMoves, ply: N })),
      btn('repeat', 'Replay', () => startReview(0)),
      btn('back', 'Back to games', () => exit(), 'primary wide'));
    rvFinish(R);
  }
  if (R.view === 'end') { R.ply = N; go2(N); showEnd(); }
  else if (R.view === 'step') { const k = R.ply; startReview(k); }
  else showSummary();
}
function clsPhrase(c) { return { brilliant: 'is brilliant', great: 'is a great move', best: 'is the best move', excellent: 'is excellent', good: 'is good', book: 'is a book move', inaccuracy: 'is an inaccuracy', mistake: 'is a mistake', miss: 'is a missed chance', blunder: 'is a blunder' }[c]; }
function fmtEval(cp) { if (Math.abs(cp) >= 9000) { const n = Math.round((10000 - Math.abs(cp)) / 10); return (cp > 0 ? '' : '-') + 'M' + Math.max(1, Math.ceil(n / 2)); } return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1); }
// practice the position before a mistake: find a move as good as the engine's
function retryMoment(R, i) {
  const P = R.pos[i], mv = R.moves[i];
  const good = new Set([mv.best]);
  if (P.lines[1] && P.lines[0] && winPct(P.lines[0].cp) - winPct(P.lines[1].cp) < 3) good.add(P.lines[1].pv[0]);
  modal((box, close) => {
    box.classList.add('rv-retrybox');
    const g = new Game(P.fen);
    const msg = h('div', { class: 'taskmsg' }, 'Find a better move!');
    let solved = false;
    const bv = new BoardView({
      orient: g.turn(),
      getTargets: sq => solved ? null : g.targetsFrom(sq),
      onMove: (from, to) => {
        const uci = sqName(from) + sqName(to) + (g.needsPromo(from, to) ? 'q' : '');
        const t = new Game(P.fen); t.play(uci); bv.set(t.viewState(), [from, to]);
        if (good.has(uci) || good.has(uci.slice(0, 4))) { solved = true; beep('win'); bv.burst('star'); msg.className = 'taskmsg good'; msg.textContent = `Yes! ${sanAt(P.fen, [], uci)} is the move.`; inc('retries'); saveProfile(); }
        else { beep('bad'); msg.className = 'taskmsg bad'; msg.textContent = uci === mv.uci ? 'That is the move from the game. Look for something better!' : 'Not quite. Try again!'; setTimeout(() => { if (!solved) bv.set(g.viewState()); }, 800); }
      },
    });
    bv.set(g.viewState());
    box.append(h('h2', null, 'Retry this moment'), h('p', { class: 'muted small' }, `${g.turn() === 'w' ? 'White' : 'Black'} to move.`), bv.el, msg,
      h('div', { class: 'row' }, h('button', { class: 'btn grow', onclick: () => { const b = mv.best; bv.set(Object.assign(g.viewState(), { arrows: [[sqFromName(b.slice(0, 2)), sqFromName(b.slice(2, 4)), '#7cc04a']] })); msg.textContent = 'The engine plays ' + sanAt(P.fen, [], b) + '.'; } }, icon('eye', 18), 'Show'), h('button', { class: 'btn primary grow', onclick: close }, 'Done')));
  });
}

// ---------- live coach for casual bot games ----------
// Grades a single move from engine lines before/after it and returns a coach message.
function gradeSingle(startFen, movesBefore, uci, linesBefore, linesAfter, color, oppName) {
  const pBefore = posWith(startFen, movesBefore), side = pBefore.turn === 0 ? 'w' : 'b';
  const turnAfter = side === 'w' ? 'b' : 'w';
  const P0 = { fen: pBefore.fen(), lines: linesBefore, turn: side, over: pBefore.status() };
  const pAfter = posWith(startFen, movesBefore.concat([uci]));
  const P1 = { fen: pAfter.fen(), lines: linesAfter, turn: turnAfter, over: pAfter.status() };
  const sgn = side === 'w' ? 1 : -1;
  const evB = evalWhite(P0) * sgn, evA = evalWhite(P1) * sgn;
  const best = linesBefore[0] ? linesBefore[0].pv[0] : null;
  const wpBest = linesBefore[0] ? winPct(linesBefore[0].cp) : winPct(evB), wpAfter = winPct(evA);
  let loss = uci === best ? 0 : Math.max(0, wpBest - wpAfter);
  const all = movesBefore.concat([uci]);
  const facts = moveFacts(startFen, movesBefore, uci);
  let cls = isBookMove(all, movesBefore.length, startFen) && loss < 3 ? 'book' : loss <= 0.5 ? 'best' : loss < 2 ? 'excellent' : loss < 5 ? 'good' : loss < 10 ? 'inaccuracy' : loss < 20 ? 'mistake' : 'blunder';
  const second = linesBefore[1] ? winPct(linesBefore[1].cp) : null;
  if (cls === 'best' && second != null && wpBest - second >= 15 && wpBest < 92) cls = 'great';
  if ((cls === 'best' || cls === 'great') && facts.leavesHanging >= 2 && (!facts.capt || PVAL[facts.capt] < PVAL[facts.piece]) && facts.piece !== 1 && wpBest < 85 && wpAfter >= 45) cls = 'brilliant';
  const i = movesBefore.length;
  const R = { startFen, uciMoves: all, color, oppName, pos: { [i]: P0, [i + 1]: P1 }, moves: {} };
  const mv = { i, uci, side, san: pBefore.san(pBefore.moveFromUci(uci)), best, cls, loss, wpBefore: wpBest, wpAfter, wpBest, leftHanging: facts.leavesHanging >= 2, allowedMate: !!(linesAfter[0] && linesAfter[0].mate > 0) };
  R.moves[i] = mv;
  return { cls, text: coachExplain(R, i), best, mv };
}
// pieces of `color` that are under attack and losing material right now
function threatsTo(fen, color) {
  const p = new E.Position(fen), side = color === 'w' ? 0 : 1, out = [];
  for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const pc = p.board[s]; if (!pc || ((pc & 8) ? 1 : 0) !== side || (pc & 7) === 6) continue; const lost = hanging(p, s); if (lost >= 2) out.push({ sq: s, piece: pc & 7, lost }); }
  return out.sort((a, b) => b.lost - a.lost);
}
