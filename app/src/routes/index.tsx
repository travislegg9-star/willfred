import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AuthChip } from "@/components/auth-chip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Hub });

function Hub() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="relative z-20 flex shrink-0 items-start justify-between gap-4 bg-bg px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 lg:absolute lg:inset-x-0 lg:top-0 lg:bg-transparent lg:pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">Woofa</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">GAMES</h1>
        </div>
        <AuthChip />
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-1">
        <GamePanel
          to="/wrestling"
          image="/art/ring.jpg"
          position="object-[center_70%]"
          kicker="Career"
          title="Sheep Wrestling"
          blurb="Raise rams. Fill the meter. Rare finishers pin the champ."
        />
        <GamePanel
          to="/bmx"
          image="/art/jump.jpg"
          position="object-center"
          kicker="Session"
          title="Stick BMX"
          blurb="Gas, pop, flip. Stick the landing or eat dirt."
        />
      </div>
    </main>
  );
}

function GamePanel({
  to,
  image,
  position,
  kicker,
  title,
  blurb,
}: {
  to: "/wrestling" | "/bmx";
  image: string;
  position: string;
  kicker: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link to={to} className="group relative min-h-0 overflow-hidden no-underline">
      <img
        src={image}
        alt=""
        className={cn("absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]", position)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent uppercase">{kicker}</p>
        <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted sm:text-base">{blurb}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fg">
          Play
          <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
