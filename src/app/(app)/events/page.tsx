import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/crm/bits";
import { listEvents } from "@/lib/server/data";
import { formatDate } from "@/lib/crm";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const events = await listEvents();
  return (
    <>
      <PageHeader
        title="Events"
        description="Networking events and meetups, and who you met at each."
        actions={
          <Link href="/events/new" className={buttonVariants()}>
            <Plus /> New event
          </Link>
        }
      />
      {events.length === 0 ? (
        <EmptyState title="No events yet">
          Create one before you head out, then add people straight into it from your phone.
        </EmptyState>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CalendarDays className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
                    {e.date ? formatDate(e.date) : "No date"}
                    {e.location && (
                      <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                        <MapPin className="size-3.5 shrink-0" />
                        {e.location}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums">{e.contactCount}</span>
                  <span className="text-xs text-muted-foreground">{e.contactCount === 1 ? "person" : "people"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
