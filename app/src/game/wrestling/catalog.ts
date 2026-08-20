import type {
  BreedDef,
  BreedKey,
  GearSlot,
  MoveDef,
  StageDef,
  StageKey,
  StatKey,
} from "./types";

export const STAGES: StageDef[] = [
  { key: "lamb", name: "Lamb", mult: 0.55, maxLevel: 5, promoteCost: 40, size: 0.74 },
  { key: "yearling", name: "Yearling", mult: 0.8, maxLevel: 8, promoteCost: 180, size: 0.9 },
  { key: "ram", name: "Ram", mult: 1.05, maxLevel: 10, promoteCost: 650, size: 1.0 },
  { key: "prize", name: "Prize Ram", mult: 1.35, maxLevel: 12, promoteCost: 2200, size: 1.14 },
  { key: "god", name: "God Ram", mult: 1.75, maxLevel: 15, promoteCost: 8000, size: 1.3 },
  { key: "legend", name: "Legend", mult: 2.2, maxLevel: 20, promoteCost: 0, size: 1.44 },
];

export const STAGE_ORDER = STAGES.map((s) => s.key);

export function stageDef(k: string): StageDef {
  return STAGES.find((s) => s.key === k) ?? STAGES[0]!;
}

export function stageIndex(k: string): number {
  const i = STAGE_ORDER.indexOf(k as StageKey);
  return i < 0 ? 0 : i;
}

export const BREEDS: Record<BreedKey, BreedDef> = {
  merino: {
    key: "merino",
    name: "Merino",
    blurb: "Balanced farm fighter. Solid starter stock.",
    power: 10, toughness: 10, weight: 9, agility: 10, spirit: 10, charge: 9,
    cost: 0, rarity: "common", wool: "#efe7d2", body: "#c9a87a", horn: "#d4c4a0",
    minStageUnlock: "lamb",
  },
  suffolk: {
    key: "suffolk",
    name: "Suffolk",
    blurb: "Black face, heavy hits. Power specialist.",
    power: 14, toughness: 11, weight: 13, agility: 7, spirit: 9, charge: 12,
    cost: 220, rarity: "uncommon", wool: "#f0ece4", body: "#2a2428", horn: "#c8b090",
    minStageUnlock: "lamb",
  },
  blackface: {
    key: "blackface",
    name: "Blackface",
    blurb: "Tough as fence wire. Absorbs smashes.",
    power: 9, toughness: 15, weight: 12, agility: 7, spirit: 11, charge: 8,
    cost: 280, rarity: "uncommon", wool: "#e8e4dc", body: "#1c1816", horn: "#b8a080",
    minStageUnlock: "lamb",
  },
  dorper: {
    key: "dorper",
    name: "Dorper",
    blurb: "Quick on the charge. Hits then slips.",
    power: 11, toughness: 8, weight: 8, agility: 15, spirit: 10, charge: 13,
    cost: 320, rarity: "uncommon", wool: "#f6f2ea", body: "#c4a070", horn: "#e0c8a0",
    minStageUnlock: "yearling",
  },
  texel: {
    key: "texel",
    name: "Texel",
    blurb: "Dense muscle, brutal shove contests.",
    power: 13, toughness: 12, weight: 14, agility: 6, spirit: 9, charge: 10,
    cost: 540, rarity: "rare", wool: "#f4f0e8", body: "#b8a888", horn: "#d8c8a8",
    minStageUnlock: "yearling",
  },
  golden: {
    key: "golden",
    name: "Golden Fleece",
    blurb: "Rare glitter stock. Spirit through the roof.",
    power: 14, toughness: 12, weight: 11, agility: 12, spirit: 16, charge: 13,
    cost: 2800, rarity: "epic", wool: "#e8c45a", body: "#c49228", horn: "#f0d080",
    minStageUnlock: "ram",
  },
  midnight: {
    key: "midnight",
    name: "Midnight Ram",
    blurb: "Night-bred bruiser. Scary charge energy.",
    power: 16, toughness: 14, weight: 13, agility: 11, spirit: 12, charge: 17,
    cost: 6200, rarity: "epic", wool: "#2a2830", body: "#121018", horn: "#8a7a90",
    minStageUnlock: "prize",
  },
  thunderhead: {
    key: "thunderhead",
    name: "Thunderhead",
    blurb: "The hell-good one. Costs a fortune. Worth it.",
    power: 18, toughness: 17, weight: 16, agility: 14, spirit: 15, charge: 18,
    cost: 18000, rarity: "legendary", wool: "#dfe8f4", body: "#4a6080", horn: "#c0d0e8",
    minStageUnlock: "god",
  },
};

export const FOODS = [
  { key: "pellets", name: "Basic Pellets", cost: 12, blurb: "Fills the belly. Tiny all-round growth.", perm: { power: 0.15, toughness: 0.15, weight: 0.1 } as Partial<Record<StatKey, number>>, xp: 8, minStage: "lamb" as StageKey },
  { key: "lucerne", name: "Lucerne Hay", cost: 28, blurb: "Green gold. Builds toughness and weight.", perm: { toughness: 0.45, weight: 0.35, spirit: 0.1 } as Partial<Record<StatKey, number>>, xp: 14, minStage: "lamb" as StageKey },
  { key: "oats", name: "Race Oats", cost: 35, blurb: "Speedy fuel. Agility plus charge.", perm: { agility: 0.5, charge: 0.35, power: 0.1 } as Partial<Record<StatKey, number>>, xp: 16, minStage: "lamb" as StageKey },
  { key: "protein", name: "Protein Mash", cost: 70, blurb: "Heavy training feed. Pure power.", perm: { power: 0.7, weight: 0.4, toughness: 0.2 } as Partial<Record<StatKey, number>>, xp: 28, minStage: "yearling" as StageKey },
  { key: "champion", name: "Champion Chow", cost: 160, blurb: "Show-ring diet. Big permanent gains.", perm: { power: 0.55, toughness: 0.55, spirit: 0.55, charge: 0.4 } as Partial<Record<StatKey, number>>, xp: 48, minStage: "ram" as StageKey },
  { key: "thunder_mash", name: "Thunder Mash", cost: 320, blurb: "Pre-fight fire. Temporary smash buff.", perm: { charge: 0.3 } as Partial<Record<StatKey, number>>, temp: { power: 4, charge: 5, spirit: 2 } as Partial<Record<StatKey, number>>, xp: 40, minStage: "ram" as StageKey },
  { key: "golden_grain", name: "Golden Grain", cost: 900, blurb: "Fleece-tier feed. Serious permanent stats.", perm: { power: 1.2, toughness: 1.0, agility: 0.8, spirit: 1.0, charge: 1.0 } as Partial<Record<StatKey, number>>, xp: 90, minStage: "prize" as StageKey },
  { key: "god_nectar", name: "God Nectar", cost: 2500, blurb: "Mythic sip. Only God Rams and up.", perm: { power: 2.2, toughness: 2.0, weight: 1.5, agility: 1.5, spirit: 2.0, charge: 2.2 } as Partial<Record<StatKey, number>>, temp: { power: 6, charge: 8 } as Partial<Record<StatKey, number>>, xp: 160, minStage: "god" as StageKey },
];

export const TRAINING = [
  { key: "sprint", name: "Paddock Sprints", cost: 25, blurb: "Agility work around the yards.", stats: { agility: 0.6, charge: 0.25 } as Partial<Record<StatKey, number>>, xp: 20 },
  { key: "push", name: "Fence Push", cost: 30, blurb: "Lean into the rails. Weight and power.", stats: { weight: 0.55, power: 0.4 } as Partial<Record<StatKey, number>>, xp: 22 },
  { key: "horns", name: "Horn Drill", cost: 45, blurb: "Headbutt the sack. Charge mastery.", stats: { charge: 0.7, power: 0.35, spirit: 0.15 } as Partial<Record<StatKey, number>>, xp: 28 },
  { key: "bulk", name: "Bulk Block", cost: 55, blurb: "Heavy hay bales. Toughness tank.", stats: { toughness: 0.75, weight: 0.4 } as Partial<Record<StatKey, number>>, xp: 30 },
  { key: "spirit", name: "Crowd Work", cost: 40, blurb: "Walk-outs and noise. Spirit under pressure.", stats: { spirit: 0.8, agility: 0.15 } as Partial<Record<StatKey, number>>, xp: 24 },
  { key: "charge", name: "Full Charge", cost: 90, blurb: "Long run into the dummy. Hell hectic.", stats: { charge: 1.0, power: 0.5, spirit: 0.3 } as Partial<Record<StatKey, number>>, xp: 45 },
];

export const GEAR: { key: string; name: string; cost: number; blurb: string; slot: GearSlot; stats: Partial<Record<StatKey, number>> }[] = [
  { key: "leather_collar", name: "Leather Collar", cost: 80, blurb: "Farmyard swagger. Spirit bump.", slot: "collar", stats: { spirit: 1.5 } },
  { key: "iron_collar", name: "Iron Collar", cost: 320, blurb: "Protects the neck. Toughness.", slot: "collar", stats: { toughness: 3, weight: 1 } },
  { key: "gold_collar", name: "Champion Collar", cost: 1400, blurb: "Show copper. Big spirit and power.", slot: "collar", stats: { spirit: 4, power: 2, charge: 1 } },
  { key: "horn_wrap", name: "Horn Wrap", cost: 150, blurb: "Tape job. Safer clashes.", slot: "horns", stats: { toughness: 1.5, charge: 1.5 } },
  { key: "steel_tips", name: "Steel Horn Tips", cost: 900, blurb: "Nasty on impact. Power and charge.", slot: "horns", stats: { power: 3.5, charge: 3 } },
  { key: "wool_armor", name: "Thick Wool Coat", cost: 600, blurb: "Extra padding. Soaks damage.", slot: "body", stats: { toughness: 4, weight: 2, agility: -0.5 } },
];

export const SHEEP_NAMES = [
  "Buster", "Tank", "Nugget", "Thunder", "Crusher", "Woolly", "Rambo", "Brick",
  "Diesel", "Bazza", "Shearer", "Mutton", "Knuckles", "Boomer", "Spike", "Rusty",
  "Havoc", "Titan", "Ruckus", "Blaze", "Grit", "Paddock", "Stomper", "Kingpin",
  "Outback", "Fury", "Moss", "Cliff", "Bolt", "Maul", "Drover", "Anvil",
];

export const RARITY_COLOR: Record<string, string> = {
  common: "#9c968c",
  uncommon: "#9c968c",
  rare: "#f3eee6",
  epic: "#c45c2a",
  legendary: "#c45c2a",
};

export const MOVES: MoveDef[] = [
  // Basics
  { id: "headbutt", name: "Headbutt", callout: "HORNS FIRST", blurb: "The farmyard classic.", tier: "basic", kind: "strike", pose: "strike", minBattles: 0, damageMul: 0.7, meterGain: 12, meterCost: 0, canFinish: false, stunChance: 0.08, fx: "smash" },
  { id: "shoulder", name: "Shoulder Block", callout: "HEAVY SHOULDER", blurb: "A running crash of wool.", tier: "basic", kind: "strike", pose: "charge", minBattles: 0, damageMul: 0.65, meterGain: 10, meterCost: 0, canFinish: false, stunChance: 0.05, fx: "smash" },
  { id: "hornlock", name: "Horn Lock", callout: "HORNS LOCKED", blurb: "Grind them into the canvas.", tier: "basic", kind: "lock", pose: "lock", minBattles: 0, damageMul: 0.4, meterGain: 8, meterCost: 0, canFinish: false, stunChance: 0.12, fx: "lock" },
  { id: "shove", name: "Paddock Shove", callout: "SHOVES THROUGH", blurb: "Weight and spite.", tier: "basic", kind: "strike", pose: "strike", minBattles: 0, damageMul: 0.55, meterGain: 8, meterCost: 0, canFinish: false, stunChance: 0.04, fx: "smash" },
  { id: "rear_kick", name: "Rear Kick", callout: "BACK-HOOF!", blurb: "They never see the hoof.", tier: "basic", kind: "strike", pose: "strike", minBattles: 0, damageMul: 0.6, meterGain: 9, meterCost: 0, canFinish: false, stunChance: 0.1, fx: "smash" },
  { id: "irish_whip", name: "Irish Whip", callout: "INTO THE ROPES", blurb: "Sling them off the top rope.", tier: "basic", kind: "strike", pose: "whip", minBattles: 1, damageMul: 0.5, meterGain: 14, meterCost: 0, canFinish: false, stunChance: 0.06, fx: "whip" },

  // Power
  { id: "paddock_driver", name: "Paddock Driver", callout: "PADDOCK DRIVER", blurb: "Hoist and plant. Unlocks after 3 bouts.", tier: "power", kind: "slam", pose: "slam", minBattles: 3, damageMul: 1.15, meterGain: 18, meterCost: 0, canFinish: false, stunChance: 0.22, fx: "slam" },
  { id: "fleece_buster", name: "Fleece Buster", callout: "FLEECE BUSTER", blurb: "A snapping DDT of wool. 6 bouts.", tier: "power", kind: "slam", pose: "slam", minBattles: 6, damageMul: 1.2, meterGain: 16, meterCost: 0, canFinish: false, stunChance: 0.28, fx: "drop" },
  { id: "spinning_horn", name: "Spinning Horn", callout: "SPINNING HORN", blurb: "A full twist into the temple. 8 bouts.", tier: "power", kind: "strike", pose: "strike", minBattles: 8, damageMul: 1.1, meterGain: 15, meterCost: 0, canFinish: false, stunChance: 0.18, fx: "spin" },
  { id: "yard_slam", name: "Yard Slam", callout: "YARD SLAM", blurb: "Pick them up. Put them down. 10 bouts.", tier: "power", kind: "slam", pose: "lift", minBattles: 10, damageMul: 1.25, meterGain: 18, meterCost: 0, canFinish: false, stunChance: 0.25, fx: "slam" },
  { id: "turnbuckle_ram", name: "Turnbuckle Ram", callout: "INTO THE BUCKLE", blurb: "Drive them into the post. 12 bouts.", tier: "power", kind: "charge", pose: "charge", minBattles: 12, damageMul: 1.18, meterGain: 20, meterCost: 0, canFinish: false, stunChance: 0.2, fx: "smash" },
  { id: "wool_suplex", name: "Wool Suplex", callout: "WOOL SUPLEX", blurb: "Classic throw. 14 bouts.", tier: "power", kind: "slam", pose: "lift", minBattles: 14, damageMul: 1.22, meterGain: 17, meterCost: 0, canFinish: false, stunChance: 0.24, fx: "slam" },

  // Super
  { id: "god_ram_spear", name: "God Ram Spear", callout: "GOD RAM SPEAR", blurb: "A full-send charge that levels the ring. 18 bouts.", tier: "super", kind: "charge", pose: "charge", minBattles: 18, damageMul: 1.7, meterGain: 8, meterCost: 80, canFinish: true, stunChance: 0.45, fx: "thunder" },
  { id: "golden_splash", name: "Golden Fleece Splash", callout: "FROM THE TOP ROPE", blurb: "Aerial splash. 22 bouts.", tier: "super", kind: "aerial", pose: "aerial", minBattles: 22, damageMul: 1.65, meterGain: 8, meterCost: 80, canFinish: true, stunChance: 0.4, fx: "gold" },
  { id: "steel_guillotine", name: "Steel Horn Guillotine", callout: "GUILLOTINE", blurb: "Horns drop like a gate. 28 bouts.", tier: "super", kind: "strike", pose: "strike", minBattles: 28, damageMul: 1.75, meterGain: 6, meterCost: 85, canFinish: true, stunChance: 0.5, fx: "drop" },
  { id: "thunder_driver", name: "Thunder Driver", callout: "THUNDER DRIVER", blurb: "Sit-out powerbomb. 32 bouts.", tier: "super", kind: "slam", pose: "slam", minBattles: 32, damageMul: 1.8, meterGain: 6, meterCost: 90, canFinish: true, stunChance: 0.48, fx: "thunder" },

  // Rare finishers — championships and gauntlets only stay down to these
  { id: "the_shearing", name: "The Shearing", callout: "THE SHEARING", blurb: "Rare finisher. 40 bouts. Championship rams only stay down to a rare.", tier: "rare", kind: "finisher", pose: "pin", minBattles: 40, damageMul: 2.4, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1, fx: "gold" },
  { id: "woolpocalypse", name: "Woolpocalypse", callout: "WOOLPOCALYPSE", blurb: "Rare finisher. 60 bouts. The crowd loses its mind.", tier: "rare", kind: "finisher", pose: "slam", minBattles: 60, damageMul: 2.7, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1, fx: "thunder" },
  { id: "midnight_eclipse", name: "Midnight Eclipse", callout: "MIDNIGHT ECLIPSE", blurb: "Rare. 80 bouts and Prize Ram or better.", tier: "rare", kind: "finisher", pose: "aerial", minBattles: 80, minStage: "prize", damageMul: 2.9, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1, fx: "eclipse" },
  { id: "thunderhead_judgment", name: "Thunderhead Judgment", callout: "THUNDERHEAD JUDGMENT", blurb: "Thunderhead exclusive. 50 wins.", tier: "rare", kind: "finisher", pose: "roar", minBattles: 0, minWins: 50, breed: "thunderhead", damageMul: 3.1, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1, fx: "thunder" },
  { id: "legends_last_charge", name: "Legend's Last Charge", callout: "LEGEND'S LAST CHARGE", blurb: "The rarest. 100 bouts and Legend stage.", tier: "rare", kind: "finisher", pose: "charge", minBattles: 100, minStage: "legend", damageMul: 3.4, meterGain: 0, meterCost: 100, canFinish: true, stunChance: 1, fx: "eclipse" },
];

export function moveById(id: string): MoveDef | undefined {
  return MOVES.find((m) => m.id === id);
}

export function isMoveUnlocked(
  move: MoveDef,
  fights: number,
  wins: number,
  stage: StageKey,
  breed: BreedKey,
): boolean {
  if (fights < move.minBattles) return false;
  if (move.minWins != null && wins < move.minWins) return false;
  if (move.minStage && stageIndex(stage) < stageIndex(move.minStage)) return false;
  if (move.breed && breed !== move.breed) return false;
  return true;
}

export function unlockedMoves(
  fights: number,
  wins: number,
  stage: StageKey,
  breed: BreedKey,
): MoveDef[] {
  return MOVES.filter((m) => isMoveUnlocked(m, fights, wins, stage, breed));
}

export function lockReason(move: MoveDef): string {
  const bits: string[] = [];
  if (move.minBattles) bits.push(`${move.minBattles} bouts`);
  if (move.minWins) bits.push(`${move.minWins} wins`);
  if (move.minStage) bits.push(`${stageDef(move.minStage).name}+`);
  if (move.breed) bits.push(`${BREEDS[move.breed].name} only`);
  return bits.length ? `Unlock: ${bits.join(" · ")}` : "Unlocked";
}
