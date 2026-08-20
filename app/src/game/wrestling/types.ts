export const STAT_KEYS = [
  "power",
  "toughness",
  "weight",
  "agility",
  "spirit",
  "charge",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export type StageKey = "lamb" | "yearling" | "ram" | "prize" | "god" | "legend";
export type BreedKey =
  | "merino"
  | "suffolk"
  | "blackface"
  | "dorper"
  | "texel"
  | "golden"
  | "midnight"
  | "thunderhead";
export type GearSlot = "collar" | "horns" | "body";
export type MoveTier = "basic" | "power" | "super" | "rare";
export type MoveKind = "strike" | "lock" | "slam" | "aerial" | "charge" | "finisher";
export type Pose =
  | "idle"
  | "walk"
  | "lock"
  | "charge"
  | "strike"
  | "lift"
  | "slam"
  | "aerial"
  | "stunned"
  | "down"
  | "pin"
  | "celebrate"
  | "roar"
  | "whip";

export type EventKind =
  | "lights"
  | "entrance"
  | "bell"
  | "lockup"
  | "move"
  | "reversal"
  | "nearfall"
  | "kickout"
  | "super"
  | "finisher"
  | "pin"
  | "ko"
  | "celebrate"
  | "crowd"
  | "recover"
  | "timeout";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type StageDef = {
  key: StageKey;
  name: string;
  mult: number;
  maxLevel: number;
  promoteCost: number;
  size: number;
};

export type BreedDef = {
  key: BreedKey;
  name: string;
  blurb: string;
  power: number;
  toughness: number;
  weight: number;
  agility: number;
  spirit: number;
  charge: number;
  cost: number;
  rarity: Rarity;
  wool: string;
  body: string;
  horn: string;
  minStageUnlock: StageKey;
};

export type MoveDef = {
  id: string;
  name: string;
  callout: string;
  blurb: string;
  tier: MoveTier;
  kind: MoveKind;
  pose: Pose;
  minBattles: number;
  minWins?: number;
  minStage?: StageKey;
  breed?: BreedKey;
  damageMul: number;
  meterGain: number;
  meterCost: number;
  canFinish: boolean;
  stunChance: number;
  fx: "smash" | "slam" | "spin" | "drop" | "eclipse" | "thunder" | "gold" | "lock" | "whip";
};

export type Sheep = {
  id: string;
  name: string;
  breed: BreedKey;
  stage: StageKey;
  level: number;
  xp: number;
  power: number;
  toughness: number;
  weight: number;
  agility: number;
  spirit: number;
  charge: number;
  wins: number;
  losses: number;
  seed: number;
  bornAt: number;
  collar: string | null;
  horns: string | null;
  body: string | null;
  earnings: number;
  buffs?: Partial<Stats>;
};

export type FightEvent = {
  t: number;
  kind: EventKind;
  actor: "left" | "right" | "both";
  moveId?: string;
  damage?: number;
  intensity: number;
  text: string;
  timing?: boolean;
  slowmo?: boolean;
  zoom?: number;
};

export type FightResult = {
  seed: number;
  events: FightEvent[];
  winner: "left" | "right";
  duration: number;
  leftHpEnd: number;
  rightHpEnd: number;
  prize: number;
  left: Sheep;
  right: Sheep;
  finishMoveId?: string;
  requiredRare: boolean;
  usedRare: boolean;
  title: string;
};

export type ArenaCard = {
  id: string;
  title: string;
  blurb: string;
  difficulty: number;
  prize: number;
  requireRare: boolean;
  championship?: boolean;
  sheep: Sheep;
};

export type SaveState = {
  version: number;
  coins: number;
  trophies: number;
  bestWinStreak: number;
  winStreak: number;
  sheep: Sheep[];
  activeId: string | null;
  ownedGear: string[];
  trainerLevel: number;
  stableLevel: number;
  totalFights: number;
  playerName: string;
  lastDaily: string | null;
  championships: number;
  unlockedMoves: string[];
  seenMoves: string[];
};
