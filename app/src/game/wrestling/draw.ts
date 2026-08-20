import { BREEDS, GEAR, moveById, stageDef, stageIndex } from "./catalog";
import { maxHp } from "./sheep";
import type { FightEvent, FightResult, Pose, Sheep } from "./types";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  c: string;
};

type FighterVis = {
  x: number;
  y: number;
  pose: Pose;
  poseT: number;
  facing: 1 | -1;
  squash: number;
  flash: number;
};

export type ArenaRuntime = {
  stop: () => void;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function playArena(
  canvas: HTMLCanvasElement,
  fight: FightResult,
  opts: {
    onHp: (l: number, r: number) => void;
    onBanner: (text: string) => void;
    onMeter: (l: number, r: number) => void;
    onCue: (kind: string, intensity: number) => void;
    onDone: () => void;
    reducedMotion?: boolean;
  },
): ArenaRuntime {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop: () => undefined };

  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let stopped = false;
  const resize = () => {
    const parent = canvas.parentElement;
    W = parent?.clientWidth || 360;
    H = parent?.clientHeight || 420;
    dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);

  let t = 0;
  let last = performance.now();
  let ei = 0;
  let trauma = 0;
  let flash = 0;
  let slow = 1;
  let zoom = 1;
  let zoomT = 1;
  let spotlight = 0.2;
  let banner = "";
  let bannerT = 0;
  let lHp = maxHp(fight.left);
  let rHp = maxHp(fight.right);
  const particles: Particle[] = [];
  const leftV: FighterVis = { x: 0.28, y: 0, pose: "walk", poseT: 0, facing: 1, squash: 1, flash: 0 };
  const rightV: FighterVis = { x: 0.72, y: 0, pose: "walk", poseT: 0, facing: -1, squash: 1, flash: 0 };

  const burst = (x: number, y: number, n: number, col: string, speed = 8) => {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * speed,
        vy: -Math.random() * speed * 0.7 - 1,
        life: 0.45 + Math.random() * 0.5,
        max: 0.9,
        r: 1.5 + Math.random() * 3.5,
        c: col,
      });
    }
  };

  const applyEvent = (ev: FightEvent) => {
    banner = ev.text;
    bannerT = ev.kind === "ko" || ev.kind === "finisher" ? 2.0 : 1.15;
    opts.onBanner(ev.text);
    opts.onCue(ev.kind === "move" ? (moveById(ev.moveId ?? "")?.fx ?? "smash") : ev.kind, ev.intensity);
    trauma = Math.min(1, trauma + ev.intensity * (opts.reducedMotion ? 0.12 : 0.38));
    flash = Math.max(flash, ev.intensity * (ev.kind === "finisher" ? 0.7 : 0.35));
    zoomT = ev.zoom ?? 1;
    if (ev.slowmo) slow = 0.42;
    spotlight = ev.kind === "entrance" || ev.kind === "lights" ? 0.85 : 0.45;

    const atk = ev.actor === "left" ? leftV : ev.actor === "right" ? rightV : null;
    const def = ev.actor === "left" ? rightV : ev.actor === "right" ? leftV : null;
    const move = ev.moveId ? moveById(ev.moveId) : undefined;

    if (ev.kind === "entrance") {
      if (ev.actor === "left") {
        leftV.pose = "walk";
        leftV.x = 0.18;
      }
      if (ev.actor === "right") {
        rightV.pose = "walk";
        rightV.x = 0.82;
      }
    } else if (ev.kind === "lockup") {
      leftV.pose = "lock";
      rightV.pose = "lock";
      leftV.x = 0.44;
      rightV.x = 0.56;
    } else if (ev.kind === "bell") {
      leftV.pose = "roar";
      rightV.pose = "roar";
    } else if (atk && def) {
      atk.pose = move?.pose ?? "strike";
      atk.poseT = 0;
      atk.squash = 1.18;
      def.flash = 0.55;
      if (ev.kind === "finisher" || ev.kind === "super" || ev.kind === "move") {
        atk.x = ev.actor === "left" ? 0.48 : 0.52;
        def.x = ev.actor === "left" ? 0.6 : 0.4;
        def.pose = ev.kind === "finisher" ? "down" : "stunned";
        if (ev.damage) {
          if (ev.actor === "left") rHp = Math.max(0, rHp - ev.damage);
          else lHp = Math.max(0, lHp - ev.damage);
        }
        burst(W * 0.5, H * 0.56, 16 + ev.intensity * 12, "#f4efe4");
        burst(W * 0.5, H * 0.56, 8, "#c45c2a");
      } else if (ev.kind === "reversal") {
        def.pose = "strike";
        atk.pose = "stunned";
      } else if (ev.kind === "kickout") {
        atk.pose = "roar";
        atk.x = ev.actor === "left" ? 0.36 : 0.64;
      } else if (ev.kind === "pin") {
        atk.pose = "pin";
        def.pose = "down";
        atk.x = 0.5;
        def.x = 0.52;
      } else if (ev.kind === "ko" || ev.kind === "celebrate") {
        if (ev.actor === "left" || ev.actor === "both") {
          leftV.pose = fight.winner === "left" ? "celebrate" : "down";
          rightV.pose = fight.winner === "right" ? "celebrate" : "down";
        }
        lHp = fight.leftHpEnd;
        rHp = fight.rightHpEnd;
        burst(W * 0.5, H * 0.48, 28, "#d4a04a");
      }
    }
    opts.onHp(lHp, rHp);
  };

  const tick = (now: number) => {
    if (stopped) return;
    const rawDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = rawDt * slow;
    t += dt;
    slow = lerp(slow, 1, 1 - Math.exp(-2.4 * dt));
    zoom = lerp(zoom, zoomT, 1 - Math.exp(-3.2 * dt));
    zoomT = lerp(zoomT, 1, 1 - Math.exp(-1.1 * dt));
    trauma = Math.max(0, trauma - dt * 1.6);
    flash = Math.max(0, flash - dt * 1.7);
    bannerT = Math.max(0, bannerT - dt);
    spotlight = lerp(spotlight, 0.35, 1 - Math.exp(-1.2 * dt));

    while (ei < fight.events.length && fight.events[ei]!.t <= t) {
      applyEvent(fight.events[ei]!);
      ei++;
    }

    const restL = 0.34;
    const restR = 0.66;
    if (leftV.pose !== "pin" && leftV.pose !== "down" && leftV.pose !== "celebrate") {
      leftV.x = lerp(leftV.x, restL, 1 - Math.exp(-1.8 * dt));
    }
    if (rightV.pose !== "pin" && rightV.pose !== "down" && rightV.pose !== "celebrate") {
      rightV.x = lerp(rightV.x, restR, 1 - Math.exp(-1.8 * dt));
    }
    leftV.poseT += dt;
    rightV.poseT += dt;
    leftV.squash = lerp(leftV.squash, 1, 1 - Math.exp(-8 * dt));
    rightV.squash = lerp(rightV.squash, 1, 1 - Math.exp(-8 * dt));
    leftV.flash = Math.max(0, leftV.flash - dt * 3);
    rightV.flash = Math.max(0, rightV.flash - dt * 3);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 14 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    const shake = trauma * trauma;
    const shx = opts.reducedMotion ? 0 : (Math.random() - 0.5) * shake * 22;
    const shy = opts.reducedMotion ? 0 : (Math.random() - 0.5) * shake * 16;

    ctx.clearRect(0, 0, W, H);
    drawBackdrop(ctx, W, H, t, spotlight);
    ctx.save();
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    drawCrowd(ctx, W, H, t, trauma);
    drawRing(ctx, W, H);
    const baseY = H * 0.64;
    drawSheep(ctx, fight.left, W * leftV.x, baseY, leftV, 1);
    drawSheep(ctx, fight.right, W * rightV.x, baseY, rightV, 1);
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(244,239,228,${flash * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (bannerT > 0 && banner) drawBanner(ctx, W, H, banner, bannerT);
    if (ei >= fight.events.length && bannerT <= 0) {
      window.setTimeout(() => {
        if (!stopped) opts.onDone();
      }, 420);
      stopped = true;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWinResize);
    },
  };
}

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, spot: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#14161c");
  g.addColorStop(0.42, "#1c2018");
  g.addColorStop(1, "#2a2618");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W * 0.5, H * 0.22, 8, W * 0.5, H * 0.58, H * 0.72);
  rg.addColorStop(0, `rgba(244,239,228,${0.16 + spot * 0.18})`);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(196,92,42,0.06)";
  for (let i = 0; i < 6; i++) {
    const x = (i * 73 + t * 12) % (W + 40) - 20;
    ctx.fillRect(x, 0, 2, H * 0.22);
  }
}

function drawCrowd(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, trauma: number) {
  const rows = 4;
  for (let row = 0; row < rows; row++) {
    const y = H * (0.08 + row * 0.045);
    const n = 18 - row * 2;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W;
      const bob = Math.sin(t * (4 + trauma * 8) + i * 1.7 + row) * (2 + trauma * 6);
      ctx.fillStyle = i % 5 === 0 ? "#3a2a22" : i % 3 === 0 ? "#2a3038" : "#1c1f26";
      ctx.beginPath();
      ctx.ellipse(x, y + bob, 7 - row, 9 - row, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2c241c";
      ctx.fillRect(x - 5, y + 4 + bob, 10, 8);
    }
  }
}

function drawRing(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W * 0.5;
  const cy = H * 0.74;
  const rx = W * 0.42;
  const ry = H * 0.13;
  ctx.fillStyle = "#2a241c";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16, rx + 18, ry + 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const mat = ctx.createRadialGradient(cx, cy, 10, cx, cy, rx);
  mat.addColorStop(0, "#6a5a40");
  mat.addColorStop(1, "#3d3428");
  ctx.fillStyle = mat;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(244,239,228,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#c45c2a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 18, rx * 0.98, ry * 0.9, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(244,239,228,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 32, rx * 0.96, ry * 0.86, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  const posts: [number, number][] = [
    [cx - rx + 8, cy - 8],
    [cx + rx - 8, cy - 8],
  ];
  for (const [px, py] of posts) {
    ctx.fillStyle = "#c45c2a";
    ctx.fillRect(px - 5, py - 48, 10, 52);
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(px - 6, py - 52, 12, 8);
  }
}

function drawSheep(ctx: CanvasRenderingContext2D, sheep: Sheep, x: number, y: number, vis: FighterVis, scale: number) {
  const B = BREEDS[sheep.breed];
  const sc = scale * stageDef(sheep.stage).size * 1.05;
  const kick = vis.pose === "charge" || vis.pose === "strike" ? Math.sin(vis.poseT * 18) * 6 : 0;
  const bob =
    vis.pose === "down"
      ? 10
      : vis.pose === "aerial"
        ? -28 - Math.sin(vis.poseT * 8) * 6
        : vis.pose === "celebrate"
          ? -6 + Math.sin(vis.poseT * 10) * 4
          : vis.pose === "walk"
            ? Math.sin(vis.poseT * 8) * 2
            : 0;
  const tilt =
    vis.pose === "slam"
      ? vis.facing * 0.35
      : vis.pose === "lift"
        ? -0.2
        : vis.pose === "lock"
          ? vis.facing * 0.12
          : vis.pose === "stunned"
            ? Math.sin(vis.poseT * 20) * 0.15
            : 0;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(vis.facing * sc, sc * vis.squash);
  ctx.rotate(tilt);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const legKick = vis.pose === "charge" ? 10 + kick : vis.pose === "walk" ? Math.sin(vis.poseT * 8) * 6 : 0;
  ctx.strokeStyle = B.body;
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  const legs: [number, number, number, number][] = [
    [-14, 8, -16, 24],
    [10, 8, 14 + legKick, 24],
    [-6, 8, -8, 24],
    [4, 8, 6 - legKick * 0.4, 24],
  ];
  for (const L of legs) {
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    ctx.lineTo(L[2], L[3]);
    ctx.stroke();
  }

  ctx.fillStyle = B.wool;
  ctx.beginPath();
  ctx.ellipse(0, -2, 28, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-16, -6, 10, 0, Math.PI * 2);
  ctx.arc(4, -16, 11, 0, Math.PI * 2);
  ctx.arc(14, -4, 9, 0, Math.PI * 2);
  ctx.fill();

  if (sheep.body && GEAR.find((g) => g.key === sheep.body)) {
    ctx.strokeStyle = "rgba(196,92,42,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -2, 30, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = B.body;
  ctx.beginPath();
  ctx.ellipse(20, -8, 15, 13, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, -16, 5, 8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(B.body, -20);
  ctx.beginPath();
  ctx.ellipse(30, -4, 7, 5.5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  if (stageIndex(sheep.stage) >= 2) {
    ctx.strokeStyle = B.horn;
    ctx.lineWidth = stageIndex(sheep.stage) >= 4 ? 5.5 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, -16);
    ctx.quadraticCurveTo(34, -32, 16, -34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, -18);
    ctx.quadraticCurveTo(6, -34, 22, -36);
    ctx.stroke();
    if (sheep.horns === "steel_tips") {
      ctx.fillStyle = "#c8d0d8";
      ctx.beginPath();
      ctx.arc(16, -34, 3, 0, Math.PI * 2);
      ctx.arc(22, -36, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (sheep.collar) {
    ctx.strokeStyle = sheep.collar === "gold_collar" ? "#d4a04a" : sheep.collar === "iron_collar" ? "#8a949c" : "#6a4a32";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(18, 2, 10, 5, 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = vis.pose === "down" ? "#3a2a22" : "#111";
  ctx.beginPath();
  ctx.arc(26, -10, vis.pose === "stunned" ? 2.8 : 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (vis.pose !== "down") {
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.arc(26.7, -10.7, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (vis.flash > 0) {
    ctx.globalAlpha = vis.flash * 0.55;
    ctx.fillStyle = "#f4efe4";
    ctx.beginPath();
    ctx.ellipse(0, -2, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawBanner(ctx: CanvasRenderingContext2D, W: number, H: number, text: string, life: number) {
  const a = clamp(life, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(10,12,16,0.72)";
  ctx.fillRect(0, H * 0.26, W, 52);
  ctx.fillStyle = "#c45c2a";
  ctx.fillRect(0, H * 0.26, W, 3);
  ctx.fillRect(0, H * 0.26 + 49, W, 3);
  ctx.fillStyle = "#f4efe4";
  ctx.font = `700 ${Math.min(22, W * 0.052)}px Oswald, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H * 0.26 + 28);
  ctx.restore();
}

export function paintPortrait(canvas: HTMLCanvasElement, sheep: Sheep) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cssW = Math.max(48, canvas.clientWidth || 72);
  const cssH = Math.max(48, canvas.clientHeight || 72);
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#1a1814";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#2a2620";
  ctx.beginPath();
  ctx.ellipse(cssW * 0.5, cssH * 0.78, cssW * 0.38, cssH * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const vis: FighterVis = { x: 0, y: 0, pose: "idle", poseT: 0.35, facing: 1, squash: 1, flash: 0 };
  const sc = (Math.min(cssW, cssH) / 46) / Math.max(0.7, stageDef(sheep.stage).size);
  drawSheep(ctx, sheep, cssW * 0.46, cssH * 0.74, vis, sc);
}
