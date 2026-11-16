# Knight Club lobby protocol

Server: `https://knightclub-lobby.chesscomplex.workers.dev` (Cloudflare Worker + one SQLite-backed
Durable Object, WebSocket Hibernation API). Browser client: `src/lobby-client.js` (`LobbyClient`).

## HTTP (GET, CORS `*`)

| Path | Response |
|---|---|
| `/health` | `{ok:true, service, version}` |
| `/leaderboard` | `{players:[{id,name,r,rd,games,wins,losses,draws}]}` top 50 by rating, players with >= 5 rated games |
| `/stats` | `{online, games, seeks}` (distinct signed-in players, games in progress, open seeks) |
| `/ws` | WebSocket upgrade |

## WebSocket

All frames are JSON text, at most 2048 bytes. Malformed JSON and binary frames are ignored.
`{"t":"ping"}` is answered with `{"t":"pong"}` by the runtime (does not wake the server; use it as keepalive).

### Authentication

1. Server -> `{t:'challenge', nonce, prefix:'knightclub-auth:'}`
2. Client -> `{t:'auth', pub:{kty:'EC',crv:'P-256',x,y}, sig, name}`
   - `sig` = base64url of the WebCrypto ECDSA P-256 / SHA-256 signature (raw r||s, 64 bytes) over the UTF-8 bytes of `prefix + nonce`.
   - Player id = first 9 bytes of SHA-256(`x + '.' + y`), base64url (12 chars). Same key = same player.
   - One attempt per connection; failure -> `{t:'error',code:'authFailed'}` and close (4001).
3. Server -> `{t:'welcome', id, name, r, rd, games, provisional, wins, losses, draws, now}`, then a `game`
   message for every live or recently finished game of this player, and `mySeek` if one is open.

Names: 2-20 chars of letters, digits, space, `_`, `-`, passed through a word filter. A rejected name gives
`{t:'error',code:'badName'}` and the previous name (or `Player-xxxx`) is used.
Any other message before auth -> `error notAuthed`.

### Client -> server

| Message | Notes |
|---|---|
| `{t:'subscribe', what:'seeks'}` / `{t:'unsubscribe', what:'seeks'}` | receive `seeks` on every change |
| `{t:'seek', tc:{base,inc}, color:'w'\|'b'\|'r', rated:bool}` | public seek; replaces your open seek |
| `{t:'quick', tc, rated?}` | hidden pool, auto-paired (default rated) |
| `{t:'cancelSeek'}` | |
| `{t:'accept', seekId}` | starts a game |
| `{t:'move', gameId, uci, ply}` | `ply` = number of moves already played; a resend of an applied move is ignored |
| `{t:'resign'\|'drawOffer'\|'drawAccept'\|'drawDecline'\|'abort'\|'rematch', gameId}` | `gameId` optional: defaults to your live (else latest) game |
| `{t:'chat', gameId, code}` | `code` in `hi gl gg wp ty oops thinking rematch?`; anything else -> `error badChat` |
| `{t:'leaderboard'}` / `{t:'stats'}` | |

Time controls (`base+inc` seconds): `60+0 180+0 180+2 300+0 600+0 600+5 900+10 1800+0`.

### Server -> client

| Message | Notes |
|---|---|
| `{t:'seeks', list:[{id,pid,name,r,provisional,tc,color,rated,quick,created}]}` | full list (max 100), public seeks only |
| `{t:'mySeek', seek\|null}` | your open seek (null once cancelled or paired) |
| `{t:'game', ...}` | absolute game state, sent after every change (see below) |
| `{t:'chat', gameId, from:'w'\|'b', name, code}` | |
| `{t:'me', ...welcome fields}` | after a rated game |
| `{t:'leaderboard', players}` / `{t:'stats', online, games, seeks}` | |
| `{t:'error', code, gameId?}` | codes: `notAuthed authFailed badName badTimeControl inGame seekGone ownSeek noGame badMove illegal notYourTurn badPly gameOver tooLateToAbort tooManyOffers noOffer gameNotOver rematchDone opponentGone badChat chatLimit badSubscribe rateLimit tooBig unknown`. Move errors are preceded by a fresh `game` state. |

Game state:
```
{t:'game', id, white:{id,name,r}, black:{id,name,r}, tc:{base,inc}, rated, moves:[uci],
 clocks:{w:ms,b:ms}, turnStartedAt, clockRunning, now, firstMoveDeadline,
 status:{over, result:'1-0'|'0-1'|'1/2-1/2'|'*', reason}, drawOfferBy:'w'|'b'|null,
 rematchBy:'w'|'b'|'both'|null, rematchId, disconnected:{w,b},
 ratingChange:{w,b,white,black}|null}
```
Remaining time of the side to move = `clocks[side] - (serverNow - turnStartedAt)` when `clockRunning`;
estimate server time from `now`. Reasons: `checkmate stalemate insufficient material 50-move rule
threefold repetition resignation agreement timeout "timeout vs insufficient material" aborted`.

## Game rules

- Moves are validated by the same engine as the app (`src/chess-engine.js`, a generated copy of `src/engine.js`).
- Clocks start after both sides have made their first move. Before that either player may abort, and a
  side that does not make its first move within 30 s gets the game aborted.
- On each move: elapsed time is deducted, then the increment added. Flags are detected by a Durable
  Object alarm set for the exact flag moment (and also checked when a late move arrives).
- Flag: the flagging side loses, unless the opponent has only a king, or king + one bishop/knight: draw.
- Moving declines a pending draw offer. At most 3 draw offers per player per game.
- Rematch: both players send `rematch` after the game; a new game starts with colors swapped.
- Disconnect: the game continues and the clock keeps running. Reconnecting with the same key restores it.
  Disconnected for more than 60 s on your own turn (or running out of time) loses on time.
- Finished games stay available for rematch/reconnect for 10 minutes.

## Ratings (Glicko-2, one game per rating period, tau 0.5)

- New players: r 800, RD 250, volatility 0.06. Provisional while RD > 110.
- Change per game capped at +/-50 while provisional, +/-30 after. RD kept within 50-350; rating floor 100.
- Unrated: games with fewer than 4 plies, aborted games, and seeks with `rated:false`.

## Limits

- 1 live game and 1 open seek per player (a new seek replaces the old one).
- 20 messages per 5 s per connection; extra messages are dropped (one `error rateLimit`).
- 2 KB per message; 30 chat messages per player per game.
- Quick pairing: closest rating within a window of 100, widened by 50 every 5 s of waiting (max 1500).
  Checked on every new quick seek and by an alarm every 5 s while unpaired quick seekers exist (no polling).

## Development

```
cd lobby && npm install
node lobby/sync-engine.mjs          # after any change to src/engine.js
node tools/lobby_test.mjs           # starts wrangler dev with test hooks, runs end-to-end tests
npx wrangler deploy --dry-run --outdir /tmp/kc-dry
```
Test hooks (`{t:'test', op:'setClocks'|'setRating'}`) exist only when the `TEST_HOOKS` var is `1`,
which is passed on the `wrangler dev` command line and never set in `wrangler.jsonc`.
