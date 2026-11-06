import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact, Event, Interaction } from "@/db/schema";
import { daysBetween, followUpStatus, nextDueDate, type FollowUpStatus } from "@/lib/crm";

const { contacts, events, interactions } = schema;

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

async function selectContacts(where: SQL | undefined) {
  const db = await getDb();
  const rows = await db
    .select({ c: contacts, eventName: events.name })
    .from(contacts)
    .leftJoin(events, eq(contacts.eventId, events.id))
    .where(where)
    .orderBy(asc(contacts.fullName));
  return rows.map((r) => ({ ...r.c, eventName: r.eventName }));
}

export async function listContacts(f: ContactFilters, today: string): Promise<ContactRow[]> {
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
  if (f.event) conds.push(eq(contacts.eventId, f.event));
  if (f.company) conds.push(sql`lower(${contacts.company}) = lower(${f.company})`);
  if (f.tag) conds.push(sql`${f.tag} = any(${contacts.tags})`);
  if (f.status === "starred") conds.push(eq(contacts.starred, true));
  if (f.status === "never") conds.push(sql`${contacts.lastContactedOn} is null`);

  let rows = (await selectContacts(conds.length ? and(...conds) : undefined)).map((c) => decorate(c, today));

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

export async function getDashboard(today: string) {
  const all = (await selectContacts(undefined)).map((c) => decorate(c, today));
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

export async function getContact(id: string, today: string) {
  if (!isUuid(id)) return null;
  const [c] = await selectContacts(eq(contacts.id, id));
  if (!c) return null;
  const db = await getDb();
  const log: Interaction[] = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.occurredOn), desc(interactions.createdAt));
  return { contact: decorate(c, today), interactions: log };
}

export type EventRow = Event & { contactCount: number };

export async function listEvents(): Promise<EventRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ e: events, n: sql<number>`count(${contacts.id})::int` })
    .from(events)
    .leftJoin(contacts, eq(contacts.eventId, events.id))
    .groupBy(events.id)
    .orderBy(sql`${events.date} desc nulls last`, desc(events.createdAt));
  return rows.map((r) => ({ ...r.e, contactCount: r.n }));
}

export async function getEvent(id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [e] = await db.select().from(events).where(eq(events.id, id));
  return e ?? null;
}

export async function getFilterOptions() {
  const db = await getDb();
  const [companies, tags] = await Promise.all([
    db
      .selectDistinct({ v: contacts.company })
      .from(contacts)
      .where(sql`coalesce(${contacts.company}, '') <> ''`)
      .orderBy(asc(contacts.company)),
    db.execute<{ v: string }>(sql`select distinct unnest(tags) as v from contacts order by 1`),
  ]);
  const tagRows = (Array.isArray(tags) ? tags : (tags as { rows: { v: string }[] }).rows) as { v: string }[];
  return {
    companies: companies.map((r) => r.v!).filter(Boolean),
    tags: tagRows.map((r) => r.v).filter(Boolean),
  };
}

export async function getAllContactsForExport() {
  return selectContacts(undefined);
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
