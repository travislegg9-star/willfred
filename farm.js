/* =====================================================================
   EWE BEAUTY FARMING Co — a build-it-up sheep farm starring Woofa.
   Raise sheep → wool + lambs (neglect = death). Shear (in a pen!) → sell.
   Guard dogs & a tractor herd the flock into a loose bunch; build pens with
   gates on any side; foxes slip under fences — dogs catch & FLING them.
   Movable troughs, upgradeable pens + farmhouse, animated intro, tutorial.
   Angled 2.5D view. Saves + grows offline. Vanilla canvas, built to expand.
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
  const FEED_COST = 8, WATER_COST = 3, PEN_COST = 120, GATE_W = 56;
  const BREEDS = {
    normal: { name: 'Woolly', mult: 1, cost: 55, wool: '#f4f3ee', lvl: 1 },
    merino: { name: 'Merino', mult: 1.9, cost: 240, wool: '#efe7d2', lvl: 2 },
    golden: { name: 'Golden', mult: 4.2, cost: 1400, wool: '#ffd24a', lvl: 4 },
    black: { name: 'Black', mult: 6.5, cost: 2800, wool: '#3a3640', lvl: 5 },
  };
  const DOGS = {
    woofa: { name: 'Woofa', kind: 'woofa', cost: 0, bonus: 0.0, desc: 'Your loyal good boy. Herds the flock and chases off foxes.' },
    winnie: { name: 'Winnie', kind: 'poodle', cost: 1600, bonus: 0.12, desc: 'Fluffy miniature poodle. +12% wool growth and another set of eyes on the foxes.' },
    tia: { name: 'Tia', kind: 'schnauzer', cost: 3400, bonus: 0.18, desc: 'Sharp miniature schnauzer. +18% wool growth and a fierce fox-chaser.' },
  };

  // 70% of new/born sheep are ewes (you need ewes to breed)
  const rollRole = () => Math.random() < 0.7 ? 'ewe' : 'ram';

  const defaultSave = () => ({
    money: 90, wool: 0, feed: 60, water: 60,
    sheep: [
      { breed: 'normal', role: 'ewe', wool: 25 },
      { breed: 'normal', role: 'ewe', wool: 10 },
      { breed: 'normal', role: 'ram', wool: 15 },
    ],
    sheepCap: 6, farmLevel: 1, power: 'none',
    dogs: { woofa: true }, upgrades: { tractor: false },
    pens: [{ x: 0, y: 0, w: 130, h: 100, gateOpen: true, gateSide: 0, level: 1, _init: false }],
    house: { level: 1 },
    troughs: null,           // set on first layout from paddock
    tutorialDone: false, muted: false, lastTime: nowMs(),
  });

  let F = null;
  const sheep = [], dogs = [], foxes = [], fluff = [], grass = [], pops = [];
  let tractor = null, paddock = {}, feedTrough = {}, waterTrough = {}, shed = {}, house = {};
  let running = false, tick = 0, breedTimer = 1600, foxTimer = 1600, alertTimer = 0;
  let placing = null;   // a freshly-bought pen following the finger (tap to drop)
  let drag = null;      // moving an existing pen / trough with the finger

  function spaceMargins() {
    const lvl = F ? F.farmLevel : 1;
    return { top: Math.max(150, 178 - (lvl - 1) * 6), bot: 128, mx: Math.max(6, 18 - (lvl - 1) * 2) };
  }
  function layout() {
    const m = spaceMargins();
    paddock = { x: m.mx, y: m.top, w: W - m.mx * 2, h: H - m.top - m.bot };
    if (F && F.troughs) { feedTrough = F.troughs.feed; waterTrough = F.troughs.water; }
    shed = { x: paddock.x + paddock.w - 60, y: paddock.y + 8 };
    house = { x: paddock.x + 46, y: paddock.y + 12 };
  }
  function defaultTroughs() {
    return {
      feed: { x: paddock.x + paddock.w * 0.30, y: paddock.y + paddock.h - 34 },
      water: { x: paddock.x + paddock.w * 0.62, y: paddock.y + paddock.h - 34 },
    };
  }

  // ---------- 2.5D depth ----------
  function dscale(y) { return 0.58 + 0.64 * clamp((y - paddock.y) / paddock.h, 0, 1); }
  const INSET_BASE = 0.17;
  function inset() { return Math.max(0.09, INSET_BASE - (F ? (F.farmLevel - 1) * 0.012 : 0)); }
  function fieldBounds(y) {
    const ty = clamp((y - paddock.y) / paddock.h, 0, 1), ins = paddock.w * inset() * (1 - ty);
    return { left: paddock.x + ins + 16, right: paddock.x + paddock.w - ins - 16 };
  }

  // flashing on-screen prompts
  const alerts = [];
  function flashAlert(msg, col, big) { const ex = alerts.find(a => a.msg === msg); if (ex) { ex.t = 1; return; } alerts.push({ msg, col: col || '#ff5a5a', t: 1, big: !!big }); if (alerts.length > 3) alerts.shift(); }

  // ---------- sound (tiny WebAudio blips, muted-safe) ----------
  let actx = null;
  function beep(freq, dur, type, vol) {
    if (!F || F.muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = (vol || 0.05); o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12)); o.stop(t + (dur || 0.12) + 0.02);
    } catch (e) {}
  }
  const sfx = {
    coin() { beep(880, 0.09, 'triangle', 0.05); setTimeout(() => beep(1320, 0.08, 'triangle', 0.045), 60); },
    shear() { beep(520, 0.06, 'square', 0.04); },
    baa() { beep(300, 0.14, 'sawtooth', 0.03); },
    pop() { beep(660, 0.07, 'sine', 0.05); },
    fox() { beep(180, 0.18, 'sawtooth', 0.05); },
    boom() { beep(120, 0.25, 'sawtooth', 0.07); setTimeout(() => beep(90, 0.2, 'square', 0.05), 40); },
    up() { beep(523, 0.1, 'triangle', 0.05); setTimeout(() => beep(784, 0.14, 'triangle', 0.05), 90); },
    err() { beep(160, 0.12, 'square', 0.04); },
  };

  // ---------- particles ----------
  function spawnFluff(x, y, c) { for (let i = 0; i < 10; i++) fluff.push({ x, y, vx: rand(-2, 2), vy: rand(-3, -0.5), life: 1, r: rand(3, 6), c: c || '#f4f3ee' }); }
  function pop(x, y, txt, col, big) { pops.push({ x, y, vx: rand(-0.7, 0.7), vy: rand(-2.4, -1.4), life: 1, txt, col: col || '#fff', sz: big ? 22 : 15, spin: rand(-0.1, 0.1), rot: 0 }); }
  function confetti(x, y, emojis) { for (let i = 0; i < 12; i++) pops.push({ x, y, vx: rand(-3, 3), vy: rand(-4.5, -1.5), life: 1, txt: emojis[(Math.random() * emojis.length) | 0], col: '#fff', sz: rand(14, 22), spin: rand(-0.3, 0.3), rot: rand(0, 6) }); }

  // ---------- factories ----------
  function makeSheep(o = {}) {
    return {
      x: o.x != null ? o.x : rand(paddock.x + 40, paddock.x + paddock.w - 40),
      y: o.y != null ? o.y : rand(paddock.y + 40, paddock.y + paddock.h - 60),
      breed: o.breed || 'normal', role: o.role || 'ewe', tx: 0, ty: 0, moveT: 0,
      hunger: o.hunger != null ? o.hunger : rand(10, 30), thirst: o.thirst != null ? o.thirst : rand(10, 30),
      wool: o.wool != null ? o.wool : rand(0, 25), size: o.role === 'lamb' ? 0.4 : (o.size != null ? o.size : 0.85),
      age: o.role === 'lamb' ? 0 : 999, health: 100, starve: 0, baaT: 0, heartT: 0, face: rand(0, 6), breedCD: rand(600, 1200),
    };
  }
  function makeDog(kind) { return { kind, x: rand(paddock.x + 60, paddock.x + paddock.w - 60), y: rand(paddock.y + 40, paddock.y + paddock.h - 40), tx: 0, ty: 0, moveT: 0, zoom: 0, facing: 1, orbit: rand(0, 6), _fx: null }; }
  function initGrass() { grass.length = 0; for (let i = 0; i < 40; i++) grass.push({ x: rand(paddock.x + 20, paddock.x + paddock.w - 20), y: rand(paddock.y + 20, paddock.y + paddock.h - 24), amt: rand(0.35, 0.9) }); }
  function makeTractor() { return { x: paddock.x + 50, y: paddock.y + 50, tx: 0, ty: 0, facing: 1, zoom: 0 }; }
  function rebuildDogs() { dogs.length = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) dogs.push(makeDog(DOGS[k].kind)); }
  function dogBonus() { let b = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) b += DOGS[k].bonus; return b; }
  function houseWoolBonus() { return (F.house.level - 1) * 0.06; }
  function houseIncome() { return (F.house.level - 1) * 0.006; }   // money per dt

  // ---------- pens / gates (gate can be on any side) ----------
  // gateSide: 0 bottom, 1 top, 2 left, 3 right
  function gateCenter(p) {
    switch (p.gateSide) {
      case 1: return { x: p.x + p.w / 2, y: p.y };
      case 2: return { x: p.x, y: p.y + p.h / 2 };
      case 3: return { x: p.x + p.w, y: p.y + p.h / 2 };
      default: return { x: p.x + p.w / 2, y: p.y + p.h };
    }
  }
  // the four edges, each split around the gate gap when that side holds the (open) gate
  function penWalls(p) {
    const g = GATE_W / 2, x0 = p.x, y0 = p.y, x1 = p.x + p.w, y1 = p.y + p.h, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const w = [];
    const edge = (side, ax, ay, bx, by, along) => {
      if (side === p.gateSide && p.gateOpen) {
        if (along === 'x') { w.push([ax, ay, cx - g, ay]); w.push([cx + g, by, bx, by]); }
        else { w.push([ax, ay, ax, cy - g]); w.push([bx, cy + g, bx, by]); }
      } else { w.push([ax, ay, bx, by]); }
    };
    edge(1, x0, y0, x1, y0, 'x');   // top
    edge(0, x0, y1, x1, y1, 'x');   // bottom
    edge(2, x0, y0, x0, y1, 'y');   // left
    edge(3, x1, y0, x1, y1, 'y');   // right
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
  const penInside = (p, x, y) => x > p.x - 4 && x < p.x + p.w + 4 && y > p.y - 4 && y < p.y + p.h + 4;
  const penInsideStrict = (p, x, y) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
  function insideAnyPen(x, y) { for (const p of F.pens) if (penInsideStrict(p, x, y)) return p; return null; }
  const penHandle = (p) => ({ x: p.x + 12, y: p.y + 12 });
  const penBadge = (p) => ({ x: p.x + p.w - 12, y: p.y + 12 });

  // ---------- persistence + offline ----------
  function load() { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return defaultSave(); return Object.assign(defaultSave(), JSON.parse(r)); } catch (e) { return defaultSave(); } }
  function persist() {
    if (!F) return; F.lastTime = nowMs();
    F.sheep = sheep.map(s => ({ breed: s.breed, role: s.role, wool: s.wool, hunger: s.hunger, thirst: s.thirst, size: s.size, age: s.age }));
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(F)); } catch (e) {}
  }

  function startGame() {
    F = load(); layout();
    if (!F.troughs) { F.troughs = defaultTroughs(); layout(); }
    if (!F.house) F.house = { level: 1 };
    if (!F.pens) F.pens = [];
    // clamp troughs into the current field
    for (const t of [F.troughs.feed, F.troughs.water]) { const b = fieldBounds(t.y); t.x = clamp(t.x, b.left, b.right); t.y = clamp(t.y, paddock.y + 26, paddock.y + paddock.h - 20); }
    // position any un-initialised starter pen in the centre
    for (const p of F.pens) { if (!p._init) { p.x = paddock.x + paddock.w / 2 - p.w / 2; p.y = paddock.y + paddock.h * 0.5 - p.h / 2; p._init = true; } if (p.gateSide == null) p.gateSide = 0; if (p.level == null) p.level = 1; }
    sheep.length = 0;
    for (const sd of (F.sheep || [])) sheep.push(makeSheep(sd));
    while (sheep.length < 3) sheep.push(makeSheep({ role: rollRole() }));
    rebuildDogs(); initGrass();
    tractor = F.upgrades && F.upgrades.tractor ? makeTractor() : null;
    applyOffline(); running = true; hideOverlays(); updateHud();
    syncMute();
    if (!F.tutorialDone) startTutorial();
  }
  function applyOffline() {
    const el = clamp((nowMs() - (F.lastTime || nowMs())) / 1000, 0, 8 * 3600); if (el < 30) return;
    const fed = F.feed > 5, watered = F.water > 5, rate = 0.22 * (fed ? 1 : 0.4) * (watered ? 1 : 0.6) * (1 + dogBonus() + houseWoolBonus());
    let grew = 0; for (const s of sheep) { if (s.role === 'lamb') continue; const add = Math.min(rate * el, 100 - s.wool); s.wool += add; grew += add; }
    F.feed = clamp(F.feed - el * 0.03, 0, 100); F.water = clamp(F.water - el * 0.03, 0, 100);
    F.money += houseIncome() * el * 60 / 100;   // gentle offline house income
    if (grew > 5) setTimeout(() => toast('🧺 Your flock grew wool while you were away!'), 400);
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  function nearGate(p, x, y) { const g = gateCenter(p); return dist(x, y, g.x, g.y) < GATE_W / 2 + 8; }

  function onDown(e) {
    if (!running) return; e.preventDefault && e.preventDefault();
    const p = pt(e);
    if (placing) { placing = null; toast('Pen placed'); sfx.pop(); persist(); return; }        // drop a fresh pen

    // 1) shear a fluffy sheep — but only inside a pen (herd them in first!)
    for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb' && dist(p.x, p.y, s.x, s.y - 6) < 30) {
      if (insideAnyPen(s.x, s.y)) { shearSheep(s); } else { toast('🚧 Herd them into a pen to shear!'); flashAlert('🚧 Shear inside a pen — herd them in!', '#ffb03a'); sfx.err(); }
      return;
    }
    // 2) pen controls: upgrade badge, gate, move-handle, move-gate-to-side
    for (const pen of F.pens) {
      const bd = penBadge(pen); if (dist(p.x, p.y, bd.x, bd.y) < 15) { upgradePen(pen); return; }
      const hd = penHandle(pen); if (dist(p.x, p.y, hd.x, hd.y) < 16) { drag = { type: 'pen', ref: pen, ox: p.x - pen.x, oy: p.y - pen.y }; return; }
      if (nearGate(pen, p.x, p.y)) { pen.gateOpen = !pen.gateOpen; toast(pen.gateOpen ? 'Gate opened' : 'Gate closed'); sfx.pop(); persist(); return; }
    }
    // move the gate: tap the midpoint of any (non-gate) wall to put the gate there
    for (const pen of F.pens) { const side = wallMidHit(pen, p.x, p.y); if (side >= 0 && side !== pen.gateSide) { pen.gateSide = side; toast('Gate moved'); sfx.pop(); persist(); return; } }

    // 3) grab a trough to move it
    for (const t of [feedTrough, waterTrough]) { const sc = dscale(t.y); if (dist(p.x, p.y, t.x, t.y) < 24 * sc) { drag = { type: 'trough', ref: t, ox: p.x - t.x, oy: p.y - t.y }; return; } }

    // 4) empty ground → send Woofa + tractor to round up here
    herdTo(p.x, p.y);
  }
  // which non-gate wall's midpoint got tapped (for moving the gate); -1 if none
  function wallMidHit(p, x, y) {
    const mids = [
      { s: 0, x: p.x + p.w / 2, y: p.y + p.h },
      { s: 1, x: p.x + p.w / 2, y: p.y },
      { s: 2, x: p.x, y: p.y + p.h / 2 },
      { s: 3, x: p.x + p.w, y: p.y + p.h / 2 },
    ];
    for (const m of mids) if (dist(x, y, m.x, m.y) < 22) return m.s;
    return -1;
  }
  function onMove(e) {
    const p = pt(e);
    if (placing) { placing.x = clamp(p.x - placing.w / 2, paddock.x + 4, paddock.x + paddock.w - placing.w - 4); placing.y = clamp(p.y - placing.h / 2, paddock.y + 4, paddock.y + paddock.h - placing.h - 4); return; }
    if (drag) {
      if (drag.type === 'pen') { drag.ref.x = clamp(p.x - drag.ox, paddock.x + 4, paddock.x + paddock.w - drag.ref.w - 4); drag.ref.y = clamp(p.y - drag.oy, paddock.y + 4, paddock.y + paddock.h - drag.ref.h - 4); }
      else { const t = drag.ref; t.y = clamp(p.y - drag.oy, paddock.y + 26, paddock.y + paddock.h - 20); const b = fieldBounds(t.y); t.x = clamp(p.x - drag.ox, b.left, b.right); }
    }
  }
  function onUp() { if (drag) { persist(); drag = null; } }
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (placing || drag) e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', (e) => { if (placing || drag) onMove(e); });
  window.addEventListener('mouseup', onUp);

  function herdTo(x, y) {
    x = clamp(x, paddock.x + 16, paddock.x + paddock.w - 16); y = clamp(y, paddock.y + 16, paddock.y + paddock.h - 16);
    for (const d of dogs) { d.tx = x + rand(-18, 18); d.ty = y + rand(-14, 14); d.moveT = 90; d.zoom = 1; }
    if (tractor) { tractor.tx = x; tractor.ty = y; tractor.zoom = 1; }
    pop(x, y, '🐾', '#fff');
  }
  function shearSheep(s) {
    const val = Math.max(1, Math.round((5 + s.size * 4 + s.health / 30) * BREEDS[s.breed].mult));
    F.wool += val; s.wool = 0; s.baaT = 40; s.heartT = 30; spawnFluff(s.x, s.y);
    pop(s.x, s.y - 14, '+' + val + ' 🧺', '#fff5c8'); sfx.shear();
    toast('✂️ +' + val + ' wool' + (s.breed !== 'normal' ? ' (' + BREEDS[s.breed].name + '!)' : '')); persist(); updateHud();
  }

  // ---------- update ----------
  function update(dt) {
    if (!running || !F) return;
    tick += dt;

    // power: economical tops WATER only (cheap); electric tops both fast but the bill nibbles money
    if (F.power === 'economical') { F.water = clamp(F.water + 0.05 * dt, 0, 65); }
    else if (F.power === 'electric') { if (F.money > 0) { F.feed = clamp(F.feed + 0.16 * dt, 0, 100); F.water = clamp(F.water + 0.16 * dt, 0, 100); F.money = Math.max(0, F.money - 0.05 * dt); } }
    // farmhouse passive income
    if (F.house.level > 1) F.money += houseIncome() * dt;

    for (let i = sheep.length - 1; i >= 0; i--) {
      const s = sheep[i];
      // needs rise (relaxed but real — they get hungry/thirsty and drain the troughs)
      s.hunger = clamp(s.hunger + 0.015 * dt, 0, 100); s.thirst = clamp(s.thirst + 0.018 * dt, 0, 100);
      // pens level ≥2 slowly auto-feed/water sheep inside (a hay bale + water)
      if (penInsideStrict(insideAnyPen(s.x, s.y) || {}, s.x, s.y)) { const pen = insideAnyPen(s.x, s.y); if (pen && pen.level >= 2) { s.hunger = clamp(s.hunger - 0.05 * dt, 0, 100); s.thirst = clamp(s.thirst - 0.05 * dt, 0, 100); } }
      s.health = clamp(100 - Math.max(0, s.hunger - 62) * 1.3 - Math.max(0, s.thirst - 62) * 1.3, 0, 100);
      if (s.hunger >= 100 || s.thirst >= 100) s.starve += dt; else s.starve = Math.max(0, s.starve - dt * 0.5);
      if (s.starve > 480) { sheep.splice(i, 1); toast('💀 A sheep died! Keep them fed and watered.'); pop(s.x, s.y, '💀', '#ff6a6a', true); sfx.err(); persist(); updateHud(); continue; }

      if (s.role !== 'lamb') {
        const grazing = grass.some(gr => gr.amt > 0.2 && dist(s.x, s.y, gr.x, gr.y) < 15);
        const fed = F.feed > 0 || grazing, watered = F.water > 0;
        const rate = 0.020 * (fed ? 1 : 0.3) * (watered ? 1 : 0.45) * (0.5 + s.health / 200) * (1 + dogBonus() + houseWoolBonus());
        s.wool = clamp(s.wool + rate * dt, 0, 100);
        if (fed && s.size < 1) s.size = clamp(s.size + 0.00012 * dt, 0.85, 1);
      } else { s.age += dt; if (s.age > 900) { s.role = rollRole(); s.size = 0.85; toast('🐑 A lamb grew up!'); pop(s.x, s.y, '🐑', '#fff'); } }
      if (s.baaT > 0) s.baaT -= dt; if (s.heartT > 0) s.heartT -= dt; s.breedCD -= dt;

      s.moveT -= dt; let fleeing = false;
      for (const fx of foxes) if (!fx.dead && dist(s.x, s.y, fx.x, fx.y) < 84) { const a = Math.atan2(s.y - fx.y, s.x - fx.x); s.tx = s.x + Math.cos(a) * 130; s.ty = s.y + Math.sin(a) * 130; s.moveT = 20; fleeing = true; }
      if (tractor && dist(s.x, s.y, tractor.x, tractor.y) < 78) { const a = Math.atan2(s.y - tractor.y, s.x - tractor.x); s.tx = s.x + Math.cos(a) * 120; s.ty = s.y + Math.sin(a) * 120; s.moveT = 24; fleeing = true; }
      for (const d of dogs) if (dist(s.x, s.y, d.x, d.y) < 50) { const a = Math.atan2(s.y - d.y, s.x - d.x); s.tx = s.x + Math.cos(a) * 62; s.ty = s.y + Math.sin(a) * 62; s.moveT = Math.max(s.moveT, 12); fleeing = true; }
      if (!fleeing && s.hunger > 42 && F.feed > 0) { s.tx = feedTrough.x + rand(-12, 12); s.ty = feedTrough.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && s.thirst > 42 && F.water > 0) { s.tx = waterTrough.x + rand(-12, 12); s.ty = waterTrough.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && s.moveT <= 0) { s.tx = rand(paddock.x + 30, paddock.x + paddock.w - 30); s.ty = rand(paddock.y + 30, paddock.y + paddock.h - 40); s.moveT = rand(60, 150); }

      // anti-stuck: if the target is on the other side of a pen wall, aim at the gate first
      for (const pen of F.pens) { const inNow = penInsideStrict(pen, s.x, s.y), inTgt = penInsideStrict(pen, s.tx, s.ty); if (inNow !== inTgt) { if (pen.gateOpen) { const g = gateCenter(pen); s.tx = g.x; s.ty = g.y; } } }

      const spd = fleeing ? 2.4 : (s.role === 'lamb' ? 0.9 : 0.6);
      const a = Math.atan2(s.ty - s.y, s.tx - s.x);
      if (dist(s.x, s.y, s.tx, s.ty) > 4) { s.y = clamp(s.y + Math.sin(a) * spd * dt, paddock.y + 24, paddock.y + paddock.h - 24); const b = fieldBounds(s.y); s.x = clamp(s.x + Math.cos(a) * spd * dt, b.left, b.right); }

      // sheep-to-sheep separation → a loose bunch, never a single stack
      const sc = dscale(s.y), sep = 15 * sc;
      for (let j = 0; j < sheep.length; j++) { if (j === i) continue; const o = sheep[j]; const dd = dist(s.x, s.y, o.x, o.y); if (dd < sep && dd > 0.01) { const push = (sep - dd) * 0.5; const ang = Math.atan2(s.y - o.y, s.x - o.x); s.x += Math.cos(ang) * push; s.y += Math.sin(ang) * push; } }

      repelFromPens(s, 13);
      { const b = fieldBounds(s.y); s.x = clamp(s.x, b.left, b.right); s.y = clamp(s.y, paddock.y + 24, paddock.y + paddock.h - 24); }

      // eat / drink (this drains the troughs → you must buy refills = the core loop)
      if (F.feed > 0 && s.hunger > 8 && dist(s.x, s.y, feedTrough.x, feedTrough.y) < 40) { s.hunger = clamp(s.hunger - 0.32 * dt, 0, 100); F.feed = clamp(F.feed - 0.05 * dt, 0, 100); if (s.hunger < 20 && s.heartT <= 0) s.heartT = 24; }
      if (F.water > 0 && s.thirst > 8 && dist(s.x, s.y, waterTrough.x, waterTrough.y) < 40) { s.thirst = clamp(s.thirst - 0.32 * dt, 0, 100); F.water = clamp(F.water - 0.045 * dt, 0, 100); if (s.thirst < 20 && s.heartT <= 0) s.heartT = 24; }
      // graze grass — a small free supplement that runs out (not a full meal)
      for (const gr of grass) if (gr.amt > 0.2 && dist(s.x, s.y, gr.x, gr.y) < 14) { s.hunger = clamp(s.hunger - 0.03 * dt, 0, 100); gr.amt = clamp(gr.amt - 0.03 * dt, 0, 1); break; }
    }
    for (const gr of grass) gr.amt = clamp(gr.amt + 0.00035 * dt, 0, 1);   // slow regrow

    // breeding (needs a ram + a healthy ewe; slower pace)
    breedTimer -= dt;
    if (breedTimer <= 0) {
      breedTimer = rand(1400, 2400);
      const rams = sheep.filter(s => s.role === 'ram' && s.health > 60), ewes = sheep.filter(s => s.role === 'ewe' && s.health > 60 && s.breedCD <= 0);
      if (rams.length && ewes.length && sheep.length < F.sheepCap) { const mum = ewes[(Math.random() * ewes.length) | 0]; mum.breedCD = rand(1600, 2600); const lamb = makeSheep({ x: mum.x + rand(-10, 10), y: mum.y + 14, breed: mum.breed, role: 'lamb' }); sheep.push(lamb); toast('💕 A lamb was born!'); confetti(mum.x, mum.y - 10, ['💕', '🐑', '✨']); sfx.up(); persist(); updateHud(); }
    }

    // foxes (slower, scale a bit with farm level)
    foxTimer -= dt;
    if (foxTimer <= 0 && sheep.length > 0 && foxes.length < 3) {
      foxTimer = rand(2600, 4400) / (1 + (F.farmLevel - 1) * 0.3);
      const spawnFoxAt = (left) => foxes.push({ x: left ? paddock.x + 6 : paddock.x + paddock.w - 6, y: rand(paddock.y + 20, paddock.y + paddock.h - 20), fleeing: false, dead: false, facing: 1 });
      const left = Math.random() < 0.5; spawnFoxAt(left); flashAlert('🦊 FOX!', '#ff6a3a'); sfx.fox();
      if (Math.random() < 0.13 + (F.farmLevel - 1) * 0.03 && foxes.length < 3) { spawnFoxAt(!left); flashAlert('🦊🦊 DOUBLE FOX RAID!', '#ff4d4d', true); toast('🦊🦊 Double fox raid!'); }
    }
    for (let i = foxes.length - 1; i >= 0; i--) {
      const fx = foxes[i];
      if (fx.dead) {   // FOX TERMINATED — spinning off into the sunset
        fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 0.12 * dt; fx.spin += 0.35 * dt; fx.tumble += dt;
        if (fx.x < -60 || fx.x > W + 60 || fx.y > H + 80 || fx.tumble > 130) foxes.splice(i, 1);
        continue;
      }
      let chased = false;
      for (const d of dogs) if (dist(d.x, d.y, fx.x, fx.y) < 95) chased = true;
      if (chased) fx.fleeing = true;
      let tx, ty;
      if (fx.fleeing) { tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x - 40 : paddock.x + paddock.w + 40; ty = fx.y; }
      else { let best = null, bd = 1e9; for (const s of sheep) { const dd = dist(fx.x, fx.y, s.x, s.y); if (dd < bd) { bd = dd; best = s; } } if (best) { tx = best.x; ty = best.y; if (bd < 16) { const idx = sheep.indexOf(best); if (idx >= 0) { sheep.splice(idx, 1); toast('🦊 A fox took a sheep! Get more guard dogs.'); pop(best.x, best.y, '💔', '#ff6a6a'); sfx.err(); persist(); updateHud(); } fx.fleeing = true; } } else { fx.fleeing = true; tx = fx.x; ty = fx.y; } }
      const a = Math.atan2(ty - fx.y, tx - fx.x), sp = fx.fleeing ? 3.0 : 1.5;
      fx.x += Math.cos(a) * sp * dt; fx.y += Math.sin(a) * sp * dt; fx.facing = Math.cos(a) >= 0 ? 1 : -1;
      if (fx.fleeing && (fx.x < paddock.x - 30 || fx.x > paddock.x + paddock.w + 30)) foxes.splice(i, 1);
    }

    // ---- dogs: nearest free dog peels off to each fox (and CATCHES it); the rest herd a loose mob ----
    const busy = new Set();
    for (const fx of foxes) { if (fx.dead) continue; let best = null, bd = 1e9; for (const d of dogs) { if (busy.has(d)) continue; const dd = dist(d.x, d.y, fx.x, fx.y); if (dd < bd) { bd = dd; best = d; } } if (best) { busy.add(best); best._fx = fx; } }
    let cx = 0, cy = 0; if (sheep.length) { for (const s of sheep) { cx += s.x; cy += s.y; } cx /= sheep.length; cy /= sheep.length; }
    for (const d of dogs) {
      d.moveT -= dt; if (d.zoom > 0) d.zoom -= 0.01 * dt;
      const chasing = busy.has(d) && d._fx && !d._fx.dead;
      if (chasing) {
        d.tx = d._fx.x; d.ty = d._fx.y; d.zoom = Math.max(d.zoom, 0.7);
        if (dist(d.x, d.y, d._fx.x, d._fx.y) < 18) catchFox(d._fx, d);   // gotcha!
      } else if (sheep.length) {
        let stray = null, sd = -1; for (const s of sheep) { const dd = dist(s.x, s.y, cx, cy); if (dd > sd) { sd = dd; stray = s; } }
        if (stray && sd > 52) { const a = Math.atan2(stray.y - cy, stray.x - cx); d.tx = stray.x + Math.cos(a) * 40; d.ty = stray.y + Math.sin(a) * 40; }
        else { d.orbit += 0.03 * dt; d.tx = cx + Math.cos(d.orbit) * 80; d.ty = cy + Math.sin(d.orbit) * 80; }
      } else if (d.moveT <= 0) { d.tx = rand(paddock.x + 40, paddock.x + paddock.w - 40); d.ty = rand(paddock.y + 30, paddock.y + paddock.h - 30); d.moveT = rand(60, 160); }
      const sp = chasing ? 3.6 : 1.5, a = Math.atan2(d.ty - d.y, d.tx - d.x);
      if (dist(d.x, d.y, d.tx, d.ty) > 5) { d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt; d.facing = Math.cos(a) >= 0 ? 1 : -1; }
    }
    if (tractor) {
      if (tractor.zoom > 0) tractor.zoom -= 0.006 * dt;
      if (tractor.tx || tractor.ty) { const a = Math.atan2(tractor.ty - tractor.y, tractor.tx - tractor.x); if (dist(tractor.x, tractor.y, tractor.tx, tractor.ty) > 6) { tractor.x = clamp(tractor.x + Math.cos(a) * 2.2 * dt, paddock.x + 16, paddock.x + paddock.w - 16); tractor.y = clamp(tractor.y + Math.sin(a) * 2.2 * dt, paddock.y + 16, paddock.y + paddock.h - 16); tractor.facing = Math.cos(a) >= 0 ? 1 : -1; } }
    }

    for (let i = fluff.length - 1; i >= 0; i--) { const p = fluff[i]; p.vy += 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) fluff.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.05 * dt; p.rot += p.spin * dt; p.life -= 0.013 * dt; if (p.life <= 0) pops.splice(i, 1); }
    for (let i = alerts.length - 1; i >= 0; i--) { alerts[i].t -= 0.006 * dt; if (alerts[i].t <= 0) alerts.splice(i, 1); }
    alertTimer -= dt;
    if (alertTimer <= 0) {
      alertTimer = 160;
      if (sheep.some(s => s.starve > 60)) flashAlert('⚠️ YOUR SHEEP ARE DYING!', '#ff4d4d', true);
      else if (F.feed < 18 && sheep.some(s => s.hunger > 55)) flashAlert('🌾 Feed your sheep!', '#ffb03a');
      else if (F.water < 18 && sheep.some(s => s.thirst > 55)) flashAlert('💧 Your sheep need water!', '#4cc9ff');
      if (F.wool > 30) flashAlert('🧺 Sell your wool for coin!', '#58e08a');
    }
    if ((tick | 0) % 30 === 0) { updateHud(); persist(); }
  }

  function catchFox(fx, d) {
    if (fx.dead) return;
    fx.dead = true; d.zoom = 1;
    if (Math.random() < 0.45) {   // FINISHER — fling it off into the sunset
      const dir = fx.x < W / 2 ? 1 : -1;
      fx.vx = dir * rand(6, 10); fx.vy = rand(-9, -6); fx.spin = rand(0.3, 0.6); fx.tumble = 0;
      flashAlert('🦊 FOX TERMINATED! 💥', '#ffd23d', true); toast('💥 FOX TERMINATED!'); pop(fx.x, fx.y - 10, '💥', '#ffd23d', true); confetti(fx.x, fx.y, ['💥', '⭐', '🦴']); sfx.boom();
    } else {                       // just chased off, tail between legs
      const dir = fx.x < W / 2 ? -1 : 1;
      fx.vx = dir * rand(4, 6); fx.vy = rand(-3, -1); fx.spin = rand(-0.2, 0.2); fx.tumble = 60;
      pop(fx.x, fx.y - 8, '💨', '#cfd8e6'); sfx.pop();
    }
  }

  // ---------- render ----------
  function render() {
    ctx.fillStyle = '#0c1a12'; ctx.fillRect(0, 0, W, H);
    if (!F) return;
    const sky = ctx.createLinearGradient(0, 0, 0, paddock.y + 20); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#e8f6ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, paddock.y);
    ctx.fillStyle = '#6fae5e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, paddock.y - 20 - Math.sin(x / 130) * 16); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c9c4e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 80) ctx.lineTo(x, paddock.y - 8 - Math.cos(x / 90) * 10); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.font = '18px system-ui'; ctx.textAlign = 'left'; ctx.fillText('☁️', (W * 0.2 + tick * 0.15) % (W + 40) - 20, 40); ctx.fillText('☁️', (W * 0.7 + tick * 0.1) % (W + 40) - 20, 62); ctx.globalAlpha = 1;

    const far = fieldBounds(paddock.y), near = fieldBounds(paddock.y + paddock.h);
    const fL = far.left, fR = far.right, nL = near.left, nR = near.right, ty0 = paddock.y, ty1 = paddock.y + paddock.h;
    ctx.fillStyle = '#5a3f24'; ctx.beginPath(); ctx.moveTo(fL - 12, ty0 - 9); ctx.lineTo(fR + 12, ty0 - 9); ctx.lineTo(nR + 12, ty1 + 10); ctx.lineTo(nL - 12, ty1 + 10); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, ty0, 0, ty1); g.addColorStop(0, '#3a8340'); g.addColorStop(1, '#59ad4f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fL, ty0); ctx.lineTo(fR, ty0); ctx.lineTo(nR, ty1); ctx.lineTo(nL, ty1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 1; i < 10; i++) { const t = i / 10, yy = ty0 + t * (ty1 - ty0), lx = fL + t * (nL - fL), rx = fR + t * (nR - fR); ctx.lineWidth = 1 + t * 1.6; ctx.beginPath(); ctx.moveTo(lx, yy); ctx.lineTo(rx, yy); ctx.stroke(); }
    ctx.strokeStyle = '#caa06a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fL, ty0); ctx.lineTo(fR, ty0); ctx.lineTo(nR, ty1); ctx.lineTo(nL, ty1); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#b98d55'; for (let i = 0; i <= 8; i++) { const t = i / 8, yy = ty0 + t * (ty1 - ty0), lx = fL + t * (nL - fL), rx = fR + t * (nR - fR); ctx.fillRect(lx - 2, yy - 5, 4, 10); ctx.fillRect(rx - 2, yy - 5, 4, 10); }
    drawGrass();

    if (F.power === 'economical') drawWaterWheel();
    drawTrough(feedTrough, '#d9b24a', F.feed, '🌾'); drawTrough(waterTrough, '#4cc9ff', F.water, '💧');
    drawHouse(house); drawShed(shed);
    for (const p of F.pens) drawPen(p);
    if (placing) { ctx.globalAlpha = 0.5; drawPen(placing); ctx.globalAlpha = 1; }

    const actors = [];
    for (const s of sheep) actors.push({ y: s.y, d: () => drawSheep(s) });
    for (const fx of foxes) actors.push({ y: fx.dead ? -9999 : fx.y, d: () => drawFox(fx) });
    for (const d of dogs) actors.push({ y: d.y, d: () => drawDog(d) });
    if (tractor) actors.push({ y: tractor.y, d: () => drawTractor(tractor) });
    actors.sort((a, b) => a.y - b.y); for (const a of actors) a.d();

    for (const p of fluff) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    for (const p of pops) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.font = '900 ' + p.sz + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = p.col; ctx.fillText(p.txt, 0, 0); ctx.restore(); } ctx.globalAlpha = 1;
    drawAlerts();
  }

  function drawAlerts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let yy = paddock.y + 24;
    for (const al of alerts) {
      const flash = 0.45 + 0.55 * Math.abs(Math.sin(tick / 6));
      ctx.globalAlpha = clamp(al.t, 0, 1) * (0.5 + flash * 0.5);
      const fs = al.big ? 26 : 19;
      ctx.font = '900 ' + fs + 'px system-ui, sans-serif';
      const w = ctx.measureText(al.msg).width + 26;
      ctx.fillStyle = 'rgba(11,18,32,0.7)'; roundRect(W / 2 - w / 2, yy - fs * 0.7, w, fs * 1.4, 10); ctx.fill();
      ctx.fillStyle = al.col; ctx.fillText(al.msg, W / 2, yy);
      yy += fs * 1.7;
    }
    ctx.globalAlpha = 1;
  }

  function shadow(x, y, r) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawPen(p) {
    ctx.fillStyle = p.level >= 2 ? 'rgba(255,220,120,0.06)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(p.x, p.y, p.w, p.h);
    // walls (skip the gate gap)
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); for (const seg of penWalls(p)) { ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); } ctx.stroke();
    // posts along the top/bottom
    ctx.fillStyle = '#6a4f28'; for (let px = p.x; px <= p.x + p.w; px += 28) { ctx.fillRect(px - 1.5, p.y - 5, 3, p.h + 10); }
    // gate marker
    const gc = gateCenter(p); ctx.fillStyle = p.gateOpen ? '#58e08a' : '#c86a3a';
    ctx.beginPath(); ctx.arc(gc.x, gc.y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(p.gateOpen ? 'gate' : 'shut', gc.x, gc.y + (p.gateSide === 1 ? -10 : 14));
    if (p.level >= 2) { ctx.font = '15px system-ui'; ctx.fillText('🌾', p.x + p.w - 16, p.y + p.h - 12); ctx.fillText('💧', p.x + 16, p.y + p.h - 12); }
    // move handle (top-left) + upgrade badge (top-right)
    const hd = penHandle(p); ctx.fillStyle = 'rgba(11,18,32,0.75)'; ctx.beginPath(); ctx.arc(hd.x, hd.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#eaf0ff'; ctx.font = '13px system-ui'; ctx.fillText('✥', hd.x, hd.y + 4);
    const bd = penBadge(p); ctx.fillStyle = p.level >= 4 ? 'rgba(88,224,138,0.85)' : 'rgba(255,210,61,0.9)'; ctx.beginPath(); ctx.arc(bd.x, bd.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#241a00'; ctx.font = '900 11px system-ui'; ctx.fillText(p.level >= 4 ? 'MAX' : 'Lv' + p.level, bd.x, bd.y + 4);
  }
  function drawTrough(t, col, level, ic) {
    const sc = dscale(t.y); ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc);
    ctx.fillStyle = '#7a5a3a'; roundRect(-22, -8, 44, 16, 4); ctx.fill();
    ctx.fillStyle = col; roundRect(-19, -6 + (12 - level / 100 * 12), 38, level / 100 * 12, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; roundRect(-22, -8, 44, 16, 4); ctx.stroke();
    ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ic, 0, -12);
    ctx.restore();
  }
  function drawGrass() {
    for (const gr of grass) {
      if (gr.amt < 0.12) { ctx.fillStyle = 'rgba(90,63,36,0.35)'; ctx.beginPath(); ctx.ellipse(gr.x, gr.y, 5, 2.5, 0, 0, 7); ctx.fill(); continue; }
      const sc = dscale(gr.y), n = 3 + Math.round(gr.amt * 3);
      ctx.strokeStyle = gr.amt > 0.5 ? '#6fd06a' : '#8fbf6a'; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) { const bx = gr.x + (i - n / 2) * 2.4 * sc, sw = Math.sin(tick / 30 + gr.x + i) * 1.5; ctx.beginPath(); ctx.moveTo(bx, gr.y); ctx.lineTo(bx + sw, gr.y - (5 + gr.amt * 5) * sc); ctx.stroke(); }
    }
  }
  function drawWaterWheel() {
    const wx = paddock.x + 40, wy = paddock.y + paddock.h - 46, r = 34, ang = tick / 40;
    ctx.fillStyle = '#3ba7e0'; ctx.fillRect(wx - 4, wy + r - 6, 60, 8);
    ctx.strokeStyle = '#5a3f24'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(wx, wy, r, 0, 7); ctx.stroke();
    for (let i = 0; i < 10; i++) { const a = ang + i / 10 * Math.PI * 2; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r); ctx.stroke(); ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(wx + Math.cos(a) * r, wy + Math.sin(a) * r, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5a3f24'; ctx.beginPath(); ctx.arc(wx, wy, 6, 0, 7); ctx.fill();
  }
  function drawShed(sh) { const sc = dscale(sh.y); ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sc, sc); ctx.fillStyle = '#b04a3a'; ctx.fillRect(0, 14, 52, 34); ctx.fillStyle = '#7a2f28'; ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(26, -2); ctx.lineTo(56, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(18, 28, 16, 20); ctx.restore(); }
  function drawHouse(h) {
    const sc = dscale(h.y), lv = F.house.level; ctx.save(); ctx.translate(h.x, h.y); ctx.scale(sc, sc);
    ctx.fillStyle = '#e8e2d2'; ctx.fillRect(-2, 10, 46 + lv * 4, 34);                 // wall (wider with level)
    ctx.fillStyle = '#7a4b34'; ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(22 + lv * 2, -8); ctx.lineTo(52 + lv * 4, 12); ctx.closePath(); ctx.fill();  // roof
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(6, 26, 12, 18);                            // door
    ctx.fillStyle = '#bfe6ff'; ctx.fillRect(24, 20, 10, 10);                           // window
    ctx.strokeStyle = '#9aa'; ctx.lineWidth = 1; ctx.strokeRect(24, 20, 10, 10);
    if (lv > 1) { ctx.fillStyle = '#8a8f96'; ctx.fillRect(36 + lv * 3, 0, 6, 14); const p = Math.sin(tick / 20) * 2; ctx.fillStyle = 'rgba(200,200,210,0.6)'; ctx.beginPath(); ctx.arc(39 + lv * 3, -3 + p, 3, 0, 7); ctx.fill(); }  // chimney smoke
    for (let i = 0; i < lv - 1; i++) { ctx.fillStyle = '#ffd23d'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★', 6 + i * 8, 6); }
    ctx.restore();
  }

  function drawSheep(s) {
    const B = BREEDS[s.breed], sc = dscale(s.y);
    const isRam = s.role === 'ram', isLamb = s.role === 'lamb';
    const roleScale = isRam ? 1.16 : isLamb ? 0.62 : 0.98;
    const ready = s.wool >= 100 && !isLamb;
    const fluffR = (11 + s.wool / 100 * 8) * (0.55 + s.size * 0.5) * sc * roleScale;
    const bob = Math.sin(tick / 10 + s.face) * 1.2 + (s.baaT > 0 ? -2 : 0);
    shadow(s.x, s.y + fluffR * 0.55, fluffR);
    // legs
    ctx.strokeStyle = '#3a3238'; ctx.lineWidth = 2.5 * sc;
    for (const lx of [-fluffR * 0.5, fluffR * 0.5]) { ctx.beginPath(); ctx.moveTo(s.x + lx, s.y + fluffR * 0.3); ctx.lineTo(s.x + lx, s.y + fluffR * 0.7); ctx.stroke(); }
    // fleece — merino is curlier (more, tighter puffs); golden shiny; black obvious
    const wool = s.health > 40 ? B.wool : '#cfc9bf';
    ctx.fillStyle = wool;
    const puffs = s.breed === 'merino' ? 9 : 6, pr = s.breed === 'merino' ? 0.42 : 0.5;
    if (s.wool > 20) for (let i = 0; i < puffs; i++) { const a = i / puffs * Math.PI * 2; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * fluffR * 0.55, s.y + bob + Math.sin(a) * fluffR * 0.45, fluffR * pr, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(s.x, s.y + bob, fluffR, fluffR * 0.8, 0, 0, 7); ctx.fill();
    if (s.breed === 'golden') { ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.3, s.y + bob - fluffR * 0.3, fluffR * 0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; if ((tick | 0) % 40 < 3) { ctx.fillStyle = '#fff'; ctx.font = (10 * sc) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✨', s.x + fluffR * 0.5, s.y + bob - fluffR * 0.5); } }
    // face
    ctx.fillStyle = s.breed === 'black' ? '#1c1a20' : '#3a3238'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.7, s.y + bob + 2, fluffR * 0.42, fluffR * 0.5, -0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.85, s.y + bob, 1.7 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c262b'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.55, s.y + bob - 4, 3 * sc, 5 * sc, -0.5, 0, 7); ctx.fill();
    // horns — rams get bold curled horns; ewes none
    if (isRam) {
      ctx.strokeStyle = '#e6c689'; ctx.lineWidth = 3.4 * sc; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const hx = s.x - fluffR * 0.7 + side * fluffR * 0.18, hy = s.y + bob - fluffR * 0.55;
        ctx.beginPath(); ctx.arc(hx, hy, 5.5 * sc, Math.PI * 0.1, Math.PI * 1.7, false); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    ctx.textAlign = 'center';
    if (ready) { ctx.font = (15 * sc) + 'px system-ui'; ctx.fillText('✂️', s.x, s.y - fluffR - 12 + Math.sin(tick / 6) * 2); }
    if (s.heartT > 0) { ctx.globalAlpha = clamp(s.heartT / 24, 0, 1); ctx.font = (13 * sc) + 'px system-ui'; ctx.fillText('💗', s.x + fluffR * 0.6, s.y + bob - fluffR - 2); ctx.globalAlpha = 1; }
    if (s.baaT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 11px system-ui'; ctx.fillText('baa!', s.x + fluffR, s.y + bob - fluffR); }
    if (s.health < 40) { ctx.font = '13px system-ui'; ctx.fillText(s.hunger > s.thirst ? '🌾' : '💧', s.x, s.y - fluffR - 10); }
  }
  function drawFox(fx) {
    const sc = dscale(fx.dead ? fx.y : fx.y), f = fx.facing || 1; ctx.save(); ctx.translate(fx.x, fx.y);
    if (fx.dead) ctx.rotate(fx.spin ? (fx.spin * (fx.tumble || 0)) : 0);
    ctx.scale(f * sc, sc); if (!fx.dead) shadowLocal(0, 7, 12);
    ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-20, -6); ctx.lineTo(-11, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-17, -4); ctx.lineTo(-19, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.arc(11, -2, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -6); ctx.lineTo(11, -12); ctx.lineTo(13, -6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(14, -11); ctx.lineTo(16, -5); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(16, -2, 1.3, 0, 7); ctx.fill();
    if (fx.dead) { ctx.fillStyle = '#111'; ctx.font = '900 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('x', 15, -3); }
    ctx.restore();
  }
  function drawDog(d) {
    const sc = dscale(d.y), f = d.facing || 1; ctx.save(); ctx.translate(d.x, d.y); ctx.scale(f * sc, sc); shadowLocal(0, 8, 12);
    if (d.kind === 'woofa') { ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.ellipse(-3, 5, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(13, -2, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -2, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#f3f1ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-15, -6); ctx.stroke(); }
    else if (d.kind === 'poodle') { ctx.fillStyle = '#f2ead8'; for (const p of [[0, 0, 9], [10, -3, 6], [-8, -2, 5], [0, -6, 5]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); } ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(13, -3, 1.3, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#d8dade'; ctx.beginPath(); ctx.ellipse(13, 1, 3.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -3, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawTractor(t) {
    const sc = dscale(t.y), f = t.facing || 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(f * sc, sc); shadowLocal(0, 12, 20);
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-9, 8, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(-9, 8, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#3aa64a'; roundRect(-14, -6, 26, 14, 3); ctx.fill();
    ctx.fillStyle = '#2f8a3c'; roundRect(-2, -18, 12, 14, 3); ctx.fill();
    ctx.fillStyle = '#bfe6ff'; roundRect(0, -15, 8, 8, 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(-13, -14, 3, 8);
    ctx.restore();
  }
  function shadowLocal(x, y, r) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- HUD + actions ----------
  const el = (id) => document.getElementById(id);
  function woolPrice() { return 3 + (F.farmLevel - 1) * 2; }
  function setBar(fillId, pctId, v) { const f = el(fillId); if (f) f.style.width = v + '%'; const p = el(pctId); if (p) p.textContent = Math.round(v) + '%'; }
  function updateHud() {
    if (!F) return;
    el('fMoney').textContent = '💰 ' + Math.floor(F.money);
    el('fWool').textContent = '🧺 ' + Math.floor(F.wool);
    el('fSheep').textContent = '🐑 ' + sheep.length + '/' + F.sheepCap;
    el('fLevel').textContent = 'Lv ' + F.farmLevel;
    setBar('foodFill', 'foodPct', F.feed); setBar('waterFill', 'waterPct', F.water);
    const fb = el('foodFill'); if (fb) fb.classList.toggle('low', F.feed < 20);
    const wb = el('waterFill'); if (wb) wb.classList.toggle('low', F.water < 20);
    el('sellVal').textContent = '$' + Math.floor(F.wool * woolPrice());
  }
  const toastEl = el('toast');
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.style.color = '#fff'; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }
  function heartsOnFlock() { let n = 0; for (const s of sheep) { if (n++ > 5) break; s.heartT = 24; } }
  function refillFeed() { if (F.money < FEED_COST) return toast('Not enough money'); F.money -= FEED_COST; F.feed = clamp(F.feed + 55, 0, 100); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function refillWater() { if (F.money < WATER_COST) return toast('Not enough money'); F.money -= WATER_COST; F.water = clamp(F.water + 65, 0, 100); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function sellWool() { if (F.wool < 1) return toast('No wool — shear the fluffy (✂️) sheep first!'); const got = Math.floor(F.wool * woolPrice()); F.money += got; F.wool = 0; toast('💰 Sold wool for $' + got); confetti(W / 2, H * 0.4, ['💰', '🪙', '✨']); sfx.coin(); persist(); updateHud(); }
  el('btnFeed').onclick = refillFeed; el('btnWater').onclick = refillWater; el('btnSell').onclick = sellWool; el('btnShop').onclick = openShop; el('farmPlay').onclick = startGame; el('shopClose').onclick = closeShop;

  // sound + help buttons
  function syncMute() { const b = el('btnSound'); if (b) b.textContent = F && F.muted ? '🔇' : '🔊'; }
  const btnSound = el('btnSound'); if (btnSound) btnSound.onclick = () => { F.muted = !F.muted; syncMute(); if (!F.muted) sfx.pop(); persist(); };
  const btnHelp = el('btnHelp'); if (btnHelp) btnHelp.onclick = () => startTutorial();

  // ---------- tutorial ----------
  const TUT = [
    { t: '👋 Welcome to Ewe Beauty Farming Co! Raise sheep, grow wool, build the biggest farm.' },
    { t: '🌾 Tap FEED and 💧 WATER at the bottom to fill the troughs. Watch the gauges up top — refill before they empty!' },
    { t: '🐾 Tap empty grass to send Woofa & the tractor to round the flock into a bunch.' },
    { t: '🚧 Herd sheep INTO a pen, then tap a fluffy ✂️ sheep to shear it. Tap the gate dot to open/close it.' },
    { t: '🧺 Tap SELL WOOL to turn wool into coins. Then spend them in the 🛒 SHOP.' },
    { t: '🦊 Foxes raid your flock — keep your dogs close and watch them FLING the foxes away! Have fun! 🐑' },
  ];
  let tutIx = 0;
  function startTutorial() { tutIx = 0; showTut(); }
  function showTut() { const o = el('tutOverlay'); if (!o) return; el('tutText').textContent = TUT[tutIx].t; el('tutStep').textContent = (tutIx + 1) + ' / ' + TUT.length; el('tutNext').textContent = tutIx === TUT.length - 1 ? 'Let\'s farm! 🐑' : 'Next ›'; o.classList.remove('hidden'); }
  function nextTut() { tutIx++; if (tutIx >= TUT.length) return endTut(); showTut(); }
  function endTut() { const o = el('tutOverlay'); if (o) o.classList.add('hidden'); if (F) { F.tutorialDone = true; persist(); } }
  { const n = el('tutNext'); if (n) n.onclick = nextTut; const s = el('tutSkip'); if (s) s.onclick = endTut; }

  // ---------- shop ----------
  const startScreen = el('startScreen'), shopScreen = el('shopScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); }
  function openShop() { if (!F) return; renderShop(); shopScreen.classList.remove('hidden'); }
  function closeShop() { shopScreen.classList.add('hidden'); }
  function sheepCost(b) { return Math.round(BREEDS[b].cost + (b === 'normal' ? sheep.length * 18 : 0)); }
  function expandCost() { return Math.round(240 * F.farmLevel); }
  function houseCost() { return Math.round(300 * F.house.level); }

  function renderShop() {
    el('shopMoney').textContent = Math.floor(F.money);
    const list = el('shopList'); list.innerHTML = ''; const rows = [];
    for (const b of ['normal', 'merino', 'golden', 'black']) {
      const B = BREEDS[b], locked = F.farmLevel < B.lvl, full = sheep.length >= F.sheepCap, c = sheepCost(b);
      rows.push({ emoji: b === 'black' ? '🖤' : b === 'golden' ? '⭐' : '🐑', name: 'Buy ' + B.name + ' Sheep', desc: locked ? 'Unlocks at farm Lv ' + B.lvl + '.' : (b === 'black' ? 'Priciest of all — wool sells for 6.5×.' : 'Wool value ×' + B.mult + '.'), act: locked ? { tag: 'Lv ' + B.lvl } : full ? { tag: 'Full' } : { label: '$' + c, fn: () => buySheep(b), afford: F.money >= c } });
    }
    rows.push({ emoji: '🏠', name: 'Upgrade Farmhouse (Lv ' + F.house.level + ')', desc: F.house.level >= 5 ? 'Fully upgraded! Passive coin + faster wool.' : 'Passive coin income + faster wool growth each level.', act: F.house.level >= 5 ? { tag: 'MAX' } : { label: '$' + houseCost(), fn: buyHouse, afford: F.money >= houseCost() } });
    rows.push({ emoji: '🚜', name: 'Buy a Tractor', desc: F.upgrades.tractor ? 'Owned — tap the field to drive it and round up the flock.' : 'Tap the field to send it herding sheep into your pens.', act: F.upgrades.tractor ? { tag: 'Owned' } : { label: '$650', fn: buyTractor, afford: F.money >= 650 } });
    rows.push({ emoji: '🚧', name: 'Build a Pen', desc: 'Drops a fenced pen — drag the ✥ handle to move it, tap a wall to move the gate, tap the Lv badge to upgrade.', act: { label: '$' + PEN_COST, fn: buyPen, afford: F.money >= PEN_COST } });
    rows.push({ emoji: '🌱', name: 'Expand the Farm', desc: 'Bigger paddock, +5 sheep cap, +wool price (Lv ' + F.farmLevel + '→' + (F.farmLevel + 1) + ').', act: { label: '$' + expandCost(), fn: buyExpand, afford: F.money >= expandCost() } });
    rows.push({ emoji: '💧', name: 'Economical Power (water wheel)', desc: F.power === 'economical' ? 'Running — slowly tops up water.' : 'Slowly tops up water. Cheap to run.', act: F.power === 'economical' ? { tag: 'Running' } : { label: '$180', fn: () => buyPower('economical'), afford: F.money >= 180 } });
    rows.push({ emoji: '⚡', name: 'Electric Power', desc: F.power === 'electric' ? 'Running — fast, but electricity costs money.' : 'Auto-tops feed & water FAST — but the power bill nibbles your money.', act: F.power === 'electric' ? { tag: 'Running' } : { label: '$340', fn: () => buyPower('electric'), afford: F.money >= 340 } });
    for (const k of ['winnie', 'tia']) { const d = DOGS[k]; rows.push({ emoji: k === 'winnie' ? '🐩' : '🦴', name: d.name + (k === 'winnie' ? ' (poodle)' : ' (schnauzer)'), desc: d.desc, act: F.dogs[k] ? { tag: 'Owned' } : { label: '$' + d.cost, fn: () => buyDog(k), afford: F.money >= d.cost } }); }
    for (const r of rows) {
      const div = document.createElement('div'); div.className = 'shop-item';
      const action = r.act.tag ? '<span class="si-tag ' + (r.act.tag === 'Owned' || r.act.tag === 'Running' || r.act.tag === 'MAX' ? 'equipped' : 'lockmsg') + '">' + r.act.tag + '</span>' : '<button class="si-buy" ' + (r.act.afford ? '' : 'disabled') + '>' + r.act.label + '</button>';
      div.innerHTML = '<div class="si-emoji">' + r.emoji + '</div><div class="si-body"><div class="si-name">' + r.name + '</div><div class="si-desc">' + r.desc + '</div></div><div class="si-action">' + action + '</div>';
      if (r.act.fn && r.act.afford) div.querySelector('.si-buy').onclick = () => { r.act.fn(); renderShop(); updateHud(); }; list.appendChild(div);
    }
  }
  function buySheep(b) { const c = sheepCost(b); if (F.money < c || sheep.length >= F.sheepCap) return; F.money -= c; sheep.push(makeSheep({ breed: b, role: rollRole(), wool: 0 })); toast('🐑 New ' + BREEDS[b].name + '!'); sfx.pop(); persist(); }
  function buyExpand() { const c = expandCost(); if (F.money < c) return; F.money -= c; F.farmLevel++; F.sheepCap += 5; layout(); toast('🌱 Farm expanded! More room, more sheep!'); confetti(W / 2, H * 0.4, ['🌱', '🎉', '🐑']); sfx.up(); persist(); }
  function buyPower(m) { const cost = m === 'electric' ? 340 : 180; if (F.money < cost) return; F.money -= cost; F.power = m; toast('Power set to ' + m); sfx.pop(); persist(); }
  function buyDog(k) { const d = DOGS[k]; if (F.money < d.cost || F.dogs[k]) return; F.money -= d.cost; F.dogs[k] = true; rebuildDogs(); toast('🐾 ' + d.name + ' joined the farm!'); confetti(W / 2, H * 0.4, ['🐾', '🎉']); sfx.up(); persist(); }
  function buyTractor() { if (F.money < 650 || F.upgrades.tractor) return; F.money -= 650; F.upgrades.tractor = true; tractor = makeTractor(); toast('🚜 Tractor delivered! Tap the field to drive it.'); sfx.up(); persist(); }
  function buyHouse() { const c = houseCost(); if (F.money < c || F.house.level >= 5) return; F.money -= c; F.house.level++; toast('🏠 Farmhouse upgraded to Lv ' + F.house.level + '!'); confetti(house.x, house.y, ['🏠', '⭐', '✨']); sfx.up(); persist(); }
  function buyPen() { if (F.money < PEN_COST) return; F.money -= PEN_COST; const pen = { x: paddock.x + paddock.w / 2 - 65, y: paddock.y + paddock.h / 2 - 50, w: 130, h: 100, gateOpen: true, gateSide: 0, level: 1, _init: true }; F.pens.push(pen); placing = pen; closeShop(); toast('🚧 Drag the pen into place, then tap to drop it.'); persist(); }
  function upgradePen(p) {
    if (p.level >= 4) { toast('This pen is maxed out!'); return; }
    const cost = 150 * p.level;
    if (F.money < cost) { toast('Need $' + cost + ' to upgrade this pen'); sfx.err(); return; }
    F.money -= cost; p.level++;
    p.w = clamp(p.w + 16, 80, paddock.w - 20); p.h = clamp(p.h + 12, 70, paddock.h - 20);
    p.x = clamp(p.x, paddock.x + 4, paddock.x + paddock.w - p.w - 4); p.y = clamp(p.y, paddock.y + 4, paddock.y + paddock.h - p.h - 4);
    toast('🚧 Pen upgraded to Lv ' + p.level + (p.level >= 2 ? ' — auto-feeds inside!' : '!')); confetti(p.x + p.w / 2, p.y, ['🚧', '⭐']); sfx.up(); persist(); updateHud();
  }

  // ---------- loop ----------
  let lastT = performance.now(), lastErr = null;
  function frame(nt) { let dt = (nt - lastT) / 16.6667; lastT = nt; dt = clamp(dt, 0, 2.5); try { update(dt); render(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  window.addEventListener('beforeunload', persist);
  resize(); requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__farm = {
      start: startGame, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return F ? { running, money: Math.floor(F.money), wool: Math.floor(F.wool), sheep: sheep.length, cap: F.sheepCap, feed: Math.floor(F.feed), water: Math.floor(F.water), level: F.farmLevel, house: F.house.level, power: F.power, dogs: Object.keys(F.dogs).filter(k => F.dogs[k]), tractor: !!tractor, pens: F.pens.length, penLevels: F.pens.map(p => p.level), foxes: foxes.length, lambs: sheep.filter(s => s.role === 'lamb').length, rams: sheep.filter(s => s.role === 'ram').length, ewes: sheep.filter(s => s.role === 'ewe').length } : { running }; },
      lastErr() { return lastErr ? String(lastErr && lastErr.stack || lastErr) : null; },
      give(m) { F.money += m; updateHud(); }, feed: refillFeed, water: refillWater, sell: sellWool,
      forceWool() { for (const s of sheep) if (s.role !== 'lamb') s.wool = 100; }, shearAll() { for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb') { if (!insideAnyPen(s.x, s.y)) { s.x = F.pens[0] ? F.pens[0].x + F.pens[0].w / 2 : s.x; s.y = F.pens[0] ? F.pens[0].y + F.pens[0].h / 2 : s.y; } shearSheep(s); } },
      spawnFox() { foxTimer = -5; }, pushFox() { foxes.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false, dead: false, facing: 1 }); },
      killFox() { if (foxes[0] && dogs[0]) catchFox(foxes[0], dogs[0]); },
      forceBreed() { breedTimer = 0; for (const s of sheep) s.breedCD = 0; }, starve() { for (const s of sheep) { s.hunger = 100; s.thirst = 100; } F.feed = 0; F.water = 0; },
      buyTractor, buyPen, buyHouse, herdTo, expand: buyExpand,
      penInfo() { return F.pens.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), w: p.w, h: p.h, gate: p.gateSide, open: p.gateOpen, level: p.level })); },
      moveGate(i, side) { if (F.pens[i]) F.pens[i].gateSide = side; }, upgradePen(i) { if (F.pens[i]) upgradePen(F.pens[i]); },
      dropPlacing() { placing = null; }, tutorial: startTutorial,
      flockSpread() { if (sheep.length < 2) return 0; let cx = 0, cy = 0; for (const s of sheep) { cx += s.x; cy += s.y; } cx /= sheep.length; cy /= sheep.length; let d = 0; for (const s of sheep) d += Math.hypot(s.x - cx, s.y - cy); return Math.round(d / sheep.length); },
      grassTotal() { let t = 0; for (const gr of grass) t += gr.amt; return Math.round(t); },
      dbg() { return { pens: F.pens.length, placing: !!placing, drag: drag ? drag.type : null, tractor: !!tractor, dogs: dogs.length, grass: grass.length, pops: pops.length }; },
    };
  }
})();
