import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ContactCard } from "@/components/crm/contact-card";
import { ContactFilters, ViewControls } from "@/components/crm/contact-filters";
import { EmptyState, PageHeader } from "@/components/crm/bits";
import { getFilterOptions, listContacts, listEvents, type ContactRow } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";
import { ROLE_CATEGORIES, roleLabel, sourceLabel } from "@/lib/crm";

export const metadata: Metadata = { title: "Contacts" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = await getToday();
  const filters = {
    q: one(sp.q),
    source: one(sp.source),
    role: one(sp.role),
    event: one(sp.event),
    company: one(sp.company),
    tag: one(sp.tag),
    status: one(sp.status),
    sort: one(sp.sort),
  };
  const group = one(sp.group);
  const [rows, events, opts] = await Promise.all([listContacts(filters, today), listEvents(), getFilterOptions()]);
  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "sort");

  return (
    <>
      <PageHeader
        title="Contacts"
        description={`${rows.length} ${rows.length === 1 ? "person" : "people"}${filtered ? " match" : ""}`}
        actions={
          <>
            <a href="/api/export" className={buttonVariants({ variant: "outline" })}>
              <Download /> Export CSV
            </a>
          </>
        }
      />
      <Suspense>
        <ContactFilters
          events={events.map((e) => ({ value: e.id, label: e.name }))}
          companies={opts.companies}
          tags={opts.tags}
        />
        <div className="mb-3 flex justify-end">
          <ViewControls />
        </div>
      </Suspense>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? "No one matches those filters" : "No contacts yet"}>
          {filtered ? (
            "Try a different search or clear the filters."
          ) : (
            <Link href="/contacts/new" className="text-primary underline">
              Add your first contact
            </Link>
          )}
        </EmptyState>
      ) : group ? (
        <Grouped rows={rows} group={group} />
      ) : (
        <ul className="grid gap-2">
          {rows.map((c) => (
            <ContactCard key={c.id} c={c} />
          ))}
        </ul>
      )}
    </>
  );
}

function groupKey(c: ContactRow, group: string): string {
  switch (group) {
    case "company":
      return c.company?.trim() || "No company";
    case "role":
      return roleLabel(c.roleCategory);
    case "source":
      return sourceLabel(c.source);
    case "event":
      return c.eventName ?? "Not linked to an event";
    default:
      return "";
  }
}

function Grouped({ rows, group }: { rows: ContactRow[]; group: string }) {
  const map = new Map<string, ContactRow[]>();
  for (const r of rows) {
    const k = groupKey(r, group);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  let keys = [...map.keys()];
  if (group === "role") {
    const order = ROLE_CATEGORIES.map((r) => r.label as string);
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else {
    keys = keys.sort((a, b) => {
      const empty = (s: string) => s.startsWith("No ") || s.startsWith("Not ");
      return Number(empty(a)) - Number(empty(b)) || (map.get(b)!.length - map.get(a)!.length) || a.localeCompare(b);
    });
  }
  return (
    <div className="space-y-6">
      {keys.map((k) => (
        <section key={k}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {k}
            <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{map.get(k)!.length}</span>
          </h2>
          <ul className="grid gap-2">
            {map.get(k)!.map((c) => (
              <ContactCard key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
