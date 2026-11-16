import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SESSION_COOKIE, TZ_COOKIE, verifySessionToken } from "@/lib/session";
import { todayIn } from "@/lib/crm";

/** The signed-in user's id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Defence in depth: proxy.ts already guards routes, but every page and action
 * re-checks and gets the user id it must scope its queries to.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

/** The signed-in user's account, once per request. Null if signed out or the account is gone. */
export const getCurrentUser = cache(async () => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = await getDb();
  const [u] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return u ?? null;
});

export async function getTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return tz ? decodeURIComponent(tz) : process.env.APP_TIMEZONE || "UTC";
}

export async function getToday(): Promise<string> {
  return todayIn(await getTimeZone());
}
