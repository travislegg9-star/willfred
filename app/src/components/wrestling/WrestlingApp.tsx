import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronLeft,
  Coins,
  Crown,
  Dumbbell,
  House,
  PawPrint,
  SkipForward,
  Store,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { BREEDS, FOODS, GEAR, MOVES, RARITY_COLOR, TRAINING, isMoveUnlocked, lockReason, stageDef, stageIndex, unlockedMoves } from "@/game/wrestling/catalog";
import { simulateFight } from "@/game/wrestling/combat";
import { decodeSheepCode, encodeSheepCode } from "@/game/wrestling/codes";
import { playArena, type ArenaRuntime } from "@/game/wrestling/draw";
import {
  activeSheep,
  applyXp,
  canPromote,
  createSheep,
  defaultSave,
  feedSheep,
  loadSave,
  persistSave,
  promote,
  refreshArena,
  stableCap,
  trainSheep,
} from "@/game/wrestling/save";
import { cloneSheep, clearBuffs, effectiveStats, hashSeed, maxHp, powerRating } from "@/game/wrestling/sheep";
import { isWrestlingMuted, playCue, setWrestlingMuted, unlockWrestlingAudio } from "@/game/wrestling/audio";
import type { ArenaCard, BreedKey, FightResult, SaveState, Sheep } from "@/game/wrestling/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SheepPortrait } from "@/components/wrestling/SheepPortrait";

type Screen = "home" | "stable" | "train" | "shop" | "arena" | "challenge" | "moves";

const NAV: { id: Screen; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "stable", label: "Stable", icon: PawPrint },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "shop", label: "Shop", icon: Store },
  { id: "arena", label: "Arena", icon: Swords },
];

export function WrestlingApp() {
  const [save, setSave] = useState<SaveState>(() => (typeof window === "undefined" ? defaultSave() : loadSave()));
  const [screen, setScreen] = useState<Screen>("home");
  const [toast, setToast] = useState<string | null>(null);
  const [fight, setFight] = useState<FightResult | null>(null);
  const [fighting, setFighting] = useState(false);
  const [result, setResult] = useState<{ won: boolean; coins: number; trophies: number; sheep: Sheep; title: string; finish?: string } | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lHp, setLHp] = useState(1);
  const [rHp, setRHp] = useState(1);
  const [banner, setBanner] = useState("");
  const [muted, setMuted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<ArenaRuntime | null>(null);
  const fightMode = useRef<"arena" | "code">("arena");
  const toastTimer = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const patch = useCallback((fn: (s: SaveState) => SaveState) => {
    setSave((prev) => {
      const next = fn(prev);
      persistSave(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onHide = () => persistSave(save);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [save]);

  const active = activeSheep(save);
  const arena = useMemo(() => refreshArena(save), [save]);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const go = (s: Screen) => {
    unlockWrestlingAudio();
    setScreen(s);
  };

  const startFight = (card: ArenaCard) => {
    if (!active) return;
    if (card.requireRare) {
      const rares = unlockedMoves(save.totalFights, active.wins, active.stage, active.breed).filter((m) => m.tier === "rare");
      if (!rares.length) {
        showToast("Need a rare finisher — win more bouts to unlock The Shearing (40).");
        return;
      }
    }
    unlockWrestlingAudio();
    playCue("bell", 0.5);
    const seed = hashSeed([active.id, card.sheep.seed, active.wins, Date.now() & 0xffff]);
    const res = simulateFight(cloneSheep(active), cloneSheep(card.sheep), seed, {
      requireRare: card.requireRare,
      title: card.title,
      careerFights: save.totalFights,
    });
    res.prize = Math.max(res.prize, card.prize);
    fightMode.current = "arena";
    setFight(res);
    setFighting(true);
    setLHp(maxHp(res.left));
    setRHp(maxHp(res.right));
    setBanner("");
    setResult(null);
  };

  const startCodeFight = () => {
    if (!active) return;
    const decoded = decodeSheepCode(codeInput);
    if (!decoded.ok) return showToast(decoded.error);
    unlockWrestlingAudio();
    const seed = hashSeed([active.id, decoded.sheep.seed, "code"]);
    const res = simulateFight(cloneSheep(active), cloneSheep(decoded.sheep), seed, {
      title: "Friend Duel",
      careerFights: save.totalFights,
    });
    fightMode.current = "code";
    setFight(res);
    setFighting(true);
    setLHp(maxHp(res.left));
    setRHp(maxHp(res.right));
    showToast(`Challenging ${decoded.sheep.name}`);
  };

  useEffect(() => {
    if (!fighting || !fight || !canvasRef.current) return;
    arenaRef.current?.stop();
    arenaRef.current = playArena(canvasRef.current, fight, {
      reducedMotion: reduced,
      onHp: (l, r) => {
        setLHp(l);
        setRHp(r);
      },
      onBanner: setBanner,
      onMeter: () => undefined,
      onCue: (k, i) => playCue(k, i),
      onDone: () => finishFight(fight),
    });
    return () => arenaRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighting, fight]);

  const finishFight = (f: FightResult) => {
    arenaRef.current?.stop();
    arenaRef.current = null;
    setFighting(false);
    const sheep = activeSheep(save);
    if (!sheep) return;
    const won = f.winner === "left";
    let next = { ...sheep };
    if (won) {
      next.wins += 1;
      next.earnings += f.prize;
      next = applyXp(next, 35 + Math.round(powerRating(f.right) * 0.15)).sheep;
    } else {
      next.losses += 1;
      next = applyXp(next, 12).sheep;
    }
    next = clearBuffs(next);
    const winStreak = won ? save.winStreak + 1 : 0;
    const trophyDelta = won ? (fightMode.current === "code" ? 2 : 1) + (winStreak >= 3 ? 1 : 0) + (f.usedRare ? 1 : 0) : 0;
    const coinDelta = won ? f.prize : Math.max(5, Math.floor(f.prize * 0.2));
    const newFights = save.totalFights + 1;
    const newly = unlockedMoves(newFights, next.wins, next.stage, next.breed)
      .map((m) => m.id)
      .filter((id) => !unlockedMoves(save.totalFights, sheep.wins, sheep.stage, sheep.breed).some((m) => m.id === id));
    patch((s) => ({
      ...s,
      coins: s.coins + coinDelta,
      trophies: s.trophies + trophyDelta,
      winStreak,
      bestWinStreak: Math.max(s.bestWinStreak, winStreak),
      totalFights: newFights,
      championships: s.championships + (won && f.title.includes("Championship") ? 1 : 0),
      unlockedMoves: unlockedMoves(newFights, next.wins, next.stage, next.breed).map((m) => m.id),
      sheep: s.sheep.map((x) => (x.id === sheep.id ? next : x)),
    }));
    if (newly.length) {
      const names = newly.map((id) => MOVES.find((m) => m.id === id)?.name).filter(Boolean);
      showToast(`New move: ${names.join(", ")}`);
    }
    setResult({
      won,
      coins: coinDelta,
      trophies: trophyDelta,
      sheep: next,
      title: f.title,
      finish: f.finishMoveId ? MOVES.find((m) => m.id === f.finishMoveId)?.name : undefined,
    });
    playCue(won ? "celebrate" : "smash", 0.8);
  };

  const skipFight = () => {
    if (!fight) return;
    finishFight(fight);
  };

  const lMax = fight ? maxHp(fight.left) : 1;
  const rMax = fight ? maxHp(fight.right) : 1;
  const navOn = (id: Screen) => screen === id || (screen === "challenge" && id === "arena") || (screen === "moves" && id === "home");

  return (
    <div className="flex h-dvh bg-bg text-fg">
      {!fighting && (
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-bg-elevated lg:flex">
          <Link to="/" className="flex items-center gap-1 px-5 pt-6 text-sm font-medium text-muted no-underline hover:text-fg">
            <ChevronLeft className="size-4" />
            Games
          </Link>
          <div className="px-5 pt-6">
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent uppercase">Paddock</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight">Wrestling</p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1 px-3">
            {NAV.map((n) => {
              const Icon = n.icon;
              const on = navOn(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                    on ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {n.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => go("moves")}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                screen === "moves" ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg",
              )}
            >
              <BookOpen className="size-4" />
              Moves
            </button>
          </nav>
          <div className="border-t border-border px-5 py-4 text-xs text-muted">{save.playerName}'s stable</div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!fighting && (
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-8">
            <Link to="/" className="flex items-center gap-1 text-sm font-medium text-muted no-underline hover:text-fg lg:hidden">
              <ChevronLeft className="size-4" />
              Games
            </Link>
            <div className="min-w-0 lg:hidden">
              <div className="font-display text-xs font-semibold tracking-[0.18em] text-accent uppercase">Sheep Wrestling</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg-subtle px-3 text-sm font-semibold tabular-nums">
                <Coins className="size-3.5 text-muted" />
                {Math.floor(save.coins)}
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg-subtle px-3 text-sm font-semibold tabular-nums">
                <Trophy className="size-3.5 text-muted" />
                {save.trophies}
              </span>
            </div>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!fighting && (
            <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-10">
              {screen === "home" && <Home save={save} active={active} patch={patch} showToast={showToast} go={go} />}
              {screen === "stable" && <Stable save={save} active={active} patch={patch} showToast={showToast} />}
              {screen === "train" && <Train save={save} active={active} patch={patch} showToast={showToast} />}
              {screen === "shop" && <Shop save={save} patch={patch} showToast={showToast} />}
              {screen === "arena" && <Arena save={save} active={active} arena={arena} go={go} onFight={startFight} />}
              {screen === "challenge" && (
                <Challenge
                  active={active}
                  codeInput={codeInput}
                  lastCode={lastCode}
                  setCodeInput={setCodeInput}
                  onCopy={() => {
                    if (!active) return;
                    const code = encodeSheepCode(active);
                    setLastCode(code);
                    void navigator.clipboard?.writeText(code).then(
                      () => showToast("Code copied — send it to a mate"),
                      () => showToast("Code ready"),
                    );
                  }}
                  onFight={startCodeFight}
                  go={go}
                />
              )}
              {screen === "moves" && <Moves save={save} active={active} />}
            </main>
          )}
        </div>

        {!fighting && (
          <nav className="border-t border-border bg-bg-elevated pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="flex justify-around px-1 py-1.5">
              {NAV.map((n) => {
                const Icon = n.icon;
                const on = navOn(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => go(n.id)}
                    className={cn("flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-semibold", on ? "text-fg" : "text-muted")}
                  >
                    <Icon className="size-5" strokeWidth={on ? 2.2 : 1.7} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {fighting && fight && (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg">
          <div className="flex items-center gap-4 border-b border-border bg-bg-elevated/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <HpSide name={fight.left.name} hp={lHp} max={lMax} align="left" />
            <div className="font-display text-xs font-semibold tracking-[0.2em] text-accent">LIVE</div>
            <HpSide name={fight.right.name} hp={rHp} max={rMax} align="right" />
          </div>
          <div className="relative min-h-0 flex-1">
            <canvas ref={canvasRef} className="block h-full w-full" />
            {banner ? (
              <div className="pointer-events-none absolute top-[28%] left-0 right-0 text-center font-display text-xl font-semibold tracking-wide text-fg">
                {banner}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 bg-bg-elevated px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              variant="secondary"
              size="icon"
              aria-label={muted || isWrestlingMuted() ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                setWrestlingMuted(next);
              }}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={skipFight}>
              <SkipForward className="size-4" />
              Skip to result
            </Button>
          </div>
        </div>
      )}

      {result && !fighting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-5">
          <div className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-bg-subtle">
              {result.won ? <Crown className="size-6 text-accent" /> : <Swords className="size-6 text-danger" />}
            </div>
            <h2 className="font-display text-4xl font-semibold tracking-tight">{result.won ? "WIN" : "DOWN"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {result.won ? `${result.sheep.name} takes ${result.title}` : `${result.sheep.name} couldn\u2019t hold ${result.title}`}
              {result.finish ? `. Finished with ${result.finish}.` : "."}
            </p>
            <p className="mt-3 text-sm font-semibold tabular-nums">
              +{result.coins} coins{result.trophies ? ` · +${result.trophies} trophies` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              Record {result.sheep.wins}W – {result.sheep.losses}L
            </p>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                setResult(null);
                setFight(null);
                setScreen("arena");
              }}
            >
              Back to Arena
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-60 max-w-[90vw] -translate-x-1/2 rounded-full border border-border bg-bg-elevated px-4 py-2 text-center text-sm font-medium lg:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function HpSide({ name, hp, max, align }: { name: string; hp: number; max: number; align: "left" | "right" }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  return (
    <div className={cn("min-w-0 flex-1", align === "right" && "text-right")}>
      <div className="truncate text-sm font-semibold">{name}</div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <i
          className={cn("block h-full rounded-full", align === "left" ? "bg-accent" : "bg-fg")}
          style={{
            width: pct + "%",
            marginLeft: align === "right" ? `${100 - pct}%` : 0,
          }}
        />
      </div>
    </div>
  );
}

function SheepCard({ sheep, selected, onClick }: { sheep: Sheep; selected?: boolean; onClick?: () => void }) {
  const B = BREEDS[sheep.breed];
  const st = stageDef(sheep.stage);
  const inner = (
    <div className="flex gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#1a1814]">
        <SheepPortrait sheep={sheep} className="h-16 w-16" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold">{sheep.name}</span>
          <span className="text-xs font-medium" style={{ color: RARITY_COLOR[B.rarity] }}>
            {B.name}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-muted">
          {st.name} · Lv {sheep.level} · {powerRating(sheep)}
        </div>
        <div className="text-xs text-subtle">
          {sheep.wins}W – {sheep.losses}L{sheep.buffs ? " · buffed" : ""}
        </div>
      </div>
    </div>
  );
  if (!onClick) {
    return <div className="rounded-xl border border-accent/40 bg-bg-elevated p-4">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-full rounded-xl border p-4 text-left", selected ? "border-accent bg-bg-elevated" : "border-border bg-bg-elevated")}
    >
      {inner}
    </button>
  );
}

function StatGrid({ sheep }: { sheep: Sheep }) {
  const stats = effectiveStats(sheep);
  const rows = [
    { k: "Power", v: stats.power },
    { k: "Tough", v: stats.toughness },
    { k: "Weight", v: stats.weight },
    { k: "Agility", v: stats.agility },
    { k: "Spirit", v: stats.spirit },
    { k: "Charge", v: stats.charge },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map((r) => (
        <div key={r.k} className="rounded-md bg-bg-subtle px-3 py-2.5">
          <div className="text-xs font-medium text-muted">{r.k}</div>
          <div className="font-display text-xl font-semibold tabular-nums">{r.v.toFixed(1)}</div>
        </div>
      ))}
    </div>
  );
}

function Home({
  save,
  active,
  patch,
  showToast,
  go,
}: {
  save: SaveState;
  active: Sheep | null;
  patch: (fn: (s: SaveState) => SaveState) => void;
  showToast: (m: string) => void;
  go: (s: Screen) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="relative min-h-72 overflow-hidden rounded-xl lg:col-span-7">
        <img src="/art/ring.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
        <div className="relative flex min-h-72 flex-col justify-end p-6">
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent uppercase">Paddock Championship</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight lg:text-5xl">Sheep Wrestling</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Raise lambs into God Rams. Super meters. Rare finishers. Championship rams will not stay down without one.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => go("arena")}>Enter Arena</Button>
            <Button variant="secondary" onClick={() => go("challenge")}>
              Friend Code
            </Button>
            <Button variant="ghost" onClick={() => go("moves")}>
              Move Codex
            </Button>
          </div>
        </div>
      </section>
      <div className="space-y-4 lg:col-span-5">
        {active && (
          <>
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Active fighter</p>
            <SheepCard sheep={active} />
            <StatGrid sheep={active} />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-bg-elevated p-4">
            <div className="text-xs text-muted">Win streak</div>
            <div className="font-display text-3xl font-semibold tabular-nums">{save.winStreak}</div>
            <div className="text-xs text-subtle">Best {save.bestWinStreak}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated p-4">
            <div className="text-xs text-muted">Career bouts</div>
            <div className="font-display text-3xl font-semibold tabular-nums">{save.totalFights}</div>
            <div className="text-xs text-subtle">
              {save.sheep.length} sheep · {save.championships} belts
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated p-4">
          <label className="text-xs font-medium text-muted" htmlFor="farmer-name">
            Farmer name
          </label>
          <input
            id="farmer-name"
            maxLength={18}
            defaultValue={save.playerName}
            className="mt-2 h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            onChange={(e) => patch((s) => ({ ...s, playerName: e.target.value.trim().slice(0, 18) || "Farmer" }))}
          />
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              if (save.lastDaily === today) return showToast("Daily already claimed");
              patch((s) => ({ ...s, lastDaily: today, coins: s.coins + 80 + s.trainerLevel * 15 }));
              showToast("Daily bag collected");
            }}
          >
            Claim daily coins
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stable({
  save,
  active,
  patch,
  showToast,
}: {
  save: SaveState;
  active: Sheep | null;
  patch: (fn: (s: SaveState) => SaveState) => void;
  showToast: (m: string) => void;
}) {
  const cap = stableCap(save.stableLevel);
  const cost = 200 + save.stableLevel * 250;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Stable</h2>
            <p className="text-sm text-muted">
              {save.sheep.length}/{cap} pens · Barn lv {save.stableLevel}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (save.coins < cost) return showToast("Not enough coins");
              patch((s) => ({ ...s, coins: s.coins - cost, stableLevel: s.stableLevel + 1 }));
              showToast("Stable expanded");
            }}
          >
            Expand · {cost}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {save.sheep.map((s) => (
            <SheepCard key={s.id} sheep={s} selected={s.id === save.activeId} onClick={() => patch((prev) => ({ ...prev, activeId: s.id }))} />
          ))}
        </div>
      </div>
      {active && (
        <div className="rounded-xl border border-border bg-bg-elevated p-5 lg:col-span-5">
          <div className="mb-3 font-semibold">Manage {active.name}</div>
          <input
            className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            maxLength={16}
            defaultValue={active.name}
            key={active.id}
            onBlur={(e) => {
              const clean = e.target.value.trim().slice(0, 16) || active.name;
              patch((s) => ({
                ...s,
                sheep: s.sheep.map((x) => (x.id === active.id ? { ...x, name: clean } : x)),
              }));
            }}
          />
          <div className="mt-4">
            <StatGrid sheep={active} />
          </div>
          <div className="mt-3 text-xs text-muted">
            XP {Math.floor(active.xp)}/{40 + active.level * 28} · {stageDef(active.stage).name}
          </div>
          {canPromote(active) && (
            <Button
              className="mt-4 w-full"
              onClick={() => {
                const costP = stageDef(active.stage).promoteCost;
                if (save.coins < costP) return showToast(`Need ${costP} to promote`);
                const next = promote(active);
                patch((s) => ({
                  ...s,
                  coins: s.coins - costP,
                  sheep: s.sheep.map((x) => (x.id === active.id ? next : x)),
                }));
                showToast(`${next.name} is now a ${stageDef(next.stage).name}`);
              }}
            >
              Promote to {stageDef(STAGE_NEXT(active.stage)).name} · {stageDef(active.stage).promoteCost}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function STAGE_NEXT(k: string) {
  const order = ["lamb", "yearling", "ram", "prize", "god", "legend"] as const;
  const i = Math.min(order.length - 1, order.indexOf(k as (typeof order)[number]) + 1);
  return order[i]!;
}

function Row({
  title,
  blurb,
  meta,
  onClick,
}: {
  title: string;
  blurb: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-4 rounded-xl border border-border bg-bg-elevated p-4 text-left hover:border-border-strong">
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{title}</b>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{blurb}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{meta}</span>
    </button>
  );
}

function Train({
  save,
  active,
  patch,
  showToast,
}: {
  save: SaveState;
  active: Sheep | null;
  patch: (fn: (s: SaveState) => SaveState) => void;
  showToast: (m: string) => void;
}) {
  if (!active) return <p className="text-muted">No sheep</p>;
  const tCost = 150 + save.trainerLevel * 200;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Feed & Train</h2>
            <p className="text-sm text-muted">Powering up {active.name}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (save.coins < tCost) return showToast("Not enough coins");
              patch((s) => ({ ...s, coins: s.coins - tCost, trainerLevel: s.trainerLevel + 1 }));
              showToast("Trainer level up");
            }}
          >
            Trainer lv {save.trainerLevel}
          </Button>
        </div>
        <SheepCard sheep={active} />
        <div className="mt-4">
          <StatGrid sheep={active} />
        </div>
      </div>
      <div className="space-y-6 lg:col-span-7">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Food</p>
          <div className="grid gap-2">
            {FOODS.map((f) => (
              <Row
                key={f.key}
                title={f.name}
                blurb={f.blurb}
                meta={`${f.cost}`}
                onClick={() => {
                  if (save.coins < f.cost) return showToast("Not enough coins");
                  if (stageIndex(active.stage) < stageIndex(f.minStage)) return showToast(`Only for ${f.minStage}+ sheep`);
                  const fed = feedSheep(active, f.key);
                  patch((s) => ({
                    ...s,
                    coins: s.coins - f.cost,
                    sheep: s.sheep.map((x) => (x.id === active.id ? fed : x)),
                  }));
                  showToast(`${active.name} ate ${f.name}`);
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Training yard</p>
          <div className="grid gap-2">
            {TRAINING.map((tr) => {
              const cost = Math.round(tr.cost * (1 - (save.trainerLevel - 1) * 0.06));
              return (
                <Row
                  key={tr.key}
                  title={tr.name}
                  blurb={tr.blurb}
                  meta={`${cost}`}
                  onClick={() => {
                    if (save.coins < cost) return showToast("Not enough coins");
                    const trained = trainSheep(active, tr.key);
                    patch((s) => ({
                      ...s,
                      coins: s.coins - cost,
                      sheep: s.sheep.map((x) => (x.id === active.id ? trained : x)),
                    }));
                    showToast(`${active.name} finished ${tr.name}`);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shop({
  save,
  patch,
  showToast,
}: {
  save: SaveState;
  patch: (fn: (s: SaveState) => SaveState) => void;
  showToast: (m: string) => void;
}) {
  const bestStage = Math.max(0, ...save.sheep.map((s) => stageIndex(s.stage)));
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="font-display text-2xl font-semibold">Market</h2>
        <p className="mb-4 text-sm text-muted">Lambs start cheap. Prize stock costs a fortune.</p>
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Sheep stock</p>
        <div className="grid gap-2">
          {(Object.keys(BREEDS) as BreedKey[]).map((k) => {
            const b = BREEDS[k];
            return (
              <Row
                key={b.key}
                title={`${b.name}`}
                blurb={`${b.rarity} · ${b.blurb}`}
                meta={b.cost === 0 ? "Free" : `${b.cost}`}
                onClick={() => {
                  if (save.sheep.length >= stableCap(save.stableLevel)) return showToast("Stable full — upgrade the barn");
                  if (save.coins < b.cost) return showToast("Not enough coins");
                  if (stageIndex(b.minStageUnlock) > bestStage && b.cost > 0) {
                    return showToast(`Unlock by reaching ${b.minStageUnlock} stage first`);
                  }
                  const used = new Set(save.sheep.map((s) => s.name));
                  const lamb = createSheep({ breed: b.key, stage: "lamb", usedNames: used });
                  patch((s) => ({
                    ...s,
                    coins: s.coins - b.cost,
                    sheep: s.sheep.concat([lamb]),
                    activeId: lamb.id,
                  }));
                  showToast(`Welcome ${lamb.name} the ${b.name} lamb`);
                }}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Gear</p>
        <div className="grid gap-2">
          {GEAR.map((g) => {
            const owned = save.ownedGear.includes(g.key);
            return (
              <Row
                key={g.key}
                title={g.name}
                blurb={g.blurb}
                meta={owned ? "Equip" : `${g.cost}`}
                onClick={() => {
                  const active = activeSheep(save);
                  if (!owned) {
                    if (save.coins < g.cost) return showToast("Not enough coins");
                    patch((s) => ({ ...s, coins: s.coins - g.cost, ownedGear: s.ownedGear.concat([g.key]) }));
                  }
                  if (!active) return;
                  patch((s) => ({
                    ...s,
                    sheep: s.sheep.map((x) => (x.id === active.id ? { ...x, [g.slot]: g.key } : x)),
                  }));
                  showToast(`Equipped ${g.name} on ${active.name}`);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Arena({
  save,
  active,
  arena,
  go,
  onFight,
}: {
  save: SaveState;
  active: Sheep | null;
  arena: ArenaCard[];
  go: (s: Screen) => void;
  onFight: (c: ArenaCard) => void;
}) {
  void save;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Arena</h2>
        <p className="text-sm text-muted">Lights, named moves, rare finishers. Tap a bout.</p>
      </div>
      {active && <SheepCard sheep={active} />}
      <Button variant="secondary" className="w-full" onClick={() => go("challenge")}>
        Friend codes
      </Button>
      <div className="flex flex-col gap-3">
        {arena.map((o) => (
          <button
            key={o.id}
            type="button"
            className="flex w-full shrink-0 items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 text-left"
            onClick={() => onFight(o)}
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#1a1814]">
              <SheepPortrait sheep={o.sheep} className="h-16 w-16" />
            </div>
            <span className="min-w-0 flex-1 py-0.5">
              <span className="block font-semibold text-fg">
                {o.title}
                {o.requireRare ? <span className="ml-2 text-xs font-semibold text-accent">Rare</span> : null}
              </span>
              <span className="mt-1 block text-sm leading-snug text-muted">{o.blurb}</span>
              <span className="mt-1 block text-xs text-subtle">
                vs {o.sheep.name} · {powerRating(o.sheep)} · Prize {o.prize}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Challenge({
  active,
  codeInput,
  lastCode,
  setCodeInput,
  onCopy,
  onFight,
  go,
}: {
  active: Sheep | null;
  codeInput: string;
  lastCode: string | null;
  setCodeInput: (s: string) => void;
  onCopy: () => void;
  onFight: () => void;
  go: (s: Screen) => void;
}) {
  return (
    <div className="mx-auto max-w-lg">
      <Button variant="ghost" size="sm" className="mb-4 px-0" onClick={() => go("arena")}>
        Back to arena
      </Button>
      <h2 className="font-display text-2xl font-semibold">Friend Code Duels</h2>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Export your ram as a WOOF code. A mate pastes it and the rams go — no account needed.
      </p>
      {active && <SheepCard sheep={active} />}
      <Button className="my-4 w-full" onClick={onCopy}>
        Copy my sheep code
      </Button>
      {lastCode && <div className="mb-4 break-all rounded-lg border border-border bg-bg p-3 font-mono text-xs text-muted">{lastCode}</div>}
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Paste rival code</p>
      <textarea
        className="min-h-24 w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs"
        placeholder="WOOF-…"
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
      />
      <Button variant="accent" className="mt-3 w-full" onClick={onFight}>
        Challenge code
      </Button>
    </div>
  );
}

function Moves({ save, active }: { save: SaveState; active: Sheep | null }) {
  if (!active) return <p className="text-muted">No sheep</p>;
  return (
    <>
      <h2 className="font-display text-2xl font-semibold">Move Codex</h2>
      <p className="mb-6 text-sm text-muted">Career bouts: {save.totalFights}. Rares pin championship rams.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {(["basic", "power", "super", "rare"] as const).map((tier) => (
          <div key={tier}>
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{tier}</p>
            <div className="grid gap-2">
              {MOVES.filter((m) => m.tier === tier).map((m) => {
                const on = isMoveUnlocked(m, save.totalFights, active.wins, active.stage, active.breed);
                return (
                  <div key={m.id} className={cn("rounded-xl border p-4", on ? "border-border bg-bg-elevated" : "border-border/60 bg-bg opacity-55")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <b className="font-display tracking-wide">{m.name}</b>
                      <span className="text-xs font-semibold text-muted">{on ? "Owned" : "Locked"}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{m.blurb}</p>
                    {!on && <p className="mt-1 text-xs text-accent">{lockReason(m)}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
