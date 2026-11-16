// "How to play" courses for the World Games wing. Professor Hoot teaches each game.
//
// Structure: WORLD_COURSES[gameKey] = { title, intro, lessons: [{ id, title, desc, steps: [...] }] }
// Step types:
//   {type:'text', text, fen?, marks?:[sq], arrows?:[[from,to]]}
//       Explanation with an optional display position. (Extra fields `legal`, `illegal`, `losing`
//       are only read by tools/validate_worldcourses.mjs to prove the rule being shown.)
//   {type:'goal', text, fen, goal:'move'|'mate'|'check'|'capture'|'drop'|'promote', moves:[uci], success, fail}
//       The learner makes ONE legal move. For 'move' only the listed moves count; for the other goals
//       the listed moves are known solutions (for 'mate' they are ALL the mating moves).
//       (`best`, `wins`, `depth`, `margin` are validator hints: `best` = the text claims the listed
//       moves are clearly the best; `wins` = the move ends the game in a win.)
//   {type:'line', text, fen, side:'w'|'b', moves:[uci,...], success}
//       The learner plays the moves of `side`, the app answers with the other moves.
//
// Conventions (all FENs and moves use Fairy-Stockfish / ffish format for that variant):
//   - Uppercase pieces = the side that moves first ('w' in the FEN): Red in xiangqi, Sente in shogi,
//     Cho (Blue) in janggi, White in makruk / shatranj / chess variants, the first player in sittuyin.
//     That side is always drawn at the bottom.
//   - Squares are file letter + rank number, seen from the first player: files a.. from left to right,
//     rank 1 at the first player's side.
//       xiangqi, janggi: 9 files a-i, 10 ranks 1-10 (Red / Cho palace = d1-f3, Black / Han palace = d8-f10;
//                        xiangqi river lies between ranks 5 and 6)
//       shogi:           9 files a-i, 9 ranks 1-9 (file a = Japanese file 9, rank 1 = Japanese rank 9);
//                        Sente's promotion zone = ranks 7-9
//       makruk, shatranj, sittuyin and chess variants: normal 8x8, a1-h8
//   - Moves: from-square + to-square, e.g. 'h3e3', 'a1a10'.
//       drops:      'P@e5' (piece letter is always uppercase in ffish UCI)
//       shogi:      promotion adds '+', e.g. 'b2h8+'; the same move without '+' does not promote
//       makruk:     pawn promotion adds 'm' (e.g. 'b5b6m')
//       shatranj:   pawn promotion adds 'q' (the Ferz), e.g. 'b7b8q'
//       sittuyin:   promotion adds 'f' (the Sit-ke); promoting in place is 'f6f6f'
//       chess:      'b7b8q' etc.
//       janggi:     passing = the general "moving" to its own square, e.g. 'e2e2'
//   - Hand / pocket pieces are written in brackets after the board: '...[Gp]'.
const WORLD_COURSES = (function () {
  // Common positions (kept inside this function so nothing else becomes a top-level name)
  var XQ = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  var SH = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL[] w - - 0 1';
  var JG = 'rnba1abnr/4k4/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/4K4/RNBA1ABNR w - - 0 1';
  var MK = 'rnsmksnr/8/pppppppp/8/8/PPPPPPPP/8/RNSKMSNR w - - 0 1';
  var SJ = 'rnbkqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKQBNR w - - 0 1';
  var ST = 'r6r/1ns1ksn1/3fpppp/pppp4/4PPPP/PPPPF3/1NSK1SN1/R6R[] w - - 0 1';
  var CHESS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var XQ_PALACES = ['d1', 'e1', 'f1', 'd2', 'e2', 'f2', 'd3', 'e3', 'f3', 'd8', 'e8', 'f8', 'd9', 'e9', 'f9', 'd10', 'e10', 'f10'];
  var XQ_RIVER = ['a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5', 'i5', 'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6', 'i6'];
  var SH_ZONE = ['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7', 'i7', 'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8', 'i8', 'a9', 'b9', 'c9', 'd9', 'e9', 'f9', 'g9', 'h9', 'i9'];

  return {

    // =====================================================================================
    xiangqi: {
      title: 'Xiangqi (Chinese Chess)',
      intro: "Xiangqi (said 'shyahng-chee') is the chess of China, played by millions of people every day in parks and online. Two armies, <b>Red</b> and <b>Black</b>, fight across a river. Red always moves first.",
      lessons: [
        { id: 'xq-board', title: 'The Board', desc: 'Points, the river and the palaces', steps: [
          { type: 'text', text: "Welcome! I am Professor Hoot. In xiangqi the pieces stand on the <b>points</b> where lines cross, not inside the squares. The board has 9 lines across and 10 lines up and down, so there are 90 points." },
          { type: 'text', text: "The empty band across the middle is the <b>river</b>. It splits the board into Red's half (bottom) and Black's half (top). Some pieces may never cross it!", fen: XQ, marks: XQ_RIVER },
          { type: 'text', text: "Each side has a <b>palace</b>: the 3x3 box with an X drawn inside it. The General and his Advisors must stay inside their palace for the whole game.", fen: XQ, marks: XQ_PALACES },
          { type: 'text', text: "To name a point we use a letter for the file (a to i, left to right) and a number for the rank (1 at Red's side up to 10 at Black's side). Red's General starts on <b>e1</b>, Black's on <b>e10</b>.", fen: XQ, marks: ['e1', 'e10'] },
          { type: 'text', text: "Each army has 16 pieces: 1 General, 2 Advisors, 2 Elephants, 2 Horses, 2 Chariots, 2 Cannons and 5 Soldiers. Let's meet them one by one!", fen: XQ },
        ] },
        { id: 'xq-general', title: 'General and Advisors', desc: 'The leader and his bodyguards', steps: [
          { type: 'text', text: "The <b>General</b> is the piece you must protect. Red's is 帥 (shuai, said 'shwhy') and Black's is 將 (jiang, said 'jyahng'). In the picture set it is a <b>general wearing a helmet</b>. It moves <b>one point</b> up, down, left or right, never diagonally, and it can never leave the palace.", fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1', marks: ['e1', 'e3', 'd2', 'f2'] },
          { type: 'goal', goal: 'move', text: "Move your General up to <b>e3</b>, the top middle point of the palace.", fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1', moves: ['e2e3'], success: 'Well done! One step at a time, and always inside the palace.', fail: 'The General moves one point straight. Try e2 to e3.' },
          { type: 'text', text: "The <b>Advisors</b> are 仕 / 士 (shi, said 'shr'). In the picture set each is a <b>scholar with a tall hat</b>. An Advisor moves <b>one point diagonally</b> and must stay in the palace too, so it can only ever stand on these 5 points.", fen: '3k5/9/9/9/9/9/9/9/9/3AKA3 w - - 0 1', marks: ['d1', 'f1', 'e2', 'd3', 'f3'] },
          { type: 'goal', goal: 'move', text: "Move one of your Advisors to the center of the palace, <b>e2</b>.", fen: '3k5/9/9/9/9/9/9/9/9/3AKA3 w - - 0 1', moves: ['d1e2', 'f1e2'], success: 'Good! From the center an Advisor guards the General best.', fail: 'Advisors move one point diagonally. Try d1 to e2.' },
          { type: 'text', text: "A special rule: the two Generals may <b>never face each other</b> on the same line with nothing in between. It is called the <b>flying general</b> rule. Here Red's General cannot step to d2, because it would look straight at Black's General on d10.", fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1', marks: ['d2'], arrows: [['d10', 'd2']], legal: ['e2e1', 'e2e3', 'e2f2'], illegal: ['e2d2'] },
          { type: 'goal', goal: 'move', text: "Make a <b>safe</b> General move. Remember: do not step onto the d-file!", fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1', moves: ['e2e1', 'e2e3', 'e2f2'], success: 'Perfect! You kept away from the open file.', fail: 'Stepping to d2 would face the black General. Choose another point.' },
        ] },
        { id: 'xq-chariot', title: 'The Chariot', desc: 'The strongest piece', steps: [
          { type: 'text', text: "The <b>Chariot</b> is 俥 / 車 (ju, said 'jyoo'). In the picture set it is a <b>two-wheeled war cart</b>. It moves any number of points in a straight line, just like a rook in chess. It cannot jump over pieces. It is the strongest piece on the board!", fen: '3k5/9/9/9/9/4R4/9/9/9/4K4 w - - 0 1', arrows: [['e5', 'e9'], ['e5', 'a5'], ['e5', 'i5'], ['e5', 'e2']] },
          { type: 'goal', goal: 'capture', text: "Use your Chariot to capture the black Horse.", fen: '3k5/9/9/9/9/n8/9/9/9/R3K4 w - - 0 1', moves: ['a1a5'], success: 'Crash! The Chariot rolls straight up and takes it.', fail: 'Slide the Chariot straight up the a-file.' },
          { type: 'goal', goal: 'move', best: true, depth: 2, text: "Two black pieces are in reach. One is guarded, one is not. Capture the piece that is <b>not protected</b>.", fen: '3k5/4a4/3n5/9/9/9/3R3c1/9/9/4K4 w - - 0 1', moves: ['d4h4'], success: 'Smart! The Cannon was alone. Taking the Horse would lose your Chariot to the Advisor.', fail: 'Look again: the Horse on d8 is guarded by the Advisor on e9. The Cannon on h4 is free.' },
        ] },
        { id: 'xq-horse', title: 'The Horse', desc: 'One straight, one diagonal', steps: [
          { type: 'text', text: "The <b>Horse</b> is 傌 / 馬 (ma, said 'mah'). In the picture set it is a <b>horse head</b>. It moves one point straight, then one point diagonally outward. From the middle of the board it can reach up to 8 points.", fen: '5k3/9/9/9/9/4N4/9/9/9/4K4 w - - 0 1', marks: ['d7', 'f7', 'c6', 'g6', 'c4', 'g4', 'd3', 'f3'] },
          { type: 'text', text: "Unlike a chess knight, the Horse <b>cannot jump</b>. If a piece stands right next to it on the first straight step, that way is blocked. We say the horse's <b>leg is hobbled</b>. Here the soldier on e6 stops the Horse from going to d7 or f7.", fen: '5k3/9/9/9/4p4/4N4/9/9/9/4K4 w - - 0 1', marks: ['e6'], arrows: [['e5', 'c6'], ['e5', 'g6']], legal: ['e5c6', 'e5g6'], illegal: ['e5d7', 'e5f7'] },
          { type: 'goal', goal: 'move', best: true, text: "Two black Chariots are near your Horse, but only one can really be reached. Capture it!", fen: '5k3/9/9/3r5/4P1r2/4N4/9/9/9/4K4 w - - 0 1', moves: ['e5g6'], success: 'Yes! The way to g6 was open. Your own soldier on e6 blocked the road to d7.', fail: 'The path to d7 is blocked by your soldier on e6. Look at g6 instead.' },
        ] },
        { id: 'xq-elephant', title: 'The Elephant', desc: 'Two diagonal steps, never across the river', steps: [
          { type: 'text', text: "The <b>Elephant</b> is 相 / 象 (xiang, said 'shyahng'). In the picture set it is an <b>elephant head</b>. It moves exactly <b>two points diagonally</b>. It may <b>not cross the river</b>, so it can only use these 7 points. It is a defender.", fen: '3k5/9/9/9/9/9/9/9/9/2B1K1B2 w - - 0 1', marks: ['c1', 'g1', 'a3', 'e3', 'i3', 'c5', 'g5'] },
          { type: 'goal', goal: 'move', text: "Move an Elephant to the strong center point <b>e3</b>.", fen: '3k5/9/9/9/9/9/9/9/9/2B1K1B2 w - - 0 1', moves: ['c1e3', 'g1e3'], success: 'Nice! On e3 the Elephant guards the middle of your camp.', fail: 'Two points diagonally: c1 to e3 or g1 to e3.' },
          { type: 'text', text: "If any piece sits on the point in the middle of the diagonal (the <b>elephant's eye</b>), the Elephant is blocked that way. Here the Horse on d2 blocks c1 to e3.", fen: '3k5/9/9/9/9/9/9/9/3N5/2B1K4 w - - 0 1', marks: ['d2'], legal: ['c1a3'], illegal: ['c1e3'] },
          { type: 'goal', goal: 'capture', text: "Capture a black Horse with your Elephant. Watch out for the blocked eye!", fen: '3k5/9/9/9/9/2n3n2/5N3/4B4/9/4K4 w - - 0 1', moves: ['e3c5'], success: 'Great! The road to g5 was blocked on f4, but c5 was open.', fail: 'The point f4 is the eye toward g5, and it is taken. Try c5.' },
          { type: 'text', text: "An Elephant on the river bank still cannot go further. From c5 it may go back to a3 or e3, but never across to a7 or e7.", fen: '3k5/9/9/9/9/2B6/9/9/9/4K4 w - - 0 1', legal: ['c5a3', 'c5e3'], illegal: ['c5a7', 'c5e7'] },
        ] },
        { id: 'xq-cannon', title: 'The Cannon', desc: 'Jump to capture', steps: [
          { type: 'text', text: "The <b>Cannon</b> is 炮 / 砲 (pao, said 'pow'). In the picture set it is a <b>cannon on wheels</b>. When it is <b>not</b> capturing, it moves just like a Chariot: any distance in a straight line.", fen: '3k5/9/9/9/9/9/9/4C4/9/4K4 w - - 0 1', arrows: [['e3', 'e9'], ['e3', 'a3'], ['e3', 'i3']] },
          { type: 'text', text: "To <b>capture</b>, the Cannon must jump over <b>exactly one</b> piece (of either color) on its line. That piece is called the <b>screen</b>. Here the red Soldier on e4 is the screen, so the Cannon can capture the Chariot on e7.", fen: '3k5/9/9/4r4/9/9/4P4/4C4/9/4K4 w - - 0 1', marks: ['e4'], arrows: [['e3', 'e7']], legal: ['e3e7'] },
          { type: 'goal', goal: 'capture', text: "This is the starting position. Can your Cannon capture something right away? Look for a screen!", fen: XQ, moves: ['h3h10', 'b3b10'], success: 'Boom! The black Cannon on the 8th rank was the screen, and the Horse behind it is gone.', fail: 'Look up the b-file or the h-file. The black Cannon there can act as a screen.' },
          { type: 'goal', goal: 'move', text: "The most popular first move in xiangqi puts a Cannon in the middle. Move a Cannon to <b>e3</b>.", fen: XQ, moves: ['h3e3', 'b3e3'], success: 'This is the famous <b>central cannon</b>. Using your own Soldier on e4 as a screen, it already aims at the black Soldier on e7.', fail: 'Slide a Cannon sideways along the 3rd rank to e3.' },
        ] },
        { id: 'xq-soldier', title: 'The Soldier', desc: 'Small but brave', steps: [
          { type: 'text', text: "The <b>Soldier</b> is 兵 (bing, said 'bing') for Red and 卒 (zu, said 'dzoo') for Black. In the picture set it is a <b>soldier with a spear</b>. Before it crosses the river it can only move <b>one point forward</b>.", fen: '3k5/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1', legal: ['e4e5'], illegal: ['e4d4', 'e4f4', 'e4e3'] },
          { type: 'text', text: "After it crosses the river it grows stronger: it may move one point <b>forward or sideways</b>. It can never move backward. It captures the same way it moves.", fen: '3k5/9/9/9/4P4/9/9/9/9/4K4 w - - 0 1', marks: ['e7', 'd6', 'f6'], legal: ['e6e7', 'e6d6', 'e6f6'], illegal: ['e6e5'] },
          { type: 'goal', goal: 'capture', text: "Your Soldier has crossed the river. Capture the black Horse!", fen: '3k5/9/9/9/3nP4/9/9/9/9/4K4 w - - 0 1', moves: ['e6d6'], success: 'Yes! A Soldier across the river can capture sideways.', fail: 'Across the river, a Soldier can move sideways. The Horse is right next to it.' },
          { type: 'text', text: "A Soldier never promotes. When it reaches the last rank it can only walk sideways, so do not rush it there too early.", fen: '2P2k3/9/9/9/9/9/9/9/9/4K4 w - - 0 1', legal: ['c10b10', 'c10d10'] },
        ] },
        { id: 'xq-win', title: 'How to Win', desc: 'Checkmate, and why stalemate loses', steps: [
          { type: 'text', text: "You win by <b>checkmate</b>: the enemy General is attacked and has no way to escape. In xiangqi there is a twist: if a player has <b>no legal move at all</b> (stalemate), that player <b>loses</b>. Here Black cannot move anything, so Red has won.", fen: '4k4/R8/9/9/9/5R3/9/9/9/3K5 b - - 0 1', marks: ['d10', 'e9', 'f10'] },
          { type: 'goal', goal: 'mate', text: "Checkmate in one move! Hint: your own General helps by guarding the e-file.", fen: '3k5/9/9/9/9/7R1/p8/9/9/4K4 w - - 0 1', moves: ['h5d5'], success: 'Checkmate! The Chariot attacks the d-file, and the black General cannot step to the e-file because of the flying general rule.', fail: 'Put the Chariot on the same file as the black General. Your own General already covers the e-file.' },
          { type: 'goal', goal: 'mate', text: "Checkmate with your Horse! The black General is boxed in by its own Advisors.", fen: '3ak4/4a4/9/7N1/9/9/9/r8/9/5K3 w - - 0 1', moves: ['h7g9'], success: 'Checkmate! The Horse attacks e10, and f10 is covered by your General on the open f-file.', fail: 'Find a Horse jump that attacks e10. Remember the leg must be free.' },
          { type: 'text', text: "A few more rules. You may not give <b>perpetual check</b> (checking again and again forever); the checking side must stop or it loses. Chasing an unprotected piece forever is also not allowed. If neither side can win, the game can be drawn." },
        ] },
        { id: 'xq-strategy', title: 'First Strategy', desc: 'Get your big pieces out', steps: [
          { type: 'text', text: "Piece values help you decide trades. A common guide: <b>Chariot 9</b>, <b>Cannon 4.5</b>, <b>Horse 4</b>, <b>Elephant 2</b>, <b>Advisor 2</b>, <b>Soldier 1</b> (2 after crossing the river). Cannons are strong early when the board is full of screens; Horses get better later when the board is open.", fen: XQ },
          { type: 'line', text: "Let's play a classic opening as Red. First the central cannon (<b>h3 to e3</b>), then bring out the Horse (<b>h1 to g3</b>) and the Chariot (<b>i1 to h1</b>).", fen: XQ, side: 'w', moves: ['h3e3', 'h10g8', 'h1g3', 'i10h10', 'i1h1'], success: 'Great start! Your Cannon aims at the center, your Horse guards e4, and your Chariot is ready to roll up the open h-file.' },
          { type: 'text', text: "Three tips from Hoot: <b>1.</b> Bring your Chariots out early, they are your strongest pieces. <b>2.</b> Keep Advisors and Elephants at home to guard your General. <b>3.</b> Do not let a Cannon line up with your General with only one piece in between!" },
        ] },
      ],
    },

    // =====================================================================================
    shogi: {
      title: 'Shogi (Japanese Chess)',
      intro: "Shogi (said 'show-gee') is the chess of Japan. Its big idea: pieces you capture <b>join your army</b> and can be dropped back onto the board. The first player is called <b>Sente</b> and sits at the bottom; the second player is <b>Gote</b>.",
      lessons: [
        { id: 'sh-board', title: 'The Board', desc: '81 squares and wedge-shaped pieces', steps: [
          { type: 'text', text: "Hello! Professor Hoot here. Shogi is played on a board of <b>9 by 9 squares</b>. Each side has 20 pieces. In the traditional set all pieces are the same color: you can tell whose piece it is by the way its pointed end faces. Pieces point toward the enemy.", fen: SH },
          { type: 'text', text: "In this app the files are lettered a to i from left to right and the ranks numbered 1 to 9 from Sente's side. (Japanese books number the files from the right and the ranks from the top, but the moves are the same.) Your King starts on <b>e1</b>.", fen: SH, marks: ['e1', 'e9'] },
          { type: 'text', text: "Your back rank: Lance, Knight, Silver, Gold, <b>King</b>, Gold, Silver, Knight, Lance. In front of it, the Bishop (b2) and Rook (h2). Then a row of 9 Pawns.", fen: SH, marks: ['b2', 'h2'] },
        ] },
        { id: 'sh-king-gold-silver', title: 'King, Gold and Silver', desc: 'The royal guard', steps: [
          { type: 'text', text: "The <b>King</b> is 王将 / 玉将 (osho or gyokusho, said 'oh-show' / 'gyok-show'). In the picture set it is a <b>king with a crown</b>, and the little dots around the edge of every picture piece show where it can step. It moves one square in any direction.", fen: '4k4/9/9/9/4K4/9/9/9/9[] w - - 0 1', marks: ['d6', 'e6', 'f6', 'd5', 'f5', 'd4', 'e4', 'f4'] },
          { type: 'text', text: "The <b>Gold General</b> is 金将 (kin, said 'keen'). In the picture set it is a <b>gold bar</b>. It moves one square straight in any direction, or one square <b>diagonally forward</b>. It cannot go diagonally backward. That makes 6 squares.", fen: '4k4/9/9/9/4G4/9/9/9/4K4[] w - - 0 1', marks: ['d6', 'e6', 'f6', 'd5', 'f5', 'e4'] },
          { type: 'goal', goal: 'capture', text: "Capture with your Gold. One black piece is in reach and one is not!", fen: '4k4/9/9/3p5/4G4/3s5/9/9/4K4[] w - - 0 1', moves: ['e5d6'], success: 'Right! Diagonally forward is fine. Diagonally backward is the one move a Gold cannot make.', fail: 'A Gold cannot move diagonally backward. Take the pawn diagonally in front instead.' },
          { type: 'text', text: "The <b>Silver General</b> is 銀将 (gin, said 'geen'). In the picture set it is a <b>silver bar</b>. It moves one square <b>diagonally</b> in any direction, or one square <b>straight forward</b>. It cannot move sideways or straight back. That makes 5 squares.", fen: '4k4/9/9/9/4S4/9/9/9/4K4[] w - - 0 1', marks: ['d6', 'e6', 'f6', 'd4', 'f4'] },
          { type: 'goal', goal: 'capture', text: "Capture with your Silver!", fen: '4k4/9/9/9/4S4/3gp4/9/9/4K4[] w - - 0 1', moves: ['e5d4'], success: 'Good! A Silver can step diagonally backward, but not straight back.', fail: 'A Silver cannot move straight back. Try diagonally backward.' },
        ] },
        { id: 'sh-rook-bishop', title: 'Rook and Bishop', desc: 'The two long-range pieces', steps: [
          { type: 'text', text: "The <b>Rook</b> is 飛車 (hisha, said 'hee-shah'), the <b>Flying Chariot</b>. It moves any distance straight, like a chess rook. The <b>Bishop</b> is 角行 (kaku, said 'kah-koo'), the <b>Angle Mover</b>. It moves any distance diagonally. Neither can jump. In the picture set they look like a chess <b>rook</b> and <b>bishop</b>.", fen: '4k4/9/9/9/2R3B2/9/9/9/4K4[] w - - 0 1', arrows: [['c5', 'c9'], ['c5', 'a5'], ['c5', 'c2'], ['g5', 'i7'], ['g5', 'e7'], ['g5', 'd2']] },
          { type: 'goal', goal: 'move', best: true, depth: 2, text: "Your Rook can capture two pieces. One is protected by a Silver. Take the <b>free</b> one!", fen: '4k4/3s5/4b4/9/9/9/4R2g1/9/4K4[] w - - 0 1', moves: ['e3h3'], success: 'Excellent! The Gold was free. Remember: a piece you lose goes to your opponent\'s hand.', fail: 'The Bishop on e7 is guarded by the Silver on d8. Take the Gold on h3 instead.' },
          { type: 'text', text: "When they promote, these pieces get even stronger. The <b>Dragon King</b> 龍王 (ryuo, said 'ryoo-oh') moves like a Rook <b>plus</b> one square diagonally. The <b>Dragon Horse</b> 龍馬 (ryuma, said 'ryoo-mah') moves like a Bishop <b>plus</b> one square straight.", fen: '4k4/9/9/9/2+R3+B2/9/9/9/4K4[] w - - 0 1', marks: ['b6', 'd6', 'b4', 'd4', 'g6', 'f5', 'h5', 'g4'] },
        ] },
        { id: 'sh-knight-lance-pawn', title: 'Knight, Lance and Pawn', desc: 'Pieces that only go forward', steps: [
          { type: 'text', text: "The <b>Knight</b> is 桂馬 (keima, said 'kay-mah'). In the picture set it is a <b>horse</b>. It jumps two squares forward and one to the side, so it has only <b>2 squares</b> to choose from. It jumps over pieces, but it can never move backward or sideways.", fen: '4k4/9/9/9/9/9/4N4/9/4K4[] w - - 0 1', marks: ['d5', 'f5'], legal: ['e3d5', 'e3f5'] },
          { type: 'goal', goal: 'capture', text: "Jump with your Knight and capture the Gold!", fen: '4k4/9/9/9/3g5/9/4N4/9/4K4[] w - - 0 1', moves: ['e3d5'], success: 'Hop! Two forward and one to the side.', fail: 'The Knight jumps two squares forward and one to the side.' },
          { type: 'text', text: "The <b>Lance</b> is 香車 (kyosha, said 'kyoh-shah'), the Incense Chariot, drawn as a <b>lance</b> (a long spear). It moves any distance <b>straight forward</b> only. It can never turn around!", fen: '4k4/9/9/9/9/9/9/9/L3K4[] w - - 0 1', arrows: [['a1', 'a9']] },
          { type: 'goal', goal: 'capture', text: "Fire the Lance up the file and capture the Bishop.", fen: '4k4/9/9/8b/9/9/9/9/4K3L[] w - - 0 1', moves: ['i1i6'], success: 'Zoom! The Lance flies straight ahead.', fail: 'The Lance only moves straight forward. Look up the i-file.' },
          { type: 'text', text: "The <b>Pawn</b> is 歩兵 (fu, said 'foo'), drawn as a <b>foot soldier</b>. It moves one square forward, and it also <b>captures straight forward</b>, not diagonally like in chess. Here your Pawn can take the black Pawn in front of it.", fen: '4k4/9/9/4p4/4P4/9/9/9/4K4[] w - - 0 1', legal: ['e5e6'] },
        ] },
        { id: 'sh-drops', title: 'Captures and Drops', desc: 'Your prisoners fight for you', steps: [
          { type: 'text', text: "This is shogi's big idea. When you capture a piece, it goes into your <b>hand</b>. Later, instead of moving, you may <b>drop</b> it onto any empty square as your own piece. A dropped piece always starts unpromoted.", fen: '4k4/9/9/9/9/9/9/9/4K4[RBp] w - - 0 1' },
          { type: 'goal', goal: 'drop', best: true, text: "You have a Knight in hand. Drop it where it attacks the Rook <b>and</b> the Gold at the same time!", fen: '4k4/9/2r1g4/9/9/9/9/9/3GKG3[N] w - - 0 1', moves: ['N@d5'], success: 'A fork! Black can only save one, and nothing can capture your Knight on d5.', fail: 'A Knight on d5 attacks both c7 and e7.' },
          { type: 'text', text: "Drop rules: <b>1.</b> You may not drop a piece where it could never move again: no Pawn or Lance on the last rank, no Knight on the last two ranks. <b>2.</b> Two-pawn rule (nifu): you may not drop a Pawn on a file that already has one of your unpromoted Pawns. Here the c-file is not allowed.", fen: '4k4/9/9/9/9/9/2P6/9/4K4[P] w - - 0 1', marks: ['c3'], legal: ['P@d5', 'P@a8'], illegal: ['P@c5', 'P@a9'] },
          { type: 'text', text: "<b>3.</b> You may give check with a dropped Pawn, but you may <b>not checkmate by dropping a Pawn</b> (uchifuzume). Here P@e8 would be mate, so it is against the rules and loses the game. Checkmate with a Pawn that <b>moves</b> is fine, and so is a mate by dropping any other piece.", fen: '3lkl3/9/4G4/9/9/9/9/9/4K4[P] w - - 0 1', marks: ['e8'], losing: ['P@e8'] },
        ] },
        { id: 'sh-promotion', title: 'Promotion', desc: 'The last three ranks', steps: [
          { type: 'text', text: "The last <b>three ranks</b> on the far side are your <b>promotion zone</b>. When a piece moves into, inside, or out of the zone, you may flip it over to <b>promote</b> it.", fen: SH, marks: SH_ZONE },
          { type: 'text', text: "Silver, Knight, Lance and Pawn promote into pieces that move <b>like a Gold</b> (a promoted Pawn is called <b>tokin</b>, said 'toh-keen'). Rook becomes Dragon King, Bishop becomes Dragon Horse. The King and the Gold never promote. Promotion is your choice, but a captured promoted piece goes into the hand <b>unpromoted</b>." },
          { type: 'goal', goal: 'promote', text: "Move your Pawn into the zone and promote it!", fen: '4k4/9/9/2P6/9/9/9/9/4K4[] w - - 0 1', moves: ['c6c7+'], success: 'Your Pawn is now a tokin and moves like a Gold!', fail: 'Move the Pawn one square forward and choose to promote.' },
          { type: 'text', text: "Sometimes promotion is <b>forced</b>: a piece must promote if it could never move again otherwise. A Pawn or Lance reaching the last rank, or a Knight reaching the last two ranks, must promote.", fen: '4k4/2P6/4N4/9/9/9/9/9/4K4[] w - - 0 1', legal: ['c8c9+', 'e7d9+'], illegal: ['c8c9', 'e7d9'] },
          { type: 'goal', goal: 'promote', text: "Both players have opened their Bishop's diagonal. Capture Black's Bishop and promote yours to a Dragon Horse!", fen: 'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL[] w - - 0 3', moves: ['b2h8+'], success: 'A Bishop trade with a promotion. Black will recapture, but now you each hold a Bishop in hand.', fail: 'Your Bishop on b2 sees all the way to h8. Capture and promote.' },
        ] },
        { id: 'sh-win', title: 'How to Win', desc: 'Checkmate with drops', steps: [
          { type: 'text', text: "You win by <b>checkmate</b> (tsumi). Because pieces can be dropped, stalemate almost never happens; in this app a player with no legal move loses. If the same position appears <b>four times</b>, the game is a draw (sennichite), but a player who causes it by checking every move loses instead." },
          { type: 'goal', goal: 'mate', text: "Drop your Gold to checkmate! This is the famous <b>head Gold</b> mate.", fen: '4k4/9/4P4/9/9/9/9/9/4K4[G] w - - 0 1', moves: ['G@e8'], success: 'Checkmate! The Gold covers every escape, and your Pawn guards it.', fail: 'Drop the Gold right in front of the King, where your Pawn protects it.' },
          { type: 'goal', goal: 'mate', text: "The black King hides in the corner. Find the mating drop!", fen: '7nk/8l/7P1/9/9/9/9/9/4K4[G] w - - 0 1', moves: ['G@h8'], success: 'Checkmate! The King is trapped by its own Knight and Lance.', fail: 'Drop the Gold next to the King where your Pawn protects it.' },
        ] },
        { id: 'sh-strategy', title: 'First Strategy', desc: 'Open lines and build a castle', steps: [
          { type: 'text', text: "Rough piece values: Pawn 1, Lance 3, Knight 4, Silver 5, Gold 6, Bishop 8, Rook 10. Remember that every piece you lose goes into your opponent's hand, so a loose piece hurts twice!" },
          { type: 'line', text: "Let's play a common opening as Sente. Open your Bishop's diagonal (<b>c3 to c4</b>), then push your Rook's Pawn (<b>h3 to h4</b>, then <b>h4 to h5</b>).", fen: SH, side: 'w', moves: ['c3c4', 'g7g6', 'h3h4', 'b7b6', 'h4h5'], success: 'Well played! Both sides opened lines for their Bishop and Rook.' },
          { type: 'text', text: "Before attacking, build a <b>castle</b>: move your King away from the center and surround it with Golds and Silvers. Here Sente has built the <b>Mino castle</b> (said 'mee-no') on the right side, with the Rook moved to the left to attack.", fen: 'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PPBPPPPPP/2S1GRSK1/LN3G1NL[] b - - 0 1', marks: ['h2', 'g2', 'f1', 'e2'] },
        ] },
      ],
    },

    // =====================================================================================
    janggi: {
      title: 'Janggi (Korean Chess)',
      intro: "Janggi (said 'jahng-ghee') is the chess of Korea. The two sides are <b>Cho</b> (blue or green, said 'choh') and <b>Han</b> (red, said 'hahn'). Cho moves first. It looks like xiangqi, but there is no river and many pieces move differently!",
      lessons: [
        { id: 'jg-board', title: 'The Board', desc: 'Palaces with diagonal lines', steps: [
          { type: 'text', text: "Hi, Professor Hoot here! Like xiangqi, janggi pieces stand on the <b>points</b> of a 9 by 10 grid. But there is <b>no river</b>: every piece may go anywhere it can reach.", fen: JG },
          { type: 'text', text: "Each side has a <b>palace</b> with an X inside. The General and the Guards must stay in it. The diagonal lines of the palace are real roads: pieces can move along them.", fen: JG, marks: XQ_PALACES },
          { type: 'text', text: "The General starts in the <b>center</b> of its palace (e2 for Cho). Before the game each player may <b>swap</b> the Horse and Elephant on either side, so there are four different setups. This app shows one of them.", fen: JG, marks: ['e2', 'e9', 'b1', 'c1', 'g1', 'h1'] },
        ] },
        { id: 'jg-general', title: 'General and Guards', desc: 'Moving along the palace lines', steps: [
          { type: 'text', text: "The <b>General</b> (gung, said 'goong') is the piece you must protect. It shows 楚 for Cho and 漢 for Han. In the picture set it is a <b>general wearing a helmet</b>. It moves <b>one point along any line</b> of the palace, including the diagonals. From the center it can reach all 8 other points.", fen: '5k3/9/9/9/9/9/9/9/4K4/9 w - - 0 1', marks: ['d1', 'e1', 'f1', 'd2', 'f2', 'd3', 'e3', 'f3'] },
          { type: 'goal', goal: 'move', text: "Move your General diagonally to the corner <b>d3</b>.", fen: '5k3/9/9/9/9/9/9/9/4K4/9 w - - 0 1', moves: ['e2d3'], success: 'Nice! The diagonal line from the center leads straight to the corner.', fail: 'Follow the diagonal line from e2 to d3.' },
          { type: 'text', text: "Careful: there are no diagonal lines through the <b>middle of a side</b> like d2. From d2 the General can only go up, down or to the center.", fen: '5k3/9/9/9/9/9/9/9/3K5/9 w - - 0 1', legal: ['d2d1', 'd2d3', 'd2e2'], illegal: ['d2e1', 'd2e3'] },
          { type: 'text', text: "The two <b>Guards</b> 士 (sa, said 'sah') move exactly like the General: one point along the palace lines, never leaving the palace. In the picture set each Guard is a <b>scholar with a hat</b>.", fen: '5k3/9/9/9/9/9/9/9/4K4/3A1A3 w - - 0 1', marks: ['d1', 'f1'] },
        ] },
        { id: 'jg-chariot', title: 'The Chariot', desc: 'Straight lines and palace diagonals', steps: [
          { type: 'text', text: "The <b>Chariot</b> 車 (cha, said 'chah') is the strongest piece. In the picture set it is a <b>two-wheeled war cart</b>. It moves any distance in a straight line, and inside a palace it may also slide along the <b>diagonal lines</b>.", fen: '5k3/9/9/9/9/9/9/3R5/9/4K4 w - - 0 1', arrows: [['d3', 'f1'], ['d3', 'd10'], ['d3', 'a3']], legal: ['d3e2', 'd3f1'] },
          { type: 'goal', goal: 'capture', text: "Your Chariot has reached the enemy palace. Capture the Han Chariot using a palace diagonal!", fen: '3R5/5k3/5r3/9/9/9/9/9/4K4/9 w - - 0 1', moves: ['d10f8'], success: 'Swish! Down the diagonal from d10 through e9 to f8.', fail: 'Follow the palace diagonal from d10 through e9.' },
        ] },
        { id: 'jg-horse-elephant', title: 'Horse and Elephant', desc: 'Two pieces that can be blocked', steps: [
          { type: 'text', text: "The <b>Horse</b> 馬 (ma, said 'mah') moves one point straight and then one point diagonally outward, just like in xiangqi. In the picture set it is a <b>horse head</b>. If the first point is occupied, that way is blocked.", fen: '5k3/9/9/9/9/4N4/9/9/4K4/9 w - - 0 1', marks: ['d7', 'f7', 'c6', 'g6', 'c4', 'g4', 'd3', 'f3'] },
          { type: 'text', text: "The <b>Elephant</b> 象 (sang, said 'sahng') moves one point straight and then <b>two</b> points diagonally outward. In the picture set it is an <b>elephant head</b>. Unlike in xiangqi, it can go anywhere on the board.", fen: '5k3/9/9/9/9/4B4/9/9/4K4/9 w - - 0 1', marks: ['c8', 'g8', 'b7', 'h7', 'b3', 'h3', 'c2', 'g2'], legal: ['e5c8', 'e5g8', 'e5b7', 'e5h7', 'e5b3', 'e5h3', 'e5c2', 'e5g2'] },
          { type: 'text', text: "The Elephant is blocked if <b>any</b> point on its path is taken, the first straight step or the next diagonal point. Here the Soldier on e4 blocks the way down to c2 and g2.", fen: '5k3/9/9/9/9/4B4/4P4/9/4K4/9 w - - 0 1', marks: ['e4'], illegal: ['e5c2', 'e5g2'], legal: ['e5b3', 'e5h3'] },
          { type: 'goal', goal: 'capture', text: "Capture with your Elephant. One target is blocked!", fen: '5k3/9/9/1r5n1/2N6/4B4/9/9/4K4/9 w - - 0 1', moves: ['e5h7'], success: 'Great! Your own Horse on c6 was in the way to b7, but h7 was open.', fail: 'The path to b7 goes through c6, where your Horse stands. Try the Horse on h7.' },
        ] },
        { id: 'jg-cannon', title: 'The Cannon', desc: 'Always jumping', steps: [
          { type: 'text', text: "The <b>Cannon</b> 包 (po, said 'poh') is very different from the xiangqi cannon. In the picture set it is a <b>cannon on wheels</b>. It must <b>always jump over exactly one piece</b>, both to move and to capture. With no screen, it cannot move at all! Inside a palace it may also jump along a diagonal line, using a piece on the center point as its screen.", fen: '5k3/9/2r6/9/9/9/9/2N6/4K4/2C6 w - - 0 1', marks: ['c3'], legal: ['c1c4', 'c1c5', 'c1c8'], illegal: ['c1c2'] },
          { type: 'text', text: "Two more rules: a Cannon may <b>not jump over another Cannon</b>, and it may <b>not capture a Cannon</b>. Here the c1 Cannon has a Cannon as its screen, and the g1 Cannon would be capturing a Cannon. Both are not allowed.", fen: '5k3/9/2r3c2/9/9/9/9/2C3N2/4K4/2C3C2 w - - 0 1', illegal: ['c1c4', 'c1c8', 'g1g8'], legal: ['g1g4'] },
          { type: 'goal', goal: 'capture', text: "Use your Soldier as a screen and capture the Han Chariot!", fen: '5k3/9/9/1r7/9/9/1P7/1C7/4K4/9 w - - 0 1', moves: ['b3b7'], success: 'Boom! Over the Soldier and onto the Chariot.', fail: 'The Cannon jumps over the Soldier on b4 to reach b7.' },
        ] },
        { id: 'jg-soldier', title: 'The Soldier', desc: 'Forward and sideways from the start', steps: [
          { type: 'text', text: "The <b>Soldier</b> is 兵 (byeong, said 'byuhng') for Cho and 卒 (jol, said 'jole') for Han. In the picture set it is a <b>soldier with a spear</b>. With no river in janggi, it may move one point <b>forward or sideways</b> from the very start. Never backward.", fen: '5k3/9/9/9/9/9/4P4/9/4K4/9 w - - 0 1', legal: ['e4e5', 'e4d4', 'e4f4'], illegal: ['e4e3'] },
          { type: 'goal', goal: 'capture', text: "Inside the enemy palace, a Soldier may also step <b>diagonally forward</b> along the palace lines. Capture the Guard!", fen: '5k3/4a4/3P5/9/9/9/9/9/4K4/9 w - - 0 1', moves: ['d8e9'], success: 'Yes! The palace diagonal let your Soldier capture.', fail: 'Follow the palace diagonal from d8 to e9.' },
        ] },
        { id: 'jg-rules', title: 'Special Rules and Winning', desc: 'Passing, bikjang and checkmate', steps: [
          { type: 'text', text: "You win by <b>checkmate</b>. In janggi you may also <b>pass</b> your turn instead of moving (but not while your General is in check). Because of that, stalemate does not happen in janggi." },
          { type: 'text', text: "<b>Bikjang</b> (said 'bick-jahng'): if the two Generals face each other on a file with nothing between them, the other player must break it right away. If not, the game ends and the pieces are counted. Here Cho has just moved to d2, so Han must react.", fen: '3k5/9/9/9/9/9/9/9/3K5/R8 b - - 1 1', arrows: [['d2', 'd10']] },
          { type: 'text', text: "Counting points: <b>Chariot 13</b>, <b>Cannon 7</b>, <b>Horse 5</b>, <b>Elephant 3</b>, <b>Guard 3</b>, <b>Soldier 2</b>. Han gets <b>1.5 extra</b> points because Cho moved first. Points are also used when a game reaches the move limit. (Some friendly games simply call bikjang a draw.)" },
          { type: 'goal', goal: 'mate', text: "Checkmate in one! Your Soldier on e8 is already doing a lot of work.", fen: '4k4/9/4P4/9/9/8p/9/9/4K4/R8 w - - 0 1', moves: ['a1a10'], success: 'Checkmate! The Chariot attacks the whole back rank and the Soldier covers e9.', fail: 'Attack the General along the back rank. The Soldier already covers e9.' },
        ] },
        { id: 'jg-strategy', title: 'First Strategy', desc: 'Develop horses and protect the palace', steps: [
          { type: 'text', text: "Cannons are strong while the board is crowded with screens. Chariots are your best attackers. Keep your Guards close to your General: the palace is your fortress." },
          { type: 'line', text: "A calm start as Cho: bring both Horses toward the center (<b>b1 to c3</b> and <b>h1 to g3</b>).", fen: JG, side: 'w', moves: ['b1c3', 'b10c8', 'h1g3', 'h10g8'], success: 'Good development! Both Horses now guard the center and make room for your Chariots.' },
        ] },
      ],
    },

    // =====================================================================================
    makruk: {
      title: 'Makruk (Thai Chess)',
      intro: "Makruk (said 'mahk-rook') is the chess of Thailand. It is a close cousin of chess, but its pieces are slower and more careful, and the pawns start further forward. White moves first.",
      lessons: [
        { id: 'mk-board', title: 'The Board and Setup', desc: 'A chess board with a twist', steps: [
          { type: 'text', text: "Sawasdee! Professor Hoot here. Makruk uses an 8 by 8 board, often with no colored squares. The pawns (<b>Bia</b>) start on the <b>third</b> rank, not the second.", fen: MK, marks: ['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3'] },
          { type: 'text', text: "Back rank: Rua, Ma, Khon, then the <b>Khun</b> (king) and the <b>Met</b>, then Khon, Ma, Rua. The two Khuns do not face each other: White's is on d1 and Black's on e8.", fen: MK, marks: ['d1', 'e1', 'e8', 'd8'] },
        ] },
        { id: 'mk-khun-met', title: 'Khun and Met', desc: 'The king and his advisor', steps: [
          { type: 'text', text: "The <b>Khun</b> (said 'koon') is the king. In the picture set it is a <b>king with a crown</b>. It moves one square in any direction. There is no castling in makruk.", fen: '4k3/8/8/8/3K4/8/8/8 w - - 0 1', marks: ['c5', 'd5', 'e5', 'c4', 'e4', 'c3', 'd3', 'e3'] },
          { type: 'text', text: "The <b>Met</b> (said 'met') stands where the queen stands in chess, but it is much weaker: it moves only <b>one square diagonally</b>. In the picture set it is a <b>queen-like advisor</b>.", fen: '4k3/8/8/8/4M3/8/8/3K4 w - - 0 1', marks: ['d5', 'f5', 'd3', 'f3'] },
          { type: 'goal', goal: 'capture', text: "Capture the black Bia with your Met.", fen: '4k3/8/8/3p4/4M3/8/8/3K4 w - - 0 1', moves: ['e4d5'], success: 'Got it! One diagonal step.', fail: 'The Met moves one square diagonally.' },
        ] },
        { id: 'mk-khon-ma', title: 'Khon and Ma', desc: 'The nobleman and the horse', steps: [
          { type: 'text', text: "The <b>Khon</b> (said 'kohn') stands where the bishop stands in chess. It moves one square <b>diagonally</b> in any direction, or one square <b>straight forward</b>. In the picture set it is drawn like a <b>bishop</b>.", fen: '4k3/8/8/8/4S3/8/8/3K4 w - - 0 1', marks: ['d5', 'e5', 'f5', 'd3', 'f3'] },
          { type: 'goal', goal: 'capture', text: "Capture with your Khon. Remember which ways it can go!", fen: '4k3/8/8/8/4S3/3rn3/8/7K w - - 0 1', moves: ['e4d3'], success: 'Right! Diagonally backward is allowed, straight backward is not.', fail: 'The Khon cannot step straight back. Try diagonally.' },
          { type: 'text', text: "The <b>Ma</b> (said 'mah') is the horse. In the picture set it is a <b>horse head</b>. It moves exactly like a chess knight, in an L shape, and it can jump over pieces.", fen: '4k3/8/8/8/3N4/8/8/7K w - - 0 1', marks: ['c6', 'e6', 'b5', 'f5', 'b3', 'f3', 'c2', 'e2'] },
          { type: 'goal', goal: 'move', best: true, text: "Find the Ma move that attacks the Khun <b>and</b> the Rua at the same time!", fen: 'r3k3/8/8/1N6/8/8/8/3K4 w - - 0 1', moves: ['b5c7'], success: 'A royal fork! The Khun must move, and the Rua falls.', fail: 'Look for a square that attacks both e8 and a8.' },
        ] },
        { id: 'mk-rua-bia', title: 'Rua and Bia', desc: 'The boat and the pawns', steps: [
          { type: 'text', text: "The <b>Rua</b> (said 'roo-ah') means boat. In the picture set it is a <b>boat</b>. It moves like a chess rook: any distance straight. It is the strongest piece in makruk.", fen: '4k3/8/8/8/3R4/8/8/7K w - - 0 1', arrows: [['d4', 'd8'], ['d4', 'a4'], ['d4', 'h4'], ['d4', 'd1']] },
          { type: 'text', text: "The <b>Bia</b> (said 'bee-ah') is the pawn, drawn as a <b>pawn</b>. It moves one square forward and captures one square diagonally forward. It never moves two squares, so there is no en passant.", fen: '4k3/8/8/3p4/4P3/8/8/3K4 w - - 0 1', legal: ['e4e5', 'e4d5'], illegal: ['e4e6'] },
          { type: 'goal', goal: 'promote', text: "A Bia that reaches the <b>sixth rank</b> promotes at once into a Met (called Bia Ngai). Push your Bia!", fen: '4k3/8/8/1P6/8/8/8/3K4 w - - 0 1', moves: ['b5b6m'], success: 'Promoted! Your Bia is now a Met.', fail: 'Move the Bia one square forward to the sixth rank.' },
        ] },
        { id: 'mk-win', title: 'How to Win', desc: 'Checkmate, stalemate and counting', steps: [
          { type: 'text', text: "You win by <b>checkmate</b>. If the player to move is not in check but has no legal move, it is <b>stalemate</b>, and in makruk that is a <b>draw</b>.", fen: 'k1K5/7R/8/8/8/8/8/8 b - - 0 1' },
          { type: 'goal', goal: 'mate', text: "Checkmate in one with your Rua!", fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', moves: ['h1h8'], success: 'Checkmate! Your Khun guards the escape squares.', fail: 'Your Khun covers a7 and b7. Attack along the back rank.' },
          { type: 'goal', goal: 'mate', text: "The black Khun is surrounded by its own pieces. Finish it with your Ma!", fen: '6rk/6sm/8/4N3/8/8/8/3K4 w - - 0 1', moves: ['e5f7'], success: 'Checkmate! A smothered mate: no black piece can take the Ma.', fail: 'Find a knight jump that checks h8.' },
          { type: 'text', text: "Makruk has <b>counting rules</b> so games cannot go on forever. When no unpromoted Bia are left, the weaker side may start counting, and the stronger side must checkmate within <b>64 moves</b>. When the weaker side has only its Khun, the limit is shorter, for example <b>16 moves</b> against one Rua or <b>8</b> against two. If the count runs out, the game is a draw. (These are simplified; the app keeps count for you.)" },
        ] },
        { id: 'mk-strategy', title: 'First Strategy', desc: 'Pawns are the backbone', steps: [
          { type: 'text', text: "Because Met and Khon are slow, makruk is a game of patient maneuvering. Build a strong chain of Bia, bring your Ma toward the center, and use your Rua on open files." },
          { type: 'line', text: "A typical start as White: advance a Bia, bring out a Ma, and push in the center.", fen: MK, side: 'w', moves: ['f3f4', 'c6c5', 'g1f3', 'b8d7', 'e3e4'], success: 'Nice! Your pieces are coming out behind a solid wall of Bia.' },
        ] },
      ],
    },

    // =====================================================================================
    shatranj: {
      title: 'Shatranj (Medieval Chess)',
      intro: "Shatranj (said 'shah-trahnj') was played in Persia and the Arab world more than 1000 years ago. It is the ancestor of modern chess. These are the rules as most historians reconstruct them.",
      lessons: [
        { id: 'sj-board', title: 'The Old Army', desc: 'Shah, Ferz, Alfil and friends', steps: [
          { type: 'text', text: "Greetings from Professor Hoot! Shatranj looks like chess, but some pieces are older and slower. The <b>Shah</b> (said 'shah', the king), <b>Rukh</b> (said 'rook', chariot) and <b>Faras</b> (said 'fah-rahs', horse) move exactly like the chess king, rook and knight. There is no castling.", fen: SJ, marks: ['d1', 'a1', 'h1', 'b1', 'g1'] },
          { type: 'text', text: "The <b>Ferz</b> (said 'fairz', the counselor) stands next to the Shah and moves only <b>one square diagonally</b>. It became the queen of modern chess.", fen: '3k4/8/8/8/4Q3/8/8/3K4 w - - 0 1', marks: ['d5', 'f5', 'd3', 'f3'] },
          { type: 'text', text: "The <b>Alfil</b> (said 'al-feel', the elephant) jumps exactly <b>two squares diagonally</b>, leaping over whatever is in between. It can only ever visit 8 squares in the whole game!", fen: '3k4/8/8/8/3B4/8/8/3K4 w - - 0 1', marks: ['b6', 'f6', 'b2', 'f2'] },
          { type: 'goal', goal: 'capture', text: "Jump with your Alfil and capture the black Faras. The pawn in the way does not stop it!", fen: '3k4/8/8/8/3n4/2p5/1B6/3K4 w - - 0 1', moves: ['b2d4'], success: 'Leap! The Alfil flies over c3 and lands on d4.', fail: 'The Alfil jumps two squares diagonally: b2 to d4.' },
        ] },
        { id: 'sj-baidaq', title: 'The Baidaq', desc: 'Pawns of the past', steps: [
          { type: 'text', text: "The <b>Baidaq</b> (said 'bay-dahk', foot soldier) moves one square forward and captures one square diagonally forward, like a chess pawn. But it can <b>never move two squares</b>.", fen: SJ, legal: ['e2e3'], illegal: ['e2e4'] },
          { type: 'goal', goal: 'promote', text: "A Baidaq that reaches the last rank can only promote to a <b>Ferz</b>. Promote your Baidaq!", fen: '3k4/1P6/8/7p/8/8/8/3K4 w - - 0 1', moves: ['b7b8q'], success: 'Your Baidaq is now a Ferz. Small, but helpful!', fail: 'Move the Baidaq to the last rank.' },
        ] },
        { id: 'sj-win', title: 'Three Ways to Win', desc: 'Checkmate, bare king and stalemate', steps: [
          { type: 'goal', goal: 'mate', text: "<b>1. Checkmate</b> wins, just like in chess. Mate in one!", fen: 'k7/8/1K6/6p1/6P1/8/8/7R w - - 0 1', moves: ['h1h8'], success: 'Checkmate! Your Shah guards the escape squares.', fail: 'Attack along the back rank. Your Shah covers a7 and b7.' },
          { type: 'line', text: "<b>2. Bare king</b>: if you capture every enemy piece except the Shah, you win (unless your opponent can bare your Shah right back on the next move). Capture the last black piece!", fen: '3k4/8/8/8/8/8/n7/R2K4 w - - 0 1', side: 'w', moves: ['a1a2', 'd8c8'], result: '1-0', success: 'The black Shah stands alone. You win by bare king!' },
          { type: 'goal', goal: 'move', wins: true, text: "<b>3. Stalemate</b>: in shatranj, if you leave your opponent with <b>no legal move</b>, you <b>win</b>! Find the move that stalemates Black.", fen: 'k7/8/1PK5/7p/7P/8/8/8 w - - 0 1', moves: ['c6c7'], success: 'Stalemate, and in shatranj that is a win for you!', fail: 'Take away the last free square from the black Shah without giving check.' },
        ] },
        { id: 'sj-strategy', title: 'Playing Shatranj', desc: 'A slow and careful game', steps: [
          { type: 'text', text: "With only short-range Ferz and Alfil, armies meet slowly. Rukhs are by far the strongest pieces, so open files for them. Since bare king wins, trading down to an extra piece is often enough to win!" },
          { type: 'line', text: "A sensible start: push central Baidaqs and bring out the Faras.", fen: SJ, side: 'w', moves: ['e2e3', 'e7e6', 'g1f3', 'g8f6'], success: 'Good! In shatranj there is plenty of time to build your position.' },
        ] },
      ],
    },

    // =====================================================================================
    sittuyin: {
      title: 'Sittuyin (Burmese Chess)',
      intro: "Sittuyin (said 'sit-too-yin') is the chess of Myanmar (Burma). Its special feature: the players <b>place their own pieces</b> before the battle begins. The first player is shown at the bottom and moves first.",
      lessons: [
        { id: 'st-board', title: 'Board and Pieces', desc: 'Meet the Burmese army', steps: [
          { type: 'text', text: "Hello from Professor Hoot! The 8 by 8 board has two long <b>diagonal lines</b> from corner to corner (a1 to h8 and h1 to a8). They matter for promotion. The pawns (<b>Ne</b>, said 'nay') start in a staggered line: four on the 3rd rank and four on the 4th.", fen: '8/8/4pppp/pppp4/4PPPP/PPPP4/8/8[KSSFRRNNkssfrrnn] w - - 0 1' },
          { type: 'text', text: "The pieces: <b>Min-gyi</b> (said 'min-jee', the king) moves one square any way. <b>Sit-ke</b> (said 'sit-kay', the general) moves one square diagonally. <b>Sin</b> (said 'sin', the elephant) moves one square diagonally or one straight forward. <b>Myin</b> (said 'myin', the horse) moves like a chess knight. <b>Yahhta</b> (said 'yah-tah', the chariot) moves like a chess rook.", fen: ST },
          { type: 'goal', goal: 'capture', text: "Practice with the Sin: it can capture forward or diagonally, but never straight back or sideways. Capture!", fen: '4k3/8/8/8/4S3/3rn3/8/7K[] w - - 0 1', moves: ['e4d3'], success: 'Right! Diagonally backward is allowed for the Sin.', fail: 'The Sin cannot step straight back. Try diagonally.' },
        ] },
        { id: 'st-setup', title: 'Setting Up', desc: 'Place your army', steps: [
          { type: 'text', text: "The game starts with only the pawns on the board. The players take turns placing their other pieces on their own half, <b>behind their pawns</b>. The first player places first." },
          { type: 'text', text: "One rule: the <b>Yahhta</b> (chariots) may only be placed on your <b>back rank</b>. The other pieces may go on any free square behind your pawns.", fen: 'r6r/1ns1ksn1/3fpppp/pppp4/4PPPP/PPPPF3/1NSK1SN1/R7[R] w - - 0 1', marks: ['b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'], legal: ['R@h1'], illegal: ['R@e2', 'R@h2'] },
          { type: 'goal', goal: 'drop', text: "Only your second Yahhta is left. Place it on your back rank!", fen: 'r6r/1ns1ksn1/3fpppp/pppp4/4PPPP/PPPPF3/1NSK1SN1/R7[R] w - - 0 1', moves: ['R@h1', 'R@g1', 'R@f1', 'R@e1', 'R@d1', 'R@c1', 'R@b1'], success: 'Your army is ready. Let the battle begin!', fail: 'A Yahhta must go on the first rank.' },
        ] },
        { id: 'st-promote', title: 'Promotion', desc: 'A pawn becomes a general', steps: [
          { type: 'text', text: "A Ne can promote to a <b>Sit-ke</b> only if your Sit-ke has been captured. It must stand on one of the two long diagonals in the enemy half. Promotion takes your whole turn: the Ne turns into a Sit-ke where it stands, or steps one square diagonally and promotes there. (If it is your last Ne, any square will do.)", fen: '7k/8/5P2/8/8/P7/8/4K3[] w - - 0 1', marks: ['e5', 'f6', 'g7', 'h8', 'd5', 'c6', 'b7', 'a8'] },
          { type: 'goal', goal: 'promote', text: "Your Ne on f6 stands on the long diagonal. Promote it!", fen: '7k/8/5P2/8/8/P7/8/4K3[] w - - 0 1', moves: ['f6f6f', 'f6e7f', 'f6e5f', 'f6g5f'], success: 'You have a new Sit-ke!', fail: 'Promote the Ne on f6, in place or with one diagonal step.' },
          { type: 'text', text: "Also, the new Sit-ke may not give check or attack an enemy piece right away. That is why promoting on g7 next to the black Min-gyi is not allowed here.", fen: '7k/8/5P2/8/8/P7/8/4K3[] w - - 0 1', marks: ['g7'], illegal: ['f6g7f'], legal: ['f6e7f'] },
        ] },
        { id: 'st-win', title: 'How to Win', desc: 'Checkmate, stalemate and counting', steps: [
          { type: 'goal', goal: 'mate', text: "You win by <b>checkmate</b>. Mate in one with your Yahhta!", fen: 'k7/8/1K6/8/8/8/8/7R[] w - - 0 1', moves: ['h1h8'], success: 'Checkmate! Your Min-gyi guards the escape squares.', fail: 'Attack along the back rank.' },
          { type: 'text', text: "<b>Stalemate is a draw</b> in sittuyin. Like makruk, there is also a counting rule: when one side has only its Min-gyi left and the other side has no pawns, the stronger side must mate within a limit (for example 16 moves with a Yahhta), or the game is drawn.", fen: 'k1K5/7R/8/8/8/8/8/8[] b - - 0 1' },
        ] },
      ],
    },

    // =====================================================================================
    crazyhouse: {
      title: 'Crazyhouse',
      intro: "Crazyhouse is chess with a shogi twist: the pieces you capture become yours, and you can drop them back onto the board!",
      lessons: [
        { id: 'zh-drops', title: 'Captures Become Yours', desc: 'Dropping pieces', steps: [
          { type: 'text', text: "Everything is like normal chess, except: when you capture a piece, it goes into your <b>pocket</b> in your own color. On any later turn, instead of moving, you may <b>drop</b> it on any empty square.", fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R[] w KQkq - 0 3' },
          { type: 'text', text: "Two rules for drops: pawns may not be dropped on the first or last rank, and a piece that was promoted from a pawn goes back into the pocket as a <b>pawn</b>. Dropping a piece to give check, or even checkmate, is allowed!" },
          { type: 'goal', goal: 'mate', text: "Drop your Rook to give checkmate!", fen: '6k1/5ppp/8/8/8/8/5PPP/6K1[R] w - - 0 1', moves: ['R@a8', 'R@b8', 'R@c8', 'R@d8', 'R@e8'], success: 'Checkmate from the pocket! A back-rank mate out of nowhere.', fail: 'Drop the Rook on the back rank, far enough that the King cannot take it.' },
        ] },
        { id: 'zh-tactics', title: 'Drop Tactics', desc: 'Knights out of nowhere', steps: [
          { type: 'text', text: "In crazyhouse, attacks on the king are fast and deadly. Keep pieces near your King, and never forget what your opponent has in their pocket!" },
          { type: 'goal', goal: 'mate', text: "The black King is walled in by its own pieces. Drop your Knight for a smothered mate!", fen: '6rk/6pp/8/8/8/8/5PPP/6K1[N] w - - 0 1', moves: ['N@f7'], success: 'Smothered mate! Nobody can reach f7.', fail: 'Find the square where a Knight checks h8.' },
        ] },
      ],
    },

    // =====================================================================================
    '3check': {
      title: 'Three-check',
      intro: "Three-check is normal chess with one extra way to win: give check <b>three times</b>!",
      lessons: [
        { id: '3c-rules', title: 'Count the Checks', desc: 'Three checks win', steps: [
          { type: 'text', text: "All chess rules apply, and checkmate still wins. But you also win as soon as you have given <b>three checks</b> in the game. Every check counts, even if the checking piece is captured right after." },
          { type: 'goal', goal: 'check', text: "Give your first check! Sacrificing a piece is fine if it scores a check.", fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 3+3 0 3', moves: ['c4f7'], success: 'Check number one! The Bishop may be lost, but the check counts.', fail: 'The Bishop on c4 can reach f7 with check.' },
        ] },
        { id: '3c-finish', title: 'The Third Check', desc: 'Finish the job', steps: [
          { type: 'goal', goal: 'check', wins: true, text: "You have already given two checks. One more and you win!", fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 1+3 0 3', moves: ['c4f7'], success: 'Third check! You win the game.', fail: 'Any check wins here. Look at the Bishop.' },
          { type: 'text', text: "Hoot's tip: in three-check, keep your King safe from checks too. Castle early and do not open lines toward your King." },
        ] },
      ],
    },

    // =====================================================================================
    kingofthehill: {
      title: 'King of the Hill',
      intro: "King of the Hill is normal chess, but you also win by bringing your King to the <b>hill</b>: the four center squares.",
      lessons: [
        { id: 'koth-rules', title: 'Climb the Hill', desc: 'The four center squares', steps: [
          { type: 'text', text: "The hill is <b>d4, e4, d5 and e5</b>. If your King safely reaches one of them, you win at once. Checkmate also still wins.", fen: 'k7/8/8/8/8/8/8/7K w - - 0 1', marks: ['d4', 'e4', 'd5', 'e5'] },
          { type: 'goal', goal: 'move', wins: true, text: "Walk your King onto the hill!", fen: 'k7/8/8/8/8/2K5/8/8 w - - 0 1', moves: ['c3d4'], success: 'King of the hill! You win.', fail: 'Step diagonally to d4, one of the center squares.' },
        ] },
        { id: 'koth-race', title: 'The King Race', desc: 'Plan your walk', steps: [
          { type: 'text', text: "Kings are attackers in this game. Watch out: your opponent's King may also be racing to the center, and you must keep guarding the hill squares with your pieces." },
          { type: 'line', text: "March your King to the hill: <b>e2 to e3</b>, then <b>e3 to e4</b>.", fen: 'k7/8/8/8/8/8/4K3/8 w - - 0 1', side: 'w', moves: ['e2e3', 'a8b7', 'e3e4'], result: '1-0', success: 'You reached the hill first!' },
        ] },
      ],
    },

    // =====================================================================================
    atomic: {
      title: 'Atomic Chess',
      intro: "In atomic chess every capture causes an <b>explosion</b>! Blow up the enemy King to win.",
      lessons: [
        { id: 'at-rules', title: 'Explosions', desc: 'What a capture does', steps: [
          { type: 'text', text: "When a piece captures, it explodes. The captured piece, the capturing piece, and every piece on the 8 squares around them are removed, <b>except pawns</b> (pawns only vanish if they capture or are captured themselves)." },
          { type: 'text', text: "Rules that follow: you win if your explosion removes the enemy King. A King can never capture (it would blow itself up). And if your King touches the enemy King, it cannot be checked by pieces, because any capture there would blow up both Kings." },
          { type: 'goal', goal: 'capture', wins: true, text: "Capture a pawn next to the black King and blow it up!", fen: 'rnbqkbnr/pppp1ppp/4p3/6N1/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 3', moves: ['g5f7'], success: 'Boom! The explosion on f7 reached the King on e8. You win!', fail: 'Capture on a square right next to the black King.' },
        ] },
        { id: 'at-defend', title: 'Staying Safe', desc: 'Watch your neighbours', steps: [
          { type: 'text', text: "Defend by keeping the squares next to your King protected and by not crowding pieces around it. Hoot's tip: the f7 and f2 pawns are the weak spots early in the game, just like in the puzzle you solved." },
        ] },
      ],
    },

    // =====================================================================================
    horde: {
      title: 'Horde',
      intro: "In Horde, White has no King but a giant army of <b>36 pawns</b>. Black has a normal army.",
      lessons: [
        { id: 'hd-rules', title: 'The Horde', desc: 'Pawns against an army', steps: [
          { type: 'text', text: "<b>Black wins</b> by capturing every white piece. <b>White wins</b> by checkmating the black King. Pawns move and promote as usual.", fen: 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1' },
          { type: 'goal', goal: 'promote', text: "A Horde pawn has broken through. Promote it to a Queen!", fen: '4k3/1P6/8/8/8/8/8/8 w - - 0 1', moves: ['b7b8q'], success: 'A new Queen for the horde!', fail: 'Push the pawn to the last rank and choose a Queen.' },
        ] },
        { id: 'hd-tips', title: 'Horde Strategy', desc: 'Walls and breakthroughs', steps: [
          { type: 'text', text: "As White, advance pawns side by side so they protect each other, and aim to promote. As Black, attack pawn chains from the side and trade pieces only when you are sure to win the race." },
        ] },
      ],
    },

    // =====================================================================================
    antichess: {
      title: 'Antichess',
      intro: "Antichess turns chess upside down: you try to <b>lose all your pieces</b>!",
      lessons: [
        { id: 'ac-rules', title: 'Must Capture', desc: 'Upside-down rules', steps: [
          { type: 'text', text: "Rules: if you can capture, you <b>must</b> capture (you may choose which capture). The King is an ordinary piece: there is no check, and it can be captured. Pawns may also promote to a King. You win if you lose all your pieces, or if you have no legal move." },
          { type: 'goal', goal: 'capture', text: "You have a capture available, so you must take it!", fen: '8/8/8/8/8/2p5/1P6/8 w - - 0 1', moves: ['b2c3'], success: 'Correct, capturing was forced.', fail: 'When a capture is possible, you must capture.' },
        ] },
        { id: 'ac-giveaway', title: 'Give It Away', desc: 'Lose your last piece', steps: [
          { type: 'line', text: "You have one pawn left. Move it where Black <b>must</b> capture it!", fen: '8/8/8/8/3p4/8/4P3/8 w - - 0 1', side: 'w', moves: ['e2e3', 'd4e3'], result: '1-0', success: 'Black had to take, and now you have no pieces. You win!' },
        ] },
      ],
    },
  };
})();
if (typeof module !== 'undefined') module.exports = WORLD_COURSES;
