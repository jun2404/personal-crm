"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import type { NewContact } from "@/db/schema";
import {
  classifyTitle,
  isKind,
  isRole,
  isSource,
  normalizeLinkedIn,
  phoneDigits,
} from "@/lib/crm";
import { getToday, requireUserId } from "@/lib/server/auth";
import { isUuid, ownsContact } from "@/lib/server/data";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/server/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  TZ_COOKIE,
  createSessionToken,
  legacyPasswordMatches,
} from "@/lib/session";

const { contacts, events, interactions, users } = schema;

export type FormState = {
  error?: string;
  duplicate?: { id: string; name: string };
  ok?: boolean;
  savedName?: string;
} | null;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const raw = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slowDown = () => new Promise((r) => setTimeout(r, 800)); // makes guessing slow

// ---------------------------------------------------------------- auth

function configError(): string | null {
  return (process.env.SESSION_SECRET ?? "").length >= 16
    ? null
    : "The app isn't configured yet: set SESSION_SECRET (16+ characters).";
}

async function startSession(userId: string, fd: FormData) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  const tz = str(fd, "tz");
  if (tz && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) {
    jar.set(TZ_COOKIE, tz, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_S });
  }
}

function safeNext(fd: FormData): string {
  const next = str(fd, "next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const problem = configError();
  if (problem) return { error: problem };
  const email = (str(fd, "email") ?? "").toLowerCase();
  const password = raw(fd, "password");
  if (!email || !password) return { error: "Enter your email and password." };

  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !ok) {
    await slowDown();
    return { error: "That email and password don't match an account." };
  }
  await startSession(user.id, fd);
  redirect(safeNext(fd));
}

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const problem = configError();
  if (problem) return { error: problem };
  const name = str(fd, "name")?.slice(0, 100) ?? null;
  const email = (str(fd, "email") ?? "").toLowerCase();
  const password = raw(fd, "password");
  const legacy = raw(fd, "legacyPassword");

  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (password.length > 200) return { error: "That password is too long." };
  if (legacy && !(await legacyPasswordMatches(legacy))) {
    await slowDown();
    return { error: "That old app password isn't right. Leave it empty to start with an empty account." };
  }

  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email, name, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!u) return null;
    if (legacy) {
      // Move everything saved before accounts existed into this account.
      await tx.update(events).set({ userId: u.id }).where(isNull(events.userId));
      await tx.update(contacts).set({ userId: u.id }).where(isNull(contacts.userId));
    }
    return u.id;
  });
  if (!userId) return { error: "An account with that email already exists. Sign in instead." };

  await startSession(userId, fd);
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------- page refresh

// Pages that list contacts, and the route patterns for single contact / event pages.
const LISTS = ["/", "/contacts", "/events"];
const TIMELINE = "/timeline";
const CONTACT_PAGES = "/(app)/contacts/[id]";
const EVENT_PAGES = "/(app)/events/[id]";

/** Refresh only the pages that show the data a save changed, not the whole app. */
function refreshPages(paths: (string | null | undefined)[], patterns: string[] = []) {
  for (const p of new Set(paths.filter((x): x is string => !!x))) revalidatePath(p);
  for (const p of patterns) revalidatePath(p, "page");
}

// ---------------------------------------------------------------- contacts

async function resolveEventId(userId: string, fd: FormData): Promise<string | null> {
  const db = await getDb();
  const newName = str(fd, "newEventName");
  if (newName) {
    const [e] = await db
      .insert(events)
      .values({ userId, name: newName, date: isoDate(str(fd, "metOn")) })
      .returning({ id: events.id });
    return e.id;
  }
  const id = str(fd, "eventId");
  if (!id || !isUuid(id)) return null;
  // Only link to the user's own events.
  const [e] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)));
  return e?.id ?? null;
}

function contactFromForm(fd: FormData): Omit<NewContact, "eventId" | "userId"> | { error: string } {
  const fullName = str(fd, "fullName");
  if (!fullName) return { error: "Name is required." };
  const title = str(fd, "title");
  const roleInput = str(fd, "roleCategory") ?? "auto";
  const source = str(fd, "source") ?? "networking_event";
  const follow = Number(str(fd, "followUpDays") ?? 60);
  const tags = (str(fd, "tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const email = str(fd, "email");
  if (email && !EMAIL_RE.test(email)) return { error: "That email doesn't look right." };

  return {
    fullName,
    company: str(fd, "company"),
    title,
    roleCategory: roleInput !== "auto" && isRole(roleInput) ? roleInput : classifyTitle(title),
    phone: str(fd, "phone"),
    email,
    linkedinUrl: normalizeLinkedIn(str(fd, "linkedinUrl")),
    source: isSource(source) ? source : "other",
    metOn: isoDate(str(fd, "metOn")),
    city: str(fd, "city"),
    notes: str(fd, "notes"),
    tags: [...new Set(tags)],
    followUpDays: Number.isFinite(follow) && follow >= 0 && follow <= 3650 ? Math.round(follow) : 60,
    starred: fd.get("starred") === "on",
  };
}

async function findDuplicate(
  userId: string,
  c: { phone?: string | null; linkedinUrl?: string | null; email?: string | null },
  excludeId?: string,
) {
  const db = await getDb();
  const conds = [];
  const digits = phoneDigits(c.phone);
  if (digits.length >= 7)
    conds.push(sql`right(regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g'), 9) = ${digits.slice(-9)}`);
  if (c.linkedinUrl) conds.push(sql`lower(${contacts.linkedinUrl}) = lower(${c.linkedinUrl})`);
  if (c.email) conds.push(sql`lower(${contacts.email}) = lower(${c.email})`);
  if (!conds.length) return null;
  const where = sql`(${sql.join(conds, sql` or `)})`;
  const [dup] = await db
    .select({ id: contacts.id, name: contacts.fullName })
    .from(contacts)
    .where(and(eq(contacts.userId, userId), where, excludeId ? sql`${contacts.id} <> ${excludeId}` : undefined))
    .limit(1);
  return dup ?? null;
}

export async function createContact(_prev: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const data = contactFromForm(fd);
  if ("error" in data) return { error: data.error };

  if (fd.get("ignoreDuplicate") !== "1") {
    const dup = await findDuplicate(userId, data);
    if (dup) return { duplicate: dup, error: `Looks like ${dup.name} is already saved (same phone, email or LinkedIn).` };
  }

  const db = await getDb();
  const eventId = await resolveEventId(userId, fd);
  const [row] = await db
    .insert(contacts)
    .values({ ...data, userId, eventId })
    .returning({ id: contacts.id });

  refreshPages([...LISTS, TIMELINE, eventId && `/events/${eventId}`]);
  if (fd.get("intent") === "another") {
    return { ok: true, savedName: data.fullName };
  }
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  if (!(await ownsContact(userId, id))) return { error: "Unknown contact." };
  const data = contactFromForm(fd);
  if ("error" in data) return { error: data.error };

  if (fd.get("ignoreDuplicate") !== "1") {
    const dup = await findDuplicate(userId, data, id);
    if (dup) return { duplicate: dup, error: `${dup.name} already has the same phone, email or LinkedIn.` };
  }

  const db = await getDb();
  const eventId = await resolveEventId(userId, fd);
  await db
    .update(contacts)
    .set({ ...data, eventId, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  refreshPages([...LISTS, TIMELINE, `/contacts/${id}`], [EVENT_PAGES]);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const userId = await requireUserId();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  refreshPages([...LISTS, TIMELINE, `/contacts/${id}`], [EVENT_PAGES]);
  redirect("/contacts");
}

export async function toggleStar(id: string) {
  const userId = await requireUserId();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db
    .update(contacts)
    .set({ starred: sql`not ${contacts.starred}` })
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  refreshPages(["/", "/contacts", `/contacts/${id}`], [EVENT_PAGES]);
}

// ---------------------------------------------------------------- follow-ups

async function syncLastContacted(contactId: string) {
  const db = await getDb();
  await db
    .update(contacts)
    .set({
      lastContactedOn: sql`(select max(${interactions.occurredOn}) from ${interactions} where ${interactions.contactId} = ${contactId})`,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));
}

const afterCheckIn = (contactId: string) =>
  refreshPages(["/", "/contacts", TIMELINE, `/contacts/${contactId}`], [EVENT_PAGES]);

export async function logInteraction(contactId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  if (!(await ownsContact(userId, contactId))) return { error: "Unknown contact." };
  const kind = str(fd, "kind") ?? "other";
  const occurredOn = isoDate(str(fd, "occurredOn")) ?? (await getToday());
  const db = await getDb();
  await db.insert(interactions).values({
    contactId,
    kind: isKind(kind) ? kind : "other",
    occurredOn,
    note: str(fd, "note"),
  });
  await syncLastContacted(contactId);
  afterCheckIn(contactId);
  return { ok: true };
}

/** One-tap "I just reached out" from lists. */
export async function quickCheckIn(contactId: string, kind: string) {
  const userId = await requireUserId();
  if (!(await ownsContact(userId, contactId))) return;
  const db = await getDb();
  await db.insert(interactions).values({
    contactId,
    kind: isKind(kind) ? kind : "other",
    occurredOn: await getToday(),
  });
  await syncLastContacted(contactId);
  afterCheckIn(contactId);
}

export async function deleteInteraction(id: string, contactId: string) {
  const userId = await requireUserId();
  if (!isUuid(id) || !(await ownsContact(userId, contactId))) return;
  const db = await getDb();
  await db.delete(interactions).where(and(eq(interactions.id, id), eq(interactions.contactId, contactId)));
  await syncLastContacted(contactId);
  afterCheckIn(contactId);
}

// ---------------------------------------------------------------- events

export async function saveEvent(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const name = str(fd, "name");
  if (!name) return { error: "Event name is required." };
  const values = {
    name,
    date: isoDate(str(fd, "date")),
    location: str(fd, "location"),
    notes: str(fd, "notes"),
  };
  const db = await getDb();
  let eventId = id;
  if (id) {
    if (!isUuid(id)) return { error: "Unknown event." };
    const [e] = await db
      .update(events)
      .set(values)
      .where(and(eq(events.id, id), eq(events.userId, userId)))
      .returning({ id: events.id });
    if (!e) return { error: "Unknown event." };
  } else {
    const [e] = await db.insert(events).values({ ...values, userId }).returning({ id: events.id });
    eventId = e.id;
  }
  refreshPages([...LISTS, TIMELINE, `/events/${eventId}`], [CONTACT_PAGES]);
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(id: string) {
  const userId = await requireUserId();
  if (!isUuid(id)) return;
  const db = await getDb();
  // Contacts keep existing; their event link is cleared.
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  refreshPages([...LISTS, TIMELINE, `/events/${id}`], [CONTACT_PAGES]);
  redirect("/events");
}

// ---------------------------------------------------------------- import

export type ImportRow = {
  fullName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  metOn?: string;
  notes?: string;
};

export async function importContacts(
  rows: ImportRow[],
  opts: { source: string; eventId?: string | null; followUpDays: number; tag?: string },
): Promise<{ added: number; skipped: number }> {
  const userId = await requireUserId();
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error("Too many rows (max 5000 per import).");
  const db = await getDb();

  // The user's existing identities, to skip duplicates.
  const existing = await db
    .select({ phone: contacts.phone, linkedin: contacts.linkedinUrl, email: contacts.email, name: contacts.fullName, company: contacts.company })
    .from(contacts)
    .where(eq(contacts.userId, userId));
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.linkedin) seen.add(`li:${e.linkedin.toLowerCase()}`);
    if (e.email) seen.add(`em:${e.email.toLowerCase()}`);
    const d = phoneDigits(e.phone);
    if (d.length >= 7) seen.add(`ph:${d.slice(-9)}`);
    seen.add(`nc:${e.name.toLowerCase()}|${(e.company ?? "").toLowerCase()}`);
  }

  const source = isSource(opts.source) ? opts.source : "other";
  let eventId: string | null = null;
  if (opts.eventId && isUuid(opts.eventId)) {
    const [e] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, opts.eventId), eq(events.userId, userId)));
    eventId = e?.id ?? null;
  }
  const followUpDays = Number.isFinite(opts.followUpDays) ? Math.max(0, Math.min(3650, opts.followUpDays)) : 90;
  const tag = opts.tag?.trim().toLowerCase();

  const toInsert: NewContact[] = [];
  let skipped = 0;
  for (const r of rows) {
    const fullName = r.fullName?.toString().trim().slice(0, 200);
    if (!fullName) {
      skipped++;
      continue;
    }
    const linkedinUrl = normalizeLinkedIn(r.linkedinUrl);
    const email = r.email?.trim() || null;
    const phone = r.phone?.trim() || null;
    const keys = [
      linkedinUrl && `li:${linkedinUrl.toLowerCase()}`,
      email && `em:${email.toLowerCase()}`,
      phoneDigits(phone).length >= 7 && `ph:${phoneDigits(phone).slice(-9)}`,
      `nc:${fullName.toLowerCase()}|${(r.company ?? "").trim().toLowerCase()}`,
    ].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) {
      skipped++;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    const title = r.title?.trim() || null;
    toInsert.push({
      userId,
      fullName,
      company: r.company?.trim() || null,
      title,
      roleCategory: classifyTitle(title),
      email,
      phone,
      linkedinUrl,
      source,
      eventId,
      metOn: isoDate(r.metOn?.trim() ?? null),
      notes: r.notes?.trim() || null,
      tags: tag ? [tag] : [],
      followUpDays,
    });
  }

  for (let i = 0; i < toInsert.length; i += 200) {
    await db.insert(contacts).values(toInsert.slice(i, i + 200));
  }
  refreshPages([...LISTS, TIMELINE], [EVENT_PAGES]);
  return { added: toInsert.length, skipped };
}
