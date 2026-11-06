import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContactCard } from "@/components/crm/contact-card";
import { EmptyState, PageHeader } from "@/components/crm/bits";
import { getDashboard } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const today = await getToday();
  const d = await getDashboard(today);

  if (d.total === 0) {
    return (
      <>
        <PageHeader title="Welcome 👋" description="Your personal CRM is empty. Start with one of these:" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/contacts/new" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
            <p className="font-medium">Add someone you met</p>
            <p className="mt-1 text-sm text-muted-foreground">Name, company, title and where you met. Takes 20 seconds.</p>
          </Link>
          <Link href="/import" className="rounded-xl border bg-card p-5 hover:bg-muted/40">
            <p className="font-medium">Import your LinkedIn connections</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload LinkedIn&apos;s Connections.csv to bring everyone in at once.</p>
          </Link>
        </div>
      </>
    );
  }

  const stats = [
    { label: "Contacts", value: d.total, href: "/contacts" },
    { label: "Overdue", value: d.overdue.length, href: "/contacts?status=overdue", tone: d.overdue.length ? "text-red-600 dark:text-red-400" : "" },
    { label: "Founders, execs & investors", value: d.decisionMakers, href: "/contacts?sort=company" },
    { label: "Added this month", value: d.addedThisMonth, href: "/contacts?sort=recent" },
  ];

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description={
          d.overdue.length
            ? `${d.overdue.length} ${d.overdue.length === 1 ? "person is" : "people are"} waiting to hear from you.`
            : "You're all caught up. Nice."
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
            <p className={cn("text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <Section
        title="Overdue"
        hint="Tap the WhatsApp or LinkedIn button to reach out. It logs the check-in for you."
        more={d.overdue.length > 8 ? { href: "/contacts?status=overdue", label: `All ${d.overdue.length}` } : undefined}
      >
        {d.overdue.length ? (
          <ul className="grid gap-2">
            {d.overdue.slice(0, 8).map((c) => (
              <ContactCard key={c.id} c={c} showReachOut />
            ))}
          </ul>
        ) : (
          <EmptyState title="Nobody overdue">Everyone has heard from you recently.</EmptyState>
        )}
      </Section>

      {d.dueSoon.length > 0 && (
        <Section
          title="Coming up (next 2 weeks)"
          more={d.dueSoon.length > 6 ? { href: "/contacts?status=due_soon", label: `All ${d.dueSoon.length}` } : undefined}
        >
          <ul className="grid gap-2">
            {d.dueSoon.slice(0, 6).map((c) => (
              <ContactCard key={c.id} c={c} showReachOut />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recently added" more={{ href: "/contacts?sort=recent", label: "See all" }}>
        <ul className="grid gap-2 md:grid-cols-2">
          {d.recent.map((c) => (
            <ContactCard key={c.id} c={c} />
          ))}
        </ul>
      </Section>
    </>
  );
}

function Section({
  title,
  hint,
  more,
  children,
}: {
  title: string;
  hint?: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {more && (
          <Link href={more.href} className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline">
            {more.label} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
