import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-5 py-10 text-fg">
      <img src="/art/ram.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/50" />
      <div className="relative w-full max-w-sm">
        <Link to="/" className="text-sm font-medium text-muted no-underline hover:text-fg">
          Back to games
        </Link>
        <p className="mt-8 font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">Woofa's Games</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Optional. Progress saves in this browser either way.
        </p>
        <div className="mt-6 space-y-2.5">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
