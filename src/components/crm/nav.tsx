"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LogOut, Plus, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions";

const LINKS = [
  { href: "/", label: "Follow-ups", icon: Home },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/import", label: "Import", icon: Upload },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/contacts") return pathname.startsWith("/contacts") && pathname !== "/contacts/new";
  return pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            PC
          </span>
          <span>Personal CRM</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(pathname, href) && "bg-muted font-medium text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/contacts/new"
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85 md:inline-flex"
          >
            <Plus className="size-4" /> Add contact
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/** Thumb-reachable tab bar for phones, with a big Add button in the middle. */
export function BottomNav() {
  const pathname = usePathname();
  const tab = (l: (typeof LINKS)[number]) => {
    const Icon = l.icon;
    const active = isActive(pathname, l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground",
          active && "font-medium text-primary",
        )}
      >
        <Icon className="size-5" />
        {l.label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-end">
        {LINKS.slice(0, 2).map(tab)}
        <Link
          href="/contacts/new"
          aria-label="Add contact"
          className="-mt-5 mx-1 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <Plus className="size-7" />
        </Link>
        {LINKS.slice(2).map(tab)}
      </div>
    </nav>
  );
}
