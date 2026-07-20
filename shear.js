/* =====================================================================
   WOOFA SHEARING — Woofa's grown a big woolly coat. Drag the clippers over
   him to shear it all off as FAST as you can. His real colourway is revealed
   underneath. Best time is saved. (Sheer-offs / multiplayer coming later.)
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

  const BEST_KEY = 'woofa_shear_best';
  let best = parseFloat(localStorage.getItem(BEST_KEY) || '0') || 0;

  // Woofa's body as a set of ellipses (in screen space). insideDog() tests them.
  let parts = [], S = 1, cx = 0, cy = 0;
  function layout() {
    S = Math.min(W / 420, H / 620) * 1.15;
    cx = W / 2; cy = H / 2 + 10 * S;
    const u = (x, y) => ({ x: cx + x * S, y: cy + y * S });
    const body = u(0, 0), head = u(120, -46), tail = u(-125, -30);
    parts = [
      { cx: body.x, cy: body.y, rx: 130 * S, ry: 74 * S, rot: 0, kind: 'body' },
      { cx: head.x, cy: head.y, rx: 52 * S, ry: 46 * S, rot: 0, kind: 'head' },
      { cx: u(120, 40).x, cy: u(120, 40).y, rx: 34 * S, ry: 30 * S, rot: 0, kind: 'body' }, // chest
      { cx: tail.x, cy: tail.y, rx: 26 * S, ry: 16 * S, rot: -0.5, kind: 'body' },
      // legs (upper blocks)
      { cx: u(-70, 66).x, cy: u(-70, 66).y, rx: 16 * S, ry: 40 * S, rot: 0, kind: 'leg' },
      { cx: u(-30, 68).x, cy: u(-30, 68).y, rx: 16 * S, ry: 42 * S, rot: 0, kind: 'leg' },
      { cx: u(55, 68).x, cy: u(55, 68).y, rx: 16 * S, ry: 42 * S, rot: 0, kind: 'leg' },
      { cx: u(95, 66).x, cy: u(95, 66).y, rx: 16 * S, ry: 40 * S, rot: 0, kind: 'leg' },
    ];
    rebuildWool();
  }
  function insideDog(x, y) {
    for (const p of parts) {
      const dx = x - p.cx, dy = y - p.cy;
      const c = Math.cos(-p.rot), s = Math.sin(-p.rot);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      if ((rx * rx) / (p.rx * p.rx) + (ry * ry) / (p.ry * p.ry) <= 1) return true;
    }
    return false;
  }

  let wool = [], woolTotal = 0, sheared = 0;
  function rebuildWool() {
    wool = [];
    const gap = 15 * S;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const p of parts) { minx = Math.min(minx, p.cx - p.rx); maxx = Math.max(maxx, p.cx + p.rx); miny = Math.min(miny, p.cy - p.ry); maxy = Math.max(maxy, p.cy + p.ry); }
    for (let y = miny; y <= maxy; y += gap) {
      for (let x = minx; x <= maxx; x += gap) {
        if (insideDog(x, y)) wool.push({ x: x + rand(-3, 3), y: y + rand(-3, 3), r: gap * rand(0.62, 0.82), ph: rand(0, 6), gone: false });
      }
    }
    woolTotal = wool.length; sheared = 0;
  }

  // ---------- state ----------
  let running = false, started = false, done = false, elapsed = 0, tick = 0;
  const clip = { x: -999, y: -999, down: false, moved: false, lastX: 0, lastY: 0 };
  const particles = [];

  function reset() {
    layout(); running = true; started = false; done = false; elapsed = 0;
    particles.length = 0; hideOverlays(); updateHud();
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
  function down(e) { e.preventDefault && e.preventDefault(); const p = pt(e); clip.down = true; clip.x = p.x; clip.y = p.y; clip.lastX = p.x; clip.lastY = p.y; }
  function move(e) { const p = pt(e); if (e.preventDefault && e.touches) e.preventDefault(); clip.x = p.x; clip.y = p.y; }
  function up() { clip.down = false; }
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up, { passive: false });
  canvas.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);

  // ---------- update ----------
  const CLIP_R = () => 30 * S;
  function update(dt) {
    tick += dt;
    if (!running) return;
    const moved = Math.hypot(clip.x - clip.lastX, clip.y - clip.lastY);
    clip.moved = moved > 0.5;
    clip.lastX = clip.x; clip.lastY = clip.y;

    if (clip.down && clip.moved) {
      const r = CLIP_R(), r2 = r * r;
      let cut = 0;
      for (const w of wool) {
        if (w.gone) continue;
        if ((w.x - clip.x) * (w.x - clip.x) + (w.y - clip.y) * (w.y - clip.y) < r2) {
          w.gone = true; sheared++; cut++;
          if (particles.length < 160) for (let i = 0; i < 2; i++) particles.push({ x: w.x, y: w.y, vx: rand(-2, 2), vy: rand(-3, -0.5), life: 1, r: w.r * 0.5 });
        }
      }
      if (cut > 0 && !started) { started = true; }
    }
    if (started && !done) elapsed += dt / 60;   // seconds (60fps)
    // particles
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy += 0.12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) particles.splice(i, 1); }

    if (!done && sheared >= woolTotal && woolTotal > 0) finish();
    if ((tick | 0) % 4 === 0) updateHud();
  }

  function finish() {
    done = true; running = false;
    if (best === 0 || elapsed < best) { best = elapsed; localStorage.setItem(BEST_KEY, best.toFixed(2)); }
    document.getElementById('overTime').textContent = elapsed.toFixed(2) + 's';
    document.getElementById('overBest').textContent = best.toFixed(2) + 's';
    updateHud();
    setTimeout(() => overScreen.classList.remove('hidden'), 500);
  }

  // ---------- render ----------
  function render() {
    ctx.fillStyle = '#101826'; ctx.fillRect(0, 0, W, H);
    // pen floor
    ctx.fillStyle = '#1a2536'; ctx.fillRect(0, cy + 90 * S, W, H);
    drawShornWoofa();
    // wool on top
    for (const w of wool) {
      if (w.gone) continue;
      const wob = Math.sin(tick / 14 + w.ph) * 0.8;
      ctx.fillStyle = '#f4f3ee';
      ctx.beginPath(); ctx.arc(w.x, w.y + wob, w.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath(); ctx.arc(w.x + w.r * 0.3, w.y + w.r * 0.3 + wob, w.r * 0.5, 0, 7); ctx.fill();
    }
    // particles (fluff)
    for (const p of particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = '#f4f3ee'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // clipper cursor
    if (clip.x > -100) {
      ctx.save(); ctx.translate(clip.x, clip.y);
      ctx.fillStyle = clip.down ? '#ffd23d' : 'rgba(255,210,61,0.6)';
      ctx.strokeStyle = '#241a12'; ctx.lineWidth = 2;
      roundRect(-11 * S, -8 * S, 22 * S, 16 * S, 4 * S); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9ccd6'; ctx.fillRect(-3 * S, -16 * S, 6 * S, 8 * S); // blade
      ctx.beginPath(); ctx.arc(0, -16 * S, 8 * S * (clip.down ? 1 : 0.001), -0.4, Math.PI + 0.4); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
      ctx.restore();
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // shorn Woofa in his real colourway: black body, white neck, white socks,
  // white tail tip, black head/eye-mask, white snout.
  function drawShornWoofa() {
    const u = (x, y) => ({ x: cx + x * S, y: cy + y * S });
    const BLACK = '#1a1a1e', WHITE = '#f3f1ea';
    // legs (black upper, white sock)
    ctx.lineCap = 'round'; ctx.lineWidth = 26 * S;
    for (const lx of [-70, -30, 55, 95]) {
      const top = u(lx, 30), mid = u(lx, 66), foot = u(lx, 92);
      ctx.strokeStyle = BLACK; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(mid.x, mid.y); ctx.stroke();
      ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
    }
    // tail (black + white tip)
    ctx.lineWidth = 16 * S;
    const t0 = u(-120, -20), t1 = u(-160, -46), t2 = u(-178, -30);
    ctx.strokeStyle = BLACK; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.quadraticCurveTo(t1.x, t1.y, t2.x, t2.y); ctx.stroke();
    ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.moveTo(u(-170, -40).x, u(-170, -40).y); ctx.lineTo(t2.x, t2.y); ctx.stroke();
    // body (black)
    ctx.fillStyle = BLACK; ellipse(u(0, 0), 130, 74);
    // white neck ring
    ctx.fillStyle = WHITE; ellipse(u(92, -18), 34, 40);
    // head (black)
    ctx.fillStyle = BLACK; ellipse(u(120, -46), 52, 46);
    // white snout
    ctx.fillStyle = WHITE;
    const h = u(120, -46);
    ctx.beginPath();
    ctx.moveTo(h.x + 8 * S, h.y - 20 * S);
    ctx.quadraticCurveTo(h.x + 62 * S, h.y - 14 * S, h.x + 66 * S, h.y + 8 * S);
    ctx.quadraticCurveTo(h.x + 58 * S, h.y + 26 * S, h.x + 8 * S, h.y + 22 * S);
    ctx.quadraticCurveTo(h.x - 2 * S, h.y, h.x + 8 * S, h.y - 20 * S);
    ctx.fill();
    // eye + nose
    ctx.fillStyle = '#0a0a0c'; ellipse(u(126, -50), 5, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ellipse(u(128, -52), 1.6, 1.6);
    ctx.fillStyle = '#111'; ellipse(u(184, -38), 6, 5);
    // ear
    ctx.fillStyle = '#26262c'; ellipse(u(104, -66), 14, 22);
  }
  function ellipse(p, rx, ry) { ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * S, ry * S, 0, 0, 7); ctx.fill(); }

  // ---------- HUD / overlays ----------
  const elTime = document.getElementById('shTime');
  const elPct = document.getElementById('shPct');
  const elBest = document.getElementById('shBest');
  function updateHud() {
    elTime.textContent = elapsed.toFixed(1) + 's';
    elPct.textContent = woolTotal ? Math.round(sheared / woolTotal * 100) + '%' : '0%';
    elBest.textContent = best ? best.toFixed(2) + 's' : '—';
  }
  const startScreen = document.getElementById('startScreen');
  const overScreen = document.getElementById('overScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); overScreen.classList.add('hidden'); }
  document.getElementById('shearPlay').onclick = reset;
  document.getElementById('shearAgain').onclick = reset;

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
    window.__shear = { reset, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return { running, started, done, elapsed: +elapsed.toFixed(2), woolTotal, sheared, pct: woolTotal ? Math.round(sheared / woolTotal * 100) : 0 }; },
      // testing: sweep the clipper across the dog to shear everything
      sweep() { clip.down = true; let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9; for (const p of parts) { minx = Math.min(minx, p.cx - p.rx); maxx = Math.max(maxx, p.cx + p.rx); miny = Math.min(miny, p.cy - p.ry); maxy = Math.max(maxy, p.cy + p.ry); } for (let y = miny; y <= maxy; y += 10 * S) { for (let x = minx; x <= maxx; x += 10 * S) { clip.lastX = clip.x; clip.lastY = clip.y; clip.x = x; clip.y = y; update(1); } } clip.down = false; } };
  }
})();
