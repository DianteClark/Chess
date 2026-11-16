# Screen-lock QA across a device matrix: python3 tools/qa/devices.py [outdir]
# For each device: hub page + focus screen (bot game) + lesson, checks horizontal overflow, focus screen
# filling exactly --app-h, controls inside the screen, rotation (viewport swap), emulated safe areas
# (notch + home indicator), input focus (keyboard) not zooming, and visualViewport scale staying 1.
import sys, os, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/qm/dev'; os.makedirs(OUT, exist_ok=True)
URL = os.environ.get('KC_URL', 'http://localhost:8000/index.html')
SAFE = ":root{--safe-t:47px!important;--safe-b:34px!important}"   # iPhone 14-ish notch + home bar
CHECK = r"""(() => {
  const out = [], vw = innerWidth, vh = innerHeight, de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push('page wider than screen: ' + de.scrollWidth + ' > ' + vw);
  if (visualViewport && Math.abs(visualViewport.scale - 1) > .01) out.push('zoomed: scale ' + visualViewport.scale);
  const focus = document.body.classList.contains('focus');
  if (focus) {
    const fs = document.querySelector('.fs'); if (fs) { const r = fs.getBoundingClientRect(); if (Math.abs(r.height - vh) > 1 || r.top < -1) out.push('fs not filling screen: top ' + r.top + ' h ' + r.height + ' vh ' + vh); }
    if (de.scrollHeight > vh + 1) out.push('focus page scrolls: ' + de.scrollHeight);
    for (const el of document.querySelectorAll('.fs button, .fs .board-wrap, .fs .vboard-wrap')) { const r = el.getBoundingClientRect(); if (!r.height) continue;
      if (r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) out.push('outside screen: ' + (el.className || el.tagName) + ' ' + JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round))); }
    const st = getComputedStyle(document.documentElement).getPropertyValue('--safe-t');
    const head = document.querySelector('.fs-head'); if (head && parseFloat(st) > 0 && head.getBoundingClientRect().top < parseFloat(st) - 1) out.push('header under status bar');
    const act = document.querySelector('.fs-actions'); const sb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b'));
    if (act && act.offsetHeight && sb > 0 && act.getBoundingClientRect().bottom > vh - sb + 1) out.push('actions under home indicator');
  } else {
    const tb = document.querySelector('.topbar'); const st = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-t'));
    if (tb && st > 0) { const c = tb.firstElementChild.getBoundingClientRect(); if (c.top < st - 1) out.push('topbar content under status bar'); }
  }
  for (const el of document.querySelectorAll('#app button, .modal button, .tabs button')) { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width && r.height && s.visibility !== 'hidden' && (r.width < 40 || r.height < 40) && !el.closest('.seg,.cats,.moves,.board-wrap,.vboard-wrap,.vpocket')) out.push('small tap target ' + Math.round(r.width) + 'x' + Math.round(r.height) + ': ' + ((el.className || el.tagName) + ' ' + (el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 20))); }
  return [...new Set(out)].slice(0, 14);
})()"""
DEVICES = [('iphone-se1', 'iPhone SE', None), ('iphone-se', 'iPhone SE (3rd gen)', None), ('iphone-14', 'iPhone 14', None), ('iphone-15pm', 'iPhone 15 Pro Max', None), ('pixel-7', 'Pixel 7', None),
           ('galaxy-s8', 'Galaxy S8', None), ('ipad-mini', 'iPad Mini', None), ('ipad-mini-land', 'iPad Mini landscape', None), ('desktop', None, (1280, 800))]
SCENES = [('hub', "profile.current=null; puzMode=null; lessonOpen=null; go('play')"), ('home', "go('home')"), ('game', "profile.current=null; startBotGame(1,'w',false,'0+0'); go('play')"),
          ('lesson', "lessonOpen=LESSONS[2]; lessonStep=0; go('learn')"), ('puzzle', "puzMode='daily'; go('puzzles')")]
report = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for key, dname, size in DEVICES:
        if dname and dname not in p.devices: print('no descriptor', dname); continue
        opts = dict(p.devices[dname]) if dname else {'viewport': {'width': size[0], 'height': size[1]}}
        opts.pop('default_browser_type', None)
        ctx = b.new_context(**opts); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(1800)
        pg.evaluate("document.querySelectorAll('.modal-bg,.splash').forEach(x=>x.remove())")
        vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
        for safe in (False, True):
            if safe: pg.add_style_tag(content=SAFE)
            for sname, js in SCENES:
                for rot in ((False, True) if not safe else (False,)):
                    if rot: pg.set_viewport_size({'width': vh, 'height': vw}); pg.wait_for_timeout(500)
                    pg.evaluate("document.querySelectorAll('.modal-bg').forEach(x=>x.remove())"); pg.evaluate(js); pg.wait_for_timeout(900)
                    tag = f"{key}-{sname}{'-rot' if rot else ''}{'-safe' if safe else ''}"
                    iss = pg.evaluate(CHECK)
                    pg.screenshot(path=f'{OUT}/{tag}.png')
                    if iss: report[tag] = iss
                    if rot: pg.set_viewport_size({'width': vw, 'height': vh}); pg.wait_for_timeout(500)
        # rotate there and back on a focus screen: the layout must come back exactly
        pg.evaluate("profile.current=null; startBotGame(1,'w',false,'0+0'); go('play')"); pg.wait_for_timeout(700)
        before = pg.evaluate("JSON.stringify(document.querySelector('.fs-stage .board-wrap, .fs-stage').getBoundingClientRect())")
        pg.set_viewport_size({'width': vh, 'height': vw}); pg.wait_for_timeout(400); pg.set_viewport_size({'width': vw, 'height': vh}); pg.wait_for_timeout(600)
        after = pg.evaluate("JSON.stringify(document.querySelector('.fs-stage .board-wrap, .fs-stage').getBoundingClientRect())")
        if before != after: report.setdefault(key + '-rotate-back', []).append('board moved after rotate and back: ' + before + ' -> ' + after)
        # keyboard: focus a text field (friend code), the page must not zoom or scroll sideways
        pg.evaluate("profile.current=null; friendView='online'; go('friend')"); pg.wait_for_timeout(600)
        inp = pg.query_selector('#app input')
        if inp:
            fsz = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#app input')).fontSize)")
            if fsz < 16: report.setdefault(key + '-input', []).append('input font-size < 16px (iOS zooms): ' + str(fsz))
            inp.tap(); pg.wait_for_timeout(300); iss = pg.evaluate(CHECK)
            if iss: report[key + '-input'] = report.get(key + '-input', []) + iss
        if errs: report.setdefault(key, []).extend(['JS ERROR ' + e for e in errs])
        ctx.close()
    b.close()
json.dump(report, open(f'{OUT}/report.json', 'w'), indent=1)
for k, v in report.items(): print(k, v)
print(len(report), 'scenes with issues; screenshots in', OUT)
