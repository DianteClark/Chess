// Start the app after every module has loaded.
boot();
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
