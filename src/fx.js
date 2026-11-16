// Knight Club motion kit: an animated Professor Hoot, particle bursts, floating text, star ratings,
// the treasure chest reveal, the end-of-game results screen and small "juice" helpers.
// All art is original inline SVG / CSS / canvas. CSS classes and keyframes use the kx- prefix (src/css/30-fx.css).
// Public globals: hootEl, setHootMood, hootReact, fxBurst, fxFloat, starRating, chestReveal,
// resultsScreen, fxShake, fxPop, fxPulse, screenWipe. Everything else stays inside this closure.
'use strict';
(function () {
  const D = document, W = window;
  let uidN = 0;
  const uid = () => 'kx' + (++uidN).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const T = s => (typeof tr === 'function' ? tr(s) : s);
  const snd = n => { try { if (typeof beep === 'function') beep(n); } catch (e) { } };
  const buzz = p => { try { if (typeof haptic === 'function') haptic(p); } catch (e) { } };
  const mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  // reduced motion: the OS setting or the app's own "animations off" switch (body.no-anim)
  function calm() {
    const c = !!(mq && mq.matches) || !!(D.body && D.body.classList.contains('no-anim'));
    D.documentElement.classList.toggle('kx-rm', c);
    return c;
  }
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', calm); else if (mq.addListener) mq.addListener(calm); }
  function mk(tag, cls, html) { const e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function txt(tag, cls, s) { const e = mk(tag, cls); e.textContent = s == null ? '' : String(s); return e; }
  function center(t) {
    if (!t) return { x: innerWidth / 2, y: innerHeight / 2 };
    if (t.getBoundingClientRect) { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    if (t.width != null) return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    return { x: t.x || 0, y: t.y || 0 };
  }
  // restart a one-shot CSS animation class
  function replay(el, cls, ms) {
    if (!el || !el.classList) return el;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    clearTimeout(el['_kx' + cls]);
    el['_kx' + cls] = setTimeout(() => el.classList.remove(cls), ms);
    return el;
  }
  // run fn once the element is in the page (or give up after ~4 s)
  function whenConnected(el, fn) {
    let n = 0;
    const chk = () => { if (el.isConnected) fn(); else if (n++ < 240) requestAnimationFrame(chk); };
    chk();
  }
  const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  // =====================================================================
  // 1. Professor Hoot
  // =====================================================================
  const MOODS = ['idle', 'talk', 'happy', 'cheer', 'think', 'sad', 'wow', 'wave'];
  const SPARK = 'M0 -6Q1 -1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z';
  function hootSvg(u) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="${u}b" cx=".36" cy=".28" r=".85"><stop offset="0" stop-color="#b07c4f"/><stop offset=".55" stop-color="#8a5a36"/><stop offset="1" stop-color="#5e3a20"/></radialGradient>
<radialGradient id="${u}bl" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#fbf0d8"/><stop offset=".6" stop-color="#ecd6b4"/><stop offset="1" stop-color="#d2b48a"/></radialGradient>
<linearGradient id="${u}w" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#83532f"/><stop offset="1" stop-color="#5a361c"/></linearGradient>
<linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47414f"/><stop offset="1" stop-color="#1f1c25"/></linearGradient>
<radialGradient id="${u}e" cx=".42" cy=".36" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".65" stop-color="#fffdf7"/><stop offset="1" stop-color="#e6dccb"/></radialGradient>
<linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc35a"/><stop offset="1" stop-color="#ea8f22"/></linearGradient>
</defs>
<ellipse class="kx-h-shadow" cx="50" cy="96.5" rx="23" ry="3.6" fill="#000" opacity=".24"/>
<g class="kx-h-all"><g class="kx-h-body">
<g fill="#f0a02c" stroke="#c87a18" stroke-width=".8"><circle cx="38" cy="93.6" r="2.4"/><circle cx="41.6" cy="94.3" r="2.4"/><circle cx="45.2" cy="93.6" r="2.4"/><circle cx="54.8" cy="93.6" r="2.4"/><circle cx="58.4" cy="94.3" r="2.4"/><circle cx="62" cy="93.6" r="2.4"/></g>
<ellipse cx="50" cy="67" rx="31" ry="28.5" fill="url(#${u}b)"/>
<ellipse cx="50" cy="73" rx="19.5" ry="20" fill="url(#${u}bl)"/>
<path d="M41 71q2.5 2.2 5 0M54 71q2.5 2.2 5 0M47.5 77q2.5 2.2 5 0M41 83q2.5 2.2 5 0M54 83q2.5 2.2 5 0M47.5 88.5q2.5 2 5 0" stroke="#c6a378" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<g class="kx-h-head">
<path class="kx-h-tl" d="M27 39L19.5 22.5Q20 20.5 22 21.5L36 32z" fill="#6f4426"/>
<path class="kx-h-tr" d="M73 39L80.5 22.5Q80 20.5 78 21.5L64 32z" fill="#6f4426"/>
<ellipse cx="50" cy="47" rx="30" ry="24.5" fill="url(#${u}b)"/>
<path d="M50 41C44 33 23 33 22.5 50.5C22 64 38 69 50 62.5C62 69 78 64 77.5 50.5C77 33 56 33 50 41z" fill="#d4ab7c" opacity=".5"/>
<ellipse class="kx-h-cheek" cx="27" cy="62" rx="5" ry="3" fill="#ff8f73"/>
<ellipse class="kx-h-cheek" cx="73" cy="62" rx="5" ry="3" fill="#ff8f73"/>
<g class="kx-h-eyes">
<g class="kx-h-eye"><circle cx="37" cy="51" r="12.5" fill="url(#${u}e)" stroke="#3b2a1d" stroke-width="1.8"/><g class="kx-h-pup"><circle cx="38" cy="52" r="6.2" fill="#2b2320"/><circle cx="40.1" cy="49.7" r="2.2" fill="#fff"/><circle cx="36" cy="54.6" r=".95" fill="#fff" opacity=".8"/></g><ellipse class="kx-h-lid" cx="37" cy="51" rx="13.6" ry="13.6" fill="#7a4c2b" stroke="#3b2a1d" stroke-width="1.8" vector-effect="non-scaling-stroke"/></g>
<g class="kx-h-eye"><circle cx="63" cy="51" r="12.5" fill="url(#${u}e)" stroke="#3b2a1d" stroke-width="1.8"/><g class="kx-h-pup"><circle cx="62" cy="52" r="6.2" fill="#2b2320"/><circle cx="64.1" cy="49.7" r="2.2" fill="#fff"/><circle cx="60" cy="54.6" r=".95" fill="#fff" opacity=".8"/></g><ellipse class="kx-h-lid" cx="63" cy="51" rx="13.6" ry="13.6" fill="#7a4c2b" stroke="#3b2a1d" stroke-width="1.8" vector-effect="non-scaling-stroke"/></g>
</g>
<path class="kx-h-brl" d="M27.5 36.5q8-5.5 15.5-1" stroke="#4a2c18" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path class="kx-h-brr" d="M57 35.5q7.5-4.5 15.5 1" stroke="#4a2c18" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<g class="kx-h-happy" stroke="#2b2320" stroke-width="3.6" fill="none" stroke-linecap="round"><path d="M27.5 54.5q9.5-11 19 0"/><path d="M53.5 54.5q9.5-11 19 0"/></g>
<path class="kx-h-tear" d="M71 61.5q-2.6 4.2 0 5.8q2.6-1.6 0-5.8z" fill="#9ccfff" stroke="#5f9fd6" stroke-width=".6"/>
<ellipse class="kx-h-mouth" cx="50" cy="65" rx="4" ry="4.8" fill="#5a2412"/>
<g class="kx-h-beak"><path class="kx-h-jaw" d="M45.6 60.5Q50 67.5 54.4 60.5z" fill="#c8701c"/><path d="M43.8 57.2Q50 54.4 56.2 57.2L50.9 65.6Q50 66.8 49.1 65.6z" fill="url(#${u}k)" stroke="#b86a14" stroke-width=".7" stroke-linejoin="round"/><path d="M46.6 57.6Q50 56.3 53.2 57.4" stroke="#ffe0a0" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>
<g class="kx-h-cap">
<path d="M31 26.5v8.5c9 6.2 29 6.2 38 0v-8.5" fill="#2e2a35"/>
<path d="M31 33q19 7 38 0" stroke="#4a4454" stroke-width="1.2" fill="none" opacity=".7"/>
<path d="M16.5 24.5L50 11.5L83.5 24.5L50 37.5z" fill="url(#${u}c)" stroke="#16131b" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M23.5 24L50 13.8" stroke="#6b6478" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>
<path d="M50 24.5Q66 22.5 79.2 25" stroke="#ffcf3f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<circle cx="50" cy="24.5" r="2.5" fill="#ffcf3f" stroke="#c9961c" stroke-width=".7"/>
<g class="kx-h-tassel"><path d="M79.2 25v12" stroke="#ffcf3f" stroke-width="1.8" stroke-linecap="round"/><circle cx="79.2" cy="37.6" r="2" fill="#e3a92a"/><path d="M76.7 38.4h5l1.3 7.6q-3.8 1.4-7.6 0z" fill="#ffcf3f" stroke="#c9961c" stroke-width=".7" stroke-linejoin="round"/><path d="M78.2 40v5.4M80.2 40v5.4" stroke="#d9a326" stroke-width=".7"/></g>
</g>
</g>
<g class="kx-h-wl"><path d="M28.5 57.5C18 60 12.5 72 15 83.5C16 88.5 19.5 92 22.5 90C28 84 31.5 72 31 60z" fill="url(#${u}w)" stroke="#4e2f18" stroke-width=".8"/><path d="M18.5 79.5q4.5-1.5 8-8.5M20 86q4-1.5 7-7.5" stroke="#a7774c" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/></g>
<g class="kx-h-wr"><path d="M71.5 57.5C82 60 87.5 72 85 83.5C84 88.5 80.5 92 77.5 90C72 84 68.5 72 69 60z" fill="url(#${u}w)" stroke="#4e2f18" stroke-width=".8"/><path d="M81.5 79.5q-4.5-1.5-8-8.5M80 86q-4-1.5-7-7.5" stroke="#a7774c" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/></g>
</g></g>
<g class="kx-h-fx">
<g transform="translate(9 40)"><path class="kx-h-sp" d="${SPARK}" fill="#ffe39a"/></g>
<g transform="translate(92 46) scale(.8)"><path class="kx-h-sp" d="${SPARK}" fill="#fff6d8"/></g>
<g transform="translate(14 14) scale(.7)"><path class="kx-h-sp" d="${SPARK}" fill="#ffe39a"/></g>
<g transform="translate(89 12)"><path class="kx-h-sp" d="${SPARK}" fill="#ffcf3f"/></g>
<g class="kx-h-dots" fill="#fbf4e3" stroke="#2a2219" stroke-width=".8"><circle cx="87" cy="16" r="2.2"/><circle cx="92.5" cy="7.5" r="3.2"/><circle cx="99" cy="-3" r="4.4"/></g>
<g class="kx-h-wowl" stroke="#ffe39a" stroke-width="2.4" stroke-linecap="round"><path d="M12 33l-7-2.5M15 24.5l-5.5-5M22 18l-2.5-6"/><path d="M88 33l7-2.5M85 24.5l5.5-5M78 18l2.5-6"/></g>
</g>
</svg>`;
  }
  function applyMood(el, mood) {
    if (MOODS.indexOf(mood) < 0) mood = 'idle';
    if (el._kxMood === mood) return;
    for (const m of MOODS) el.classList.remove('m-' + m);
    el.classList.add('m-' + mood);
    el._kxMood = mood;
    if (!calm()) replay(el, 'kx-boing', 420);
  }
  function blinkLoop(el) {
    const tick = () => {
      if (el.isConnected) el._kxSeen = 1;
      else if (el._kxSeen || (Date.now() - el._kxBorn) > 300000) return; // removed from the page: stop
      if (el.isConnected && !D.hidden) {
        el.classList.add('kx-blink');
        setTimeout(() => el.classList.remove('kx-blink'), 120);
        if (Math.random() < .22) setTimeout(() => { el.classList.add('kx-blink'); setTimeout(() => el.classList.remove('kx-blink'), 110); }, 260);
      }
      el._kxBlinkT = setTimeout(tick, 2300 + Math.random() * 3600);
    };
    el._kxBlinkT = setTimeout(tick, 900 + Math.random() * 2400);
  }
  function hootEl(mood = 'idle', size = 56) {
    calm();
    if (MOODS.indexOf(mood) < 0) mood = 'idle';
    const el = mk('span', 'kx-hoot m-' + mood, hootSvg(uid()));
    el.style.width = el.style.height = size + 'px';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Professor Hoot');
    el._kxMood = el._kxBase = mood; el._kxBorn = Date.now();
    blinkLoop(el);
    return el;
  }
  function setHootMood(el, mood) {
    if (!el || !el.classList) return;
    clearTimeout(el._kxReactT);
    el._kxBase = MOODS.indexOf(mood) < 0 ? 'idle' : mood;
    applyMood(el, el._kxBase);
  }
  function hootReact(el, mood, ms = 1400) {
    if (!el || !el.classList) return;
    if (el._kxBase == null) el._kxBase = el._kxMood || 'idle';
    clearTimeout(el._kxReactT);
    applyMood(el, mood);
    el._kxReactT = setTimeout(() => applyMood(el, el._kxBase), ms);
  }

  // =====================================================================
  // 2. Particles: one shared canvas, only alive while something is flying
  // =====================================================================
  let cv = null, cx = null, parts = [], running = false, last = 0, dpr = 1;
  const sprites = {};
  function starPts(g, x, y, R, r, n = 5) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function sprite(key) {
    if (sprites[key]) return sprites[key];
    const s = 64, c = D.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    if (key === 'star') {
      g.lineJoin = 'round';
      starPts(g, 32, 34, 27, 12.5); g.lineWidth = 7; g.strokeStyle = '#a8741b'; g.stroke();
      const gr = g.createLinearGradient(0, 8, 0, 60); gr.addColorStop(0, '#fff3b8'); gr.addColorStop(.45, '#ffcf3f'); gr.addColorStop(1, '#e48f22');
      starPts(g, 32, 34, 27, 12.5); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = gr; g.stroke();
      g.beginPath(); g.ellipse(26, 25, 5, 2.6, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
    } else if (key === 'coin') {
      g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fillStyle = '#a8741b'; g.fill();
      const gr = g.createLinearGradient(0, 6, 0, 58); gr.addColorStop(0, '#fff0b0'); gr.addColorStop(.5, '#efbb4f'); gr.addColorStop(1, '#c98a22');
      g.beginPath(); g.arc(32, 30, 26, 0, 7); g.fillStyle = gr; g.fill();
      g.beginPath(); g.arc(32, 30, 18, 0, 7); g.lineWidth = 3; g.strokeStyle = 'rgba(168,116,27,.7)'; g.stroke();
      starPts(g, 32, 31, 10, 4.6); g.fillStyle = 'rgba(168,116,27,.75)'; g.fill();
      g.beginPath(); g.ellipse(22, 18, 7, 3, -0.6, 0, 7); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    } else if (key === 'orb') {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,248,214,1)'); gr.addColorStop(.42, 'rgba(255,214,102,.75)'); gr.addColorStop(1, 'rgba(239,187,79,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    } else if (key === 'glint') {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,240,190,.8)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(35, 29, 64, 32); g.quadraticCurveTo(35, 35, 32, 64); g.quadraticCurveTo(29, 35, 0, 32); g.quadraticCurveTo(29, 29, 32, 0); g.fill();
    }
    return sprites[key] = c;
  }
  function sizeCanvas() {
    if (!cv) return;
    dpr = Math.min(2, W.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  }
  function ensureCanvas() {
    if (!cv) { cv = mk('canvas', 'kx-canvas'); cv.setAttribute('aria-hidden', 'true'); cx = cv.getContext('2d'); W.addEventListener('resize', sizeCanvas); sizeCanvas(); }
    if (!cv.isConnected) D.body.append(cv);
    cv.style.display = 'block';
  }
  function step(t) {
    const dt = Math.min(34, Math.max(1, t - last)); last = t;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age >= p.life) { parts.splice(i, 1); if (p.onHit && p.homing) p.onHit(p); continue; }
      const f = Math.pow(p.drag, dt / 16);
      if (p.homing && p.age > p.homeAt) {
        if (!p.hx) { p.hx = p.x; p.hy = p.y; }
        const k = Math.min(1, (p.age - p.homeAt) / (p.life - p.homeAt)), e = k * k * (3 - 2 * k) * k;
        p.x = p.hx + (p.tx - p.hx) * e + Math.sin(k * Math.PI) * p.curve; p.y = p.hy + (p.ty - p.hy) * e;
      } else {
        p.vy += p.g * dt; p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      p.rot += p.vr * dt;
      const k = p.age / p.life;
      const fade = p.homing ? 1 : Math.min(1, (1 - k) / .35);
      const grow = Math.min(1, p.age / 90);
      const s = p.size * (p.kind === 'sparks' ? 1 : (0.35 + 0.65 * grow) * (p.shrink ? 1 - k * .5 : 1));
      cx.globalAlpha = Math.max(0, fade);
      if (p.kind === 'sparks') {
        cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = p.color; cx.lineWidth = s; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(p.x - p.vx * 26, p.y - p.vy * 26); cx.lineTo(p.x, p.y); cx.stroke();
        cx.globalCompositeOperation = 'source-over';
        continue;
      }
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
      if (p.kind === 'confetti') {
        const fl = Math.cos(p.age * p.fl);
        cx.scale(1, fl); cx.fillStyle = p.color;
        if (p.round) { cx.beginPath(); cx.arc(0, 0, s * .45, 0, 7); cx.fill(); }
        else cx.fillRect(-s / 2, -s * .3, s, s * .6);
      } else if (p.kind === 'coins') {
        cx.scale(Math.max(.12, Math.abs(Math.cos(p.age * p.fl))), 1);
        cx.drawImage(sprite('coin'), -s / 2, -s / 2, s, s);
      } else if (p.kind === 'xp') {
        cx.globalCompositeOperation = 'lighter';
        cx.drawImage(sprite('orb'), -s, -s, s * 2, s * 2);
        cx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'glint') {
        cx.globalCompositeOperation = 'lighter';
        const tw = .6 + .4 * Math.sin(p.age * .02);
        cx.drawImage(sprite('glint'), -s * tw, -s * tw, s * 2 * tw, s * 2 * tw);
        cx.globalCompositeOperation = 'source-over';
      } else {
        cx.drawImage(sprite('star'), -s / 2, -s / 2, s, s);
      }
      cx.restore();
    }
    cx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(step);
    else { running = false; cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
  }
  const CONF_COLS = ['#efbb4f', '#ffe39a', '#93dc98', '#ff8a78', '#9ccfff', '#c99bff', '#fbf4e3'];
  const SPARK_COLS = ['#fff3c4', '#ffe39a', '#ffcf3f', '#ffb547'];
  const KIND = {
    stars: { n: 14, sp: [.22, .55], g: .0009, drag: .965, life: [750, 1150], size: [12, 24], vr: .008 },
    confetti: { n: 46, sp: [.35, .95], g: .0011, drag: .95, life: [1300, 2000], size: [6, 11], vr: .012, up: .25 },
    sparks: { n: 22, sp: [.45, 1.05], g: .0004, drag: .9, life: [360, 600], size: [1.6, 3.2], vr: 0 },
    coins: { n: 12, sp: [.4, .75], g: .0019, drag: .985, life: [1050, 1400], size: [19, 27], vr: .004, angle: -90, spread: 130 },
    xp: { n: 10, sp: [.18, .42], g: 0, drag: .9, life: [800, 1000], size: [7, 11], vr: 0 },
    glint: { n: 6, sp: [.05, .2], g: 0, drag: .94, life: [500, 800], size: [8, 15], vr: .002 },
  };
  function fxBurst(target, kind = 'stars', opts = {}) {
    const c = center(target);
    if (calm()) { if (opts.onHit) opts.onHit(); return; }
    const K = KIND[kind] || KIND.stars;
    const n = Math.min(160, Math.round((opts.count != null ? opts.count : K.n)));
    const pw = opts.power || 1, sz = opts.size || 1;
    const spread = (opts.spread != null ? opts.spread : K.spread != null ? K.spread : 360) * Math.PI / 180;
    const ang = (opts.angle != null ? opts.angle : K.angle != null ? K.angle : -90) * Math.PI / 180;
    const cols = opts.colors || (kind === 'sparks' ? SPARK_COLS : CONF_COLS);
    const to = opts.to ? center(opts.to) : null;
    const rr = (a) => a[0] + Math.random() * (a[1] - a[0]);
    let hits = 0;
    ensureCanvas();
    if (parts.length > 360) parts.splice(0, parts.length - 360);
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - .5) * spread, v = rr(K.sp) * pw;
      const p = {
        kind, x: c.x + (Math.random() - .5) * 8, y: c.y + (Math.random() - .5) * 8,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (K.up || 0) * Math.random(),
        g: K.g, drag: K.drag, life: rr(K.life), age: -(opts.stagger ? Math.random() * opts.stagger : 0),
        size: rr(K.size) * sz, rot: Math.random() * 6.28, vr: (Math.random() - .5) * 2 * K.vr,
        color: cols[(Math.random() * cols.length) | 0], fl: .006 + Math.random() * .012, round: Math.random() < .2, shrink: kind === 'stars',
      };
      if (kind === 'xp' && to) {
        p.homing = true; p.tx = to.x; p.ty = to.y; p.homeAt = 160 + Math.random() * 140; p.life = p.homeAt + 420 + Math.random() * 220; p.curve = (Math.random() - .5) * 60;
        p.age = -i * 28;
        p.onHit = () => { hits++; if (opts.onHit) opts.onHit(hits, n); if (hits === 1 && opts.to && opts.to.classList) fxPop(opts.to); };
      } else if (kind === 'xp') { p.vy -= .12; p.g = -.0002; }
      parts.push(p);
    }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); }
  }

  // =====================================================================
  // 3. Floating text
  // =====================================================================
  function fxFloat(target, text, cls = '') {
    const c = center(target);
    const e = txt('div', 'kx-float ' + (cls || ''), text);
    e.setAttribute('aria-hidden', 'true');
    e.style.left = c.x + 'px'; e.style.top = c.y + 'px';
    D.body.append(e);
    const rm = () => e.remove();
    e.addEventListener('animationend', rm);
    setTimeout(rm, calm() ? 1300 : 1700);
    return e;
  }

  // =====================================================================
  // 4. Star rating
  // =====================================================================
  function starPoly(cx0, cy0, R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; pts.push((cx0 + Math.cos(a) * q).toFixed(1) + ',' + (cy0 + Math.sin(a) * q).toFixed(1)); }
    return pts.join(' ');
  }
  const STAR_P = starPoly(50, 54, 42, 20), STAR_IN = starPoly(50, 54, 30, 14.5);
  function starSvg(u) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4bd"/><stop offset=".42" stop-color="#ffd04a"/><stop offset="1" stop-color="#e88a1e"/></linearGradient></defs>
<g class="kx-star-socket"><polygon points="${STAR_P}" fill="rgba(0,0,0,.32)" stroke="rgba(0,0,0,.32)" stroke-width="9" stroke-linejoin="round"/><polygon points="${STAR_IN}" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.06)" stroke-width="3" stroke-linejoin="round" transform="translate(0 3)"/></g>
<g class="kx-star-gold"><polygon points="${STAR_P}" fill="#a8741b" stroke="#8a5a12" stroke-width="12" stroke-linejoin="round" transform="translate(0 3.5)"/><polygon points="${STAR_P}" fill="url(#${u}g)" stroke="url(#${u}g)" stroke-width="7" stroke-linejoin="round"/><polygon points="${STAR_IN}" fill="none" stroke="#fff8d6" stroke-width="2.2" stroke-linejoin="round" opacity=".55"/><path d="M33 34q6-10 14-13" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/></g></svg>`;
  }
  function starRating(n = 0, o = {}) {
    n = Math.max(0, Math.min(3, Math.round(n)));
    const size = o.size || 44, animate = o.animate !== false;
    const wrap = mk('div', 'kx-stars');
    wrap.style.setProperty('--s', size + 'px');
    wrap.setAttribute('role', 'img'); wrap.setAttribute('aria-label', n + ' of 3 stars');
    const stars = [0, 1, 2].map(i => { const s = mk('span', 'kx-star kx-star' + i, starSvg(uid())); wrap.append(s); return s; });
    const show = (i) => {
      const s = stars[i]; s.classList.add('on');
      if (animate && !calm()) {
        s.classList.add('pop'); snd('star'); buzz(12);
        setTimeout(() => fxBurst(s, 'stars', { count: 7, power: .65, size: .6 }), 120);
        setTimeout(() => fxBurst(s, 'sparks', { count: 10, power: .6 }), 100);
      }
    };
    if (!animate || calm()) { for (let i = 0; i < n; i++) stars[i].classList.add('on'); if (animate && n) whenConnected(wrap, () => snd('star')); }
    else whenConnected(wrap, () => { for (let i = 0; i < n; i++) setTimeout(() => wrap.isConnected && show(i), (o.delay || 0) + 160 + i * 400); });
    wrap.kxDuration = (o.delay || 0) + 160 + n * 400;
    return wrap;
  }

  // =====================================================================
  // Shared overlay bits
  // =====================================================================
  function overlay(cls, label) {
    calm();
    const ov = mk('div', 'kx-ov ' + cls);
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); if (label) ov.setAttribute('aria-label', label);
    return ov;
  }
  function popTitle(text) {
    const h1 = mk('h1', 'kx-title'); h1.setAttribute('aria-label', text);
    let i = 0;
    String(text).split(/(\s+)/).forEach(w => {
      if (!w) return;
      if (/^\s+$/.test(w)) { h1.append(D.createTextNode(' ')); return; }
      const ws = mk('span', 'kx-word'); ws.setAttribute('aria-hidden', 'true');
      for (const ch of w) { const c = txt('span', 'kx-ch', ch); c.style.animationDelay = (i++ * 38) + 'ms'; ws.append(c); }
      h1.append(ws);
    });
    return h1;
  }
  function kxButton(b, onClick) {
    const btn = txt('button', 'kx-btn' + (b.primary ? ' primary' : ''), b.label);
    btn.type = 'button';
    btn.addEventListener('click', e => { e.stopPropagation(); snd('tap'); buzz(8); onClick(); });
    return btn;
  }
  // light rays svg-free: a rotating conic gradient, masked into a soft disc
  const rays = (cls = '') => mk('div', 'kx-rays ' + cls);

  // =====================================================================
  // 5. Chest reveal
  // =====================================================================
  function chestSvg(u) {
    return `<svg viewBox="0 0 200 172" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9773f"/><stop offset=".5" stop-color="#8e5429"/><stop offset="1" stop-color="#5f3418"/></linearGradient>
<linearGradient id="${u}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cf8c4f"/><stop offset="1" stop-color="#8a4f26"/></linearGradient>
<linearGradient id="${u}b" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fff0b3"/><stop offset=".45" stop-color="#efbb4f"/><stop offset="1" stop-color="#a8741b"/></linearGradient>
<linearGradient id="${u}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a16"/><stop offset="1" stop-color="#6e3f1f"/></linearGradient>
<radialGradient id="${u}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe6"/><stop offset=".4" stop-color="#ffe39a"/><stop offset="1" stop-color="#ffcf3f" stop-opacity="0"/></radialGradient>
<clipPath id="${u}c"><path d="M26 92V66C26 41 56 30 100 30S174 41 174 66V92z"/></clipPath>
</defs>
<g class="kx-ch-open">
<path d="M30 90L37 30C62 15 138 15 163 30L170 90z" fill="url(#${u}i)" stroke="#3a1f0e" stroke-width="3" stroke-linejoin="round"/>
<path d="M44 84L49 38C70 28 130 28 151 38L156 84z" fill="#7a4522" opacity=".55"/>
<path d="M56 86l3-52M141 34l3 52" stroke="url(#${u}b)" stroke-width="9" stroke-linecap="round"/>
<path d="M37 30C62 15 138 15 163 30" stroke="url(#${u}b)" stroke-width="8" fill="none" stroke-linecap="round"/>
</g>
<g class="kx-ch-base">
<rect x="26" y="88" width="148" height="70" rx="9" fill="url(#${u}w)" stroke="#3a1f0e" stroke-width="3"/>
<path d="M29 111H171M29 134H171" stroke="#4e2a12" stroke-width="2.2" opacity=".55"/>
<path d="M29 113.5H171M29 136.5H171" stroke="#d99a62" stroke-width="1.4" opacity=".35"/>
<path d="M70 100q8 2 14 0M118 122q9 2 16 0M74 146q8 2 12 0" stroke="#5a3118" stroke-width="1.4" fill="none" opacity=".5" stroke-linecap="round"/>
<rect x="44" y="88" width="15" height="70" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.4"/>
<rect x="141" y="88" width="15" height="70" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.4"/>
<g fill="#8a5a12"><circle cx="51.5" cy="100" r="2"/><circle cx="51.5" cy="124" r="2"/><circle cx="148.5" cy="100" r="2"/><circle cx="148.5" cy="124" r="2"/></g>
<rect x="21" y="147" width="158" height="14" rx="6" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.6"/>
<path d="M27 151h146" stroke="#fff6cc" stroke-width="1.5" opacity=".6" stroke-linecap="round"/>
<rect x="86" y="96" width="28" height="31" rx="7" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.6"/>
<circle cx="100" cy="108" r="3.8" fill="#3a2408"/><path d="M98.2 109h3.6l1.1 8.5h-5.8z" fill="#3a2408"/>
</g>
<g class="kx-ch-mouth">
<rect x="30" y="80" width="140" height="15" rx="6" fill="#2a160b"/>
<ellipse cx="100" cy="86" rx="78" ry="22" fill="url(#${u}g)"/>
<rect x="21" y="86" width="158" height="10" rx="4.5" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.4"/>
</g>
<g class="kx-ch-lid">
<path d="M26 92V66C26 41 56 30 100 30S174 41 174 66V92z" fill="url(#${u}l)" stroke="#3a1f0e" stroke-width="3"/>
<g clip-path="url(#${u}c)"><rect x="44" y="20" width="15" height="80" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.4"/><rect x="141" y="20" width="15" height="80" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.4"/><path d="M26 62H174" stroke="#5a3118" stroke-width="2" opacity=".45"/></g>
<path d="M34 64C36 47 62 38 100 38" stroke="#ffd7a6" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".45"/>
<rect x="21" y="83" width="158" height="13" rx="5.5" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.6"/>
<path d="M27 86.5h146" stroke="#fff6cc" stroke-width="1.5" opacity=".6" stroke-linecap="round"/>
<path d="M89 76h22a4 4 0 0 1 4 4v14q0 6-6 8h-18q-6-2-6-8v-14a4 4 0 0 1 4-4z" fill="url(#${u}b)" stroke="#7a5212" stroke-width="1.6"/>
<circle cx="100" cy="88" r="3" fill="#7a5212"/>
</g>
</svg>`;
  }
  function artNode(a) {
    if (a == null) return null;
    if (typeof a === 'string') return mk('div', 'kx-art-in', a);
    return a;
  }
  const OPEN_SCALE = .8;
  function chestReveal(o = {}) {
    const rm = calm();
    const items = o.items || [];
    const ov = overlay('kx-chest-ov', o.title || T('Reward'));
    const title = popTitle(o.title || T('You found a chest!'));
    const head = mk('div', 'kx-ch-head'); head.append(title);
    const cards = mk('div', 'kx-ch-cards' + (items.length === 4 ? ' many four' : items.length > 3 ? ' many' : items.length === 1 ? ' one' : ''));
    const stage = mk('div', 'kx-ch-stage');
    const glow = mk('div', 'kx-ch-glow');
    const chest = mk('div', 'kx-chest', chestSvg(uid()));
    const shadow = mk('div', 'kx-ch-shadow');
    const hint = txt('div', 'kx-ch-hint', T('Tap to open'));
    stage.append(rays('kx-ch-rays'), glow, shadow, chest, hint);
    const foot = mk('div', 'kx-ch-foot');
    const collect = kxButton({ label: o.collectLabel || T('Collect'), primary: true }, () => done());
    foot.append(collect);
    ov.append(mk('div', 'kx-ov-bg'), stage, head, cards, foot);
    D.body.append(ov);
    let opened = false, finished = false, autoT = 0, closed = false;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(() => { if (!closed) fn(); }, ms));
    if (!rm) { snd('whoosh'); later(() => { snd('tap'); buzz(18); }, 420); }
    ov.classList.add(rm ? 'landed' : 'dropping');
    later(() => { ov.classList.remove('dropping'); ov.classList.add('landed'); }, rm ? 0 : 720);
    autoT = later(open, rm ? 500 : 720 + (o.autoOpen != null ? o.autoOpen : 1200));
    ov.addEventListener('click', () => { if (!opened) open(); });
    function open() {
      if (opened || closed) return; opened = true;
      ov.classList.add('opening'); buzz(20);
      later(() => {
        ov.classList.remove('opening'); ov.classList.add('open');
        snd('chest'); buzz([20, 40, 30]);
        if (!rm) { fxBurst(chest, 'sparks', { count: 28, power: 1.1, angle: -90, spread: 200 }); fxBurst(chest, 'stars', { count: 12, angle: -90, spread: 160, power: 1.1 }); fxBurst(chest, 'glint', { count: 6, power: 1.5 }); }
        // move the chest down to make room for the cards above it
        const sr = stage.getBoundingClientRect(), fr = foot.getBoundingClientRect(), cr = cards.getBoundingClientRect();
        const half = sr.height * OPEN_SCALE / 2, want = fr.top - half - 4;
        const dy = Math.max(0, want - (sr.top + sr.height / 2));
        stage.style.setProperty('--dy', dy + 'px');
        cards.style.paddingBottom = Math.max(0, cr.bottom - (sr.top + sr.height / 2 + dy - half) + 6) + 'px';
        later(dealCards, rm ? 50 : 420);
      }, rm ? 0 : 170);
    }
    function dealCards() {
      const els = items.map(it => {
        const c = mk('div', 'kx-card');
        const art = mk('div', 'kx-card-art'); const an = artNode(it.art); if (an) art.append(an);
        c.append(art, txt('b', 'kx-card-label', it.label || ''));
        if (it.sub) c.append(txt('small', 'kx-card-sub', it.sub));
        cards.append(c); return c;
      });
      const mouth = center(chest); mouth.y -= chest.getBoundingClientRect().height * .12;
      let t = 0;
      els.forEach((c, i) => {
        later(() => {
          c.classList.add('in');
          if (!rm && c.animate) {
            const r = c.getBoundingClientRect(), dx = mouth.x - (r.left + r.width / 2), dy = mouth.y - (r.top + r.height / 2);
            const rot = (i - (els.length - 1) / 2) * 9;
            c.animate([
              { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(${rot * 3}deg)`, opacity: 0 },
              { transform: `translate(${dx * .35}px,${dy * .55 - 40}px) scale(.8) rotate(${rot}deg)`, opacity: 1, offset: .45 },
              { transform: 'translate(0,0) scale(1.08) rotate(0deg)', opacity: 1, offset: .8 },
              { transform: 'none', opacity: 1 },
            ], { duration: 640, easing: 'cubic-bezier(.2,.75,.35,1)', fill: 'backwards' });
            replay(chest, 'kx-burp', 300);
            later(() => { fxBurst(c, 'sparks', { count: 12, power: .7 }); fxBurst(c, 'glint', { count: 3, power: .6 }); c.classList.add('shine'); }, 520);
          }
          snd('unlock'); buzz(15);
        }, t);
        t += rm ? 80 : 380;
      });
      later(() => { finished = true; ov.classList.add('done'); try { collect.focus({ preventScroll: true }); } catch (e) { } }, t + (rm ? 0 : 350));
    }
    function done() {
      if (closed || !finished) return;
      closed = true; timers.forEach(clearTimeout);
      snd('confirm');
      if (!rm) Array.from(cards.children).forEach((c, i) => { c.style.transitionDelay = (i * 50) + 'ms'; c.classList.add('away'); });
      ov.classList.add('kx-out');
      setTimeout(() => { ov.remove(); if (o.onDone) o.onDone(); }, rm ? 160 : 380);
    }
    return { close: () => { finished = true; done(); }, el: ov };
  }

  // =====================================================================
  // 6. Results screen
  // =====================================================================
  function parseNum(v) {
    const s = String(v);
    const m = s.match(/^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!m || /^:/.test(m[3])) return null;
    const raw = m[2].replace(/,/g, ''), dec = (raw.split('.')[1] || '').length;
    return { pre: m[1], n: parseFloat(raw), dec, post: m[3], comma: m[2].indexOf(',') >= 0 };
  }
  function fmtNum(p, x) { let s = x.toFixed(p.dec); if (p.comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }); return p.pre + s + p.post; }
  const GOOD = { cheer: 1, happy: 1, wow: 1, wave: 1 };
  function resultsScreen(o = {}) {
    const rm = calm();
    const mood = o.mood || 'happy', good = !!GOOD[mood];
    const ov = overlay('kx-res ' + (good ? 'kx-good' : 'kx-meh') + (o.stars != null ? ' has-stars' : ''), o.title || '');
    const timers = []; let closed = false, raf = 0;
    const later = (fn, ms) => { const id = setTimeout(() => { if (!closed) fn(); }, ms); timers.push(id); return id; };
    const bg = mk('div', 'kx-ov-bg');
    const body = mk('div', 'kx-res-body');
    const hero = mk('div', 'kx-res-hero');
    const hsize = Math.round(Math.max(84, Math.min(150, innerHeight * .175)));
    const hoot = hootEl(mood === 'wave' ? 'wave' : (good ? 'happy' : mood), hsize);
    if (good) hero.append(rays('kx-res-rays'));
    hero.append(mk('div', 'kx-res-glow'), hoot);
    body.append(hero);
    const title = popTitle(o.title || '');
    body.append(title);
    if (o.subtitle) body.append(txt('div', 'kx-res-sub', o.subtitle));
    let tl = 520; // timeline cursor (ms)
    if (o.stars != null) {
      const sr = starRating(o.stars, { size: Math.round(Math.min(54, innerHeight * .064)), animate: true, delay: 380 });
      const sw = mk('div', 'kx-res-stars'); sw.append(sr); body.append(sw);
      tl = 380 + 160 + Math.max(1, o.stars) * 400 + 120;
    }
    const statEls = [];
    if (o.stats && o.stats.length) {
      const row = mk('div', 'kx-res-stats' + (o.stats.length > 3 ? ' many' : ''));
      o.stats.forEach((s, i) => {
        const v = txt('b', 'kx-stat-v', s.value), card = mk('div', 'kx-stat');
        card.append(v, txt('small', 'kx-stat-l', s.label));
        card.style.animationDelay = (tl + i * 90) + 'ms';
        row.append(card); statEls.push({ v, s, at: tl + i * 90 });
      });
      body.append(row);
      tl += o.stats.length * 90 + 200;
    }
    let xpUI = null;
    const LI = (o.xp && (o.xp.levelInfo || (typeof levelInfo === 'function' ? levelInfo : null)));
    if (o.xp && LI) {
      const li = x => { const r = LI(x) || {}; return { lvl: r.lvl || 1, cur: r.cur != null ? r.cur : (r.into || 0), need: r.need || 100 }; };
      const p = mk('div', 'kx-xp'); p.style.animationDelay = tl + 'ms';
      const lv = mk('div', 'kx-xp-lvl'); const lvN = txt('b', null, li(o.xp.from).lvl); lv.append(txt('small', null, T('Level')), lvN);
      const main = mk('div', 'kx-xp-main');
      const top = mk('div', 'kx-xp-top'); const gain = txt('span', 'kx-xp-gain', '+0 XP'); const cnt = txt('span', 'kx-xp-cnt', '');
      top.append(gain, cnt);
      const bar = mk('div', 'kx-xp-bar'); const fill = mk('div', 'kx-xp-fill'); bar.append(fill, mk('div', 'kx-xp-gloss'));
      main.append(top, bar); p.append(lv, main);
      body.append(p);
      xpUI = { p, lvN, gain, cnt, bar, fill, li, lv };
      const s0 = li(o.xp.from); fill.style.width = (s0.cur / s0.need * 100) + '%'; cnt.textContent = `${s0.cur} / ${s0.need}`;
      tl += 380;
    }
    const btns = mk('div', 'kx-res-btns');
    (o.buttons || []).forEach((b, i) => {
      const el = kxButton(b, () => { const r = b.on ? b.on() : undefined; if (r !== false) close(); });
      el.style.animationDelay = (Math.min(tl, 900) + 80 + i * 70) + 'ms';
      btns.append(el);
    });
    ov.append(bg, body, btns);
    D.body.append(ov);

    // --- choreography ---
    if (!rm) {
      later(() => { snd(good ? 'win' : 'confirm'); buzz(good ? [20, 30, 20] : 15); }, 260);
      if (mood === 'cheer' || mood === 'wow') later(() => { fxBurst(title, 'confetti', { count: 60, power: 1.1 }); fxBurst(title, 'stars', { count: 10 }); }, 380);
      later(() => setHootMood(hoot, mood), good ? 900 : 300);
    } else setHootMood(hoot, mood);
    statEls.forEach(({ v, s, at }) => {
      const pn = parseNum(s.value);
      if (!pn || rm) return;
      v.textContent = fmtNum(pn, 0);
      later(() => {
        const t0 = performance.now(), dur = 750;
        const tick = t => { if (closed) return; const k = Math.min(1, (t - t0) / dur); v.textContent = fmtNum(pn, pn.n * easeOutCubic(k)); if (k < 1) requestAnimationFrame(tick); else replay(v, 'kx-popk', 400); };
        requestAnimationFrame(tick);
      }, at + 120);
    });
    if (xpUI) later(runXP, rm ? 0 : tl + 150);

    function runXP() {
      const { li, fill, cnt, gain, lvN } = xpUI, from = o.xp.from, to = Math.max(o.xp.from, o.xp.to);
      const total = to - from;
      if (rm || total <= 0) {
        const e = li(to); fill.style.width = (e.cur / e.need * 100) + '%'; cnt.textContent = `${e.cur} / ${e.need}`; gain.textContent = `+${total} XP`; lvN.textContent = e.lvl;
        if (e.lvl > li(from).lvl) { snd('levelup'); levelBanner(e.lvl); }
        return;
      }
      if (!rm) fxBurst(gain, 'xp', { count: 8, to: xpUI.bar });
      let x = from, lastTick = 0;
      const seg = () => {
        const s = li(x), base = x - s.cur, end = Math.min(to, base + s.need);
        const dur = Math.max(420, Math.min(1500, (end - x) / s.need * 1500));
        const xs = x, t0 = performance.now();
        const frame = t => {
          if (closed) return;
          const k = Math.min(1, (t - t0) / dur), e = easeInOut(k), xv = xs + (end - xs) * e;
          fill.style.width = ((xv - base) / s.need * 100) + '%';
          cnt.textContent = `${Math.round(xv - base)} / ${s.need}`;
          gain.textContent = `+${Math.round(xv - from)} XP`;
          if (t - lastTick > 68 && k < 1) { lastTick = t; snd('xp'); }
          if (k < 1) { raf = requestAnimationFrame(frame); return; }
          x = end;
          if (end - base >= s.need) { // level up: flash, banner, reset, continue
            xpUI.bar.classList.add('flash'); buzz([30, 40, 30]);
            lvN.textContent = s.lvl + 1; replay(xpUI.lv, 'kx-popk', 500);
            snd('levelup'); levelBanner(s.lvl + 1);
            hootReact(hoot, 'cheer', 2000);
            later(() => {
              xpUI.bar.classList.remove('flash');
              fill.classList.add('noanim'); fill.style.width = '0%'; void fill.offsetWidth; fill.classList.remove('noanim');
              const n = li(x); cnt.textContent = `0 / ${n.need}`;
              if (x < to) later(seg, 260); else replay(xpUI.p, 'kx-popk', 400);
            }, 780);
          } else { replay(gain, 'kx-popk', 400); fxBurst(fill, 'glint', { count: 3, power: .5 }); }
        };
        raf = requestAnimationFrame(frame);
      };
      seg();
    }
    function levelBanner(lvl) {
      const b = mk('div', 'kx-lvlup');
      const rib = mk('div', 'kx-lvlup-rib'); rib.append(txt('span', null, T('Level up!')));
      b.append(rays('kx-lvlup-rays'), rib, txt('div', 'kx-lvlup-num', T('Level') + ' ' + lvl));
      ov.append(b);
      if (!rm) { later(() => { fxBurst(rib, 'confetti', { count: 70, power: 1.2 }); fxBurst(rib, 'stars', { count: 12, power: 1.1 }); }, 120); }
      later(() => b.classList.add('out'), 1700);
      later(() => b.remove(), 2200);
    }
    function onKey(e) { if (e.key === 'Escape') { const pb = (o.buttons || []).find(b => b.primary) || (o.buttons || [])[0]; if (!pb) close(); } }
    D.addEventListener('keydown', onKey);
    later(() => { const f = btns.querySelector('.primary') || btns.firstChild; if (f) try { f.focus({ preventScroll: true }); } catch (e) { } }, 1200);
    function close() {
      if (closed) return; closed = true;
      timers.forEach(clearTimeout); cancelAnimationFrame(raf); D.removeEventListener('keydown', onKey);
      ov.classList.add('kx-out');
      setTimeout(() => ov.remove(), rm ? 120 : 260);
    }
    return { close, el: ov, hoot };
  }

  // =====================================================================
  // 7. Juice helpers
  // =====================================================================
  function fxShake(el) { if (calm()) return el; buzz(25); return replay(el, 'kx-shake', 460); }
  function fxPop(el) { if (calm()) return el; return replay(el, 'kx-pop', 420); }
  function fxPulse(el) { if (calm()) return el; return replay(el, 'kx-pulse', 1250); }

  // =====================================================================
  // 8. Screen wipe: a brass medallion with the knight, under 450 ms
  // =====================================================================
  const KNIGHT = 'M11 39.5h23v-3H11z M13 36.5h19C33 31 34 24 31 18c-1-2.5-2-4-3-5V7.5l-3.5 3.5C21 10.5 17 12 14 15c-2 2.5-3.5 5-4.5 8-.2 1.7 1.1 3.2 2.8 3 1.7-.2 3.7-1.2 6.2-2.5 1 2.5-2.5 5.5-4 8-1.1 2-1.5 3-1.5 5z';
  function medalSvg(u) {
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="${u}b" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".45" stop-color="#efbb4f"/><stop offset="1" stop-color="#9c6a17"/></linearGradient><linearGradient id="${u}f" x1=".3" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#f7cf6c"/><stop offset="1" stop-color="#d79a2c"/></linearGradient><linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a24"/><stop offset="1" stop-color="#2e1a10"/></linearGradient></defs>
<circle cx="100" cy="104" r="92" fill="#7a4a12"/><circle cx="100" cy="100" r="92" fill="url(#${u}b)"/><circle cx="100" cy="100" r="76" fill="url(#${u}f)" stroke="#9c6a17" stroke-width="3"/>
<circle cx="100" cy="100" r="84" fill="none" stroke="#fff3c4" stroke-width="2" opacity=".55" stroke-dasharray="1.5 8" stroke-linecap="round"/>
<path d="M36 70a72 72 0 0 1 56-42" stroke="#fff8dc" stroke-width="6" fill="none" stroke-linecap="round" opacity=".5"/>
<g transform="translate(100 102) scale(3.5) translate(-22.5 -23.5)"><path d="${KNIGHT}" fill="#7a4a12" opacity=".5" transform="translate(0 .9)"/><path d="${KNIGHT}" fill="url(#${u}k)" stroke="#2a160b" stroke-width=".9" stroke-linejoin="round"/><circle cx="19.5" cy="16.5" r="1.5" fill="#f7efdd"/></g></svg>`;
  }
  function screenWipe(dir = 'center', onCovered) {
    if (typeof dir === 'function') { onCovered = dir; dir = 'center'; }
    const rm = calm();
    const w = mk('div', 'kx-wipe'); w.setAttribute('aria-hidden', 'true');
    const m = mk('div', 'kx-wipe-medal', medalSvg(uid()));
    w.append(m); D.body.append(w);
    const shapes = {
      center: ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)', 'circle(0% at 50% 50%)'],
      left: ['inset(0 0 0 100%)', 'inset(0 0 0 0)', 'inset(0 100% 0 0)'],
      right: ['inset(0 100% 0 0)', 'inset(0 0 0 0)', 'inset(0 0 0 100%)'],
      up: ['inset(100% 0 0 0)', 'inset(0 0 0 0)', 'inset(0 0 100% 0)'],
    }[dir] || null;
    const S = shapes || ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)', 'circle(0% at 50% 50%)'];
    return new Promise(res => {
      const cover = () => { try { if (onCovered) onCovered(); } catch (e) { setTimeout(() => { throw e; }); } };
      if (rm || !w.animate) {
        w.style.opacity = '0'; w.style.transition = 'opacity 90ms';
        requestAnimationFrame(() => { w.style.opacity = '1'; });
        setTimeout(() => { cover(); w.style.opacity = '0'; }, 110);
        setTimeout(() => { w.remove(); res(); }, 220);
        return;
      }
      snd('whoosh'); buzz(10);
      // 0-170 cover, 170-230 hold (callback fires), 230-420 reveal
      const ein = 'cubic-bezier(.5,0,.3,1)', eout = 'cubic-bezier(.6,0,.6,1)';
      w.animate([{ clipPath: S[0], offset: 0, easing: ein }, { clipPath: S[1], offset: .42 }, { clipPath: S[1], offset: .56, easing: eout }, { clipPath: S[2], offset: 1 }],
        { duration: 420, fill: 'both' });
      m.animate([
        { transform: 'scale(.25) rotate(-80deg)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' },
        { transform: 'scale(1.1) rotate(6deg)', opacity: 1, offset: .36, easing: 'ease-out' },
        { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: .56, easing: 'cubic-bezier(.6,0,.8,.5)' },
        { transform: 'scale(.35) rotate(30deg)', opacity: 0, offset: 1 },
      ], { duration: 420, fill: 'both' });
      setTimeout(cover, 205);
      setTimeout(() => { w.remove(); res(); }, 430);
    });
  }

  Object.assign(W, { hootEl, setHootMood, hootReact, fxBurst, fxFloat, starRating, chestReveal, resultsScreen, fxShake, fxPop, fxPulse, screenWipe });
})();
