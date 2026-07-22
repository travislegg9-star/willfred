/* =====================================================================
   SHEEP CHASE — a boy scrambles round the paddock grabbing frisbees for
   Woofa while the sheep hunt him down (and gobble the frisbees first).
   Drag to steer. Hit the round target before the sheep catch you 3 times.
   Rounds escalate. Best round saved. Pure vanilla canvas.
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
    layoutField();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('load', resize);

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

  const BEST_KEY = 'sheep_chase_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;

  // field rect (in screen space; camera fixed)
  const field = { x: 0, y: 0, w: 0, h: 0 };
  function layoutField() {
    const mx = 16, top = 120, bot = 130;
    field.x = mx; field.y = top; field.w = W - mx * 2; field.h = H - top - bot;
  }

  let player, sheep, frisbees, bales, bones, round, collected, target, lives, running, invuln, tick, boneTimer, scareT, shakeT;
  const particles = [];

  function reset() {
    layoutField();
    round = 1; ensureAudio(); startRound(); running = true; hideOverlays(); updateHud();
  }

  // ---------- sound ----------
  let actx = null, master = null;
  function ensureAudio() { try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination); } if (actx.state === 'suspended' && actx.resume) actx.resume(); } catch (e) { actx = null; } }
  function beep(f, dur, type, vol, slideTo) { if (!actx) return; try { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = f; if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur); g.gain.value = vol || 0.05; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur + 0.02); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + dur + 0.04); } catch (e) {} }
  const sfx = {
    grab() { beep(720, 0.06, 'triangle', 0.05, 1080); },
    steal() { beep(300, 0.12, 'square', 0.05, 150); },
    caught() { beep(170, 0.3, 'sawtooth', 0.08, 70); setTimeout(() => beep(110, 0.24, 'square', 0.06, 60), 70); },
    round() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.06), i * 90)); },
    over() { [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.26, 'sawtooth', 0.06, f * 0.7), i * 130)); },
    bone() { beep(950, 0.08, 'triangle', 0.05, 1400); },
    bark() { beep(200, 0.16, 'square', 0.08, 95); setTimeout(() => beep(620, 0.2, 'sawtooth', 0.07, 190), 80); },
  };
  function boom(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 4); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 1, r: rand(2, 5), c }); } }

  function startRound() {
    collected = 0;
    target = 8 + round * 2;
    lives = 3; invuln = 0; tick = 0; scareT = 0; shakeT = 0; boneTimer = rand(180, 340); particles.length = 0;
    player = { x: field.x + field.w / 2, y: field.y + field.h - 40, r: 15, speed: 3.4, dir: -Math.PI / 2, moving: false };
    bones = [];
    bales = [];
    const nb = 2 + Math.min(round, 4);
    for (let i = 0; i < nb; i++) {
      const bw = rand(50, 90), bh = rand(34, 46);
      bales.push({ x: rand(field.x + 40, field.x + field.w - bw - 40), y: rand(field.y + 70, field.y + field.h - bh - 70), w: bw, h: bh });
    }
    sheep = [];
    const ns = 2 + round;
    for (let i = 0; i < ns; i++) addSheep();
    frisbees = [];
    for (let i = 0; i < 10; i++) spawnFrisbee();
  }

  function addSheep() {
    const edge = Math.random();
    const x = edge < 0.5 ? field.x + 30 : field.x + field.w - 30;
    const y = rand(field.y + 30, field.y + 90);
    sheep.push({ x, y, r: 16, vx: 0, vy: 0, speed: 1.7 + round * 0.12, wander: rand(0, 6), bob: rand(0, 6) });
  }

  function spawnFrisbee() {
    for (let tries = 0; tries < 20; tries++) {
      const x = rand(field.x + 24, field.x + field.w - 24), y = rand(field.y + 24, field.y + field.h - 24);
      if (!bales.some((b) => x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16)) {
        frisbees.push({ x, y, r: 9, ph: rand(0, 6) }); return;
      }
    }
    frisbees.push({ x: field.x + field.w / 2, y: field.y + field.h / 2, r: 9, ph: 0 });
  }
  function spawnBone() {
    for (let tries = 0; tries < 20; tries++) {
      const x = rand(field.x + 40, field.x + field.w - 40), y = rand(field.y + 40, field.y + field.h - 40);
      if (!bales.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) { bones.push({ x, y, r: 13, ph: rand(0, 6) }); return; }
    }
  }

  // ---------- input: drag joystick ----------
  const joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  const keys = {};
  function pt(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const p = pt(e); joy.active = true; joy.ox = p.x; joy.oy = p.y; joy.x = p.x; joy.y = p.y; }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const p = pt(e); joy.x = p.x; joy.y = p.y; }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (!e.touches.length) joy.active = false; }, { passive: false });
  canvas.addEventListener('mousedown', (e) => { const p = pt(e); joy.active = true; joy.ox = p.x; joy.oy = p.y; joy.x = p.x; joy.y = p.y; });
  window.addEventListener('mousemove', (e) => { if (joy.active) { joy.x = e.clientX; joy.y = e.clientY; } });
  window.addEventListener('mouseup', () => { joy.active = false; });
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  // ---------- update ----------
  function update(dt) {
    if (!running || !player) return;
    tick += dt;
    if (invuln > 0) invuln -= dt;
    if (scareT > 0) scareT -= dt;
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    boneTimer -= dt;
    if (boneTimer <= 0 && bones.length === 0) { spawnBone(); boneTimer = rand(420, 700); }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += 0.1 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.025 * dt; if (p.life <= 0) particles.splice(i, 1); }

    // player velocity from joystick or keys
    let vx = 0, vy = 0;
    if (joy.active) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, m = Math.hypot(dx, dy);
      if (m > 10) { const s = Math.min(m, 60) / 60; vx = dx / m * s; vy = dy / m * s; }
    }
    if (keys.ArrowLeft || keys.a) vx = -1; if (keys.ArrowRight || keys.d) vx = 1;
    if (keys.ArrowUp || keys.w) vy = -1; if (keys.ArrowDown || keys.s) vy = 1;
    const pm = Math.hypot(vx, vy);
    player.moving = pm > 0.05;
    if (pm > 1) { vx /= pm; vy /= pm; }
    if (player.moving) player.dir = Math.atan2(vy, vx);
    moveEntity(player, vx * player.speed * dt, vy * player.speed * dt);

    // collect frisbees
    for (let i = frisbees.length - 1; i >= 0; i--) {
      if (dist(player.x, player.y, frisbees[i].x, frisbees[i].y) < player.r + frisbees[i].r) {
        boom(frisbees[i].x, frisbees[i].y, '#ff8a3d', 8); frisbees.splice(i, 1); collected++; spawnFrisbee(); sfx.grab();
        if (collected >= target) { winRound(); return; }
      }
    }
    // grab a bone → Woofa barks, the whole flock flees for a few seconds
    for (let i = bones.length - 1; i >= 0; i--) {
      if (dist(player.x, player.y, bones[i].x, bones[i].y) < player.r + bones[i].r + 2) {
        boom(bones[i].x, bones[i].y, '#ffd23d', 18); bones.splice(i, 1); scareT = 250; shakeT = 6; sfx.bone(); sfx.bark(); toast('WOOFA BARKS! 🐕');
      }
    }

    // sheep AI: chase player if close, else drift to nearest frisbee (and eat it)
    for (const s of sheep) {
      s.wander -= dt;
      const dp = dist(s.x, s.y, player.x, player.y);
      let tx, ty, spd = s.speed;
      if (scareT > 0) { tx = s.x * 2 - player.x; ty = s.y * 2 - player.y; spd = s.speed * 1.35; }   // scared → bolt away from the boy
      else if (dp < 220) { tx = player.x; ty = player.y; }      // hunt the boy
      else {                                                // graze toward frisbees
        let bd = 1e9, bf = null;
        for (const f of frisbees) { const d = dist(s.x, s.y, f.x, f.y); if (d < bd) { bd = d; bf = f; } }
        if (bf) { tx = bf.x; ty = bf.y; } else { tx = player.x; ty = player.y; }
      }
      const a = Math.atan2(ty - s.y, tx - s.x) + (s.wander > 0 ? 0 : rand(-0.5, 0.5));
      if (s.wander <= 0) s.wander = rand(1, 3);
      moveEntity(s, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt);
      // sheep eat frisbees (not while fleeing)
      if (scareT <= 0) for (let i = frisbees.length - 1; i >= 0; i--) {
        if (dist(s.x, s.y, frisbees[i].x, frisbees[i].y) < s.r + frisbees[i].r) { frisbees.splice(i, 1); spawnFrisbee(); sfx.steal(); }
      }
      // caught the boy? (safe while the flock is scared)
      if (scareT <= 0 && invuln <= 0 && dp < s.r + player.r + 2) loseLife();
    }
    if ((tick | 0) % 6 === 0) updateHud();
  }

  // move with field bounds + bale collision (axis-separated push-out)
  function moveEntity(e, dx, dy) {
    e.x = clamp(e.x + dx, field.x + e.r, field.x + field.w - e.r);
    for (const b of bales) resolveBale(e, b);
    e.y = clamp(e.y + dy, field.y + e.r, field.y + field.h - e.r);
    for (const b of bales) resolveBale(e, b);
  }
  function resolveBale(e, b) {
    const cx = clamp(e.x, b.x, b.x + b.w), cy = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
    if (d < e.r && d > 0.0001) { e.x = cx + dx / d * e.r; e.y = cy + dy / d * e.r; }
    else if (d === 0) { e.y = b.y - e.r; }
  }

  function loseLife() {
    lives--; invuln = 90; shakeT = 11; boom(player.x, player.y, '#e0503a', 16); sfx.caught();
    player.x = field.x + field.w / 2; player.y = field.y + field.h - 40;
    for (const s of sheep) { const a = Math.atan2(s.y - player.y, s.x - player.x); s.x += Math.cos(a) * 80; s.y += Math.sin(a) * 80; }
    updateHud();
    if (lives <= 0) endGame(false);
  }
  function winRound() {
    round++;
    if (round - 1 > best) { best = round - 1; localStorage.setItem(BEST_KEY, String(best)); }
    sfx.round(); toast('Round ' + round + '! 🐑');
    startRound(); updateHud();
  }

  // ---------- render ----------
  function render() {
    ctx.fillStyle = '#0c1a10'; ctx.fillRect(0, 0, W, H);
    const kx = shakeT > 0 ? rand(-shakeT, shakeT) * 0.6 : 0, ky = shakeT > 0 ? rand(-shakeT, shakeT) * 0.6 : 0;
    ctx.save(); ctx.translate(kx, ky);
    // paddock grass
    ctx.fillStyle = '#2f5a34'; ctx.fillRect(field.x, field.y, field.w, field.h);
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 6; ctx.strokeRect(field.x, field.y, field.w, field.h); // fence
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = field.y; y < field.y + field.h; y += 44) ctx.fillRect(field.x, y, field.w, 22);
    if (player) {
      // frisbees
      for (const f of frisbees) {
        const pr = f.r + Math.sin(tick / 12 + f.ph) * 0.8;
        ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.ellipse(f.x, f.y, pr, pr * 0.5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(f.x, f.y, pr * 0.55, pr * 0.28, 0, 0, 7); ctx.stroke();
      }
      // bones (Woofa's bark power-up)
      for (const bn of bones) {
        const yy = bn.y + Math.sin(tick / 10 + bn.ph) * 2;
        const gl = 0.5 + Math.sin(tick / 6) * 0.3; ctx.fillStyle = 'rgba(255,210,61,' + gl * 0.4 + ')';
        ctx.beginPath(); ctx.arc(bn.x, yy, bn.r + 6, 0, 7); ctx.fill();
        ctx.font = (bn.r * 2) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦴', bn.x, yy + 1);
      }
      // bales
      for (const b of bales) {
        ctx.fillStyle = '#d9b24a'; roundRect(b.x, b.y, b.w, b.h, 8); ctx.fill();
        ctx.strokeStyle = '#a9822a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,90,20,0.5)'; ctx.lineWidth = 2;
        for (let yy = b.y + 8; yy < b.y + b.h - 4; yy += 9) { ctx.beginPath(); ctx.moveTo(b.x + 4, yy); ctx.lineTo(b.x + b.w - 4, yy); ctx.stroke(); }
      }
      // sheep
      for (const s of sheep) drawSheep(s);
      // fluff / burst particles
      for (const p of particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c || '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      // player boy
      drawBoy(player);
    }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // scared-flock golden border pulse
    if (scareT > 0) { ctx.strokeStyle = 'rgba(255,210,61,' + Math.min(0.55, scareT / 250 * 0.55) + ')'; ctx.lineWidth = 7; ctx.strokeRect(3, 3, W - 6, H - 6); }
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawSheep(s) {
    const bob = Math.sin(tick / 8 + s.bob) * 1.5;
    // fluffy body
    ctx.fillStyle = '#f2f2f0';
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * s.r * 0.7, s.y + Math.sin(a) * s.r * 0.6 + bob, s.r * 0.55, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.arc(s.x, s.y + bob, s.r * 0.8, 0, 7); ctx.fill();
    // face toward player
    const a = Math.atan2(player.y - s.y, player.x - s.x);
    const fx = s.x + Math.cos(a) * s.r * 0.8, fy = s.y + Math.sin(a) * s.r * 0.8 + bob;
    ctx.fillStyle = '#26242a'; ctx.beginPath(); ctx.ellipse(fx, fy, s.r * 0.42, s.r * 0.36, a, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + Math.cos(a - 0.4) * 4, fy + Math.sin(a - 0.4) * 4, 2, 0, 7); ctx.arc(fx + Math.cos(a + 0.4) * 4, fy + Math.sin(a + 0.4) * 4, 2, 0, 7); ctx.fill();
  }

  function drawBoy(p) {
    if (invuln > 0 && (tick | 0) % 8 < 4) ctx.globalAlpha = 0.5;
    // shadow
    ctx.globalAlpha *= 1; ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.9, p.r * 0.9, p.r * 0.35, 0, 0, 7); ctx.fill();
    // body (red shirt)
    ctx.fillStyle = '#e0503a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#241a12'; ctx.lineWidth = 2; ctx.stroke();
    // head
    ctx.fillStyle = '#c98a56'; ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.7, p.r * 0.55, 0, 7); ctx.fill(); ctx.stroke();
    // hair
    ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.arc(p.x, p.y - p.r * 0.95, p.r * 0.55, Math.PI, 0); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- HUD / overlays ----------
  const elF = document.getElementById('shFrisbees');
  const elL = document.getElementById('shLives');
  const elR = document.getElementById('shRound');
  function updateHud() {
    if (!player) return;
    elF.textContent = collected + '/' + target;
    elL.textContent = '❤️'.repeat(Math.max(0, lives)) || '—';
    elR.textContent = 'R' + round;
  }
  const toastEl = document.getElementById('toast');
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }

  const startScreen = document.getElementById('startScreen');
  const overScreen = document.getElementById('overScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); overScreen.classList.add('hidden'); }
  function endGame() {
    running = false; sfx.over();
    document.getElementById('overRound').textContent = round;
    document.getElementById('overBest').textContent = best;
    setTimeout(() => overScreen.classList.remove('hidden'), 400);
  }
  document.getElementById('sheepPlay').onclick = reset;
  document.getElementById('sheepAgain').onclick = reset;

  // ---------- loop (crash-proof) ----------
  let lastT = performance.now();
  function frame(now) {
    let dt = (now - lastT) / 16.6667; lastT = now; dt = clamp(dt, 0, 2.5);
    try { update(dt); render(); } catch (e) { /* keep the loop alive */ }
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__sheep = { reset, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return { running, collected, target, lives, round, sheep: sheep && sheep.length, frisbees: frisbees && frisbees.length, bones: bones && bones.length, scareT: Math.round(scareT || 0), dead: !running }; },
      forceBone() { bones.length = 0; spawnBone(); const b = bones[0]; if (!b) return 'no bone'; player.x = b.x; player.y = b.y; update(1); return { scareT: Math.round(scareT), bonesLeft: bones.length }; },
      steer(dx, dy) { joy.active = true; joy.ox = 0; joy.oy = 0; joy.x = dx * 60; joy.y = dy * 60; },
      px() { return player ? { x: player.x | 0, y: player.y | 0, lives } : null; },
      // definitive: drop the player onto a frisbee and step — collected must ++.
      collectTest() { if (!frisbees.length) return 'no frisbees'; const before = collected; const f = frisbees[0]; player.x = f.x; player.y = f.y; joy.active = false; update(1); return { before, after: collected, worked: collected === before + 1 }; } };
  }
})();
