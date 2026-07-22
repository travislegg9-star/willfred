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
  const SAVE_BASE = 'ewe_beauty_v1', SLOT_KEY = 'ewe_beauty_slot', NSLOTS = 3;
  let curSlot = 0;
  function saveKey(slot) { return SAVE_BASE + '_' + (slot == null ? curSlot : slot); }
  const SAVE_KEY = SAVE_BASE;   // legacy single-save key (migrated into slot 0)
  const FEED_COST = 8, WATER_COST = 3, PEN_COST = 120;
  const ERAS = [{ name: 'Homestead', ic: '🏡' }, { name: 'Smallholding', ic: '🚜' }, { name: 'Estate', ic: '🏘️' }, { name: 'Grand Estate', ic: '🏛️' }, { name: 'Sheep Empire', ic: '👑' }];
  // ---------- difficulty / farm modes (picks the whole feel: threats, pace, starting flock) ----------
  const DIFFS = {
    little: {
      key: 'little', name: 'Little Farmer', emoji: '🐑', age: 'Ages 5–8', tint: '#7ed957',
      blurb: 'No wolves. The odd fox pops by, but your dogs shoo every one away — nothing ever hurts your flock. Just build your dream farm! 💚',
      wolves: false, foxKill: false, foxRate: 0.45, guardian: true,
      needMul: 0.5, breed: 1.6, startMoney: 500, startSheep: 6, startCap: 14,
    },
    helper: {
      key: 'helper', name: 'Farm Hand', emoji: '🐕', age: 'Ages 7–10', tint: '#4bc0e0',
      blurb: 'Cheeky foxes sneak in, but your dog always chases them off before they can grab a sheep. Grow a big, happy, safe flock. 🐕',
      wolves: false, foxKill: false, foxRate: 0.85, guardian: true,
      needMul: 0.7, breed: 1.25, startMoney: 240, startSheep: 5, startCap: 11,
    },
    grazier: {
      key: 'grazier', name: 'Grazier', emoji: '🚜', age: 'Ages 10+', tint: '#e0a848',
      blurb: 'Foxes WILL grab a stray sheep if you leave them out. Keep the flock close, work your dogs, pen them up. A real farm to run. 🚜',
      wolves: false, foxKill: true, foxRate: 1, guardian: false,
      needMul: 1, breed: 1, startMoney: 90, startSheep: 3, startCap: 6,
    },
    station: {
      key: 'station', name: 'Wolf Country', emoji: '🐺', age: 'God Mode', tint: '#c94a3a',
      blurb: 'Foxes AND night-time WOLF PACKS raid the farm. Build stone pens, train your dogs, defend the flock. The full challenge! 🐺',
      wolves: true, foxKill: true, foxRate: 1.3, guardian: false,
      needMul: 1.1, breed: 1, startMoney: 90, startSheep: 3, startCap: 6,
    },
  };
  const DIFF_ORDER = ['little', 'helper', 'grazier', 'station'];
  const curDiff = () => DIFFS[(F && F.diff) || 'grazier'] || DIFFS.grazier;
  const BREEDS = {
    normal: { name: 'Woolly', mult: 1, cost: 55, wool: '#f4f3ee', lvl: 1 },
    merino: { name: 'Merino', mult: 1.9, cost: 240, wool: '#efe7d2', lvl: 2 },
    golden: { name: 'Golden', mult: 4.2, cost: 2400, wool: '#ffd24a', lvl: 4 },
    black: { name: 'Black', mult: 6.5, cost: 4200, wool: '#3a3640', lvl: 5 },
  };
  const DOGS = {
    woofa: { name: 'Woofa', kind: 'woofa', cost: 0, bonus: 0.0, desc: 'Your loyal good boy. Herds the flock and chases off predators.' },
    winnie: { name: 'Winnie', kind: 'cavoodle', cost: 1600, bonus: 0.12, desc: 'Fluffy light-brown miniature cavoodle. +12% wool growth and another set of eyes on the foxes.' },
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
    shearGear: 1, records: { woolCrop: 0, bestShear: {} },
    dayT: 0, seasonT: 0, weather: 'clear', weatherT: 900, won: false, tutorialDone: false, muted: false, lastTime: nowMs(),
    diff: null, sheepSeq: 0, shedHands: 0,
    feedMax: 100, waterMax: 100, extraTroughs: [], dams: [], trailer: false,
  });
  // stamp a fresh farm with its chosen difficulty: starting purse, flock size + cap
  function applyDiffStart(f) {
    const d = DIFFS[f.diff]; if (!d) return;
    f.money = d.startMoney;
    f.sheepCap = Math.max(f.sheepCap || 6, d.startCap);
    const arr = [];
    for (let k = 0; k < d.startSheep; k++) arr.push({ breed: 'normal', role: (k === Math.floor(d.startSheep / 2)) ? 'ram' : 'ewe', wool: Math.round(rand(6, 28)) });
    if (!arr.some(s => s.role === 'ram') && arr.length) arr[arr.length - 1].role = 'ram';
    f.sheep = arr;
  }
  const WIN_MONEY = 20000;   // amass this in the Sheep Empire era to win the Golden Fleece

  let F = null;
  const sheep = [], dogs = [], preds = [], fluff = [], grass = [], pops = [], workers = [], motes = [];
  let tractor = null, paddock = {}, feedTrough = {}, waterTrough = {}, shed = {}, house = {};
  let running = false, tick = 0, breedTimer = 1600, predTimer = 1600, alertTimer = 0;
  let placing = null, drag = null, selectedPen = null, selectedBuilding = null, herdGoal = null;
  let viewRect = { x: 0, y: 0, w: 0, h: 0 }, zoom = 1;   // free-scroll RTS camera — pan around a world bigger than the screen
  let cam = { x: 0, y: 0 }, camReady = false, panDrag = null, miniRect = null, pinch = null, armedDam = null;
  const ZOOM_MIN = 0.5, ZOOM_MAX = 1.35;
  let shearSession = null;   // the shearing minigame (pauses the farm)

  function spaceMargins() { return { top: 168, bot: 128, mx: 16 }; }
  function worldMul() { const lvl = (F ? F.farmLevel : 1), ex = (F ? (F.expand || 0) : 0); return 1.3 + (lvl - 1) * 0.7 + ex * 0.5; }   // the WORLD grows as you expand — scroll around it like an RTS map
  function worldScale() { return worldMul(); }   // kept for existing callers
  function layout() {
    const m = spaceMargins();
    viewRect = { x: m.mx, y: m.top, w: W - m.mx * 2, h: H - m.top - m.bot };
    const wm = worldMul();
    paddock = { x: m.mx, y: m.top, w: viewRect.w * wm, h: viewRect.h * wm };   // logical world, bigger than the screen
    zoom = clamp(zoom || 1, ZOOM_MIN, ZOOM_MAX);                               // free camera zoom
    if (F && F.troughs) { feedTrough = F.troughs.feed; waterTrough = F.troughs.water; }
    shed = { x: paddock.x + paddock.w - 60, y: paddock.y + 8 };
    house = { x: paddock.x + 46, y: paddock.y + 12 };
    clampCam();
  }
  function visW() { return viewRect.w / zoom; }
  function visH() { return viewRect.h / zoom; }
  function clampCam() {
    const vw = visW(), vh = visH();
    cam.x = paddock.w <= vw ? paddock.x + (paddock.w - vw) / 2 : clamp(cam.x, paddock.x, paddock.x + paddock.w - vw);
    cam.y = paddock.h <= vh ? paddock.y + (paddock.h - vh) / 2 : clamp(cam.y, paddock.y, paddock.y + paddock.h - vh);
  }
  function centerCamOn(wx, wy) { cam.x = wx - visW() / 2; cam.y = wy - visH() / 2; clampCam(); }
  function setZoom(z, ax, ay) {
    ax = ax == null ? viewRect.x + viewRect.w / 2 : ax; ay = ay == null ? viewRect.y + viewRect.h / 2 : ay;
    const wx = cam.x + (ax - viewRect.x) / zoom, wy = cam.y + (ay - viewRect.y) / zoom;
    zoom = clamp(z, ZOOM_MIN, ZOOM_MAX);
    cam.x = wx - (ax - viewRect.x) / zoom; cam.y = wy - (ay - viewRect.y) / zoom; clampCam();
  }
  function defaultTroughs() { return { feed: { x: paddock.x + paddock.w * 0.30, y: paddock.y + paddock.h - 34 }, water: { x: paddock.x + paddock.w * 0.62, y: paddock.y + paddock.h - 34 } }; }
  function troughsOfKind(kind) { const list = [kind === 'feed' ? feedTrough : waterTrough]; if (F.extraTroughs) for (const t of F.extraTroughs) if (t.kind === kind) list.push(t); return list; }
  function nearestTrough(kind, x, y) { let best = null, bd = 1e9; for (const t of troughsOfKind(kind)) { if (!t) continue; const d = dist(x, y, t.x, t.y); if (d < bd) { bd = d; best = t; } } return best || (kind === 'feed' ? feedTrough : waterTrough); }

  function dscale(y) { return 1; }   // top-down scroll map: uniform scale (no trapezoid perspective)
  const INSET_BASE = 0.17;
  function inset() { return 0; }
  function fieldBounds(y) { return { left: paddock.x + 16, right: paddock.x + paddock.w - 16 }; }   // rectangular world

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
  // kid-friendly sheep names (each sheep gets one; kids can rename in the 📖 My Sheep book)
  const SHEEP_NAMES = ['Woolly', 'Cloud', 'Fluffy', 'Snowy', 'Cotton', 'Marshmallow', 'Nugget', 'Pebble', 'Buttons', 'Daisy', 'Clover', 'Maisie', 'Shaun', 'Baa-bara', 'Sir Baa', 'Lambchop', 'Puff', 'Ziggy', 'Mochi', 'Biscuit', 'Waffles', 'Pom-Pom', 'Coco', 'Dolly', 'Frosty', 'Muffin', 'Noodle', 'Peaches', 'Tofu', 'Bramble', 'Meadow', 'Poppy', 'Sprout', 'Fern', 'Hazel', 'Willow', 'Cinnamon', 'Marlow', 'Gus', 'Otis', 'Angel', 'Bella', 'Chip', 'Dot', 'Ellie', 'Rocky', 'Suki', 'Teddy'];
  function nextSheepId() { F.sheepSeq = (F.sheepSeq || 0) + 1; return F.sheepSeq; }
  function pickSheepName() { const used = new Set(sheep.map(s => s.name)); const free = SHEEP_NAMES.filter(n => !used.has(n)); const pool = free.length ? free : SHEEP_NAMES; return pool[(Math.random() * pool.length) | 0]; }
  function makeSheep(o = {}) {
    return {
      x: o.x != null ? o.x : rand(paddock.x + 40, paddock.x + paddock.w - 40), y: o.y != null ? o.y : rand(paddock.y + 40, paddock.y + paddock.h - 60),
      breed: o.breed || 'normal', role: o.role || 'ewe', tx: 0, ty: 0, moveT: 0,
      hunger: o.hunger != null ? o.hunger : rand(10, 30), thirst: o.thirst != null ? o.thirst : rand(10, 30),
      wool: o.wool != null ? o.wool : rand(0, 25), size: o.role === 'lamb' ? 0.4 : (o.size != null ? o.size : 0.85),
      age: o.role === 'lamb' ? 0 : 999, health: 100, starve: 0, baaT: 0, heartT: 0, face: rand(0, 6), breedCD: rand(2200, 3800),
      sick: !!o.sick, sickT: 0, stuckT: 0, ax: 0, ay: 0, facing: -1,
      id: o.id != null ? o.id : nextSheepId(), name: o.name || pickSheepName(), born: o.born || nowMs(),
    };
  }
  function makeDog(kind) { return { kind, x: rand(paddock.x + 60, paddock.x + paddock.w - 60), y: rand(paddock.y + 40, paddock.y + paddock.h - 40), tx: 0, ty: 0, moveT: 0, zoom: 0, facing: 1, orbit: rand(0, 6), _fx: null }; }
  function makeWorker(job, level, xp) { return { job, level: level || 1, xp: xp || 0, x: house.x + rand(0, 40), y: house.y + rand(40, 60), tx: 0, ty: 0, moveT: 0, cd: 0, facing: 1, step: 0 }; }
  function rebuildWorkers() { workers.length = 0; for (const w of (F.workers || [])) workers.push(makeWorker(w.job, w.level, w.xp)); }
  function bunkCount() { return F.buildings.filter(b => b.bkind === 'bunk').length; }
  function workerCap() { return 3 + (F.farmLevel - 1) + (F.house.level - 1) + bunkCount() * 2; }
  function initGrass() { grass.length = 0; const n = Math.min(220, Math.round(40 * worldMul())); for (let i = 0; i < n; i++) grass.push({ x: rand(paddock.x + 20, paddock.x + paddock.w - 20), y: rand(paddock.y + 20, paddock.y + paddock.h - 24), amt: rand(0.35, 0.9) }); }
  function initMotes() { motes.length = 0; for (let i = 0; i < 16; i++) motes.push({ x: rand(paddock.x + 40, paddock.x + paddock.w - 40), y: rand(paddock.y + 20, paddock.y + paddock.h - 20), ph: rand(0, 6), vx: rand(-0.14, 0.14), vy: rand(-0.12, -0.03) }); }
  function fieldClampX(fx, y) { const b = fieldBounds(y); return clamp(paddock.x + paddock.w * fx, b.left + 10, b.right - 10); }
  function initPlants() {
    F.plants = [];
    const place = (type, fx, fy, extra) => { const y = paddock.y + paddock.h * fy; F.plants.push(Object.assign({ type, x: fieldClampX(fx, y), y }, extra)); };
    place('tree', 0.16, 0.16, { sz: rand(0.9, 1.1), wood: 100 });
    place('tree', 0.84, 0.14, { sz: rand(0.9, 1.1), wood: 100 });
    place('bush', 0.5, 0.32, { sz: 1, amt: 1 });
    place('rock', 0.72, 0.22, { sz: 1, stone: 100 });
    place('rock', 0.3, 0.2, { sz: 0.9, stone: 100 });
  }
  function makeTractor() { return { x: paddock.x + 50, y: paddock.y + 50, tx: 0, ty: 0, facing: 1, zoom: 0, load: 0, mode: 'toDam', herdT: 0 }; }
  function rebuildDogs() { dogs.length = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) dogs.push(makeDog(DOGS[k].kind)); }
  function dogBonus() { let b = 0; for (const k of Object.keys(DOGS)) if (F.dogs[k]) b += DOGS[k].bonus; return b; }
  function houseWoolBonus() { return (F.house.level - 1) * 0.06; }
  function houseIncome() { return (F.house.level - 1) * 0.006; }
  function eraName() { return ERAS[Math.min(F.farmLevel - 1, ERAS.length - 1)]; }
  function shearValue(s) { return Math.max(1, Math.round((5 + s.size * 4 + s.health / 30) * BREEDS[s.breed].mult * techWoolMult())); }

  // ---------- pens / gates ----------
  const OPP = { 0: 1, 1: 0, 2: 3, 3: 2 };
  function gateSides(p) { return [p.gateSide]; }   // ONE swinging gate — no midpoint post to snag on
  function gateWidth(p) { const side = (p.gateSide === 2 || p.gateSide === 3) ? p.h : p.w; return clamp(Math.min(110, side * 0.7), 58, Math.max(30, side - 6)); }   // nice wide, easy-flow gate
  function gateCenterFor(p, side) { switch (side) { case 1: return { x: p.x + p.w / 2, y: p.y }; case 2: return { x: p.x, y: p.y + p.h / 2 }; case 3: return { x: p.x + p.w, y: p.y + p.h / 2 }; default: return { x: p.x + p.w / 2, y: p.y + p.h }; } }
  function gateCenter(p) { return gateCenterFor(p, p.gateSide); }
  function gateSideDir(side) { return side === 0 ? { x: 0, y: 1 } : side === 1 ? { x: 0, y: -1 } : side === 2 ? { x: -1, y: 0 } : { x: 1, y: 0 }; }   // outward normal
  function gateApproach(p, side) { const g = gateCenterFor(p, side), d = gateSideDir(side); return { x: g.x + d.x * 36, y: g.y + d.y * 36 }; }
  function gateCornersFor(p, side) { const m = 20; if (side === 0) return [{ x: p.x - m, y: p.y + p.h + m }, { x: p.x + p.w + m, y: p.y + p.h + m }]; if (side === 1) return [{ x: p.x - m, y: p.y - m }, { x: p.x + p.w + m, y: p.y - m }]; if (side === 2) return [{ x: p.x - m, y: p.y - m }, { x: p.x - m, y: p.y + p.h + m }]; return [{ x: p.x + p.w + m, y: p.y - m }, { x: p.x + p.w + m, y: p.y + p.h + m }]; }
  // waypoint that draws an outside sheep to the nearest open gate: aim for the gate mouth once you're on
  // its side, otherwise for the approach point just outside it (so the flock slides around to the opening)
  function herdWaypoint(p, x, y) {
    let best = null, bestD = 1e9;
    for (const side of gateSides(p)) {
      const g = gateCenterFor(p, side), d = gateSideDir(side), rel = (x - g.x) * d.x + (y - g.y) * d.y;
      const w = rel > -6 ? g : gateApproach(p, side);
      const dd = dist(x, y, w.x, w.y) + (rel > -6 ? 0 : 24);
      if (dd < bestD) { bestD = dd; best = w; }
    }
    return best || gateCenter(p);
  }
  function penWalls(p) {
    const g = gateWidth(p) / 2, x0 = p.x, y0 = p.y, x1 = p.x + p.w, y1 = p.y + p.h, cx = p.x + p.w / 2, cy = p.y + p.h / 2, w = [];
    const open = p.gateOpen ? gateSides(p) : [];
    const edge = (side, ax, ay, bx, by, along) => { if (open.indexOf(side) >= 0) { if (along === 'x') { w.push([ax, ay, cx - g, ay]); w.push([cx + g, by, bx, by]); } else { w.push([ax, ay, ax, cy - g]); w.push([bx, cy + g, bx, by]); } } else { w.push([ax, ay, bx, by]); } };
    edge(1, x0, y0, x1, y0, 'x'); edge(0, x0, y1, x1, y1, 'x'); edge(2, x0, y0, x0, y1, 'y'); edge(3, x1, y0, x1, y1, 'y'); return w;
  }
  // the clear corridor through an open gate — no wall-repel here so sheep flow straight through
  function inGateZone(p, x, y) {
    if (!p.gateOpen) return false;
    const hw = gateWidth(p) / 2 + 16;   // generous clear funnel through the opening — sheep flow straight out
    for (const side of gateSides(p)) { const gc = gateCenterFor(p, side); if (side === 0 || side === 1) { if (Math.abs(x - gc.x) < hw && Math.abs(y - gc.y) < 48) return true; } else { if (Math.abs(y - gc.y) < hw && Math.abs(x - gc.x) < 48) return true; } }
    return false;
  }
  function repelFromPens(e, buffer, stoneOnly) {
    if (!F.pens) return;
    for (const p of F.pens) {
      if (stoneOnly && !p.stone) continue;
      if (inGateZone(p, e.x, e.y)) continue;
      const gates = p.gateOpen ? gateSides(p).map(side => gateCenterFor(p, side)) : null;
      const gclear = gateWidth(p) / 2 + 14;
      for (const seg of penWalls(p)) {
        const c = closestOnSeg(e.x, e.y, seg[0], seg[1], seg[2], seg[3]);
        if (gates) { let post = false; for (const gc of gates) if (Math.abs(c.x - gc.x) < gclear && Math.abs(c.y - gc.y) < gclear) { post = true; break; } if (post) continue; }   // never repel off the gate posts — that's what snagged sheep
        const d = dist(e.x, e.y, c.x, c.y);
        if (d < buffer && d > 0.001) { const push = buffer - d; e.x += (e.x - c.x) / d * push; e.y += (e.y - c.y) / d * push; }
      }
    }
  }
  const penInside = (p, x, y) => x > p.x - 4 && x < p.x + p.w + 4 && y > p.y - 4 && y < p.y + p.h + 4;
  const penInsideStrict = (p, x, y) => x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
  function insideAnyPen(x, y) { for (const p of F.pens) if (penInsideStrict(p, x, y)) return p; return null; }
  // a sheep tucked inside a stone pen is safe: a closed gate is total protection; an open one
  // only lets a predator that has actually walked inside reach it
  function predShielded(s, fx) { for (const p of F.pens) { if (!p.stone || !penInside(p, s.x, s.y)) continue; if (!p.gateOpen) return true; if (!penInsideStrict(p, fx.x, fx.y)) return true; } return false; }
  function penCorners(p) { return [{ k: 'nw', x: p.x, y: p.y }, { k: 'ne', x: p.x + p.w, y: p.y }, { k: 'sw', x: p.x, y: p.y + p.h }, { k: 'se', x: p.x + p.w, y: p.y + p.h }]; }
  const penTick = (p) => ({ x: p.x + p.w / 2 - 48, y: p.y - 22 });
  const penStoneBtn = (p) => ({ x: p.x + p.w / 2 - 16, y: p.y - 22 });
  const penDoubleBtn = (p) => ({ x: p.x + p.w / 2 + 16, y: p.y - 22 });
  const penScrap = (p) => ({ x: p.x + p.w / 2 + 48, y: p.y - 22 });
  const inBuilding = (b, x, y) => x > b.x && x < b.x + b.w && y > b.y - 14 && y < b.y + b.h;
  function buildingAt(x, y) { for (let i = F.buildings.length - 1; i >= 0; i--) if (inBuilding(F.buildings[i], x, y)) return F.buildings[i]; return null; }
  const bScrapBtn = (b) => ({ x: b.x + b.w, y: b.y - 8 });
  function scrapBuilding(b) { const i = F.buildings.indexOf(b); if (i < 0) return; const bd = BUILD[b.bkind]; F.buildings.splice(i, 1); selectedBuilding = null; F.money += Math.round(bd.coin * 0.5); F.wood += Math.round(bd.wood * 0.5); F.stone += Math.round((bd.stone || 0) * 0.5); toast('🗑️ ' + bd.name + ' scrapped (refund)'); pop(b.x + b.w / 2, b.y, '🗑️', '#ff8a3d'); sfx.pop(); persist(); updateHud(); }
  function flockCentroid() { if (!sheep.length) return { x: paddock.x + paddock.w / 2, y: paddock.y + paddock.h / 2 }; let cx = 0, cy = 0; for (const s of sheep) { cx += s.x; cy += s.y; } return { x: cx / sheep.length, y: cy / sheep.length }; }
  function nearestOpenPen() { const c = flockCentroid(); let best = null, bd = 1e9; for (const p of F.pens) { if (!p.gateOpen) continue; const g = gateCenter(p); const d = dist(c.x, c.y, g.x, g.y); if (d < bd) { bd = d; best = p; } } return best; }

  // ---------- persistence ----------
  function slotRaw(slot) { try { return localStorage.getItem(saveKey(slot)); } catch (e) { return null; } }
  function slotSummary(slot) { try { const r = slotRaw(slot); if (!r) return null; const d = JSON.parse(r); return { money: Math.floor(d.money || 0), sheep: (d.sheep || []).length, era: d.farmLevel || 1 }; } catch (e) { return null; } }
  function migrateLegacy() { try { curSlot = parseInt(localStorage.getItem(SLOT_KEY) || '0', 10) || 0; const legacy = localStorage.getItem(SAVE_KEY); if (legacy && !localStorage.getItem(saveKey(0))) localStorage.setItem(saveKey(0), legacy); } catch (e) {} }
  function load() { try { const r = slotRaw(); if (!r) return defaultSave(); return Object.assign(defaultSave(), JSON.parse(r)); } catch (e) { return defaultSave(); } }
  function persist() { if (!F) return; F.lastTime = nowMs(); F.sheep = sheep.map(s => ({ breed: s.breed, role: s.role, wool: s.wool, hunger: s.hunger, thirst: s.thirst, size: s.size, age: s.age, sick: s.sick, id: s.id, name: s.name, born: s.born })); try { localStorage.setItem(saveKey(), JSON.stringify(F)); } catch (e) {} }
  function restartFarm() { try { localStorage.removeItem(saveKey()); } catch (e) {} F = null; running = false; shearSession = null; showSlotPicker(); }

  // ---------- difficulty / mode picker ----------
  function showModeSelect(which) {
    modeSelectMode = which || 'new';
    const g = (id) => document.getElementById(id);
    const scr = g('modeScreen'); if (!scr) { pendingDiff = pendingDiff || 'grazier'; startGame(); return; }
    const list = g('modeList');
    if (list) {
      list.innerHTML = '';
      const cur = F && F.diff;
      for (const k of DIFF_ORDER) {
        const d = DIFFS[k], isCur = modeSelectMode === 'change' && cur === k;
        const card = document.createElement('button');
        card.className = 'mode-card' + (isCur ? ' cur' : '');
        card.style.setProperty('--tint', d.tint);
        card.innerHTML =
          '<span class="mode-emoji">' + d.emoji + '</span>' +
          '<span class="mode-main"><span class="mode-top"><span class="mode-name">' + d.name + '</span>' +
          '<span class="mode-age">' + d.age + '</span></span>' +
          '<span class="mode-blurb">' + d.blurb + '</span></span>' +
          (isCur ? '<span class="mode-flag">✓ Now</span>' : '<span class="mode-go">▶</span>');
        card.onclick = () => chooseMode(k);
        list.appendChild(card);
      }
    }
    const title = g('modeTitle'); if (title) title.textContent = modeSelectMode === 'change' ? '🎚️ Change Difficulty' : '🐑 Pick your farm';
    const sub = g('modeSub'); if (sub) sub.textContent = modeSelectMode === 'change'
      ? 'Switch this farm’s challenge any time — your sheep, money & buildings all stay.'
      : 'How tough should the farm be? Younger farmers pick the top ones. You can change this later in ⚙ Menu.';
    const back = g('modeBack'); if (back) back.classList.toggle('hidden', modeSelectMode !== 'change');
    for (const id of ['startScreen', 'slotScreen', 'menuScreen']) { const o = g(id); if (o) o.classList.add('hidden'); }
    scr.classList.remove('hidden');
  }
  function chooseMode(k) {
    const scr = document.getElementById('modeScreen'); if (scr) scr.classList.add('hidden');
    if (modeSelectMode === 'change') applyDiffChange(k);
    else { pendingDiff = k; startGame(); }
  }
  function applyDiffChange(k) {
    if (!F || !DIFFS[k]) return;
    F.diff = k; preds.length = 0; const d = DIFFS[k];
    F.sheepCap = Math.max(F.sheepCap, d.startCap);
    toast(d.emoji + ' Difficulty set to ' + d.name); flashAlert(d.emoji + ' ' + d.name + '!', d.tint, true); sfx.up();
    persist(); updateHud();
  }

  let pendingDiff = null, modeSelectMode = 'new';
  function startGame() {
    const fresh = !slotRaw();
    if (fresh && !pendingDiff) { showModeSelect('new'); return; }   // brand-new farm → pick a difficulty first
    F = load(); layout(); ensureAudio();
    if (fresh) { F.diff = pendingDiff || 'grazier'; applyDiffStart(F); }
    if (!F.diff) F.diff = 'grazier';   // legacy saves = the classic balance
    pendingDiff = null;
    if (typeof F.energy !== 'number') F.energy = F.power === 'electric' ? 3 : F.power === 'economical' ? 1 : 0;
    if (typeof F.wood !== 'number') F.wood = 25; if (typeof F.stone !== 'number') F.stone = 0;
    if (!F.workers) F.workers = []; if (!F.buildings) F.buildings = []; if (!F.tech) F.tech = {};
    if (typeof F.dayT !== 'number') F.dayT = 0; if (F.won == null) F.won = false;
    if (typeof F.seasonT !== 'number') F.seasonT = 0; if (!F.weather) F.weather = 'clear'; if (typeof F.weatherT !== 'number') F.weatherT = 900;
    if (typeof F.shearGear !== 'number') F.shearGear = 1; if (!F.records) F.records = { woolCrop: 0 }; if (!F.records.bestShear) F.records.bestShear = {};
    if (!F.troughs) { F.troughs = defaultTroughs(); layout(); }
    if (!F.house) F.house = { level: 1 };
    if (!F.pens) F.pens = [];
    if (!F.plants) initPlants();
    if (!F.plants.some(p => p.type === 'rock')) { const ry = paddock.y + paddock.h * 0.22; F.plants.push({ type: 'rock', x: fieldClampX(0.72, ry), y: ry, sz: 1, stone: 100 }); }
    for (const pl of F.plants) { if (pl.type === 'tree' && pl.wood == null) pl.wood = 100; if (pl.type === 'rock' && pl.stone == null) pl.stone = 100; }
    for (const t of [F.troughs.feed, F.troughs.water]) { const b = fieldBounds(t.y); t.x = clamp(t.x, b.left, b.right); t.y = clamp(t.y, paddock.y + 26, paddock.y + paddock.h - 20); }
    for (const p of F.pens) { if (!p._init) { p.x = paddock.x + paddock.w / 2 - p.w / 2; p.y = paddock.y + paddock.h * 0.5 - p.h / 2; p._init = true; } if (p.gateSide == null) p.gateSide = 0; if (p.stone == null) p.stone = false; }
    sheep.length = 0; for (const sd of (F.sheep || [])) sheep.push(makeSheep(sd));
    while (sheep.length < 3) sheep.push(makeSheep({ role: rollRole() }));
    rebuildDogs(); rebuildWorkers(); initGrass(); initMotes();
    tractor = F.upgrades && F.upgrades.tractor ? makeTractor() : null;
    if (typeof F.expand !== 'number') F.expand = 0;
    if (typeof F.shedHands !== 'number') F.shedHands = 0;
    if (typeof F.feedMax !== 'number') F.feedMax = 100; if (typeof F.waterMax !== 'number') F.waterMax = 100;
    if (!F.extraTroughs) F.extraTroughs = []; if (!F.dams) F.dams = []; if (typeof F.trailer !== 'boolean') F.trailer = false;
    applyOffline(); running = true; hideOverlays(); updateHud(); syncMute();
    zoom = 1; layout(); centerCamOn(paddock.x + paddock.w / 2, paddock.y + paddock.h / 2); camReady = true;   // start looking at the middle of the farm
    if (!F.tutorialDone) startTutorial();
  }
  function applyOffline() {
    const el = clamp((nowMs() - (F.lastTime || nowMs())) / 1000, 0, 8 * 3600); if (el < 30) return;
    const fed = F.feed > 5, watered = F.water > 5, rate = 0.22 * (fed ? 1 : 0.4) * (watered ? 1 : 0.6) * (1 + dogBonus() + houseWoolBonus());
    let grew = 0; for (const s of sheep) { if (s.role === 'lamb') continue; const add = Math.min(rate * el, 100 - s.wool); s.wool += add; grew += add; }
    F.feed = clamp(F.feed - el * 0.03, 0, F.feedMax); F.water = clamp(F.water - el * 0.03, 0, F.waterMax); F.money += houseIncome() * el * 0.6;
    if (grew > 5) setTimeout(() => toast('🧺 Your flock grew wool while you were away!'), 400);
  }

  // ---------- input ----------
  function pt(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); const sx = t.clientX - r.left, sy = t.clientY - r.top; return { x: cam.x + (sx - viewRect.x) / zoom, y: cam.y + (sy - viewRect.y) / zoom }; }
  function nearGate(p, x, y) { for (const side of gateSides(p)) { const g = gateCenterFor(p, side); if (dist(x, y, g.x, g.y) < gateWidth(p) / 2 + 8) return true; } return false; }
  function wallMidHit(p, x, y) { const mids = [{ s: 0, x: p.x + p.w / 2, y: p.y + p.h }, { s: 1, x: p.x + p.w / 2, y: p.y }, { s: 2, x: p.x, y: p.y + p.h / 2 }, { s: 3, x: p.x + p.w, y: p.y + p.h / 2 }]; for (const m of mids) if (dist(x, y, m.x, m.y) < 20) return m.s; return -1; }

  function onDown(e) {
    if (!running) return; e.preventDefault && e.preventDefault();
    // two-finger pinch → zoom
    if (e.touches && e.touches.length >= 2) { pinch = pinchState(e); panDrag = null; drag = null; return; }
    const raw = ptRaw(e);
    // tap the minimap to jump the camera there
    if (miniRect && raw.x >= miniRect.x && raw.x <= miniRect.x + miniRect.w && raw.y >= miniRect.y && raw.y <= miniRect.y + miniRect.h) {
      const wx = paddock.x + (raw.x - miniRect.x) / miniRect.w * paddock.w, wy = paddock.y + (raw.y - miniRect.y) / miniRect.h * paddock.h;
      centerCamOn(wx, wy); sfx.pop(); return;
    }
    const p = pt(e);
    if (placing) { const wasB = !!placing.bkind; placing = null; if (wasB) { toast('🏗️ Built!'); sfx.build(); } else { selectedPen = F.pens[F.pens.length - 1]; toast('Pen dropped — resize corners · 🧱 stone · ✓ / ✕'); sfx.pop(); } persist(); return; }

    // rescue a sheep stuck in a dam (tap it)
    for (const s of sheep) if (s.stuck && dist(p.x, p.y, s.x, s.y) < 36) { rescueSheep(s); return; }
    // dams: tap the ➕ badge to enlarge (two-tap confirm), or DRAG the dam body to move it
    for (const d of F.dams) {
      const up = damUpBtn(d);
      if (dist(p.x, p.y, up.x, up.y) < 15) { if (d.size >= 4) { toast('🏞️ That dam is already huge!'); } else if (armedDam === d) { armedDam = null; upgradeDam(d); } else { armedDam = d; toast('🏞️ Tap ➕ again to enlarge ($' + damSizeCost(d) + ')'); sfx.pop(); } return; }
      if (dist(p.x, p.y, d.x, d.y) < damR(d)) { armedDam = null; drag = { type: 'dam', ref: d, ox: p.x - d.x, oy: p.y - d.y }; toast('🏞️ Drag the dam to move it · ➕ to enlarge'); return; }
    }
    armedDam = null;

    for (const s of sheep) if (s.wool >= SHEAR_MIN && s.role !== 'lamb' && dist(p.x, p.y, s.x, s.y - 6) < 30) {
      if (insideAnyPen(s.x, s.y)) { const list = sheep.filter(x => x.wool >= SHEAR_MIN && x.role !== 'lamb' && insideAnyPen(x.x, x.y)); startShearSession(list); }
      else { toast('🚧 Herd them into a pen to shear!'); flashAlert('🚧 Pen them, or hire a Shepherd ✂️', '#ffb03a'); sfx.err(); }
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

    for (const t of [feedTrough, waterTrough].concat(F.extraTroughs || [])) { const s = dscale(t.y); if (dist(p.x, p.y, t.x, t.y) < 24 * s) { drag = { type: 'trough', ref: t, ox: p.x - t.x, oy: p.y - t.y }; return; } }
    const bh = buildingAt(p.x, p.y); if (bh) { selectedBuilding = bh; selectedPen = null; toast('Drag to move · ✕ to scrap'); sfx.pop(); return; }
    for (const pen of F.pens) if (penInside(pen, p.x, p.y)) { selectedPen = pen; selectedBuilding = null; toast('Editing pen — resize corners · 🧱 stone · ✓ keep · ✕ scrap'); sfx.pop(); return; }

    selectedBuilding = null;
    // empty ground → begin a pan-or-tap: drag pans the map, a clean tap sends the dogs there
    panDrag = { sx: raw.x, sy: raw.y, camx: cam.x, camy: cam.y, wx: p.x, wy: p.y, moved: false };
  }
  function pinchState(e) { const a = e.touches[0], b = e.touches[1], r = canvas.getBoundingClientRect(); const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); const mx = (a.clientX + b.clientX) / 2 - r.left, my = (a.clientY + b.clientY) / 2 - r.top; return { d0: d, z0: zoom, mx, my }; }
  function syncWorkerJobs() { F.workers = workers.map(w => ({ job: w.job, level: w.level || 1, xp: w.xp || 0 })); }
  function onMove(e) {
    if (pinch && e.touches && e.touches.length >= 2) { const a = e.touches[0], b = e.touches[1]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); setZoom(pinch.z0 * (d / pinch.d0), pinch.mx, pinch.my); return; }
    if (panDrag) { const raw = ptRaw(e); const dx = raw.x - panDrag.sx, dy = raw.y - panDrag.sy; if (!panDrag.moved && Math.hypot(dx, dy) > 6) panDrag.moved = true; if (panDrag.moved) { cam.x = panDrag.camx - dx / zoom; cam.y = panDrag.camy - dy / zoom; clampCam(); } return; }
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
    } else if (drag.type === 'dam') { const d = drag.ref, r = damR(d); const y = clamp(p.y - drag.oy, paddock.y + r + 6, paddock.y + paddock.h - r - 6); const b = fieldBounds(y); d.x = clamp(p.x - drag.ox, b.left + r, b.right - r); d.y = y; }
    else { const t = drag.ref; t.y = clamp(p.y - drag.oy, paddock.y + 26, paddock.y + paddock.h - 20); const b = fieldBounds(t.y); t.x = clamp(p.x - drag.ox, b.left, b.right); }
  }
  function onUp() {
    if (drag) { persist(); drag = null; }
    if (pinch) pinch = null;
    if (panDrag) { if (!panDrag.moved) { herdGoal = null; herdTo(panDrag.wx, panDrag.wy); } panDrag = null; }
  }
  function ptRaw(e) { const t = e.touches ? e.touches[0] : e; const r = canvas.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
  canvas.addEventListener('touchstart', (e) => { if (shearSession) { e.preventDefault(); shearDown(ptRaw(e)); return; } onDown(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (shearSession) { e.preventDefault(); shearMove(ptRaw(e)); return; } if (placing || drag || panDrag || pinch) e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { if (shearSession) { shearUp(); return; } onUp(e); });
  canvas.addEventListener('mousedown', (e) => { if (shearSession) { shearDown(ptRaw(e)); return; } onDown(e); });
  window.addEventListener('mousemove', (e) => { if (shearSession) { shearMove(ptRaw(e)); return; } if (placing || drag || panDrag) onMove(e); });
  window.addEventListener('mouseup', () => { if (shearSession) { shearUp(); return; } onUp(); });
  canvas.addEventListener('wheel', (e) => { if (!running || shearSession) return; e.preventDefault(); const r = canvas.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

  function herdTo(x, y) { x = clamp(x, paddock.x + 16, paddock.x + paddock.w - 16); y = clamp(y, paddock.y + 16, paddock.y + paddock.h - 16); for (const d of dogs) { d.tx = x + rand(-18, 18); d.ty = y + rand(-14, 14); d.moveT = 90; d.zoom = 1; } if (tractor) { tractor.tx = x; tractor.ty = y; tractor.zoom = 1; tractor.herdT = 90; } pop(x, y, '🐾', '#fff'); }
  function woofaGather() {
    if (!F.pens || !F.pens.length) { toast('🚧 Build a pen first, then press 🐾 Woofa!'); flashAlert('🚧 Build a pen first!', '#ffb03a'); sfx.err(); return; }
    // nearest pen to the flock — Woofa OPENS its gate and drives them straight in
    const c = flockCentroid(); let pen = null, bd = 1e9;
    for (const p of F.pens) { const g = gateCenter(p); const d = dist(c.x, c.y, g.x, g.y); if (d < bd) { bd = d; pen = p; } }
    pen.gateOpen = true;
    herdGoal = { pen, t: 1600 };   // stays herding for a good long while (~27s), clears once they're all in
    for (const s of sheep) s._penned = penInsideStrict(pen, s.x, s.y);
    for (const d of dogs) { d.zoom = 1; }
    toast('🐾 Woofa\'s rounding them up!'); flashAlert('🐾 Herding into the pen!', '#58e08a');
    const g = gateCenter(pen); pop(g.x, g.y, '🐾', '#58e08a', true); sfx.woof();
  }
  function shearSheep(s) { const val = shearValue(s); F.wool += val; s.wool = 0; s.baaT = 40; s.heartT = 30; spawnFluff(s.x, s.y); pop(s.x, s.y - 14, '+' + val + ' 🧺', '#fff5c8'); sfx.shear(); toast('✂️ +' + val + ' wool' + (s.breed !== 'normal' ? ' (' + BREEDS[s.breed].name + '!)' : '')); persist(); updateHud(); }
  function scrapPen(p) { const i = F.pens.indexOf(p); if (i < 0) return; F.pens.splice(i, 1); if (herdGoal && herdGoal.pen === p) herdGoal = null; selectedPen = null; F.money += 40; if (p.stone) F.stone += 12; toast('🗑️ Pen scrapped (+$40)'); pop(p.x + p.w / 2, p.y, '🗑️', '#ff8a3d'); sfx.pop(); persist(); updateHud(); }
  function upgradePenStone(p) { const c = stonePenCost(); if (F.stone < c) { toast('Need 🪨' + c + ' stone to build stone walls'); sfx.err(); return; } F.stone -= c; p.stone = true; toast('🧱 Stone walls up! Predators can\'t get in (close the gate).'); confetti(p.x + p.w / 2, p.y, ['🧱', '🛡️']); sfx.build(); persist(); updateHud(); }

  // a night pack raid led by an Alpha wolf (tough, needs walls + dogs)
  function maybePackRaid() {
    if (F._nofox || !curDiff().wolves || sheep.length === 0 || F.farmLevel < 3 || preds.some(p => p.alpha)) return;
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
    if (nowNight && !wasNight) { if (curDiff().wolves) { flashAlert('🌙 Night falls — watch for wolves!', '#7a8fff', true); toast('🌙 Night falls...'); } else { flashAlert('🌙 Goodnight, farm 🐑', '#7a8fff', true); toast('🌙 Night falls — your dogs keep watch.'); } maybePackRaid(); }
    else if (!nowNight && wasNight) { toast('☀️ A new day dawns!'); }
    wasNight = nowNight;

    // seasons + weather
    F.seasonT = (F.seasonT || 0) + dt; const season = seasonIx();
    F.weatherT -= dt;
    if (F.weatherT <= 0) { F.weatherT = rand(1400, 3000); const nw = pickWeather(season); if (nw !== F.weather) { F.weather = nw; if (nw === 'rain') { flashAlert('🌧️ Rain — free water!', '#5aa0ff'); } else if (nw === 'snow') { flashAlert('❄️ Snowfall — grass is buried, keep them fed!', '#cdd6dd', true); } else if (nw === 'drought') { flashAlert('🏜️ Drought — water runs dry faster!', '#e0a03a'); } } }
    if (F.weather === 'rain') F.water = clamp(F.water + 0.06 * dt, 0, F.waterMax * 0.96);
    else if (F.weather === 'drought') F.water = clamp(F.water - 0.01 * dt, 0, F.waterMax);
    const seasonNeed = (season === 1 ? 1.15 : season === 3 ? 1.15 : 1);   // summer thirst / winter hunger both bite

    const e = F.energy;
    if (e === 1) { F.water = clamp(F.water + 0.05 * dt, 0, F.waterMax * 0.62); }
    else if (e === 2) { F.water = clamp(F.water + 0.09 * dt, 0, F.waterMax * 0.78); F.feed = clamp(F.feed + 0.06 * dt, 0, F.feedMax * 0.6); }
    else if (e === 3) { if (F.money > 0) { F.feed = clamp(F.feed + 0.18 * dt, 0, F.feedMax); F.water = clamp(F.water + 0.18 * dt, 0, F.waterMax); F.money = Math.max(0, F.money - 0.06 * dt); } }
    if (F.house.level > 1) F.money += houseIncome() * dt;

    for (const b of F.buildings) {
      if (b.bkind === 'market') { b.cd = (b.cd || 0) - dt; if (b.cd <= 0 && F.wool >= 1) { const amt = Math.min(F.wool, 4); F.wool -= amt; const got = Math.floor(amt * woolPrice()); F.money += got; b.cd = 105; pop(b.x, b.y - 14, '+$' + got, '#ffd23d'); } }
      else if (b.bkind === 'tower') { for (const fx of preds) if (!fx.dead && !fx.wolf && dist(b.x, b.y, fx.x, fx.y) < 140) fx.fleeing = true; }
      else if (b.bkind === 'well') { F.water = clamp(F.water + 0.05 * dt, 0, F.waterMax * 0.92); }
      else if (b.bkind === 'haybarn') { F.feed = clamp(F.feed + 0.04 * dt, 0, F.feedMax * 0.88); }
    }

    if (herdGoal) {
      herdGoal.t -= dt;
      if (herdGoal.t <= 0 || F.pens.indexOf(herdGoal.pen) < 0) herdGoal = null;
      else if (!herdGoal.announced) { const grown = sheep.filter(s => s.role !== 'lamb'); if (grown.length && grown.every(s => penInsideStrict(herdGoal.pen, s.x, s.y))) { herdGoal.announced = true; toast('🐑 All penned! Tap a fluffy ✂️ sheep to shear.'); flashAlert('🐑 All in — tap one to shear!', '#58e08a'); } }
    }
    const needM = techNeedMult() * curDiff().needMul;

    const winter = season === 3, summer = season === 1, snowing = F.weather === 'snow';
    const vetOn = hasBuilding('vet'), sickChanceMul = (T('vaccine') ? 0.2 : 1);
    // spatial hash → O(n) flock separation instead of O(n²); keeps hundreds of sheep smooth
    const SEPC = 26, sgrid = new Map();
    for (const gs of sheep) { const k = Math.floor(gs.x / SEPC) + ',' + Math.floor(gs.y / SEPC); let a = sgrid.get(k); if (!a) { a = []; sgrid.set(k, a); } a.push(gs); }
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
        const rate = 0.0118 * (s.sick ? 0.15 : 1) * (fed ? 1 : 0.3) * (watered ? 1 : 0.45) * (0.5 + s.health / 200) * (1 + dogBonus() + houseWoolBonus());
        s.wool = clamp(s.wool + rate * dt, 0, 100);
        if (fed && s.size < 1) s.size = clamp(s.size + 0.00012 * dt, 0.85, 1);
      } else { s.age += dt; if (s.age > 900) { s.role = rollRole(); s.size = 0.85; toast('🐑 A lamb grew up!'); pop(s.x, s.y, '🐑', '#fff'); } }
      if (s.baaT > 0) s.baaT -= dt; if (s.heartT > 0) s.heartT -= dt; s.breedCD -= dt;

      // stuck in a dam — pin it, drain condition, and struggle free after a while (unless rescued)
      if (s.stuck) {
        const d = F.dams[s.stuckDam];
        if (!d) { s.stuck = false; }
        else {
          s.x = d.x + Math.sin(tick / 9 + s.face) * 3; s.y = d.y + Math.cos(tick / 11 + s.face) * 3;
          s.stuckT2 = (s.stuckT2 || 0) + dt; s.health = clamp(s.health - 0.012 * dt, 0, 100); s.baaT = 30;
          if (Math.random() < 0.04 * dt) splash(s.x + rand(-6, 6), s.y);
          if (s.stuckT2 > 1500) { s.stuck = false; const b = fieldBounds(d.y + damR(d) + 22); s.x = clamp(d.x, b.left, b.right); s.y = clamp(d.y + damR(d) + 22, paddock.y + 24, paddock.y + paddock.h - 24); s.wool = clamp(s.wool - 18, 0, 100); pop(s.x, s.y - 14, '😮‍💨 free!', '#8fe08a'); }
          continue;
        }
      } else if (F.dams.length && s.role !== 'lamb') {
        for (const d of F.dams) if (dist(s.x, s.y, d.x, d.y) < damR(d) * 0.72) { if (Math.random() < 0.0026 * dt * (curDiff().foxKill ? 1 : 0.45)) { s.stuck = true; s.stuckDam = F.dams.indexOf(d); s.stuckT2 = 0; flashAlert('🆘 ' + s.name + ' is stuck in the dam!', '#ff6a6a', true); toast('🆘 ' + s.name + ' is stuck in the dam — tap to rescue!'); sfx.err(); } break; }
      }
      s.moveT -= dt; let foxFlee = false;
      for (const fx of preds) if (!fx.dead && dist(s.x, s.y, fx.x, fx.y) < (fx.wolf ? 96 : 84)) { const a = Math.atan2(s.y - fx.y, s.x - fx.x); s.tx = s.x + Math.cos(a) * 140; s.ty = s.y + Math.sin(a) * 140; s.moveT = 20; foxFlee = true; }
      if (tractor && dist(s.x, s.y, tractor.x, tractor.y) < 78) { const a = Math.atan2(s.y - tractor.y, s.x - tractor.x); s.tx = s.x + Math.cos(a) * 120; s.ty = s.y + Math.sin(a) * 120; s.moveT = 24; foxFlee = true; }
      // dogs only scatter/nudge the flock when NOT actively herding into a pen (so Woofa's escort doesn't cancel the lure)
      let dogNudge = false;
      if (!herdGoal) for (const d of dogs) if (dist(s.x, s.y, d.x, d.y) < 50) { const a = Math.atan2(s.y - d.y, s.x - d.x); s.tx = s.x + Math.cos(a) * 62; s.ty = s.y + Math.sin(a) * 62; s.moveT = Math.max(s.moveT, 12); dogNudge = true; }
      const fleeing = foxFlee || dogNudge;

      let toPen = false;
      if (herdGoal && !foxFlee) {   // Woofa is walking them in — route around to the gate, then settle inside
        const pn = herdGoal.pen; toPen = true;
        if (penInsideStrict(pn, s.x, s.y)) { const d = gateSideDir(pn.gateSide); s.tx = pn.x + pn.w / 2 - d.x * pn.w * 0.3 + rand(-pn.w * 0.18, pn.w * 0.18); s.ty = pn.y + pn.h / 2 - d.y * pn.h * 0.3 + rand(-pn.h * 0.18, pn.h * 0.18); }   // pack toward the back, away from the gate
        else { const wp = herdWaypoint(pn, s.x, s.y); s.tx = wp.x; s.ty = wp.y; }
        s.moveT = Math.max(s.moveT, 16);
      }
      if (!fleeing && !toPen && s.hunger > 42 && F.feed > 0) { const t = nearestTrough('feed', s.x, s.y); s.tx = t.x + rand(-12, 12); s.ty = t.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && !toPen && s.thirst > 42 && F.water > 0) { const t = nearestTrough('water', s.x, s.y); s.tx = t.x + rand(-12, 12); s.ty = t.y - 10; s.moveT = Math.max(s.moveT, 18); }
      else if (!fleeing && !toPen && s.moveT <= 0) { s.tx = rand(paddock.x + 30, paddock.x + paddock.w - 30); s.ty = rand(paddock.y + 30, paddock.y + paddock.h - 40); s.moveT = rand(60, 150); }

      // keep sheep from ramming a fence: if the target is across a pen wall, route to the OPEN gate, or if the gate's SHUT stay on your own side
      for (const pen of F.pens) {
        const inNow = penInsideStrict(pen, s.x, s.y), inTgt = penInsideStrict(pen, s.tx, s.ty);
        if (inNow === inTgt) continue;
        if (pen.gateOpen) { let best = null, bd = 1e9; for (const side of gateSides(pen)) { const g = gateCenterFor(pen, side); const dd = dist(s.x, s.y, g.x, g.y); if (dd < bd) { bd = dd; best = g; } } if (best) { s.tx = best.x; s.ty = best.y; } }
        else if (inNow) { s.tx = clamp(s.tx, pen.x + 12, pen.x + pen.w - 12); s.ty = clamp(s.ty, pen.y + 12, pen.y + pen.h - 12); s.moveT = Math.max(s.moveT, 24); }   // penned, gate shut → wander INSIDE, don't headbutt the fence
        else { const cx = pen.x + pen.w / 2, cy = pen.y + pen.h / 2, ang = Math.atan2(s.y - cy, s.x - cx); s.tx = cx + Math.cos(ang) * (pen.w / 2 + 46); s.ty = cy + Math.sin(ang) * (pen.h / 2 + 46); }   // outside → don't push into a shut pen
      }

      const spd = foxFlee ? 2.4 : toPen ? 2.0 : dogNudge ? 1.9 : (s.role === 'lamb' ? 0.9 : 0.6);
      const a = Math.atan2(s.ty - s.y, s.tx - s.x);
      if (dist(s.x, s.y, s.tx, s.ty) > 4) { s.y = clamp(s.y + Math.sin(a) * spd * dt, paddock.y + 24, paddock.y + paddock.h - 24); const b = fieldBounds(s.y); s.x = clamp(s.x + Math.cos(a) * spd * dt, b.left, b.right); if (Math.abs(Math.cos(a)) > 0.12) s.facing = Math.cos(a) >= 0 ? 1 : -1; }

      const sc = dscale(s.y), sep = (toPen ? 10 : 15) * sc, pf = toPen ? 0.18 : 0.5;   // pack tight & gentle while herding so newcomers aren't shoved back out
      const cgx = Math.floor(s.x / SEPC), cgy = Math.floor(s.y / SEPC); let sdx = 0, sdy = 0;
      for (let gx = cgx - 1; gx <= cgx + 1; gx++) for (let gy = cgy - 1; gy <= cgy + 1; gy++) { const arr = sgrid.get(gx + ',' + gy); if (!arr) continue; for (const o of arr) { if (o === s) continue; const dd = dist(s.x, s.y, o.x, o.y); if (dd < sep && dd > 0.01) { const push = (sep - dd) * pf; const ang = Math.atan2(s.y - o.y, s.x - o.x); sdx += Math.cos(ang) * push; sdy += Math.sin(ang) * push; } } }
      { const smag = Math.hypot(sdx, sdy); if (smag > 3.5) { sdx = sdx / smag * 3.5; sdy = sdy / smag * 3.5; } s.x += sdx; s.y += sdy; }   // cap the shove so crowding can't fling a sheep through a fence
      repelFromPens(s, toPen ? 7 : 12);   // gentler walls while herding so sheep slide around to the gate
      { const b = fieldBounds(s.y); s.x = clamp(s.x, b.left, b.right); s.y = clamp(s.y, paddock.y + 24, paddock.y + paddock.h - 24); }
      // sticky pen while Woofa is herding: the moment a sheep reaches the gate mouth it's captured and stays in,
      // so the flock accumulates instead of oscillating at the opening
      if (herdGoal) { const pn = herdGoal.pen; if (penInside(pn, s.x, s.y) || inGateZone(pn, s.x, s.y)) s._penned = true; if (s._penned && F.pens.indexOf(pn) >= 0) { s.x = clamp(s.x, pn.x + 7, pn.x + pn.w - 7); s.y = clamp(s.y, pn.y + 7, pn.y + pn.h - 7); } } else if (s._penned) s._penned = false;
      // a shut pen firmly contains its flock — no clipping out through a wall, even when crowded (open the gate to let them out)
      for (const p of F.pens) if (!p.gateOpen && penInside(p, s.x, s.y)) { s.x = clamp(s.x, p.x + 6, p.x + p.w - 6); s.y = clamp(s.y, p.y + 6, p.y + p.h - 6); }
      // anti-jam: if a sheep barely moves for a moment while trying to, shove it straight through the nearest open gate
      if (dist(s.x, s.y, s.ax, s.ay) < 1.2) s.stuckT += dt; else { s.stuckT = 0; s.ax = s.x; s.ay = s.y; }
      if (s.stuckT > 20 && dist(s.x, s.y, s.tx, s.ty) > 8) {   // trying to move but jammed (not just grazing/drinking)
        let g = null, gd = 1e9;
        for (const p of F.pens) if (p.gateOpen) { const gc = gateCenter(p); const d = dist(s.x, s.y, gc.x, gc.y); if (d < 90 && d < gd) { gd = d; g = gc; } }
        if (g) { const a = Math.atan2(g.y - s.y, g.x - s.x); s.x += Math.cos(a) * 9; s.y += Math.sin(a) * 9; const b = fieldBounds(s.y); s.x = clamp(s.x, b.left, b.right); s.y = clamp(s.y, paddock.y + 24, paddock.y + paddock.h - 24); s.stuckT = 0; s.ax = s.x; s.ay = s.y; }   // nudge toward/through the gate (kept in-bounds)
        else {   // no open gate to reach — break the jam: retarget to open space (into the pen interior if penned) and give a small shove
          let cpen = null; for (const p of F.pens) if (penInsideStrict(p, s.x, s.y)) { cpen = p; break; }
          if (cpen) { s.tx = cpen.x + cpen.w / 2 + rand(-cpen.w * 0.25, cpen.w * 0.25); s.ty = cpen.y + cpen.h / 2 + rand(-cpen.h * 0.25, cpen.h * 0.25); }
          else { s.tx = s.x + rand(-55, 55); s.ty = s.y + rand(-45, 45); }
          const a = Math.atan2(s.ty - s.y, s.tx - s.x); s.x += Math.cos(a) * 6; s.y += Math.sin(a) * 6;
          s.moveT = rand(50, 110); s.stuckT = 0; s.ax = s.x; s.ay = s.y;
        }
      }

      { const ft = nearestTrough('feed', s.x, s.y); if (F.feed > 0 && s.hunger > 8 && dist(s.x, s.y, ft.x, ft.y) < 40) { s.hunger = clamp(s.hunger - 0.32 * dt, 0, 100); F.feed = clamp(F.feed - 0.05 * dt, 0, F.feedMax); if (s.hunger < 20 && s.heartT <= 0) s.heartT = 24; } }
      { const wt = nearestTrough('water', s.x, s.y); if (F.water > 0 && s.thirst > 8 && dist(s.x, s.y, wt.x, wt.y) < 40) { s.thirst = clamp(s.thirst - 0.32 * dt, 0, 100); F.water = clamp(F.water - 0.045 * dt, 0, F.waterMax); if (s.thirst < 20 && s.heartT <= 0) s.heartT = 24; if (Math.random() < 0.025 * dt) splash(wt.x + rand(-8, 8), wt.y - 3); } }
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
      breedTimer = rand(4400, 7000) / curDiff().breed;   // calmer breeding — flock grows steadily, not silly-fast
      const rams = sheep.filter(s => s.role === 'ram' && s.health > 60), ewes = sheep.filter(s => s.role === 'ewe' && s.health > 60 && s.breedCD <= 0);
      if (rams.length && ewes.length && sheep.length < F.sheepCap) { const mum = ewes[(Math.random() * ewes.length) | 0]; mum.breedCD = rand(5000, 7600); const lamb = makeSheep({ x: mum.x + rand(-10, 10), y: mum.y + 14, breed: mum.breed, role: 'lamb' }); sheep.push(lamb); toast('💕 ' + mum.name + ' had a lamb — ' + lamb.name + '!'); pop(lamb.x, lamb.y - 14, lamb.name, '#ffd23d'); confetti(mum.x, mum.y - 10, ['💕', '🐑', '✨']); sfx.up(); persist(); updateHud(); }
    }

    predTimer -= dt;
    const dcfg = curDiff();
    if (predTimer <= 0 && sheep.length > 0 && preds.length < 4 && !F._nofox && dcfg.foxRate > 0) {
      predTimer = rand(2600, 4400) / dcfg.foxRate / (1 + (F.farmLevel - 1) * 0.3) / (1 + night * 0.9);   // raids come faster at night / on tougher farms
      const wolfChance = dcfg.wolves ? ((F.farmLevel >= 2 ? 0.22 + (F.farmLevel - 2) * 0.06 : 0) + night * 0.35) : 0;   // wolves only prowl Wolf Country
      const spawn = (left, wolf) => preds.push({ x: left ? paddock.x + 6 : paddock.x + paddock.w - 6, y: rand(paddock.y + 20, paddock.y + paddock.h - 20), fleeing: false, dead: false, facing: 1, wolf: !!wolf });
      const left = Math.random() < 0.5;
      if (Math.random() < wolfChance) { spawn(left, true); flashAlert('🐺 WOLF!', '#c94a3a', true); toast('🐺 A wolf is on the prowl!'); sfx.wolf(); if (Math.random() < 0.3 && preds.length < 4) spawn(!left, true); }
      else if (dcfg.foxKill) { spawn(left, false); flashAlert('🦊 FOX!', '#ff6a3a'); sfx.fox(); if (Math.random() < 0.13 + (F.farmLevel - 1) * 0.03 && preds.length < 4) { spawn(!left, false); flashAlert('🦊🦊 DOUBLE FOX RAID!', '#ff4d4d', true); } }
      else { spawn(left, false); flashAlert('🦊 A fox! Woofa’s on it 🐕', '#ff9a3a'); sfx.fox(); }
    } else if (predTimer <= 0 && dcfg.foxRate <= 0) { predTimer = 3000; }
    const dogRange = techDogRange() * (curDiff().guardian ? 1.8 : 1);   // guardian farms: dogs spot & fling foxes from way off
    for (let i = preds.length - 1; i >= 0; i--) {
      const fx = preds[i];
      if (fx.dead) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 0.12 * dt; fx.spin += 0.35 * dt; fx.tumble += dt; if (fx.x < -60 || fx.x > W + 60 || fx.y > H + 80 || fx.tumble > 130) preds.splice(i, 1); continue; }
      let chased = false; for (const d of dogs) if (dist(d.x, d.y, fx.x, fx.y) < (fx.wolf ? 80 : 95) * dogRange) chased = true;
      if (chased && !fx.alpha) fx.fleeing = true;
      let tx, ty;
      if (fx.stun > 0) { fx.stun -= dt; tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x + 20 : paddock.x + paddock.w - 20; ty = fx.y; }   // alpha recovering from a hit
      else if (fx.fleeing) { tx = fx.x < paddock.x + paddock.w / 2 ? paddock.x - 40 : paddock.x + paddock.w + 40; ty = fx.y; }
      else { let best = null, bd = 1e9; for (const s of sheep) { const dd = dist(fx.x, fx.y, s.x, s.y); if (dd < bd) { bd = dd; best = s; } } if (best) { tx = best.x; ty = best.y; if (bd < 16 && !predShielded(best, fx)) { if (curDiff().foxKill) { const idx = sheep.indexOf(best); if (idx >= 0) { sheep.splice(idx, 1); toast((fx.alpha ? '🐺 The ALPHA' : fx.wolf ? '🐺 A wolf' : '🦊 A fox') + ' took a sheep! Guard them!'); pop(best.x, best.y, '💔', '#ff6a6a'); sfx.err(); persist(); updateHud(); } } else { const a2 = Math.atan2(best.y - fx.y, best.x - fx.x); best.tx = best.x + Math.cos(a2) * 90; best.ty = best.y + Math.sin(a2) * 90; best.moveT = 22; best.baaT = 20; pop(best.x, best.y - 8, '💨', '#dfefff'); sfx.baa(); } if (fx.alpha) fx.stun = 30; else fx.fleeing = true; } } else { if (!fx.alpha) fx.fleeing = true; tx = fx.x; ty = fx.y; } }
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
    if (tractor) updateTractor(dt);
    // dams slowly refill (faster in the rain)
    for (const d of F.dams) d.water = clamp(d.water + (F.weather === 'rain' ? 0.22 : 0.05) * dt, 0, damCap(d.size));

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
        let tgt = null, bd = 1e9; for (const s of sheep) if (s.role !== 'lamb' && s.wool >= 80) { const d = dist(w.x, w.y, s.x, s.y); if (d < bd) { bd = d; tgt = s; } }   // auto-shear ready sheep (fire the Shepherd to grade them yourself in the shed)
        if (tgt) { w.tx = tgt.x; w.ty = tgt.y + 4; if (bd < 15 && w.cd <= 0) { const val = shearValue(tgt); F.wool += val; tgt.wool = 0; tgt.baaT = 40; tgt.heartT = 24; spawnFluff(tgt.x, tgt.y); pop(tgt.x, tgt.y - 12, '+' + val + '🧺', '#fff5c8'); sfx.shear(); w.cd = 45 * cdMul; gainXp(w); updateHud(); } }
        else idleNear(w, house.x + 30, house.y + 40);
      } else if (w.job === 'haul') {
        const feedLow = F.feed <= F.water; const t = feedLow ? feedTrough : waterTrough; const lvl = feedLow ? F.feed : F.water;
        if (lvl < (feedLow ? F.feedMax : F.waterMax) * 0.82) { w.tx = t.x; w.ty = t.y - 6; if (dist(w.x, w.y, t.x, t.y) < 20 && w.cd <= 0) { const cost = feedLow ? 2 : 1; if (F.money >= cost) { F.money -= cost; if (feedLow) F.feed = clamp(F.feed + 7, 0, F.feedMax); else F.water = clamp(F.water + 8, 0, F.waterMax); w.cd = 34 * cdMul; pop(t.x, t.y - 14, feedLow ? '🌾' : '💧', '#fff'); gainXp(w); updateHud(); } else { w.cd = 60; } } }
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

  // ---------- shearing minigame ----------
  function shearGearInfo() { const lv = F.shearGear || 1; return { lv, clipR: 24 + (lv - 1) * 9, woolMult: 1 + (lv - 1) * 0.06, name: ['Hand Shears', 'Spring Shears', 'Powered Clippers', 'Pro Clippers', 'Golden Clippers'][lv - 1] || 'Shears' }; }
  // ===== The Shearing Shed — a full side-game: CATCH → SHEAR → GRADE, with a BOSS finale =====
  const SHEAR_MIN = 50;   // penned sheep are shear-able from 50% wool — grade rewards ~80%
  const SHEAR_DENSITY = { normal: 1, merino: 1.35, golden: 1.05, black: 2.0 };   // black wool is DENSE → ~2× the shearing time
  const SHEAR_PAR = { normal: 5, merino: 7, golden: 5, black: 10 };              // "gun-shearer" times to beat (seconds)
  const BREED_LABEL = { normal: 'White', merino: 'Merino', golden: 'Golden', black: 'Black' };
  const BREED_ICON = { normal: '🐑', merino: '🐏', golden: '⭐', black: '🖤' };
  function woolGrade(pct) {
    const p = clamp(pct, 0, 100);
    if (p >= 74 && p <= 86) return { key: 'premium', label: 'PREMIUM', stars: '★★★', mult: 1.8, col: '#ffd23d' };
    if (p >= 66 && p <= 92) return { key: 'good', label: 'GOOD', stars: '★★', mult: 1.3, col: '#8fe08a' };
    if (p > 92) return { key: 'store', label: 'OVERGROWN', stars: '★', mult: 0.85, col: '#e0a848' };   // too much wool → downgraded
    if (p >= 55) return { key: 'store', label: 'A BIT SHORT', stars: '★', mult: 0.95, col: '#cbd3e0' };
    return { key: 'oddments', label: 'ODDMENTS', stars: '·', mult: 0.6, col: '#c98a6a' };
  }
  function startShearSession(list) {
    if (!list || !list.length || shearSession) return;
    shearSession = {
      queue: list.slice(), idx: 0, clip: { x: -999, y: -999, down: false, lx: 0, ly: 0 },
      t: 0, phase: 'intro', introT: 0, gradeT: 0, flashT: 0, cutT: 0,
      totalWool: 0, earned: 0, record: false, grades: [], combo: 0, bestCombo: 0,
      tally: { premium: 0, good: 0, store: 0, oddments: 0 }, bossDone: false, trophy: false,
      cx: W / 2, cy: H * 0.54, rx: 168, ry: 118, breed: 'normal', tufts: [], total: 0, gone: 0, boss: false,
      handHands: F.shedHands || 0, handTail: list.length, handWork: 0, handSheared: 0,
    };
    fluff.length = 0; pops.length = 0; herdGoal = null;
    syncShearUI(true); sfx.pop();
  }
  function beginCatch(boss) {
    const s = shearSession;
    const sh = boss
      ? { breed: (Math.random() < 0.4 ? 'black' : 'normal'), role: 'ram', wool: 100, size: 1.3, health: 100, name: 'THE WOOLLY BEAST', boss: true }
      : s.queue[s.idx];
    const heavy = clamp((sh.wool || 0) / 100, 0, 1);
    s.phase = 'catch';
    s.catch = {
      sh, boss: !!boss, x: rand(W * 0.3, W * 0.7), y: rand(H * 0.44, H * 0.6),
      vx: (Math.random() < 0.5 ? -1 : 1) * (boss ? 6 : 5 - heavy * 2),
      vy: (Math.random() < 0.5 ? -1 : 1) * (boss ? 3.6 : 3.2 - heavy * 1.3),
      hitR: boss ? 66 : 46, ring: 0, caught: false, dodges: 0, t: 0, pct: Math.round(sh.wool || 0), clean: false,
    };
    if (boss) { flashAlert('🐏 THE WOOLLY BEAST appears — catch it!', '#ff5a5a', true); sfx.wolf(); }
  }
  function buildShearSheep(sh, boss) {
    const s = shearSession;
    s.rx = Math.min(W * (boss ? 0.44 : 0.34), boss ? 232 : 168); s.ry = s.rx * 0.7;
    s.breed = sh.breed; s.boss = !!boss; s.tufts = [];
    const dens = boss ? 1.7 : (SHEAR_DENSITY[sh.breed] || 1);   // denser wool = more tufts = longer to shear
    const gap = (boss ? 15 : 17) / Math.sqrt(dens);
    for (let y = -s.ry; y <= s.ry; y += gap) for (let x = -s.rx; x <= s.rx; x += gap) { if ((x * x) / (s.rx * s.rx) + (y * y) / (s.ry * s.ry) <= 0.95) s.tufts.push({ x: s.cx + x + rand(-3, 3), y: s.cy + y + rand(-3, 3), r: gap * rand(0.66, 0.9), ph: rand(0, 6), gone: false }); }
    s.total = s.tufts.length; s.gone = 0; s.sheepT = 0; s.started = false; s.struggle = 0; s.freed = false;
    s.par = SHEAR_PAR[sh.breed] || 6; s.breedRec = (F.records.bestShear && F.records.bestShear[sh.breed]) || null;
    s.phase = 'shearing';   // ⏱️ clock starts now — the moment you've caught the sheep
  }
  function shearDown(p) {
    if (!shearSession) return; const s = shearSession;
    if (s.phase === 'intro') { const b = shearIntroButtons(); if (inRect(p, b.hire)) { hireShedHand(); return; } if (inRect(p, b.fire)) { fireShedHand(); return; } beginCatch(false); return; }
    if (s.phase === 'catch') { tryCatch(p.x, p.y); return; }
    if (s.phase === 'grade') { advanceAfterGrade(); return; }
    if (s.phase === 'summary') { s.phase = 'cutscene'; s.cutT = 0; return; }
    if (s.phase === 'cutscene') { endShearSession(); return; }
    s.clip.down = true; s.clip.x = p.x; s.clip.y = p.y; s.clip.lx = p.x; s.clip.ly = p.y;
  }
  function shearMove(p) { if (!shearSession) return; shearSession.clip.x = p.x; shearSession.clip.y = p.y; }
  function shearUp() { if (shearSession) shearSession.clip.down = false; }
  // shed hands: hired helpers who shear the queue from the BACK while you work the front
  function handShearOne() {
    const s = shearSession, sh = s.queue[s.handTail - 1]; if (!sh) { s.handTail--; s.handWork = 0; return; }
    const grade = woolGrade(sh.wool || 0);
    const got = Math.max(1, Math.round(shearValue(sh) * shearGearInfo().woolMult * (0.4 + 0.6 * clamp((sh.wool || 0) / 100, 0, 1)) * grade.mult * 0.85));
    s.totalWool += got; s.handSheared++; s.tally[grade.key] = (s.tally[grade.key] || 0) + 1;
    if (!sh.boss) { sh.wool = 0; sh.baaT = 30; }
    s.handTail--; s.handWork = 0;
    pop(W * 0.15, H * 0.72, '🧑‍🌾 +' + got + '🧺', '#8fe08a'); sfx.shear();
  }
  const SHED_HAND_COST = 220;
  function hireShedHand() {
    if ((F.shedHands || 0) >= 2) { toast('Max 2 shed hands'); sfx.err(); return; }
    if (F.money < SHED_HAND_COST) { toast('Need $' + SHED_HAND_COST + ' to hire a shed hand'); sfx.err(); return; }
    F.money -= SHED_HAND_COST; F.shedHands = (F.shedHands || 0) + 1; if (shearSession) shearSession.handHands = F.shedHands;
    toast('🧑‍🌾 Shed hand hired! They shear in the background.'); sfx.up(); persist();
  }
  function fireShedHand() {
    if ((F.shedHands || 0) <= 0) { toast('No shed hands to fire'); sfx.err(); return; }
    F.shedHands--; if (shearSession) shearSession.handHands = F.shedHands; F.money += 60;
    toast('👋 Shed hand let go (+$60)'); sfx.pop(); persist();
  }
  function shearIntroButtons() {
    const cy = H * 0.68;
    return {
      hire: { x: W / 2 - 168, y: cy, w: 158, h: 44 },
      fire: { x: W / 2 + 10, y: cy, w: 158, h: 44 },
      start: { x: W / 2 - 90, y: H * 0.8, w: 180, h: 50 },
    };
  }
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function tryCatch(px, py) {
    const s = shearSession, c = s.catch; if (!c || c.caught) return;
    if (Math.hypot(px - c.x, py - c.y) < c.hitR) {
      c.caught = true; c.clean = (c.ring < 0.3 || c.ring > 0.88);
      pop(c.x, c.y - 34, c.clean ? '⭐ PERFECT CATCH!' : '🤠 Caught!', c.clean ? '#ffd23d' : '#8fe08a', true);
      confetti(c.x, c.y, ['🤠', '💨', '⭐']); sfx.coin();
      buildShearSheep(c.sh, c.boss);
    } else { c.dodges++; c.vx = -c.vx; if (Math.random() < 0.5) c.vy = -c.vy; pop(px, py, 'dodge! 💨', '#cbd3e0'); sfx.pop(); }
  }
  function shearUpdate(dt) {
    const s = shearSession; if (!s) return; s.t += dt; if (s.flashT > 0) s.flashT -= dt;
    // shed hands auto-shear from the back of the queue while you work the front
    if (s.handHands > 0 && !s.boss && (s.phase === 'catch' || s.phase === 'shearing' || s.phase === 'grade')) {
      if (s.handTail - 1 > s.idx) { const sh = s.queue[s.handTail - 1], cost = (SHEAR_PAR[sh.breed] || 6) * 60; s.handWork += dt * s.handHands; if (s.handWork >= cost) handShearOne(); }
    }
    if (s.phase === 'intro') { s.introT += dt; /* wait for a tap so you can hire/fire hands first */ }
    else if (s.phase === 'catch') {
      const c = s.catch; c.t += dt; c.ring = (c.ring + dt * 0.035) % 1;
      const spd = 1 + c.dodges * 0.1;
      c.x += c.vx * spd * dt; c.y += c.vy * spd * dt;
      const L = W * 0.12, Rr = W * 0.88, T = H * 0.36, Bt = H * 0.72;
      if (c.x < L) { c.x = L; c.vx = Math.abs(c.vx); } if (c.x > Rr) { c.x = Rr; c.vx = -Math.abs(c.vx); }
      if (c.y < T) { c.y = T; c.vy = Math.abs(c.vy); } if (c.y > Bt) { c.y = Bt; c.vy = -Math.abs(c.vy); }
    } else if (s.phase === 'shearing') {
      const moved = Math.hypot(s.clip.x - s.clip.lx, s.clip.y - s.clip.ly); s.clip.lx = s.clip.x; s.clip.ly = s.clip.y;
      if (s.clip.down && moved > 0.5) {
        const r = shearGearInfo().clipR, r2 = r * r; let cut = 0;
        for (const w of s.tufts) { if (w.gone) continue; const dx = w.x - s.clip.x, dy = w.y - s.clip.y; if (dx * dx + dy * dy < r2) { w.gone = true; s.gone++; cut++; for (let k = 0; k < 2 && fluff.length < 260; k++) fluff.push({ x: w.x, y: w.y, vx: rand(-2, 2), vy: rand(-3, -0.5), life: 1, r: w.r * 0.5, c: BREEDS[s.breed].wool }); } }
        if (cut > 0 && !s.started) s.started = true;
        if (cut > 0) sfx.shear();
      }
      s.sheepT += dt / 60;   // clock runs from the moment the sheep is caught (dawdling costs time)
      if (s.boss && !s.freed) { s.struggle = clamp(s.struggle + dt / 1500, 0, 1); if (s.struggle >= 1) { bossBreaksFree(); return; } }
      if (s.gone >= s.total * 0.98) finishShearSheep();
    } else if (s.phase === 'grade') { s.gradeT += dt; if (s.gradeT > 165) advanceAfterGrade(); }
    else if (s.phase === 'cutscene') { s.cutT += dt; if (s.cutT > 150) endShearSession(); }
    for (let i = fluff.length - 1; i >= 0; i--) { const p = fluff[i]; p.vy += 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt; if (p.life <= 0) fluff.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.05 * dt; p.life -= 0.013 * dt; if (p.life <= 0) pops.splice(i, 1); }
  }
  function finishShearSheep() {
    const s = shearSession, sh = s.catch.sh, gear = shearGearInfo();
    const grade = woolGrade(s.catch.pct);
    const base = Math.max(1, Math.round(shearValue(sh) * gear.woolMult * (0.4 + 0.6 * clamp(s.catch.pct / 100, 0, 1))));
    const spd = s.sheepT, par = s.par || 6;
    const fast = spd <= par ? 1.4 : spd <= par * 1.6 ? 1.15 : 1.0, cleanBonus = s.catch.clean ? 1.12 : 1, bossMul = s.boss ? 3 : 1;
    const got = Math.max(1, Math.round(base * grade.mult * fast * cleanBonus * bossMul));
    s.totalWool += got;
    // ⏱️ per-breed BEST TIME (skip the boss) — the speed-run high score
    let newTimeRec = false;
    if (!s.boss) {
      if (!F.records.bestShear) F.records.bestShear = {};
      const prev = F.records.bestShear[s.breed];
      if (prev == null || spd < prev) { F.records.bestShear[s.breed] = Math.round(spd * 10) / 10; newTimeRec = true; }
    }
    s.lastTime = spd; s.lastPar = par; s.lastTimeRec = newTimeRec;
    if (!s.boss) { s.tally[grade.key]++; s.grades.push(grade.key); if (grade.key === 'premium') { s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo); } else s.combo = 0; }
    if (sh && !sh.boss) { sh.wool = 0; sh.baaT = 40; sh.heartT = 30; }
    s.lastGrade = s.boss ? { label: 'BEAST SHORN!', stars: '🏆', col: '#ffd23d' } : grade; s.lastGot = got; s.flashT = 90;
    s.phase = 'grade'; s.gradeT = 0;
    pop(s.cx, s.cy - s.ry - 26, (s.boss ? '🏆 BEAST! +' : grade.stars + ' +') + got + '🧺', s.boss ? '#ffd23d' : grade.col, true);
    sfx.coin();
    if (newTimeRec) { flashAlert('🏆 NEW BEST ' + (BREED_LABEL[s.breed] || '').toUpperCase() + ' TIME! ' + spd.toFixed(1) + 's', '#ffd23d', true); sfx.up(); confetti(s.cx, s.cy - s.ry, ['🏆', '⏱️', '⭐', '💛']); }
    else if (grade.key === 'premium' || s.boss) { confetti(s.cx, s.cy - s.ry, ['⭐', '🧺', '✨', '💛']); sfx.up(); }
    if (s.boss) { s.bossDone = true; s.trophy = true; }
    persist();
  }
  function bossBreaksFree() {
    const s = shearSession;
    const partial = Math.max(0, Math.round(s.gone / Math.max(1, s.total) * shearValue(s.catch.sh) * shearGearInfo().woolMult * 2));
    s.totalWool += partial; s.bossDone = true; s.trophy = false; s.freed = true;
    s.lastGrade = { label: 'BROKE FREE!', stars: '', col: '#ff6a6a' }; s.lastGot = partial; s.flashT = 90;
    flashAlert('🐏 The Beast broke free! 💨', '#ff6a6a', true); pop(s.cx, s.cy - s.ry - 20, '💨 +' + partial + '🧺', '#ff9a6a', true); sfx.err();
    s.phase = 'grade'; s.gradeT = 0;
  }
  function advanceAfterGrade() {
    const s = shearSession;
    if (s.boss) { finishSession(); return; }
    s.idx++;
    if (s.idx < s.handTail) beginCatch(false);                        // still sheep left for you (hands take the rest)
    else if (!s.bossDone && s.queue.length >= 3) beginCatch(true);    // finale BOSS after a decent muster
    else finishSession();
  }
  function finishSession() {
    const s = shearSession;
    s.earned = Math.floor(s.totalWool * woolPrice()); F.money += s.earned;
    if (!F.records) F.records = { woolCrop: 0 };
    s.record = s.totalWool > (F.records.woolCrop || 0); if (s.record) F.records.woolCrop = s.totalWool;
    s.phase = 'summary'; sfx.up(); persist(); updateHud();
  }
  function endShearSession() {
    const pens = new Set(); for (const sh of shearSession.queue) { const pn = insideAnyPen(sh.x, sh.y); if (pn) pens.add(pn); }
    for (const pn of pens) pn.gateOpen = true;   // "let them out to pasture" cutscene
    shearSession = null; fluff.length = 0; syncShearUI(false); toast('✂️ Good shearing! 🐑'); persist(); updateHud();
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
    const dayL = 1 - nightAmt();   // sky/sun/mountains/hills below are a fixed SCREEN backdrop (not zoomed)
    const sky = ctx.createLinearGradient(0, 0, 0, paddock.y + 20); sky.addColorStop(0, '#6fbdf5'); sky.addColorStop(0.55, '#a4d8fb'); sky.addColorStop(1, '#e9f6ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, paddock.y);
    if (dayL > 0.15) { const sx = W * 0.16, sy = paddock.y * 0.3, r = 16; ctx.save(); ctx.globalAlpha = dayL; const gl = ctx.createRadialGradient(sx, sy, 3, sx, sy, 70); gl.addColorStop(0, 'rgba(255,244,190,0.85)'); gl.addColorStop(1, 'rgba(255,244,190,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, 7); ctx.fill(); ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(sx - 4, sy - 4, r * 0.6, 0, 7); ctx.fill(); ctx.restore(); }
    // distant mountains — layered for depth
    ctx.fillStyle = '#aebfd0'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 22) ctx.lineTo(x, paddock.y - 30 - Math.abs(Math.sin(x * 0.017 + 1.3)) * 30 - Math.abs(Math.sin(x * 0.006)) * 12); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#93aabf'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 28) ctx.lineTo(x, paddock.y - 20 - Math.abs(Math.sin(x * 0.012 + 3)) * 22); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6fae5e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, paddock.y - 20 - Math.sin(x / 130) * 16); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5c9c4e'; ctx.beginPath(); ctx.moveTo(0, paddock.y); for (let x = 0; x <= W; x += 80) ctx.lineTo(x, paddock.y - 8 - Math.cos(x / 90) * 10); ctx.lineTo(W, paddock.y); ctx.closePath(); ctx.fill();
    drawClouds(dayL);

    ctx.save(); ctx.beginPath(); ctx.rect(viewRect.x, viewRect.y, viewRect.w, viewRect.h); ctx.clip(); ctx.translate(viewRect.x, viewRect.y); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);   // ← free-scroll camera, clipped to the field window
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
    // cull everything outside the camera window — only draw what's on-screen (huge win on big maps)
    const CULL = 90, vx0 = cam.x - CULL, vy0 = cam.y - CULL, vx1 = cam.x + visW() + CULL, vy1 = cam.y + visH() + CULL;
    const inView = (x, y) => x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;
    drawGrass(inView);
    for (const pl of F.plants) if (pl.type === 'bush' && inView(pl.x, pl.y)) drawBush(pl);
    for (const d of F.dams) if (inView(d.x, d.y)) drawDam(d);

    drawEnergy();
    drawTrough(feedTrough, '#d9b24a', F.feed / F.feedMax * 100, '🌾'); drawTrough(waterTrough, '#4cc9ff', F.water / F.waterMax * 100, '💧');
    for (const t of F.extraTroughs) drawTrough(t, t.kind === 'feed' ? '#d9b24a' : '#4cc9ff', (t.kind === 'feed' ? F.feed / F.feedMax : F.water / F.waterMax) * 100, t.kind === 'feed' ? '🌾' : '💧');
    drawTank();
    drawShed(shed);
    for (const p of F.pens) drawPen(p, p === selectedPen);
    if (placing) { ctx.globalAlpha = 0.5; if (placing.bkind) drawBuilding(placing); else drawPen(placing, false); ctx.globalAlpha = 1; }

    const actors = [];
    if (inView(house.x, house.y)) actors.push({ y: house.y + 30, d: () => drawHouse(house) });
    for (const b of F.buildings) if (inView(b.x, b.y)) actors.push({ y: b.y + b.h, d: () => drawBuilding(b, b === selectedBuilding) });
    for (const s of sheep) if (inView(s.x, s.y)) actors.push({ y: s.y, d: () => drawSheep(s) });
    for (const fx of preds) if (fx.dead) actors.push({ y: -9999, d: () => drawPredator(fx) }); else if (inView(fx.x, fx.y)) actors.push({ y: fx.y, d: () => drawPredator(fx) });
    for (const d of dogs) if (inView(d.x, d.y)) actors.push({ y: d.y, d: () => drawDog(d) });
    for (const w of workers) if (inView(w.x, w.y)) actors.push({ y: w.y, d: () => drawWorker(w) });
    for (const pl of F.plants) if (inView(pl.x, pl.y)) { if (pl.type === 'tree') actors.push({ y: pl.y, d: () => drawTree(pl) }); else if (pl.type === 'rock') actors.push({ y: pl.y, d: () => drawRock(pl) }); }
    if (tractor && inView(tractor.x, tractor.y)) actors.push({ y: tractor.y, d: () => drawTractor(tractor) });
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
    const mw = 120, mh = 78, mx = W - mw - 10, my = paddock.y - mh - 6;
    if (my < 4) { miniRect = null; return; }
    miniRect = { x: mx, y: my, w: mw, h: mh };
    ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgba(11,18,32,0.72)'; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.stroke();
    ctx.fillStyle = '#2f6a34'; ctx.fillRect(mx, my, mw, mh);
    const sx = (x) => mx + (x - paddock.x) / paddock.w * mw, sy = (y) => my + (y - paddock.y) / paddock.h * mh;
    for (const pl of F.plants) { if (pl.type === 'tree') { ctx.fillStyle = '#2f8f3a'; ctx.fillRect(sx(pl.x) - 1, sy(pl.y) - 1, 2, 2); } else if (pl.type === 'rock') { ctx.fillStyle = '#9498a0'; ctx.fillRect(sx(pl.x) - 1, sy(pl.y) - 1, 2, 2); } }
    for (const d of F.dams) { ctx.fillStyle = '#4cc9ff'; ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), 2.4, 0, 7); ctx.fill(); }
    for (const p of F.pens) { ctx.strokeStyle = p.stone ? '#c8ccd0' : '#caa06a'; ctx.lineWidth = 1; ctx.strokeRect(sx(p.x), sy(p.y), p.w / paddock.w * mw, p.h / paddock.h * mh); }
    ctx.fillStyle = '#8a6a3a'; for (const b of F.buildings) ctx.fillRect(sx(b.x), sy(b.y), 3, 3);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(sx(house.x), sy(house.y + 20), 4, 4);
    ctx.fillStyle = '#f4f3ee'; for (const s of sheep) { ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), 1.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3a6ea5'; for (const w of workers) { ctx.beginPath(); ctx.arc(sx(w.x), sy(w.y), 1.3, 0, 7); ctx.fill(); }
    for (const fx of preds) { if (fx.dead) continue; ctx.fillStyle = fx.wolf ? '#c94a3a' : '#ff8a3d'; ctx.beginPath(); ctx.arc(sx(fx.x), sy(fx.y), 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1a1a1e'; for (const d of dogs) { ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), 1.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 1.4; ctx.strokeRect(sx(cam.x), sy(cam.y), visW() / paddock.w * mw, visH() / paddock.h * mh);   // viewport box
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
  function shade(hex, amt) { let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); let r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); const t = amt < 0 ? 0 : 255, p = Math.abs(amt) / 100; r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b; return '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join(''); }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawSwingGate(p) {
    const side = p.gateSide, gc = gateCenterFor(p, side), gw = gateWidth(p), horiz = (side === 0 || side === 1);
    let hinge, baseAng, outSign;
    if (side === 0) { hinge = { x: gc.x - gw / 2, y: gc.y }; baseAng = 0; outSign = 1; }
    else if (side === 1) { hinge = { x: gc.x - gw / 2, y: gc.y }; baseAng = 0; outSign = -1; }
    else if (side === 2) { hinge = { x: gc.x, y: gc.y - gw / 2 }; baseAng = Math.PI / 2; outSign = -1; }
    else { hinge = { x: gc.x, y: gc.y - gw / 2 }; baseAng = Math.PI / 2; outSign = 1; }
    const swing = p.gateOpen ? outSign * 1.15 : 0;   // swung wide open, or across the gap when shut
    ctx.save(); ctx.translate(hinge.x, hinge.y); ctx.rotate(baseAng + swing);
    ctx.strokeStyle = p.gateOpen ? '#6fce7a' : '#c86a3a'; ctx.lineWidth = p.stone ? 6 : 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(gw, 0); ctx.stroke();
    ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(gw * i / 4, -5); ctx.lineTo(gw * i / 4, 5); ctx.stroke(); }
    ctx.lineCap = 'butt'; ctx.restore();
    ctx.fillStyle = '#4a3620'; ctx.beginPath(); ctx.arc(hinge.x, hinge.y, 4, 0, 7); ctx.fill();   // hinge post
    ctx.fillStyle = p.gateOpen ? '#58e08a' : '#c86a3a'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(p.gateOpen ? 'open' : '🔒 shut', gc.x, gc.y + (side === 1 ? -10 : side === 0 ? 15 : 4));
  }
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
    drawSwingGate(p);
    if (p.stone) { ctx.fillStyle = 'rgba(200,205,210,0.9)'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🛡️ stone', p.x + 22, p.y + 12); }
    if (sel) {
      ctx.fillStyle = '#58e08a'; for (const c of penCorners(p)) { roundRect(c.x - 6, c.y - 6, 12, 12, 3); ctx.fill(); }
      const tk = penTick(p), scr = penScrap(p);
      ctx.fillStyle = '#2fbf6a'; ctx.beginPath(); ctx.arc(tk.x, tk.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✓', tk.x, tk.y + 6);
      ctx.fillStyle = '#d94a3a'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 16px system-ui'; ctx.fillText('✕', scr.x, scr.y + 5);
      if (!p.stone) { const st = penStoneBtn(p); ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(st.x, st.y, 15, 0, 7); ctx.fill(); ctx.font = '14px system-ui'; ctx.fillText('🧱', st.x, st.y + 5); }
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 10px system-ui'; ctx.fillText('▢ resize · 🧱 stone · move the gate: tap a wall', p.x + p.w / 2, p.y + p.h + 16);
    }
  }
  function drawDam(d) {
    const r = damR(d), fill = clamp(d.water / damCap(d.size), 0, 1);
    ctx.save(); ctx.translate(d.x, d.y);
    ctx.fillStyle = '#6a5236'; ctx.beginPath(); ctx.ellipse(0, 0, r + 8, r * 0.72 + 7, 0, 0, 7); ctx.fill();      // muddy bank
    ctx.fillStyle = '#4f3f26'; ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r * 0.72 + 2, 0, 0, 7); ctx.fill();
    const wr = r * (0.5 + 0.5 * fill);
    const g = ctx.createRadialGradient(0, -r * 0.15, wr * 0.2, 0, 0, wr); g.addColorStop(0, '#63cbf2'); g.addColorStop(1, '#2c7aac');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, wr, wr * 0.7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.4; for (let i = 0; i < 2; i++) { const rr = wr * (0.4 + i * 0.32) + Math.sin(tick / 22 + i) * 2; ctx.beginPath(); ctx.ellipse(Math.sin(tick / 30) * 4, 0, rr, rr * 0.6, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#eaf7ff'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🏞️ Dam ' + Math.round(d.water) + '/' + damCap(d.size), d.x, d.y - r * 0.7 - 6);
    // enlarge (➕) badge — tap twice to grow the dam; the dam body itself drags to move
    if (d.size < 4) { const up = damUpBtn(d); ctx.fillStyle = armedDam === d ? '#ffd23d' : '#2fbf6a'; ctx.beginPath(); ctx.arc(up.x, up.y, 12, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#0d2417'; ctx.font = '900 16px system-ui'; ctx.textBaseline = 'middle'; ctx.fillText('＋', up.x, up.y + 1); ctx.textBaseline = 'alphabetic'; }
    if (armedDam === d) { ctx.fillStyle = '#ffd23d'; ctx.font = '800 11px system-ui'; ctx.fillText('tap ➕ again → enlarge $' + damSizeCost(d), d.x, d.y + r * 0.7 + 16); }
  }
  function drawTank() {
    const x = waterTrough.x + 30, y = waterTrough.y - 30, sc = dscale(y), fill = clamp(F.water / F.waterMax, 0, 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); shadowLocal(0, 14, 13);
    ctx.fillStyle = '#9aa0a6'; roundRect(-12, -20, 24, 30, 4); ctx.fill();
    ctx.fillStyle = '#4cc9ff'; const h = 26 * fill; roundRect(-10, 8 - h, 20, h, 3); ctx.fill();
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.5; roundRect(-12, -20, 24, 30, 4); ctx.stroke();
    ctx.fillStyle = '#5a5f66'; roundRect(-14, -22, 28, 5, 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#cfe0ff'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🛢️' + Math.round(F.water), x, y - 24);
  }
  function drawTrough(t, col, level, ic) { const sc = dscale(t.y); ctx.save(); ctx.translate(t.x, t.y); ctx.scale(sc, sc); ctx.fillStyle = '#7a5a3a'; roundRect(-22, -8, 44, 16, 4); ctx.fill(); const surY = -6 + (12 - level / 100 * 12); ctx.fillStyle = col; roundRect(-19, surY, 38, level / 100 * 12, 3); ctx.fill(); if (level > 5) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff'; const shx = Math.sin(tick / 14 + t.x * 0.1) * 8; ctx.beginPath(); ctx.ellipse(shx, surY + 1.6, 7, 1.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; roundRect(-22, -8, 44, 16, 4); ctx.stroke(); ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ic, 0, -12); ctx.restore(); }
  function drawGrass(inView) { const snow = F.weather === 'snow'; for (const gr of grass) { if (inView && !inView(gr.x, gr.y)) continue; if (gr.amt < 0.12) { ctx.fillStyle = snow ? 'rgba(232,238,244,0.5)' : 'rgba(90,63,36,0.35)'; ctx.beginPath(); ctx.ellipse(gr.x, gr.y, 5, 2.5, 0, 0, 7); ctx.fill(); continue; } const sc = dscale(gr.y), n = 3 + Math.round(gr.amt * 3); ctx.strokeStyle = snow ? '#cfe0d6' : gr.amt > 0.5 ? '#6fd06a' : '#8fbf6a'; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round'; for (let i = 0; i < n; i++) { const bx = gr.x + (i - n / 2) * 2.4 * sc, sw = (Math.sin(tick / 30 + gr.x + i) + Math.sin(tick / 55 - gr.y * 0.02) * 1.3) * 1.3; ctx.beginPath(); ctx.moveTo(bx, gr.y); ctx.lineTo(bx + sw, gr.y - (5 + gr.amt * 5) * sc); ctx.stroke(); } } }
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
    const roleScale = isRam ? 1.18 : isLamb ? 0.6 : 0.98;
    const woolAmt = clamp(s.wool / 100, 0, 1);
    const sweet = s.wool >= 74 && s.wool <= 86;
    const R = (11.5 + woolAmt * 7) * (0.62 + s.size * 0.42) * roleScale;   // body radius grows with wool
    const bob = Math.sin(tick / 10 + s.face) * 1.1 + (s.baaT > 0 ? -1.6 : 0);
    const f = s.facing || -1;
    const dark = s.breed === 'black';
    const wool = s.health > 40 ? B.wool : '#cfc9bf';
    const woolShade = dark ? '#2a2630' : shade(wool, -18);
    shadow(s.x, s.y + R * 0.62, R * 1.06);
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(sc, sc); ctx.translate(0, bob);
    // legs (four, gently stepping)
    ctx.strokeStyle = dark ? '#241f28' : '#4a3d38'; ctx.lineWidth = 2.7; ctx.lineCap = 'round';
    const step = Math.sin(tick / 8 + s.face);
    for (let i = 0; i < 4; i++) { const lx = (-0.52 + i * 0.35) * R; const sw = Math.sin(tick / 8 + s.face + i * 1.6) * 0.8; ctx.beginPath(); ctx.moveTo(lx, R * 0.34); ctx.lineTo(lx + sw, R * 0.98); ctx.stroke(); }
    ctx.lineCap = 'butt';
    // rump/tail hint on the back (opposite the head)
    ctx.fillStyle = wool; ctx.beginPath(); ctx.arc(-f * R * 0.78, -R * 0.1, R * 0.36, 0, 7); ctx.fill();
    // fluffy wool body — a mound of overlapping puffs
    const puffs = s.breed === 'merino' ? 12 : dark ? 9 : 9;
    ctx.fillStyle = woolShade;
    for (let i = 0; i < puffs; i++) { const a = i / puffs * Math.PI * 2; const rr = R * (0.5 + 0.09 * Math.sin(i * 1.7 + s.face)); ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.5 + R * 0.05, rr * 0.66, 0, 7); ctx.fill(); }
    ctx.fillStyle = wool;
    for (let i = 0; i < puffs; i++) { const a = i / puffs * Math.PI * 2; const rr = R * (0.5 + 0.09 * Math.sin(i * 1.7 + s.face)); ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.46, rr * 0.62, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.82, 0, 0, 7); ctx.fill();
    // bottom shading + top-left sheen for volume
    ctx.globalAlpha = dark ? 0.3 : 0.12; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, R * 0.32, R * 0.9, R * 0.44, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalAlpha = dark ? 0.16 : 0.34; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-R * 0.28, -R * 0.36, R * 0.52, R * 0.38, -0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (s.breed === 'golden') { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-R * 0.25, -R * 0.3, R * 0.42, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // head (on the facing side)
    ctx.save(); ctx.translate(f * R * 0.86, -R * 0.12); ctx.scale(f, 1);
    if (isRam) { ctx.strokeStyle = '#dcb877'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(R * 0.12, R * 0.06, R * 0.26, -2.2, 1.2, false); ctx.stroke(); ctx.beginPath(); ctx.arc(-R * 0.02, R * 0.04, R * 0.2, -2.2, 1.0, false); ctx.stroke(); ctx.lineCap = 'butt'; }
    // ears
    ctx.fillStyle = dark ? '#241f28' : '#39312e'; ctx.beginPath(); ctx.ellipse(-R * 0.08, -R * 0.24, R * 0.17, R * 0.09, -0.7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(R * 0.16, -R * 0.2, R * 0.14, R * 0.08, 0.5, 0, 7); ctx.fill();
    // face
    const faceCol = dark ? '#211d26' : s.breed === 'golden' ? '#5a4a26' : '#39312e';
    ctx.fillStyle = faceCol; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.35, R * 0.44, 0, 0, 7); ctx.fill();
    // muzzle (lighter, toward the front)
    ctx.fillStyle = dark ? '#3a3540' : '#4b4048'; ctx.beginPath(); ctx.ellipse(-R * 0.18, R * 0.16, R * 0.17, R * 0.14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = dark ? '#151318' : '#241f24'; ctx.beginPath(); ctx.arc(-R * 0.3, R * 0.14, R * 0.045, 0, 7); ctx.fill();
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.04, R * 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#120f14'; ctx.beginPath(); ctx.arc(-R * 0.08, -R * 0.03, R * 0.055, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-R * 0.1, -R * 0.06, R * 0.02, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
    // overlays (screen-aligned)
    ctx.textAlign = 'center';
    if (s.breed === 'golden' && (tick | 0) % 46 < 3) { ctx.font = (11 * sc) + 'px system-ui'; ctx.fillText('✨', s.x + R * sc * 0.5, s.y - R * sc * 0.6); }
    if (s.stuck) { ctx.font = (18 * sc) + 'px system-ui'; ctx.fillText('🆘', s.x, s.y - R * sc - 14 + Math.sin(tick / 5) * 2); }   // stuck in a dam — tap to rescue
    else if (!isLamb && sweet) { ctx.font = (17 * sc) + 'px system-ui'; ctx.fillText('⭐', s.x, s.y - R * sc - 12 + Math.sin(tick / 6) * 2); }         // sweet spot ~80% → shear now for PREMIUM
    else if (!isLamb && s.wool > 92) { ctx.globalAlpha = 0.85; ctx.font = (14 * sc) + 'px system-ui'; ctx.fillText('✂️', s.x, s.y - R * sc - 12 + Math.sin(tick / 6) * 2); ctx.globalAlpha = 1; }   // overgrown → losing grade
    if (s.heartT > 0) { ctx.globalAlpha = clamp(s.heartT / 24, 0, 1); ctx.font = (13 * sc) + 'px system-ui'; ctx.fillText('💗', s.x + R * sc * 0.6, s.y + bob * sc - R * sc - 2); ctx.globalAlpha = 1; }
    if (s.baaT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '700 11px system-ui'; ctx.fillText('baa!', s.x + R * sc, s.y - R * sc); }
    if (s.sick) { ctx.font = (13 * sc) + 'px system-ui'; ctx.fillText('🤒', s.x, s.y - R * sc - 10); }
    else if (s.health < 40) { ctx.font = '13px system-ui'; ctx.fillText(s.hunger > s.thirst ? '🌾' : '💧', s.x, s.y - R * sc - 10); }
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
    else if (d.kind === 'cavoodle') {   // Winnie — fluffy light-brown miniature cavoodle (teddy-bear look)
      ctx.fillStyle = '#b07f4a'; for (const p of [[-9, 1, 5.5], [9, 1, 5.5]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); }   // floppy ears (darker)
      ctx.fillStyle = '#caa06a'; for (const p of [[-1, 0, 9], [-9, -1, 5.5], [9, -1, 5.5], [-2, -7, 6], [4, -6, 5.5]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); }   // curly body/head fluff
      ctx.fillStyle = '#d9b483'; for (const p of [[11, -3, 5], [0, -5, 4]]) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); }   // lighter muzzle/highlight
      ctx.fillStyle = '#2a1f16'; ctx.beginPath(); ctx.arc(15, -2, 1.6, 0, 7); ctx.fill();   // nose
      ctx.fillStyle = '#1a120c'; ctx.beginPath(); ctx.arc(11, -4, 1.2, 0, 7); ctx.fill();   // eye
      ctx.fillStyle = '#e7c99a'; ctx.beginPath(); ctx.arc(-11, -3, 3.5, 0, 7); ctx.fill();   // fluffy tail
    }
    else { ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(10, -3, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#d8dade'; ctx.beginPath(); ctx.ellipse(13, 1, 3.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -3, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawTractor(t) { const sc = dscale(t.y), f = t.facing || 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(f * sc, sc); shadowLocal(0, 12, 20);
    if (F.trailer) { ctx.fillStyle = '#9aa0a6'; roundRect(-43, -7, 23, 15, 4); ctx.fill(); const lf = clamp((t.load || 0) / TRAILER_CAP, 0, 1); ctx.fillStyle = '#4cc9ff'; roundRect(-42, 7 - 13 * lf, 21, 13 * lf, 3); ctx.fill(); ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.5; roundRect(-43, -7, 23, 15, 4); ctx.stroke(); ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-32, 9, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-15, 6); ctx.stroke(); }
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-9, 8, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.arc(-9, 8, 3.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(12, 10, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#3aa64a'; roundRect(-14, -6, 26, 14, 3); ctx.fill(); ctx.fillStyle = '#2f8a3c'; roundRect(-2, -18, 12, 14, 3); ctx.fill(); ctx.fillStyle = '#bfe6ff'; roundRect(0, -15, 8, 8, 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.fillRect(-13, -14, 3, 8); ctx.restore(); }

  // ---------- shearing minigame render ----------
  const SKIN = { normal: '#e6b6a2', merino: '#e9cbb0', golden: '#e8c98a', black: '#4a4650' };
  function shearRender() {
    const s = shearSession;
    drawShedScene(s);
    if (s.phase === 'intro') { drawShearIntro(s); return; }
    if (s.phase === 'catch') { drawCatch(s); drawShearHud(s); drawShedFluffPops(); return; }
    // shearing / grade / summary / cutscene — sheep on the board
    drawShornBody(s);
    for (const w of s.tufts) { if (w.gone) continue; const wob = Math.sin(s.t / 14 + w.ph) * 0.8; ctx.fillStyle = shade(BREEDS[s.breed].wool, -14); ctx.beginPath(); ctx.arc(w.x, w.y + wob + 1.5, w.r, 0, 7); ctx.fill(); ctx.fillStyle = BREEDS[s.breed].wool; ctx.beginPath(); ctx.arc(w.x, w.y + wob, w.r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(w.x - w.r * 0.3, w.y - w.r * 0.3 + wob, w.r * 0.4, 0, 7); ctx.fill(); }
    drawShedFluffPops();
    if (s.phase === 'shearing' && s.clip.x > -100) drawClipper(s.clip);
    if (s.boss && (s.phase === 'shearing')) drawStruggleBar(s);
    drawShearHud(s);
    if (s.phase === 'grade') drawGradeFlash(s);
    if (s.phase === 'summary') drawShearSummary(s);
    if (s.phase === 'cutscene') drawShearCutscene(s);
  }
  function drawShedFluffPops() {
    for (const p of fluff) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.c || '#f4f3ee'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    for (const p of pops) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.font = '900 ' + p.sz + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y); } ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }
  function drawShedScene(s) {
    const floorY = H * 0.3;
    const wall = ctx.createLinearGradient(0, 0, 0, floorY); wall.addColorStop(0, '#33455f'); wall.addColorStop(1, '#293a51'); ctx.fillStyle = wall; ctx.fillRect(0, 0, W, floorY);
    // corrugated-iron back wall lines
    ctx.strokeStyle = 'rgba(0,0,0,0.09)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, floorY); ctx.stroke(); }
    // wooden board floor
    const fl = ctx.createLinearGradient(0, floorY, 0, H); fl.addColorStop(0, '#7a5f3c'); fl.addColorStop(1, '#5f4a2e'); ctx.fillStyle = fl; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; for (let i = 0; i <= 12; i++) ctx.fillRect(i * W / 12, floorY, 2, H - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, floorY + (H - floorY) * i / 6, W, 2);
    // wool bins in the back corners
    ctx.fillStyle = '#8a6a44'; roundRect(14, floorY - 34, 60, 40, 5); ctx.fill(); ctx.fillStyle = '#f2efe6'; roundRect(18, floorY - 44, 52, 16, 6); ctx.fill();
    ctx.fillStyle = '#8a6a44'; roundRect(W - 74, floorY - 34, 60, 40, 5); ctx.fill(); ctx.fillStyle = '#f2efe6'; roundRect(W - 70, floorY - 44, 52, 16, 6); ctx.fill();
    // hanging sign
    ctx.fillStyle = '#7a4f2c'; roundRect(W / 2 - 96, 8, 192, 34, 9); ctx.fill(); ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; roundRect(W / 2 - 96, 8, 192, 34, 9); ctx.stroke();
    ctx.fillStyle = '#ffd23d'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('✂️ SHEARING SHED', W / 2, 31);
  }
  function drawShedSheep(cx, cy, breed, R, facing, boss) {
    const wool = BREEDS[breed].wool, dark = breed === 'black', f = facing || 1;
    ctx.save(); ctx.translate(cx, cy); shadowLocal(0, R * 0.72, R * 1.15);
    ctx.strokeStyle = dark ? '#241f28' : '#4a3d38'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const lx = (-0.5 + i * 0.33) * R; ctx.beginPath(); ctx.moveTo(lx, R * 0.4); ctx.lineTo(lx + Math.sin(tick / 6 + i) * 1.2, R); ctx.stroke(); }
    ctx.lineCap = 'butt';
    ctx.fillStyle = dark ? '#2a2630' : shade(wool, -16); for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.5, R * 0.42, 0, 7); ctx.fill(); }
    ctx.fillStyle = wool; for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.46, R * 0.4, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.82, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = dark ? 0.16 : 0.32; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.34, R * 0.5, R * 0.36, -0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(f * R * 0.86, -R * 0.1); ctx.scale(f, 1);
    if (boss) { ctx.strokeStyle = '#dcb877'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(R * 0.15, R * 0.05, R * 0.3, -2.2, 1.3, false); ctx.stroke(); ctx.lineCap = 'butt'; }
    ctx.fillStyle = dark ? '#241f28' : '#39312e'; ctx.beginPath(); ctx.ellipse(-R * 0.08, -R * 0.24, R * 0.17, R * 0.09, -0.7, 0, 7); ctx.fill();
    ctx.fillStyle = dark ? '#211d26' : '#39312e'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.35, R * 0.44, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.04, R * 0.11, 0, 7); ctx.fill();
    ctx.fillStyle = '#120f14'; ctx.beginPath(); ctx.arc(-R * 0.08, -R * 0.03, R * 0.06, 0, 7); ctx.fill();
    if (boss) { ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.04, R * 0.04, 0, 7); ctx.fill(); }
    ctx.restore(); ctx.restore();
  }
  function drawCatch(s) {
    const c = s.catch, facing = c.vx >= 0 ? 1 : -1;
    drawShedSheep(c.x, c.y, c.sh.breed, c.boss ? 54 : 34, facing, c.boss);
    const ringR = (c.boss ? 74 : 52) * (0.5 + 0.5 * Math.abs(Math.sin(c.ring * Math.PI)));
    ctx.strokeStyle = c.boss ? '#ff5a5a' : '#ffd23d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, ringR, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x - 11, c.y); ctx.lineTo(c.x - 4, c.y); ctx.moveTo(c.x + 4, c.y); ctx.lineTo(c.x + 11, c.y); ctx.moveTo(c.x, c.y - 11); ctx.lineTo(c.x, c.y - 4); ctx.moveTo(c.x, c.y + 4); ctx.lineTo(c.x, c.y + 11); ctx.stroke();
    drawShedFluffPops();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 19px system-ui';
    ctx.fillText(c.boss ? '🐏 Catch THE WOOLLY BEAST — tap it!' : '🤠 Catch the sheep — tap it!', W / 2, H * 0.85);
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '700 13px system-ui'; ctx.fillText('Tap when the ring is small for a PERFECT catch ⭐', W / 2, H * 0.85 + 24);
  }
  function drawClipper(c) {
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.fillStyle = c.down ? '#ffd23d' : 'rgba(255,210,61,0.6)'; ctx.strokeStyle = '#241a12'; ctx.lineWidth = 2;
    roundRect(-13, -9, 26, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9ccd6'; ctx.fillRect(-4, -20, 8, 11);   // blade
    if (c.down) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(0, -20, 9, -0.5, Math.PI + 0.5); ctx.stroke(); }
    ctx.restore();
  }
  function drawStruggleBar(s) {
    const bw = W * 0.5, bx = W / 2 - bw / 2, by = H * 0.15;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(bx - 2, by - 2, bw + 4, 16, 8); ctx.fill();
    ctx.fillStyle = s.struggle > 0.7 ? '#ff5a5a' : '#ffb03a'; roundRect(bx, by, bw * clamp(s.struggle, 0, 1), 12, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🐏 STRUGGLE — shear fast before it breaks free!', W / 2, by - 6);
  }
  function drawShornBody(s) {
    const cx = s.cx, cy = s.cy, rx = s.rx * 0.82, ry = s.ry * 0.82, skin = SKIN[s.breed] || '#e6b6a2';
    // laid on its back — four legs sticking up, kicking gently
    ctx.strokeStyle = s.breed === 'black' ? '#2a2630' : '#caa08a'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    for (const lx of [-0.5, -0.18, 0.2, 0.52]) { ctx.beginPath(); ctx.moveTo(cx + rx * lx, cy - ry * 0.18); ctx.lineTo(cx + rx * lx + Math.sin(s.t / 18 + lx * 4) * 4, cy - ry * 0.92); ctx.stroke(); }
    ctx.fillStyle = '#3a2f2a'; for (const lx of [-0.5, -0.18, 0.2, 0.52]) { ctx.beginPath(); ctx.arc(cx + rx * lx + Math.sin(s.t / 18 + lx * 4) * 4, cy - ry * 0.92, 5, 0, 7); ctx.fill(); }
    ctx.lineCap = 'butt';
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();   // shorn belly
    ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.28, rx * 0.92, ry * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.3, cy - ry * 0.28, rx * 0.5, ry * 0.32, -0.3, 0, 7); ctx.fill();
    // head at the front, tongue out (happy)
    const hx = cx - rx * 0.98, hy = cy + ry * 0.12;
    ctx.fillStyle = s.breed === 'black' ? '#2a2630' : '#39312e'; ctx.beginPath(); ctx.ellipse(hx, hy, rx * 0.3, ry * 0.4, 0.35, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx - rx * 0.05, hy - ry * 0.06, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx - rx * 0.06, hy - ry * 0.05, 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#e07a86'; ctx.beginPath(); ctx.ellipse(hx - rx * 0.08, hy + ry * 0.12, 3, 5, 0.4, 0, 7); ctx.fill();   // tongue
  }
  function drawShearHud(s) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(11,18,32,0.62)'; roundRect(W / 2 - 168, 46, 336, 28, 12); ctx.fill();
    ctx.fillStyle = '#eaf0ff'; ctx.font = '800 13px system-ui';
    const who = s.boss ? '🐏 BOSS' : '🐑 ' + Math.min(s.idx + 1, s.queue.length) + '/' + s.queue.length;
    const prog = s.phase === 'shearing' ? '  ·  ✂️ ' + Math.round(s.gone / Math.max(1, s.total) * 100) + '%' : '';
    ctx.fillText(who + prog + '   🧺 ' + s.totalWool + '   🏆 ' + Math.floor((F.records && F.records.woolCrop) || 0), W / 2, 65);
    if (s.phase === 'catch' && s.catch && !s.catch.boss) { const g = woolGrade(s.catch.pct); ctx.fillStyle = g.col; ctx.font = '900 15px system-ui'; ctx.fillText(g.stars + ' ' + s.catch.pct + '% → ' + g.label + ' grade   (aim for ~80%)', W / 2, 92); }
    if (s.phase === 'shearing') {
      const beating = s.sheepT <= (s.par || 6);
      ctx.fillStyle = beating ? '#8fe08a' : '#fff'; ctx.font = '900 32px system-ui'; ctx.fillText('⏱️ ' + s.sheepT.toFixed(1) + 's', W / 2, 116);
      ctx.font = '800 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const rec = (s.breedRec != null) ? ('🏆 best ' + s.breedRec.toFixed(1) + 's') : '🏆 no time yet';
      ctx.fillText((BREED_LABEL[s.breed] || '') + ' sheep  ·  ' + rec + '  ·  gun ' + (s.par || 6) + 's', W / 2, 138);
    }
    // shed hands working in the background
    if (s.handHands > 0 && !s.boss && s.phase !== 'summary' && s.phase !== 'cutscene') {
      const remaining = Math.max(0, s.handTail - s.idx - 1), bx = 10, by = H * 0.64;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(11,18,32,0.66)'; roundRect(bx, by, 182, 48, 10); ctx.fill();
      ctx.fillStyle = '#8fe08a'; ctx.font = '900 13px system-ui'; ctx.fillText('🧑‍🌾 ×' + s.handHands + '  shearing…', bx + 10, by + 17);
      ctx.fillStyle = '#cfe0ff'; ctx.font = '700 11px system-ui'; ctx.fillText(s.handSheared + ' done  ·  ' + remaining + ' in the back', bx + 10, by + 32);
      if (remaining > 0) { const sh = s.queue[s.handTail - 1], cost = (SHEAR_PAR[sh.breed] || 6) * 60; ctx.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(bx + 10, by + 39, 162, 4, 2); ctx.fill(); ctx.fillStyle = '#8fe08a'; roundRect(bx + 10, by + 39, 162 * clamp(s.handWork / cost, 0, 1), 4, 2); ctx.fill(); }
      ctx.textAlign = 'center';
    }
  }
  function drawShedBtn(r, label, col, dim) {
    ctx.globalAlpha = dim ? 0.4 : 1;
    ctx.fillStyle = col; roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill();
    ctx.fillStyle = '#12100a'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
  }
  function drawShearIntro(s) {
    ctx.fillStyle = 'rgba(6,10,20,0.55)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23d'; ctx.font = '900 36px system-ui'; ctx.fillText('✂️ SHEARING SHED', W / 2, H * 0.16);
    ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.fillText('Catch each sheep, then shear it FAST!', W / 2, H * 0.16 + 32);
    ctx.fillStyle = '#8fe08a'; ctx.font = '800 14px system-ui'; ctx.fillText('★★★ Best grade at ~80% wool  ·  ⏱️ beat the gun time ★★★', W / 2, H * 0.16 + 58);
    // best times board
    const bs = F.records.bestShear || {}, breeds = ['normal', 'black', 'merino', 'golden'].filter(b => bs[b] != null);
    ctx.fillStyle = '#ffd23d'; ctx.font = '900 15px system-ui'; ctx.fillText('🏆 YOUR BEST TIMES', W / 2, H * 0.16 + 90);
    ctx.font = '800 14px system-ui';
    if (breeds.length) { let ry = H * 0.16 + 114; for (const b of breeds) { ctx.fillStyle = '#eaf0ff'; ctx.fillText(BREED_ICON[b] + ' ' + BREED_LABEL[b] + ': ' + bs[b].toFixed(1) + 's  (gun ' + SHEAR_PAR[b] + 's)', W / 2, ry); ry += 22; } }
    else { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 13px system-ui'; ctx.fillText('none yet — shear fast to set a record!', W / 2, H * 0.16 + 114); }
    // shed hands
    ctx.fillStyle = '#cfe0ff'; ctx.font = '900 16px system-ui'; ctx.fillText('🧑‍🌾 Shed Hands: ' + (F.shedHands || 0) + '/2', W / 2, H * 0.62);
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '700 12px system-ui'; ctx.fillText('hands shear the flock in the background while you go for records', W / 2, H * 0.62 + 18);
    const b = shearIntroButtons();
    drawShedBtn(b.hire, '🧑‍🌾 Hire  $' + SHED_HAND_COST, '#8fe08a', (F.shedHands || 0) >= 2 || F.money < SHED_HAND_COST);
    drawShedBtn(b.fire, '👋 Fire', '#ffb03a', (F.shedHands || 0) <= 0);
    drawShedBtn(b.start, '▶ START', '#ffd23d');
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 12px system-ui'; ctx.fillText('(or tap anywhere to start)', W / 2, H * 0.8 + 68);
  }
  function drawGradeFlash(s) {
    const g = s.lastGrade; if (!g) return; ctx.textAlign = 'center';
    ctx.save(); ctx.globalAlpha = clamp(s.gradeT < 18 ? s.gradeT / 18 : 1, 0, 1);
    let y = H * 0.24;
    ctx.fillStyle = g.col; ctx.font = '900 44px system-ui'; ctx.fillText((g.stars || '') + ' ' + g.label, W / 2, y); y += 38;
    ctx.fillStyle = '#fff5c8'; ctx.font = '900 24px system-ui'; ctx.fillText('+' + s.lastGot + ' 🧺', W / 2, y); y += 36;
    if (s.lastTime != null && !s.boss) {
      const beat = s.lastTimeRec;
      ctx.fillStyle = beat ? '#ffd23d' : '#bcd0ff'; ctx.font = '900 24px system-ui';
      ctx.fillText('⏱️ ' + s.lastTime.toFixed(1) + 's' + (s.lastTime <= s.lastPar ? '  ⚡GUN!' : ''), W / 2, y); y += 30;
      if (beat) { ctx.fillStyle = '#ffd23d'; ctx.font = '900 22px system-ui'; ctx.fillText('🏆 NEW BEST ' + (BREED_LABEL[s.breed] || '').toUpperCase() + ' TIME!', W / 2, y); y += 30; }
    }
    if (s.combo >= 2 && g.key === 'premium') { ctx.fillStyle = '#ffd23d'; ctx.font = '900 20px system-ui'; ctx.fillText('🔥 ' + s.combo + ' PREMIUM STREAK!', W / 2, y); y += 28; }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '700 14px system-ui'; ctx.fillText('tap to continue', W / 2, y + 6);
    ctx.restore();
  }
  function drawShearSummary(s) {
    ctx.fillStyle = 'rgba(6,10,20,0.8)'; ctx.fillRect(0, 0, W, H);
    const py = H * 0.18; ctx.textAlign = 'center';
    ctx.fillStyle = s.trophy ? '#ffd23d' : '#58e08a'; ctx.font = '900 34px system-ui'; ctx.fillText(s.trophy ? '🏆 BEAST DEFEATED!' : '✂️ SHEARING DONE!', W / 2, py);
    ctx.fillStyle = '#fff5c8'; ctx.font = '900 24px system-ui'; ctx.fillText('🧺 Wool crop: ' + s.totalWool, W / 2, py + 42);
    ctx.fillStyle = '#ffd23d'; ctx.font = '900 28px system-ui'; ctx.fillText('💰 +$' + s.earned, W / 2, py + 80);
    let gy = py + 120; ctx.font = '800 17px system-ui';
    const lines = [['★★★ Premium', s.tally.premium, '#ffd23d'], ['★★ Good', s.tally.good, '#8fe08a'], ['★ Store', s.tally.store, '#cbd3e0'], ['· Oddments', s.tally.oddments, '#c98a6a']];
    for (const ln of lines) { if (ln[1] > 0) { ctx.fillStyle = ln[2]; ctx.fillText(ln[0] + '  ×' + ln[1], W / 2, gy); gy += 26; } }
    if (s.handSheared > 0) { ctx.fillStyle = '#8fe08a'; ctx.font = '800 15px system-ui'; ctx.fillText('🧑‍🌾 Shed hands sheared ' + s.handSheared, W / 2, gy); gy += 24; }
    if (s.bestCombo >= 2) { ctx.fillStyle = '#ff8a3d'; ctx.font = '900 18px system-ui'; ctx.fillText('🔥 Best premium streak: ' + s.bestCombo, W / 2, gy); gy += 28; }
    if (s.record) { ctx.fillStyle = '#ff8a3d'; ctx.font = '900 20px system-ui'; ctx.fillText('🏆 NEW RECORD WOOL CROP!', W / 2, gy); gy += 28; }
    // best-time board — the speed-run high scores
    const bs = F.records.bestShear || {}, breeds = ['normal', 'black', 'merino', 'golden'].filter(b => bs[b] != null);
    if (breeds.length) { gy += 4; ctx.fillStyle = '#ffd23d'; ctx.font = '900 16px system-ui'; ctx.fillText('⏱️ BEST TIMES', W / 2, gy); gy += 24; ctx.font = '800 15px system-ui'; for (const b of breeds) { ctx.fillStyle = '#eaf0ff'; ctx.fillText(BREED_ICON[b] + ' ' + BREED_LABEL[b] + ': ' + bs[b].toFixed(1) + 's  (gun ' + SHEAR_PAR[b] + 's)', W / 2, gy); gy += 22; } }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 14px system-ui'; ctx.fillText('tap to send them out to pasture 🐑', W / 2, gy + 8);
  }
  function drawShearCutscene(s) {
    ctx.fillStyle = 'rgba(6,10,20,0.5)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 26px system-ui'; ctx.fillText('Out to pasture! 🐑', W / 2, H * 0.3);
    const n = Math.min(s.queue.length, 6), prog = clamp(s.cutT / 150, 0, 1);
    for (let i = 0; i < n; i++) { const x = -60 + (W + 120) * clamp(prog * 1.4 - i * 0.08, 0, 1), y = H * 0.55 + Math.sin(s.t / 8 + i) * 4 + i * 6; ctx.font = '40px system-ui'; ctx.fillText('🐑', x, y); }
  }

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
    setBar('foodFill', 'foodPct', F.feed / (F.feedMax || 100) * 100); setBar('waterFill', 'waterPct', F.water / (F.waterMax || 100) * 100);
    const fb = el('foodFill'); if (fb) fb.classList.toggle('low', F.feed < (F.feedMax || 100) * 0.2);
    const wb = el('waterFill'); if (wb) wb.classList.toggle('low', F.water < (F.waterMax || 100) * 0.2);
    el('sellVal').textContent = '$' + Math.floor(F.wool * woolPrice());
    const gc = el('goalChip'), gf = el('goalFill'); if (gc) { const g = goalInfo(); gc.querySelector('.goal-text').textContent = g.text; if (gf) gf.style.width = Math.round(g.pct * 100) + '%'; gc.classList.toggle('done', g.done); }
  }
  function goalInfo() {
    if (F.won) return { text: '🏆 Golden Fleece won — sandbox on!', pct: 1, done: true };
    if (F.farmLevel < ERAS.length) { const c = expandCost(); return { text: '🎯 Level ' + (F.farmLevel + 1) + ' → ' + ERAS[F.farmLevel].ic + ' ' + ERAS[F.farmLevel].name, pct: clamp(F.money / c, 0, 1), done: false }; }
    return { text: '🏆 Amass $' + WIN_MONEY + ' for the Golden Fleece', pct: clamp(F.money / WIN_MONEY, 0, 1), done: false };
  }
  const toastEl = el('toast');
  function toast(m) { if (!toastEl) return; toastEl.textContent = m; toastEl.style.color = '#fff'; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show'); }
  function heartsOnFlock() { let n = 0; for (const s of sheep) { if (n++ > 5) break; s.heartT = 24; } }
  function refillFeed() { if (F.money < FEED_COST) return toast('Not enough money'); F.money -= FEED_COST; F.feed = clamp(F.feed + Math.max(55, F.feedMax * 0.55), 0, F.feedMax); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function refillWater() { if (F.money < WATER_COST) return toast('Not enough money'); F.money -= WATER_COST; F.water = clamp(F.water + Math.max(65, F.waterMax * 0.55), 0, F.waterMax); heartsOnFlock(); sfx.pop(); persist(); updateHud(); }
  function sellWool() { if (F.wool < 1) return toast('No wool — shear the fluffy (✂️) sheep first!'); const got = Math.floor(F.wool * woolPrice()); F.money += got; F.wool = 0; toast('💰 Sold wool for $' + got); confetti(W / 2, H * 0.4, ['💰', '🪙', '✨']); sfx.coin(); persist(); updateHud(); }
  el('btnFeed').onclick = refillFeed; el('btnWater').onclick = refillWater; el('btnSell').onclick = sellWool; el('btnShop').onclick = openShop; el('farmPlay').onclick = startGame; el('shopClose').onclick = closeShop;
  { const b = el('btnWoofa'); if (b) b.onclick = () => { if (running) woofaGather(); }; }
  function syncMute() { const b = el('btnSound'); if (b) b.textContent = F && F.muted ? '🔇' : '🔊'; }
  { const b = el('btnSound'); if (b) b.onclick = () => { F.muted = !F.muted; syncMute(); if (!F.muted) { ensureAudio(); sfx.pop(); } persist(); }; }
  { const b = el('btnHelp'); if (b) b.onclick = () => startTutorial(); }
  { const b = el('btnResearch'); if (b) b.onclick = () => { if (running) openResearch(); }; }
  { const b = el('btnZoomIn'); if (b) b.onclick = () => { if (running) { setZoom(zoom * 1.2); sfx.pop(); } }; }
  { const b = el('btnZoomOut'); if (b) b.onclick = () => { if (running) { setZoom(zoom * 0.82); sfx.pop(); } }; }
  { const b = el('btnHome'); if (b) b.onclick = () => { if (!running) return; const t = F.pens[0]; centerCamOn(t ? t.x + t.w / 2 : house.x, t ? t.y + t.h / 2 : house.y + 20); sfx.pop(); }; }

  // ---------- tutorial ----------
  const TUT = [
    { t: '👋 Welcome to Ewe Beauty Farming Co — build a sheep EMPIRE! Raise sheep, grow wool, run a whole farm crew.' },
    { t: '🗺️ Your farm is a big map! DRAG to scroll around it, pinch or ＋／－ to zoom, tap the 🏠 button to zip back home, and tap the mini-map (top-right) to jump anywhere. Buy Land to make it huge!' },
    { t: '🌾 Tap FEED & 💧 WATER to fill troughs (watch the gauges). Or hire a 🪣 Hauler to do it for you!' },
    { t: '👷 In the 🛒 SHOP hire Farmhands: ✂️ Shepherd shears, 🪣 Hauler refills, 🪓 Woodcutter chops 🪵 wood, ⛏️ Miner digs 🪨 stone. Tap a worker to change their job!' },
    { t: '🏗️ Spend wood + stone to BUILD a 🏪 Market, 🗼 Watchtower, 🛖 Bunkhouse, Wells & Barns. Upgrade a pen to 🧱 STONE and shut the gate — predators can\'t get in!' },
    { t: '🔬 RESEARCH tech (top-right) for permanent boosts: sharper shears, hardy breeds, faster hands & more.' },
    { t: '🐾 WOOFA button herds the flock into a pen. Then tap a fluffy ✂️ sheep to SHEAR them all in the shearing minigame — go fast for record wool crops & more money!' },
    { t: '🦊 Foxes AND 🐺 wolves raid — dogs FLING them! Advance ERAS to grow, and ⚙ (top-right) lets you switch farms or restart. Have fun! 🐑' },
  ];
  let tutIx = 0;
  function startTutorial() { tutIx = 0; showTut(); }
  function lastTutText() {
    const d = curDiff();
    if (d.wolves) return '🦊 Foxes AND 🐺 wolf packs raid at night — herd sheep into a 🧱 stone pen and shut the gate! Dogs FLING predators. Level up to grow. Have fun! 🐑';
    if (d.foxKill) return '🦊 Foxes will try to grab a stray — keep the flock close and let your dogs chase them off! Level up your farm to grow. Have fun! 🐑';
    return '🦊 A cheeky fox might pop by — but your dogs shoo every one away, so your flock is always safe! Just build, breed & grow. Have fun! 🐑';
  }
  function showTut() { const o = el('tutOverlay'); if (!o) return; el('tutText').textContent = (tutIx === TUT.length - 1 && F) ? lastTutText() : TUT[tutIx].t; el('tutStep').textContent = (tutIx + 1) + ' / ' + TUT.length; el('tutNext').textContent = tutIx === TUT.length - 1 ? 'Let\'s farm! 🐑' : 'Next ›'; o.classList.remove('hidden'); }
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

  // ---------- My Sheep collection book ----------
  function sheepFace(s) { return s.role === 'ram' ? '🐏' : '🐑'; }
  function breedTag(s) { const b = BREEDS[s.breed]; const mk = s.breed === 'golden' ? '⭐ ' : s.breed === 'black' ? '🖤 ' : s.breed === 'merino' ? '✨ ' : ''; return mk + b.name + ' ' + (s.role === 'lamb' ? 'Lamb' : s.role === 'ram' ? 'Ram' : 'Ewe'); }
  function sheepMood(s) {
    if (s.sick) return '🤒 Poorly';
    if (s.role === 'lamb') return '🐑 Growing up';
    if (s.hunger > 65) return '🍽️ Hungry';
    if (s.thirst > 65) return '💧 Thirsty';
    if (s.wool >= 100) return '✂️ Ready to shear';
    if (s.health > 78) return '😊 Happy';
    return '🙂 Content';
  }
  const sheepScreen = el('sheepScreen');
  function openSheepBook() { if (!F) return; renderSheepBook(); if (sheepScreen) sheepScreen.classList.remove('hidden'); }
  function closeSheepBook() { if (sheepScreen) sheepScreen.classList.add('hidden'); }
  function renderSheepBook() {
    const cnt = el('sheepCount'); if (cnt) cnt.textContent = '🐑 ' + sheep.length + '/' + F.sheepCap;
    const list = el('sheepList'); if (!list) return; list.innerHTML = '';
    if (!sheep.length) { const d = document.createElement('div'); d.className = 'sheep-empty'; d.textContent = 'No sheep yet — buy one in the 🛒 Shop!'; list.appendChild(d); return; }
    const order = sheep.slice().sort((a, b) => (a.role === 'lamb') - (b.role === 'lamb') || (b.wool - a.wool));
    for (const s of order) {
      const div = document.createElement('div'); div.className = 'shop-item sheep-row';
      const woolPct = Math.round(s.wool);
      div.innerHTML =
        '<div class="si-emoji sheep-ico' + (s.breed === 'golden' ? ' gold' : s.breed === 'black' ? ' black' : '') + '">' + sheepFace(s) + '</div>' +
        '<div class="si-body"><div class="si-name sheep-nm">' + escapeHtml(s.name) + '</div>' +
        '<div class="si-desc">' + breedTag(s) + ' · ' + sheepMood(s) + ' · 🧺 ' + woolPct + '%</div></div>' +
        '<div class="si-action sheep-acts"><button class="si-mini" data-act="rename" title="Rename">✏️</button><button class="si-mini" data-act="find" title="Find on farm">📍</button></div>';
      div.querySelector('[data-act="rename"]').onclick = () => openRename(s.id);
      div.querySelector('[data-act="find"]').onclick = () => locateSheep(s.id);
      div.querySelector('.sheep-nm').onclick = () => openRename(s.id);
      list.appendChild(div);
    }
  }
  function locateSheep(id) {
    const s = sheep.find(x => x.id === id); if (!s) return;
    closeSheepBook();
    if (typeof centerCamOn === 'function') centerCamOn(s.x, s.y);
    s.heartT = 60; s._hl = 150; pop(s.x, s.y - 16, '📍 ' + s.name, '#ffd23d', true); flashAlert('📍 There’s ' + s.name + '!', '#58e08a'); sfx.pop();
  }
  // rename modal
  let renameTarget = null;
  const renameScreen = el('renameScreen');
  function openRename(id) {
    const s = sheep.find(x => x.id === id); if (!s) return;
    renameTarget = id;
    const emo = el('renameEmoji'); if (emo) emo.textContent = sheepFace(s);
    const inp = el('renameInput'); if (inp) { inp.value = s.name; }
    if (renameScreen) renameScreen.classList.remove('hidden');
    if (inp) setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 60);
  }
  function closeRename() { if (renameScreen) renameScreen.classList.add('hidden'); renameTarget = null; }
  function saveRename() {
    const s = sheep.find(x => x.id === renameTarget); const inp = el('renameInput');
    if (s && inp) { const nm = (inp.value || '').trim().slice(0, 14); if (nm) { s.name = nm; toast('🐑 Say hi to ' + nm + '!'); s.heartT = 40; sfx.pop(); persist(); } }
    closeRename(); renderSheepBook(); updateHud();
  }
  { const b = el('btnSheep'); if (b) b.onclick = () => { if (running) openSheepBook(); }; }
  { const b = el('sheepClose'); if (b) b.onclick = closeSheepBook; }
  { const b = el('renameSave'); if (b) b.onclick = saveRename; }
  { const b = el('renameCancel'); if (b) b.onclick = closeRename; }
  { const b = el('renameShuffle'); if (b) b.onclick = () => { const inp = el('renameInput'); if (inp) inp.value = pickSheepName(); }; }
  { const inp = el('renameInput'); if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveRename(); } }); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- shear UI + save slots + menu ----------
  function syncShearUI(active) { for (const id of ['farmHud', 'farmBar', 'btnWoofa', 'mapCtrls']) { const e = el(id); if (e) e.classList.toggle('hidden', active); } }
  function showSlotPicker() { renderSlots(); const o = el('slotScreen'); if (o) o.classList.remove('hidden'); const st = el('startScreen'); if (st) st.classList.add('hidden'); const m = el('menuScreen'); if (m) m.classList.add('hidden'); }
  function renderSlots() {
    for (let i = 0; i < NSLOTS; i++) { const b = el('slot' + i); if (!b) continue; const sum = slotSummary(i), info = b.querySelector('.slot-info'), wipe = b.querySelector('.slot-wipe');
      if (info) info.textContent = sum ? (ERAS[Math.min(sum.era - 1, ERAS.length - 1)].ic + ' ' + ERAS[Math.min(sum.era - 1, ERAS.length - 1)].name + ' · 💰' + sum.money + ' · 🐑' + sum.sheep) : 'Empty — start a new farm';
      if (wipe) wipe.style.display = sum ? 'block' : 'none';
      b.classList.toggle('cur', i === curSlot);
    }
  }
  function pickSlot(i) { curSlot = i; try { localStorage.setItem(SLOT_KEY, String(i)); } catch (e) {} const o = el('slotScreen'); if (o) o.classList.add('hidden'); startGame(); }
  function wipeSlot(i) { try { localStorage.removeItem(saveKey(i)); } catch (e) {} renderSlots(); }
  function openMenu() { const m = el('menuScreen'); if (m) m.classList.remove('hidden'); const r = el('menuRestart'); if (r) r.textContent = '🔄 Restart this Farm'; const d = el('menuDiff'); if (d && F) d.textContent = '🎚️ Difficulty: ' + curDiff().emoji + ' ' + curDiff().name; }
  function closeMenu() { const m = el('menuScreen'); if (m) m.classList.add('hidden'); }
  { const b = el('btnMenu'); if (b) b.onclick = () => { if (running) openMenu(); }; }
  { const b = el('menuClose'); if (b) b.onclick = closeMenu; }
  { const b = el('menuSwitch'); if (b) b.onclick = () => { persist(); closeMenu(); showSlotPicker(); }; }
  { const b = el('menuDiff'); if (b) b.onclick = () => { closeMenu(); showModeSelect('change'); }; }
  { const b = el('modeBack'); if (b) b.onclick = () => { const o = el('modeScreen'); if (o) o.classList.add('hidden'); if (running) openMenu(); else { const s = el('startScreen'); if (s) s.classList.remove('hidden'); } }; }
  { let armed = false; const b = el('menuRestart'); if (b) b.onclick = () => { if (!armed) { armed = true; b.textContent = '⚠️ Tap again to wipe this farm'; setTimeout(() => { armed = false; b.textContent = '🔄 Restart this Farm'; }, 2500); return; } armed = false; closeMenu(); restartFarm(); }; }
  for (let i = 0; i < NSLOTS; i++) { const b = el('slot' + i); if (b) { b.onclick = (e) => { if (e.target && e.target.classList && e.target.classList.contains('slot-wipe')) return; pickSlot(i); }; const w = b.querySelector('.slot-wipe'); if (w) w.onclick = (e) => { e.stopPropagation(); wipeSlot(i); }; } }
  { const b = el('chooseFarm'); if (b) b.onclick = showSlotPicker; }

  // ---------- shop ----------
  const startScreen = el('startScreen'), shopScreen = el('shopScreen');
  function hideOverlays() { startScreen.classList.add('hidden'); shopScreen.classList.add('hidden'); if (researchScreen) researchScreen.classList.add('hidden'); if (sheepScreen) sheepScreen.classList.add('hidden'); if (renameScreen) renameScreen.classList.add('hidden'); const wsn = el('winScreen'); if (wsn) wsn.classList.add('hidden'); }
  function openShop() { if (!F) return; renderShop(); shopScreen.classList.remove('hidden'); }
  function closeShop() { shopScreen.classList.add('hidden'); }
  function sheepCost(b) { if (b === 'normal' && sheep.length === 0) return 0; return Math.round(BREEDS[b].cost + (b === 'normal' ? sheep.length * 18 : 0)); }
  function expandCost() { return Math.round(560 * Math.pow(F.farmLevel, 1.75)); }   // steeper level-up cost — progress through the eras gradually
  function houseCost() { return Math.round(300 * F.house.level); }
  function workerCost() { return 90 + workers.length * 55; }
  function shearsCost() { return 200 * (F.shearGear || 1); }

  function renderShop() {
    el('shopMoney').textContent = Math.floor(F.money);
    const list = el('shopList'); list.innerHTML = ''; const rows = [];
    rows.push({ head: '🐑 Livestock' });
    for (const b of ['normal', 'merino', 'golden', 'black']) { const B = BREEDS[b], locked = F.farmLevel < B.lvl, full = sheep.length >= F.sheepCap, c = sheepCost(b), rescue = b === 'normal' && sheep.length === 0; rows.push({ emoji: b === 'black' ? '🖤' : b === 'golden' ? '⭐' : rescue ? '🐣' : '🐑', name: rescue ? 'Rescue a Stray Lamb' : 'Buy ' + B.name + ' Sheep', desc: rescue ? 'Your flock is empty — take this one free and start again!' : locked ? 'Unlocks at farm Lv ' + B.lvl + '.' : (b === 'black' ? 'Priciest — wool sells for 6.5×.' : 'Wool value ×' + B.mult + '.'), act: locked ? { tag: 'Lv ' + B.lvl } : full ? { tag: 'Full' } : { label: rescue ? 'FREE' : '$' + c, fn: () => buySheep(b), afford: F.money >= c } }); }
    rows.push({ head: '👷 Farmhands (' + workers.length + '/' + workerCap() + ')' });
    const capFull = workers.length >= workerCap(), wc = workerCost();
    for (const j of JOBS) { const info = WORKER[j]; rows.push({ emoji: info.emoji, name: 'Hire ' + info.name, desc: info.desc + (capFull ? ' — cap reached (build a 🛖 Bunkhouse!).' : ''), act: capFull ? { tag: 'Full' } : { label: '$' + wc, fn: () => hireWorker(j), afford: F.money >= wc } }); }
    if (workers.length) { rows.push({ head: '🧑‍🌾 Your Crew — let a hand go' }); workers.forEach((w, i) => rows.push({ emoji: WORKER[w.job].emoji, name: WORKER[w.job].name + ' · Lv ' + (w.level || 1), desc: 'Working as your ' + WORKER[w.job].name + '. Tap Fire to let them go.', act: { label: '✕ Fire', fn: () => fireWorker(i), afford: true } })); }
    rows.push({ head: '🏗️ Buildings' });
    for (const k of Object.keys(BUILD)) { const bd = BUILD[k]; const can = F.money >= bd.coin && F.wood >= bd.wood && F.stone >= (bd.stone || 0); let cd = 'Costs 🪵' + bd.wood + (bd.stone ? ' 🪨' + bd.stone : ''); rows.push({ emoji: bd.emoji, name: 'Build ' + bd.name, desc: bd.desc + ' ' + cd + '.', act: { label: '$' + bd.coin, fn: () => buyBuilding(k), afford: can } }); }
    rows.push({ emoji: '🚧', name: 'Build a Pen', desc: 'Drops a pen — resize corners, tap 🧱 to make it a fox-proof stone pen, ✕ to scrap.', act: { label: '$' + PEN_COST, fn: buyPen, afford: F.money >= PEN_COST } });
    rows.push({ head: '🌾💧 Feed & Water' });
    rows.push({ emoji: '🛢️', name: 'Bigger Feed Store (holds ' + F.feedMax + ')', desc: 'Upgrade your feed tank so it holds more — top up less often. +80 capacity.', act: { label: '$' + tankCost('feed'), fn: () => upgradeTank('feed'), afford: F.money >= tankCost('feed') } });
    rows.push({ emoji: '🛢️', name: 'Bigger Water Tank (holds ' + F.waterMax + ')', desc: 'Upgrade your water tank so it holds more — great with a dam & tanker. +80 capacity.', act: { label: '$' + tankCost('water'), fn: () => upgradeTank('water'), afford: F.money >= tankCost('water') } });
    rows.push({ emoji: '🌾', name: 'Build a Feed Trough', desc: 'An extra feed trough so more sheep can eat at once. Drag it anywhere.', act: { label: '$' + TROUGH_COST, fn: () => buyTrough('feed'), afford: F.money >= TROUGH_COST } });
    rows.push({ emoji: '💧', name: 'Build a Water Trough', desc: 'An extra water trough so more sheep can drink at once. Drag it anywhere.', act: { label: '$' + TROUGH_COST, fn: () => buyTrough('water'), afford: F.money >= TROUGH_COST } });
    rows.push({ emoji: '🏞️', name: F.dams.length ? 'Buy Another Dam' : 'Dig a Dam', desc: 'A big water source out on the land. Send your 🚜 tractor + tanker to cart water back to your tank. Tap a dam to make it bigger. ⚠️ sheep can wander in!', act: { label: '$' + damBuyCost(), fn: buyDam, afford: F.money >= damBuyCost() } });
    rows.push({ emoji: '🛻', name: F.trailer ? 'Trailer Tanker (owned)' : 'Buy a Trailer Tanker', desc: F.trailer ? 'Your tractor carts water from dams to your tank automatically.' : 'Hook a water tanker to your 🚜 tractor — it auto-carts dam water to your tank. (Needs a tractor & a dam.)', act: F.trailer ? { tag: 'Owned' } : { label: '$420', fn: buyTrailer, afford: F.money >= 420 } });
    rows.push({ head: '🌱 Land, Power & Resources' });
    rows.push({ emoji: '🏠', name: 'Upgrade Farmhouse (Lv ' + F.house.level + ')', desc: F.house.level >= 5 ? 'Maxed! Passive coin, faster wool, +worker cap.' : 'Passive coin, faster wool, +1 worker cap, fancier house.', act: F.house.level >= 5 ? { tag: 'MAX' } : { label: '$' + houseCost(), fn: buyHouse, afford: F.money >= houseCost() } });
    const et = F.energy, next = ENERGY[et + 1];
    rows.push({ emoji: et >= 3 ? '⚡' : et === 2 ? '☀️' : et === 1 ? '🌬️' : '🔌', name: next ? 'Upgrade Energy → ' + next.short : 'Energy: Power Grid', desc: next ? next.desc + ' (now: ' + ENERGY[et].short + ')' : 'Top-tier energy.', act: next ? { label: '$' + next.cost, fn: buyEnergy, afford: F.money >= next.cost } : { tag: 'MAX' } });
    { const g = shearGearInfo(); rows.push({ emoji: '✂️', name: 'Upgrade Shears (' + g.name + ')', desc: F.shearGear >= 5 ? 'Golden Clippers — top speed & +wool. 🏆 Record crop: ' + Math.floor(F.records.woolCrop || 0) : 'Bigger, faster clippers → shear quicker for a better price. 🏆 Record crop: ' + Math.floor(F.records.woolCrop || 0), act: F.shearGear >= 5 ? { tag: 'MAX' } : { label: '$' + shearsCost(), fn: buyShears, afford: F.money >= shearsCost() } }); }
    rows.push({ emoji: '🚜', name: 'Buy a Tractor', desc: F.upgrades.tractor ? 'Owned — tap the field to drive it.' : 'Tap the field to send it herding.', act: F.upgrades.tractor ? { tag: 'Owned' } : { label: '$650', fn: buyTractor, afford: F.money >= 650 } });
    rows.push({ emoji: '🌳', name: 'Plant a Tree', desc: 'More 🪵 wood for Woodcutters, and prettier.', act: { label: '$70', fn: plantTree, afford: F.money >= 70 } });
    rows.push({ emoji: '🪨', name: 'Haul in a Boulder', desc: 'A rock for Miners to dig 🪨 stone from.', act: { label: '$90', fn: addRock, afford: F.money >= 90 } });
    rows.push({ emoji: '🌿', name: 'Plant a Grazing Bush', desc: 'A lush bush the sheep nibble — free food that regrows.', act: { label: '$50', fn: plantBush, afford: F.money >= 50 } });
    { const sickN = sheep.filter(s => s.sick).length, vcost = 40 + sickN * 20; rows.push({ emoji: '💊', name: 'Call the Vet', desc: sickN ? 'Instantly cure all ' + sickN + ' sick 🤒 sheep.' : 'No sick sheep right now — build a 🩺 Vet Hut to auto-heal.', act: sickN ? { label: '$' + vcost, fn: callVet, afford: F.money >= vcost } : { tag: 'Healthy' } }); }
    const nextEra = ERAS[Math.min(F.farmLevel, ERAS.length - 1)];
    rows.push({ emoji: nextEra.ic, name: F.farmLevel >= ERAS.length ? 'Sheep Empire (max era)' : 'Advance to ' + nextEra.name, desc: 'Level up: bigger world, +12 sheep cap, +worker cap, +wool price, new trees.', act: F.farmLevel >= ERAS.length ? { tag: 'MAX' } : { label: '$' + expandCost(), fn: buyExpand, afford: F.money >= expandCost() } });
    rows.push({ emoji: '🌾', name: 'Buy More Land', desc: 'Grow the map bigger and bigger — +15 sheep cap, more trees & rocks. Scroll around it! Buy as many as you like.', act: { label: '$' + landCost(), fn: buyLand, afford: F.money >= landCost() } });
    rows.push({ head: '🐾 Guard Dogs' });
    for (const k of ['winnie', 'tia']) { const d = DOGS[k]; rows.push({ emoji: k === 'winnie' ? '🐕' : '🦴', name: d.name + (k === 'winnie' ? ' (cavoodle)' : ' (schnauzer)'), desc: d.desc, act: F.dogs[k] ? { tag: 'Owned' } : { label: '$' + d.cost, fn: () => buyDog(k), afford: F.money >= d.cost } }); }
    for (const r of rows) {
      if (r.head) { const h = document.createElement('div'); h.className = 'shop-section'; h.textContent = r.head; list.appendChild(h); continue; }
      const div = document.createElement('div'); div.className = 'shop-item';
      const action = r.act.tag ? '<span class="si-tag ' + (r.act.tag === 'Owned' || r.act.tag === 'Running' || r.act.tag === 'MAX' ? 'equipped' : 'lockmsg') + '">' + r.act.tag + '</span>' : '<button class="si-buy" ' + (r.act.afford ? '' : 'disabled') + '>' + r.act.label + '</button>';
      div.innerHTML = '<div class="si-emoji">' + r.emoji + '</div><div class="si-body"><div class="si-name">' + r.name + '</div><div class="si-desc">' + r.desc + '</div></div><div class="si-action">' + action + '</div>';
      if (r.act.fn && r.act.afford) div.querySelector('.si-buy').onclick = () => { r.act.fn(); renderShop(); updateHud(); }; list.appendChild(div);
    }
  }
  function buySheep(b) { const c = sheepCost(b); if (sheep.length >= F.sheepCap || (c > 0 && F.money < c)) return; F.money -= c; const ns = makeSheep({ breed: b, role: rollRole(), wool: 0 }); sheep.push(ns); toast(c === 0 ? '🐣 Rescued a stray — meet ' + ns.name + '!' : '🐑 New ' + BREEDS[b].name + ' — meet ' + ns.name + '!'); pop(ns.x, ns.y - 14, ns.name, '#ffd23d'); sfx.pop(); persist(); updateHud(); }
  function scatterTerrain(trees, rocks, bushes) {
    const rx = () => rand(paddock.x + 44, paddock.x + paddock.w - 44), ry = () => rand(paddock.y + 44, paddock.y + paddock.h - 44);
    for (let i = 0; i < (trees || 0); i++) F.plants.push({ type: 'tree', x: rx(), y: ry(), sz: rand(0.8, 1.15), wood: 100 });
    for (let i = 0; i < (rocks || 0); i++) F.plants.push({ type: 'rock', x: rx(), y: ry(), sz: rand(0.78, 1.1), stone: 100 });
    for (let i = 0; i < (bushes || 0); i++) F.plants.push({ type: 'bush', x: rx(), y: ry(), sz: 1, amt: 1 });
  }
  function buyExpand() { const c = expandCost(); if (F.money < c || F.farmLevel >= ERAS.length) return; F.money -= c; F.farmLevel++; F.sheepCap += 12; layout(); scatterTerrain(3, 1, 2); initGrass(); const era = eraName(); toast(era.ic + ' Entered the ' + era.name + ' — the farm grew!'); flashAlert(era.ic + ' ' + era.name + '!', '#58e08a', true); confetti(W / 2, H * 0.4, ['🌱', '🎉', '🐑', '🌳']); sfx.up(); persist(); updateHud(); }
  function landCost() { return Math.round(450 * Math.pow(1.32, (F.expand || 0))); }
  function buyLand() { const c = landCost(); if (F.money < c) return; F.money -= c; F.expand = (F.expand || 0) + 1; F.sheepCap += 15; layout(); scatterTerrain(4, 2, 3); initGrass(); toast('🌾 Bought more land! +15 sheep cap — scroll to explore →'); flashAlert('🌾 More land! Drag the map to explore →', '#7ed957', true); confetti(W / 2, H * 0.4, ['🌾', '🚜', '🐑', '🌳']); sfx.up(); persist(); updateHud(); }
  function buyEnergy() { const next = ENERGY[F.energy + 1]; if (!next || F.money < next.cost) return; F.money -= next.cost; F.energy++; toast('🔌 Energy upgraded to ' + next.short + '!'); confetti(W / 2, H * 0.4, ['⚡', '🎉', '☀️']); sfx.up(); persist(); }
  function buyDog(k) { const d = DOGS[k]; if (F.money < d.cost || F.dogs[k]) return; F.money -= d.cost; F.dogs[k] = true; rebuildDogs(); toast('🐾 ' + d.name + ' joined the farm!'); confetti(W / 2, H * 0.4, ['🐾', '🎉']); sfx.up(); persist(); }
  function buyTractor() { if (F.money < 650 || F.upgrades.tractor) return; F.money -= 650; F.upgrades.tractor = true; tractor = makeTractor(); toast('🚜 Tractor delivered!'); sfx.up(); persist(); }
  // ---- dams & the water tanker ----
  function damCap(size) { return size * 420; }
  function damR(d) { return 30 + (d.size - 1) * 15; }
  function damUpBtn(d) { const r = damR(d); return { x: d.x + r * 0.72, y: d.y - r * 0.72 }; }
  function damBuyCost() { return Math.round(300 * Math.pow(1.6, F.dams.length)); }
  function damSizeCost(d) { return Math.round(240 * d.size * 1.4); }
  function tankPos() { return { x: waterTrough.x, y: waterTrough.y - 4 }; }
  function buyDam() { const c = damBuyCost(); if (F.money < c) return; F.money -= c; const y = rand(paddock.y + paddock.h * 0.22, paddock.y + paddock.h * 0.8), b = fieldBounds(y); const dam = { x: clamp(rand(b.left + 50, b.right - 50), b.left + 50, b.right - 50), y, size: 1, water: damCap(1) }; F.dams.push(dam); centerCamOn(dam.x, dam.y); toast('🏞️ A dam was dug! Tap it to make it bigger. Get a 🛻 tanker to cart the water.'); flashAlert('🏞️ Dam dug — here it is!', '#4cc9ff', true); confetti(W / 2, H * 0.4, ['🏞️', '💧', '🚜']); sfx.up(); persist(); }
  function upgradeDam(d) { if (d.size >= 4) { toast('That dam is already huge! 🏞️'); return; } const c = damSizeCost(d); if (F.money < c) { toast('Need $' + c + ' to enlarge the dam'); sfx.err(); return; } F.money -= c; d.size++; d.water = Math.min(damCap(d.size), d.water + damCap(1)); toast('🏞️ Dam enlarged — now holds ' + damCap(d.size) + ' water!'); confetti(d.x, d.y - 20, ['🏞️', '💧', '✨']); sfx.up(); persist(); }
  function buyTrailer() { if (F.trailer) return; if (!F.upgrades.tractor) { toast('🚜 Buy a Tractor first!'); sfx.err(); return; } if (F.money < 420) return; F.money -= 420; F.trailer = true; if (tractor) { tractor.load = 0; tractor.mode = 'toDam'; } toast('🛻 Trailer tanker hooked up! It carts dam water to your tank.'); sfx.up(); persist(); }
  function rescueCost(s) { return Math.round(45 + (BREEDS[s.breed] ? BREEDS[s.breed].mult : 1) * 22); }
  function rescueSheep(s) { const c = rescueCost(s); if (F.money < c) { toast('Need $' + c + ' to rescue ' + s.name); sfx.err(); return; } F.money -= c; s.stuck = false; const d = F.dams[s.stuckDam]; if (d) { const b = fieldBounds(d.y + damR(d) + 24); s.x = clamp(d.x, b.left, b.right); s.y = clamp(d.y + damR(d) + 24, paddock.y + 24, paddock.y + paddock.h - 24); } s.heartT = 44; toast('💚 Rescued ' + s.name + ' for $' + c + '!'); pop(s.x, s.y - 14, '💚 saved!', '#58e08a'); confetti(s.x, s.y, ['💚', '🚜', '💧']); sfx.up(); persist(); updateHud(); }
  function nearestDamWithWater() { let best = null, bd = 1e9; for (const d of F.dams) if (d.water > 4) { const dd = dist(tractor.x, tractor.y, d.x, d.y); if (dd < bd) { bd = dd; best = d; } } return best; }
  const TRAILER_CAP = 95;
  function driveTractor(t, tx, ty, dt) { const a = Math.atan2(ty - t.y, tx - t.x), d = dist(t.x, t.y, tx, ty); if (d > 6) { t.x = clamp(t.x + Math.cos(a) * 2.2 * dt, paddock.x + 16, paddock.x + paddock.w - 16); t.y = clamp(t.y + Math.sin(a) * 2.2 * dt, paddock.y + 16, paddock.y + paddock.h - 16); t.facing = Math.cos(a) >= 0 ? 1 : -1; if ((tick | 0) % 6 === 0) dustPuff(t.x - 8 * t.facing, t.y + 11); } return d; }
  function updateTractor(dt) {
    const t = tractor; if (t.zoom > 0) t.zoom -= 0.006 * dt; if (t.herdT > 0) t.herdT -= dt;
    if (t.herdT > 0 && (t.tx || t.ty)) { driveTractor(t, t.tx, t.ty, dt); return; }   // recent player herd command wins
    if (!F.trailer) { if (t.tx || t.ty) driveTractor(t, t.tx, t.ty, dt); return; }     // no tanker → classic herding tractor
    if (F.dams.length && F.water < F.waterMax * 0.92) {
      t.load = t.load || 0; t.mode = t.mode || 'toDam';
      if (t.mode === 'toDam') { const d = nearestDamWithWater(); if (!d) { t.mode = t.load > 0.5 ? 'toTank' : 'idle'; } else { t._dam = d; if (driveTractor(t, d.x, d.y + damR(d) + 8, dt) < 34) t.mode = 'filling'; } }
      else if (t.mode === 'filling') { const d = t._dam, take = Math.min(TRAILER_CAP - t.load, d ? d.water : 0, 0.7 * dt); if (d) d.water -= take; t.load += take; if (Math.random() < 0.05 * dt) splash(t.x, t.y - 4); if (t.load >= TRAILER_CAP || !d || d.water <= 1) t.mode = 'toTank'; }
      else if (t.mode === 'toTank') { const tp = tankPos(); if (driveTractor(t, tp.x, tp.y, dt) < 28) t.mode = 'emptying'; }
      else if (t.mode === 'emptying') { const give = Math.min(t.load, 0.9 * dt, F.waterMax - F.water); F.water = clamp(F.water + give, 0, F.waterMax); t.load -= give; if (Math.random() < 0.12 * dt) splash(tankPos().x + rand(-6, 6), tankPos().y - 6); if (t.load <= 0.5 || F.water >= F.waterMax) { t.mode = 'toDam'; updateHud(); } }
      else { t.mode = 'toDam'; }
      return;
    }
    t.mode = null;   // idle
  }
  function buyShears() { const c = shearsCost(); if (F.money < c || F.shearGear >= 5) return; F.money -= c; F.shearGear = (F.shearGear || 1) + 1; toast('✂️ Shears upgraded — ' + shearGearInfo().name + '!'); confetti(W / 2, H * 0.4, ['✂️', '⭐']); sfx.up(); persist(); }
  function buyHouse() { const c = houseCost(); if (F.money < c || F.house.level >= 5) return; F.money -= c; F.house.level++; toast('🏠 Farmhouse upgraded to Lv ' + F.house.level + '! (+worker cap)'); confetti(house.x, house.y, ['🏠', '⭐', '✨']); sfx.up(); persist(); }
  function buyPen() { if (F.money < PEN_COST) return; F.money -= PEN_COST; const pen = { x: paddock.x + paddock.w / 2 - 75, y: paddock.y + paddock.h / 2 - 60, w: 150, h: 118, gateOpen: true, gateSide: 0, stone: false, _init: true }; F.pens.push(pen); placing = pen; closeShop(); toast('🚧 Drag into place, then tap to drop.'); persist(); }
  function buyBuilding(k) { const bd = BUILD[k]; if (F.money < bd.coin || F.wood < bd.wood || F.stone < (bd.stone || 0)) return; F.money -= bd.coin; F.wood -= bd.wood; F.stone -= (bd.stone || 0); const n = F.buildings.length; const b = { bkind: k, x: clamp(paddock.x + paddock.w / 2 - bd.w / 2 + (n % 3 - 1) * 66, paddock.x + 4, paddock.x + paddock.w - bd.w - 4), y: paddock.y + paddock.h * 0.35 + (n % 4) * 40, w: bd.w, h: bd.h, cd: 0 }; F.buildings.push(b); placing = b; closeShop(); toast('🏗️ Place your ' + bd.name + ' — tap to drop.'); persist(); }
  function hireWorker(j) { if (workers.length >= workerCap()) return toast('Worker cap reached — build a 🛖 Bunkhouse or upgrade your house!'); const c = workerCost(); if (F.money < c) return; F.money -= c; workers.push(makeWorker(j)); syncWorkerJobs(); toast(WORKER[j].emoji + ' ' + WORKER[j].name + ' hired!'); confetti(house.x + 20, house.y + 30, ['👷', '🎉']); sfx.up(); persist(); }
  function fireWorker(i) { if (i < 0 || i >= workers.length) return; const w = workers[i]; workers.splice(i, 1); syncWorkerJobs(); toast('👋 ' + WORKER[w.job].name + ' was let go.'); pop(house.x + 20, house.y + 20, '👋', '#ff8a3d'); sfx.pop(); persist(); updateHud(); }
  const TROUGH_COST = 90;
  function buyTrough(kind) { if (F.money < TROUGH_COST) return; F.money -= TROUGH_COST; if (!F.extraTroughs) F.extraTroughs = []; const base = kind === 'feed' ? feedTrough : waterTrough; const y = clamp((base.y || paddock.y + paddock.h - 40) - 46, paddock.y + 30, paddock.y + paddock.h - 24), b = fieldBounds(y); F.extraTroughs.push({ kind, x: clamp((base.x || paddock.x + paddock.w / 2) + rand(-70, 70), b.left, b.right), y }); toast('🪣 New ' + (kind === 'feed' ? 'feed' : 'water') + ' trough — drag it where you like!'); sfx.build(); persist(); }
  function tankCost(kind) { const cur = kind === 'feed' ? F.feedMax : F.waterMax; return Math.round(140 * Math.pow(cur / 100, 1.25)); }
  function upgradeTank(kind) { const c = tankCost(kind); if (F.money < c) return; F.money -= c; if (kind === 'feed') F.feedMax += 80; else F.waterMax += 80; toast('🛢️ Bigger ' + (kind === 'feed' ? 'feed store' : 'water tank') + ' — now holds ' + (kind === 'feed' ? F.feedMax : F.waterMax) + '!'); confetti(W / 2, H * 0.4, ['🛢️', '💧', '✨']); sfx.up(); persist(); updateHud(); }
  function plantTree() { if (F.money < 70) return; F.money -= 70; const y = paddock.y + rand(paddock.h * 0.12, paddock.h * 0.55), b = fieldBounds(y); F.plants.push({ type: 'tree', x: rand(b.left + 12, b.right - 12), y, sz: rand(0.85, 1.15), wood: 100 }); toast('🌳 Planted a tree!'); sfx.pop(); persist(); }
  function addRock() { if (F.money < 90) return; F.money -= 90; const y = rand(paddock.y + paddock.h * 0.15, paddock.y + paddock.h * 0.5); const b = fieldBounds(y); F.plants.push({ type: 'rock', x: rand(b.left + 10, b.right - 10), y, sz: rand(0.9, 1.1), stone: 100 }); toast('🪨 A boulder was hauled in!'); sfx.pop(); persist(); }
  function plantBush() { if (F.money < 50) return; F.money -= 50; const y = rand(paddock.y + paddock.h * 0.35, paddock.y + paddock.h - 40); const b = fieldBounds(y); F.plants.push({ type: 'bush', x: rand(b.left + 10, b.right - 10), y, sz: 1, amt: 1 }); toast('🌿 Planted a grazing bush!'); sfx.pop(); persist(); }
  function callVet() { const sickN = sheep.filter(s => s.sick).length; if (!sickN) return; const cost = 40 + sickN * 20; if (F.money < cost) return; F.money -= cost; for (const s of sheep) if (s.sick) { s.sick = false; s.sickT = 0; s.heartT = 24; pop(s.x, s.y - 12, '💚', '#58e08a'); } toast('💊 The vet cured your flock!'); confetti(W / 2, H * 0.4, ['💚', '🩺', '✨']); sfx.up(); persist(); updateHud(); }

  // ---------- loop ----------
  let lastT = performance.now(), lastErr = null;
  function frame(nt) { let dt = (nt - lastT) / 16.6667; lastT = nt; dt = clamp(dt, 0, 2.5); try { if (shearSession) { shearUpdate(dt); shearRender(); } else { update(dt); render(); } if (musicOn) musicSched(); } catch (e) { lastErr = e; } requestAnimationFrame(frame); }
  window.addEventListener('beforeunload', persist);
  migrateLegacy();
  resize(); requestAnimationFrame(frame);

  if (location.hash.indexOf('debug') !== -1) {
    window.__farm = {
      start: startGame, step(n) { for (let i = 0; i < (n || 1); i++) update(1); render(); },
      upd(n) { for (let i = 0; i < (n || 1); i++) update(1); }, rnd(n) { for (let i = 0; i < (n || 1); i++) render(); },
      visibleSheep() { const CULL = 90, vx0 = cam.x - CULL, vy0 = cam.y - CULL, vx1 = cam.x + visW() + CULL, vy1 = cam.y + visH() + CULL; return sheep.filter(s => s.x >= vx0 && s.x <= vx1 && s.y >= vy0 && s.y <= vy1).length; },
      info() { return F ? { running, diff: F.diff, money: Math.floor(F.money), wool: Math.floor(F.wool), wood: Math.floor(F.wood), stone: Math.floor(F.stone), sheep: sheep.length, cap: F.sheepCap, feed: Math.floor(F.feed), water: Math.floor(F.water), era: F.farmLevel, house: F.house.level, energy: F.energy, workers: workers.length, workerCap: workerCap(), jobs: workers.reduce((m, w) => (m[w.job] = (m[w.job] || 0) + 1, m), {}), buildings: F.buildings.map(b => b.bkind), pens: F.pens.length, stonePens: F.pens.filter(p => p.stone).length, tech: Object.keys(F.tech).filter(k => F.tech[k]), preds: preds.length, wolves: preds.filter(p => p.wolf && !p.dead).length, plants: F.plants.length, herding: !!herdGoal, lambs: sheep.filter(s => s.role === 'lamb').length, rams: sheep.filter(s => s.role === 'ram').length, ewes: sheep.filter(s => s.role === 'ewe').length, night: +nightAmt().toFixed(2), isNight: isNight(), won: !!F.won, workerLvls: workers.map(w => w.level || 1), season: SEASONS[seasonIx()].name, weather: F.weather, sick: sheep.filter(s => s.sick).length, alpha: preds.filter(p => p.alpha && !p.dead).length } : { running }; },
      lastErr() { return lastErr ? String(lastErr && lastErr.stack || lastErr) : null; },
      give(m) { F.money += m; updateHud(); }, giveWood(w) { F.wood += w; updateHud(); }, giveStone(s) { F.stone += s; updateHud(); }, feed: refillFeed, water: refillWater, sell: sellWool,
      forceWool() { for (const s of sheep) if (s.role !== 'lamb') s.wool = 100; }, shearAll() { for (const s of sheep) if (s.wool >= 100 && s.role !== 'lamb') { if (!insideAnyPen(s.x, s.y)) { s.x = F.pens[0] ? F.pens[0].x + F.pens[0].w / 2 : s.x; s.y = F.pens[0] ? F.pens[0].y + F.pens[0].h / 2 : s.y; } shearSheep(s); } },
      spawnFox() { predTimer = -5; }, pushFox(wolf) { preds.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false, dead: false, facing: 1, wolf: !!wolf }); }, pushWolf() { preds.push({ x: paddock.x + 6, y: paddock.y + paddock.h / 2, fleeing: false, dead: false, facing: 1, wolf: true }); }, killFox() { const t = preds.find(p => !p.dead); if (t && dogs[0]) catchPredator(t, dogs[0]); },
      noFox() { F._nofox = true; preds.length = 0; }, foxOn() { F._nofox = false; },
      diff() { return F && F.diff; }, setDiff(k) { if (F && DIFFS[k]) { F.diff = k; preds.length = 0; updateHud(); } return F && F.diff; }, diffCfg() { return curDiff(); }, modeSelect(w) { showModeSelect(w || 'change'); }, chooseMode,
      forceBreed() { breedTimer = 0; for (const s of sheep) s.breedCD = 0; }, starve() { for (const s of sheep) { s.hunger = 100; s.thirst = 100; } F.feed = 0; F.water = 0; },
      addSheep(n) { for (let i = 0; i < (n || 1); i++) sheep.push(makeSheep({ role: i % 2 ? 'ram' : 'ewe', wool: 0 })); updateHud(); },
      satiate() { for (const s of sheep) { s.hunger = 8; s.thirst = 8; s.starve = 0; s.sick = false; } },
      shearStart(pct) { const p = F.pens[0]; let i = 0; for (const s of sheep) if (s.role !== 'lamb') { s.wool = pct != null ? pct : [70, 80, 90, 60, 82][i % 5]; i++; if (p) { s.x = p.x + p.w / 2 + rand(-p.w * 0.2, p.w * 0.2); s.y = p.y + p.h / 2 + rand(-p.h * 0.2, p.h * 0.2); } } const list = sheep.filter(x => x.wool >= SHEAR_MIN && x.role !== 'lamb' && insideAnyPen(x.x, x.y)); startShearSession(list); return list.length; },
      shearInfo() { const s = shearSession; return s ? { phase: s.phase, idx: s.idx, queue: s.queue.length, gone: s.gone, total: s.total, totalWool: s.totalWool, earned: s.earned, record: s.record, boss: s.boss, bossDone: s.bossDone, trophy: s.trophy, tally: s.tally, combo: s.combo, catchPct: s.catch ? s.catch.pct : null, breed: s.breed, sheepT: s.sheepT, par: s.par, breedRec: s.breedRec, lastTime: s.lastTime, lastTimeRec: s.lastTimeRec } : null; },
      shearPhase() { return shearSession ? shearSession.phase : null; },
      shearCatchNow() { const s = shearSession; if (!s || s.phase !== 'catch') return false; tryCatch(s.catch.x, s.catch.y); return s.phase; },
      shearMiss() { const s = shearSession; if (!s || s.phase !== 'catch') return; tryCatch(s.catch.x + 9999, s.catch.y); },
      shearSweep() { const s = shearSession; if (!s || s.phase !== 'shearing') return; s.clip.down = true; for (let y = s.cy - s.ry - 5; y <= s.cy + s.ry + 5; y += 7) for (let x = s.cx - s.rx - 5; x <= s.cx + s.rx + 5; x += 7) { s.clip.lx = s.clip.x; s.clip.ly = s.clip.y; s.clip.x = x; s.clip.y = y; shearUpdate(1); } s.clip.down = false; },
      shearAdvance() { const s = shearSession; if (s && s.phase === 'grade') advanceAfterGrade(); return s ? s.phase : null; },
      shearFinishAt(t) { const s = shearSession; if (!s || s.phase !== 'shearing') return null; s.sheepT = t; for (const w of s.tufts) w.gone = true; s.gone = s.total; shearUpdate(1); return { phase: s.phase, breed: s.breed, lastTime: s.lastTime, rec: s.lastTimeRec, par: s.lastPar, best: F.records.bestShear }; },
      bestTimes() { return F.records.bestShear; }, shearTuftCount() { return shearSession ? shearSession.total : null; },
      shedHands() { return F.shedHands; }, hireHand: hireShedHand, fireHand: fireShedHand,
      buyDam, upgradeDamAt(i) { if (F.dams[i]) upgradeDam(F.dams[i]); }, buyTrailer, buyTrough, upgradeTank, addTrough: buyTrough,
      damPos(i) { const d = F.dams[i || 0]; return d ? { x: Math.round(d.x), y: Math.round(d.y), r: Math.round(damR(d)), upBtn: damUpBtn(d) } : null; },
      damInfo() { return { dams: F.dams.map(d => ({ x: Math.round(d.x), y: Math.round(d.y), size: d.size, water: Math.round(d.water), cap: damCap(d.size) })), trailer: F.trailer, tractor: tractor ? { x: Math.round(tractor.x), y: Math.round(tractor.y), mode: tractor.mode, load: Math.round(tractor.load || 0) } : null }; },
      waterInfo() { return { feed: Math.round(F.feed), feedMax: F.feedMax, water: Math.round(F.water), waterMax: F.waterMax, extraTroughs: F.extraTroughs.length }; },
      stuckInfo() { return sheep.filter(s => s.stuck).map(s => ({ name: s.name, dam: s.stuckDam, t: Math.round(s.stuckT2 || 0) })); },
      forceStuck(i) { const s = sheep[i || 0], d = F.dams[0]; if (s && d) { s.x = d.x; s.y = d.y; s.stuck = true; s.stuckDam = 0; s.stuckT2 = 0; return true; } return false; },
      rescueFirst() { const s = sheep.find(x => x.stuck); if (s) rescueSheep(s); return !!s; },
      handInfo() { const s = shearSession; return s ? { hands: s.handHands, tail: s.handTail, idx: s.idx, sheared: s.handSheared, work: Math.round(s.handWork) } : null; },
      penInfo2(i) { const p = F.pens[i || 0]; return p ? { gateSide: p.gateSide, open: p.gateOpen, gw: Math.round(gateWidth(p)), doubleGone: !p.doubleGate ? true : gateSides(p).length === 1 } : null; },
      sheepOut(i) { const p = F.pens[i || 0]; if (!p) return null; return sheep.filter(s => !penInsideStrict(p, s.x, s.y)).length; },
      jamStats() { let maxStuck = 0, jammed = 0; for (const s of sheep) { const st = s.stuckT || 0; maxStuck = Math.max(maxStuck, st); if (st > 55) jammed++; } return { maxStuck: Math.round(maxStuck), jammed, sheep: sheep.length }; },
      spawnBreed(b, wool) { const p = F.pens[0]; const ns = makeSheep({ breed: b, role: 'ewe', wool: wool == null ? 80 : wool }); if (p) { ns.x = p.x + p.w / 2; ns.y = p.y + p.h / 2; } sheep.push(ns); updateHud(); return ns.id; },
      shearTap() { shearDown({ x: W / 2, y: H / 2 }); }, shearStep(n) { for (let i = 0; i < (n || 1); i++) shearUpdate(1); }, shearRenderNow() { if (shearSession) shearRender(); }, buyShears, gear() { return F.shearGear; }, records() { return F.records; },
      grade(p) { return woolGrade(p); }, fireWorker, forceBoss() { const s = shearSession; if (s) { s.idx = s.queue.length; s.bossDone = false; beginCatch(true); } },
      slot() { return curSlot; }, pickSlot, restart: restartFarm, slotSummary,
      hire: hireWorker, fire() { if (workers.length) { workers.pop(); syncWorkerJobs(); } }, setJob(i, j) { if (workers[i]) { workers[i].job = j; syncWorkerJobs(); } },
      research, techList() { return Object.keys(F.tech).filter(k => F.tech[k]); }, openResearch,
      buildKind: buyBuilding, addRock, dropPlacing() { placing = null; }, buyTractor, buyPen, buyHouse, buyEnergy, plantTree, plantBush, herdTo, gather: woofaGather, expand: buyExpand,
      buySheep, scrapBuild(i) { if (F.buildings[i]) scrapBuilding(F.buildings[i]); }, killAllSheep() { sheep.length = 0; updateHud(); },
      audio() { ensureAudio(); return { musicOn, hasCtx: !!actx }; }, tickMusic() { musicSched(); }, advClock(s) { if (actx && actx._adv) actx._adv(s); },
      penInfo() { return F.pens.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h), gate: p.gateSide, open: p.gateOpen, stone: !!p.stone })); },
      resizePen(i, w, h) { if (F.pens[i]) { F.pens[i].w = w; F.pens[i].h = h; } }, moveGate(i, side) { if (F.pens[i]) F.pens[i].gateSide = side; }, scrapPen(i) { if (F.pens[i]) scrapPen(F.pens[i]); }, selectPen(i) { selectedPen = F.pens[i] || null; }, stonePen(i) { if (F.pens[i]) upgradePenStone(F.pens[i]); }, closeGate(i) { if (F.pens[i]) F.pens[i].gateOpen = false; }, openGate(i) { if (F.pens[i]) F.pens[i].gateOpen = true; }, doubleGate(i) { if (F.pens[i]) F.pens[i].doubleGate = !F.pens[i].doubleGate; return F.pens[i] && F.pens[i].doubleGate; }, gateW(i) { return F.pens[i] ? Math.round(gateWidth(F.pens[i])) : 0; }, setEnergy(n) { F.energy = n; },
      sheepInPen(i) { const p = F.pens[i]; if (!p) return 0; return sheep.filter(s => penInsideStrict(p, s.x, s.y)).length; },
      treeWood() { return F.plants.filter(p => p.type === 'tree').map(p => Math.round(p.wood)); }, rockStone() { return F.plants.filter(p => p.type === 'rock').map(p => Math.round(p.stone)); },
      putSheepIn(i) { const p = F.pens[i]; if (!p) return; for (const s of sheep) { s.x = p.x + p.w / 2 + rand(-p.w * 0.3, p.w * 0.3); s.y = p.y + p.h / 2 + rand(-p.h * 0.3, p.h * 0.3); } },
      jamSheepAtGate(i) { const p = F.pens[i || 0], s = sheep[0]; if (!p || !s) return null; const g = gateCenterFor(p, p.gateSide); s.x = g.x + gateWidth(p) / 2 - 3; s.y = g.y - 3; s.tx = g.x; s.ty = g.y + 80; s.moveT = 200; s.stuckT = 0; s.ax = s.x; s.ay = s.y; return { x: Math.round(s.x), y: Math.round(s.y) }; },
      sheepPos(i) { const s = sheep[i || 0]; return s ? { x: Math.round(s.x), y: Math.round(s.y) } : null; },
      tutorial: startTutorial, sampleEwes(n) { let e = 0; for (let i = 0; i < (n || 100); i++) if (rollRole() === 'ewe') e++; return e; },
      setDay(phase) { F.dayT = phase * DAY_LEN; }, night() { return nightAmt(); }, goal() { return goalInfo(); }, levelUpAll() { for (const w of workers) { w.level = 5; } syncWorkerJobs(); }, workXp() { for (const w of workers) gainXp(w); },
      setSeason(i) { F.seasonT = i * SEASON_LEN; }, setWeather(w) { F.weather = w; }, makeSick(n) { let c = 0; for (const s of sheep) { if (c >= (n || 1)) break; if (s.role !== 'lamb' && !s.sick) { s.sick = true; s.sickT = 0; c++; } } return c; }, callVet, packRaid: spawnPack,
      camInfo() { return { zoom: +zoom.toFixed(3), scale: +worldScale().toFixed(2), worldW: Math.round(paddock.w), worldH: Math.round(paddock.h), viewW: Math.round(viewRect.w), viewH: Math.round(viewRect.h), camX: Math.round(cam.x), camY: Math.round(cam.y), visW: Math.round(visW()), visH: Math.round(visH()) }; },
      cam() { return { x: Math.round(cam.x), y: Math.round(cam.y), zoom: +zoom.toFixed(2) }; }, panTo(x, y) { centerCamOn(x, y); return this.cam(); }, panBy(dx, dy) { cam.x += dx; cam.y += dy; clampCam(); return this.cam(); }, zoomTo(z) { setZoom(z); return +zoom.toFixed(2); }, buyLand, miniRect() { return miniRect; }, worldMul() { return +worldMul().toFixed(2); },
      flockSpread() { if (sheep.length < 2) return 0; const c = flockCentroid(); let d = 0; for (const s of sheep) d += Math.hypot(s.x - c.x, s.y - c.y); return Math.round(d / sheep.length); },
      dbg() { return { pens: F.pens.length, placing: placing ? (placing.bkind || 'pen') : null, drag: drag ? drag.type : null, selected: !!selectedPen, herding: !!herdGoal, workers: workers.length, buildings: F.buildings.length, preds: preds.length }; },
    };
  }
})();
