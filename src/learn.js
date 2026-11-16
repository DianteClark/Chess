// The Library: beginner path, courses and the lesson player.
'use strict';
// ======================= LEARN =======================
let lessonOpen = null, lessonStep = 0;
function lessonIcon(l) { return l.piece ? h('div', { class: 'ic', style: { backgroundImage: `url(${PIECE_URL['w' + l.piece]})` } }) : h('div', { class: 'ic dark' }, icon(l.icon, 24)); }
function lessonKey(L) { return L.course ? `c:${L.course.id}/${L.id}` : L.id; }
// course levels, listed for the translation catalog: tr('beginner') tr('intermediate') tr('advanced')
let courseOpen = null;
function courseIcon(c) { return ['pawn', 'king', 'rook', 'queen', 'knight', 'bishop'].includes(c.icon) ? h('div', { class: 'ic', style: { backgroundImage: `url(${PIECE_URL['w' + { pawn: 'p', king: 'k', rook: 'r', queen: 'q', knight: 'n', bishop: 'b' }[c.icon]]})` } }) : h('div', { class: 'ic dark' }, icon(c.icon || 'book', 24)); }
function renderCourse(main) {
  const C = courseOpen, done = C.lessons.filter(l => profile.lessons[lessonKey(l)]).length;
  main.append(h('div', { class: 'course-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => { courseOpen = null; navDir = 'back'; render(); } }, icon('back', 20)),
    h('div', { class: 'grow' }, h('h2', null, C.title), h('small', null, `${done} of ${C.lessons.length} lessons done, ${tr(C.level)}`))));
  main.append(h('div', { class: 'card course-intro' }, h('p', null, C.desc), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(done / C.lessons.length * 100) + '%' } }))));
  C.lessons.forEach(l => { l.course = C; });
  main.append(lessonPath(C.lessons.map((l, k) => ({ key: lessonKey(l), title: l.title, art: h('b', { class: 'lp-num' }, String(k + 1)), open: () => { lessonOpen = l; lessonStep = 0; render(); } }))));
}
let learnTab = 'path';
function lessonStarsEl(key) { const n = (profile.lessonStars || {})[key] || (profile.lessons[key] ? 1 : 0); const el = h('div', { class: 'lstars' }); for (let i = 0; i < 3; i++) el.append(h('i', { class: i < n ? 'on' : '' }, icon('star', 13))); return el; }
function renderLearn(main) {
  if (lessonOpen) return renderLesson(main);
  if (courseOpen) return renderCourse(main);
  const done = LESSONS.filter(l => profile.lessons[l.id]).length, next = LESSONS.find(l => !profile.lessons[l.id]);
  const totalStars = LESSONS.reduce((a, l) => a + ((profile.lessonStars || {})[l.id] || (profile.lessons[l.id] ? 1 : 0)), 0);
  main.append(stageBanner('library', 'The Library', `${done} of ${LESSONS.length} lessons, ${totalStars} of ${LESSONS.length * 3} stars`));
  const tabs = h('div', { class: 'seg learn-tabs' }); [['path', [icon('route', 16), ' Beginner path']], ['courses', [icon('book', 16), ' Courses']]].forEach(([v, l]) => tabs.append(h('button', { class: learnTab === v ? 'on' : '', onclick: () => { learnTab = v; beep('toggle'); render(); } }, l)));
  main.append(tabs);
  if (learnTab === 'courses') {
    main.append(h('div', { class: 'course-cards' }, COURSES.map((c, ci) => { const d = c.lessons.filter(l => profile.lessons[`c:${c.id}/${l.id}`]).length;
      return h('button', { class: 'course-card c' + ci, onclick: () => { courseOpen = c; beep('open'); render(); window.scrollTo(0, 0); } }, h('div', { class: 'cc-ic' }, courseIcon(c)), h('div', { class: 'grow' }, h('b', null, c.title), h('small', null, c.desc), h('div', { class: 'cc-meta' }, h('span', { class: 'pill' }, tr(c.level)), h('span', null, `${d} of ${c.lessons.length} lessons`)), h('div', { class: 'qbar' }, h('div', { style: { width: Math.round(d / c.lessons.length * 100) + '%' } })))); })));
    main.append(h('button', { class: 'course-card world', onclick: () => { worldView = null; go('world'); } }, h('div', { class: 'cc-ic' }, icon('globe', 26)), h('div', { class: 'grow' }, h('b', null, 'World Games'), h('small', null, 'Xiangqi, shogi, janggi and more, each with its own course'))));
    return;
  }
  main.append(lessonPath(LESSONS.map(l => ({ key: l.id, title: l.title, group: l.group, art: l.piece ? h('img', { src: PIECE_URL['w' + l.piece], alt: '' }) : icon(l.icon || 'learn', 26), open: () => { lessonOpen = l; lessonStep = 0; render(); } })),
    { say: next ? (done === 0 ? "Hoo-hoo! Tap the glowing circle to start your first lesson." : `Great work! Next up: ${next.title}.`) : 'You finished the whole path. Try a course next!', mood: done ? 'wave' : 'talk' }));
}
// A winding trail of lesson nodes (used by the beginner path, courses and World Games courses).
// items: [{key, title, group?, art, open(), done?, stars?}]
function lessonPath(items, opts = {}) {
  const isDone = it => it.done != null ? it.done : !!profile.lessons[it.key];
  const next = items.find(it => !isDone(it));
  const path = h('div', { class: 'lpath' });
  if (opts.say) path.append(h('div', { class: 'lp-hoot' }, typeof hootEl === 'function' ? hootEl(opts.mood || 'talk', 64) : hoot(64), h('div', { class: 'lp-say' }, opts.say)));
  const offs = [0, 46, 70, 46, 0, -46, -70, -46];
  let lastGroup = null, k = 0;
  for (const it of items) {
    if (it.group && it.group !== lastGroup) { lastGroup = it.group; const gl = items.filter(x => x.group === it.group); path.append(h('div', { class: 'lp-chapter' }, h('b', null, it.group), h('small', null, `${gl.filter(isDone).length} / ${gl.length}`))); }
    const d = isDone(it), nx = it === next;
    const stars = h('div', { class: 'lstars' }); const n = it.stars != null ? it.stars : ((profile.lessonStars || {})[it.key] || (d ? 1 : 0)); for (let i = 0; i < 3; i++) stars.append(h('i', { class: i < n ? 'on' : '' }, icon('star', 13)));
    const node = h('button', { class: 'lp-node' + (d ? ' done' : '') + (nx ? ' next' : ''), onclick: () => { beep('open'); haptic(8); it.open(); } },
      h('span', { class: 'lp-disc' }, it.art), h('span', { class: 'lp-lab' }, h('b', null, it.title), stars));
    node.style.setProperty('--x', offs[k % offs.length] + 'px'); path.append(node); k++;
  }
  requestAnimationFrame(() => { const pr = path.getBoundingClientRect(); if (!pr.width) return; const pts = [...path.querySelectorAll('.lp-disc')].map(d => { const r = d.getBoundingClientRect(); return [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2]; });
    let d = ''; pts.forEach((p, i) => { if (!i) { d = `M${p[0]} ${p[1]}`; return; } const q = pts[i - 1], my = (q[1] + p[1]) / 2; d += ` C${q[0]} ${my} ${p[0]} ${my} ${p[0]} ${p[1]}`; });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'lp-trail'); svg.setAttribute('width', pr.width); svg.setAttribute('height', pr.height);
    const pa = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pa.setAttribute('d', d); svg.append(pa); path.prepend(svg); });
  if (next) setTimeout(() => { const n = path.querySelector('.lp-node.next'); if (n && n.getBoundingClientRect().top > innerHeight - 160) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
  return path;
}
function fenToBoard(fen) { return new E.Position(fen.includes(' ') ? fen : fen + ' w - - 0 1').board; }
function boardFromPieces(spec) { // spec: {'d4':'R', 'e5':'p'}
  const b = new Int8Array(128);
  for (const k in spec) b[sqFromName(k)] = E.PIECE_CHARS.indexOf(spec[k]);
  return b;
}
// movement on a lesson board, ignoring check: used for "collect the stars"
function lessonTargets(b, sq) {
  const p = b[sq]; if (!p || (p & 8)) return [];
  const t = p & 7, out = [];
  const add = to => { if (to & 0x88) return false; const q = b[to]; if (!q) { out.push(to); return true; } if (q & 8) out.push(to); return false; };
  if (t === 1) {
    const one = sq + 16; if (!(one & 0x88) && !b[one]) { out.push(one); if ((sq >> 4) === 1 && !b[one + 16]) out.push(one + 16); }
    for (const d of [15, 17]) { const to = sq + d; if (!(to & 0x88) && (b[to] & 8)) out.push(to); }
  } else if (t === 2 || t === 6) {
    for (const d of (t === 2 ? [33, 31, 18, 14, -33, -31, -18, -14] : [1, -1, 16, -16, 17, 15, -17, -15])) add(sq + d);
  } else {
    const dirs = t === 3 ? [17, 15, -17, -15] : t === 4 ? [1, -1, 16, -16] : [1, -1, 16, -16, 17, 15, -17, -15];
    for (const d of dirs) { let to = sq + d; while (add(to)) to += d; }
  }
  return out;
}
let lessonMistakes = 0;
function renderLesson(main) {
  const L = lessonOpen, steps = L.steps, step = steps[lessonStep];
  if (lessonStep === 0) lessonMistakes = 0;
  const F = focusScreen(main, { title: L.title, sub: L.course ? L.course.title : (L.group || 'Beginner course'), back: () => { lessonOpen = null; render(); }, progress: [lessonStep, steps.length] });
  const bubble = hootSays(step.text, step.type === 'text' ? 'talk' : 'idle'); F.above.append(bubble);
  const hootW = bubble.querySelector('.who').firstChild;
  const react = m => { if (typeof hootReact === 'function') hootReact(hootW, m); };
  const msg = h('div', { class: 'fs-msg' }); F.below.append(msg);
  let complete = step.type === 'text';
  const isLast = lessonStep >= steps.length - 1;
  const advance = () => {
    if (!isLast) { lessonStep++; render(); return; }
    const key = lessonKey(L), firstTime = !profile.lessons[key]; profile.lessons[key] = 1;
    const stars = lessonMistakes === 0 ? 3 : lessonMistakes <= 2 ? 2 : 1;
    profile.lessonStars = profile.lessonStars || {}; const prevStars = profile.lessonStars[key] || 0; profile.lessonStars[key] = Math.max(prevStars, stars); saveProfile();
    if (firstTime) { rewardEvent('lesson'); if (L.course && L.course.lessons.every(x => profile.lessons[lessonKey(x)])) rewardEvent('course'); }
    const list = L.course ? L.course.lessons : LESSONS; const nxt = list[list.indexOf(L) + 1];
    showLessonResults({ title: 'Lesson complete!', subtitle: L.title, stars, firstTime, next: nxt ? () => { lessonOpen = nxt; lessonStep = 0; lessonMistakes = 0; render(); } : null, nextLabel: nxt ? 'Next lesson' : "Let's play!", done: () => { lessonOpen = null; if (!nxt) go('play'); else render(); } });
  };
  const navActions = (extra) => F.setActions([
    lessonStep > 0 ? { ic: 'back', label: 'Back', on: () => { lessonStep--; render(); } } : null,
    extra || null,
    { ic: isLast ? 'check' : 'next', label: isLast ? 'Finish' : 'Next', primary: true, disabled: !complete, on: advance }]);
  const nextBtn = { set disabled(v) { navActions(restartAct); } };
  let restartAct = null;
  const finishTask = (text) => { complete = true; nextBtn.disabled = false; msg.className = 'fs-msg good'; msg.textContent = text || 'Great job!'; beep('correct'); react('cheer'); haptic([8, 30, 8]); };
  const missTask = () => { lessonMistakes++; react('sad'); haptic(20); };

  // explanation steps without their own picture reuse the lesson's last position
  let textBoard = step.board; if (step.type === 'text' && !textBoard) for (let i = lessonStep - 1; i >= 0 && !textBoard; i--) textBoard = steps[i].board || steps[i].fen;
  if (step.type === 'text' && textBoard) {
    const bv = new BoardView({ orient: step.orient || 'w' });
    const marks = {}; (step.marks || []).forEach(s => marks[sqFromName(s)] = 'mark');
    const showTargets = step.showMoves ? lessonTargets(fenToBoard(textBoard), sqFromName(step.showMoves)) : [];
    bv.set({ board: fenToBoard(textBoard), marks, arrows: (step.arrows || []).map(([a, b]) => [sqFromName(a), sqFromName(b)]) });
    if (showTargets.length) { bv.targets = showTargets; bv.draw(); }
    F.stage.append(bv.el);
  } else if (step.type === 'stars') {
    let b = boardFromPieces(step.pieces);
    const stars = new Set((step.stars || []).map(sqFromName));
    const fixed = new Set((step.fixed || []).map(sqFromName));
    let movesUsed = 0;
    const enemiesLeft = () => { let n = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (b[s] & 8) n++; } return n; };
    const bv = new BoardView({
      getTargets: sq => (!complete && b[sq] && !(b[sq] & 8) && !fixed.has(sq)) ? lessonTargets(b, sq) : null,
      onMove: (from, to, dragged) => {
        const cap = !!b[to]; b[to] = b[from]; b[from] = 0; movesUsed++;
        if (step.promote && (b[to] & 7) === 1 && (to >> 4) === 7) b[to] = 5;
        let got = false; if (stars.has(to)) { stars.delete(to); got = true; }
        beep(got ? 'star' : cap ? 'capture' : 'move');
        bv.set({ board: b, stars, last: [from, to] }, dragged ? null : [from, to]);
        const left = stars.size + (step.captureAll ? enemiesLeft() : 0);
        if (!left) { bv.burst('star'); if (movesUsed > (step.par || 99)) lessonMistakes++; finishTask(movesUsed <= (step.par || 99) ? `Perfect! You did it in ${movesUsed} moves!` : `You did it in ${movesUsed} moves! Can you do it in ${step.par}?`); }
        else msg.textContent = [stars.size ? (stars.size > 1 ? `${stars.size} stars left` : `${stars.size} star left`) : '', step.captureAll && enemiesLeft() ? `${enemiesLeft()} to capture` : ''].filter(Boolean).join(', ');
      }
    });
    bv.set({ board: b, stars });
    F.stage.append(bv.el);
    msg.textContent = [stars.size ? (stars.size > 1 ? `${stars.size} stars to collect` : `${stars.size} star to collect`) : '', step.captureAll ? `${enemiesLeft()} to capture` : ''].filter(Boolean).join(', ');
    restartAct = { ic: 'undo', label: 'Restart', on: () => render() };
  } else if (step.type === 'line') {
    let g = new Game(step.fen), k = 0;
    const side = step.side || g.turn();
    // the learner plays the moves at their turns; the app replies with the next move in the line
    const autoReply = () => { while (k < step.moves.length && g.turn() !== side) { const r = g.play(step.moves[k]); k++; playSound(r); } bv.set(g.viewState(), g.lastFromTo); if (k >= step.moves.length) { bv.burst('star'); finishTask(step.success); } };
    const bv = new BoardView({
      orient: side,
      getTargets: sq => (!complete && g.turn() === side) ? g.targetsFrom(sq) : null,
      onMove: (from, to, dragged) => {
        const uci = sqName(from) + sqName(to) + (g.needsPromo(from, to) ? 'q' : '');
        const expected = step.moves[k], alts = (step.alt && step.alt[k]) || [];
        if (uci === expected || uci.slice(0, 4) === (expected || '').slice(0, 4) || alts.includes(uci) || alts.includes(uci.slice(0, 4))) {
          const r = g.play(uci); k++; playSound(r); bv.set(g.viewState(), dragged ? null : g.lastFromTo);
          msg.className = 'fs-msg good'; msg.textContent = k < step.moves.length ? 'Good! Keep going…' : '';
          setTimeout(autoReply, 450);
        } else {
          const t = new Game(g.startFen, g.moves); if (t.play(uci)) bv.set(t.viewState(), [from, to]);
          beep('wrong'); missTask(); msg.className = 'fs-msg bad'; msg.textContent = step.fail || 'Not the move we are practicing. Try again!';
          setTimeout(() => bv.set(g.viewState()), 800);
        }
      },
    });
    F.stage.append(bv.el);
    bv.set(g.viewState());
    if (g.turn() !== side) setTimeout(autoReply, 500);
    restartAct = { ic: 'undo', label: 'Restart', on: () => render() };
  } else if (step.type === 'goal') {
    let g = new Game(step.fen);
    const side = g.turn();
    const bv = new BoardView({
      orient: side,
      getTargets: sq => (!complete && g.turn() === side) ? g.targetsFrom(sq) : null,
      onMove: (from, to, dragged) => {
        const needs = g.needsPromo(from, to);
        const uci = sqName(from) + sqName(to) + (needs ? 'q' : '');
        const legal = g.legal(); const m = g.pos.moveFromUci(uci, legal);
        const res = g.play(uci); playSound(res);
        bv.set(g.viewState(), dragged ? null : g.lastFromTo);
        let ok = false;
        if (step.goal === 'check') ok = g.pos.inCheck();
        else if (step.goal === 'mate') ok = g.status().reason === 'checkmate';
        else if (step.goal === 'castle') ok = !!(E.mFlags(m) & E.F_CASTLE);
        else if (step.goal === 'promote') ok = !!E.mPromo(m);
        else if (step.goal === 'move') ok = step.moves.includes(uci.slice(0, 4));
        if (ok) { bv.burst(step.goal === 'mate' ? 'crown' : 'star'); finishTask(step.success); }
        else {
          const st = g.status();
          msg.className = 'fs-msg bad'; msg.textContent = st.reason === 'stalemate' ? 'Oops, that is stalemate (a draw)! Try again.' : (step.fail || 'Not quite. Try again!');
          beep('wrong'); missTask(); stepMisses++;
          setTimeout(() => { g = new Game(step.fen); bv.set(g.viewState()); if (stepMisses >= 2 && !hintShown) { hintShown = true; restartAct = { ic: 'bulb', label: 'Show me', on: showAnswer }; navActions(restartAct); } }, 1100);
        }
      }
    });
    // after two misses Hoot offers to show the answer with an arrow
    let stepMisses = 0, hintShown = false;
    const goalOk = (gg, m, uci) => step.goal === 'check' ? gg.pos.inCheck() : step.goal === 'mate' ? gg.status().reason === 'checkmate' : step.goal === 'castle' ? !!(E.mFlags(m) & E.F_CASTLE) : step.goal === 'promote' ? !!E.mPromo(m) : step.goal === 'move' ? step.moves.includes(uci.slice(0, 4)) : false;
    const showAnswer = () => {
      let ans = step.goal === 'move' ? step.moves[0] : null;
      if (!ans) { const t = new Game(step.fen); for (const m of t.legal()) { const u = t.pos.uci(m); const t2 = new Game(step.fen); t2.play(u); if (goalOk(t2, m, u)) { ans = u; break; } } }
      if (!ans) return;
      beep('hint'); react('think');
      bv.set(Object.assign(g.viewState(), { arrows: [[sqFromName(ans.slice(0, 2)), sqFromName(ans.slice(2, 4)), '#7cc04a']] }));
      msg.className = 'fs-msg'; msg.textContent = 'Follow the green arrow!';
    };
    bv.set(g.viewState());
    F.stage.append(bv.el);
  }
  if (step.type === 'text' && !textBoard) F.stage.append(h('div', { class: 'lesson-art' }, typeof hootEl === 'function' ? hootEl('wave', 140) : hoot(140)));
  navActions(restartAct);
}
// end of a lesson: stars, XP and the next step (the full results screen when the FX kit is loaded)
function showLessonResults(o) {
  presentResults({ mood: o.stars === 3 ? 'cheer' : 'happy', title: o.title, subtitle: o.subtitle, stars: o.stars,
    buttons: [{ label: 'All lessons', on: o.done }, { label: o.nextLabel, primary: true, on: o.next || o.done }] });
}

