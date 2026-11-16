# First-load performance on a mid-range phone: python3 tools/qa/perf.py [runs]
# Chrome with 4x CPU slowdown (CDP) and a "fast 4G" network, cold cache. Reports when the HTML arrived,
# script evaluation, first contentful paint and when the clubhouse is interactive (#app has content
# and the main thread is idle), plus the biggest long tasks.
import sys, json, gzip, os
from playwright.sync_api import sync_playwright
RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 3
URL = os.environ.get('KC_URL', 'http://localhost:8000/index.html')
raw = open(os.path.join(os.path.dirname(__file__), '..', '..', 'index.html'), 'rb').read()
print(f'index.html {len(raw) / 1024:.0f} KB, gzip {len(gzip.compress(raw, 9)) / 1024:.0f} KB')
res = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for i in range(RUNS):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
        pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 60, 'downloadThroughput': 9 * 1024 * 1024 / 8, 'uploadThroughput': 1.5 * 1024 * 1024 / 8})
        pg.add_init_script("""window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())__lt.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true});
          try{sessionStorage.setItem('kc-splash','1')}catch(e){}""")
        pg.goto(URL, wait_until='load')
        pg.wait_for_function("document.querySelector('#app') && document.querySelector('#app').children.length > 0", timeout=30000)
        pg.wait_for_timeout(2500)
        m = pg.evaluate("""(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = (performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime;
          const lt = __lt.slice().sort((a,b)=>b[1]-a[1]); const lastLong = __lt.reduce((m,[s,d])=>Math.max(m,s+d),0);
          return { ttfb: Math.round(n.responseStart), html: Math.round(n.responseEnd), domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd),
                   fcp: Math.round(fcp||0), tti: Math.max(Math.round(n.domContentLoadedEventEnd), lastLong), longTasks: lt.slice(0,5), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null }; })()""")
        res.append(m); print(json.dumps(m))
        ctx.close()
    b.close()
keys = ['html', 'domInteractive', 'fcp', 'dcl', 'load', 'tti']
print('median:', {k: sorted(r[k] for r in res)[len(res) // 2] for k in keys})
