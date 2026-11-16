// Maximum-likelihood Elo fit (Bradley-Terry with draws counted as half wins) from calibration games.
const R = require('../data/calib_results.json');
const { BOT_LEVELS } = require('../src/bots.js');
const L = BOT_LEVELS.length;
let r = new Array(L).fill(0);
const sc = res => res === '1-0' ? 1 : res === '0-1' ? 0 : 0.5;
for (let it = 0; it < 5000; it++) {
  const grad = new Array(L).fill(0);
  for (const g of R) {
    const e = 1 / (1 + Math.pow(10, (r[g.b] - r[g.w]) / 400)), s = sc(g.res);
    grad[g.w] += s - e; grad[g.b] -= s - e;
  }
  for (let i = 1; i < L; i++) r[i] += grad[i] * 2; // level 0 fixed as anchor
}
const pairs = {};
for (const g of R) { const k = Math.min(g.w, g.b) + '-' + Math.max(g.w, g.b); pairs[k] = pairs[k] || [0, 0, 0]; const s = sc(g.res); const lowWhite = g.w < g.b; const lowScore = lowWhite ? s : 1 - s; pairs[k][0] += lowScore; pairs[k][1]++; if (s === 0.5) pairs[k][2]++; }
console.log('pair: weaker-bot score / games (draws)'); for (const k in pairs) console.log(k, pairs[k][0] + '/' + pairs[k][1], '(' + pairs[k][2] + ')');
console.log('raw diffs from Pip:', r.map(x => Math.round(x)));
require('fs').writeFileSync(__dirname + '/../data/elo_raw.json', JSON.stringify(r));
