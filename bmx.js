/* Stick BMX — smooth freestyle ramp game */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const SAVE_KEY = "woofa_stick_bmx_v1";

  // ─── Input ───────────────────────────────────────────────────────────
  const keys = Object.create(null);
  const touch = { gas: false, brake: false, flipUp: false, flipDown: false, jump: false, trick: false, jumpPressed: false, trickPressed: false };

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (e.code === "Space") touch.jumpPressed = true;
    if (e.code === "KeyT" || e.code === "KeyJ") touch.trickPressed = true;
  }, { passive: false });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  function bindPad() {
    document.querySelectorAll(".touch .btn").forEach((btn) => {
      const k = btn.getAttribute("data-k");
      const set = (v) => {
        touch[k] = v;
        btn.classList.toggle("held", v);
        if (v && k === "jump") touch.jumpPressed = true;
        if (v && k === "trick") touch.trickPressed = true;
      };
      const on = (e) => { e.preventDefault(); set(true); };
      const off = (e) => { e.preventDefault(); set(false); };
      btn.addEventListener("pointerdown", on);
      btn.addEventListener("pointerup", off);
      btn.addEventListener("pointerleave", off);
      btn.addEventListener("pointercancel", off);
    });
  }
  bindPad();

  function gasHeld() { return !!(keys.ArrowRight || keys.KeyD || touch.gas); }
  function brakeHeld() { return !!(keys.ArrowLeft || keys.KeyA || touch.brake); }
  function flipUpHeld() { return !!(keys.ArrowUp || keys.KeyW || touch.flipUp); }
  function flipDownHeld() { return !!(keys.ArrowDown || keys.KeyS || touch.flipDown); }
  function jumpDown() { return !!(keys.Space || touch.jump); }

  // ─── Terrain (smooth freestyle park line) ────────────────────────────
  // Points define ground polyline y = f(x). Built as big-air progressive park.
  function buildPark() {
    const pts = [];
    let x = 0;
    let y = 420;
    const add = (dx, dy) => { x += dx; y += dy; pts.push({ x, y }); };
    pts.push({ x: 0, y });

    // start pad
    add(280, 0);
    // roll-in
    add(120, 40);
    add(100, 60);
    // small table
    add(160, 0);
    // first kicker
    add(90, -55);
    add(40, -30);
    // gap air
    add(220, 20);
    // landing slope
    add(100, 50);
    add(140, 10);
    // pump bump
    add(80, -25);
    add(80, 25);
    // medium quarter
    add(70, -70);
    add(40, -40);
    add(30, 0);
    // deck
    add(100, 0);
    // drop
    add(40, 30);
    add(80, 70);
    // long rhythm section
    add(100, 0);
    for (let i = 0; i < 3; i++) {
      add(70, -35);
      add(90, 35);
    }
    // BIG kicker approach
    add(160, 0);
    add(140, -40);
    // mega kicker
    add(100, -90);
    add(50, -50);
    // huge air gap
    add(380, 30);
    // steep landing
    add(120, 80);
    add(160, 40);
    // halfpipe left wall
    add(80, 0);
    add(50, -100);
    add(30, -40);
    add(40, 0);
    // coping / transfer
    add(60, 0);
    // down the other side
    add(30, 40);
    add(50, 100);
    // final step-up
    add(140, 0);
    add(110, -70);
    add(50, -45);
    // final canyon
    add(300, 20);
    add(140, 70);
    // finish flats
    add(200, 10);
    add(400, 0);
    add(200, 0);

    // smooth a bit by densifying with catmull-ish samples
    const dense = densify(pts, 18);
    return dense;
  }

  function densify(pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const n = Math.max(1, Math.floor(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        // ease for smoother lips
        const s = t * t * (3 - 2 * t);
        out.push({ x: a.x + dx * s, y: a.y + dy * s });
      }
    }
    return out;
  }

  const terrain = buildPark();
  const parkEnd = terrain[terrain.length - 1].x - 120;

  function groundAt(x) {
    // binary search segment
    let lo = 0, hi = terrain.length - 2;
    if (x <= terrain[0].x) {
      const a = terrain[0], b = terrain[1];
      return sampleSeg(a, b, x);
    }
    if (x >= terrain[terrain.length - 1].x) {
      const a = terrain[terrain.length - 2], b = terrain[terrain.length - 1];
      return sampleSeg(a, b, x);
    }
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (terrain[mid + 1].x < x) lo = mid + 1;
      else hi = mid;
    }
    return sampleSeg(terrain[lo], terrain[lo + 1], x);
  }

  function sampleSeg(a, b, x) {
    const dx = b.x - a.x || 1e-6;
    const t = Math.max(0, Math.min(1, (x - a.x) / dx));
    const y = a.y + (b.y - a.y) * t;
    const ang = Math.atan2(b.y - a.y, dx);
    return { y, ang, nx: -Math.sin(ang), ny: Math.cos(ang) };
  }

  // ─── Rider state ─────────────────────────────────────────────────────
  const TRICKS = [
    { id: "superman", name: "SUPERMAN", points: 400, airOnly: true },
    { id: "nohander", name: "NO-HANDER", points: 280, airOnly: true },
    { id: "barspin", name: "BARSPIN", points: 320, airOnly: true },
    { id: "onefooter", name: "ONE-FOOTER", points: 240, airOnly: true },
    { id: "cancan", name: "CAN-CAN", points: 260, airOnly: true },
    { id: "tabletop", name: "TABLETOP", points: 300, airOnly: true },
  ];

  function defaultRider() {
    const g = groundAt(80);
    return {
      x: 80,
      y: g.y - 14,
      vx: 0,
      vy: 0,
      angle: g.ang,
      av: 0, // angular vel
      grounded: true,
      wheelie: 0,
      dead: false,
      finished: false,
      airTime: 0,
      flipAccum: 0, // radians spun this air
      flips: 0,
      trick: null, // active style trick
      trickT: 0,
      trickQueue: [],
      combo: 1,
      comboTimer: 0,
      score: 0,
      runBestAir: 0,
      crashReason: "",
      invuln: 0.6,
      particles: [],
      trail: [],
    };
  }

  let rider = defaultRider();
  let cam = { x: 0, y: 0 };
  let shake = 0;
  let running = false;
  let lastTs = 0;
  let accum = 0;
  const FIXED = 1 / 120;
  let best = 0;

  try {
    best = Number(JSON.parse(localStorage.getItem(SAVE_KEY) || "{}").best) || 0;
  } catch { best = 0; }

  function saveBest(s) {
    if (s > best) {
      best = s;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ best })); } catch { /* */ }
    }
  }

  // ─── Simulation ──────────────────────────────────────────────────────
  function step(dt) {
    if (!running || rider.dead || rider.finished) return;

    const r = rider;
    r.invuln = Math.max(0, r.invuln - dt);
    r.comboTimer = Math.max(0, r.comboTimer - dt);
    if (r.comboTimer <= 0) r.combo = 1;

    // consume edge presses
    let jumped = touch.jumpPressed || (keys.Space && !r._spaceWas);
    r._spaceWas = !!keys.Space;
    touch.jumpPressed = false;
    let trickTap = touch.trickPressed || ((keys.KeyT || keys.KeyJ) && !r._trickWas);
    r._trickWas = !!(keys.KeyT || keys.KeyJ);
    touch.trickPressed = false;

    const g = groundAt(r.x);
    const footY = g.y - 12;
    const dist = r.y - footY;
    const wasGrounded = r.grounded;

    // Ground detect with a little skin
    if (r.vy >= -20 && dist >= -3 && dist < 18 && r.vy > -80) {
      // check if moving into ground
      const along = Math.cos(g.ang) * r.vx + Math.sin(g.ang) * r.vy;
      const into = -g.nx * r.vx + -g.ny * r.vy; // toward ground if positive-ish
      if (dist > -2) {
        r.grounded = true;
        r.y = footY;
        // kill velocity into ground, keep tangent
        const tx = Math.cos(g.ang), ty = Math.sin(g.ang);
        const spd = r.vx * tx + r.vy * ty;
        r.vx = tx * spd;
        r.vy = ty * spd;
      }
    } else if (dist < -6) {
      r.grounded = false;
    }

    if (r.grounded) {
      // snap angle toward ground
      let da = normAngle(g.ang - r.angle);
      r.angle += da * Math.min(1, 14 * dt);
      r.av *= 0.2;

      // gas / brake along surface
      const tx = Math.cos(g.ang), ty = Math.sin(g.ang);
      let spd = r.vx * tx + r.vy * ty;
      if (gasHeld()) spd += 420 * dt;
      if (brakeHeld()) spd -= 380 * dt;
      // friction + gravity component along slope
      const gAlong = Math.sin(g.ang) * 520;
      spd += gAlong * dt;
      spd *= Math.pow(0.22, dt); // drag-ish — keep flow
      // softer drag so you can keep speed
      spd *= 1 - 0.35 * dt;
      spd = Math.max(-80, Math.min(620, spd));

      r.vx = tx * spd;
      r.vy = ty * spd;

      // bunny hop / lip boost
      if (jumped) {
        const boost = 220 + Math.min(180, Math.abs(spd) * 0.25);
        r.vx += g.nx * boost * 0.15;
        r.vy += g.ny * -boost;
        // slight pop along normal
        r.vx += -g.nx * 40;
        r.vy += -g.ny * 40;
        r.grounded = false;
        r.airTime = 0;
        r.flipAccum = 0;
        r.flips = 0;
        spawnDust(r.x, r.y + 10, 6);
        pulseTrick("POP", false);
      }

      // landing score from previous air
      if (!wasGrounded && r.airTime > 0.18) {
        scoreLanding(r);
      }

      r.airTime = 0;
      r.trick = null;
      r.trickT = 0;
    } else {
      // AIR
      r.airTime += dt;
      r.runBestAir = Math.max(r.runBestAir, r.airTime);

      // gravity
      r.vy += 980 * dt;

      // air rotation — smooth and snappy
      let spin = 0;
      if (flipUpHeld()) spin -= 7.2; // backflip (nose up / CCW if facing right)
      if (flipDownHeld()) spin += 7.2; // frontflip
      // slight auto stability toward velocity direction when not holding
      if (!flipUpHeld() && !flipDownHeld()) {
        const vAng = Math.atan2(r.vy, Math.max(40, r.vx));
        const da = normAngle(vAng - r.angle);
        r.av += da * 1.2 * dt;
      }
      r.av += spin * dt * 10;
      r.av *= Math.pow(0.08, dt);
      r.av = Math.max(-14, Math.min(14, r.av));
      const prev = r.angle;
      r.angle += r.av * dt;
      r.flipAccum += Math.abs(r.angle - prev);

      // style tricks
      if (trickTap || (touch.trick && !r.trick)) {
        startTrick(r);
      }
      if (r.trick) {
        r.trickT += dt;
        if (r.trickT > 0.85) {
          // complete trick for points mid-air
          completeTrick(r);
        }
      }

      // continuous flip credit every full rotation
      while (r.flipAccum >= Math.PI * 2 * 0.92) {
        r.flipAccum -= Math.PI * 2;
        r.flips += 1;
        const name = r.av < 0 ? (r.flips > 1 ? r.flips + "× BACKFLIP" : "BACKFLIP") : (r.flips > 1 ? r.flips + "× FRONTFLIP" : "FRONTFLIP");
        addScore(r, 350 * r.flips, name, true);
      }

      // crash if upside-down into ground hard
      const g2 = groundAt(r.x);
      const foot = g2.y - 12;
      if (r.y >= foot && r.vy > 0) {
        r.y = foot;
        const landAng = normAngle(r.angle - g2.ang);
        const impact = Math.hypot(r.vx, r.vy);
        const bad = Math.abs(landAng) > 1.05 || (Math.abs(landAng) > 0.7 && impact > 420);
        if (bad && r.invuln <= 0) {
          crash(r, Math.abs(landAng) > 1.05 ? "Endo! Stick the landing next time." : "Too hot on the landing.");
        } else {
          // stick it
          r.grounded = true;
          const tx = Math.cos(g2.ang), ty = Math.sin(g2.ang);
          let spd = r.vx * tx + r.vy * ty;
          spd *= 0.92;
          r.vx = tx * spd;
          r.vy = ty * spd;
          r.av = 0;
          if (r.airTime > 0.18) scoreLanding(r);
          r.airTime = 0;
          r.flipAccum = 0;
          r.flips = 0;
          if (r.trick) completeTrick(r);
          spawnDust(r.x, r.y + 8, 10);
          shake = Math.min(10, impact * 0.01);
        }
      }
    }

    // integrate
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    // trail
    if (r.trail.length > 40) r.trail.shift();
    r.trail.push({ x: r.x, y: r.y, a: r.angle });

    // particles
    r.particles = r.particles.filter((p) => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      return p.t < p.life;
    });

    // finish line
    if (r.x >= parkEnd && !r.finished) {
      r.finished = true;
      running = false;
      saveBest(r.score);
      showFinish();
    }

    // fall off world
    if (r.y > 2000 || r.x < -200) {
      crash(r, "Yeeted into the void.");
    }

    updateHud();
  }

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function startTrick(r) {
    if (r.grounded) return;
    if (r.trick) return;
    const t = TRICKS[(Math.random() * TRICKS.length) | 0];
    r.trick = t;
    r.trickT = 0;
    pulseTrick(t.name, true);
  }

  function completeTrick(r) {
    if (!r.trick) return;
    addScore(r, r.trick.points, r.trick.name, true);
    r.trick = null;
    r.trickT = 0;
  }

  function scoreLanding(r) {
    const airPts = Math.floor(r.airTime * 180);
    const flipPts = r.flips * 200;
    const total = airPts + flipPts;
    if (total > 40) {
      addScore(r, total, r.flips ? "CLEAN LANDING" : "STUCK IT", false);
      shake = Math.min(6, r.airTime * 2);
    }
    r.flips = 0;
    r.flipAccum = 0;
  }

  function addScore(r, base, label, big) {
    const pts = Math.floor(base * r.combo);
    r.score += pts;
    r.combo = Math.min(12, r.combo + 0.35);
    r.comboTimer = 3.2;
    pulseTrick(label + "  +" + pts, big);
    updateHud();
  }

  function crash(r, reason) {
    r.dead = true;
    r.crashReason = reason;
    running = false;
    saveBest(r.score);
    shake = 14;
    spawnDust(r.x, r.y, 18);
    document.getElementById("crashMsg").textContent = reason;
    document.getElementById("crashScore").textContent = String(Math.floor(r.score));
    document.getElementById("crashOverlay").classList.remove("hidden");
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      rider.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: -Math.random() * 180,
        t: 0,
        life: 0.4 + Math.random() * 0.5,
        c: Math.random() > 0.5 ? "#c4a070" : "#8a7a5a",
        s: 2 + Math.random() * 3,
      });
    }
  }

  // ─── HUD / UI ────────────────────────────────────────────────────────
  let trickTimer = 0;
  function pulseTrick(name, big) {
    const el = document.getElementById("hudTrick");
    const m = document.getElementById("hudMult");
    el.textContent = name;
    el.className = "name on" + (big ? " big" : "");
    m.textContent = "×" + rider.combo.toFixed(1) + " combo";
    m.className = "mult on";
    trickTimer = 1.1;
  }

  function updateHud() {
    document.getElementById("hudScore").textContent = String(Math.floor(rider.score));
    document.getElementById("hudCombo").textContent = "combo ×" + rider.combo.toFixed(1);
    const spd = Math.min(1, Math.hypot(rider.vx, rider.vy) / 620);
    document.getElementById("hudSpeed").style.height = (spd * 100).toFixed(0) + "%";
  }

  function showFinish() {
    document.getElementById("finishScore").textContent = String(Math.floor(rider.score));
    document.getElementById("finishBest").textContent = "Best: " + Math.floor(best);
    document.getElementById("finishOverlay").classList.remove("hidden");
  }

  function startRun() {
    rider = defaultRider();
    cam = { x: rider.x - 120, y: rider.y - 100 };
    running = true;
    document.getElementById("startOverlay").classList.add("hidden");
    document.getElementById("crashOverlay").classList.add("hidden");
    document.getElementById("finishOverlay").classList.add("hidden");
    document.getElementById("bestLabel").textContent = "Best: " + Math.floor(best);
    updateHud();
  }

  document.getElementById("btnPlay").onclick = startRun;
  document.getElementById("btnHow").onclick = startRun;
  document.getElementById("btnRetry").onclick = startRun;
  document.getElementById("btnAgain").onclick = startRun;
  document.getElementById("bestLabel").textContent = "Best: " + Math.floor(best);

  // ─── Render ──────────────────────────────────────────────────────────
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // camera follow — smooth, look-ahead by speed
    const look = Math.max(80, Math.min(260, rider.vx * 0.35));
    const targetX = rider.x - w * 0.35 + look;
    const targetY = rider.y - h * 0.55;
    const k = running ? 0.08 : 0.12;
    cam.x += (targetX - cam.x) * k;
    cam.y += (targetY - cam.y) * k;
    if (shake > 0) {
      cam.x += (Math.random() - 0.5) * shake;
      cam.y += (Math.random() - 0.5) * shake;
      shake *= 0.88;
    }

    // sky
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1a3a6a");
    grd.addColorStop(0.45, "#2a5a8a");
    grd.addColorStop(0.7, "#6a9bb8");
    grd.addColorStop(1, "#c4a070");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // sun
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,210,61,0.9)";
    ctx.arc(w * 0.78 - cam.x * 0.02, h * 0.18, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // far hills
    drawHills(0.25, "#1e3a2f", 80);
    drawHills(0.4, "#244a38", 50);

    // dirt ground fill
    drawTerrain();

    // finish flag
    drawFinish();

    // particles
    for (const p of rider.particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // motion trail
    if (rider.trail.length > 2) {
      ctx.strokeStyle = "rgba(255,107,44,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < rider.trail.length; i++) {
        const t = rider.trail[i];
        if (i === 0) ctx.moveTo(t.x, t.y);
        else ctx.lineTo(t.x, t.y);
      }
      ctx.stroke();
    }

    // rider
    drawRider(rider);

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawHills(parallax, color, amp) {
    const w = window.innerWidth;
    const base = 500;
    ctx.beginPath();
    ctx.moveTo(cam.x - 50, cam.y + window.innerHeight + 100);
    for (let sx = -50; sx < w + 100; sx += 30) {
      const wx = cam.x + sx;
      const y = base + Math.sin(wx * 0.003 * parallax) * amp + Math.sin(wx * 0.001) * amp * 0.5;
      ctx.lineTo(wx * 0 + cam.x + sx, y); // screen-ish
    }
    // simpler: world space hills
    ctx.beginPath();
    const startX = cam.x - 100;
    const endX = cam.x + w + 100;
    ctx.moveTo(startX, 2000);
    for (let x = startX; x <= endX; x += 40) {
      const y = 480 + Math.sin(x * 0.002 * parallax + parallax * 3) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, 2000);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawTerrain() {
    if (terrain.length < 2) return;
    // fill under
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
    const last = terrain[terrain.length - 1];
    ctx.lineTo(last.x + 50, last.y + 800);
    ctx.lineTo(terrain[0].x - 50, terrain[0].y + 800);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 300, 0, 900);
    g.addColorStop(0, "#5a3a22");
    g.addColorStop(0.4, "#3d2818");
    g.addColorStop(1, "#1a120c");
    ctx.fillStyle = g;
    ctx.fill();

    // grass lip
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i].x, terrain[i].y);
    ctx.strokeStyle = "#3dff9a";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgba(90,60,35,0.9)";
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ramp edge highlights on steep bits
    ctx.strokeStyle = "rgba(255,210,61,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < terrain.length; i++) {
      const a = terrain[i - 1], b = terrain[i];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (Math.abs(ang) > 0.45) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }

  function drawFinish() {
    const x = parkEnd;
    const g = groundAt(x);
    ctx.save();
    ctx.translate(x, g.y);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -80);
    ctx.stroke();
    ctx.fillStyle = "#ff6b2c";
    ctx.fillRect(0, -80, 40, 24);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px system-ui";
    ctx.fillText("END", 8, -64);
    ctx.restore();
  }

  function drawRider(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);

    // crash tumble extra spin visual
    if (r.dead) ctx.rotate(performance.now() / 120);

    const trick = r.trick && r.trick.id;
    // bike geometry in local space: facing +x
    const wheelR = 9;

    // rear wheel
    drawWheel(-12, 8, wheelR, r.x * 0.2);
    // front wheel
    const frontOff = trick === "barspin" ? Math.sin(r.trickT * 20) * 0.5 : 0;
    ctx.save();
    ctx.translate(14, 8);
    ctx.rotate(frontOff * Math.PI * 2);
    drawWheel(0, 0, wheelR, r.x * 0.2 + frontOff * 6);
    ctx.restore();

    // frame
    ctx.strokeStyle = "#e8f0ff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    // rear axle -> bb
    ctx.moveTo(-12, 8);
    ctx.lineTo(-2, 2);
    // bb -> head tube
    ctx.lineTo(10, -2);
    // head -> front axle
    ctx.lineTo(14, 8);
    // top tube
    ctx.moveTo(-2, 2);
    ctx.lineTo(8, -6);
    // seat tube
    ctx.moveTo(-2, 2);
    ctx.lineTo(-6, -10);
    // down tube already
    // bars
    if (trick === "nohander" || trick === "superman") {
      // bars alone
      ctx.moveTo(8, -6);
      ctx.lineTo(12, -12);
    } else {
      ctx.moveTo(8, -6);
      ctx.lineTo(12, -12);
      ctx.moveTo(8, -12);
      ctx.lineTo(16, -12);
    }
    ctx.stroke();

    // pedals spin
    const ped = performance.now() / 80 * (r.grounded ? Math.max(0.5, Math.hypot(r.vx, r.vy) / 100) : 0.3);
    ctx.beginPath();
    ctx.moveTo(-2 + Math.cos(ped) * 5, 2 + Math.sin(ped) * 5);
    ctx.lineTo(-2 - Math.cos(ped) * 5, 2 - Math.sin(ped) * 5);
    ctx.strokeStyle = "#ffd23d";
    ctx.lineWidth = 2;
    ctx.stroke();

    // stick figure rider
    drawStick(r, trick);

    ctx.restore();
  }

  function drawWheel(x, y, rad, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rad - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "#8899aa";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // spokes
    ctx.strokeStyle = "rgba(200,210,220,0.7)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (rad - 2), Math.sin(a) * (rad - 2));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStick(r, trick) {
    ctx.strokeStyle = "#ffe0c0";
    ctx.fillStyle = "#ffe0c0";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";

    // hip / seat position
    let hipX = -5, hipY = -10;
    let headX = -3, headY = -28;
    let handLX = 12, handLY = -12;
    let handRX = 14, handRY = -12;
    let footLX = -6, footLY = 6;
    let footRX = 2, footRY = 6;

    if (trick === "superman") {
      hipX = 0; hipY = -8;
      headX = 18; headY = -14;
      handLX = 22; handLY = -8;
      handRX = 24; handRY = -10;
      footLX = -18; footLY = -4;
      footRX = -16; footRY = 0;
    } else if (trick === "nohander") {
      handLX = -4; handLY = -20;
      handRX = 0; handRY = -22;
    } else if (trick === "onefooter") {
      footRX = 14; footRY = -8;
    } else if (trick === "cancan") {
      footRX = 10; footRY = -14;
      footLX = -8; footLY = 6;
    } else if (trick === "tabletop") {
      // bike already rotated visually by rider lean — tuck legs
      footLX = -2; footLY = 0;
      footRX = 4; footRY = 0;
      hipY = -12;
    } else if (trick === "barspin") {
      handLX = 6; handLY = -8;
      handRX = 10; handRY = -16;
    }

    // body
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(headX, headY + 6);
    ctx.stroke();
    // head
    ctx.beginPath();
    ctx.arc(headX, headY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // arms
    ctx.beginPath();
    ctx.moveTo(headX, headY + 8);
    ctx.lineTo(handLX, handLY);
    ctx.moveTo(headX, headY + 8);
    ctx.lineTo(handRX, handRY);
    ctx.stroke();
    // legs
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footLX, footLY);
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footRX, footRY);
    ctx.stroke();

    // helmet stripe
    ctx.strokeStyle = "#ff6b2c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(headX, headY, 4.5, -2.2, -0.6);
    ctx.stroke();
  }

  // ─── Loop ────────────────────────────────────────────────────────────
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(0.05, dt);
    accum += dt;
    while (accum >= FIXED) {
      step(FIXED);
      accum -= FIXED;
    }
    if (trickTimer > 0) {
      trickTimer -= dt;
      if (trickTimer <= 0) {
        document.getElementById("hudTrick").className = "name";
        document.getElementById("hudMult").className = "mult";
      }
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // expose for debug
  window.__bmx = { rider: () => rider, startRun, groundAt };
})();
