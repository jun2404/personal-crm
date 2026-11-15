import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

type DbState = { promise?: Promise<DB> };
// Survive hot reloads in dev so we never open the local database twice.
const g = globalThis as unknown as { __crmDb?: DbState };
const state: DbState = (g.__crmDb ??= {});

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Hosted Postgres (Supabase). Use the transaction pooler URL (port 6543),
    // which doesn't support prepared statements.
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { prepare: false, max: 3 });
    const db = drizzle(client, { schema });
    // Simple protocol sends every statement in one message: one database trip.
    try {
      await ensureSchema(async (script) => {
        await client.unsafe(script).simple();
      });
    } catch (err) {
      // Never let the faster path take the app down: fall back to the old
      // statement-by-statement setup, and log why so it shows in Vercel's logs.
      console.error("One-trip schema setup failed; using the step-by-step setup instead.", err);
      await ensureSchemaStepByStep(db);
    }
    return db;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase connection string in Vercel → Settings → Environment Variables.",
    );
  }

  // Local development: embedded Postgres stored in ./.data (no install needed).
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as DB;
  await ensureSchema(async (script) => {
    await client.exec(script);
  });
  return db;
}

/**
 * Creates the tables if they're missing, in a single database trip.
 * Several statements sent together run as one transaction, and the advisory
 * lock stops two cold starts from racing on CREATE TABLE. Every statement in
 * SCHEMA_SQL is idempotent, so running it on every cold start is safe.
 */
async function ensureSchema(runScript: (script: string) => Promise<void>) {
  await runScript(`select pg_advisory_xact_lock(727274);\n${schema.SCHEMA_SQL}`);
}

/** The previous setup: one database trip per statement. Kept only as a fallback. */
async function ensureSchemaStepByStep(db: DB) {
  await db.transaction(async (tx) => {
    await tx.execute(`select pg_advisory_xact_lock(727274)`);
    for (const stmt of schema.SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await tx.execute(stmt);
    }
  });
}

export function getDb(): Promise<DB> {
  if (!state.promise) {
    state.promise = connect().catch((err) => {
      state.promise = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return state.promise;
}

export { schema };
