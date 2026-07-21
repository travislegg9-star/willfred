/* =====================================================================
   EWE BEAUTY FARMING Co — Age-of-Empires-but-sheep.
   Hire farmhands (shear / haul / chop wood / mine stone), gather WOOD & STONE,
   BUILD a Market / Watchtower / Well / Hay Barn / Bunkhouse, upgrade pens to
   fox-proof STONE, RESEARCH a tech tree, and fend off foxes AND wolf packs
   as you advance through ERAS. Woofa herds. Minimap. Saves + grows offline.
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
  const FEED_COST = 8, WATER_COST = 3, PEN_COST = 120;
  const ERAS = [{ name: 'Homestead', ic: '🏡' }, { name: 'Smallholding', ic: '🚜' }, { name: 'Estate', ic: '🏘️' }, { name: 'Grand Estate', ic: '🏛️' }, { name: 'Sheep Empire', ic: '👑' }];
  const BREEDS = {
    normal: { name: 'Woolly', mult: 1, cost: 55, wool: '#f4f3ee', lvl: 1 },
    merino: { name: 'Merino', mult: 1.9, cost: 240, wool: '#efe7d2', lvl: 2 },
    golden: { name: 'Golden', mult: 4.2, cost: 1400, wool: '#ffd24a', lvl: 4 },
    black: { name: 'Black', mult: 6.5, cost: 2800, wool: '#3a3640', lvl: 5 },
  };
  const DOGS = {
    woofa: { name: 'Woofa', kind: 'woofa', cost: 0, bonus: 0.0, desc: 'Your loyal good boy. Herds the flock and chases off predators.' },
    winnie: { name: 'Winnie', kind: 'poodle', cost: 1600, bonus: 0.12, desc: 'Fluffy miniature poodle. +12% wool growth and another set of eyes on the foxes.' },
    tia: { name: 'Tia', kind: 'schnauzer', cost: 3400, bonus: 0.18, desc: 'Sharp miniature schnauzer. +18% wool growth and a fierce predator-chaser.' },
  };
  const ENERGY = [
    { name: 'No power', short: 'None' },
    { name: 'Windmill', short: 'Windmill', cost: 180, desc: 'Slowly tops up water. Cheap & breezy.' },
    { name: 'Solar Array', short: 'Solar', cost: 520, desc: 'Sun tops up feed & water — free to run.' },
    { name: 'Power Grid', short: 'Grid', cost: 980, desc: 'Auto-fills feed & water FAST — the bill nibbles your coin.' },
  ];
  const JOBS = ['shear', 'haul', 'wood', 'mine'];
  const WORKER = {
    shear: { name: 'Shepherd', emoji: '✂️', col: '#3a6ea5', desc: 'Roams the farm shearing fluffy sheep into your wool store.' },
    haul: { name: 'Hauler', emoji: '🪣', col: '#2f8a6a', desc: 'Keeps the feed & water troughs topped up (small coin per haul).' },
    wood: { name: 'Woodcutter', emoji: '🪓', col: '#8a5a34', desc: 'Chops trees into 🪵 wood for building.' },
    mine: { name: 'Miner', emoji: '⛏️', col: '#6a6f76', desc: 'Mines rocks into 🪨 stone for walls & tech.' },
  };
  const BUILD = {
    market: { name: 'Market', emoji: '🏪', coin: 220, wood: 20, stone: 0, w: 58, h: 46, desc: 'Auto-sells your wool for coin, little by little.' },
    tower: { name: 'Watchtower', emoji: '🗼', coin: 180, wood: 25, stone: 10, w: 30, h: 54, desc: 'Scares off foxes that wander near.' },
    bunk: { name: 'Bunkhouse', emoji: '🛖', coin: 260, wood: 30, stone: 0, w: 54, h: 40, desc: 'Houses +2 farmhands (raises your worker cap).' },
    well: { name: 'Well', emoji: '💧', coin: 160, wood: 12, stone: 8, w: 34, h: 34, desc: 'Slowly tops up the water trough.' },
    haybarn: { name: 'Hay Barn', emoji: '🌾', coin: 200, wood: 18, stone: 0, w: 54, h: 44, desc: 'Slowly tops up the feed trough.' },
    vet: { name: 'Vet Hut', emoji: '🩺', coin: 280, wood: 22, stone: 6, w: 46, h: 42, desc: 'Heals sick 🤒 sheep that wander near it.' },
  };
  const SEASONS = [{ name: 'Spring', ic: '🌱', grass: '#59ad4f' }, { name: 'Summer', ic: '☀️', grass: '#6bbf46' }, { name: 'Autumn', ic: '🍂', grass: '#a88a3a' }, { name: 'Winter', ic: '❄️', grass: '#b9c4cc' }];
  const SEASON_LEN = 5400 * 2;   // two day-cycles per season
  const TECH = {
    shears: { name: 'Sharper Shears', emoji: '✂️', coin: 400, wood: 0, stone: 0, desc: '+25% wool from every shear.' },
    hardy: { name: 'Hardy Breeds', emoji: '💪', coin: 500, wood: 20, stone: 0, desc: 'Sheep get hungry & thirsty 20% slower.' },
    fast: { name: 'Fast Hands', emoji: '⚡', coin: 450, wood: 15, stone: 0, desc: 'Farmhands move & work 25% faster.' },
    barons: { name: 'Wool Barons', emoji: '🎩', coin: 700, wood: 0, stone: 0, desc: '+30% wool sell price.' },
    pasture: { name: 'Rich Pastures', emoji: '🌾', coin: 350, wood: 15, stone: 0, desc: 'Grass & bushes regrow twice as fast.' },
    guard: { name: 'Guard Training', emoji: '🎖️', coin: 600, wood: 0, stone: 20, desc: 'Dogs catch predators from further away.' },
    masonry: { name: 'Masonry', emoji: '🧱', coin: 500, wood: 0, stone: 30, desc: 'Stone pen upgrades cost far less stone.' },
    vaccine: { name: 'Vaccination', emoji: '💉', coin: 550, wood: 0, stone: 0, desc: 'Sheep are far less likely to fall ill.' },
  };
  const STONE_PEN_COST = 30;

  const rollRole = () => Math.random() < 0.7 ? 'ewe' : 'ram';

  const defaultSave = () => ({
    money: 90, wool: 0, feed: 60, water: 60, wood: 25, stone: 0,
    sheep: [{ breed: 'normal', role: 'ewe', wool: 25 }, { breed: 'normal', role: 'ewe', wool: 10 }, { breed: 'normal', role: 'ram', wool: 15 }],
    sheepCap: 6, farmLevel: 1, energy: 0,
    dogs: { woofa: true }, upgrades: { tractor: false },
    pens: [{ x: 0, y: 0, w: 150, h: 118, gateOpen: true, gateSide: 0, stone: false, _init: false }],
    house: { level: 1 }, plants: null, troughs: null, workers: [], buildings: [], tech: {},
    dayT: 0, seasonT: 0, weather: 'clear', weatherT: 900, won: false, tutorialDone: false, muted: false, lastTime: nowMs(),
  });
  const WIN_MONEY = 10000;   // amass this in the Sheep Empire era to win the Golden Fleece

  let F = null;
  const sheep = [], dogs = [], preds = [], fluff = [], grass = [], pops = [], workers = [], motes = [];
  let tractor = null, paddock = {}, feedTrough = {}, waterTrough = {}, shed = {}, house = {};
  let running = false, tick = 0, breedTimer = 1600, predTimer = 1600, alertTimer = 0;
  let placing = null, drag = null, selectedPen = null, selectedBuilding = null, herdGoal = null;
  let cam = { x: 0, y: 0 }, viewH = 0, panLast = null;   // vertical camera for the scrollable map

  function spaceMargins() { const lvl = F ? F.farmLevel : 1; return { top: Math.max(150, 178 - (lvl - 1) * 6), bot: 128, mx: Math.max(6, 18 - (lvl - 1) * 2) }; }
  function worldScale() { return 1 + ((F ? F.farmLevel : 1) - 1) * 0.15; }   // taller world as the empire grows
  function camMaxY() { return Math.max(0, paddock.h - viewH); }
  function layout() {
    const m = spaceMargins();
    viewH = H - m.top - m.bot;
    paddock = { x: m.mx, y: m.top, w: W - m.mx * 2, h: viewH * worldScale() };
    cam.y = clamp(cam.y, 0, camMaxY());
    if (F && F.troughs) { feedTrough = F.troughs.feed; waterTrough = F.troughs.water; }
    shed = { x: paddock.x + paddock.w - 60, y: paddock.y + 8 };
    house = { x: paddock.x + 46, y: paddock.y + 12 };
  }
  function defaultTroughs() { return { feed: { x: paddock.x + paddock.w * 0.30, y: paddock.y + paddock.h - 34 }, water: { x: paddock.x + paddock.w * 0.62, y: paddock.y + paddock.h - 34 } }; }

  function dscale(y) { return 0.58 + 0.64 * clamp((y - paddock.y) / paddock.h, 0, 1); }
  const INSET_BASE = 0.17;
  function inset() { return Math.max(0.09, INSET_BASE - (F ? (F.farmLevel - 1) * 0.012 : 0)); }
  function fieldBounds(y) { const ty = clamp((y - paddock.y) / paddock.h, 0, 1), ins = paddock.w * inset() * (1 - ty); return { left: paddock.x + ins + 16, right: paddock.x + paddock.w - ins - 16 }; }

  const alerts = [];
  function flashAlert(msg, col, big) { const ex = alerts.find(a => a.msg === msg); if (ex) { ex.t = 1; return; } alerts.push({ msg, col: col || '#ff5a5a', t: 1, big: !!big }); if (alerts.length > 3) alerts.shift(); }

  // tech helpers
  const T = (k) => F.tech && F.tech[k];
  const techWoolMult = () => T('shears') ? 1.25 : 1;
  const techNeedMult = () => T('hardy') ? 0.8 : 1;
  const techWorkerSpeed = () => T('fast') ? 1.25 : 1;
  const techSellMult = () => T('barons') ? 1.3 : 1;
  const techGrass = () => T('pasture') ? 2 : 1;
  const techDogRange = () => T('guard') ? 1.3 : 1;
  const stonePenCost = () => T('masonry') ? 12 : STONE_PEN_COST;

  // ---------- day / night ----------
  const DAY_LEN = 5400;   // ticks for a full day+night (~90s at 60fps)
  function nightAmt() {
    const phase = ((F.dayT || 0) % DAY_LEN) / DAY_LEN;
    if (phase < 0.5) return 0;                       // day
    if (phase < 0.62) return (phase - 0.5) / 0.12;   // dusk
    if (phase < 0.9) return 1;                        // night
    return 1 - (phase - 0.9) / 0.1;                   // dawn
  }
  const isNight = () => nightAmt() > 0.5;
  let wasNight = false;
  // ---------- seasons / weather ----------
  const seasonIx = () => Math.floor((F.seasonT || 0) / SEASON_LEN) % 4;
  function pickWeather(s) { const r = Math.random(); if (s === 3) return r < 0.45 ? 'snow' : 'clear'; if (s === 1) return r < 0.18 ? 'rain' : r < 0.30 ? 'drought' : 'clear'; return r < 0.32 ? 'rain' : 'clear'; }
  function hasBuilding(k) { return F.buildings.some(b => b.bkind === k); }
  // worker level speed / xp
  function workerSpeedMul(w) { return 1 + ((w.level || 1) - 1) * 0.12; }
  function gainXp(w) { if ((w.level || 1) >= 5) return; w.xp = (w.xp || 0) + 1; if (w.xp >= (w.level || 1) * 8) { w.xp = 0; w.level = (w.level || 1) + 1; pop(w.x, w.y - 16, '⭐Lv' + w.level, '#ffd23d'); sfx.up(); syncWorkerJobs(); } }

  // ---------- sound ----------
  let actx = null, master = null, musicGain = null, musicOn = false, musicStep = 0, nextNoteTime = 0;
  const BPM = 66, SPB = 60 / BPM, EIGHTH = SPB / 2;
  const M_C = 130.81, nf = (semi) => M_C * Math.pow(2, semi / 12);
  const PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];   // Cmaj · Gmaj · Amin · Fmaj
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  function ensureAudio() {
    try {
      if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.85; master.connect(actx.destination); musicGain = actx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master); }
      if (actx.state === 'suspended' && actx.resume) actx.resume();
      nextNoteTime = actx.currentTime + 0.12; musicOn = true;
    } catch (e) { actx = null; musicOn = false; }
  }
  function tone(type, f, t, dur, v, atk) { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (atk || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.03); }
  function musicSched() {
    try {
      if (!actx || F.muted) { if (actx) nextNoteTime = actx.currentTime + 0.1; return; }
      while (nextNoteTime < actx.currentTime + 0.3) {
        const step = musicStep, t = nextNoteTime, night = nightAmt(), mv = 1 - night * 0.45;
        const bar = Math.floor(step / 8) % PROG.length, chord = PROG[bar], inBar = step % 8;
        if (inBar === 0) for (const s of chord) tone('sine', nf(s - 12), t, SPB * 3.6, 0.022 * mv, 0.5);   // warm pad
        const an = chord[inBar % chord.length] + (inBar >= 4 ? 12 : 0); tone('triangle', nf(an), t, 0.5, 0.03 * mv, 0.008);   // arpeggio
        if ((inBar === 2 || inBar === 6) && Math.random() < 0.45) tone('sine', nf(PENTA[(Math.random() * PENTA.length) | 0] + 12), t + 0.02, 0.55, 0.026 * mv, 0.03);   // gentle lead
        musicStep++; nextNoteTime += EIGHTH;
      }
    } catch (e) { musicOn = false; }
  }
  function beep(freq, dur, type, vol) { if (!F || F.muted || !actx) return; try { const o = actx.createOscillator(), g = actx.createGain(); o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = (vol || 0.05); o.connect(g); g.connect(master || actx.destination); const t = actx.currentTime; o.start(t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12)); o.stop(t + (dur || 0.12) + 0.02); } catch (e) {} }
  const sfx = {
    coin() { beep(880, 0.09, 'triangle', 0.05); setTimeout(() => beep(1320, 0.08, 'triangle', 0.045), 60); },
    shear() { beep(520, 0.06, 'square', 0.04); }, chop() { beep(140, 0.08, 'square', 0.05); }, mine() { beep(200, 0.07, 'square', 0.05); }, pop() { beep(660, 0.07, 'sine', 0.05); },
    fox() { beep(180, 0.18, 'sawtooth', 0.05); }, wolf() { beep(110, 0.3, 'sawtooth', 0.06); }, boom() { beep(120, 0.25, 'sawtooth', 0.07); setTimeout(() => beep(90, 0.2, 'square', 0.05), 40); },
    up() { beep(523, 0.1, 'triangle', 0.05); setTimeout(() => beep(784, 0.14, 'triangle', 0.05), 90); }, woof() { beep(240, 0.12, 'square', 0.05); setTimeout(() => beep(200, 0.1, 'square', 0.04), 90); },
    build() { beep(392, 0.09, 'square', 0.05); setTimeout(() => beep(523, 0.1, 'triangle', 0.05), 90); }, tech() { beep(660, 0.08, 'triangle', 0.05); setTimeout(() => beep(990, 0.12, 'triangle', 0.05), 80); }, err() { beep(160, 0.12, 'square', 0.04); },
    baa() { beep(300, 0.16, 'sawtooth', 0.03); setTimeout(() => beep(270, 0.14, 'sawtooth', 0.025), 120); },
    bird() { beep(1900, 0.05, 'sine', 0.025); setTimeout(() => beep(2300, 0.05, 'sine', 0.022), 80); setTimeout(() => beep(2050, 0.06, 'sine', 0.018), 165); },
    cricket() { beep(3200, 0.025, 'square', 0.012); setTimeout(() => beep(3200, 0.025, 'square', 0.01), 55); },
  };

  // ---------- particles ----------
  function spawnFluff(x, y, c) { for (let i = 0; i < 10; i++) fluff.push({ x, y, vx: rand(-2, 2), vy: rand(-3, -0.5), life: 1, r: rand(3, 6), c: c || '#f4f3ee' }); }
  function dustPuff(x, y) { fluff.push({ x: x + rand(-3, 3), y, vx: rand(-0.6, 0.6), vy: rand(-1.1, -0.3), life: 0.7, r: rand(3, 6), c: 'rgba(190,168,128,0.65)' }); }
  function splash(x, y) { for (let i = 0; i < 3; i++) fluff.push({ x, y, vx: rand(-1.3, 1.3), vy: rand(-2.3, -0.8), life: 0.55, r: rand(2, 3.4), c: '#9fdcff' }); }
  function pop(x, y, txt, col, big) { pops.push({ x, y, vx: rand(-0.4, 0.4), vy: rand(-2.4, -1.4), life: 1, txt, col: col || '#fff', sz: big ? 22 : 15, spin: 0, rot: 0 }); }   // text pops float straight up (readable)
  function confetti(x, y, emojis) { for (let i = 0; i < 12; i++) pops.push({ x, y, vx: rand(-3, 3), vy: rand(-4.5, -1.5), life: 1, txt: emojis[(Math.random() * emojis.length) | 0], col: '#fff', sz: rand(14, 22), spin: rand(-0.3, 0.3), rot: rand(0, 6) }); }

  // ---------- factories ----------
  function makeSheep(o = {}) {
    return {
      x: o.x != null ? o.x : rand(paddock.x + 40, paddock.x + paddock.w - 40), y: o.y != null ? o.y : rand(paddock.y + 40, paddock.y + paddock.h - 60),
      breed: o.breed || 'normal', role: o.role || 'ewe', tx: 0, ty: 0, moveT: 0,
      hunger: o.hunger != null ? o.hunger : rand(10, 30), thirst: o.thirst != null ? o.thirst : rand(10, 30),
      wool: o.wool != null ? o.wool : rand(0, 25), size: o.role === 'lamb' ? 0.4 : (o.size != null ? o.size : 0.85),
      age: o.role === 'lamb' ? 0 : 999, health: 100, starve: 0, baaT: 0, heartT: 0, face: rand(0, 6), breedCD: rand(600, 1200),
      sick: !!o.sick, sickT: 0,
    };
  }
  function makeDog(kind) { return { kind, x: rand(paddock.x + 60, paddock.x + paddock.w - 60), y: rand(paddock.y + 40, paddock.y + paddock.h - 40), tx: 0, ty: 0, moveT: 0, zoom: 0, facing: 1, orbit: rand(0, 6), _fx: null }; }
  function makeWorker(job, level, xp) { return { job, level: level || 1, xp: xp || 0, x: house.x + rand(0, 40), y: house.y + rand(40, 60), tx: 0, ty: 0, moveT: 0, cd: 0, facing: 1, step: 0 }; }
  function rebuildWorkers() { workers.length = 0; for (const w of (F.workers || [])) workers.push(makeWorker(w.job, w.level, w.xp)); }
  function bunkCount() { return F.buildings.filter(b => b.bkind === 'bunk').length; }
  function workerCap() { return 3 + (F.farmLevel - 1) + (F.house.level - 1) + bunkCount() * 2; }
  function initGrass() { grass.length = 0; for (let i = 0; i < 40; i++) grass.push({ x: rand(paddock.x + 20, paddock.x + paddock.w - 20), y: rand(paddock.y + 20, paddock.y + paddock.h - 24), amt: rand(0.35, 0.9) }); }
  function initMotes() { motes.length = 0; for (let i = 0; i < 16; i++) motes.push({ x: rand(paddock.x + 40, paddock.x + paddock.w - 40), y: rand(paddock.y + 20, paddock.y + paddock.h - 20), ph: rand(0, 6), vx: rand(-0.14, 0.14), vy: rand(-0.12, -0.03) }); }
  function initPlants() {
    F.plants = [];
    F.plants.push({ type: 'tree', x: paddock.x + paddock.w * 0.16, y: paddock.y + 30, sz: rand(0.9, 1.1), wood: 100 });
    F.plants.push({ type: 'tree', x: paddock.x + paddock.w * 0.84, y: paddock.y + 26, sz: rand(0.9, 1.1), wood: 100 });
    F.plants.push({ type: 'bush', x: paddock.x + paddock.w * 0.5, y: paddock.y + paddock.h * 0.32, sz: 1, amt: 1 });
    F.plants.push({ type: 'rock', x: paddock.x + paddock.w * 0.72, y: paddock.y + paddock.h * 0.2, sz: 1, stone: 100 });
    F.plants.push({ type: 'rock', x: paddock.x + paddock.w * 0.3, y: paddock.y + paddock.h * 0.18, sz: 0.9, stone: 100 });
  }
  function makeTractor() { return { x: paddock.x + 50, y: paddock.y + 50, tx: 0, ty: 0, facing: 1, zoom: 0 }; }
  function rebuildDogs() { dogs.length = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) dogs.push(makeDog(DOGS[k].kind)); }
  function dogBonus() { let b = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) b += DOGS[k].bonus; return b; }
  function houseWoolBonus() { return (F.house.level - 1) * 0.06; }
  function houseIncome() { return (F.house.level - 1) * 0.006; }
  function eraName() { return ERAS[Math.min(F.farmLevel - 1, ERAS.length - 1)]; }
  function shearValue(s) { return Math.max(1, Math.round((5 + s.size * 4 + s.health / 30) * BREEDS[s.breed].mult * techWoolMult())); }

  // ---------- pens / gates ----------
  function gateWidth(p) { const side = (p.gateSide === 2 || p.gateSide === 3) ? p.h : p.w; return clamp(Math.min(72, side * 0.55), 34, Math.max(20, side - 10)); }
  function gateCenter(p) { switch (p.gateSide) { case 1: return { x: p.x + p.w / 2, y: p.y }; case 2: return { x: p.x, y: p.y + p.h / 2 }; case 3: return { x: p.x + p.w, y: p.y + p.h / 2 }; default: return { x: p.x + p.w / 2, y: p.y + p.h }; } }
  function penWalls(p) {
    const g = gateWidth(p) / 2, x0 = p.x, y0 = p.y, x1 = p.x + p.w, y1 = p.y + p.h, cx = p.x + p.w / 2, cy = p.y + p.h / 2, w = [];
    const edge = (side, ax, ay, bx, by, along) => { if (side === p.gateSide && p.gateOpen) { if (along === 'x') { w.push([ax, ay, cx - g, ay]); w.push([cx + g, by, bx, by]); } else { w.push([ax, ay, ax, cy - g]); w.push([bx, cy + g, bx, by]); } } else { w.push([ax, ay, bx, by]); } };
    edge(1, x0, y0, x1, y0, 'x'); edge(0, x0, y1, x1, y1, 'x'); edge(2, x0, y0, x0, y1, 'y'); edge(3, x1, y0, x1, y1, 'y'); return w;
  }
  function repelFromPens(e, buffer, stoneOnly) { if (!F.pens) return; for (const p of F.pens) { if (stoneOnly && !p.stone) continue; for (const seg of penWalls(p)) { const c = closestOnSeg(e.x, e.y, seg[0], seg[1], seg[2], seg[3]); const d = dist(e.x, e.y, c.x, c.y); if (d < buffer && d > 0.001) { const push = buffer - d; e.x += (e.x - c.x) / d * push; e.y += (e.y - c.y) / d * push; } } } }
  const penInside = (p, x, y) => x > p.x - 4 && x < p.x + p.w + 4 && y > p.y - 4 && y < p.y + p.h + 4;
  const penInsideStrict = (p, x, y) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
  function insideAnyPen(x, y) { for (const p of F.pens) if (penInsideStrict(p, x, y)) return p; return null; }
  // a sheep tucked inside a stone pen is safe: a closed gate is total protection; an open one
  // only lets a predator that has actually walked inside reach it
  function predShielded(s, fx) { for (const p of F.pens) { if (!p.stone || !penInside(p, s.x, s.y)) continue; if (!p.gateOpen) return true; if (!penInsideStrict(p, fx.x, fx.y)) return true; } return false; }
  function penCorners(p) { return [{ k: 'nw', x: p.x, y: p.y }, { k: 'ne', x: p.x + p.w, y: p.y }, { k: 'sw', x: p.x, y: p.y + p.h }, { k: 'se', x: p.x + p.w, y: p.y + p.h }]; }
  const penTick = (p) => ({ x: p.x + p.w / 2 - 30, y: p.y - 22 });
  const penScrap = (p) => ({ x: p.x + p.w / 2 + 30, y: p.y - 22 });
  const penStoneBtn = (p) => ({ x: p.x + p.w / 2, y: p.y - 22 });
  const inBuilding = (b, x, y) => x > b.x && x < b.x + b.w && y > b.y - 14 && y < b.y + b.h;
  function buildingAt(x, y) { for (let i = F.buildings.length - 1; i >= 0; i--) if (inBuilding(F.buildings[i], x, y)) return F.buildings[i]; return null; }
  const bScrapBtn = (b) => ({ x: b.x + b.w, y: b.y - 8 });
  function scrapBuilding(b) { const i = F.buildings.indexOf(b); if (i < 0) return; const bd = BUILD[b.bkind]; F.buildings.splice(i, 1); selectedBuilding = null; F.money += Math.round(bd.coin * 0.5); F.wood += Math.round(bd.wood * 0.5); F.stone += Math.round((bd.stone || 0) * 0.5); toast('🗑️ ' + bd.name + ' scrapped (refund)'); pop(b.x + b.w / 2, b.y, '🗑️', '#ff8a3d'); sfx.pop(); persist(); updateHud(); }
  function flockCentroid() { if (!sheep.length) return { x: paddock.x + paddock.w / 2, y: paddock.y + paddock.h / 2 }; let cx = 0, cy = 0; for (const s of sheep) { cx += s.x; cy += s.y; } return { x: cx / sheep.length, y: cy / sheep.length }; }
  function nearestOpenPen() { const c = flockCentroid(); let best = null, bd = 1e9; for (const p of F.pens) { if (!p.gateOpen) continue; const g = gateCenter(p); const d = dist(c.x, c.y, g.x, g.y); if (d < bd) { bd = d; best = p; } } return best; }

  // ---------- persistence ----------
  function load() { try { const r = localStorage.getItem(SAVE_KEY); if (!r) return defaultSave(); return Object.assign(defaultSave(), JSON.parse(r)); } catch (e) { return defaultSave(); } }
  function persist() { if (!F) return; F.lastTime = nowMs(); F.sheep = sheep.map(s => ({ breed: s.breed, role: s.role, wool: s.wool, hunger: s.hunger, thirst: s.thirst, size: s.size, age: s.age, sick: s.sick })); try { localStorage.setItem(SAVE_KEY, JSON.stringify(F)); } catch (e) {} }

  function startGame() {
    F = load(); layout(); ensureAudio();
    if (typeof F.energy !== 'number') F.energy = F.power === 'electric' ? 3 : F.power === 'economical' ? 1 : 0;
    if (typeof F.wood !== 'number') F.wood = 25; if (typeof F.stone !== 'number') F.stone = 0;
    if (!F.workers) F.workers = []; if (!F.buildings) F.buildings = []; if (!F.tech) F.tech = {};
    if (typeof F.dayT !== 'number') F.dayT = 0; if (F.won == null) F.won = false;
    if (typeof F.seasonT !== 'number') F.seasonT = 0; if (!F.weather) F.weather = 'clear'; if (typeof F.weatherT !== 'number') F.weatherT = 900;
    if (!F.troughs) { F.troughs = defaultTroughs(); layout(); }
    if (!F.house) F.house = { level: 1 };
    if (!F.pens) F.pens = [];
    if (!F.plants) initPlants();
    if (!F.plants.some(p => p.type === 'rock')) { F.plants.push({ type: 'rock', x: paddock.x + paddock.w * 0.72, y: paddock.y + paddock.h * 0.2, sz: 1, stone: 100 }); }
    for (const pl of F.plants) { if (pl.type === 'tree' && pl.wood == null) pl.wood = 100; if (pl.type === 'rock' && pl.stone == null) pl.stone = 100; }
    for (const t of [F.troughs.feed, F.troughs.water]) { const b = fieldBounds(t.y); t.x = clamp(t.x, b.left, b.right); t.y = clamp(t.y, paddock.y + 26, paddock.y + paddock.h - 20); }
    for (const p of F.pens) { if (!p._init) { p.x = paddock.x + paddock.w / 2 - p.w / 2; p.y = paddock.y + paddock.h * 0.5 - p.h / 2; p._init = true; } if (p.gateSide == null) p.gateSide = 0; if (p.stone == null) p.stone = false; }
    sheep.length = 0; for (const sd of (F.sheep || [])) sheep.push(makeSheep(sd));
    while (sheep.length < 3) sheep.push(makeSheep({ role: rollRole() }));
    rebuildDogs(); rebuildWorkers(); initGrass(); initMotes();
    tractor = F.upgrades && F.upgrades.tractor ? makeTractor() : null;
    applyOffline(); running = true; hideOverlays(); updateHud(); syncMute();
    if (!F.tutorialDone) startTutorial();
  }
  function applyOffline() {
    const el = clamp((nowMs() - (F.lastTime || nowMs())) / 1000, 0, 8 * 3600); if (el < 30) return;
    const fed = F.feed > 5, watered = F.water > 5, rate = 0.22 * (fed ? 1 : 0.4) * (watered ? 1 : 0.6) * (1 + dogBonus() + houseWoolBonus());
    let grew = 0; for (const s of sheep) { if (s.role === 'lamb') continue; const add = Math.min(rate * el, 100 - s.wool); s.wool += add; grew += add; }
    F.feed = clamp(F.feed - el * 0.03, 0, 100); F.water = clamp(F.water - el * 0.03, 0, 100); F.money += houseIncome() * el * 0.6;
    if (grew > 5) setTimeout(() => toast('🧺 Your flock grew wool while you were away!'), 400);
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top + cam.y }; }
  function nearGate(p, x, y) { const g = gateCenter(p); return dist(x, y, g.x, g.y) < gateWidth(p) / 2 + 8; }
  function wallMidHit(p, x, y) { const mids = [{ s: 0, x: p.x + p.w / 2, y: p.y + p.h }, { s: 1, x: p.x + p.w / 2, y: p.y }, { s: 2, x: p.x, y: p.y + p.h / 2 }, { s: 3, x: p.x + p.w, y: p.y + p.h / 2 }]; for (const m of mids) if (dist(x, y, m.x, m.y) < 20) return m.s; return -1; }

  function onDown(e) {
    if (!running) return; e.preventDefault && e.preventDefault();
    const p = pt(e);
    if (placing) { const wasB = !!placing.bkind; placing = null; if (wasB) { toast('🏗️ Built!'); sfx.build(); } else { selectedPen = F.pens[F.pens.length - 1]; toast('Pen dropped — resize corners · 🧱 stone · ✓ / ✕'); sfx.pop(); } persist(); return; }

    for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb' && dist(p.x, p.y, s.x, s.y - 6) < 30) {
      if (insideAnyPen(s.x, s.y)) shearSheep(s); else { toast('🚧 Pen them, or hire a Shepherd ✂️'); flashAlert('🚧 Pen them, or hire a Shepherd ✂️', '#ffb03a'); sfx.err(); }
      return;
    }
    for (const pen of F.pens) if (nearGate(pen, p.x, p.y)) { pen.gateOpen = !pen.gateOpen; toast(pen.gateOpen ? 'Gate opened' : 'Gate closed'); sfx.pop(); persist(); return; }

    if (selectedPen) {
      const sp = selectedPen;
      const tk = penTick(sp); if (dist(p.x, p.y, tk.x, tk.y) < 16) { selectedPen = null; toast('Pen saved'); sfx.pop(); persist(); return; }
      const scr = penScrap(sp); if (dist(p.x, p.y, scr.x, scr.y) < 16) { scrapPen(sp); return; }
      if (!sp.stone) { const st = penStoneBtn(sp); if (dist(p.x, p.y, st.x, st.y) < 16) { upgradePenStone(sp); return; } }
      for (const c of penCorners(sp)) if (dist(p.x, p.y, c.x, c.y) < 18) { drag = { type: 'resize', ref: sp, corner: c.k }; return; }
      const side = wallMidHit(sp, p.x, p.y); if (side >= 0 && side !== sp.gateSide) { sp.gateSide = side; toast('Gate moved'); sfx.pop(); persist(); return; }
      if (penInside(sp, p.x, p.y)) { drag = { type: 'pen', ref: sp, ox: p.x - sp.x, oy: p.y - sp.y }; return; }
      selectedPen = null; return;
    }
    if (selectedBuilding) {
      const b = selectedBuilding, sb = bScrapBtn(b);
      if (dist(p.x, p.y, sb.x, sb.y) < 15) { scrapBuilding(b); return; }
      if (inBuilding(b, p.x, p.y)) { drag = { type: 'building', ref: b, ox: p.x - b.x, oy: p.y - b.y }; return; }
      selectedBuilding = null; return;
    }

    for (const w of workers) { const s = dscale(w.y); if (dist(p.x, p.y, w.x, w.y - 8) < 16 * s) { w.job = JOBS[(JOBS.indexOf(w.job) + 1) % JOBS.length]; syncWorkerJobs(); toast(WORKER[w.job].emoji + ' Now a ' + WORKER[w.job].name); sfx.pop(); persist(); return; } }

    for (const t of [feedTrough, waterTrough]) { const s = dscale(t.y); if (dist(p.x, p.y, t.x, t.y) < 24 * s) { drag = { type: 'trough', ref: t, ox: p.x - t.x, oy: p.y - t.y }; return; } }
    const bh = buildingAt(p.x, p.y); if (bh) { selectedBuilding = bh; selectedPen = null; toast('Drag to move · ✕ to scrap'); sfx.pop(); return; }
    for (const pen of F.pens) if (penInside(pen, p.x, p.y)) { selectedPen = pen; selectedBuilding = null; toast('Editing pen — resize corners · 🧱 stone · ✓ keep · ✕ scrap'); sfx.pop(); return; }

    selectedBuilding = null; herdGoal = null; herdTo(p.x, p.y);
  }
  function syncWorkerJobs() { F.workers = workers.map(w => ({ job: w.job, level: w.level || 1, xp: w.xp || 0 })); }
  function onMove(e) {
    const p = pt(e);
    if (placing) { placing.x = clamp(p.x - placing.w / 2, paddock.x + 4, paddock.x + paddock.w - placing.w - 4); placing.y = clamp(p.y - placing.h / 2, paddock.y + 4, paddock.y + paddock.h - placing.h - 4); return; }
    if (!drag) return;
    if (drag.type === 'pen' || drag.type === 'building') { drag.ref.x = clamp(p.x - drag.ox, paddock.x + 4, paddock.x + paddock.w - drag.ref.w - 4); drag.ref.y = clamp(p.y - drag.oy, paddock.y + 4, paddock.y + paddock.h - drag.ref.h - 4); }
    else if (drag.type === 'resize') {
      const r = drag.ref, mnx = paddock.x + 4, mny = paddock.y + 4, mxx = paddock.x + paddock.w - 4, mxy = paddock.y + paddock.h - 4;
      const mx = clamp(p.x, mnx, mxx), my = clamp(p.y, mny, mxy);
      let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
      if (drag.corner === 'nw') { x0 = mx; y0 = my; } else if (drag.corner === 'ne') { x1 = mx; y0 = my; } else if (drag.corner === 'sw') { x0 = mx; y1 = my; } else { x1 = mx; y1 = my; }
      const MIN = 46; if (Math.abs(x1 - x0) < MIN) { if (drag.corner[1] === 'w') x0 = x1 - MIN; else x1 = x0 + MIN; }
      if (Math.abs(y1 - y0) < MIN * 0.8) { if (drag.corner[0] === 'n') y0 = y1 - MIN * 0.8; else y1 = y0 + MIN * 0.8; }
      r.x = Math.min(x0, x1); r.y = Math.min(y0, y1); r.w = Math.abs(x1 - x0); r.h = Math.abs(y1 - y0);
    } else { const t = drag.ref; t.y = clamp(p.y - drag.oy, paddock.y + 26, paddock.y + paddock.h - 20); const b = fieldBounds(t.y); t.x = clamp(p.x - drag.ox, b.left, b.right); }
  }
  function onUp() { if (drag) { persist(); drag = null; } }
  const twoFingerY = (e) => (e.touches[0].clientY + e.touches[1].clientY) / 2;
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) { panLast = twoFingerY(e); return; } onDown(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length >= 2) { e.preventDefault(); const avg = twoFingerY(e); if (panLast != null && camMaxY() > 0) cam.y = clamp(cam.y - (avg - panLast), 0, camMaxY()); panLast = avg; return; }
    if (placing || drag) e.preventDefault(); onMove(e);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => { if (!e.touches || e.touches.length === 0) panLast = null; onUp(e); });
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', (e) => { if (placing || drag) onMove(e); });
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', (e) => { if (camMaxY() > 0) { e.preventDefault(); cam.y = clamp(cam.y + e.deltaY * 0.5, 0, camMaxY()); } }, { passive: false });

  function herdTo(x, y) { x = clamp(x, paddock.x + 16, paddock.x + paddock.w - 16); y = clamp(y, paddock.y + 16, paddock.y + paddock.h - 16); for (const d of dogs) { d.tx = x + rand(-18, 18); d.ty = y + rand(-14, 14); d.moveT = 90; d.zoom = 1; } if (tractor) { tractor.tx = x; tractor.ty = y; tractor.zoom = 1; } pop(x, y, '🐾', '#fff'); }
  function woofaGather() {
    const pen = nearestOpenPen();
    if (pen) { herdGoal = { pen, t: 480 }; toast('🐾 Woofa\'s bringing them in!'); flashAlert('🐾 Herding into the pen!', '#58e08a'); const g = gateCenter(pen); pop(g.x, g.y, '🐾', '#58e08a', true); }
    else { const c = flockCentroid(); herdGoal = null; herdTo(c.x, c.y); toast(F.pens.length ? '🐾 Gathered! Open a gate to pen them.' : '🐾 Woofa gathers the flock!'); }
    sfx.woof();
  }
  function shearSheep(s) { const val = shearValue(s); F.wool += val; s.wool = 0; s.baaT = 40; s.heartT = 30; spawnFluff(s.x, s.y); pop(s.x, s.y - 14, '+' + val + ' 🧺', '#fff5c8'); sfx.shear(); toast('✂️ +' + val + ' wool' + (s.breed !== 'normal' ? ' (' + BREEDS[s.breed].name + '!)' : '')); persist(); updateHud(); }
  function scrapPen(p) { const i = F.pens.indexOf(p); if (i < 0) return; F.pens.splice(i, 1); if (herdGoal && herdGoal.pen === p) herdGoal = null; selectedPen = null; F.money += 40; if (p.stone) F.stone += 12; toast('🗑️ Pen scrapped (+$40)'); pop(p.x + p.w / 2, p.y, '🗑️', '#ff8a3d'); sfx.pop(); persist(); updateHud(); }
  function upgradePenStone(p) { const c = stonePenCost(); if (F.stone < c) { toast('Need 🪨' + c + ' stone to build stone walls'); sfx.err(); return; } F.stone -= c; p.stone = true; toast('🧱 Stone walls up! Predators can\'t get in (close the gate).'); confetti(p.x + p.w / 2, p.y, ['🧱', '🛡️']); sfx.build(); persist(); updateHud(); }

  // a night pack raid led by an Alpha wolf (tough, needs walls + dogs)
  function maybePackRaid() {
    if (F._nofox || sheep.length === 0 || F.farmLevel < 3 || preds.some(p => p.alpha)) return;
    if (Math.random() > 0.28 + (F.farmLevel - 3) * 0.06) return;
    spawnPack();
  }
  function spawnPack() {
    const spawnW = (left, alpha) => preds.push({ x: left ? paddock.x + 6 : paddock.x + paddock.w - 6, y: rand(paddock.y + 20, paddock.y + paddock.h - 20), fleeing: false, dead: false, facing: 1, wolf: true, alpha: !!alpha, hp: alpha ? 4 : 1, stun: 0 });
    const left = Math.random() < 0.5; spawnW(left, true); spawnW(left, false); if (preds.length < 4) spawnW(!left, false);
    flashAlert('🐺 WOLF PACK RAID! 🐺', '#c94a3a', true); toast('🐺 An ALPHA wolf leads a pack — pen your flock!'); sfx.wolf();
  }

  // ---------- update ----------
  function update(dt) {
    if (!running || !F) return;
    tick += dt;
    F.dayT = (F.dayT || 0) + dt;
    const night = nightAmt(), nowNight = night > 0.5;
    if (nowNight && !wasNight) { flashAlert('🌙 Night falls — watch for wolves!', '#7a8fff', true); toast('🌙 Night falls...'); maybePackRaid(); }
    else if (!nowNight && wasNight) { toast('☀️ A new day dawns!'); }
    wasNight = nowNight;

    // seasons + weather
    F.seasonT = (F.seasonT || 0) + dt; const season = seasonIx();
    F.weatherT -= dt;
    if (F.weatherT <= 0) { F.weatherT = rand(1400, 3000); const nw = pickWeather(season); if (nw !== F.weather) { F.weather = nw; if (nw === 'rain') { flashAlert('🌧️ Rain — free water!', '#5aa0ff'); } else if (nw === 'snow') { flashAlert('❄️ Snowfall — grass is buried, keep them fed!', '#cdd6dd', true); } else if (nw === 'drought') { flashAlert('🏜️ Drought — water runs dry faster!', '#e0a03a'); } } }
    if (F.weather === 'rain') F.water = clamp(F.water + 0.06 * dt, 0, 96);
    else if (F.weather === 'drought') F.water = clamp(F.water - 0.01 * dt, 0, 100);
    const seasonNeed = (season === 1 ? 1.15 : season === 3 ? 1.15 : 1);   // summer thirst / winter hunger both bite

    const e = F.energy;
    if (e === 1) { F.water = clamp(F.water + 0.05 * dt, 0, 62); }
    else if (e === 2) { F.water = clamp(F.water + 0.09 * dt, 0, 78); F.feed = clamp(F.feed + 0.06 * dt, 0, 60); }
    else if (e === 3) { if (F.money > 0) { F.feed = clamp(F.feed + 0.18 * dt, 0, 100); F.water = clamp(F.water + 0.18 * dt, 0, 100); F.money = Math.max(0, F.money - 0.06 * dt); } }
    if (F.house.level > 1) F.money += houseIncome() * dt;

    for (const b of F.buildings) {
      if (b.bkind === 'market') { b.cd = (b.cd || 0) - dt; if (b.cd <= 0 && F.wool >= 1) { const amt = Math.min(F.wool, 4); F.wool -= amt; const got = Math.floor(amt * woolPrice()); F.money += got; b.cd = 70; pop(b.x, b.y - 14, '+$' + got, '#ffd23d'); } }
      else if (b.bkind === 'tower') { for (const fx of preds) if (!fx.dead && !fx.wolf && dist(b.x, b.y, fx.x, fx.y) < 140) fx.fleeing = true; }
      else if (b.bkind === 'well') { F.water = clamp(F.water + 0.05 * dt, 0, 92); }
      else if (b.bkind === 'haybarn') { F.feed = clamp(F.feed + 0.04 * dt, 0, 88); }
    }

    if (herdGoal) { herdGoal.t -= dt; if (herdGoal.t <= 0 || F.pens.indexOf(herdGoal.pen) < 0) herdGoal = null; }
    const needM = techNeedMult();

    const winter = season === 3, summer = season === 1, snowing = F.weather === 'snow';
    const vetOn = hasBuilding('vet'), sickChanceMul = (T('vaccine') ? 0.2 : 1);
    for (let i = sheep.length - 1; i >= 0; i--) {
      const s = sheep[i];
      s.hunger = clamp(s.hunger + 0.015 * needM * (winter ? 1.15 : 1) * dt, 0, 100); s.thirst = clamp(s.thirst + 0.018 * needM * (summer ? 1.15 : 1) * dt, 0, 100);
      // disease: sick sheep sicken, spread in crowds, and can be healed by a Vet Hut
      if (s.sick) {
        s.sickT += dt; s.health = clamp(s.health - 0.02 * dt, 0, 100);
        let cured = false;
        if (vetOn) for (const b of F.buildings) if (b.bkind === 'vet' && dist(s.x, s.y, b.x + b.w / 2, b.y + b.h / 2) < 70) { s.sickT -= 0.6 * dt; if (s.sickT <= 0) cured = true; }
        if (cured || s.sickT > 900) { s.sick = false; s.sickT = 0; s.heartT = 24; pop(s.x, s.y - 12, '💚', '#58e08a'); }
      } else if (s.role !== 'lamb' && Math.random() < 0.0000012 * sickChanceMul * dt * (s.health < 50 ? 3 : 1)) { s.sick = true; s.sickT = 0; pop(s.x, s.y - 12, '🤒', '#8fd06a'); }
      s.health = clamp(100 - Math.max(0, s.hunger - 62) * 1.3 - Math.max(0, s.thirst - 62) * 1.3 - (s.sick ? 22 : 0), 0, 100);
      if (s.hunger >= 100 || s.thirst >= 100) s.starve += dt; else s.starve = Math.max(0, s.starve - dt * 0.5);
      if (s.starve > 480 || (s.sick && s.health <= 0)) { sheep.splice(i, 1); toast(s.sick ? '💀 A sick sheep was lost — build a Vet Hut!' : '💀 A sheep died! Keep them fed and watered.'); pop(s.x, s.y, '💀', '#ff6a6a', true); sfx.err(); persist(); updateHud(); continue; }
      // spread to a close, healthy flockmate
      if (s.sick && Math.random() < 0.0006 * sickChanceMul * dt) { for (const o of sheep) if (!o.sick && o.role !== 'lamb' && o !== s && dist(s.x, s.y, o.x, o.y) < 22) { o.sick = true; o.sickT = 0; pop(o.x, o.y - 12, '🤒', '#8fd06a'); break; } }

      if (s.role !== 'lamb') {
        const grazing = !snowing && (grass.some(gr => gr.amt > 0.2 && dist(s.x, s.y, gr.x, gr.y) < 15) || F.plants.some(pl => pl.type === 'bush' && pl.amt > 0.2 && dist(s.x, s.y, pl.x, pl.y) < 20));
        const fed = F.feed > 0 || grazing, watered = F.water > 0;
        const rate = 0.020 * (s.sick ? 0.15 : 1) * (fed ? 1 : 0.3) * (watered ? 1 : 0.45) * (0.5 + s.health / 200) * (1 + dogBonus() + houseWoolBonus());
        s.wool = clamp(s.wool + rate * dt, 0, 100);
        if (fed && s.size < 1) s.size = clamp(s.size + 0.00012 * dt, 0.85, 1);
      } else { s.age += dt; if (s.age > 900) { s.role = rollRole(); s.size = 0.85; toast('🐑 A lamb grew up!'); pop(s.x, s.y, '🐑', '#fff'); } }
      if (s.baaT > 0) s.baaT -= dt; if (s.heartT > 0) s.heartT -= dt; s.breedCD -= dt;

      s.moveT -= dt; let fleeing = false;
      for (const fx of preds) if (!fx.dead && dist(s.x, s.y, fx.x, fx.y) < (fx.wolf ? 96 : 84)) { const a = Math.atan2(s.y - fx.y, s.x - fx.x); s.tx = s.x + Math.cos(a) * 140; s.ty = s.y + Math.sin(a) * 140; s.moveT = 20; fleeing = true; }
      if (tractor && dist(s.x, s.y, tractor.x, tractor.y) < 78) { const a = Math.atan2(s.y - tractor.y, s.x - tractor.x); s.tx = s.x + Math.cos(a) * 120; s.ty = s.y + Math.sin(a) * 120; s.moveT = 24; fleeing = true; }
      for (const d of dogs) if (dist(s.x, s.y, d.x, d.y) < 50) { const a = Math.atan2(s.y - d.y, s.x - d.x); s.tx = s.x + Math.cos(a) * 62; s.ty = s.y + Math.sin(a) * 62; s.moveT = Math.max(s.moveT, 12); fleeing = true; }

      let toPen = false;
      if (herdGoal && !fleeing) { const pn = herdGoal.pen; toPen = true; if (penInsideStrict(pn, s.x, s.y)) { s.tx = pn.x + pn.w / 2 + rand(-pn.w * 0.3, pn.w * 0.3); s.ty = pn.y + pn.h / 2 + rand(-pn.h * 0.3, pn.h * 0.3); } else { const g = gateCenter(pn); s.tx = g.x; s.ty = g.y; } s.moveT = Math.max(s.moveT, 16); }
      if (!fleeing && !toPen && s.hunger > 42 && F.feed > 0) { s.tx = feedTrough.x + rand(-12, 12); s.ty = feedTrough.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && !toPen && s.thirst > 42 && F.water > 0) { s.tx = waterTrough.x + rand(-12, 12); s.ty = waterTrough.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && !toPen && s.moveT <= 0) { s.tx = rand(paddock.x + 30, paddock.x + paddock.w - 30); s.ty = rand(paddock.y + 30, paddock.y + paddock.h - 40); s.moveT = rand(60, 150); }

      for (const pen of F.pens) { const inNow = penInsideStrict(pen, s.x, s.y), inTgt = penInsideStrict(pen, s.tx, s.ty); if (inNow !== inTgt && pen.gateOpen) { const g = gateCenter(pen); s.tx = g.x; s.ty = g.y; } }

      const spd = fleeing ? 2.4 : toPen ? 1.5 : (s.role === 'lamb' ? 0.9 : 0.6);
      const a = Math.atan2(s.ty - s.y, s.tx - s.x);
      if (dist(s.x, s.y, s.tx, s.ty) > 4) { s.y = clamp(s.y + Math.sin(a) * spd * dt, paddock.y + 24, paddock.y + paddock.h - 24); const b = fieldBounds(s.y); s.x = clamp(s.x + Math.cos(a) * spd * dt, b.left, b.right); }

      const sc = dscale(s.y), sep = 15 * sc;
      for (let j = 0; j < sheep.length; j++) { if (j === i) continue; const o = sheep[j]; const dd = dist(s.x, s.y, o.x, o.y); if (dd < sep && dd > 0.01) { const push = (sep - dd) * 0.5; const ang = Math.atan2(s.y - o.y, s.x - o.x); s.x += Math.cos(ang) * push; s.y += Math.sin(ang) * push; } }
      repelFromPens(s, 13);
      { const b = fieldBounds(s.y); s.x = clamp(s.x, b.left, b.right); s.y = clamp(s.y, paddock.y + 24, paddock.y + paddock.h - 24); }

      if (F.feed > 0 && s.hunger > 8 && dist(s.x, s.y, feedTrough.x, feedTrough.y) < 40) { s.hunger = clamp(s.hunger - 0.32 * dt, 0, 100); F.feed = clamp(F.feed - 0.05 * dt, 0, 100); if (s.hunger < 20 && s.heartT <= 0) s.heartT = 24; }
      if (F.water > 0 && s.thirst > 8 && dist(s.x, s.y, waterTrough.x, waterTrough.y) < 40) { s.thirst = clamp(s.thirst - 0.32 * dt, 0, 100); F.water = clamp(F.water - 0.045 * dt, 0, 100); if (s.thirst < 20 && s.heartT <= 0) s.heartT = 24; if (Math.random() < 0.025 * dt) splash(waterTrough.x + rand(-8, 8), waterTrough.y - 3); }
      for (const gr of grass) if (gr.amt > 0.2 && dist(s.x, s.y, gr.x, gr.y) < 14) { s.hunger = clamp(s.hunger - 0.03 * dt, 0, 100); gr.amt = clamp(gr.amt - 0.03 * dt, 0, 1); break; }
      for (const pl of F.plants) if (pl.type === 'bush' && pl.amt > 0.2 && dist(s.x, s.y, pl.x, pl.y) < 18) { s.hunger = clamp(s.hunger - 0.05 * dt, 0, 100); pl.amt = clamp(pl.amt - 0.02 * dt, 0, 1); break; }
    }
    const wGrow = snowing ? 0 : F.weather === 'rain' ? 1.6 : F.weather === 'drought' ? 0.3 : winter ? 0.45 : 1;
    const gRegrow = techGrass() * wGrow;
    for (const gr of grass) gr.amt = clamp(gr.amt + 0.00035 * gRegrow * dt - (snowing ? 0.0006 * dt : 0), 0, 1);
    for (const pl of F.plants) { if (pl.type === 'bush') pl.amt = clamp((pl.amt == null ? 1 : pl.amt) + 0.0005 * gRegrow * dt, 0, 1); if (pl.type === 'tree') pl.wood = clamp((pl.wood == null ? 100 : pl.wood) + 0.012 * dt, 0, 100); if (pl.type === 'rock') pl.stone = clamp((pl.stone == null ? 100 : pl.stone) + 0.008 * dt, 0, 100); }

    updateWorkers(dt);

    breedTimer -= dt;
    if (breedTimer <= 0) {
      breedTimer = rand(1400, 2400);
      const rams = sheep.filter(s => s.role === 'ram' && s.health > 60), ewes = sheep.filter(s => s.role === 'ewe' && s.health > 60 && s.breedCD <= 0);
      if (rams.length && ewes.length && sheep.length < F.sheepCap) { const mum = ewes[(Math.random() * ewes.length) | 0]; mum.breedCD = rand(1600, 2600); sheep.push(makeSheep({ x: mum.x + rand(-10, 10), y: mum.y + 14, breed: mum.breed, role: 'lamb' })); toast('💕 A lamb was born!'); confetti(mum.x, mum.y - 10, ['💕', '🐑', '✨']); sfx.up(); persist(); updateHud(); }
    }

    predTimer -= dt;
    if (predTimer <= 0 && sheep.length > 0 && preds.length < 4 && !F._nofox) {
      predTimer = rand(2600, 4400) / (1 + (F.farmLevel - 1) * 0.3) / (1 + night * 0.9);   // raids come faster at night
      const wolfChance = (F.farmLevel >= 2 ? 0.22 + (F.farmLevel - 2) * 0.06 : 0) + night * 0.35;   // wolves prowl the night
      const spawn = (left, wolf) => preds.push({ x: left ? paddock.x + 6 : paddock.x + paddock.w - 6, y: rand(paddock.y + 20, paddock.y + paddock.h - 20), fleeing: false, dead: false, facing: 1, wolf: !!wolf });
      const left = Math.random() < 0.5;
      if (Math.random() < wolfChance) { spawn(left, true); flashAlert('🐺 WOLF!', '#c94a3a', true); toast('🐺 A wolf is on the prowl!'); sfx.wolf(); if (Math.random() < 0.3 && preds.length < 4) spawn(!left, true); }
      else { spawn(left, false); flashAlert('🦊 FOX!', '#ff6a3a'); sfx.fox(); if (Math.random() < 0.13 + (F.farmLevel - 1) * 0.03 && preds.length < 4) { spawn(!left, false); flashAlert('🦊🦊 DOUBLE FOX RAID!', '#ff4d4d', true); } }
    }
    const dogRange = techDogRange();
    for (let i = preds.length - 1; i >= 0; i--) {
      const fx = preds[i];
      if (fx.dead) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 0.12 * dt; fx.spin += 0.35 * dt; fx.tumble += dt; if (fx.x < -60 || fx.x > W + 60 || fx.y > H + 80 || fx.tumble > 130) preds.splice(i, 1); continue; }
      let chased = false; for (const d of dogs) if (dist(d.x, d.y, fx.x, fx.y) < (fx.wolf ? 80 : 95) * dogRange) chased = true;
      if (chased && !fx.alpha) fx.fleeing = true;
      let tx, ty;
      if (fx.stun > 0) { fx.stun -= dt; tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x + 20 : paddock.x + paddock.w - 20; ty = fx.y; }   // alpha recovering from a hit
      else if (fx.fleeing) { tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x - 40 : paddock.x + paddock.w + 40; ty = fx.y; }
      else { let best = null, bd = 1e9; for (const s of sheep) { const dd = dist(fx.x, fx.y, s.x, s.y); if (dd < bd) { bd = dd; best = s; } } if (best) { tx = best.x; ty = best.y; if (bd < 16 && !predShielded(best, fx)) { const idx = sheep.indexOf(best); if (idx >= 0) { sheep.splice(idx, 1); toast((fx.alpha ? '🐺 The ALPHA' : fx.wolf ? '🐺 A wolf' : '🦊 A fox') + ' took a sheep! Guard them!'); pop(best.x, best.y, '💔', '#ff6a6a'); sfx.err(); persist(); updateHud(); } if (fx.alpha) fx.stun = 30; else fx.fleeing = true; } } else { if (!fx.alpha) fx.fleeing = true; tx = fx.x; ty = fx.y; } }
      const a = Math.atan2(ty - fx.y, tx - fx.x), sp = fx.stun > 0 ? 2.4 : fx.fleeing ? (fx.wolf ? 3.4 : 3.0) : (fx.alpha ? 2.4 : fx.wolf ? 2.1 : 1.5);
      fx.x += Math.cos(a) * sp * dt; fx.y += Math.sin(a) * sp * dt; fx.facing = Math.cos(a) >= 0 ? 1 : -1;
      repelFromPens(fx, 12, true);  // stone pens are predator-proof
      if (!fx.alpha && fx.fleeing && (fx.x < paddock.x - 30 || fx.x > paddock.x + paddock.w + 30)) preds.splice(i, 1);
    }

    const busy = new Set();
    for (const fx of preds) { if (fx.dead) continue; let best = null, bd = 1e9; for (const d of dogs) { if (busy.has(d)) continue; const dd = dist(d.x, d.y, fx.x, fx.y); if (dd < bd) { bd = dd; best = d; } } if (best) { busy.add(best); best._fx = fx; } }
    const fc = flockCentroid(), cx = fc.x, cy = fc.y;
    for (const d of dogs) {
      d.moveT -= dt; if (d.zoom > 0) d.zoom -= 0.01 * dt;
      const chasing = busy.has(d) && d._fx && !d._fx.dead;
      if (chasing) { d.tx = d._fx.x; d.ty = d._fx.y; d.zoom = Math.max(d.zoom, 0.7); if (dist(d.x, d.y, d._fx.x, d._fx.y) < 18 * dogRange) catchPredator(d._fx, d); }
      else if (herdGoal && sheep.length) { const g = gateCenter(herdGoal.pen); const a = Math.atan2(cy - g.y, cx - g.x); d.tx = cx + Math.cos(a) * 46; d.ty = cy + Math.sin(a) * 46; }
      else if (sheep.length) { let stray = null, sd = -1; for (const s of sheep) { const dd = dist(s.x, s.y, cx, cy); if (dd > sd) { sd = dd; stray = s; } } if (stray && sd > 52) { const a = Math.atan2(stray.y - cy, stray.x - cx); d.tx = stray.x + Math.cos(a) * 40; d.ty = stray.y + Math.sin(a) * 40; } else { d.orbit += 0.03 * dt; d.tx = cx + Math.cos(d.orbit) * 80; d.ty = cy + Math.sin(d.orbit) * 80; } }
      else if (d.moveT <= 0) { d.tx = rand(paddock.x + 40, paddock.x + paddock.w - 40); d.ty = rand(paddock.y + 30, paddock.y + paddock.h - 30); d.moveT = rand(60, 160); }
      const sp = chasing ? 3.7 : 1.6, a = Math.atan2(d.ty - d.y, d.tx - d.x);
      if (dist(d.x, d.y, d.tx, d.ty) > 5) { d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt; d.facing = Math.cos(a) >= 0 ? 1 : -1; if (chasing && (tick | 0) % 5 === 0) dustPuff(d.x, d.y + 9); }
    }
    if (tractor) { if (tractor.zoom > 0) tractor.zoom -= 0.006 * dt; if (tractor.tx || tractor.ty) { const a = Math.atan2(tractor.ty - tractor.y, tractor.tx - tractor.x); if (dist(tractor.x, tractor.y, tractor.tx, tractor.ty) > 6) { tractor.x = clamp(tractor.x + Math.cos(a) * 2.2 * dt, paddock.x + 16, paddock.x + paddock.w - 16); tractor.y = clamp(tractor.y + Math.sin(a) * 2.2 * dt, paddock.y + 16, paddock.y + paddock.h - 16); tractor.facing = Math.cos(a) >= 0 ? 1 : -1; if ((tick | 0) % 6 === 0) dustPuff(tractor.x - 8 * tractor.facing, tractor.y + 11); } } }

    for (const m of motes) { m.x += (m.vx + Math.sin(tick / 40 + m.ph) * 0.12) * dt; m.y += m.vy * dt; if (m.y < paddock.y + 10) m.y = paddock.y + paddock.h - 12; const b = fieldBounds(m.y); if (m.x < b.left) m.x = b.right; else if (m.x > b.right) m.x = b.left; }
    for (let i = fluff.length - 1; i >= 0; i--) { const p = fluff[i]; p.vy += 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) fluff.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.05 * dt; p.rot += p.spin * dt; p.life -= 0.013 * dt; if (p.life <= 0) pops.splice(i, 1); }
    for (let i = alerts.length - 1; i >= 0; i--) { alerts[i].t -= 0.006 * dt; if (alerts[i].t <= 0) alerts.splice(i, 1); }
    alertTimer -= dt;
    if (alertTimer <= 0) {
      alertTimer = 160;
      if (sheep.some(s => s.starve > 60)) flashAlert('⚠️ YOUR SHEEP ARE DYING!', '#ff4d4d', true);
      else if (F.feed < 18 && sheep.some(s => s.hunger > 55)) flashAlert('🌾 Feed your sheep!', '#ffb03a');
      else if (F.water < 18 && sheep.some(s => s.thirst > 55)) flashAlert('💧 Your sheep need water!', '#4cc9ff');
      if (F.wool > 30 && !F.buildings.some(b => b.bkind === 'market')) flashAlert('🧺 Sell wool — or build a Market!', '#58e08a');
    }
    // ambient life
    if (sheep.length && Math.random() < 0.0006 * dt) { const s = sheep[(Math.random() * sheep.length) | 0]; if (s.role !== 'lamb') { s.baaT = 40; sfx.baa(); } }
    if (Math.random() < 0.0007 * dt) { if (isNight()) sfx.cricket(); else sfx.bird(); }

    if (!F.won && F.farmLevel >= ERAS.length && F.money >= WIN_MONEY) { F.won = true; onVictory(); }

    if ((tick | 0) % 30 === 0) { updateHud(); persist(); }
  }

  // ---------- workers ----------
  function idleNear(w, x, y) { if (w.moveT <= 0) { w.tx = x + rand(-30, 30); w.ty = y + rand(-14, 24); w.moveT = rand(50, 130); } }
  function updateWorkers(dt) {
    const base = 1.5 * techWorkerSpeed(), baseCd = 1 / techWorkerSpeed();
    for (const w of workers) {
      w.cd -= dt; w.moveT -= dt;
      const lb = workerSpeedMul(w), spd = base * lb, cdMul = baseCd / lb;   // levelled-up hands are faster
      if (w.job === 'shear') {
        let tgt = null, bd = 1e9; for (const s of sheep) if (s.role !== 'lamb' && s.wool >= 100) { const d = dist(w.x, w.y, s.x, s.y); if (d < bd) { bd = d; tgt = s; } }
        if (tgt) { w.tx = tgt.x; w.ty = tgt.y + 4; if (bd < 15 && w.cd <= 0) { const val = shearValue(tgt); F.wool += val; tgt.wool = 0; tgt.baaT = 40; tgt.heartT = 24; spawnFluff(tgt.x, tgt.y); pop(tgt.x, tgt.y - 12, '+' + val + '🧺', '#fff5c8'); sfx.shear(); w.cd = 45 * cdMul; gainXp(w); updateHud(); } }
        else idleNear(w, house.x + 30, house.y + 40);
      } else if (w.job === 'haul') {
        const feedLow = F.feed <= F.water; const t = feedLow ? feedTrough : waterTrough; const lvl = feedLow ? F.feed : F.water;
        if (lvl < 82) { w.tx = t.x; w.ty = t.y - 6; if (dist(w.x, w.y, t.x, t.y) < 20 && w.cd <= 0) { const cost = feedLow ? 2 : 1; if (F.money >= cost) { F.money -= cost; if (feedLow) F.feed = clamp(F.feed + 7, 0, 100); else F.water = clamp(F.water + 8, 0, 100); w.cd = 34 * cdMul; pop(t.x, t.y - 14, feedLow ? '🌾' : '💧', '#fff'); gainXp(w); updateHud(); } else { w.cd = 60; } } }
        else idleNear(w, feedTrough.x, feedTrough.y - 20);
      } else if (w.job === 'wood') {
        let tgt = null, bd = 1e9; for (const pl of F.plants) if (pl.type === 'tree' && (pl.wood == null ? 100 : pl.wood) > 14) { const d = dist(w.x, w.y, pl.x, pl.y); if (d < bd) { bd = d; tgt = pl; } }
        if (tgt) { w.tx = tgt.x + 10; w.ty = tgt.y + 6; if (bd < 20 && w.cd <= 0) { tgt.wood = clamp(tgt.wood - 9, 0, 100); F.wood += 3; w.cd = 30 * cdMul; pop(tgt.x, tgt.y - 22, '🪵', '#caa06a'); sfx.chop(); gainXp(w); updateHud(); } }
        else idleNear(w, house.x + 30, house.y + 40);
      } else if (w.job === 'mine') {
        let tgt = null, bd = 1e9; for (const pl of F.plants) if (pl.type === 'rock' && (pl.stone == null ? 100 : pl.stone) > 12) { const d = dist(w.x, w.y, pl.x, pl.y); if (d < bd) { bd = d; tgt = pl; } }
        if (tgt) { w.tx = tgt.x + 10; w.ty = tgt.y + 6; if (bd < 20 && w.cd <= 0) { tgt.stone = clamp(tgt.stone - 8, 0, 100); F.stone += 2; w.cd = 34 * cdMul; pop(tgt.x, tgt.y - 20, '🪨', '#b8bcc2'); sfx.mine(); gainXp(w); updateHud(); } }
        else idleNear(w, house.x + 30, house.y + 40);
      }
      const a = Math.atan2(w.ty - w.y, w.tx - w.x);
      if (dist(w.x, w.y, w.tx, w.ty) > 4) { w.y = clamp(w.y + Math.sin(a) * spd * dt, paddock.y + 20, paddock.y + paddock.h - 18); const b = fieldBounds(w.y); w.x = clamp(w.x + Math.cos(a) * spd * dt, b.left, b.right); w.facing = Math.cos(a) >= 0 ? 1 : -1; w.step += dt; }
    }
  }

  function catchPredator(fx, d) {
    if (fx.dead) return;
    if (fx.alpha && fx.hp > 1) { fx.hp--; fx.stun = 55; const ang = Math.atan2(fx.y - d.y, fx.x - d.x); fx.x += Math.cos(ang) * 28; fx.y += Math.sin(ang) * 28; d.zoom = 1; pop(fx.x, fx.y - 14, '-1❤️', '#ff6a6a'); flashAlert('🐺 Alpha hit! ' + fx.hp + ' left', '#ffb03a'); sfx.wolf(); return; }
    fx.dead = true; d.zoom = 1;
    const wolf = fx.wolf, alpha = fx.alpha;
    if (alpha) { F.money += 200; flashAlert('🏅 ALPHA DEFEATED! +$200', '#ffd23d', true); toast('🏅 Alpha wolf defeated! +$200'); const dir = fx.x < W / 2 ? 1 : -1; fx.vx = dir * rand(7, 12); fx.vy = rand(-11, -7); fx.spin = rand(0.4, 0.7); fx.tumble = 0; pop(fx.x, fx.y - 12, '💥', '#ffd23d', true); confetti(fx.x, fx.y, ['🏅', '💰', '⭐', '🦴', '💥']); sfx.boom(); updateHud(); return; }
    if (Math.random() < (wolf ? 0.55 : 0.45)) { const dir = fx.x < W / 2 ? 1 : -1; fx.vx = dir * rand(6, 11); fx.vy = rand(-10, -6); fx.spin = rand(0.3, 0.6); fx.tumble = 0; flashAlert((wolf ? '🐺 WOLF' : '🦊 FOX') + ' TERMINATED! 💥', '#ffd23d', true); toast('💥 ' + (wolf ? 'WOLF' : 'FOX') + ' TERMINATED!'); pop(fx.x, fx.y - 10, '💥', '#ffd23d', true); confetti(fx.x, fx.y, ['💥', '⭐', '🦴']); sfx.boom(); }
    else { const dir = fx.x < W / 2 ? -1 : 1; fx.vx = dir * rand(4, 6); fx.vy = rand(-3, -1); fx.spin = rand(-0.2, 0.2); fx.tumble = 60; pop(fx.x, fx.y - 8, '💨', '#cfd8e6'); sfx.pop(); }
  }

  // ---------- render ----------
  function render() {
    ctx.fillStyle = '#0c1a12'; ctx.fillRect(0, 0, W, H);
    if (!F) return;
    ctx.save(); ctx.translate(0, -cam.y);   // ← camera: world layer scrolls, screen overlays drawn after restore
    const dayL = 1 - nightAmt();
    const sky = ctx.createLinearGradient(0, 0, 0, paddock.y + 20); sky.addColorStop(0, '#6fbdf5'); sky.addColorStop(0.55, '#a4d8fb'); sky.addColorStop(1, '#e9f6ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, paddock.y);
    if (dayL > 0.15) { const sx = W * 0.16, sy = paddock.y * 0.3, r = 16; ctx.save(); ctx.globalAlpha = dayL; const gl = ctx.createRadialGradient(sx, sy, 3, sx, sy, 70); gl.addColorStop(0, 'rgba(255,244,190,0.85)'); gl.addColorStop(1, 'rgba(255,244,190,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, 7); ctx.fill(); ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(sx - 4, sy - 4, r * 0.6, 0, 7); ctx.fill(); ctx.restore(); }
    // distant mountains — layered for depth
    ctx.fillStyle = '#aebfd0'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 22) ctx.lineTo(x, paddock.y - 30 - Math.abs(Math.sin(x * 0.017 + 1.3)) * 30 - Math.abs(Math.sin(x * 0.006)) * 12); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#93aabf'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 28) ctx.lineTo(x, paddock.y - 20 - Math.abs(Math.sin(x * 0.012 + 3)) * 22); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6fae5e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, paddock.y - 20 - Math.sin(x / 130) * 16); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c9c4e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 80) ctx.lineTo(x, paddock.y - 8 - Math.cos(x / 90) * 10); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    drawClouds(dayL);

    const far = fieldBounds(paddock.y), near = fieldBounds(paddock.y + paddock.h);
    const fL = far.left, fR = far.right, nL = near.left, nR = near.right, ty0 = paddock.y, ty1 = paddock.y + paddock.h;
    ctx.fillStyle = '#5a3f24'; ctx.beginPath(); ctx.moveTo(fL - 12, ty0 - 9); ctx.lineTo(fR + 12, ty0 - 9); ctx.lineTo(nR + 12, ty1 + 10); ctx.lineTo(nL - 12, ty1 + 10); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, ty0, 0, ty1); g.addColorStop(0, '#3a8340'); g.addColorStop(1, SEASONS[seasonIx()].grass);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fL, ty0); ctx.lineTo(fR, ty0); ctx.lineTo(nR, ty1); ctx.lineTo(nL, ty1); ctx.closePath(); ctx.fill();
    const NB = 9;   // mowed stripes for depth & a groomed-field look
    for (let i = 0; i < NB; i++) {
      const t0 = i / NB, t1 = (i + 1) / NB, y0 = ty0 + t0 * (ty1 - ty0), y1 = ty0 + t1 * (ty1 - ty0);
      const l0 = fL + t0 * (nL - fL), r0 = fR + t0 * (nR - fR), l1 = fL + t1 * (nL - fL), r1 = fR + t1 * (nR - fR);
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(l0, y0); ctx.lineTo(r0, y0); ctx.lineTo(r1, y1); ctx.lineTo(l1, y1); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#caa06a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fL, ty0); ctx.lineTo(fR, ty0); ctx.lineTo(nR, ty1); ctx.lineTo(nL, ty1); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#b98d55'; for (let i = 0; i <= 8; i++) { const t = i / 8, yy = ty0 + t * (ty1 - ty0), lx = fL + t * (nL - fL), rx = fR + t * (nR - fR); ctx.fillRect(lx - 2, yy - 5, 4, 10); ctx.fillRect(rx - 2, yy - 5, 4, 10); }
    drawGrass();
    for (const pl of F.plants) if (pl.type === 'bush') drawBush(pl);

    drawEnergy();
    drawTrough(feedTrough, '#d9b24a', F.feed, '🌾'); drawTrough(waterTrough, '#4cc9ff', F.water, '💧');
    drawShed(shed);
    for (const p of F.pens) drawPen(p, p === selectedPen);
    if (placing) { ctx.globalAlpha = 0.5; if (placing.bkind) drawBuilding(placing); else drawPen(placing, false); ctx.globalAlpha = 1; }

    const actors = [];
    actors.push({ y: house.y + 30, d: () => drawHouse(house) });
    for (const b of F.buildings) actors.push({ y: b.y + b.h, d: () => drawBuilding(b, b === selectedBuilding) });
    for (const s of sheep) actors.push({ y: s.y, d: () => drawSheep(s) });
    for (const fx of preds) actors.push({ y: fx.dead ? -9999 : fx.y, d: () => drawPredator(fx) });
    for (const d of dogs) actors.push({ y: d.y, d: () => drawDog(d) });
    for (const w of workers) actors.push({ y: w.y, d: () => drawWorker(w) });
    for (const pl of F.plants) if (pl.type === 'tree') actors.push({ y: pl.y, d: () => drawTree(pl) }); else if (pl.type === 'rock') actors.push({ y: pl.y, d: () => drawRock(pl) });
    if (tractor) actors.push({ y: tractor.y, d: () => drawTractor(tractor) });
    actors.sort((a, b) => a.y - b.y); for (const a of actors) a.d();
    drawMotes();

    for (const p of fluff) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    for (const p of pops) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.font = '900 ' + p.sz + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = p.col; ctx.fillText(p.txt, 0, 0); ctx.restore(); } ctx.globalAlpha = 1;
    ctx.restore();   // ← end camera: overlays below are screen-space
    drawVignette();
    drawWeather();
    drawNight();
    drawSeasonLabel();
    drawMinimap();
    drawAlerts();
  }

  function drawSeasonLabel() {
    const s = SEASONS[seasonIx()], wIc = F.weather === 'rain' ? '🌧️' : F.weather === 'snow' ? '❄️' : F.weather === 'drought' ? '🏜️' : (isNight() ? '🌙' : '☀️');
    ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(11,18,32,0.55)'; roundRect(10, paddock.y - 26, 96, 20, 8); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#eaf0ff'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s.ic + ' ' + s.name + ' ' + wIc, 16, paddock.y - 16);
  }
  function drawWeather() {
    if (F.weather === 'rain') { ctx.strokeStyle = 'rgba(150,190,255,0.5)'; ctx.lineWidth = 1.4; for (let i = 0; i < 60; i++) { const x = (i * 137 + tick * 6) % (W + 20) - 10, y = (i * 89 + tick * 11) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke(); } }
    else if (F.weather === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 70; i++) { const x = (i * 121 + Math.sin(tick / 30 + i) * 14) % (W + 20) - 10, y = (i * 97 + tick * 2.2) % H; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill(); } }
  }

  function drawNight() {
    const n = nightAmt(); if (n <= 0.01) return;
    // warm dusk/dawn edge, cool deep-night core
    ctx.save();
    ctx.globalAlpha = n * 0.5; ctx.fillStyle = '#0a1330'; ctx.fillRect(0, 0, W, H);
    if (n > 0.35) { // moon + stars in the sky band
      ctx.globalAlpha = clamp((n - 0.35) / 0.4, 0, 1);
      ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(W * 0.8, paddock.y * 0.4, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a1330'; ctx.beginPath(); ctx.arc(W * 0.8 + 5, paddock.y * 0.4 - 3, 11, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 14; i++) { const sx = (i * 97 % W), sy = ((i * 53) % (paddock.y - 10)) + 4, tw = 0.5 + 0.5 * Math.abs(Math.sin(tick / 20 + i)); ctx.globalAlpha = clamp((n - 0.35) / 0.4, 0, 1) * tw; ctx.fillRect(sx, sy, 1.6, 1.6); }
    }
    ctx.restore();
  }

  function drawAlerts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let yy = paddock.y + 24;
    for (const al of alerts) { const flash = 0.45 + 0.55 * Math.abs(Math.sin(tick / 6)); ctx.globalAlpha = clamp(al.t, 0, 1) * (0.5 + flash * 0.5); const fs = al.big ? 26 : 19; ctx.font = '900 ' + fs + 'px system-ui, sans-serif'; const w = ctx.measureText(al.msg).width + 26; ctx.fillStyle = 'rgba(11,18,32,0.7)'; roundRect(W / 2 - w / 2, yy - fs * 0.7, w, fs * 1.4, 10); ctx.fill(); ctx.fillStyle = al.col; ctx.fillText(al.msg, W / 2, yy); yy += fs * 1.7; }
    ctx.globalAlpha = 1;
  }
  function drawMinimap() {
    const mw = 92, mh = 60, mx = W - mw - 10, my = paddock.y - mh - 6;
    if (my < 4) return;
    ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(11,18,32,0.7)'; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.stroke();
    ctx.fillStyle = '#2f6a34'; ctx.fillRect(mx, my, mw, mh);
    const sx = (x) => mx + (x - paddock.x) / paddock.w * mw, sy = (y) => my + (y - paddock.y) / paddock.h * mh;
    for (const p of F.pens) { ctx.strokeStyle = p.stone ? '#c8ccd0' : '#caa06a'; ctx.lineWidth = 1; ctx.strokeRect(sx(p.x), sy(p.y), p.w / paddock.w * mw, p.h / paddock.h * mh); }
    ctx.fillStyle = '#8a6a3a'; for (const b of F.buildings) ctx.fillRect(sx(b.x), sy(b.y), 3, 3);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(sx(house.x), sy(house.y + 20), 4, 4);
    ctx.fillStyle = '#f4f3ee'; for (const s of sheep) { ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), 1.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3a6ea5'; for (const w of workers) { ctx.beginPath(); ctx.arc(sx(w.x), sy(w.y), 1.4, 0, 7); ctx.fill(); }
    for (const fx of preds) { if (fx.dead) continue; ctx.fillStyle = fx.wolf ? '#c94a3a' : '#ff8a3d'; ctx.beginPath(); ctx.arc(sx(fx.x), sy(fx.y), 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1a1a1e'; for (const d of dogs) { ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), 1.5, 0, 7); ctx.fill(); }
    if (camMaxY() > 0) { const vy = my + (cam.y / paddock.h) * mh, vh = (viewH / paddock.h) * mh; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.strokeRect(mx + 0.5, vy + 0.5, mw - 1, vh); }
    ctx.globalAlpha = 1;
  }

  function drawClouds(day) {
    ctx.globalAlpha = 0.55 + day * 0.4;
    const rows = [[0.20, 30, 1.0, 1.0], [0.60, 52, 0.7, 0.82], [0.86, 24, 0.55, 0.66]];
    for (const c of rows) {
      const cx = (c[0] * W + tick * 0.12 * c[2]) % (W + 140) - 70, cy = c[1], s = c[3];
      ctx.fillStyle = 'rgba(210,230,248,0.7)'; ctx.beginPath(); ctx.ellipse(cx + 6 * s, cy + 9 * s, 30 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; for (const p of [[-18, 5, 12], [-2, 0, 16], [15, 3, 13], [30, 6, 10], [7, -6, 12]]) { ctx.beginPath(); ctx.ellipse(cx + p[0] * s, cy + p[1] * s, p[2] * 1.15 * s, p[2] * 0.85 * s, 0, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawVignette() { const g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.34, W / 2, H * 0.5, H * 0.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.24)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function drawMotes() {
    const n = nightAmt();
    for (const m of motes) {
      const b = fieldBounds(m.y); if (m.x < b.left - 4 || m.x > b.right + 4) continue;
      if (n > 0.4) { const blink = 0.25 + 0.75 * Math.abs(Math.sin(tick / 18 + m.ph)), a = clamp((n - 0.4) / 0.5, 0, 1); ctx.globalAlpha = a * blink * 0.5; ctx.fillStyle = '#f6ff9a'; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, 7); ctx.fill(); ctx.globalAlpha = a * blink; ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, 7); ctx.fill(); }
      else { ctx.globalAlpha = 0.16 * (1 - n); ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  function shadow(x, y, r) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function shadowLocal(x, y, r) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.32, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawPen(p, sel) {
    ctx.fillStyle = sel ? 'rgba(88,224,138,0.10)' : p.stone ? 'rgba(200,205,210,0.06)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(p.x, p.y, p.w, p.h);
    if (p.stone) {
      ctx.strokeStyle = sel ? '#58e08a' : '#c2c6cc'; ctx.lineWidth = sel ? 5 : 7; ctx.lineCap = 'round'; ctx.beginPath(); for (const seg of penWalls(p)) { ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); } ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(90,90,95,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); for (const seg of penWalls(p)) { ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); } ctx.stroke();
      ctx.fillStyle = '#9aa0a6'; for (const c of penCorners(p)) { ctx.fillRect(c.x - 3, c.y - 3, 6, 6); }
    } else {
      ctx.strokeStyle = sel ? '#58e08a' : '#8a6a3a'; ctx.lineWidth = sel ? 3.5 : 3; ctx.beginPath(); for (const seg of penWalls(p)) { ctx.moveTo(seg[0], seg[1]); ctx.lineTo(seg[2], seg[3]); } ctx.stroke();
      ctx.fillStyle = '#6a4f28'; for (let px = p.x; px <= p.x + p.w; px += 30) { ctx.fillRect(px - 1.5, p.y - 4, 3, 8); ctx.fillRect(px - 1.5, p.y + p.h - 4, 3, 8); }
    }
    const gc = gateCenter(p); ctx.fillStyle = p.gateOpen ? '#58e08a' : '#c86a3a'; ctx.beginPath(); ctx.arc(gc.x, gc.y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.gateOpen ? 'gate' : 'shut', gc.x, gc.y + (p.gateSide === 1 ? -10 : 14));
    if (p.stone) { ctx.fillStyle = 'rgba(200,205,210,0.9)'; ctx.font = '700 9px system-ui'; ctx.fillText('🛡️ stone', p.x + 20, p.y + 12); }
    if (sel) {
      ctx.fillStyle = '#58e08a'; for (const c of penCorners(p)) { roundRect(c.x - 6, c.y - 6, 12, 12, 3); ctx.fill(); }
      const tk = penTick(p), scr = penScrap(p);
      ctx.fillStyle = '#2fbf6a'; ctx.beginPath(); ctx.arc(tk.x, tk.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 17px system-ui'; ctx.fillText('✓', tk.x, tk.y + 6);
      ctx.fillStyle = '#d94a3a'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 16px system-ui'; ctx.fillText('✕', scr.x, scr.y + 5);
      if (!p.stone) { const st = penStoneBtn(p); ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(st.x, st.y, 15, 0, 7); ctx.fill(); ctx.font = '14px system-ui'; ctx.fillText('🧱', st.x, st.y + 5); }
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 10px system-ui'; ctx.fillText('drag ▢ resize · 🧱 stone (fox-proof) · move gate: tap a wall', p.x + p.w / 2, p.y + p.h + 16);
    }
  }
  function drawTrough(t, col, level, ic) { const sc = dscale(t.y); ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc); ctx.fillStyle = '#7a5a3a'; roundRect(-22, -8, 44, 16, 4); ctx.fill(); const surY = -6 + (12 - level / 100 * 12); ctx.fillStyle = col; roundRect(-19, surY, 38, level / 100 * 12, 3); ctx.fill(); if (level > 5) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff'; const shx = Math.sin(tick / 14 + t.x * 0.1) * 8; ctx.beginPath(); ctx.ellipse(shx, surY + 1.6, 7, 1.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; roundRect(-22, -8, 44, 16, 4); ctx.stroke(); ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ic, 0, -12); ctx.restore(); }
  function drawGrass() { const snow = F.weather === 'snow'; for (const gr of grass) { if (gr.amt < 0.12) { ctx.fillStyle = snow ? 'rgba(232,238,244,0.5)' : 'rgba(90,63,36,0.35)'; ctx.beginPath(); ctx.ellipse(gr.x, gr.y, 5, 2.5, 0, 0, 7); ctx.fill(); continue; } const sc = dscale(gr.y), n = 3 + Math.round(gr.amt * 3); ctx.strokeStyle = snow ? '#cfe0d6' : gr.amt > 0.5 ? '#6fd06a' : '#8fbf6a'; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round'; for (let i = 0; i < n; i++) { const bx = gr.x + (i - n / 2) * 2.4 * sc, sw = (Math.sin(tick / 30 + gr.x + i) + Math.sin(tick / 55 - gr.y * 0.02) * 1.3) * 1.3; ctx.beginPath(); ctx.moveTo(bx, gr.y); ctx.lineTo(bx + sw, gr.y - (5 + gr.amt * 5) * sc); ctx.stroke(); } } }
  function drawBush(b) { const sc = dscale(b.y) * (b.sz || 1), amt = b.amt == null ? 1 : b.amt; ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sc, sc); ctx.rotate(Math.sin(tick / 48 + b.x * 0.1) * 0.02); shadowLocal(0, 6, 16); const green = amt > 0.5 ? '#3f9a45' : '#6a8f4a'; ctx.fillStyle = green; for (const c of [[-8, 0, 9], [0, -3, 11], [9, 0, 9], [0, 3, 8]]) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); ctx.fill(); } ctx.fillStyle = amt > 0.5 ? '#57b85c' : '#7fa35a'; for (const c of [[-6, -2, 5], [4, -3, 5]]) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); ctx.fill(); } if (amt > 0.6) { ctx.fillStyle = '#e0556a'; for (const c of [[-4, 1], [6, 2], [1, -4]]) { ctx.beginPath(); ctx.arc(c[0], c[1], 1.6, 0, 7); ctx.fill(); } } ctx.restore(); }
  function drawTree(t) {
    const wood = t.wood == null ? 100 : t.wood, sc = dscale(t.y) * (t.sz || 1); ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc); shadowLocal(0, 4, 18);
    ctx.rotate(Math.sin(tick / 55 + t.x * 0.08) * 0.035);   // gentle breeze sway
    ctx.fillStyle = '#7a5230'; ctx.fillRect(-4, -12, 8, 20);
    if (wood > 20) { ctx.fillStyle = '#2f7a38'; for (const c of [[0, -30, 18], [-12, -22, 13], [12, -22, 13], [0, -18, 15]]) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); ctx.fill(); } ctx.fillStyle = '#3f9a45'; for (const c of [[-6, -30, 8], [7, -26, 8], [0, -34, 8]]) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); ctx.fill(); } }
    else { ctx.fillStyle = '#5a3f24'; ctx.beginPath(); ctx.ellipse(0, 8, 7, 3, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-7, -16); ctx.moveTo(3, -8); ctx.lineTo(8, -14); ctx.stroke(); }
    ctx.restore();
  }
  function drawRock(r) {
    const stone = r.stone == null ? 100 : r.stone, sc = dscale(r.y) * (r.sz || 1) * (0.6 + stone / 250); ctx.save(); ctx.translate(r.x, r.y); ctx.scale(sc, sc); shadowLocal(0, 4, 14);
    ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-8, -6); ctx.lineTo(2, -10); ctx.lineTo(11, -3); ctx.lineTo(9, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8adb3'; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(2, -10); ctx.lineTo(0, -2); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a6f76'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(2, -2); ctx.stroke();
    if (stone < 25) { ctx.fillStyle = 'rgba(120,120,128,0.6)'; ctx.beginPath(); ctx.arc(6, 6, 2, 0, 7); ctx.arc(-6, 7, 1.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawEnergy() {
    const e = F.energy; if (!e) return; const wx = paddock.x + 42, wy = paddock.y + paddock.h - 48;
    if (e === 1) { ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx, wy + 26); ctx.lineTo(wx, wy - 6); ctx.stroke(); const ang = tick / 30; ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(wx, wy - 6); ctx.lineTo(wx + Math.cos(a) * 22, wy - 6 + Math.sin(a) * 22); ctx.stroke(); } ctx.fillStyle = '#5a3f24'; ctx.beginPath(); ctx.arc(wx, wy - 6, 4, 0, 7); ctx.fill(); }
    else if (e === 2) { for (let i = 0; i < 2; i++) { const px = wx - 8 + i * 30; ctx.save(); ctx.translate(px, wy + 8); ctx.rotate(-0.5); ctx.fillStyle = '#1b3b6f'; ctx.fillRect(-14, -8, 28, 16); ctx.strokeStyle = '#4c9be0'; ctx.lineWidth = 1; for (let j = -1; j < 2; j++) { ctx.beginPath(); ctx.moveTo(j * 8, -8); ctx.lineTo(j * 8, 8); ctx.stroke(); } ctx.restore(); ctx.strokeStyle = '#666'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, wy + 10); ctx.lineTo(px, wy + 22); ctx.stroke(); } }
    else if (e === 3) { ctx.fillStyle = '#8a8f96'; ctx.fillRect(wx - 10, wy - 4, 20, 26); ctx.fillStyle = '#ffd23d'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⚡', wx, wy + 14); ctx.strokeStyle = '#6a6f76'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx - 16, wy - 10); ctx.lineTo(wx - 16, wy + 22); ctx.moveTo(wx + 16, wy - 10); ctx.lineTo(wx + 16, wy + 22); ctx.stroke(); ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wx - 16, wy - 8); ctx.lineTo(wx + 16, wy - 8); ctx.stroke(); }
  }
  function drawShed(sh) { const sc = dscale(sh.y); ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(sc, sc); ctx.fillStyle = '#b04a3a'; ctx.fillRect(0, 14, 52, 34); ctx.fillStyle = '#7a2f28'; ctx.beginPath(); ctx.moveTo(-4, 16); ctx.lineTo(26, -2); ctx.lineTo(56, 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(18, 28, 16, 20); ctx.restore(); }
  function drawHouse(h) {
    const sc = dscale(h.y), lv = F.house.level; ctx.save(); ctx.translate(h.x, h.y); ctx.scale(sc, sc);
    const wallW = 48 + lv * 6, wallH = 34 + lv * 2;
    if (lv >= 3) { ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 1.5; for (let fx = -6; fx < wallW + 6; fx += 8) { ctx.beginPath(); ctx.moveTo(fx, 10 + wallH); ctx.lineTo(fx, 4 + wallH); ctx.stroke(); } }
    const wg = ctx.createLinearGradient(0, 12, 0, 12 + wallH); wg.addColorStop(0, '#f7f2e8'); wg.addColorStop(1, '#dbd2c0'); ctx.fillStyle = wg; ctx.fillRect(-2, 12, wallW, wallH);
    const roofBase = ['#7a4b34', '#7a4b34', '#8a4030', '#5a6a8a', '#6a4a8a'][lv - 1] || '#7a4b34';
    const rg = ctx.createLinearGradient(0, -10 - lv * 2, 0, 14); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.25, roofBase); rg.addColorStop(1, roofBase); ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(wallW / 2 - 2, -10 - lv * 2); ctx.lineTo(wallW + 8, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(8, 12 + wallH - 20, 13, 20); ctx.fillStyle = '#caa46a'; ctx.beginPath(); ctx.arc(18, 12 + wallH - 10, 1.2, 0, 7); ctx.fill();
    const lit = nightAmt() > 0.35, wins = Math.min(1 + lv, 4);
    for (let i = 0; i < wins; i++) { const wxp = 26 + i * 13; if (wxp > wallW - 6) break; if (lit) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffdf8a'; ctx.beginPath(); ctx.arc(wxp + 5, 25, 9, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } ctx.fillStyle = lit ? '#ffe9a0' : '#bfe6ff'; ctx.fillRect(wxp, 20, 10, 10); ctx.strokeStyle = '#9aa'; ctx.lineWidth = 1; ctx.strokeRect(wxp, 20, 10, 10); ctx.beginPath(); ctx.moveTo(wxp + 5, 20); ctx.lineTo(wxp + 5, 30); ctx.moveTo(wxp, 25); ctx.lineTo(wxp + 10, 25); ctx.stroke(); }
    if (lv >= 2) { ctx.fillStyle = '#8a8f96'; ctx.fillRect(wallW - 10, -2, 6, 16); const p = Math.sin(tick / 20) * 2; ctx.fillStyle = 'rgba(210,210,220,0.6)'; ctx.beginPath(); ctx.arc(wallW - 7, -5 + p, 3, 0, 7); ctx.fill(); }
    if (lv >= 4) { ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🌷', 4, 12 + wallH - 1); ctx.fillText('🌻', wallW - 4, 12 + wallH - 1); }
    for (let i = 0; i < lv - 1; i++) { ctx.fillStyle = '#ffd23d'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★', 2 + i * 8, 6); }
    ctx.restore();
  }
  function drawBuilding(b, sel) {
    const sc = dscale(b.y + b.h), x = b.x, y = b.y, w = b.w, h = b.h;
    shadow(x + w / 2, y + h + 2, w * 0.5);
    if (sel) { ctx.strokeStyle = '#58e08a'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x - 3, y - 15, w + 6, h + 17); ctx.setLineDash([]); }
    if (b.bkind === 'market') { ctx.fillStyle = '#caa06a'; ctx.fillRect(x + 4, y + 16, w - 8, h - 16); for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#e0556a' : '#f4f3ee'; ctx.beginPath(); ctx.moveTo(x + 2 + i * (w - 4) / 5, y + 8); ctx.lineTo(x + 2 + (i + 1) * (w - 4) / 5, y + 8); ctx.lineTo(x + 2 + (i + 0.5) * (w - 4) / 5, y + 18); ctx.closePath(); ctx.fill(); } ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 4, y + 6, w - 8, 4); ctx.font = (14 * sc + 8) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🧺', x + w / 2, y + h - 4); }
    else if (b.bkind === 'tower') { ctx.fillStyle = '#9a8a6a'; ctx.fillRect(x + 2, y + 14, w - 4, h - 14); ctx.fillStyle = '#7a6a4a'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 + i * (w - 4) / 3, y + 8, (w - 6) / 3, 8); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x + w / 2 - 3, y + h - 12, 6, 12); ctx.strokeStyle = '#c94a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 8); ctx.lineTo(x + w / 2, y - 6); ctx.stroke(); ctx.fillStyle = '#c94a3a'; ctx.beginPath(); ctx.moveTo(x + w / 2, y - 6); ctx.lineTo(x + w / 2 + 10, y - 3); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill(); }
    else if (b.bkind === 'bunk') { ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x + 4, y + 14, w - 8, h - 14); ctx.fillStyle = '#6a4028'; ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + w / 2, y + 2); ctx.lineTo(x + w, y + 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + w / 2 - 5, y + h - 14, 10, 14); ctx.fillStyle = '#bfe6ff'; ctx.fillRect(x + 8, y + 20, 7, 7); ctx.fillRect(x + w - 15, y + 20, 7, 7); ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🛏️', x + w / 2, y + h - 3); }
    else if (b.bkind === 'well') { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 6, w * 0.45, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#3ba7e0'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 6, w * 0.3, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#cfeeff'; ctx.beginPath(); ctx.ellipse(x + w / 2 + Math.sin(tick / 16) * 4, y + h - 6, w * 0.13, 1.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 6, y + h - 8); ctx.lineTo(x + 8, y); ctx.moveTo(x + w - 6, y + h - 8); ctx.lineTo(x + w - 8, y); ctx.stroke(); ctx.fillStyle = '#8a4030'; ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w / 2, y - 8); ctx.lineTo(x + w - 2, y + 2); ctx.closePath(); ctx.fill(); }
    else if (b.bkind === 'haybarn') { ctx.fillStyle = '#b04a3a'; ctx.fillRect(x + 4, y + 16, w - 8, h - 16); ctx.fillStyle = '#7a2f28'; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x + w / 2, y + 2); ctx.lineTo(x + w, y + 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e0c060'; ctx.fillRect(x + 8, y + h - 12, 10, 10); ctx.fillRect(x + w - 18, y + h - 12, 10, 10); ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🌾', x + w / 2, y + h - 2); }
    else if (b.bkind === 'vet') { ctx.fillStyle = '#f4f3ee'; ctx.fillRect(x + 4, y + 14, w - 8, h - 14); ctx.fillStyle = '#c85a5a'; ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + w / 2, y + 2); ctx.lineTo(x + w, y + 16); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3aa64a'; ctx.fillRect(x + w / 2 - 8, y + 22, 16, 5); ctx.fillRect(x + w / 2 - 2.5, y + 16, 5, 16); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(x + 8, y + h - 12, 9, 12); ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🩺', x + w - 12, y + h - 3); }
    if (b.bkind !== 'well') { const ws = ctx.createLinearGradient(0, y + 12, 0, y + h); ws.addColorStop(0, 'rgba(255,255,255,0.10)'); ws.addColorStop(0.4, 'rgba(0,0,0,0)'); ws.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = ws; ctx.fillRect(x + 3, y + 13, w - 6, h - 13); }   // form shading
    if (sel) { const sb = bScrapBtn(b); ctx.fillStyle = '#d94a3a'; ctx.beginPath(); ctx.arc(sb.x, sb.y, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', sb.x, sb.y + 1); ctx.textBaseline = 'alphabetic'; }
  }
  function drawWorker(w) {
    const sc = dscale(w.y), f = w.facing || 1, col = WORKER[w.job].col, bob = Math.abs(Math.sin(w.step / 6)) * 2;
    ctx.save(); ctx.translate(w.x, w.y - bob); ctx.scale(sc, sc); shadowLocal(0, 8 + bob, 8);
    ctx.strokeStyle = '#3a2f28'; ctx.lineWidth = 2.4; const lg = Math.sin(w.step / 5) * 2.5; ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-2 + lg, 11); ctx.moveTo(2, 5); ctx.lineTo(2 - lg, 11); ctx.stroke();
    ctx.fillStyle = col; roundRect(-5, -4, 10, 10, 3); ctx.fill();
    ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(0, -8, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0c060'; ctx.beginPath(); ctx.ellipse(0, -10, 6, 2.2, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, -11.5, 3, Math.PI, 0); ctx.fill();
    if (w.job === 'wood') { ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(6 * f, 2); ctx.lineTo(9 * f, -6); ctx.stroke(); ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(9 * f, -6); ctx.lineTo(12 * f, -8); ctx.lineTo(10 * f, -3); ctx.closePath(); ctx.fill(); }
    else if (w.job === 'mine') { ctx.strokeStyle = '#6a4a34'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(6 * f, 2); ctx.lineTo(9 * f, -6); ctx.stroke(); ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6 * f, -7); ctx.lineTo(12 * f, -5); ctx.stroke(); }
    else if (w.job === 'haul') { ctx.fillStyle = '#8a8f96'; ctx.fillRect(5 * f, 0, 5, 5); ctx.strokeStyle = '#6a6f76'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(7.5 * f, 0, 2.5, Math.PI, 0); ctx.stroke(); }
    else { ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(6 * f, 0); ctx.lineTo(10 * f, -3); ctx.moveTo(6 * f, 2); ctx.lineTo(10 * f, -1); ctx.stroke(); }
    if ((w.level || 1) > 1) { ctx.fillStyle = '#ffd23d'; ctx.font = '900 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(Math.min(w.level - 1, 4)), 0, -16); }
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
    ctx.strokeStyle = '#3a3238'; ctx.lineWidth = 2.5 * sc;
    for (const lx of [-fluffR * 0.5, fluffR * 0.5]) { ctx.beginPath(); ctx.moveTo(s.x + lx, s.y + fluffR * 0.3); ctx.lineTo(s.x + lx, s.y + fluffR * 0.7); ctx.stroke(); }
    const wool = s.health > 40 ? B.wool : '#cfc9bf'; ctx.fillStyle = wool;
    const puffs = s.breed === 'merino' ? 9 : 6, pr = s.breed === 'merino' ? 0.42 : 0.5;
    if (s.wool > 20) for (let i = 0; i < puffs; i++) { const a = i / puffs * Math.PI * 2; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * fluffR * 0.55, s.y + bob + Math.sin(a) * fluffR * 0.45, fluffR * pr, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(s.x, s.y + bob, fluffR, fluffR * 0.8, 0, 0, 7); ctx.fill();
    // soft top-left sheen for a puffy, lit look
    ctx.globalAlpha = s.breed === 'black' ? 0.16 : 0.34; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.3, s.y + bob - fluffR * 0.32, fluffR * 0.52, fluffR * 0.4, -0.35, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (s.breed === 'golden') { ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.3, s.y + bob - fluffR * 0.3, fluffR * 0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; if ((tick | 0) % 40 < 3) { ctx.fillStyle = '#fff'; ctx.font = (10 * sc) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✨', s.x + fluffR * 0.5, s.y + bob - fluffR * 0.5); } }
    ctx.fillStyle = s.breed === 'black' ? '#1c1a20' : '#3a3238'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.7, s.y + bob + 2, fluffR * 0.42, fluffR * 0.5, -0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x - fluffR * 0.85, s.y + bob, 1.7 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c262b'; ctx.beginPath(); ctx.ellipse(s.x - fluffR * 0.55, s.y + bob - 4, 3 * sc, 5 * sc, -0.5, 0, 7); ctx.fill();
    if (isRam) { ctx.strokeStyle = '#e6c689'; ctx.lineWidth = 3.4 * sc; ctx.lineCap = 'round'; for (const side of [-1, 1]) { const hx = s.x - fluffR * 0.7 + side * fluffR * 0.18, hy = s.y + bob - fluffR * 0.55; ctx.beginPath(); ctx.arc(hx, hy, 5.5 * sc, Math.PI * 0.1, Math.PI * 1.7, false); ctx.stroke(); } ctx.lineCap = 'butt'; }
    ctx.textAlign = 'center';
    if (ready) { ctx.font = (15 * sc) + 'px system-ui'; ctx.fillText('✂️', s.x, s.y - fluffR - 12 + Math.sin(tick / 6) * 2); }
    if (s.heartT > 0) { ctx.globalAlpha = clamp(s.heartT / 24, 0, 1); ctx.font = (13 * sc) + 'px system-ui'; ctx.fillText('💗', s.x + fluffR * 0.6, s.y + bob - fluffR - 2); ctx.globalAlpha = 1; }
    if (s.baaT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 11px system-ui'; ctx.fillText('baa!', s.x + fluffR, s.y + bob - fluffR); }
    if (s.sick) { ctx.globalAlpha = 0.28; ctx.fillStyle = '#8fd06a'; ctx.beginPath(); ctx.ellipse(s.x, s.y + bob, fluffR, fluffR * 0.8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; ctx.font = (13 * sc) + 'px system-ui'; ctx.fillText('🤒', s.x, s.y - fluffR - 10); }
    else if (s.health < 40) { ctx.font = '13px system-ui'; ctx.fillText(s.hunger > s.thirst ? '🌾' : '💧', s.x, s.y - fluffR - 10); }
  }
  function drawPredator(fx) {
    const wolf = fx.wolf, alpha = fx.alpha, sc = dscale(fx.y) * (alpha ? 1.7 : wolf ? 1.3 : 1), f = fx.facing || 1; ctx.save(); ctx.translate(fx.x, fx.y); if (fx.dead) ctx.rotate(fx.spin ? (fx.spin * (fx.tumble || 0)) : 0); ctx.scale(f * sc, sc); if (!fx.dead) shadowLocal(0, 7, wolf ? 15 : 12);
    if (wolf) {
      ctx.fillStyle = alpha ? '#4a4f56' : '#6a6f76'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-22, -8); ctx.lineTo(-13, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a5f66'; ctx.beginPath(); ctx.arc(13, -3, 6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(12, -15); ctx.lineTo(15, -8); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(16, -14); ctx.lineTo(18, -7); ctx.fill();
      ctx.fillStyle = '#3a3f46'; ctx.beginPath(); ctx.arc(19, -2, 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = alpha ? '#ff3a2a' : '#ffd23d'; ctx.beginPath(); ctx.arc(16, -4, alpha ? 1.7 : 1.3, 0, 7); ctx.fill();
      if (alpha) { ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(13, -4, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd23d'; ctx.font = '8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('👑', 12, -14); }
    } else {
      ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-20, -6); ctx.lineTo(-11, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-17, -4); ctx.lineTo(-19, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9662e'; ctx.beginPath(); ctx.arc(11, -2, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -6); ctx.lineTo(11, -12); ctx.lineTo(13, -6); ctx.fill(); ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(14, -11); ctx.lineTo(16, -5); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(16, -2, 1.3, 0, 7); ctx.fill();
    }
    if (fx.dead) { ctx.fillStyle = '#111'; ctx.font = '900 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('x', wolf ? 17 : 15, -3); } ctx.restore();
    if (alpha && !fx.dead) { const bw = 28, by = fx.y - 22; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(fx.x - bw / 2, by, bw, 4); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(fx.x - bw / 2, by, bw * clamp(fx.hp / 4, 0, 1), 4); }
  }
  function drawDog(d) {
    const sc = dscale(d.y), f = d.facing || 1; ctx.save(); ctx.translate(d.x, d.y); ctx.scale(f * sc, sc); shadowLocal(0, 8, 12);
    if (d.kind === 'woofa') { ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.ellipse(-3, 5, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#f3f1ea'; ctx.beginPath(); ctx.arc(13, -2, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -2, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#f3f1ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-15, -6); ctx.stroke(); }
    else if (d.kind === 'poodle') { ctx.fillStyle = '#f2ead8'; for (const p of [[0, 0, 9], [10, -3, 6], [-8, -2, 5], [0, -6, 5]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); } ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(13, -3, 1.3, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#d8dade'; ctx.beginPath(); ctx.ellipse(13, 1, 3.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -3, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawTractor(t) { const sc = dscale(t.y), f = t.facing || 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(f * sc, sc); shadowLocal(0, 12, 20); ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-9, 8, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(-9, 8, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#3aa64a'; roundRect(-14, -6, 26, 14, 3); ctx.fill(); ctx.fillStyle = '#2f8a3c'; roundRect(-2, -18, 12, 14, 3); ctx.fill(); ctx.fillStyle = '#bfe6ff'; roundRect(0, -15, 8, 8, 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(-13, -14, 3, 8); ctx.restore(); }

  // ---------- HUD + actions ----------
  const el = (id) => document.getElementById(id);
  function woolPrice() { return (3 + (F.farmLevel - 1) * 2) * techSellMult(); }
  function setBar(fillId, pctId, v) { const f = el(fillId); if (f) f.style.width = v + '%'; const p = el(pctId); if (p) p.textContent = Math.round(v) + '%'; }
  function updateHud() {
    if (!F) return;
    el('fMoney').textContent = '💰 ' + Math.floor(F.money); el('fWool').textContent = '🧺 ' + Math.floor(F.wool);
    el('fWood').textContent = '🪵 ' + Math.floor(F.wood); el('fStone').textContent = '🪨 ' + Math.floor(F.stone);
    el('fSheep').textContent = '🐑 ' + sheep.length + '/' + F.sheepCap;
    const era = eraName(); el('fLevel').textContent = era.ic + ' ' + era.name;
    setBar('foodFill', 'foodPct', F.feed); setBar('waterFill', 'waterPct', F.water);
    const fb = el('foodFill'); if (fb) fb.classList.toggle('low', F.feed < 20);
    const wb = el('waterFill'); if (wb) wb.classList.toggle('low', F.water < 20);
    el('sellVal').textContent = '$' + Math.floor(F.wool * woolPrice());
    const gc = el('goalChip'), gf = el('goalFill'); if (gc) { const g = goalInfo(); gc.querySelector('.goal-text').textContent = g.text; if (gf) gf.style.width = Math.round(g.pct * 100) + '%'; gc.classList.toggle('done', g.done); }
  }
  function goalInfo() {
    if (F.won) return { text: '🏆 Golden Fleece won — sandbox on!', pct: 1, done: true };
    if (F.farmLevel < ERAS.length) { const c = expandCost(); return { text: '🎯 Reach the ' + ERAS[F.farmLevel].name + ' era', pct: clamp(F.money / c, 0, 1), done: false }; }
    return { text: '🏆 Amass $' + WIN_MONEY + ' for the Golden Fleece', pct: clamp(F.money / WIN_MONEY, 0, 1), done: false };
  }
  const toastEl = el('toast');
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.style.color = '#fff'; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }
  function heartsOnFlock() { let n = 0; for (const s of sheep) { if (n++ > 5) break; s.heartT = 24; } }
  function refillFeed() { if (F.money < FEED_COST) return toast('Not enough money'); F.money -= FEED_COST; F.feed = clamp(F.feed + 55, 0, 100); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function refillWater() { if (F.money < WATER_COST) return toast('Not enough money'); F.money -= WATER_COST; F.water = clamp(F.water + 65, 0, 100); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function sellWool() { if (F.wool < 1) return toast('No wool — shear the fluffy (✂️) sheep first!'); const got = Math.floor(F.wool * woolPrice()); F.money += got; F.wool = 0; toast('💰 Sold wool for $' + got); confetti(W / 2, H * 0.4, ['💰', '🪙', '✨']); sfx.coin(); persist(); updateHud(); }
  el('btnFeed').onclick = refillFeed; el('btnWater').onclick = refillWater; el('btnSell').onclick = sellWool; el('btnShop').onclick = openShop; el('farmPlay').onclick = startGame; el('shopClose').onclick = closeShop;
  { const b = el('btnWoofa'); if (b) b.onclick = () => { if (running) woofaGather(); }; }
  function syncMute() { const b = el('btnSound'); if (b) b.textContent = F && F.muted ? '🔇' : '🔊'; }
  { const b = el('btnSound'); if (b) b.onclick = () => { F.muted = !F.muted; syncMute(); if (!F.muted) { ensureAudio(); sfx.pop(); } persist(); }; }
  { const b = el('btnHelp'); if (b) b.onclick = () => startTutorial(); }
  { const b = el('btnResearch'); if (b) b.onclick = () => { if (running) openResearch(); }; }

  // ---------- tutorial ----------
  const TUT = [
    { t: '👋 Welcome to Ewe Beauty Farming Co — build a sheep EMPIRE! Raise sheep, grow wool, run a whole farm crew.' },
    { t: '🌾 Tap FEED & 💧 WATER to fill troughs (watch the gauges). Or hire a 🪣 Hauler to do it for you!' },
    { t: '👷 In the 🛒 SHOP hire Farmhands: ✂️ Shepherd shears, 🪣 Hauler refills, 🪓 Woodcutter chops 🪵 wood, ⛏️ Miner digs 🪨 stone. Tap a worker to change their job!' },
    { t: '🏗️ Spend wood + stone to BUILD a 🏪 Market, 🗼 Watchtower, 🛖 Bunkhouse, Wells & Barns. Upgrade a pen to 🧱 STONE and shut the gate — predators can\'t get in!' },
    { t: '🔬 RESEARCH tech (top-right) for permanent boosts: sharper shears, hardy breeds, faster hands & more.' },
    { t: '🐾 WOOFA button herds the flock into a pen. 🦊 Foxes AND 🐺 wolves raid — dogs FLING them! Advance ERAS to grow. Have fun! 🐑' },
  ];
  let tutIx = 0;
  function startTutorial() { tutIx = 0; showTut(); }
  function showTut() { const o = el('tutOverlay'); if (!o) return; el('tutText').textContent = TUT[tutIx].t; el('tutStep').textContent = (tutIx + 1) + ' / ' + TUT.length; el('tutNext').textContent = tutIx === TUT.length - 1 ? 'Let\'s farm! 🐑' : 'Next ›'; o.classList.remove('hidden'); }
  function nextTut() { tutIx++; if (tutIx >= TUT.length) return endTut(); showTut(); }
  function endTut() { const o = el('tutOverlay'); if (o) o.classList.add('hidden'); if (F) { F.tutorialDone = true; persist(); } }
  { const n = el('tutNext'); if (n) n.onclick = nextTut; const s = el('tutSkip'); if (s) s.onclick = endTut; }

  // ---------- victory ----------
  function onVictory() {
    toast('🏆 GOLDEN FLEECE!'); flashAlert('🏆 YOU BUILT A SHEEP EMPIRE!', '#ffd23d', true); sfx.up(); setTimeout(() => sfx.coin(), 200);
    for (let k = 0; k < 4; k++) setTimeout(() => confetti(rand(W * 0.2, W * 0.8), H * 0.3, ['🏆', '🎉', '⭐', '🐑', '👑']), k * 250);
    const o = el('winScreen'); if (o) o.classList.remove('hidden');
    persist();
  }
  { const b = el('winClose'); if (b) b.onclick = () => { const o = el('winScreen'); if (o) o.classList.add('hidden'); }; }

  // ---------- research overlay ----------
  const researchScreen = el('researchScreen');
  function openResearch() { renderResearch(); researchScreen.classList.remove('hidden'); }
  function closeResearch() { researchScreen.classList.add('hidden'); }
  { const b = el('researchClose'); if (b) b.onclick = closeResearch; }
  function canAfford(t) { return F.money >= (t.coin || 0) && F.wood >= (t.wood || 0) && F.stone >= (t.stone || 0); }
  function costLabel(t) { let s = '$' + t.coin; if (t.wood) s += ' 🪵' + t.wood; if (t.stone) s += ' 🪨' + t.stone; return s; }
  function renderResearch() {
    el('researchCoins').textContent = Math.floor(F.money);
    const list = el('researchList'); list.innerHTML = '';
    for (const k of Object.keys(TECH)) {
      const t = TECH[k], owned = !!F.tech[k], can = canAfford(t);
      const div = document.createElement('div'); div.className = 'shop-item' + (owned ? ' owned' : '');
      const action = owned ? '<span class="si-tag equipped">✓ Done</span>' : '<button class="si-buy" ' + (can ? '' : 'disabled') + '>' + costLabel(t) + '</button>';
      div.innerHTML = '<div class="si-emoji">' + t.emoji + '</div><div class="si-body"><div class="si-name">' + t.name + '</div><div class="si-desc">' + t.desc + '</div></div><div class="si-action">' + action + '</div>';
      if (!owned && can) div.querySelector('.si-buy').onclick = () => { research(k); renderResearch(); updateHud(); };
      list.appendChild(div);
    }
  }
  function research(k) { const t = TECH[k]; if (F.tech[k] || !canAfford(t)) return; F.money -= t.coin || 0; F.wood -= t.wood || 0; F.stone -= t.stone || 0; F.tech[k] = true; toast('🔬 Researched ' + t.name + '!'); confetti(W / 2, H * 0.4, ['🔬', '✨', '⭐']); sfx.tech(); persist(); updateHud(); }

  // ---------- shop ----------
  const startScreen = el('startScreen'), shopScreen = el('shopScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); if (researchScreen) researchScreen.classList.add('hidden'); const wsn = el('winScreen'); if (wsn) wsn.classList.add('hidden'); }
  function openShop() { if (!F) return; renderShop(); shopScreen.classList.remove('hidden'); }
  function closeShop() { shopScreen.classList.add('hidden'); }
  function sheepCost(b) { if (b === 'normal' && sheep.length === 0) return 0; return Math.round(BREEDS[b].cost + (b === 'normal' ? sheep.length * 18 : 0)); }
  function expandCost() { return Math.round(240 * F.farmLevel); }
  function houseCost() { return Math.round(300 * F.house.level); }
  function workerCost() { return 90 + workers.length * 55; }

  function renderShop() {
    el('shopMoney').textContent = Math.floor(F.money);
    const list = el('shopList'); list.innerHTML = ''; const rows = [];
    rows.push({ head: '🐑 Livestock' });
    for (const b of ['normal', 'merino', 'golden', 'black']) { const B = BREEDS[b], locked = F.farmLevel < B.lvl, full = sheep.length >= F.sheepCap, c = sheepCost(b), rescue = b === 'normal' && sheep.length === 0; rows.push({ emoji: b === 'black' ? '🖤' : b === 'golden' ? '⭐' : rescue ? '🐣' : '🐑', name: rescue ? 'Rescue a Stray Lamb' : 'Buy ' + B.name + ' Sheep', desc: rescue ? 'Your flock is empty — take this one free and start again!' : locked ? 'Unlocks at farm Lv ' + B.lvl + '.' : (b === 'black' ? 'Priciest — wool sells for 6.5×.' : 'Wool value ×' + B.mult + '.'), act: locked ? { tag: 'Lv ' + B.lvl } : full ? { tag: 'Full' } : { label: rescue ? 'FREE' : '$' + c, fn: () => buySheep(b), afford: F.money >= c } }); }
    rows.push({ head: '👷 Farmhands (' + workers.length + '/' + workerCap() + ')' });
    const capFull = workers.length >= workerCap(), wc = workerCost();
    for (const j of JOBS) { const info = WORKER[j]; rows.push({ emoji: info.emoji, name: 'Hire ' + info.name, desc: info.desc + (capFull ? ' — cap reached (build a 🛖 Bunkhouse!).' : ''), act: capFull ? { tag: 'Full' } : { label: '$' + wc, fn: () => hireWorker(j), afford: F.money >= wc } }); }
    rows.push({ head: '🏗️ Buildings' });
    for (const k of Object.keys(BUILD)) { const bd = BUILD[k]; const can = F.money >= bd.coin && F.wood >= bd.wood && F.stone >= (bd.stone || 0); let cd = 'Costs 🪵' + bd.wood + (bd.stone ? ' 🪨' + bd.stone : ''); rows.push({ emoji: bd.emoji, name: 'Build ' + bd.name, desc: bd.desc + ' ' + cd + '.', act: { label: '$' + bd.coin, fn: () => buyBuilding(k), afford: can } }); }
    rows.push({ emoji: '🚧', name: 'Build a Pen', desc: 'Drops a pen — resize corners, tap 🧱 to make it a fox-proof stone pen, ✕ to scrap.', act: { label: '$' + PEN_COST, fn: buyPen, afford: F.money >= PEN_COST } });
    rows.push({ head: '🌱 Land, Power & Resources' });
    rows.push({ emoji: '🏠', name: 'Upgrade Farmhouse (Lv ' + F.house.level + ')', desc: F.house.level >= 5 ? 'Maxed! Passive coin, faster wool, +worker cap.' : 'Passive coin, faster wool, +1 worker cap, fancier house.', act: F.house.level >= 5 ? { tag: 'MAX' } : { label: '$' + houseCost(), fn: buyHouse, afford: F.money >= houseCost() } });
    const et = F.energy, next = ENERGY[et + 1];
    rows.push({ emoji: et >= 3 ? '⚡' : et === 2 ? '☀️' : et === 1 ? '🌬️' : '🔌', name: next ? 'Upgrade Energy → ' + next.short : 'Energy: Power Grid', desc: next ? next.desc + ' (now: ' + ENERGY[et].short + ')' : 'Top-tier energy.', act: next ? { label: '$' + next.cost, fn: buyEnergy, afford: F.money >= next.cost } : { tag: 'MAX' } });
    rows.push({ emoji: '🚜', name: 'Buy a Tractor', desc: F.upgrades.tractor ? 'Owned — tap the field to drive it.' : 'Tap the field to send it herding.', act: F.upgrades.tractor ? { tag: 'Owned' } : { label: '$650', fn: buyTractor, afford: F.money >= 650 } });
    rows.push({ emoji: '🌳', name: 'Plant a Tree', desc: 'More 🪵 wood for Woodcutters, and prettier.', act: { label: '$70', fn: plantTree, afford: F.money >= 70 } });
    rows.push({ emoji: '🪨', name: 'Haul in a Boulder', desc: 'A rock for Miners to dig 🪨 stone from.', act: { label: '$90', fn: addRock, afford: F.money >= 90 } });
    rows.push({ emoji: '🌿', name: 'Plant a Grazing Bush', desc: 'A lush bush the sheep nibble — free food that regrows.', act: { label: '$50', fn: plantBush, afford: F.money >= 50 } });
    { const sickN = sheep.filter(s => s.sick).length, vcost = 40 + sickN * 20; rows.push({ emoji: '💊', name: 'Call the Vet', desc: sickN ? 'Instantly cure all ' + sickN + ' sick 🤒 sheep.' : 'No sick sheep right now — build a 🩺 Vet Hut to auto-heal.', act: sickN ? { label: '$' + vcost, fn: callVet, afford: F.money >= vcost } : { tag: 'Healthy' } }); }
    const nextEra = ERAS[Math.min(F.farmLevel, ERAS.length - 1)];
    rows.push({ emoji: nextEra.ic, name: F.farmLevel >= ERAS.length ? 'Sheep Empire (max era)' : 'Advance to ' + nextEra.name, desc: 'Bigger land, +5 sheep cap, +worker cap, +wool price, a new tree.', act: F.farmLevel >= ERAS.length ? { tag: 'MAX' } : { label: '$' + expandCost(), fn: buyExpand, afford: F.money >= expandCost() } });
    rows.push({ head: '🐾 Guard Dogs' });
    for (const k of ['winnie', 'tia']) { const d = DOGS[k]; rows.push({ emoji: k === 'winnie' ? '🐩' : '🦴', name: d.name + (k === 'winnie' ? ' (poodle)' : ' (schnauzer)'), desc: d.desc, act: F.dogs[k] ? { tag: 'Owned' } : { label: '$' + d.cost, fn: () => buyDog(k), afford: F.money >= d.cost } }); }
    for (const r of rows) {
      if (r.head) { const h = document.createElement('div'); h.className = 'shop-section'; h.textContent = r.head; list.appendChild(h); continue; }
      const div = document.createElement('div'); div.className = 'shop-item';
      const action = r.act.tag ? '<span class="si-tag ' + (r.act.tag === 'Owned' || r.act.tag === 'Running' || r.act.tag === 'MAX' ? 'equipped' : 'lockmsg') + '">' + r.act.tag + '</span>' : '<button class="si-buy" ' + (r.act.afford ? '' : 'disabled') + '>' + r.act.label + '</button>';
      div.innerHTML = '<div class="si-emoji">' + r.emoji + '</div><div class="si-body"><div class="si-name">' + r.name + '</div><div class="si-desc">' + r.desc + '</div></div><div class="si-action">' + action + '</div>';
      if (r.act.fn && r.act.afford) div.querySelector('.si-buy').onclick = () => { r.act.fn(); renderShop(); updateHud(); }; list.appendChild(div);
    }
  }
  function buySheep(b) { const c = sheepCost(b); if (sheep.length >= F.sheepCap || (c > 0 && F.money < c)) return; F.money -= c; sheep.push(makeSheep({ breed: b, role: rollRole(), wool: 0 })); toast(c === 0 ? '🐣 Rescued a stray lamb!' : '🐑 New ' + BREEDS[b].name + '!'); sfx.pop(); persist(); updateHud(); }
  function buyExpand() { const c = expandCost(); if (F.money < c || F.farmLevel >= ERAS.length) return; F.money -= c; F.farmLevel++; F.sheepCap += 5; layout(); F.plants.push({ type: 'tree', x: rand(paddock.x + 40, paddock.x + paddock.w - 40), y: paddock.y + rand(24, 46), sz: rand(0.85, 1.1), wood: 100 }); const era = eraName(); toast(era.ic + ' Entered the ' + era.name + '!'); confetti(W / 2, H * 0.4, ['🌱', '🎉', '🐑']); sfx.up(); persist(); }
  function buyEnergy() { const next = ENERGY[F.energy + 1]; if (!next || F.money < next.cost) return; F.money -= next.cost; F.energy++; toast('🔌 Energy upgraded to ' + next.short + '!'); confetti(W / 2, H * 0.4, ['⚡', '🎉', '☀️']); sfx.up(); persist(); }
  function buyDog(k) { const d = DOGS[k]; if (F.money < d.cost || F.dogs[k]) return; F.money -= d.cost; F.dogs[k] = true; rebuildDogs(); toast('🐾 ' + d.name + ' joined the farm!'); confetti(W / 2, H * 0.4, ['🐾', '🎉']); sfx.up(); persist(); }
  function buyTractor() { if (F.money < 650 || F.upgrades.tractor) return; F.money -= 650; F.upgrades.tractor = true; tractor = makeTractor(); toast('🚜 Tractor delivered!'); sfx.up(); persist(); }
  function buyHouse() { const c = houseCost(); if (F.money < c || F.house.level >= 5) return; F.money -= c; F.house.level++; toast('🏠 Farmhouse upgraded to Lv ' + F.house.level + '! (+worker cap)'); confetti(house.x, house.y, ['🏠', '⭐', '✨']); sfx.up(); persist(); }
  function buyPen() { if (F.money < PEN_COST) return; F.money -= PEN_COST; const pen = { x: paddock.x + paddock.w / 2 - 75, y: paddock.y + paddock.h / 2 - 60, w: 150, h: 118, gateOpen: true, gateSide: 0, stone: false, _init: true }; F.pens.push(pen); placing = pen; closeShop(); toast('🚧 Drag into place, then tap to drop.'); persist(); }
  function buyBuilding(k) { const bd = BUILD[k]; if (F.money < bd.coin || F.wood < bd.wood || F.stone < (bd.stone || 0)) return; F.money -= bd.coin; F.wood -= bd.wood; F.stone -= (bd.stone || 0); const n = F.buildings.length; const b = { bkind: k, x: clamp(paddock.x + paddock.w / 2 - bd.w / 2 + (n % 3 - 1) * 66, paddock.x + 4, paddock.x + paddock.w - bd.w - 4), y: paddock.y + paddock.h * 0.35 + (n % 4) * 40, w: bd.w, h: bd.h, cd: 0 }; F.buildings.push(b); placing = b; closeShop(); toast('🏗️ Place your ' + bd.name + ' — tap to drop.'); persist(); }
  function hireWorker(j) { if (workers.length >= workerCap()) return toast('Worker cap reached — build a 🛖 Bunkhouse or upgrade your house!'); const c = workerCost(); if (F.money < c) return; F.money -= c; workers.push(makeWorker(j)); syncWorkerJobs(); toast(WORKER[j].emoji + ' ' + WORKER[j].name + ' hired!'); confetti(house.x + 20, house.y + 30, ['👷', '🎉']); sfx.up(); persist(); }
  function plantTree() { if (F.money < 70) return; F.money -= 70; F.plants.push({ type: 'tree', x: rand(paddock.x + 40, paddock.x + paddock.w - 40), y: paddock.y + rand(24, paddock.h * 0.5), sz: rand(0.85, 1.15), wood: 100 }); toast('🌳 Planted a tree!'); sfx.pop(); persist(); }
  function addRock() { if (F.money < 90) return; F.money -= 90; const y = rand(paddock.y + paddock.h * 0.15, paddock.y + paddock.h * 0.5); const b = fieldBounds(y); F.plants.push({ type: 'rock', x: rand(b.left + 10, b.right - 10), y, sz: rand(0.9, 1.1), stone: 100 }); toast('🪨 A boulder was hauled in!'); sfx.pop(); persist(); }
  function plantBush() { if (F.money < 50) return; F.money -= 50; const y = rand(paddock.y + paddock.h * 0.35, paddock.y + paddock.h - 40); const b = fieldBounds(y); F.plants.push({ type: 'bush', x: rand(b.left + 10, b.right - 10), y, sz: 1, amt: 1 }); toast('🌿 Planted a grazing bush!'); sfx.pop(); persist(); }
  function callVet() { const sickN = sheep.filter(s => s.sick).length; if (!sickN) return; const cost = 40 + sickN * 20; if (F.money < cost) return; F.money -= cost; for (const s of sheep) if (s.sick) { s.sick = false; s.sickT = 0; s.heartT = 24; pop(s.x, s.y - 12, '💚', '#58e08a'); } toast('💊 The vet cured your flock!'); confetti(W / 2, H * 0.4, ['💚', '🩺', '✨']); sfx.up(); persist(); updateHud(); }

  // ---------- loop ----------
  let lastT = performance.now(), lastErr = null;
  function frame(nt) { let dt = (nt - lastT) / 16.6667; lastT = nt; dt = clamp(dt, 0, 2.5); try { update(dt); render(); if (musicOn) musicSched(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  window.addEventListener('beforeunload', persist);
  resize(); requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__farm = {
      start: startGame, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      info() { return F ? { running, money: Math.floor(F.money), wool: Math.floor(F.wool), wood: Math.floor(F.wood), stone: Math.floor(F.stone), sheep: sheep.length, cap: F.sheepCap, feed: Math.floor(F.feed), water: Math.floor(F.water), era: F.farmLevel, house: F.house.level, energy: F.energy, workers: workers.length, workerCap: workerCap(), jobs: workers.reduce((m, w) => (m[w.job] = (m[w.job] || 0) + 1, m), {}), buildings: F.buildings.map(b => b.bkind), pens: F.pens.length, stonePens: F.pens.filter(p => p.stone).length, tech: Object.keys(F.tech).filter(k => F.tech[k]), preds: preds.length, wolves: preds.filter(p => p.wolf && !p.dead).length, plants: F.plants.length, herding: !!herdGoal, lambs: sheep.filter(s => s.role === 'lamb').length, rams: sheep.filter(s => s.role === 'ram').length, ewes: sheep.filter(s => s.role === 'ewe').length, night: +nightAmt().toFixed(2), isNight: isNight(), won: !!F.won, workerLvls: workers.map(w => w.level || 1), season: SEASONS[seasonIx()].name, weather: F.weather, sick: sheep.filter(s => s.sick).length, alpha: preds.filter(p => p.alpha && !p.dead).length } : { running }; },
      lastErr() { return lastErr ? String(lastErr && lastErr.stack || lastErr) : null; },
      give(m) { F.money += m; updateHud(); }, giveWood(w) { F.wood += w; updateHud(); }, giveStone(s) { F.stone += s; updateHud(); }, feed: refillFeed, water: refillWater, sell: sellWool,
      forceWool() { for (const s of sheep) if (s.role !== 'lamb') s.wool = 100; }, shearAll() { for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb') { if (!insideAnyPen(s.x, s.y)) { s.x = F.pens[0] ? F.pens[0].x + F.pens[0].w / 2 : s.x; s.y = F.pens[0] ? F.pens[0].y + F.pens[0].h / 2 : s.y; } shearSheep(s); } },
      spawnFox() { predTimer = -5; }, pushFox(wolf) { preds.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false, dead: false, facing: 1, wolf: !!wolf }); }, pushWolf() { preds.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false, dead: false, facing: 1, wolf: true }); }, killFox() { const t = preds.find(p => !p.dead); if (t && dogs[0]) catchPredator(t, dogs[0]); },
      noFox() { F._nofox = true; preds.length = 0; }, foxOn() { F._nofox = false; },
      forceBreed() { breedTimer = 0; for (const s of sheep) s.breedCD = 0; }, starve() { for (const s of sheep) { s.hunger = 100; s.thirst = 100; } F.feed = 0; F.water = 0; },
      addSheep(n) { for (let i = 0; i < (n || 1); i++) sheep.push(makeSheep({ role: i % 2 ? 'ram' : 'ewe', wool: 0 })); updateHud(); },
      hire: hireWorker, fire() { if (workers.length) { workers.pop(); syncWorkerJobs(); } }, setJob(i, j) { if (workers[i]) { workers[i].job = j; syncWorkerJobs(); } },
      research, techList() { return Object.keys(F.tech).filter(k => F.tech[k]); }, openResearch,
      buildKind: buyBuilding, addRock, dropPlacing() { placing = null; }, buyTractor, buyPen, buyHouse, buyEnergy, plantTree, plantBush, herdTo, gather: woofaGather, expand: buyExpand,
      buySheep, scrapBuild(i) { if (F.buildings[i]) scrapBuilding(F.buildings[i]); }, killAllSheep() { sheep.length = 0; updateHud(); },
      audio() { ensureAudio(); return { musicOn, hasCtx: !!actx }; }, tickMusic() { musicSched(); }, advClock(s) { if (actx && actx._adv) actx._adv(s); },
      penInfo() { return F.pens.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h), gate: p.gateSide, open: p.gateOpen, stone: !!p.stone })); },
      resizePen(i, w, h) { if (F.pens[i]) { F.pens[i].w = w; F.pens[i].h = h; } }, moveGate(i, side) { if (F.pens[i]) F.pens[i].gateSide = side; }, scrapPen(i) { if (F.pens[i]) scrapPen(F.pens[i]); }, selectPen(i) { selectedPen = F.pens[i] || null; }, stonePen(i) { if (F.pens[i]) upgradePenStone(F.pens[i]); }, closeGate(i) { if (F.pens[i]) F.pens[i].gateOpen = false; }, setEnergy(n) { F.energy = n; },
      sheepInPen(i) { const p = F.pens[i]; if (!p) return 0; return sheep.filter(s => penInsideStrict(p, s.x, s.y)).length; },
      treeWood() { return F.plants.filter(p => p.type === 'tree').map(p => Math.round(p.wood)); }, rockStone() { return F.plants.filter(p => p.type === 'rock').map(p => Math.round(p.stone)); },
      putSheepIn(i) { const p = F.pens[i]; if (!p) return; for (const s of sheep) { s.x = p.x + p.w / 2 + rand(-p.w * 0.3, p.w * 0.3); s.y = p.y + p.h / 2 + rand(-p.h * 0.3, p.h * 0.3); } },
      tutorial: startTutorial, sampleEwes(n) { let e = 0; for (let i = 0; i < (n || 100); i++) if (rollRole() === 'ewe') e++; return e; },
      setDay(phase) { F.dayT = phase * DAY_LEN; }, night() { return nightAmt(); }, goal() { return goalInfo(); }, levelUpAll() { for (const w of workers) { w.level = 5; } syncWorkerJobs(); }, workXp() { for (const w of workers) gainXp(w); },
      setSeason(i) { F.seasonT = i * SEASON_LEN; }, setWeather(w) { F.weather = w; }, makeSick(n) { let c = 0; for (const s of sheep) { if (c >= (n || 1)) break; if (s.role !== 'lamb' && !s.sick) { s.sick = true; s.sickT = 0; c++; } } return c; }, callVet, packRaid: spawnPack,
      camInfo() { return { y: Math.round(cam.y), max: Math.round(camMaxY()), viewH: Math.round(viewH), worldH: Math.round(paddock.h), scale: +worldScale().toFixed(2) }; }, setCam(y) { cam.y = clamp(y, 0, camMaxY()); return Math.round(cam.y); },
      flockSpread() { if (sheep.length < 2) return 0; const c = flockCentroid(); let d = 0; for (const s of sheep) d += Math.hypot(s.x - c.x, s.y - c.y); return Math.round(d / sheep.length); },
      dbg() { return { pens: F.pens.length, placing: placing ? (placing.bkind || 'pen') : null, drag: drag ? drag.type : null, selected: !!selectedPen, herding: !!herdGoal, workers: workers.length, buildings: F.buildings.length, preds: preds.length }; },
    };
  }
})();
