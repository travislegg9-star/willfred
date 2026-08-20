import { BREEDS, GEAR, SHEEP_NAMES, STAGE_ORDER, stageDef, stageIndex } from "./catalog";
import type { BreedKey, Sheep, StageKey, Stats } from "./types";
import { STAT_KEYS } from "./types";

export function uid(): string {
  return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function pickName(used: Set<string>): string {
  const free = SHEEP_NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : SHEEP_NAMES;
  return pool[(Math.random() * pool.length) | 0]!;
}

export function createSheep(opts: {
  breed?: BreedKey;
  stage?: StageKey;
  name?: string;
  variance?: number;
  usedNames?: Set<string>;
} = {}): Sheep {
  const breed = opts.breed ?? "merino";
  const B = BREEDS[breed];
  const v = opts.variance ?? 1.5;
  const jitter = () => (Math.random() * 2 - 1) * v;
  const used = opts.usedNames ?? new Set<string>();
  return {
    id: uid(),
    name: opts.name || pickName(used),
    breed,
    stage: opts.stage ?? "lamb",
    level: 1,
    xp: 0,
    power: Math.max(3, B.power + jitter()),
    toughness: Math.max(3, B.toughness + jitter()),
    weight: Math.max(3, B.weight + jitter()),
    agility: Math.max(3, B.agility + jitter()),
    spirit: Math.max(3, B.spirit + jitter()),
    charge: Math.max(3, B.charge + jitter()),
    wins: 0,
    losses: 0,
    seed: (Math.random() * 1e9) | 0,
    bornAt: Date.now(),
    collar: null,
    horns: null,
    body: null,
    earnings: 0,
  };
}

export function starterLamb(): Sheep {
  const s = createSheep({ breed: "merino", stage: "lamb", name: "Nugget" });
  s.power = 8;
  s.toughness = 8;
  s.weight = 7;
  s.agility = 9;
  s.spirit = 10;
  s.charge = 7;
  return s;
}

export function gearBonus(sheep: Sheep): Stats {
  const out: Stats = { power: 0, toughness: 0, weight: 0, agility: 0, spirit: 0, charge: 0 };
  for (const k of [sheep.collar, sheep.horns, sheep.body]) {
    if (!k) continue;
    const g = GEAR.find((x) => x.key === k);
    if (!g) continue;
    for (const [stat, val] of Object.entries(g.stats)) {
      out[stat as keyof Stats] += val ?? 0;
    }
  }
  return out;
}

export function effectiveStats(sheep: Sheep): Stats {
  const mult = stageDef(sheep.stage).mult;
  const gear = gearBonus(sheep);
  const buffs = sheep.buffs ?? {};
  const out = {} as Stats;
  for (const k of STAT_KEYS) {
    out[k] = Math.max(1, (sheep[k] + gear[k] + (buffs[k] ?? 0)) * mult);
  }
  return out;
}

export function powerRating(sheep: Sheep): number {
  const s = effectiveStats(sheep);
  return Math.round(
    s.power * 1.3 +
      s.toughness * 1.1 +
      s.weight * 0.9 +
      s.agility * 0.85 +
      s.spirit * 0.7 +
      s.charge * 1.2 +
      sheep.level * 2 +
      stageDef(sheep.stage).size * 20,
  );
}

export function maxHp(sheep: Sheep): number {
  const s = effectiveStats(sheep);
  return Math.round(90 + s.toughness * 4.4 + s.weight * 2.4 + s.spirit * 1.2 + sheep.level * 3);
}

export function maxStam(sheep: Sheep): number {
  const s = effectiveStats(sheep);
  return Math.round(40 + s.agility * 2.2 + s.spirit * 1.5 + s.charge * 0.8);
}

export function cloneSheep(s: Sheep): Sheep {
  return { ...s, buffs: s.buffs ? { ...s.buffs } : undefined };
}

export function clearBuffs(sheep: Sheep): Sheep {
  if (!sheep.buffs) return sheep;
  const n = { ...sheep };
  delete n.buffs;
  return n;
}

export function xpToLevel(level: number): number {
  return Math.round(40 + level * 28 + level * level * 2.5);
}

export function applyXp(sheep: Sheep, amount: number): { sheep: Sheep; leveled: number } {
  const s = { ...sheep };
  let xp = s.xp + amount;
  let leveled = 0;
  const maxLv = stageDef(s.stage).maxLevel;
  while (s.level < maxLv && xp >= xpToLevel(s.level)) {
    xp -= xpToLevel(s.level);
    s.level += 1;
    leveled += 1;
    s.power += 0.35 + Math.random() * 0.25;
    s.toughness += 0.35 + Math.random() * 0.25;
    s.weight += 0.2 + Math.random() * 0.2;
    s.agility += 0.25 + Math.random() * 0.2;
    s.spirit += 0.25 + Math.random() * 0.2;
    s.charge += 0.3 + Math.random() * 0.25;
  }
  s.xp = s.level >= maxLv ? 0 : xp;
  return { sheep: s, leveled };
}

export function canPromote(sheep: Sheep): boolean {
  const st = stageDef(sheep.stage);
  return st.promoteCost > 0 && sheep.level >= st.maxLevel;
}

export function promote(sheep: Sheep): Sheep {
  const idx = stageIndex(sheep.stage);
  if (idx >= STAGE_ORDER.length - 1) return sheep;
  const next = STAGE_ORDER[idx + 1]!;
  return {
    ...sheep,
    stage: next,
    level: 1,
    xp: 0,
    power: sheep.power + 1.2,
    toughness: sheep.toughness + 1.2,
    weight: sheep.weight + 0.8,
    agility: sheep.agility + 0.6,
    spirit: sheep.spirit + 1,
    charge: sheep.charge + 1.1,
  };
}

export function hashSeed(parts: Array<string | number>): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateOpponent(targetRating: number, difficulty: number, seed: number): Sheep {
  let sseed = seed;
  const rng = () => {
    sseed = (sseed * 1664525 + 1013904223) >>> 0;
    return sseed / 4294967296;
  };
  const stageIdx = Math.min(
    STAGE_ORDER.length - 1,
    Math.max(0, Math.floor(difficulty * 1.1 + rng() * 1.2)),
  );
  const stage = STAGE_ORDER[stageIdx]!;
  const unlocked = (Object.keys(BREEDS) as BreedKey[]).filter(
    (k) => stageIndex(BREEDS[k].minStageUnlock) <= stageIdx,
  );
  let breed = unlocked[(rng() * unlocked.length) | 0] ?? "merino";
  if (difficulty >= 4 && rng() < 0.35 && unlocked.includes("golden")) breed = "golden";
  if (difficulty >= 6 && rng() < 0.3 && unlocked.includes("midnight")) breed = "midnight";
  if (difficulty >= 8 && rng() < 0.25 && unlocked.includes("thunderhead")) breed = "thunderhead";
  const s = createSheep({
    breed,
    stage,
    name: SHEEP_NAMES[(rng() * SHEEP_NAMES.length) | 0],
    variance: 0.8,
  });
  s.level = Math.min(stageDef(stage).maxLevel, 1 + Math.floor(rng() * stageDef(stage).maxLevel * 0.85));
  s.seed = seed;
  let guard = 0;
  while (powerRating(s) < targetRating * (0.85 + difficulty * 0.03) && guard < 40) {
    s.power += 0.4;
    s.toughness += 0.35;
    s.weight += 0.25;
    s.agility += 0.25;
    s.spirit += 0.2;
    s.charge += 0.35;
    guard++;
  }
  return s;
}
