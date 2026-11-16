import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact, Event, Interaction } from "@/db/schema";
import { daysBetween, followUpStatus, isoDateIn, nextDueDate, type FollowUpStatus } from "@/lib/crm";

const { contacts, events, interactions } = schema;

// Every function here takes the signed-in user's id and only ever reads that user's rows.

export type ContactRow = Contact & {
  eventName: string | null;
  dueOn: string | null;
  status: FollowUpStatus;
  /** Negative = overdue by N days. */
  daysUntilDue: number | null;
};

export type ContactFilters = {
  q?: string;
  source?: string;
  role?: string;
  event?: string;
  company?: string;
  tag?: string;
  status?: string; // overdue | due_soon | never | starred
  sort?: string; // due | name | recent | company | last
};

function decorate(c: Contact & { eventName: string | null }, today: string): ContactRow {
  const dueOn = nextDueDate(c);
  return {
    ...c,
    dueOn,
    status: followUpStatus(dueOn, today),
    daysUntilDue: dueOn ? daysBetween(today, dueOn) : null,
  };
}

async function selectContacts(userId: string, where?: SQL) {
  const db = await getDb();
  const rows = await db
    .select({ c: contacts, eventName: events.name })
    .from(contacts)
    .leftJoin(events, eq(contacts.eventId, events.id))
    .where(and(eq(contacts.userId, userId), where))
    .orderBy(asc(contacts.fullName));
  return rows.map((r) => ({ ...r.c, eventName: r.eventName }));
}

export async function listContacts(userId: string, f: ContactFilters, today: string): Promise<ContactRow[]> {
  const conds: SQL[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(contacts.fullName, like),
        ilike(contacts.company, like),
        ilike(contacts.title, like),
        ilike(contacts.email, like),
        ilike(contacts.phone, like),
        ilike(contacts.notes, like),
        ilike(contacts.city, like),
        sql`array_to_string(${contacts.tags}, ' ') ilike ${like}`,
      )!,
    );
  }
  if (f.source) conds.push(eq(contacts.source, f.source));
  if (f.role) conds.push(eq(contacts.roleCategory, f.role));
  if (f.event && isUuid(f.event)) conds.push(eq(contacts.eventId, f.event));
  if (f.company) conds.push(sql`lower(${contacts.company}) = lower(${f.company})`);
  if (f.tag) conds.push(sql`${f.tag} = any(${contacts.tags})`);
  if (f.status === "starred") conds.push(eq(contacts.starred, true));
  if (f.status === "never") conds.push(sql`${contacts.lastContactedOn} is null`);

  let rows = (await selectContacts(userId, conds.length ? and(...conds) : undefined)).map((c) => decorate(c, today));

  if (f.status === "overdue") rows = rows.filter((r) => r.status === "overdue");
  if (f.status === "due_soon") rows = rows.filter((r) => r.status === "due_soon");

  const byName = (a: ContactRow, b: ContactRow) => a.fullName.localeCompare(b.fullName);
  switch (f.sort) {
    case "name":
      rows.sort(byName);
      break;
    case "recent":
      rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
    case "company":
      rows.sort((a, b) => (a.company ?? "~").localeCompare(b.company ?? "~") || byName(a, b));
      break;
    case "last":
      rows.sort((a, b) => (b.lastContactedOn ?? "").localeCompare(a.lastContactedOn ?? ""));
      break;
    default: // "due": most overdue first, reminders-off last
      rows.sort((a, b) => (a.daysUntilDue ?? 1e9) - (b.daysUntilDue ?? 1e9) || byName(a, b));
  }
  return rows;
}

export async function getDashboard(userId: string, today: string) {
  const all = (await selectContacts(userId)).map((c) => decorate(c, today));
  const byDue = (a: ContactRow, b: ContactRow) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0);
  const monthStart = today.slice(0, 8) + "01";
  return {
    total: all.length,
    overdue: all.filter((c) => c.status === "overdue").sort(byDue),
    dueSoon: all.filter((c) => c.status === "due_soon").sort(byDue),
    recent: [...all].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6),
    addedThisMonth: all.filter((c) => new Date(c.createdAt).toISOString().slice(0, 10) >= monthStart).length,
    decisionMakers: all.filter((c) => ["founder", "c_suite", "investor"].includes(c.roleCategory)).length,
    neverContacted: all.filter((c) => !c.lastContactedOn).length,
  };
}

export async function getContact(userId: string, id: string, today: string) {
  if (!isUuid(id)) return null;
  const [c] = await selectContacts(userId, eq(contacts.id, id));
  if (!c) return null;
  const db = await getDb();
  const log: Interaction[] = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.occurredOn), desc(interactions.createdAt));
  return { contact: decorate(c, today), interactions: log };
}

/** True if this contact exists and belongs to the user. */
export async function ownsContact(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const db = await getDb();
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  return !!row;
}

export type EventRow = Event & { contactCount: number };

export async function listEvents(userId: string): Promise<EventRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ e: events, n: sql<number>`count(${contacts.id})::int` })
    .from(events)
    .leftJoin(contacts, eq(contacts.eventId, events.id))
    .where(eq(events.userId, userId))
    .groupBy(events.id)
    .orderBy(sql`${events.date} desc nulls last`, desc(events.createdAt));
  return rows.map((r) => ({ ...r.e, contactCount: r.n }));
}

export async function getEvent(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [e] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)));
  return e ?? null;
}

export async function getFilterOptions(userId: string) {
  const db = await getDb();
  const [companies, tags] = await Promise.all([
    db
      .selectDistinct({ v: contacts.company })
      .from(contacts)
      .where(and(eq(contacts.userId, userId), sql`coalesce(${contacts.company}, '') <> ''`))
      .orderBy(asc(contacts.company)),
    db.execute<{ v: string }>(
      sql`select distinct unnest(tags) as v from contacts where user_id = ${userId} order by 1`,
    ),
  ]);
  const tagRows = (Array.isArray(tags) ? tags : (tags as { rows: { v: string }[] }).rows) as { v: string }[];
  return {
    companies: companies.map((r) => r.v!).filter(Boolean),
    tags: tagRows.map((r) => r.v).filter(Boolean),
  };
}

export async function getAllContactsForExport(userId: string) {
  return selectContacts(userId);
}

// ---------------------------------------------------------------- timeline

type Person = { id: string; name: string; company: string | null; event: string | null };

export type TimelineItem =
  | {
      type: "saved";
      key: string;
      /** Calendar day in the user's timezone. */
      date: string;
      /** Exact moment (ISO), for ordering within a day and showing the time. */
      at: string;
      /** How many contacts were saved in this minute (imports save many at once). */
      count: number;
      /** Up to 5 of them, newest first. */
      people: Person[];
      source: string;
    }
  | {
      type: "interaction";
      key: string;
      date: string;
      at: string;
      id: string;
      kind: string;
      note: string | null;
      person: Person;
    };

export type TimelineFilter = "all" | "saved" | "interactions";

const parseJson = <T,>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;

/**
 * Everything that happened across all of the user's contacts, newest first:
 * when each contact was saved, and every check-in logged with them.
 */
export async function getTimeline(
  userId: string,
  timeZone: string,
  opts: { limit: number; filter: TimelineFilter },
): Promise<{ items: TimelineItem[]; hasMore: boolean }> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(1000, opts.limit));
  const iso = (col: SQL | AnyColumn) =>
    sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

  const [saved, logged] = await Promise.all([
    opts.filter === "interactions"
      ? []
      : db
          .select({
            at: iso(sql`max(${contacts.createdAt})`),
            count: sql<number>`count(*)::int`,
            source: sql<string>`mode() within group (order by ${contacts.source})`,
            people: sql<unknown>`json_agg(json_build_object('id', ${contacts.id}, 'name', ${contacts.fullName}, 'company', ${contacts.company}, 'event', ${events.name}) order by ${contacts.createdAt} desc)`,
          })
          .from(contacts)
          .leftJoin(events, eq(contacts.eventId, events.id))
          .where(eq(contacts.userId, userId))
          .groupBy(sql`date_trunc('minute', ${contacts.createdAt})`)
          .orderBy(desc(sql`date_trunc('minute', ${contacts.createdAt})`))
          .limit(limit + 1),
    opts.filter === "saved"
      ? []
      : db
          .select({
            id: interactions.id,
            kind: interactions.kind,
            note: interactions.note,
            date: interactions.occurredOn,
            at: iso(interactions.createdAt),
            personId: contacts.id,
            name: contacts.fullName,
            company: contacts.company,
          })
          .from(interactions)
          .innerJoin(contacts, eq(interactions.contactId, contacts.id))
          .where(eq(contacts.userId, userId))
          .orderBy(desc(interactions.occurredOn), desc(interactions.createdAt))
          .limit(limit + 1),
  ]);

  const items: TimelineItem[] = [
    ...saved.map((s): TimelineItem => {
      const people = parseJson<Person[]>(s.people);
      return {
        type: "saved",
        key: `s:${s.at}:${people[0]?.id}`,
        date: isoDateIn(s.at, timeZone),
        at: s.at,
        count: s.count,
        people: people.slice(0, 5),
        source: s.source,
      };
    }),
    ...logged.map(
      (i): TimelineItem => ({
        type: "interaction",
        key: `i:${i.id}`,
        date: i.date,
        at: i.at,
        id: i.id,
        kind: i.kind,
        note: i.note,
        person: { id: i.personId, name: i.name, company: i.company, event: null },
      }),
    ),
  ];
  sortTimeline(items);
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

/** Newest day first; within a day, the most recently recorded first. */
export function sortTimeline<T extends { date: string; at: string }>(items: T[]): T[] {
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * True while contacts saved before accounts existed are still waiting for an owner,
 * and the old APP_PASSWORD is set so the original owner can claim them at sign-up.
 */
export async function hasUnclaimedData(): Promise<boolean> {
  if (!process.env.APP_PASSWORD) return false;
  const db = await getDb();
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(contacts)
    .where(sql`${contacts.userId} is null`)
    .limit(1);
  if (row) return true;
  const [ev] = await db
    .select({ one: sql<number>`1` })
    .from(events)
    .where(sql`${events.userId} is null`)
    .limit(1);
  return !!ev;
}
