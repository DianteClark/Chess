// Knight Club lobby Worker: routes HTTP and WebSocket traffic to the single global Lobby
// Durable Object. Friend games stay peer-to-peer (WebRTC) and never touch this server.
//   GET /health       -> {ok:true,...}
//   GET /leaderboard  -> {players:[...]} top 50 by rating (>= 5 rated games)
//   GET /stats        -> {online, games, seeks}
//   GET /ws           -> WebSocket upgrade (see PROTOCOL.md)
export { Lobby } from './lobby.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const lobby = () => env.LOBBY.get(env.LOBBY.idFromName('global'));
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'knightclub-lobby', version: 1 });
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'expected websocket' }, 426);
      return lobby().fetch(request);
    }
    if (request.method === 'GET' && (url.pathname === '/leaderboard' || url.pathname === '/stats')) {
      const res = await lobby().fetch(new Request(url.origin + url.pathname));
      return json(await res.json(), 200, { 'Cache-Control': 'public, max-age=' + (url.pathname === '/stats' ? 10 : 60) });
    }
    return json({ ok: false, error: 'not found' }, 404);
  },
};
