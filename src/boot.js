// Native-app feel: no pinch zoom, no double-tap zoom, a stable app height that does not jump
// when the browser toolbar shows or hides, and a page that snaps back after the iOS keyboard closes.
(function lockViewport() {
  const de = document.documentElement;
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  let lastW = 0;
  const setH = () => {
    // innerHeight is the visible height on iOS Safari, iOS home-screen apps and Android Chrome alike
    const hgt = window.innerHeight, w = window.innerWidth;
    if (!hgt) return;
    de.style.setProperty('--app-h', hgt + 'px'); de.style.setProperty('--app-w', w + 'px');
    if (w !== lastW) { lastW = w; de.classList.toggle('land', w > hgt); }
  };
  setH();
  let raf = 0; const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(setH); };
  // while the keyboard is up the window shrinks: keep the app height so the board does not jump
  window.addEventListener('resize', () => { if (!typing()) soon(); });
  // rotation: iOS reports the new size a little late, so measure a few times
  const rotated = () => { soon(); setTimeout(setH, 120); setTimeout(setH, 400); };
  window.addEventListener('orientationchange', rotated);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', rotated);
  window.addEventListener('pageshow', setH);
  // the keyboard closed: measure again and put a pinned (focus) screen back where it belongs
  document.addEventListener('focusout', () => setTimeout(() => {
    if (typing()) return; setH();
    if (document.body.classList.contains('focus') && (window.scrollY || window.scrollX)) window.scrollTo(0, 0);
    else if (window.scrollX) window.scrollTo(0, window.scrollY);
  }, 60));
  // Safari: pinch gestures; every browser: two-finger moves and double-tap zoom
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  // trackpad pinch (ctrl + wheel) on desktop browsers scales the page, not the app
  document.addEventListener('wheel', e => { if (e.ctrlKey && document.body.classList.contains('focus')) e.preventDefault(); }, { passive: false });
  // home-screen app (iOS standalone or installed PWA): lets the CSS know there is no browser chrome
  try { if (navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) de.classList.add('standalone'); } catch (e) { }
})();
// Dialogs for screen readers and keyboards: every .modal becomes a labelled, modal dialog that
// takes focus, keeps Tab inside, closes on Escape (when it can be dismissed) and gives focus back.
(function dialogs() {
  if (!window.MutationObserver) return;
  const open = [];
  const setup = bg => {
    const box = bg.querySelector('.modal'); if (!box || box.dataset.a11y) return; box.dataset.a11y = '1';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
    const ttl = box.querySelector('h2,h3'); if (ttl) { ttl.id = ttl.id || 'dlg-' + Math.random().toString(36).slice(2, 8); box.setAttribute('aria-labelledby', ttl.id); }
    open.push({ bg, ret: document.activeElement });
    requestAnimationFrame(() => { const f = box.querySelector('[autofocus]') || box; try { f.focus({ preventScroll: true }); } catch (e) { } });
  };
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('modal-bg')) setup(n);
      for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList.contains('modal-bg')) {
        const i = open.findIndex(o => o.bg === n); if (i < 0) continue;
        const { ret } = open.splice(i, 1)[0];
        if (ret && ret.isConnected && ret.focus && !document.querySelector('.modal-bg')) try { ret.focus({ preventScroll: true }); } catch (e) { }
      }
    }
  }).observe(document.body, { childList: true });
  document.addEventListener('keydown', e => {
    const top = open[open.length - 1]; if (!top || !top.bg.isConnected) return;
    if (e.key === 'Escape') { top.bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; } // same as tapping outside
    if (e.key !== 'Tab') return;
    const items = [...top.bg.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null); if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !top.bg.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !top.bg.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
  // icon-only buttons with no words: borrow the tooltip, so a screen reader can say what they do
  const label = root => { for (const b of root.querySelectorAll('button:not([aria-label])')) { if (!b.textContent.trim()) { const t = b.title || (b.dataset && b.dataset.r); if (t) b.setAttribute('aria-label', t); } } };
  new MutationObserver(() => { cancelAnimationFrame(label.raf); label.raf = requestAnimationFrame(() => label(document.body)); }).observe(document.body, { childList: true, subtree: true });
})();
// Manifest shortcuts: #daily opens today's puzzle straight away
const bootWantsDaily = location.hash === '#daily';
if (bootWantsDaily) try { history.replaceState(null, '', '#puzzles'); } catch (e) { }
// Start the app after every module has loaded (and the chosen language's words are in).
initI18n().catch(() => { }).finally(() => {
  boot();
  if (bootWantsDaily && typeof puzMode !== 'undefined') { try { puzMode = 'daily'; render(); } catch (e) { } }
});
// opening moment: the brass medallion drops in, the knight lands, then the clubhouse appears
(function splash() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (sessionStorage.getItem('kc-splash')) return; sessionStorage.setItem('kc-splash', '1'); } catch (e) { }
  const el = document.createElement('div'); el.className = 'splash';
  el.innerHTML = `<div class="sp-disc"><img src="${PIECE_URL.bn}" alt=""></div><div class="sp-name">Knight Club</div>`;
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 1150);
  setTimeout(() => el.remove(), 1600);
})();
// Installable app + offline play (only when served over http/https, not from a local file)
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
// "A new version is ready" toast: shown when an update has downloaded in the background.
// Tapping Reload switches to it; otherwise it starts by itself the next time the app opens.
function showUpdateToast(reg) {
  if (document.querySelector('.uptoast')) return;
  const t = h('div', { class: 'uptoast', role: 'status' },
    typeof icon === 'function' ? icon('download', 20) : null,
    h('span', { class: 'grow' }, 'A new version of Knight Club is ready'),
    h('button', { class: 'btn primary sm', onclick: () => { t.remove(); if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); else location.reload(); } }, 'Reload'),
    h('button', { class: 'up-x', 'aria-label': 'Later', onclick: () => t.remove() }, typeof icon === 'function' ? icon('x', 18) : 'x'));
  document.body.append(t);
}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !bootHadController) return; reloading = true; location.reload(); });
    const bootHadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const waiting = () => { if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg); };
      waiting();
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') waiting(); }); });
      // a home-screen app can stay open for days: look for updates whenever it comes back to the front
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
    }).catch(() => { });
  });
}
