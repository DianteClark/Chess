// Kids' "Learn to Play" course. Step types:
//  text  - Professor Hoot explains; optional display board (FEN), marks, showMoves (dots for a piece)
//  stars - move your piece to collect every star (and capture black pieces if captureAll)
//  goal  - real chess position; succeed by reaching the goal (check, mate, castle, promote, move)
const LESSONS = [
  { id: 'board', group: 'The Basics', icon: 'board', title: 'The Chessboard', desc: '64 squares and how to name them', steps: [
    { type: 'text', text: 'Welcome to chess! It is a battle between two armies: <b>White</b> and <b>Black</b>. White always moves first.', board: '8/8/8/8/8/8/8/8' },
    { type: 'text', text: 'The board has <b>64 squares</b>: 8 rows and 8 columns. The columns are called <b>files</b> (a to h). The rows are called <b>ranks</b> (1 to 8).', board: '8/8/8/8/8/8/8/8', marks: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'] },
    { type: 'text', text: 'Every square has a name made from its file letter and rank number, like a map! The blue square is <b>e4</b>.', board: '8/8/8/8/8/8/8/8', marks: ['e4'] },
    { type: 'text', text: 'Golden rule for setting up: the bottom-right corner is always a <b>light</b> square. Remember: <b>"Light on the right!"</b>', board: '8/8/8/8/8/8/8/8', marks: ['h1'] },
  ] },
  { id: 'setup', group: 'The Basics', icon: 'puzzle', title: 'Setting Up', desc: 'Where every piece starts', steps: [
    { type: 'text', text: 'Each army has <b>16 pieces</b>: 1 king, 1 queen, 2 rooks, 2 bishops, 2 knights and 8 pawns.', board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' },
    { type: 'text', text: 'The <b>rooks</b> go in the corners. Next to them are the <b>knights</b>, then the <b>bishops</b>.', board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', marks: ['a1', 'h1', 'b1', 'g1', 'c1', 'f1'] },
    { type: 'text', text: 'The <b>queen goes on her own color</b>: the white queen on a light square, the black queen on a dark square. The <b>king</b> takes the last spot.', board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', marks: ['d1', 'd8', 'e1', 'e8'] },
    { type: 'text', text: 'The 8 <b>pawns</b> stand in a row in front, like a shield. Now you are ready to meet the pieces!', board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', marks: ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'] },
  ] },
  { id: 'rook', group: 'Meet the Pieces', piece: 'r', title: 'The Rook', desc: 'Straight lines, any distance', steps: [
    { type: 'text', text: 'The <b>rook</b> moves in straight lines: up, down, left or right, as far as it wants. The dots show where it can go.', board: '8/8/8/8/3R4/8/8/8', showMoves: 'd4' },
    { type: 'stars', text: 'Your turn! Tap the rook, then tap where it should go. <b>Collect all the stars!</b>', pieces: { a1: 'R' }, stars: ['a6', 'f6', 'f2'], par: 3 },
    { type: 'text', text: 'A rook <b>cannot jump</b> over other pieces. If something is in the way, it has to stop.', board: '8/8/8/3P4/1P1R2P1/8/3P4/8', showMoves: 'd4' },
    { type: 'stars', text: 'Your own pawn is blocking the way up. Find a path around it!', pieces: { a1: 'R', a4: 'P' }, fixed: ['a4'], stars: ['a6', 'h6'], par: 3 },
  ] },
  { id: 'bishop', group: 'Meet the Pieces', piece: 'b', title: 'The Bishop', desc: 'Diagonals only', steps: [
    { type: 'text', text: 'The <b>bishop</b> moves <b>diagonally</b>, as far as it wants. A bishop stays on the same color square for the whole game!', board: '8/8/8/8/3B4/8/8/8', showMoves: 'd4' },
    { type: 'stars', text: 'Collect the stars with your bishop. Look for the diagonals!', pieces: { c1: 'B' }, stars: ['e3', 'g5', 'd8'], par: 3 },
    { type: 'stars', text: 'Trickier! Plan your path.', pieces: { f1: 'B' }, stars: ['b5', 'e8', 'h5', 'd1'], par: 4 },
  ] },
  { id: 'queen', group: 'Meet the Pieces', piece: 'q', title: 'The Queen', desc: 'The most powerful piece', steps: [
    { type: 'text', text: 'The <b>queen</b> is the most powerful piece. She moves like a rook <b>and</b> a bishop: straight or diagonal, any distance.', board: '8/8/8/8/3Q4/8/8/8', showMoves: 'd4' },
    { type: 'stars', text: 'Zoom around the board with your queen!', pieces: { d1: 'Q' }, stars: ['d5', 'h5', 'e8', 'a4'], par: 4 },
  ] },
  { id: 'king', group: 'Meet the Pieces', piece: 'k', title: 'The King', desc: 'Slow but super important', steps: [
    { type: 'text', text: 'The <b>king</b> is the most important piece. If your king gets trapped, you lose! He moves just <b>one square</b> in any direction.', board: '8/8/8/8/3K4/8/8/8', showMoves: 'd4' },
    { type: 'stars', text: 'Walk the king to every star, one step at a time.', pieces: { e1: 'K' }, stars: ['e2', 'f3', 'f4', 'e5'], par: 4 },
  ] },
  { id: 'knight', group: 'Meet the Pieces', piece: 'n', title: 'The Knight', desc: 'The L-shaped jumper', steps: [
    { type: 'text', text: 'The <b>knight</b> moves in an <b>L shape</b>: two squares one way, then one square to the side.', board: '8/8/8/8/3N4/8/8/8', showMoves: 'd4' },
    { type: 'text', text: 'The knight is the only piece that can <b>jump over</b> other pieces! Nothing can block it.', board: '8/8/8/2PPP3/2PNP3/2PPP3/8/8', showMoves: 'd4' },
    { type: 'stars', text: 'Hop to every star!', pieces: { b1: 'N' }, stars: ['c3', 'e4', 'f6', 'g8'], par: 4 },
    { type: 'stars', text: 'Jump right over your pawns!', pieces: { g1: 'N', f2: 'P', g2: 'P', h2: 'P' }, fixed: ['f2', 'g2', 'h2'], stars: ['f3', 'e5', 'c6'], par: 3 },
  ] },
  { id: 'pawn', group: 'Meet the Pieces', piece: 'p', title: 'The Pawn', desc: 'Small but brave', steps: [
    { type: 'text', text: 'Pawns move <b>straight forward one square</b>. On its very first move, a pawn may move <b>two squares</b>. Pawns never move backward!', board: '8/8/8/8/8/8/4P3/8', showMoves: 'e2' },
    { type: 'stars', text: 'March your pawn to the stars.', pieces: { e2: 'P' }, stars: ['e4', 'e5', 'e6'], par: 3 },
    { type: 'text', text: 'Pawns <b>capture differently</b>: one square <b>diagonally forward</b>. A pawn cannot capture straight ahead.', board: '8/8/8/3pr3/4P3/8/8/8', showMoves: 'e4' },
    { type: 'stars', text: 'Capture all the black pieces with your pawn!', pieces: { d2: 'P', c3: 'p', b4: 'n', c5: 'b' }, stars: [], captureAll: true, par: 3 },
  ] },
  { id: 'capture', group: 'Playing the Game', icon: 'target', title: 'Capturing', desc: 'Taking enemy pieces', steps: [
    { type: 'text', text: 'You <b>capture</b> by moving onto a square with an enemy piece. The captured piece leaves the board. You can never capture your own pieces.' },
    { type: 'stars', text: 'Use your queen to capture every black piece!', pieces: { d1: 'Q', d7: 'p', h3: 'n', a3: 'b' }, stars: [], captureAll: true, par: 3 },
    { type: 'stars', text: 'Now with a knight. Hop, hop, capture!', pieces: { b1: 'N', c3: 'p', e4: 'p', g5: 'r' }, stars: [], captureAll: true, par: 3 },
  ] },
  { id: 'values', group: 'Playing the Game', icon: 'gem', title: 'Piece Values', desc: 'Which pieces are worth more?', steps: [
    { type: 'text', text: 'Pieces have points: <b>Pawn = 1</b>, <b>Knight = 3</b>, <b>Bishop = 3</b>, <b>Rook = 5</b>, <b>Queen = 9</b>. The king is <b>priceless</b>, because you can never trade him!' },
    { type: 'text', text: 'Try not to give away a big piece for a small one. Trading your queen (9) for a knight (3) is a bad deal!' },
    { type: 'goal', text: 'Your knight can capture two pieces. Pick the <b>most valuable</b> one!', fen: '4k3/8/3q1p2/8/4N3/8/8/4K3 w - - 0 1', goal: 'move', moves: ['e4d6'], success: 'Yes! The queen is worth 9 points!', fail: 'That piece is worth less. Look for the queen!' },
  ] },
  { id: 'check', group: 'Playing the Game', icon: 'alert', title: 'Check!', desc: 'Attacking the king', steps: [
    { type: 'text', text: 'When a piece attacks the enemy king, it is called <b>check</b>. The king must get out of check right away!', board: '4k3/8/8/8/8/8/8/R3K3', marks: ['e8'] },
    { type: 'goal', text: 'Put the black king in <b>check</b>!', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', goal: 'check', success: 'Check! The king is under attack.' },
    { type: 'text', text: 'There are <b>3 ways</b> to escape check:<br>1. <b>Move</b> the king to a safe square.<br>2. <b>Block</b> the attack with another piece.<br>3. <b>Capture</b> the attacking piece.' },
    { type: 'goal', text: 'Your king is in check from the black queen. <b>Capture it</b> with your king!', fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', goal: 'move', moves: ['e1d2'], success: 'Captured! Your king is safe.', fail: 'Your king is safe, but you can do better. Capture the queen!' },
    { type: 'goal', text: 'The black rook gives check. <b>Block</b> it with your bishop!', fen: '4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1', goal: 'move', moves: ['d2e3'], success: 'Blocked! The bishop shields the king.', fail: 'That works too, but this time use the bishop to block!' },
  ] },
  { id: 'mate', group: 'Playing the Game', icon: 'crown', title: 'Checkmate!', desc: 'How you win the game', steps: [
    { type: 'text', text: '<b>Checkmate</b> means the king is in check and there is <b>no way to escape</b>. Checkmate wins the game!', board: 'R5k1/5ppp/8/8/8/8/8/6K1', marks: ['g8'] },
    { type: 'goal', text: 'The black king is stuck behind its own pawns. Find <b>checkmate in one move</b>!', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', goal: 'mate', success: 'Checkmate! That is called a back-rank mate.' },
    { type: 'goal', text: 'Your king helps your queen. Find the <b>checkmate</b>!', fen: '4k3/8/4K3/8/8/8/8/7Q w - - 0 1', goal: 'mate', success: 'Checkmate! Teamwork!' },
    { type: 'goal', text: 'A famous trap! The square f7 is weak. Find <b>checkmate</b>!', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', goal: 'mate', success: "Checkmate! That's Scholar's Mate. Watch out for it in your own games!" },
  ] },
  { id: 'castling', group: 'Special Moves', icon: 'castle', title: 'Castling', desc: 'Tuck your king in safe', steps: [
    { type: 'text', text: '<b>Castling</b> is a special move that keeps your king safe. The king moves <b>two squares</b> toward a rook, and the rook <b>hops over</b> to the other side of the king.', board: '4k3/8/8/8/8/8/8/R3K2R', marks: ['e1', 'g1', 'f1', 'h1'] },
    { type: 'text', text: 'You can castle only if: the king and that rook <b>have not moved</b> yet, nothing is <b>between</b> them, and the king is <b>not in check</b> and won\'t pass through check.' },
    { type: 'goal', text: 'Castle! Tap your king, then tap the square <b>two steps to the right</b>.', fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1', goal: 'castle', success: 'Castled! Your king is tucked away safely.', fail: 'Not quite. Tap the king, then the square two steps toward the rook.' },
  ] },
  { id: 'promotion', group: 'Special Moves', icon: 'arrowUp', title: 'Promotion', desc: 'A pawn becomes a queen', steps: [
    { type: 'text', text: 'When a pawn reaches the <b>other side</b> of the board, it gets <b>promoted</b>! It turns into a queen, rook, bishop or knight. Usually a queen!', board: '8/4P3/8/8/8/8/8/8', marks: ['e8'] },
    { type: 'goal', text: 'Push your pawn to the end and <b>promote</b> it!', fen: 'k7/4P3/8/8/8/8/8/6K1 w - - 0 1', goal: 'promote', success: 'A brand new queen!' },
    { type: 'stars', text: 'Walk your pawn all the way up. It becomes a queen at the top! Then grab the last star.', pieces: { b2: 'P' }, stars: ['b4', 'b8', 'h2'], promote: true, par: 6 },
  ] },
  { id: 'enpassant', group: 'Special Moves', icon: 'ninja', title: 'En Passant', desc: 'The sneaky pawn capture', steps: [
    { type: 'text', text: '<b>En passant</b> (say "on pah-SAHN") is a sneaky pawn rule. If an enemy pawn jumps <b>two squares</b> and lands right <b>next to</b> your pawn, you can capture it as if it had moved only one square.' },
    { type: 'text', text: 'You must do it <b>right away</b>, on your very next move, or the chance is gone!', board: '4k3/8/8/3pP3/8/8/8/4K3', marks: ['d5', 'd6'] },
    { type: 'goal', text: 'Black just moved a pawn two squares to d5. Capture it <b>en passant</b>! (Move your pawn to d6.)', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', goal: 'move', moves: ['e5d6'], success: 'Sneaky! The black pawn is gone.', fail: 'Try moving your e5 pawn diagonally to d6.' },
  ] },
  { id: 'draws', group: 'Winning & Drawing', icon: 'half', title: 'Stalemate & Draws', desc: 'When nobody wins', steps: [
    { type: 'text', text: '<b>Stalemate</b>: it is your turn, you are <b>not</b> in check, but you have <b>no legal moves</b>. That is a <b>draw</b> (a tie), even if you have fewer pieces!', board: '7k/5Q2/6K1/8/8/8/8/8', marks: ['h8'] },
    { type: 'text', text: 'Other draws:<br>• Both players <b>agree</b> to a draw.<br>• The same position happens <b>3 times</b>.<br>• <b>Not enough pieces</b> to checkmate (like king vs king).<br>• <b>50 moves</b> by each player with no capture or pawn move.' },
    { type: 'goal', text: 'Careful! Some queen moves cause stalemate. Find the <b>checkmate</b> instead.', fen: '7k/4Q3/6K1/8/8/8/8/8 w - - 0 1', goal: 'mate', success: 'Checkmate, not stalemate. Well done!' },
  ] },
  { id: 'tips', group: 'Winning & Drawing', icon: 'bulb', title: 'Winning Tips', desc: 'Play like a champion', steps: [
    { type: 'text', text: '<b>Start strong:</b><br>1. Move a center pawn (e or d pawn).<br>2. Bring out your <b>knights and bishops</b>.<br>3. <b>Castle</b> early to keep your king safe.<br>4. Don\'t bring your queen out too early.' },
    { type: 'text', text: 'Before <b>every</b> move, ask yourself:<br>1. What is my opponent attacking?<br>2. Can I capture something for free?<br>3. Is my piece safe on its new square?' },
    { type: 'text', text: 'You are ready! Go to the <b>Play</b> tab and challenge <b>Pip</b> the chick. Then try the <b>Puzzles</b> to get even better.' },
  ] },
];
if (typeof module !== 'undefined') module.exports = LESSONS;
