import { cookies } from "next/headers";
import { getContact } from "@/lib/server/data";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getToday } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// vCard 3.0 escaping: backslash, comma, semicolon, newline.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response("Not signed in", { status: 401 });
  }
  const { id } = await ctx.params;
  const data = await getContact(id, await getToday());
  if (!data) return new Response("Not found", { status: 404 });
  const c = data.contact;

  const parts = c.fullName.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const first = parts.join(" ");
  const met = ["Met", c.eventName && `at ${c.eventName}`, c.metOn && `on ${c.metOn}`].filter(Boolean);
  const note = [met.length > 1 ? `${met.join(" ")}.` : "", c.notes].filter(Boolean).join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(c.fullName)}`,
    c.company && `ORG:${esc(c.company)}`,
    c.title && `TITLE:${esc(c.title)}`,
    c.phone && `TEL;TYPE=CELL:${esc(c.phone)}`,
    c.email && `EMAIL;TYPE=INTERNET:${esc(c.email)}`,
    c.linkedinUrl && `URL:${esc(c.linkedinUrl)}`,
    note && `NOTE:${esc(note)}`,
    "END:VCARD",
  ].filter(Boolean);

  const file = c.fullName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "contact";
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
