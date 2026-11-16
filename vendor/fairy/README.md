# World Games: Fairy-Stockfish rules and engine (vendor/fairy/)

Used by `src/variants.js` (globals `VARIANTS`, `Variants`, `VGame`). Nothing here is downloaded until a
World Game is opened: `Variants.ready()` loads the rules, the first `Variants.engine.*` call starts the engine.
Everything works on a plain static host (GitHub Pages): no `SharedArrayBuffer`, no COOP/COEP headers, no threads.

| File | Bytes (gzip) | Purpose |
| --- | --- | --- |
| `ffish.js` | 124,326 (31 K) | ffish.js loader, classic script, defines the single global `FFishModule` |
| `ffish.wasm` | 921,975 (309 K) | Fairy-Stockfish move generator / rules (ffish) |
| `vengine-worker.js` | ~5 K | Knight Club's classic Web Worker: WASI shim + UCI bridge for the engine |
| `fairy-stockfish.wasm` | 1,262,928 (367 K) | Fairy-Stockfish engine, single-threaded wasm32-wasi build (see below) |
| `Copying.txt`, `AUTHORS` | | GPL-3.0 license text and Fairy-Stockfish / Stockfish authors |
| `build/` | | the patch, glue code and script that produce `fairy-stockfish.wasm` |
| `test.html` | | browser test page (open `/vendor/fairy/test.html` over HTTP); `tools/test_variants.py` drives it headless |

## Rules: ffish.js

- npm package [`ffish-es6`](https://www.npmjs.com/package/ffish-es6) **0.7.10** (identical `ffish.wasm` to the
  CommonJS package `ffish` 0.7.10), by Fabian Fichter, Johannes Czech and contributors, built from
  <https://github.com/fairy-stockfish/Fairy-Stockfish> (`tests/js`). Reports itself as "Fairy-Stockfish 230826 LB".
- Not threaded (no `SharedArrayBuffer` anywhere in the loader).
- `ffish.wasm` is unmodified. `ffish.js` has two mechanical edits so it can run as a classic script without
  touching the page's globals: the first line `var Module = (function() {` became
  `var FFishModule = (function() {`, and the final `export default Module;` line was removed.

## Engine: Fairy-Stockfish, single-threaded WASM (built for Knight Club)

The published engine builds need threads: `fairy-stockfish-nnue.wasm` 1.1.12 and `fairy-stockfish-web` 0.0.1
are Emscripten pthread builds that fail with "SharedArrayBuffer is not defined" on a page that is not
cross-origin isolated (checked in headless Chrome). So `fairy-stockfish.wasm` is built here from the
Fairy-Stockfish sources contained in the PyPI source package **pyffish 0.0.91**
(sha256 `2374e345cb0ea8bbd0331df7caa29bba6c04f28dce19823854495b4bb96f4f5e`; upstream
<https://github.com/fairy-stockfish/Fairy-Stockfish>), with the Zig 0.17.1 toolchain from PyPI (`ziglang`)
targeting `wasm32-wasi`:

- `build/no-threads.patch` (enabled by `-DFS_NO_THREADS`): no worker threads; `Thread::start_searching()`
  runs the search synchronously; `UCI::loop()` keeps its state between calls and reads commands from a
  buffer instead of stdin.
- `build/wasm_compat.h`: single-threaded stand-ins for `std::mutex`, `std::condition_variable`,
  `std::thread` and file streams (wasi-libc++ has no threads and no filesystem; no file can be opened).
- `build/wasm_main.cpp`: replaces `main.cpp`; exports `fs_init()`, `fs_buf()` and `fs_cmd()`.
- Flags: `-O3 -DLARGEBOARDS -DALLVARS -DPRECOMPUTED_MAGICS -DNNUE_EMBEDDING_OFF`, no SIMD, no NNUE network
  (classical evaluation for every game). `build/build.sh` reproduces the file byte for byte.

`vengine-worker.js` provides the dozen WASI imports the module needs (stdout, clocks; files always fail),
writes a UCI command batch into the module's buffer, calls `fs_cmd()` and posts back the output lines.
Because the search is synchronous it cannot be stopped; every search is limited by depth, nodes or
movetime. Measured in headless Chrome (2 cores): load about 0.35 s, roughly 300-500k nodes/s,
depth 14-21 in 1.5 s depending on the game. Memory: 64 MB initial linear memory (mostly static attack
tables for the large boards) plus the 16 MB hash table.

## License

Fairy-Stockfish, ffish.js and Stockfish are **GPL-3.0** (`Copying.txt`); Knight Club is GPL-3.0 as well.
The complete corresponding source of `fairy-stockfish.wasm` is the pyffish 0.0.91 source package plus the
files in `build/`; the source of ffish is in the Fairy-Stockfish repository linked above.
