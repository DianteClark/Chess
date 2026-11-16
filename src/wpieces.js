// Piece art for the World Games wing. Every piece comes in two styles:
//  'trad'  traditional: carved discs with Chinese characters (xiangqi), octagons (janggi),
//          wedge tiles with kanji (shogi), and classic silhouettes for makruk / sittuyin / shatranj.
//  'eng'   English: the same token with a picture of what the piece is, plus (for shogi)
//          little marks around the edge that show where it can move.
// A piece is described by its game, its FEN letter (uppercase), its side and whether it is promoted.
'use strict';
// what each FEN letter means in each game
const WP_KIND = {
  xiangqi: { K: 'general', A: 'advisor', B: 'elephant', R: 'chariot', N: 'horse', C: 'cannon', P: 'soldier' },
  janggi: { K: 'general', A: 'advisor', B: 'elephant', R: 'chariot', N: 'horse', C: 'cannon', P: 'soldier' },
  shogi: { K: 'king', R: 'rook', B: 'bishop', G: 'gold', S: 'silver', N: 'knight', L: 'lance', P: 'pawn' },
  makruk: { K: 'khun', M: 'met', S: 'khon', N: 'ma', R: 'rua', P: 'bia' },
  sittuyin: { K: 'khun', F: 'met', S: 'khon', N: 'ma', R: 'rua', P: 'bia' },
  shatranj: { K: 'khun', Q: 'ferz', B: 'alfil', N: 'ma', R: 'rua', P: 'bia' },
};
// English names shown in tooltips, the piece guide and lessons (translatable through the catalog)
const WP_NAME = {
  general: 'General', advisor: 'Advisor', elephant: 'Elephant', chariot: 'Chariot', horse: 'Horse', cannon: 'Cannon', soldier: 'Soldier',
  king: 'King', rook: 'Rook', bishop: 'Bishop', gold: 'Gold General', silver: 'Silver General', knight: 'Knight', lance: 'Lance', pawn: 'Pawn',
  '+rook': 'Dragon King', '+bishop': 'Dragon Horse', '+silver': 'Promoted Silver', '+knight': 'Promoted Knight', '+lance': 'Promoted Lance', '+pawn': 'Tokin',
  khun: 'King', met: 'Queen (Met)', khon: 'Bishop (Khon)', ma: 'Horse', rua: 'Boat', bia: 'Pawn', '+bia': 'Promoted Pawn', ferz: 'Counselor (Ferz)', alfil: 'Elephant (Alfil)',
};
const WP_CHAR = {
  xiangqi: { w: { general: '帥', advisor: '仕', elephant: '相', chariot: '俥', horse: '傌', cannon: '炮', soldier: '兵' }, b: { general: '將', advisor: '士', elephant: '象', chariot: '車', horse: '馬', cannon: '砲', soldier: '卒' } },
  janggi: { w: { general: '楚', advisor: '士', elephant: '象', chariot: '車', horse: '馬', cannon: '包', soldier: '卒' }, b: { general: '漢', advisor: '士', elephant: '象', chariot: '車', horse: '馬', cannon: '包', soldier: '兵' } },
  shogi: { king: '玉', rook: '飛', bishop: '角', gold: '金', silver: '銀', knight: '桂', lance: '香', pawn: '歩', '+rook': '龍', '+bishop': '馬', '+silver': '全', '+knight': '圭', '+lance': '杏', '+pawn': 'と' },
};
// Shogi move marks, from the owner's point of view: [dx, dy, slide]; dy=+1 is forward
const SHOGI_MOVES = {
  king: [[-1, 1], [0, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]],
  gold: [[-1, 1], [0, 1], [1, 1], [-1, 0], [1, 0], [0, -1]],
  silver: [[-1, 1], [0, 1], [1, 1], [-1, -1], [1, -1]],
  knight: [[-1, 2], [1, 2]], lance: [[0, 1, 1]], pawn: [[0, 1]],
  rook: [[0, 1, 1], [0, -1, 1], [1, 0, 1], [-1, 0, 1]], bishop: [[1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1]],
  '+rook': [[0, 1, 1], [0, -1, 1], [1, 0, 1], [-1, 0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]],
  '+bishop': [[1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]],
};
['+silver', '+knight', '+lance', '+pawn'].forEach(k => SHOGI_MOVES[k] = SHOGI_MOVES.gold);

// ---- pictures (drawn in a 100x100 box, centered on 50,50; 'c' is the ink color) ----
const WP_PIC = {
  chariot: c => `<g fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 54h46l6-16H30z" fill="${c}" fill-opacity=".18"/><path d="M70 40l10-12"/><circle cx="36" cy="64" r="11"/><circle cx="64" cy="64" r="11"/><path d="M36 53v22M25 64h22M64 53v22M53 64h22"/></g>`,
  horse: c => `<path d="M33 78c0-12 4-20 12-25-6-1-12 2-16 5l-6-7c4-8 13-17 25-21l2-7 6 6c11 4 18 14 18 28v21z" fill="${c}"/><circle cx="46" cy="38" r="3" fill="#fff"/>`,
  elephant: c => `<g fill="${c}"><path d="M30 46c0-14 10-22 22-22s22 9 22 22c0 9-4 15-10 18v14h-9V66h-6v12h-9V64c-2-1-4-3-5-5-1 6-5 10-11 10-4 0-6-3-5-6 4 1 7-1 8-5z"/></g><path d="M40 34c-6 0-10 5-10 12s5 10 10 10" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/><circle cx="56" cy="40" r="3" fill="#fff"/>`,
  advisor: c => `<g fill="${c}"><rect x="38" y="16" width="24" height="14" rx="3"/><rect x="31" y="28" width="38" height="5" rx="2"/><circle cx="50" cy="42" r="9"/><path d="M30 82c2-18 9-28 20-28s18 10 20 28z"/></g><path d="M44 62l6 8 6-8" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>`,
  general: c => `<g fill="${c}"><path d="M30 46c0-14 9-23 20-23s20 9 20 23z"/><rect x="47" y="12" width="6" height="13" rx="2"/><path d="M42 12h16l-3 6h-10z"/><rect x="27" y="45" width="46" height="6" rx="3"/><circle cx="50" cy="60" r="8"/><path d="M28 86c1-12 9-18 22-18s21 6 22 18z"/></g>`,
  cannon: c => `<g fill="${c}"><rect x="22" y="40" width="50" height="14" rx="7" transform="rotate(-18 47 47)"/><circle cx="78" cy="34" r="5" fill="none" stroke="${c}" stroke-width="3"/></g><g fill="none" stroke="${c}" stroke-width="5"><circle cx="40" cy="64" r="12"/><path d="M40 52v24M28 64h24"/></g><path d="M18 78h64" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  soldier: c => `<g fill="${c}"><path d="M38 34c0-8 5-13 12-13s12 5 12 13z"/><circle cx="50" cy="40" r="8"/><path d="M34 84c1-16 7-26 16-26s15 10 16 26z"/></g><path d="M72 14v72" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M72 8l6 12h-12z" fill="${c}"/>`,
  king: c => `<g fill="${c}"><path d="M24 70l-4-34 15 13 15-21 15 21 15-13-4 34z"/><rect x="24" y="72" width="52" height="9" rx="3"/></g><circle cx="50" cy="56" r="5" fill="#fff" opacity=".7"/>`,
  rook: c => WP_PIC.chariot(c) + `<path d="M12 36h12M10 46h12M14 56h10" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
  bishop: c => `<g stroke="${c}" stroke-width="7" stroke-linecap="round"><path d="M28 28l44 44M72 28L28 72"/></g><g fill="${c}"><path d="M22 22l16 2-14 14zM78 22l-2 16-14-14zM22 78l2-16 14 14zM78 78l-16-2 14-14z"/></g>`,
  gold: c => `<path d="M24 64l10-26h32l10 26z" fill="#e6b434" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M36 44h28" stroke="#fff6c8" stroke-width="4" stroke-linecap="round"/><path d="M20 72h60" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  silver: c => `<path d="M24 64l10-26h32l10 26z" fill="#c9d0d6" stroke="${c}" stroke-width="4" stroke-linejoin="round"/><path d="M36 44h28" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M20 72h60" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  knight: c => WP_PIC.horse(c),
  lance: c => `<path d="M50 84V30" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M50 10l10 22H40z" fill="${c}"/><path d="M40 66h20" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  pawn: c => WP_PIC.soldier(c),
  khun: c => WP_PIC.king(c), met: c => `<g fill="${c}"><circle cx="50" cy="30" r="9"/><path d="M34 80c2-22 8-38 16-38s14 16 16 38z"/></g><path d="M38 60h24" stroke="#fff" stroke-width="3" opacity=".6"/>`,
  khon: c => `<g fill="${c}"><path d="M50 18c9 8 14 18 14 28 0 10-6 16-14 16s-14-6-14-16c0-10 5-20 14-28z"/><path d="M34 82c2-12 8-18 16-18s14 6 16 18z"/></g>`,
  ma: c => WP_PIC.horse(c), rua: c => `<path d="M16 58h68l-10 18H26z" fill="${c}"/><path d="M50 58V18" stroke="${c}" stroke-width="5"/><path d="M50 22l22 28H50z" fill="${c}" opacity=".75"/>`,
  bia: c => `<g fill="${c}"><circle cx="50" cy="36" r="11"/><path d="M34 82c1-14 7-26 16-26s15 12 16 26z"/></g>`,
  ferz: c => WP_PIC.advisor(c), alfil: c => WP_PIC.elephant(c),
};
function wpKind(variant, letter, promoted) {
  const map = WP_KIND[variant] || {}; const k = map[letter.toUpperCase()];
  if (!k) return null;
  return promoted ? '+' + k : k;
}
function wpName(variant, letter, promoted) { const k = wpKind(variant, letter, promoted); return (k && WP_NAME[k]) || letter; }
// The piece token as an SVG string. side 'w' moves first (red in xiangqi, Cho in janggi, Sente in shogi).
function wpSvg(variant, letter, side, promoted, style, flippedView) {
  const kind = wpKind(variant, letter, promoted); const base = kind && kind.replace('+', '');
  const eng = style === 'eng';
  if (variant === 'xiangqi' || variant === 'janggi') {
    const red = variant === 'xiangqi' ? side === 'w' : side === 'b';
    const ink = red ? '#b4231c' : variant === 'janggi' ? '#155a8a' : '#1f1a16';
    const shape = variant === 'xiangqi' ? `<circle cx="50" cy="50" r="46" fill="#7d5226"/><circle cx="50" cy="48" r="45" fill="#f0d6a2"/><circle cx="50" cy="48" r="37" fill="none" stroke="${ink}" stroke-width="2.5"/>`
      : (() => { const s = { general: 1, chariot: .9, cannon: .9, horse: .9, elephant: .9, advisor: .78, soldier: .78 }[base] || .9; const r = 46 * s, a = r * .414; const pts = [[-a, -r], [a, -r], [r, -a], [r, a], [a, r], [-a, r], [-r, a], [-r, -a]].map(([x, y]) => `${50 + x},${48 + y}`).join(' '); return `<polygon points="${pts}" transform="translate(0 2)" fill="#7d5226"/><polygon points="${pts}" fill="#f4e2bd" stroke="${ink}" stroke-width="2"/>`; })();
    const scale = variant === 'janggi' ? ({ general: 1, advisor: .8, soldier: .8 }[base] || .92) : 1;
    const inner = eng ? `<g transform="translate(50 48) scale(${.72 * scale}) translate(-50 -50)">${WP_PIC[base] ? WP_PIC[base](ink) : ''}</g>`
      : `<text x="50" y="49" text-anchor="middle" dominant-baseline="central" font-size="${46 * scale}" font-weight="700" fill="${ink}" font-family="'Noto Serif CJK SC','Noto Serif CJK TC','Songti SC','SimSun','Noto Sans CJK SC',serif">${(WP_CHAR[variant][side] || {})[base] || letter}</text>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${shape}${inner}</svg>`;
  }
  if (variant === 'shogi') {
    // wedge tile; Gote's tiles point down the board
    const rot = (side === 'b') !== !!flippedView ? 180 : 0;
    const size = { king: 1, rook: .97, bishop: .97, gold: .93, silver: .93, knight: .9, lance: .88, pawn: .84 }[base] || .9;
    const ink = promoted ? '#c0261f' : '#1f1a16';
    let inner;
    if (eng) {
      const marks = (SHOGI_MOVES[kind] || []).map(([dx, dy, slide]) => {
        const x = 50 + dx * 34, y = 57 - dy * 34;
        if (Math.abs(dy) === 2) return `<circle cx="${50 + dx * 18}" cy="12" r="4.5" fill="${ink}"/>`;
        return slide ? `<path d="M${50 + dx * 24} ${57 - dy * 24}L${x} ${y}" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>` : `<circle cx="${50 + dx * 31}" cy="${57 - dy * 31}" r="5" fill="${ink}"/>`;
      }).join('');
      inner = `<g transform="translate(50 57) scale(.6) translate(-50 -50)">${WP_PIC[base](ink)}</g>${marks}`;
    } else {
      const ch = kind === 'king' && side === 'b' ? '王' : WP_CHAR.shogi[kind] || letter;
      inner = `<text x="50" y="58" text-anchor="middle" dominant-baseline="central" font-size="44" font-weight="700" fill="${ink}" font-family="'Noto Serif CJK JP','Noto Serif CJK SC','Hiragino Mincho ProN','Yu Mincho',serif">${ch}</text>`;
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${rot} 50 50) translate(50 52) scale(${size}) translate(-50 -52)"><path d="M50 4l30 12 10 80H10l10-80z" fill="#9a6b33" transform="translate(0 2)"/><path d="M50 4l30 12 10 80H10l10-80z" fill="#f2d9a0" stroke="#8a5a28" stroke-width="2"/>${inner}</g></svg>`;
  }
  // makruk, sittuyin, shatranj, traditional style: the carved Western-style pieces these games are
  // usually played with today (Met and Ferz look like small queens, Khon and Alfil like bishops)
  if (!eng && typeof PIECE_URL !== 'undefined') {
    const chessLetter = { khun: 'k', met: 'q', ferz: 'q', khon: 'b', alfil: 'b', ma: 'n', rua: 'r', bia: 'p' }[base] || 'p';
    const sc = { met: .8, ferz: .8 }[base] || 1;
    const ring = promoted ? `<circle cx="50" cy="54" r="44" fill="none" stroke="#d9a63a" stroke-width="5" opacity=".9"/>` : '';
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${ring}<image href="${PIECE_URL[side + chessLetter]}" x="${50 - 50 * sc}" y="${100 - 100 * sc}" width="${100 * sc}" height="${100 * sc}"/></svg>`;
  }
  // English style: round tokens; white side light, black side dark
  const light = side === 'w', fill = light ? '#f7efdd' : '#2c2622', ink = light ? '#2c2622' : '#f7efdd';
  const ring = promoted ? `<circle cx="50" cy="50" r="40" fill="none" stroke="#d9a63a" stroke-width="4"/>` : '';
  const pic = WP_PIC[base] ? WP_PIC[base](ink) : '';
  const label = eng ? '' : '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="52" r="46" fill="rgba(0,0,0,.35)"/><circle cx="50" cy="49" r="46" fill="${fill}" stroke="${light ? '#a88a5c' : '#0d0b0a'}" stroke-width="2"/>${ring}<g transform="translate(50 49) scale(.66) translate(-50 -50)">${pic}</g>${label}</svg>`;
}
