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
    const art = cls === 'inaccuracy' ? 'an inaccuracy' : cls === 'miss' ? 'a missed chance' : 'a ' + cls;
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
  if (hangs) tips.push(`You left a piece unprotected ${hangs} time${hangs > 1 ? 's' : ''}. Before each move, check that the piece you move is safe on its new square.`);
  if (allowedMates) tips.push(`You allowed a checkmate. When your king is near open lines, look at every check your opponent could give.`);
  if (missedWins) tips.push(`You missed ${missedWins} chance${missedWins > 1 ? 's' : ''} to win material. Each turn, scan for captures, checks and threats: "checks, captures, attacks".`);
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
  // save for insights + rewards
  const side = R.color || 'w';
  profile.reviews = profile.reviews || [];
  const key = R.uciMoves.join('');
  if (!profile.reviews.some(r => r.key === key)) {
    const cnt = {}; R.moves.filter(m => m.side === side).forEach(m => cnt[m.cls] = (cnt[m.cls] || 0) + 1);
    profile.reviews.unshift({ key, t: Date.now(), color: side, acc: R.acc[side], phase: R.phaseAcc[side], cnt, opening: R.opening, hangs: R.moves.filter(m => m.side === side && m.leftHanging && ['mistake', 'blunder'].includes(m.cls)).length, missed: R.moves.filter(m => m.side === side && (m.cls === 'miss' || m.bestWasCapture)).length, moves: R.uciMoves.length, opp: R.oppName, result: R.src.result || null });
    profile.reviews = profile.reviews.slice(0, 60);
    saveProfile();
    setTimeout(() => rewardEvent('review', { acc: R.acc[side] || 0, moves: Math.ceil(R.uciMoves.length / 2), brilliants: R.moves.filter(m => m.side === side && m.cls === 'brilliant').length }), 800);
  }
  if (reviewProgressHook) reviewProgressHook(true);
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
function renderReview(main) {
  const R = REV;
  if (!R) { route = 'play'; return render(); }
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { REV = null; route = R.back || 'play'; render(); } }, icon('back', 18), 'Done'), h('h2', { class: 'grow' }, 'Game Review'), h('span', { class: 'pill' }, R.done ? engineName() : 'analyzing')));
  if (!R.done) {
    const bar = h('div', { class: 'xpbar' }, h('div', { style: { width: Math.round(R.progress * 100) + '%' } }));
    const txt = h('div', { class: 'small muted center' }, 'Professor Hoot is studying your game…');
    main.append(h('div', { class: 'card stack center' }, hoot(64), txt, bar));
    reviewProgressHook = (doneNow) => { if (doneNow) { reviewProgressHook = null; render(); return; } bar.firstChild.style.width = Math.round(R.progress * 100) + '%'; txt.textContent = `Professor Hoot is studying your game… ${Math.round(R.progress * 100)}%`; };
    cleanups.push(() => { reviewProgressHook = (d) => { if (d && route === 'review') render(); }; });
    return;
  }
  const side = R.color || 'w';
  // summary card
  const accBox = (s, label) => h('div', { class: 'accbox' + (s === side ? ' mine' : '') }, h('div', { class: 'accv' }, R.acc[s] != null ? Math.round(R.acc[s]) + '%' : '-'), h('div', { class: 'small muted' }, label));
  const counts = h('table', { class: 'tbl ctbl' }, CLASS_ORDER.map(k => { const cw = R.moves.filter(m => m.side === 'w' && m.cls === k).length, cb = R.moves.filter(m => m.side === 'b' && m.cls === k).length; return h('tr', null, h('td', null, cw), h('td', null, classBadge(k), ' ', CLASSES[k].label), h('td', null, cb)); }));
  main.append(h('div', { class: 'card stack' },
    h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(52)), h('div', { class: 'txt' }, h('b', null, R.summary.headline), ' ', R.opening ? `Opening: ${R.opening}.` : '')),
    h('div', { class: 'row', style: { justifyContent: 'space-around' } }, accBox('w', R.color === 'w' ? 'Your accuracy' : (R.src.white || 'White') + ' accuracy'), accBox('b', R.color === 'b' ? 'Your accuracy' : (R.src.black || 'Black') + ' accuracy')),
    counts));
  main.append(h('div', { class: 'card stack' }, h('b', null, "Coach's advice"), h('ul', { class: 'tips' }, R.summary.tips.map(t => h('li', null, t))),
    R.key.length ? h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, h('span', { class: 'small muted' }, 'Key moments:'), R.key.map(k => h('button', { class: 'btn sm', onclick: () => go2(k + 1) }, `${Math.floor(k / 2) + 1}${k % 2 ? '...' : '.'} ${R.moves[k].san}`))) : null));
  // board + coach
  let ply = 0;
  const graph = evalGraph(R, k => go2(k));
  const board = new BoardView({ orient: side });
  const coach = h('div', { class: 'txt' });
  const head = h('div', { class: 'revhead' });
  const actions = h('div', { class: 'row' });
  const movesEl = h('div', { class: 'moves revmoves' });
  main.append(graph, board.el, head, h('div', { class: 'bubble' }, h('div', { class: 'who' }, hoot(48)), coach), actions,
    h('div', { class: 'nav' }, h('button', { class: 'btn sm', onclick: () => go2(0) }, icon('first', 20)), h('button', { class: 'btn sm', onclick: () => go2(ply - 1) }, icon('prev', 20)), h('button', { class: 'btn sm', onclick: () => go2(ply + 1) }, icon('next', 20)), h('button', { class: 'btn sm', onclick: () => go2(R.uciMoves.length) }, icon('last', 20))),
    movesEl);
  R.moves.forEach((m, i) => { if (i % 2 === 0) movesEl.append(h('span', { class: 'n' }, (i / 2 + 1) + '.')); movesEl.append(h('span', { class: 'm', 'data-i': i + 1, onclick: () => go2(i + 1) }, m.san, ' ', classBadge(m.cls, 14))); });
  function go2(k) {
    ply = Math.max(0, Math.min(R.uciMoves.length, k));
    const g = new Game(R.startFen, R.uciMoves.slice(0, ply));
    const st = g.viewState(); const arrows = [];
    const mv = ply > 0 ? R.moves[ply - 1] : null;
    if (mv && mv.best && mv.best !== mv.uci && !['best', 'book', 'great', 'brilliant'].includes(mv.cls)) arrows.push([sqFromName(mv.best.slice(0, 2)), sqFromName(mv.best.slice(2, 4)), '#7cc04a']);
    st.arrows = arrows; st.badge = mv ? { sq: sqFromName(mv.uci.slice(2, 4)), cls: mv.cls } : null;
    board.set(st);
    graph.setCursor(ply);
    head.innerHTML = '';
    if (mv) head.append(classBadge(mv.cls, 22), h('b', null, `${Math.floor((ply - 1) / 2) + 1}${(ply - 1) % 2 ? '...' : '.'} ${mv.san}`), h('span', { class: 'muted' }, ' ' + clsPhrase(mv.cls)), h('span', { class: 'grow' }), h('span', { class: 'pill' }, fmtEval(R.evals[ply])));
    else head.append(h('b', null, 'Starting position'), h('span', { class: 'grow' }), h('span', { class: 'pill' }, fmtEval(R.evals[0])));
    coach.textContent = mv ? coachExplain(R, ply - 1) : `Use the arrows or tap the graph to walk through the game. Green arrows show what the engine would have played.`;
    actions.innerHTML = '';
    if (mv && ['inaccuracy', 'mistake', 'blunder', 'miss'].includes(mv.cls)) actions.append(h('button', { class: 'btn primary sm grow', onclick: () => retryMoment(R, ply - 1) }, icon('repeat', 16), 'Retry it'));
    actions.append(h('button', { class: 'btn sm grow', onclick: () => openAnalysis({ fen: R.startFen, moves: R.uciMoves, ply }) }, icon('search', 16), 'Analyze'));
    const nextBad = R.moves.findIndex((m, i) => i >= ply && m.side === side && ['mistake', 'blunder', 'miss'].includes(m.cls));
    if (nextBad >= 0) actions.append(h('button', { class: 'btn sm grow', onclick: () => go2(nextBad + 1) }, 'Next mistake', icon('next', 16)));
    movesEl.querySelectorAll('.m').forEach(e => e.classList.toggle('cur', +e.dataset.i === ply));
    const cur = movesEl.querySelector('.cur'); if (cur) cur.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
  go2(R.key.length ? R.key[0] + 1 : 0);
}
function clsPhrase(c) { return { brilliant: 'is brilliant', great: 'is a great move', best: 'is the best move', excellent: 'is excellent', good: 'is good', book: 'is a book move', inaccuracy: 'is an inaccuracy', mistake: 'is a mistake', miss: 'is a missed chance', blunder: 'is a blunder' }[c]; }
function fmtEval(cp) { if (Math.abs(cp) >= 9000) { const n = Math.round((10000 - Math.abs(cp)) / 10); return (cp > 0 ? '' : '-') + 'M' + Math.max(1, Math.ceil(n / 2)); } return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1); }
// practice the position before a mistake: find a move as good as the engine's
function retryMoment(R, i) {
  const P = R.pos[i], mv = R.moves[i];
  const good = new Set([mv.best]);
  if (P.lines[1] && P.lines[0] && winPct(P.lines[0].cp) - winPct(P.lines[1].cp) < 3) good.add(P.lines[1].pv[0]);
  modal((box, close) => {
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
