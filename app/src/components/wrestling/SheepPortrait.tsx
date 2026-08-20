import { useEffect, useRef } from "react";
import { paintPortrait } from "@/game/wrestling/draw";
import type { Sheep } from "@/game/wrestling/types";
import { cn } from "@/lib/utils";

export function SheepPortrait({ sheep, className }: { sheep: Sheep; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = () => paintPortrait(el, sheep);
    paint();
    const id = requestAnimationFrame(paint);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
  }, [sheep]);
  return (
    <canvas
      ref={ref}
      width={128}
      height={128}
      className={cn("block size-full bg-[#1a1814]", className)}
      aria-hidden
    />
  );
}
