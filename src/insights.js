// Insights (Me > Stats): two views.
//  Overview: rating graphs (Bot League, Online, Puzzles) with ranges, win/draw/loss donuts, records,
//            favorite openings, and what your reviews say about your play.
//  Games:    the archive of finished games (profile.games) with filters; tap one for its final position,
//            Review and Analyze. Game records may carry: t, opp, oppR, oppAvatar, color, score, reason, rated,
//            before, after, moves, startFen, tc, mode ('bot'|'friend'|'local'|'online'|'world'), variant, opening.
'use strict';
function bar(label, val, max = 100, color = 'var(--accent)', suffix = '%') {
  return h('div', { class: 'ibar' }, h('div', { class: 'il' }, label), h('div', { class: 'it' }, h('div', { style: { width: Math.max(2, Math.min(100, val / max * 100)) + '%', background: color } })), h('div', { class: 'iv' }, val == null ? '-' : Math.round(val) + suffix));
}
const insAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
let insView = 'overview', insRating = 'bot', insRange = '50', insFilter = 'all';
function renderInsights(main) {
  const games = profile.games || [];
  const seg = h('div', { class: 'seg ins-seg' }, [['overview', 'Overview'], ['games', `Games (${games.length})`]].map(([v, l]) => h('button', { class: insView === v ? 'on' : '', onclick: () => { if (insView === v) return; insView = v; beep('tap'); haptic(5); main.innerHTML = ''; renderInsights(main); } }, l)));
  main.append(seg);
  if (insView === 'games') { main.append(insArchive(games)); return; }
  const revs = (profile.reviews || []).slice(0, 40);
  // headline tiles
  const scored = games.filter(g => g.score != null), won = scored.filter(g => g.score === 1).length;
  const winRate = scored.length ? (won + scored.filter(g => g.score === 0.5).length * 0.5) / scored.length * 100 : null;
  const avgAcc = insAvg(revs.map(r => r.acc || 0));
  const kpi = (ic, val, label, tone) => h('div', { class: 'ins-kpi ' + (tone || '') }, h('div', { class: 'ins-kpi-ic' }, icon(ic, 17)), h('b', null, val), h('small', null, label));
  main.append(h('div', { class: 'ins-kpis' },
    kpi('play', String(games.length), 'Games', ''), kpi('trophy', winRate == null ? '-' : Math.round(winRate) + '%', 'Score', 'gold'),
    kpi('target', avgAcc == null ? '-' : Math.round(avgAcc) + '%', 'Accuracy', 'green'), kpi('search', String(revs.length), 'Reviewed', 'blue')));
  main.append(insRatingCard(), insResultsCard(games), insRecordsCard(games));
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
  if (ops.length) main.append(h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Favorite openings')), ops.map(([n, a]) => bar(`${n} (${a[0] + a[1] + a[2]})`, rate(a), 100, 'var(--blue)'))));
}
// ---------- rating graph ----------
function insRatingCard() {
  const card = h('div', { class: 'card ins-card ins-rating' });
  const draw = () => {
    card.innerHTML = '';
    const defs = { bot: ['Bot League', profile.rHist || [], '#ffc56b'], online: ['Online', profile.hHist || [], '#93dc98'], puzzle: ['Puzzles', profile.pHist || [], '#9ccfff'] };
    const [, all, color] = defs[insRating];
    const data = insRange === 'all' ? all.slice() : all.slice(-(+insRange + 1));
    const kinds = h('div', { class: 'seg ins-rk' }, [['bot', 'Bot League'], ['online', 'Online'], ['puzzle', 'Puzzles']].map(([k, l]) => h('button', { class: insRating === k ? 'on' : '', onclick: () => { insRating = k; beep('tap'); draw(); } }, l)));
    const ranges = h('div', { class: 'ins-rr' }, [['10', 'Last 10'], ['50', 'Last 50'], ['all', 'All']].map(([k, l]) => h('button', { class: insRange === k ? 'on' : '', onclick: () => { insRange = k; beep('tap'); draw(); } }, l)));
    const now = all.length ? Math.round(all[all.length - 1]) : null, peak = all.length ? Math.round(Math.max(...all)) : null;
    const ch = data.length > 1 ? Math.round(data[data.length - 1] - data[0]) : 0;
    card.append(kinds,
      h('div', { class: 'ins-rhead' }, h('div', null, h('small', null, 'Now'), h('b', { style: { color } }, now == null ? '-' : String(now))), h('div', null, h('small', null, 'Peak'), h('b', null, peak == null ? '-' : String(peak))),
        h('div', null, h('small', null, 'Change'), h('b', { class: ch > 0 ? 'up' : ch < 0 ? 'dn' : '' }, (ch > 0 ? '+' : '') + ch)), ranges),
      insChart(data, color, insRange === 'all' ? 0 : Math.max(0, all.length - data.length)));
  };
  draw(); return card;
}
// line chart with grid, peak marker and a finger scrub that shows each point
function insChart(data, color, offset = 0) {
  const W = 320, H = 132, padL = 34, padR = 8, padT = 10, padB = 18, wrap = h('div', { class: 'ins-chart' });
  if (data.length < 2) { wrap.append(h('div', { class: 'ins-chart-empty' }, icon('chart', 22), h('small', null, 'Play rated games to see your graph.'))); return wrap; }
  let min = Math.min(...data), max = Math.max(...data); const span0 = max - min; if (span0 < 40) { min -= (40 - span0) / 2; max += (40 - span0) / 2; }
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find(s => (max - min) / s <= 4) || 1000;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const X = i => padL + i / (data.length - 1) * (W - padL - padR), Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const pts = data.map((v, i) => [X(i), Y(v)]), line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const gid = 'ig' + Math.random().toString(36).slice(2, 7);
  let grid = ''; for (let v = lo; v <= hi + .1; v += step) grid += `<path d="M${padL} ${Y(v).toFixed(1)}H${W - padR}" stroke="rgba(247,239,221,.1)" stroke-width="1"/><text x="${padL - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(247,239,221,.55)" font-weight="700">${Math.round(v)}</text>`;
  const pk = data.indexOf(Math.max(...data)), last = pts[pts.length - 1];
  const svgEl = h('div', { class: 'ins-chart-svg', html: `<svg viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}
    <path d="${line}L${last[0].toFixed(1)} ${H - padB}L${padL} ${H - padB}Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M${pts[pk][0].toFixed(1)} ${(pts[pk][1] - 5).toFixed(1)}l-4 -6h8z" fill="var(--brass)"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="${color}" stroke="#14362a" stroke-width="2"/>
    <text x="${padL}" y="${H - 4}" font-size="10" fill="rgba(247,239,221,.45)" font-weight="700">${data.length - 1 === 1 ? '1 game' : (data.length - 1) + ' games'}</text>
    <g class="ins-scrub" style="display:none"><path d="M0 ${padT}V${H - padB}" stroke="rgba(247,239,221,.5)" stroke-width="1" stroke-dasharray="3 3"/><circle r="5" fill="#fff" stroke="${color}" stroke-width="2.5"/></g></svg>` });
  const tip = h('div', { class: 'ins-tip' });
  wrap.append(svgEl, tip);
  const svg = svgEl.querySelector('svg'), sc = svg.querySelector('.ins-scrub');
  const show = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(data.length - 1, Math.round((x - padL) / (W - padL - padR) * (data.length - 1))));
    sc.style.display = ''; sc.querySelector('path').setAttribute('transform', `translate(${pts[i][0]} 0)`); const c = sc.querySelector('circle'); c.setAttribute('cx', pts[i][0]); c.setAttribute('cy', pts[i][1]);
    tip.textContent = i + offset === 0 ? `Start: ${Math.round(data[i])}` : `Game ${i + offset}: ${Math.round(data[i])}`;
    tip.style.left = Math.max(8, Math.min(r.width - 8, pts[i][0] / W * r.width)) + 'px'; tip.classList.add('on');
  };
  const hide = () => { sc.style.display = 'none'; tip.classList.remove('on'); };
  svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
  svg.addEventListener('pointerup', () => setTimeout(hide, 900)); svg.addEventListener('pointerleave', hide);
  return wrap;
}
// ---------- results donuts ----------
function insDonut(w, d, l, size = 84) {
  const n = w + d + l, r = 15.9155, segs = [[w, 'var(--good)'], [d, '#c9c2b0'], [l, 'var(--bad)']];
  let at = 0, arcs = '';
  for (const [v, c] of segs) { if (!v) continue; const p = v / n * 100; arcs += `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${c}" stroke-width="4.2" stroke-dasharray="${Math.max(0, p - (n > v ? 1.2 : 0)).toFixed(2)} ${(100 - p + (n > v ? 1.2 : 0)).toFixed(2)}" stroke-dashoffset="${(25 - at).toFixed(2)}"/>`; at += p; }
  const pct = n ? Math.round(w / n * 100) : 0;
  return h('div', { class: 'ins-donut', style: { width: size + 'px', height: size + 'px' }, html: `<svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="4.2"/>${arcs}</svg>` },
    h('div', { class: 'ins-donut-c' }, h('b', null, n ? `${pct}%` : '-'), h('small', null, 'won')));
}
function insResultsCard(games) {
  const groups = [['all', 'All games', () => true], ['bots', 'Bots', g => insKind(g) === 'bots'], ['people', 'People', g => insKind(g) === 'online' || insKind(g) === 'friends']];
  return h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', { class: 'grow' }, 'Results'), h('span', { class: 'ins-legend' }, h('i', { class: 'w' }), 'Won', h('i', { class: 'd' }), 'Drawn', h('i', { class: 'l' }), 'Lost')),
    h('div', { class: 'ins-donuts' }, groups.map(([k, label, f]) => {
      const gs = games.filter(g => g.score != null && f(g)), w = gs.filter(g => g.score === 1).length, d = gs.filter(g => g.score === .5).length, l = gs.length - w - d;
      return h('div', { class: 'ins-dn' }, insDonut(w, d, l), h('b', null, label), h('small', null, `${w}W ${d}D ${l}L`));
    })));
}
// ---------- records ----------
function insRecordsCard(games) {
  const s = stats(), chrono = games.slice().reverse();
  let run = 0, best = s.bestStreak || 0; for (const g of chrono) { if (g.score === 1) { run++; best = Math.max(best, run); } else if (g.score != null) run = 0; }
  const wins = games.filter(g => g.score === 1);
  const bestWin = wins.filter(g => g.oppR).sort((a, b) => b.oppR - a.oppR)[0];
  const mates = wins.filter(g => g.reason === 'checkmate' && g.moves && g.moves.length).sort((a, b) => a.moves.length - b.moves.length)[0];
  const peakP = Math.round(Math.max(...(profile.pHist || [0])));
  const rec = (ic, val, label, sub, tone) => h('div', { class: 'ins-rec ' + (tone || '') }, h('span', { class: 'ins-rec-ic' }, icon(ic, 17)), h('div', { class: 'grow' }, h('small', null, label), h('b', null, val), sub ? h('em', { class: 'no-i18n' }, sub) : null));
  return h('div', { class: 'card ins-card' }, h('div', { class: 'ins-h' }, h('b', null, 'Records')),
    h('div', { class: 'ins-recs' },
      rec('flame', best ? (best === 1 ? '1 win' : `${best} wins`) : '-', 'Longest win streak', null, 'gold'),
      rec('trophy', bestWin ? String(bestWin.oppR) : '-', 'Best win', bestWin ? bestWin.opp : null, 'green'),
      rec('bolt', mates ? (Math.ceil(mates.moves.length / 2) === 1 ? '1 move' : `${Math.ceil(mates.moves.length / 2)} moves`) : '-', 'Fastest checkmate', mates ? mates.opp : null),
      rec('shield', String(profile.ladder.peak || profile.ladder.r), 'Peak Bot League', null),
      rec('puzzle', peakP ? String(peakP) : '-', 'Peak puzzle rating', null, 'blue'),
      rec('clock', String(Math.max(0, ...Object.values(profile.rushBest || {}))), 'Puzzle Rush best', profile.best ? `Puzzle streak ${profile.best}` : null)));
}
// ---------- game archive ----------
// which shelf a game record belongs on
function insKind(g) {
  if (g.mode) return { bot: 'bots', friend: 'friends', local: 'friends', p2p: 'friends', online: 'online', lobby: 'online', world: 'world' }[g.mode] || 'bots';
  if (g.variant || g.world) return 'world';
  if (g.lobby) return 'online';
  if (g.online || g.local) return 'friends';
  return 'bots';
}
const INS_FILTERS = [['all', 'All'], ['bots', 'Bots'], ['friends', 'Friends'], ['online', 'Online'], ['world', 'World']];
function insOppArt(g, size = 36) {
  const bot = typeof BOTS !== 'undefined' ? BOTS.find(b => b.name === g.opp) : null;
  if (g.oppAvatar && AVATAR_URL[g.oppAvatar]) return avatar(g.oppAvatar, size);
  if (bot && insKind(g) !== 'world') return avatar(bot.avatar, size);
  const k = insKind(g); return h('span', { class: 'ins-oic', style: { width: size + 'px', height: size + 'px' } }, icon(k === 'online' ? 'globe' : k === 'friends' ? 'friends' : k === 'world' ? 'route' : 'user', Math.round(size * .5)));
}
const insRes = g => g.kind === 'local' || g.mode === 'local' ? (g.result === '1-0' ? 'lw' : g.result === '0-1' ? 'lb' : g.result === '1/2-1/2' ? 'd' : 'n') : g.score === 1 ? 'w' : g.score === 0.5 ? 'd' : g.score === 0 ? 'l' : 'n';
const insResLabel = r => ({ w: 'Win', d: 'Draw', l: 'Loss', n: 'Played', lw: 'White won', lb: 'Black won' })[r];
const insDelta = g => g.rated && g.after != null && g.before != null ? Math.round(g.after - g.before) : g.ratingDelta != null ? Math.round(g.ratingDelta) : null;
function insOpening(g) { if (g.opening) return g.opening; if (!g.moves || !g.moves.length || (g.startFen && g.startFen !== START_FEN) || insKind(g) === 'world') return null; try { return openingName(g.moves); } catch (e) { return null; } }
function insWhen(t) { if (!t) return ''; const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function insArchive(games) {
  const box = h('div', { class: 'ins-arch' });
  let shown = 15;
  const counts = {}; games.forEach(g => { const k = insKind(g); counts[k] = (counts[k] || 0) + 1; });
  const chips = h('div', { class: 'ins-filters', role: 'tablist' });
  const list = h('div', { class: 'ins-games' });
  const draw = () => {
    chips.innerHTML = '';
    chips.append(...INS_FILTERS.map(([k, l]) => h('button', { class: 'ins-fc' + (insFilter === k ? ' on' : ''), role: 'tab', 'aria-selected': String(insFilter === k), onclick: () => { insFilter = k; shown = 15; beep('tap'); haptic(4); draw(); } }, l, h('span', null, String(k === 'all' ? games.length : counts[k] || 0)))));
    list.innerHTML = '';
    const gs = games.filter(g => insFilter === 'all' || insKind(g) === insFilter);
    if (!gs.length) { list.append(h('div', { class: 'ins-arch-empty' }, hoot(48), h('b', null, games.length ? 'No games here yet' : 'Your finished games will appear here'), h('small', { class: 'muted' }, 'Every game you finish is saved with its moves, so you can review it later.'))); return; }
    list.append(...gs.slice(0, shown).map(insGameRow));
    if (gs.length > shown) list.append(h('button', { class: 'btn ghost block small', onclick: () => { shown += 25; beep('tap'); draw(); } }, `Show more (${gs.length - shown})`));
  };
  draw();
  box.append(chips, h('div', { class: 'card ins-card ins-glist' }, list));
  return box;
}
function insGameRow(g) {
  const r = insRes(g), dr = insDelta(g), op = insOpening(g), k = insKind(g);
  const sub = [g.reason, op].filter(Boolean).join(' · ');
  return h('button', { class: 'ins-g tap', onclick: () => insGameSheet(g) },
    h('span', { class: 'ins-res ' + r }, insResLabel(r)),
    h('div', { class: 'ins-opp' }, insOppArt(g, 34),
      h('div', { class: 'grow' }, h('b', { class: 'no-i18n' }, (g.opp || 'Opponent').replace(/ \(online\)$/, '')), h('small', null, sub || (k === 'world' ? 'World Games' : '')))),
    h('div', { class: 'ins-gr' }, h('span', { class: 'ins-dr ' + (dr == null ? '' : dr >= 0 ? 'up' : 'dn') }, dr == null ? (g.rated ? '' : 'casual') : (dr >= 0 ? '+' : '') + dr), h('small', null, insWhen(g.t))));
}
// final position as a small static board (chess games only)
function insMiniBoard(g, size = 220) {
  if (!g.moves || insKind(g) === 'world') return null;
  let gm; try { gm = new Game(g.startFen || START_FEN, g.moves); } catch (e) { return null; }
  const flip = g.color === 'b', cs = getComputedStyle(document.documentElement);
  const light = cs.getPropertyValue('--light').trim() || '#ecd9b4', dark = cs.getPropertyValue('--dark').trim() || '#a9744a';
  const last = gm.lastFromTo || [], q = size / 8;
  let out = '';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const rank = flip ? r : 7 - r, file = flip ? 7 - f : f, sq = rank * 16 + file, p = gm.pos.board[sq];
    out += `<rect x="${f * q}" y="${r * q}" width="${q}" height="${q}" fill="${(rank + file) % 2 ? light : dark}"/>`;
    if (last.includes(sq)) out += `<rect x="${f * q}" y="${r * q}" width="${q}" height="${q}" fill="#f6d55c" opacity=".45"/>`;
    if (p) out += `<image href="${PIECE_URL[pieceKey(p)]}" x="${f * q}" y="${r * q}" width="${q}" height="${q}"/>`;
  }
  const st = gm.status(); if (st.over && st.reason === 'checkmate') { const k = gm.pos.kings[gm.pos.turn], rr = k >> 4, ff = k & 7, x = (flip ? 7 - ff : ff) * q, y = (flip ? rr : 7 - rr) * q; out = out.replace(`<image href="${PIECE_URL[pieceKey(gm.pos.board[k])]}" x="${x}" y="${y}"`, `<rect x="${x}" y="${y}" width="${q}" height="${q}" fill="#ff5a4a" opacity=".55"/><image href="${PIECE_URL[pieceKey(gm.pos.board[k])]}" x="${x}" y="${y}"`); }
  return h('div', { class: 'ins-mini', html: `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="Final position">${out}</svg>` });
}
function insGameSheet(g) {
  beep('open');
  const r = insRes(g), dr = insDelta(g), op = insOpening(g), k = insKind(g), chess = !!(g.moves && g.moves.length && k !== 'world');
  const me = profile.name || 'You', opp = (g.opp || 'Opponent').replace(/ \(online\)$/, '');
  const [tb, ti] = g.tc ? parseTc(g.tc) : [0, 0], tcRow = TIME_CONTROLS.find(x => x[0] === tb && x[1] === ti);
  modal((box, close) => {
    box.classList.add('ins-sheet');
    const fact = (label, val) => val == null || val === '' ? null : h('div', { class: 'ins-fact' }, h('small', null, label), h('b', null, val));
    box.append(
      h('div', { class: 'ins-sh-top ' + r }, h('span', { class: 'ins-sh-res' }, r === 'w' ? 'Victory' : r === 'l' ? 'Defeat' : r === 'd' ? 'Draw' : 'Game over'), h('small', null, [g.reason ? `by ${g.reason}` : '', insWhen(g.t)].filter(Boolean).join(' · '))),
      h('div', { class: 'ins-sh-vs' }, h('div', { class: 'ins-sh-p' }, playerBadgeEl(44), h('b', { class: 'no-i18n' }, me)), h('span', { class: 'ins-sh-x' }, 'vs'), h('div', { class: 'ins-sh-p' }, insOppArt(g, 44), h('b', { class: 'no-i18n' }, opp), g.oppR ? h('small', null, String(g.oppR)) : null)),
      chess ? insMiniBoard(g, Math.min(236, innerWidth - 110)) : null,
      h('div', { class: 'ins-facts' },
        fact('Moves', g.moves ? String(Math.ceil(g.moves.length / 2)) : null), fact('Color', g.color === 'w' ? 'White' : g.color === 'b' ? 'Black' : null),
        fact('Rating', dr != null ? (dr >= 0 ? '+' : '') + dr : g.rated === false ? 'Casual' : null), fact('Time', g.tc ? (tb ? `${tcLabel(tb, ti)} ${tcRow ? tcRow[2] : ''}`.trim() : 'Untimed') : null),
        fact('Opening', op), fact('Game', g.variant ? g.variant : null)),
      h('div', { class: 'row ins-sh-btns' },
        h('button', { class: 'btn grow', disabled: !chess, onclick: () => { close(); openAnalysis({ fen: g.startFen || START_FEN, moves: g.moves }); } }, icon('board', 18), 'Analyze'),
        h('button', { class: 'btn primary grow', disabled: !chess, onclick: () => { close(); openReview({ startFen: g.startFen, moves: g.moves, color: g.color || null, white: g.color === 'b' ? opp : me, black: g.color === 'b' ? me : opp }); } }, icon('search', 18), 'Review')),
      chess ? null : h('p', { class: 'small muted center', style: { margin: '8px 0 0' } }, k === 'world' ? 'World Games can be replayed from the World Games hall.' : 'This game was saved without its moves.'));
  });
}
