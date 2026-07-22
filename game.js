/* =====================================================================
   WOOFA FETCH  — Woofa throws, you flick it, the kids fly for the hero catch.
   Pure vanilla canvas. No framework, no backend. Saves to localStorage.
   ===================================================================== */
(() => {
  'use strict';

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('load', resize);   // re-measure once layout has settled
  resize();

  const groundY = () => H - Math.max(90, H * 0.14);

  // ---------- Persistence ----------
  const SAVE_KEY = 'wilford_fetch_v1';
  const defaultSave = {
    coins: 0,
    best: 0,
    owned: { tennis: true, frisbee: true },
    equipped: 'frisbee',
    maxLevel: 1,
    capeUnlocked: false,
  };
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...defaultSave };
      const s = JSON.parse(raw);
      return { ...defaultSave, ...s, owned: { ...defaultSave.owned, ...(s.owned || {}) } };
    } catch (e) { return { ...defaultSave }; }
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  let save = load();

  // ---------- Ball / item catalog ----------
  // gravity: fall speed feel. power: launch strength. window: sweet-spot forgiveness.
  // mult: coin multiplier. rip: chance Wilford destroys it on a catch. bounce: restitution.
  const ITEMS = {
    tennis:  { emoji: '🎾', name: 'Sad Tennis Ball', cost: 0,    color: '#c7e04a', size: 9,
               gravity: 1.15, power: 0.86, window: 0.72, mult: 1.0, rip: 0.0, bounce: 0.55,
               desc: 'Chewed, flat, barely bounces. The fallback when you lose the good stuff.' },
    frisbee: { emoji: '🥏', name: 'Classic Frisbee', cost: 0,    color: '#ff8a3d', size: 15,
               gravity: 0.82, power: 1.0,  window: 1.0,  mult: 1.15, rip: 0.02, bounce: 0.3,
               desc: 'Floaty and forgiving. A proper throw. Woofa\'s favourite.' },
    spiky:   { emoji: '🔴', name: 'Spiky Ball', cost: 320,  color: '#ff4d5e', size: 12,
               gravity: 1.05, power: 1.22, window: 0.9,  mult: 1.5,  rip: 0.10, bounce: 0.7,
               desc: 'Flies flat and fast for big range. Pays 1.5×. He chews it more often, though.' },
    squishy: { emoji: '🟣', name: 'Squishy Ball', cost: 850,  color: '#a06bff', size: 14,
               gravity: 0.9,  power: 1.08, window: 1.35, mult: 1.8,  rip: 0.04, bounce: 0.92,
               desc: 'Huge sweet spot, mega bounce, 1.8× bones. The luxury throw.' },
    wreck:   { emoji: '⚫', name: 'Wrecking Ball', cost: 1400, color: '#5a5a66', size: 19,
               gravity: 1.4, power: 0.98, window: 0.95, mult: 2.2, rip: 0, bounce: 0.15,
               desc: 'A hunk of iron. Heavy and drops fast — throw hard and read the wind. Pays a huge 2.2×.' },
    rocket:  { emoji: '🚀', name: 'Rocket', cost: 5000, color: '#d94b3a', size: 15,
               gravity: 0.62, power: 1.45, window: 3, mult: 0, rip: 0, bounce: 0,
               explosive: true, consumable: true,
               desc: 'ONE use. Fire it at a kid and BOOM — blows them to bits. 💥 No bones, pure carnage.' },
  };
  const CAPE = { name: 'Batman Cape', cost: 1600, unlockLevel: 5,
                 desc: 'Your catcher becomes the hero the field deserves. +10% bones on every catch.' };

  const equippedItem = () => ITEMS[save.equipped] || ITEMS[frisbeeOrTennis()];
  function frisbeeOrTennis() { return save.owned.frisbee ? 'frisbee' : 'tennis'; }

  // ---------- Scenes ----------
  const SCENES = [
    { name: 'Footy Ground', sky: ['#63b8ff', '#bfe6ff'], ground: '#3f9e4a', groundDark: '#2c7a36', accent: '#5cc06a', footy: true },
    { name: 'Backyard',   sky: ['#7fc7ff', '#cdeaff'], ground: '#5aa64a', groundDark: '#3f7d33', accent: '#6fbf5c' },
    { name: 'The Park',   sky: ['#63b8ff', '#bfe6ff'], ground: '#4f9e46', groundDark: '#377a30', accent: '#63b055' },
    { name: 'Playground', sky: ['#8fd0ff', '#d8f0ff'], ground: '#c98f5a', groundDark: '#a2703f', accent: '#e0a86e' },
    { name: 'The Beach',  sky: ['#ffd98a', '#ffeecb'], ground: '#e9d29a', groundDark: '#cbb073', accent: '#f0dca8' },
    { name: 'The Oval',   sky: ['#5fb0f0', '#c6e8ff'], ground: '#469b52', groundDark: '#2f7a3c', accent: '#5cc06a' },
    { name: 'Rooftops',   sky: ['#2b3c66', '#61789e'], ground: '#4a5570', groundDark: '#333c52', accent: '#5b6788', roofs: true },
    { name: 'The Forest', sky: ['#3f6b52', '#8fbf9c'], ground: '#3a6b3f', groundDark: '#274a2b', accent: '#4f8f57' },
    { name: 'The Outback',sky: ['#ffb15c', '#ffe0a8'], ground: '#c76a3a', groundDark: '#9c4f28', accent: '#e08a52' },
    { name: 'Night Match',sky: ['#12193a', '#2a3566'], ground: '#3d6b45', groundDark: '#2a4a30', accent: '#4f8f57', roofs: true },
    { name: 'Snow Field', sky: ['#c3d6ea', '#eef5fb'], ground: '#eef4fb', groundDark: '#cdd9e8', accent: '#dbe6f2' },
  ];
  const sceneFor = (lvl) => SCENES[(lvl - 1) % SCENES.length];

  // ---------- Game state ----------
  const STATE = { MENU: 0, AIM: 1, FLY: 2, RESOLVE: 3 };
  let state = STATE.MENU;

  let level = 1;
  let sessionScore = 0;
  let streak = 0;
  let catchesThisLevel = 0;
  const CATCHES_TO_ADVANCE = 4;

  let camX = 0;           // camera world-x offset
  let worldWidth = 1400;
  let gravity = 0.5;
  let wind = 0;

  // camera zoom + focus (world point shown at screen centre) — used to punch in on tantrums
  let camZoom = 1, camFX = 0, camFY = 0;
  let droppedStreak = 0;   // consecutive drops → Woofa gets hungry and runs them down
  let goalX = 1200;        // footy goal line (world x), out past the kids
  const woofaEat = { active: false, x: 0, phase: 'run', chompT: 0 };
  const TANTRUM_LINES = ["NO! That's not a goal!", "You DIDN'T catch that!", "That's NOT FAIR!", "I want a new frisbee!", "You threw it WRONG!", "WAAAAAH!", "That's rubbish!!"];

  const thrower = { x: 70, handY: 0 };
  let ring = { x: 900, r: 70 };     // sweet-spot target ring (world x)

  // frisbee/projectile
  const disc = { x: 0, y: 0, vx: 0, vy: 0, spin: 0, live: false, landed: false, caught: false };

  // Woofa (the dog) is the THROWER. The two kids are the catchers.
  // `dog` below = the ACTIVE catcher kid's motion state (runs, leaps, faceplants).
  const dog = {
    x: 900, y: 0, vx: 0, vy: 0, onGround: true,
    facing: -1, run: 0, targetX: 900, jumping: false, mouthOpen: 0,
    state: 'idle', // idle | chase | leap | catchpose | rip | fall
    stateT: 0, patrol: null,
  };
  // the catcher kid runs back and forth on higher levels — you have to LEAD the throw
  function initPatrol() {
    const pr = level >= 3 ? clamp((level - 2) * 24, 0, 200) : 0;
    dog.patrol = { on: pr > 0, c: ring.x, r: pr, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.95 + Math.max(0, level - 2) * 0.22 };
    dog.x = ring.x + (pr ? rand(-pr, pr) : rand(-30, 30)); dog.targetX = dog.x;
  }

  // The two kids who chase the throws.
  const kids = [
    // small, pale, lightest blonde with a touch of orange
    { skin: '#f8e2d1', skinShade: '#eec3ab', hair: '#ffce7a', hairShade: '#e7a844',
      shirt: '#39b6c9', shirtShade: '#2b93a4', shorts: '#31507c',
      hairStyle: 'short', scale: 0.95, chub: 0.95, cheeky: false, freckles: true },
    // older, taller, tanned, dark brown mop, cheeky grin, a touch chubby
    { skin: '#c98a56', skinShade: '#a86e3f', hair: '#3a2416', hairShade: '#25150b',
      shirt: '#e0503a', shirtShade: '#b73a29', shorts: '#2e3a56',
      hairStyle: 'mop', scale: 1.12, chub: 1.2, cheeky: true, freckles: false },
  ];
  let activeKid = 0;

  // input aiming
  const aim = { active: false, sx: 0, sy: 0, cx: 0, cy: 0 };

  // effects
  const particles = [];
  let shake = 0;
  let slowmo = 1;

  // ---------- Helpers ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const worldToScreenX = (wx) => wx - camX;

  function spawnParticles(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, spread || 5);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, color, r: rand(2, 5) });
    }
  }

  // Every throw has wind now — moderate, grows with the level. You read the
  // gauge and aim off to beat it (but it's always beatable).
  function windForLevel(step) {
    return (Math.random() < 0.5 ? -1 : 1) * (0.028 + step * 0.011);
  }

  // ---------- Level setup ----------
  function configureLevel(lvl) {
    const sc = sceneFor(lvl);
    // difficulty ramps: farther target, smaller ring, more wind
    const step = lvl - 1;
    worldWidth = 1200 + step * 260;
    ring.x = clamp(560 + step * 150, 520, worldWidth - 220);
    ring.r = clamp(62 - step * 3.5, 28, 62);   // tighter sweet-spot
    gravity = 0.5;
    wind = windForLevel(step);
    goalX = worldWidth - 90;             // footy goals out past the kids
    camX = 0; camZoom = 1; camFX = W / 2; camFY = H / 2;
    dog.y = groundY();
    dog.state = 'idle';
    dog.mouthOpen = 0;
    dog.jumping = false;
    initPatrol();
    resetDisc();
  }

  function resetDisc() {
    disc.x = thrower.x + 18;    // launches from Woofa's raised paw (he stands up to throw)
    disc.y = groundY() - 116;
    disc.vx = 0; disc.vy = 0; disc.spin = 0;
    disc.live = false; disc.landed = false; disc.caught = false; disc.attempted = false; disc.scored = false;
    thrower.handY = disc.y;
  }

  // ---------- Input ----------
  function pointer(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  function onDown(e) {
    if (state !== STATE.AIM) return;
    e.preventDefault();
    const p = pointer(e);
    aim.active = true;
    aim.sx = p.x; aim.sy = p.y; aim.cx = p.x; aim.cy = p.y;
    hideAimHint();
  }
  function onMove(e) {
    if (!aim.active) return;
    e.preventDefault();
    const p = pointer(e);
    aim.cx = p.x; aim.cy = p.y;
  }
  function onUp(e) {
    if (!aim.active) return;
    e.preventDefault();
    aim.active = false;
    launchFromAim();
  }
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // slingshot: drag vector is pull-back; launch is opposite direction
  function aimVector() {
    const dx = aim.sx - aim.cx;   // pull back -> launch forward (+x when dragging left)
    const dy = aim.sy - aim.cy;   // pull down -> launch up
    return { dx, dy };
  }

  function launchFromAim() {
    const { dx, dy } = aimVector();
    const pull = Math.hypot(dx, dy);
    if (pull < 18) { return; } // too small, ignore (stay in AIM)
    const it = equippedItem();
    const maxPull = Math.min(W, H) * 0.42;
    const strength = clamp(pull / maxPull, 0, 1);
    const speed = (9 + strength * 20) * it.power;
    const ang = Math.atan2(dy, dx); // launch angle
    disc.vx = Math.cos(ang) * speed;
    disc.vy = Math.sin(ang) * speed;
    // keep it sane: mostly forward & up
    if (disc.vx < 1) disc.vx = 1;
    disc.live = true;
    disc.spin = 0;
    state = STATE.FLY;

    // On easy levels the catcher runs to the landing; on patrol levels it keeps running and you must LEAD it
    if (!(dog.patrol && dog.patrol.on)) {
      const predicted = predictLanding();
      dog.targetX = predicted.x;
      dog.state = 'chase';
      dog.stateT = 0;
    }
  }

  // Simulate the disc forward to estimate where it will be catchable (near ground)
  function predictLanding() {
    const it = equippedItem();
    let x = disc.x, y = disc.y, vx = disc.vx, vy = disc.vy;
    const g = gravity * it.gravity;
    const gy = groundY();
    for (let i = 0; i < 600; i++) {
      vy += g;
      vx += wind;
      x += vx; y += vy;
      if (y >= gy - 40 && vy > 0) return { x, y, t: i };
    }
    return { x, y, t: 600 };
  }

  // ---------- Update ----------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 16.6667;
    last = now;
    dt = clamp(dt, 0, 2.5) * slowmo;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // camera follows disc when flying
    if (state === STATE.FLY || state === STATE.RESOLVE) {
      const targetCam = clamp(disc.x - W * 0.42, 0, Math.max(0, worldWidth - W));
      camX = lerp(camX, targetCam, 0.12 * dt);
    } else {
      camX = lerp(camX, 0, 0.1 * dt);
    }
    // punch in hard on a meltdown / eating / explosion
    const punchIn = dog.state === 'tantrum' || dog.state === 'eaten' || dog.state === 'boom';
    camZoom = lerp(camZoom, punchIn ? 1.9 : 1, 0.08 * dt);

    if (state === STATE.FLY) updateFlight(dt);
    updateDog(dt);
    updateParticles(dt);

    if (shake > 0) shake = Math.max(0, shake - dt * 1.4);
    // ease slowmo back to normal
    slowmo = lerp(slowmo, 1, 0.06 * dt);
  }

  function updateFlight(dt) {
    const it = equippedItem();
    const g = gravity * it.gravity;
    disc.vy += g * dt;
    disc.vx += wind * dt;
    disc.x += disc.vx * dt;
    disc.y += disc.vy * dt;
    disc.spin += (disc.vx * 0.06 + 0.15) * dt;
    const gy = groundY();

    // Catch check — when disc gets near the dog and near catch height
    const dogReach = 105;           // horizontal reach (tighter = must catch on the run)
    const nearDog = Math.abs(disc.x - dog.x) < dogReach;
    const catchable = (disc.y > gy - 230 && disc.vy > -2) || it.explosive; // rocket detonates on approach
    if (nearDog && catchable && !disc.caught) {
      tryCatch();
      return;
    }

    // Missed past the dog and hit ground
    if (disc.y >= gy - it.size) {
      disc.y = gy - it.size;
      // bounce a couple times then settle
      if (Math.abs(disc.vy) > 2.2) {
        disc.vy = -disc.vy * it.bounce;
        disc.vx *= 0.7;
        spawnParticles(disc.x, gy, sceneFor(level).accent, 6, 4);
      } else {
        disc.vx *= 0.8;
        if (Math.abs(disc.vx) < 0.5) resolveMiss();
      }
    }

    // Footy goal — sail it through the sticks (out past the kids) for bonus points
    if (!disc.scored && !it.explosive && disc.x > goalX && disc.y > gy - 200 && disc.y < gy - 10) {
      scoreGoal(); return;
    }

    // Overshoot off the end of the world → gone (lose item flavour)
    if (disc.x > worldWidth + 60) resolveOvershoot();
  }

  function scoreGoal() {
    if (state !== STATE.FLY) return;
    disc.scored = true;
    state = STATE.RESOLVE;
    save.coins += 10; sessionScore += 10; droppedStreak = 0;
    toast(Math.random() < 0.5 ? 'GOAL! 🏉 +10 to Gryffindor!' : 'GOAAAL! 🏉 +10', '#ffd23d');
    spawnParticles(disc.x, disc.y, '#ffd23d', 22, 9);
    shake = 5;
    persist(); updateHUD();
    setTimeout(newThrow, 1300);
  }

  function tryCatch() {
    const it = equippedItem();
    if (it.explosive) { doExplode(); return; }   // rocket — blow the kid to bits
    // how close to the sweet-spot ring did it come down?
    const missToRing = Math.abs(disc.x - ring.x);
    const perfectR = ring.r * it.window;
    const goodR = perfectR + 60;

    let quality;
    if (missToRing <= perfectR) quality = 'perfect';
    else if (missToRing <= goodR) quality = 'good';
    else quality = null;

    if (!quality) {
      // Kid lunges hopefully, mistimes it, and eats dirt.
      if (!disc.attempted) {
        disc.attempted = true;
        dog.state = 'fall'; dog.stateT = 0;
        dog.onGround = false; dog.jumping = true; dog.vy = -9;
      }
      return; // ball keeps falling; resolveMiss handles the crying
    }

    disc.caught = true;
    disc.live = false;
    dog.mouthOpen = 1;

    if (quality === 'perfect') {
      dog.state = 'leap';
      dog.stateT = 0;
      dog.vy = -15;
      dog.jumping = true;
      dog.onGround = false;
      slowmo = 0.45;
      shake = 6;
      spawnParticles(disc.x, disc.y, '#ffd23d', 22, 8);
    } else {
      dog.state = 'catchpose';
      dog.stateT = 0;
      spawnParticles(disc.x, disc.y, it.color, 10, 5);
    }
    finishCatch(quality);
  }

  function finishCatch(quality) {
    const it = equippedItem();
    droppedStreak = 0;   // they held onto it — Woofa calms down
    // scoring
    let base = quality === 'perfect' ? 50 : 20;
    streak = quality === 'perfect' ? streak + 1 : Math.max(1, Math.floor(streak / 2) + 1);
    const streakBonus = Math.min(streak - 1, 8) * (quality === 'perfect' ? 6 : 2);
    let coins = Math.round((base + streakBonus) * it.mult);
    if (isCapeOn()) coins = Math.round(coins * 1.1); // Batman-cape kid bonus

    sessionScore += coins;
    save.coins += coins;

    // rip chance — Wilford destroys the item
    const willRip = Math.random() < it.rip && save.equipped !== 'tennis';
    setTimeout(() => {
      if (quality === 'perfect') {
        toast(`HERO CATCH! +${coins}🦴`, '#ffd23d');
      } else {
        toast(`Nice catch +${coins}🦴`, '#58e08a');
      }
    }, quality === 'perfect' ? 220 : 40);

    catchesThisLevel++;
    if (sessionScore > save.best) save.best = sessionScore;

    // schedule resolve
    const delay = quality === 'perfect' ? 1400 : 900;
    setTimeout(() => {
      if (willRip) doRip();
      else advanceAfterCatch();
    }, delay);

    persist();
    updateHUD();
  }

  function doRip() {
    dog.state = 'rip';
    dog.stateT = 0;
    const lost = ITEMS[save.equipped];
    spawnParticles(dog.x, dog.y - 40, lost.color, 26, 7);
    shake = 8;
    // caught it way too hard — the fragile ball gets wrecked
    if (save.equipped === 'spiky') save.owned.spiky = false;
    if (save.equipped === 'squishy') save.owned.squishy = false;
    save.equipped = save.owned.frisbee ? 'frisbee' : 'tennis';
    toast(`The ${lost.name} got WRECKED! 😬 Back to the ${ITEMS[save.equipped].name}`, '#ff4d5e');
    persist();
    setTimeout(advanceAfterCatch, 1500);
  }

  // Rocket hit — blow the kid into pieces. No coins, pure carnage. Single use.
  function doExplode() {
    if (state !== STATE.FLY) return;
    disc.caught = false; disc.live = false;
    state = STATE.RESOLVE;
    streak = 0;
    dog.state = 'boom'; dog.stateT = 0;
    spawnGibs(dog.x, dog.y - 40, kids[activeKid]);
    spawnParticles(disc.x, disc.y, '#ff5a2a', 34, 13);
    spawnParticles(disc.x, disc.y, '#ffd23d', 22, 10);
    spawnParticles(disc.x, disc.y, '#888888', 16, 9);
    shake = 16; slowmo = 0.5;
    toast('💥 BOOM!', '#ff5a2a');
    consumeRocket();
    updateHUD();
    setTimeout(newThrow, 1700);
  }
  function spawnGibs(x, y, k) {
    const cols = [k.skin, k.shirt, k.hair, k.shorts, k.skinShade || k.skin];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), s = rand(3, 10);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, life: 1.4, color: cols[i % cols.length], r: rand(3, 7) });
    }
  }
  function consumeRocket() {
    if (save.owned.rocket) {
      save.owned.rocket = false;
      if (save.equipped === 'rocket') save.equipped = frisbeeOrTennis();
      persist();
    }
  }

  function advanceAfterCatch() {
    if (catchesThisLevel >= CATCHES_TO_ADVANCE) {
      catchesThisLevel = 0;
      level++;
      if (level > save.maxLevel) { save.maxLevel = level; persist(); }
      toast(`LEVEL ${level} — ${sceneFor(level).name}!`, '#ff8a3d');
      if (level >= CAPE.unlockLevel && !save.capeUnlocked) {
        // just gate purchase; announce
        setTimeout(() => toast('Batman Cape unlocked in shop! 🦇', '#a06bff'), 1400);
      }
      setTimeout(() => { configureLevel(level); newThrow(); }, 900);
    } else {
      newThrow();
    }
    updateHUD();
  }

  function resolveMiss() {
    if (state !== STATE.FLY) return;
    state = STATE.RESOLVE;
    streak = 0;
    if (save.equipped === 'rocket') { consumeRocket(); toast('The rocket flew wide! 🚀💨', '#93a2c4'); updateHUD(); setTimeout(newThrow, 1200); return; }
    droppedStreak++;
    // the more they keep dropping it, the hungrier Woofa gets — sometimes he eats them
    const eatChance = Math.min(0.18 + droppedStreak * 0.12, 0.72);
    if (Math.random() < eatChance) startEat();
    else startTantrum();
    updateHUD();
  }

  function startTantrum() {
    dog.state = 'tantrum'; dog.stateT = 0; dog.onGround = true;
    dog.speech = TANTRUM_LINES[(Math.random() * TANTRUM_LINES.length) | 0];
    shake = 6;
    setTimeout(newThrow, 2300);
  }
  function startEat() {
    dog.state = 'eaten'; dog.stateT = 0;
    dog.speech = "no — NO! AAA—";
    woofaEat.active = true; woofaEat.x = thrower.x; woofaEat.phase = 'run'; woofaEat.chompT = 0;
    setTimeout(newThrow, 2700);
  }

  function resolveOvershoot() {
    if (state !== STATE.FLY) return;
    state = STATE.RESOLVE;
    streak = 0;
    if (save.equipped === 'rocket') { consumeRocket(); toast('The rocket screamed off into the distance! 🚀', '#93a2c4'); updateHUD(); setTimeout(newThrow, 1300); return; }
    const sc = sceneFor(level);
    // On the rooftops, an overshoot means it's stuck up on a roof → lose it.
    const loseIt = sc.roofs && save.equipped !== 'tennis' && Math.random() < 0.8;
    if (loseIt) {
      if (save.equipped === 'spiky') save.owned.spiky = false;
      if (save.equipped === 'squishy') save.owned.squishy = false;
      if (save.equipped === 'frisbee') save.owned.frisbee = false;
      save.equipped = save.owned.frisbee ? 'frisbee' : 'tennis';
      toast(`It's on the roof! 🏠 Grab the ${ITEMS[save.equipped].name}`, '#ff4d5e');
      persist();
    } else {
      toast('Way too far! 🐾', '#93a2c4');
    }
    updateHUD();
    setTimeout(newThrow, 1300);
  }

  function newThrow() {
    // swap which kid is up, re-roll wind, reset positions
    activeKid = 1 - activeKid;
    wind = windForLevel(level - 1);
    dog.y = groundY();
    dog.facing = -1;
    dog.state = 'idle';
    initPatrol();
    dog.mouthOpen = 0;
    dog.jumping = false;
    dog.onGround = true;
    dog.vy = 0;
    dog.speech = null;
    woofaEat.active = false;
    resetDisc();
    state = STATE.AIM;
    showAimHint();
  }

  // ---------- Dog AI & animation ----------
  function updateDog(dt) {
    const gy = groundY();
    const speed = 4.6 + level * 0.15;

    // moving catcher: run back and forth while you aim & the disc flies — the sweet-spot ring follows the kid, so you must lead the throw
    if (dog.patrol && dog.patrol.on && (state === STATE.AIM || state === STATE.FLY) && !disc.caught && dog.state !== 'leap' && dog.state !== 'fall' && dog.state !== 'catchpose' && dog.state !== 'rip') {
      dog.x += dog.patrol.dir * dog.patrol.speed * dt;
      if (dog.x <= dog.patrol.c - dog.patrol.r) { dog.x = dog.patrol.c - dog.patrol.r; dog.patrol.dir = 1; }
      else if (dog.x >= dog.patrol.c + dog.patrol.r) { dog.x = dog.patrol.c + dog.patrol.r; dog.patrol.dir = -1; }
      dog.facing = dog.patrol.dir; dog.run += dog.patrol.speed * 0.14 * dt;
      ring.x = dog.x;
    }

    if (dog.state === 'chase') {
      const dx = dog.targetX - dog.x;
      dog.facing = dx >= 0 ? 1 : -1;
      const move = clamp(dx, -speed * dt, speed * dt);
      dog.x += move;
      dog.run += Math.abs(move) * 0.12;
    } else if (dog.state === 'idle') {
      // gentle idle sway
      dog.run += dt * 0.04;
    } else if (dog.state === 'leap') {
      dog.stateT += dt;
      dog.vy += gravity * 1.1 * dt;
      dog.y += dog.vy * dt;
      // ride toward the disc for the highlight
      if (disc.caught) { dog.x = lerp(dog.x, disc.x, 0.25 * dt); }
      if (dog.y >= gy) { dog.y = gy; dog.vy = 0; dog.jumping = false; dog.state = 'catchpose'; dog.stateT = 0; }
    } else if (dog.state === 'fall') {
      dog.stateT += dt;
      if (!dog.onGround) {
        dog.vy += gravity * 1.1 * dt;
        dog.y += dog.vy * dt;
        dog.x += dog.facing * 1.2 * dt;        // the hopeful lunge forward
        if (dog.y >= gy) {
          dog.y = gy; dog.vy = 0; dog.onGround = true; dog.jumping = false;
          spawnParticles(dog.x, gy - 6, '#ffffff', 12, 5);   // dust
          spawnParticles(dog.x, gy - 70, '#ffd23d', 8, 4);   // "seeing stars"
          shake = 7;
        }
      }
    } else if (dog.state === 'tantrum') {
      dog.stateT += dt;
      // periodic frisbee-smash thump
      if (Math.floor(dog.stateT) % 24 < dt) { shake = Math.max(shake, 3); spawnParticles(dog.x, groundY() - 4, sceneFor(level).accent, 5, 5); }
    } else if (dog.state === 'eaten') {
      dog.stateT += dt;
      if (woofaEat.active) {
        if (woofaEat.phase === 'run') {
          woofaEat.x = lerp(woofaEat.x, dog.x - 16, 0.11 * dt);
          if (Math.abs(woofaEat.x - dog.x) < 26) { woofaEat.phase = 'chomp'; woofaEat.chompT = 0; spawnGibs(dog.x, groundY() - 40, kids[activeKid]); shake = 12; }
        } else { woofaEat.chompT += dt; }
      }
    } else if (dog.state === 'catchpose' || dog.state === 'rip' || dog.state === 'celebrate') {
      dog.stateT += dt;
    }

    // carry the caught ball in the kid's hands
    if (disc.caught) {
      const mouth = dogMouthPos();
      disc.x = mouth.x; disc.y = mouth.y;
      disc.vx = 0; disc.vy = 0;
    }
    dog.mouthOpen = lerp(dog.mouthOpen, (dog.state === 'leap' || dog.state === 'chase') ? 1 : 0, 0.2 * dt);
  }

  function dogMouthPos() {
    // hands of the active catcher kid (ball held overhead)
    const S = (kids[activeKid].scale || 1) * 1.18;
    return { x: dog.x + dog.facing * 5 * S, y: dog.y - 96 * S };
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.25 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= 0.02 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- Rendering ----------
  function render() {
    const punchIn = dog.state === 'tantrum' || dog.state === 'eaten' || dog.state === 'boom';
    const pivotX = punchIn ? clamp(dog.x - camX, W * 0.2, W * 0.8) : W / 2;
    const pivotY = groundY();
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    // zoom the whole frame around a point on the ground — the ground line stays put
    ctx.translate(pivotX, pivotY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-pivotX, -pivotY);

    drawScene();

    // world-space objects
    ctx.save();
    ctx.translate(-camX, 0);
    drawGoals();
    drawRing();
    drawWoofa();
    drawCatchers();
    drawDisc();
    drawParticles();
    ctx.restore();

    ctx.restore(); // end zoom (+ shake)

    if (state === STATE.AIM && aim.active) drawAimUI();
    drawWindIndicator();
  }

  // Wind gauge near the top — green = tailwind (carries it), orange = headwind (fights you)
  function drawWindIndicator() {
    if (state === STATE.MENU) return;
    const cx = W / 2, cy = 104;
    const mag = clamp(Math.abs(wind) / 0.22, 0.18, 1);
    const dir = wind >= 0 ? 1 : -1;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(dir > 0 ? 'WIND ▸ tail' : 'WIND ◂ head', cx, cy - 12);
    const len = 24 + mag * 46;
    const col = dir > 0 ? '#58e08a' : '#ff8a3d';
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - dir * len / 2, cy); ctx.lineTo(cx + dir * len / 2, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dir * len / 2, cy); ctx.lineTo(cx + dir * (len / 2 - 9), cy - 6);
    ctx.moveTo(cx + dir * len / 2, cy); ctx.lineTo(cx + dir * (len / 2 - 9), cy + 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawScene() {
    const sc = sceneFor(level);
    const gy = groundY();
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, sc.sky[0]);
    g.addColorStop(1, sc.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, gy);

    // parallax scenery (clouds / skyline / dunes) — tied loosely to camera
    const par = camX * 0.3;
    if (sc.roofs) drawSkyline(par, gy);
    else drawClouds(par, gy);

    // ground
    ctx.fillStyle = sc.ground;
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = sc.groundDark;
    ctx.fillRect(0, gy, W, 6);
    // ground texture streaks
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    const off = -(camX * 1) % 60;
    for (let x = off; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 18);
      ctx.lineTo(x + 22, gy + 18);
      ctx.stroke();
    }
    // footy ground markings (scroll with the camera)
    if (sc.footy) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, gy + 10); ctx.lineTo(W, gy + 10); ctx.stroke(); // boundary
      const cxm = worldWidth / 2 - camX;
      ctx.beginPath(); ctx.moveTo(cxm, gy); ctx.lineTo(cxm, H); ctx.stroke();        // centre line
      ctx.beginPath(); ctx.arc(cxm, gy + (H - gy) * 0.5, 42, 0, 7); ctx.stroke();    // centre circle
    }
  }

  function drawClouds(par, gy) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cw = 900;
    for (let base = -cw; base < W + cw; base += cw) {
      const cx = base - (par % cw);
      cloud(cx + 120, gy * 0.28, 34);
      cloud(cx + 460, gy * 0.2, 26);
      cloud(cx + 720, gy * 0.36, 30);
    }
  }
  function cloud(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y + 6, r * 0.8, 0, 7);
    ctx.arc(x - r, y + 8, r * 0.7, 0, 7); ctx.arc(x + r * 0.4, y - r * 0.5, r * 0.7, 0, 7);
    ctx.fill();
  }
  function drawSkyline(par, gy) {
    const bw = 700;
    for (let base = -bw; base < W + bw; base += bw) {
      const bx = base - (par % bw);
      ctx.fillStyle = 'rgba(20,28,48,0.55)';
      building(bx + 40, gy, 70, gy * 0.5);
      building(bx + 140, gy, 55, gy * 0.35);
      building(bx + 230, gy, 90, gy * 0.6);
      building(bx + 350, gy, 60, gy * 0.42);
      building(bx + 450, gy, 100, gy * 0.55);
      building(bx + 580, gy, 65, gy * 0.38);
    }
  }
  function building(x, gy, w, h) {
    ctx.fillRect(x, gy - h, w, h);
    ctx.fillStyle = 'rgba(255,220,120,0.25)';
    for (let wy = gy - h + 12; wy < gy - 10; wy += 22) {
      for (let wx = x + 8; wx < x + w - 8; wx += 18) {
        if (Math.random() < 0.6) ctx.fillRect(wx, wy, 7, 10);
      }
    }
    ctx.fillStyle = 'rgba(20,28,48,0.55)';
  }

  // Footy goals out past the kids — sail one through the middle sticks for points.
  function drawGoals() {
    if (state === STATE.MENU) return;
    const gy = groundY();
    const top = gy - 200;
    ctx.strokeStyle = '#f3f1ea'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const posts = [[goalX - 28, gy - 150], [goalX - 9, top], [goalX + 9, top], [goalX + 28, gy - 150]];
    for (const p of posts) { ctx.beginPath(); ctx.moveTo(p[0], gy); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
    const grad = ctx.createLinearGradient(0, top, 0, gy);
    grad.addColorStop(0, 'rgba(255,210,61,0)'); grad.addColorStop(1, 'rgba(255,210,61,0.12)');
    ctx.fillStyle = grad; ctx.fillRect(goalX - 9, top, 18, gy - top);
  }

  function drawRing() {
    if (state === STATE.MENU) return;
    const gy = groundY();
    const it = equippedItem();
    const r = ring.r * it.window;
    const x = ring.x;
    const y = gy - 4;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    // ground ellipse ring
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,210,61,${0.55 + pulse * 0.4})`;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    // beam
    const grad = ctx.createLinearGradient(0, gy - 140, 0, gy);
    grad.addColorStop(0, 'rgba(255,210,61,0)');
    grad.addColorStop(1, `rgba(255,210,61,${0.10 + pulse * 0.08})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, gy - 140, r * 2, 140);
  }

  // Woofa — the good boy who throws. Stands upright on two legs to throw,
  // in his real colourway (black body, white belly/neck, white socks, white
  // tail tip, black head/eye-mask, white snout).
  function drawWoofa() {
    if (state === STATE.MENU) return;
    const gy = groundY();
    const aiming = state === STATE.AIM && aim.active;
    const fly = state === STATE.FLY;
    const BLACK = '#1a1a1e', WHITE = '#f3f1ea', SOFT = '#26262c';
    const t = performance.now();
    ctx.save();
    ctx.translate(thrower.x, gy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // shadow
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, 7); ctx.fill(); ctx.restore();

    // tail (behind) — black with white tip
    const tw = Math.sin(t / 120) * 4;
    ctx.strokeStyle = BLACK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-14, -44); ctx.quadraticCurveTo(-36, -34 + tw, -32, -10 + tw); ctx.stroke();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-33, -16 + tw); ctx.lineTo(-32, -10 + tw); ctx.stroke();

    // back arm (behind torso)
    ctx.strokeStyle = BLACK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-3, -88); ctx.lineTo(-15, -64); ctx.stroke();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-15, -70); ctx.lineTo(-15, -63); ctx.stroke();

    // legs (two) — black thigh, white sock, white foot
    ctx.lineWidth = 10;
    function leg(x) {
      ctx.strokeStyle = BLACK; ctx.beginPath(); ctx.moveTo(x * 0.5, -44); ctx.lineTo(x, -22); ctx.stroke();
      ctx.strokeStyle = WHITE; ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x, -2); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(x + 3, -1, 7, 4, 0, 0, 7); ctx.fill();
    }
    leg(-9); leg(9);

    // torso (upright) — black with white belly
    ctx.fillStyle = BLACK; ctx.beginPath(); ctx.ellipse(0, -64, 21, 28, 0, 0, 7); ctx.fill();
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(7, -58, 9, 19, 0, 0, 7); ctx.fill();
    // white neck ring
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(4, -92, 13, 9, 0, 0, 7); ctx.fill();

    // head — black skull + eye-mask, white snout, floppy ear
    const hx = 7, hy = -113;
    ctx.fillStyle = BLACK; ctx.beginPath(); ctx.ellipse(hx, hy, 16, 15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = SOFT; ctx.beginPath(); ctx.ellipse(hx - 10, hy - 6, 6, 11, -0.5, 0, 7); ctx.fill(); // ear
    ctx.fillStyle = WHITE; // snout
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy - 9);
    ctx.quadraticCurveTo(hx + 25, hy - 9, hx + 28, hy + 3);
    ctx.quadraticCurveTo(hx + 24, hy + 14, hx + 6, hy + 12);
    ctx.quadraticCurveTo(hx - 1, hy + 2, hx + 5, hy - 9);
    ctx.fill();
    ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.arc(hx + 7, hy - 3, 2.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(hx + 8, hy - 4, 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + 28, hy + 3, 3.2, 0, 7); ctx.fill(); // nose
    const mo = aiming ? 5 : 1;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + 28, hy + 5); ctx.quadraticCurveTo(hx + 18, hy + 8 + mo, hx + 7, hy + 10); ctx.stroke();

    // front (throwing) arm + paw holding the ball
    const hpx = fly ? 34 : 18, hpy = fly ? -130 : -116;
    ctx.strokeStyle = BLACK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(3, -88); ctx.quadraticCurveTo(hpx * 0.5, -104, hpx, hpy); ctx.stroke();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(hpx - 3, hpy + 5); ctx.lineTo(hpx, hpy); ctx.stroke();

    ctx.restore();
  }

  // ---- Woofa: German pointer × staghound. Mostly black, white neck, black eye-mask, white muzzle ----
  function paintDog(px, py, facing, pose) {
    const gy = groundY();
    const x = px;
    const y = py;
    const f = facing;            // 1 = right, -1 = left
    const leaping = !!pose.leaping;
    const chasing = !!pose.chasing;
    const t = pose.run || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f, 1);

    // ground shadow
    const airborne = gy - y;
    const shScale = clamp(1 - airborne / 260, 0.4, 1);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, gy - y, 40 * shScale, 9 * shScale, 0, 0, 7);
    ctx.fill();
    ctx.restore();

    const bodyTilt = (leaping ? -0.5 : (chasing ? 0.06 * Math.sin(t) : 0)) + (pose.tilt || 0);
    ctx.rotate(bodyTilt);

    const BLACK = '#1a1a1e';
    const BLACKSOFT = '#26262c';
    const WHITE = '#f3f1ea';

    // ---- legs (animated) — black with white socks on the lower half ----
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    const legPhase = leaping ? 0 : Math.sin(t);
    const legPhase2 = leaping ? 0 : Math.sin(t + Math.PI);
    function leg(px, swing, tuck) {
      const sw = leaping ? tuck : swing * 10;
      const footY = leaping ? -6 : 0;
      const mx = px + sw * 0.45, my = (-20 + footY) * 0.5;
      ctx.strokeStyle = BLACK;
      ctx.beginPath(); ctx.moveTo(px, -20); ctx.lineTo(mx, my); ctx.stroke();
      ctx.strokeStyle = WHITE;  // white sock
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(px + sw, footY); ctx.stroke();
    }
    // back legs
    leg(-26, legPhase, -14);
    leg(-20, legPhase2, -8);
    // front legs
    leg(20, legPhase2, 18);
    leg(28, legPhase, 26);

    // ---- tail — black with a white tip ----
    ctx.lineWidth = 6;
    const tailWag = Math.sin(performance.now() / 90) * ((pose.wag || 0) > 0.5 ? 6 : 3);
    ctx.strokeStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(-34, -34);
    ctx.quadraticCurveTo(-52, -44 + tailWag, -58, -30 + tailWag);
    ctx.stroke();
    ctx.strokeStyle = WHITE;   // white tail tip
    ctx.beginPath();
    ctx.moveTo(-55, -36 + tailWag);
    ctx.lineTo(-58, -30 + tailWag);
    ctx.stroke();

    // ---- body (mostly black) ----
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.ellipse(-6, -40, 34, 20, leaping ? -0.15 : 0, 0, 7);
    ctx.fill();
    // subtle top sheen
    ctx.fillStyle = BLACKSOFT;
    ctx.beginPath();
    ctx.ellipse(-8, -46, 26, 10, 0, 0, 7);
    ctx.fill();

    // (Woofa doesn't wear the cape — the kids do)
    if (pose.cape) drawCape(leaping, t);

    // ---- white neck patch ----
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(16, -52);
    ctx.quadraticCurveTo(30, -40, 24, -22);
    ctx.quadraticCurveTo(14, -26, 10, -40);
    ctx.quadraticCurveTo(10, -50, 16, -52);
    ctx.fill();

    // ---- neck to head ----
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(14, -54);
    ctx.quadraticCurveTo(30, -66, 36, -58);
    ctx.lineTo(30, -40);
    ctx.quadraticCurveTo(20, -42, 14, -48);
    ctx.fill();

    // ---- head ----
    const headX = 40, headY = -60;
    // black skull (over the eyes / top of head)
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.ellipse(headX, headY, 18, 15, 0, 0, 7);
    ctx.fill();

    // ---- white muzzle / face ----
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(headX + 2, headY - 2);
    ctx.quadraticCurveTo(headX + 26, headY - 4, headX + 30, headY + 6);
    ctx.quadraticCurveTo(headX + 26, headY + 16, headX + 6, headY + 14);
    ctx.quadraticCurveTo(headX - 2, headY + 6, headX + 2, headY - 2);
    ctx.fill();
    // white blaze up the face
    ctx.beginPath();
    ctx.moveTo(headX + 6, headY - 12);
    ctx.quadraticCurveTo(headX + 12, headY - 16, headX + 14, headY + 4);
    ctx.quadraticCurveTo(headX + 8, headY + 6, headX + 6, headY - 12);
    ctx.fill();

    // ---- black eye mask over the eyes ----
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.ellipse(headX + 8, headY - 2, 8, 7, -0.2, 0, 7);
    ctx.fill();

    // ---- ear (floppy, black) ----
    ctx.fillStyle = BLACKSOFT;
    ctx.beginPath();
    ctx.moveTo(headX - 6, headY - 8);
    ctx.quadraticCurveTo(headX - 20, headY + 2, headX - 12, headY + 20);
    ctx.quadraticCurveTo(headX - 4, headY + 12, headX - 2, headY - 2);
    ctx.fill();

    // ---- eye ----
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.arc(headX + 9, headY - 3, 2.6, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(headX + 10, headY - 4, 0.9, 0, 7);
    ctx.fill();

    // ---- nose ----
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(headX + 30, headY + 6, 3.4, 0, 7);
    ctx.fill();

    // ---- mouth (opens to fling the ball) ----
    const mo = (pose.mouthOpen || 0) * 8;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX + 30, headY + 8);
    ctx.quadraticCurveTo(headX + 20, headY + 10 + mo, headX + 8, headY + 12 + mo * 0.5);
    ctx.stroke();
    if (mo > 3) {
      ctx.fillStyle = '#c0455a';
      ctx.beginPath();
      ctx.ellipse(headX + 16, headY + 12 + mo * 0.4, 6, mo * 0.5, 0, 0, 7);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---- The two kids who chase the throws ----
  function drawCatchers() {
    if (state === STATE.MENU) return;
    const gy = groundY();
    const activeK = kids[activeKid];
    const idleK = kids[1 - activeKid];
    const s = dog.state;

    // bystander kid — stands near the ring and reacts
    drawKid(ring.x + 140, gy, -1, {
      run: performance.now() / 620,
      idle: true,
      cheer: s === 'catchpose' || s === 'leap',
    }, idleK);

    // Woofa charging in on all fours to eat them
    if (s === 'eaten' && woofaEat.active) {
      paintDog(woofaEat.x, gy, 1, { run: performance.now() / 80, chasing: true, mouthOpen: woofaEat.phase === 'chomp' ? 1 : 0.6, wag: 0, cape: false });
    }

    // active kid — the runner (gone if the rocket got them, or Woofa ate them)
    const chomped = s === 'eaten' && woofaEat.phase === 'chomp';
    if (s !== 'boom' && !chomped) drawKid(dog.x, dog.y, dog.facing, {
      run: dog.run,
      reaching: (s === 'chase' || s === 'leap'),
      leaping: s === 'leap',
      holding: disc.caught && (s === 'leap' || s === 'catchpose' || s === 'rip'),
      falling: s === 'fall',
      fallT: dog.stateT,
      crying: s === 'fall' && dog.onGround,
      tantrum: s === 'tantrum',
      scared: s === 'eaten',
      cheer: s === 'catchpose',
      cape: isCapeOn(),
    }, activeK);

    // speech bubble while they sook / panic
    if ((s === 'tantrum' || (s === 'eaten' && !chomped)) && dog.speech) {
      drawSpeechBubble(dog.x, dog.y - 82, dog.speech);
    }
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawSpeechBubble(x, y, text) {
    ctx.save();
    ctx.font = '800 14px system-ui, sans-serif';
    const w = Math.max(70, ctx.measureText(text).width + 22), h = 30;
    const bx = x - w / 2, by = y - h;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#241a12'; ctx.lineWidth = 2.5;
    roundRectPath(bx, by, w, h, 9); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x + 2, by + h + 11); ctx.lineTo(x + 8, by + h - 1); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#241a12'; ctx.stroke();
    ctx.fillStyle = '#241a12'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + h / 2);
    ctx.restore();
  }

  const KID_OUT = '#241a12';

  function drawKid(px, py, facing, pose, k) {
    const gy = groundY();
    const airborne = gy - py;
    const shs = clamp(1 - airborne / 260, 0.4, 1);
    const S = (k.scale || 1) * 1.18;
    const run = pose.run || 0;
    const OUT = KID_OUT;
    const now = performance.now();

    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(px, gy, 26 * shs * (k.scale || 1), 6.5 * shs * (k.scale || 1), 0, 0, 7); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(facing * S, S);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // whole-body pose transform
    if (pose.tantrum) { ctx.translate(0, 10); ctx.rotate(Math.sin(now / 70) * 0.14); }   // sat down, rocking + bawling
    else if (pose.crying) { ctx.translate(4, -4); ctx.rotate(1.32); }
    else if (pose.falling) { ctx.translate(0, -3); ctx.rotate(clamp((pose.fallT || 0) * 0.13, 0, 1.3)); }
    else if (pose.leaping) { ctx.rotate(-0.13); }
    else if (pose.reaching) { ctx.translate(0, Math.abs(Math.sin(run)) * -2); ctx.rotate(0.05); }
    else { ctx.translate(0, Math.sin(run * 0.6) * -1); }   // idle breathe

    // proportions (unit space, feet at 0, up negative)
    const chub = k.chub || 1;
    const hipY = -30;
    const torsoH = 32;
    const shoulderY = hipY - torsoH;
    const torsoW = 24 * chub;
    const headR = 15;
    const headCy = shoulderY - headR + 3;

    // ---- helpers ----
    function limb(pts, w, color) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = OUT; ctx.lineWidth = w + 2.2; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
    }
    function blob(cx, cy, rx, ry, color) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
    }
    function hand(x, y) { blob(x, y, 4.4, 4.4, k.skin); }
    function shoe(x, y) {
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath(); ctx.moveTo(-4, -3.5); ctx.quadraticCurveTo(-5.5, 3, 8.5, 3.5);
      ctx.quadraticCurveTo(9.5, -1.5, 3.5, -3.5); ctx.closePath();
      ctx.fillStyle = '#f1f1f6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 1.2); ctx.lineTo(7.5, 1.6); ctx.strokeStyle = k.shirt; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
    }
    // arm/leg endpoints by pose
    function armHand(dir) {
      if (pose.tantrum) return [dir * (torsoW * 0.5 + 10), shoulderY - 12 - Math.abs(Math.sin(now / 55)) * 11]; // flailing fists
      if (pose.scared) return [dir * (torsoW * 0.5 + 8), shoulderY - 8]; // hands up in panic
      if (pose.holding) return [dir * 5, headCy - 22];
      if (pose.leaping || pose.reaching || pose.cheer) return [dir * (torsoW * 0.16) + dir * 4, headCy - 12];
      if (pose.falling) return [dir * (torsoW * 0.55 + 12), shoulderY - 5];
      if (pose.crying) return [dir * 7, headCy + 4];
      return [dir * (torsoW * 0.5), hipY + 3 + Math.sin(run * 0.6 + (dir > 0 ? 0 : Math.PI)) * 2]; // idle down
    }
    function drawArm(dir, col) {
      const s = [dir * torsoW * 0.32, shoulderY + 7];
      const hd = armHand(dir);
      const el = [(s[0] + hd[0]) / 2 + dir * 2, (s[1] + hd[1]) / 2 + 2];
      limb([s, el, hd], 6, col); hand(hd[0], hd[1]);
    }
    function legTargets(side) { // side -1 back, +1 front
      const s1 = Math.sin(run + (side > 0 ? 0 : Math.PI));
      if (pose.tantrum) return { knee: [side * 11, hipY + 1], foot: [side * 25, hipY + 3] };   // sat, legs out front
      if (pose.leaping || pose.holding) return { knee: [side * 5, hipY + 12], foot: [side * 9, hipY + 26] };
      if (pose.falling || pose.crying) return { knee: [side * 9, hipY - 3], foot: [side * 19, hipY - 13] };
      if (pose.reaching) return { knee: [s1 * 7, hipY + 15], foot: [s1 * 15, 0] };
      return { knee: [side * 4, hipY + 15], foot: [side * 5 + s1 * 2, 0] };
    }
    function drawLeg(side, shortsCol, skinCol) {
      const t = legTargets(side);
      limb([[t.knee[0] * 0.35, hipY], t.knee], 8.5, shortsCol);
      limb([t.knee, t.foot], 6.5, skinCol);
      shoe(t.foot[0], t.foot[1]);
    }

    const skinD = k.skinShade || k.skin;
    const shirtD = k.shirtShade || k.shirt;

    // ==== draw order: cape, back limbs, torso, front limbs, head, hair, face ====
    if (pose.cape) drawKidCape(pose, shoulderY, hipY, torsoW, now);

    drawArm(-1, skinD);            // back arm
    drawLeg(-1, k.shorts, skinD);  // back leg

    // ---- torso ----
    (function torso() {
      const tw = torsoW, tl = shoulderY + 3, bl = hipY + 7;
      ctx.beginPath();
      ctx.moveTo(-tw * 0.4, tl);
      ctx.quadraticCurveTo(-tw * 0.56, (tl + bl) / 2, -tw * 0.5, bl);
      ctx.quadraticCurveTo(0, bl + 7, tw * 0.5, bl);
      ctx.quadraticCurveTo(tw * 0.56, (tl + bl) / 2, tw * 0.4, tl);
      ctx.quadraticCurveTo(0, tl - 5, -tw * 0.4, tl);
      ctx.closePath();
      ctx.fillStyle = k.shirt; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = shirtD; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(2, tl - 8); ctx.lineTo(tw, tl); ctx.lineTo(tw, bl + 12); ctx.lineTo(2, bl + 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, tl); ctx.quadraticCurveTo(0, tl + 6, 6, tl); ctx.lineWidth = 1.6; ctx.stroke(); // collar
    })();

    drawLeg(1, k.shorts, k.skin);  // front leg
    drawArm(1, k.skin);            // front arm

    // ---- neck ----
    limb([[0, shoulderY + 2], [0, headCy + headR - 3]], 8, k.skin);

    // ---- head ----
    blob(0, headCy, headR, headR * 1.02, k.skin);
    blob(headR * 0.9, headCy + 2, 3.2, 4, k.skin);       // ear (front)
    // cheek shade
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, headCy, headR, headR * 1.02, 0, 0, 7); ctx.clip();
    ctx.globalAlpha = 0.4; ctx.fillStyle = skinD;
    ctx.beginPath(); ctx.arc(-headR * 0.6, headCy + 1, headR * 1.1, 0, 7); ctx.fill();
    ctx.restore();

    // ---- hair ----
    (function hair() {
      ctx.fillStyle = k.hair; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      if (k.hairStyle === 'mop') {
        ctx.beginPath();
        ctx.moveTo(-headR * 1.05, headCy + 3);
        ctx.quadraticCurveTo(-headR * 1.18, headCy - headR * 1.25, 0, headCy - headR * 1.4);
        ctx.quadraticCurveTo(headR * 1.18, headCy - headR * 1.25, headR * 1.05, headCy + 3);
        ctx.quadraticCurveTo(headR * 0.6, headCy - headR * 0.25, headR * 0.12, headCy - headR * 0.6);
        ctx.quadraticCurveTo(-headR * 0.3, headCy - headR * 0.2, -headR * 0.62, headCy - headR * 0.55);
        ctx.quadraticCurveTo(-headR * 0.92, headCy - headR * 0.15, -headR * 1.05, headCy + 3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-headR * 0.98, headCy + 1);
        ctx.quadraticCurveTo(-headR * 1.02, headCy - headR * 1.35, 0, headCy - headR * 1.3);
        ctx.quadraticCurveTo(headR * 1.02, headCy - headR * 1.35, headR * 0.98, headCy + 1);
        ctx.quadraticCurveTo(headR * 0.55, headCy - headR * 0.55, headR * 0.24, headCy - headR * 0.78);
        ctx.quadraticCurveTo(0, headCy - headR * 0.5, -headR * 0.24, headCy - headR * 0.78);
        ctx.quadraticCurveTo(-headR * 0.55, headCy - headR * 0.5, -headR * 0.98, headCy + 1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // highlight
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = shade(k.hair, 42);
      ctx.beginPath(); ctx.ellipse(-headR * 0.3, headCy - headR * 0.9, headR * 0.5, headR * 0.28, -0.4, 0, 7); ctx.fill();
      ctx.restore();
    })();

    // ---- face (facing side = +x) ----
    if (pose.crying || pose.tantrum) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      // squeezed ^ eyes
      ctx.beginPath(); ctx.moveTo(headR * 0.1, headCy - 1); ctx.quadraticCurveTo(headR * 0.32, headCy - 4, headR * 0.55, headCy - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(headR * 0.62, headCy - 1); ctx.quadraticCurveTo(headR * 0.82, headCy - 4, headR * 1.0, headCy - 1); ctx.stroke();
      // wailing mouth
      blob(headR * 0.5, headCy + 6, 4.2, 5.4, '#8a3140');
      ctx.fillStyle = '#d67'; ctx.beginPath(); ctx.ellipse(headR * 0.5, headCy + 8.5, 2.4, 1.8, 0, 0, 7); ctx.fill();
      // streaming tears
      const tl = 4 + (Math.sin(now / 140) + 1) * 4;
      ctx.fillStyle = '#8fd8ff';
      [headR * 0.32, headR * 0.8].forEach((ex) => {
        ctx.beginPath(); ctx.moveTo(ex - 1.6, headCy + 1); ctx.lineTo(ex + 1.6, headCy + 1);
        ctx.lineTo(ex + 1, headCy + 1 + tl); ctx.quadraticCurveTo(ex, headCy + 3 + tl, ex - 1, headCy + 1 + tl); ctx.closePath(); ctx.fill();
      });
    } else {
      const shocked = pose.falling || pose.scared;
      const wide = shocked ? 1.4 : 1;
      const ex = headR * 0.34, ey = headCy - 1, er = 3 * wide;
      // two forward-facing eye whites
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-ex, ey, er, er * 1.15, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.15, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.ellipse(-ex, ey, er, er * 1.15, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.15, 0, 0, 7); ctx.stroke();
      // pupils (glance toward the facing side)
      const px = shocked ? 0 : er * 0.42;
      ctx.fillStyle = '#20140c';
      ctx.beginPath(); ctx.arc(-ex + px, ey, er * 0.55, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + px, ey, er * 0.55, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-ex + px + 0.8, ey - 0.9, 0.7, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + px + 0.8, ey - 0.9, 0.7, 0, 7); ctx.fill();
      // brows
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      const bw = shocked ? -3 : 0;
      ctx.beginPath();
      ctx.moveTo(-ex - 3, ey - er - 2 + bw); ctx.lineTo(-ex + 3, ey - er - 3 + bw);
      ctx.moveTo(ex - 3, ey - er - 3 + bw); ctx.lineTo(ex + 3, ey - er - 2 + bw);
      ctx.stroke();
      // little nose
      ctx.fillStyle = k.skinShade || k.skin;
      ctx.beginPath(); ctx.ellipse(headR * 0.06, headCy + 4, 1.7, 1.3, 0, 0, 7); ctx.fill();
      // mouth
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      if (shocked) { blob(0, headCy + 7.5, 2.8, 3.4, '#8a3140'); }
      else if (k.cheeky) {
        ctx.beginPath(); ctx.arc(0, headCy + 4, 5, 0.1, Math.PI - 0.1); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, headCy + 4.6, 3.4, 0.35, Math.PI - 0.35); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, headCy + 4, 3.2, 0.2, Math.PI - 0.2); ctx.stroke();
      }
      // freckles + blush for the young one (both cheeks)
      if (k.freckles) {
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#ff9a8a';
        ctx.beginPath(); ctx.ellipse(-ex, headCy + 5, 2.6, 1.8, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex, headCy + 5, 2.6, 1.8, 0, 0, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = k.skinShade;
        [[-ex, headCy + 5], [ex, headCy + 5], [ex + 3, headCy + 3.5], [-ex - 3, headCy + 3.5]].forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 0.7, 0, 7); ctx.fill(); });
      }
    }

    ctx.restore();
  }

  function drawKidCape(pose, shoulderY, hipY, torsoW, now) {
    const flow = Math.sin((now || 0) / 120) * 6;
    ctx.save();
    ctx.fillStyle = '#16161d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.28, shoulderY + 4);
    ctx.quadraticCurveTo(-torsoW - 20, shoulderY + (pose.leaping ? -14 : flow), -torsoW - 10, hipY + 10 + (pose.leaping ? -8 : flow));
    ctx.quadraticCurveTo(-torsoW * 0.7, hipY + 14, -torsoW * 0.5, hipY + 6);
    ctx.quadraticCurveTo(-torsoW * 0.4, hipY, -torsoW * 0.28, shoulderY + 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawCape(leaping, t) {
    const flow = Math.sin(performance.now() / 120) * 6;
    ctx.save();
    ctx.fillStyle = '#15151b';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(6, -54);
    ctx.quadraticCurveTo(-40, -60 + (leaping ? -16 : flow), -54, -18 + (leaping ? -8 : flow));
    ctx.quadraticCurveTo(-40, -30, -26, -18);
    ctx.quadraticCurveTo(-30, -40, 6, -54);
    ctx.fill();
    // little bat scallops on the edge
    ctx.fillStyle = '#0e0e13';
    ctx.beginPath();
    ctx.arc(-50, -20 + (leaping ? -8 : flow), 5, 0, 7);
    ctx.arc(-40, -14, 5, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  function drawDisc() {
    if (state === STATE.MENU) return;
    const it = equippedItem();
    const sz = it.size;
    ctx.save();
    ctx.translate(disc.x, disc.y);

    if (save.equipped === 'rocket') {
      // rocket — points the way it's flying, flame trailing
      ctx.rotate(Math.atan2(disc.vy, disc.vx || 1));
      const fl = 10 + Math.random() * 12;
      ctx.fillStyle = '#ffb03a'; ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(-sz - fl, 5); ctx.lineTo(-sz - fl, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(-sz - fl * 0.6, 2.6); ctx.lineTo(-sz - fl * 0.6, -2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c93a2a'; // fins
      ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.35); ctx.lineTo(-sz - 5, -sz * 0.85); ctx.lineTo(-sz + 6, -sz * 0.35); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-sz, sz * 0.35); ctx.lineTo(-sz - 5, sz * 0.85); ctx.lineTo(-sz + 6, sz * 0.35); ctx.fill();
      ctx.fillStyle = '#ececef'; ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.42, 0, 0, 7); ctx.fill(); // body
      ctx.fillStyle = '#d94b3a'; ctx.beginPath(); ctx.moveTo(sz * 0.55, -sz * 0.42); ctx.quadraticCurveTo(sz * 1.25, 0, sz * 0.55, sz * 0.42); ctx.closePath(); ctx.fill(); // nose
      ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.arc(-sz * 0.1, 0, sz * 0.2, 0, 7); ctx.fill(); // window
    } else if (save.equipped === 'frisbee') {
      // frisbee floats flat like a real frisbee — no tumble, just a gentle bob
      const bob = Math.sin(performance.now() / 120) * 1.5;
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.ellipse(0, bob, sz, sz * 0.42, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, bob - 1, sz * 0.6, sz * 0.24, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(-sz * 0.35, bob - 2, sz * 0.3, sz * 0.12, 0, 0, 7); ctx.fill();
    } else {
      // balls spin
      ctx.rotate(disc.spin);
      const grad = ctx.createRadialGradient(-sz * 0.3, -sz * 0.3, 1, 0, 0, sz);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.25, it.color); grad.addColorStop(1, shade(it.color, -30));
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, sz, 0, 7); ctx.fill();
      if (save.equipped === 'spiky') {
        ctx.fillStyle = shade(it.color, -40);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * sz, Math.sin(a) * sz);
          ctx.lineTo(Math.cos(a) * sz * 1.4, Math.sin(a) * sz * 1.4);
          ctx.lineTo(Math.cos(a + 0.3) * sz, Math.sin(a + 0.3) * sz); ctx.fill();
        }
      } else if (save.equipped === 'tennis') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(-sz * 0.3, 0, sz * 1.3, -0.9, 0.9); ctx.stroke();
      } else if (save.equipped === 'wreck') {
        ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, sz, 0, 7); ctx.stroke();
        ctx.fillStyle = '#3a3a44';
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * sz * 0.62, Math.sin(a) * sz * 0.62, 1.9, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#8a8a94'; ctx.beginPath(); ctx.arc(0, -sz, 3.4, 0, 7); ctx.fill(); // chain ring nub
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAimUI() {
    const { dx, dy } = aimVector();
    const pull = Math.hypot(dx, dy);
    if (pull < 8) return;
    const it = equippedItem();
    const maxPull = Math.min(W, H) * 0.42;
    const strength = clamp(pull / maxPull, 0, 1);
    const speed = (9 + strength * 20) * it.power;
    const ang = Math.atan2(dy, dx);
    // predicted trajectory dots (screen space)
    let x = disc.x - camX, y = disc.y;
    let vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
    const g = gravity * it.gravity;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 26; i++) {
      vy += g; vx += wind; x += vx; y += vy;
      if (i % 2 === 0) {
        ctx.globalAlpha = clamp(1 - i / 28, 0.15, 0.85);
        ctx.beginPath();
        ctx.arc(x, y, clamp(4 - i * 0.08, 1.5, 4), 0, 7);
        ctx.fill();
      }
      if (y > groundY()) break;
    }
    ctx.globalAlpha = 1;

    // power meter at the launch point
    const lx = disc.x - camX, ly = disc.y;
    ctx.save();
    ctx.translate(lx, ly);
    // pull-back line
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(ang) * pull * 0.4, -Math.sin(ang) * pull * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);
    // strength arc
    ctx.strokeStyle = `hsl(${lerp(140, 8, strength)}, 90%, 55%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + strength * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // color shade helper
  function shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  // ---------- Cape state ----------
  function isCapeOn() { return save.capeOn === true; }

  // ---------- HUD / UI ----------
  const hud = document.getElementById('hud');
  const hudLevel = document.getElementById('hudLevel');
  const hudCoins = document.getElementById('hudCoins');
  const hudStreak = document.getElementById('hudStreak');
  const toastEl = document.getElementById('toast');
  const aimHintEl = document.getElementById('aimHint');

  function updateHUD() {
    hudLevel.textContent = `Lvl ${level} · ${sceneFor(level).name}`;
    hudCoins.textContent = `🦴 ${save.coins}`;
    hudStreak.textContent = `🔥 ${streak}`;
  }
  let toastTimer = null;
  function toast(msg, color) {
    toastEl.textContent = msg;
    toastEl.style.color = color || '#fff';
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
  }
  let aimHintShown = false;
  function showAimHint() {
    if (aimHintShown) { aimHintEl.classList.add('hidden'); return; }
    aimHintEl.classList.remove('hidden');
  }
  function hideAimHint() { aimHintShown = true; aimHintEl.classList.add('hidden'); }

  // ---------- Screens ----------
  const startScreen = document.getElementById('startScreen');
  const howScreen = document.getElementById('howScreen');
  const shopScreen = document.getElementById('shopScreen');

  document.getElementById('playBtn').onclick = startGame;
  document.getElementById('howBtn').onclick = () => { startScreen.classList.add('hidden'); howScreen.classList.remove('hidden'); };
  document.getElementById('howBack').onclick = () => { howScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); };
  document.getElementById('shopBtn').onclick = openShop;
  document.getElementById('shopClose').onclick = closeShop;

  function startGame() {
    startScreen.classList.add('hidden');
    howScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    level = Math.min(save.maxLevel, SCENES.length * 3); // resume near where you were
    level = 1; // fresh run each session for score; unlocks persist
    sessionScore = 0; streak = 0; catchesThisLevel = 0;
    configureLevel(level);
    newThrow();
    updateHUD();
  }

  // ---------- Shop ----------
  const shopList = document.getElementById('shopList');
  const shopCoinsEl = document.getElementById('shopCoins');

  function openShop() {
    if (state === STATE.FLY) return;
    renderShop();
    shopScreen.classList.remove('hidden');
  }
  function closeShop() { shopScreen.classList.add('hidden'); }

  function renderShop() {
    shopCoinsEl.textContent = save.coins;
    shopList.innerHTML = '';

    const order = ['tennis', 'frisbee', 'spiky', 'squishy', 'wreck'];
    for (const key of order) {
      const it = ITEMS[key];
      const owned = !!save.owned[key];
      const equipped = save.equipped === key;
      const row = document.createElement('div');
      row.className = 'shop-item' + (owned ? ' owned' : '');
      let action;
      if (equipped) action = `<span class="si-tag equipped">Equipped</span>`;
      else if (owned) action = `<span class="si-tag equip" data-equip="${key}">Equip</span>`;
      else action = `<button class="si-buy" data-buy="${key}" ${save.coins < it.cost ? 'disabled' : ''}>Buy 🦴${it.cost}</button>`;
      row.innerHTML = `
        <div class="si-emoji">${it.emoji}</div>
        <div class="si-body">
          <div class="si-name">${it.name}</div>
          <div class="si-desc">${it.desc}</div>
        </div>
        <div class="si-action">${action}</div>`;
      shopList.appendChild(row);
    }

    // Rocket — one-use consumable
    const rocket = ITEMS.rocket;
    const rocketRow = document.createElement('div');
    const armed = !!save.owned.rocket;
    const rEquipped = save.equipped === 'rocket';
    rocketRow.className = 'shop-item' + (armed ? ' owned' : '');
    let rAction;
    if (rEquipped) rAction = `<span class="si-tag equipped">Armed 💥</span>`;
    else if (armed) rAction = `<span class="si-tag equip" data-equip="rocket">Arm it</span>`;
    else rAction = `<button class="si-buy" data-buyrocket="1" ${save.coins < rocket.cost ? 'disabled' : ''}>Buy 🦴${rocket.cost}</button>`;
    rocketRow.innerHTML = `
      <div class="si-emoji">${rocket.emoji}</div>
      <div class="si-body">
        <div class="si-name">${rocket.name} <span class="gc-tag-new" style="background:#ff5a2a;color:#2a0d05">1 USE</span></div>
        <div class="si-desc">${rocket.desc}</div>
      </div>
      <div class="si-action">${rAction}</div>`;
    shopList.appendChild(rocketRow);

    // Batman cape
    const capeOwned = save.capeUnlocked;
    const capeRow = document.createElement('div');
    const capeLocked = level < CAPE.unlockLevel && !capeOwned && save.maxLevel < CAPE.unlockLevel;
    capeRow.className = 'shop-item' + (capeOwned ? ' owned' : '') + (capeLocked ? ' locked' : '');
    let capeAction;
    if (capeOwned) {
      capeAction = save.capeOn
        ? `<span class="si-tag equip" data-cape="off">Take off</span>`
        : `<span class="si-tag equip" data-cape="on">Wear it</span>`;
    } else if (capeLocked) {
      capeAction = `<span class="si-tag lockmsg">Reach Lvl ${CAPE.unlockLevel}</span>`;
    } else {
      capeAction = `<button class="si-buy" data-buycape="1" ${save.coins < CAPE.cost ? 'disabled' : ''}>Buy 🦴${CAPE.cost}</button>`;
    }
    capeRow.innerHTML = `
      <div class="si-emoji">🦇</div>
      <div class="si-body">
        <div class="si-name">${CAPE.name}</div>
        <div class="si-desc">${CAPE.desc}</div>
      </div>
      <div class="si-action">${capeAction}</div>`;
    shopList.appendChild(capeRow);

    // wire buttons
    shopList.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyItem(b.dataset.buy));
    shopList.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => equipItem(b.dataset.equip));
    shopList.querySelectorAll('[data-buycape]').forEach(b => b.onclick = buyCape);
    shopList.querySelectorAll('[data-buyrocket]').forEach(b => b.onclick = buyRocket);
    shopList.querySelectorAll('[data-cape]').forEach(b => b.onclick = () => { save.capeOn = b.dataset.cape === 'on'; persist(); renderShop(); });
  }

  function buyItem(key) {
    const it = ITEMS[key];
    if (save.coins < it.cost) return;
    save.coins -= it.cost;
    save.owned[key] = true;
    save.equipped = key;
    persist(); updateHUD(); renderShop();
  }
  function equipItem(key) {
    if (!save.owned[key]) return;
    save.equipped = key;
    resetDisc();
    persist(); renderShop();
  }
  function buyRocket() {
    if (save.coins < ITEMS.rocket.cost) return;
    save.coins -= ITEMS.rocket.cost;
    save.owned.rocket = true;
    save.equipped = 'rocket';
    resetDisc();
    persist(); updateHUD(); renderShop();
  }
  function buyCape() {
    if (save.coins < CAPE.cost) return;
    if (level < CAPE.unlockLevel && save.maxLevel < CAPE.unlockLevel) return;
    save.coins -= CAPE.cost;
    save.capeUnlocked = true;
    save.capeOn = true;
    persist(); updateHUD(); renderShop();
  }

  // ---------- boot ----------
  updateHUD();
  requestAnimationFrame(frame);

  // Debug harness (only when the URL contains #debug). Inert in normal play.
  if (typeof location !== 'undefined' && location.hash.indexOf('debug') !== -1) {
    window.__wf = {
      step(n) { for (let i = 0; i < (n || 1); i++) { update(1); render(); } },
      resize,
      play() { startGame(); },
      throwUpRight() {
        if (state !== STATE.AIM) return 'not-aiming:' + state;
        aim.sx = 250; aim.sy = 500; aim.cx = 150; aim.cy = 620; aim.active = false;
        launchFromAim();
        return 'thrown';
      },
      throwAt(sx, sy, cx, cy) {
        if (state !== STATE.AIM) return 'not-aiming:' + state;
        aim.sx = sx; aim.sy = sy; aim.cx = cx; aim.cy = cy; aim.active = false;
        launchFromAim();
        return 'thrown';
      },
      setRing(x) { ring.x = x; dog.x = x; dog.targetX = x; },
      forceAim() { state = STATE.AIM; resetDisc(); },
      renderPose(poseName, kidIndex, capeOn) {
        if (state === STATE.MENU) startGame();
        activeKid = (kidIndex | 0) % kids.length;
        save.capeOn = !!capeOn;
        camX = 0;
        dog.x = W * 0.5; dog.y = groundY(); dog.facing = -1; dog.run = 1.4; dog.stateT = 40;
        dog.onGround = (poseName === 'fall');
        dog.state = poseName;
        disc.caught = (poseName === 'leap' || poseName === 'catchpose');
        if (disc.caught) { const m = dogMouthPos(); disc.x = m.x; disc.y = m.y; }
        else { disc.x = -9999; }
        render();
        return 'rendered:' + poseName;
      },
      info() {
        return { state, level, scene: sceneFor(level).name, dogState: dog.state,
          discX: disc.x | 0, discY: disc.y | 0, caught: disc.caught, attempted: disc.attempted,
          coins: save.coins, streak, activeKid, capeOn: !!save.capeOn,
          patrol: dog.patrol ? { on: dog.patrol.on, r: Math.round(dog.patrol.r), c: Math.round(dog.patrol.c) } : null,
          dogX: Math.round(dog.x), ringX: Math.round(ring.x) };
      },
      setLevel(n) { level = n; configureLevel(level); state = STATE.AIM; showAimHint && showAimHint(); },
      dogX() { return Math.round(dog.x); },
    };
  }

  // ---------- Service worker (PWA) ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
