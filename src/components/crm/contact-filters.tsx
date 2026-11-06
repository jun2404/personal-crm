"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { ROLE_CATEGORIES, SOURCES } from "@/lib/crm";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };

export function ContactFilters({
  events,
  companies,
  tags,
}: {
  events: Opt[];
  companies: string[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const filterKeys = ["source", "role", "event", "company", "tag", "status"] as const;
  const activeCount = filterKeys.filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(activeCount > 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam("q", v.trim()), 250);
  };

  const select = (key: string, label: string, options: Opt[]) => (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <NativeSelect
        value={params.get(key) ?? ""}
        onChange={(e) => setParam(key, e.target.value)}
        className="w-full"
        aria-label={label}
      >
        <NativeSelectOption value="">Any</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );

  return (
    <div className={cn("mb-4 space-y-3", pending && "opacity-80")}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search name, company, title, notes…"
            className="h-10 pl-9"
            aria-label="Search contacts"
          />
        </div>
        <Button
          type="button"
          variant={open ? "secondary" : "outline"}
          className="h-10 gap-1.5"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span>
          )}
        </Button>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 md:grid-cols-3 lg:grid-cols-6">
          {select("status", "Follow-up", [
            { value: "overdue", label: "Overdue" },
            { value: "due_soon", label: "Due in 2 weeks" },
            { value: "never", label: "Never contacted" },
            { value: "starred", label: "Starred" },
          ])}
          {select("role", "Role", ROLE_CATEGORIES.map((r) => ({ value: r.value, label: r.label })))}
          {select("source", "Met via", SOURCES.map((s) => ({ value: s.value, label: s.label })))}
          {select("event", "Event", events)}
          {select("company", "Company", companies.map((c) => ({ value: c, label: c })))}
          {select("tag", "Tag", tags.map((t) => ({ value: t, label: `#${t}` })))}
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="col-span-full justify-self-start"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                filterKeys.forEach((k) => next.delete(k));
                start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ViewControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className="flex items-center gap-2">
      <NativeSelect size="sm" value={params.get("group") ?? ""} onChange={(e) => set("group", e.target.value)} aria-label="Group by">
        <NativeSelectOption value="">No grouping</NativeSelectOption>
        <NativeSelectOption value="company">Group by company</NativeSelectOption>
        <NativeSelectOption value="role">Group by role</NativeSelectOption>
        <NativeSelectOption value="source">Group by how we met</NativeSelectOption>
        <NativeSelectOption value="event">Group by event</NativeSelectOption>
      </NativeSelect>
      <NativeSelect size="sm" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)} aria-label="Sort by">
        <NativeSelectOption value="">Sort: follow-up due</NativeSelectOption>
        <NativeSelectOption value="name">Sort: name</NativeSelectOption>
        <NativeSelectOption value="recent">Sort: recently added</NativeSelectOption>
        <NativeSelectOption value="last">Sort: last contacted</NativeSelectOption>
        <NativeSelectOption value="company">Sort: company</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
