# Accessibility sweep: python3 tools/qa/a11y.py
# Visits the main scenes and lists buttons with no accessible name, images with no alt,
# text whose colour contrast is below 4.5:1 (3:1 for large text) against its painted background,
# and dialogs that are not marked up as dialogs.
import json
from playwright.sync_api import sync_playwright
SCENES = [('home', "go('home')"), ('play', "go('play')"), ('game', "profile.current=null; startBotGame(1,'w',false,'180+2'); go('play')"),
          ('puzzles', "profile.current=null; puzMode=null; go('puzzles')"), ('daily', "puzMode='daily'; go('puzzles')"), ('learn', "puzMode=null; go('learn')"),
          ('lesson', "lessonOpen=LESSONS[2]; lessonStep=0; go('learn')"), ('me', "lessonOpen=null; meView=null; go('me')"), ('settings', "meView='settings'; go('me')"),
          ('friend', "meView=null; friendView='menu'; go('friend')"), ('world', "worldView=null; go('world')"), ('confirm', "go('home'); confirmBox('Resign?','Are you sure?','Resign',()=>{})")]
JS = r"""(() => {
  const out = { noname: [], noalt: [], contrast: [], dialogs: [] };
  const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > .3 && r.width > 0 && r.height > 0; };
  const nm = el => (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase());
  for (const b of document.querySelectorAll('button,[role=button],a[href]')) { if (!vis(b)) continue;
    const name = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim() || [...b.querySelectorAll('img[alt]')].map(i => i.alt).join('').trim();
    if (!name) out.noname.push(nm(b) + ' in ' + nm(b.parentElement)); }
  for (const i of document.querySelectorAll('img')) if (vis(i) && !i.hasAttribute('alt')) out.noalt.push(nm(i) + ' ' + (i.src || '').slice(-30));
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const bgOf = el => { let stack = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && !/^url/.test(s.backgroundImage)) return null; const c = parse(s.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= .99) break; } }
    let r = [27, 68, 52]; for (const c of stack.reverse()) r = r.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return r; };
  const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.nodeValue.trim(); const el = n.parentElement; if (!t || !el || seen.has(el) || el.closest('svg,script,style,.board-wrap,.vboard-wrap') || !vis(el)) continue; seen.add(el);
    const s = getComputedStyle(el); const fg = parse(s.color); const bg = bgOf(el); if (!fg || !bg) continue;
    const a = fg[3] * (+s.opacity || 1); const f = bg.map((v, i) => v * (1 - a) + fg[i] * a);
    const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.6 && +s.fontWeight >= 700);
    if (cr < (big ? 3 : 4.5)) out.contrast.push(cr.toFixed(2) + ' ' + nm(el) + ' "' + t.slice(0, 26) + '"'); }
  for (const m of document.querySelectorAll('.modal')) if (m.getAttribute('role') !== 'dialog' || !m.getAttribute('aria-modal')) out.dialogs.push('modal without dialog role');
  for (const k in out) out[k] = [...new Set(out[k])].slice(0, 12);
  return out; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page()
    pg.goto('http://localhost:8000/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(2000)
    for name, js in SCENES:
        pg.evaluate("document.querySelectorAll('.modal-bg,.kx-ov').forEach(x=>x.remove())"); pg.evaluate(js); pg.wait_for_timeout(1000)
        r = pg.evaluate(JS); r = {k: v for k, v in r.items() if v}
        if r: print(name, json.dumps(r, indent=1))
    b.close()
