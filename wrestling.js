/* Sheep Wrestling — full static pack for GitHub Pages (WOOF friend codes + arena). */
(function () {
  "use strict";

  // ─── Data ───────────────────────────────────────────────────────────
  const STAGES = [
    { key: "lamb", name: "Lamb", emoji: "🍼", mult: 0.55, maxLevel: 5, promoteCost: 40, size: 0.72 },
    { key: "yearling", name: "Yearling", emoji: "🐑", mult: 0.8, maxLevel: 8, promoteCost: 180, size: 0.88 },
    { key: "ram", name: "Ram", emoji: "🐏", mult: 1.05, maxLevel: 10, promoteCost: 650, size: 1.0 },
    { key: "prize", name: "Prize Ram", emoji: "🏅", mult: 1.35, maxLevel: 12, promoteCost: 2200, size: 1.12 },
    { key: "god", name: "God Ram", emoji: "⚡", mult: 1.75, maxLevel: 15, promoteCost: 8000, size: 1.28 },
    { key: "legend", name: "Legend", emoji: "👑", mult: 2.2, maxLevel: 20, promoteCost: 0, size: 1.42 },
  ];
  const STAGE_ORDER = STAGES.map((s) => s.key);
  function stageDef(k) { return STAGES.find((s) => s.key === k) || STAGES[0]; }
  function stageIndex(k) { return STAGE_ORDER.indexOf(k); }

  const BREEDS = {
    merino: { key: "merino", name: "Merino", emoji: "🐑", blurb: "Balanced farm fighter. Solid starter stock.", power: 10, toughness: 10, weight: 9, agility: 10, spirit: 10, charge: 9, cost: 0, rarity: "common", wool: "#efe7d2", body: "#d8c8a0", minStageUnlock: "lamb" },
    suffolk: { key: "suffolk", name: "Suffolk", emoji: "🖤", blurb: "Black face, heavy hits. Power specialist.", power: 14, toughness: 11, weight: 13, agility: 7, spirit: 9, charge: 12, cost: 220, rarity: "uncommon", wool: "#f0ece4", body: "#2a2428", minStageUnlock: "lamb" },
    blackface: { key: "blackface", name: "Blackface", emoji: "🛡️", blurb: "Tough as fence wire. Absorbs smashes.", power: 9, toughness: 15, weight: 12, agility: 7, spirit: 11, charge: 8, cost: 280, rarity: "uncommon", wool: "#e8e4dc", body: "#1c1816", minStageUnlock: "lamb" },
    dorper: { key: "dorper", name: "Dorper", emoji: "💨", blurb: "Quick on the charge. Hits then slips.", power: 11, toughness: 8, weight: 8, agility: 15, spirit: 10, charge: 13, cost: 320, rarity: "uncommon", wool: "#f6f2ea", body: "#c4a070", minStageUnlock: "yearling" },
    texel: { key: "texel", name: "Texel", emoji: "💪", blurb: "Dense muscle, brutal shove contests.", power: 13, toughness: 12, weight: 14, agility: 6, spirit: 9, charge: 10, cost: 540, rarity: "rare", wool: "#f4f0e8", body: "#b8a888", minStageUnlock: "yearling" },
    golden: { key: "golden", name: "Golden Fleece", emoji: "⭐", blurb: "Rare glitter stock. Spirit through the roof.", power: 14, toughness: 12, weight: 11, agility: 12, spirit: 16, charge: 13, cost: 2800, rarity: "epic", wool: "#ffd24a", body: "#e0a820", minStageUnlock: "ram" },
    midnight: { key: "midnight", name: "Midnight Ram", emoji: "🌑", blurb: "Night-bred bruiser. Scary charge energy.", power: 16, toughness: 14, weight: 13, agility: 11, spirit: 12, charge: 17, cost: 6200, rarity: "epic", wool: "#2a2830", body: "#121018", minStageUnlock: "prize" },
    thunderhead: { key: "thunderhead", name: "Thunderhead", emoji: "⛈️", blurb: "The hell-good one. Costs a fortune. Worth it.", power: 18, toughness: 17, weight: 16, agility: 14, spirit: 15, charge: 18, cost: 18000, rarity: "legendary", wool: "#dfe8f4", body: "#4a6080", minStageUnlock: "god" },
  };

  const FOODS = [
    { key: "pellets", name: "Basic Pellets", emoji: "🥣", cost: 12, blurb: "Fills the belly. Tiny all-round growth.", perm: { power: 0.15, toughness: 0.15, weight: 0.1 }, xp: 8, minStage: "lamb" },
    { key: "lucerne", name: "Lucerne Hay", emoji: "🌿", cost: 28, blurb: "Green gold. Builds toughness & weight.", perm: { toughness: 0.45, weight: 0.35, spirit: 0.1 }, xp: 14, minStage: "lamb" },
    { key: "oats", name: "Race Oats", emoji: "🌾", cost: 35, blurb: "Speedy fuel. Agility + charge.", perm: { agility: 0.5, charge: 0.35, power: 0.1 }, xp: 16, minStage: "lamb" },
    { key: "protein", name: "Protein Mash", emoji: "🥩", cost: 70, blurb: "Heavy training feed. Pure power.", perm: { power: 0.7, weight: 0.4, toughness: 0.2 }, xp: 28, minStage: "yearling" },
    { key: "champion", name: "Champion Chow", emoji: "🏆", cost: 160, blurb: "Show-ring diet. Big permanent gains.", perm: { power: 0.55, toughness: 0.55, spirit: 0.55, charge: 0.4 }, xp: 48, minStage: "ram" },
    { key: "thunder_mash", name: "Thunder Mash", emoji: "⚡", cost: 320, blurb: "Pre-fight fire. Temporary smash buff.", perm: { charge: 0.3 }, temp: { power: 4, charge: 5, spirit: 2 }, xp: 40, minStage: "ram" },
    { key: "golden_grain", name: "Golden Grain", emoji: "✨", cost: 900, blurb: "Fleece-tier feed. Serious permanent stats.", perm: { power: 1.2, toughness: 1.0, agility: 0.8, spirit: 1.0, charge: 1.0 }, xp: 90, minStage: "prize" },
    { key: "god_nectar", name: "God Nectar", emoji: "👑", cost: 2500, blurb: "Mythic sip. Only God Rams and up.", perm: { power: 2.2, toughness: 2.0, weight: 1.5, agility: 1.5, spirit: 2.0, charge: 2.2 }, temp: { power: 6, charge: 8 }, xp: 160, minStage: "god" },
  ];

  const TRAINING = [
    { key: "sprint", name: "Paddock Sprints", emoji: "🏃", cost: 25, blurb: "Agility work around the yards.", stats: { agility: 0.6, charge: 0.25 }, xp: 20 },
    { key: "push", name: "Fence Push", emoji: "🧱", cost: 30, blurb: "Lean into the rails. Weight & power.", stats: { weight: 0.55, power: 0.4 }, xp: 22 },
    { key: "horns", name: "Horn Drill", emoji: "📯", cost: 45, blurb: "Headbutt the sack. Charge mastery.", stats: { charge: 0.7, power: 0.35, spirit: 0.15 }, xp: 28 },
    { key: "bulk", name: "Bulk Block", emoji: "🏋️", cost: 55, blurb: "Heavy hay bales. Toughness tank.", stats: { toughness: 0.75, weight: 0.4 }, xp: 30 },
    { key: "spirit", name: "Crowd Work", emoji: "📣", cost: 40, blurb: "Walk-outs & noise. Spirit under pressure.", stats: { spirit: 0.8, agility: 0.15 }, xp: 24 },
    { key: "charge", name: "Full Charge", emoji: "💥", cost: 90, blurb: "Long run into the dummy. Hell hectic.", stats: { charge: 1.0, power: 0.5, spirit: 0.3 }, xp: 45 },
  ];

  const GEAR = [
    { key: "leather_collar", name: "Leather Collar", emoji: "🟤", cost: 80, blurb: "Farmyard swagger. +spirit.", slot: "collar", stats: { spirit: 1.5 } },
    { key: "iron_collar", name: "Iron Collar", emoji: "⚙️", cost: 320, blurb: "Protects the neck. +toughness.", slot: "collar", stats: { toughness: 3, weight: 1 } },
    { key: "gold_collar", name: "Champion Collar", emoji: "🥇", cost: 1400, blurb: "Show gold. Big spirit & power.", slot: "collar", stats: { spirit: 4, power: 2, charge: 1 } },
    { key: "horn_wrap", name: "Horn Wrap", emoji: "🩹", cost: 150, blurb: "Tape job. Safer clashes.", slot: "horns", stats: { toughness: 1.5, charge: 1.5 } },
    { key: "steel_tips", name: "Steel Horn Tips", emoji: "🗡️", cost: 900, blurb: "Nasty on impact. +power & charge.", slot: "horns", stats: { power: 3.5, charge: 3 } },
    { key: "wool_armor", name: "Thick Wool Coat", emoji: "🧥", cost: 600, blurb: "Extra padding. Soaks damage.", slot: "body", stats: { toughness: 4, weight: 2, agility: -0.5 } },
  ];

  const SHEEP_NAMES = ["Buster","Tank","Nugget","Thunder","Crusher","Woolly","Rambo","Brick","Diesel","Bazza","Shearer","Mutton","Knuckles","Boomer","Spike","Rusty","Havoc","Titan","Ruckus","Blaze","Grit","Paddock","Stomper","Kingpin","Outback","Fury","Moss","Cliff","Bolt","Maul"];
  const RARITY_COLOR = { common: "#8b95a8", uncommon: "#58e08a", rare: "#4bc0e0", epic: "#a06bff", legendary: "#ffd23d" };
  const STAT_KEYS = ["power", "toughness", "weight", "agility", "spirit", "charge"];
  const KEY = "woofa_wrestling_v1";

  // ─── RNG / combat ───────────────────────────────────────────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(parts) {
    let h = 2166136261;
    const s = parts.join("|");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function gearBonus(sheep) {
    const out = { power: 0, toughness: 0, weight: 0, agility: 0, spirit: 0, charge: 0 };
    [sheep.collar, sheep.horns, sheep.body].forEach((k) => {
      if (!k) return;
      const g = GEAR.find((x) => x.key === k);
      if (!g) return;
      Object.keys(g.stats).forEach((stat) => { out[stat] += g.stats[stat] || 0; });
    });
    return out;
  }
  function effectiveStats(sheep) {
    const mult = stageDef(sheep.stage).mult;
    const gear = gearBonus(sheep);
    const buffs = sheep.buffs || {};
    const out = {};
    STAT_KEYS.forEach((k) => { out[k] = Math.max(1, (sheep[k] + gear[k] + (buffs[k] || 0)) * mult); });
    return out;
  }
  function powerRating(sheep) {
    const s = effectiveStats(sheep);
    return Math.round(s.power * 1.3 + s.toughness * 1.1 + s.weight * 0.9 + s.agility * 0.85 + s.spirit * 0.7 + s.charge * 1.2 + sheep.level * 2 + stageDef(sheep.stage).size * 20);
  }
  function maxHp(sheep) {
    const s = effectiveStats(sheep);
    return Math.round(80 + s.toughness * 4.2 + s.weight * 2.4 + s.spirit * 1.2 + sheep.level * 3);
  }
  function maxStam(sheep) {
    const s = effectiveStats(sheep);
    return Math.round(40 + s.agility * 2.2 + s.spirit * 1.5 + s.charge * 0.8);
  }
  function cloneSheep(s) { return Object.assign({}, s, { buffs: s.buffs ? Object.assign({}, s.buffs) : undefined }); }
  function clearBuffs(sheep) { if (!sheep.buffs) return sheep; const n = Object.assign({}, sheep); delete n.buffs; return n; }

  function simulateFight(leftSheep, rightSheep, seed) {
    const rng = mulberry32(seed);
    const left = { sheep: leftSheep, displayName: leftSheep.name, maxHp: maxHp(leftSheep), hp: maxHp(leftSheep), maxStam: maxStam(leftSheep), stam: maxStam(leftSheep), stun: 0, chargeMeter: 0, side: "left" };
    const right = { sheep: rightSheep, displayName: rightSheep.name, maxHp: maxHp(rightSheep), hp: maxHp(rightSheep), maxStam: maxStam(rightSheep), stam: maxStam(rightSheep), stun: 0, chargeMeter: 0, side: "right" };
    const L = effectiveStats(leftSheep), R = effectiveStats(rightSheep);
    const events = [];
    let t = 0;
    const push = (e) => events.push(Object.assign({ t: t }, e));
    push({ kind: "approach", actor: "both", intensity: 0.3, text: "They lock eyes…" });
    t += 0.6 + rng() * 0.4;
    push({ kind: "cheer", actor: "both", intensity: 0.4, text: "CROWD GOES OFF" });
    let rounds = 0;
    while (left.hp > 0 && right.hp > 0 && rounds < 28) {
      rounds++; t += 0.35 + rng() * 0.25;
      if (left.stun > 0) left.stun -= 1;
      if (right.stun > 0) right.stun -= 1;
      left.chargeMeter += L.charge * 0.08 + rng() * 4;
      right.chargeMeter += R.charge * 0.08 + rng() * 4;
      const leftCan = left.stun <= 0 && left.stam > 4;
      const rightCan = right.stun <= 0 && right.stam > 4;
      if (!leftCan && !rightCan) {
        left.stam = Math.min(left.maxStam, left.stam + 8);
        right.stam = Math.min(right.maxStam, right.stam + 8);
        push({ kind: "recover", actor: "both", intensity: 0.2, text: "Breathing hard…" });
        continue;
      }
      const leftInit = leftCan ? L.agility * 0.6 + L.spirit * 0.3 + L.charge * 0.2 + rng() * 12 + (left.chargeMeter > 70 ? 8 : 0) : -999;
      const rightInit = rightCan ? R.agility * 0.6 + R.spirit * 0.3 + R.charge * 0.2 + rng() * 12 + (right.chargeMeter > 70 ? 8 : 0) : -999;
      const actor = leftInit >= rightInit ? "left" : "right";
      const atk = actor === "left" ? left : right;
      const def = actor === "left" ? right : left;
      const AS = actor === "left" ? L : R;
      const DS = actor === "left" ? R : L;
      atk.stam = Math.max(0, atk.stam - (6 + rng() * 5));
      def.stam = Math.max(0, def.stam - (3 + rng() * 3));
      const bigCharge = atk.chargeMeter >= 75 + rng() * 20;
      if (bigCharge) atk.chargeMeter = 0;
      const attackPower = AS.power * (bigCharge ? 1.55 : 1) + AS.charge * (bigCharge ? 0.9 : 0.35) + AS.weight * 0.35 + rng() * 14;
      const defensePower = DS.toughness * 0.9 + DS.weight * 0.45 + DS.spirit * 0.25 + rng() * 12;
      const margin = attackPower - defensePower;
      const intensity = Math.min(1, 0.35 + Math.abs(margin) / 40 + (bigCharge ? 0.25 : 0));
      if (bigCharge && margin > -4) {
        const dmg = Math.max(6, Math.round(AS.power * 0.85 + AS.charge * 0.7 + AS.weight * 0.25 - DS.toughness * 0.35 + rng() * 10));
        def.hp = Math.max(0, def.hp - dmg);
        if (rng() < 0.45) {
          def.stun = 1 + (rng() < 0.3 ? 1 : 0);
          push({ kind: "stun", actor: actor, damage: dmg, intensity: 1, text: atk.displayName + " THUNDER SMASH!" });
        } else {
          push({ kind: "crit", actor: actor, damage: dmg, intensity: 1, text: atk.displayName + " FULL SEND CHARGE!" });
        }
        push({ kind: "smash", actor: actor, damage: dmg, intensity: intensity, text: "💥 " + dmg });
      } else if (margin > 8) {
        const dmg = Math.max(4, Math.round(AS.power * 0.55 + AS.weight * 0.2 - DS.toughness * 0.28 + rng() * 8));
        def.hp = Math.max(0, def.hp - dmg);
        push({ kind: "smash", actor: actor, damage: dmg, intensity: intensity, text: atk.displayName + " SMASHES through!" });
        if (rng() < 0.22) { def.stun = 1; push({ kind: "stun", actor: actor, intensity: 0.7, text: "Dazed!" }); }
      } else if (margin > -6) {
        const dmgA = Math.max(2, Math.round(3 + rng() * 5 + AS.power * 0.12));
        const dmgB = Math.max(2, Math.round(3 + rng() * 5 + DS.power * 0.12));
        atk.hp = Math.max(0, atk.hp - dmgB * 0.55);
        def.hp = Math.max(0, def.hp - dmgA * 0.55);
        if (rng() < 0.5) push({ kind: "hornlock", actor: "both", intensity: 0.75, text: "HORNS LOCKED — grinding!" });
        else push({ kind: "clash", actor: "both", intensity: 0.7, text: "BANG — skulls collide!" });
        if (AS.weight + AS.power + rng() * 8 > DS.weight + DS.power + rng() * 8) {
          const dmg = Math.max(3, Math.round(AS.weight * 0.35 + rng() * 5));
          def.hp = Math.max(0, def.hp - dmg);
          push({ kind: "shove", actor: actor, damage: dmg, intensity: 0.65, text: atk.displayName + " shoves forward!" });
        } else {
          const dmg = Math.max(3, Math.round(DS.weight * 0.35 + rng() * 5));
          atk.hp = Math.max(0, atk.hp - dmg);
          push({ kind: "shove", actor: def.side, damage: dmg, intensity: 0.65, text: def.displayName + " digs in and shoves back!" });
        }
      } else {
        const dmg = Math.max(2, Math.round(DS.toughness * 0.25 + DS.power * 0.2 + rng() * 4));
        atk.hp = Math.max(0, atk.hp - dmg);
        push({ kind: "clash", actor: def.side, damage: dmg, intensity: 0.55, text: def.displayName + " shrugs it off!" });
      }
      left.stam = Math.min(left.maxStam, left.stam + 2.5 + L.spirit * 0.05);
      right.stam = Math.min(right.maxStam, right.stam + 2.5 + R.spirit * 0.05);
    }
    if (left.hp > 0 && right.hp > 0) {
      if (left.hp === right.hp) { if (rng() < 0.5) right.hp = 0; else left.hp = 0; }
      else if (left.hp > right.hp) right.hp = 0; else left.hp = 0;
      t += 0.3;
      push({ kind: "cheer", actor: "both", intensity: 0.8, text: "JUDGES CALL IT!" });
    }
    const winner = left.hp > 0 ? "left" : "right";
    t += 0.4;
    push({ kind: "ko", actor: winner, intensity: 1, text: (winner === "left" ? left.displayName : right.displayName) + " WINS!" });
    const winnerSheep = winner === "left" ? leftSheep : rightSheep;
    const loserSheep = winner === "left" ? rightSheep : leftSheep;
    const ratingDiff = powerRating(loserSheep) - powerRating(winnerSheep);
    const prize = Math.max(15, Math.round(28 + powerRating(loserSheep) * 0.35 + Math.max(0, ratingDiff) * 0.5 + stageDef(winnerSheep.stage).size * 12));
    return { seed: seed, events: events, winner: winner, duration: t, leftHpEnd: Math.max(0, left.hp), rightHpEnd: Math.max(0, right.hp), prize: prize, left: leftSheep, right: rightSheep };
  }

  // ─── Sheep helpers ──────────────────────────────────────────────────
  function uid() { return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function pickName(used) {
    const free = SHEEP_NAMES.filter((n) => !used.has(n));
    const pool = free.length ? free : SHEEP_NAMES;
    return pool[(Math.random() * pool.length) | 0];
  }
  function createSheep(opts) {
    opts = opts || {};
    const breed = opts.breed || "merino";
    const B = BREEDS[breed];
    const stage = opts.stage || "lamb";
    const v = opts.variance != null ? opts.variance : 1.5;
    const jitter = () => (Math.random() * 2 - 1) * v;
    const used = opts.usedNames || new Set();
    return {
      id: uid(), name: opts.name || pickName(used), breed: breed, stage: stage, level: 1, xp: 0,
      power: Math.max(3, B.power + jitter()), toughness: Math.max(3, B.toughness + jitter()),
      weight: Math.max(3, B.weight + jitter()), agility: Math.max(3, B.agility + jitter()),
      spirit: Math.max(3, B.spirit + jitter()), charge: Math.max(3, B.charge + jitter()),
      wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, bornAt: Date.now(),
      collar: null, horns: null, body: null, earnings: 0,
    };
  }
  function starterLamb() {
    const s = createSheep({ breed: "merino", stage: "lamb", name: "Nugget" });
    s.power = 8; s.toughness = 8; s.weight = 7; s.agility = 9; s.spirit = 10; s.charge = 7;
    return s;
  }
  function xpToLevel(level) { return Math.round(40 + level * 28 + level * level * 2.5); }
  function applyXp(sheep, amount) {
    let s = Object.assign({}, sheep);
    let xp = s.xp + amount;
    let leveled = 0;
    const maxLv = stageDef(s.stage).maxLevel;
    while (s.level < maxLv && xp >= xpToLevel(s.level)) {
      xp -= xpToLevel(s.level); s.level += 1; leveled += 1;
      s.power += 0.35 + Math.random() * 0.25;
      s.toughness += 0.35 + Math.random() * 0.25;
      s.weight += 0.2 + Math.random() * 0.2;
      s.agility += 0.25 + Math.random() * 0.2;
      s.spirit += 0.25 + Math.random() * 0.2;
      s.charge += 0.3 + Math.random() * 0.25;
    }
    s.xp = s.level >= maxLv ? 0 : xp;
    return { sheep: s, leveled: leveled };
  }
  function canPromote(sheep) {
    const st = stageDef(sheep.stage);
    return st.promoteCost > 0 && sheep.level >= st.maxLevel;
  }
  function promote(sheep) {
    const idx = stageIndex(sheep.stage);
    if (idx >= STAGE_ORDER.length - 1) return sheep;
    const next = STAGE_ORDER[idx + 1];
    return Object.assign({}, sheep, {
      stage: next, level: 1, xp: 0,
      power: sheep.power + 1.2, toughness: sheep.toughness + 1.2, weight: sheep.weight + 0.8,
      agility: sheep.agility + 0.6, spirit: sheep.spirit + 1, charge: sheep.charge + 1.1,
    });
  }
  function feedSheep(sheep, food) {
    let s = Object.assign({}, sheep);
    Object.keys(food.perm).forEach((k) => { s[k] = (s[k] || 0) + (food.perm[k] || 0); });
    if (food.temp) {
      s.buffs = Object.assign({}, s.buffs || {});
      Object.keys(food.temp).forEach((k) => { s.buffs[k] = (s.buffs[k] || 0) + (food.temp[k] || 0); });
    }
    return applyXp(s, food.xp).sheep;
  }
  function trainSheep(sheep, train) {
    let s = Object.assign({}, sheep);
    Object.keys(train.stats).forEach((k) => { s[k] = (s[k] || 0) + (train.stats[k] || 0); });
    return applyXp(s, train.xp).sheep;
  }
  function generateOpponent(targetRating, difficulty, seed) {
    let sseed = seed;
    const rng = () => { sseed = (sseed * 1664525 + 1013904223) >>> 0; return sseed / 4294967296; };
    const stageIdx = Math.min(STAGE_ORDER.length - 1, Math.max(0, Math.floor(difficulty * 1.1 + rng() * 1.2)));
    const stage = STAGE_ORDER[stageIdx];
    const unlocked = Object.keys(BREEDS).filter((k) => stageIndex(BREEDS[k].minStageUnlock) <= stageIdx);
    let breed = unlocked[(rng() * unlocked.length) | 0];
    if (difficulty >= 4 && rng() < 0.35 && unlocked.indexOf("golden") >= 0) breed = "golden";
    if (difficulty >= 6 && rng() < 0.3 && unlocked.indexOf("midnight") >= 0) breed = "midnight";
    if (difficulty >= 8 && rng() < 0.25 && unlocked.indexOf("thunderhead") >= 0) breed = "thunderhead";
    const s = createSheep({ breed: breed, stage: stage, name: SHEEP_NAMES[(rng() * SHEEP_NAMES.length) | 0], variance: 0.8 });
    s.level = Math.min(stageDef(stage).maxLevel, 1 + Math.floor(rng() * stageDef(stage).maxLevel * 0.85));
    s.seed = seed;
    let guard = 0;
    while (powerRating(s) < targetRating * (0.85 + difficulty * 0.03) && guard < 40) {
      s.power += 0.4; s.toughness += 0.35; s.weight += 0.25; s.agility += 0.25; s.spirit += 0.2; s.charge += 0.35; guard++;
    }
    return s;
  }

  // ─── Codes ──────────────────────────────────────────────────────────
  function serializeSheepLite(s) {
    return { n: s.name, b: s.breed, st: s.stage, lv: s.level, p: +s.power.toFixed(2), t: +s.toughness.toFixed(2), w: +s.weight.toFixed(2), a: +s.agility.toFixed(2), sp: +s.spirit.toFixed(2), c: +s.charge.toFixed(2), wi: s.wins, lo: s.losses, se: s.seed, col: s.collar || null, ho: s.horns || null, bo: s.body || null };
  }
  function deserializeSheepLite(o) {
    return {
      id: uid(), name: String(o.n || "Rival").slice(0, 16),
      breed: BREEDS[o.b] ? o.b : "merino",
      stage: STAGE_ORDER.indexOf(o.st) >= 0 ? o.st : "lamb",
      level: Math.max(1, Math.min(20, Number(o.lv) || 1)), xp: 0,
      power: Number(o.p) || 8, toughness: Number(o.t) || 8, weight: Number(o.w) || 8,
      agility: Number(o.a) || 8, spirit: Number(o.sp) || 8, charge: Number(o.c) || 8,
      wins: Number(o.wi) || 0, losses: Number(o.lo) || 0, seed: Number(o.se) || 1,
      bornAt: Date.now(), collar: o.col, horns: o.ho, body: o.bo, earnings: 0,
    };
  }
  function simpleChecksum(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 46656;
  }
  function encodeSheepCode(sheep) {
    const json = JSON.stringify(serializeSheepLite(sheep));
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const checksum = simpleChecksum(b64).toString(36).toUpperCase().padStart(3, "0");
    return "WOOF-" + checksum + "-" + b64;
  }
  function decodeSheepCode(raw) {
    try {
      const original = raw.trim().replace(/\s+/g, "");
      const parts = original.split("-");
      if (parts.length < 3 || parts[0].toUpperCase() !== "WOOF") return { ok: false, error: "Not a WOOF sheep code" };
      const body = parts.slice(2).join("-");
      const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64 + "===".slice((b64.length + 3) % 4);
      const json = decodeURIComponent(escape(atob(pad)));
      const sheep = deserializeSheepLite(JSON.parse(json));
      if (sheep.power > 80 || sheep.toughness > 80) return { ok: false, error: "Sheep stats look cheated — rejected" };
      return { ok: true, sheep: sheep };
    } catch (e) {
      return { ok: false, error: "Could not read that code" };
    }
  }

  // ─── Save ───────────────────────────────────────────────────────────
  function stableCap(level) { return 4 + level * 2; }
  function defaultSave() {
    const lamb = starterLamb();
    return {
      version: 1, coins: 120, trophies: 0, bestWinStreak: 0, winStreak: 0,
      sheep: [lamb], activeId: lamb.id, ownedGear: [], trainerLevel: 1, stableLevel: 1,
      totalFights: 0, playerName: "Farmer", lastDaily: null,
    };
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      const base = defaultSave();
      const merged = Object.assign({}, base, parsed, {
        version: 1,
        sheep: Array.isArray(parsed.sheep) && parsed.sheep.length ? parsed.sheep : base.sheep,
        ownedGear: Array.isArray(parsed.ownedGear) ? parsed.ownedGear : [],
      });
      if (!merged.activeId || !merged.sheep.some((s) => s.id === merged.activeId)) {
        merged.activeId = merged.sheep[0] ? merged.sheep[0].id : null;
      }
      return merged;
    } catch (e) { return defaultSave(); }
  }
  function persistSave(save) {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* quota */ }
  }

  // ─── State ──────────────────────────────────────────────────────────
  let save = loadSave();
  let screen = "home";
  let arenaList = [];
  let lastFight = null;
  let fightMode = null;
  let lastCode = null;
  let codeInput = "";
  let arenaAnim = null;

  function activeSheep() {
    return save.sheep.find((s) => s.id === save.activeId) || save.sheep[0] || null;
  }
  function patchSave(fn) {
    save = fn(save);
    persistSave(save);
    updateTop();
  }
  function toast(msg) {
    const el = document.getElementById("wToast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }
  function updateTop() {
    document.getElementById("wCoins").textContent = "🪙 " + Math.floor(save.coins);
    document.getElementById("wTrophies").textContent = "🏆 " + save.trophies;
    document.getElementById("wPlayerSub").textContent = save.playerName + "'s stable";
  }

  function refreshArena() {
    const active = activeSheep();
    if (!active) { arenaList = []; return; }
    const rating = powerRating(active);
    arenaList = [
      { id: "a1", title: "Yard Scrap", blurb: "A soft local lamb. Warm-up smash.", difficulty: 0, prize: 20, sheep: generateOpponent(rating * 0.72, 0, hashSeed([active.id, "a1", active.wins])) },
      { id: "a2", title: "District Bout", blurb: "Even fight. Expect horns.", difficulty: 2, prize: 45, sheep: generateOpponent(rating * 0.98, 2, hashSeed([active.id, "a2", active.wins])) },
      { id: "a3", title: "County Classic", blurb: "They hit hard. Bring feed buffs.", difficulty: 4, prize: 90, sheep: generateOpponent(rating * 1.12, 4, hashSeed([active.id, "a3", active.wins])) },
      { id: "a4", title: "State Smash", blurb: "Hectic. Prize rams live here.", difficulty: 6, prize: 180, sheep: generateOpponent(rating * 1.28, 6, hashSeed([active.id, "a4", active.wins])) },
      { id: "a5", title: "God Ram Gauntlet", blurb: "Hell hectic. Only legends leave standing.", difficulty: 9, prize: 400, sheep: generateOpponent(rating * 1.5, 9, hashSeed([active.id, "a5", active.wins])) },
    ];
  }

  // ─── Actions ────────────────────────────────────────────────────────
  function buySheep(breed) {
    const B = BREEDS[breed];
    if (save.sheep.length >= stableCap(save.stableLevel)) return toast("Stable full — upgrade the barn!");
    if (save.coins < B.cost) return toast("Not enough coins");
    const bestStage = Math.max(0, ...save.sheep.map((s) => stageIndex(s.stage)));
    if (stageIndex(B.minStageUnlock) > bestStage && B.cost > 0) return toast("Unlock by reaching " + B.minStageUnlock + " stage first");
    const used = new Set(save.sheep.map((s) => s.name));
    const lamb = createSheep({ breed: breed, stage: "lamb", usedNames: used });
    patchSave((s) => Object.assign({}, s, { coins: s.coins - B.cost, sheep: s.sheep.concat([lamb]), activeId: lamb.id }));
    toast("Welcome " + lamb.name + " the " + B.name + " lamb!");
    setScreen("stable");
  }
  function feed(foodKey) {
    const food = FOODS.find((f) => f.key === foodKey);
    const active = activeSheep();
    if (!food || !active) return;
    if (save.coins < food.cost) return toast("Not enough coins");
    if (stageIndex(active.stage) < stageIndex(food.minStage)) return toast("Only for " + food.minStage + "+ sheep");
    const fed = feedSheep(active, food);
    patchSave((s) => Object.assign({}, s, {
      coins: s.coins - food.cost,
      sheep: s.sheep.map((x) => (x.id === active.id ? fed : x)),
    }));
    toast(active.name + " ate " + food.name + "!");
    render();
  }
  function train(key) {
    const t = TRAINING.find((x) => x.key === key);
    const active = activeSheep();
    if (!t || !active) return;
    const cost = Math.round(t.cost * (1 - (save.trainerLevel - 1) * 0.06));
    if (save.coins < cost) return toast("Not enough coins");
    const trained = trainSheep(active, t);
    patchSave((s) => Object.assign({}, s, {
      coins: s.coins - cost,
      sheep: s.sheep.map((x) => (x.id === active.id ? trained : x)),
    }));
    toast(t.emoji + " " + active.name + " finished " + t.name);
    render();
  }
  function promoteActive() {
    const active = activeSheep();
    if (!active || !canPromote(active)) return toast("Max level this stage first");
    const cost = stageDef(active.stage).promoteCost;
    if (save.coins < cost) return toast("Need $" + cost + " to promote");
    const next = promote(active);
    patchSave((s) => Object.assign({}, s, {
      coins: s.coins - cost,
      sheep: s.sheep.map((x) => (x.id === active.id ? next : x)),
    }));
    toast("⬆️ " + next.name + " is now a " + stageDef(next.stage).name + "!");
    render();
  }
  function buyGear(key) {
    const g = GEAR.find((x) => x.key === key);
    if (!g) return;
    if (save.ownedGear.indexOf(key) >= 0) { equipGear(key); return; }
    if (save.coins < g.cost) return toast("Not enough coins");
    patchSave((s) => Object.assign({}, s, { coins: s.coins - g.cost, ownedGear: s.ownedGear.concat([key]) }));
    equipGear(key);
    toast("Bought " + g.name);
  }
  function equipGear(key) {
    const g = GEAR.find((x) => x.key === key);
    const active = activeSheep();
    if (!g || !active || save.ownedGear.indexOf(key) < 0) return;
    const slot = g.slot;
    patchSave((s) => Object.assign({}, s, {
      sheep: s.sheep.map((x) => {
        if (x.id !== active.id) return x;
        const n = Object.assign({}, x); n[slot] = key; return n;
      }),
    }));
    toast("Equipped " + g.name + " on " + active.name);
    render();
  }
  function claimDaily() {
    const today = new Date().toISOString().slice(0, 10);
    if (save.lastDaily === today) return toast("Daily already claimed");
    patchSave((s) => Object.assign({}, s, { lastDaily: today, coins: s.coins + 80 + s.trainerLevel * 15 }));
    toast("Daily bag collected! 🪙");
    render();
  }
  function startArenaFight(oppId) {
    const active = activeSheep();
    const opp = arenaList.find((o) => o.id === oppId);
    if (!active || !opp) return;
    const seed = hashSeed([active.id, opp.sheep.seed, active.wins, Date.now() & 0xffff]);
    const result = simulateFight(cloneSheep(active), cloneSheep(opp.sheep), seed);
    result.prize = Math.max(result.prize, opp.prize);
    lastFight = result;
    fightMode = "arena";
    playFight(result);
  }
  function exportCode() {
    const active = activeSheep();
    if (!active) return null;
    lastCode = encodeSheepCode(active);
    return lastCode;
  }
  function importCodeAndFight() {
    const active = activeSheep();
    if (!active) return;
    const decoded = decodeSheepCode(codeInput);
    if (!decoded.ok) return toast(decoded.error);
    const seed = hashSeed([active.id, decoded.sheep.seed, "code"]);
    const result = simulateFight(cloneSheep(active), cloneSheep(decoded.sheep), seed);
    lastFight = result;
    fightMode = "code";
    toast("Challenging " + decoded.sheep.name + "!");
    playFight(result);
  }
  function finishFight() {
    if (arenaAnim) { arenaAnim.stop(); arenaAnim = null; }
    document.getElementById("wFight").classList.remove("on");
    document.getElementById("wApp").classList.remove("fight-mode");
    if (!lastFight) { setScreen("arena"); return; }
    const active = activeSheep();
    if (!active) return;
    const won = lastFight.winner === "left";
    let next = Object.assign({}, active);
    if (won) {
      next.wins += 1;
      next.earnings += lastFight.prize;
      next = applyXp(next, 35 + Math.round(powerRating(lastFight.right) * 0.15)).sheep;
    } else {
      next.losses += 1;
      next = applyXp(next, 12).sheep;
    }
    next = clearBuffs(next);
    const winStreak = won ? save.winStreak + 1 : 0;
    const bestWinStreak = Math.max(save.bestWinStreak, winStreak);
    const coinDelta = won ? lastFight.prize : Math.max(5, Math.floor(lastFight.prize * 0.2));
    const trophyDelta = won ? (fightMode === "code" ? 2 : 1) + (winStreak >= 3 ? 1 : 0) : 0;
    patchSave((s) => Object.assign({}, s, {
      coins: s.coins + coinDelta,
      trophies: s.trophies + trophyDelta,
      winStreak: winStreak,
      bestWinStreak: bestWinStreak,
      totalFights: s.totalFights + 1,
      sheep: s.sheep.map((x) => (x.id === active.id ? next : x)),
    }));
    const res = document.getElementById("wResult");
    document.getElementById("wResultEmoji").textContent = won ? "🏆" : "💥";
    document.getElementById("wResultTitle").textContent = won ? "WIN!" : "DOWN!";
    document.getElementById("wResultBody").innerHTML =
      (won ? next.name + " smashed " + lastFight.right.name : lastFight.right.name + " smashed " + next.name) +
      "<br><b style='color:var(--w-primary)'>" + (won ? "+" : "+") + coinDelta + " coins</b>" +
      (trophyDelta ? " · +" + trophyDelta + " trophies" : "") +
      "<br>Record " + next.wins + "W – " + next.losses + "L";
    res.classList.add("on");
  }

  // ─── Arena canvas ───────────────────────────────────────────────────
  function playFight(fight) {
    document.getElementById("wApp").classList.add("fight-mode");
    document.getElementById("wFight").classList.add("on");
    document.getElementById("wNav").classList.add("hidden");
    document.getElementById("wLName").textContent = fight.left.name;
    document.getElementById("wRName").textContent = fight.right.name;
    const lMax = maxHp(fight.left), rMax = maxHp(fight.right);
    let lHp = lMax, rHp = rMax;
    const setHp = () => {
      document.getElementById("wLHp").style.width = Math.max(0, (lHp / lMax) * 100) + "%";
      document.getElementById("wRHp").style.width = Math.max(0, (rHp / rMax) * 100) + "%";
    };
    setHp();

    const canvas = document.getElementById("wArena");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, raf = 0, stopped = false;
    const resize = () => {
      const parent = canvas.parentElement;
      W = parent.clientWidth || 360;
      H = parent.clientHeight || 420;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let t = 0, last = performance.now();
    let shake = 0, flash = 0, banner = "", bannerT = 0, ei = 0;
    let lx = 0.34, rx = 0.66, lPose = 0, rPose = 0;
    const particles = [];
    const burst = (x, y, n, col) => {
      for (let i = 0; i < n; i++) {
        particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6 - 1, life: 0.6 + Math.random() * 0.5, c: col, r: 2 + Math.random() * 4 });
      }
    };
    const applyEvent = (ev) => {
      banner = ev.text || ""; bannerT = 1.1;
      if (ev.kind === "smash" || ev.kind === "crit" || ev.kind === "stun") {
        shake = 10 + ev.intensity * 14; flash = 0.45 + ev.intensity * 0.4;
        if (ev.actor === "left") { lx = 0.48; rx = 0.58; lPose = 1; if (ev.damage) rHp = Math.max(0, rHp - ev.damage); }
        else if (ev.actor === "right") { rx = 0.52; lx = 0.42; rPose = 1; if (ev.damage) lHp = Math.max(0, lHp - ev.damage); }
        burst(W * 0.5, H * 0.55, 14, "#ffd23d"); burst(W * 0.5, H * 0.55, 10, "#fff");
        setHp();
      } else if (ev.kind === "clash" || ev.kind === "hornlock") {
        shake = 8 + ev.intensity * 10; flash = 0.3; lx = 0.46; rx = 0.54; lPose = rPose = 0.8;
        burst(W * 0.5, H * 0.52, 12, "#e8c070");
      } else if (ev.kind === "shove") {
        shake = 6;
        if (ev.actor === "left") { lx = 0.5; rx = 0.62; if (ev.damage) rHp = Math.max(0, rHp - ev.damage); }
        else { rx = 0.5; lx = 0.38; if (ev.damage) lHp = Math.max(0, lHp - ev.damage); }
        burst(W * 0.5, H * 0.62, 8, "#c4a070"); setHp();
      } else if (ev.kind === "ko") {
        shake = 16; flash = 0.7; bannerT = 2.2; burst(W * 0.5, H * 0.5, 28, "#ffd23d");
        lHp = fight.leftHpEnd; rHp = fight.rightHpEnd; setHp();
      } else if (ev.kind === "approach") { lx = 0.3; rx = 0.7; }
    };
    const drawSheep = (s, x, y, facing, pose, scale) => {
      const B = BREEDS[s.breed];
      const st = stageDef(s.stage);
      const sc = scale * st.size;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * sc, sc);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(0, 18, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = B.body; ctx.lineWidth = 5; ctx.lineCap = "round";
      const legKick = pose * 8;
      [[-14, 8, -16, 22], [10, 8, 14 + legKick, 22], [-6, 8, -8, 22], [4, 8, 6 - legKick * 0.5, 22]].forEach((L) => {
        ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke();
      });
      ctx.fillStyle = B.wool;
      ctx.beginPath(); ctx.ellipse(0, -2, 26, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = B.body;
      ctx.beginPath(); ctx.ellipse(18, -8, 14, 12, 0.2, 0, Math.PI * 2); ctx.fill();
      // horns for ram+
      if (stageIndex(s.stage) >= 2) {
        ctx.strokeStyle = "#c8b090"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(22, -16); ctx.quadraticCurveTo(30, -28, 18, -30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, -18); ctx.quadraticCurveTo(8, -30, 20, -32); ctx.stroke();
      }
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(24, -10, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const tick = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000) * 1.15;
      last = now; t += dt;
      while (ei < fight.events.length && fight.events[ei].t <= t) {
        applyEvent(fight.events[ei]); ei++;
      }
      // ease poses back
      lx += (0.34 - lx) * Math.min(1, dt * 2.2);
      rx += (0.66 - rx) * Math.min(1, dt * 2.2);
      lPose = Math.max(0, lPose - dt * 2.5);
      rPose = Math.max(0, rPose - dt * 2.5);
      shake = Math.max(0, shake - dt * 28);
      flash = Math.max(0, flash - dt * 1.8);
      bannerT = Math.max(0, bannerT - dt);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 12 * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      const shx = (Math.random() - 0.5) * shake;
      const shy = (Math.random() - 0.5) * shake;
      ctx.clearRect(0, 0, W, H);
      // arena bg
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1a2840"); g.addColorStop(0.55, "#243018"); g.addColorStop(1, "#3a4a22");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // stands
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H * 0.22);
      ctx.fillStyle = "rgba(232,168,56,0.08)";
      for (let i = 0; i < 12; i++) ctx.fillRect(i * (W / 12) + 4, 8, W / 14, H * 0.14);
      // ring
      ctx.save(); ctx.translate(shx, shy);
      ctx.fillStyle = "#6b8f3a";
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.72, W * 0.42, H * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.72, W * 0.42, H * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
      const baseY = H * 0.62;
      drawSheep(fight.left, W * lx, baseY, 1, lPose, 1.05);
      drawSheep(fight.right, W * rx, baseY, -1, rPose, 1.05);
      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = "rgba(255,240,180," + (flash * 0.45) + ")";
        ctx.fillRect(0, 0, W, H);
      }
      if (bannerT > 0 && banner) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, H * 0.28, W, 40);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(banner, W / 2, H * 0.28 + 26);
      }
      if (ei >= fight.events.length && bannerT <= 0) {
        setTimeout(() => { if (!stopped) finishFight(); }, 400);
        stopped = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    arenaAnim = {
      stop: () => { stopped = true; cancelAnimationFrame(raf); },
    };
    raf = requestAnimationFrame(tick);
  }

  // ─── UI render ──────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;");
  }
  function sheepCardHtml(sheep, selected) {
    const B = BREEDS[sheep.breed];
    const st = stageDef(sheep.stage);
    return (
      '<button type="button" class="w-card' + (selected ? " sel" : "") + '" data-select="' + esc(sheep.id) + '">' +
      '<div class="w-sheep"><div class="w-av" style="background:' + B.wool + "33;border-color:" + B.body + '">' + st.emoji + "</div>" +
      '<div class="w-meta"><div class="name">' + esc(sheep.name) +
      ' <span style="font-size:11px;font-weight:700;color:' + (RARITY_COLOR[B.rarity] || "#aaa") + '">' + esc(B.name) + "</span></div>" +
      '<div class="sub">' + esc(st.name) + " · Lv " + sheep.level + " · ⚔️ " + powerRating(sheep) + "</div>" +
      '<div class="sub">' + sheep.wins + "W – " + sheep.losses + "L" + (sheep.buffs ? " · 🔥 buffed" : "") + "</div>" +
      "</div></div></button>"
    );
  }
  function statRowHtml(sheep) {
    const stats = effectiveStats(sheep);
    const rows = [
      { k: "PWR", v: stats.power, c: "#ff6b4a" },
      { k: "TUF", v: stats.toughness, c: "#58e08a" },
      { k: "WGT", v: stats.weight, c: "#c4a070" },
      { k: "AGI", v: stats.agility, c: "#4bc0e0" },
      { k: "SPI", v: stats.spirit, c: "#a06bff" },
      { k: "CHG", v: stats.charge, c: "#e8a838" },
    ];
    return '<div class="w-statgrid">' + rows.map((r) =>
      '<div class="w-stat"><div class="k">' + r.k + '</div><div class="v" style="color:' + r.c + '">' + r.v.toFixed(1) + "</div></div>"
    ).join("") + "</div>";
  }

  function renderHome() {
    const active = activeSheep();
    return (
      '<section class="w-hero"><div style="font-size:36px">🐏💥🐏</div>' +
      "<h1>SHEEP WRESTLING</h1>" +
      "<p>Raise lambs into God Rams. Feed them. Train them. Throw them in the ring and watch them <b style='color:var(--w-primary)'>smash head-to-head</b>. You don't steer the fight — the strongest sheep wins.</p>" +
      '<div class="w-row">' +
      '<button type="button" class="w-btn" data-go="arena">Enter Arena</button>' +
      '<button type="button" class="w-btn ghost" data-go="challenge">Friend Code</button>' +
      "</div></section>" +
      (active ? '<div class="w-section-lab">Active fighter</div>' + sheepCardHtml(active, true) + statRowHtml(active) : "") +
      '<div class="w-grid2" style="margin-top:12px">' +
      '<div class="w-card"><div class="w-muted">Win streak</div><div style="font-size:28px;font-weight:900;color:var(--w-primary)">' + save.winStreak + '</div><div class="w-muted">Best ' + save.bestWinStreak + "</div></div>" +
      '<div class="w-card"><div class="w-muted">Total fights</div><div style="font-size:28px;font-weight:900">' + save.totalFights + '</div><div class="w-muted">' + save.sheep.length + " sheep owned</div></div>" +
      "</div>" +
      '<div class="w-card" style="margin-top:10px"><label class="w-muted">Your farmer name</label>' +
      '<input class="w-input" id="wNameIn" maxlength="18" value="' + esc(save.playerName) + '" style="margin:8px 0"/>' +
      '<button type="button" class="w-btn good block" id="wDaily">Claim daily coins</button></div>' +
      '<div class="w-card"><div style="font-weight:800">How it works</div><ol class="w-muted" style="margin:8px 0 0;padding-left:18px;line-height:1.5">' +
      "<li>Start with a lamb. Feed & train until max level.</li>" +
      "<li>Promote → Yearling → Ram → Prize → God → Legend.</li>" +
      "<li>Buy hell-good breeds when you can afford them.</li>" +
      "<li>Arena AI or friend WOOF codes — pure auto smash.</li>" +
      "</ol></div>"
    );
  }
  function renderStable() {
    const active = activeSheep();
    const cap = stableCap(save.stableLevel);
    let html =
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">' +
      "<div><h2 class='w-h2'>Stable</h2><p class='w-muted'>" + save.sheep.length + "/" + cap + " pens · Barn lv " + save.stableLevel + "</p></div>" +
      '<button type="button" class="w-btn sm" id="wUpStable">Expand $' + (200 + save.stableLevel * 250) + "</button></div>";
    html += save.sheep.map((s) => sheepCardHtml(s, s.id === save.activeId)).join("");
    if (active) {
      const nextIdx = Math.min(STAGE_ORDER.length - 1, stageIndex(active.stage) + 1);
      html +=
        '<div class="w-card"><div style="font-weight:800;margin-bottom:8px">Manage ' + esc(active.name) + "</div>" +
        '<input class="w-input" id="wRename" maxlength="16" value="' + esc(active.name) + '"/>' +
        statRowHtml(active) +
        '<div class="w-muted" style="margin-top:8px">XP ' + Math.floor(active.xp) + "/" + xpToLevel(active.level) + " · " + stageDef(active.stage).name + "</div>" +
        (canPromote(active)
          ? '<button type="button" class="w-btn block" style="margin-top:10px" id="wPromote">Promote to ' + stageDef(STAGE_ORDER[nextIdx]).name + " ($" + stageDef(active.stage).promoteCost + ")</button>"
          : "") +
        "</div>";
    }
    return html;
  }
  function renderTrain() {
    const active = activeSheep();
    if (!active) return "<p>No sheep</p>";
    let html =
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">' +
      "<div><h2 class='w-h2'>Feed & Train</h2><p class='w-muted'>Powering up " + esc(active.name) + "</p></div>" +
      '<button type="button" class="w-btn sm" id="wUpTrain">Trainer lv ' + save.trainerLevel + " ↑</button></div>" +
      sheepCardHtml(active, true) +
      '<div class="w-section-lab">Food (permanent gains)</div>';
    FOODS.forEach((f) => {
      html +=
        '<button type="button" class="w-list-btn" data-feed="' + f.key + '">' +
        '<span style="font-size:24px">' + f.emoji + "</span>" +
        '<span style="flex:1;min-width:0"><b>' + esc(f.name) + "</b><br><span class='w-muted'>" + esc(f.blurb) + "</span></span>" +
        '<span style="font-weight:900;color:var(--w-primary)">$' + f.cost + "</span></button>";
    });
    html += '<div class="w-section-lab">Training yard</div>';
    TRAINING.forEach((t) => {
      const cost = Math.round(t.cost * (1 - (save.trainerLevel - 1) * 0.06));
      html +=
        '<button type="button" class="w-list-btn" data-train="' + t.key + '">' +
        '<span style="font-size:24px">' + t.emoji + "</span>" +
        '<span style="flex:1;min-width:0"><b>' + esc(t.name) + "</b><br><span class='w-muted'>" + esc(t.blurb) + "</span></span>" +
        '<span style="font-weight:900;color:var(--w-accent)">$' + cost + "</span></button>";
    });
    return html;
  }
  function renderShop() {
    let html = "<h2 class='w-h2'>Market</h2><p class='w-muted'>Lambs start cheap. Hell-good stock costs a fortune.</p>" +
      '<div class="w-section-lab">Sheep stock</div>';
    Object.keys(BREEDS).forEach((k) => {
      const b = BREEDS[k];
      html +=
        '<button type="button" class="w-list-btn" data-buy-breed="' + b.key + '">' +
        '<span style="font-size:24px">' + b.emoji + "</span>" +
        '<span style="flex:1;min-width:0"><b>' + esc(b.name) + '</b> <span style="font-size:10px;font-weight:800;color:' + RARITY_COLOR[b.rarity] + '">' + b.rarity.toUpperCase() + "</span>" +
        "<br><span class='w-muted'>" + esc(b.blurb) + "</span><br><span class='w-muted'>Unlock: " + b.minStageUnlock + "+</span></span>" +
        '<span style="font-weight:900;color:var(--w-primary)">' + (b.cost === 0 ? "FREE" : "$" + b.cost) + "</span></button>";
    });
    html += '<div class="w-section-lab">Gear</div>';
    GEAR.forEach((g) => {
      const owned = save.ownedGear.indexOf(g.key) >= 0;
      html +=
        '<button type="button" class="w-list-btn" data-buy-gear="' + g.key + '">' +
        '<span style="font-size:24px">' + g.emoji + "</span>" +
        '<span style="flex:1;min-width:0"><b>' + esc(g.name) + "</b><br><span class='w-muted'>" + esc(g.blurb) + "</span></span>" +
        '<span style="font-weight:900;color:var(--w-primary)">' + (owned ? "Equip" : "$" + g.cost) + "</span></button>";
    });
    return html;
  }
  function renderArena() {
    refreshArena();
    const active = activeSheep();
    let html =
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px">' +
      "<div><h2 class='w-h2'>Arena</h2><p class='w-muted'>Sit back. They smash. Strongest wins.</p></div>" +
      '<button type="button" class="w-btn sm" data-go="challenge">Codes</button></div>';
    if (active) html += sheepCardHtml(active, true);
    arenaList.forEach((o) => {
      html +=
        '<button type="button" class="w-list-btn" data-fight="' + o.id + '">' +
        '<div class="w-av" style="background:rgba(196,92,42,.25)">' + stageDef(o.sheep.stage).emoji + "</div>" +
        '<span style="flex:1;min-width:0"><b>' + esc(o.title) + "</b><br><span class='w-muted'>" + esc(o.blurb) + "</span>" +
        "<br><span class='w-muted'>vs " + esc(o.sheep.name) + " · ⚔️ " + powerRating(o.sheep) + " · Prize $" + o.prize + "</span></span>" +
        '<span class="go">›</span></button>';
    });
    return html;
  }
  function renderChallenge() {
    const active = activeSheep();
    return (
      '<button type="button" class="w-btn sm" data-go="arena" style="margin-bottom:10px">‹ Back to arena</button>' +
      "<h2 class='w-h2'>Friend Code Duels</h2>" +
      "<p class='w-muted' style='margin-bottom:12px'>Export your prized sheep as a <b style='color:var(--w-primary)'>WOOF</b> code. Your mate pastes it and the rams go hell hectic — no account needed.</p>" +
      (active ? sheepCardHtml(active, true) : "") +
      '<button type="button" class="w-btn block" id="wCopyCode" style="margin:10px 0">Copy my sheep code</button>' +
      (lastCode ? '<div class="w-code" id="wCodeOut">' + esc(lastCode) + "</div>" : "") +
      '<div class="w-section-lab">Paste rival code</div>' +
      '<textarea class="w-input" id="wCodeIn" placeholder="WOOF-…">' + esc(codeInput) + "</textarea>" +
      '<button type="button" class="w-btn block" id="wFightCode" style="margin-top:10px">Challenge code → SMASH</button>'
    );
  }

  function render() {
    updateTop();
    const main = document.getElementById("wMain");
    const map = { home: renderHome, stable: renderStable, train: renderTrain, shop: renderShop, arena: renderArena, challenge: renderChallenge };
    main.innerHTML = (map[screen] || renderHome)();
    document.querySelectorAll("#wNav button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-screen") === screen || (screen === "challenge" && b.getAttribute("data-screen") === "arena"));
    });
    document.getElementById("wNav").classList.toggle("hidden", false);
    bindMain();
  }

  function setScreen(s) {
    screen = s;
    render();
    var sc = document.getElementById("wScroll");
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function bindMain() {
    const main = document.getElementById("wMain");
    main.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => setScreen(el.getAttribute("data-go"))));
    main.querySelectorAll("[data-select]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-select");
      patchSave((s) => Object.assign({}, s, { activeId: id }));
      render();
    }));
    main.querySelectorAll("[data-feed]").forEach((el) => el.addEventListener("click", () => feed(el.getAttribute("data-feed"))));
    main.querySelectorAll("[data-train]").forEach((el) => el.addEventListener("click", () => train(el.getAttribute("data-train"))));
    main.querySelectorAll("[data-buy-breed]").forEach((el) => el.addEventListener("click", () => buySheep(el.getAttribute("data-buy-breed"))));
    main.querySelectorAll("[data-buy-gear]").forEach((el) => el.addEventListener("click", () => buyGear(el.getAttribute("data-buy-gear"))));
    main.querySelectorAll("[data-fight]").forEach((el) => el.addEventListener("click", () => startArenaFight(el.getAttribute("data-fight"))));
    const daily = document.getElementById("wDaily");
    if (daily) daily.addEventListener("click", claimDaily);
    const nameIn = document.getElementById("wNameIn");
    if (nameIn) nameIn.addEventListener("change", () => {
      patchSave((s) => Object.assign({}, s, { playerName: nameIn.value.trim().slice(0, 18) || "Farmer" }));
      updateTop();
    });
    const rename = document.getElementById("wRename");
    if (rename) rename.addEventListener("change", () => {
      const active = activeSheep();
      if (!active) return;
      const clean = rename.value.trim().slice(0, 16) || active.name;
      patchSave((s) => Object.assign({}, s, {
        sheep: s.sheep.map((x) => (x.id === active.id ? Object.assign({}, x, { name: clean }) : x)),
      }));
      render();
    });
    const promoteBtn = document.getElementById("wPromote");
    if (promoteBtn) promoteBtn.addEventListener("click", promoteActive);
    const upS = document.getElementById("wUpStable");
    if (upS) upS.addEventListener("click", () => {
      const cost = 200 + save.stableLevel * 250;
      if (save.coins < cost) return toast("Not enough coins");
      patchSave((s) => Object.assign({}, s, { coins: s.coins - cost, stableLevel: s.stableLevel + 1 }));
      toast("Stable expanded!");
      render();
    });
    const upT = document.getElementById("wUpTrain");
    if (upT) upT.addEventListener("click", () => {
      const cost = 150 + save.trainerLevel * 200;
      if (save.coins < cost) return toast("Not enough coins");
      patchSave((s) => Object.assign({}, s, { coins: s.coins - cost, trainerLevel: s.trainerLevel + 1 }));
      toast("Trainer level up!");
      render();
    });
    const copy = document.getElementById("wCopyCode");
    if (copy) copy.addEventListener("click", () => {
      const code = exportCode();
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => toast("Code copied — send it to a mate!")).catch(() => toast("Code ready — long-press to copy"));
      } else toast("Code ready — long-press to copy");
      render();
    });
    const codeIn = document.getElementById("wCodeIn");
    if (codeIn) codeIn.addEventListener("input", () => { codeInput = codeIn.value; });
    const fightCode = document.getElementById("wFightCode");
    if (fightCode) fightCode.addEventListener("click", importCodeAndFight);
  }

  // nav
  document.querySelectorAll("#wNav button").forEach((b) => {
    b.addEventListener("click", () => setScreen(b.getAttribute("data-screen")));
  });
  document.getElementById("wSkipFight").addEventListener("click", finishFight);
  document.getElementById("wResultOk").addEventListener("click", () => {
    document.getElementById("wResult").classList.remove("on");
    setScreen("arena");
  });

  updateTop();
  render();
})();
