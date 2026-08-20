import { useEffect, useRef } from "react";
import { paintPortrait } from "@/game/wrestling/draw";
import type { Sheep } from "@/game/wrestling/types";
import { cn } from "@/lib/utils";

export function SheepPortrait({ sheep, className }: { sheep: Sheep; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintPortrait(ref.current, sheep);
  }, [sheep]);
  return <canvas ref={ref} className={cn("block size-14", className)} aria-hidden />;
}
