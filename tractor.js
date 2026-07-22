/* =====================================================================
   WOOFA TRACTOR PARKOUR — drive the John Deere over rolling hills.
   Collect hay bales, grab fuel, don't run dry, and don't flip.
   Pure vanilla canvas. Best distance saved to localStorage.
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
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const norm = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  const BEST_KEY = 'woofa_tractor_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;

  // ---------- terrain ----------
  const GROUND_BASE = () => H * 0.66;
  function hillAmp(x) { return 26 + Math.min(x / 260, 80); }   // hills grow with distance
  function groundY(x) {
    const a = hillAmp(x);
    return GROUND_BASE()
      - Math.sin(x * 0.0032) * a
      - Math.sin(x * 0.0089 + 1.3) * a * 0.5
      - Math.sin(x * 0.0173 + 0.6) * a * 0.28;
  }
  function slopeAt(x) { return (groundY(x + 7) - groundY(x - 7)) / 14; }   // + = downhill (screen y grows)

  // ---------- state ----------
  const WHEEL_BASE = 52, RIDE_H = 26, WHEEL_R = 15;
  const tr = {};
  let items = [];   // hay bales + fuel cans ahead
  let cam = { x: 0, y: 0 };
  let particles = [];
  let running = false, tick = 0, dist = 0, bales = 0, fuel = 1, flipT = 0, spawnedTo = 0;
  const input = { gas: false, brake: false };

  function reset() {
    tr.x = 120; tr.vx = 0; tr.vy = 0; tr.angle = 0; tr.angVel = 0; tr.onGround = true; tr.slopePrev = 0;
    tr.y = groundY(tr.x) - RIDE_H;
    items = []; particles = []; spawnedTo = 0;
    dist = 0; bales = 0; fuel = 1; flipT = 0; tick = 0;
    cam.x = 0; cam.y = 0;
    spawnAhead(2600);
    running = true;
    hideOverlays(); updateHud();
  }

  function spawnAhead(toX) {
    // hay bales + fuel cans scattered along the course
    for (let x = Math.max(700, spawnedTo); x < toX; x += rand(230, 420)) {
      const gy = groundY(x);
      if (Math.random() < 0.28) items.push({ type: 'fuel', x, y: gy - 30, got: false, ph: rand(0, 6) });
      else items.push({ type: 'bale', x, y: gy - 26, got: false, ph: rand(0, 6) });
    }
    spawnedTo = toX;
  }

  // ---------- input ----------
  function bindPedal(el, key) {
    const on = (e) => { e.preventDefault(); input[key] = true; el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); input[key] = false; el.classList.remove('on'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    window.addEventListener('mouseup', off);
  }
  bindPedal(document.getElementById('gasPedal'), 'gas');
  bindPedal(document.getElementById('brakePedal'), 'brake');
  window.addEventListener('keydown', (e) => { if (e.code === 'ArrowRight' || e.code === 'Space') input.gas = true; if (e.code === 'ArrowLeft') input.brake = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowRight' || e.code === 'Space') input.gas = false; if (e.code === 'ArrowLeft') input.brake = false; });

  // ---------- update ----------
  const GRAV = 0.42;
  function update(dt) {
    if (!running) return;
    tick += dt;
    const hasFuel = fuel > 0;
    const gas = input.gas && hasFuel, brake = input.brake && hasFuel;

    if (tr.onGround) {
      const gyF = groundY(tr.x + WHEEL_BASE / 2), gyB = groundY(tr.x - WHEEL_BASE / 2);
      const targetAngle = Math.atan2(gyF - gyB, WHEEL_BASE);
      tr.angle = lerp(tr.angle, targetAngle, 0.35 * dt);
      // engine + gravity along the slope
      if (gas) tr.vx += 0.42 * dt;
      if (brake) tr.vx -= 0.5 * dt;
      tr.vx += Math.sin(targetAngle) * 0.34 * dt;   // downhill speeds up, uphill drags
      tr.vx *= Math.pow(0.992, dt);
      tr.vx = clamp(tr.vx, -5.5, 12);
      tr.x += tr.vx * dt;
      if (tr.x < 40) { tr.x = 40; tr.vx = Math.max(0, tr.vx); }
      const cy = (groundY(tr.x + WHEEL_BASE / 2) + groundY(tr.x - WHEEL_BASE / 2)) / 2 - RIDE_H;
      tr.y = cy;
      // crest launch — fly off the top of a hill at speed (only real crests at pace, and gentle so it lands easy)
      const s = slopeAt(tr.x);
      if (tr.vx > 4.6 && s > tr.slopePrev + 0.06 && s > 0.16) {
        tr.onGround = false;
        tr.vy = clamp(-tr.vx * s * 0.85 - 1.0, -8, 0);
        tr.angVel = -tr.vx * 0.0009;   // slight nose-up
      }
      tr.slopePrev = s;
      // burn fuel while driving
      if ((gas || brake) && Math.abs(tr.vx) > 0.2) fuel = clamp(fuel - 0.00055 * dt, 0, 1);
      if (Math.abs(tr.vx) > 0.5 && (tick | 0) % 5 === 0) particles.push({ x: tr.x - Math.cos(tr.angle) * 24, y: tr.y + 14, vx: rand(-0.6, -0.2) - tr.vx * 0.1, vy: rand(-1, -0.3), life: 0.7, r: rand(3, 6), c: 'rgba(150,120,80,0.6)' });
    } else {
      // airborne — gas noses up, brake noses down (classic hill-climb air control), with a gentle auto-level so casual driving lands fine
      tr.vy += GRAV * dt;
      tr.x += tr.vx * dt; tr.y += tr.vy * dt;
      if (gas) tr.angVel -= 0.0015 * dt;   // gentle nose-up (for style) — auto-level below keeps it from ever spinning out
      if (brake) tr.angVel += 0.005 * dt;  // brake noses down for control
      tr.angVel = lerp(tr.angVel, 0, 0.05 * dt);   // STRONG auto-level → flooring it still lands flat
      tr.angVel = clamp(tr.angVel, -0.09, 0.09);
      tr.angle += tr.angVel * dt;
      const gy = groundY(tr.x) - RIDE_H;
      if (tr.y >= gy) {
        tr.y = gy;
        const up = Math.abs(norm(tr.angle));
        if (up < 1.5) { tr.onGround = true; tr.vy = 0; tr.angVel = 0; tr.angle = Math.atan2(groundY(tr.x + WHEEL_BASE / 2) - groundY(tr.x - WHEEL_BASE / 2), WHEEL_BASE); if (tr.vx > 5) { spawnParticles(tr.x, tr.y + 20, '#e7d6b0', 10); shake(); toast('Nice landing! 🚜'); } }
        else { crash('flipped'); return; }
      }
    }

    // tipped over on the ground for too long → flip out
    if (tr.onGround && Math.abs(norm(tr.angle)) > 1.35) { flipT += dt; if (flipT > 40) { crash('flipped'); return; } }
    else flipT = Math.max(0, flipT - dt * 2);

    // out of fuel and stopped → done
    if (fuel <= 0 && Math.abs(tr.vx) < 0.25 && tr.onGround) { crash('fuel'); return; }

    dist = Math.max(dist, Math.floor(tr.x / 10) - 11);
    if (tr.x + 3000 > spawnedTo) spawnAhead(spawnedTo + 2600);

    // collect items
    for (const it of items) {
      if (it.got) continue;
      if (Math.hypot(it.x - tr.x, it.y - tr.y) < 46) {
        it.got = true;
        if (it.type === 'bale') { bales++; spawnParticles(it.x, it.y, '#e7c65a', 10); toast('🌾 +1'); }
        else { fuel = clamp(fuel + 0.4, 0, 1); spawnParticles(it.x, it.y, '#58e08a', 10); toast('⛽ Fuel!'); }
      }
    }
    items = items.filter((it) => !it.got && it.x > tr.x - 400);

    // camera
    cam.x = lerp(cam.x, tr.x - W * 0.34, 0.12 * dt);
    cam.y = lerp(cam.y, tr.y - H * 0.52, 0.08 * dt);
    cam.x = Math.max(0, cam.x);

    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += 0.12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) particles.splice(i, 1); }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if ((tick | 0) % 6 === 0) updateHud();
  }

  let shakeT = 0;
  function shake() { shakeT = 8; }
  function spawnParticles(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, r: rand(2, 5), c }); } }

  function crash(cause) {
    running = false;
    spawnParticles(tr.x, tr.y, '#ff6a6a', 20); shake();
    if (dist > best) { best = dist; localStorage.setItem(BEST_KEY, String(best)); }
    document.getElementById('overTitle').textContent = cause === 'fuel' ? 'Out of fuel! ⛽' : 'Flipped it! 🚜💥';
    document.getElementById('overDist').textContent = dist;
    document.getElementById('overBales').textContent = bales;
    document.getElementById('overBest').textContent = best;
    setTimeout(() => document.getElementById('overScreen').classList.remove('hidden'), 700);
  }

  // ---------- render ----------
  const s2 = (wx) => wx - cam.x + (shakeT > 0 ? rand(-shakeT, shakeT) : 0);
  const sy2 = (wy) => wy - cam.y + (shakeT > 0 ? rand(-shakeT, shakeT) : 0);
  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ec8ff'); sky.addColorStop(1, '#cdeeff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // parallax hills
    ctx.fillStyle = '#8fc98a'; drawLayer(0.4, 70);
    ctx.fillStyle = '#6fb56a'; drawLayer(0.65, 36);
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) { const cx = ((i * 520 - cam.x * 0.25) % (W + 300)) - 150, cyy = 60 + (i % 3) * 42; cloud(cx, cyy); }
    // ground
    drawGround();
    // items
    for (const it of items) { if (it.got) continue; const x = s2(it.x), y = sy2(it.y) + Math.sin(tick / 16 + it.ph) * 2; if (x < -60 || x > W + 60) continue; ctx.font = '30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.type === 'bale' ? '🌾' : '⛽', x, y); }
    ctx.textBaseline = 'alphabetic';
    // particles
    for (const p of particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(s2(p.x), sy2(p.y), p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    // tractor
    drawTractor();
  }
  function drawLayer(par, amp) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 24) { const wx = (cam.x * par) + sx; const y = H * 0.5 - Math.sin(wx * 0.002) * amp - Math.sin(wx * 0.006 + 1) * amp * 0.4; ctx.lineTo(sx, y); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function cloud(x, y) { for (const c of [[0, 0, 22], [20, 5, 16], [-18, 6, 14], [8, -8, 14]]) { ctx.beginPath(); ctx.arc(x + c[0], y + c[1], c[2], 0, 7); ctx.fill(); } }
  function drawGround() {
    ctx.beginPath(); ctx.moveTo(0, H);
    const startWX = cam.x - 20;
    for (let sx = -20; sx <= W + 20; sx += 8) { const wx = cam.x + sx; ctx.lineTo(sx, groundY(wx) - cam.y); }
    ctx.lineTo(W + 20, H); ctx.closePath();
    ctx.fillStyle = '#5aa84e'; ctx.fill();
    // dirt band under the grass
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = -20; sx <= W + 20; sx += 8) { const wx = cam.x + sx; ctx.lineTo(sx, groundY(wx) - cam.y + 10); }
    ctx.lineTo(W + 20, H); ctx.closePath();
    ctx.fillStyle = '#7a5230'; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
    // grass top line
    ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 4; ctx.beginPath();
    for (let sx = -20; sx <= W + 20; sx += 8) { const wx = cam.x + sx; const y = groundY(wx) - cam.y; if (sx === -20) ctx.moveTo(sx, y); else ctx.lineTo(sx, y); }
    ctx.stroke();
  }
  function drawTractor() {
    const x = s2(tr.x), y = sy2(tr.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tr.angle);
    // shadow
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, RIDE_H + 4, 40, 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // rear big wheel
    wheel(-WHEEL_BASE / 2, RIDE_H - 2, WHEEL_R + 5);
    // front wheel
    wheel(WHEEL_BASE / 2, RIDE_H + 2, WHEEL_R);
    // body (John Deere green)
    ctx.fillStyle = '#3a8a2e'; roundRect(-30, -6, 46, 24, 4); ctx.fill();
    ctx.fillStyle = '#2f7a26'; roundRect(-30, 8, 52, 8, 3); ctx.fill();   // chassis
    // cab
    ctx.fillStyle = '#367f2b'; roundRect(-26, -30, 24, 26, 4); ctx.fill();
    ctx.fillStyle = '#bfe6ff'; roundRect(-23, -27, 18, 15, 3); ctx.fill();   // window
    // Woofa in the cab (little black+white head)
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(-14, -18, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(-11, -16, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -17, 1.3, 0, 7); ctx.fill();
    // exhaust + nose
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(6, -22, 4, 16);
    ctx.fillStyle = '#ffd23d'; roundRect(14, 2, 8, 10, 2); ctx.fill();   // headlight
    ctx.restore();
    // exhaust puff when accelerating
    if (input.gas && running && (tick | 0) % 8 < 4) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(s2(tr.x) + Math.cos(tr.angle - 1.4) * 8, sy2(tr.y) - 26, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function wheel(wx, wy, r) {
    ctx.fillStyle = '#1c1c22'; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.arc(wx, wy, r * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(wx, wy, r * 0.22, 0, 7); ctx.fill();
    // spinning spokes
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    const sp = tr.x * 0.12;
    for (let i = 0; i < 4; i++) { const a = sp + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * r * 0.5, wy + Math.sin(a) * r * 0.5); ctx.stroke(); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- HUD / overlays ----------
  function updateHud() {
    document.getElementById('trDist').textContent = dist;
    document.getElementById('trBales').textContent = bales;
    document.getElementById('trBest').textContent = best;
    const f = document.getElementById('trFuel'); if (f) f.style.width = Math.round(fuel * 100) + '%';
  }
  const toastEl = document.getElementById('toast');
  let toastT = null;
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 900); }
  function hideOverlays() { document.getElementById('startScreen').classList.add('hidden'); document.getElementById('overScreen').classList.add('hidden'); }
  document.getElementById('trPlay').onclick = reset;
  document.getElementById('trAgain').onclick = reset;

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(now) { let dt = (now - lastT) / 16.6667; lastT = now; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  let lastErr = null;
  requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__tractor = {
      reset, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      hold(k, v) { input[k] = v; }, drive(n) { input.gas = true; for (let i = 0; i < (n || 60); i++) update(1); input.gas = false; },
      info() { return { running, dist, bales, fuel: +fuel.toFixed(2), x: tr.x | 0, y: tr.y | 0, vx: +tr.vx.toFixed(2), angle: +tr.angle.toFixed(2), onGround: tr.onGround, best }; },
      lastErr() { return lastErr ? String(lastErr.stack || lastErr) : null; },
    };
  }
})();
