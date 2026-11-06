import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Pencil, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ContactCard } from "@/components/crm/contact-card";
import { ConfirmDelete } from "@/components/crm/confirm-button";
import { EmptyState, PageHeader } from "@/components/crm/bits";
import { deleteEvent } from "@/app/actions";
import { getEvent, listContacts } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";
import { formatDate } from "@/lib/crm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getEvent(id))?.name ?? "Event" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const people = await listContacts({ event: event.id, sort: "recent" }, await getToday());

  return (
    <>
      <Link href="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Events
      </Link>
      <PageHeader
        title={event.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{event.date ? formatDate(event.date) : "No date"}</span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {event.location}
              </span>
            )}
            <span>
              {people.length} {people.length === 1 ? "person" : "people"} met
            </span>
          </span>
        }
        actions={
          <>
            <Link href={`/contacts/new?event=${event.id}`} className={buttonVariants()}>
              <UserPlus /> Add someone I met here
            </Link>
            <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Edit event" title="Edit event">
              <Pencil />
            </Link>
          </>
        }
      />

      {event.notes && <p className="mb-5 rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{event.notes}</p>}

      {people.length === 0 ? (
        <EmptyState title="Nobody added yet">
          At the event? Tap <strong>Add someone I met here</strong> and use &quot;Save &amp; add another&quot; to log people in a row.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {people.map((c) => (
            <ContactCard key={c.id} c={c} />
          ))}
        </ul>
      )}

      <div className="mt-10">
        <ConfirmDelete
          label="Delete event"
          title={`Delete ${event.name}?`}
          description="The contacts you met here stay in your CRM. They just won't be linked to this event any more."
          onConfirm={deleteEvent.bind(null, event.id)}
        />
      </div>
    </>
  );
}
