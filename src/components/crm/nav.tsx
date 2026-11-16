"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Download, History, Home, LogOut, Plus, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/crm/bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavUser = { name: string | null; email: string };

const LINKS = [
  { href: "/", label: "Follow-ups", icon: Home },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/import", label: "Import", icon: Upload },
];
// The phone tab bar has room for four tabs around the Add button; Import lives in the account menu there.
const PHONE_TABS = LINKS.filter((l) => l.href !== "/import");

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/contacts") return pathname.startsWith("/contacts") && pathname !== "/contacts/new";
  return pathname.startsWith(href);
}

export function TopNav({ user }: { user: NavUser }) {
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
          <AccountMenu user={user} />
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
        {PHONE_TABS.slice(0, 2).map(tab)}
        <Link
          href="/contacts/new"
          aria-label="Add contact"
          className="-mt-5 mx-1 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <Plus className="size-7" />
        </Link>
        {PHONE_TABS.slice(2).map(tab)}
      </div>
    </nav>
  );
}

function AccountMenu({ user }: { user: NavUser }) {
  const display = user.name || user.email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="inline-flex h-8 items-center gap-2 rounded-full border py-0.5 pr-0.5 pl-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:pr-3"
      >
        <Avatar name={display} className="size-7 text-[11px]" />
        <span className="hidden max-w-36 truncate md:inline">{user.name || user.email.split("@")[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/import" />}>
          <Upload /> Import contacts
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href="/api/export" />}>
          <Download /> Export CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
