# Knight Club Chess

A complete chess game in one HTML file, written from scratch with no game engine, no frameworks and no build dependencies. Play it on a phone or a computer.

## [Play now: dianteclark.github.io/Chess](https://dianteclark.github.io/Chess/)

Works on phones and computers. You can also download `index.html` and open it in any browser.

## What's inside

| | |
|---|---|
| **Play vs bots** | 8 bots from Pip (total beginner) to The Tower (full strength). Rated or casual (casual allows undo and hints). |
| **Friends** | **Pass & Play** on one device, or **Online**: true peer-to-peer over WebRTC. The two browsers connect directly, with no game server. |
| **Puzzles** | Checkmate puzzles (mate in 1, 2 and 3) plus famous named mates. Every puzzle's solution is proven by an exhaustive solver. |
| **Learn** | 16 interactive lessons for kids with Professor Hoot: the board, each piece ("collect the stars"), capturing, check, checkmate, castling, promotion, en passant, draws and tips. |
| ⭐ **Ratings** | Glicko-2 ratings for games and puzzles, with history graphs. |

## How online play works

1. The host taps **Friends → Play Online → Create invite** and sends the link to a friend.
2. The friend opens the link, taps **Join**, and sends back the reply code their screen shows.
3. The host pastes the reply code, and the devices connect directly over a WebRTC data channel.

Only the connection setup (an "SDP offer/answer") is passed by hand, which is why no server is needed. Public STUN servers help the two devices find each other. Very strict networks, like some school or office Wi-Fi, block direct connections. If that happens, try mobile data on one device. Both sides validate every move, so a tampered client can't make an illegal move.

## How the ratings were made

- **Player ratings** use **Glicko-2**. New players start at 800 with a "?" (provisional) mark until enough games are played.
- **Bot ratings are measured, not guessed.** The bots played a calibration tournament against each other (`tools/calibrate.js`). Their relative strengths were fitted by maximum likelihood (`tools/fit_elo.js`), and the scale was then pinned at two ends: Pip at 300 and The Tower at 2000. Bot-vs-bot results stretch rating gaps compared with human play, so the measured spacing is scaled to fit between those two points. Results are in `data/calibration.json`.
- **Puzzle ratings** are estimated from how much searching the engine needs to find the solution and how many tempting wrong moves (checks and captures) a position has.

These ratings compare fairly with each other inside Knight Club. They are estimates, not official FIDE or chess.com ratings.

## Project layout

```
index.html              ← the built game (everything inlined, about 150 KB)
src/engine.js           rules (0x88 board), notation, alpha-beta search, mate solver
src/bots.js             bot personalities + opening book
src/lessons.js          kids' course content
src/app.js              UI: board, game modes, WebRTC, puzzles, lessons, ratings
src/style.css, src/template.html
data/                   calibration results, puzzle set
tools/                  build, tests and data generators (Node.js, no npm packages)
```

## License

Knight Club is free software under the **GNU General Public License v3.0** (see `LICENSE`).
You may use, copy, change and share it, as long as you keep it open under the same license.

## Online lobby (Cloudflare)

`lobby/` holds a tiny Cloudflare Worker that Cloudflare deploys automatically from this repo, live at https://knightclub-lobby.chesscomplex.workers.dev (health check: `/health`).
Right now it only answers a health check. In Phase 3 it will list open games and set up connections, while the games themselves stay peer-to-peer.

## Developing

```bash
node tools/perft.js            # move generator vs. standard perft counts
node tools/test2.js            # notation, draw rules, search sanity checks
node tools/validate_lessons.js # every lesson task is solvable; "par" moves are exact
node tools/build.js            # rebuild index.html after editing src/
```

Regenerating data (slow): `node tools/calibrate.js 30` → `node tools/fit_elo.js` → `node tools/gen_puzzles.js` → `node tools/rate_puzzles.js`.

### Engine verification

The move generator matches the published perft node counts for six standard test positions (16.5 million positions in total). The positions include castling, en passant, promotion and discovered-check edge cases.

## Design

Knight Club uses no emoji. Every icon, the bot characters, Professor Hoot and the chess pieces are original SVG artwork drawn for this project (`src/icons.js`, `src/app.js`).
