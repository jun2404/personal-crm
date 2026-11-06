import type { Metadata } from "next";
import { PageHeader } from "@/components/crm/bits";
import { listEvents } from "@/lib/server/data";
import { Importer } from "./importer";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const events = await listEvents();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Import contacts" description="Bring in your LinkedIn connections or any spreadsheet of contacts." />
      <Importer events={events.map((e) => ({ id: e.id, name: e.name }))} />

      <details className="mt-8 rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to download your LinkedIn connections</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>On LinkedIn, open <strong>Me → Settings &amp; Privacy → Data privacy</strong>.</li>
          <li>Choose <strong>Get a copy of your data</strong>, tick <strong>Connections</strong>, and request the archive.</li>
          <li>LinkedIn emails you a download link, usually within about 10 minutes.</li>
          <li>Unzip it and upload <strong>Connections.csv</strong> here.</li>
        </ol>
        <p className="mt-3 text-muted-foreground">
          LinkedIn only includes an email when the person allows it, so expect most rows to have just a name, title,
          company and profile link. That&apos;s enough to start following up.
        </p>
      </details>
    </div>
  );
}
