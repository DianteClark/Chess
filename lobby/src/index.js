// Knight Club lobby — placeholder.
// For now this only answers a health check so we can confirm the Cloudflare setup works.
// Phase 3 will add the real lobby here: a list of open games and the WebRTC connection
// handshake. Games themselves stay peer-to-peer, so this server does very little work.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json' };

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'knightclub-lobby', version: 0, lobby: 'coming in phase 3' }), { headers: CORS });
    }
    return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404, headers: CORS });
  },
};
