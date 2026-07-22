/* =====================================================================
   WOOFA TRACTOR PARKOUR — level-based hill racer. Launch off ramps, clear
   speed-gated gaps, land flips for coins, reach the flag. Spend coins in the
   Garage to upgrade your John Deere. Pure vanilla canvas + localStorage.
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

  // ---------- save ----------
  const SAVE_KEY = 'woofa_tractor_v2';
  const DEF = { coins: 0, bestLevel: 1, best: 0, up: { engine: 0, tank: 0, susp: 0, grip: 0 }, model: 'green', owned: { green: true } };
  function load() { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return JSON.parse(JSON.stringify(DEF)); const s = JSON.parse(r); return Object.assign(JSON.parse(JSON.stringify(DEF)), s, { up: Object.assign({}, DEF.up, s.up), owned: Object.assign({}, DEF.owned, s.owned) }); } catch (e) { return JSON.parse(JSON.stringify(DEF)); } }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  let save = load();

  // ---------- upgrades + tractors ----------
  const UP = {
    engine: { name: 'Engine', emoji: '🔧', max: 5, base: 60, desc: 'More top speed & pull.' },
    tank: { name: 'Fuel Tank', emoji: '⛽', max: 5, base: 55, desc: 'Bigger tank — runs longer.' },
    susp: { name: 'Suspension', emoji: '🛞', max: 5, base: 65, desc: 'Land steeper without flipping.' },
    grip: { name: 'Grip', emoji: '⛰️', max: 5, base: 50, desc: 'Better climbing up hills.' },
  };
  const MODELS = {
    green: { name: 'John Deere', emoji: '🚜', body: '#3a8a2e', cab: '#367f2b', cost: 0, spd: 1, acc: 1 },
    red: { name: 'Red Rocket', emoji: '🚜', body: '#c0392b', cab: '#a5342a', cost: 900, spd: 1.14, acc: 1.1 },
    monster: { name: 'Monster', emoji: '🚜', body: '#5b3a86', cab: '#4a2f6e', cost: 2500, spd: 1.28, acc: 1.25, big: 1.25 },
  };
  const upCost = (k) => UP[k].base * (save.up[k] + 1);
  function stats() {
    const m = MODELS[save.model] || MODELS.green;
    return {
      maxSpeed: (11.5 + save.up.engine * 1.6) * m.spd,
      accel: (0.4 + save.up.engine * 0.055) * m.acc,
      fuelDrain: 0.00058 / (1 + save.up.tank * 0.32),
      safeLand: 1.42 + save.up.susp * 0.17,
      uphill: 0.34 * (1 - save.up.grip * 0.11),
      big: m.big || 1, body: m.body, cab: m.cab,
    };
  }

  // ---------- terrain (per level) ----------
  const GROUND_BASE = () => H * 0.66;
  let hillA = 26, ramps = [], gaps = [], finishX = 9000;
  function baseGround(x) { return GROUND_BASE() - Math.sin(x * 0.0032) * hillA - Math.sin(x * 0.0089 + 1.3) * hillA * 0.45 - Math.sin(x * 0.0173 + 0.6) * hillA * 0.22; }
  const GAP_Y = 100000;
  function groundY(x) {
    for (const g of gaps) if (x > g.x0 && x < g.x1) return GAP_Y;
    let y = baseGround(x);
    for (const r of ramps) { if (x > r.x0 && x < r.x1) { const t = (x - r.x0) / (r.x1 - r.x0); y -= t * t * r.h; } }
    return y;
  }
  function slopeAt(x) { const a = groundY(x + 7), b = groundY(x - 7); if (a > 90000 || b > 90000) return 0; return (a - b) / 14; }

  // ---------- state ----------
  const WHEEL_BASE = 52, RIDE_H = 26, WHEEL_R = 15, GRAV = 0.42;
  const tr = {};
  let items = [], cam = { x: 0, y: 0 }, particles = [];
  let level = 1, running = false, tick = 0, dist = 0, coins = 0, fuel = 1, flipT = 0, banner = null, lastMile = 0, shakeT = 0, spawnedTo = 0, flipCount = 0;
  const input = { gas: false, brake: false };
  function showBanner(txt, col) { banner = { txt, col: col || '#ffd23d', t: 90 }; }
  function shake() { shakeT = 8; }

  function genLevel(L) {
    hillA = 24 + Math.min(L * 4.5, 72);
    ramps = []; gaps = []; items = [];
    finishX = 8500 + L * 3200;
    let x = 2400;
    const nJumps = 2 + Math.floor(L * 0.85);
    for (let i = 0; i < nJumps && x < finishX - 1600; i++) {
      const rampH = 58 + Math.min(L * 7, 148) + rand(-8, 22), rampW = 150 + rand(0, 60);
      ramps.push({ x0: x, x1: x + rampW, h: rampH });
      x += rampW;
      if (L >= 3 && (L >= 5 || i % 2 === 0)) {   // speed-gated gaps from level 3
        const gapW = 55 + Math.min(L * 15, 236) + rand(-8, 30);
        gaps.push({ x0: x + 6, x1: x + 6 + gapW });
        x += gapW + 34;
      }
      x += rand(760, 1340);
    }
    // scatter bales + fuel (never in a gap)
    for (let sx = 900; sx < finishX - 200; sx += rand(360, 620)) { if (gaps.some(g => sx > g.x0 - 30 && sx < g.x1 + 30)) continue; const gy = baseGround(sx); items.push({ type: Math.random() < 0.24 ? 'fuel' : 'bale', x: sx, y: gy - 30, got: false, ph: rand(0, 6) }); }
  }

  function startLevel(L) {
    level = L; genLevel(L);
    tr.x = 120; tr.vx = 0; tr.vy = 0; tr.angle = 0; tr.angVel = 0; tr.onGround = true; tr.slopePrev = 0; tr.airRot = 0; tr.spin = 0; tr.airTime = 0;
    tr.y = groundY(tr.x) - RIDE_H;
    particles = []; dist = 0; coins = 0; fuel = 1; flipT = 0; tick = 0; banner = null; lastMile = 0; flipCount = 0;
    cam.x = 0; cam.y = 0; running = true;
    ensureAudio(); engineStart();
    banner = { txt: 'LEVEL ' + L, col: '#58e08a', t: 120 };
    hideOverlays(); updateHud();
  }

  // ---------- sound ----------
  let actx = null, master = null, engOsc = null, engGain = null;
  function ensureAudio() { try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination); } if (actx.state === 'suspended' && actx.resume) actx.resume(); } catch (e) { actx = null; } }
  function beep(f, dur, type, vol, slideTo) { if (!actx) return; try { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = f; if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur); g.gain.value = vol || 0.05; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur + 0.02); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + dur + 0.04); } catch (e) {} }
  const sfx = {
    jump() { beep(300, 0.16, 'square', 0.05, 560); }, land() { beep(150, 0.1, 'sine', 0.06, 90); },
    bale() { beep(760, 0.07, 'triangle', 0.05, 1080); }, fuel() { beep(500, 0.1, 'triangle', 0.05, 820); },
    crash() { beep(130, 0.4, 'sawtooth', 0.09, 55); setTimeout(() => beep(90, 0.3, 'square', 0.06, 50), 60); },
    flip() { beep(400, 0.1, 'square', 0.06, 780); setTimeout(() => beep(700, 0.12, 'triangle', 0.06, 1120), 80); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.06), i * 100)); },
    coin() { beep(900, 0.06, 'triangle', 0.05, 1300); },
  };
  function engineStart() { if (!actx || engOsc) return; try { engOsc = actx.createOscillator(); engGain = actx.createGain(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 46; engGain.gain.value = 0; engOsc.connect(engGain); engGain.connect(master); engOsc.start(); } catch (e) {} }
  function engineUpdate() { if (!engOsc) return; try { const t = 44 + Math.abs(tr.vx) * 7; engOsc.frequency.value += (t - engOsc.frequency.value) * 0.12; engGain.gain.value += (((input.gas && fuel > 0) ? 0.05 : 0.016) - engGain.gain.value) * 0.1; } catch (e) {} }
  function engineStop() { if (engOsc) { try { engGain.gain.value = 0; engOsc.stop(); } catch (e) {} engOsc = null; } }

  // ---------- input ----------
  function bindPedal(el, key) {
    const on = (e) => { e.preventDefault(); input[key] = true; el.classList.add('on'); };
    const off = (e) => { e.preventDefault(); input[key] = false; el.classList.remove('on'); };
    el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false }); el.addEventListener('mousedown', on); window.addEventListener('mouseup', off);
  }
  bindPedal(document.getElementById('gasPedal'), 'gas');
  bindPedal(document.getElementById('brakePedal'), 'brake');
  window.addEventListener('keydown', (e) => { if (e.code === 'ArrowRight' || e.code === 'Space') input.gas = true; if (e.code === 'ArrowLeft') input.brake = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowRight' || e.code === 'Space') input.gas = false; if (e.code === 'ArrowLeft') input.brake = false; });

  // ---------- update ----------
  function update(dt) {
    if (!running) return;
    tick += dt;
    const st = stats();
    const hasFuel = fuel > 0, gas = input.gas && hasFuel, brake = input.brake && hasFuel;

    if (tr.onGround) {
      let ga = Math.atan2(groundY(tr.x + WHEEL_BASE / 2) - groundY(tr.x - WHEEL_BASE / 2), WHEEL_BASE);
      if (!isFinite(ga) || Math.abs(ga) > 1.2) ga = tr.angle;   // near a lip/gap edge → keep current (don't spike)
      const targetAngle = clamp(ga, -0.85, 0.85);
      tr.angle = lerp(tr.angle, targetAngle, 0.35 * dt);
      if (gas) tr.vx += st.accel * dt;
      if (brake) tr.vx -= 0.5 * dt;
      tr.vx += Math.sin(targetAngle) * st.uphill * dt;
      tr.vx *= Math.pow(0.992, dt);
      tr.vx = clamp(tr.vx, -5.5, st.maxSpeed);
      const prevX = tr.x;
      tr.x += tr.vx * dt;
      if (tr.x < 40) { tr.x = 40; tr.vx = Math.max(0, tr.vx); }
      const fw = tr.x + WHEEL_BASE / 2, pfw = prevX + WHEEL_BASE / 2;   // front wheel now / before moving
      let launched = false;   // explicit, deterministic launch the instant the front wheel leaves a ramp lip
      for (const r of ramps) {
        if (pfw < r.x1 && fw >= r.x1 && tr.vx > 1) {
          const th = Math.min(Math.atan(2 * r.h / (r.x1 - r.x0)), 0.62);
          tr.onGround = false; tr.airTime = 0; tr.airRot = 0; tr.spin = 0;
          tr.vy = -Math.sin(th) * tr.vx * 1.5 - 2;     // faster + steeper ramp = MASSIVE air
          tr.angle = -th * 0.5; tr.angVel = 0;
          sfx.jump(); spawnParticles(tr.x, groundY(prevX) - RIDE_H, 'rgba(150,120,80,0.55)', 8);
          launched = true; break;
        }
      }
      if (!launched) {
        const gyF = groundY(fw), gyB = groundY(tr.x - WHEEL_BASE / 2);
        if (gyF > 90000 || gyB > 90000) {   // over a gap with no ramp behind → drop in (too slow to have launched)
          tr.onGround = false; tr.airTime = 0; tr.airRot = 0; tr.spin = 0;
        } else {
          tr.y = (gyF + gyB) / 2 - RIDE_H;
          if ((gas || brake) && Math.abs(tr.vx) > 0.2) fuel = clamp(fuel - st.fuelDrain * dt, 0, 1);
          if (Math.abs(tr.vx) > 0.5 && (tick | 0) % 5 === 0) particles.push({ x: tr.x - Math.cos(tr.angle) * 24, y: tr.y + 14, vx: rand(-0.6, -0.2) - tr.vx * 0.1, vy: rand(-1, -0.3), life: 0.7, r: rand(3, 6), c: 'rgba(150,120,80,0.6)' });
        }
      }
    } else {
      tr.airTime = (tr.airTime || 0) + dt;
      tr.vy += GRAV * dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt;
      if (brake) { tr.angVel = clamp(tr.angVel + 0.0082 * dt, -0.02, 0.17); const d = tr.angVel * dt; tr.angle += d; tr.spin = (tr.spin || 0) + Math.abs(d); }
      else { const flat = Math.round(tr.angle / (2 * Math.PI)) * (2 * Math.PI); tr.angle = lerp(tr.angle, flat, 0.06 * dt); tr.angVel = 0; }   // ease to nearest flat: commit past a half-flip and it auto-completes; little kids always land safe
      const gy = groundY(tr.x);
      if (gy < 90000) {
        if (tr.airTime > 2 && tr.vy >= 0 && tr.y >= gy - RIDE_H) {   // only land when descending (no 1-frame re-land glitch)
          tr.y = gy - RIDE_H;
          if (Math.abs(norm(tr.angle)) < st.safeLand) {
            tr.onGround = true; tr.vy = 0; tr.angVel = 0;
            tr.angle = clamp(Math.atan2(groundY(tr.x + WHEEL_BASE / 2) - groundY(tr.x - WHEEL_BASE / 2), WHEEL_BASE), -0.85, 0.85);
            spawnParticles(tr.x, tr.y + 20, '#e7d6b0', 12); shake(); sfx.land();
            const flips = Math.floor((tr.spin || 0) / (Math.PI * 2));
            if (flips >= 1) { const bonus = flips * 20; coins += bonus; flipCount += flips; showBanner((flips >= 2 ? flips + 'x FLIP! ' : 'FLIP! ') + '+' + bonus + '🪙', '#ff8a3d'); spawnParticles(tr.x, tr.y - 12, '#ffd23d', 22); sfx.flip(); sfx.coin(); updateHud(); }
          } else { crash('flipped'); return; }
          tr.airRot = 0; tr.spin = 0;
        }
      } else if (tr.y > GROUND_BASE() + 250) { crash('gap'); return; }   // not enough speed → fell into the pit
    }

    // finish line
    if (tr.x >= finishX) { finishLevel(); return; }

    dist = Math.max(dist, Math.floor(tr.x / 10));
    if (dist >= lastMile + 250) { lastMile = Math.floor(dist / 250) * 250; }
    engineUpdate();
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

    for (const it of items) {
      if (it.got) continue;
      if (Math.hypot(it.x - tr.x, it.y - tr.y) < 46) {
        it.got = true;
        if (it.type === 'bale') { coins += 5; spawnParticles(it.x, it.y, '#e7c65a', 10); sfx.bale(); sfx.coin(); }
        else { fuel = clamp(fuel + 0.42, 0, 1); spawnParticles(it.x, it.y, '#58e08a', 10); sfx.fuel(); }
        updateHud();
      }
    }

    cam.x = Math.max(0, lerp(cam.x, tr.x - W * 0.34, 0.12 * dt));
    cam.y = lerp(cam.y, tr.y - H * 0.52, 0.08 * dt);
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += 0.12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) particles.splice(i, 1); }
    if ((tick | 0) % 6 === 0) updateHud();
  }
  function spawnParticles(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, r: rand(2, 5), c }); } }

  function crash(cause) {
    running = false; spawnParticles(tr.x, tr.y, '#ff6a6a', 20); shake(); sfx.crash(); engineStop();
    save.coins += coins; if (dist > save.best) save.best = dist; persist();
    document.getElementById('overTitle').textContent = cause === 'gap' ? 'Fell in the gap! 🕳️' : 'Flipped it! 🚜💥';
    document.getElementById('overDist').textContent = dist;
    document.getElementById('overCoins').textContent = coins;
    document.getElementById('overBest').textContent = save.bestLevel;
    setTimeout(() => document.getElementById('overScreen').classList.remove('hidden'), 700);
  }
  function finishLevel() {
    running = false; engineStop(); sfx.win();
    const bonus = 50 + level * 12; coins += bonus;
    save.coins += coins; if (level + 1 > save.bestLevel) save.bestLevel = level + 1; persist();
    const frac = fuel;   // stars: fuel left + flips
    const stars = (flipCount >= 2 || frac > 0.5) ? 3 : (flipCount >= 1 || frac > 0.2) ? 2 : 1;
    document.getElementById('clearStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('clearText').textContent = stars === 3 ? 'Gun driver! ⚡' + (flipCount ? '  ' + flipCount + ' flips!' : '') : 'Made it to the flag!';
    document.getElementById('clearCoins').textContent = coins;
    for (let k = 0; k < 3; k++) setTimeout(() => spawnParticles(tr.x, tr.y - 20, '#ffd23d', 16), k * 200);
    setTimeout(() => document.getElementById('clearScreen').classList.remove('hidden'), 500);
  }

  // ---------- render ----------
  const s2 = (wx) => wx - cam.x + (shakeT > 0 ? rand(-shakeT, shakeT) : 0);
  const sy2 = (wy) => wy - cam.y + (shakeT > 0 ? rand(-shakeT, shakeT) : 0);
  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ec8ff'); sky.addColorStop(1, '#cdeeff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fc98a'; drawLayer(0.4, 70); ctx.fillStyle = '#6fb56a'; drawLayer(0.65, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 5; i++) { const cx = ((i * 520 - cam.x * 0.25) % (W + 300)) - 150; cloud(cx, 60 + (i % 3) * 42); }
    drawGround();
    drawFinish();
    for (const it of items) { if (it.got) continue; const x = s2(it.x), y = sy2(it.y) + Math.sin(tick / 16 + it.ph) * 2; if (x < -60 || x > W + 60) continue; ctx.font = '30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.type === 'bale' ? '🌾' : '⛽', x, y); }
    ctx.textBaseline = 'alphabetic';
    for (const p of particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(s2(p.x), sy2(p.y), p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    drawTractor();
    if (running && Math.abs(tr.vx) > 8) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const yy = (i * 90 + tick * 6) % H; const len = Math.abs(tr.vx) * 4; const sx = W - (tick * 8 % W); ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx - len, yy); ctx.stroke(); } }
    if (running && !tr.onGround) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '800 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('hold LEAN to flip! 🤸', W / 2, 120); }
    if (banner) { ctx.globalAlpha = clamp(banner.t / 30, 0, 1); ctx.fillStyle = banner.col; ctx.font = '900 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText(banner.txt, W / 2, H * 0.28); ctx.globalAlpha = 1; }
  }
  function drawLayer(par, amp) { ctx.beginPath(); ctx.moveTo(0, H); for (let sx = 0; sx <= W; sx += 24) { const wx = (cam.x * par) + sx; const y = H * 0.5 - Math.sin(wx * 0.002) * amp - Math.sin(wx * 0.006 + 1) * amp * 0.4; ctx.lineTo(sx, y); } ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); }
  function cloud(x, y) { for (const c of [[0, 0, 22], [20, 5, 16], [-18, 6, 14], [8, -8, 14]]) { ctx.beginPath(); ctx.arc(x + c[0], y + c[1], c[2], 0, 7); ctx.fill(); } }
  function drawGround() {
    // draw as filled columns so gaps read as pits
    const step = 6;
    ctx.fillStyle = '#5aa84e';
    for (let sx = -20; sx <= W + 20; sx += step) {
      const wx = cam.x + sx, gy = groundY(wx);
      if (gy > 90000) continue;   // gap → leave open (sky/pit shows through)
      const y = gy - cam.y;
      ctx.fillRect(sx, y, step + 1, H - y);
    }
    // dark chasm inside each gap so it reads as a pit to fall into
    for (const g of gaps) {
      const gx0 = s2(g.x0), gx1 = s2(g.x1); if (gx1 < -10 || gx0 > W + 10) continue;
      const topY = baseGround((g.x0 + g.x1) / 2) - cam.y;
      const grad = ctx.createLinearGradient(0, topY, 0, H); grad.addColorStop(0, '#3a2e24'); grad.addColorStop(1, '#0d0a08');
      ctx.fillStyle = grad; ctx.fillRect(gx0 - 2, topY - 2, gx1 - gx0 + 4, H - topY + 4);
    }
    // dirt + grass line
    ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 4; ctx.beginPath(); let pen = false;
    for (let sx = -20; sx <= W + 20; sx += step) { const wx = cam.x + sx, gy = groundY(wx); if (gy > 90000) { pen = false; continue; } const y = gy - cam.y; if (!pen) { ctx.moveTo(sx, y); pen = true; } else ctx.lineTo(sx, y); }
    ctx.stroke();
    // ramp shading (a wooden ramp look)
    for (const r of ramps) { const x0 = s2(r.x0), x1 = s2(r.x1); if (x1 < -40 || x0 > W + 40) continue; ctx.fillStyle = 'rgba(120,80,40,0.5)'; ctx.beginPath(); ctx.moveTo(x0, baseGround(r.x0) - cam.y); ctx.lineTo(x1, groundY(r.x1 - 1) - cam.y); ctx.lineTo(x1, baseGround(r.x1) - cam.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, baseGround(r.x0) - cam.y); ctx.lineTo(x1, groundY(r.x1 - 1) - cam.y); ctx.stroke(); }
    // gap warning stripes at the edges
    for (const g of gaps) { for (const ex of [g.x0, g.x1]) { const x = s2(ex), y = baseGround(ex) - cam.y; if (x < -20 || x > W + 20) continue; ctx.fillStyle = '#ffd23d'; ctx.fillRect(x - 3, y - 16, 6, 16); ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x - 3, y - 12, 6, 4); } }
  }
  function drawFinish() {
    const x = s2(finishX); if (x < -40 || x > W + 200) return;
    const gy = baseGround(finishX) - cam.y;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 120); ctx.stroke();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff'; ctx.fillRect(x + c * 12, gy - 120 + r * 12, 12, 12); }
    ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🏁', x + 18, gy - 128);
  }
  function drawTractor() {
    const st = stats(), sc = st.big, x = s2(tr.x), y = sy2(tr.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tr.angle); ctx.scale(sc, sc);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, RIDE_H + 4, 40, 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    wheel(-WHEEL_BASE / 2, RIDE_H - 2, WHEEL_R + 5); wheel(WHEEL_BASE / 2, RIDE_H + 2, WHEEL_R);
    ctx.fillStyle = st.body; roundRect(-30, -6, 46, 24, 4); ctx.fill();
    ctx.fillStyle = shade(st.body, -12); roundRect(-30, 8, 52, 8, 3); ctx.fill();
    ctx.fillStyle = st.cab; roundRect(-26, -30, 24, 26, 4); ctx.fill();
    ctx.fillStyle = '#bfe6ff'; roundRect(-23, -27, 18, 15, 3); ctx.fill();
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(-14, -18, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(-11, -16, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -17, 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(6, -22, 4, 16);
    ctx.fillStyle = '#ffd23d'; roundRect(14, 2, 8, 10, 2); ctx.fill();
    ctx.restore();
  }
  function wheel(wx, wy, r) {
    ctx.fillStyle = '#1c1c22'; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.arc(wx, wy, r * 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(wx, wy, r * 0.22, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; const sp = tr.x * 0.12;
    for (let i = 0; i < 4; i++) { const a = sp + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * r * 0.5, wy + Math.sin(a) * r * 0.5); ctx.stroke(); }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, amt) { let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); let r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); const t = amt < 0 ? 0 : 255, p = Math.abs(amt) / 100; r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b; return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join(''); }

  // ---------- HUD / overlays ----------
  function updateHud() {
    document.getElementById('trLevel').textContent = level;
    document.getElementById('trDist').textContent = dist;
    document.getElementById('trTarget').textContent = Math.floor(finishX / 10);
    document.getElementById('trCoins').textContent = save.coins + coins;
    const f = document.getElementById('trFuel'); if (f) f.style.width = Math.round(fuel * 100) + '%';
    const pr = document.getElementById('trProg'); if (pr) pr.style.width = clamp(tr.x / finishX * 100, 0, 100) + '%';
  }
  const toastEl = document.getElementById('toast'); let toastT = null;
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 900); }
  function hideOverlays() { for (const id of ['startScreen', 'garageScreen', 'clearScreen', 'overScreen']) document.getElementById(id).classList.add('hidden'); }
  function openGarage() { renderGarage(); document.getElementById('garageScreen').classList.remove('hidden'); }
  function renderGarage() {
    document.getElementById('garageCoins').textContent = save.coins;
    const list = document.getElementById('garageList'); list.innerHTML = '';
    const row = (emoji, name, desc, actLabel, can, fn, tag) => {
      const d = document.createElement('div'); d.className = 'shop-item';
      const action = tag ? '<span class="si-tag equipped">' + tag + '</span>' : '<button class="si-buy" ' + (can ? '' : 'disabled') + '>' + actLabel + '</button>';
      d.innerHTML = '<div class="si-emoji">' + emoji + '</div><div class="si-body"><div class="si-name">' + name + '</div><div class="si-desc">' + desc + '</div></div><div class="si-action">' + action + '</div>';
      if (fn && can) d.querySelector('.si-buy').onclick = () => { fn(); renderGarage(); updateHud(); };
      list.appendChild(d);
    };
    const head = (t) => { const h = document.createElement('div'); h.className = 'shop-section'; h.textContent = t; list.appendChild(h); };
    head('⚙️ Upgrades');
    for (const k of Object.keys(UP)) { const u = UP[k], lv = save.up[k]; const bars = '▮'.repeat(lv) + '▯'.repeat(u.max - lv); if (lv >= u.max) row(u.emoji, u.name + '  ' + bars, u.desc, '', false, null, 'MAX'); else { const c = upCost(k); row(u.emoji, u.name + '  ' + bars, u.desc, '🪙 ' + c, save.coins >= c, () => { if (save.coins >= c) { save.coins -= c; save.up[k]++; sfx.coin && sfx.coin(); persist(); } }); } }
    head('🚜 Tractors');
    for (const k of Object.keys(MODELS)) { const m = MODELS[k]; if (save.owned[k]) row(m.emoji, m.name + (m.spd > 1 ? ' ·  faster' : ''), k === save.model ? 'Currently driving.' : 'Tap to drive this one.', k === save.model ? '' : 'Select', k !== save.model, () => { save.model = k; persist(); }, k === save.model ? 'DRIVING' : null); else row(m.emoji, m.name, 'Faster top speed & pull.', '🪙 ' + m.cost, save.coins >= m.cost, () => { if (save.coins >= m.cost) { save.coins -= m.cost; save.owned[k] = true; save.model = k; persist(); } }); }
  }
  document.getElementById('trPlay').onclick = () => startLevel(save.bestLevel || 1);
  document.getElementById('trAgain').onclick = () => startLevel(level);
  document.getElementById('trNext').onclick = () => startLevel(level + 1);
  document.getElementById('trGarageBtn').onclick = () => { ensureAudio(); openGarage(); };
  document.getElementById('trGarage2').onclick = openGarage;
  document.getElementById('trGarage3').onclick = openGarage;
  document.getElementById('garageClose').onclick = () => { document.getElementById('garageScreen').classList.add('hidden'); if (!running && document.getElementById('clearScreen').classList.contains('hidden') && document.getElementById('overScreen').classList.contains('hidden')) document.getElementById('startScreen').classList.remove('hidden'); };

  // ---------- loop ----------
  let lastT = performance.now(), lastErr = null;
  function frame(now) { let dt = (now - lastT) / 16.6667; lastT = now; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1 || location.search.indexOf('debug') !== -1) {
    window.__tractor = {
      startLevel, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      hold(k, v) { input[k] = v; },
      info() { return { running, level, dist, target: Math.floor(finishX / 10), coins, savedCoins: save.coins, fuel: +fuel.toFixed(2), x: tr.x | 0, y: tr.y | 0, vx: +tr.vx.toFixed(2), onGround: tr.onGround, angle: +tr.angle.toFixed(2), spin: +(tr.spin || 0).toFixed(2), airTime: +(tr.airTime || 0).toFixed(0), flipCount, bestLevel: save.bestLevel, gaps: gaps.length, ramps: ramps.length }; },
      addCoins(n) { save.coins += (n || 1000); persist(); }, buyUp(k) { if (save.up[k] < UP[k].max) { save.coins -= upCost(k); save.up[k]++; persist(); } }, stats,
      lastErr() { return lastErr ? String(lastErr.stack || lastErr) : null; },
    };
  }
})();
