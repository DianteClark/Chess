// Knight Club lobby Durable Object: one global instance holds every seek and live game.
// Free-plan friendly: SQLite-backed storage, WebSocket Hibernation API, one DO alarm for
// every timed event (flags, first-move aborts, disconnect losses, quick-pair widening).
// The protocol is documented in lobby/PROTOCOL.md.
import ChessEngineFactory from './chess-engine.js';
import { update as glickoUpdate, DEFAULT_RATING, PROVISIONAL_RD } from './glicko.js';
import { sanitizeName } from './names.js';

const AUTH_PREFIX = 'knightclub-auth:';
const TIME_CONTROLS = ['60+0', '180+0', '180+2', '300+0', '600+0', '600+5', '900+10', '1800+0'];
const CHAT_CODES = ['hi', 'gl', 'gg', 'wp', 'ty', 'oops', 'thinking', 'rematch?'];
const MAX_MSG_BYTES = 2048;
const RATE_WINDOW_MS = 5000, RATE_MAX = 20;
const FIRST_MOVE_MS = 30000;      // no first move within this -> game aborted
const DISCONNECT_MS = 60000;      // gone this long on your own turn -> lose on time
const KEEP_FINISHED_MS = 10 * 60000; // finished games stay in memory for rematch / reconnect
const QUICK_WINDOW = 100, QUICK_STEP = 50, QUICK_STEP_MS = 5000, QUICK_MAX_WINDOW = 1500;
const MAX_DRAW_OFFERS = 3, MAX_CHAT_PER_GAME = 30;
const MAX_SEEKS_LISTED = 100;
const MIN_RATED_PLIES = 4;
const LEADERBOARD_MIN_GAMES = 5;

const enc = new TextEncoder();
function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function randId(n = 9) { return b64u(crypto.getRandomValues(new Uint8Array(n))); }
const tcKey = tc => tc.base + '+' + tc.inc;
const other = side => (side === 'w' ? 'b' : 'w');

let Engine = null;
function engine() { return Engine || (Engine = ChessEngineFactory()); }

export class Lobby {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.test = env.TEST_HOOKS === '1';
    this.firstMoveMs = (this.test && +env.FIRST_MOVE_MS) || FIRST_MOVE_MS;
    this.disconnectMs = (this.test && +env.DISCONNECT_MS) || DISCONNECT_MS;
    this.games = new Map();      // id -> live game object (persisted in live_games)
    this.seeks = new Map();      // id -> seek (persisted in seeks)
    this.positions = new Map();  // id -> engine Position (rebuilt on demand)
    this.rate = new Map();       // connection id -> {start, count}
    this.alarmAt = null;
    // keepalive pings are answered by the runtime without waking the object
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}')); } catch (e) { /* older runtime */ }
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, r REAL NOT NULL, rd REAL NOT NULL, vol REAL NOT NULL,
        games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, seen INTEGER NOT NULL)`);
      this.sql.exec('CREATE INDEX IF NOT EXISTS players_rating ON players (games, r)');
      this.sql.exec(`CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY, white TEXT NOT NULL, black TEXT NOT NULL, tc TEXT NOT NULL, rated INTEGER NOT NULL,
        moves TEXT NOT NULL, result TEXT NOT NULL, reason TEXT NOT NULL, white_change REAL, black_change REAL,
        started INTEGER NOT NULL, ended INTEGER NOT NULL)`);
      this.sql.exec('CREATE TABLE IF NOT EXISTS live_games (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS seeks (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
      for (const row of this.sql.exec('SELECT data FROM live_games')) {
        const g = JSON.parse(row.data);
        this.games.set(g.id, g);
      }
      for (const row of this.sql.exec('SELECT data FROM seeks')) {
        const s = JSON.parse(row.data);
        this.seeks.set(s.id, s);
      }
      // after a real restart (not hibernation) sockets are gone: drop orphaned seeks and
      // mark players of live games as disconnected so the normal timeouts apply
      const now = Date.now();
      const online = this.onlinePids();
      for (const s of [...this.seeks.values()]) if (!online.has(s.pid)) this.removeSeek(s.id);
      for (const g of this.games.values()) {
        if (g.status.over) continue;
        for (const side of ['w', 'b']) {
          const pid = this.pidOf(g, side);
          if (!online.has(pid) && !g.disc[side]) { g.disc[side] = now; this.saveGame(g); }
        }
      }
      this.alarmAt = await ctx.storage.getAlarm();
      this.scheduleAlarm();
    });
  }

  // ---------------------------------------------------------------- HTTP
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const pair = new WebSocketPair();
      const nonce = randId(24);
      const cid = randId(6);
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ cid, nonce, pid: null, name: null, subs: [] });
      pair[1].send(JSON.stringify({ t: 'challenge', nonce, prefix: AUTH_PREFIX }));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname === '/leaderboard') return Response.json({ players: this.leaderboard() });
    if (url.pathname === '/stats') return Response.json(this.stats());
    return new Response('not found', { status: 404 });
  }

  // ---------------------------------------------------------------- sockets
  sockets() {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === 1);
  }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch (e) { return {}; } }
  socketsOf(pid, except) {
    return this.sockets().filter(ws => ws !== except && this.att(ws).pid === pid);
  }
  onlinePids(except) {
    const s = new Set();
    for (const ws of this.sockets()) { if (ws === except) continue; const a = this.att(ws); if (a.pid) s.add(a.pid); }
    return s;
  }
  send(ws, msg) { try { ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (e) { /* closed */ } }
  sendTo(pid, msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.socketsOf(pid)) this.send(ws, data);
  }
  err(ws, code, extra) { this.send(ws, Object.assign({ t: 'error', code }, extra || {})); }

  async webSocketMessage(ws, message) {
    const a = this.att(ws);
    // rate limit per connection (in memory; resets if the object hibernates, which only happens when idle)
    const now = Date.now();
    let rl = this.rate.get(a.cid);
    if (!rl || now - rl.start > RATE_WINDOW_MS) { rl = { start: now, count: 0, warned: false }; this.rate.set(a.cid, rl); }
    if (++rl.count > RATE_MAX) {
      if (!rl.warned) { rl.warned = true; this.err(ws, 'rateLimit'); }
      return;
    }
    if (typeof message !== 'string') return;
    if (message.length > MAX_MSG_BYTES) { this.err(ws, 'tooBig'); return; }
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;

    if (!a.pid) {
      if (m.t === 'auth') await this.onAuth(ws, a, m);
      else this.err(ws, 'notAuthed');
      return;
    }
    const pid = a.pid;
    switch (m.t) {
      case 'subscribe': return this.onSubscribe(ws, a, m, true);
      case 'unsubscribe': return this.onSubscribe(ws, a, m, false);
      case 'seek': return this.onSeek(ws, pid, m, false);
      case 'quick': return this.onSeek(ws, pid, m, true);
      case 'cancelSeek': return this.onCancelSeek(pid);
      case 'accept': return this.onAccept(ws, pid, m);
      case 'move': return this.onMove(ws, pid, m);
      case 'resign': case 'drawOffer': case 'drawAccept': case 'drawDecline': case 'abort': case 'rematch':
        return this.onGameAction(ws, pid, m);
      case 'chat': return this.onChat(ws, pid, m);
      case 'leaderboard': return this.send(ws, { t: 'leaderboard', players: this.leaderboard() });
      case 'stats': return this.send(ws, Object.assign({ t: 'stats' }, this.stats()));
      case 'ping': return this.send(ws, { t: 'pong', now });
      case 'test': if (this.test) return this.onTest(ws, pid, m); return;
      default: this.err(ws, 'unknown');
    }
  }

  async webSocketClose(ws) { this.onSocketGone(ws); }
  async webSocketError(ws) { this.onSocketGone(ws); }

  onSocketGone(ws) {
    const a = this.att(ws);
    this.rate.delete(a.cid);
    try { ws.close(1000, 'bye'); } catch (e) { /* already closed */ }
    if (!a.pid) return;
    if (this.socketsOf(a.pid, ws).length) return; // still connected in another tab
    const now = Date.now();
    let seeksChanged = false;
    for (const s of [...this.seeks.values()]) if (s.pid === a.pid) { this.removeSeek(s.id); seeksChanged = true; }
    if (seeksChanged) this.broadcastSeeks();
    for (const g of this.games.values()) {
      const side = this.sideOf(g, a.pid);
      if (!side) continue;
      if (!g.status.over) { g.disc[side] = now; this.saveGame(g); this.pushGame(g); }
      else if (g.rematch[side]) { g.rematch[side] = false; this.saveGame(g); this.pushGame(g); }
    }
    this.scheduleAlarm();
  }

  // ---------------------------------------------------------------- auth
  async onAuth(ws, a, m) {
    const nonce = a.nonce;
    a.nonce = null; // one attempt per connection
    ws.serializeAttachment(a);
    const pub = m.pub;
    let ok = false, pid = null;
    try {
      if (!nonce || !pub || pub.kty !== 'EC' || pub.crv !== 'P-256' || typeof pub.x !== 'string' || typeof pub.y !== 'string' ||
          pub.x.length > 64 || pub.y.length > 64 || typeof m.sig !== 'string' || m.sig.length > 200) throw new Error('bad');
      const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, ext: true },
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(m.sig), enc.encode(AUTH_PREFIX + nonce));
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(pub.x + '.' + pub.y)));
      pid = b64u(digest.slice(0, 9));
    } catch (e) { ok = false; }
    if (!ok) { this.err(ws, 'authFailed'); try { ws.close(4001, 'auth failed'); } catch (e) {} return; }

    const now = Date.now();
    let p = this.getPlayer(pid);
    let name = sanitizeName(m.name);
    const nameRejected = m.name != null && !name;
    if (!name) name = p ? p.name : 'Player-' + pid.slice(0, 4);
    if (!p) {
      p = { id: pid, name, ...DEFAULT_RATING, wins: 0, losses: 0, draws: 0 };
      this.sql.exec('INSERT INTO players (id, name, r, rd, vol, games, wins, losses, draws, created, seen) VALUES (?,?,?,?,?,0,0,0,0,?,?)',
        pid, name, p.r, p.rd, p.vol, now, now);
    } else {
      p.name = name;
      this.sql.exec('UPDATE players SET name = ?, seen = ? WHERE id = ?', name, now, pid);
    }
    a.pid = pid; a.name = name;
    ws.serializeAttachment(a);
    this.send(ws, Object.assign({ t: 'welcome', now }, this.publicMe(p)));
    if (nameRejected) this.err(ws, 'badName');
    // reconnect: hand back live and recently finished games, stop the disconnect timer
    for (const g of this.games.values()) {
      const side = this.sideOf(g, pid);
      if (!side) continue;
      if (g.disc[side]) { g.disc[side] = null; this.saveGame(g); this.pushGame(g); }
      else this.send(ws, this.gameMsg(g));
    }
    const mine = [...this.seeks.values()].find(s => s.pid === pid);
    if (mine) this.send(ws, { t: 'mySeek', seek: this.publicSeek(mine) });
    this.scheduleAlarm();
  }

  // ---------------------------------------------------------------- players
  getPlayer(pid) {
    const rows = this.sql.exec('SELECT * FROM players WHERE id = ?', pid).toArray();
    return rows[0] || null;
  }
  publicMe(p) {
    return { id: p.id, name: p.name, r: Math.round(p.r), rd: Math.round(p.rd), games: p.games,
      provisional: p.rd > PROVISIONAL_RD, wins: p.wins, losses: p.losses, draws: p.draws };
  }
  leaderboard() {
    return this.sql.exec('SELECT id, name, r, rd, games, wins, losses, draws FROM players WHERE games >= ? ORDER BY r DESC LIMIT 50',
      LEADERBOARD_MIN_GAMES).toArray().map(p => ({ id: p.id, name: p.name, r: Math.round(p.r), rd: Math.round(p.rd),
      games: p.games, wins: p.wins, losses: p.losses, draws: p.draws }));
  }
  stats() {
    let live = 0;
    for (const g of this.games.values()) if (!g.status.over) live++;
    return { online: this.onlinePids().size, games: live, seeks: this.seeks.size };
  }

  // ---------------------------------------------------------------- seeks
  onSubscribe(ws, a, m, on) {
    if (m.what !== 'seeks') return this.err(ws, 'badSubscribe');
    const subs = new Set(a.subs || []);
    if (on) subs.add('seeks'); else subs.delete('seeks');
    a.subs = [...subs];
    ws.serializeAttachment(a);
    if (on) this.send(ws, { t: 'seeks', list: this.seekList() });
  }
  publicSeek(s) {
    return { id: s.id, pid: s.pid, name: s.name, r: Math.round(s.r), provisional: s.provisional, tc: s.tc,
      color: s.color, rated: s.rated, quick: s.quick, created: s.created };
  }
  seekList() {
    return [...this.seeks.values()].filter(s => !s.quick).slice(0, MAX_SEEKS_LISTED).map(s => this.publicSeek(s));
  }
  broadcastSeeks() {
    const data = JSON.stringify({ t: 'seeks', list: this.seekList() });
    for (const ws of this.sockets()) if ((this.att(ws).subs || []).includes('seeks')) this.send(ws, data);
  }
  saveSeek(s) { this.seeks.set(s.id, s); this.sql.exec('INSERT OR REPLACE INTO seeks (id, data) VALUES (?, ?)', s.id, JSON.stringify(s)); }
  removeSeek(id) { this.seeks.delete(id); this.sql.exec('DELETE FROM seeks WHERE id = ?', id); }
  validTc(tc) {
    if (!tc || typeof tc !== 'object') return null;
    const base = +tc.base, inc = +tc.inc;
    if (!TIME_CONTROLS.includes(base + '+' + inc)) return null;
    return { base, inc };
  }
  activeGameOf(pid) {
    for (const g of this.games.values()) if (!g.status.over && this.sideOf(g, pid)) return g;
    return null;
  }

  onSeek(ws, pid, m, quick) {
    const tc = this.validTc(m.tc);
    if (!tc) return this.err(ws, 'badTimeControl');
    if (this.activeGameOf(pid)) return this.err(ws, 'inGame');
    const color = quick ? 'r' : (['w', 'b', 'r'].includes(m.color) ? m.color : 'r');
    const rated = quick ? m.rated !== false : m.rated !== false && m.rated !== 0;
    const p = this.getPlayer(pid);
    // one open seek per player: a new one replaces the old one
    for (const s of [...this.seeks.values()]) if (s.pid === pid) this.removeSeek(s.id);
    const seek = { id: randId(6), pid, name: p.name, r: p.r, provisional: p.rd > PROVISIONAL_RD, tc, color, rated: !!rated,
      quick, created: Date.now() };
    this.saveSeek(seek);
    this.sendTo(pid, { t: 'mySeek', seek: this.publicSeek(seek) });
    if (quick) this.matchQuick();
    this.broadcastSeeks();
    this.scheduleAlarm();
  }

  onCancelSeek(pid) {
    let changed = false;
    for (const s of [...this.seeks.values()]) if (s.pid === pid) { this.removeSeek(s.id); changed = true; }
    if (!changed) return;
    this.sendTo(pid, { t: 'mySeek', seek: null });
    this.broadcastSeeks();
    this.scheduleAlarm();
  }

  onAccept(ws, pid, m) {
    const s = this.seeks.get(m.seekId);
    if (!s || s.quick) return this.err(ws, 'seekGone');
    if (s.pid === pid) return this.err(ws, 'ownSeek');
    if (this.activeGameOf(pid)) return this.err(ws, 'inGame');
    let ownerColor = s.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : s.color;
    const owner = s.pid;
    this.startGame(ownerColor === 'w' ? owner : pid, ownerColor === 'w' ? pid : owner, s.tc, s.rated);
  }

  quickWindow(s, now) {
    return Math.min(QUICK_MAX_WINDOW, QUICK_WINDOW + QUICK_STEP * Math.floor((now - s.created) / QUICK_STEP_MS));
  }
  // pair waiting quick seekers: oldest first, each with the closest-rated partner inside the window
  matchQuick() {
    const now = Date.now();
    const buckets = new Map();
    for (const s of this.seeks.values()) {
      if (!s.quick) continue;
      const k = tcKey(s.tc) + (s.rated ? 'R' : 'C');
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    let paired = false;
    for (const list of buckets.values()) {
      list.sort((x, y) => x.created - y.created);
      const used = new Set();
      for (const a of list) {
        if (used.has(a.id)) continue;
        let best = null, bestDiff = Infinity;
        for (const b of list) {
          if (b === a || used.has(b.id) || b.pid === a.pid) continue;
          const diff = Math.abs(a.r - b.r);
          if (diff <= Math.max(this.quickWindow(a, now), this.quickWindow(b, now)) && diff < bestDiff) { best = b; bestDiff = diff; }
        }
        if (!best) continue;
        used.add(a.id); used.add(best.id);
        const aWhite = Math.random() < 0.5;
        this.startGame(aWhite ? a.pid : best.pid, aWhite ? best.pid : a.pid, a.tc, a.rated, true);
        paired = true;
      }
    }
    return paired;
  }

  // ---------------------------------------------------------------- games
  pidOf(g, side) { return side === 'w' ? g.white.id : g.black.id; }
  sideOf(g, pid) { return g.white.id === pid ? 'w' : g.black.id === pid ? 'b' : null; }
  sideToMove(g) { return g.moves.length % 2 === 0 ? 'w' : 'b'; }
  clockRunning(g) { return !g.status.over && g.moves.length >= 2; }
  pos(g) {
    let p = this.positions.get(g.id);
    if (p && p.__ply === g.moves.length) return p;
    const E = engine();
    p = new E.Position();
    for (const u of g.moves) { const mv = p.moveFromUci(u); if (!mv) break; p.make(mv); }
    p.__ply = g.moves.length;
    this.positions.set(g.id, p);
    return p;
  }
  saveGame(g) { this.games.set(g.id, g); this.sql.exec('INSERT OR REPLACE INTO live_games (id, data) VALUES (?, ?)', g.id, JSON.stringify(g)); }
  dropGame(id) { this.games.delete(id); this.positions.delete(id); this.sql.exec('DELETE FROM live_games WHERE id = ?', id); }

  gameMsg(g) {
    return {
      t: 'game', id: g.id, white: g.white, black: g.black, tc: g.tc, rated: g.rated, moves: g.moves,
      clocks: g.clocks, turnStartedAt: g.turnStartedAt, clockRunning: this.clockRunning(g), now: Date.now(),
      firstMoveDeadline: !g.status.over && g.moves.length < 2 ? g.turnStartedAt + this.firstMoveMs : null,
      status: g.status, drawOfferBy: g.drawOfferBy, rematchBy: g.rematch.w && g.rematch.b ? 'both' : g.rematch.w ? 'w' : g.rematch.b ? 'b' : null,
      rematchId: g.rematchId || null, disconnected: { w: !!g.disc.w, b: !!g.disc.b }, ratingChange: g.ratingChange || null,
    };
  }
  pushGame(g) {
    const data = JSON.stringify(this.gameMsg(g));
    for (const ws of this.sockets()) {
      const pid = this.att(ws).pid;
      if (pid && (pid === g.white.id || pid === g.black.id)) this.send(ws, data);
    }
  }

  startGame(whitePid, blackPid, tc, rated, fromQuick) {
    const now = Date.now();
    const pw = this.getPlayer(whitePid), pb = this.getPlayer(blackPid);
    for (const s of [...this.seeks.values()]) if (s.pid === whitePid || s.pid === blackPid) this.removeSeek(s.id);
    const g = {
      id: randId(6), white: { id: pw.id, name: pw.name, r: Math.round(pw.r) }, black: { id: pb.id, name: pb.name, r: Math.round(pb.r) },
      tc, rated: !!rated, moves: [], clocks: { w: tc.base * 1000, b: tc.base * 1000 }, turnStartedAt: now, started: now,
      status: { over: false }, drawOfferBy: null, drawOffers: { w: 0, b: 0 }, chats: { w: 0, b: 0 },
      rematch: { w: false, b: false }, rematchId: null, disc: { w: null, b: null }, endedAt: null, ratingChange: null,
    };
    // a player whose sockets are all gone starts disconnected
    const online = this.onlinePids();
    for (const side of ['w', 'b']) if (!online.has(this.pidOf(g, side))) g.disc[side] = now;
    this.saveGame(g);
    this.sendTo(whitePid, { t: 'mySeek', seek: null });
    this.sendTo(blackPid, { t: 'mySeek', seek: null });
    this.pushGame(g);
    if (!fromQuick) this.broadcastSeeks();
    this.scheduleAlarm();
    return g;
  }

  findGame(pid, gameId) {
    if (typeof gameId === 'string') {
      const g = this.games.get(gameId);
      return g && this.sideOf(g, pid) ? g : null;
    }
    // no id given: the active game, else the most recently finished one
    let best = null;
    for (const g of this.games.values()) {
      if (!this.sideOf(g, pid)) continue;
      if (!g.status.over) return g;
      if (!best || g.endedAt > best.endedAt) best = g;
    }
    return best;
  }

  onMove(ws, pid, m) {
    const g = this.findGame(pid, m.gameId);
    if (!g) return this.err(ws, 'noGame');
    const side = this.sideOf(g, pid);
    const ply = g.moves.length;
    if (typeof m.uci !== 'string' || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(m.uci)) return this.err(ws, 'badMove', { gameId: g.id });
    if (Number.isInteger(m.ply) && m.ply < ply && g.moves[m.ply] === m.uci) return; // duplicate, already applied
    if (g.status.over) { this.send(ws, this.gameMsg(g)); return this.err(ws, 'gameOver', { gameId: g.id }); }
    if (side !== this.sideToMove(g)) { this.send(ws, this.gameMsg(g)); return this.err(ws, 'notYourTurn', { gameId: g.id }); }
    if (Number.isInteger(m.ply) && m.ply !== ply) { this.send(ws, this.gameMsg(g)); return this.err(ws, 'badPly', { gameId: g.id }); }
    const now = Date.now();
    if (this.clockRunning(g)) {
      const elapsed = now - g.turnStartedAt;
      if (elapsed >= g.clocks[side]) { this.flag(g, side, now); return; }
    }
    const p = this.pos(g);
    const mv = p.moveFromUci(m.uci);
    if (!mv) { this.send(ws, this.gameMsg(g)); return this.err(ws, 'illegal', { gameId: g.id, uci: m.uci }); }
    if (this.clockRunning(g)) {
      g.clocks[side] = g.clocks[side] - (now - g.turnStartedAt) + g.tc.inc * 1000;
    }
    p.make(mv);
    g.moves.push(m.uci);
    p.__ply = g.moves.length;
    g.turnStartedAt = now;
    g.disc[side] = null;
    if (g.drawOfferBy && g.drawOfferBy !== side) g.drawOfferBy = null; // moving declines a pending offer
    const st = p.status();
    if (st.over) return this.endGame(g, st.result, st.reason, now);
    this.saveGame(g);
    this.pushGame(g);
    this.scheduleAlarm();
  }

  onGameAction(ws, pid, m) {
    const g = this.findGame(pid, m.gameId);
    if (!g) return this.err(ws, 'noGame');
    const side = this.sideOf(g, pid), opp = other(side);
    const now = Date.now();
    if (m.t === 'rematch') return this.onRematch(ws, g, side, now);
    if (g.status.over) return this.err(ws, 'gameOver', { gameId: g.id });
    switch (m.t) {
      case 'resign':
        return this.endGame(g, side === 'w' ? '0-1' : '1-0', 'resignation', now);
      case 'abort':
        if (g.moves.length >= 2) return this.err(ws, 'tooLateToAbort', { gameId: g.id });
        return this.endGame(g, '*', 'aborted', now);
      case 'drawOffer':
        if (g.drawOfferBy === opp) return this.endGame(g, '1/2-1/2', 'agreement', now);
        if (g.drawOfferBy === side) return;
        if (g.drawOffers[side] >= MAX_DRAW_OFFERS) return this.err(ws, 'tooManyOffers', { gameId: g.id });
        g.drawOffers[side]++;
        g.drawOfferBy = side;
        break;
      case 'drawAccept':
        if (g.drawOfferBy !== opp) return this.err(ws, 'noOffer', { gameId: g.id });
        return this.endGame(g, '1/2-1/2', 'agreement', now);
      case 'drawDecline':
        if (g.drawOfferBy !== opp) return;
        g.drawOfferBy = null;
        break;
    }
    this.saveGame(g);
    this.pushGame(g);
  }

  onRematch(ws, g, side, now) {
    if (!g.status.over) return this.err(ws, 'gameNotOver', { gameId: g.id });
    if (g.rematchId) return this.err(ws, 'rematchDone', { gameId: g.id });
    const opp = other(side);
    if (!this.socketsOf(this.pidOf(g, opp)).length) return this.err(ws, 'opponentGone', { gameId: g.id });
    g.rematch[side] = true;
    if (g.rematch[opp]) {
      if (this.activeGameOf(g.white.id) || this.activeGameOf(g.black.id)) {
        g.rematch = { w: false, b: false };
        this.saveGame(g); this.pushGame(g);
        return this.err(ws, 'inGame');
      }
      const ng = this.startGame(g.black.id, g.white.id, g.tc, g.rated); // colors swapped
      g.rematchId = ng.id;
    }
    this.saveGame(g);
    this.pushGame(g);
  }

  onChat(ws, pid, m) {
    if (!CHAT_CODES.includes(m.code)) return this.err(ws, 'badChat');
    const g = this.findGame(pid, m.gameId);
    if (!g) return this.err(ws, 'noGame');
    const side = this.sideOf(g, pid);
    if (g.chats[side] >= MAX_CHAT_PER_GAME) return this.err(ws, 'chatLimit');
    g.chats[side]++;
    this.saveGame(g);
    const msg = { t: 'chat', gameId: g.id, from: side, name: side === 'w' ? g.white.name : g.black.name, code: m.code };
    this.sendTo(g.white.id, msg);
    this.sendTo(g.black.id, msg);
  }

  // side ran out of time (or stayed disconnected too long on its own turn)
  flag(g, side, now, disconnected) {
    if (!disconnected && this.clockRunning(g)) g.clocks[side] = 0;
    // the side that did NOT flag can only win if it has mating material (more than a lone king or king + one minor)
    const p = this.pos(g);
    const winnerColor = side === 'w' ? 8 : 0; // engine: black pieces have bit 8
    let pieces = 0, minors = 0, heavy = false;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const v = p.board[sq];
      if (!v || (v & 8) !== winnerColor) continue;
      const t = v & 7;
      if (t === 6) continue;
      pieces++;
      if (t === 2 || t === 3) minors++; else heavy = true;
    }
    const insufficient = !heavy && pieces <= 1 && minors <= 1;
    if (insufficient) return this.endGame(g, '1/2-1/2', 'timeout vs insufficient material', now, true);
    return this.endGame(g, side === 'w' ? '0-1' : '1-0', 'timeout', now, true);
  }

  endGame(g, result, reason, now, clocksFinal) {
    if (g.status.over) return;
    if (!clocksFinal && this.clockRunning(g)) {
      const side = this.sideToMove(g);
      g.clocks[side] = Math.max(0, g.clocks[side] - (now - g.turnStartedAt));
    }
    g.status = { over: true, result, reason };
    g.endedAt = now;
    g.turnStartedAt = now;
    g.drawOfferBy = null;
    const rated = g.rated && result !== '*' && g.moves.length >= MIN_RATED_PLIES;
    let wc = null, bc = null;
    if (rated) {
      const pw = this.getPlayer(g.white.id), pb = this.getPlayer(g.black.id);
      const sw = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
      const nw = glickoUpdate(pw, pb, sw), nb = glickoUpdate(pb, pw, 1 - sw);
      const col = s => (s === 1 ? 'wins' : s === 0 ? 'losses' : 'draws');
      this.sql.exec(`UPDATE players SET r = ?, rd = ?, vol = ?, games = games + 1, ${col(sw)} = ${col(sw)} + 1 WHERE id = ?`, nw.r, nw.rd, nw.vol, pw.id);
      this.sql.exec(`UPDATE players SET r = ?, rd = ?, vol = ?, games = games + 1, ${col(1 - sw)} = ${col(1 - sw)} + 1 WHERE id = ?`, nb.r, nb.rd, nb.vol, pb.id);
      wc = Math.round(nw.r) - Math.round(pw.r);
      bc = Math.round(nb.r) - Math.round(pb.r);
      g.ratingChange = { w: wc, b: bc, white: Math.round(nw.r), black: Math.round(nb.r) };
    }
    if (result !== '*') {
      this.sql.exec('INSERT OR REPLACE INTO games (id, white, black, tc, rated, moves, result, reason, white_change, black_change, started, ended) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        g.id, g.white.id, g.black.id, tcKey(g.tc), rated ? 1 : 0, g.moves.join(' '), result, reason, wc, bc, g.started, now);
    }
    this.saveGame(g);
    this.pushGame(g);
    if (rated) for (const pid of [g.white.id, g.black.id]) this.sendTo(pid, Object.assign({ t: 'me' }, this.publicMe(this.getPlayer(pid))));
    this.scheduleAlarm();
  }

  // ---------------------------------------------------------------- timers
  nextDeadline(g) {
    if (g.status.over) return g.endedAt + KEEP_FINISHED_MS;
    const side = this.sideToMove(g);
    let d = g.moves.length < 2 ? g.turnStartedAt + this.firstMoveMs : g.turnStartedAt + g.clocks[side];
    if (g.disc[side]) d = Math.min(d, Math.max(g.disc[side], g.turnStartedAt) + this.disconnectMs);
    return d;
  }
  scheduleAlarm() {
    const now = Date.now();
    let next = Infinity;
    for (const g of this.games.values()) next = Math.min(next, this.nextDeadline(g));
    // quick seekers who could not be paired yet: re-check when windows widen
    const counts = new Map();
    for (const s of this.seeks.values()) if (s.quick) { const k = tcKey(s.tc) + s.rated; counts.set(k, (counts.get(k) || 0) + 1); }
    if ([...counts.values()].some(n => n >= 2)) next = Math.min(next, now + QUICK_STEP_MS);
    if (next === Infinity) return;
    next = Math.max(next, now + 10);
    if (this.alarmAt && this.alarmAt > now && this.alarmAt <= next) return; // an earlier alarm is already set
    this.alarmAt = next;
    this.ctx.storage.setAlarm(next);
  }
  async alarm() {
    this.alarmAt = null;
    const now = Date.now();
    for (const g of [...this.games.values()]) {
      if (g.status.over) { if (now >= g.endedAt + KEEP_FINISHED_MS) this.dropGame(g.id); continue; }
      const side = this.sideToMove(g);
      if (g.moves.length < 2 && now >= g.turnStartedAt + this.firstMoveMs) { this.endGame(g, '*', 'aborted', now); continue; }
      if (this.clockRunning(g) && now >= g.turnStartedAt + g.clocks[side]) { this.flag(g, side, now); continue; }
      if (g.disc[side] && now >= Math.max(g.disc[side], g.turnStartedAt) + this.disconnectMs) {
        if (this.clockRunning(g)) g.clocks[side] = Math.max(0, g.clocks[side] - (now - g.turnStartedAt));
        this.flag(g, side, now, true);
      }
    }
    if (this.matchQuick()) this.broadcastSeeks();
    this.scheduleAlarm();
  }

  // ---------------------------------------------------------------- test hooks (only with TEST_HOOKS=1, never in production)
  onTest(ws, pid, m) {
    if (m.op === 'setClocks') {
      const g = this.findGame(pid, m.gameId);
      if (!g) return this.err(ws, 'noGame');
      g.clocks = { w: +m.w, b: +m.b };
      g.turnStartedAt = Date.now();
      this.saveGame(g); this.pushGame(g); this.scheduleAlarm();
    } else if (m.op === 'setRating') {
      this.sql.exec('UPDATE players SET r = ?, rd = ?, games = ? WHERE id = ?', +m.r, +m.rd, +m.games | 0, pid);
      this.send(ws, Object.assign({ t: 'me' }, this.publicMe(this.getPlayer(pid))));
    }
  }
}
