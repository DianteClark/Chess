// End-to-end tests for the Knight Club lobby Worker, against the real workerd runtime.
//   node tools/lobby_test.mjs            (starts `wrangler dev` itself with test hooks and a fresh state dir)
//   LOBBY_URL=http://localhost:8787 node tools/lobby_test.mjs   (use an already running dev server
//     started with: --var TEST_HOOKS:1 --var FIRST_MOVE_MS:3000 --var DISCONNECT_MS:4000)
// Needs Node 22+ (global WebSocket) and `npm install` inside lobby/.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOBBY_DIR = join(ROOT, 'lobby');
const PORT = 8790;
let BASE = process.env.LOBBY_URL || 'http://localhost:' + PORT;
const subtle = globalThis.crypto.subtle;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok   ' + label); } else { fail++; console.log('  FAIL ' + label); }
}

// ------------------------------------------------------------------ test client
class Client {
  constructor(label) { this.label = label; this.msgs = []; this.waiters = []; this.sent = []; this.keys = null; }
  async makeKeys() {
    const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await subtle.exportKey('jwk', pair.publicKey);
    this.keys = { priv: pair.privateKey, pub: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y } };
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws');
      this.closed = false;
      this.ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        this.msgs.push(m);
        if (m.t === 'game') this.game = m;
        for (const w of this.waiters.slice()) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(m); }
      };
      this.ws.onopen = () => resolve();
      this.ws.onerror = e => reject(e);
      this.ws.onclose = () => { this.closed = true; };
    });
  }
  async connect(name, opts = {}) {
    if (!this.keys) await this.makeKeys();
    this.msgs = [];
    await this.open();
    const ch = await this.wait(m => m.t === 'challenge');
    let sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys.priv, new TextEncoder().encode(ch.prefix + ch.nonce));
    sig = Buffer.from(sig);
    if (opts.badSig) sig[5] ^= 1;
    this.raw({ t: 'auth', pub: this.keys.pub, sig: sig.toString('base64url'), name });
    if (opts.badSig) return this.wait(m => m.t === 'error');
    this.me = await this.wait(m => m.t === 'welcome');
    return this.me;
  }
  raw(obj) { this.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  // stays under the server's 20 msgs / 5 s per-connection limit
  async send(obj) {
    const now = Date.now();
    this.sent = this.sent.filter(t => now - t < 5200);
    if (this.sent.length >= 15) await sleep(5200 - (now - this.sent[0]));
    this.sent.push(Date.now());
    this.raw(obj);
  }
  wait(pred, ms = 4000, label) {
    const hit = this.msgs.find(pred);
    if (hit) { this.msgs.splice(this.msgs.indexOf(hit), 1); return Promise.resolve(hit); }
    return new Promise((resolve, reject) => {
      const w = { pred, resolve: m => { clearTimeout(timer); this.msgs.splice(this.msgs.indexOf(m), 1); resolve(m); } };
      const timer = setTimeout(() => { this.waiters.splice(this.waiters.indexOf(w), 1); reject(new Error(this.label + ' timeout waiting for ' + (label || pred))); }, ms);
      this.waiters.push(w);
    });
  }
  drain() { this.msgs = []; }
  // wait for a game state matching pred
  gameWhere(pred, ms) { return this.wait(m => m.t === 'game' && pred(m), ms); }
  async none(pred, ms = 600) {
    await sleep(ms);
    return !this.msgs.some(pred);
  }
  close() { try { this.ws.close(); } catch (e) {} }
  async closeAndWait() { this.close(); for (let i = 0; i < 50 && !this.closed; i++) await sleep(20); await sleep(150); }
}

async function play(white, black, gameId, ucis, startPly = 0) {
  let ply = startPly;
  for (const u of ucis) {
    const mover = ply % 2 === 0 ? white : black;
    await mover.send({ t: 'move', gameId, uci: u, ply });
    ply++;
    const p = ply;
    await white.gameWhere(g => g.id === gameId && g.moves.length === p);
    await black.gameWhere(g => g.id === gameId && g.moves.length === p);
  }
}

async function newGame(a, b, tc = { base: 180, inc: 2 }, rated = true) {
  a.drain(); b.drain();
  await a.send({ t: 'seek', tc, color: 'w', rated });
  const s = await a.wait(m => m.t === 'mySeek' && m.seek);
  await b.send({ t: 'accept', seekId: s.seek.id });
  const g = await a.gameWhere(x => !x.status.over && x.moves.length === 0);
  await b.gameWhere(x => x.id === g.id);
  return g;
}

// ------------------------------------------------------------------ unit check: flag vs insufficient material
async function unitFlag() {
  console.log('unit: flag vs insufficient material');
  const { Lobby } = await import(join(LOBBY_DIR, 'src', 'lobby.js'));
  const E = (await import(join(LOBBY_DIR, 'src', 'chess-engine.js'))).default();
  const run = (fen, flagged) => {
    const L = Object.create(Lobby.prototype);
    let out = null;
    L.pos = () => new E.Position(fen);
    L.clockRunning = () => true;
    L.endGame = (g, result, reason) => { out = { result, reason }; };
    L.flag({ clocks: { w: 5, b: 5 }, moves: ['a', 'b', 'c'] }, flagged, Date.now());
    return out;
  };
  ok(run('8/8/4k3/8/8/8/3QK3/8 b - - 0 1', 'b').result === '1-0', 'black flags vs K+Q: white wins');
  ok(run('8/8/4k3/8/8/8/3QK3/8 w - - 0 1', 'w').result === '1/2-1/2', 'white flags vs lone king: draw');
  ok(run('8/8/4k3/8/8/8/3NK3/8 b - - 0 1', 'b').result === '1/2-1/2', 'black flags vs K+N: draw');
  ok(run('8/8/4k3/8/8/8/2NNK3/8 b - - 0 1', 'b').result === '1-0', 'black flags vs K+N+N: white wins');
  ok(run('8/8/4k3/8/8/8/3PK3/8 b - - 0 1', 'b').result === '1-0', 'black flags vs K+P: white wins');
}

// ------------------------------------------------------------------ server lifecycle
let server = null, stateDir = null;
async function startServer() {
  if (process.env.LOBBY_URL) return;
  try { await fetch(BASE + '/health'); throw new Error('port ' + PORT + ' is already in use (stale wrangler dev?)'); }
  catch (e) { if (/already in use/.test(e.message)) throw e; }
  stateDir = mkdtempSync(join(tmpdir(), 'kc-lobby-'));
  server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', stateDir,
    '--var', 'TEST_HOOKS:1', '--var', 'FIRST_MOVE_MS:3000', '--var', 'DISCONNECT_MS:4000'],
  { cwd: LOBBY_DIR, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  let log = '';
  server.stdout.on('data', d => { log += d; });
  server.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try { const r = await fetch(BASE + '/health'); if (r.ok) return; } catch (e) { /* not up yet */ }
  }
  console.log(log);
  throw new Error('wrangler dev did not start');
}
function stopServer() {
  if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch (e) { try { server.kill('SIGTERM'); } catch (e2) {} } }
  if (stateDir) try { rmSync(stateDir, { recursive: true, force: true }); } catch (e) {}
}

// ------------------------------------------------------------------ main
async function main() {
  await unitFlag();
  await startServer();
  console.log('server: ' + BASE);

  console.log('http');
  let r = await fetch(BASE + '/health');
  ok(r.ok && (await r.json()).ok === true, '/health ok');
  r = await fetch(BASE + '/stats');
  ok(r.headers.get('access-control-allow-origin') === '*', '/stats has CORS header');

  console.log('auth');
  const A = new Client('A'), B = new Client('B'), C = new Client('C'), D = new Client('D');
  const wa = await A.connect('Alice');
  ok(wa.id && wa.name === 'Alice' && wa.r === 800 && wa.provisional === true, 'A welcome with default rating 800 provisional');
  const wb = await B.connect('Bob');
  ok(wb.id && wb.id !== wa.id, 'B has a different id');
  const wc = await C.connect('Fuuuck you');
  ok(wc.name.startsWith('Player-'), 'bad name replaced with default');
  ok(!!(await C.wait(m => m.t === 'error' && m.code === 'badName')), 'badName error sent');
  const e = await D.connect('Dan', { badSig: true });
  ok(e.code === 'authFailed', 'bad signature rejected');
  await sleep(200);
  ok(D.closed, 'socket closed after failed auth');
  const X = new Client('X');
  await X.makeKeys(); await X.open(); await X.wait(m => m.t === 'challenge');
  X.raw({ t: 'seek', tc: { base: 60, inc: 0 } });
  ok((await X.wait(m => m.t === 'error')).code === 'notAuthed', 'unauthenticated message rejected');
  X.close();

  console.log('seeks');
  await C.send({ t: 'subscribe', what: 'seeks' });
  ok(Array.isArray((await C.wait(m => m.t === 'seeks')).list), 'subscribe returns seek list');
  await A.send({ t: 'seek', tc: { base: 120, inc: 0 }, color: 'w', rated: true });
  ok((await A.wait(m => m.t === 'error')).code === 'badTimeControl', 'invalid time control rejected');
  await A.send({ t: 'seek', tc: { base: 180, inc: 2 }, color: 'w', rated: true });
  const mySeek = (await A.wait(m => m.t === 'mySeek' && m.seek)).seek;
  const listed = await C.wait(m => m.t === 'seeks' && m.list.some(s => s.id === mySeek.id));
  ok(listed.list[0].name === 'Alice' && listed.list[0].tc.base === 180, 'subscriber sees new seek');
  await A.send({ t: 'accept', seekId: mySeek.id });
  ok((await A.wait(m => m.t === 'error')).code === 'ownSeek', 'cannot accept own seek');
  await A.send({ t: 'seek', tc: { base: 300, inc: 0 }, color: 'b', rated: true });
  const seek2 = (await A.wait(m => m.t === 'mySeek' && m.seek && m.seek.tc.base === 300)).seek;
  const l2 = await C.wait(m => m.t === 'seeks' && m.list.some(s => s.id === seek2.id));
  ok(l2.list.length === 1, 'new seek replaces old one (1 open seek per player)');
  await A.send({ t: 'cancelSeek' });
  await C.wait(m => m.t === 'seeks' && m.list.length === 0);
  ok(true, 'cancelSeek clears the list');

  console.log('game: seek/accept, moves');
  C.drain();
  let g = await newGame(A, B);
  ok(g.white.id === wa.id && g.black.id === wb.id && g.clocks.w === 180000, 'game created, A white, clocks 3:00');
  ok(g.clockRunning === false && typeof g.firstMoveDeadline === 'number', 'clock not running before first moves');
  await C.wait(m => m.t === 'seeks' && m.list.length === 0);
  ok(true, 'accepted seek removed from list');
  await A.send({ t: 'seek', tc: { base: 60, inc: 0 } });
  ok((await A.wait(m => m.t === 'error')).code === 'inGame', 'cannot seek while in a game');
  await A.send({ t: 'move', gameId: g.id, uci: 'e2e5', ply: 0 });
  ok((await A.wait(m => m.t === 'error')).code === 'illegal', 'illegal move rejected');
  await B.send({ t: 'move', gameId: g.id, uci: 'e7e5', ply: 0 });
  ok((await B.wait(m => m.t === 'error')).code === 'notYourTurn', 'moving out of turn rejected');
  await A.send({ t: 'move', gameId: g.id, uci: 'e2e4', ply: 0 });
  g = await B.gameWhere(x => x.moves.length === 1);
  ok(g.moves[0] === 'e2e4', 'legal move applied and pushed to opponent');
  await A.gameWhere(x => x.moves.length === 1);
  A.drain();
  await A.send({ t: 'move', gameId: g.id, uci: 'e2e4', ply: 0 });
  ok(await A.none(m => m.t === 'game' || m.t === 'error'), 'duplicate move (same ply) ignored');
  await play(A, B, g.id, ['e7e5'], 1);
  g = A.game;
  ok(g.clockRunning === true && g.firstMoveDeadline === null, 'clock runs after both first moves');
  await sleep(300);
  await play(A, B, g.id, ['g1f3'], 2);
  g = A.game;
  ok(g.clocks.w > 180000 && g.clocks.w < 182000, 'elapsed deducted and increment added (' + g.clocks.w + ')');
  await A.send({ t: 'move', gameId: g.id, uci: 'b8c6', ply: 5 });
  ok((await A.wait(m => m.t === 'error')).code === 'notYourTurn', 'wrong-turn move rejected');
  await B.send({ t: 'move', gameId: g.id, uci: 'b8c6', ply: 7 });
  ok((await B.wait(m => m.t === 'error')).code === 'badPly', 'wrong ply rejected');
  await play(A, B, g.id, ['b8c6'], 3);

  console.log('chat');
  await A.send({ t: 'chat', gameId: g.id, code: 'gl' });
  const ch = await B.wait(m => m.t === 'chat');
  ok(ch.code === 'gl' && ch.from === 'w', 'preset chat delivered');
  await A.wait(m => m.t === 'chat');
  await A.send({ t: 'chat', gameId: g.id, code: 'hello there' });
  ok((await A.wait(m => m.t === 'error')).code === 'badChat', 'free-text chat rejected');
  ok(await B.none(m => m.t === 'chat'), 'free text never reaches opponent');

  console.log('draw');
  await A.send({ t: 'drawOffer', gameId: g.id });
  ok((await B.gameWhere(x => x.drawOfferBy === 'w')).drawOfferBy === 'w', 'draw offer visible to opponent');
  await B.send({ t: 'drawDecline', gameId: g.id });
  ok((await A.gameWhere(x => x.drawOfferBy === null)).status.over === false, 'draw declined');
  await A.send({ t: 'drawOffer', gameId: g.id });
  await B.gameWhere(x => x.drawOfferBy === 'w');
  await B.send({ t: 'drawAccept', gameId: g.id });
  g = await A.gameWhere(x => x.status.over);
  ok(g.status.result === '1/2-1/2' && g.status.reason === 'agreement', 'draw by agreement');
  ok(g.ratingChange && Math.abs(g.ratingChange.w) <= 1, 'rated draw between equals: ~0 change');
  await A.wait(m => m.t === 'me');

  console.log('rematch + abort');
  await A.send({ t: 'rematch', gameId: g.id });
  ok((await B.gameWhere(x => x.id === g.id && x.rematchBy === 'w')).rematchBy === 'w', 'rematch request visible');
  await B.send({ t: 'rematch', gameId: g.id });
  const g2 = await A.gameWhere(x => x.id !== g.id && !x.status.over);
  ok(g2.white.id === wb.id && g2.black.id === wa.id, 'rematch started with colors swapped');
  await B.send({ t: 'abort', gameId: g2.id });
  const ab = await A.gameWhere(x => x.id === g2.id && x.status.over);
  ok(ab.status.reason === 'aborted' && !ab.ratingChange, 'abort before first moves: unrated');

  console.log('resign, rating caps');
  g = await newGame(A, B);
  await play(A, B, g.id, ['e2e4', 'e7e5']);
  await A.send({ t: 'resign', gameId: g.id });
  g = await B.gameWhere(x => x.id === g.id && x.status.over);
  ok(g.status.result === '0-1' && g.status.reason === 'resignation', 'resignation');
  ok(!g.ratingChange, 'game with fewer than 4 plies is unrated');
  g = await newGame(A, B);
  await A.send({ t: 'move', gameId: g.id, uci: 'e2e4', ply: 0 });
  await sleep(100);
  await A.send({ t: 'abort', gameId: g.id });
  ok((await A.gameWhere(x => x.id === g.id && x.status.over)).status.reason === 'aborted', 'abort allowed after one move');
  g = await newGame(A, B);
  await play(A, B, g.id, ['e2e4', 'e7e5']);
  await A.send({ t: 'abort', gameId: g.id });
  ok((await A.wait(m => m.t === 'error')).code === 'tooLateToAbort', 'abort refused after both moved');
  await play(A, B, g.id, ['d2d4', 'd7d5'], 2);
  await B.send({ t: 'resign', gameId: g.id });
  g = await A.gameWhere(x => x.id === g.id && x.status.over);
  ok(g.status.result === '1-0', 'black resigned');
  ok(g.ratingChange.w === 50 && g.ratingChange.b === -50, 'provisional change capped at +/-50 (' + g.ratingChange.w + '/' + g.ratingChange.b + ')');
  const meA = await A.wait(m => m.t === 'me');
  ok(meA.games === 2 && meA.wins === 1 && meA.draws === 1, 'player record updated');
  // established players: cap 30
  await A.send({ t: 'test', op: 'setRating', r: 1000, rd: 105, games: 10 });
  await A.wait(m => m.t === 'me' && m.r === 1000);
  await B.send({ t: 'test', op: 'setRating', r: 1400, rd: 105, games: 10 });
  await B.wait(m => m.t === 'me' && m.r === 1400);
  g = await newGame(A, B);
  await play(A, B, g.id, ['e2e4', 'e7e5', 'd2d4', 'd7d5']);
  await B.send({ t: 'resign', gameId: g.id });
  g = await A.gameWhere(x => x.id === g.id && x.status.over);
  ok(g.ratingChange.w === 30 && g.ratingChange.b === -30, 'established change capped at +/-30 (' + g.ratingChange.w + '/' + g.ratingChange.b + ')');

  console.log('flag');
  g = await newGame(A, B, { base: 60, inc: 0 });
  await play(A, B, g.id, ['e2e4', 'e7e5']);
  await A.send({ t: 'test', op: 'setClocks', gameId: g.id, w: 1200, b: 60000 });
  g = await B.gameWhere(x => x.id === g.id && x.status.over, 5000);
  ok(g.status.result === '0-1' && g.status.reason === 'timeout' && g.clocks.w === 0, 'white flagged via alarm');

  console.log('first-move timeout');
  g = await newGame(A, B);
  g = await A.gameWhere(x => x.id === g.id && x.status.over, 6000);
  ok(g.status.reason === 'aborted', 'no first move within limit: aborted');

  console.log('reconnect');
  g = await newGame(A, B);
  await play(A, B, g.id, ['e2e4', 'e7e5']);
  await A.closeAndWait();
  ok((await B.gameWhere(x => x.id === g.id && x.disconnected.w)).disconnected.w, 'opponent sees disconnect');
  const back = await A.connect('Alice');
  ok(back.id === wa.id, 'same key -> same player id');
  const rg = await A.gameWhere(x => x.id === g.id);
  ok(!rg.status.over && rg.moves.length === 2 && rg.disconnected.w === false, 'game state restored on reconnect');
  await play(A, B, g.id, ['g1f3'], 2);
  await B.closeAndWait(); // black to move, disconnected
  g = await A.gameWhere(x => x.id === g.id && x.status.over, 8000);
  ok(g.status.result === '1-0' && g.status.reason === 'timeout', 'disconnected too long on own turn: loses on time');
  await B.connect('Bob');

  console.log('quick pairing');
  await A.send({ t: 'test', op: 'setRating', r: 800, rd: 200, games: 1 });
  await A.wait(m => m.t === 'me' && m.r === 800);
  A.drain(); C.drain();
  await A.send({ t: 'quick', tc: { base: 300, inc: 0 } });
  await C.send({ t: 'quick', tc: { base: 300, inc: 0 } });
  g = await A.gameWhere(x => !x.status.over, 3000);
  ok((g.white.id === wa.id && g.black.id === wc.id) || (g.white.id === wc.id && g.black.id === wa.id), 'close ratings paired instantly');
  await A.send({ t: 'abort', gameId: g.id });
  await A.gameWhere(x => x.id === g.id && x.status.over);
  await B.send({ t: 'test', op: 'setRating', r: 980, rd: 200, games: 1 });
  await B.wait(m => m.t === 'me' && m.r === 980);
  A.drain(); B.drain();
  await A.send({ t: 'quick', tc: { base: 600, inc: 5 } });
  await B.send({ t: 'quick', tc: { base: 600, inc: 5 } });
  ok(await A.none(m => m.t === 'game', 1500), '180 apart: not paired at once');
  const t0 = Date.now();
  g = await A.gameWhere(x => !x.status.over, 15000);
  ok(g.tc.base === 600 && Date.now() - t0 > 4000, 'paired after window widened (' + (Date.now() - t0 + 1500) + ' ms)');
  await A.send({ t: 'abort', gameId: g.id });
  await A.gameWhere(x => x.id === g.id && x.status.over);

  console.log('limits');
  const R = new Client('R');
  await R.connect('Rate Tester');
  R.raw('x'.repeat(3000));
  ok((await R.wait(m => m.t === 'error')).code === 'tooBig', 'oversized message rejected');
  R.raw('{not json');
  R.raw({ t: 'stats' });
  ok(!!(await R.wait(m => m.t === 'stats')), 'malformed JSON ignored, socket still works');
  for (let i = 0; i < 25; i++) R.raw({ t: 'stats' });
  ok(!!(await R.wait(m => m.t === 'error' && m.code === 'rateLimit')), 'rate limit enforced');
  await sleep(600);
  ok(R.msgs.filter(m => m.t === 'stats').length <= 18, 'messages over the limit are dropped');
  R.close();

  console.log('leaderboard');
  await A.send({ t: 'test', op: 'setRating', r: 1234, rd: 90, games: 7 });
  await A.wait(m => m.t === 'me' && m.r === 1234);
  r = await fetch(BASE + '/leaderboard');
  const lb = (await r.json()).players;
  ok(r.headers.get('access-control-allow-origin') === '*', '/leaderboard has CORS header');
  ok(lb.length >= 1 && lb[0].id === wa.id && lb[0].r === 1234, 'leaderboard sorted, includes A');
  ok(!lb.some(p => p.id === wc.id), 'players under 5 rated games excluded');
  await A.send({ t: 'leaderboard' });
  ok((await A.wait(m => m.t === 'leaderboard')).players[0].id === wa.id, 'socket leaderboard');
  const st = await (await fetch(BASE + '/stats')).json();
  ok(st.online >= 3 && typeof st.games === 'number', '/stats online=' + st.online + ' games=' + st.games);

  console.log('browser client (src/lobby-client.js)');
  const src = readFileSync(join(ROOT, 'src', 'lobby-client.js'), 'utf8');
  const ctx = { WebSocket, crypto: globalThis.crypto, TextEncoder, btoa, atob, setTimeout, clearTimeout, setInterval, clearInterval, console, fetch, module: { exports: {} } };
  vm.runInNewContext(src, ctx);
  const LobbyClient = ctx.module.exports;
  const lc = new LobbyClient(BASE);
  const welcomed = new Promise(res => lc.on('welcome', res));
  const seeksSeen = new Promise(res => lc.on('seeks', res));
  lc.subscribeSeeks();
  lc.connect('Client Test');
  const w = await Promise.race([welcomed, sleep(5000).then(() => null)]);
  ok(w && w.name === 'Client Test' && lc.state === 'online', 'LobbyClient authenticates (no localStorage)');
  ok(Array.isArray(await Promise.race([seeksSeen, sleep(3000).then(() => null)])), 'LobbyClient re-subscribes after welcome');
  const lbc = await lc.fetchLeaderboard();
  ok(Array.isArray(lbc), 'LobbyClient.fetchLeaderboard');
  lc.disconnect();

  for (const c of [A, B, C]) c.close();
}

main().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  stopServer();
  process.exit(fail ? 1 : 0);
}).catch(err => {
  console.error(err);
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  stopServer();
  process.exit(1);
});
