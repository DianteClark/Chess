// Knight Club online lobby client (browser, classic script, no dependencies).
// Talks to the lobby Worker (lobby/ folder, protocol in lobby/PROTOCOL.md).
// Identity: an ECDSA P-256 keypair kept in localStorage; the server derives the player id
// from the public key, so the same browser keeps the same rating without an account.
//
//   const lobby = new LobbyClient('https://knightclub-lobby.chesscomplex.workers.dev');
//   lobby.on('welcome', me => ...); lobby.on('game', g => ...); lobby.on('seeks', list => ...);
//   lobby.connect('MyName');
class LobbyClient {
  constructor(url) {
    let u = String(url || '').trim().replace(/\/+$/, '');
    if (/^http/i.test(u)) u = u.replace(/^http/i, 'ws');
    if (!/\/ws$/.test(u)) u += '/ws';
    this.url = u;
    this.httpUrl = u.replace(/^ws/i, 'http').replace(/\/ws$/, '');
    this.name = null;
    this.me = null;            // {id, name, r, rd, games, provisional, ...}
    this.games = {};           // id -> latest game state
    this.mySeek = null;
    this.seeks = [];
    this.state = 'offline';    // offline | connecting | online
    this.offset = 0;           // server clock minus local clock, ms
    this._ws = null;
    this._handlers = {};
    this._want = false;
    this._retry = 0;
    this._timer = null;
    this._ping = null;
    this._keys = null;
    this._subs = {};
  }

  // ---------------------------------------------------------------- events
  on(type, fn) {
    (this._handlers[type] || (this._handlers[type] = [])).push(fn);
    return () => { this._handlers[type] = (this._handlers[type] || []).filter(f => f !== fn); };
  }
  _emit(type, data) {
    for (const fn of (this._handlers[type] || []).slice()) {
      try { fn(data); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
    }
  }
  _setState(s) { if (this.state !== s) { this.state = s; this._emit('status', s); } }

  // ---------------------------------------------------------------- keys
  static _b64u(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async _getKeys() {
    if (this._keys) return this._keys;
    const subtle = typeof crypto !== 'undefined' && crypto.subtle;
    if (!subtle) throw new Error('WebCrypto is not available');
    const KEY = 'kc.lobby.key.v1';
    const alg = { name: 'ECDSA', namedCurve: 'P-256' };
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { stored = null; }
    if (stored && stored.pub && stored.priv) {
      try {
        const priv = await subtle.importKey('jwk', stored.priv, alg, false, ['sign']);
        this._keys = { priv, pub: { kty: 'EC', crv: 'P-256', x: stored.pub.x, y: stored.pub.y } };
        return this._keys;
      } catch (e) { /* corrupted: make a new one */ }
    }
    const pair = await subtle.generateKey(alg, true, ['sign', 'verify']);
    const pubJwk = await subtle.exportKey('jwk', pair.publicKey);
    const privJwk = await subtle.exportKey('jwk', pair.privateKey);
    try { localStorage.setItem(KEY, JSON.stringify({ pub: pubJwk, priv: privJwk })); } catch (e) { /* private mode: key lasts this session */ }
    this._keys = { priv: pair.privateKey, pub: { kty: 'EC', crv: 'P-256', x: pubJwk.x, y: pubJwk.y } };
    return this._keys;
  }

  // ---------------------------------------------------------------- connection
  connect(name) {
    if (name != null) this.name = name;
    this._want = true;
    if (this._ws && (this._ws.readyState === 0 || this._ws.readyState === 1)) return;
    this._open();
  }
  disconnect() {
    this._want = false;
    clearTimeout(this._timer);
    clearInterval(this._ping);
    if (this._ws) try { this._ws.close(1000); } catch (e) { /* ignore */ }
    this._ws = null;
    this._setState('offline');
  }
  setName(name) { this.name = name; if (this._ws) try { this._ws.close(1000); } catch (e) { /* reconnects with the new name */ } }

  _open() {
    clearTimeout(this._timer);
    this._setState('connecting');
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { this._scheduleReconnect(); return; }
    this._ws = ws;
    ws.onmessage = ev => { if (ws === this._ws) this._onMessage(ev.data); };
    ws.onclose = () => {
      if (ws !== this._ws) return;
      clearInterval(this._ping);
      this._ws = null;
      this._setState('offline');
      this._emit('close', null);
      if (this._want) this._scheduleReconnect();
    };
    ws.onerror = () => { /* onclose follows */ };
  }
  _scheduleReconnect() {
    clearTimeout(this._timer);
    const delay = Math.min(30000, 1000 * Math.pow(2, this._retry++)) * (0.75 + Math.random() * 0.5);
    this._timer = setTimeout(() => { if (this._want) this._open(); }, delay);
  }
  _send(obj) {
    if (!this._ws || this._ws.readyState !== 1 || (this.state !== 'online' && obj.t !== 'auth')) return false;
    try { this._ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  async _onMessage(data) {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'challenge': {
        try {
          const keys = await this._getKeys();
          const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.priv,
            new TextEncoder().encode((m.prefix || 'knightclub-auth:') + m.nonce));
          this._send({ t: 'auth', pub: keys.pub, sig: LobbyClient._b64u(sig), name: this.name });
        } catch (e) {
          this._emit('error', { code: 'noCrypto', message: String(e && e.message || e) });
          this.disconnect();
        }
        return;
      }
      case 'welcome':
        this._retry = 0;
        this.me = m;
        if (m.now) this.offset = m.now - Date.now();
        this._setState('online');
        clearInterval(this._ping);
        this._ping = setInterval(() => { try { this._ws && this._ws.readyState === 1 && this._ws.send('{"t":"ping"}'); } catch (e) { /* ignore */ } }, 45000);
        if (this._subs.seeks) this._send({ t: 'subscribe', what: 'seeks' });
        break;
      case 'me': this.me = Object.assign({}, this.me, m); break;
      case 'game':
        if (m.now) this.offset = m.now - Date.now();
        this.games[m.id] = m;
        break;
      case 'seeks': this.seeks = m.list || []; break;
      case 'mySeek': this.mySeek = m.seek; break;
    }
    this._emit(m.t, m.t === 'seeks' ? m.list : m.t === 'leaderboard' ? m.players : m);
    this._emit('message', m);
  }

  // remaining clock (ms) for side 'w' or 'b' of a game state, as of now
  clockFor(game, side) {
    if (!game || !game.clocks) return 0;
    let ms = game.clocks[side];
    const toMove = game.moves.length % 2 === 0 ? 'w' : 'b';
    if (game.clockRunning && side === toMove) ms -= (Date.now() + this.offset) - game.turnStartedAt;
    return Math.max(0, ms);
  }
  // 'w', 'b' or null for the signed-in player in a game state
  myColor(game) {
    if (!game || !this.me) return null;
    return game.white.id === this.me.id ? 'w' : game.black.id === this.me.id ? 'b' : null;
  }

  // ---------------------------------------------------------------- actions
  // tc: {base: seconds, inc: seconds}; color: 'w' | 'b' | 'r'
  seek(tc, color, rated) { return this._send({ t: 'seek', tc, color: color || 'r', rated: rated !== false }); }
  cancelSeek() { return this._send({ t: 'cancelSeek' }); }
  accept(seekId) { return this._send({ t: 'accept', seekId }); }
  quick(tc, rated) { return this._send({ t: 'quick', tc, rated: rated !== false }); }
  move(gameId, uci, ply) { return this._send({ t: 'move', gameId, uci, ply }); }
  resign(gameId) { return this._send({ t: 'resign', gameId }); }
  offerDraw(gameId) { return this._send({ t: 'drawOffer', gameId }); }
  acceptDraw(gameId) { return this._send({ t: 'drawAccept', gameId }); }
  declineDraw(gameId) { return this._send({ t: 'drawDecline', gameId }); }
  abort(gameId) { return this._send({ t: 'abort', gameId }); }
  rematch(gameId) { return this._send({ t: 'rematch', gameId }); }
  // code: 'hi' | 'gl' | 'gg' | 'wp' | 'ty' | 'oops' | 'thinking' | 'rematch?'
  chat(gameId, code) { return this._send({ t: 'chat', gameId, code }); }
  subscribeSeeks() { this._subs.seeks = true; return this._send({ t: 'subscribe', what: 'seeks' }); }
  unsubscribeSeeks() { this._subs.seeks = false; return this._send({ t: 'unsubscribe', what: 'seeks' }); }
  leaderboard() { return this._send({ t: 'leaderboard' }); }
  stats() { return this._send({ t: 'stats' }); }
  // HTTP versions (work without a socket)
  fetchLeaderboard() { return fetch(this.httpUrl + '/leaderboard').then(r => r.json()).then(j => j.players || []); }
  fetchStats() { return fetch(this.httpUrl + '/stats').then(r => r.json()); }
}
LobbyClient.TIME_CONTROLS = [[60, 0], [180, 0], [180, 2], [300, 0], [600, 0], [600, 5], [900, 10], [1800, 0]];
LobbyClient.CHAT_CODES = ['hi', 'gl', 'gg', 'wp', 'ty', 'oops', 'thinking', 'rematch?'];
if (typeof module !== 'undefined' && module.exports) module.exports = LobbyClient;
