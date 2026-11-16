// Native-app feel: no pinch zoom, no double-tap zoom, a stable app height that does not jump
// when the browser toolbar shows or hides.
(function lockViewport() {
  const setH = () => document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px');
  setH(); window.addEventListener('resize', () => { if (!document.activeElement || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) setH(); }); window.addEventListener('orientationchange', () => setTimeout(setH, 300));
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
})();
// Start the app after every module has loaded (and the chosen language's words are in).
initI18n().catch(() => { }).finally(boot);
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
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
