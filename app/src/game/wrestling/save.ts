import { FOODS, GEAR, TRAINING, stageDef, stageIndex, unlockedMoves } from "./catalog";
import { applyXp, canPromote, createSheep, generateOpponent, hashSeed, powerRating, promote, starterLamb } from "./sheep";
import type { ArenaCard, SaveState, Sheep } from "./types";

const KEY = "woofa_wrestling_v2";
const SAVE_VERSION = 2;

export function stableCap(level: number): number {
  return 4 + level * 2;
}

export function defaultSave(): SaveState {
  const lamb = starterLamb();
  return {
    version: SAVE_VERSION,
    coins: 120,
    trophies: 0,
    bestWinStreak: 0,
    winStreak: 0,
    sheep: [lamb],
    activeId: lamb.id,
    ownedGear: [],
    trainerLevel: 1,
    stableLevel: 1,
    totalFights: 0,
    playerName: "Farmer",
    lastDaily: null,
    championships: 0,
    unlockedMoves: unlockedMoves(0, 0, "lamb", "merino").map((m) => m.id),
    seenMoves: [],
  };
}

function migrate(raw: SaveState): SaveState {
  const base = defaultSave();
  const merged: SaveState = {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    sheep: Array.isArray(raw.sheep) && raw.sheep.length ? raw.sheep : base.sheep,
    ownedGear: Array.isArray(raw.ownedGear) ? raw.ownedGear : [],
    championships: raw.championships ?? 0,
    unlockedMoves: raw.unlockedMoves ?? base.unlockedMoves,
    seenMoves: raw.seenMoves ?? [],
  };
  if (!merged.activeId || !merged.sheep.some((s) => s.id === merged.activeId)) {
    merged.activeId = merged.sheep[0]?.id ?? null;
  }
  return merged;
}

export function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("woofa_wrestling_v1");
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw) as SaveState);
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* quota */
  }
}

export function activeSheep(save: SaveState): Sheep | null {
  return save.sheep.find((s) => s.id === save.activeId) ?? save.sheep[0] ?? null;
}

export function refreshArena(save: SaveState): ArenaCard[] {
  const active = activeSheep(save);
  if (!active) return [];
  const rating = powerRating(active);
  const seedParts = [active.id, active.wins, save.totalFights];
  return [
    {
      id: "a1",
      title: "Yard Scrap",
      blurb: "A soft local lamb. Warm-up smash.",
      difficulty: 0,
      prize: 20,
      requireRare: false,
      sheep: generateOpponent(rating * 0.72, 0, hashSeed([...seedParts, "a1"])),
    },
    {
      id: "a2",
      title: "District Bout",
      blurb: "Even fight. Expect horns.",
      difficulty: 2,
      prize: 45,
      requireRare: false,
      sheep: generateOpponent(rating * 0.98, 2, hashSeed([...seedParts, "a2"])),
    },
    {
      id: "a3",
      title: "County Classic",
      blurb: "They hit hard. Bring feed buffs.",
      difficulty: 4,
      prize: 90,
      requireRare: false,
      sheep: generateOpponent(rating * 1.12, 4, hashSeed([...seedParts, "a3"])),
    },
    {
      id: "a4",
      title: "State Smash",
      blurb: "Hectic. Prize rams live here. Rare finishers recommended.",
      difficulty: 6,
      prize: 180,
      requireRare: false,
      sheep: generateOpponent(rating * 1.28, 6, hashSeed([...seedParts, "a4"])),
    },
    {
      id: "a5",
      title: "God Ram Gauntlet",
      blurb: "This ram will not stay down unless you land a rare finisher.",
      difficulty: 9,
      prize: 400,
      requireRare: true,
      sheep: generateOpponent(rating * 1.5, 9, hashSeed([...seedParts, "a5"])),
    },
    {
      id: "belt",
      title: "Paddock Championship",
      blurb: "Title shot. Only a rare finisher pins the champ.",
      difficulty: 10,
      prize: 700,
      requireRare: true,
      championship: true,
      sheep: generateOpponent(rating * 1.62, 10, hashSeed([...seedParts, "belt"])),
    },
  ];
}

export function feedSheep(sheep: Sheep, foodKey: string): Sheep {
  const food = FOODS.find((f) => f.key === foodKey);
  if (!food) return sheep;
  let s = { ...sheep, buffs: { ...sheep.buffs } };
  for (const [k, v] of Object.entries(food.perm)) {
    (s as unknown as Record<string, number>)[k] = ((s as unknown as Record<string, number>)[k] ?? 0) + (v ?? 0);
  }
  if (food.temp) {
    s.buffs = { ...s.buffs };
    for (const [k, v] of Object.entries(food.temp)) {
      s.buffs[k as keyof typeof s.buffs] = (s.buffs[k as keyof typeof s.buffs] ?? 0) + (v ?? 0);
    }
  }
  return applyXp(s, food.xp).sheep;
}

export function trainSheep(sheep: Sheep, trainKey: string): Sheep {
  const train = TRAINING.find((x) => x.key === trainKey);
  if (!train) return sheep;
  const s = { ...sheep };
  for (const [k, v] of Object.entries(train.stats)) {
    (s as unknown as Record<string, number>)[k] = ((s as unknown as Record<string, number>)[k] ?? 0) + (v ?? 0);
  }
  return applyXp(s, train.xp).sheep;
}

export { FOODS, GEAR, TRAINING, canPromote, promote, applyXp, stageDef, stageIndex, createSheep };
