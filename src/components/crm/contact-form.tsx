"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "@/app/actions";
import { FOLLOW_UP_OPTIONS, ROLE_CATEGORIES, SOURCES, classifyTitle, roleLabel } from "@/lib/crm";
import { cn } from "@/lib/utils";

export type ContactFormValues = {
  fullName?: string;
  company?: string | null;
  title?: string | null;
  roleCategory?: string;
  phone?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  source?: string;
  eventId?: string | null;
  metOn?: string | null;
  city?: string | null;
  notes?: string | null;
  tags?: string[];
  followUpDays?: number;
  starred?: boolean;
};

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  events: { id: string; name: string }[];
  initial?: ContactFormValues;
  mode: "create" | "edit";
  today: string;
  cancelHref: string;
};

const NEW_EVENT = "__new__";

export function ContactForm({ action, events, initial = {}, mode, today, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [source, setSource] = useState(initial.source ?? "networking_event");
  const [eventId, setEventId] = useState(initial.eventId ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [role, setRole] = useState(mode === "edit" && initial.roleCategory && initial.roleCategory !== classifyTitle(initial.title) ? initial.roleCategory : "auto");
  const [showMore, setShowMore] = useState(mode === "edit");

  // "Save & add another": keep source, event and date, clear the person.
  useEffect(() => {
    if (state?.ok && state.savedName) {
      toast.success(`Saved ${state.savedName}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form after a successful save
      setFormKey((k) => k + 1);
      setTitle("");
      setRole("auto");
      requestAnimationFrame(() => nameRef.current?.focus());
    }
    // On a phone the save buttons are far below the message, so bring it into view.
    if (state?.error) alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  const field = "h-10";
  const showEvent = source === "networking_event" || source === "offline_meetup" || eventId !== "";

  return (
    <form
      ref={formRef}
      // Submit manually (not via the action prop) so React doesn't wipe the fields when there's an error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
      className="space-y-6"
    >

      {state?.error && (
        <div ref={alertRef} role="alert" className="scroll-mt-20 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">{state.error}</p>
          {state.duplicate && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href={`/contacts/${state.duplicate.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open {state.duplicate.name}
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!formRef.current) return;
                  const fd = new FormData(formRef.current);
                  fd.set("ignoreDuplicate", "1");
                  startTransition(() => formAction(fd));
                }}
              >
                Save anyway
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Person: remounted after "save & add another" to clear the fields */}
      <fieldset key={formKey} className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">Who</legend>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Name *</Label>
          <Input
            ref={nameRef}
            id="fullName"
            name="fullName"
            required
            autoFocus={mode === "create"}
            autoComplete="off"
            autoCapitalize="words"
            defaultValue={initial.fullName ?? ""}
            className={field}
            placeholder="Jane Doe"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoCapitalize="words"
              autoComplete="off"
              className={field}
              placeholder="Co-founder & CMO"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" defaultValue={initial.company ?? ""} autoComplete="off" className={field} placeholder="Acme Inc." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleCategory">Role type</Label>
          <NativeSelect id="roleCategory" name="roleCategory" value={role} onChange={(e) => setRole(e.target.value)} className="w-full [&_select]:h-10">
            <NativeSelectOption value="auto">
              Auto from title{title.trim() ? `: ${roleLabel(classifyTitle(title))}` : ""}
            </NativeSelectOption>
            {ROLE_CATEGORIES.map((r) => (
              <NativeSelectOption key={r.value} value={r.value}>
                {r.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone / WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={initial.phone ?? ""} className={field} placeholder="+country code, e.g. +971 50 123 4567" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl">LinkedIn</Label>
            <Input id="linkedinUrl" name="linkedinUrl" inputMode="url" autoCapitalize="none" autoComplete="off" defaultValue={initial.linkedinUrl ?? ""} className={field} placeholder="linkedin.com/in/jane-doe" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">How you met</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Met via">
          {SOURCES.map((s) => (
            <label
              key={s.value}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                source === s.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="source"
                value={s.value}
                checked={source === s.value}
                onChange={() => setSource(s.value)}
                className="sr-only"
              />
              {s.label}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {showEvent && (
            <div className="space-y-1.5">
              <Label htmlFor="eventId">Event</Label>
              <NativeSelect id="eventId" name="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full [&_select]:h-10">
                <NativeSelectOption value="">None</NativeSelectOption>
                {events.map((e) => (
                  <NativeSelectOption key={e.id} value={e.id}>
                    {e.name}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value={NEW_EVENT}>+ New event…</NativeSelectOption>
              </NativeSelect>
              {eventId === NEW_EVENT && (
                <Input name="newEventName" required autoFocus placeholder="Event name, e.g. Step Conference 2026" className={cn(field, "mt-2")} />
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="metOn">Date met</Label>
            <Input id="metOn" name="metOn" type="date" max={today} defaultValue={initial.metOn ?? (mode === "create" ? today : "")} className={field} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">Staying in touch</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="followUpDays">Remind me to check in</Label>
            <NativeSelect id="followUpDays" name="followUpDays" defaultValue={String(initial.followUpDays ?? 60)} className="w-full [&_select]:h-10">
              {FOLLOW_UP_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={String(o.value)}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="starred" defaultChecked={initial.starred} className="size-4 accent-[var(--primary)]" />
            Star as a key contact
          </label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            key={`notes-${formKey}`}
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial.notes ?? ""}
            placeholder="What did you talk about? Anything to remember or follow up on?"
          />
        </div>
      </fieldset>

      {showMore ? (
        <fieldset key={`more-${formKey}`} className="space-y-4">
          <legend className="mb-3 text-sm font-semibold">More details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" defaultValue={initial.email ?? ""} className={field} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={initial.city ?? ""} className={field} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" autoCapitalize="none" defaultValue={(initial.tags ?? []).join(", ")} className={field} placeholder="fintech, potential client, hiring" />
            <p className="text-xs text-muted-foreground">Separate with commas.</p>
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setShowMore(true)} className="text-sm text-primary hover:underline">
          + Email, city and tags
        </button>
      )}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-wrap gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" name="intent" value="open" className="h-10 flex-1 sm:flex-none" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Save contact" : "Save changes"}
        </Button>
        {mode === "create" && (
          <Button type="submit" name="intent" value="another" variant="secondary" className="h-10 flex-1 sm:flex-none" disabled={pending}>
            Save &amp; add another
          </Button>
        )}
        <Link href={cancelHref} className={cn(buttonVariants({ variant: "ghost" }), "h-10")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
