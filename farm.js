/* =====================================================================
   EWE BEAUTY FARMING Co — a build-it-up sheep farm starring Woofa.
   Raise sheep → wool + lambs (neglect = death). Shear → sell → run the farm.
   Guard dogs & a tractor herd the flock; build pens with gates to round them
   up; foxes slip under fences so keep Woofa on them. Angled 2.5D view.
   Saves + grows offline. Vanilla canvas, built to expand.
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
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); layout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('load', resize);

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const nowMs = () => Date.now();
  const closestOnSeg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1; let t = ((px - x1) * dx + (py - y1) * dy) / l2; t = clamp(t, 0, 1); return { x: x1 + t * dx, y: y1 + t * dy }; };

  // ---------- data ----------
  const SAVE_KEY = 'ewe_beauty_v1';
  const FEED_COST = 8, WATER_COST = 3, PEN_COST = 120, GATE_W = 48;
  const BREEDS = {
    normal: { name: 'Ewe', mult: 1, cost: 55, wool: '#f4f3ee', lvl: 1 },
    merino: { name: 'Merino', mult: 1.9, cost: 240, wool: '#efe7d2', lvl: 2 },
    golden: { name: 'Golden', mult: 4.2, cost: 1400, wool: '#ffd24a', lvl: 4 },
    black: { name: 'Black', mult: 6.5, cost: 2800, wool: '#3a3640', lvl: 5 },
  };
  const DOGS = {
    woofa: { name: 'Woofa', kind: 'woofa', cost: 0, bonus: 0.0, desc: 'Your loyal good boy. Herds the flock and chases off foxes.' },
    winnie: { name: 'Winnie', kind: 'poodle', cost: 1600, bonus: 0.12, desc: 'Fluffy miniature poodle. +12% wool growth and another set of eyes on the foxes.' },
    tia: { name: 'Tia', kind: 'schnauzer', cost: 3400, bonus: 0.18, desc: 'Sharp miniature schnauzer. +18% wool growth and a fierce fox-chaser.' },
  };

  const defaultSave = () => ({
    money: 90, wool: 0, feed: 60, water: 60,
    sheep: [{ breed: 'normal', role: 'ewe', wool: 25 }, { breed: 'normal', role: 'ewe', wool: 10 }, { breed: 'normal', role: 'ram', wool: 15 }],
    sheepCap: 6, farmLevel: 1, power: 'none',
    dogs: { woofa: true }, upgrades: { tractor: false }, pens: [], lastTime: nowMs(),
  });

  let F = null;
  const sheep = [], dogs = [], foxes = [], fluff = [];
  let tractor = null, paddock = {}, feedTrough = {}, waterTrough = {}, shed = {};
  let running = false, tick = 0, breedTimer = 900, foxTimer = 900;
  let placing = null; // a pen being positioned by the finger

  function layout() {
    const top = 168, bot = 150, mx = 18;
    paddock = { x: mx, y: top, w: W - mx * 2, h: H - top - bot };
    feedTrough = { x: paddock.x + paddock.w * 0.24, y: paddock.y + paddock.h - 30 };
    waterTrough = { x: paddock.x + paddock.w * 0.6, y: paddock.y + paddock.h - 30 };
    shed = { x: paddock.x + paddock.w - 66, y: paddock.y + 6 };
  }

  // ---------- 2.5D depth ----------
  function dscale(y) { return 0.72 + 0.5 * clamp((y - paddock.y) / paddock.h, 0, 1); }

  // ---------- factories ----------
  function makeSheep(o = {}) {
    return {
      x: o.x != null ? o.x : rand(paddock.x + 40, paddock.x + paddock.w - 40),
      y: o.y != null ? o.y : rand(paddock.y + 40, paddock.y + paddock.h - 60),
      breed: o.breed || 'normal', role: o.role || 'ewe', tx: 0, ty: 0, moveT: 0,
      hunger: o.hunger != null ? o.hunger : rand(10, 35), thirst: o.thirst != null ? o.thirst : rand(10, 35),
      wool: o.wool != null ? o.wool : rand(0, 30), size: o.role === 'lamb' ? 0.4 : (o.size != null ? o.size : 0.85),
      age: o.role === 'lamb' ? 0 : 999, health: 100, starve: 0, baaT: 0, face: rand(0, 6), breedCD: rand(400, 900),
    };
  }
  function makeDog(kind) { return { kind, x: rand(paddock.x + 60, paddock.x + paddock.w - 60), y: rand(paddock.y + 40, paddock.y + paddock.h - 40), tx: 0, ty: 0, moveT: 0, zoom: 0, facing: 1 }; }
  function makeTractor() { return { x: paddock.x + 50, y: paddock.y + 50, tx: 0, ty: 0, facing: 1, zoom: 0 }; }
  function rebuildDogs() { dogs.length = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) dogs.push(makeDog(DOGS[k].kind)); }
  function dogBonus() { let b = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) b += DOGS[k].bonus; return b; }

  // pen fence segments (skip the gate gap when open)
  function penWalls(p) {
    const gx = p.x + p.w / 2, gw = GATE_W;
    const w = [];
    w.push([p.x, p.y, p.x + p.w, p.y]);                 // top
    w.push([p.x, p.y, p.x, p.y + p.h]);                 // left
    w.push([p.x + p.w, p.y, p.x + p.w, p.y + p.h]);     // right
    w.push([p.x, p.y + p.h, gx - gw / 2, p.y + p.h]);   // bottom-left of gate
    w.push([gx + gw / 2, p.y + p.h, p.x + p.w, p.y + p.h]); // bottom-right of gate
    if (!p.gateOpen) w.push([gx - gw / 2, p.y + p.h, gx + gw / 2, p.y + p.h]); // gate closed
    return w;
  }
  function repelFromPens(e, buffer) {
    if (!F.pens) return;
    for (const p of F.pens) for (const seg of penWalls(p)) {
      const c = closestOnSeg(e.x, e.y, seg[0], seg[1], seg[2], seg[3]);
      const d = dist(e.x, e.y, c.x, c.y);
      if (d < buffer && d > 0.001) { const push = buffer - d; e.x += (e.x - c.x) / d * push; e.y += (e.y - c.y) / d * push; }
    }
  }

  // ---------- persistence + offline ----------
  function load() { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return defaultSave(); return Object.assign(defaultSave(), JSON.parse(r)); } catch (e) { return defaultSave(); } }
  function persist() { if (!F) return; F.lastTime = nowMs(); F.sheep = sheep.map(s => ({ breed: s.breed, role: s.role, wool: s.wool, hunger: s.hunger, thirst: s.thirst, size: s.size, age: s.age })); try { localStorage.setItem(SAVE_KEY, JSON.stringify(F)); } catch (e) {} }

  function startGame() {
    F = load(); layout();
    sheep.length = 0;
    for (const sd of (F.sheep || [])) sheep.push(makeSheep(sd));
    while (sheep.length < 3) sheep.push(makeSheep({ role: sheep.length === 2 ? 'ram' : 'ewe' }));
    if (!F.pens) F.pens = [];
    rebuildDogs();
    tractor = F.upgrades && F.upgrades.tractor ? makeTractor() : null;
    applyOffline(); running = true; hideOverlays(); updateHud();
  }
  function applyOffline() {
    const el = clamp((nowMs() - (F.lastTime || nowMs())) / 1000, 0, 8 * 3600); if (el < 30) return;
    const fed = F.feed > 5, watered = F.water > 5, rate = 0.32 * (fed ? 1 : 0.4) * (watered ? 1 : 0.6) * (1 + dogBonus());
    let grew = 0; for (const s of sheep) { const add = Math.min(rate * el, 100 - s.wool); s.wool += add; grew += add; }
    F.feed = clamp(F.feed - el * 0.02, 0, 100); F.water = clamp(F.water - el * 0.02, 0, 100);
    if (grew > 5) setTimeout(() => toast('🧺 Your flock grew wool while you were away!'), 400);
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  function nearGate(p, x, y) { const gx = p.x + p.w / 2, gy = p.y + p.h; return Math.abs(x - gx) < GATE_W / 2 + 8 && Math.abs(y - gy) < 22; }
  function insidePen(p, x, y) { return x > p.x - 6 && x < p.x + p.w + 6 && y > p.y - 6 && y < p.y + p.h + 6; }

  function onDown(e) {
    if (!running) return; e.preventDefault && e.preventDefault();
    const p = pt(e);
    if (placing) { placing = null; toast('Pen placed'); persist(); return; }        // drop the pen
    for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb' && dist(p.x, p.y, s.x, s.y - 6) < 30) { shearSheep(s); return; }
    for (const pen of F.pens) if (nearGate(pen, p.x, p.y)) { pen.gateOpen = !pen.gateOpen; toast(pen.gateOpen ? 'Gate opened' : 'Gate closed'); persist(); return; }
    for (const pen of F.pens) if (insidePen(pen, p.x, p.y) && (Math.abs(p.x - pen.x) < 10 || Math.abs(p.x - (pen.x + pen.w)) < 10 || Math.abs(p.y - pen.y) < 10)) { placing = pen; return; } // grab a fence edge to move
    herdTo(p.x, p.y);  // send tractor + dogs to round up here
  }
  function onMove(e) { if (placing) { const p = pt(e); placing.x = clamp(p.x - placing.w / 2, paddock.x + 4, paddock.x + paddock.w - placing.w - 4); placing.y = clamp(p.y - placing.h / 2, paddock.y + 4, paddock.y + paddock.h - placing.h - 4); } }
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (placing) e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', (e) => { if (placing) onMove(e); });

  function herdTo(x, y) {
    x = clamp(x, paddock.x + 16, paddock.x + paddock.w - 16); y = clamp(y, paddock.y + 16, paddock.y + paddock.h - 16);
    for (const d of dogs) { d.tx = x + rand(-16, 16); d.ty = y + rand(-12, 12); d.moveT = 80; d.zoom = 1; }
    if (tractor) { tractor.tx = x; tractor.ty = y; tractor.zoom = 1; }
  }
  function shearSheep(s) {
    const val = Math.max(1, Math.round((5 + s.size * 4 + s.health / 30) * BREEDS[s.breed].mult));
    F.wool += val; s.wool = 0; s.baaT = 40; spawnFluff(s.x, s.y);
    toast('✂️ +' + val + ' wool' + (s.breed !== 'normal' ? ' (' + BREEDS[s.breed].name + '!)' : '')); persist(); updateHud();
  }
  function spawnFluff(x, y, c) { for (let i = 0; i < 10; i++) fluff.push({ x, y, vx: rand(-2, 2), vy: rand(-3, -0.5), life: 1, r: rand(3, 6), c: c || '#f4f3ee' }); }

  // ---------- update ----------
  function update(dt) {
    if (!running || !F) return;
    tick += dt;
    const fed = F.feed > 0, watered = F.water > 0;
    if (F.power === 'economical') { F.water = clamp(F.water + 0.05 * dt, 0, 80); if (F.feed < 40) F.feed = clamp(F.feed + 0.03 * dt, 0, 100); }
    else if (F.power === 'electric') { if (F.money > 0) { F.feed = clamp(F.feed + 0.16 * dt, 0, 100); F.water = clamp(F.water + 0.16 * dt, 0, 100); F.money = Math.max(0, F.money - 0.04 * dt); } }

    for (let i = sheep.length - 1; i >= 0; i--) {
      const s = sheep[i]; const ox = s.x, oy = s.y;
      s.hunger = clamp(s.hunger + 0.011 * dt, 0, 100); s.thirst = clamp(s.thirst + 0.009 * dt, 0, 100);
      s.health = clamp(100 - Math.max(0, s.hunger - 55) * 1.3 - Math.max(0, s.thirst - 55) * 1.3, 0, 100);
      if (s.hunger >= 100 || s.thirst >= 100) s.starve += dt; else s.starve = Math.max(0, s.starve - dt * 0.5);
      if (s.starve > 360) { sheep.splice(i, 1); toast('💀 A sheep died! Keep them fed and watered.'); persist(); updateHud(); continue; }
      if (s.role !== 'lamb') {
        const rate = 0.03 * (fed ? 1 : 0.35) * (watered ? 1 : 0.6) * (0.5 + s.health / 200) * (1 + dogBonus());
        s.wool = clamp(s.wool + rate * dt, 0, 100);
        if (fed && s.size < 1) s.size = clamp(s.size + 0.00016 * dt, 0.85, 1);
      } else { s.age += dt; if (s.age > 650) { s.role = Math.random() < 0.5 ? 'ram' : 'ewe'; s.size = 0.85; toast('🐑 A lamb grew up!'); } }
      if (s.baaT > 0) s.baaT -= dt; s.breedCD -= dt;

      s.moveT -= dt; let fleeing = false;
      for (const fx of foxes) if (dist(s.x, s.y, fx.x, fx.y) < 80) { const a = Math.atan2(s.y - fx.y, s.x - fx.x); s.tx = s.x + Math.cos(a) * 130; s.ty = s.y + Math.sin(a) * 130; s.moveT = 20; fleeing = true; }
      // flee the tractor (it herds)
      if (tractor && dist(s.x, s.y, tractor.x, tractor.y) < 78) { const a = Math.atan2(s.y - tractor.y, s.x - tractor.x); s.tx = s.x + Math.cos(a) * 120; s.ty = s.y + Math.sin(a) * 120; s.moveT = 24; fleeing = true; }
      if (!fleeing && s.hunger > 55 && F.feed > 0) { s.tx = feedTrough.x + rand(-14, 14); s.ty = feedTrough.y - 12; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && s.thirst > 55 && F.water > 0) { s.tx = waterTrough.x + rand(-14, 14); s.ty = waterTrough.y - 12; }
      else if (!fleeing && s.moveT <= 0) { s.tx = rand(paddock.x + 30, paddock.x + paddock.w - 30); s.ty = rand(paddock.y + 30, paddock.y + paddock.h - 40); s.moveT = rand(40, 120); }
      const spd = fleeing ? 2.7 : (s.role === 'lamb' ? 1 : 0.7);
      const a = Math.atan2(s.ty - s.y, s.tx - s.x);
      if (dist(s.x, s.y, s.tx, s.ty) > 4) { s.x = clamp(s.x + Math.cos(a) * spd * dt, paddock.x + 20, paddock.x + paddock.w - 20); s.y = clamp(s.y + Math.sin(a) * spd * dt, paddock.y + 24, paddock.y + paddock.h - 24); }
      repelFromPens(s, 13); // fences block sheep (gate lets them through)
      s.x = clamp(s.x, paddock.x + 20, paddock.x + paddock.w - 20); s.y = clamp(s.y, paddock.y + 24, paddock.y + paddock.h - 24);

      if (F.feed > 0 && s.hunger > 12 && dist(s.x, s.y, feedTrough.x, feedTrough.y) < 44) { s.hunger = clamp(s.hunger - 0.3 * dt, 0, 100); F.feed = clamp(F.feed - 0.02 * dt, 0, 100); }
      if (F.water > 0 && s.thirst > 12 && dist(s.x, s.y, waterTrough.x, waterTrough.y) < 44) { s.thirst = clamp(s.thirst - 0.3 * dt, 0, 100); F.water = clamp(F.water - 0.015 * dt, 0, 100); }
      void ox; void oy;
    }

    breedTimer -= dt;
    if (breedTimer <= 0) {
      breedTimer = rand(700, 1300);
      const rams = sheep.filter(s => s.role === 'ram' && s.health > 60), ewes = sheep.filter(s => s.role === 'ewe' && s.health > 60 && s.breedCD <= 0);
      if (rams.length && ewes.length && sheep.length < F.sheepCap) { const mum = ewes[(Math.random() * ewes.length) | 0]; mum.breedCD = rand(1200, 2000); sheep.push(makeSheep({ x: mum.x + rand(-10, 10), y: mum.y + 14, breed: mum.breed, role: 'lamb' })); toast('💕 A lamb was born!'); persist(); updateHud(); }
    }

    foxTimer -= dt;
    if (foxTimer <= 0 && sheep.length > 0 && foxes.length < 2) { foxTimer = rand(1400, 2600) / (1 + (F.farmLevel - 1) * 0.35); const edge = Math.random() < 0.5; foxes.push({ x: edge ? paddock.x + 6 : paddock.x + paddock.w - 6, y: rand(paddock.y + 20, paddock.y + paddock.h - 20), fleeing: false }); }
    for (let i = foxes.length - 1; i >= 0; i--) {
      const fx = foxes[i]; let chased = false;
      for (const d of dogs) if (dist(d.x, d.y, fx.x, fx.y) < 95) chased = true;
      if (chased) fx.fleeing = true;
      let tx, ty;
      if (fx.fleeing) { tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x - 40 : paddock.x + paddock.w + 40; ty = fx.y; }
      else { let best = null, bd = 1e9; for (const s of sheep) { const dd = dist(fx.x, fx.y, s.x, s.y); if (dd < bd) { bd = dd; best = s; } } if (best) { tx = best.x; ty = best.y; if (bd < 16) { const idx = sheep.indexOf(best); if (idx >= 0) { sheep.splice(idx, 1); toast('🦊 A fox took a sheep! Get more guard dogs.'); persist(); updateHud(); } fx.fleeing = true; } } else { fx.fleeing = true; tx = fx.x; ty = fx.y; } }
      const a = Math.atan2(ty - fx.y, tx - fx.x), sp = fx.fleeing ? 3.2 : 1.6;
      fx.x += Math.cos(a) * sp * dt; fx.y += Math.sin(a) * sp * dt; fx.facing = Math.cos(a) >= 0 ? 1 : -1; // foxes slip under fences (no pen collision)
      if (fx.fleeing && (fx.x < paddock.x - 30 || fx.x > paddock.x + paddock.w + 30)) foxes.splice(i, 1);
    }

    for (const d of dogs) {
      d.moveT -= dt; if (d.zoom > 0) d.zoom -= 0.01 * dt;
      let target = null; if (foxes.length) { let bd = 1e9; for (const fx of foxes) { const dd = dist(d.x, d.y, fx.x, fx.y); if (dd < bd) { bd = dd; target = fx; } } }
      if (target) { d.tx = target.x; d.ty = target.y; d.zoom = Math.max(d.zoom, 0.6); }
      else if (d.moveT <= 0) { d.tx = rand(paddock.x + 40, paddock.x + paddock.w - 40); d.ty = rand(paddock.y + 30, paddock.y + paddock.h - 30); d.moveT = rand(60, 160); }
      const sp = d.zoom > 0 ? 3.5 : 1.3, a = Math.atan2(d.ty - d.y, d.tx - d.x);
      if (dist(d.x, d.y, d.tx, d.ty) > 5) { d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt; d.facing = Math.cos(a) >= 0 ? 1 : -1; }
    }
    if (tractor) {
      if (tractor.zoom > 0) tractor.zoom -= 0.006 * dt;
      if (tractor.tx || tractor.ty) { const a = Math.atan2(tractor.ty - tractor.y, tractor.tx - tractor.x); if (dist(tractor.x, tractor.y, tractor.tx, tractor.ty) > 6) { tractor.x = clamp(tractor.x + Math.cos(a) * 2.4 * dt, paddock.x + 16, paddock.x + paddock.w - 16); tractor.y = clamp(tractor.y + Math.sin(a) * 2.4 * dt, paddock.y + 16, paddock.y + paddock.h - 16); tractor.facing = Math.cos(a) >= 0 ? 1 : -1; } }
    }

    for (let i = fluff.length - 1; i >= 0; i--) { const p = fluff[i]; p.vy += 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) fluff.splice(i, 1); }
    if ((tick | 0) % 30 === 0) { updateHud(); persist(); }
  }

  // ---------- render ----------
  function render() {
    ctx.fillStyle = '#0c1a12'; ctx.fillRect(0, 0, W, H);
    if (!F) return;
    // sky + distant hills (the "angle" horizon)
    const sky = ctx.createLinearGradient(0, 0, 0, paddock.y + 20); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#e8f6ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, paddock.y);
    ctx.fillStyle = '#6fae5e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, paddock.y - 20 - Math.sin(x / 130) * 16); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c9c4e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 80) ctx.lineTo(x, paddock.y - 8 - Math.cos(x / 90) * 10); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.font = '18px system-ui'; ctx.fillText('☁️', W * 0.2, 40); ctx.fillText('☁️', W * 0.7, 62); ctx.globalAlpha = 1;

    // ground: dirt border + grass with a far→near gradient for depth
    ctx.fillStyle = '#5a3f24'; ctx.fillRect(paddock.x - 9, paddock.y - 9, paddock.w + 18, paddock.h + 18);
    const g = ctx.createLinearGradient(0, paddock.y, 0, paddock.y + paddock.h); g.addColorStop(0, '#3f8a42'); g.addColorStop(1, '#57ab4d');
    ctx.fillStyle = g; ctx.fillRect(paddock.x, paddock.y, paddock.w, paddock.h);
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; for (let i = 0; i < 12; i++) { const yy = paddock.y + (i / 12) * paddock.h; ctx.fillRect(paddock.x, yy, paddock.w, 2 + i * 0.5); }
    drawFence(paddock.x, paddock.y, paddock.w, paddock.h, true);

    if (F.power === 'economical') drawWaterWheel();
    drawTrough(feedTrough, '#d9b24a', F.feed); drawTrough(waterTrough, '#4cc9ff', F.water); drawShed(shed);
    for (const p of F.pens) drawPen(p);
    if (placing) { ctx.globalAlpha = 0.5; drawPen(placing); ctx.globalAlpha = 1; }

    // depth-sorted actors
    const actors = [];
    for (const s of sheep) actors.push({ y: s.y, d: () => drawSheep(s) });
    for (const fx of foxes) actors.push({ y: fx.y, d: () => drawFox(fx) });
    for (const d of dogs) actors.push({ y: d.y, d: () => drawDog(d) });
    if (tractor) actors.push({ y: tractor.y, d: () => drawTractor(tractor) });
    actors.sort((a, b) => a.y - b.y); for (const a of actors) a.d();

    for (const p of fluff) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  }

  function shadow(x, y, r) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawFence(x, y, w, h, thick) {
    ctx.strokeStyle = '#caa06a'; ctx.lineWidth = thick ? 5 : 3; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#b98d55'; const step = 46; for (let px = x; px <= x + w; px += step) { ctx.fillRect(px - 2, y - 7, 4, h + 14); }
  }
  function drawPen(p) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
    const gx = p.x + p.w / 2;
    // draw all edges except gate gap
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.lineTo(p.x + p.w, p.y + p.h); ctx.lineTo(gx + GATE_W / 2, p.y + p.h);
    ctx.moveTo(gx - GATE_W / 2, p.y + p.h); ctx.lineTo(p.x, p.y + p.h); ctx.lineTo(p.x, p.y); ctx.stroke();
    // posts
    ctx.fillStyle = '#6a4f28'; for (let px = p.x; px <= p.x + p.w; px += 28) { ctx.fillRect(px - 1.5, p.y - 5, 3, p.h + 10); }
    // gate
    ctx.strokeStyle = p.gateOpen ? '#58e08a' : '#c86a3a'; ctx.lineWidth = 4;
    if (p.gateOpen) { ctx.beginPath(); ctx.moveTo(gx - GATE_W / 2, p.y + p.h); ctx.lineTo(gx - GATE_W / 2 - 14, p.y + p.h - 20); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(gx - GATE_W / 2, p.y + p.h); ctx.lineTo(gx + GATE_W / 2, p.y + p.h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.gateOpen ? 'gate open' : 'tap gate', gx, p.y + p.h + 14);
  }
  function drawTrough(t, col, level) {
    const sc = dscale(t.y); ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc);
    ctx.fillStyle = '#7a5a3a'; roundRect(-22, -8, 44, 16, 4); ctx.fill();
    ctx.fillStyle = col; roundRect(-19, -6 + (12 - level / 100 * 12), 38, level / 100 * 12, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; roundRect(-22, -8, 44, 16, 4); ctx.stroke(); ctx.restore();
  }
  function drawWaterWheel() { const wx = paddock.x + 24, wy = paddock.y + 30, r = 18, ang = tick / 40; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.stroke(); ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = ang + i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.stroke(); } }
  function drawShed(sh) { const sc = dscale(sh.y); ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sc, sc); ctx.fillStyle = '#b04a3a'; ctx.fillRect(0, 14, 52, 34); ctx.fillStyle = '#7a2f28'; ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(26, -2); ctx.lineTo(56, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(18, 28, 16, 20); ctx.restore(); }

  function drawSheep(s) {
    const B = BREEDS[s.breed], sc = dscale(s.y), ready = s.wool >= 100 && s.role !== 'lamb';
    const fluffR = (11 + s.wool / 100 * 8) * (0.55 + s.size * 0.5) * sc, bob = Math.sin(tick / 10 + s.face) * 1.2 + (s.baaT > 0 ? -2 : 0);
    shadow(s.x, s.y + fluffR * 0.55, fluffR);
    ctx.strokeStyle = '#3a3238'; ctx.lineWidth = 2.5 * sc;
    for (const lx of [-fluffR * 0.5, fluffR * 0.5]) { ctx.beginPath(); ctx.moveTo(s.x + lx, s.y + fluffR * 0.3); ctx.lineTo(s.x + lx, s.y + fluffR * 0.7); ctx.stroke(); }
    ctx.fillStyle = s.health > 40 ? B.wool : '#cfc9bf';
    if (s.wool > 25) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * fluffR * 0.55, s.y + bob + Math.sin(a) * fluffR * 0.45, fluffR * 0.5, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(s.x, s.y + bob, fluffR, fluffR * 0.8, 0, 0, 7); ctx.fill();
    if (s.breed === 'golden') { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.3, s.y + bob - fluffR * 0.3, fluffR * 0.35, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = s.breed === 'black' ? '#1c1a20' : '#3a3238'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.7, s.y + bob + 2, fluffR * 0.42, fluffR * 0.5, -0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.85, s.y + bob, 1.7 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c262b'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.55, s.y + bob - 4, 3 * sc, 5 * sc, -0.5, 0, 7); ctx.fill();
    if (s.role === 'ram') { ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.7, s.y + bob - 4, 5 * sc, Math.PI * 0.2, Math.PI * 1.4); ctx.stroke(); }
    ctx.textAlign = 'center';
    if (ready) { ctx.font = (15 * sc) + 'px system-ui'; ctx.fillText('✂️', s.x, s.y - fluffR - 12 + Math.sin(tick / 6) * 2); }
    if (s.baaT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 11px system-ui'; ctx.fillText('baa!', s.x + fluffR, s.y + bob - fluffR); }
    if (s.health < 40) { ctx.font = '13px system-ui'; ctx.fillText(s.hunger > s.thirst ? '🌾' : '💧', s.x, s.y - fluffR - 10); }
  }
  function drawFox(fx) { const sc = dscale(fx.y), f = fx.facing || 1; ctx.save(); ctx.translate(fx.x, fx.y); ctx.scale(f * sc, sc); shadowLocal(0, 7, 12); ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-20, -6); ctx.lineTo(-11, 3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-17, -4); ctx.lineTo(-19, -2); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.arc(11, -2, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -6); ctx.lineTo(11, -12); ctx.lineTo(13, -6); ctx.fill(); ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(14, -11); ctx.lineTo(16, -5); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(16, -2, 1.3, 0, 7); ctx.fill(); ctx.restore(); }
  function drawDog(d) {
    const sc = dscale(d.y), f = d.facing || 1; ctx.save(); ctx.translate(d.x, d.y); ctx.scale(f * sc, sc); shadowLocal(0, 8, 12);
    if (d.kind === 'woofa') { ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.ellipse(-3, 5, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(13, -2, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -2, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#f3f1ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-15, -6); ctx.stroke(); }
    else if (d.kind === 'poodle') { ctx.fillStyle = '#f2ead8'; for (const p of [[0, 0, 9], [10, -3, 6], [-8, -2, 5], [0, -6, 5]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); } ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(13, -3, 1.3, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#d8dade'; ctx.beginPath(); ctx.ellipse(13, 1, 3.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -3, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawTractor(t) {
    const sc = dscale(t.y), f = t.facing || 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(f * sc, sc); shadowLocal(0, 12, 20);
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-9, 8, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 5, 0, 7); ctx.fill(); // wheels
    ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(-9, 8, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#3aa64a'; roundRect(-14, -6, 26, 14, 3); ctx.fill();               // body
    ctx.fillStyle = '#2f8a3c'; roundRect(-2, -18, 12, 14, 3); ctx.fill();               // cab
    ctx.fillStyle = '#bfe6ff'; roundRect(0, -15, 8, 8, 2); ctx.fill();                  // window
    ctx.fillStyle = '#333'; ctx.fillRect(-13, -14, 3, 8);                               // exhaust
    ctx.restore();
  }
  function shadowLocal(x, y, r) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- HUD + actions ----------
  const el = (id) => document.getElementById(id);
  function woolPrice() { return 3 + (F.farmLevel - 1) * 2; }
  function updateHud() { if (!F) return; el('fMoney').textContent = '💰 ' + Math.floor(F.money); el('fWool').textContent = '🧺 ' + Math.floor(F.wool); el('fSheep').textContent = '🐑 ' + sheep.length + '/' + F.sheepCap; el('fLevel').textContent = 'Lv ' + F.farmLevel; el('feedBar').style.height = F.feed + '%'; el('waterBar').style.height = F.water + '%'; el('sellVal').textContent = '$' + Math.floor(F.wool * woolPrice()); }
  const toastEl = el('toast');
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.style.color = '#fff'; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }
  function refillFeed() { if (F.money < FEED_COST) return toast('Not enough money'); F.money -= FEED_COST; F.feed = clamp(F.feed + 55, 0, 100); persist(); updateHud(); }
  function refillWater() { if (F.money < WATER_COST) return toast('Not enough money'); F.money -= WATER_COST; F.water = clamp(F.water + 65, 0, 100); persist(); updateHud(); }
  function sellWool() { if (F.wool < 1) return toast('No wool — shear the fluffy (✂️) sheep first!'); const got = Math.floor(F.wool * woolPrice()); F.money += got; F.wool = 0; toast('💰 Sold wool for $' + got); persist(); updateHud(); }
  el('btnFeed').onclick = refillFeed; el('btnWater').onclick = refillWater; el('btnSell').onclick = sellWool; el('btnShop').onclick = openShop; el('farmPlay').onclick = startGame; el('shopClose').onclick = closeShop;

  // ---------- shop ----------
  const startScreen = el('startScreen'), shopScreen = el('shopScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); }
  function openShop() { if (!F) return; renderShop(); shopScreen.classList.remove('hidden'); }
  function closeShop() { shopScreen.classList.add('hidden'); }
  function sheepCost(b) { return Math.round(BREEDS[b].cost + (b === 'normal' ? sheep.length * 18 : 0)); }
  function expandCost() { return Math.round(240 * F.farmLevel); }

  function renderShop() {
    el('shopMoney').textContent = Math.floor(F.money);
    const list = el('shopList'); list.innerHTML = ''; const rows = [];
    for (const b of ['normal', 'merino', 'golden', 'black']) { const B = BREEDS[b], locked = F.farmLevel < B.lvl, full = sheep.length >= F.sheepCap, c = sheepCost(b);
      rows.push({ emoji: b === 'black' ? '🖤' : b === 'golden' ? '⭐' : '🐑', name: 'Buy ' + B.name + ' Sheep', desc: locked ? 'Unlocks at farm Lv ' + B.lvl + '.' : (b === 'black' ? 'Priciest of all — wool sells for 6.5×. (There\'s a lesson in that.)' : 'Wool value ×' + B.mult + '.'), act: locked ? { tag: 'Lv ' + B.lvl } : full ? { tag: 'Full' } : { label: '$' + c, fn: () => buySheep(b), afford: F.money >= c } }); }
    rows.push({ emoji: '🚜', name: 'Buy a Tractor', desc: F.upgrades.tractor ? 'Owned — tap the field to drive it and round up the flock.' : 'Drive it round to herd sheep into your pens. Tap the field to send it.', act: F.upgrades.tractor ? { tag: 'Owned' } : { label: '$650', fn: buyTractor, afford: F.money >= 650 } });
    rows.push({ emoji: '🚧', name: 'Build a Pen', desc: 'Drops a fenced pen — drag it where you want, tap the gate to open/close. Round sheep in! (Foxes still slip under.)', act: { label: '$' + PEN_COST, fn: buyPen, afford: F.money >= PEN_COST } });
    rows.push({ emoji: '🚜', name: 'Expand the Farm', desc: 'Bigger paddock, +4 sheep cap, +wool price (Lv ' + F.farmLevel + '→' + (F.farmLevel + 1) + ').', act: { label: '$' + expandCost(), fn: buyExpand, afford: F.money >= expandCost() } });
    rows.push({ emoji: '💧', name: 'Economical Power (water wheel)', desc: F.power === 'economical' ? 'Running — slow, steady, cheap.' : 'Slowly tops up water & a bit of feed. Cheap to run.', act: F.power === 'economical' ? { tag: 'Running' } : { label: '$180', fn: () => buyPower('economical'), afford: F.money >= 180 } });
    rows.push({ emoji: '⚡', name: 'Electric Power', desc: F.power === 'electric' ? 'Running — fast, but electricity costs money.' : 'Auto-tops feed & water FAST — but the power bill nibbles your money.', act: F.power === 'electric' ? { tag: 'Running' } : { label: '$340', fn: () => buyPower('electric'), afford: F.money >= 340 } });
    for (const k of ['winnie', 'tia']) { const d = DOGS[k]; rows.push({ emoji: k === 'winnie' ? '🐩' : '🦴', name: d.name + (k === 'winnie' ? ' (poodle)' : ' (schnauzer)'), desc: d.desc, act: F.dogs[k] ? { tag: 'Owned' } : { label: '$' + d.cost, fn: () => buyDog(k), afford: F.money >= d.cost } }); }
    for (const r of rows) { const div = document.createElement('div'); div.className = 'shop-item';
      const action = r.act.tag ? '<span class="si-tag ' + (r.act.tag === 'Owned' || r.act.tag === 'Running' ? 'equipped' : 'lockmsg') + '">' + r.act.tag + '</span>' : '<button class="si-buy" ' + (r.act.afford ? '' : 'disabled') + '>' + r.act.label + '</button>';
      div.innerHTML = '<div class="si-emoji">' + r.emoji + '</div><div class="si-body"><div class="si-name">' + r.name + '</div><div class="si-desc">' + r.desc + '</div></div><div class="si-action">' + action + '</div>';
      if (r.act.fn && r.act.afford) div.querySelector('.si-buy').onclick = () => { r.act.fn(); renderShop(); updateHud(); }; list.appendChild(div); }
  }
  function buySheep(b) { const c = sheepCost(b); if (F.money < c || sheep.length >= F.sheepCap) return; F.money -= c; sheep.push(makeSheep({ breed: b, role: Math.random() < 0.4 ? 'ram' : 'ewe', wool: 0 })); toast('🐑 New ' + BREEDS[b].name + '!'); persist(); }
  function buyExpand() { const c = expandCost(); if (F.money < c) return; F.money -= c; F.farmLevel++; F.sheepCap += 4; toast('🚜 Farm expanded! New breeds & tougher foxes ahead.'); persist(); }
  function buyPower(m) { const cost = m === 'electric' ? 340 : 180; if (F.money < cost) return; F.money -= cost; F.power = m; toast('Power set to ' + m); persist(); }
  function buyDog(k) { const d = DOGS[k]; if (F.money < d.cost || F.dogs[k]) return; F.money -= d.cost; F.dogs[k] = true; rebuildDogs(); toast('🐾 ' + d.name + ' joined the farm!'); persist(); }
  function buyTractor() { if (F.money < 650 || F.upgrades.tractor) return; F.money -= 650; F.upgrades.tractor = true; tractor = makeTractor(); toast('🚜 Tractor delivered! Tap the field to drive it.'); persist(); }
  function buyPen() { if (F.money < PEN_COST) return; F.money -= PEN_COST; const pen = { x: paddock.x + paddock.w / 2 - 60, y: paddock.y + paddock.h / 2 - 45, w: 120, h: 90, gateOpen: true }; F.pens.push(pen); placing = pen; closeShop(); toast('🚧 Drag the pen into place, then tap to drop it.'); persist(); }

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(nt) { let dt = (nt - lastT) / 16.6667; lastT = nt; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { /* keep the loop alive */ } requestAnimationFrame(frame); }
  window.addEventListener('beforeunload', persist);
  resize(); requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__farm = {
      start: startGame, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return F ? { running, money: Math.floor(F.money), wool: Math.floor(F.wool), sheep: sheep.length, cap: F.sheepCap, feed: Math.floor(F.feed), water: Math.floor(F.water), level: F.farmLevel, power: F.power, dogs: Object.keys(F.dogs).filter(k => F.dogs[k]), tractor: !!tractor, pens: F.pens.length, foxes: foxes.length, lambs: sheep.filter(s => s.role === 'lamb').length } : { running }; },
      give(m) { F.money += m; updateHud(); }, feed: refillFeed, sell: sellWool,
      forceWool() { for (const s of sheep) if (s.role !== 'lamb') s.wool = 100; }, shearAll() { for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb') shearSheep(s); },
      spawnFox() { foxTimer = -5; }, pushFox() { foxes.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false }); },
      forceBreed() { breedTimer = 0; for (const s of sheep) s.breedCD = 0; }, starve() { for (const s of sheep) { s.hunger = 100; s.thirst = 100; } F.feed = 0; F.water = 0; },
      buyTractor, buyPen, herdTo, dropPlacing() { placing = null; },
      dbg() { return { pens: F.pens.length, placing: !!placing, tractor: !!tractor }; },
    };
  }
})();
