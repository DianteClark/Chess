// Knight Club original artwork: a line-icon set, bot character avatars and the
// Professor Hoot mascot. All drawn by hand in SVG for this project (no emoji, no icon fonts).
'use strict';
const ICON_PATHS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.8 3.5 5.6"/>',
  puzzle: '<path d="M5 8h3a2.2 2.2 0 1 1 4.4 0H16v3.6a2.2 2.2 0 1 1 0 4.4V20h-3.6a2.2 2.2 0 1 0-4.4 0H5v-3.6a2.2 2.2 0 1 0 0-4.4z"/>',
  learn: '<path d="M2 9.5l10-5 10 5-10 5z"/><path d="M6 11.6v4.6c2.6 2.3 9.4 2.3 12 0v-4.6"/><path d="M22 9.5v5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  flip: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M18 3v4.5h-4.5"/><path d="M6 21v-4.5h4.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  half: '<text x="12" y="16.5" text-anchor="middle" font-size="13" font-weight="900" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">1/2</text>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5h12l-2.5 4 2.5 4H5"/>',
  repeat: '<path d="M17 2.5l3.5 3.5-3.5 3.5"/><path d="M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5"/><path d="M7 21.5L3.5 18 7 14.5"/><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  first: '<path d="M17 18l-6-6 6-6"/><path d="M7 6v12"/>',
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  last: '<path d="M7 6l6 6-6 6"/><path d="M17 6v12"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" fill="currentColor" stroke-linejoin="round"/>',
  trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.8M16 6h2.5a2.5 2.5 0 0 1-2.6 3.8"/><path d="M12 13.5V17"/><path d="M8.5 20.5h7l-.8-3.5H9.3z"/>',
  flame: '<path d="M12 2.8c.8 3.8 5.2 5.2 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.4 1.3-4 2.4-5 .3 1.9 1.3 2.8 2.3 2.8 0-2.8-.6-5.3.5-8.2z"/>',
  soundOn: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18 7a7 7 0 0 1 0 10"/>',
  soundOff: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 3.8 5.8 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.8-3.8-9S9.4 5.5 12 3z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  save: '<path d="M5 3.5h11l3.5 3.5v13.5H5z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  plug: '<path d="M9 3v5M15 3v5"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5v4.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  gem: '<path d="M6.5 4h11L21 9l-9 11L3 9z"/><path d="M3 9h18M9.5 4L8 9l4 11M14.5 4L16 9l-4 11"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/>',
  crown: '<path d="M4 18h16l1-10-5 4-4-6.5L8 12 3 8z"/><path d="M4 21h16"/>',
  castle: '<path d="M5 21V10h14v11z"/><path d="M5 10V5h3v2.5h2.5V5h3v2.5H16V5h3v5"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  arrowUp: '<path d="M12 20V5"/><path d="M6 11l6-6 6 6"/>',
  arrowRight: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  board: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/><path d="M3.5 3.5h5.7v5.7H3.5zM14.8 3.5h5.7v5.7h-5.7zM9.2 9.2h5.6v5.6H9.2zM3.5 14.8h5.7v5.7H3.5zM14.8 14.8h5.7v5.7h-5.7z" fill="currentColor" stroke="none" opacity=".35"/>',
  book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z"/>',
  sword: '<path d="M14.5 3.5H20v5.5L9.5 19.5l-5-5z"/><path d="M6.5 13.5l4 4M3.5 20.5l3-3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.5 12L20 3.5M16.5 7l3 3M14 9.5l2 2"/>',
  fork: '<path d="M12 21v-8"/><path d="M12 13L5.5 5M12 13l6.5-8"/><circle cx="5" cy="4.5" r="1.6" fill="currentColor"/><circle cx="19" cy="4.5" r="1.6" fill="currentColor"/>',
  pin: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21.5"/>',
  skewer: '<path d="M3 12h18"/><circle cx="9" cy="12" r="3"/><circle cx="17" cy="12" r="2"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.5 15l4-4.5 3 3L20 7"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  ninja: '<circle cx="12" cy="12" r="8.5"/><path d="M4 11h16v3H4z" fill="currentColor"/><circle cx="9" cy="12.5" r="1" fill="#fff" stroke="none"/><circle cx="15" cy="12.5" r="1" fill="#fff" stroke="none"/>',
  muscle: '<path d="M5 17c0-5 3-9 6-10l2 2-3 2c3 0 6 1 8 4-2 3-6 4-13 2z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.7 16a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 10z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4.5 20h15"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4.5 20h15"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 1.6-2.2-.5-1.4.4-2.8 1.9-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5L6 3h4l2 5 2-5h4l-2.5 7.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
};
function icon(name, size = 22, extraClass = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.star;
  const span = document.createElement('span');
  span.className = 'icn ' + extraClass;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return span;
}
const iconSvg = (name, color = '#fff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${ICON_PATHS[name]}</svg>`;

// ---------- Characters (64x64) ----------
const AVATAR_SVG = {
  // Pip: a newly hatched chick peeking out of its shell
  pip: `<circle cx="32" cy="32" r="32" fill="#2f4a7a"/><ellipse cx="32" cy="34" rx="15" ry="16" fill="#ffd54a"/><path d="M28 15c2-4 6-4 6 0" stroke="#e8a317" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="26.5" cy="30" r="2.6" fill="#2b2320"/><circle cx="37.5" cy="30" r="2.6" fill="#2b2320"/><circle cx="27.3" cy="29.2" r=".9" fill="#fff"/><circle cx="38.3" cy="29.2" r=".9" fill="#fff"/><path d="M29 35l3 3.5 3-3.5z" fill="#ff8a3c"/><path d="M14 42l5-4 4 5 5-5 4 5 4-5 5 5 4-5 5 4v8a18 18 0 0 1-36 0z" fill="#fbf4e6" stroke="#d9cdb4" stroke-width="1.5"/>`,
  // Bea: a round bumblebee with clear wings
  bea: `<circle cx="32" cy="32" r="32" fill="#3d3a6e"/><ellipse cx="23" cy="20" rx="8" ry="11" fill="#cfe9ff" opacity=".85" transform="rotate(-25 23 20)"/><ellipse cx="41" cy="20" rx="8" ry="11" fill="#cfe9ff" opacity=".85" transform="rotate(25 41 20)"/><ellipse cx="32" cy="37" rx="16" ry="14" fill="#ffc83a"/><path d="M22 28.5h20M18.5 36h27M20 43.5h24" stroke="#2b2320" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="33" r="0" /><path d="M27 18c-1-4-3-6-6-6M37 18c1-4 3-6 6-6" stroke="#2b2320" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="21" cy="12" r="2" fill="#2b2320"/><circle cx="43" cy="12" r="2" fill="#2b2320"/>`,
  // Milo: a clever fox
  milo: `<circle cx="32" cy="32" r="32" fill="#28536b"/><path d="M14 16l8 14M50 16l-8 14" stroke="none"/><path d="M13 14l12 10-6 6zM51 14L39 24l6 6z" fill="#e8742a"/><path d="M15.5 17.5l6 5-3 3zM48.5 17.5l-6 5 3 3z" fill="#3a2418"/><path d="M14 30c0-8 8-12 18-12s18 4 18 12c0 9-8 18-18 22-10-4-18-13-18-22z" fill="#f08a35"/><path d="M14.5 33c6 0 11 4 17.5 19-10-4-17-11-17.5-19zM49.5 33c-6 0-11 4-17.5 19 10-4 17-11 17.5-19z" fill="#fff4e6"/><circle cx="25" cy="30" r="2.6" fill="#2b2320"/><circle cx="39" cy="30" r="2.6" fill="#2b2320"/><path d="M29.5 41h5l-2.5 3z" fill="#2b2320"/>`,
  // Rosa: a thoughtful owl
  rosa: `<circle cx="32" cy="32" r="32" fill="#4a3b6b"/><path d="M15 18l7 6M49 18l-7 6" stroke="#7a5233" stroke-width="4" stroke-linecap="round"/><ellipse cx="32" cy="36" rx="18" ry="19" fill="#9a6a44"/><ellipse cx="32" cy="42" rx="11" ry="11" fill="#e9d2b0"/><circle cx="24.5" cy="29" r="7.5" fill="#fff"/><circle cx="39.5" cy="29" r="7.5" fill="#fff"/><circle cx="25" cy="29.5" r="3.6" fill="#2b2320"/><circle cx="39" cy="29.5" r="3.6" fill="#2b2320"/><circle cx="26" cy="28.4" r="1.1" fill="#fff"/><circle cx="40" cy="28.4" r="1.1" fill="#fff"/><path d="M29.5 34.5h5L32 39z" fill="#f2a530"/><path d="M26 45q2 1.5 3 0M31 47q2 1.5 3 0M35 44q2 1.5 3 0" stroke="#b08a63" stroke-width="1.4" fill="none"/>`,
  // Sir Knight: a knight's helmet with a plume
  knight: `<circle cx="32" cy="32" r="32" fill="#1f5f5b"/><path d="M33 9c6-2 12 1 13 7-5-1-9 0-12 3z" fill="#e2483d"/><path d="M18 30c0-10 6-17 14-17s14 7 14 17v14c0 4-3 7-7 7H25c-4 0-7-3-7-7z" fill="#c9d1db" stroke="#8d97a3" stroke-width="1.5"/><path d="M19 31h26v6H19z" fill="#2b3340"/><path d="M32 13v18" stroke="#8d97a3" stroke-width="2"/><path d="M24 42h16M26 46h12" stroke="#8d97a3" stroke-width="1.6" stroke-linecap="round"/>`,
  // Bishop Bo: a wise old wizard-scholar
  bo: `<circle cx="32" cy="32" r="32" fill="#2c3f6e"/><path d="M32 4L18 27h28z" fill="#6b4fc4"/><circle cx="32" cy="16" r="2.2" fill="#ffd54a"/><path d="M15 27h34" stroke="#8f78e0" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="35" r="10" fill="#f2c9a0"/><circle cx="28" cy="34" r="1.6" fill="#2b2320"/><circle cx="36" cy="34" r="1.6" fill="#2b2320"/><path d="M22 38c2 14 18 14 20 0-3 2-6 3-10 3s-7-1-10-3z" fill="#f4f1ea"/><path d="M27 31.5h3M34 31.5h3" stroke="#f4f1ea" stroke-width="1.8" stroke-linecap="round"/>`,
  // Queen Vera: a confident queen with a jeweled crown
  vera: `<circle cx="32" cy="32" r="32" fill="#5b2a5e"/><path d="M18 54c0-10 6-15 14-15s14 5 14 15z" fill="#b8327a"/><path d="M19 30c0-10 5-15 13-15s13 5 13 15c0 3 1 7 3 9-4 1-6-2-7-4l-9-1-9 1c-1 2-3 5-7 4 2-2 3-6 3-9z" fill="#5a3426"/><circle cx="32" cy="31" r="9.5" fill="#e9b48e"/><circle cx="28.5" cy="30.5" r="1.5" fill="#2b2320"/><circle cx="35.5" cy="30.5" r="1.5" fill="#2b2320"/><path d="M29 35q3 2 6 0" stroke="#a5453c" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M22 19l3-9 4 5 3-7 3 7 4-5 3 9z" fill="#ffcf3f" stroke="#d9a21a" stroke-width="1"/><circle cx="32" cy="15" r="1.6" fill="#e2483d"/>`,
  // The Tower: an ancient stone tower with a glowing window
  tower: `<circle cx="32" cy="32" r="32" fill="#283244"/><path d="M20 56V24h24v32z" fill="#8a94a6"/><path d="M18 24V13h5v4h4.5v-4h5v4h4.5v-4h5v11z" fill="#a4aec0"/><path d="M28 56V45a4 4 0 0 1 8 0v11z" fill="#3b2a1d"/><path d="M29 30h6v7h-6z" fill="#ffcf5a"/><path d="M20 33h5M39 40h5M22 48h4M38 50h6" stroke="#717b8d" stroke-width="1.5" stroke-linecap="round"/><path d="M44 13l5-3v6z" fill="#e2483d"/><path d="M44 10v14" stroke="#cfd6e0" stroke-width="1.3"/>`,
  // generic people
  you: `<circle cx="32" cy="32" r="32" fill="#2f6f4f"/><circle cx="32" cy="26" r="10" fill="#f3d2b3"/><path d="M14 56c1-11 8-17 18-17s17 6 18 17z" fill="#ffb547"/><circle cx="28.5" cy="26" r="1.5" fill="#2b2320"/><circle cx="35.5" cy="26" r="1.5" fill="#2b2320"/><path d="M28.5 30.5q3.5 3 7 0" stroke="#a5453c" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M22 23c1-8 19-9 20 0-3-3-7-4-10-4s-7 1-10 4z" fill="#4a3426"/>`,
  friend: `<circle cx="32" cy="32" r="32" fill="#6b3b3b"/><circle cx="32" cy="26" r="10" fill="#c98f6a"/><path d="M14 56c1-11 8-17 18-17s17 6 18 17z" fill="#6fb3ff"/><circle cx="28.5" cy="26" r="1.5" fill="#2b2320"/><circle cx="35.5" cy="26" r="1.5" fill="#2b2320"/><path d="M28.5 30.5q3.5 3 7 0" stroke="#7a2e26" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M21 26c0-9 4-12 11-12s11 3 11 12c-2-4-6-6-11-6s-9 2-11 6z" fill="#2b2320"/>`,
  white: `<circle cx="32" cy="32" r="32" fill="#e9e3d6"/><circle cx="32" cy="32" r="14" fill="#fffdf6" stroke="#272320" stroke-width="2.5"/>`,
  black: `<circle cx="32" cy="32" r="32" fill="#3a3540"/><circle cx="32" cy="32" r="14" fill="#2b2730" stroke="#f4ecdc" stroke-width="2.5"/>`,
};
// Professor Hoot: the owl teacher with a mortarboard
const HOOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="40" rx="20" ry="21" fill="#8a5a36"/><ellipse cx="32" cy="46" rx="12.5" ry="13" fill="#ecd6b4"/><path d="M37 55q2 1.6 3 0M27 52q2 1.6 3 0M32 57q2 1.6 3 0" stroke="#b9936b" stroke-width="1.4" fill="none"/><circle cx="23.5" cy="33" r="8.5" fill="#fff"/><circle cx="40.5" cy="33" r="8.5" fill="#fff"/><circle cx="23.5" cy="33" r="8.5" fill="none" stroke="#3b2a1d" stroke-width="1.6"/><circle cx="40.5" cy="33" r="8.5" fill="none" stroke="#3b2a1d" stroke-width="1.6"/><path d="M32 33h0" stroke="#3b2a1d" stroke-width="1.6"/><circle cx="24" cy="33.5" r="3.8" fill="#2b2320"/><circle cx="40" cy="33.5" r="3.8" fill="#2b2320"/><circle cx="25.2" cy="32.3" r="1.2" fill="#fff"/><circle cx="41.2" cy="32.3" r="1.2" fill="#fff"/><path d="M29.5 39h5L32 43.5z" fill="#f2a530"/><path d="M12 15l20-8 20 8-20 8z" fill="#2b2730"/><path d="M20 18v6c6 4 18 4 24 0v-6" fill="#3a3540"/><path d="M50 15.5v9" stroke="#ffcf3f" stroke-width="1.8"/><circle cx="50" cy="25.5" r="2" fill="#ffcf3f"/></svg>`;
const AVATAR_URL = {};
for (const k in AVATAR_SVG) AVATAR_URL[k] = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${AVATAR_SVG[k]}</svg>`);
const HOOT_URL = 'data:image/svg+xml;base64,' + btoa(HOOT_SVG);
function avatar(key, size = 38) {
  const img = document.createElement('img');
  img.src = AVATAR_URL[key] || AVATAR_URL.you; img.alt = ''; img.width = size; img.height = size;
  img.className = 'av-img'; return img;
}
function hoot(size = 52) { const img = document.createElement('img'); img.src = HOOT_URL; img.width = size; img.height = size; img.alt = 'Professor Hoot'; img.className = 'hoot'; return img; }
// tiny piece image for inline text, e.g. pieceImg('wk')
function pieceImg(key, size = 18) { const img = document.createElement('img'); img.src = PIECE_URL[key]; img.width = size; img.height = size; img.alt = ''; img.style.verticalAlign = '-3px'; return img; }

// Big round badge for result screens, e.g. badge('trophy', 'gold')
function badge(name, tone = 'gold') { const d = document.createElement('div'); d.className = 'badge ' + tone; d.append(icon(name, 40)); return d; }
// icon as an HTML string, for places that build innerHTML
function iconSvgInline(name, size = 22) { return `<span class="icn"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg></span>`; }
