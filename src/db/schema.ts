import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  date: date("date"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    company: text("company"),
    title: text("title"),
    roleCategory: text("role_category").notNull().default("unknown"),
    phone: text("phone"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    source: text("source").notNull().default("networking_event"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    metOn: date("met_on"),
    city: text("city"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    /** Days between check-ins. 0 = no reminders. */
    followUpDays: integer("follow_up_days").notNull().default(60),
    lastContactedOn: date("last_contacted_on"),
    starred: boolean("starred").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("contacts_event_idx").on(t.eventId)],
);

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    kind: text("kind").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("interactions_contact_idx").on(t.contactId)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Event = typeof events.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;

/**
 * Idempotent DDL, run once per server process before the first query.
 * Keep in sync with the Drizzle tables above.
 * RLS is enabled with no policies so Supabase's public REST API can't read
 * these tables; the app connects as the table owner, which bypasses RLS.
 */
export const SCHEMA_SQL = `
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  title text,
  role_category text not null default 'unknown',
  phone text,
  email text,
  linkedin_url text,
  source text not null default 'networking_event',
  event_id uuid references events(id) on delete set null,
  met_on date,
  city text,
  notes text,
  tags text[] not null default '{}'::text[],
  follow_up_days integer not null default 60,
  last_contacted_on date,
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_event_idx on contacts(event_id);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  occurred_on date not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists interactions_contact_idx on interactions(contact_id);

alter table events enable row level security;
alter table contacts enable row level security;
alter table interactions enable row level security;
`;
