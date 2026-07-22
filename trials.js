/* =====================================================================
   WOOFA SHEEPDOG TRIALS — top-down herding puzzle. You're Woofa; touch & hold
   to run. Sheep flee from you. Push the whole flock into the pen before time's
   up. Levels get bigger, faster, harder. Best trial saved to localStorage.
   ===================================================================== */
(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('load', resize);

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

  const BEST_KEY = 'woofa_trials_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '1', 10) || 1;

  // ---------- sound ----------
  let actx = null, master = null;
  function ensureAudio() { try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination); } if (actx.state === 'suspended' && actx.resume) actx.resume(); } catch (e) { actx = null; } }
  function beep(f, dur, type, vol, slideTo) { if (!actx) return; try { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = f; if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur); g.gain.value = vol || 0.05; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur + 0.02); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + dur + 0.04); } catch (e) {} }
  const sfx = {
    bark() { beep(220, 0.09, 'square', 0.06, 150); setTimeout(() => beep(180, 0.1, 'square', 0.05, 120), 70); },
    baa() { beep(300, 0.14, 'sawtooth', 0.03, 260); }, chime() { beep(700, 0.08, 'triangle', 0.05); setTimeout(() => beep(1050, 0.12, 'triangle', 0.05), 70); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.06), i * 110)); },
    fail() { beep(200, 0.3, 'sawtooth', 0.06, 90); }, tick() { beep(900, 0.05, 'sine', 0.04); },
  };

  let field = { x: 0, y: 0, w: 0, h: 0 };
  let pen = { x: 0, y: 0, w: 0, h: 0 };
  function layout() {
    const top = 74, m = 14;
    field = { x: m, y: top, w: W - m * 2, h: H - top - m };
  }

  const dog = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, run: 0 };
  const target = { x: 0, y: 0, active: false };
  let sheep = [], obstacles = [];
  let level = 1, timeLeft = 30, pennedCount = 0, total = 0, running = false, tick = 0, wonT = 0, barkCD = 0, banner = null;
  const barks = [];   // expanding bark rings for juice

  // ---------- setup ----------
  function startLevel(lvl) {
    level = lvl;
    layout();
    const n = Math.min(4 + lvl, 18);
    total = n;
    timeLeft = Math.max(22, 40 - lvl * 1.5);
    // pen in a corner, gate facing the field
    const pw = clamp(150 - lvl * 4, 96, 150), ph = clamp(130 - lvl * 3, 92, 130);
    const corner = lvl % 2 === 0 ? 'tr' : 'br';
    pen = corner === 'tr'
      ? { x: field.x + field.w - pw - 8, y: field.y + 8, w: pw, h: ph, gate: 'bottom' }
      : { x: field.x + field.w - pw - 8, y: field.y + field.h - ph - 8, w: pw, h: ph, gate: 'top' };
    // dog starts opposite the pen
    dog.x = field.x + field.w * 0.25; dog.y = field.y + field.h * 0.5; dog.vx = dog.vy = 0;
    target.active = false;
    // sheep scattered on the far side from the pen
    sheep = [];
    for (let i = 0; i < n; i++) {
      sheep.push({ x: rand(field.x + 40, field.x + field.w * 0.5), y: rand(field.y + 40, field.y + field.h - 40),
        vx: 0, vy: 0, penned: false, face: rand(0, 6), baa: 0 });
    }
    // a couple of obstacles (rocks) on higher levels
    obstacles = [];
    const oc = clamp(lvl - 2, 0, 4);
    for (let i = 0; i < oc; i++) obstacles.push({ x: rand(field.x + field.w * 0.35, field.x + field.w * 0.8), y: rand(field.y + 50, field.y + field.h - 50), r: rand(18, 30) });
    pennedCount = 0; wonT = 0; running = true; barkCD = 0; barks.length = 0;
    ensureAudio();
    banner = { txt: 'Trial ' + level + ' · ' + total + ' 🐑', t: 130 };
    hideOverlays(); updateHud();
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  function down(e) { if (!running) return; e.preventDefault(); const p = pt(e); target.x = p.x; target.y = p.y; target.active = true; }
  function move(e) { if (!running || !target.active) return; e.preventDefault(); const p = pt(e); target.x = p.x; target.y = p.y; }
  function up(e) { target.active = false; }
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up, { passive: false });
  canvas.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  // BARK — a loud woof that shoves every nearby sheep hard away from Woofa (short cooldown). A real herding tool.
  function bark() {
    if (!running || barkCD > 0) return;
    barkCD = 80; sfx.bark();
    barks.push({ x: dog.x, y: dog.y, r: 0 });
    for (const s of sheep) { if (s.penned) continue; const d = dist(s.x, s.y, dog.x, dog.y); if (d < 200) { const f = (200 - d) / 200 * 7; const a = Math.atan2(s.y - dog.y, s.x - dog.x); s.vx += Math.cos(a) * f; s.vy += Math.sin(a) * f; s.baa = 30; } }
  }
  { const b = document.getElementById('barkBtn'); if (b) { const go = (e) => { e.preventDefault(); bark(); }; b.addEventListener('touchstart', go, { passive: false }); b.addEventListener('mousedown', go); } }
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') bark(); });

  // ---------- update ----------
  function inPen(x, y) { return x > pen.x && x < pen.x + pen.w && y > pen.y && y < pen.y + pen.h; }
  function update(dt) {
    if (!running) { return; }
    tick += dt;
    const prevT = timeLeft;
    timeLeft -= dt / 60;
    if (timeLeft < 8 && Math.ceil(prevT) !== Math.ceil(timeLeft)) sfx.tick();   // urgent countdown ticks
    if (barkCD > 0) barkCD -= dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    for (let i = barks.length - 1; i >= 0; i--) { barks[i].r += 6 * dt; if (barks[i].r > 210) barks.splice(i, 1); }
    if (timeLeft <= 0 && pennedCount < total) { timeLeft = 0; fail(); return; }

    // dog moves toward held target
    if (target.active) {
      const dx = target.x - dog.x, dy = target.y - dog.y, d = Math.hypot(dx, dy);
      if (d > 4) { const sp = 4.4; dog.vx = dx / d * sp; dog.vy = dy / d * sp; dog.facing = dx >= 0 ? 1 : -1; dog.run += 0.3 * dt; }
      else { dog.vx *= 0.6; dog.vy *= 0.6; }
    } else { dog.vx *= 0.8; dog.vy *= 0.8; }
    dog.x = clamp(dog.x + dog.vx * dt, field.x + 12, field.x + field.w - 12);
    dog.y = clamp(dog.y + dog.vy * dt, field.y + 12, field.y + field.h - 12);

    // sheep flocking + flee
    pennedCount = 0;
    for (let i = 0; i < sheep.length; i++) {
      const s = sheep[i];
      if (s.baa > 0) s.baa -= dt;
      if (s.penned) { pennedCount++; steerPenned(s, dt); continue; }

      let ax = 0, ay = 0;
      // flee the dog
      const dd = dist(s.x, s.y, dog.x, dog.y);
      if (dd < 118) { const f = (118 - dd) / 118; const a = Math.atan2(s.y - dog.y, s.x - dog.x); ax += Math.cos(a) * f * 3.4; ay += Math.sin(a) * f * 3.4; if (s.baa <= 0) s.baa = 30; }
      // separation + gentle cohesion from nearby flock
      let cx = 0, cy = 0, cn = 0;
      for (let j = 0; j < sheep.length; j++) { if (j === i) continue; const o = sheep[j]; const od = dist(s.x, s.y, o.x, o.y); if (od < 26 && od > 0.1) { const a = Math.atan2(s.y - o.y, s.x - o.x); ax += Math.cos(a) * (26 - od) * 0.10; ay += Math.sin(a) * (26 - od) * 0.10; } if (od < 130 && !o.penned) { cx += o.x; cy += o.y; cn++; } }
      if (cn) { ax += ((cx / cn) - s.x) * 0.011; ay += ((cy / cn) - s.y) * 0.011; }   // stronger cohesion → they stay a tight flock you can push together
      // avoid obstacles
      for (const ob of obstacles) { const od = dist(s.x, s.y, ob.x, ob.y); if (od < ob.r + 18 && od > 0.1) { const a = Math.atan2(s.y - ob.y, s.x - ob.x); ax += Math.cos(a) * (ob.r + 18 - od) * 0.18; ay += Math.sin(a) * (ob.r + 18 - od) * 0.18; } }
      // "come home" pull — sheep drift toward the pen everywhere (gentle), and get drawn strongly IN once near the gate.
      // The dog's job is to gather them and speed them home before the clock runs out.
      const pcx = pen.x + pen.w / 2, pcy = pen.y + pen.h / 2, dp = dist(s.x, s.y, pcx, pcy);
      // a whisper of home-drift (so a pushed flock keeps trending in), then a strong suck-in once near the gate
      if (dp > 0.1) { const pull = 0.045 + (dp < 250 ? (250 - dp) / 250 * 1.5 : 0); ax += (pcx - s.x) / dp * pull; ay += (pcy - s.y) / dp * pull; }
      // gentle wander when out in the open
      if (dd > 130 && dp > 250 && Math.random() < 0.02 * dt) { const a = rand(0, 7); ax += Math.cos(a) * 0.55; ay += Math.sin(a) * 0.55; }

      s.vx = (s.vx + ax) * 0.82; s.vy = (s.vy + ay) * 0.82;
      const sp = Math.hypot(s.vx, s.vy), MAX = 3.6; if (sp > MAX) { s.vx = s.vx / sp * MAX; s.vy = s.vy / sp * MAX; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.abs(s.vx) > 0.1) s.face = s.vx >= 0 ? 1 : -1;

      // field bounds (bounce)
      if (s.x < field.x + 12) { s.x = field.x + 12; s.vx = Math.abs(s.vx) * 0.5; }
      if (s.x > field.x + field.w - 12) { s.x = field.x + field.w - 12; s.vx = -Math.abs(s.vx) * 0.5; }
      if (s.y < field.y + 12) { s.y = field.y + 12; s.vy = Math.abs(s.vy) * 0.5; }
      if (s.y > field.y + field.h - 12) { s.y = field.y + field.h - 12; s.vy = -Math.abs(s.vy) * 0.5; }

      // entered the pen → penned!
      if (inPen(s.x, s.y)) { s.penned = true; s.vx = s.vy = 0; spawnPop(s.x, s.y); sfx.chime(); }
    }

    if (pennedCount >= total && wonT === 0) { wonT = tick; setTimeout(win, 700); }
    if ((tick | 0) % 5 === 0) updateHud();
  }
  function steerPenned(s, dt) {
    // settle gently toward pen centre and stay inside
    const cx = pen.x + pen.w / 2, cy = pen.y + pen.h / 2;
    s.x += (cx - s.x) * 0.02 * dt + rand(-0.3, 0.3);
    s.y += (cy - s.y) * 0.02 * dt + rand(-0.3, 0.3);
    s.x = clamp(s.x, pen.x + 10, pen.x + pen.w - 10);
    s.y = clamp(s.y, pen.y + 10, pen.y + pen.h - 10);
  }

  const pops = [];
  function spawnPop(x, y) { pops.push({ x, y, life: 1 }); }

  function win() {
    running = false; sfx.win();
    if (level + 1 > best) { best = level + 1; localStorage.setItem(BEST_KEY, String(best)); }
    const frac = timeLeft / Math.max(1, (Math.max(22, 40 - level * 1.5)));
    const stars = frac > 0.5 ? 3 : frac > 0.25 ? 2 : 1;
    document.getElementById('clearStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('clearText').textContent = stars === 3 ? 'Gun sheepdog! ⚡' : stars === 2 ? 'Nicely mustered!' : 'Got them home!';
    document.getElementById('clearScreen').classList.remove('hidden');
  }
  function fail() {
    running = false; sfx.fail();
    document.getElementById('failPenned').textContent = pennedCount + '/' + total;
    document.getElementById('failBest').textContent = best;
    document.getElementById('failScreen').classList.remove('hidden');
  }

  // ---------- render ----------
  function render() {
    // grass field
    ctx.fillStyle = '#0c1a12'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, field.y, 0, field.y + field.h); g.addColorStop(0, '#5fb356'); g.addColorStop(1, '#4c9a45');
    ctx.fillStyle = g; ctx.fillRect(field.x, field.y, field.w, field.h);
    // mowed stripes
    ctx.globalAlpha = 0.05; for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#000' : '#fff'; ctx.fillRect(field.x, field.y + field.h * i / 10, field.w, field.h / 10); } ctx.globalAlpha = 1;
    // fence border
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 5; ctx.strokeRect(field.x, field.y, field.w, field.h);

    drawPen();
    for (const ob of obstacles) { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(ob.x - ob.r * 0.2, ob.y - ob.r * 0.2, ob.r * 0.5, 0, 7); ctx.fill(); }
    for (const p of pops) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.font = '20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('💚', p.x, p.y - (1 - p.life) * 20); } ctx.globalAlpha = 1;
    for (const s of sheep) drawSheep(s);
    drawDog();
    // bark shockwave rings
    for (const b of barks) { ctx.globalAlpha = clamp(1 - b.r / 210, 0, 0.7); ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;
    // held-target marker
    if (target.active) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(target.x, target.y, 16 + Math.sin(tick / 6) * 3, 0, 7); ctx.stroke(); }
    // banner (level intro)
    if (banner) { ctx.globalAlpha = clamp(banner.t / 40, 0, 1); ctx.fillStyle = 'rgba(11,18,32,0.55)'; ctx.fillRect(0, H * 0.4, W, 54); ctx.fillStyle = '#ffd23d'; ctx.font = '900 28px system-ui'; ctx.textAlign = 'center'; ctx.fillText(banner.txt, W / 2, H * 0.4 + 36); ctx.globalAlpha = 1; }

    for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= 0.03; if (pops[i].life <= 0) pops.splice(i, 1); }
  }
  function drawPen() {
    ctx.fillStyle = 'rgba(180,140,80,0.14)'; ctx.fillRect(pen.x, pen.y, pen.w, pen.h);
    ctx.strokeStyle = '#a6763e'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    // draw walls with a gate gap on the `gate` side
    const gap = 72, cx = pen.x + pen.w / 2, cy = pen.y + pen.h / 2;
    ctx.beginPath();
    // top
    if (pen.gate === 'top') { ctx.moveTo(pen.x, pen.y); ctx.lineTo(cx - gap / 2, pen.y); ctx.moveTo(cx + gap / 2, pen.y); ctx.lineTo(pen.x + pen.w, pen.y); }
    else { ctx.moveTo(pen.x, pen.y); ctx.lineTo(pen.x + pen.w, pen.y); }
    // bottom
    if (pen.gate === 'bottom') { ctx.moveTo(pen.x, pen.y + pen.h); ctx.lineTo(cx - gap / 2, pen.y + pen.h); ctx.moveTo(cx + gap / 2, pen.y + pen.h); ctx.lineTo(pen.x + pen.w, pen.y + pen.h); }
    else { ctx.moveTo(pen.x, pen.y + pen.h); ctx.lineTo(pen.x + pen.w, pen.y + pen.h); }
    // sides
    ctx.moveTo(pen.x, pen.y); ctx.lineTo(pen.x, pen.y + pen.h);
    ctx.moveTo(pen.x + pen.w, pen.y); ctx.lineTo(pen.x + pen.w, pen.y + pen.h);
    ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#ffd23d'; ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🏠 PEN', cx, cy);
    // gate arrow hint
    const gy = pen.gate === 'top' ? pen.y - 14 : pen.y + pen.h + 18;
    ctx.fillStyle = '#ffd23d'; ctx.font = '16px system-ui'; ctx.fillText(pen.gate === 'top' ? '⬆️' : '⬇️', cx, gy);
  }
  function drawSheep(s) {
    const R = 11, bob = Math.sin(tick / 10 + s.face) * 1;
    ctx.save(); ctx.translate(s.x, s.y + bob);
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, R * 0.7, R, R * 0.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#eef0f0'; for (let i = 0; i < 7; i++) { const a = i / 7 * 7; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.5, R * 0.5, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.85, 0, 0, 7); ctx.fill();
    const f = s.face || 1; ctx.fillStyle = '#39312e'; ctx.beginPath(); ctx.ellipse(f * R * 0.7, -R * 0.1, R * 0.34, R * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f * R * 0.78, -R * 0.15, R * 0.09, 0, 7); ctx.fill();
    if (s.baa > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('baa!', 0, -R - 4); }
    ctx.restore();
  }
  function drawDog() {
    const R = 13, f = dog.facing, bob = Math.sin(dog.run) * 1.5;
    ctx.save(); ctx.translate(dog.x, dog.y + bob); ctx.scale(f, 1);
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, R * 0.7, R * 1.1, R * 0.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // body (black + white collie)
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.ellipse(-2, R * 0.4, R * 0.6, R * 0.4, 0, 0, 7); ctx.fill();
    // head
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(R * 0.85, -R * 0.2, R * 0.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(R * 1.05, -R * 0.1, R * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(R * 1.25, -R * 0.15, R * 0.13, 0, 7); ctx.fill();   // nose
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(R * 0.85, -R * 0.35, R * 0.11, 0, 7); ctx.fill();   // eye
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(R * 0.88, -R * 0.35, R * 0.06, 0, 7); ctx.fill();
    // tail
    ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-R * 0.9, 0); ctx.lineTo(-R * 1.4, -R * 0.3 + Math.sin(dog.run) * 3); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.restore();
  }

  // ---------- HUD / overlays ----------
  function updateHud() {
    document.getElementById('tlLevel').textContent = level;
    document.getElementById('tlPenned').textContent = pennedCount;
    document.getElementById('tlTotal').textContent = total;
    const te = document.getElementById('tlTime'); te.textContent = Math.ceil(timeLeft);
    const pill = te.closest('.hud-pill'); if (pill) pill.classList.toggle('urgent', running && timeLeft < 8);
    const bb = document.getElementById('barkBtn'); if (bb) bb.disabled = barkCD > 0;
  }
  function hideOverlays() { for (const id of ['startScreen', 'clearScreen', 'failScreen']) document.getElementById(id).classList.add('hidden'); }
  document.getElementById('tlPlay').onclick = () => startLevel(1);
  document.getElementById('tlNext').onclick = () => startLevel(level + 1);
  document.getElementById('tlRetry').onclick = () => startLevel(1);

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(now) { let dt = (now - lastT) / 16.6667; lastT = now; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  let lastErr = null;
  resize();
  requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__trials = {
      start(l) { startLevel(l || 1); },
      step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      moveDog(x, y) { target.x = x; target.y = y; target.active = true; },
      release() { target.active = false; },
      // auto-herd: park the dog behind the flock (opposite the pen) to push them in
      autoHerd() { const un = sheep.filter(s => !s.penned); if (!un.length) return; const px = pen.x + pen.w / 2, py = pen.y + pen.h / 2; let far = un[0], fd = -1; for (const s of un) { const d = dist(s.x, s.y, px, py); if (d > fd) { fd = d; far = s; } } const a = Math.atan2(far.y - py, far.x - px); target.x = clamp(far.x + Math.cos(a) * 70, field.x + 12, field.x + field.w - 12); target.y = clamp(far.y + Math.sin(a) * 70, field.y + 12, field.y + field.h - 12); target.active = true; },
      info() { return { running, level, penned: pennedCount, total, timeLeft: +timeLeft.toFixed(1), dog: { x: dog.x | 0, y: dog.y | 0 }, pen: { x: pen.x | 0, y: pen.y | 0, w: pen.w | 0, h: pen.h | 0 } }; },
      lastErr() { return lastErr ? String(lastErr.stack || lastErr) : null; },
    };
  }
})();
