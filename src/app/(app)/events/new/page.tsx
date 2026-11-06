import type { Metadata } from "next";
import { EventForm } from "@/components/crm/event-form";
import { PageHeader } from "@/components/crm/bits";
import { saveEvent } from "@/app/actions";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New event" />
      <EventForm action={saveEvent.bind(null, null)} cancelHref="/events" />
    </div>
  );
}
