// Insights (Me > Stats): what your games and reviews say about your play, with suggestions for what to practice.
'use strict';
function bar(label, val, max = 100, color = 'var(--accent)', suffix = '%') {
  return h('div', { class: 'ibar' }, h('div', { class: 'il' }, label), h('div', { class: 'it' }, h('div', { style: { width: Math.max(2, Math.min(100, val / max * 100)) + '%', background: color } })), h('div', { class: 'iv' }, val == null ? '-' : Math.round(val) + suffix));
}
const insAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function renderInsights(main) {
  const revs = (profile.reviews || []).slice(0, 40), games = profile.games || [];
  // headline tiles
  const scored = games.filter(g => g.score != null), won = scored.filter(g => g.score === 1).length;
  const winRate = scored.length ? (won + scored.filter(g => g.score === 0.5).length * 0.5) / scored.length * 100 : null;
  const avgAcc = insAvg(revs.map(r => r.acc || 0));
  const kpi = (ic, val, label, tone) => h('div', { class: 'ins-kpi ' + (tone || '') }, h('div', { class: 'ins-kpi-ic' }, icon(ic, 17)), h('b', null, val), h('small', null, label));
  main.append(h('div', { class: 'ins-kpis' },
    kpi('play', String(games.length), 'Games', ''), kpi('trophy', winRate == null ? '-' : Math.round(winRate) + '%', 'Score', 'gold'),
    kpi('target', avgAcc == null ? '-' : Math.round(avgAcc) + '%', 'Accuracy', 'green'), kpi('search', String(revs.length), 'Reviewed', 'blue')));
  if (!revs.length && games.length < 3) {
    main.append(h('div', { class: 'card ins-empty' }, hoot(56), h('div', null, h('b', null, 'Not enough games yet'), h('p', { class: 'muted small' }, 'Play a few games and tap Review afterwards. Insights will show your accuracy trend, strongest and weakest phases, favorite openings and the mistakes you make most often.'))));
  }
  if (revs.length) {
    // accuracy trend
    const accs = revs.slice().reverse().map(r => r.acc || 0);
    const avg = insAvg(accs), avg5 = insAvg(accs.slice(-5));
    main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', { class: 'grow' }, 'Accuracy'), h('span', { class: 'pill' }, `Average ${Math.round(avg)}%`), h('span', { class: 'pill ' + (avg5 >= avg ? 'live' : '') }, `Last 5: ${Math.round(avg5)}%`)),
      sparkline(accs, '#93dc98', 'Review one more game to see your trend.'), h('div', { class: 'small muted' }, (revs.length > 1 ? `From ${revs.length} reviewed games.` : `From ${revs.length} reviewed game.`))));
    // phases
    const ph = { opening: [], middlegame: [], endgame: [] };
    revs.forEach(r => { for (const k in ph) if (r.phase && r.phase[k] != null) ph[k].push(r.phase[k]); });
    const pa = k => insAvg(ph[k]);
    const phases = [['Opening', pa('opening')], ['Middlegame', pa('middlegame')], ['Endgame', pa('endgame')]];
    main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Accuracy by game phase')), phases.map(([n, v]) => bar(n, v, 100, v == null ? 'var(--line)' : v >= 80 ? 'var(--good)' : v >= 65 ? 'var(--accent)' : 'var(--bad)'))));
    // mistakes
    const sum = k => revs.reduce((a, r) => a + ((r.cnt || {})[k] || 0), 0), moves = revs.reduce((a, r) => a + Math.ceil((r.moves || 0) / 2), 0) || 1;
    const per = n => (n / moves * 10).toFixed(1);
    const hangs = revs.reduce((a, r) => a + (r.hangs || 0), 0), missed = revs.reduce((a, r) => a + (r.missed || 0), 0);
    main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Move quality')),
      h('div', { class: 'qgrid ins-q' }, ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder'].map(k => h('div', { class: 'q' }, classBadge(k, 20), h('b', null, sum(k)), h('small', null, CLASSES[k].label)))),
      h('div', { class: 'small muted' }, `About ${per(sum('mistake') + sum('blunder'))} mistakes or blunders per 10 moves. Pieces left hanging: ${hangs}. Missed chances to win material: ${missed}.`)));
    // biggest weakness -> suggestion
    const sugg = [];
    const weakest = phases.filter(p => p[1] != null).sort((a, b) => a[1] - b[1])[0];
    if (hangs >= 2) sugg.push(['Protect your pieces', 'You often leave pieces undefended. Before every move, ask: "Is the piece I am moving safe there?"', () => { puzCat = 't:hangingPiece'; puzState = null; go('puzzles'); }]);
    if (missed >= 2) sugg.push(['Spot free material', 'You miss chances to win pieces. Themed tactics puzzles train exactly this.', () => { puzCat = 'rated'; puzState = null; go('puzzles'); }]);
    if (weakest && weakest[1] < 75) sugg.push([`Work on your ${weakest[0].toLowerCase()}`, weakest[0] === 'Opening' ? 'The opening course teaches the ideas behind the first moves.' : weakest[0] === 'Endgame' ? 'The endgame course turns winning positions into wins.' : 'Puzzle Rush builds the quick tactical vision the middlegame needs.', () => weakest[0] === 'Middlegame' ? (puzMode = 'rush', rush = { phase: 'menu' }, go('puzzles')) : go('learn')]);
    if (!sugg.length) sugg.push(['Keep climbing', 'Your play is balanced. Challenge a stronger bot in the Bot League!', () => go('play')]);
    main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'What to practice next')), sugg.map(([t, d, fn]) => h('button', { class: 'lesson', onclick: fn }, h('div', { class: 'ic dark' }, icon('target', 22)), h('div', null, h('div', { class: 't' }, t), h('div', { class: 'd' }, d)), h('span', { class: 'ck' }, icon('next', 20))))));
  }
  // results by color and opening (from game history)
  const byColor = { w: [0, 0, 0], b: [0, 0, 0] };
  const byOpening = {};
  games.forEach(g => {
    if (!g.color) return; const k = g.score === 1 ? 0 : g.score === .5 ? 1 : 2; byColor[g.color][k]++;
    const op = g.moves ? (openingName(g.moves) || 'Other openings') : null;
    if (op) { byOpening[op] = byOpening[op] || [0, 0, 0]; byOpening[op][k]++; }
  });
  const rate = a => { const n = a[0] + a[1] + a[2]; return n ? (a[0] + a[1] * .5) / n * 100 : null; };
  if (games.some(g => g.color)) {
    const side = (c, label) => {
      const a = byColor[c], n = a[0] + a[1] + a[2], r = rate(a);
      return h('div', { class: 'ins-side ' + c }, h('div', { class: 'ins-side-h' }, h('span', { class: 'ins-king' }, pieceImg(c + 'k', 22)), h('small', null, label)), h('b', null, r == null ? '-' : Math.round(r) + '%'),
        h('div', { class: 'ins-wdl' }, n ? [[a[0], 'w'], [a[1], 'd'], [a[2], 'l']].map(([v, k]) => v ? h('i', { class: k, style: { flexGrow: v } }) : null) : h('i', { class: 'none' })),
        h('small', { class: 'ins-wdl-t' }, `${a[0]}W ${a[1]}D ${a[2]}L`));
    };
    main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Score by color')), h('div', { class: 'ins-sides' }, side('w', 'As White'), side('b', 'As Black'))));
  }
  const ops = Object.entries(byOpening).sort((a, b) => (b[1][0] + b[1][1] + b[1][2]) - (a[1][0] + a[1][1] + a[1][2])).slice(0, 6);
  if (ops.length) main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Your openings')), ops.map(([n, a]) => bar(`${n} (${a[0] + a[1] + a[2]})`, rate(a), 100, 'var(--blue)'))));
  if (games.length) main.append(insRecentGames(games));
}
// recent games: result chip, opponent, rating change; tap one to open it in Game Review
function insRecentGames(games) {
  const byKey = {}; (profile.reviews || []).forEach(r => { if (r.key) byKey[r.key] = r; });
  const list = h('div', { class: 'ins-games' });
  let shown = 6;
  const row = g => {
    const res = g.score === 1 ? 'w' : g.score === 0.5 ? 'd' : 'l';
    const bot = !g.online && typeof BOTS !== 'undefined' ? BOTS.find(b => b.name === g.opp) : null;
    const rv = g.moves ? byKey[g.moves.join('')] : null;
    const dr = g.rated && g.after != null && g.before != null ? g.after - g.before : null;
    const open = () => { beep('open'); openReview({ startFen: g.startFen, moves: g.moves, color: g.color || null, white: g.color === 'b' ? g.opp : (profile.name || 'You'), black: g.color === 'b' ? (profile.name || 'You') : g.opp }); };
    return h(g.moves ? 'button' : 'div', { class: 'ins-g' + (g.moves ? ' tap' : ''), onclick: g.moves ? open : null },
      h('span', { class: 'ins-res ' + res }, res === 'w' ? 'Win' : res === 'd' ? 'Draw' : 'Loss'),
      h('div', { class: 'ins-opp' }, bot ? avatar(bot.avatar, 30) : h('span', { class: 'ins-oic' }, icon(g.online ? 'globe' : 'user', 16)),
        h('div', { class: 'grow' }, h('b', { class: 'no-i18n' }, g.opp || ''), h('small', null, g.reason || ''))),
      rv && rv.acc != null ? h('span', { class: 'ins-acc' }, `${Math.round(rv.acc)}%`) : null,
      h('span', { class: 'ins-dr ' + (dr == null ? '' : dr >= 0 ? 'up' : 'dn') }, dr == null ? 'casual' : (dr >= 0 ? '+' : '') + dr),
      g.moves ? h('span', { class: 'ins-go' }, icon('next', 16)) : null);
  };
  const draw = () => {
    list.innerHTML = '';
    list.append(...games.slice(0, shown).map(row));
    if (games.length > shown) list.append(h('button', { class: 'btn ghost block small', onclick: () => { shown = games.length; beep('tap'); draw(); } }, `Show all ${games.length} games`));
  };
  draw();
  return h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', { class: 'grow' }, 'Recent games'), h('small', { class: 'muted' }, 'Tap a game to review it')), list);
}
