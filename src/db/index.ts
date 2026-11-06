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
    await ensureSchema(db);
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
  await ensureSchema(db);
  return db;
}

async function ensureSchema(db: DB) {
  await db.transaction(async (tx) => {
    // Serialise concurrent cold starts so two instances don't race on CREATE TABLE.
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
