import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, TZ_COOKIE, verifySessionToken } from "@/lib/session";
import { todayIn } from "@/lib/crm";

/** Defence in depth: proxy.ts already guards routes, but every action re-checks. */
export async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) redirect("/login");
}

export async function getTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return tz ? decodeURIComponent(tz) : process.env.APP_TIMEZONE || "UTC";
}

export async function getToday(): Promise<string> {
  return todayIn(await getTimeZone());
}
