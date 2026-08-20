export type TouchState = {
  gas: boolean;
  brake: boolean;
  flipUp: boolean;
  flipDown: boolean;
  jump: boolean;
  trick: boolean;
  jumpPressed: boolean;
  trickPressed: boolean;
};

export type Rider = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  av: number;
  grounded: boolean;
  dead: boolean;
  finished: boolean;
  airTime: number;
  flipAccum: number;
  flips: number;
  trick: { id: string; name: string; points: number } | null;
  trickT: number;
  combo: number;
  comboTimer: number;
  score: number;
  runBestAir: number;
  crashReason: string;
  invuln: number;
  particles: { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number }[];
  trail: { x: number; y: number; a: number }[];
  _spaceWas: boolean;
  _trickWas: boolean;
};

const TRICKS = [
  { id: "superman", name: "SUPERMAN", points: 400 },
  { id: "nohander", name: "NO-HANDER", points: 280 },
  { id: "barspin", name: "BARSPIN", points: 320 },
  { id: "onefooter", name: "ONE-FOOTER", points: 240 },
  { id: "cancan", name: "CAN-CAN", points: 260 },
  { id: "tabletop", name: "TABLETOP", points: 300 },
];

function densify(pts: { x: number; y: number }[], step: number) {
  const out = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.floor(len / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const s = t * t * (3 - 2 * t);
      out.push({ x: a.x + dx * s, y: a.y + dy * s });
    }
  }
  return out;
}

function buildPark() {
  const pts: { x: number; y: number }[] = [];
  let x = 0;
  let y = 420;
  const add = (dx: number, dy: number) => {
    x += dx;
    y += dy;
    pts.push({ x, y });
  };
  pts.push({ x: 0, y });
  add(280, 0);
  add(120, 40);
  add(100, 60);
  add(160, 0);
  add(90, -55);
  add(40, -30);
  add(220, 20);
  add(100, 50);
  add(140, 10);
  add(80, -25);
  add(80, 25);
  add(70, -70);
  add(40, -40);
  add(30, 0);
  add(100, 0);
  add(40, 30);
  add(80, 70);
  add(100, 0);
  for (let i = 0; i < 3; i++) {
    add(70, -35);
    add(90, 35);
  }
  add(160, 0);
  add(140, -40);
  add(100, -90);
  add(50, -50);
  add(380, 30);
  add(120, 80);
  add(160, 40);
  add(80, 0);
  add(50, -100);
  add(30, -40);
  add(40, 0);
  add(60, 0);
  add(30, 40);
  add(50, 100);
  add(140, 0);
  add(110, -70);
  add(50, -45);
  add(300, 20);
  add(140, 70);
  add(200, 10);
  add(400, 0);
  add(200, 0);
  return densify(pts, 18);
}

export const terrain = buildPark();
export const parkEnd = terrain[terrain.length - 1]!.x - 120;

function sampleSeg(a: { x: number; y: number }, b: { x: number; y: number }, x: number) {
  const dx = b.x - a.x || 1e-6;
  const t = Math.max(0, Math.min(1, (x - a.x) / dx));
  const y = a.y + (b.y - a.y) * t;
  const ang = Math.atan2(b.y - a.y, dx);
  return { y, ang, nx: -Math.sin(ang), ny: Math.cos(ang) };
}

export function groundAt(x: number) {
  if (x <= terrain[0]!.x) return sampleSeg(terrain[0]!, terrain[1]!, x);
  if (x >= terrain[terrain.length - 1]!.x) {
    return sampleSeg(terrain[terrain.length - 2]!, terrain[terrain.length - 1]!, x);
  }
  let lo = 0, hi = terrain.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (terrain[mid + 1]!.x < x) lo = mid + 1;
    else hi = mid;
  }
  return sampleSeg(terrain[lo]!, terrain[lo + 1]!, x);
}

export function defaultRider(): Rider {
  const g = groundAt(80);
  return {
    x: 80, y: g.y - 18, vx: 0, vy: 0, angle: g.ang, av: 0,
    grounded: true, dead: false, finished: false, airTime: 0, flipAccum: 0, flips: 0,
    trick: null, trickT: 0, combo: 1, comboTimer: 0, score: 0, runBestAir: 0,
    crashReason: "", invuln: 0.6, particles: [], trail: [], _spaceWas: false, _trickWas: false,
  };
}

function normAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export type BmxHooks = {
  pulseTrick: (name: string, big: boolean) => void;
  onCrash: (reason: string, score: number) => void;
  onFinish: (score: number) => void;
  saveBest: (score: number) => void;
};

export function stepRider(
  r: Rider,
  dt: number,
  keys: Record<string, boolean>,
  touch: TouchState,
  running: boolean,
  hooks: BmxHooks,
): boolean {
  if (!running || r.dead || r.finished) return running;
  r.invuln = Math.max(0, r.invuln - dt);
  r.comboTimer = Math.max(0, r.comboTimer - dt);
  if (r.comboTimer <= 0) r.combo = 1;

  const gasHeld = !!(keys.ArrowRight || keys.KeyD || touch.gas);
  const brakeHeld = !!(keys.ArrowLeft || keys.KeyA || touch.brake);
  const flipUpHeld = !!(keys.ArrowUp || keys.KeyW || touch.flipUp);
  const flipDownHeld = !!(keys.ArrowDown || keys.KeyS || touch.flipDown);
  let jumped = touch.jumpPressed || (keys.Space && !r._spaceWas);
  r._spaceWas = !!keys.Space;
  touch.jumpPressed = false;
  let trickTap = touch.trickPressed || ((keys.KeyT || keys.KeyJ) && !r._trickWas);
  r._trickWas = !!(keys.KeyT || keys.KeyJ);
  touch.trickPressed = false;

  const wasGrounded = r.grounded;
  const WHEEL = 18;

  const addScore = (base: number, label: string, big: boolean) => {
    const pts = Math.floor(base * r.combo);
    r.score += pts;
    r.combo = Math.min(12, r.combo + 0.35);
    r.comboTimer = 3.2;
    hooks.pulseTrick(label + "  +" + pts, big);
  };

  const spawnDust = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      r.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: -Math.random() * 180,
        t: 0,
        life: 0.4 + Math.random() * 0.5,
        c: Math.random() > 0.5 ? "#c4a070" : "#8a7a5a",
        s: 2 + Math.random() * 3,
      });
    }
  };

  if (!r.grounded) {
    r.vy += 980 * dt;
    let spin = 0;
    if (flipUpHeld) spin -= 8.5;
    if (flipDownHeld) spin += 8.5;
    if (!flipUpHeld && !flipDownHeld) {
      const vAng = Math.atan2(r.vy, Math.max(50, r.vx));
      const da = normAngle(vAng - r.angle);
      r.av += da * 1.4 * dt;
    }
    r.av += spin * dt * 11;
    r.av *= Math.pow(0.05, dt);
    r.av = Math.max(-16, Math.min(16, r.av));
    const prevA = r.angle;
    r.angle += r.av * dt;
    r.flipAccum += Math.abs(r.angle - prevA);
    r.airTime += dt;
    r.runBestAir = Math.max(r.runBestAir, r.airTime);
    if ((trickTap || (touch.trick && !r.trick)) && !r.trick) {
      const t = TRICKS[(Math.random() * TRICKS.length) | 0]!;
      r.trick = t;
      r.trickT = 0;
      hooks.pulseTrick(t.name, true);
    }
    if (r.trick) {
      r.trickT += dt;
      if (r.trickT > 0.8) {
        addScore(r.trick.points, r.trick.name, true);
        r.trick = null;
        r.trickT = 0;
      }
    }
    while (r.flipAccum >= Math.PI * 2 * 0.9) {
      r.flipAccum -= Math.PI * 2;
      r.flips += 1;
      const name = r.av < 0
        ? r.flips > 1 ? r.flips + "× BACKFLIP" : "BACKFLIP"
        : r.flips > 1 ? r.flips + "× FRONTFLIP" : "FRONTFLIP";
      addScore(350 * r.flips, name, true);
    }
  } else {
    const g0 = groundAt(r.x);
    let da = normAngle(g0.ang - r.angle);
    r.angle += da * Math.min(1, 16 * dt);
    r.av *= 0.15;
    const tx = Math.cos(g0.ang), ty = Math.sin(g0.ang);
    let spd = r.vx * tx + r.vy * ty;
    if (gasHeld) spd += 520 * dt;
    if (brakeHeld) spd -= 460 * dt;
    spd += Math.sin(g0.ang) * 560 * dt;
    spd *= Math.exp(-0.55 * dt);
    if (!gasHeld && !brakeHeld) spd *= Math.exp(-0.25 * dt);
    spd = Math.max(-100, Math.min(680, spd));
    r.vx = tx * spd;
    r.vy = ty * spd;
    if (jumped) {
      const boost = 280 + Math.min(220, Math.abs(spd) * 0.3);
      r.vx += -g0.nx * boost;
      r.vy += -g0.ny * boost;
      r.vx += tx * Math.max(0, spd) * 0.1;
      r.vy += ty * Math.max(0, spd) * 0.1;
      r.grounded = false;
      r.airTime = 0;
      r.flipAccum = 0;
      r.flips = 0;
      spawnDust(r.x, r.y + 8, 7);
      hooks.pulseTrick("POP", false);
    } else {
      r.airTime = 0;
      r.trick = null;
      r.trickT = 0;
    }
  }

  r.x += r.vx * dt;
  r.y += r.vy * dt;

  {
    const g = groundAt(r.x);
    const surface = g.y - WHEEL;
    const pen = r.y - surface;
    if (pen > -2.5) {
      const nUpX = -g.nx, nUpY = -g.ny;
      const vInto = -(r.vx * nUpX + r.vy * nUpY);
      if (r.grounded || vInto > -30 || pen > 0) {
        if (pen > -1) {
          r.y = surface;
          const tx = Math.cos(g.ang), ty = Math.sin(g.ang);
          let spd = r.vx * tx + r.vy * ty;
          if (!r.grounded && pen > 0) {
            const landAng = Math.abs(normAngle(r.angle - g.ang));
            const impact = Math.hypot(r.vx, r.vy);
            const bad = landAng > 1.1 || (landAng > 0.75 && impact > 480);
            if (bad && r.invuln <= 0 && r.airTime > 0.12) {
              r.dead = true;
              r.crashReason = landAng > 1.1 ? "Endo! Stick the landing next time." : "Too hot on the landing.";
              hooks.saveBest(r.score);
              spawnDust(r.x, r.y, 18);
              hooks.onCrash(r.crashReason, r.score);
              return false;
            }
            if (!wasGrounded && r.airTime > 0.18) {
              const airPts = Math.floor(r.airTime * 180);
              const flipPts = r.flips * 200;
              const total = airPts + flipPts;
              if (total > 40) addScore(total, r.flips ? "CLEAN LANDING" : "STUCK IT", false);
              r.flips = 0;
              r.flipAccum = 0;
            }
            if (r.trick) {
              addScore(r.trick.points, r.trick.name, true);
              r.trick = null;
              r.trickT = 0;
            }
            spawnDust(r.x, r.y + 6, 9);
            spd *= 0.94;
            r.flips = 0;
            r.flipAccum = 0;
            r.airTime = 0;
          }
          r.vx = tx * spd;
          r.vy = ty * spd;
          r.grounded = true;
          r.angle += normAngle(g.ang - r.angle) * Math.min(1, 20 * dt);
        }
      }
    } else if (pen < -8) {
      r.grounded = false;
    }
  }

  if (r.trail.length > 40) r.trail.shift();
  r.trail.push({ x: r.x, y: r.y, a: r.angle });
  r.particles = r.particles.filter((p) => {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
    return p.t < p.life;
  });

  if (r.x >= parkEnd && !r.finished) {
    r.finished = true;
    hooks.saveBest(r.score);
    hooks.onFinish(r.score);
    return false;
  }
  if (r.y > 2000 || r.x < -200) {
    r.dead = true;
    r.crashReason = "Yeeted into the void.";
    hooks.saveBest(r.score);
    hooks.onCrash(r.crashReason, r.score);
    return false;
  }
  return true;
}

export function drawBmx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rider: Rider,
  cam: { x: number; y: number },
) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#1a3a6a");
  grd.addColorStop(0.45, "#2a5a8a");
  grd.addColorStop(0.7, "#6a9bb8");
  grd.addColorStop(1, "#c4a070");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,210,61,0.9)";
  ctx.arc(w * 0.78 - cam.x * 0.02, h * 0.18, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawHills(ctx, cam, w, 0.25, "#1e3a2f", 80);
  drawHills(ctx, cam, w, 0.4, "#244a38", 50);
  drawTerrain(ctx);
  drawFinish(ctx);
  for (const p of rider.particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (rider.trail.length > 2) {
    ctx.strokeStyle = "rgba(196,92,42,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    rider.trail.forEach((t, i) => (i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y)));
    ctx.stroke();
  }
  drawRider(ctx, rider);
  ctx.restore();

  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  cam: { x: number; y: number },
  w: number,
  parallax: number,
  color: string,
  amp: number,
) {
  const startX = cam.x - 100;
  const endX = cam.x + w + 100;
  ctx.beginPath();
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

function drawTerrain(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(terrain[0]!.x, terrain[0]!.y);
  for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i]!.x, terrain[i]!.y);
  const last = terrain[terrain.length - 1]!;
  ctx.lineTo(last.x + 50, last.y + 800);
  ctx.lineTo(terrain[0]!.x - 50, terrain[0]!.y + 800);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 300, 0, 900);
  g.addColorStop(0, "#5a3a22");
  g.addColorStop(0.4, "#3d2818");
  g.addColorStop(1, "#1a120c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(terrain[0]!.x, terrain[0]!.y);
  for (let i = 1; i < terrain.length; i++) ctx.lineTo(terrain[i]!.x, terrain[i]!.y);
  ctx.strokeStyle = "#3dff9a";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawFinish(ctx: CanvasRenderingContext2D) {
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
  ctx.fillStyle = "#c45c2a";
  ctx.fillRect(0, -80, 40, 24);
  ctx.fillStyle = "#fff";
  ctx.font = "600 11px Figtree, system-ui";
  ctx.fillText("END", 8, -64);
  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, rot: number) {
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

function drawRider(ctx: CanvasRenderingContext2D, r: Rider) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle);
  if (r.dead) ctx.rotate(performance.now() / 120);
  const trick = r.trick?.id;
  const wheelR = 9;
  drawWheel(ctx, -12, 8, wheelR, r.x * 0.2);
  const frontOff = trick === "barspin" ? Math.sin(r.trickT * 20) * 0.5 : 0;
  ctx.save();
  ctx.translate(14, 8);
  ctx.rotate(frontOff * Math.PI * 2);
  drawWheel(ctx, 0, 0, wheelR, r.x * 0.2 + frontOff * 6);
  ctx.restore();
  ctx.strokeStyle = "#e8f0ff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-12, 8);
  ctx.lineTo(-2, 2);
  ctx.lineTo(10, -2);
  ctx.lineTo(14, 8);
  ctx.moveTo(-2, 2);
  ctx.lineTo(8, -6);
  ctx.moveTo(-2, 2);
  ctx.lineTo(-6, -10);
  ctx.moveTo(8, -6);
  ctx.lineTo(12, -12);
  if (trick !== "nohander" && trick !== "superman") {
    ctx.moveTo(8, -12);
    ctx.lineTo(16, -12);
  }
  ctx.stroke();
  const ped = (performance.now() / 80) * (r.grounded ? Math.max(0.5, Math.hypot(r.vx, r.vy) / 100) : 0.3);
  ctx.beginPath();
  ctx.moveTo(-2 + Math.cos(ped) * 5, 2 + Math.sin(ped) * 5);
  ctx.lineTo(-2 - Math.cos(ped) * 5, 2 - Math.sin(ped) * 5);
  ctx.strokeStyle = "#d4a04a";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawStick(ctx, trick);
  ctx.restore();
}

function drawStick(ctx: CanvasRenderingContext2D, trick?: string) {
  ctx.strokeStyle = "#ffe0c0";
  ctx.fillStyle = "#ffe0c0";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  let hipX = -5, hipY = -10;
  let headX = -3, headY = -28;
  let handLX = 12, handLY = -12;
  let handRX = 14, handRY = -12;
  let footLX = -6, footLY = 6;
  let footRX = 2, footRY = 6;
  if (trick === "superman") {
    hipX = 0; hipY = -8; headX = 18; headY = -14;
    handLX = 22; handLY = -8; handRX = 24; handRY = -10;
    footLX = -18; footLY = -4; footRX = -16; footRY = 0;
  } else if (trick === "nohander") {
    handLX = -4; handLY = -20; handRX = 0; handRY = -22;
  } else if (trick === "onefooter") {
    footRX = 14; footRY = -8;
  } else if (trick === "cancan") {
    footRX = 10; footRY = -14; footLX = -8; footLY = 6;
  } else if (trick === "tabletop") {
    footLX = -2; footLY = 0; footRX = 4; footRY = 0; hipY = -12;
  } else if (trick === "barspin") {
    handLX = 6; handLY = -8; handRX = 10; handRY = -16;
  }
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(headX, headY + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headX, headY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX, headY + 8);
  ctx.lineTo(handLX, handLY);
  ctx.moveTo(headX, headY + 8);
  ctx.lineTo(handRX, handRY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(footLX, footLY);
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(footRX, footRY);
  ctx.stroke();
  ctx.strokeStyle = "#c45c2a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(headX, headY, 4.5, -2.2, -0.6);
  ctx.stroke();
}
