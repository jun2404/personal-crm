import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/crm/bits";
import { TimelineList, dayLabel, type TimelineEntry } from "@/components/crm/timeline";
import { buttonVariants } from "@/components/ui/button";
import { getTimeline, type TimelineFilter, type TimelineItem } from "@/lib/server/data";
import { getTimeZone, getToday, requireUserId } from "@/lib/server/auth";
import { formatTimeIn, kindLabel, sourceLabel } from "@/lib/crm";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Timeline" };

const PAGE = 100;
const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "saved", label: "Contacts saved" },
  { value: "interactions", label: "Interactions" },
];

type SP = { show?: string; limit?: string };

const href = (show: TimelineFilter, limit?: number) => {
  const q = new URLSearchParams();
  if (show !== "all") q.set("show", show);
  if (limit && limit > PAGE) q.set("limit", String(limit));
  const s = q.toString();
  return `/timeline${s ? `?${s}` : ""}`;
};

const personLink = (p: { id: string; name: string }) => (
  <Link href={`/contacts/${p.id}`} className="hover:underline">
    {p.name}
  </Link>
);

function toEntry(item: TimelineItem, timeZone: string): TimelineEntry {
  const time = formatTimeIn(item.at, timeZone);
  if (item.type === "interaction") {
    return {
      key: item.key,
      tone: "interaction",
      kind: item.kind,
      title: (
        <>
          {kindLabel(item.kind)} <span className="font-normal text-muted-foreground">with</span>{" "}
          {personLink(item.person)}
        </>
      ),
      meta: item.person.company,
      note: item.note,
    };
  }
  const [first, ...rest] = item.people;
  if (item.count === 1) {
    return {
      key: item.key,
      tone: "saved",
      title: (
        <>
          Saved {personLink(first)}
        </>
      ),
      meta: [time, first.company, first.event && `met at ${first.event}`, sourceLabel(item.source)]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const more = item.count - item.people.length;
  return {
    key: item.key,
    tone: "saved",
    title: `Saved ${item.count} contacts`,
    meta: (
      <>
        {time} ·{" "}
        {[first, ...rest].map((p, i) => (
          <span key={p.id}>
            {i > 0 && ", "}
            {personLink(p)}
          </span>
        ))}
        {more > 0 && ` and ${more} more`}
      </>
    ),
  };
}

export default async function TimelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const uid = await requireUserId();
  const sp = await searchParams;
  const show: TimelineFilter = FILTERS.some((f) => f.value === sp.show) ? (sp.show as TimelineFilter) : "all";
  const limit = Math.min(1000, Math.max(PAGE, Number(sp.limit) || PAGE));
  const [timeZone, today] = await Promise.all([getTimeZone(), getToday()]);
  const { items, hasMore } = await getTimeline(uid, timeZone, { limit, filter: show });

  // Group into days, keeping the newest-first order.
  const days: { date: string; entries: TimelineEntry[] }[] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    const entry = toEntry(item, timeZone);
    if (last?.date === item.date) last.entries.push(entry);
    else days.push({ date: item.date, entries: [entry] });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Timeline" description="Who you saved and every interaction you logged, newest first." />

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value)}
            aria-current={show === f.value ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              show === f.value && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {days.length === 0 ? (
        <EmptyState title={show === "interactions" ? "No interactions logged yet" : "Nothing here yet"}>
          <p>
            {show === "interactions"
              ? "Log a check-in from a contact's page, or tap WhatsApp / LinkedIn on the Follow-ups screen."
              : "Save someone you met and they'll show up here."}
          </p>
          <Link href="/contacts/new" className={cn(buttonVariants(), "mt-4")}>
            Add contact
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {days.map((d) => (
            <section key={d.date} aria-label={dayLabel(d.date, today)}>
              <h2 className="sticky top-14 z-20 -mx-1 mb-3 bg-background/95 px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                {dayLabel(d.date, today)}
              </h2>
              <TimelineList entries={d.entries} />
            </section>
          ))}
          {hasMore && (
            <div className="text-center">
              <Link href={href(show, limit + PAGE)} scroll={false} className={buttonVariants({ variant: "outline" })}>
                Show older
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
