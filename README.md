# Knight Club Chess 10.0

A complete, free chess app in one page: play bots and people, learn with a coach that explains your games, solve puzzles every day, and collect rewards along the way. No ads, no account, no paywall. Built from scratch, with no game engine or framework.

## [Play now: dianteclark.github.io/Chess](https://dianteclark.github.io/Chess/)

Works on phones and computers. Install it to your home screen (Me > Install) and it works offline too.

See [CHANGELOG.md](CHANGELOG.md) for everything new in 10.0.

## Features

| | |
|---|---|
| **Play bots** | 8 calibrated bots from Pip (total beginner) to The Tower. Rated Bot League or casual games with a Live Coach. Clocks, Chess960. |
| **Play people** | Play the World: quick pairing, server-checked games and verified ratings, Top 50 leaderboard. Invite a friend peer-to-peer, or Pass & Play on one device. |
| **Game Review** | Stockfish 19 grades every move, and the coach explains mistakes in plain words. Accuracy, eval graph, key moments, retry your mistakes. |
| **Analysis** | Analysis board with live engine lines, opening names, position editor, FEN/PGN import and export. Insights dashboard across your games. |
| **Puzzles** | 588 puzzles: Daily Puzzle, Puzzle Rush, checkmate puzzles, famous mating patterns and 372 themed tactics, all verified. |
| **Learn** | 16 kids' lessons with Professor Hoot, plus 3 courses (22 lessons) on openings, tactics and endgames. |
| **Rewards** | XP and levels, achievements, daily quests, unlockable boards, piece sets and avatars. |

## Ratings

- **Bot League** (vs bots): Elo ladder from the Pawn League to the King League. At most 40 points per game in 10 placement games, then at most 20. Bot ratings were measured with a 390-game calibration tournament (`tools/calibrate.js`, `tools/fit_elo.js`), anchored at Pip = 300 and The Tower = 2000.
- **Online** (vs people): Glicko-2 kept by the server, so results can't be faked. At most 50 points per game while provisional, then 30.
- **Puzzles**: Glicko-2, at most 30 points per puzzle while provisional, then 15.

These ratings compare fairly inside Knight Club. They are estimates, not official FIDE or chess.com ratings.

## How it's built

```
index.html               the built app (everything inlined)
sw.js, manifest.webmanifest, icon*.{svg,png}   installable offline app
src/engine.js            rules (0x88), notation, alpha-beta search, mate solver, Chess960
src/bots.js              bot personalities + opening book
src/lessons.js           kids' course      src/courses.js   openings, tactics, endgames
src/app.js               board, game modes, puzzles, lessons, profile
src/review.js            Game Review, coach, Live Coach        src/analysis.js  analysis board
src/puzzles2.js          Daily Puzzle, Puzzle Rush, themes     src/rewards.js   XP, achievements, quests, styles
src/insights.js          insights dashboard                    src/icons.js     original SVG art
src/lobby-client.js, src/lobby-ui.js   Play the World          src/sf.js        Stockfish bridge
vendor/stockfish/        Stockfish 19 Lite (single-threaded WASM, GPL-3.0, unmodified)
lobby/                   Cloudflare Worker + Durable Object (lobby server), see lobby/PROTOCOL.md
data/                    calibration, puzzles, tactics
tools/                   build, tests and data generators (Node.js)
```

### Online lobby (Cloudflare)

`lobby/` is deployed automatically by Cloudflare Workers Builds on every push. It runs on the free plan, live at https://knightclub-lobby.chesscomplex.workers.dev (`/health`, `/leaderboard`, `/stats`).

### Developing

```bash
node tools/build.js              # rebuild index.html after editing src/
node tools/perft.js              # move generator vs standard perft counts (16.5M positions)
node tools/perft960.js           # Chess960 perft
node tools/test2.js              # notation, draw rules, search
node tools/validate_lessons.js   # every lesson task is solvable, par moves are exact
node tools/validate_courses.js   # every course position and answer is engine-checked
node tools/verify_puzzles.js     # every checkmate puzzle is proven by the solver
node tools/verify_tactics.js data/tactics.json   # tactics re-checked with Stockfish (slow)
node lobby/sync-engine.mjs       # after changing src/engine.js
cd lobby && npm install && cd .. && node tools/lobby_test.mjs   # 71 end-to-end lobby tests
```

## License

Knight Club is free software under the **GNU General Public License v3.0** (see `LICENSE`). Stockfish is also GPL-3.0 (see `vendor/stockfish/Copying.txt`).

## Design

Knight Club uses no emoji. Every icon, the bot characters, Professor Hoot and the chess pieces are original SVG artwork drawn for this project.
