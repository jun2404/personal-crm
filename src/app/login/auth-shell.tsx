import Link from "next/link";
import { cn } from "@/lib/utils";

/** Shared frame for the sign-in and create-account pages. */
export function AuthShell({
  active,
  next,
  children,
}: {
  active: "login" | "signup";
  next?: string;
  children: React.ReactNode;
}) {
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex-1 rounded-md py-1.5 text-center text-sm text-muted-foreground transition-colors hover:text-foreground",
        on && "bg-background font-medium text-foreground shadow-sm",
      )}
    >
      {label}
    </Link>
  );
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
            PC
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Personal CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everyone you&apos;ve met, and when to reach out next.</p>
        </div>
        <nav className="mb-4 flex gap-1 rounded-lg bg-muted p-1" aria-label="Account">
          {tab(`/login${q}`, "Sign in", active === "login")}
          {tab(`/signup${q}`, "Create account", active === "signup")}
        </nav>
        {children}
      </div>
    </main>
  );
}
