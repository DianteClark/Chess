// Stockfish bridge: a small promise API over the UCI protocol, talking to the
// single-threaded Stockfish 19 Lite WASM build in a classic Web Worker.
// Classic script (no modules). Defines the global `SF`.
//
//   SF.ready()                         -> Promise<true>  (rejects if the engine cannot load)
//   SF.analyze(fen, {depth, movetime, multipv, moves, timeout})
//                                      -> Promise<{lines:[{multipv, depth, scoreCp?, mate?, pv:[uci]}], bestmove, depth, fen}>
//                                         scores are from the SIDE TO MOVE's point of view
//                                         (after `moves` are applied, if given)
//   SF.bestMove(fen, opts)             -> Promise<uci|null>
//   SF.stop()                          stops the running search (it resolves with what it has)
//                                      and rejects every queued, not-yet-started request
//   SF.newGame()                       -> Promise (ucinewgame + isready)
//   SF.setSkill(0..20)                 -> Promise (Stockfish "Skill Level")
//   SF.setOption(name, value)          -> Promise
//   SF.available                       null = not tried yet, true = loaded, false = failed
//   SF.terminate()                     kills the worker (next call reloads it)
// All requests go through one serialized queue: only one search runs at a time.
(function (global) {
  'use strict';
  var DEFAULT_PATH = 'vendor/stockfish/stockfish-19-lite-single.js';
  var LOAD_TIMEOUT = 20000;     // ms to get "uciok"+"readyok" after creating the worker
  var DEFAULT_TIMEOUT = 60000;  // ms safety cap for one depth-limited search

  var worker = null, loading = null, listener = null;
  var queue = [], busy = false, current = null;
  var curMultiPV = 1;

  function post(cmd) { if (worker) worker.postMessage(cmd); }

  function fail(err) {
    SF.available = false;
    SF.lastError = String(err && err.message || err);
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null; loading = null; listener = null;
    var q = queue; queue = []; busy = false;
    if (current) { var c = current; current = null; c.done(null, new Error('Stockfish unavailable: ' + SF.lastError)); }
    q.forEach(function (j) { j.reject(new Error('Stockfish unavailable: ' + SF.lastError)); });
  }

  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var settled = false;
      function bad(e) { if (settled) return; settled = true; clearTimeout(t); fail(e); reject(new Error('Stockfish failed to load: ' + SF.lastError)); }
      if (typeof Worker === 'undefined') return bad('Web Workers not supported');
      if (typeof location !== 'undefined' && location.protocol === 'file:') return bad('workers cannot load from file://');
      if (typeof WebAssembly !== 'object') return bad('WebAssembly not supported');
      try { worker = new Worker(SF.path); } catch (e) { return bad(e); }
      var t = setTimeout(function () { bad('timeout while loading engine'); }, LOAD_TIMEOUT);
      var gotUci = false;
      worker.onerror = function (e) {
        var msg = (e && e.message) || 'worker error';
        if (e && e.preventDefault) e.preventDefault();
        if (!settled) bad(msg); else fail(msg);
      };
      worker.onmessage = function (e) {
        var line = typeof e.data === 'string' ? e.data : '';
        if (!line) return;
        if (SF.debug) console.log('[sf] ' + line);
        if (!settled) {
          if (line === 'uciok') { gotUci = true; post('setoption name Hash value ' + SF.hashMB); post('isready'); }
          else if (line === 'readyok' && gotUci) {
            settled = true; clearTimeout(t); SF.available = true;
            resolve(true);
          } else if (/^id name /.test(line)) SF.name = line.slice(8);
          return;
        }
        if (listener) listener(line);
      };
      post('uci');
    });
    return loading;
  }

  // ---- queue ----
  function enqueue(run) {
    return new Promise(function (resolve, reject) {
      queue.push({ run: run, resolve: resolve, reject: reject });
      pump();
    });
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    var job = queue.shift();
    load().then(function () {
      var finished = false;
      current = {
        done: function (val, err) {
          if (finished) return; finished = true;
          current = null; listener = null; busy = false;
          if (err) job.reject(err); else job.resolve(val);
          pump();
        }
      };
      try { job.run(current); } catch (e) { current.done(null, e); }
    }, function (e) { busy = false; job.reject(e); });
  }
  function waitReady(cur) {
    listener = function (line) { if (line === 'readyok') cur.done(true); };
    post('isready');
  }

  function parseInfo(line) {
    // info depth 12 seldepth 14 multipv 1 score cp 31 [lowerbound] nodes ... pv e2e4 ...
    if (line.indexOf(' pv ') < 0 || line.indexOf(' score ') < 0) return null;
    var tok = line.split(' '), r = { multipv: 1, depth: 0, pv: [] };
    for (var i = 1; i < tok.length; i++) {
      var k = tok[i];
      if (k === 'depth') r.depth = +tok[++i];
      else if (k === 'multipv') r.multipv = +tok[++i];
      else if (k === 'score') {
        var kind = tok[++i], v = +tok[++i];
        if (kind === 'cp') r.scoreCp = v; else if (kind === 'mate') r.mate = v;
        if (tok[i + 1] === 'lowerbound' || tok[i + 1] === 'upperbound') { r.bound = tok[i + 1]; i++; }
      } else if (k === 'pv') { r.pv = tok.slice(i + 1); break; }
    }
    return r;
  }

  var SF = {
    path: DEFAULT_PATH,
    hashMB: 16,
    available: null,
    name: null,
    lastError: null,
    debug: false,

    ready: function () { return enqueue(function (cur) { waitReady(cur); }); },

    analyze: function (fen, opts) {
      opts = opts || {};
      var multipv = Math.max(1, Math.min(10, opts.multipv | 0 || 1));
      var go = 'go';
      if (opts.depth) go += ' depth ' + (opts.depth | 0);
      if (opts.movetime) go += ' movetime ' + (opts.movetime | 0);
      if (opts.nodes) go += ' nodes ' + (opts.nodes | 0);
      if (go === 'go') go += ' depth 12';
      var limit = opts.timeout || (opts.movetime ? opts.movetime + 10000 : DEFAULT_TIMEOUT);
      return enqueue(function (cur) {
        var lines = {}, timer = null, hard = null;
        listener = function (line) {
          if (line.lastIndexOf('info ', 0) === 0) {
            var info = parseInfo(line);
            if (!info || info.bound) return;
            var prev = lines[info.multipv];
            if (!prev || info.depth >= prev.depth) lines[info.multipv] = info;
          } else if (line.lastIndexOf('bestmove', 0) === 0) {
            clearTimeout(timer); clearTimeout(hard);
            var bm = line.split(' ')[1];
            var out = [];
            Object.keys(lines).forEach(function (k) {
              var l = lines[k], o = { multipv: l.multipv, depth: l.depth, pv: l.pv };
              if (l.mate !== undefined) o.mate = l.mate; else o.scoreCp = l.scoreCp;
              out.push(o);
            });
            out.sort(function (a, b) { return a.multipv - b.multipv; });
            cur.done({ fen: fen, lines: out, bestmove: (bm && bm !== '(none)') ? bm : null,
              depth: out.length ? out[0].depth : 0 });
          }
        };
        if (multipv !== curMultiPV) { post('setoption name MultiPV value ' + multipv); curMultiPV = multipv; }
        var moves = opts.moves && opts.moves.length ? ' moves ' + opts.moves.join(' ') : '';
        post('position fen ' + fen + moves);
        post(go);
        // safety: ask the engine to stop; if it still does not answer, restart it
        timer = setTimeout(function () {
          post('stop');
          hard = setTimeout(function () {
            var err = new Error('Stockfish search timed out');
            if (worker) { try { worker.terminate(); } catch (e) {} }
            worker = null; loading = null; curMultiPV = 1;
            cur.done(null, err);
          }, 3000);
        }, limit);
      });
    },

    bestMove: function (fen, opts) { return SF.analyze(fen, opts).then(function (r) { return r.bestmove; }); },

    stop: function () {
      var q = queue; queue = [];
      q.forEach(function (j) { j.reject(new Error('cancelled')); });
      if (current) post('stop');
    },

    newGame: function () {
      return enqueue(function (cur) { post('ucinewgame'); waitReady(cur); });
    },

    setOption: function (name, value) {
      return enqueue(function (cur) {
        post('setoption name ' + name + (value === undefined ? '' : ' value ' + value));
        if (name === 'MultiPV') curMultiPV = +value;
        waitReady(cur);
      });
    },

    setSkill: function (level) {
      level = Math.max(0, Math.min(20, Math.round(level)));
      return SF.setOption('Skill Level', level);
    },

    terminate: function () {
      SF.stop();
      if (worker) { try { worker.terminate(); } catch (e) {} }
      worker = null; loading = null; busy = false; current = null; listener = null; curMultiPV = 1;
      SF.available = null;
    }
  };

  global.SF = SF;
})(typeof window !== 'undefined' ? window : this);
