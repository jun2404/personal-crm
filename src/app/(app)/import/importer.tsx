"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { importContacts, type ImportRow } from "@/app/actions";
import { FOLLOW_UP_OPTIONS, SOURCES } from "@/lib/crm";

type Field = keyof ImportRow;

// Column names we recognise (lower-cased, punctuation stripped).
const ALIASES: Record<Field, string[]> = {
  fullName: ["name", "full name", "fullname", "contact name", "display name"],
  company: ["company", "organization", "organisation", "company name", "employer"],
  title: ["position", "title", "job title", "role", "designation"],
  email: ["email", "email address", "e mail", "emailaddress"],
  phone: ["phone", "phone number", "mobile", "mobile number", "whatsapp", "cell", "telephone"],
  linkedinUrl: ["url", "linkedin", "linkedin url", "profile url", "linkedin profile"],
  metOn: ["connected on", "date", "met on", "date met", "created"],
  notes: ["notes", "note", "comments"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function toIsoDate(v: string | undefined): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // LinkedIn uses "05 Nov 2026". Only accept dates with a written month (no 1/2 vs 2/1 ambiguity).
  if (/[a-z]{3}/i.test(s)) {
    const t = Date.parse(`${s} 12:00 UTC`);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  }
  return undefined;
}

type Parsed = { rows: ImportRow[]; mapping: Partial<Record<Field, string>>; isLinkedIn: boolean; fileName: string };

function parseCsv(text: string, fileName: string): Parsed | { error: string } {
  // LinkedIn's export starts with a "Notes:" preamble; jump to the real header line.
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /(^|,)"?(first name|name|full name)"?(,|$)/i.test(l));
  const body = (headerIdx > 0 ? lines.slice(headerIdx) : lines).join("\n");
  const res = Papa.parse<Record<string, string>>(body, { header: true, skipEmptyLines: "greedy" });
  const headers = res.meta.fields ?? [];
  if (!headers.length) return { error: "Couldn't find a header row in that file." };

  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const mapping: Partial<Record<Field, string>> = {};
  (Object.keys(ALIASES) as Field[]).forEach((f) => {
    const hit = ALIASES[f].map((a) => byNorm.get(a)).find(Boolean);
    if (hit) mapping[f] = hit;
  });
  const first = byNorm.get("first name");
  const last = byNorm.get("last name");
  if (!mapping.fullName && !first) {
    return { error: "No name column found. The file needs a 'Name' or 'First Name' / 'Last Name' column." };
  }

  const rows: ImportRow[] = res.data.map((r) => {
    const get = (f: Field) => (mapping[f] ? r[mapping[f]!]?.trim() : undefined) || undefined;
    const fullName =
      get("fullName") ?? [first && r[first]?.trim(), last && r[last]?.trim()].filter(Boolean).join(" ");
    return {
      fullName: fullName ?? "",
      company: get("company"),
      title: get("title"),
      email: get("email"),
      phone: get("phone"),
      linkedinUrl: get("linkedinUrl"),
      metOn: toIsoDate(get("metOn")),
      notes: get("notes"),
    };
  });
  const usable = rows.filter((r) => r.fullName.trim());
  const isLinkedIn = Boolean(first && byNorm.get("connected on"));
  if (first && !mapping.fullName) mapping.fullName = last ? `${first} + ${last}` : first;
  return { rows: usable, mapping, isLinkedIn, fileName };
}

const FIELD_LABELS: Record<Field, string> = {
  fullName: "Name",
  company: "Company",
  title: "Title",
  email: "Email",
  phone: "Phone",
  linkedinUrl: "LinkedIn URL",
  metOn: "Date met",
  notes: "Notes",
};

export function Importer({ events }: { events: { id: string; name: string }[] }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("linkedin");
  const [eventId, setEventId] = useState("");
  const [followUp, setFollowUp] = useState("90");
  const [tag, setTag] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number; tag: string } | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setError(null);
    setParsed(null);
    if (!file) return;
    if (file.size > 5_000_000) return setError("That file is over 5 MB. Is it the right one?");
    const out = parseCsv(await file.text(), file.name);
    if ("error" in out) return setError(out.error);
    if (!out.rows.length) return setError("No contacts with a name were found in that file.");
    setParsed(out);
    setSource(out.isLinkedIn ? "linkedin" : "other");
    if (out.isLinkedIn && !tag) setTag("linkedin-import");
  };

  const run = () =>
    start(async () => {
      if (!parsed) return;
      let added = 0;
      let skipped = 0;
      try {
        for (let i = 0; i < parsed.rows.length; i += 500) {
          const r = await importContacts(parsed.rows.slice(i, i + 500), {
            source,
            eventId: eventId || null,
            followUpDays: Number(followUp),
            tag,
          });
          added += r.added;
          skipped += r.skipped;
        }
        setResult({ added, skipped, tag: tag.trim().toLowerCase() });
        setParsed(null);
        toast.success(`Imported ${added} contact${added === 1 ? "" : "s"}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed.");
      }
    });

  if (result) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-lg font-semibold">
          Added {result.added} contact{result.added === 1 ? "" : "s"}
        </p>
        {result.skipped > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Skipped {result.skipped} that were already in your CRM or had no name.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={result.tag ? `/contacts?tag=${encodeURIComponent(result.tag)}&sort=recent` : "/contacts?sort=recent"}
            className={buttonVariants()}
          >
            See imported contacts
          </Link>
          <Button variant="outline" onClick={() => setResult(null)}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-muted/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <FileUp className="size-8 text-muted-foreground" />
        <span className="font-medium">{parsed ? parsed.fileName : "Choose a CSV file"}</span>
        <span className="text-sm text-muted-foreground">LinkedIn Connections.csv, or any CSV with a Name column</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {parsed && (
        <>
          <div className="rounded-xl border bg-card p-4">
            <p className="font-medium">
              Found {parsed.rows.length} contact{parsed.rows.length === 1 ? "" : "s"}
              {parsed.isLinkedIn && <span className="font-normal text-muted-foreground"> (LinkedIn export detected)</span>}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Columns matched:</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => (
                <span
                  key={f}
                  className={
                    parsed.mapping[f]
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground line-through"
                  }
                >
                  {FIELD_LABELS[f]}
                  {parsed.mapping[f] ? ` ← ${parsed.mapping[f]}` : ""}
                </span>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Name</th>
                    <th className="py-1 pr-3 font-medium">Title</th>
                    <th className="py-1 pr-3 font-medium">Company</th>
                    <th className="py-1 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{r.fullName}</td>
                      <td className="py-1.5 pr-3">{r.title}</td>
                      <td className="py-1.5 pr-3">{r.company}</td>
                      <td className="py-1.5 whitespace-nowrap">{r.metOn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 5 && (
                <p className="mt-1 text-xs text-muted-foreground">…and {parsed.rows.length - 5} more</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="imp-source">Met via</Label>
              <NativeSelect id="imp-source" value={source} onChange={(e) => setSource(e.target.value)} className="w-full [&_select]:h-10">
                {SOURCES.map((s) => (
                  <NativeSelectOption key={s.value} value={s.value}>
                    {s.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-event">Link to event (optional)</Label>
              <NativeSelect id="imp-event" value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full [&_select]:h-10">
                <NativeSelectOption value="">None</NativeSelectOption>
                {events.map((e) => (
                  <NativeSelectOption key={e.id} value={e.id}>
                    {e.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-follow">Remind me to check in</Label>
              <NativeSelect id="imp-follow" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="w-full [&_select]:h-10">
                {FOLLOW_UP_OPTIONS.map((o) => (
                  <NativeSelectOption key={o.value} value={String(o.value)}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-tag">Tag them with (optional)</Label>
              <Input id="imp-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-10" placeholder="linkedin-import" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            People already in your CRM (same LinkedIn URL, email, phone, or name + company) are skipped.
          </p>
          <Button className="h-10" onClick={run} disabled={pending}>
            {pending ? "Importing…" : `Import ${parsed.rows.length} contact${parsed.rows.length === 1 ? "" : "s"}`}
          </Button>
        </>
      )}
    </div>
  );
}
