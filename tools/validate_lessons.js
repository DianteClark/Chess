// Checks every lesson task: star puzzles are solvable and "par" equals the true minimum;
// goal positions are legal and the goal is achievable in one move.
const E = require('../src/engine.js')();
const LESSONS = require('../src/lessons.js');
const vm = require('vm');
// pull lessonTargets/boardFromPieces out of app.js so we test the real code
const app = require('fs').readFileSync(__dirname + '/../src/app.js', 'utf8');
const grab = name => { const i = app.indexOf('function ' + name); let d = 0, j = app.indexOf('{', i); for (; j < app.length; j++) { if (app[j] === '{') d++; else if (app[j] === '}' && --d === 0) break; } return app.slice(i, j + 1); };
const ctx = { E, sqFromName: E.sqFromName, Int8Array };
vm.createContext(ctx); vm.runInContext(grab('lessonTargets') + grab('boardFromPieces'), ctx);
let bad = 0;
for (const L of LESSONS) for (const [i, st] of L.steps.entries()) {
  const tag = `${L.id}#${i}`;
  if (st.type === 'stars') {
    const b0 = ctx.boardFromPieces(st.pieces), fixed = new Set((st.fixed || []).map(E.sqFromName));
    const stars0 = (st.stars || []).map(E.sqFromName);
    const key = (b, s) => Array.from(b).join(',') + '|' + s.join(',');
    let frontier = [[b0, stars0]], seen = new Set([key(b0, stars0)]), depth = 0, found = -1;
    const done = (b, s) => !s.length && (!st.captureAll || !Array.from(b).some(p => p & 8));
    if (done(b0, stars0)) found = 0;
    while (found < 0 && frontier.length && depth < 12) {
      depth++; const next = [];
      for (const [b, s] of frontier) for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88 || !b[sq] || (b[sq] & 8) || fixed.has(sq)) continue;
        for (const to of ctx.lessonTargets(b, sq)) {
          const nb = Int8Array.from(b); nb[to] = nb[sq]; nb[sq] = 0;
          if (st.promote && (nb[to] & 7) === 1 && (to >> 4) === 7) nb[to] = 5;
          const ns = s.filter(x => x !== to), k = key(nb, ns);
          if (seen.has(k)) continue; seen.add(k);
          if (done(nb, ns)) { found = depth; break; }
          next.push([nb, ns]);
        }
        if (found >= 0) break;
      }
      frontier = next;
    }
    if (found < 0) { bad++; console.log('UNSOLVABLE', tag); }
    else if (found !== st.par) { bad++; console.log('PAR', tag, 'is', st.par, 'actual', found); }
  } else if (st.type === 'goal') {
    const pos = new E.Position(st.fen);
    if (pos.attacked(pos.kings[pos.turn ^ 1], pos.turn)) { bad++; console.log('ILLEGAL (side not to move in check)', tag); continue; }
    const legal = pos.legalMoves();
    const hits = legal.filter(m => {
      pos.make(m); let ok;
      if (st.goal === 'check') ok = pos.inCheck(); else if (st.goal === 'mate') ok = pos.status().reason === 'checkmate';
      else if (st.goal === 'castle') ok = !!(E.mFlags(m) & E.F_CASTLE); else if (st.goal === 'promote') ok = !!E.mPromo(m);
      else ok = st.moves.includes(E.sqName(E.mFrom(m)) + E.sqName(E.mTo(m)));
      pos.unmake(); return ok;
    });
    if (!hits.length) { bad++; console.log('GOAL IMPOSSIBLE', tag); }
    else console.log('ok', tag, st.goal, hits.length + ' solution(s)');
  }
}
console.log(bad ? bad + ' PROBLEMS' : 'ALL LESSONS VALID');
