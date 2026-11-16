# Changelog

## 13.0 — Grand Opening

Rebuilt by five specialists and a coordinator, with more than 45 improvements.

**Screen and devices**
- The app is locked to the screen: no pinch or double-tap zoom, no bounce, fields never zoom on iOS, a stable height when the browser toolbar or keyboard moves, safe-area spacing on all sides.
- Landscape layout for games and lessons (board left, panels right); bigger boards and a framed side panel on tablets and desktop.
- Focus rings, screen-reader labels, real dialogs (focus trap, Escape, swipe down to close), 44px tap targets, better contrast.
- Update toast with Reload instead of surprise reloads; offline start after a slow network; home-screen shortcuts for Play, Puzzles and Daily.

**Board**
- Lifted drag with a finger offset, tap-to-move, smooth slides for every move (castling and promotion too), on-board promotion picker, premoves, your own arrows and circles, keyboard play.

**Games**
- Versus intro, bot personalities with lines for big moments, player bars with frames and material, clocks with low-time pulse, ticks and a flag, game menu sheet, move list sheet, arrow hints, rated-game leave guard, Pass & Play setup with names, full game records.

**Puzzles**
- Puzzle Battle against any bot, Streak mode, Rush combos with +5s bonuses and a run summary, three-step Hoot hints, rating graph and theme medals, Daily calendar, puzzle history, and missed puzzles that come back for review.

**Progress**
- Season 1 "The Opening" with a 30-tier cosmetic track; avatar frames, titles and banners; game archive with filters; 100 trophies; stats with draggable rating graphs; a 3-step welcome; rank titles; an in-app inbox.

**Also**
- World Games in progress survive a reload, lesson hints after two misses, directional tab transitions, review accuracy shown in the archive, translations at 100% in eight languages.

## 12.0 — The Revamp

Knight Club now feels like a game from top to bottom.

- **Full-screen play.** Bot games, Pass & Play, friend and online games, World Games, lessons, puzzles, Daily, Rush, Game Review and the analysis board fill exactly one phone screen. No dock, no scrolling, nothing under the status bar, the board sized to the space, the buttons at the bottom. Swipe the board to step through moves.
- **Rewards that wait their turn.** XP, level ups, trophies and unlocks never pop up in the middle of something. They arrive on a results screen (stars, an XP bar that fills, a level-up banner) and then a reward chest.
- **Game Review** opens with a summary and starts at move 1. Autoplay, key moments, a tappable game graph and an end card; review XP is given at the end.
- **Professor Hoot is alive**: blinking, cheering, thinking and sulking along with you.
- **New sound kit**: 38 synthesized sounds in three packs, volume control and optional cozy music.
- **Clubhouse**: level ring, a "continue" card, daily row with quest rings and a 7-day login chest, and a tighter room grid.
- **Arena**: spotlight opponent card with your record, portrait strip, compact setup and a sticky Play button.
- **Library**: the beginner course is a winding trail with chapters and 1-3 stars per lesson; courses use the same trail.
- **Puzzle Den**: rating card with a Solve button, Daily with a week strip, Rush modes, theme tiles; streak combos while solving.
- **Me**: player card, trophy cabinet, Style with live preview, Stats, and Settings (language, volume, music, vibration).
- **Play the World**: matchmaking screen with radar search and a podium leaderboard. **Invite a Friend** has Host and Join tabs.
- **World Games**: tile hall, game pages with Learn / Play / Pieces tabs, framed boards that fit the screen.
- New boards (Mint Tea, Atlas, Dusk), the Scholar piece set, and login achievements.

## 11.1 — Polish pass

- Fixed: Play the World opened World Games instead of the online lobby. The build now refuses two global names that clash.
- Nothing hides under the dock any more: every screen leaves room for the Play medallion.
- Every lesson step has a board: World Games explanations show the starting position, and the kids' lessons on capturing, piece values, check, castling, en passant, draws and tips got their own diagrams with arrows.
- World Games boards sit in a wooden frame with the coordinates on the frame instead of on top of the pieces. Lesson arrows have proper heads.
- Makruk, sittuyin and shatranj have a real traditional set (carved pieces) that is different from the English set.
- World Games: end-of-game card with "Next level", numbered lessons, a row of the game's pieces on each game page, the bot picker scrolls sideways, piece guide uses each game's own piece names (janggi Guards, makruk Ruea).
- The bot ratings table shows portraits instead of raw names.
- Translations: 100% in all eight languages, including singular and plural forms, rating changes, coach explanations sentence by sentence, game results and course levels.
- QA: tools/qa/crawl_scenes.py visits 231 screens at phone size (all 155 World Games lesson steps included) and flags overlaps, clipped text, raw values and untranslated text.

## 11.0 — World Games

Knight Club becomes a home for chess and its cousins from around the world, in nine languages.

- **World Games wing**: xiangqi (Chinese chess), shogi (Japanese chess), janggi (Korean chess), makruk (Thai chess), sittuyin (Burmese chess) and shatranj (the old Persian game), plus crazyhouse, three-check, king of the hill, atomic, horde and antichess.
- **Rules and bots by Fairy-Stockfish**: rules from ffish.js and a single-threaded Fairy-Stockfish engine compiled to WebAssembly so it runs on any static host. Bots at 8 levels, hints, Pass & Play and a short game review. Everything is downloaded only when you first open World Games.
- **Two piece styles for every game**: traditional (Chinese and Korean characters, Japanese wedge tiles) and an English picture set. English shogi pieces show their moves around the edge.
- **How-to-play courses** for all 12 games, 61 lessons in all: every piece, the special rules (river and palace, flying general, cannon screens, shogi drops and promotion, janggi passing, makruk counting) and first checkmates. Every position is checked with Fairy-Stockfish's rules.
- **Nine languages**: English, Spanish, Portuguese, French, German, Chinese, Japanese, Hindi and Arabic (right to left). Change it under Me.
- **New app icon**: a brass medallion on felt, with a maskable version for Android and a proper Apple touch icon.
- Five new achievements for World Games.

## 10.1 — The Clubhouse

A complete visual overhaul so that getting around is as fun as playing.

- **Clubhouse home**: an illustrated home screen where each area is a room: the Arena (bots), Puzzle Den, Library (lessons), World Hall (online), Courtyard (friends) and Trophy Hall. Each area opens with its own room banner.
- **New identity**: card-table felt, walnut and brass, ivory and ebony. Lilita One for titles and Atkinson Hyperlegible for reading, bundled with the app so they work offline.
- **Wooden dock** with a brass Play medallion, screen transitions and an opening splash.
- **New art**: shaded Club piece set (new default), wooden board frame, bot portraits with studio lighting in brass medallions, paper speech bubbles.
- **Juice**: pieces land with a bounce, captures puff dust, check pulses, phones buzz on moves, ratings count up, level ups get a full celebration.
- Sentence-case labels and plainer wording throughout. Reduced-motion settings are respected.

## 10.0 — the big one

Knight Club grows from a solid chess game into a full chess home: a coach that explains your games, real online play, puzzles every day, courses, rewards and a whole new original look. Still 100% free, no ads, no account.

### Coach and analysis
- **Game Review** powered by Stockfish 19 (running in your browser): every move graded Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss or Blunder.
- **Coach explanations in plain words**: what a mistake allowed, which piece was left hanging, the better move and *why* (captures, forks, defending the mating square, forced wins).
- Accuracy for both players and per game phase, eval graph, key moments, best-move arrows, grade badges on the board.
- **Retry this moment**: replay the position before a mistake and find the better move.
- **Live Coach** in casual bot games: Professor Hoot grades each move as you play, warns when your pieces are attacked, and lets you take back mistakes.
- **Analysis board**: live multi-line engine analysis, eval bar, opening names, position editor, FEN/PGN import and export.
- **Insights**: accuracy trend, accuracy by phase, move-quality totals, score by color and opening, and what to practice next.

### Play
- **Play the World**: online lobby on a free Cloudflare server. Quick pairing by rating, open games, server-checked moves and clocks, verified ratings, Top 50 leaderboard, preset-only chat (safe for kids).
- **Clocks**: untimed, bullet, blitz, rapid and classical time controls for bots, Pass & Play and online games.
- **Chess960** (Fischer Random) against bots and in Pass & Play, verified by perft.
- Friend invites (peer-to-peer) are now friendly, unrated games.

### Ratings
- Three separate ratings: **Bot League** ladder (Pawn → King League, strict ±40/±20 per game), **Online** (server-verified Glicko-2, ±50/±30), **Puzzles** (±30/±15).
- Win/draw/loss stakes shown before every rated bot game.

### Puzzles
- **Daily Puzzle** with streaks, **Puzzle Rush** (3 min, 5 min, Survival), theme filters.
- 372 themed tactics puzzles (forks, pins, skewers, discovered attacks, trapped pieces, sacrifices and more), each verified by Stockfish. 588 puzzles in total.

### Learn
- New **courses**: Opening Principles (with move-by-move opening drills), Tactics Toolkit, Endgame Essentials. 22 lessons, every position machine-checked.

### Rewards
- XP and levels, 41 achievements with a Trophy Room, **daily quests** with streaks, confetti.
- Unlockable **board themes** (12), **piece sets** (8) and **avatars** (beat a bot to unlock its character).

### Look and feel
- Sound packs (Wooden, Soft, Retro), live opening names during games, a What's New screen.
- Completely original art: hand-drawn SVG icons, bot characters and Professor Hoot. No emoji anywhere.
- Installable app that works **offline** (bots, puzzles, lessons, Stockfish reviews).

## 1.0
- Chess engine written from scratch (perft-verified), 8 calibrated bots, checkmate puzzles, 16 kids' lessons, peer-to-peer play with friends, Glicko-2 ratings.
