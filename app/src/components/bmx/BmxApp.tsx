import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultRider,
  drawBmx,
  parkEnd,
  stepRider,
  type BmxHooks,
  type Rider,
  type TouchState,
} from "@/game/bmx/engine";
import { cn } from "@/lib/utils";

type Phase = "title" | "playing" | "paused" | "crashed" | "finished";
type ControlMode = "auto" | "always" | "off";

const BEST_KEY = "woofa_bmx_best";
const CTRL_KEY = "woofa_bmx_controls";
const GAME_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "Space",
  "KeyT",
  "KeyJ",
  "KeyP",
  "Escape",
  "KeyR",
  "Enter",
]);

const emptyTouch = (): TouchState => ({
  gas: false,
  brake: false,
  flipUp: false,
  flipDown: false,
  jump: false,
  trick: false,
  jumpPressed: false,
  trickPressed: false,
});

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number) {
  try {
    const prev = loadBest();
    if (n > prev) localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function loadCtrl(): ControlMode {
  try {
    const v = localStorage.getItem(CTRL_KEY);
    if (v === "always" || v === "off" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

function saveCtrl(mode: ControlMode) {
  try {
    localStorage.setItem(CTRL_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function BmxApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const riderRef = useRef<Rider>(defaultRider());
  const keysRef = useRef<Record<string, boolean>>({});
  const touchRef = useRef<TouchState>(emptyTouch());
  const phaseRef = useRef<Phase>("title");
  const camRef = useRef({ x: 0, y: 0 });
  const [phase, setPhase] = useState<Phase>("title");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [flash, setFlash] = useState<{ name: string; t: number } | null>(null);
  const [crash, setCrash] = useState("");
  const [best, setBest] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [air, setAir] = useState(0);
  const [progress, setProgress] = useState(0);
  const [controls, setControls] = useState<ControlMode>("auto");
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    setBest(loadBest());
    setControls(loadCtrl());
    const mq = window.matchMedia("(max-width: 639px), (pointer: coarse)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const resetRun = useCallback(() => {
    riderRef.current = defaultRider();
    keysRef.current = {};
    touchRef.current = emptyTouch();
    setScore(0);
    setCombo(1);
    setFlash(null);
    setCrash("");
    setSpeed(0);
    setAir(0);
    setProgress(0);
    setPhaseBoth("playing");
  }, [setPhaseBoth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (!GAME_CODES.has(e.code)) return;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      keysRef.current[e.code] = down;
      if (!down) return;
      const p = phaseRef.current;
      if ((e.code === "Enter" || e.code === "Space") && (p === "title" || p === "crashed" || p === "finished")) {
        resetRun();
      } else if ((e.code === "Escape" || e.code === "KeyP") && p === "playing") {
        setPhaseBoth("paused");
      } else if ((e.code === "Escape" || e.code === "KeyP") && p === "paused") {
        setPhaseBoth("playing");
      } else if (e.code === "KeyR" && p !== "title") {
        resetRun();
      }
    };
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    const clear = () => {
      keysRef.current = {};
      touchRef.current = emptyTouch();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [resetRun, setPhaseBoth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hooks: BmxHooks = {
      pulseTrick: (name) => setFlash({ name, t: performance.now() }),
      onCrash: (reason, sc) => {
        setCrash(reason);
        setScore(sc);
        setPhaseBoth("crashed");
      },
      onFinish: (sc) => {
        setScore(sc);
        setPhaseBoth("finished");
      },
      saveBest: (sc) => {
        saveBest(sc);
        setBest(loadBest());
      },
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || 360;
      const h = parent?.clientHeight || 520;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    if (import.meta.env.DEV || (typeof window !== "undefined" && window.location.search.includes("qa=1"))) {
      window.__controlsTest = {
        getSpeed: () => Math.hypot(riderRef.current.vx, riderRef.current.vy),
        getX: () => riderRef.current.x,
        getYaw: () => 0,
        setKeys: (codes) => {
          keysRef.current = {};
          for (const c of codes) keysRef.current[c] = true;
        },
      };
    }

    let last = performance.now();
    let hudAcc = 0;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const rider = riderRef.current;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (phaseRef.current === "playing") {
        stepRider(rider, dt, keysRef.current, touchRef.current, true, hooks);
      }
      const cam = camRef.current;
      const tx = rider.x - w * 0.34;
      const ty = rider.y - h * 0.58;
      const k = phaseRef.current === "playing" ? Math.min(1, 7 * dt) : 1;
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
      drawBmx(ctx, w, h, rider, cam);

      hudAcc += dt;
      if (hudAcc > 0.08) {
        hudAcc = 0;
        setScore(rider.score);
        setCombo(rider.combo);
        setSpeed(Math.hypot(rider.vx, rider.vy));
        setAir(rider.grounded ? 0 : rider.airTime);
        setProgress(Math.max(0, Math.min(1, rider.x / parkEnd)));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (window.__controlsTest) delete window.__controlsTest;
    };
  }, [setPhaseBoth]);

  const hold = (key: keyof TouchState, edge?: "jumpPressed" | "trickPressed") => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const t = touchRef.current;
      t[key] = true as never;
      if (edge) t[edge] = true;
    },
    onPointerUp: () => {
      touchRef.current[key] = false as never;
    },
    onPointerCancel: () => {
      touchRef.current[key] = false as never;
    },
  });

  const overlay = phase !== "playing";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="relative min-h-0 flex-1 touch-none">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />

        {phase === "playing" && (
          <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-3xl font-semibold tabular-nums leading-none">{score}</div>
                <div className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">
                  {combo > 1.05 ? `${combo.toFixed(1)}× combo` : "score"}
                </div>
              </div>
              <div className="text-right text-xs font-semibold tabular-nums text-muted">
                <div>{Math.round(speed)} u/s</div>
                {air > 0.05 && <div className="text-fg">{air.toFixed(2)}s air</div>}
                <div>Best {best}</div>
              </div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg/50">
              <div className="h-full rounded-full bg-fg" style={{ width: `${progress * 100}%` }} />
            </div>
            {flash && performance.now() - flash.t < 900 && (
              <div className="mt-6 text-center font-display text-2xl font-semibold tracking-wide text-fg drop-shadow">
                {flash.name}
              </div>
            )}
          </div>
        )}

        {overlay && (
          <div className="absolute inset-0 flex flex-col bg-gradient-to-t from-bg via-bg/70 to-bg/30 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link to="/" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted no-underline hover:text-fg">
              <ChevronLeft className="size-4" />
              Games
            </Link>
            <div className="mt-auto w-full max-w-lg pb-4 sm:pb-8">
              {phase === "title" && (
                <>
                  <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">Dirt park</p>
                  <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">STICK BMX</h1>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                    Hold gas, pop the lip, rotate in the air, tap a trick. Stick the landing or it's an endo.
                  </p>
                  <p className="mt-4 text-sm text-muted">
                    <b className="text-fg">D</b> gas · <b className="text-fg">A</b> brake · <b className="text-fg">Space</b> jump · <b className="text-fg">W/S</b> flip · <b className="text-fg">T</b> trick
                  </p>
                  <p className="mt-2 text-xs text-subtle">Best {best}</p>
                  <ControlToggle
                    value={controls}
                    onChange={(m) => {
                      setControls(m);
                      saveCtrl(m);
                    }}
                  />
                  <Button className="mt-6" size="lg" onClick={resetRun}>
                    Drop in
                  </Button>
                </>
              )}
              {phase === "paused" && (
                <>
                  <h2 className="font-display text-4xl font-semibold">Paused</h2>
                  <ControlToggle
                    value={controls}
                    onChange={(m) => {
                      setControls(m);
                      saveCtrl(m);
                    }}
                  />
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button size="lg" onClick={() => setPhaseBoth("playing")}>
                      Resume
                    </Button>
                    <Button variant="secondary" size="lg" onClick={resetRun}>
                      Restart
                    </Button>
                  </div>
                </>
              )}
              {phase === "crashed" && (
                <>
                  <h2 className="font-display text-5xl font-semibold tracking-tight">CRASH</h2>
                  <p className="mt-3 text-sm text-muted">{crash}</p>
                  <p className="mt-4 font-display text-3xl font-semibold tabular-nums">{score}</p>
                  <p className="text-xs text-subtle">Best {best}</p>
                  <Button className="mt-6" size="lg" onClick={resetRun}>
                    Try again
                  </Button>
                </>
              )}
              {phase === "finished" && (
                <>
                  <h2 className="font-display text-5xl font-semibold tracking-tight">CLEAN</h2>
                  <p className="mt-3 text-sm text-muted">Park complete.</p>
                  <p className="mt-4 font-display text-3xl font-semibold tabular-nums">{score}</p>
                  <p className="text-xs text-subtle">Best {best}</p>
                  <Button className="mt-6" size="lg" onClick={resetRun}>
                    Ride again
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {phase === "playing" && (
        <>
          <button
            type="button"
            aria-label="Pause"
            onClick={() => setPhaseBoth("paused")}
            className="absolute top-[max(0.6rem,env(safe-area-inset-top))] right-14 z-10 grid size-11 place-items-center rounded-full border border-border bg-bg-elevated/90 lg:right-16"
          >
            <Pause className="size-4" />
          </button>
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8",
              (controls === "off" || (controls === "auto" && !narrow)) && "hidden",
            )}
          >
            <div className="pointer-events-auto flex gap-2">
              <Pad label="Brake" {...hold("brake")} />
              <Pad label="Gas" accent {...hold("gas")} />
            </div>
            <div className="pointer-events-auto grid grid-cols-2 gap-2">
              <Pad label="Flip" {...hold("flipUp")} />
              <Pad label="Dive" {...hold("flipDown")} />
              <Pad label="Jump" accent {...hold("jump", "jumpPressed")} />
              <Pad label="Trick" {...hold("trick", "trickPressed")} />
            </div>
          </div>
          <button
            type="button"
            aria-label="Restart"
            onClick={resetRun}
            className="absolute top-[max(0.6rem,env(safe-area-inset-top))] right-3 z-10 hidden size-11 place-items-center rounded-full border border-border bg-bg-elevated/90 sm:grid"
          >
            <RotateCcw className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

function ControlToggle({
  value,
  onChange,
}: {
  value: ControlMode;
  onChange: (m: ControlMode) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">On-screen controls</p>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-border bg-bg-elevated p-1">
        {(["auto", "always", "off"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              "rounded-full px-2 py-2 text-xs font-semibold capitalize",
              value === m ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pad({
  label,
  accent,
  ...rest
}: {
  label: string;
  accent?: boolean;
} & HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "h-14 min-w-16 rounded-2xl border px-3 text-xs font-semibold select-none",
        accent ? "border-accent/50 bg-accent text-accent-fg" : "border-border bg-bg-elevated/90 text-fg",
      )}
      {...rest}
    >
      {label}
    </button>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getSpeed: () => number;
      getX: () => number;
      getYaw: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}
