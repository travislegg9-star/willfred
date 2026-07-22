/* =====================================================================
   WOOFA FISHING — hold to drop the hook & slide it onto a fish, then tap fast
   to reel it up. Bigger & golden fish pay more; the odd boot pays nothing.
   60-second run. Best score saved to localStorage. Pure vanilla canvas.
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
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('load', resize);
  resize();

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const surfaceY = () => H * 0.24;

  const BEST_KEY = 'woofa_fishing_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;

  const KINDS = [
    { key: 'small', emoji: '🐟', w: 0.28, value: 2, size: 20, weight: 0.9, chance: 0.42 },
    { key: 'med', emoji: '🐠', w: 0.4, value: 5, size: 26, weight: 1.3, chance: 0.28 },
    { key: 'big', emoji: '🐡', w: 0.55, value: 12, size: 34, weight: 2.1, chance: 0.14 },
    { key: 'gold', emoji: '🌟', w: 0.35, value: 30, size: 24, weight: 1.5, chance: 0.08, gold: true },
    { key: 'squid', emoji: '🦑', w: 0.45, value: 18, size: 30, weight: 1.8, chance: 0.05 },
    { key: 'boot', emoji: '🥾', w: 0.3, value: 0, size: 24, weight: 1.6, chance: 0.03, junk: true },
  ];
  function pickKind() { let r = Math.random(); for (const k of KINDS) { if (r < k.chance) return k; r -= k.chance; } return KINDS[0]; }

  let fish = [], bubbles = [], pops = [];
  const hook = { x: 0, y: 0, held: false, hooked: null };
  let state = 'menu', score = 0, caught = 0, timeLeft = 60, tick = 0, running = false;

  function reset() {
    fish = []; bubbles = []; pops = [];
    hook.x = W / 2; hook.y = surfaceY() + 8; hook.held = false; hook.hooked = null;
    state = 'cast'; score = 0; caught = 0; timeLeft = 60; tick = 0; running = true;
    for (let i = 0; i < 7; i++) spawnFish();
    for (let i = 0; i < 26; i++) bubbles.push({ x: rand(0, W), y: rand(surfaceY(), H), r: rand(1.5, 4), sp: rand(0.2, 0.7) });
    hideOverlays(); updateHud();
  }

  function spawnFish(side) {
    const k = pickKind();
    const fromLeft = side != null ? side : Math.random() < 0.5;
    const depthT = k.gold ? rand(0.55, 0.92) : rand(0.14, 0.9);   // gold fish lurk deep
    fish.push({
      k, x: fromLeft ? -40 : W + 40, y: surfaceY() + 20 + depthT * (H - surfaceY() - 40),
      vx: (fromLeft ? 1 : -1) * rand(0.7, 1.7) * (k.big ? 0.8 : 1), face: fromLeft ? 1 : -1,
      size: k.size, wob: rand(0, 6), spooked: 0,
    });
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  function down(e) {
    if (!running) return; e.preventDefault();
    const p = pt(e);
    if (state === 'cast') { hook.held = true; hook.x = clamp(p.x, 20, W - 20); }
    else if (state === 'reel') { hook.y -= 26 + (hook.hooked ? 0 : 0); reelTap(); }   // tap = pull up
  }
  function move(e) { if (!running) return; e.preventDefault(); const p = pt(e); if (state === 'cast' && hook.held) hook.x = clamp(p.x, 20, W - 20); }
  function up(e) { if (state === 'cast') hook.held = false; }
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up, { passive: false });
  canvas.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  let reelFlash = 0;
  function reelTap() { reelFlash = 6; }

  // ---------- update ----------
  function update(dt) {
    if (!running) return;
    tick += dt;
    timeLeft -= dt / 60;
    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }

    // fish swim
    for (const f of fish) {
      f.x += f.vx * dt * (f.spooked > 0 ? 2.2 : 1);
      if (f.spooked > 0) f.spooked -= dt;
      f.y += Math.sin(tick / 24 + f.wob) * 0.25 * dt;
      // fish flee the hook a little (unless it's the hooked one)
      if (state === 'cast' && hook.held && f !== hook.hooked) { const d = dist(f.x, f.y, hook.x, hook.y); if (d < 30) { f.spooked = 6; f.vx += (f.x - hook.x) * 0.0022 * dt; } }
    }
    fish = fish.filter((f) => f.x > -80 && f.x < W + 80 && f !== hook.hooked);
    // keep the sea busy
    while (fish.length < 8) spawnFish();
    if (Math.random() < 0.01 * dt && fish.length < 12) spawnFish();

    if (state === 'cast') {
      if (hook.held) hook.y += 3.2 * dt; else hook.y -= 4.2 * dt;
      hook.y = clamp(hook.y, surfaceY() + 8, H - 24);
      // grab a fish
      for (const f of fish) { if (dist(hook.x, hook.y, f.x, f.y) < f.size * 0.7 + 8) { hook.hooked = f; state = 'reel'; hook.held = false; pop(f.x, f.y, '🎣!', '#ffd23d'); break; } }
    } else if (state === 'reel') {
      const f = hook.hooked;
      // the fish weight sinks the hook; tapping pulls it up (handled in down())
      hook.y += f.k.weight * 0.9 * dt;
      hook.y = clamp(hook.y, surfaceY() + 6, H - 20);
      // fish wriggles side to side on the line
      f.x = hook.x + Math.sin(tick / 8) * 6; f.y = hook.y + f.size * 0.5;
      if (hook.y <= surfaceY() + 10) {   // landed!
        landFish(f);
      }
    }

    for (const b of bubbles) { b.y -= b.sp * dt; if (b.y < surfaceY()) { b.y = H; b.x = rand(0, W); } }
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].y -= 0.6 * dt; pops[i].life -= 0.02 * dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    if (reelFlash > 0) reelFlash -= dt;
    if ((tick | 0) % 5 === 0) updateHud();
  }
  function landFish(f) {
    const val = f.k.value;
    score += val; if (!f.k.junk) caught++;
    if (f.k.junk) { pop(hook.x, surfaceY(), 'An old boot! 🥾', '#c98a6a'); toast('🥾 Just a boot…'); }
    else if (f.k.gold) { pop(hook.x, surfaceY(), 'GOLDEN FISH! +' + val + ' ✨', '#ffd23d'); toast('✨ Golden fish! +' + val); }
    else { pop(hook.x, surfaceY(), f.k.emoji + ' +' + val, '#8fe08a'); }
    hook.hooked = null; hook.y = surfaceY() + 8; state = 'cast';
    updateHud();
  }
  function pop(x, y, txt, col) { pops.push({ x, y, txt, col, life: 1 }); }

  function endGame() {
    running = false;
    if (score > best) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
    document.getElementById('overScore').textContent = score;
    document.getElementById('overCount').textContent = caught;
    document.getElementById('overBest').textContent = best;
    setTimeout(() => document.getElementById('overScreen').classList.remove('hidden'), 400);
  }

  // ---------- render ----------
  function render() {
    const sy = surfaceY();
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, sy); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#d8f0ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, sy);
    // sun
    ctx.fillStyle = 'rgba(255,244,190,0.9)'; ctx.beginPath(); ctx.arc(W * 0.82, sy * 0.5, 24, 0, 7); ctx.fill();
    // water
    const water = ctx.createLinearGradient(0, sy, 0, H); water.addColorStop(0, '#2f9fd0'); water.addColorStop(1, '#0d3b5c');
    ctx.fillStyle = water; ctx.fillRect(0, sy, W, H - sy);
    // surface shimmer
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 10) { const y = sy + Math.sin(x * 0.05 + tick / 12) * 2; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    // bubbles
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (const b of bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
    // fish
    for (const f of fish) drawFish(f);
    if (hook.hooked) drawFish(hook.hooked);
    // dock + Woofa + rod + line + hook
    drawDock();
    // line
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(rodTipX(), rodTipY()); ctx.lineTo(hook.x, hook.y); ctx.stroke();
    // hook
    ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hook.x, hook.y, 5, Math.PI * 0.2, Math.PI * 1.6); ctx.stroke();
    if (state === 'reel' && reelFlash > 0) { ctx.strokeStyle = 'rgba(255,210,61,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hook.x, hook.y, 16, 0, 7); ctx.stroke(); }
    // prompts
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '800 15px system-ui';
    if (state === 'cast' && running) ctx.fillText(hook.held ? 'slide onto a fish 🐟' : 'hold to drop the hook', W / 2, H - 22);
    if (state === 'reel' && running) { ctx.fillStyle = '#ffd23d'; ctx.font = '900 20px system-ui'; ctx.fillText('TAP FAST TO REEL! 🎣', W / 2, H - 22); }
    // pops
    for (const p of pops) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.col; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.txt, p.x, p.y); } ctx.globalAlpha = 1;
  }
  function rodTipX() { return W * 0.5 + 44; }
  function rodTipY() { return surfaceY() - 40; }
  function drawDock() {
    const sy = surfaceY();
    // dock plank
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(W * 0.5 - 70, sy - 16, 96, 14);
    ctx.fillStyle = '#6e4526'; for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.5 - 70 + i * 24, sy - 16, 2, 14);
    // post
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(W * 0.5 - 66, sy - 2, 6, 20);
    // Woofa (sitting, black+white)
    const dx = W * 0.5 - 34, dy = sy - 16;
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(dx, dy - 10, 14, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.ellipse(dx, dy - 4, 8, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(dx + 11, dy - 18, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(dx + 15, dy - 16, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(dx + 18, dy - 16, 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + 12, dy - 20, 1.4, 0, 7); ctx.fill();
    // fishing rod
    ctx.strokeStyle = '#6e4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx + 6, dy - 6); ctx.lineTo(rodTipX(), rodTipY()); ctx.stroke(); ctx.lineCap = 'butt';
  }
  function drawFish(f) {
    ctx.save(); ctx.translate(f.x, f.y + Math.sin(tick / 12 + f.wob) * 2); ctx.scale(f.face, 1);
    ctx.font = f.size + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (f.k.gold) { ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 12; }
    ctx.fillText(f.k.emoji, 0, 0);
    ctx.shadowBlur = 0; ctx.restore(); ctx.textBaseline = 'alphabetic';
  }

  // ---------- HUD / overlays ----------
  function updateHud() {
    document.getElementById('fsScore').textContent = score;
    document.getElementById('fsTime').textContent = Math.ceil(timeLeft);
    document.getElementById('fsBest').textContent = best;
  }
  const toastEl = document.getElementById('toast'); let toastT = null;
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 900); }
  function hideOverlays() { document.getElementById('startScreen').classList.add('hidden'); document.getElementById('overScreen').classList.add('hidden'); }
  document.getElementById('fsPlay').onclick = reset;
  document.getElementById('fsAgain').onclick = reset;

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(now) { let dt = (now - lastT) / 16.6667; lastT = now; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  let lastErr = null;
  requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__fishing = {
      reset, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      // drop hook onto the nearest fish, then reel it up with taps
      autoFish() {
        if (state === 'cast') { const f = fish[0]; if (f) { hook.x = f.x; hook.held = true; if (Math.abs(hook.y - f.y) < 30) { /* close */ } } }
        else if (state === 'reel') { hook.y -= 26; reelTap(); }
      },
      hookNearest() { let best = null, bd = 1e9; for (const f of fish) { const d = dist(hook.x, hook.y, f.x, f.y); if (d < bd) { bd = d; best = f; } } if (best) { hook.hooked = best; state = 'reel'; } },
      nearestFishPos() { let b = null, bd = 1e9; for (const f of fish) { const d = dist(hook.x, hook.y, f.x, f.y); if (d < bd) { bd = d; b = f; } } return b ? { x: b.x | 0, y: b.y | 0, key: b.k.key } : null; },
      hold(v) { hook.held = !!v; }, steer(x) { if (state === 'cast' && hook.held) hook.x = clamp(x, 20, W - 20); },
      tapReel() { if (state === 'reel') { hook.y -= 26; reelTap(); } },
      info() { return { running, state, score, caught, timeLeft: +timeLeft.toFixed(1), fish: fish.length, hookY: hook.y | 0, hooked: hook.hooked ? hook.hooked.k.key : null, best }; },
      lastErr() { return lastErr ? String(lastErr.stack || lastErr) : null; },
    };
  }
})();
