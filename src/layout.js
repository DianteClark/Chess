// Screen layouts.
// Hub screens (Club, Play, Learn, Puzzles, Me, World Games) scroll under a sticky header with the dock below.
// Focus screens (a game, a lesson, a puzzle, a review) fill exactly one phone screen: no dock, no
// scrolling, a fixed header, the board sized to the space that is left, and the buttons at the bottom.
'use strict';
let focusOn = false;
// focusScreen(main, opts) -> areas to fill. opts: {title, sub, back(), right:[elements], progress:[done, total]}
function focusScreen(main, opts = {}) {
  focusOn = true; document.body.classList.add('focus');
  const titleEl = h('div', { class: 'fs-title' }, h('b', null, opts.title || ''), opts.sub ? h('small', null, opts.sub) : null);
  const head = h('header', { class: 'fs-head' },
    h('button', { class: 'fs-back', 'aria-label': 'Back', onclick: () => { haptic(6); beep('tap'); navDir = 'back'; (opts.back || (() => go('home')))(); } }, icon('back', 22)),
    titleEl, h('div', { class: 'fs-right' }, opts.right || []));
  const prog = h('div', { class: 'fs-progress' });
  const above = h('div', { class: 'fs-above' });
  const stage = h('div', { class: 'fs-stage' });
  const below = h('div', { class: 'fs-below' });
  const actions = h('div', { class: 'fs-actions' });
  const root = h('div', { class: 'fs' }, head, prog, above, stage, below, actions);
  main.append(root);
  const api = {
    root, head, above, stage, below, actions,
    setTitle(t, sub) { titleEl.innerHTML = ''; titleEl.append(h('b', null, t), sub ? h('small', null, sub) : null); },
    setProgress(done, total) {
      prog.innerHTML = ''; if (!total) { prog.style.display = 'none'; return; }
      prog.style.display = '';
      if (total <= 14) for (let i = 0; i < total; i++) prog.append(h('i', { class: i < done ? 'done' : i === done ? 'on' : '' }));
      else prog.append(h('div', { class: 'fs-bar' }, h('div', { style: { width: Math.round(done / total * 100) + '%' } })));
    },
    // buttons: [{ic, label, on, primary, disabled, wide}]
    setActions(list) {
      actions.innerHTML = '';
      for (const b of list) { if (!b) continue; actions.append(h('button', { class: 'fs-btn' + (b.primary ? ' primary' : '') + (b.wide ? ' wide' : '') + (b.danger ? ' danger' : ''), disabled: !!b.disabled, 'aria-label': b.label, onclick: e => { haptic(b.primary ? 10 : 6); beep(b.primary ? 'confirm' : 'tap'); b.on(e); } }, ...(b.primary ? [b.label ? h('span', null, b.label) : null, b.ic ? icon(b.ic, 20) : null] : [b.ic ? icon(b.ic, 22) : null, b.label ? h('span', null, b.label) : null]))); }
    },
  };
  api.setProgress(...(opts.progress || [0, 0]));
  return api;
}
function leaveFocus() { focusOn = false; document.body.classList.remove('focus'); }
// a speech bubble from Professor Hoot that fits in the space above the board
function hootSays(html, mood) {
  const who = typeof hootEl === 'function' ? hootEl(mood || 'talk', 52) : hoot(52);
  return h('div', { class: 'fs-bubble' }, h('div', { class: 'who' }, who), h('div', { class: 'txt', html }));
}
