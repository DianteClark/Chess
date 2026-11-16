// Translation layer. The app is written in English; this module translates what is on screen.
// Dictionaries live in data/i18n/<lang>.json as { "English text": "translation" }.
// Strings with {0}, {1} placeholders are patterns (built from template literals in the source).
// A MutationObserver translates every new text node, so new screens are covered automatically.
'use strict';
const LANGS = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'pt', name: 'Português' }, { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' }, { code: 'zh', name: '中文' }, { code: 'ja', name: '日本語' }, { code: 'hi', name: 'हिन्दी' }, { code: 'ar', name: 'العربية', rtl: true },
];
const I18N = { lang: 'en', dict: null, patterns: [], ready: false };
function savedLang() {
  try { const v = localStorage.getItem('kc-lang'); if (v) return v; } catch (e) { }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.some(l => l.code === nav) ? nav : 'en';
}
function setLang(code) {
  try { localStorage.setItem('kc-lang', code); } catch (e) { }
  location.reload(); // simplest way to redraw every screen in the new language
}
// tr(): translate one English string (exact match, or a {0} pattern); falls back to English
function tr(s) {
  if (!I18N.dict || typeof s !== 'string') return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim().replace(/\s+/g, ' ');
  if (!core) return s;
  let t = I18N.dict[core];
  if (t == null) t = trSentences(core);
  if (t == null) {
    for (const p of I18N.patterns) { const m = core.match(p.re); if (m) { t = p.out.replace(/\{(\d)\}/g, (_, k) => { const v = m[+k + 1]; if (!v || /\{\d\}/.test(v)) return v; if ((tr.depth || 0) > 2) return I18N.dict[v.trim()] != null ? I18N.dict[v.trim()] : v; tr.depth = (tr.depth || 0) + 1; try { return tr(v); } finally { tr.depth--; } }); break; } }
  }
  if (t == null) t = trSplit(core);
  return t == null ? s : lead + t + trail;
}
// coach explanations are built from several sentences: translate them one by one
function trSentences(core) {
  const parts = core.split(/(?<=[.!?])\s+(?=[A-Z0-9"])/); if (parts.length < 2 || (tr.depth || 0) > 2) return null;
  tr.depth = (tr.depth || 0) + 1;
  try { let changed = false; const out = parts.map(p => { const t = tr(p); if (t !== p) changed = true; return t; }); return changed ? out.join(' ') : null; } finally { tr.depth--; }
}
// "Win +21", "Play Milo", "Theme: Fork": a known phrase followed by a number, a name or another known word
function trSplit(core) {
  for (let i = core.lastIndexOf(' '); i > 0; i = core.lastIndexOf(' ', i - 1)) {
    const head = core.slice(0, i).trim(), tail = core.slice(i + 1).trim();
    let th = I18N.dict[head], colon = '';
    if (th == null && head.endsWith(':') && I18N.dict[head.slice(0, -1)] != null) { th = I18N.dict[head.slice(0, -1)]; colon = ':'; }
    if (th == null) continue;
    const tt = I18N.dict[tail];
    if (tt != null) return th + colon + ' ' + tt;
    if (!/\b[a-z]{3,}\b/.test(tail)) return th + colon + ' ' + tail;
    return null;
  }
  return null;
}
function buildPatterns(dict) {
  const out = [];
  for (const k in dict) {
    if (!/\{\d\}/.test(k)) continue;
    const order = []; const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, (_, d) => { order.push(+d); return '(.*?)'; });
    try {
      // capture group i holds placeholder order[i]; the translation may reorder placeholders
      const re = new RegExp('^' + src + '$');
      out.push({ re, out: dict[k].replace(/\{(\d)\}/g, (_, d) => `{${order.indexOf(+d)}}`) });
    } catch (e) { }
  }
  return out.sort((a, b) => b.re.source.length - a.re.source.length);
}
const TRANSLATED = new WeakSet();
function translateNode(root) {
  if (!I18N.dict || !root) return;
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1) return;
  // rich text blocks (lesson and coach bubbles) are translated as whole HTML when possible
  if ((root.classList && (root.classList.contains('txt') || root.classList.contains('i18n-html'))) && !TRANSLATED.has(root)) {
    const key = root.innerHTML.replace(/\s+/g, ' ').trim(), t = I18N.dict[key];
    if (t != null) { TRANSLATED.add(root); root.innerHTML = t; return; }
  }
  for (const a of ['placeholder', 'aria-label', 'title']) if (root.hasAttribute && root.hasAttribute(a)) { const v = root.getAttribute(a), t = tr(v); if (t !== v) root.setAttribute(a, t); }
  if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'svg' || (root.classList && root.classList.contains('no-i18n'))) return;
  for (const c of [...root.childNodes]) translateNode(c);
}
function translateText(n) {
  if (TRANSLATED.has(n)) return;
  const v = n.nodeValue, t = tr(v);
  TRANSLATED.add(n);
  if (t !== v) n.nodeValue = t;
}
async function initI18n() {
  I18N.lang = savedLang();
  const meta = LANGS.find(l => l.code === I18N.lang) || LANGS[0];
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  if (meta.code === 'en') { I18N.ready = true; return; }
  try {
    const r = await fetch(`data/i18n/${meta.code}.json`);
    if (!r.ok) throw new Error('missing');
    I18N.dict = await r.json(); I18N.patterns = buildPatterns(I18N.dict);
  } catch (e) { I18N.dict = null; return; }
  translateNode(document.body);
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') { TRANSLATED.delete(m.target); translateText(m.target); continue; }
      for (const n of m.addedNodes) translateNode(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  I18N.ready = true;
}
function languagePicker() {
  const sel = h('select', { class: 'input', 'aria-label': 'Language', onchange: e => setLang(e.target.value) }, LANGS.map(l => { const o = h('option', { value: l.code }, l.name); if (l.code === I18N.lang) o.selected = true; return o; }));
  sel.classList.add('no-i18n');
  return sel;
}
