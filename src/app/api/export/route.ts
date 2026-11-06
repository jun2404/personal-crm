import { cookies } from "next/headers";
import { getAllContactsForExport } from "@/lib/server/data";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { roleLabel, sourceLabel } from "@/lib/crm";

export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Stop spreadsheet apps from treating a value as a formula (phone numbers like "+971 50…" are safe).
  const phoneLike = /^\+?[\d\s().-]+$/.test(s);
  if (!phoneLike && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response("Not signed in", { status: 401 });
  }
  const rows = await getAllContactsForExport();
  const header = [
    "Name", "Company", "Title", "Role type", "Phone", "Email", "LinkedIn", "Met via", "Event",
    "Date met", "City", "Tags", "Follow-up every (days)", "Last contacted", "Starred", "Notes", "Added",
  ];
  const lines = rows.map((c) =>
    [
      c.fullName, c.company, c.title, roleLabel(c.roleCategory), c.phone, c.email, c.linkedinUrl,
      sourceLabel(c.source), c.eventName, c.metOn, c.city, c.tags.join(", "), c.followUpDays,
      c.lastContactedOn, c.starred ? "yes" : "", c.notes, new Date(c.createdAt).toISOString().slice(0, 10),
    ]
      .map(cell)
      .join(","),
  );
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="personal-crm-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
