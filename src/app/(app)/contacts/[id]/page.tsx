import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Contact as ContactIcon, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { LinkedInIcon } from "@/components/crm/linkedin-icon";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, DueText, RolePill, SourcePill, TagPill } from "@/components/crm/bits";
import { InteractionForm } from "@/components/crm/interaction-form";
import { ConfirmDelete } from "@/components/crm/confirm-button";
import { StarButton } from "@/components/crm/star-button";
import { deleteContact, deleteInteraction, logInteraction } from "@/app/actions";
import { getContact } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";
import { daysBetween, followUpLabel, formatDate, kindLabel, relativeDays, roleLabel, telHref, whatsappHref } from "@/lib/crm";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getContact(id, await getToday());
  return { title: data?.contact.fullName ?? "Contact" };
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = await getToday();
  const data = await getContact(id, today);
  if (!data) notFound();
  const { contact: c, interactions } = data;

  const tel = telHref(c.phone);
  const wa = whatsappHref(c.phone);
  const actions = [
    wa && { href: wa, label: "WhatsApp", icon: MessageCircle, external: true },
    tel && { href: tel, label: "Call", icon: Phone, external: false },
    c.linkedinUrl && { href: c.linkedinUrl, label: "LinkedIn", icon: LinkedInIcon, external: true },
    c.email && { href: `mailto:${c.email}`, label: "Email", icon: Mail, external: false },
    { href: `/api/contacts/${c.id}/vcard`, label: "Save to phone", icon: ContactIcon, external: false },
  ].filter(Boolean) as { href: string; label: string; icon: React.ComponentType<{ className?: string }>; external: boolean }[];

  const details: [string, React.ReactNode][] = [
    ["Phone", c.phone],
    ["Email", c.email],
    ["LinkedIn", c.linkedinUrl && (
      <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
        {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    )],
    ["Role type", roleLabel(c.roleCategory)],
    ["Met", [formatDate(c.metOn), c.eventName && (
      <Link key="e" href={`/events/${c.eventId}`} className="text-primary hover:underline">
        {c.eventName}
      </Link>
    )].filter((x) => x && x !== "—").reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])],
    ["City", c.city],
    ["Added", formatDate(new Date(c.createdAt).toISOString())],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Contacts
      </Link>

      <div className="flex items-start gap-4">
        <Avatar name={c.fullName} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{c.fullName}</h1>
          {(c.title || c.company) && (
            <p className="text-muted-foreground">
              {c.title}
              {c.title && c.company && " at "}
              {c.company && (
                <Link href={`/contacts?company=${encodeURIComponent(c.company)}`} className="hover:underline">
                  {c.company}
                </Link>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RolePill role={c.roleCategory} />
            <SourcePill source={c.source} />
            {c.tags.map((t) => (
              <Link key={t} href={`/contacts?tag=${encodeURIComponent(t)}`}>
                <TagPill tag={t} />
              </Link>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <StarButton id={c.id} starred={c.starred} />
          <Link href={`/contacts/${c.id}/edit`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Edit" title="Edit">
            <Pencil />
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <a
              key={a.label}
              href={a.href}
              {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={cn(buttonVariants({ variant: "outline" }), "h-auto flex-col gap-1 py-2.5 text-xs sm:h-9 sm:flex-row sm:py-0 sm:text-sm")}
            >
              <Icon className="size-4" />
              {a.label}
            </a>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {c.notes && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 text-sm">
              {details
                .filter(([, v]) => v && !(Array.isArray(v) && v.length === 0))
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins logged yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-5">
                {interactions.map((i) => (
                  <li key={i.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {kindLabel(i.kind)}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatDate(i.occurredOn)} · {relativeDays(daysBetween(today, i.occurredOn))}
                          </span>
                        </p>
                        {i.note && <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{i.note}</p>}
                      </div>
                      <ConfirmDelete
                        compact
                        label="Remove check-in"
                        title="Remove this check-in?"
                        description="The follow-up reminder will be recalculated from the remaining history."
                        onConfirm={deleteInteraction.bind(null, i.id, c.id)}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Stay in touch</h2>
            <div className="mt-1 mb-4 space-y-0.5">
              <DueText status={c.status} daysUntilDue={c.daysUntilDue} dueOn={c.dueOn} className="text-sm" />
              <p className="text-xs text-muted-foreground">
                {followUpLabel(c.followUpDays)}
                {c.lastContactedOn
                  ? ` · last contacted ${relativeDays(daysBetween(today, c.lastContactedOn))}`
                  : " · never contacted since meeting"}
              </p>
            </div>
            <InteractionForm action={logInteraction.bind(null, c.id)} today={today} />
          </section>

          <ConfirmDelete
            label="Delete contact"
            title={`Delete ${c.fullName}?`}
            description="This removes the contact and their check-in history. It can't be undone."
            onConfirm={deleteContact.bind(null, c.id)}
          />
        </aside>
      </div>
    </div>
  );
}
