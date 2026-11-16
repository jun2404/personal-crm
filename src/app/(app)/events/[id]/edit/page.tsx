import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/crm/event-form";
import { PageHeader } from "@/components/crm/bits";
import { saveEvent } from "@/app/actions";
import { getEvent } from "@/lib/server/data";
import { requireUserId } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const uid = await requireUserId();
  const { id } = await params;
  const event = await getEvent(uid, id);
  if (!event) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={`Edit ${event.name}`} />
      <EventForm action={saveEvent.bind(null, event.id)} initial={event} cancelHref={`/events/${event.id}`} />
    </div>
  );
}
