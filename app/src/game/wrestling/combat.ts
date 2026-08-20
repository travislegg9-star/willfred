import { MOVES, stageDef, unlockedMoves } from "./catalog";
import { cloneSheep, effectiveStats, maxHp, maxStam, powerRating } from "./sheep";
import type { FightEvent, FightResult, MoveDef, Sheep } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMove(
  pool: MoveDef[],
  rng: () => number,
  meter: number,
  wantFinish: boolean,
  requireRare: boolean,
  opponentLow: boolean,
): MoveDef {
  const rares = pool.filter((m) => m.tier === "rare" && meter >= m.meterCost);
  const supers = pool.filter((m) => m.tier === "super" && meter >= m.meterCost);
  const powers = pool.filter((m) => m.tier === "power");
  const basics = pool.filter((m) => m.tier === "basic");

  if (wantFinish && opponentLow && rares.length) {
    return rares[(rng() * rares.length) | 0]!;
  }
  if (requireRare && opponentLow && rares.length && rng() < 0.7) {
    return rares[(rng() * rares.length) | 0]!;
  }
  if (opponentLow && supers.length && rng() < 0.55) {
    return supers[(rng() * supers.length) | 0]!;
  }
  if (supers.length && rng() < 0.18) return supers[(rng() * supers.length) | 0]!;
  if (powers.length && rng() < 0.42) return powers[(rng() * powers.length) | 0]!;
  const rest = basics.length ? basics : pool;
  return rest[(rng() * rest.length) | 0] ?? MOVES[0]!;
}

export function simulateFight(
  leftSheep: Sheep,
  rightSheep: Sheep,
  seed: number,
  opts: { requireRare?: boolean; title?: string; careerFights?: number } = {},
): FightResult {
  const rng = mulberry32(seed);
  const requireRare = !!opts.requireRare;
  const leftPool = unlockedMoves(
    Math.max(opts.careerFights ?? leftSheep.wins + leftSheep.losses, leftSheep.wins + leftSheep.losses),
    leftSheep.wins,
    leftSheep.stage,
    leftSheep.breed,
  );
  const rightPool = unlockedMoves(
    Math.max(8, rightSheep.wins + rightSheep.losses + 12),
    Math.max(4, rightSheep.wins),
    rightSheep.stage,
    rightSheep.breed,
  );

  const left = {
    sheep: leftSheep,
    name: leftSheep.name,
    maxHp: maxHp(leftSheep),
    hp: maxHp(leftSheep),
    maxStam: maxStam(leftSheep),
    stam: maxStam(leftSheep),
    stun: 0,
    meter: 20,
    side: "left" as const,
  };
  const right = {
    sheep: rightSheep,
    name: rightSheep.name,
    maxHp: maxHp(rightSheep),
    hp: maxHp(rightSheep),
    maxStam: maxStam(rightSheep),
    stam: maxStam(rightSheep),
    stun: 0,
    meter: 16,
    side: "right" as const,
  };
  const L = effectiveStats(leftSheep);
  const R = effectiveStats(rightSheep);
  const events: FightEvent[] = [];
  let t = 0;
  const push = (e: Omit<FightEvent, "t"> & { t?: number }) => {
    events.push({ ...e, t: e.t ?? t });
  };

  push({ kind: "lights", actor: "both", intensity: 0.4, text: "Lights down…" });
  t += 1.1;
  push({ kind: "entrance", actor: "left", intensity: 0.6, text: `${left.name} walks.` });
  t += 1.8;
  push({ kind: "entrance", actor: "right", intensity: 0.6, text: `And his opponent — ${right.name}!` });
  t += 1.8;
  push({ kind: "crowd", actor: "both", intensity: 0.5, text: "The paddock is on its feet" });
  t += 0.6;
  push({ kind: "bell", actor: "both", intensity: 0.7, text: "DING DING DING" });
  t += 0.7;
  push({ kind: "lockup", actor: "both", intensity: 0.45, text: "They lock horns…" });
  t += 1.1;

  let rounds = 0;
  let finishMoveId: string | undefined;
  let usedRare = false;
  const nearfalls = { left: 0, right: 0 };

  while (left.hp > 0 && right.hp > 0 && rounds < 22) {
    rounds++;
    t += 0.55 + rng() * 0.35;
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
      left.stam += 10;
      right.stam += 10;
      continue;
    }

    const leftInit = leftCan
      ? L.agility * 0.6 + L.spirit * 0.3 + L.charge * 0.2 + rng() * 12 + (left.meter > 70 ? 8 : 0)
      : -999;
    const rightInit = rightCan
      ? R.agility * 0.6 + R.spirit * 0.3 + R.charge * 0.2 + rng() * 12 + (right.meter > 70 ? 8 : 0)
      : -999;
    const actor = leftInit >= rightInit ? "left" : "right";
    const atk = actor === "left" ? left : right;
    const def = actor === "left" ? right : left;
    const AS = actor === "left" ? L : R;
    const DS = actor === "left" ? R : L;
    const pool = actor === "left" ? leftPool : rightPool;

    const defLow = def.hp / def.maxHp < 0.28;
    const wantFinish = defLow && atk.meter >= 80;
    const move = pickMove(pool, rng, atk.meter, wantFinish, requireRare && actor === "left", defLow);

    if (rng() < 0.16 && def.stun <= 0) {
      atk.stam = Math.max(0, atk.stam - 5);
      push({
        kind: "reversal",
        actor: def.side,
        intensity: 0.7,
        text: `${def.name} reverses!`,
        timing: actor === "left",
      });
      const chip = Math.max(3, Math.round(DS.power * 0.18 + rng() * 4));
      atk.hp = Math.max(1, atk.hp - chip);
      continue;
    }

    atk.stam = Math.max(0, atk.stam - (8 + rng() * 6));
    atk.meter = Math.max(0, atk.meter - move.meterCost + move.meterGain);
    const attackPower =
      AS.power * move.damageMul + AS.charge * (move.kind === "charge" ? 0.7 : 0.25) + AS.weight * 0.3 + rng() * 10;
    const defensePower = DS.toughness * 0.85 + DS.weight * 0.4 + DS.spirit * 0.2 + rng() * 8;
    const margin = attackPower - defensePower;
    const dmg = Math.max(
      5,
      Math.round(AS.power * 0.42 * move.damageMul + AS.weight * 0.18 - DS.toughness * 0.22 + rng() * 8),
    );
    const intensity = Math.min(1, 0.35 + Math.abs(margin) / 36 + (move.tier === "rare" ? 0.4 : 0));

    const wouldKill = def.hp - dmg <= 0;
    const rareMove = move.tier === "rare";
    const superMove = move.tier === "super" || rareMove;

    if (requireRare && wouldKill && !rareMove) {
      def.hp = Math.max(6, Math.round(def.maxHp * 0.08));
      push({
        kind: superMove ? "super" : "move",
        actor,
        moveId: move.id,
        damage: Math.max(4, def.hp === Math.round(def.maxHp * 0.08) ? dmg : dmg),
        intensity,
        text: move.callout,
        timing: actor === "left",
        slowmo: superMove,
        zoom: superMove ? 1.25 : 1,
      });
      t += 0.35;
      push({
        kind: "kickout",
        actor: def.side,
        intensity: 0.9,
        text: `${def.name} WILL NOT STAY DOWN`,
      });
      nearfalls[def.side] += 1;
      def.stun = 0;
      continue;
    }

    def.hp = Math.max(0, def.hp - dmg);
    if (rng() < move.stunChance) def.stun = rareMove ? 2 : 1;
    if (rareMove) usedRare = true;

    const kind = rareMove ? "finisher" : superMove ? "super" : "move";
    push({
      kind,
      actor,
      moveId: move.id,
      damage: dmg,
      intensity,
      text: move.callout,
      timing: actor === "left" && move.tier !== "basic",
      slowmo: superMove,
      zoom: rareMove ? 1.4 : superMove ? 1.22 : 1,
    });

    if (def.hp <= 0) {
      finishMoveId = move.id;
      break;
    }

    if (def.hp / def.maxHp < 0.22 && nearfalls[def.side] < 2 && rng() < 0.5) {
      t += 0.45;
      push({ kind: "nearfall", actor, intensity: 0.85, text: "ONE… TWO…" });
      t += 0.55;
      push({ kind: "kickout", actor: def.side, intensity: 0.95, text: "KICKOUT!" });
      nearfalls[def.side] += 1;
      def.hp = Math.max(def.hp, Math.round(def.maxHp * 0.1));
    }
  }

  if (left.hp > 0 && right.hp > 0) {
    t += 0.4;
    push({ kind: "timeout", actor: "both", intensity: 0.7, text: "JUDGES CALL IT" });
    if (requireRare && !usedRare && left.hp >= right.hp) {
      // Championship ram survives a non-rare decision
      right.hp = Math.max(right.hp, 1);
      left.hp = 0;
    } else if (left.hp === right.hp) {
      if (rng() < 0.5) right.hp = 0;
      else left.hp = 0;
    } else if (left.hp > right.hp) right.hp = 0;
    else left.hp = 0;
  }

  const winner = left.hp > 0 ? "left" : "right";
  t += 0.5;
  if (winner === "left" && (usedRare || finishMoveId)) {
    push({
      kind: "pin",
      actor: "left",
      intensity: 1,
      text: "ONE… TWO… THREE!",
      slowmo: true,
      zoom: 1.3,
      moveId: finishMoveId,
    });
    t += 1.1;
  }
  push({
    kind: "ko",
    actor: winner,
    intensity: 1,
    text: `${winner === "left" ? left.name : right.name} WINS`,
  });
  t += 0.8;
  push({
    kind: "celebrate",
    actor: winner,
    intensity: 1,
    text: winner === "left" ? "THE CHAMPIONSHIP ROAR" : "The paddock goes quiet",
  });

  const winnerSheep = winner === "left" ? leftSheep : rightSheep;
  const loserSheep = winner === "left" ? rightSheep : leftSheep;
  const ratingDiff = powerRating(loserSheep) - powerRating(winnerSheep);
  const prize = Math.max(
    15,
    Math.round(
      28 +
        powerRating(loserSheep) * 0.35 +
        Math.max(0, ratingDiff) * 0.5 +
        stageDef(winnerSheep.stage).size * 12,
    ),
  );

  return {
    seed,
    events,
    winner,
    duration: t,
    leftHpEnd: Math.max(0, left.hp),
    rightHpEnd: Math.max(0, right.hp),
    prize,
    left: cloneSheep(leftSheep),
    right: cloneSheep(rightSheep),
    finishMoveId,
    requiredRare: requireRare,
    usedRare,
    title: opts.title ?? "Bout",
  };
}
