// Illustrated rooms of the clubhouse (home screen). Original SVG scenes, drawn in code.
'use strict';
const KNIGHT_PATH = 'M13 36.5h19C33 31 34 24 31 18c-1-2.5-2-4-3-5V7.5l-3.5 3.5C21 10.5 17 12 14 15c-2 2.5-3.5 5-4.5 8-.2 1.7 1.1 3.2 2.8 3 1.7-.2 3.7-1.2 6.2-2.5 1 2.5-2.5 5.5-4 8-1.1 2-1.5 3-1.5 5z';
const KING_PATH = 'M22.5 5.5v7M19 9h7M12.5 31c-3-3-4-7-1.5-10 3-3.5 8-2 11.5 2.5 3.5-4.5 8.5-6 11.5-2.5 2.5 3 1.5 7-1.5 10zM13 36c0-2 0-3.5-.5-5h20c-.5 1.5-.5 3-.5 5zM11.5 39.5h22V36h-22z';
const PAWN_PATH = 'M22.5 9.5a5 5 0 0 0-3.2 8.85A6.8 6.8 0 0 0 15.8 24.5c0 2.3 1.1 4.3 2.8 5.6C15 31.6 12 35 12 39.5h21c0-4.5-3-7.9-6.6-9.4 1.7-1.3 2.8-3.3 2.8-5.6a6.8 6.8 0 0 0-3.5-6.15A5 5 0 0 0 22.5 9.5z';
// perspective checker floor between y0..y1, x-range narrowing toward the top
function floorSvg(W, y0, y1, rows, cols, c1, c2, topInset) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    const ya = y0 + (y1 - y0) * Math.pow(r / rows, 1.35), yb = y0 + (y1 - y0) * Math.pow((r + 1) / rows, 1.35);
    const ia = topInset * (1 - r / rows), ib = topInset * (1 - (r + 1) / rows);
    for (let c = 0; c < cols; c++) {
      const xa1 = ia + (W - 2 * ia) * c / cols, xa2 = ia + (W - 2 * ia) * (c + 1) / cols;
      const xb1 = ib + (W - 2 * ib) * c / cols, xb2 = ib + (W - 2 * ib) * (c + 1) / cols;
      out += `<path d="M${xa1.toFixed(1)} ${ya.toFixed(1)}L${xa2.toFixed(1)} ${ya.toFixed(1)}L${xb2.toFixed(1)} ${yb.toFixed(1)}L${xb1.toFixed(1)} ${yb.toFixed(1)}Z" fill="${(r + c) % 2 ? c1 : c2}"/>`;
    }
  }
  return out;
}
const ROOM_ART = {
  arena: () => `<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="ab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a2232"/><stop offset="1" stop-color="#2a0d16"/></linearGradient>
    <linearGradient id="as" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2" stop-opacity=".55"/><stop offset="1" stop-color="#fff1c2" stop-opacity="0"/></linearGradient></defs>
    <rect width="400" height="180" fill="url(#ab)"/>
    ${floorSvg(400, 112, 180, 4, 10, '#e8d2a8', '#8a5a36', 70)}
    <path d="M168 0h64l84 180H84z" fill="url(#as)"/>
    <ellipse cx="200" cy="146" rx="46" ry="9" fill="#000" opacity=".25"/>
    <g transform="translate(176 92) scale(1.1)" fill="#fff8ea" stroke="#3b2a1a" stroke-width="1.6" stroke-linejoin="round"><path d="${KING_PATH}"/></g>
    <path d="M0 0h74c-9 44 7 96-7 180H0z" fill="#a33447"/><path d="M400 0h-74c9 44-7 96 7 180h67z" fill="#a33447"/>
    <path d="M22 0c-5 62 5 120-3 180M48 0c-6 62 6 120-4 180M378 0c5 62-5 120 3 180M352 0c6 62-6 120 4 180" stroke="#7d2233" stroke-width="6" fill="none"/>
    <path d="M0 0h400v16c-18 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-22 10-40 0z" fill="#c4485a"/>
    <path d="M0 16c18 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 22 10 40 0" stroke="#efbb4f" stroke-width="2.5" fill="none"/>
  </svg>`,
  den: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="db" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f7a"/><stop offset="1" stop-color="#1c2048"/></linearGradient>
    <radialGradient id="dl" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#db)"/>
    <circle cx="30" cy="22" r="1.4" fill="#fff" opacity=".7"/><circle cx="62" cy="12" r="1" fill="#fff" opacity=".6"/><circle cx="170" cy="18" r="1.3" fill="#fff" opacity=".7"/>
    <path d="M118 0v26" stroke="#2a2a3a" stroke-width="2"/><path d="M104 26h28l10 18H94z" fill="#efbb4f"/><path d="M60 44h116l24 110H36z" fill="url(#dl)"/>
    <path d="M28 104h144v8H28z" fill="#6a3d22"/><path d="M34 112h8v38h-8zM158 112h8v38h-8z" fill="#4a2a16"/>
    <g transform="translate(66 72)">${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => `<rect x="${c * 16}" y="${r * 8}" width="16" height="8" fill="${(r + c) % 2 ? '#a9744a' : '#ecd9b4'}" transform="skewX(-18)"/>`).join('')).join('')}</g>
    <g transform="translate(86 52) scale(.62)" fill="#2b2730" stroke="#f4ecdc" stroke-width="2" stroke-linejoin="round"><path d="${KNIGHT_PATH}"/><path d="M11 39.5h23v-3H11z"/></g>
    <g fill="#ffd54a" stroke="#a87418" stroke-width="1.5"><path d="M150 54h12v-4a3.5 3.5 0 1 1 7 0v4h12v12h-4a3.5 3.5 0 1 0 0 7h4v12h-31z" transform="rotate(14 165 70)"/></g>
    <text x="40" y="70" font-family="Lilita One,Arial" font-size="30" fill="#ffe39a" opacity=".9" transform="rotate(-12 40 70)">?</text>
  </svg>`,
  library: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="150" fill="#3b2a52"/>
    ${[18, 66, 114].map((y, k) => {
      let x = 10, s = ''; const cols = ['#c4485a', '#efbb4f', '#4f9d7a', '#6fa8dc', '#e98a3c', '#9c6bd1', '#f2e3c4', '#c4485a', '#4f9d7a', '#efbb4f'];
      for (let i = 0; i < 14 && x < 190; i++) { const w = 7 + ((i * 7 + k * 3) % 6), hh = 30 + ((i * 11 + k * 5) % 12); s += `<rect x="${x}" y="${y + 40 - hh}" width="${w}" height="${hh}" rx="1.5" fill="${cols[(i + k * 3) % cols.length]}"/><rect x="${x + 1.5}" y="${y + 44 - hh}" width="${w - 3}" height="2" fill="rgba(0,0,0,.18)"/>`; x += w + 2; if (i === 5 + k) x += 10; }
      return s + `<rect x="4" y="${y + 40}" width="192" height="6" fill="#7a4a2b"/><rect x="4" y="${y + 46}" width="192" height="2" fill="#4a2a16"/>`;
    }).join('')}
  </svg>`,
  world: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16346c"/><stop offset="1" stop-color="#0c1838"/></linearGradient>
    <radialGradient id="wg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fd0c0"/><stop offset="1" stop-color="#2f7d8a"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#wb)"/>
    ${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 47) % 200}" cy="${(i * 29) % 70}" r="${i % 3 ? .9 : 1.5}" fill="#fff" opacity="${i % 2 ? .5 : .85}"/>`).join('')}
    <path d="M-10 26 Q100 70 210 26" stroke="#2b2730" stroke-width="1.2" fill="none"/>
    ${Array.from({ length: 9 }, (_, i) => { const t = (i + .5) / 9, x = -10 + 220 * t, y = 26 + 4 * 44 * t * (1 - t) * .5 * 2; return `<circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="3.4" fill="${['#ffd54a', '#ff8a78', '#93dc98', '#9ccfff'][i % 4]}"/>`; }).join('')}
    <circle cx="100" cy="98" r="40" fill="url(#wg)"/>
    <path d="M78 74c10 4 8 14 18 14s6 12 16 10M92 120c6-8 18-6 22-14M120 72c-4 6 2 10-4 16" stroke="#ecd9b4" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>
    <circle cx="100" cy="98" r="40" fill="none" stroke="#f7efdd" stroke-width="2"/>
    <ellipse cx="100" cy="98" rx="16" ry="40" fill="none" stroke="#f7efdd" stroke-width="1.2" opacity=".6"/><path d="M60 98h80" stroke="#f7efdd" stroke-width="1.2" opacity=".6"/>
    <path d="M100 138v8M80 150h40" stroke="#b57a48" stroke-width="5"/>
  </svg>`,
  courtyard: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0e6"/><stop offset="1" stop-color="#d9f0e4"/></linearGradient></defs>
    <rect width="200" height="150" fill="url(#cs)"/>
    <circle cx="160" cy="26" r="13" fill="#ffe39a"/>
    <path d="M0 74c40-12 80-12 120-4s60 4 80-2v82H0z" fill="#6fbf72"/>
    ${floorSvg(200, 80, 150, 4, 6, '#f7efdd', '#3f6b4a', 50)}
    <path d="M14 82c-8-22 4-40 16-40s22 14 16 34c-4 10-24 14-32 6z" fill="#3f8a4f"/><path d="M28 80v24" stroke="#6a3d22" stroke-width="5"/>
    <g transform="translate(70 70) scale(.9)" fill="#fff8ea" stroke="#3b2a1a" stroke-width="1.8" stroke-linejoin="round"><path d="${PAWN_PATH}"/></g>
    <g transform="translate(104 64) scale(1.05)" fill="#2b2730" stroke="#f4ecdc" stroke-width="1.8" stroke-linejoin="round"><path d="${KNIGHT_PATH}"/><path d="M11 39.5h23v-3H11z"/></g>
  </svg>`,
  trophy: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4320"/><stop offset="1" stop-color="#3a220f"/></linearGradient>
    <radialGradient id="tg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff1c2"/><stop offset=".55" stop-color="#efbb4f"/><stop offset="1" stop-color="#b8801f"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#tb)"/>
    <rect x="0" y="92" width="200" height="8" fill="#8a5532"/><rect x="0" y="100" width="200" height="3" fill="#2e180b"/>
    <g fill="url(#tg)" stroke="#7a4f12" stroke-width="1.5"><path d="M80 36h40v20a20 20 0 0 1-40 0z"/><path d="M80 42H68a10 10 0 0 0 14 14M120 42h12a10 10 0 0 1-14 14" fill="none"/><path d="M96 76h8v8h-8z"/><path d="M86 84h28v8H86z"/></g>
    <g transform="translate(26 52)"><path d="M6 0l6 14M22 0l-6 14" stroke="#c4485a" stroke-width="5"/><circle cx="14" cy="26" r="13" fill="url(#tg)" stroke="#7a4f12" stroke-width="1.5"/><text x="14" y="31" text-anchor="middle" font-family="Lilita One,Arial" font-size="13" fill="#5a3a08">1</text></g>
    <g transform="translate(146 56)"><path d="M6 0l6 12M20 0l-6 12" stroke="#4f86c6" stroke-width="5"/><circle cx="13" cy="24" r="12" fill="#d5dde8" stroke="#7d8798" stroke-width="1.5"/></g>
    <path d="M30 112h140v6H30z" fill="#8a5532"/>
    <g fill="#efbb4f" opacity=".9"><path d="M40 20l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"/><path d="M168 30l1.5 3.5 3.5.5-2.7 2.3.8 3.7-3.1-2-3.1 2 .8-3.7L163 34l3.5-.5z"/></g>
  </svg>`,
};
function roomArt(key) { const d = document.createElement('div'); d.className = 'art'; d.innerHTML = ROOM_ART[key](); return d; }
