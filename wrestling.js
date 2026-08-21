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


  const MOVES = [
    { id: "headbutt", name: "Headbutt", callout: "HORNS FIRST", tier: "basic", kind: "strike", minBattles: 0, damageMul: 0.7, meterGain: 12, meterCost: 0, canFinish: false, stunChance: 0.08 },
    { id: "shoulder", name: "Shoulder Block", callout: "HEAVY SHOULDER", tier: "basic", kind: "strike", minBattles: 0, damageMul: 0.65, meterGain: 10, meterCost: 0, canFinish: false, stunChance: 0.05 },
    { id: "hornlock", name: "Horn Lock", callout: "HORNS LOCKED", tier: "basic", kind: "lock", minBattles: 0, damageMul: 0.4, meterGain: 8, meterCost: 0, canFinish: false, stunChance: 0.12 },
    { id: "shove", name: "Paddock Shove", callout: "SHOVES THROUGH", tier: "basic", kind: "strike", minBattles: 0, damageMul: 0.55, meterGain: 8, meterCost: 0, canFinish: false, stunChance: 0.04 },
    { id: "rear_kick", name: "Rear Kick", callout: "BACK-HOOF!", tier: "basic", kind: "strike", minBattles: 0, damageMul: 0.6, meterGain: 9, meterCost: 0, canFinish: false, stunChance: 0.1 },
    { id: "irish_whip", name: "Irish Whip", callout: "INTO THE ROPES", tier: "basic", kind: "strike", minBattles: 1, damageMul: 0.5, meterGain: 14, meterCost: 0, canFinish: false, stunChance: 0.06 },
    { id: "paddock_driver", name: "Paddock Driver", callout: "PADDOCK DRIVER", tier: "power", kind: "slam", minBattles: 3, damageMul: 1.15, meterGain: 18, meterCost: 0, canFinish: false, stunChance: 0.22 },
    { id: "fleece_buster", name: "Fleece Buster", callout: "FLEECE BUSTER", tier: "power", kind: "slam", minBattles: 6, damageMul: 1.2, meterGain: 16, meterCost: 0, canFinish: false, stunChance: 0.28 },
    { id: "spinning_horn", name: "Spinning Horn", callout: "SPINNING HORN", tier: "power", kind: "strike", minBattles: 8, damageMul: 1.1, meterGain: 15, meterCost: 0, canFinish: false, stunChance: 0.18 },
    { id: "yard_slam", name: "Yard Slam", callout: "YARD SLAM", tier: "power", kind: "slam", minBattles: 10, damageMul: 1.25, meterGain: 18, meterCost: 0, canFinish: false, stunChance: 0.25 },
    { id: "turnbuckle_ram", name: "Turnbuckle Ram", callout: "INTO THE BUCKLE", tier: "power", kind: "charge", minBattles: 12, damageMul: 1.18, meterGain: 20, meterCost: 0, canFinish: false, stunChance: 0.2 },
    { id: "wool_suplex", name: "Wool Suplex", callout: "WOOL SUPLEX", tier: "power", kind: "slam", minBattles: 14, damageMul: 1.22, meterGain: 17, meterCost: 0, canFinish: false, stunChance: 0.24 },
    { id: "god_ram_spear", name: "God Ram Spear", callout: "GOD RAM SPEAR", tier: "super", kind: "charge", minBattles: 18, damageMul: 1.7, meterGain: 8, meterCost: 80, canFinish: true, stunChance: 0.45 },
    { id: "golden_splash", name: "Golden Fleece Splash", callout: "FROM THE TOP ROPE", tier: "super", kind: "aerial", minBattles: 22, damageMul: 1.65, meterGain: 8, meterCost: 80, canFinish: true, stunChance: 0.4 },
    { id: "steel_guillotine", name: "Steel Horn Guillotine", callout: "GUILLOTINE", tier: "super", kind: "strike", minBattles: 28, damageMul: 1.75, meterGain: 6, meterCost: 85, canFinish: true, stunChance: 0.5 },
    { id: "thunder_driver", name: "Thunder Driver", callout: "THUNDER DRIVER", tier: "super", kind: "slam", minBattles: 32, damageMul: 1.8, meterGain: 6, meterCost: 90, canFinish: true, stunChance: 0.48 },
    { id: "the_shearing", name: "The Shearing", callout: "THE SHEARING", tier: "rare", kind: "finisher", minBattles: 40, damageMul: 2.4, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1 },
    { id: "woolpocalypse", name: "Woolpocalypse", callout: "WOOLPOCALYPSE", tier: "rare", kind: "finisher", minBattles: 60, damageMul: 2.7, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1 },
    { id: "midnight_eclipse", name: "Midnight Eclipse", callout: "MIDNIGHT ECLIPSE", tier: "rare", kind: "finisher", minBattles: 80, minStage: "prize", damageMul: 2.9, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1 },
    { id: "thunderhead_judgment", name: "Thunderhead Judgment", callout: "THUNDERHEAD JUDGMENT", tier: "rare", kind: "finisher", minBattles: 0, minWins: 50, breed: "thunderhead", damageMul: 3.1, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1 },
    { id: "legends_last_charge", name: "Legend's Last Charge", callout: "LEGEND'S LAST CHARGE", tier: "rare", kind: "finisher", minBattles: 100, minStage: "legend", damageMul: 3.4, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1 },
  ];
  function isMoveUnlocked(move, fights, wins, stage, breed) {
    if (fights < (move.minBattles || 0)) return false;
    if (move.minWins && wins < move.minWins) return false;
    if (move.minStage && stageIndex(stage) < stageIndex(move.minStage)) return false;
    if (move.breed && breed !== move.breed) return false;
    return true;
  }
  function unlockedMoves(fights, wins, stage, breed) {
    return MOVES.filter((m) => isMoveUnlocked(m, fights, wins, stage, breed));
  }
  function lockReason(move) {
    const bits = [];
    if (move.minBattles) bits.push(move.minBattles + " bouts");
    if (move.minWins) bits.push(move.minWins + " wins");
    if (move.minStage) bits.push(stageDef(move.minStage).name + "+");
    if (move.breed) bits.push(BREEDS[move.breed].name + " only");
    return bits.length ? "Unlock: " + bits.join(" · ") : "Unlocked";
  }
  function pickMove(pool, rng, meter, wantFinish, requireRare, opponentLow) {
    const rares = pool.filter((m) => m.tier === "rare" && meter >= m.meterCost);
    const supers = pool.filter((m) => m.tier === "super" && meter >= m.meterCost);
    const powers = pool.filter((m) => m.tier === "power");
    const basics = pool.filter((m) => m.tier === "basic");
    if (wantFinish && opponentLow && rares.length) return rares[(rng() * rares.length) | 0];
    if (requireRare && opponentLow && rares.length && rng() < 0.7) return rares[(rng() * rares.length) | 0];
    if (opponentLow && supers.length && rng() < 0.55) return supers[(rng() * supers.length) | 0];
    if (supers.length && rng() < 0.18) return supers[(rng() * supers.length) | 0];
    if (powers.length && rng() < 0.42) return powers[(rng() * powers.length) | 0];
    const rest = basics.length ? basics : pool;
    return rest[(rng() * rest.length) | 0] || MOVES[0];
  }

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

  function simulateFight(leftSheep, rightSheep, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed);
    const requireRare = !!opts.requireRare;
    const career = opts.careerFights != null ? opts.careerFights : (leftSheep.wins + leftSheep.losses);
    const leftPool = unlockedMoves(Math.max(career, leftSheep.wins + leftSheep.losses), leftSheep.wins, leftSheep.stage, leftSheep.breed);
    const rightPool = unlockedMoves(Math.max(8, rightSheep.wins + rightSheep.losses + 12), Math.max(4, rightSheep.wins), rightSheep.stage, rightSheep.breed);
    const left = { sheep: leftSheep, displayName: leftSheep.name, maxHp: maxHp(leftSheep), hp: maxHp(leftSheep), maxStam: maxStam(leftSheep), stam: maxStam(leftSheep), stun: 0, meter: 20, side: "left" };
    const right = { sheep: rightSheep, displayName: rightSheep.name, maxHp: maxHp(rightSheep), hp: maxHp(rightSheep), maxStam: maxStam(rightSheep), stam: maxStam(rightSheep), stun: 0, meter: 16, side: "right" };
    const L = effectiveStats(leftSheep), R = effectiveStats(rightSheep);
    const events = [];
    let t = 0;
    const push = (e) => events.push(Object.assign({ t: t }, e));
    push({ kind: "lights", actor: "both", intensity: 0.4, text: "Lights down…" });
    t += 0.35;
    push({ kind: "entrance", actor: "left", intensity: 0.6, text: left.displayName + " walks." });
    t += 1.6;
    push({ kind: "entrance", actor: "right", intensity: 0.6, text: "And his opponent — " + right.displayName + "!" });
    t += 1.6;
    push({ kind: "crowd", actor: "both", intensity: 0.5, text: "The paddock is on its feet" });
    t += 0.5;
    push({ kind: "bell", actor: "both", intensity: 0.7, text: "DING DING DING" });
    t += 0.6;
    push({ kind: "lockup", actor: "both", intensity: 0.45, text: "They lock horns…" });
    t += 0.9;
    let rounds = 0, finishMoveId, usedRare = false;
    const nearfalls = { left: 0, right: 0 };
    while (left.hp > 0 && right.hp > 0 && rounds < 22) {
      rounds++; t += 0.5 + rng() * 0.32;
      if (left.stun > 0) left.stun -= 1;
      if (right.stun > 0) right.stun -= 1;
      left.meter = Math.min(100, left.meter + L.charge * 0.12 + rng() * 5);
      right.meter = Math.min(100, right.meter + R.charge * 0.12 + rng() * 5);
      left.stam = Math.min(left.maxStam, left.stam + 3 + L.spirit * 0.06);
      right.stam = Math.min(right.maxStam, right.stam + 3 + R.spirit * 0.06);
      const leftCan = left.stun <= 0 && left.stam > 6;
      const rightCan = right.stun <= 0 && right.stam > 6;
      if (!leftCan && !rightCan) {
        push({ kind: "recover", actor: "both", intensity: 0.25, text: "Breathing hard…" });
        left.stam += 10; right.stam += 10;
        continue;
      }
      const leftInit = leftCan ? L.agility * 0.6 + L.spirit * 0.3 + L.charge * 0.2 + rng() * 12 + (left.meter > 70 ? 8 : 0) : -999;
      const rightInit = rightCan ? R.agility * 0.6 + R.spirit * 0.3 + R.charge * 0.2 + rng() * 12 + (right.meter > 70 ? 8 : 0) : -999;
      const actor = leftInit >= rightInit ? "left" : "right";
      const atk = actor === "left" ? left : right;
      const def = actor === "left" ? right : left;
      const AS = actor === "left" ? L : R;
      const DS = actor === "left" ? R : L;
      const pool = actor === "left" ? leftPool : rightPool;
      const defLow = def.hp / def.maxHp < 0.28;
      const wantFinish = defLow && atk.meter >= 80;
      const move = pickMove(pool, rng, atk.meter, wantFinish, requireRare && actor === "left", defLow);
      if (rng() < 0.14 && def.stun <= 0) {
        atk.stam = Math.max(0, atk.stam - 5);
        push({ kind: "reversal", actor: def.side, intensity: 0.7, text: def.displayName + " reverses!" });
        const chip = Math.max(3, Math.round(DS.power * 0.18 + rng() * 4));
        atk.hp = Math.max(1, atk.hp - chip);
        continue;
      }
      atk.stam = Math.max(0, atk.stam - (8 + rng() * 6));
      atk.meter = Math.max(0, atk.meter - move.meterCost + move.meterGain);
      const dmg = Math.max(5, Math.round(AS.power * 0.42 * move.damageMul + AS.weight * 0.18 - DS.toughness * 0.22 + rng() * 8));
      const intensity = Math.min(1, 0.35 + dmg / 36 + (move.tier === "rare" ? 0.4 : 0));
      const wouldKill = def.hp - dmg <= 0;
      const rareMove = move.tier === "rare";
      const superMove = move.tier === "super" || rareMove;
      if (requireRare && wouldKill && !rareMove) {
        def.hp = Math.max(6, Math.round(def.maxHp * 0.08));
        push({ kind: superMove ? "super" : "move", actor: actor, moveId: move.id, damage: dmg, intensity: intensity, text: move.callout, slowmo: superMove, zoom: superMove ? 1.22 : 1 });
        t += 0.3;
        push({ kind: "kickout", actor: def.side, intensity: 0.9, text: def.displayName + " WILL NOT STAY DOWN" });
        nearfalls[def.side] += 1;
        def.stun = 0;
        continue;
      }
      def.hp = Math.max(0, def.hp - dmg);
      if (rng() < move.stunChance) def.stun = rareMove ? 2 : 1;
      if (rareMove) usedRare = true;
      const kind = rareMove ? "finisher" : superMove ? "super" : "move";
      push({ kind: kind, actor: actor, moveId: move.id, damage: dmg, intensity: intensity, text: move.callout, slowmo: superMove, zoom: rareMove ? 1.38 : superMove ? 1.2 : 1, timing: actor === "left" && move.tier !== "basic" });
      if (def.hp <= 0) { finishMoveId = move.id; break; }
      if (def.hp / def.maxHp < 0.22 && nearfalls[def.side] < 2 && rng() < 0.5) {
        t += 0.4;
        push({ kind: "nearfall", actor: actor, intensity: 0.85, text: "ONE… TWO…" });
        t += 0.5;
        push({ kind: "kickout", actor: def.side, intensity: 0.95, text: "KICKOUT!" });
        nearfalls[def.side] += 1;
        def.hp = Math.max(def.hp, Math.round(def.maxHp * 0.1));
      }
    }
    if (left.hp > 0 && right.hp > 0) {
      t += 0.35;
      push({ kind: "timeout", actor: "both", intensity: 0.7, text: "JUDGES CALL IT" });
      if (requireRare && !usedRare && left.hp >= right.hp) { right.hp = Math.max(right.hp, 1); left.hp = 0; }
      else if (left.hp === right.hp) { if (rng() < 0.5) right.hp = 0; else left.hp = 0; }
      else if (left.hp > right.hp) right.hp = 0; else left.hp = 0;
    }
    const winner = left.hp > 0 ? "left" : "right";
    t += 0.45;
    if (winner === "left" && (usedRare || finishMoveId)) {
      push({ kind: "pin", actor: "left", intensity: 1, text: "ONE… TWO… THREE!", slowmo: true, zoom: 1.3, moveId: finishMoveId });
      t += 1.0;
    }
    push({ kind: "ko", actor: winner, intensity: 1, text: (winner === "left" ? left.displayName : right.displayName) + " WINS" });
    t += 0.7;
    push({ kind: "celebrate", actor: winner, intensity: 1, text: winner === "left" ? "THE PADDOCK ERUPTS" : "The paddock goes quiet" });
    const winnerSheep = winner === "left" ? leftSheep : rightSheep;
    const loserSheep = winner === "left" ? rightSheep : leftSheep;
    const ratingDiff = powerRating(loserSheep) - powerRating(winnerSheep);
    const prize = Math.max(15, Math.round(28 + powerRating(loserSheep) * 0.35 + Math.max(0, ratingDiff) * 0.5 + stageDef(winnerSheep.stage).size * 12));
    return { seed: seed, events: events, winner: winner, duration: t, leftHpEnd: Math.max(0, left.hp), rightHpEnd: Math.max(0, right.hp), prize: prize, left: leftSheep, right: rightSheep, finishMoveId: finishMoveId, requiredRare: requireRare, usedRare: usedRare, title: opts.title || "Bout" };
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
    const fights = save.totalFights || 0;
    const hasShearing = isMoveUnlocked(MOVES.find((m) => m.id === "the_shearing"), fights, active.wins, active.stage, active.breed);
    const hasWool = isMoveUnlocked(MOVES.find((m) => m.id === "woolpocalypse"), fights, active.wins, active.stage, active.breed);
    arenaList = [
      { id: "a1", title: "Yard Scrap", blurb: "A soft local lamb. Warm-up smash.", difficulty: 0, prize: 20, requireRare: false, sheep: generateOpponent(rating * 0.72, 0, hashSeed([active.id, "a1", active.wins])) },
      { id: "a2", title: "District Bout", blurb: "Even fight. Named power moves start landing.", difficulty: 2, prize: 45, requireRare: false, sheep: generateOpponent(rating * 0.98, 2, hashSeed([active.id, "a2", active.wins])) },
      { id: "a3", title: "County Classic", blurb: "They hit hard. Bring feed buffs.", difficulty: 4, prize: 90, requireRare: false, sheep: generateOpponent(rating * 1.12, 4, hashSeed([active.id, "a3", active.wins])) },
      { id: "a4", title: "State Smash", blurb: "Hectic. Prize rams live here.", difficulty: 6, prize: 180, requireRare: false, sheep: generateOpponent(rating * 1.28, 6, hashSeed([active.id, "a4", active.wins])) },
      { id: "a5", title: "God Ram Gauntlet", blurb: "Hell hectic. Super finishers fly.", difficulty: 9, prize: 400, requireRare: false, sheep: generateOpponent(rating * 1.5, 9, hashSeed([active.id, "a5", active.wins])) },
      { id: "belt", title: "Paddock Championship", blurb: hasShearing ? "They will not stay down unless you hit a RARE finisher." : "Locked — The Shearing unlocks at 40 career bouts.", difficulty: 10, prize: 650, requireRare: true, locked: !hasShearing, sheep: generateOpponent(rating * 1.62, 10, hashSeed([active.id, "belt", active.wins])) },
      { id: "myth", title: "Woolpocalypse Title", blurb: hasWool ? "Mythic belt. Only Woolpocalypse (or rarer) puts them away." : "Locked — Woolpocalypse at 60 career bouts.", difficulty: 12, prize: 1200, requireRare: true, locked: !hasWool, sheep: generateOpponent(rating * 1.85, 12, hashSeed([active.id, "myth", active.wins])) },
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
    if (opp.locked) return toast(opp.blurb);
    const seed = hashSeed([active.id, opp.sheep.seed, active.wins, Date.now() & 0xffff]);
    const result = simulateFight(cloneSheep(active), cloneSheep(opp.sheep), seed, { requireRare: !!opp.requireRare, title: opp.title, careerFights: save.totalFights });
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
      (lastFight.finishMoveId ? "<br><b style='color:var(--w-primary)'>" + esc((MOVES.find(function(m){return m.id===lastFight.finishMoveId;})||{}).name || "Finisher") + "</b>" : "") +
      "<br><b style='color:var(--w-primary)'>" + (won ? "+" : "+") + coinDelta + " coins</b>" +
      (trophyDelta ? " · +" + trophyDelta + " trophies" : "") +
      "<br>Record " + next.wins + "W – " + next.losses + "L";
    res.classList.add("on");
  }

  function ramSrc(breed, pose) {
    if (pose === "down" || pose === "pin" || pose === "stunned") return "art/wrestle/ram-down.png";
    if (pose === "charge" || pose === "walk" || pose === "strike" || pose === "whip") return "art/wrestle/ram-charge.png";
    if (pose === "slam" || pose === "lift" || pose === "aerial" || pose === "roar" || pose === "celebrate") return "art/wrestle/ram-slam.png";
    if (breed === "golden") return "art/wrestle/ram-golden.png";
    if (breed === "midnight" || breed === "thunderhead") return "art/wrestle/ram-midnight.png";
    if (breed === "suffolk" || breed === "blackface") return "art/wrestle/ram-charge.png";
    return "art/wrestle/ram-idle.png";
  }
  const ART = {};
  function loadArt() {
    const urls = [
      "art/wrestle/ring.jpg","art/wrestle/ram-idle.png","art/wrestle/ram-charge.png",
      "art/wrestle/ram-slam.png","art/wrestle/ram-down.png","art/wrestle/ram-golden.png",
      "art/wrestle/ram-midnight.png"
    ];
    urls.forEach(function (u) {
      if (ART[u]) return;
      const img = new Image();
      img.src = u;
      ART[u] = img;
    });
  }
  function rps(p, a) {
    if (p === a) return "clash";
    if ((p === "strike" && a === "charge") || (p === "charge" && a === "grapple") || (p === "grapple" && a === "strike")) return "win";
    return "lose";
  }
  function gradeAt(t, a, b) {
    const mid = (a + b) / 2;
    if (Math.abs(t - mid) < 0.045) return "perfect";
    if (t >= a && t <= b) return "good";
    if (t >= a - 0.12 && t <= b + 0.12) return "ok";
    return "miss";
  }
  const GMUL = { miss: 0.35, ok: 0.75, good: 1, perfect: 1.35 };

  function playFight(fight) {
    loadArt();
    document.getElementById("wApp").classList.add("fight-mode");
    document.getElementById("wFight").classList.add("on");
    document.getElementById("wNav").classList.add("hidden");
    document.getElementById("wLName").textContent = fight.left.name;
    document.getElementById("wRName").textContent = fight.right.name;
    const titleEl = document.getElementById("wFightTitle");
    if (titleEl) titleEl.textContent = fight.title || (fight.requiredRare ? "TITLE" : "LIVE");
    const pickRow = document.getElementById("wPickRow");
    const skipBtn = document.getElementById("wSkipFight");
    const lMax = maxHp(fight.left), rMax = maxHp(fight.right);
    const L = effectiveStats(fight.left), R = effectiveStats(fight.right);
    const m = {
      phase: "entrance", t: 0, entranceT: 0, round: 0,
      lHp: lMax, rHp: rMax, lMeter: 18, rMeter: 12, lStun: 0, rStun: 0,
      lx: -0.1, rx: 1.1, lPose: "walk", rPose: "walk",
      banner: fight.left.name + " enters", callout: "",
      timing: 0, pinNeedle: 0, pinStep: 0, grade: null,
      playerPick: null, aiPick: null, lastMove: null, usedRare: false,
      trauma: 0, flash: 0, zoom: 1, slow: 1, particles: [], dmg: null, animT: 0, winner: null
    };
    const setHp = function () {
      document.getElementById("wLHp").style.width = Math.max(0, (m.lHp / lMax) * 100) + "%";
      document.getElementById("wRHp").style.width = Math.max(0, (m.rHp / rMax) * 100) + "%";
      const lm = document.getElementById("wLMeter");
      const rm = document.getElementById("wRMeter");
      if (lm) lm.style.width = Math.max(0, Math.min(100, m.lMeter)) + "%";
      if (rm) rm.style.width = Math.max(0, Math.min(100, m.rMeter)) + "%";
    };
    setHp();
    function syncUi() {
      if (pickRow) pickRow.style.display = m.phase === "pick" ? "grid" : "none";
      var pick2 = document.getElementById("wPickRow2");
      if (pick2) pick2.style.display = m.phase === "pick" ? "grid" : "none";
      if (skipBtn) {
        skipBtn.textContent = m.phase === "timing" || m.phase === "pin" ? "Tap the ring ›" : (m.phase === "over" ? "Continue ›" : "Skip ›");
        skipBtn.style.display = m.phase === "pick" ? "none" : "block";
      }
      const fin = document.getElementById("wFinisher");
      const pin = document.getElementById("wPin");
      if (fin) {
        const ready = m.lMeter >= 80 && m.rHp / rMax < 0.42;
        fin.disabled = !ready;
        fin.textContent = ready ? "FINISHER" : ("Super " + Math.round(m.lMeter));
      }
      if (pin) pin.disabled = !(m.rHp / rMax < 0.22 || m.rStun > 0);
    }
    syncUi();

    const canvas = document.getElementById("wArena");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, raf = 0, stopped = false;
    const resize = function () {
      const parent = canvas.parentElement;
      W = parent.clientWidth || 360;
      H = parent.clientHeight || 420;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    function burst(x, y, n, c) {
      for (let i = 0; i < n; i++) m.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 220, vy: -40 - Math.random() * 160, life: 0.4, r: 2 + Math.random() * 4, c: c });
    }
    function dmg(side, raw, text) {
      const d = Math.max(4, Math.round(raw));
      if (side === "right") { m.rHp = Math.max(0, m.rHp - d); m.dmg = { x: 0.68, y: 0.5, t: String(d), life: 0.7 }; }
      else { m.lHp = Math.max(0, m.lHp - d); m.dmg = { x: 0.32, y: 0.5, t: String(d), life: 0.7 }; }
      m.trauma = Math.min(1, m.trauma + Math.min(0.8, d / 40));
      m.flash = 0.3 + d / 90;
      m.callout = text;
      burst(side === "right" ? 0.62 : 0.38, 0.62, 12, "#f4efe4");
      setHp();
    }
    function bestFin() {
      const pool = unlockedMoves(save.totalFights, fight.left.wins, fight.left.stage, fight.left.breed).filter(function (x) { return x.canFinish && m.lMeter >= (x.meterCost || 80); });
      const rares = pool.filter(function (x) { return x.tier === "rare"; });
      if (fight.requiredRare && rares.length) return rares[rares.length - 1];
      if (rares.length) return rares[rares.length - 1];
      const supers = pool.filter(function (x) { return x.tier === "super"; });
      return supers[supers.length - 1] || pool[pool.length - 1] || null;
    }
    function powerMove(side, kind) {
      const sh = side === "left" ? fight.left : fight.right;
      const fights = side === "left" ? save.totalFights : 12;
      const pool = unlockedMoves(fights, sh.wins, sh.stage, sh.breed);
      const kinds = kind === "strike" ? ["strike"] : kind === "charge" ? ["charge"] : ["lock", "slam"];
      const matches = pool.filter(function (x) { return kinds.indexOf(x.kind) >= 0 && x.tier !== "rare"; });
      const powers = matches.filter(function (x) { return x.tier === "power" || x.tier === "super"; });
      const src = powers.length ? powers : (matches.length ? matches : pool);
      return src[(Math.random() * src.length) | 0] || MOVES[0];
    }
    function aiPick() {
      const wS = R.power + R.agility * 0.4, wG = R.weight + R.toughness * 0.4, wC = R.charge + R.spirit * 0.3;
      const r = Math.random() * (wS + wG + wC);
      if (r < wS) return "strike";
      if (r < wS + wG) return "grapple";
      return "charge";
    }
    function resolve(g) {
      const mul = GMUL[g] || 1;
      m.grade = g;
      m.phase = "anim";
      m.animT = 0;
      m.slow = g === "perfect" || m.playerPick === "finisher" ? 0.45 : 1;
      m.zoom = m.playerPick === "finisher" ? 1.26 : 1.08;
      m.round += 1;
      if (m.playerPick === "finisher" && m.lastMove) {
        if (g === "miss") {
          m.banner = "WHIFFED"; m.lPose = "stunned"; m.rPose = "strike";
          m.lMeter = Math.max(40, m.lMeter - 25);
          dmg("left", R.power * 0.25, "PUNISHED");
        } else {
          const mv = m.lastMove;
          m.lMeter = 0;
          if (mv.tier === "rare") m.usedRare = true;
          fight.finishMoveId = mv.id;
          m.lPose = "slam"; m.rPose = "down";
          dmg("right", (L.power * (mv.damageMul || 2) + L.charge * 0.4) * mul * 0.85, mv.callout || mv.name);
          m.banner = mv.callout || mv.name;
          m.rStun = 2;
          if (fight.requiredRare && mv.tier !== "rare" && m.rHp <= 0) {
            m.rHp = Math.max(8, Math.round(rMax * 0.08));
            m.banner = fight.right.name + " WILL NOT STAY DOWN";
          }
        }
        setHp(); syncUi(); return;
      }
      const p = m.playerPick || "strike";
      const a = m.aiPick || "strike";
      const res = rps(p, a);
      if (res === "clash" && g !== "perfect") {
        m.banner = "HORN LOCK"; m.lPose = "lock"; m.rPose = "lock"; m.lx = 0.44; m.rx = 0.56;
        dmg("right", (4 + L.weight * 0.15) * mul * 0.6, "CLASH");
        dmg("left", (4 + L.weight * 0.15) * mul * 0.45, "CLASH");
        m.lMeter = Math.min(100, m.lMeter + 10 * mul);
        return;
      }
      const playerWins = res === "win" || (res === "clash" && g === "perfect") || (res === "lose" && g === "perfect");
      if (playerWins && res === "lose") {
        m.banner = "REVERSAL"; m.lPose = "slam"; m.rPose = "down";
        dmg("right", L.power * 0.55 * mul, "REVERSAL");
        m.lMeter = Math.min(100, m.lMeter + 18);
        return;
      }
      if (playerWins) {
        const mv = powerMove("left", p);
        m.lastMove = mv;
        const raw = (L.power * mv.damageMul * 0.55 + L.weight * 0.2 + L.charge * 0.15 - R.toughness * 0.12) * mul;
        m.lPose = p === "charge" ? "charge" : (p === "grapple" ? "lift" : "strike");
        m.rPose = "stunned";
        m.lx = p === "charge" ? 0.5 : 0.4; m.rx = 0.66;
        dmg("right", raw, mv.callout || mv.name);
        m.banner = mv.callout || mv.name;
        m.lMeter = Math.min(100, m.lMeter + (mv.meterGain || 12) * mul);
        if (fight.requiredRare && m.rHp <= 0 && !m.usedRare) {
          m.rHp = Math.max(8, Math.round(rMax * 0.1));
          m.banner = fight.right.name + " KICKS OUT";
        }
      } else {
        const mv = powerMove("right", a);
        const raw = (R.power * mv.damageMul * 0.5 + R.weight * 0.18 - L.toughness * 0.14) * (g === "miss" ? 1.15 : 0.85);
        m.rPose = a === "charge" ? "charge" : "strike";
        m.lPose = "stunned";
        m.rx = 0.5; m.lx = 0.32;
        dmg("left", raw, mv.callout || mv.name);
        m.banner = fight.right.name + " — " + (mv.callout || mv.name);
        m.rMeter = Math.min(100, m.rMeter + 14);
      }
      setHp();
    }
    function end(winner) {
      m.phase = "over";
      m.winner = winner;
      m.banner = winner === "left" ? fight.left.name + " WINS" : fight.right.name + " WINS";
      m.lPose = winner === "left" ? "celebrate" : "down";
      m.rPose = winner === "right" ? "celebrate" : "down";
      if (winner === "left") m.rHp = 0; else m.lHp = 0;
      setHp(); syncUi();
      burst(0.5, 0.45, 28, "#c45c2a");
      fight.winner = winner;
      fight.leftHpEnd = m.lHp;
      fight.rightHpEnd = m.rHp;
      fight.usedRare = m.usedRare;
      setTimeout(function () { if (!stopped) finishFight(); }, 1400);
    }
    function choose(pick) {
      if (m.phase !== "pick") return;
      if (pick === "pin") {
        if (!(m.rHp / rMax < 0.22 || m.rStun > 0)) return;
        m.phase = "pin"; m.pinStep = 0; m.pinNeedle = 0; m.banner = "PIN!"; m.lPose = "pin"; m.rPose = "down";
        syncUi(); return;
      }
      if (pick === "finisher") {
        const fin = bestFin();
        if (!fin) return;
        m.playerPick = "finisher"; m.lastMove = fin; m.aiPick = aiPick();
        m.phase = "timing"; m.timing = 0; m.banner = fin.callout || fin.name; m.callout = "HIT THE WINDOW";
        syncUi(); return;
      }
      m.playerPick = pick; m.aiPick = aiPick();
      m.phase = "timing"; m.timing = 0; m.banner = pick.toUpperCase(); m.callout = "TAP THE COPPER";
      syncUi();
    }
    function tap() {
      if (m.phase === "entrance") { m.entranceT = 3.2; return; }
      if (m.phase === "timing") { resolve(gradeAt(m.timing, 0.6, 0.78)); syncUi(); return; }
      if (m.phase === "pin") {
        const g = gradeAt(m.pinNeedle, 0.45, 0.75);
        if (g === "miss") {
          m.phase = "anim"; m.animT = 0; m.banner = "KICKOUT!"; m.rPose = "roar"; m.rStun = 0;
          m.rHp = Math.max(m.rHp, Math.round(rMax * 0.08)); setHp(); syncUi(); return;
        }
        m.pinStep += 1; m.pinNeedle = 0;
        m.banner = m.pinStep === 1 ? "ONE!" : m.pinStep === 2 ? "TWO!" : "THREE!";
        if (m.pinStep >= 3) {
          if (fight.requiredRare && !m.usedRare) {
            m.phase = "anim"; m.animT = 0; m.banner = fight.right.name + " WILL NOT STAY DOWN";
            m.rHp = Math.max(12, Math.round(rMax * 0.12)); m.rPose = "roar"; m.pinStep = 0; setHp();
          } else end("left");
        }
        syncUi();
      }
    }

    canvas.onclick = tap;
    ["wStrike", "wGrapple", "wCharge", "wFinisher", "wPin"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.onclick = function (e) {
        e.stopPropagation();
        choose(id === "wStrike" ? "strike" : id === "wGrapple" ? "grapple" : id === "wCharge" ? "charge" : id === "wFinisher" ? "finisher" : "pin");
      };
    });

    let last = performance.now();
    function drawRam(sheep, x, y, facing, pose) {
      const src = ramSrc(sheep.breed, pose);
      const img = ART[src];
      const size = stageDef(sheep.stage).size;
      const w = 220 * size;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing, 1);
      if (img && img.complete && img.naturalWidth) {
        const s = Math.min(w / img.naturalWidth, w / img.naturalHeight) * 1.1;
        ctx.drawImage(img, (-img.naturalWidth * s) / 2, -img.naturalHeight * s, img.naturalWidth * s, img.naturalHeight * s);
      } else {
        ctx.fillStyle = BREEDS[sheep.breed].wool;
        ctx.beginPath(); ctx.ellipse(0, -28, 34, 24, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function tick(now) {
      if (stopped) return;
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      dt *= m.slow;
      m.t += dt;
      m.trauma = Math.max(0, m.trauma - dt * 1.6);
      m.flash = Math.max(0, m.flash - dt * 2.2);
      m.zoom += (1 - m.zoom) * (1 - Math.exp(-2.4 * dt));
      m.slow += (1 - m.slow) * (1 - Math.exp(-2.2 * dt));
      if (m.dmg) { m.dmg.life -= dt; if (m.dmg.life <= 0) m.dmg = null; }
      for (let i = m.particles.length - 1; i >= 0; i--) {
        const p = m.particles[i];
        p.x += p.vx * dt * 0.01; p.y += p.vy * dt * 0.01; p.vy += 18 * dt; p.life -= dt;
        if (p.life <= 0) m.particles.splice(i, 1);
      }
      if (m.phase === "entrance") {
        m.entranceT += dt;
        m.lx += (0.32 - m.lx) * (1 - Math.exp(-1.6 * dt));
        if (m.entranceT > 1.4) {
          m.rx += (0.68 - m.rx) * (1 - Math.exp(-1.6 * dt));
          m.banner = "And his opponent — " + fight.right.name + "!";
        }
        if (m.entranceT > 3.1) {
          m.phase = "pick"; m.banner = "DING DING DING"; m.callout = "Pick your attack";
          m.lPose = "idle"; m.rPose = "idle"; m.lx = 0.34; m.rx = 0.66; syncUi();
        }
      } else if (m.phase === "timing") {
        m.timing += dt / 0.92;
        if (m.timing >= 1) { m.timing = 1; resolve("miss"); syncUi(); }
      } else if (m.phase === "pin") {
        m.pinNeedle += dt / 0.85;
        if (m.pinNeedle >= 1) {
          m.pinNeedle = 0; m.phase = "anim"; m.animT = 0; m.banner = "KICKOUT!"; m.rPose = "roar"; m.rStun = 0; syncUi();
        }
      } else if (m.phase === "anim") {
        m.animT += dt;
        if (m.animT > 0.55) {
          m.lx += (0.34 - m.lx) * (1 - Math.exp(-4 * dt));
          m.rx += (0.66 - m.rx) * (1 - Math.exp(-4 * dt));
        }
        if (m.animT > 1.05) {
          if (m.lHp <= 0) end("right");
          else if (m.rHp <= 0) {
            if (fight.requiredRare && !m.usedRare) {
              m.rHp = Math.max(10, Math.round(rMax * 0.1)); m.banner = fight.right.name + " WILL NOT STAY DOWN";
              m.phase = "pick"; m.rPose = "roar"; setHp(); syncUi();
            } else end("left");
          } else {
            m.phase = "pick";
            m.lStun = Math.max(0, m.lStun - 1); m.rStun = Math.max(0, m.rStun - 1);
            m.lPose = m.lStun ? "stunned" : "idle"; m.rPose = m.rStun ? "stunned" : "idle";
            m.playerPick = null; m.aiPick = null; m.grade = null;
            if (m.round >= 18) end(m.lHp >= m.rHp ? "left" : "right");
            else syncUi();
          }
        }
      } else if (m.phase === "pick") {
        m.lMeter = Math.min(100, m.lMeter + dt * (4 + L.charge * 0.08));
        m.rMeter = Math.min(100, m.rMeter + dt * 3);
        m.lx += (0.34 - m.lx) * (1 - Math.exp(-3 * dt));
        m.rx += (0.66 - m.rx) * (1 - Math.exp(-3 * dt));
        setHp();
      }

      const sh = m.trauma * m.trauma;
      const shx = (Math.random() - 0.5) * sh * 18;
      const shy = (Math.random() - 0.5) * sh * 12;
      ctx.clearRect(0, 0, W, H);
      const ring = ART["art/wrestle/ring.jpg"];
      if (ring && ring.complete && ring.naturalWidth) {
        const sc = Math.max(W / ring.naturalWidth, H / ring.naturalHeight);
        const rw = ring.naturalWidth * sc, rh = ring.naturalHeight * sc;
        ctx.drawImage(ring, (W - rw) / 2, (H - rh) / 2 - H * 0.04, rw, rh);
        ctx.fillStyle = "rgba(8,8,10,0.28)"; ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "#1a1c24"; ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(W / 2 + shx, H / 2 + shy);
      ctx.scale(m.zoom, m.zoom);
      ctx.translate(-W / 2, -H / 2);
      const floorY = H * 0.72;
      drawRam(fight.left, m.lx * W, floorY, 1, m.lPose);
      drawRam(fight.right, m.rx * W, floorY, -1, m.rPose);
      m.particles.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, p.life / 0.4);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
      if (m.dmg) {
        ctx.globalAlpha = Math.max(0, m.dmg.life * 2);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "700 " + Math.round(W * 0.055) + "px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(m.dmg.t, m.dmg.x * W, m.dmg.y * H - (1 - m.dmg.life) * 28);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (m.flash > 0) { ctx.fillStyle = "rgba(244,239,228," + (m.flash * 0.22) + ")"; ctx.fillRect(0, 0, W, H); }
      if (m.banner) {
        ctx.fillStyle = "rgba(10,12,16,0.62)"; ctx.fillRect(0, H * 0.18, W, 56);
        ctx.fillStyle = "#c45c2a"; ctx.fillRect(0, H * 0.18, W, 3); ctx.fillRect(0, H * 0.18 + 53, W, 3);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "800 " + Math.min(24, W * 0.048) + "px system-ui,sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m.banner, W / 2, H * 0.18 + 28);
      }
      if (m.grade && m.phase === "anim") {
        ctx.fillStyle = "#f4efe4";
        ctx.font = "900 42px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(m.grade.toUpperCase(), W / 2, H * 0.4);
      }
      if (m.phase === "timing" || m.phase === "pin") {
        const needle = m.phase === "pin" ? m.pinNeedle : m.timing;
        const winA = m.phase === "pin" ? 0.45 : 0.6;
        const winB = m.phase === "pin" ? 0.75 : 0.78;
        const x = W * 0.12, y = H * 0.86, w = W * 0.76, h = 10;
        ctx.fillStyle = "rgba(20,20,24,0.8)"; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(88,224,138,0.9)"; ctx.fillRect(x + winA * w, y, (winB - winA) * w, h);
        ctx.fillStyle = "#f4efe4"; ctx.fillRect(x + needle * w - 2, y - 3, 4, h + 6);
        ctx.font = "700 12px system-ui,sans-serif"; ctx.textAlign = "center";
        ctx.fillText(m.phase === "pin" ? ("COUNT " + m.pinStep + "/3 — TAP") : "TAP THE COPPER", W / 2, y - 10);
      }
      raf = requestAnimationFrame(tick);
    }
    arenaAnim = {
      stop: function () { stopped = true; cancelAnimationFrame(raf); canvas.onclick = null; },
      skip: function () {
        if (m.phase === "over") return;
        const rating = powerRating(fight.left) - powerRating(fight.right);
        let winner = Math.random() < 0.5 + rating / 80 ? "left" : "right";
        if (fight.requiredRare && winner === "left" && !m.usedRare) winner = "right";
        end(winner);
      }
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
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

  function renderMoveLocker() {
    const active = activeSheep();
    if (!active) return "";
    const fights = save.totalFights || 0;
    let html = '<div class="w-section-lab">Move locker</div>';
    ["power","super","rare"].forEach((tier) => {
      html += '<div class="w-muted" style="font-weight:800;margin:8px 0 4px;letter-spacing:.08em;text-transform:uppercase;font-size:10px">' + tier + "</div>";
      MOVES.filter((m) => m.tier === tier).forEach((m) => {
        const on = isMoveUnlocked(m, fights, active.wins, active.stage, active.breed);
        html += '<div class="w-list-btn" style="cursor:default;opacity:' + (on ? "1" : ".55") + '">' +
          '<span style="flex:1;min-width:0"><b>' + esc(m.name) + "</b><br><span class='w-muted'>" + (on ? esc(m.callout) : esc(lockReason(m))) + "</span></span>" +
          '<span style="font-weight:900;color:' + (on ? "var(--w-primary)" : "var(--w-muted)") + '">' + (on ? "OWNED" : "LOCKED") + "</span></div>";
      });
    });
    return html;
  }
  function renderHome() {
    const active = activeSheep();
    return (
      '<section class="w-hero"><div style="font-size:36px">🐏💥🐏</div>' +
      "<h1>SHEEP WRESTLING</h1>" +
      "<p>Raise lambs into God Rams. Named power moves, supers, and <b style='color:var(--w-primary)'>rare finishers</b> unlock as you fight. Championship rams will not stay down unless you hit a rare.</p>" +
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
      "<li>Arena AI or friend WOOF codes — theatrical smash with named moves.</li>" +
      "<li>Rare finishers unlock by career bouts. Championship belts require them.</li>" +
      "</ol></div>" +
      renderMoveLocker()
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
      "<div><h2 class='w-h2'>Arena</h2><p class='w-muted'>Lights. Entrances. Named finishers.</p></div>" +
      '<button type="button" class="w-btn sm" data-go="challenge">Codes</button></div>';
    if (active) html += sheepCardHtml(active, true);
    arenaList.forEach((o) => {
      html +=
        '<button type="button" class="w-list-btn" data-fight="' + o.id + '">' +
        '<div class="w-av" style="background:rgba(196,92,42,.25)">' + stageDef(o.sheep.stage).emoji + "</div>" +
        '<span style="flex:1;min-width:0"><b>' + esc(o.title) + (o.requireRare ? " · RARE" : "") + "</b><br><span class='w-muted'>" + esc(o.blurb) + "</span>" +
        "<br><span class='w-muted'>vs " + esc(o.sheep.name) + " · ⚔️ " + powerRating(o.sheep) + " · Prize $" + o.prize + (o.locked ? " · LOCKED" : "") + "</span></span>" +
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
  document.getElementById("wSkipFight").addEventListener("click", function () {
    if (arenaAnim && arenaAnim.skip) arenaAnim.skip();
    else finishFight();
  });
  document.getElementById("wResultOk").addEventListener("click", () => {
    document.getElementById("wResult").classList.remove("on");
    setScreen("arena");
  });

  updateTop();
  render();
})();
