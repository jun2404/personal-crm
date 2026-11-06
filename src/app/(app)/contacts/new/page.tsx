import type { Metadata } from "next";
import { ContactForm } from "@/components/crm/contact-form";
import { PageHeader } from "@/components/crm/bits";
import { createContact } from "@/app/actions";
import { listEvents } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add contact" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; source?: string }>;
}) {
  const sp = await searchParams;
  const [events, today] = await Promise.all([listEvents(), getToday()]);
  const event = events.find((e) => e.id === sp.event);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add contact"
        description={event ? `At ${event.name}. Use "Save & add another" to log several people quickly.` : "Only the name is required. You can fill in the rest later."}
      />
      <ContactForm
        mode="create"
        action={createContact}
        events={events}
        today={today}
        cancelHref={event ? `/events/${event.id}` : "/contacts"}
        initial={{
          eventId: event?.id ?? null,
          source: sp.source ?? (event ? "networking_event" : undefined),
          metOn: event?.date && event.date <= today ? event.date : undefined,
        }}
      />
    </div>
  );
}
