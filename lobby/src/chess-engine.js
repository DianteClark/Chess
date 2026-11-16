// GENERATED FILE - DO NOT EDIT.
// Copy of src/engine.js converted to an ES module for the lobby Worker.
// Regenerate with: node lobby/sync-engine.mjs
// Chess rules engine + search. Written as one self-contained factory so it can run
// in the page, in a Web Worker (via Function.toString), and in Node for testing.
function ChessEngineFactory() {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
  const WHITE_SIDE = 0, BLACK_SIDE = 1;
  const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
  const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
  const K_OFF = [1, -1, 16, -16, 17, 15, -17, -15];
  const B_OFF = [17, 15, -17, -15];
  const R_OFF = [1, -1, 16, -16];
  const PIECE_CHARS = ' PNBRQK  pnbrqk';

  // ---------- zobrist ----------
  let seed = 0x2545F491;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }
  const Z1 = new Uint32Array(16 * 128), Z2 = new Uint32Array(16 * 128);
  for (let i = 0; i < Z1.length; i++) { Z1[i] = rnd(); Z2[i] = rnd(); }
  const ZC1 = new Uint32Array(16), ZC2 = new Uint32Array(16);
  for (let i = 0; i < 16; i++) { ZC1[i] = rnd(); ZC2[i] = rnd(); }
  const ZE1 = new Uint32Array(8), ZE2 = new Uint32Array(8);
  for (let i = 0; i < 8; i++) { ZE1[i] = rnd(); ZE2[i] = rnd(); }
  const ZS1 = rnd(), ZS2 = rnd();

  const CASTLE_MASK = new Uint8Array(128).fill(15);
  CASTLE_MASK[4] = 15 & ~3; CASTLE_MASK[7] = 15 & ~1; CASTLE_MASK[0] = 15 & ~2;
  CASTLE_MASK[116] = 15 & ~12; CASTLE_MASK[119] = 15 & ~4; CASTLE_MASK[112] = 15 & ~8;

  const sqName = s => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
  const sqFromName = n => (n.charCodeAt(0) - 97) + (n.charCodeAt(1) - 49) * 16;
  const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mPromo = m => (m >> 14) & 15, mFlags = m => (m >> 18) & 15;
  const mk = (from, to, promo, flags) => from | (to << 7) | (promo << 14) | (flags << 18);
  const colorOf = p => (p & BLACK) ? 1 : 0;

  class Position {
    constructor(fen, opts) {
      this.board = new Int8Array(128);
      this.load(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', opts);
    }
    load(fen, opts) {
      const parts = fen.trim().split(/\s+/);
      this.board.fill(0);
      let rank = 7, file = 0;
      for (const c of parts[0]) {
        if (c === '/') { rank--; file = 0; continue; }
        if (c >= '1' && c <= '8') { file += +c; continue; }
        const idx = PIECE_CHARS.indexOf(c);
        if (idx < 0) throw new Error('bad fen');
        this.board[rank * 16 + file] = idx;
        file++;
      }
      this.turn = parts[1] === 'b' ? 1 : 0;
      this.castle = 0;
      const c = parts[2] || '-';
      // Chess960 (Fischer Random): rook files may be given as letters (Shredder-FEN, e.g. "HFhf")
      this.chess960 = !!(opts && opts.chess960) || (c !== '-' && /[A-Ha-h]/.test(c));
      this.crook = [-1, -1, -1, -1]; // rook squares for rights 1 (white king side), 2 (white queen side), 4, 8 (black)
      this.ep = (parts[3] && parts[3] !== '-') ? sqFromName(parts[3]) : -1;
      this.half = parts[4] ? +parts[4] : 0;
      this.full = parts[5] ? +parts[5] : 1;
      this.kings = [-1, -1];
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        if (this.board[s] === K) this.kings[0] = s;
        if (this.board[s] === (K | BLACK)) this.kings[1] = s;
      }
      const b = this.board;
      if (!this.chess960) {
        if (c.includes('K')) this.castle |= 1; if (c.includes('Q')) this.castle |= 2;
        if (c.includes('k')) this.castle |= 4; if (c.includes('q')) this.castle |= 8;
        // sanitize castling rights against actual piece placement
        if (!(b[4] === K && b[7] === R)) this.castle &= ~1;
        if (!(b[4] === K && b[0] === R)) this.castle &= ~2;
        if (!(b[116] === (K | BLACK) && b[119] === (R | BLACK))) this.castle &= ~4;
        if (!(b[116] === (K | BLACK) && b[112] === (R | BLACK))) this.castle &= ~8;
        this.crook = [7, 0, 119, 112];
      } else {
        for (const ch of c) {
          if (ch === '-') continue;
          const side = (ch >= 'a' && ch <= 'z') ? 1 : 0, rank = side ? 112 : 0, ks = this.kings[side];
          if (ks < 0 || (ks & 0x70) !== rank) continue;
          const rookP = R | (side ? BLACK : 0), up = ch.toUpperCase();
          let rs = -1, kingSide;
          if (up === 'K') { for (let f = 7; f > (ks & 7); f--) if (b[rank + f] === rookP) { rs = rank + f; break; } kingSide = true; }
          else if (up === 'Q') { for (let f = 0; f < (ks & 7); f++) if (b[rank + f] === rookP) { rs = rank + f; break; } kingSide = false; }
          else { const f = up.charCodeAt(0) - 65; if (b[rank + f] === rookP) rs = rank + f; kingSide = f > (ks & 7); }
          if (rs < 0) continue;
          const bit = (side ? 4 : 1) << (kingSide ? 0 : 1);
          this.castle |= bit; this.crook[(side ? 2 : 0) + (kingSide ? 0 : 1)] = rs;
        }
      }
      // castling-rights masks: moving the king or a castling rook (or capturing it) clears rights
      this.cmask = new Uint8Array(128).fill(15);
      for (let i = 0; i < 4; i++) {
        const bit = 1 << i, rs = this.crook[i];
        if (!(this.castle & bit) || rs < 0) continue;
        this.cmask[rs] &= ~bit;
        this.cmask[this.kings[i < 2 ? 0 : 1]] &= ~(i < 2 ? 3 : 12);
      }
      if (!this.chess960) { this.cmask = CASTLE_MASK; }
      if (this.ep >= 0 && !this.epCapturable(this.ep, this.turn)) this.ep = -1;
      this.stack = [];
      this.computeHash();
      this.hist1 = [this.h1]; this.hist2 = [this.h2];
    }
    epCapturable(epSq, side) {
      // is there a pawn of `side` that could capture onto epSq?
      const pawn = side === 0 ? P : (P | BLACK);
      const from1 = side === 0 ? epSq - 15 : epSq + 15, from2 = side === 0 ? epSq - 17 : epSq + 17;
      return (!(from1 & 0x88) && this.board[from1] === pawn) || (!(from2 & 0x88) && this.board[from2] === pawn);
    }
    computeHash() {
      let h1 = 0, h2 = 0;
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = this.board[s];
        if (p) { h1 ^= Z1[p * 128 + s]; h2 ^= Z2[p * 128 + s]; }
      }
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
      if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      if (this.turn) { h1 ^= ZS1; h2 ^= ZS2; }
      this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
    }
    fen() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 16 + f];
          if (!p) { empty++; continue; }
          if (empty) { out += empty; empty = 0; }
          out += PIECE_CHARS[p];
        }
        if (empty) out += empty;
        if (r) out += '/';
      }
      let c = '';
      if (this.chess960) {
        const L = 'ABCDEFGH';
        if (this.castle & 1) c += L[this.crook[0] & 7]; if (this.castle & 2) c += L[this.crook[1] & 7];
        if (this.castle & 4) c += L[this.crook[2] & 7].toLowerCase(); if (this.castle & 8) c += L[this.crook[3] & 7].toLowerCase();
      } else {
        if (this.castle & 1) c += 'K'; if (this.castle & 2) c += 'Q';
        if (this.castle & 4) c += 'k'; if (this.castle & 8) c += 'q';
      }
      return `${out} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
    }
    clone() { const p = new Position(this.fen(), { chess960: this.chess960 }); return p; }

    attacked(sq, by) {
      const b = this.board;
      if (by === 0) {
        let s = sq - 15; if (!(s & 0x88) && b[s] === P) return true;
        s = sq - 17; if (!(s & 0x88) && b[s] === P) return true;
      } else {
        let s = sq + 15; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
        s = sq + 17; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
      }
      const cb = by ? BLACK : 0;
      for (let i = 0; i < 8; i++) { const s = sq + N_OFF[i]; if (!(s & 0x88) && b[s] === (N | cb)) return true; }
      for (let i = 0; i < 8; i++) { const s = sq + K_OFF[i]; if (!(s & 0x88) && b[s] === (K | cb)) return true; }
      for (let i = 0; i < 4; i++) {
        const d = B_OFF[i]; let s = sq + d;
        while (!(s & 0x88)) {
          const p = b[s];
          if (p) { if (p === (B | cb) || p === (Q | cb)) return true; break; }
          s += d;
        }
      }
      for (let i = 0; i < 4; i++) {
        const d = R_OFF[i]; let s = sq + d;
        while (!(s & 0x88)) {
          const p = b[s];
          if (p) { if (p === (R | cb) || p === (Q | cb)) return true; break; }
          s += d;
        }
      }
      return false;
    }
    inCheck(side = this.turn) { return this.attacked(this.kings[side], side ^ 1); }

    // pseudo-legal move generation. capturesOnly for quiescence.
    genMoves(capturesOnly = false) {
      const moves = [];
      const b = this.board, us = this.turn, them = us ^ 1, cb = us ? BLACK : 0;
      const dir = us ? -16 : 16, startRank = us ? 6 : 1, promoRank = us ? 0 : 7;
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = b[sq];
        if (!p || colorOf(p) !== us) continue;
        const t = p & 7;
        if (t === P) {
          const one = sq + dir;
          if (!(one & 0x88) && b[one] === 0) {
            if ((one >> 4) === promoRank) {
              moves.push(mk(sq, one, Q, 0));
              if (!capturesOnly) { moves.push(mk(sq, one, R, 0)); moves.push(mk(sq, one, B, 0)); moves.push(mk(sq, one, N, 0)); }
            } else if (!capturesOnly) {
              moves.push(mk(sq, one, 0, 0));
              const two = one + dir;
              if ((sq >> 4) === startRank && b[two] === 0) moves.push(mk(sq, two, 0, F_DOUBLE));
            }
          }
          for (let k = 0; k < 2; k++) {
            const to = sq + dir + (k ? 1 : -1);
            if (to & 0x88) continue;
            const tp = b[to];
            if (tp && colorOf(tp) === them) {
              if ((to >> 4) === promoRank) {
                moves.push(mk(sq, to, Q, F_CAP));
                if (!capturesOnly) { moves.push(mk(sq, to, R, F_CAP)); moves.push(mk(sq, to, B, F_CAP)); moves.push(mk(sq, to, N, F_CAP)); }
              } else moves.push(mk(sq, to, 0, F_CAP));
            } else if (to === this.ep) moves.push(mk(sq, to, 0, F_CAP | F_EP));
          }
        } else if (t === N || t === K) {
          const offs = t === N ? N_OFF : K_OFF;
          for (let i = 0; i < 8; i++) {
            const to = sq + offs[i];
            if (to & 0x88) continue;
            const tp = b[to];
            if (!tp) { if (!capturesOnly) moves.push(mk(sq, to, 0, 0)); }
            else if (colorOf(tp) === them) moves.push(mk(sq, to, 0, F_CAP));
          }
          if (t === K && !capturesOnly && this.chess960) this.gen960Castles(moves, sq, us);
          else if (t === K && !capturesOnly) {
            if (us === 0 && sq === 4) {
              if ((this.castle & 1) && !b[5] && !b[6] && !this.attacked(4, 1) && !this.attacked(5, 1) && !this.attacked(6, 1)) moves.push(mk(4, 6, 0, F_CASTLE));
              if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && !this.attacked(4, 1) && !this.attacked(3, 1) && !this.attacked(2, 1)) moves.push(mk(4, 2, 0, F_CASTLE));
            } else if (us === 1 && sq === 116) {
              if ((this.castle & 4) && !b[117] && !b[118] && !this.attacked(116, 0) && !this.attacked(117, 0) && !this.attacked(118, 0)) moves.push(mk(116, 118, 0, F_CASTLE));
              if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && !this.attacked(116, 0) && !this.attacked(115, 0) && !this.attacked(114, 0)) moves.push(mk(116, 114, 0, F_CASTLE));
            }
          }
        } else {
          const offs = t === B ? B_OFF : t === R ? R_OFF : K_OFF;
          for (let i = 0; i < offs.length; i++) {
            const d = offs[i]; let to = sq + d;
            while (!(to & 0x88)) {
              const tp = b[to];
              if (!tp) { if (!capturesOnly) moves.push(mk(sq, to, 0, 0)); }
              else { if (colorOf(tp) === them) moves.push(mk(sq, to, 0, F_CAP)); break; }
              to += d;
            }
          }
        }
      }
      return moves;
    }

    // Chess960 castling: the move is encoded as king-square -> castling-rook-square
    gen960Castles(moves, ks, us) {
      if (this.attacked(ks, us ^ 1)) return;
      const b = this.board, rank = ks & 0x70;
      for (let j = 0; j < 2; j++) {
        const idx = (us ? 2 : 0) + j, bit = 1 << idx;
        if (!(this.castle & bit)) continue;
        const rs = this.crook[idx], kingSide = j === 0;
        const kd = rank + (kingSide ? 6 : 2), rd = rank + (kingSide ? 5 : 3);
        const lo = Math.min(ks, rs, kd, rd), hi = Math.max(ks, rs, kd, rd);
        let ok = true;
        for (let s = lo; s <= hi && ok; s++) if (s !== ks && s !== rs && b[s]) ok = false;
        if (!ok) continue;
        const step = kd > ks ? 1 : -1;
        for (let s = ks; ; s += step) { if (s !== ks && this.attacked(s, us ^ 1)) { ok = false; break; } if (s === kd) break; }
        if (!ok) continue;
        // the king must not end in check once the rook has moved (checked by legality test after make)
        moves.push(mk(ks, rs, 0, F_CASTLE));
      }
    }
    make960Castle(m) {
      const b = this.board, from = mFrom(m), rf = mTo(m), us = this.turn;
      const kingSide = (rf & 7) > (from & 7), rank = from & 0x70, kt = rank + (kingSide ? 6 : 2), rt = rank + (kingSide ? 5 : 3);
      this.stack.push({ m, captured: 0, castle: this.castle, ep: this.ep, half: this.half, h1: this.h1, h2: this.h2, c960: { kt, rt } });
      const king = b[from], rook = b[rf];
      let h1 = this.h1, h2 = this.h2;
      h1 ^= Z1[king * 128 + from] ^ Z1[rook * 128 + rf] ^ Z1[king * 128 + kt] ^ Z1[rook * 128 + rt];
      h2 ^= Z2[king * 128 + from] ^ Z2[rook * 128 + rf] ^ Z2[king * 128 + kt] ^ Z2[rook * 128 + rt];
      b[from] = 0; b[rf] = 0; b[kt] = king; b[rt] = rook;
      this.kings[us] = kt;
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
      this.castle &= this.cmask[from] & this.cmask[rf];
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
      if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      this.ep = -1; this.half++;
      if (us === 1) this.full++;
      this.turn = us ^ 1; h1 ^= ZS1; h2 ^= ZS2;
      this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
      this.hist1.push(this.h1); this.hist2.push(this.h2);
    }
    make(m) {
      if ((mFlags(m) & F_CASTLE) && this.chess960) return this.make960Castle(m);
      const b = this.board, from = mFrom(m), to = mTo(m), promo = mPromo(m), flags = mFlags(m);
      const us = this.turn, piece = b[from], dir = us ? -16 : 16;
      const capSq = (flags & F_EP) ? to - dir : to;
      const captured = b[capSq];
      this.stack.push({ m, captured, castle: this.castle, ep: this.ep, half: this.half, h1: this.h1, h2: this.h2 });
      let h1 = this.h1, h2 = this.h2;
      // remove moving piece
      h1 ^= Z1[piece * 128 + from]; h2 ^= Z2[piece * 128 + from];
      if (captured) { h1 ^= Z1[captured * 128 + capSq]; h2 ^= Z2[captured * 128 + capSq]; b[capSq] = 0; }
      const placed = promo ? (promo | (us ? BLACK : 0)) : piece;
      b[from] = 0; b[to] = placed;
      h1 ^= Z1[placed * 128 + to]; h2 ^= Z2[placed * 128 + to];
      if (flags & F_CASTLE) {
        let rf, rt;
        if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; }
        else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
        const rook = b[rf]; b[rf] = 0; b[rt] = rook;
        h1 ^= Z1[rook * 128 + rf] ^ Z1[rook * 128 + rt]; h2 ^= Z2[rook * 128 + rf] ^ Z2[rook * 128 + rt];
      }
      if ((piece & 7) === K) this.kings[us] = to;
      // castling rights
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
      this.castle &= this.cmask[from] & this.cmask[to];
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
      // en passant
      if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      this.ep = -1;
      if (flags & F_DOUBLE) {
        const epSq = from + dir;
        if (this.epCapturable(epSq, us ^ 1)) { this.ep = epSq; h1 ^= ZE1[epSq & 7]; h2 ^= ZE2[epSq & 7]; }
      }
      this.half = ((piece & 7) === P || captured) ? 0 : this.half + 1;
      if (us === 1) this.full++;
      this.turn = us ^ 1;
      h1 ^= ZS1; h2 ^= ZS2;
      this.h1 = h1 >>> 0; this.h2 = h2 >>> 0;
      this.hist1.push(this.h1); this.hist2.push(this.h2);
    }
    unmake() {
      const top = this.stack[this.stack.length - 1];
      if (top && top.c960) {
        const u = this.stack.pop(), b = this.board, from = mFrom(u.m), rf = mTo(u.m);
        this.turn ^= 1; const us = this.turn;
        b[u.c960.kt] = 0; b[u.c960.rt] = 0; b[from] = K | (us ? BLACK : 0); b[rf] = R | (us ? BLACK : 0);
        this.kings[us] = from; if (us === 1) this.full--;
        this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.h1 = u.h1; this.h2 = u.h2;
        this.hist1.pop(); this.hist2.pop();
        return;
      }
      const u = this.stack.pop();
      const m = u.m, b = this.board, from = mFrom(m), to = mTo(m), promo = mPromo(m), flags = mFlags(m);
      this.turn ^= 1;
      const us = this.turn, dir = us ? -16 : 16;
      let piece = b[to];
      if (promo) piece = P | (us ? BLACK : 0);
      b[from] = piece; b[to] = 0;
      if (u.captured) { const capSq = (flags & F_EP) ? to - dir : to; b[capSq] = u.captured; }
      if (flags & F_CASTLE) {
        let rf, rt;
        if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; }
        else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
        b[rf] = b[rt]; b[rt] = 0;
      }
      if ((piece & 7) === K) this.kings[us] = from;
      if (us === 1) this.full--;
      this.castle = u.castle; this.ep = u.ep; this.half = u.half; this.h1 = u.h1; this.h2 = u.h2;
      this.hist1.pop(); this.hist2.pop();
    }
    makeNull() {
      this.stack.push({ m: 0, captured: 0, castle: this.castle, ep: this.ep, half: this.half, h1: this.h1, h2: this.h2, nul: true });
      let h1 = this.h1, h2 = this.h2;
      if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      this.ep = -1; this.turn ^= 1; h1 ^= ZS1; h2 ^= ZS2;
      this.h1 = h1 >>> 0; this.h2 = h2 >>> 0; this.half++;
      this.hist1.push(this.h1); this.hist2.push(this.h2);
    }
    unmakeNull() {
      const u = this.stack.pop();
      this.turn ^= 1; this.ep = u.ep; this.half = u.half; this.h1 = u.h1; this.h2 = u.h2;
      this.hist1.pop(); this.hist2.pop();
    }
    // make a move and report whether it was legal (if not, it is undone)
    tryMake(m) {
      this.make(m);
      if (this.attacked(this.kings[this.turn ^ 1], this.turn)) { this.unmake(); return false; }
      return true;
    }
    legalMoves() {
      const out = [];
      for (const m of this.genMoves()) if (this.tryMake(m)) { this.unmake(); out.push(m); }
      return out;
    }
    hasLegalMove() {
      for (const m of this.genMoves()) if (this.tryMake(m)) { this.unmake(); return true; }
      return false;
    }
    repetitionCount() {
      // how many times the current position has occurred (including now)
      const n = this.hist1.length - 1, h1 = this.h1, h2 = this.h2;
      let count = 1;
      for (let i = n - 2; i >= 0 && i >= n - this.half; i -= 2)
        if (this.hist1[i] === h1 && this.hist2[i] === h2) count++;
      return count;
    }
    insufficientMaterial() {
      let minors = 0, bishopColors = [0, 0], knights = 0;
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        const t = this.board[s] & 7;
        if (!t || t === K) continue;
        if (t === P || t === R || t === Q) return false;
        minors++;
        if (t === N) knights++; else bishopColors[((s >> 4) + (s & 7)) & 1]++;
      }
      if (minors <= 1) return true;
      if (knights === 0 && (bishopColors[0] === 0 || bishopColors[1] === 0)) return true;
      return false;
    }
    // game status: {over, result:'1-0'|'0-1'|'1/2-1/2', reason}
    status() {
      const hasMove = this.hasLegalMove();
      if (!hasMove) {
        if (this.inCheck()) return { over: true, result: this.turn ? '1-0' : '0-1', reason: 'checkmate' };
        return { over: true, result: '1/2-1/2', reason: 'stalemate' };
      }
      if (this.insufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient material' };
      if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: '50-move rule' };
      if (this.repetitionCount() >= 3) return { over: true, result: '1/2-1/2', reason: 'threefold repetition' };
      return { over: false };
    }
    pieceAt(name) { return this.board[sqFromName(name)]; }

    // ---------- notation ----------
    uci(m) { return sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? 'nbrq'[mPromo(m) - 2] : ''); }
    moveFromUci(str, legal) {
      legal = legal || this.legalMoves();
      const from = sqFromName(str.slice(0, 2)), to = sqFromName(str.slice(2, 4));
      const pr = str[4] ? 'nbrq'.indexOf(str[4]) + 2 : 0;
      return legal.find(m => mFrom(m) === from && mTo(m) === to && mPromo(m) === pr) || 0;
    }
    san(m, legal) {
      legal = legal || this.legalMoves();
      const from = mFrom(m), to = mTo(m), flags = mFlags(m), piece = this.board[from], t = piece & 7;
      let s;
      if (flags & F_CASTLE) s = (this.chess960 ? (to & 7) > (from & 7) : (to & 7) === 6) ? 'O-O' : 'O-O-O';
      else {
        s = '';
        if (t === P) {
          if (flags & F_CAP) s += 'abcdefgh'[from & 7] + 'x';
          s += sqName(to);
          if (mPromo(m)) s += '=' + 'NBRQ'[mPromo(m) - 2];
        } else {
          s += ' PNBRQK'[t];
          const others = legal.filter(o => o !== m && mTo(o) === to && (this.board[mFrom(o)] === piece));
          if (others.length) {
            const sameFile = others.some(o => (mFrom(o) & 7) === (from & 7));
            const sameRank = others.some(o => (mFrom(o) >> 4) === (from >> 4));
            if (!sameFile) s += 'abcdefgh'[from & 7];
            else if (!sameRank) s += (from >> 4) + 1;
            else s += sqName(from);
          }
          if (flags & F_CAP) s += 'x';
          s += sqName(to);
        }
      }
      this.make(m);
      if (this.inCheck()) s += this.hasLegalMove() ? '+' : '#';
      this.unmake();
      return s;
    }
    moveFromSan(san) {
      const legal = this.legalMoves();
      const clean = x => x.replace(/[+#?!]/g, '');
      return legal.find(m => clean(this.san(m, legal)) === clean(san)) || 0;
    }
  }

  // =============== EVALUATION ===============
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
  const PST = {
    1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
  };
  const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];

  function evaluate(pos, noiseAmp, noiseSalt) {
    const b = pos.board;
    let mg = 0, phase = 0, kingMg = 0, kingEg = 0;
    const mat = [0, 0], pawnFiles = [new Int8Array(8), new Int8Array(8)];
    const bishops = [0, 0];
    let pawnCount = [0, 0];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = p & 7, c = colorOf(p), r = s >> 4, f = s & 7;
      const idx = c === 0 ? (7 - r) * 8 + f : r * 8 + f;
      const sign = c === 0 ? 1 : -1;
      phase += PHASE_W[t];
      if (t === K) { kingMg += sign * PST[6][idx]; kingEg += sign * PST[7][idx]; continue; }
      mat[c] += VAL[t];
      mg += sign * (VAL[t] + PST[t][idx]);
      if (t === P) { pawnFiles[c][f]++; pawnCount[c]++; }
      if (t === B) bishops[c]++;
    }
    if (phase > 24) phase = 24;
    let score = mg + (kingMg * phase + kingEg * (24 - phase)) / 24;
    if (bishops[0] >= 2) score += 30; if (bishops[1] >= 2) score -= 30;
    // pawn structure: doubled, isolated, passed
    const egW = (24 - phase) / 24;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if ((p & 7) !== P) continue;
      const c = colorOf(p), f = s & 7, r = s >> 4, sign = c ? -1 : 1;
      const own = pawnFiles[c];
      if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) score -= sign * 12;
      // passed?
      let passed = true;
      const dir = c ? -1 : 1;
      for (let rr = r + dir; rr >= 0 && rr <= 7 && passed; rr += dir)
        for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++)
          if (b[rr * 16 + ff] === (P | (c ? 0 : BLACK))) { passed = false; break; }
      if (passed) { const adv = c ? 7 - r : r; score += sign * PASSED[adv] * (0.5 + egW); }
    }
    for (let f = 0; f < 8; f++) {
      if (pawnFiles[0][f] > 1) score -= 10 * (pawnFiles[0][f] - 1);
      if (pawnFiles[1][f] > 1) score += 10 * (pawnFiles[1][f] - 1);
    }
    // mop-up: drive a lone king to the edge when clearly winning
    const diff = mat[0] - mat[1];
    if (Math.abs(diff) >= 300) {
      const win = diff > 0 ? 0 : 1, lose = win ^ 1;
      if (pawnCount[lose] === 0 && mat[lose] <= 330) {
        const lk = pos.kings[lose], wk = pos.kings[win];
        const lr = lk >> 4, lf = lk & 7;
        const center = Math.max(3 - lr, lr - 4) + Math.max(3 - lf, lf - 4);
        const dist = Math.abs((wk >> 4) - lr) + Math.abs((wk & 7) - lf);
        const bonus = 10 * center + 4 * (14 - dist);
        score += win === 0 ? bonus : -bonus;
      }
    }
    if (noiseAmp) {
      let x = (pos.h1 ^ noiseSalt) >>> 0;
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = (x ^ (x >>> 16)) >>> 0;
      score += (x % (2 * noiseAmp + 1)) - noiseAmp;
    }
    score = Math.round(score);
    return pos.turn === 0 ? score + 10 : -score + 10; // small tempo bonus
  }

  // =============== SEARCH ===============
  const MATE = 100000, INF = 1000000;
  const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const MVV = [0, 1, 3, 3, 5, 9, 20];

  class Searcher {
    constructor() {
      this.ttKey = new Uint32Array(TT_SIZE);
      this.ttMove = new Int32Array(TT_SIZE);
      this.ttScore = new Int32Array(TT_SIZE);
      this.ttDepth = new Int8Array(TT_SIZE);
      this.ttFlag = new Int8Array(TT_SIZE);
      this.killers = [];
      this.history = new Int32Array(128 * 128);
    }
    clear() { this.ttKey.fill(0); this.ttFlag.fill(0); this.history.fill(0); }
    // opts: {maxDepth, maxNodes, timeMs, noise, salt}
    search(pos, opts) {
      this.pos = pos; this.nodes = 0; this.stop = false;
      this.maxNodes = opts.maxNodes || Infinity;
      this.deadline = opts.timeMs ? Date.now() + opts.timeMs : Infinity;
      this.noise = opts.noise || 0; this.salt = opts.salt || 0;
      this.killers = []; for (let i = 0; i < 128; i++) this.killers.push([0, 0]);
      this.history.fill(0);
      const legal = pos.legalMoves();
      if (!legal.length) return { move: 0, score: pos.inCheck() ? -MATE : 0, depth: 0 };
      let best = legal[0], bestScore = -INF, depthDone = 0;
      const maxDepth = opts.maxDepth || 64;
      for (let d = 1; d <= maxDepth; d++) {
        this.rootBest = 0;
        const sc = this.negamax(d, -INF, INF, 0, false);
        if (this.stop) {
          if (this.rootBest && this.rootBestScore > bestScore - 50 && depthDone > 0) { /* partial result: keep previous for safety */ }
          break;
        }
        best = this.rootBest || best; bestScore = sc; depthDone = d;
        if (Math.abs(sc) > MATE - 200 && d >= (MATE - Math.abs(sc)) ) break; // found a mate
        if (legal.length === 1 && d >= 2) break;
      }
      return { move: best, score: bestScore, depth: depthDone, nodes: this.nodes };
    }
    checkStop() {
      if (this.nodes >= this.maxNodes) this.stop = true;
      else if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stop = true;
    }
    ttProbe(pos) {
      const i = pos.h1 & TT_MASK;
      return (this.ttFlag[i] && this.ttKey[i] === pos.h2) ? i : -1;
    }
    ttStore(pos, depth, score, flag, move, ply) {
      const i = pos.h1 & TT_MASK;
      if (this.ttFlag[i] && this.ttKey[i] === pos.h2 && this.ttDepth[i] > depth && flag !== 1) return;
      if (score > MATE - 500) score += ply; else if (score < -MATE + 500) score -= ply;
      this.ttKey[i] = pos.h2; this.ttMove[i] = move; this.ttScore[i] = score; this.ttDepth[i] = depth; this.ttFlag[i] = flag;
    }
    orderMoves(moves, ttMove, ply) {
      const b = this.pos.board, scores = new Int32Array(moves.length);
      const k = this.killers[ply] || [0, 0];
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        if (m === ttMove) { scores[i] = 10000000; continue; }
        const fl = mFlags(m);
        if (fl & F_CAP) {
          const victim = (fl & F_EP) ? P : (b[mTo(m)] & 7);
          scores[i] = 1000000 + MVV[victim] * 100 - MVV[b[mFrom(m)] & 7];
        } else if (mPromo(m)) scores[i] = 900000 + mPromo(m);
        else if (m === k[0]) scores[i] = 800000;
        else if (m === k[1]) scores[i] = 700000;
        else scores[i] = this.history[mFrom(m) * 128 + mTo(m)];
      }
      // insertion sort by score desc
      for (let i = 1; i < moves.length; i++) {
        const m = moves[i], s = scores[i]; let j = i - 1;
        while (j >= 0 && scores[j] < s) { moves[j + 1] = moves[j]; scores[j + 1] = scores[j]; j--; }
        moves[j + 1] = m; scores[j + 1] = s;
      }
      return moves;
    }
    hasNonPawn(side) {
      const b = this.pos.board, cb = side ? BLACK : 0;
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = b[s]; if (p && (p & BLACK) === cb) { const t = p & 7; if (t !== P && t !== K) return true; }
      }
      return false;
    }
    negamax(depth, alpha, beta, ply, wasNull) {
      const pos = this.pos;
      this.nodes++;
      if ((this.nodes & 255) === 0) this.checkStop();
      if (this.stop) return 0;
      if (ply > 0) {
        if (pos.half >= 100 || pos.insufficientMaterial()) return 0;
        // repetition: any repeat counts as draw inside the tree
        const n = pos.hist1.length - 1;
        for (let i = n - 2; i >= 0 && i >= n - pos.half; i -= 2)
          if (pos.hist1[i] === pos.h1 && pos.hist2[i] === pos.h2) return 0;
        // mate distance pruning
        alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply - 1);
        if (alpha >= beta) return alpha;
      }
      const inCheck = pos.inCheck();
      if (inCheck) depth++;
      if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);
      if (ply >= 100) return evaluate(pos, this.noise, this.salt);

      let ttMove = 0;
      const ti = this.ttProbe(pos);
      if (ti >= 0) {
        ttMove = this.ttMove[ti];
        if (ply > 0 && this.ttDepth[ti] >= depth) {
          let s = this.ttScore[ti];
          if (s > MATE - 500) s -= ply; else if (s < -MATE + 500) s += ply;
          const f = this.ttFlag[ti];
          if (f === 1) return s;
          if (f === 2 && s >= beta) return s;
          if (f === 3 && s <= alpha) return s;
        }
      }
      const pvNode = beta - alpha > 1;
      // null move pruning
      if (!pvNode && !inCheck && !wasNull && depth >= 3 && ply > 0 && this.hasNonPawn(pos.turn)) {
        const se = evaluate(pos, this.noise, this.salt);
        if (se >= beta) {
          pos.makeNull();
          const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, true);
          pos.unmakeNull();
          if (this.stop) return 0;
          if (s >= beta && s < MATE - 500) return beta;
        }
      }
      const moves = this.orderMoves(pos.genMoves(), ttMove, ply);
      let bestScore = -INF, bestMove = 0, legal = 0;
      const origAlpha = alpha;
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        if (!pos.tryMake(m)) continue;
        legal++;
        const quiet = !(mFlags(m) & F_CAP) && !mPromo(m);
        let score;
        if (legal === 1) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, false);
        else {
          let red = 0;
          if (depth >= 3 && legal > 4 && quiet && !inCheck && !pos.inCheck()) red = legal > 10 ? 2 : 1;
          score = -this.negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1, false);
          if (score > alpha && red) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, false);
          if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, false);
        }
        pos.unmake();
        if (this.stop) return 0;
        if (score > bestScore) {
          bestScore = score; bestMove = m;
          if (ply === 0) { this.rootBest = m; this.rootBestScore = score; }
          if (score > alpha) {
            alpha = score;
            if (alpha >= beta) {
              if (quiet) {
                const k = this.killers[ply];
                if (k && k[0] !== m) { k[1] = k[0]; k[0] = m; }
                this.history[mFrom(m) * 128 + mTo(m)] += depth * depth;
              }
              break;
            }
          }
        }
      }
      if (!legal) return inCheck ? -MATE + ply : 0;
      const flag = bestScore >= beta ? 2 : bestScore > origAlpha ? 1 : 3;
      this.ttStore(pos, depth, bestScore, flag, bestMove, ply);
      return bestScore;
    }
    quiesce(alpha, beta, ply, qd) {
      const pos = this.pos;
      this.nodes++;
      if ((this.nodes & 255) === 0) this.checkStop();
      if (this.stop) return 0;
      const stand = evaluate(pos, this.noise, this.salt);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (qd > 8) return stand;
      const moves = this.orderMoves(pos.genMoves(true), 0, 127);
      const b = pos.board;
      let best = stand;
      for (const m of moves) {
        const fl = mFlags(m);
        const victim = (fl & F_EP) ? P : (b[mTo(m)] & 7);
        if (!mPromo(m) && stand + VAL[victim] + 200 < alpha) continue; // delta pruning
        if (!pos.tryMake(m)) continue;
        const s = -this.quiesce(-beta, -alpha, ply + 1, qd + 1);
        pos.unmake();
        if (this.stop) return 0;
        if (s > best) { best = s; if (s > alpha) { alpha = s; if (s >= beta) break; } }
      }
      return best;
    }
  }

  // =============== MATE SOLVER (for puzzles) ===============
  // returns true if side to move can force mate within n moves
  function canMateIn(pos, n) {
    if (n <= 0) return false;
    const moves = orderForMate(pos, pos.genMoves());
    for (const m of moves) {
      if (!pos.tryMake(m)) continue;
      const ok = defenderLoses(pos, n - 1);
      pos.unmake();
      if (ok) return true;
    }
    return false;
  }
  function defenderLoses(pos, n) {
    // side to move is defender; true if every reply leads to mate within n more attacker moves
    let any = false;
    const moves = pos.genMoves();
    for (const m of moves) {
      if (!pos.tryMake(m)) continue;
      any = true;
      const ok = n > 0 && canMateIn(pos, n);
      pos.unmake();
      if (!ok) return false;
    }
    if (!any) return pos.inCheck(); // checkmate yes, stalemate no
    return true;
  }
  function orderForMate(pos, moves) {
    // checks first, then captures
    const sc = moves.map(m => {
      let s = 0;
      if (mFlags(m) & F_CAP) s += 1;
      if (mPromo(m) === Q) s += 1;
      if (pos.tryMake(m)) { if (pos.inCheck()) s += 10; pos.unmake(); } else s = -100;
      return s;
    });
    return moves.map((m, i) => [m, sc[i]]).filter(x => x[1] > -100).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  // all attacker moves that force mate within n
  function matingMoves(pos, n) {
    const out = [];
    for (const m of pos.legalMoves()) {
      pos.make(m);
      if (defenderLoses(pos, n - 1)) out.push(m);
      pos.unmake();
    }
    return out;
  }
  // shortest mate length (in moves) for side to move up to maxN, or 0
  function mateLength(pos, maxN) { for (let n = 1; n <= maxN; n++) if (canMateIn(pos, n)) return n; return 0; }

  function chess960Fen(n) {
    if (n == null) n = Math.floor(Math.random() * 960);
    const row = new Array(8).fill(null), free = () => row.map((x, i) => x ? -1 : i).filter(i => i >= 0);
    let q = n;
    row[(q % 4) * 2 + 1] = 'B'; q = Math.floor(q / 4);
    row[(q % 4) * 2] = 'B'; q = Math.floor(q / 4);
    let f = free(); row[f[q % 6]] = 'Q'; q = Math.floor(q / 6);
    const KN = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]][q];
    f = free(); row[f[KN[0]]] = 'N'; row[f[KN[1]]] = 'N';
    f = free(); row[f[0]] = 'R'; row[f[1]] = 'K'; row[f[2]] = 'R';
    const back = row.join(''), L = 'ABCDEFGH';
    const rooks = [back.lastIndexOf('R'), back.indexOf('R')];
    const cast = L[rooks[0]] + L[rooks[1]] + L[rooks[0]].toLowerCase() + L[rooks[1]].toLowerCase();
    return { n, fen: `${back.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${back} w ${cast} - 0 1` };
  }

  const api = { chess960Fen, Position, Searcher, evaluate, canMateIn, matingMoves, mateLength, defenderLoses, sqName, sqFromName,
    mFrom, mTo, mPromo, mFlags, F_CAP, F_EP, F_CASTLE, F_DOUBLE, P, N, B, R, Q, K, BLACK, MATE, PIECE_CHARS };
  return api;
}
export default ChessEngineFactory;
