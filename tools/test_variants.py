# Headless-Chrome test for World Games (vendor/fairy/test.html): the ffish rules library and the
# Fairy-Stockfish worker engine must load on a plain static server (no COOP/COEP headers, so no
# SharedArrayBuffer) and return legal moves for every game at levels 1 and 8.
# Run from the repository root:  python3 tools/test_variants.py
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8010
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://localhost:{PORT}/vendor/fairy/test.html')
        pg.wait_for_function('window.testResult !== null', timeout=180000)
        r = pg.evaluate('window.testResult')
        b.close()
finally:
    srv.terminate()
if 'error' in r:
    print('ERROR', r['error']); sys.exit(1)
print(f"crossOriginIsolated={r['crossOriginIsolated']}  ffish load {r['loadMs']} ms  engine load {r['engineLoadMs']} ms")
for row in r['rows']:
    print(f"  {row['id']:14} L1 {row['L1']['uci']:7} {row['L1']['ms']:5} ms | L8 {row['L8']['uci']:7} d{row['L8']['depth']:<3} {row['L8']['ms']:5} ms | analysis d10 x3 {row['analysis']['ms']:5} ms  {'PASS' if row['pass'] else 'FAIL'}")
if errors: print('page errors:', errors)
print('failures:', r['fails'])
sys.exit(1 if r['fails'] or errors else 0)
