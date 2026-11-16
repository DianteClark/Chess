// ======================= AUDIO KIT =======================
// Knight Club sound effects and optional background music, fully synthesized with the
// Web Audio API (no audio files). Exposes only two globals:
//   sfx(name, opts)  play a sound (never throws; no-op when audio is unavailable)
//   SFX              settings, music and test helpers (see bottom of file)
// Packs: 'wood' (default, warm wooden clacks / marimba UI), 'soft' (felt and bells),
// 'retro' (chiptune). The pack follows profile.style.sound unless SFX.pack is set.
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : {};
  var AC = W.AudioContext || W.webkitAudioContext || null;
  var OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext || null;
  var PACKS = ['wood', 'soft', 'retro'];
  var STORE = 'kc-sfx';
  var MUSIC_TRIM = 0.4; // keeps the music bed well under the sound effects

  // ---------- settings ----------
  var cfg = { volume: 0.8, muted: false, musicVolume: 0.5 };
  try {
    var saved = JSON.parse(W.localStorage && W.localStorage.getItem(STORE) || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.volume === 'number' && isFinite(saved.volume)) cfg.volume = clamp(saved.volume, 0, 1);
      if (typeof saved.muted === 'boolean') cfg.muted = saved.muted;
      if (typeof saved.musicVolume === 'number' && isFinite(saved.musicVolume)) cfg.musicVolume = clamp(saved.musicVolume, 0, 1);
    }
  } catch (e) { }
  function save() { try { W.localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var packOverride = null;
  function curPack() {
    if (packOverride) return packOverride;
    try { if (typeof profile !== 'undefined' && profile && profile.style && PACKS.indexOf(profile.style.sound) >= 0) return profile.style.sound; } catch (e) { }
    return 'wood';
  }

  // ---------- context and master chain ----------
  // master: sfxGain / musicGain -> glue compressor -> brickwall-ish limiter -> destination
  var ctx = null, chain = null, failed = false;
  function makeChain(c) {
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
    var lim = c.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    var trim = c.createGain(); trim.gain.value = 0.9;
    comp.connect(lim); lim.connect(trim); trim.connect(c.destination);
    var sfxGain = c.createGain(); sfxGain.gain.value = cfg.muted ? 0 : cfg.volume; sfxGain.connect(comp);
    var musicGain = c.createGain(); musicGain.gain.value = cfg.musicVolume * MUSIC_TRIM; musicGain.connect(comp);
    return { comp: comp, sfx: sfxGain, music: musicGain };
  }
  function getCtx() {
    if (ctx || failed) return ctx;
    try {
      if (!AC) { failed = true; return null; }
      ctx = new AC({ latencyHint: 'interactive' });
      chain = makeChain(ctx);
    } catch (e) { failed = true; ctx = null; chain = null; }
    return ctx;
  }
  function resume() {
    try { if (ctx && ctx.state !== 'running' && !hiddenPaused) { var p = ctx.resume(); if (p && p.catch) p.catch(function () { }); } } catch (e) { }
  }
  // Unlock on the first user gesture (iOS needs a sound started inside the gesture).
  var unlocked = false;
  function onGesture() {
    try {
      if (!getCtx()) return;
      resume();
      if (!unlocked) {
        unlocked = true;
        var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      }
      if (ctx.state === 'running') ['pointerdown', 'touchend', 'keydown', 'mousedown'].forEach(function (ev) { W.removeEventListener(ev, onGesture, true); });
    } catch (e) { }
  }
  try { ['pointerdown', 'touchend', 'keydown', 'mousedown'].forEach(function (ev) { W.addEventListener(ev, onGesture, true); }); } catch (e) { }
  // Pause music when the app is hidden, resume when it comes back.
  var hiddenPaused = false;
  try {
    W.document && W.document.addEventListener('visibilitychange', function () {
      try {
        if (!ctx) return;
        if (W.document.hidden) { if (music.playing && ctx.state === 'running') { hiddenPaused = true; ctx.suspend(); } }
        else if (hiddenPaused) { hiddenPaused = false; resume(); }
      } catch (e) { }
    });
  } catch (e) { }

  // ---------- synthesis primitives (work on any BaseAudioContext) ----------
  var noiseCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function noiseBuf(c) {
    var b = noiseCache && noiseCache.get(c);
    if (b) return b;
    var len = Math.floor(c.sampleRate * 1.5);
    b = c.createBuffer(1, len, c.sampleRate);
    var d = b.getChannelData(0), seed = 12345;
    for (var i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
    if (noiseCache) noiseCache.set(c, b);
    return b;
  }
  var pulseCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function pulseWave(c) { // 25% duty pulse, the classic chiptune lead
    var w = pulseCache && pulseCache.get(c);
    if (w) return w;
    var n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (var k = 1; k < n; k++) re[k] = 2 * Math.sin(Math.PI * k * 0.25) / (k * Math.PI);
    w = c.createPeriodicWave(re, im);
    if (pulseCache) pulseCache.set(c, w);
    return w;
  }
  // Envelope: 0 -> peak (linear attack) -> exponential decay -> 0. Returns end time.
  function env(param, t, a, peak, d) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(Math.max(peak * 0.001, 1e-5), t + a + d);
    param.linearRampToValueAtTime(0, t + a + d + 0.01);
    return t + a + d + 0.02;
  }
  function Synth(c, out, t0) {
    var S = {
      c: c, out: out, t0: t0,
      // plain oscillator note; o = {type, a, slide(ratio), glide(seconds), detune, lp, wave}
      osc: function (f, at, d, v, o) {
        o = o || {};
        var t = t0 + at, os = c.createOscillator(), g = c.createGain(), dst = out;
        if (o.wave) os.setPeriodicWave(o.wave); else os.type = o.type || 'sine';
        os.frequency.setValueAtTime(f, t);
        if (o.slide) os.frequency.exponentialRampToValueAtTime(f * o.slide, t + (o.glide || d));
        if (o.detune) os.detune.value = o.detune;
        if (o.lp) { var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = 0.5; g.connect(lp); lp.connect(out); dst = null; }
        os.connect(g); if (dst) g.connect(dst);
        var end = env(g.gain, t, o.a || 0.004, v, d);
        os.start(t); os.stop(end);
        return end - t0;
      },
      // filtered noise burst; o = {type:'bandpass', q, f2 (sweep target), a}
      noise: function (f, at, d, v, o) {
        o = o || {};
        var t = t0 + at, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuf(c);
        flt.type = o.type || 'bandpass'; flt.Q.value = o.q == null ? 1.2 : o.q;
        flt.frequency.setValueAtTime(f, t);
        if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t + (o.a || 0.002) + d);
        src.connect(flt); flt.connect(g); g.connect(out);
        var end = env(g.gain, t, o.a || 0.002, v, d);
        src.start(t, Math.random() * 0.8); src.stop(end);
        return end - t0;
      },
      // two-operator FM bell; ratio 3.5 is glassy, 1.4 is tine-like
      fm: function (f, at, d, v, o) {
        o = o || {};
        var t = t0 + at, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.5);
        var idx = f * (o.index || 1.2);
        mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(idx * 0.05 + 0.01, t + d * 0.6);
        mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
        var end = env(g.gain, t, o.a || 0.003, v, d);
        car.start(t); mod.start(t); car.stop(end); mod.stop(end);
        return end - t0;
      }
    };
    var jit = function (x, amt) { return x * (1 + (Math.random() * 2 - 1) * amt); };
    S.jit = jit;
    // --- pack instruments ---
    // wooden piece on wooden board: click transient + hollow body + low thump
    S.clack = function (at, v, pitch) {
      pitch = jit(pitch || 1, 0.04);
      S.noise(3200 * pitch, at, 0.018, v * 0.9, { q: 1.6 });
      S.noise(1100 * pitch, at, 0.05, v * 0.55, { q: 4 });
      S.osc(520 * pitch, at, 0.045, v * 0.35, { type: 'triangle', slide: 0.8, a: 0.001 });
      S.osc(190 * pitch, at, 0.09, v * 0.5, { slide: 0.7, a: 0.002 });
      return at + 0.12;
    };
    // felt-bottomed piece: muted low thump, almost no click
    S.felt = function (at, v, pitch) {
      pitch = jit(pitch || 1, 0.03);
      S.noise(700 * pitch, at, 0.06, v * 0.45, { type: 'lowpass', q: 0.7, a: 0.004 });
      S.osc(240 * pitch, at, 0.11, v * 0.6, { slide: 0.75, a: 0.006 });
      S.osc(480 * pitch, at, 0.05, v * 0.12, { a: 0.006 });
      return at + 0.14;
    };
    // marimba bar: fundamental + 4th partial (~3.93x), soft mallet tick
    S.marimba = function (f, at, v, d) {
      d = d || 0.35;
      S.osc(f, at, d, v, { a: 0.002 });
      S.osc(f * 3.93, at, d * 0.22, v * 0.28, { a: 0.001 });
      S.osc(f * 9.2, at, 0.02, v * 0.08, { a: 0.001 });
      return at + d;
    };
    // soft bell: sine with gentle FM shimmer
    S.bell = function (f, at, v, d) {
      d = d || 0.5;
      S.fm(f, at, d, v, { ratio: 3.5, index: 0.45, a: 0.006 });
      S.osc(f * 2, at, d * 0.5, v * 0.12, { a: 0.008 });
      return at + d;
    };
    // chiptune note
    S.chip = function (f, at, v, d, o) {
      d = d || 0.12; o = o || {};
      S.osc(f, at, d, v * 0.55, { wave: o.square ? null : pulseWave(c), type: 'square', slide: o.slide, glide: o.glide, a: 0.002, lp: 6000 });
      return at + d;
    };
    return S;
  }

  // Pack voice: one melodic "note" function per pack, used by UI and jingles.
  function voice(S, pack) {
    if (pack === 'retro') return function (f, at, v, d) { return S.chip(f, at, v, (d || 0.3) * 0.5); };
    if (pack === 'soft') return function (f, at, v, d) { return S.bell(f, at, v * 0.9, d || 0.5); };
    return function (f, at, v, d) { return S.marimba(f, at, v, d || 0.35); };
  }
  function hit(S, pack, at, v, pitch) { // board piece placement per pack
    if (pack === 'soft') return S.felt(at, v, pitch);
    if (pack === 'retro') { S.chip(392 * (pitch || 1), at, v, 0.05, { slide: 0.5, glide: 0.05 }); S.noise(5000, at, 0.02, v * 0.25, { type: 'highpass', q: 0.5 }); return at + 0.07; }
    return S.clack(at, v, pitch);
  }
  var N = function (semi) { return 440 * Math.pow(2, (semi - 9) / 12) * 2; }; // N(0) = C5 (523 Hz)

  // ---------- sound definitions ----------
  // Each returns its duration in seconds. Loudness is normalized afterwards with GAIN.
  var DEF = {
    // --- board ---
    move: function (S, P) { return hit(S, P, 0, 1, 1); },
    capture: function (S, P) {
      if (P === 'retro') { S.noise(1800, 0, 0.09, 0.9, { q: 0.6, f2: 400 }); S.chip(330, 0, 1, 0.12, { slide: 0.5 }); return 0.16; }
      hit(S, P, 0, 1.1, 0.8);
      hit(S, P, 0.035, 0.55, 1.25);
      if (P === 'soft') S.bell(N(-5), 0.02, 0.18, 0.3);
      return 0.2;
    },
    check: function (S, P) {
      hit(S, P, 0, 0.9, 1);
      var v = voice(S, P);
      v(N(7), 0.05, 0.4, 0.25); v(N(12), 0.13, 0.42, 0.35);
      return 0.5;
    },
    castle: function (S, P) { hit(S, P, 0, 0.9, 1); hit(S, P, 0.11, 0.8, 1.1); return 0.25; },
    promote: function (S, P) {
      hit(S, P, 0, 0.9, 1);
      var v = voice(S, P);
      [0, 4, 7, 12].forEach(function (s, i) { v(N(s), 0.06 + i * 0.06, 0.35, 0.35); });
      return 0.6;
    },
    illegal: function (S, P) {
      if (P === 'retro') { S.chip(150, 0, 0.9, 0.08); S.chip(120, 0.09, 0.9, 0.12); return 0.25; }
      if (P === 'soft') { S.osc(196, 0, 0.12, 0.5, { a: 0.01 }); S.osc(185, 0.1, 0.16, 0.45, { a: 0.01 }); return 0.3; }
      S.clack(0, 0.5, 0.55); S.clack(0.08, 0.45, 0.5); return 0.22;
    },
    win: function (S, P) {
      var v = voice(S, P);
      [0, 4, 7].forEach(function (s, i) { v(N(s), i * 0.09, 0.4, 0.4); });
      [0, 4, 7, 12].forEach(function (s) { v(N(s), 0.3, 0.3, P === 'retro' ? 1.2 : 1.0); });
      if (P !== 'retro') S.fm(N(24), 0.32, 0.8, 0.06, { ratio: 3.5, index: 0.3 });
      return 1.3;
    },
    lose: function (S, P) {
      var v = voice(S, P);
      [7, 3, 0].forEach(function (s, i) { v(N(s - 5), i * 0.16, 0.42, 0.45); });
      v(N(-17), 0.48, 0.3, 0.9);
      return 1.3;
    },
    draw: function (S, P) {
      var v = voice(S, P);
      v(N(0), 0, 0.42, 0.45); v(N(5), 0.14, 0.42, 0.7); v(N(-5), 0.14, 0.2, 0.7);
      return 0.9;
    },
    notify: function (S, P) { var v = voice(S, P); v(N(9), 0, 0.42, 0.3); v(N(14), 0.1, 0.42, 0.45); return 0.6; },
    lowtime: function (S, P) {
      if (P === 'retro') { S.chip(N(19), 0, 0.8, 0.04, { square: true }); S.chip(N(19), 0.12, 0.6, 0.04, { square: true }); return 0.2; }
      S.osc(1800, 0, 0.04, 0.5, { type: 'triangle', a: 0.001 }); S.noise(2400, 0, 0.02, 0.5, { q: 6 });
      S.osc(1350, 0.13, 0.04, 0.4, { type: 'triangle', a: 0.001 }); S.noise(1800, 0.13, 0.02, 0.4, { q: 6 });
      return 0.2;
    },
    star: function (S, P, o) {
      var i = clamp(Math.round(o.i || 0), 0, 4), v = voice(S, P), base = [0, 4, 7, 12, 16][i];
      v(N(base + 12), 0, 0.42, 0.4); v(N(base + 19), 0.06, 0.2, 0.4);
      if (P !== 'retro') S.fm(N(base + 24), 0.04, 0.35, 0.06, { ratio: 3.5, index: 0.4 });
      return 0.5;
    },
    // --- feedback ---
    correct: function (S, P) { var v = voice(S, P); v(N(4), 0, 0.4, 0.25); v(N(11), 0.08, 0.42, 0.45); v(N(16), 0.08, 0.15, 0.45); return 0.6; },
    wrong: function (S, P) {
      if (P === 'retro') { S.chip(N(-8), 0, 0.9, 0.12); S.chip(N(-9), 0.13, 0.9, 0.22, { slide: 0.9 }); return 0.4; }
      var v = voice(S, P); v(N(-5), 0, 0.42, 0.3); v(N(-10), 0.12, 0.45, 0.5); return 0.65;
    },
    hint: function (S, P) {
      var v = voice(S, P);
      [7, 14, 17].forEach(function (s, i) { v(N(s), i * 0.07, 0.3, 0.45); });
      if (P !== 'retro') S.noise(6000, 0, 0.4, 0.05, { q: 2, f2: 9000, a: 0.08 });
      return 0.7;
    },
    error: function (S, P) {
      if (P === 'retro') { S.chip(110, 0, 1, 0.1, { square: true }); S.chip(110, 0.13, 1, 0.14, { square: true }); return 0.3; }
      S.osc(160, 0, 0.1, 0.5, { type: 'triangle', a: 0.005, lp: 900 }); S.osc(160 * 1.06, 0, 0.1, 0.25, { type: 'sawtooth', a: 0.005, lp: 700 });
      S.osc(150, 0.13, 0.14, 0.5, { type: 'triangle', a: 0.005, lp: 900 }); S.osc(150 * 1.06, 0.13, 0.14, 0.25, { type: 'sawtooth', a: 0.005, lp: 700 });
      return 0.32;
    },
    combo: function (S, P, o) {
      var n = clamp(Math.round(o.n || 1), 1, 12), st = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26][n - 1], v = voice(S, P);
      v(N(st), 0, 0.38, 0.3); v(N(st + 7), 0.07, 0.36, 0.4);
      if (n >= 3 && P !== 'retro') S.fm(N(st + 24), 0.07, 0.3, 0.05, { ratio: 3.5, index: 0.4 });
      return 0.5;
    },
    countdown: function (S, P) {
      if (P === 'retro') { S.chip(N(12), 0, 0.8, 0.05, { square: true }); return 0.08; }
      if (P === 'soft') { S.bell(N(14), 0, 0.4, 0.15); return 0.16; }
      S.osc(1500, 0, 0.05, 0.5, { type: 'triangle', a: 0.001 }); S.noise(2200, 0, 0.025, 0.55, { q: 5 }); return 0.08;
    },
    timeup: function (S, P) {
      var v = voice(S, P);
      [12, 7, 3].forEach(function (s, i) { v(N(s), i * 0.12, 0.4, 0.3); });
      v(N(-12), 0.36, 0.38, 0.7); v(N(-9), 0.36, 0.2, 0.7);
      if (P !== 'retro') S.osc(70, 0.36, 0.3, 0.5, { slide: 0.7 });
      return 1.1;
    },
    start: function (S, P) {
      hit(S, P, 0, 0.7, 1);
      var v = voice(S, P);
      v(N(-5), 0.05, 0.35, 0.3); v(N(0), 0.13, 0.35, 0.3); v(N(7), 0.21, 0.4, 0.55);
      return 0.8;
    },
    // --- UI ---
    tap: function (S, P) {
      if (P === 'retro') { S.chip(N(19), 0, 0.7, 0.03, { square: true }); return 0.05; }
      if (P === 'soft') { S.osc(N(12), 0, 0.05, 0.5, { a: 0.003 }); S.noise(900, 0, 0.02, 0.15, { type: 'lowpass', q: 0.5 }); return 0.07; }
      S.osc(N(14), 0, 0.045, 0.5, { a: 0.001 }); S.noise(2500, 0, 0.012, 0.25, { q: 2 }); return 0.06;
    },
    confirm: function (S, P) { var v = voice(S, P); v(N(7), 0, 0.42, 0.18); v(N(12), 0.06, 0.45, 0.3); return 0.36; },
    back: function (S, P) { var v = voice(S, P); v(N(9), 0, 0.4, 0.15); v(N(4), 0.06, 0.42, 0.25); return 0.32; },
    open: function (S, P) {
      S.noise(500, 0, 0.18, 0.12, { q: 1.5, f2: 2500, a: 0.08 });
      var v = voice(S, P); v(N(4), 0.07, 0.3, 0.25); v(N(11), 0.07, 0.15, 0.25);
      return 0.35;
    },
    close: function (S, P) {
      S.noise(2200, 0, 0.14, 0.1, { q: 1.5, f2: 500, a: 0.04 });
      var v = voice(S, P); v(N(7), 0.02, 0.28, 0.2); v(N(0), 0.08, 0.3, 0.22);
      return 0.32;
    },
    toggle: function (S, P, o) {
      var on = o.on !== false;
      if (P === 'retro') { S.chip(on ? N(12) : N(7), 0, 0.7, 0.04, { square: true }); S.chip(on ? N(19) : N(0), 0.04, 0.7, 0.04, { square: true }); return 0.1; }
      S.noise(on ? 3000 : 2200, 0, 0.015, 0.35, { q: 3 });
      voice(S, P)(on ? N(12) : N(7), 0.005, 0.38, 0.12);
      return 0.15;
    },
    whoosh: function (S, P) {
      if (P === 'retro') { S.noise(600, 0, 0.22, 0.6, { q: 2, f2: 5000, a: 0.06 }); return 0.3; }
      S.noise(300, 0, 0.25, 0.9, { q: 1.4, f2: 3200, a: 0.1 });
      S.noise(8000, 0.05, 0.16, 0.12, { type: 'highpass', q: 0.5, a: 0.06 });
      return 0.38;
    },
    xp: function (S, P, o) {
      var p = clamp(+o.p || 0, 0, 1), f = N(12 + Math.round(p * 12));
      if (P === 'retro') { S.chip(f, 0, 0.6, 0.03, { square: true }); return 0.05; }
      S.osc(f, 0, 0.05, 0.45, { a: 0.001 }); S.osc(f * 3, 0, 0.02, 0.08, { a: 0.001 }); return 0.07;
    },
    levelup: function (S, P) {
      var v = voice(S, P);
      [[0, 0], [4, 0.09], [7, 0.18], [12, 0.27]].forEach(function (x) { v(N(x[0] - 5), x[1], 0.36, 0.25); });
      [0, 4, 7, 12, 16].forEach(function (s) { v(N(s - 5 + 0), 0.4, 0.22, 0.85); });
      for (var k = 0; k < 6; k++) S.fm(N([24, 28, 31, 36, 31, 28][k]), 0.42 + k * 0.06, 0.4, 0.05, { ratio: 3.5, index: 0.5 });
      if (P !== 'retro') S.noise(5000, 0.38, 0.6, 0.04, { q: 1, f2: 10000, a: 0.02 });
      return 1.3;
    },
    chest: function (S, P) {
      // heavy lid thunk, then the contents rattling
      S.osc(110, 0, 0.18, 0.9, { slide: 0.6, a: 0.003 });
      S.noise(600, 0, 0.12, 0.7, { q: 1.2 });
      S.noise(1800, 0, 0.03, 0.4, { q: 2 });
      for (var k = 0; k < 7; k++) {
        var at = 0.12 + k * 0.045 + Math.random() * 0.02;
        if (P === 'retro') S.chip(N(24 + (k % 3) * 2), at, 0.25, 0.03, { square: true });
        else S.noise(2500 + Math.random() * 3000, at, 0.025, 0.28 - k * 0.025, { q: 8 });
      }
      voice(S, P)(N(19), 0.45, 0.25, 0.3);
      return 0.8;
    },
    unlock: function (S, P) {
      var notes = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      for (var k = 0; k < 10; k++) {
        var at = k * 0.045 + Math.random() * 0.015;
        if (P === 'retro') S.chip(N(notes[k] + 12), at, 0.35, 0.06, { square: k % 2 === 0 });
        else S.fm(N(notes[k] + 12), at, 0.4, 0.14, { ratio: 3.5, index: 0.5 });
      }
      if (P !== 'retro') S.noise(3000, 0, 0.55, 0.08, { q: 1.2, f2: 9000, a: 0.25 });
      voice(S, P)(N(12), 0.45, 0.3, 0.6);
      return 1.1;
    },
    coin: function (S, P) {
      if (P === 'retro') { S.chip(N(11), 0, 0.8, 0.06, { square: true }); S.chip(N(16), 0.06, 0.8, 0.25, { square: true }); return 0.35; }
      S.fm(N(23), 0, 0.12, 0.3, { ratio: 3.5, index: 0.6 }); S.fm(N(28), 0.07, 0.4, 0.32, { ratio: 3.5, index: 0.6 });
      return 0.5;
    },
    achievement: function (S, P) {
      var v = voice(S, P);
      [[7, 0], [12, 0.08], [16, 0.16], [19, 0.24], [24, 0.32]].forEach(function (x) { v(N(x[0]), x[1], 0.32, 0.3); });
      [12, 16, 19].forEach(function (s) { v(N(s), 0.4, 0.2, 0.7); });
      for (var k = 0; k < 5; k++) S.fm(N([31, 36, 34, 38, 43][k]), 0.4 + k * 0.07, 0.4, 0.05, { ratio: 3.5, index: 0.4 });
      return 1.15;
    },
    pop: function (S, P) {
      if (P === 'retro') { S.chip(300, 0, 0.8, 0.05, { square: true, slide: 3, glide: 0.04 }); return 0.07; }
      S.osc(380, 0, 0.06, 0.6, { slide: 2.6, glide: 0.035, a: 0.002 }); S.noise(1500, 0, 0.01, 0.2, { q: 2 });
      return 0.08;
    },
    card: function (S, P) {
      S.noise(2500, 0, 0.09, 0.5, { q: 0.8, f2: 5000, a: 0.03 });
      if (P === 'retro') S.chip(N(14), 0.08, 0.4, 0.03, { square: true });
      else S.noise(3500, 0.09, 0.015, 0.35, { q: 3 });
      return 0.14;
    }
  };
  // aliases for names used elsewhere in the app
  DEF.bad = DEF.wrong;
  DEF.puzzleRight = DEF.correct;
  DEF.puzzleWrong = DEF.wrong;

  // Per-pack, per-sound gain trims, calibrated with the offline check in
  // tools/qa/audio_demo.html so every sound sits at a consistent loudness
  // (UI ticks quietest, board sounds in the middle, celebrations a little louder).
  /*CAL*/var CAL = {
    wood: {"tap":6.692,"xp":6.698,"countdown":7.633,"pop":3.944,"toggle":2.509,"card":2.585,"confirm":0.681,"back":0.787,"open":0.936,"close":1.065,"whoosh":1.57,"move":8.327,"castle":1.686,"illegal":3.169,"lowtime":4.113,"capture":4.903,"check":1.041,"notify":0.996,"correct":0.985,"wrong":0.883,"hint":1.268,"error":1.169,"combo":1.288,"star":1.944,"coin":1.478,"start":0.95,"win":0.729,"lose":1.196,"draw":0.978,"levelup":0.953,"achievement":1.332,"unlock":1.525,"chest":2.311,"timeup":0.772,"promote":1.512},
    soft: {"tap":5.12,"xp":6.698,"countdown":2.029,"pop":3.947,"toggle":2.351,"card":2.58,"confirm":0.731,"back":0.841,"open":1.008,"close":1.138,"whoosh":1.526,"move":4.728,"castle":1.249,"illegal":1.124,"lowtime":4.035,"capture":2.814,"check":1.138,"notify":1.095,"correct":1.075,"wrong":0.973,"hint":1.391,"error":1.169,"combo":1.387,"star":2.074,"coin":1.478,"start":1.049,"win":0.792,"lose":1.318,"draw":1.084,"levelup":1.037,"achievement":1.427,"unlock":1.683,"chest":2.521,"timeup":0.839,"promote":1.618},
    retro: {"tap":8.414,"xp":9.834,"countdown":5.223,"pop":5.202,"toggle":1.532,"card":1.996,"confirm":2.366,"back":2.785,"open":3.383,"close":3.725,"whoosh":3.41,"move":25,"castle":4.376,"illegal":1.837,"lowtime":2.734,"capture":11.974,"check":3.604,"notify":3.269,"correct":3.275,"wrong":1.488,"hint":4.393,"error":0.975,"combo":4.458,"star":8.237,"coin":1.122,"start":3.017,"win":2.384,"lose":4.24,"draw":3.301,"levelup":3.506,"achievement":4.768,"unlock":4.854,"chest":3.587,"timeup":3.547,"promote":6.109}
  };/*CAL*/
  var BASE = 0.35;

  function render(c, dest, name, opts, pack, t) {
    var fn = DEF[name];
    if (!fn) return 0;
    var key = name === 'bad' || name === 'puzzleWrong' ? 'wrong' : name === 'puzzleRight' ? 'correct' : name;
    var g = c.createGain();
    g.gain.value = BASE * ((CAL[pack] || {})[key] || 1) * (opts.vol == null ? 1 : clamp(+opts.vol, 0, 2));
    g.connect(dest);
    var dur = fn(Synth(c, g, t), pack, opts) || 0.3;
    return dur;
  }

  // ---------- public play ----------
  var last = {};
  var THROTTLE = { xp: 0.04, tap: 0.03, move: 0.025, countdown: 0.08, pop: 0.03, card: 0.03 };
  function sfx(name, opts) {
    try {
      if (cfg.muted || cfg.volume <= 0 || !name || !DEF[name]) return;
      var c = getCtx();
      if (!c) return;
      resume();
      opts = opts || {};
      var pack = PACKS.indexOf(opts.pack) >= 0 ? opts.pack : curPack();
      var now = c.currentTime, th = THROTTLE[name] || 0.012;
      if (last[name] != null && now - last[name] < th && now >= last[name]) return;
      last[name] = now;
      render(c, chain.sfx, name, opts, pack, now + 0.005);
    } catch (e) { }
  }

  // ======================= MUSIC =======================
  // Procedural cozy jazz-club loop. Eighth-note step scheduler with look-ahead.
  var STYLES = {
    club: { bpm: 84, swing: 0.62, drums: 1, bass: 1, melody: 0.35, hiss: 1, lp: 3600, epAttack: 0.006, density: 1 },
    focus: { bpm: 66, swing: 0.58, drums: 0.35, bass: 0.7, melody: 0.12, hiss: 0, lp: 2400, epAttack: 0.03, density: 0.55 }
  };
  // chords: [rootMidi, intervals above root used for the voicing]
  var CH = {
    Gm9: [43, [3, 7, 10, 14]], C13: [36, [4, 10, 14, 21]], C9sus: [36, [5, 10, 14, 19]], Fmaj9: [41, [4, 7, 11, 14]], Dm9: [38, [3, 7, 10, 14]],
    Bbmaj9: [46, [4, 7, 11, 14]], Am7: [45, [3, 7, 10, 15]], A7b9: [45, [4, 10, 13, 19]], Ebmaj9: [39, [4, 7, 11, 14]], Dbmaj7: [37, [4, 7, 11, 18]],
    Gm7: [43, [3, 7, 10, 17]], Cm9: [36, [3, 7, 10, 14]], F9: [41, [4, 10, 14, 19]], Fmaj7: [41, [4, 7, 11, 16]], E7alt: [40, [4, 10, 15, 20]]
  };
  var SECTIONS = {
    A: [['Gm9', 'C13', 'Fmaj9', 'Dm9'], ['Gm9', 'C9sus', 'Fmaj9', 'A7b9']],
    B: [['Bbmaj9', 'Am7', 'Dm9', 'Gm7'], ['Bbmaj9', 'A7b9', 'Dm9', 'C9sus']],
    C: [['Ebmaj9', 'Dm9', 'Dbmaj7', 'C9sus'], ['Cm9', 'F9', 'Bbmaj9', 'E7alt']]
  };
  var FORMS = [['A', 'A', 'B', 'A'], ['A', 'B', 'A', 'C'], ['A', 'C', 'B', 'A']];
  var COMP = [ // [step (eighths), length in eighths, velocity]
    [[0, 6, 1]], [[0, 3, 1], [3, 4, 0.7]], [[1, 2, 0.8], [4, 3, 0.9]], [[0, 2, 1], [5, 3, 0.8]], [[2, 4, 0.9], [7, 1, 0.6]], [[0, 8, 0.9]]
  ];
  var mf = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var rnd = Math.random, pick = function (a) { return a[Math.floor(rnd() * a.length)]; };

  function MusicEngine(c, outNode, style) {
    var st = STYLES[style] || STYLES.club, me = this;
    var bus = c.createGain(); bus.gain.value = 0;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = st.lp; lp.Q.value = 0.4;
    // cheap room: one damped feedback delay
    var dl = c.createDelay(1), fb = c.createGain(), dlp = c.createBiquadFilter(), wet = c.createGain();
    dl.delayTime.value = 0.19; fb.gain.value = 0.32; dlp.type = 'lowpass'; dlp.frequency.value = 1800; wet.gain.value = 0.22;
    var mix = c.createGain(); mix.gain.value = 1;
    mix.connect(lp); lp.connect(bus); bus.connect(outNode);
    mix.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(lp);
    var drumBus = c.createGain(); drumBus.gain.value = 1; drumBus.connect(bus); // drums skip the warm lowpass for air
    this.bus = bus; this.c = c; this.st = st;
    var stepDur = 60 / st.bpm / 2;
    var bar = 0, step = 0, form = pick(FORMS), formPos = 0, prog = null, chordName = null, nextChord = null, prevVoicing = null, comp = null, sectionMood = 1, dropDrums = false, hissSrc = null;
    var nextTime = 0;
    function voicing(name) {
      var ch = CH[name], ints = ch[1].slice();
      if (rnd() < 0.3) ints.splice(Math.floor(rnd() * ints.length), 1); // thinner voicing sometimes
      var center = prevVoicing ? prevVoicing.reduce(function (a, b) { return a + b; }, 0) / prevVoicing.length : 63 + Math.floor(rnd() * 3);
      var notes = ints.map(function (i) { var m = ch[0] + i; while (m < center - 6) m += 12; while (m > center + 6) m -= 12; return m; });
      notes.sort(function (a, b) { return a - b; });
      for (var k = 1; k < notes.length; k++) if (notes[k] === notes[k - 1]) notes[k] += 12;
      var avg = notes.reduce(function (a, b) { return a + b; }, 0) / notes.length;
      if (avg > 69) notes = notes.map(function (m) { return m - 12; });
      if (avg < 57) notes = notes.map(function (m) { return m + 12; });
      prevVoicing = notes;
      return notes;
    }
    function ep(m, t, len, v) { // electric piano: tine FM + body
      var f = mf(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = f; mod.frequency.value = f; mod.detune.value = rnd() * 6 - 3;
      mg.gain.setValueAtTime(f * 1.1 * v, t); mg.gain.exponentialRampToValueAtTime(f * 0.08 + 1, t + 0.35);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(mix);
      var a = st.epAttack, end = t + len + 0.6;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.055 * v, t + a);
      g.gain.setTargetAtTime(0.03 * v, t + a, 0.4); g.gain.setTargetAtTime(0, t + len, 0.15);
      car.start(t); mod.start(t); car.stop(end); mod.stop(end);
    }
    function bass(m, t, len, v) {
      var o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = mf(m); o2.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.value = 520;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(bus);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v * st.bass, t + 0.012);
      g.gain.setTargetAtTime(0.08 * v * st.bass, t + 0.02, 0.25); g.gain.setTargetAtTime(0, t + len * 0.92, 0.05);
      o.start(t); o2.start(t); o.stop(t + len + 0.3); o2.stop(t + len + 0.3);
    }
    function nz(t, f, type, q, len, v, a, dst) {
      var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(c); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      s.connect(fl); fl.connect(g); g.connect(dst || drumBus);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(v * 0.002 + 1e-5, t + a + len); g.gain.linearRampToValueAtTime(0, t + a + len + 0.01);
      s.start(t, rnd() * 1.2); s.stop(t + a + len + 0.02);
    }
    function kick(t, v) {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.connect(g); g.connect(bus);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22); g.gain.linearRampToValueAtTime(0, t + 0.23);
      o.start(t); o.stop(t + 0.24);
    }
    function vib(m, t, v) { // soft vibraphone-ish melody note
      var f = mf(m), o = c.createOscillator(), o4 = c.createOscillator(), g = c.createGain(), g4 = c.createGain();
      o.frequency.value = f; o4.frequency.value = f * 4; g4.gain.value = 0.12;
      o.connect(g); o4.connect(g4); g4.connect(g); g.connect(mix);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, t + 1.4); g.gain.linearRampToValueAtTime(0, t + 1.41);
      o.start(t); o4.start(t); o.stop(t + 1.42); o4.stop(t + 1.42);
    }
    function startHiss(t) {
      if (!st.hiss) return;
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(c); s.loop = true; f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 0.4; g.gain.value = 0.006;
      s.connect(f); f.connect(g); g.connect(bus); s.start(t); hissSrc = s;
    }
    function newBar() {
      if (bar % 4 === 0) { // new section
        var sec = form[formPos % form.length]; formPos++;
        if (formPos % form.length === 0) form = pick(FORMS);
        prog = pick(SECTIONS[sec]);
        sectionMood = sec === 'A' ? 1 : sec === 'B' ? 1.1 : 0.85;
        dropDrums = rnd() < (sec === 'C' ? 0.5 : 0.12);
      }
      chordName = prog[bar % 4];
      nextChord = bar % 4 === 3 ? null : prog[(bar % 4) + 1];
      comp = pick(COMP);
      if (st.density < 1 && rnd() > st.density) comp = [[0, 8, 0.85]];
      me.voicing = voicing(chordName);
    }
    function schedStep(t) {
      var s8 = step % 8;
      if (s8 === 0) newBar();
      var swingOff = (s8 % 2 === 1) ? stepDur * (st.swing - 0.5) * 2 : 0, tt = t + swingOff;
      var hum = function () { return (rnd() - 0.5) * 0.012; };
      // chords
      comp.forEach(function (h) { if (h[0] === s8) me.voicing.forEach(function (m, i) { ep(m, tt + hum() + i * 0.006 * (rnd() < 0.4 ? 1 : 0), h[1] * stepDur, h[2] * sectionMood * (0.85 + rnd() * 0.25)); }); });
      // bass: root on 1, fifth/approach elsewhere
      var root = CH[chordName][0];
      if (s8 === 0) bass(root, tt, (st.density < 1 ? 7 : 3.6) * stepDur, 1);
      else if (st.density >= 1 && s8 === 4) bass(rnd() < 0.6 ? root + 7 : root + (rnd() < 0.5 ? 3 : 4), tt, 1.8 * stepDur, 0.85);
      else if (st.density >= 1 && s8 === 6 && rnd() < 0.55) { var nx = nextChord ? CH[nextChord][0] : CH[prog[0]][0]; bass(nx + (rnd() < 0.5 ? 1 : -1), tt, 1.6 * stepDur, 0.75); }
      // drums (brushes)
      if (st.drums && !dropDrums) {
        var dv = st.drums;
        if (s8 % 2 === 0 || rnd() < 0.5) nz(tt + hum(), 7500, 'highpass', 0.7, 0.03, (s8 % 2 === 0 ? 0.03 : 0.018) * dv * (0.7 + rnd() * 0.5), 0.002);
        if (s8 === 2 || s8 === 6) nz(tt, 3800, 'bandpass', 0.8, 0.16, 0.05 * dv, 0.025);
        if (st.density >= 1 && (s8 === 0 || (s8 === 5 && rnd() < 0.3))) kick(tt, s8 === 0 ? 1 : 0.6);
      }
      // sparse melody from upper chord tones
      if (st.melody && (s8 === 1 || s8 === 3 || s8 === 4 || s8 === 7) && rnd() < st.melody * (s8 === 4 ? 0.6 : 0.3)) {
        var top = me.voicing[me.voicing.length - 1], cand = me.voicing.map(function (m) { return m + 12; }).concat([top + 12 + 2]);
        vib(pick(cand), tt + hum(), 0.8 + rnd() * 0.3);
      }
      step++; if (step % 8 === 0) bar++;
    }
    this.schedUntil = function (until) { while (nextTime < until) { schedStep(nextTime); nextTime += stepDur; } };
    this.start = function (t) {
      nextTime = t + 0.05; startHiss(t);
      bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 1.5);
    };
    this.stop = function (t) {
      try { bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 0.6); } catch (e) { }
      try { if (hissSrc) hissSrc.stop(t + 0.7); } catch (e) { }
      setTimeout(function () { try { bus.disconnect(); } catch (e) { } }, 1500);
    };
  }

  var music = {
    playing: false, style: null, engine: null, timer: null,
    start: function (style) {
      try {
        style = STYLES[style] ? style : 'club';
        if (music.playing && music.style === style) return;
        if (music.playing) music.stop();
        var c = getCtx(); if (!c) return;
        resume();
        var eng = new MusicEngine(c, chain.music, style);
        eng.start(c.currentTime + 0.05);
        music.engine = eng; music.style = style; music.playing = true;
        var tick = function () {
          try { if (music.engine !== eng) return; eng.schedUntil(c.currentTime + 0.35); } catch (e) { }
          music.timer = setTimeout(tick, 90);
        };
        tick();
      } catch (e) { }
    },
    stop: function () {
      try {
        clearTimeout(music.timer); music.timer = null;
        if (music.engine && ctx) music.engine.stop(ctx.currentTime);
      } catch (e) { }
      music.engine = null; music.playing = false; music.style = null;
    },
    setVolume: function (v) {
      try {
        cfg.musicVolume = clamp(+v || 0, 0, 1); save();
        if (chain && ctx) chain.music.gain.setTargetAtTime(cfg.musicVolume * MUSIC_TRIM, ctx.currentTime, 0.05);
      } catch (e) { }
    },
    get volume() { return cfg.musicVolume; }
  };

  // ---------- offline rendering (QA) ----------
  function offline(seconds) {
    if (!OAC) return null;
    var sr = 44100;
    var c = new OAC(2, Math.ceil(sr * seconds), sr);
    return { c: c, chain: makeChain(c) };
  }
  function renderOffline(name, opts, pack) {
    try {
      opts = opts || {};
      var o = offline(3); if (!o || !DEF[name]) return Promise.resolve(null);
      o.chain.sfx.gain.value = cfg.volume;
      var dur = render(o.c, o.chain.sfx, name, opts, PACKS.indexOf(pack) >= 0 ? pack : 'wood', 0.01);
      return o.c.startRendering().then(function (buf) { return { buffer: buf, declared: dur }; });
    } catch (e) { return Promise.resolve(null); }
  }
  function renderMusicOffline(style, seconds) {
    try {
      var o = offline(seconds); if (!o) return Promise.resolve(null);
      o.chain.music.gain.value = cfg.musicVolume * MUSIC_TRIM;
      var eng = new MusicEngine(o.c, o.chain.music, style);
      eng.start(0); eng.schedUntil(seconds);
      return o.c.startRendering();
    } catch (e) { return Promise.resolve(null); }
  }

  var SFX = {
    play: sfx,
    get names() { return Object.keys(DEF); },
    get packs() { return PACKS.slice(); },
    get volume() { return cfg.volume; },
    set volume(v) { SFX.setVolume(v); },
    get muted() { return cfg.muted; },
    set muted(b) { SFX.setMuted(b); },
    setVolume: function (v) {
      try {
        cfg.volume = clamp(+v || 0, 0, 1); save();
        if (chain && ctx) chain.sfx.gain.setTargetAtTime(cfg.muted ? 0 : cfg.volume, ctx.currentTime, 0.02);
      } catch (e) { }
    },
    setMuted: function (b) {
      try {
        cfg.muted = !!b; save();
        if (chain && ctx) chain.sfx.gain.setTargetAtTime(cfg.muted ? 0 : cfg.volume, ctx.currentTime, 0.02);
      } catch (e) { }
    },
    get pack() { return curPack(); },
    set pack(p) { packOverride = PACKS.indexOf(p) >= 0 ? p : null; },
    get available() { return !!AC; },
    unlock: onGesture,
    music: music,
    _renderOffline: renderOffline,
    _renderMusicOffline: renderMusicOffline,
    _cal: CAL
  };
  try { W.SFX = SFX; W.sfx = sfx; } catch (e) { }
})();
