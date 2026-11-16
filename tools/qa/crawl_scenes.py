# Visit every scene at iPhone size, screenshot top and bottom, and flag layout problems:
#  - controls hidden under the dock when scrolled to the bottom
#  - anything wider than the screen
#  - text clipped inside its box
# Usage: python3 crawl.py [lang] [filter]
import sys, json, os
from playwright.sync_api import sync_playwright
LANG = sys.argv[1] if len(sys.argv) > 1 else 'en'
FILT = sys.argv[2] if len(sys.argv) > 2 else ''
VW, VH = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (390, 844)
OUT = f'/tmp/crawl/{LANG}' + ('' if VW == 390 else f'-{VW}'); os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
CHECK = r"""(() => {
  const issues = [];
  const vw = innerWidth, vh = innerHeight;
  const dock = document.querySelector('.tabs .inner'), medal = document.querySelector('.tabs .medal .disc');
  const dockTop = (dock && !document.body.classList.contains('focus')) ? Math.min(dock.getBoundingClientRect().top, medal ? medal.getBoundingClientRect().top + 10 : 1e9) : vh;
  if (document.documentElement.scrollWidth > vw + 1) issues.push('page wider than screen: ' + document.documentElement.scrollWidth);
  if (document.body.classList.contains('focus') && document.documentElement.scrollHeight > vh + 1) issues.push('focus screen scrolls: ' + document.documentElement.scrollHeight);
  const vis = el => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && el.offsetParent !== null; };
  const name = el => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"';
  if (document.body.classList.contains('focus')) for (const el of document.querySelectorAll('.fs button, .fs .board-wrap, .fs .vboard-wrap')) { const r = el.getBoundingClientRect(); if (r.height && (r.bottom > vh + 1 || r.top < -1)) issues.push('outside the screen: ' + name(el)); }
  for (const el of document.querySelectorAll('#app button, #app a, #app input, #app select, #app .card, #app .board-wrap, #app .vboard-wrap, .modal button')) {
    if (!vis(el) || el.closest('.tabs')) continue;
    let sc = el.parentElement, inScroller = false; while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowX; if (o === 'auto' || o === 'scroll') { inScroller = true; break; } sc = sc.parentElement; } if (inScroller) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (r.right > vw + 1 || r.left < -1) issues.push('off screen sideways: ' + name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (!el.closest('.modal') && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT') && r.bottom > dockTop + 2 && r.top < vh) issues.push('under dock at bottom: ' + name(el));
  }
  for (const el of document.querySelectorAll('#app *, .modal *')) {
    if (!vis(el) || !el.childNodes.length) continue;
    const s = getComputedStyle(el);
    if ((s.overflow === 'hidden' || s.overflowX === 'hidden' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2 && el.textContent.trim() && !el.querySelector('svg,img,canvas') && el.clientWidth > 0)
      issues.push('text clipped: ' + name(el));
  }
  { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.nodeValue.trim(); const el = n.parentElement; if (!t || !el || el.closest('script,style') || !vis(el)) continue;
      if (/\bundefined\b|\bnull\b|\bNaN\b|\[object|^[a-z]+[-_][a-z0-9_-]+$|\b(pip|bea|milo|rosa|vera|tower) [A-Z]/.test(t)) issues.push('raw value shown: ' + t.slice(0, 60)); } }
  return [...new Set(issues)].slice(0, 12);
})()"""
SCENES = []
def S(name, js, wait=500, click=None): SCENES.append((name, js, wait, click))
S('home', "go('home')")
S('play', "go('play')")
S('play-game', "playSel.rated=false; startBotGame(0,'w',false,'0+0'); go('play')", 1200)
S('play-game-clock', "profile.current=null; startBotGame(2,'b',true,'180+2'); go('play')", 2500)
S('friend-menu', "profile.current=null; friendView='menu'; go('friend')")
S('friend-local', "friendView='local'; go('friend')", 800)
S('friend-online', "friendView='online'; go('friend')")
S('friend-world', "friendView='world'; lobbyView='home'; go('friend')", 1500)
S('friend-leaderboard', "friendView='world'; lobbyView='leaderboard'; go('friend')", 1200)
S('puzzles', "friendView='menu'; puzMode=null; go('puzzles')", 800)
S('puzzles-daily', "puzMode='daily'; go('puzzles')", 800)
S('puzzles-rush', "puzMode='rush'; go('puzzles')", 800)
S('learn', "puzMode=null; lessonOpen=null; courseOpen=null; go('learn')")
for i in range(17): S(f'kids-lesson-{i}', f"lessonOpen=LESSONS[{i}]; lessonStep=0; go('learn')", 500)
for i in range(3): S(f'course-{i}', f"lessonOpen=null; courseOpen=COURSES[{i}]; go('learn')")
S('course-lesson', "courseOpen=COURSES[0]; lessonOpen=Object.assign({course:COURSES[0]},COURSES[0].lessons[0]); lessonStep=1; go('learn')", 700)
S('me', "lessonOpen=null; courseOpen=null; meView=null; go('me')")
S('me-style', "meView='style'; go('me')")
S('me-insights', "meView='insights'; go('me')", 800)
S('analysis', "meView=null; openAnalysis({moves:['e4','e5','Nf3','Nc6']})", 2500)
S('review', "openReview({moves:['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7'], color:'b', white:'Milo', black:'You'})", 30000)
S('lesson-complete', "lessonOpen=LESSONS[0]; lessonStep=LESSONS[0].steps.length-1; go('learn'); setTimeout(()=>{const b=document.querySelector('.fs-btn.primary'); b.disabled=false; b.click()},200)", 1200)
S('whatsnew', "go('home'); whatsNew(true)", 700)
S('levelup', "document.querySelectorAll('.modal-bg').forEach(x=>x.remove()); celebrateLevel(5)", 900)
S('arena-courses', "learnTab='courses'; go('learn')")
S('me-trophies', "meView='trophies'; go('me')", 800)
S('me-settings', "meView='settings'; go('me')", 800)
S('world', "document.querySelectorAll('.modal-bg,.celebrate').forEach(x=>x.remove()); worldView=null; go('world')", 800)
WG = ['xiangqi','shogi','janggi','makruk','sittuyin','shatranj','crazyhouse','3check','kingofthehill','atomic','horde','antichess']
for g in WG: S(f'wpage-{g}', f"route='world'; worldView={{g:'{g}'}}; render()", 400)
for g in WG:
    for st in (['eng','trad'] if g in WG[:6] else ['eng']):
        S(f'wgame-{g}-{st}', f"worldPrefs().style='{st}'; route='world'; startWorldGame('{g}',{{bot:1,color:'w'}})", 1500)
S('wgame-local', "route='world'; startWorldGame('shogi',{local:true})", 1200)
S('wreview', "route='world'; startWorldGame('xiangqi',{local:true}); ['h3e3','h10g8','h1g3','i10h10'].forEach(m=>{const g=new VGame('xiangqi'); worldCur.moves.forEach(x=>g.play(x)); const r=g.play(m); worldCur.moves.push(m); worldCur.sans.push(r.san)}); worldCur.over={result:'1-0',reason:'resign'}; render(); setTimeout(()=>worldReview(new VGame('xiangqi'),worldCur),300)", 6000)
S('wresult', "route='world'; startWorldGame('xiangqi',{bot:3,color:'w'}); setTimeout(()=>showWorldResult(worldCur,1,'Red wins (checkmate)',()=>{}),400)", 1200)
SCENES_W = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8000/index.html')
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('kc-lang','{LANG}')"); pg.reload(); pg.wait_for_timeout(2200)
    pg.evaluate("document.querySelectorAll('.modal-bg').forEach(x=>x.remove()); Variants.ready()"); pg.wait_for_timeout(1200)
    # world lessons: every step
    steps = pg.evaluate("Object.entries(WORLD_COURSES).flatMap(([id,c])=>c.lessons.flatMap((l,li)=>l.steps.map((s,si)=>[id,li,si])))")
    for id, li, si in steps: S(f'wl-{id}-{li}-{si}', f"route='world'; worldView={{g:'{id}', lesson: WORLD_COURSES['{id}'].lessons[{li}], step:{si}}}; render()", 250)
    report = {}
    LATIN = r"""(() => { const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const t = n.nodeValue.trim(); const el = n.parentElement; if (!t || !el || el.closest('script,style,svg,.no-i18n,.moves,.vmoves,.pgn')) continue;
        if (/[A-Za-z]{3,}/.test(t) && !/^(Knight Club|Pip|Bea|Milo|Rosa|Bo|Vera|Sir Knight|Bishop Bo|Queen Vera|The Tower|Stockfish.*|Chess960|Elo|XP|Glicko.*|Hoot)$/.test(t)) out.add(t.slice(0, 80)); }
      return [...out]; })()"""
    untranslated = {}
    for name, js, wait, click in SCENES:
        if FILT and FILT not in name: continue
        try:
            pg.evaluate("document.querySelectorAll('.modal-bg,.kx-ov').forEach(x=>x.remove()); window.scrollTo(0,0)")
            pg.evaluate(js); pg.wait_for_timeout(wait)
            pg.screenshot(path=f'{OUT}/{name}-a.png')
            h = pg.evaluate('document.documentElement.scrollHeight')
            pg.evaluate('window.scrollTo(0, 1e6)'); pg.wait_for_timeout(250)
            iss = pg.evaluate(CHECK)
            if h > VH + 16: pg.screenshot(path=f'{OUT}/{name}-b.png')
            if iss: report[name] = iss
            if LANG != 'en':
                for t in pg.evaluate(LATIN): untranslated.setdefault(t, name)
        except Exception as e:
            report[name] = ['CRAWL ERROR ' + str(e)[:200]]
        if errs: report.setdefault(name, []).extend(['JS ERROR ' + x[:200] for x in errs]); errs.clear()
    json.dump(report, open(f'{OUT}/report.json', 'w'), indent=1)
    json.dump(untranslated, open(f'{OUT}/untranslated.json', 'w'), indent=1, ensure_ascii=False)
    print('untranslated texts:', len(untranslated))
    print(len(SCENES), 'scenes;', len(report), 'with issues')
    for k, v in report.items(): print(k, v)
    b.close()
