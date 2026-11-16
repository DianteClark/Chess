// Knight Club - World Games engine worker (classic Web Worker, no modules, no threads).
// Runs Fairy-Stockfish (single-threaded wasm32-wasi build, see vendor/fairy/README.md) and
// speaks UCI. The whole search runs synchronously inside one call, so 'stop' is not
// supported: every search must be limited by depth, nodes or movetime.
//
// Messages in:  {id, cmd:'...UCI lines separated by \n...'}
// Messages out: {id, lines:[output lines]}           (after the commands have finished)
//               {id, error:'...'}                    (load or runtime failure)
//               {ready:true} / {ready:false,error}   (once, after the wasm has loaded)
// Under Node (tests) the file exports createEngine(wasmBytes) -> {send(cmd) -> [lines]}.
(function () {
  'use strict';

  function createEngine(bytesOrModule) {
    var mem = null, inst = null, out = [], partial = '';
    function view() { return new DataView(mem.buffer); }
    function u8() { return new Uint8Array(mem.buffer); }
    var dec = new TextDecoder('utf-8');
    var perfNow = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };
    var t0 = Date.now() - perfNow();
    var wasi = {
      fd_write: function (fd, iovs, iovsLen, nwritten) {
        var dv = view(), total = 0, s = '';
        for (var i = 0; i < iovsLen; i++) {
          var p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true);
          s += dec.decode(u8().subarray(p, p + l)); total += l;
        }
        if (fd === 1 || fd === 2) {
          partial += s;
          var k;
          while ((k = partial.indexOf('\n')) >= 0) { out.push(partial.slice(0, k)); partial = partial.slice(k + 1); }
        }
        dv.setUint32(nwritten, total, true);
        return 0;
      },
      fd_read: function (fd, iovs, iovsLen, nread) { view().setUint32(nread, 0, true); return 0; },
      fd_close: function () { return 0; },
      fd_seek: function () { return 70; },             // ESPIPE
      fd_fdstat_get: function (fd, ptr) {
        if (fd > 2) return 8;                            // EBADF
        var b = u8(); for (var i = 0; i < 24; i++) b[ptr + i] = 0;
        b[ptr] = 2;                                      // character device
        return 0;
      },
      fd_filestat_get: function () { return 8; },
      fd_pread: function () { return 8; },
      fd_prestat_get: function () { return 8; },         // no preopened directories
      fd_prestat_dir_name: function () { return 8; },
      path_open: function () { return 76; },             // ENOTCAPABLE: no files
      environ_sizes_get: function (cnt, size) { var dv = view(); dv.setUint32(cnt, 0, true); dv.setUint32(size, 0, true); return 0; },
      environ_get: function () { return 0; },
      clock_time_get: function (id, precision, ptr) {
        var ms = id === 0 ? Date.now() : perfNow() + t0;
        view().setBigUint64(ptr, BigInt(Math.round(ms * 1e6)), true);
        return 0;
      },
      proc_exit: function (code) { throw new Error('engine exited with code ' + code); }
    };
    function finish(instance) {
      inst = instance; mem = inst.exports.memory;
      inst.exports._initialize();
      inst.exports.fs_init();
      out = [];
      return api;
    }
    var api = {
      send: function (cmd) {
        var bytes = new TextEncoder().encode(cmd + '\n');
        if (bytes.length >= 65535) throw new Error('command too long');
        var p = inst.exports.fs_buf(), b = u8();
        b.set(bytes, p); b[p + bytes.length] = 0;
        out = [];
        inst.exports.fs_cmd();
        var r = out; out = [];
        return r;
      }
    };
    var imports = { wasi_snapshot_preview1: wasi };
    if (bytesOrModule instanceof WebAssembly.Module) return WebAssembly.instantiate(bytesOrModule, imports).then(finish);
    return WebAssembly.instantiate(bytesOrModule, imports).then(function (r) { return finish(r.instance); });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { createEngine: createEngine }; return; }

  // ---- Web Worker side ----
  var engine = null, queue = [], failed = null;
  function handle(msg) {
    if (failed) { self.postMessage({ id: msg.id, error: failed }); return; }
    try { self.postMessage({ id: msg.id, lines: engine.send(msg.cmd) }); }
    catch (e) { self.postMessage({ id: msg.id, error: String(e && e.message || e) }); }
  }
  self.onmessage = function (ev) { if (engine || failed) handle(ev.data); else queue.push(ev.data); };
  var url = new URL('fairy-stockfish.wasm', self.location.href).href;
  var load = (WebAssembly.compileStreaming ? WebAssembly.compileStreaming(fetch(url)).catch(function () {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.compile(b); });
  }) : fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.compile(b); }));
  load.then(function (m) { return createEngine(m); }).then(function (e) {
    engine = e; self.postMessage({ ready: true });
    var q = queue; queue = []; q.forEach(handle);
  }).catch(function (e) {
    failed = 'engine failed to load: ' + String(e && e.message || e);
    self.postMessage({ ready: false, error: failed });
    var q = queue; queue = []; q.forEach(handle);
  });
})();
