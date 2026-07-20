/* =====================================================================
   WOOFA SNAKE — a Snake.io-style romp. Woofa's head leads a growing tail.
   Eat frisbees to grow. Cut other snakes off so their head hits your body —
   they burst into food you gobble to get huge. Don't run your own head into
   anyone (or the fence). Pure vanilla canvas, saves best size to localStorage.
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

  // ---------- world ----------
  const WORLD_R = 1500;               // circular arena radius
  const BASE_SPEED = 2.7;
  const TURN = 0.085;
  const START_SIZE = 46;              // path points
  const AI_COUNT = 6;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const angLerp = (a, t, max) => {         // turn a toward t, at most `max`
    let d = ((t - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + clamp(d, -max, max);
  };

  const BEST_KEY = 'woofa_snake_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;

  const AI_COLORS = ['#ff8a3d', '#58e08a', '#a06bff', '#ff5d7a', '#ffd23d', '#4cc9ff', '#f26bff'];
  const AI_NAMES = ['Rex', 'Bella', 'Buddy', 'Coco', 'Max', 'Luna', 'Zeus', 'Ruby'];

  let snakes = [], food = [], cam = { x: 0, y: 0, zoom: 1 };
  let player = null, running = false, tick = 0;

  function radiusFor(size) { return 6.5 + Math.min(size / 55, 9); }

  function makeSnake(opts) {
    const a = rand(0, Math.PI * 2), r = rand(0, WORLD_R * 0.7);
    const x = opts.x != null ? opts.x : Math.cos(a) * r;
    const y = opts.y != null ? opts.y : Math.sin(a) * r;
    const s = {
      points: [], size: opts.size || START_SIZE,
      angle: rand(0, Math.PI * 2), targetAngle: 0,
      speed: BASE_SPEED, boosting: false,
      isPlayer: !!opts.isPlayer, dead: false,
      color: opts.color || '#ff8a3d', name: opts.name || 'Snake',
      wobble: rand(0, 100), aiTimer: 0,
    };
    s.targetAngle = s.angle;
    for (let i = 0; i < s.size; i++) s.points.push({ x: x - Math.cos(s.angle) * i * 3, y: y - Math.sin(s.angle) * i * 3 });
    return s;
  }

  function reset() {
    snakes = []; food = []; tick = 0;
    player = makeSnake({ isPlayer: true, color: '#1c1c22', x: 0, y: 0 });
    snakes.push(player);
    for (let i = 0; i < AI_COUNT; i++) {
      snakes.push(makeSnake({ color: AI_COLORS[i % AI_COLORS.length], name: AI_NAMES[i % AI_NAMES.length], size: rand(40, 90) }));
    }
    for (let i = 0; i < 320; i++) spawnFood();
    cam.x = player.points[0].x; cam.y = player.points[0].y;
    running = true;
    hideOverlays();
    updateHud();
  }

  function spawnFood(x, y, color, big) {
    if (x == null) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (WORLD_R - 30);
      x = Math.cos(a) * r; y = Math.sin(a) * r;
    }
    food.push({ x, y, r: big ? 6.5 : rand(3.5, 5), color: color || pickFoodColor(), value: big ? 5 : 3, ph: rand(0, 6) });
  }
  function pickFoodColor() {
    const c = ['#ff8a3d', '#ffd23d', '#58e08a', '#a06bff', '#4cc9ff']; return c[(Math.random() * c.length) | 0];
  }

  // ---------- input ----------
  const pointer = { x: W / 2, y: H / 2, active: false };
  let steering = false;
  function setPointer(e) {
    const t = e.touches ? e.touches[0] : e;
    pointer.x = t.clientX; pointer.y = t.clientY;
  }
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); steering = true; setPointer(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); setPointer(e); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); if (!e.touches.length) steering = false; }, { passive: false });
  canvas.addEventListener('mousedown', (e) => { steering = true; setPointer(e); });
  window.addEventListener('mousemove', (e) => { if (steering) setPointer(e); });
  window.addEventListener('mouseup', () => { steering = false; });

  // boost button
  const boostBtn = document.getElementById('boostBtn');
  const setBoost = (v) => { if (player) player.boosting = v; boostBtn.classList.toggle('on', v); };
  boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setBoost(true); }, { passive: false });
  boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); setBoost(false); }, { passive: false });
  boostBtn.addEventListener('mousedown', () => setBoost(true));
  window.addEventListener('mouseup', () => setBoost(false));
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') setBoost(true); });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') setBoost(false); });

  // ---------- update ----------
  function update(dt) {
    if (!running) return;
    tick += dt;
    const head = player.points[0];

    // player steering: aim head toward pointer direction from screen centre
    if (steering) {
      player.targetAngle = Math.atan2(pointer.y - H / 2, pointer.x - W / 2);
    }

    for (const s of snakes) {
      if (s.dead) continue;
      if (!s.isPlayer) aiThink(s);
      // turn toward target
      const turn = TURN * (s.boosting ? 1.5 : 1);
      s.angle = angLerp(s.angle, s.targetAngle, turn * dt);
      // boost consumes length
      let sp = s.speed * (s.boosting && s.size > 60 ? 1.85 : 1);
      if (s.boosting && s.size > 60) {
        s.size -= 0.28 * dt;
        if (Math.random() < 0.15 * dt) { const tp = s.points[s.points.length - 1]; spawnFood(tp.x, tp.y, s.isPlayer ? '#ffd23d' : s.color); }
      } else s.boosting = s.boosting && false;

      // move head
      const nx = s.points[0].x + Math.cos(s.angle) * sp * dt;
      const ny = s.points[0].y + Math.sin(s.angle) * sp * dt;
      s.points.unshift({ x: nx, y: ny });
      const want = Math.max(START_SIZE, Math.floor(s.size));
      while (s.points.length > want) s.points.pop();

      // arena fence — die if you cross it
      if (nx * nx + ny * ny > WORLD_R * WORLD_R) killSnake(s, 'fence');
    }

    // eat food
    for (const s of snakes) {
      if (s.dead) continue;
      const h = s.points[0], rr = radiusFor(s.size) + 10;
      for (let i = food.length - 1; i >= 0; i--) {
        const f = food[i];
        if (dist2(h.x, h.y, f.x, f.y) < rr * rr) { s.size += f.value; food.splice(i, 1); }
      }
    }
    while (food.length < 320) spawnFood();

    // collisions: head vs other bodies
    for (const s of snakes) {
      if (s.dead) continue;
      const h = s.points[0], hr = radiusFor(s.size);
      for (const o of snakes) {
        if (o === s || o.dead) continue;
        const orad = radiusFor(o.size) + hr;
        const step = Math.max(2, Math.floor(orad / 6));
        for (let i = 6; i < o.points.length; i += step) {
          if (dist2(h.x, h.y, o.points[i].x, o.points[i].y) < orad * orad) { killSnake(s, 'crash'); break; }
        }
        if (s.dead) break;
      }
    }

    // respawn dead AI to keep the arena busy
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (s.dead && !s.isPlayer) {
        s.respawnT = (s.respawnT || 0) + dt;
        if (s.respawnT > 90) snakes[i] = makeSnake({ color: s.color, name: s.name, size: rand(40, 70) });
      }
    }

    // camera follows player, zooms out as it grows
    const targetZoom = clamp(1.15 - player.size / 1400, 0.62, 1.15);
    cam.zoom += (targetZoom - cam.zoom) * 0.04 * dt;
    cam.x += (player.points[0].x - cam.x) * 0.14 * dt;
    cam.y += (player.points[0].y - cam.y) * 0.14 * dt;

    if (player.dead && running) endGame();
    if ((tick | 0) % 6 === 0) updateHud();
  }

  function aiThink(s) {
    s.aiTimer -= 1;
    const h = s.points[0];
    if (s.aiTimer <= 0) {
      s.aiTimer = rand(20, 55);
      // mostly hunt nearest food; sometimes wander
      let bx = null, by = null, bd = 1e12;
      for (let i = 0; i < food.length; i += 5) {
        const d = dist2(h.x, h.y, food[i].x, food[i].y);
        if (d < bd) { bd = d; bx = food[i].x; by = food[i].y; }
      }
      if (bx != null && Math.random() < 0.85) s.targetAngle = Math.atan2(by - h.y, bx - h.x);
      else s.targetAngle = s.angle + rand(-1, 1);
      s.boosting = Math.random() < 0.15 && s.size > 80;
    }
    // avoid the fence: if heading near the edge, steer inward
    const rr = Math.hypot(h.x, h.y);
    if (rr > WORLD_R - 160) s.targetAngle = Math.atan2(-h.y, -h.x) + rand(-0.4, 0.4);
    // dodge the player's body if very close ahead
    if (Math.random() < 0.3) {
      const ph = player.points;
      for (let i = 8; i < ph.length; i += 10) {
        if (dist2(h.x, h.y, ph[i].x, ph[i].y) < 60 * 60) { s.targetAngle += 0.5; break; }
      }
    }
  }

  function killSnake(s, cause) {
    if (s.dead) return;
    s.dead = true; s.respawnT = 0;
    // scatter its body as food
    for (let i = 0; i < s.points.length; i += 4) {
      const p = s.points[i];
      spawnFood(p.x + rand(-6, 6), p.y + rand(-6, 6), s.isPlayer ? '#ffd23d' : s.color, true);
    }
    if (s.isPlayer) { /* handled in update -> endGame */ }
  }

  // ---------- render ----------
  function worldToScreen(x, y) {
    return { x: (x - cam.x) * cam.zoom + W / 2, y: (y - cam.y) * cam.zoom + H / 2 };
  }

  function render() {
    // background
    ctx.fillStyle = '#0c1a12';
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const g = 70 * cam.zoom;
    const ox = (W / 2 - cam.x * cam.zoom) % g;
    const oy = (H / 2 - cam.y * cam.zoom) % g;
    ctx.beginPath();
    for (let x = ox; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = oy; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    // arena fence
    const c = worldToScreen(0, 0);
    ctx.beginPath();
    ctx.arc(c.x, c.y, WORLD_R * cam.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,90,90,0.55)';
    ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,90,0.12)';
    ctx.lineWidth = 24; ctx.stroke();

    // food
    for (const f of food) {
      const p = worldToScreen(f.x, f.y);
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      const pr = (f.r + Math.sin(tick / 10 + f.ph) * 0.6) * cam.zoom;
      ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, 7);
      ctx.fillStyle = f.color; ctx.fill();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(p.x, p.y, pr * 1.8, 0, 7); ctx.fillStyle = f.color; ctx.fill(); ctx.globalAlpha = 1;
    }

    // snakes: bodies first (far to near not critical), then heads
    const alive = snakes.filter((s) => !s.dead);
    for (const s of alive) if (!s.isPlayer) drawBody(s);
    drawBody(player);
    for (const s of alive) if (!s.isPlayer) drawHead(s);
    drawHead(player);
  }

  function drawBody(s) {
    const r = radiusFor(s.size) * cam.zoom;
    if (s.points.length < 2) return;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < s.points.length; i++) {
      const p = worldToScreen(s.points[i].x, s.points[i].y);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    // outline
    ctx.strokeStyle = s.isPlayer ? '#000' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = r * 2 + 3; ctx.stroke();
    // fill
    ctx.strokeStyle = s.isPlayer ? '#22222a' : s.color;
    ctx.lineWidth = r * 2; ctx.stroke();
    // player belly stripe
    if (s.isPlayer) {
      ctx.strokeStyle = 'rgba(243,241,234,0.28)';
      ctx.lineWidth = r * 0.7; ctx.stroke();
    }
  }

  function drawHead(s) {
    const p = worldToScreen(s.points[0].x, s.points[0].y);
    const r = radiusFor(s.size) * cam.zoom * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(s.angle);
    if (s.isPlayer) drawWoofaHead(r, s);
    else drawAiHead(r, s);
    ctx.restore();
    // name + size tag for AI
    if (!s.isPlayer) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(Math.floor(s.size), p.x, p.y - r - 5);
    }
  }

  // Woofa's head — mostly black, white muzzle, black eye mask, floppy ear
  function drawWoofaHead(r, s) {
    const u = r / 14;   // unit scale to the head art
    const BLACK = '#1a1a1e', WHITE = '#f3f1ea';
    // ear (floppy, trails a touch)
    ctx.fillStyle = '#26262c';
    ctx.beginPath(); ctx.ellipse(-6 * u, -9 * u, 6 * u, 9 * u, -0.5, 0, 7); ctx.fill();
    // black skull
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(0, 0, 15 * u, 13 * u, 0, 0, 7); ctx.fill();
    // white muzzle out front (+x is forward)
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(4 * u, -6 * u);
    ctx.quadraticCurveTo(22 * u, -5 * u, 24 * u, 0);
    ctx.quadraticCurveTo(22 * u, 6 * u, 4 * u, 7 * u);
    ctx.quadraticCurveTo(0, 0, 4 * u, -6 * u);
    ctx.fill();
    // black eye mask
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(2 * u, -1 * u, 7 * u, 6 * u, 0, 0, 7); ctx.fill();
    // eyes (two, looking forward)
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath(); ctx.arc(6 * u, -5 * u, 2.4 * u, 0, 7); ctx.arc(6 * u, 5 * u, 2.4 * u, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(7 * u, -5.6 * u, 0.9 * u, 0, 7); ctx.arc(7 * u, 4.4 * u, 0.9 * u, 0, 7); ctx.fill();
    // nose
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(24 * u, 0, 3.2 * u, 0, 7); ctx.fill();
    // tongue when boosting
    if (s.boosting) {
      ctx.fillStyle = '#e0607a';
      ctx.beginPath(); ctx.ellipse(28 * u, 0, 5 * u, 2.4 * u, 0, 0, 7); ctx.fill();
    }
  }

  function drawAiHead(r, s) {
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.4, r * 0.32, 0, 7); ctx.arc(r * 0.5, r * 0.4, r * 0.32, 0, 7); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(r * 0.65, -r * 0.4, r * 0.16, 0, 7); ctx.arc(r * 0.65, r * 0.4, r * 0.16, 0, 7); ctx.fill();
  }

  // ---------- HUD / overlays ----------
  const sizeEl = document.getElementById('snSize');
  const bestEl = document.getElementById('snBest');
  const rankEl = document.getElementById('snRank');
  function updateHud() {
    if (!player) return;
    sizeEl.textContent = Math.floor(player.dead ? player.finalSize || 0 : player.size);
    bestEl.textContent = best;
    const alive = snakes.filter((s) => !s.dead).sort((a, b) => b.size - a.size);
    const rank = alive.indexOf(player) + 1;
    rankEl.textContent = player.dead ? '—' : `#${rank}/${alive.length}`;
  }

  const startScreen = document.getElementById('startScreen');
  const overScreen = document.getElementById('overScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); overScreen.classList.add('hidden'); }
  function endGame() {
    running = false;
    player.finalSize = Math.floor(player.size);
    if (player.finalSize > best) { best = player.finalSize; localStorage.setItem(BEST_KEY, String(best)); }
    document.getElementById('overSize').textContent = player.finalSize;
    document.getElementById('overBest').textContent = best;
    updateHud();
    setTimeout(() => overScreen.classList.remove('hidden'), 500);
  }

  document.getElementById('snakePlay').onclick = reset;
  document.getElementById('snakeAgain').onclick = reset;

  // ---------- loop ----------
  let lastT = performance.now();
  function frame(now) {
    let dt = (now - lastT) / 16.6667; lastT = now;
    dt = clamp(dt, 0, 2.5);
    update(dt); render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug hook (inert unless #debug)
  if (location.hash.indexOf('debug') !== -1) {
    window.__snake = { reset, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return { running, size: player && player.size | 0, snakes: snakes.filter(s => !s.dead).length, food: food.length, dead: player && player.dead }; } };
  }
})();
