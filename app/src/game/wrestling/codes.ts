import { BREEDS, STAGE_ORDER } from "./catalog";
import { uid } from "./sheep";
import type { BreedKey, Sheep, StageKey } from "./types";

function serializeSheepLite(s: Sheep) {
  return {
    n: s.name,
    b: s.breed,
    st: s.stage,
    lv: s.level,
    p: +s.power.toFixed(2),
    t: +s.toughness.toFixed(2),
    w: +s.weight.toFixed(2),
    a: +s.agility.toFixed(2),
    sp: +s.spirit.toFixed(2),
    c: +s.charge.toFixed(2),
    wi: s.wins,
    lo: s.losses,
    se: s.seed,
    col: s.collar,
    ho: s.horns,
    bo: s.body,
  };
}

function deserializeSheepLite(o: Record<string, unknown>): Sheep {
  const breed = typeof o.b === "string" && o.b in BREEDS ? (o.b as BreedKey) : "merino";
  const stage = typeof o.st === "string" && STAGE_ORDER.includes(o.st as StageKey) ? (o.st as StageKey) : "lamb";
  return {
    id: uid(),
    name: String(o.n || "Rival").slice(0, 16),
    breed,
    stage,
    level: Math.max(1, Math.min(20, Number(o.lv) || 1)),
    xp: 0,
    power: Number(o.p) || 8,
    toughness: Number(o.t) || 8,
    weight: Number(o.w) || 8,
    agility: Number(o.a) || 8,
    spirit: Number(o.sp) || 8,
    charge: Number(o.c) || 8,
    wins: Number(o.wi) || 0,
    losses: Number(o.lo) || 0,
    seed: Number(o.se) || 1,
    bornAt: Date.now(),
    collar: typeof o.col === "string" ? o.col : null,
    horns: typeof o.ho === "string" ? o.ho : null,
    body: typeof o.bo === "string" ? o.bo : null,
    earnings: 0,
  };
}

function simpleChecksum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 46656;
}

export function encodeSheepCode(sheep: Sheep): string {
  const json = JSON.stringify(serializeSheepLite(sheep));
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const checksum = simpleChecksum(b64).toString(36).toUpperCase().padStart(3, "0");
  return "WOOF-" + checksum + "-" + b64;
}

export function decodeSheepCode(raw: string): { ok: true; sheep: Sheep } | { ok: false; error: string } {
  try {
    const original = raw.trim().replace(/\s+/g, "");
    const parts = original.split("-");
    if (parts.length < 3 || parts[0]!.toUpperCase() !== "WOOF") {
      return { ok: false, error: "Not a WOOF sheep code" };
    }
    const body = parts.slice(2).join("-");
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    const json = decodeURIComponent(escape(atob(pad)));
    const sheep = deserializeSheepLite(JSON.parse(json) as Record<string, unknown>);
    if (sheep.power > 80 || sheep.toughness > 80) {
      return { ok: false, error: "Sheep stats look cheated — rejected" };
    }
    return { ok: true, sheep };
  } catch {
    return { ok: false, error: "Could not read that code" };
  }
}
