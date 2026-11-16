// World Games: rules (ffish.js) and engine (Fairy-Stockfish) for chess's relatives.
// Classic script, no modules. Defines the globals VARIANTS, Variants and VGame.
// Nothing is downloaded until Variants.ready() or Variants.engine.* is first called.
//
// FILES (paths relative to the page, change with Variants.basePath = 'vendor/fairy/'):
//   vendor/fairy/ffish.js + ffish.wasm            rules library, loaded on the main thread by Variants.ready()
//   vendor/fairy/vengine-worker.js                engine worker (classic Web Worker)
//   vendor/fairy/fairy-stockfish.wasm             engine, single-threaded (no SharedArrayBuffer needed)
//
// SQUARE NAMES (identical to Fairy-Stockfish / ffish):
//   file letter a.. from the FIRST player's left, then rank number 1.. counted from the first
//   player's side. The first player is always 'w' (White, Red in xiangqi, Cho in janggi,
//   Sente/Black in shogi). Ranks can have two digits: xiangqi and janggi use a1..i10.
//   Xiangqi/janggi pieces stand on intersections; a1 is Red's/Cho's bottom-left point.
//   Shogi uses a1..i9: file a = shogi file 9, file i = shogi file 1; rank 1 = shogi rank i
//   (Sente's back rank), rank 9 = shogi rank a. So shogi "7g" = c3, "7f" = c4, "5e" = e5.
//
// MOVE STRINGS (exactly what ffish legalMoves() returns, and what the engine plays):
//   normal move    'e2e4', 'b10c8', 'h3e3'
//   promotion      chess family 'e7e8q' (lowercase target: q r b n, antichess also k);
//                  shogi 'b2h8+' (promote); the same move without '+' does not promote;
//                  makruk 'c6c7m' (pawn to met); shatranj 'a7a8q' (pawn to ferz);
//                  sittuyin 'a5b6f' or in place 'a5a5f' (pawn to general / sit-ke)
//   drop           'P@e5' (letter is always UPPERCASE, the side to move drops it):
//                  shogi, crazyhouse, and the sittuyin set-up phase ('K@e2', 'R@a1', ...)
//   pass           janggi only: the king's own square twice, e.g. 'e2e2'
//   Variants.parseMove(uci) -> {from, to, drop, promo, pass} splits any of these.
//
// PIECE TYPE LETTERS: VGame.pieces() reports the FEN letter upper-cased, so the mapping between
// ffish FEN letters and type letters is the identity in every game (white = uppercase in FEN).
// Promoted pieces keep their base letter with promoted:true (shogi '+P' tokin -> {type:'P',
// promoted:true}; makruk/shatranj/sittuyin/crazyhouse '~' marks -> promoted:true, e.g. a makruk
// promoted pawn is {type:'M', promoted:true}). VARIANTS[id].pieceTypes describes each letter:
//   game          K        Q / M / F       R        B           N        P        others
//   chess family  King     Q Queen         Rook     Bishop      Knight   Pawn
//   xiangqi       General  -               Chariot  B Elephant  Horse    Soldier  A Advisor, C Cannon
//   janggi        General  -               Chariot  B Elephant  Horse    Soldier  A Guard,   C Cannon
//   shogi         King     -               Rook     Bishop      Knight   Pawn     G Gold, S Silver, L Lance
//   makruk        Khun     M Met           Ruea     -           Ma       Bia      S Khon
//   shatranj      Shah     Q Ferz          Rukh     B Alfil     Faras    Baidaq
//   sittuyin      Min-gyi  F Sit-ke        Yahhta   -           Myin     Ne       S Sin
//
// API
//   Variants.ready() -> Promise<true>              loads ffish (once)
//   Variants.loaded                                 true after ready() resolved
//   Variants.list                                   ids in menu order
//   Variants.parseMove(uci)                         see above
//   Variants.squares(id)                            all square names of the board, a1 first
//   new VGame(id, fen?)                             (after ready()) throws on unknown id / bad FEN
//     .legalMoves() -> [uci]   .play(uci) -> {uci, san, capture, check} | null   .undo() -> uci|null
//     .fen()  .startFen()  .turn() -> 'w'|'b'  .inCheck()  .moves  .sans  .isLegal(uci)
//     .san(uci, notation?)  notation: VARIANTS[id].notation by default ('san' for the chess
//         family, makruk, shatranj, sittuyin and janggi; 'wxf' for xiangqi, e.g. 'C2=5';
//         'hodges' for shogi, e.g. 'P-7f', 'B*5e', 'Bx2b+'); also 'lan', 'hosking',
//         'hodgesNumber', 'janggi' (numeric Korean), 'thai'. A janggi pass is 'pass'.
//     .status() -> {over, result:'1-0'|'0-1'|'1/2-1/2'|'*', reason}
//         reasons: checkmate, stalemate, repetition, insufficient-material, move-rule,
//         counting-rule, three-checks, king-of-the-hill, king-exploded, horde-destroyed,
//         no-pieces, bikjang / double-pass (janggi, decided on points), bare-king, variant-end
//     .pieces() -> [{sq, type, color:'w'|'b', promoted}]   .pockets() -> {w:{P:2,..}, b:{..}}
//     .movesFrom(sq) -> [uci]   .drops(type?) -> [uci]   .dispose() frees wasm memory (optional)
//   Variants.engine.bestMove(id, fen|null, moves[], {level 1..8, nodes?, timeMs?, depth?})
//         -> Promise<{uci, score, mate?, depth}>   score = centipawns for the side to move
//         (after `moves`), mate = moves to mate (+ we mate, - we get mated); uci null if no move
//   Variants.engine.analyze(id, fen|null, moves[], {depth?|timeMs?|nodes?, multipv?})
//         -> Promise<{lines:[{cp?, mate?, depth, pv:[uci]}], bestmove}>  side-to-move scores
//   Variants.engine.ready() -> Promise<true>   .available (null|true|false)   .terminate()
//   A search cannot be interrupted (the wasm engine is single-threaded and synchronous), so
//   every request is bounded (default 1.5 s); requests are queued and run one at a time.
//   terminate() kills the worker and rejects all pending requests (next call restarts it).
(function (global) {
  'use strict';

  function pt(name, native, value, extra) { var o = { name: name, native: native, value: value }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
  var CHESS_PIECES = {
    K: pt('King', 'King', 0), Q: pt('Queen', 'Queen', 9), R: pt('Rook', 'Rook', 5),
    B: pt('Bishop', 'Bishop', 3), N: pt('Knight', 'Knight', 3), P: pt('Pawn', 'Pawn', 1)
  };
  function chessLike(id, name, blurb, extra) {
    var v = { id: id, name: name, english: name, files: 8, ranks: 8, grid: 'squares', checkered: true, pockets: false,
      promotions: 'mandatory', origin: 'Modern variant', blurb: blurb, pieceTypes: CHESS_PIECES, family: 'chess', notation: 'san' };
    if (extra) for (var k in extra) v[k] = extra[k];
    return v;
  }

  var VARIANTS = {
    chess: chessLike('chess', 'Chess', 'The international game of strategy in which you win by checkmating the enemy king.', { origin: 'India / Persia / Europe' }),
    xiangqi: {
      id: 'xiangqi', notation: 'wxf', name: 'Xiangqi', english: 'Chinese Chess', files: 9, ranks: 10, grid: 'intersections', checkered: false,
      pockets: false, promotions: 'none', palace: true, river: true, origin: 'China', family: 'xiangqi',
      blurb: 'Pieces stand on the points of a 9x10 board split by a river, and each general must stay inside its palace while cannons capture by jumping.',
      pieceTypes: {
        K: pt('General', 'Shuai / Jiang', 0), A: pt('Advisor', 'Shi', 2), B: pt('Elephant', 'Xiang', 2),
        N: pt('Horse', 'Ma', 4), R: pt('Chariot', 'Ju', 9), C: pt('Cannon', 'Pao', 4.5), P: pt('Soldier', 'Bing / Zu', 1)
      }
    },
    shogi: {
      id: 'shogi', notation: 'hodges', name: 'Shogi', english: 'Japanese Chess', files: 9, ranks: 9, grid: 'squares', checkered: false,
      pockets: true, promotions: 'optional', promotionZone: 3, origin: 'Japan', family: 'shogi',
      blurb: 'Captured pieces change sides and can be dropped back onto the board, and most pieces may promote in the last three ranks.',
      pieceTypes: {
        K: pt('King', 'Osho / Gyokusho', 0), R: pt('Rook', 'Hisha', 10, { promotedName: 'Dragon', promotedNative: 'Ryuo', promotedValue: 12 }),
        B: pt('Bishop', 'Kakugyo', 8, { promotedName: 'Horse', promotedNative: 'Ryuma', promotedValue: 10 }),
        G: pt('Gold', 'Kinsho', 6), S: pt('Silver', 'Ginsho', 5, { promotedName: 'Promoted Silver', promotedNative: 'Narigin', promotedValue: 6 }),
        N: pt('Knight', 'Keima', 4, { promotedName: 'Promoted Knight', promotedNative: 'Narikei', promotedValue: 6 }),
        L: pt('Lance', 'Kyosha', 3, { promotedName: 'Promoted Lance', promotedNative: 'Narikyo', promotedValue: 6 }),
        P: pt('Pawn', 'Fuhyo', 1, { promotedName: 'Tokin', promotedNative: 'Tokin', promotedValue: 6 })
      }
    },
    janggi: {
      id: 'janggi', notation: 'san', name: 'Janggi', english: 'Korean Chess', files: 9, ranks: 10, grid: 'intersections', checkered: false,
      pockets: false, promotions: 'none', palace: true, river: false, passing: true, origin: 'Korea', family: 'xiangqi',
      blurb: 'A relative of xiangqi without a river, where pieces move along the palace diagonals, cannons must jump to move, and a player may pass.',
      pieceTypes: {
        K: pt('General', 'Gung', 0), A: pt('Guard', 'Sa', 3), B: pt('Elephant', 'Sang', 3),
        N: pt('Horse', 'Ma', 5), R: pt('Chariot', 'Cha', 13), C: pt('Cannon', 'Po', 7), P: pt('Soldier', 'Byeong / Jol', 2)
      }
    },
    makruk: {
      id: 'makruk', notation: 'san', name: 'Makruk', english: 'Thai Chess', files: 8, ranks: 8, grid: 'squares', checkered: false,
      pockets: false, promotions: 'mandatory', promotionRank: 6, origin: 'Thailand', family: 'makruk',
      blurb: 'Thailand\'s chess, with pawns starting on the third rank, a one-step diagonal queen called the met, and pawns promoting on the sixth rank.',
      pieceTypes: {
        K: pt('King', 'Khun', 0), M: pt('Queen', 'Met', 1.6), S: pt('Bishop', 'Khon', 2.5),
        N: pt('Knight', 'Ma', 3), R: pt('Rook', 'Ruea', 5), P: pt('Pawn', 'Bia', 1)
      }
    },
    shatranj: {
      id: 'shatranj', notation: 'san', name: 'Shatranj', english: 'Persian Chess', files: 8, ranks: 8, grid: 'squares', checkered: false,
      pockets: false, promotions: 'mandatory', origin: 'Persia', family: 'shatranj',
      blurb: 'The medieval Persian and Arab ancestor of chess, with a weak one-step ferz instead of a queen, a jumping alfil, and a win by baring the enemy king.',
      pieceTypes: {
        K: pt('King', 'Shah', 0), Q: pt('Ferz', 'Firzan', 1.5), B: pt('Alfil', 'Pil', 1.2),
        N: pt('Knight', 'Faras', 3), R: pt('Rook', 'Rukh', 5), P: pt('Pawn', 'Baidaq', 1)
      }
    },
    sittuyin: {
      id: 'sittuyin', notation: 'san', name: 'Sittuyin', english: 'Burmese Chess', files: 8, ranks: 8, grid: 'squares', checkered: false,
      pockets: true, setupPhase: true, promotions: 'optional', origin: 'Myanmar', family: 'makruk',
      blurb: 'Myanmar\'s chess begins with the pawns staggered across the board and each player placing the other pieces on their own half before play.',
      pieceTypes: {
        K: pt('King', 'Min-gyi', 0), F: pt('General', 'Sit-ke', 1.6), S: pt('Elephant', 'Sin', 2.5),
        N: pt('Horse', 'Myin', 3), R: pt('Chariot', 'Yahhta', 5), P: pt('Pawn', 'Ne', 1)
      }
    },
    crazyhouse: chessLike('crazyhouse', 'Crazyhouse', 'Chess in which every piece you capture joins your side and can be dropped back onto an empty square instead of making a move.', { pockets: true }),
    '3check': chessLike('3check', 'Three-check', 'Chess in which you also win by giving check three times.', { checksToWin: 3 }),
    kingofthehill: chessLike('kingofthehill', 'King of the Hill', 'Chess in which you also win by bringing your king safely to one of the four centre squares.', { hill: ['d4', 'e4', 'd5', 'e5'] }),
    atomic: chessLike('atomic', 'Atomic', 'Chess in which every capture causes an explosion that removes all pieces except pawns on the surrounding squares, so blowing up the enemy king wins.'),
    horde: chessLike('horde', 'Horde', 'White\'s 36 pawns must checkmate Black, while Black wins by capturing every white piece.'),
    antichess: chessLike('antichess', 'Antichess', 'Captures are compulsory and you win by losing all your pieces or by being stalemated.', { promotions: 'mandatory (king allowed)' })
  };
  var LIST = ['xiangqi', 'shogi', 'janggi', 'makruk', 'shatranj', 'sittuyin', 'crazyhouse', '3check', 'kingofthehill', 'atomic', 'horde', 'antichess', 'chess'];

  var isNode = typeof window === 'undefined' && typeof process === 'object' && process.versions && process.versions.node && typeof require === 'function';
  var ff = null, loading = null;

  function parseMove(uci) {
    var m;
    if ((m = /^([A-Za-z])@([a-z])(\d+)$/.exec(uci))) return { from: null, to: m[2] + m[3], drop: m[1].toUpperCase(), promo: null, pass: false };
    if ((m = /^([a-z]\d+)([a-z]\d+)(.*)$/.exec(uci))) return { from: m[1], to: m[2], drop: null, promo: m[3] || null, pass: m[1] === m[2] && !m[3] };
    return null;
  }

  function squares(id) {
    var v = VARIANTS[id], out = [];
    for (var r = 1; r <= v.ranks; r++) for (var f = 0; f < v.files; f++) out.push(String.fromCharCode(97 + f) + r);
    return out;
  }

  function loadNode() {
    var fs = require('fs'), path = require('path');
    var dir = path.join(__dirname, '..', 'vendor', 'fairy');
    var src = fs.readFileSync(path.join(dir, 'ffish.js'), 'utf8');
    var factory = new Function('require', 'process', '__dirname', src + '\n;return FFishModule;')(require, process, dir);
    return factory({ wasmBinary: fs.readFileSync(path.join(dir, 'ffish.wasm')) });
  }
  function loadBrowser() {
    return new Promise(function (resolve, reject) {
      if (typeof FFishModule === 'function') return resolve();
      var s = document.createElement('script');
      s.src = Variants.basePath + 'ffish.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('could not load ' + s.src)); };
      document.head.appendChild(s);
    }).then(function () {
      /* global FFishModule */
      return FFishModule({ locateFile: function (f) { return Variants.basePath + f; } });
    });
  }
  function ready() {
    if (ff) return Promise.resolve(true);
    if (!loading) {
      loading = (isNode ? Promise.resolve().then(loadNode) : loadBrowser()).then(function (m) {
        ff = m;
        var b = new ff.Board('chess'); b.delete();   // first Board initialises Fairy-Stockfish's tables
        Variants.loaded = true;
        return true;
      }).catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }

  var NOTATION = { default: 'DEFAULT', san: 'SAN', lan: 'LAN', hosking: 'SHOGI_HOSKING', hodges: 'SHOGI_HODGES', hodgesNumber: 'SHOGI_HODGES_NUMBER', janggi: 'JANGGI', wxf: 'XIANGQI_WXF', thai: 'THAI_SAN', thaiLan: 'THAI_LAN' };
  var registry = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(function (b) { try { b.delete(); } catch (e) {} }) : null;

  function VGame(variantId, fen) {
    if (!ff) throw new Error('Variants.ready() must resolve before creating a VGame');
    if (!VARIANTS[variantId]) throw new Error('unknown variant ' + variantId);
    this.variant = variantId;
    this.meta = VARIANTS[variantId];
    if (fen && ff.validateFen(fen, variantId) !== 1) throw new Error('invalid FEN for ' + variantId + ': ' + fen);
    this._b = fen ? new ff.Board(variantId, fen) : new ff.Board(variantId);
    this._start = this._b.fen();   // normalised (ffish writes e.g. shogi hands as '[]')
    if (registry) registry.register(this, this._b, this);
    this.moves = []; this.sans = [];
    this._keys = [posKey(this._b.fen())];
    this._legal = null;
  }
  // position identity for repetition: placement + pockets + side to move (+ check counters)
  function posKey(fen) { var p = fen.split(' '); return p[0] + ' ' + p[1] + (p.length > 6 ? ' ' + p[4] : ''); }

  VGame.prototype = {
    legalMoves: function () {
      if (!this._legal) { var s = this._b.legalMoves(); this._legal = s ? s.split(' ') : []; }
      return this._legal.slice();
    },
    isLegal: function (uci) { this.legalMoves(); return this._legal.indexOf(uci) >= 0; },
    movesFrom: function (sq) { return this.legalMoves().filter(function (m) { var p = parseMove(m); return p && p.from === sq; }); },
    drops: function (type) { return this.legalMoves().filter(function (m) { var p = parseMove(m); return p && p.drop && (!type || p.drop === type.toUpperCase()); }); },
    san: function (uci, notation) {
      if (!this.isLegal(uci)) return null;
      var pm = parseMove(uci);
      if (pm && pm.pass) return 'pass';
      return this._b.sanMove(uci, ff.Notation[NOTATION[notation || this.meta.notation] || 'SAN']);
    },
    play: function (uci) {
      if (!this.isLegal(uci)) return null;
      var san = this.san(uci);
      var capture = this._b.isCapture(uci);
      if (!this._b.push(uci)) return null;
      this._legal = null;
      this.moves.push(uci); this.sans.push(san);
      this._keys.push(posKey(this._b.fen()));
      return { uci: uci, san: san, capture: capture, check: this._b.isCheck() };
    },
    undo: function () {
      if (!this.moves.length) return null;
      this._b.pop(); this._legal = null; this.sans.pop(); this._keys.pop();
      return this.moves.pop();
    },
    fen: function () { return this._b.fen(); },
    startFen: function () { return this._start; },
    turn: function () { return this._b.turn() ? 'w' : 'b'; },
    inCheck: function () { return this._b.isCheck(); },
    lastMove: function () { return this.moves.length ? this.moves[this.moves.length - 1] : null; },
    status: function () {
      var b = this._b;
      if (!b.isGameOver(true)) return { over: false, result: '*', reason: null };
      var result = b.result(true), v = this.variant, reason = 'variant-end';
      var noMoves = this.legalMoves().length === 0, pcs = this.pieces();
      var kings = pcs.filter(function (p) { return p.type === 'K'; });
      var key = this._keys[this._keys.length - 1], reps = 0;
      for (var i = 0; i < this._keys.length; i++) if (this._keys[i] === key) reps++;
      if (v === 'atomic' && kings.length < 2) reason = 'king-exploded';
      else if (v === 'kingofthehill' && kings.some(function (k) { return /^[de][45]$/.test(k.sq); })) reason = 'king-of-the-hill';
      else if (v === '3check' && /(^|\s)(\d+)\+(\d+)\s/.test(b.fen()) && /(^|\s)(0\+\d+|\d+\+0)\s/.test(b.fen())) reason = 'three-checks';
      else if (v === 'horde' && !pcs.some(function (p) { return p.color === 'w'; })) reason = 'horde-destroyed';
      else if (v === 'antichess' && (!pcs.some(function (p) { return p.color === 'w'; }) || !pcs.some(function (p) { return p.color === 'b'; }))) reason = 'no-pieces';
      else if (v === 'janggi' && b.isBikjang()) reason = 'bikjang';
      else if (v === 'janggi' && this.moves.length >= 2 && this.moves.slice(-2).every(function (m) { var q = parseMove(m); return q && q.pass; })) reason = 'double-pass';   // generals face each other: decided on points
      else if (noMoves) reason = b.isCheck() ? 'checkmate' : 'stalemate';
      else if (reps >= 3) reason = 'repetition';
      else if (b.isInsufficientMaterial()) reason = 'insufficient-material';
      else if (result === '1/2-1/2' && (v === 'makruk' || v === 'sittuyin')) reason = 'counting-rule';
      else if (result === '1/2-1/2' && b.halfmoveClock() >= 100) reason = 'move-rule';
      else if (v === 'shatranj' && kings.length === 2) reason = 'bare-king';
      return { over: true, result: result, reason: reason };
    },
    pieces: function () {
      var place = this._b.fen(true).split(' ')[0].replace(/\[.*$/, '');
      var rows = place.split('/'), out = [], ranks = this.meta.ranks;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r], f = 0, i = 0, rank = ranks - r;
        while (i < row.length) {
          var c = row[i];
          if (c >= '0' && c <= '9') { var n = ''; while (i < row.length && row[i] >= '0' && row[i] <= '9') n += row[i++]; f += parseInt(n, 10); continue; }
          var promoted = false;
          if (c === '+') { promoted = true; c = row[++i]; }
          i++;
          if (row[i] === '~') { promoted = true; i++; }
          out.push({ sq: String.fromCharCode(97 + f) + rank, type: c.toUpperCase(), color: c === c.toUpperCase() ? 'w' : 'b', promoted: promoted });
          f++;
        }
      }
      return out;
    },
    pockets: function () {
      var res = { w: {}, b: {} };
      if (!this.meta.pockets) return res;
      [['w', true], ['b', false]].forEach(function (s) {
        var str = this._b.pocket(s[1]) || '';
        for (var i = 0; i < str.length; i++) { var t = str[i].toUpperCase(); res[s[0]][t] = (res[s[0]][t] || 0) + 1; }
      }, this);
      return res;
    },
    dispose: function () { if (this._b) { if (registry) registry.unregister(this); this._b.delete(); this._b = null; } }
  };

  // ---------------------------------------------------------------- engine
  // Level table: Fairy-Stockfish "Skill Level" (-20..20), a search limit, and for the lowest
  // levels a chance to play a uniformly random legal move instead (a beginner's blunders).
  var LEVELS = {
    1: { skill: -20, depth: 1, random: 0.4 },
    2: { skill: -12, depth: 2, random: 0.2 },
    3: { skill: -5, depth: 3, random: 0.08 },
    4: { skill: 0, depth: 5, random: 0 },
    5: { skill: 5, depth: 8, movetime: 400 },
    6: { skill: 10, movetime: 600 },
    7: { skill: 15, movetime: 1000 },
    8: { skill: 20, movetime: 1500 }
  };
  var LOAD_TIMEOUT = 30000;
  var worker = null, wready = null, nextId = 1, pending = {}, curVariant = null;

  function rejectAll(err) {
    var p = pending; pending = {};
    for (var k in p) p[k].reject(err);
  }
  function startWorker() {
    if (wready) return wready;
    curVariant = null;
    wready = new Promise(function (resolve, reject) {
      var t = setTimeout(function () { fail(new Error('engine load timeout')); }, LOAD_TIMEOUT);
      function fail(e) {
        clearTimeout(t); engine.available = false; engine.lastError = String(e && e.message || e);
        if (worker && worker.terminate) worker.terminate();
        worker = null; wready = null; rejectAll(e); reject(e);
      }
      function onMsg(d) {
        if (d.ready === true) { clearTimeout(t); engine.available = true; resolve(true); return; }
        if (d.ready === false) { fail(new Error(d.error)); return; }
        var p = pending[d.id]; if (!p) return;
        delete pending[d.id];
        if (d.error) p.reject(new Error(d.error)); else p.resolve(d.lines);
      }
      if (isNode) {
        // In-process engine for Node tests: same wasm and worker code, no Worker thread.
        var path = require('path'), fs = require('fs'), dir = path.join(__dirname, '..', 'vendor', 'fairy');
        var mod = require(path.join(dir, 'vengine-worker.js'));
        mod.createEngine(fs.readFileSync(path.join(dir, 'fairy-stockfish.wasm'))).then(function (e) {
          worker = { postMessage: function (m) { setTimeout(function () { var r; try { r = { id: m.id, lines: e.send(m.cmd) }; } catch (err) { r = { id: m.id, error: String(err) }; } onMsg(r); }, 0); }, terminate: function () {} };
          onMsg({ ready: true });
        }, fail);
        return;
      }
      if (typeof Worker === 'undefined') return fail(new Error('Web Workers not supported'));
      if (typeof location !== 'undefined' && location.protocol === 'file:') return fail(new Error('workers cannot load from file://'));
      if (typeof WebAssembly !== 'object') return fail(new Error('WebAssembly not supported'));
      try { worker = new Worker(Variants.basePath + 'vengine-worker.js'); } catch (e) { return fail(e); }
      worker.onmessage = function (ev) { onMsg(ev.data); };
      worker.onerror = function (ev) { fail(new Error(ev && ev.message || 'worker error')); };
    });
    return wready;
  }
  function send(cmd, timeoutMs) {
    return startWorker().then(function () {
      return new Promise(function (resolve, reject) {
        var id = nextId++, t = null;
        pending[id] = {
          resolve: function (l) { if (t) clearTimeout(t); resolve(l); },
          reject: function (e) { if (t) clearTimeout(t); reject(e); }
        };
        if (timeoutMs) t = setTimeout(function () {
          // the synchronous search cannot be stopped: kill the worker, it restarts on next use
          if (pending[id]) { delete pending[id]; reject(new Error('engine timeout')); engine.terminate(); }
        }, timeoutMs);
        worker.postMessage({ id: id, cmd: cmd });
      });
    });
  }
  function positionCmd(variantId, fen, moves) {
    var s = '';
    if (variantId !== curVariant) { s += 'setoption name UCI_Variant value ' + variantId + '\nucinewgame\n'; curVariant = variantId; }
    s += 'position ' + (fen ? 'fen ' + fen : 'startpos') + (moves && moves.length ? ' moves ' + moves.join(' ') : '') + '\n';
    return s;
  }
  function limitCmd(o, def) {
    if (o.depth) return 'go depth ' + Math.max(1, o.depth | 0) + (o.timeMs ? ' movetime ' + Math.round(o.timeMs) : '');
    if (o.nodes) return 'go nodes ' + Math.max(1, o.nodes | 0) + (o.timeMs ? ' movetime ' + Math.round(o.timeMs) : '');
    return 'go movetime ' + Math.round(o.timeMs || def);
  }
  function parseInfo(lines) {
    var byPv = {}, best = null;
    lines.forEach(function (l) {
      if (l.indexOf('bestmove') === 0) { best = l.split(/\s+/)[1]; return; }
      if (l.indexOf('info ') !== 0 || l.indexOf(' pv ') < 0 || l.indexOf(' score ') < 0) return;
      if (/ (upperbound|lowerbound) /.test(l)) return;
      var t = l.split(/\s+/), o = { depth: 0, pv: [] }, k = 1;
      for (var i = 1; i < t.length; i++) {
        if (t[i] === 'depth') o.depth = +t[++i];
        else if (t[i] === 'multipv') k = +t[++i];
        else if (t[i] === 'score') { if (t[i + 1] === 'cp') o.cp = +t[i + 2]; else if (t[i + 1] === 'mate') o.mate = +t[i + 2]; i += 2; }
        else if (t[i] === 'pv') { o.pv = t.slice(i + 1); break; }
      }
      byPv[k] = o;
    });
    var out = [];
    for (var j = 1; byPv[j]; j++) out.push(byPv[j]);
    if (best === '(none)') best = null;
    return { lines: out, bestmove: best };
  }

  var engine = {
    available: null,
    lastError: null,
    levels: LEVELS,
    ready: function () { return startWorker(); },
    terminate: function () {
      if (worker && worker.terminate) worker.terminate();
      worker = null; wready = null; curVariant = null;
      rejectAll(new Error('engine terminated'));
    },
    bestMove: function (variantId, fen, moves, opts) {
      opts = opts || {};
      if (!VARIANTS[variantId]) return Promise.reject(new Error('unknown variant ' + variantId));
      var L = LEVELS[Math.max(1, Math.min(8, opts.level || 8))];
      var o = { depth: opts.depth || (opts.nodes || opts.timeMs ? 0 : L.depth), nodes: opts.nodes, timeMs: opts.timeMs || L.movetime || (L.depth ? 0 : 1500) };
      if (!o.depth && !o.nodes && !o.timeMs) o.timeMs = 1500;
      var cmd = positionCmd(variantId, fen, moves) + 'setoption name MultiPV value 1\nsetoption name Skill Level value ' + L.skill + '\n';
      var randomPick = L.random && Math.random() < L.random;
      if (randomPick) cmd += 'go perft 1\n';
      cmd += limitCmd(o, 1500);
      var cap = (o.timeMs || 3000) * 3 + 30000;
      return send(cmd, cap).then(function (lines) {
        var info = parseInfo(lines), uci = info.bestmove;
        if (randomPick) {
          var legal = lines.filter(function (l) { return /^\S+: \d+$/.test(l); }).map(function (l) { return l.split(':')[0]; });
          if (legal.length) uci = legal[Math.floor(Math.random() * legal.length)];
        }
        var top = info.lines[0] || {};
        var r = { uci: uci, score: top.cp != null ? top.cp : (top.mate != null ? (top.mate > 0 ? 100000 - top.mate : -100000 - top.mate) : 0), depth: top.depth || 0 };
        if (top.mate != null) r.mate = top.mate;
        if (randomPick) r.random = true;
        return r;
      });
    },
    analyze: function (variantId, fen, moves, opts) {
      opts = opts || {};
      if (!VARIANTS[variantId]) return Promise.reject(new Error('unknown variant ' + variantId));
      var mpv = Math.max(1, Math.min(10, opts.multipv || 1));
      var o = { depth: opts.depth, nodes: opts.nodes, timeMs: opts.timeMs };
      var cmd = positionCmd(variantId, fen, moves) + 'setoption name MultiPV value ' + mpv + '\nsetoption name Skill Level value 20\n' + limitCmd(o, 1000);
      var cap = (o.timeMs || 5000) * 3 + 60000;
      return send(cmd, cap).then(function (lines) {
        var info = parseInfo(lines);
        return { lines: info.lines.map(function (l) { var x = { depth: l.depth, pv: l.pv }; if (l.mate != null) x.mate = l.mate; else x.cp = l.cp; return x; }), bestmove: info.bestmove };
      });
    },
    // raw UCI access for debugging: resolves with the output lines
    uci: function (cmd, timeoutMs) { curVariant = null; return send(cmd, timeoutMs || 60000); }
  };

  var Variants = {
    basePath: 'vendor/fairy/',
    loaded: false,
    list: LIST,
    meta: VARIANTS,
    ready: ready,
    parseMove: parseMove,
    squares: squares,
    startFen: function (id) { return ff ? ff.startingFen(id) : null; },
    validateFen: function (id, fen) { return ff ? ff.validateFen(fen, id) === 1 : null; },
    engine: engine,
    ffish: function () { return ff; }
  };

  global.VARIANTS = VARIANTS;
  global.Variants = Variants;
  global.VGame = VGame;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = { VARIANTS: globalThis.VARIANTS, Variants: globalThis.Variants, VGame: globalThis.VGame };
