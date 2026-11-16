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
    <path class="kc-spot" d="M168 0h64l84 180H84z" fill="url(#as)" style="transform-origin:200px 0px"/>
    ${[[150,60],[236,48],[190,84],[260,96],[140,104]].map(([x,y],i)=>`<circle class="kc-tw" cx="${x}" cy="${y}" r="1.6" fill="#fff8d8" style="animation-delay:${i*-.7}s"/>`).join('')}
    <ellipse cx="200" cy="146" rx="46" ry="9" fill="#000" opacity=".25"/>
    <g transform="translate(176 92) scale(1.1)" fill="#fff8ea" stroke="#3b2a1a" stroke-width="1.6" stroke-linejoin="round"><path d="${KING_PATH}"/></g>
    <path d="M0 0h74c-9 44 7 96-7 180H0z" fill="#a33447"/><path d="M400 0h-74c9 44-7 96 7 180h67z" fill="#a33447"/>
    <path d="M22 0c-5 62 5 120-3 180M48 0c-6 62 6 120-4 180M378 0c5 62-5 120 3 180M352 0c6 62-6 120 4 180" stroke="#7d2233" stroke-width="6" fill="none"/>
    <path d="M0 0h400v16c-18 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-32 10-40 0-8 10-22 10-40 0z" fill="#c4485a"/>
    ${Array.from({length:10},(_,i)=>`<circle class="kc-tw" cx="${20+i*40}" cy="22" r="2.6" fill="#ffe39a" style="animation-delay:${(i%4)*-.6}s"/>`).join('')}
    <path d="M0 16c18 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 32 10 40 0 8 10 22 10 40 0" stroke="#efbb4f" stroke-width="2.5" fill="none"/>
  </svg>`,
  den: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="db" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f7a"/><stop offset="1" stop-color="#1c2048"/></linearGradient>
    <radialGradient id="dl" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#db)"/>
    ${[[30,22,1.4],[62,12,1],[170,18,1.3],[16,48,1],[184,52,1.2],[80,30,.9]].map(([x,y,r],i)=>`<circle class="kc-tw" cx="${x}" cy="${y}" r="${r}" fill="#fff" style="animation-delay:${i*-.55}s"/>`).join('')}
    <path d="M118 0v26" stroke="#2a2a3a" stroke-width="2"/><path d="M104 26h28l10 18H94z" fill="#efbb4f"/><path class="kc-fl" d="M60 44h116l24 110H36z" fill="url(#dl)"/><ellipse class="kc-fl" cx="118" cy="40" rx="22" ry="8" fill="#fff1c2" fill-opacity=".55"/>
    <path d="M28 104h144v8H28z" fill="#6a3d22"/><path d="M34 112h8v38h-8zM158 112h8v38h-8z" fill="#4a2a16"/>
    <g transform="translate(66 72)">${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => `<rect x="${c * 16}" y="${r * 8}" width="16" height="8" fill="${(r + c) % 2 ? '#a9744a' : '#ecd9b4'}" transform="skewX(-18)"/>`).join('')).join('')}</g>
    <g transform="translate(86 52) scale(.62)" fill="#2b2730" stroke="#f4ecdc" stroke-width="2" stroke-linejoin="round"><path d="${KNIGHT_PATH}"/><path d="M11 39.5h23v-3H11z"/></g>
    <g class="kc-bob" fill="#ffd54a" stroke="#a87418" stroke-width="1.5"><path d="M150 54h12v-4a3.5 3.5 0 1 1 7 0v4h12v12h-4a3.5 3.5 0 1 0 0 7h4v12h-31z" transform="rotate(14 165 70)"/></g>
    <text class="kc-bob2" x="40" y="70" font-family="Lilita One,Arial" font-size="30" fill="#ffe39a" opacity=".9" transform="rotate(-12 40 70)">?</text>
  </svg>`,
  library: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="150" fill="#3b2a52"/>
    ${[18, 66, 114].map((y, k) => {
      let x = 10, s = ''; const cols = ['#c4485a', '#efbb4f', '#4f9d7a', '#6fa8dc', '#e98a3c', '#9c6bd1', '#f2e3c4', '#c4485a', '#4f9d7a', '#efbb4f'];
      for (let i = 0; i < 14 && x < 190; i++) { const w = 7 + ((i * 7 + k * 3) % 6), hh = 30 + ((i * 11 + k * 5) % 12); s += `<rect x="${x}" y="${y + 40 - hh}" width="${w}" height="${hh}" rx="1.5" fill="${cols[(i + k * 3) % cols.length]}"/><rect x="${x + 1.5}" y="${y + 44 - hh}" width="${w - 3}" height="2" fill="rgba(0,0,0,.18)"/>`; x += w + 2; if (i === 5 + k) x += 10; }
      return s + `<rect x="4" y="${y + 40}" width="192" height="6" fill="#7a4a2b"/><rect x="4" y="${y + 46}" width="192" height="2" fill="#4a2a16"/>`;
    }).join('')}
    <defs><radialGradient id="lg" cx=".3" cy=".25" r=".7"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient></defs>
    <rect class="kc-fl" width="200" height="150" fill="url(#lg)"/>
    <path d="M60 0v10" stroke="#2a1a10" stroke-width="1.5"/><path d="M50 10h20l6 10H44z" fill="#efbb4f" stroke="#8a5a12" stroke-width="1"/><ellipse class="kc-fl" cx="60" cy="22" rx="9" ry="3" fill="#fff6d8"/>
    ${[[40,40],[86,58],[30,96],[120,30],[70,110],[150,80]].map(([x,y],i)=>`<circle class="kc-dust" cx="${x}" cy="${y}" r="1.3" fill="#fff1c2" style="animation-delay:${i*-1.1}s"/>`).join('')}
  </svg>`,
  atlas: () => {
    const tok = (v, L, side, x, y, w) => (typeof wpSvg === 'function' ? wpSvg(v, L, side, false, 'trad') : '').replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w}" `);
    const lantern = (x, d) => `<g class="kc-sway" style="transform-origin:${x}px 0px;animation-delay:${d * -.3}s"><path d="M${x} 0v${18 + d}" stroke="#3a1a10" stroke-width="1.5"/><ellipse cx="${x}" cy="${36 + d}" rx="15" ry="19" fill="#d8402c"/><ellipse cx="${x}" cy="${36 + d}" rx="9" ry="19" fill="none" stroke="#ffb36b" stroke-width="1.2" opacity=".7"/><rect x="${x - 7}" y="${15 + d}" width="14" height="4" rx="1" fill="#e2a23b"/><rect x="${x - 7}" y="${53 + d}" width="14" height="4" rx="1" fill="#e2a23b"/><path d="M${x} ${57 + d}v10" stroke="#e2a23b" stroke-width="2"/><circle class="kc-fl" cx="${x}" cy="${36 + d}" r="26" fill="#ffb36b" fill-opacity=".16"/></g>`;
    return `<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="atb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a1f1a"/><stop offset="1" stop-color="#2e0f0d"/></linearGradient>
    <linearGradient id="att" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a2e"/><stop offset="1" stop-color="#4a2a16"/></linearGradient></defs>
    <rect width="400" height="180" fill="url(#atb)"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 50} 0v128" stroke="#000" stroke-width="1" opacity=".18"/>`).join('')}
    <g transform="translate(84 10)"><rect width="160" height="92" rx="4" fill="#f1dfb4"/><rect x="-6" y="-4" width="172" height="8" rx="4" fill="#7a4a2b"/><rect x="-6" y="88" width="172" height="8" rx="4" fill="#7a4a2b"/>
      <path d="M18 30c8-10 26-12 34-4s-2 16 6 22-10 16-22 10-24-16-18-28zM70 22c10-6 30-6 40 2s24 2 30 12-6 18-18 16-16 10-28 6-6-14-18-18-14-12-6-18zM96 60c8-2 16 4 14 12s-12 8-16 2zM128 64c6-2 14 2 12 8s-10 4-12-2z" fill="#b98a4c" opacity=".7"/>
      <path d="M10 46h140M80 8v76" stroke="#7a4a2b" stroke-width=".8" opacity=".35"/>
      <circle cx="113" cy="40" r="3" fill="#d8402c"/><circle cx="138" cy="34" r="3" fill="#d8402c"/><circle cx="104" cy="54" r="3" fill="#d8402c"/><circle cx="40" cy="30" r="3" fill="#d8402c"/></g>
    ${lantern(46, 0)}${lantern(354, 8)}
    <rect y="124" width="400" height="56" fill="url(#att)"/><rect y="124" width="400" height="4" fill="#b57a48" opacity=".6"/>
    ${tok('xiangqi', 'C', 'b', 210, 104, 38)}${tok('xiangqi', 'K', 'w', 246, 92, 50)}${tok('shogi', 'K', 'w', 292, 84, 56)}${tok('janggi', 'K', 'b', 344, 94, 48)}
  </svg>`; },
  world: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16346c"/><stop offset="1" stop-color="#0c1838"/></linearGradient>
    <radialGradient id="wg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fd0c0"/><stop offset="1" stop-color="#2f7d8a"/></radialGradient></defs>
    <rect width="200" height="150" fill="url(#wb)"/>
    ${Array.from({ length: 22 }, (_, i) => `<circle class="${i % 3 ? '' : 'kc-tw'}" style="animation-delay:${i * -.37}s" cx="${(i * 47) % 200}" cy="${(i * 29) % 70}" r="${i % 3 ? .9 : 1.5}" fill="#fff" opacity="${i % 2 ? .5 : .85}"/>`).join('')}
    <g class="kc-sway2" style="transform-origin:100px 0px"><path d="M-10 26 Q100 70 210 26" stroke="#2b2730" stroke-width="1.2" fill="none"/>
    ${Array.from({ length: 9 }, (_, i) => { const t = (i + .5) / 9, x = -10 + 220 * t, y = 26 + 4 * 44 * t * (1 - t) * .5 * 2; return `<circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="3.4" fill="${['#ffd54a', '#ff8a78', '#93dc98', '#9ccfff'][i % 4]}"/>`; }).join('')}</g>
    <circle cx="100" cy="98" r="40" fill="url(#wg)"/>
    <path d="M78 74c10 4 8 14 18 14s6 12 16 10M92 120c6-8 18-6 22-14M120 72c-4 6 2 10-4 16" stroke="#ecd9b4" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>
    <circle cx="100" cy="98" r="40" fill="none" stroke="#f7efdd" stroke-width="2"/>
    <ellipse class="kc-spin" cx="100" cy="98" rx="16" ry="40" fill="none" stroke="#f7efdd" stroke-width="1.2" opacity=".6" style="transform-origin:100px 98px"/><path d="M60 98h80" stroke="#f7efdd" stroke-width="1.2" opacity=".6"/>
    <path d="M100 138v8M80 150h40" stroke="#b57a48" stroke-width="5"/>
  </svg>`,
  courtyard: () => `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0e6"/><stop offset="1" stop-color="#d9f0e4"/></linearGradient></defs>
    <rect width="200" height="150" fill="url(#cs)"/>
    <circle class="kc-fl" cx="160" cy="26" r="22" fill="#fff6c8" fill-opacity=".5"/><circle cx="160" cy="26" r="13" fill="#ffe39a"/>
    <g class="kc-drift" fill="#fff" opacity=".9"><path d="M30 30a8 8 0 0 1 14-5 9 9 0 0 1 16 4 6 6 0 0 1 0 11H32a5 5 0 0 1-2-10z"/></g>
    <g class="kc-drift" style="animation-delay:-9s;animation-duration:26s" fill="#fff" opacity=".75"><path d="M110 46a6 6 0 0 1 10-4 7 7 0 0 1 12 3 5 5 0 0 1 0 9h-20a4 4 0 0 1-2-8z"/></g>
    <path d="M0 74c40-12 80-12 120-4s60 4 80-2v82H0z" fill="#6fbf72"/>
    ${floorSvg(200, 80, 150, 4, 6, '#f7efdd', '#3f6b4a', 50)}
    <path d="M14 82c-8-22 4-40 16-40s22 14 16 34c-4 10-24 14-32 6z" fill="#3f8a4f"/><path d="M28 80v24" stroke="#6a3d22" stroke-width="5"/>
    <g transform="translate(70 70) scale(.9)" fill="#fff8ea" stroke="#3b2a1a" stroke-width="1.8" stroke-linejoin="round"><path d="${PAWN_PATH}"/></g>
    <g transform="translate(104 64) scale(1.05)" fill="#2b2730" stroke="#f4ecdc" stroke-width="1.8" stroke-linejoin="round"><path d="${KNIGHT_PATH}"/><path d="M11 39.5h23v-3H11z"/></g>
  </svg>`,
  trophy: () => `<svg viewBox="0 0 200 64" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4320"/><stop offset="1" stop-color="#3a220f"/></linearGradient>
    <radialGradient id="tg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff1c2"/><stop offset=".55" stop-color="#efbb4f"/><stop offset="1" stop-color="#b8801f"/></radialGradient>
    <radialGradient id="tl" cx=".78" cy=".4" r=".5"><stop offset="0" stop-color="#ffe7a6" stop-opacity=".5"/><stop offset="1" stop-color="#ffe7a6" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="64" fill="url(#tb)"/><rect class="kc-fl" width="200" height="64" fill="url(#tl)"/>
    <rect y="52" width="200" height="6" fill="#8a5532"/><rect y="58" width="200" height="6" fill="#2e180b"/>
    <g transform="translate(200 52) scale(.74) translate(-200 -52)">
    <g transform="translate(140 6)" fill="url(#tg)" stroke="#7a4f12" stroke-width="1.3"><path d="M8 4h26v13a13 13 0 0 1-26 0z"/><path d="M8 8H1a7 7 0 0 0 9 9M34 8h7a7 7 0 0 1-9 9" fill="none"/><path d="M18 30h6v8h-6z"/><path d="M11 38h20v8H11z"/></g>
    <g transform="translate(114 20)"><path d="M4 0l5 10M16 0l-5 10" stroke="#c4485a" stroke-width="4"/><circle cx="10" cy="20" r="10" fill="url(#tg)" stroke="#7a4f12" stroke-width="1.3"/><path d="M10 14l1.8 3.7 4 .6-2.9 2.8.7 4L10 23.2l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff3c4"/></g>
    <g transform="translate(176 24)"><path d="M3 0l4 9M13 0l-4 9" stroke="#4f86c6" stroke-width="4"/><circle cx="8" cy="17" r="9" fill="#d5dde8" stroke="#7d8798" stroke-width="1.3"/></g>
    <g fill="#ffe39a">${[[132,10,1],[170,8,.8],[192,14,.7],[108,14,.6]].map(([x,y,k],i)=>`<path class="kc-tw" style="animation-delay:${i*-.8}s;transform-origin:${x}px ${y}px" transform="translate(${x} ${y}) scale(${k})" d="M0-6l1.5 4.5L6 0l-4.5 1.5L0 6l-1.5-4.5L-6 0l4.5-1.5z"/>`).join('')}</g></g>
  </svg>`,
};
// small treasure chest for the daily reward (lit = reward waiting)
function miniChestSvg(lit) {
  return `<svg viewBox="0 0 64 56" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${lit ? '<circle class="kc-glow" cx="32" cy="30" r="27" fill="#ffd977" fill-opacity=".35"/>' : ''}
    <ellipse cx="32" cy="51" rx="22" ry="4" fill="#000" opacity=".25"/>
    <path d="M10 26h44v20a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#8a4f26" stroke="#4a2410" stroke-width="2"/>
    <path d="M10 26c0-11 8-17 22-17s22 6 22 17z" fill="#a8622f" stroke="#4a2410" stroke-width="2"/>
    <path d="M10 26h44v5H10z" fill="#efbb4f" stroke="#7a4f12" stroke-width="1.6"/>
    <path d="M19 10.5v39.5M45 10.5v39.5" stroke="#efbb4f" stroke-width="4"/><path d="M19 10.5v39.5M45 10.5v39.5" stroke="#7a4f12" stroke-width="1" opacity=".5"/>
    <rect x="27" y="25" width="10" height="12" rx="2" fill="#ffe39a" stroke="#7a4f12" stroke-width="1.6"/><circle cx="32" cy="30" r="1.8" fill="#4a2410"/>
    <path d="M16 16c3-3 7-4.5 11-5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35" fill="none"/>
    ${lit ? '<path class="kc-tw" d="M54 8l1.6 4.4L60 14l-4.4 1.6L54 20l-1.6-4.4L48 14l4.4-1.6z" fill="#fff3c4"/><path class="kc-tw" style="animation-delay:-1.2s" d="M8 12l1 2.8 2.8 1-2.8 1L8 19.6l-1-2.8-2.8-1 2.8-1z" fill="#fff3c4"/>' : ''}
  </svg>`;
}
function roomArt(key) { const d = document.createElement('div'); d.className = 'art'; d.innerHTML = ROOM_ART[key](); return d; }
