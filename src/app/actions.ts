"use server";

import { and, eq, sql } from "drizzle-orm";
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
import { getToday, requireSession } from "@/lib/server/auth";
import { isUuid } from "@/lib/server/data";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  TZ_COOKIE,
  createSessionToken,
  passwordMatches,
} from "@/lib/session";

const { contacts, events, interactions } = schema;

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
const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// ---------------------------------------------------------------- auth

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) {
    return { error: "The app isn't configured yet: set APP_PASSWORD and SESSION_SECRET." };
  }
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!(await passwordMatches(password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Wrong password." };
  }
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, await createSessionToken(), {
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
  const next = str(fd, "next");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------- contacts

async function resolveEventId(fd: FormData): Promise<string | null> {
  const newName = str(fd, "newEventName");
  if (newName) {
    const db = await getDb();
    const [e] = await db
      .insert(events)
      .values({ name: newName, date: isoDate(str(fd, "metOn")) })
      .returning({ id: events.id });
    return e.id;
  }
  const id = str(fd, "eventId");
  return id && isUuid(id) ? id : null;
}

function contactFromForm(fd: FormData): Omit<NewContact, "eventId"> | { error: string } {
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
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };

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

async function findDuplicate(c: { phone?: string | null; linkedinUrl?: string | null; email?: string | null }, excludeId?: string) {
  const db = await getDb();
  const conds = [];
  const digits = phoneDigits(c.phone);
  if (digits.length >= 7)
    conds.push(sql`right(regexp_replace(coalesce(${contacts.phone}, ''), '\\D', '', 'g'), 9) = ${digits.slice(-9)}`);
  if (c.linkedinUrl) conds.push(sql`lower(${contacts.linkedinUrl}) = lower(${c.linkedinUrl})`);
  if (c.email) conds.push(sql`lower(${contacts.email}) = lower(${c.email})`);
  if (!conds.length) return null;
  const where = sql.join(conds, sql` or `);
  const [dup] = await db
    .select({ id: contacts.id, name: contacts.fullName })
    .from(contacts)
    .where(excludeId ? and(sql`(${where})`, sql`${contacts.id} <> ${excludeId}`) : where)
    .limit(1);
  return dup ?? null;
}

export async function createContact(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const data = contactFromForm(fd);
  if ("error" in data) return { error: data.error };

  if (fd.get("ignoreDuplicate") !== "1") {
    const dup = await findDuplicate(data);
    if (dup) return { duplicate: dup, error: `Looks like ${dup.name} is already saved (same phone, email or LinkedIn).` };
  }

  const db = await getDb();
  const eventId = await resolveEventId(fd);
  const [row] = await db
    .insert(contacts)
    .values({ ...data, eventId })
    .returning({ id: contacts.id });

  revalidatePath("/", "layout");
  if (fd.get("intent") === "another") {
    return { ok: true, savedName: data.fullName };
  }
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  if (!isUuid(id)) return { error: "Unknown contact." };
  const data = contactFromForm(fd);
  if ("error" in data) return { error: data.error };

  if (fd.get("ignoreDuplicate") !== "1") {
    const dup = await findDuplicate(data, id);
    if (dup) return { duplicate: dup, error: `${dup.name} already has the same phone, email or LinkedIn.` };
  }

  const db = await getDb();
  const eventId = await resolveEventId(fd);
  await db
    .update(contacts)
    .set({ ...data, eventId, updatedAt: new Date() })
    .where(eq(contacts.id, id));
  revalidatePath("/", "layout");
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  await requireSession();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.delete(contacts).where(eq(contacts.id, id));
  revalidatePath("/", "layout");
  redirect("/contacts");
}

export async function toggleStar(id: string) {
  await requireSession();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.update(contacts).set({ starred: sql`not ${contacts.starred}` }).where(eq(contacts.id, id));
  revalidatePath("/", "layout");
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

export async function logInteraction(contactId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  if (!isUuid(contactId)) return { error: "Unknown contact." };
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
  revalidatePath("/", "layout");
  return { ok: true };
}

/** One-tap "I just reached out" from lists. */
export async function quickCheckIn(contactId: string, kind: string) {
  await requireSession();
  if (!isUuid(contactId)) return;
  const db = await getDb();
  await db.insert(interactions).values({
    contactId,
    kind: isKind(kind) ? kind : "other",
    occurredOn: await getToday(),
  });
  await syncLastContacted(contactId);
  revalidatePath("/", "layout");
}

export async function deleteInteraction(id: string, contactId: string) {
  await requireSession();
  if (!isUuid(id) || !isUuid(contactId)) return;
  const db = await getDb();
  await db.delete(interactions).where(and(eq(interactions.id, id), eq(interactions.contactId, contactId)));
  await syncLastContacted(contactId);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- events

export async function saveEvent(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
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
  if (id && isUuid(id)) {
    await db.update(events).set(values).where(eq(events.id, id));
  } else {
    const [e] = await db.insert(events).values(values).returning({ id: events.id });
    eventId = e.id;
  }
  revalidatePath("/", "layout");
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(id: string) {
  await requireSession();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.delete(events).where(eq(events.id, id)); // contacts keep existing, event link is cleared
  revalidatePath("/", "layout");
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
  await requireSession();
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error("Too many rows (max 5000 per import).");
  const db = await getDb();

  // Existing identities, to skip duplicates.
  const existing = await db
    .select({ phone: contacts.phone, linkedin: contacts.linkedinUrl, email: contacts.email, name: contacts.fullName, company: contacts.company })
    .from(contacts);
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.linkedin) seen.add(`li:${e.linkedin.toLowerCase()}`);
    if (e.email) seen.add(`em:${e.email.toLowerCase()}`);
    const d = phoneDigits(e.phone);
    if (d.length >= 7) seen.add(`ph:${d.slice(-9)}`);
    seen.add(`nc:${e.name.toLowerCase()}|${(e.company ?? "").toLowerCase()}`);
  }

  const source = isSource(opts.source) ? opts.source : "other";
  const eventId = opts.eventId && isUuid(opts.eventId) ? opts.eventId : null;
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
  revalidatePath("/", "layout");
  return { added: toInsert.length, skipped };
}
