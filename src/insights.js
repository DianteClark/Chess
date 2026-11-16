// Insights: what your games and reviews say about your play, with suggestions for what to practice.
'use strict';
function bar(label, val, max = 100, color = 'var(--accent)', suffix = '%') {
  return h('div', { class: 'ibar' }, h('div', { class: 'il' }, label), h('div', { class: 'it' }, h('div', { style: { width: Math.max(2, Math.min(100, val / max * 100)) + '%', background: color } })), h('div', { class: 'iv' }, val == null ? '-' : Math.round(val) + suffix));
}
function renderInsights(main) {
  main.append(h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { meView = null; render(); } }, icon('back', 18), 'Me'), h('h2', { class: 'grow' }, 'Insights')));
  const revs = (profile.reviews || []).slice(0, 40), games = profile.games || [];
  if (!revs.length && games.length < 3) {
    main.append(h('div', { class: 'card stack center' }, hoot(64), h('b', null, 'Not enough games yet'), h('p', { class: 'muted small' }, 'Play a few games and tap Review afterwards. Insights will show your accuracy trend, strongest and weakest phases, favorite openings and the mistakes you make most often.')));
    return;
  }
  // accuracy trend
  if (revs.length) {
    const accs = revs.slice().reverse().map(r => r.acc || 0);
    const avg = accs.reduce((a, b) => a + b, 0) / accs.length;
    const last5 = accs.slice(-5), avg5 = last5.reduce((a, b) => a + b, 0) / last5.length;
    main.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Accuracy'), h('span', { class: 'pill' }, `Average ${Math.round(avg)}%`), h('span', { class: 'pill ' + (avg5 >= avg ? 'live' : '') }, `Last 5: ${Math.round(avg5)}%`)), sparkline(accs, '#4fd18b', 'Review one more game to see your trend.'), h('div', { class: 'small muted' }, `From ${revs.length} reviewed game${revs.length > 1 ? 's' : ''}.`)));
    // phases
    const ph = { opening: [], middlegame: [], endgame: [] };
    revs.forEach(r => { for (const k in ph) if (r.phase && r.phase[k] != null) ph[k].push(r.phase[k]); });
    const pa = k => ph[k].length ? ph[k].reduce((a, b) => a + b, 0) / ph[k].length : null;
    const phases = [['Opening', pa('opening')], ['Middlegame', pa('middlegame')], ['Endgame', pa('endgame')]];
    main.append(h('div', { class: 'card stack' }, h('b', null, 'Accuracy by game phase'), phases.map(([n, v]) => bar(n, v, 100, v == null ? 'var(--line)' : v >= 80 ? 'var(--good)' : v >= 65 ? 'var(--accent)' : 'var(--bad)'))));
    // mistakes
    const sum = k => revs.reduce((a, r) => a + ((r.cnt || {})[k] || 0), 0), moves = revs.reduce((a, r) => a + Math.ceil((r.moves || 0) / 2), 0) || 1;
    const per = n => (n / moves * 10).toFixed(1);
    const hangs = revs.reduce((a, r) => a + (r.hangs || 0), 0), missed = revs.reduce((a, r) => a + (r.missed || 0), 0);
    main.append(h('div', { class: 'card stack' }, h('b', null, 'Move quality'),
      h('div', { class: 'qgrid' }, ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder'].map(k => h('div', { class: 'q' }, classBadge(k, 22), h('b', null, sum(k)), h('small', null, CLASSES[k].label)))),
      h('div', { class: 'small muted' }, `About ${per(sum('mistake') + sum('blunder'))} mistakes or blunders per 10 moves. Pieces left hanging: ${hangs}. Missed chances to win material: ${missed}.`)));
    // biggest weakness -> suggestion
    const sugg = [];
    const weakest = phases.filter(p => p[1] != null).sort((a, b) => a[1] - b[1])[0];
    if (hangs >= 2) sugg.push(['Protect your pieces', 'You often leave pieces undefended. Before every move, ask: "Is the piece I am moving safe there?"', () => { puzCat = 't:hangingPiece'; puzState = null; go('puzzles'); }]);
    if (missed >= 2) sugg.push(['Spot free material', 'You miss chances to win pieces. Themed tactics puzzles train exactly this.', () => { puzCat = 'rated'; puzState = null; go('puzzles'); }]);
    if (weakest && weakest[1] < 75) sugg.push([`Work on your ${weakest[0].toLowerCase()}`, weakest[0] === 'Opening' ? 'The opening course teaches the ideas behind the first moves.' : weakest[0] === 'Endgame' ? 'The endgame course turns winning positions into wins.' : 'Puzzle Rush builds the quick tactical vision the middlegame needs.', () => weakest[0] === 'Middlegame' ? (puzMode = 'rush', rush = { phase: 'menu' }, go('puzzles')) : go('learn')]);
    if (!sugg.length) sugg.push(['Keep climbing', 'Your play is balanced. Challenge a stronger bot in the Bot League!', () => go('play')]);
    main.append(h('div', { class: 'card stack' }, h('b', null, 'What to practice next'), sugg.map(([t, d, fn]) => h('button', { class: 'lesson', onclick: fn }, h('div', { class: 'ic dark' }, icon('target', 22)), h('div', null, h('div', { class: 't' }, t), h('div', { class: 'd' }, d)), h('span', { class: 'ck' }, icon('next', 20))))));
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
  main.append(h('div', { class: 'card stack' }, h('b', null, 'Score by color'),
    bar('As White', rate(byColor.w), 100, '#f3efe4'), bar('As Black', rate(byColor.b), 100, '#8a8496'),
    h('div', { class: 'small muted' }, `White: ${byColor.w[0]}W ${byColor.w[1]}D ${byColor.w[2]}L · Black: ${byColor.b[0]}W ${byColor.b[1]}D ${byColor.b[2]}L`)));
  const ops = Object.entries(byOpening).sort((a, b) => (b[1][0] + b[1][1] + b[1][2]) - (a[1][0] + a[1][1] + a[1][2])).slice(0, 6);
  if (ops.length) main.append(h('div', { class: 'card stack' }, h('b', null, 'Your openings'), ops.map(([n, a]) => bar(`${n} (${a[0] + a[1] + a[2]})`, rate(a), 100, 'var(--blue)'))));
}
