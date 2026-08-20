import { Link } from "@tanstack/react-router";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export function AuthChip() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-bg-subtle" aria-hidden />;
  }
  if (!user) {
    return (
      <Button asChild variant="secondary" size="sm" className="rounded-full">
        <Link to="/login" className="no-underline">
          Sign in
        </Link>
      </Button>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-bg/80 px-2 py-1 backdrop-blur-sm">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-7 rounded-full object-cover" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-bg-subtle text-xs font-semibold">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{label}</span>
      {authEnabled && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="pr-1 text-xs font-medium text-muted hover:text-fg"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
