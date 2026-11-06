import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/crm/contact-form";
import { PageHeader } from "@/components/crm/bits";
import { updateContact } from "@/app/actions";
import { getContact, listEvents } from "@/lib/server/data";
import { getToday } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = await getToday();
  const [data, events] = await Promise.all([getContact(id, today), listEvents()]);
  if (!data) notFound();
  const c = data.contact;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit ${c.fullName}`} />
      <ContactForm
        mode="edit"
        action={updateContact.bind(null, c.id)}
        events={events}
        today={today}
        cancelHref={`/contacts/${c.id}`}
        initial={c}
      />
    </div>
  );
}
