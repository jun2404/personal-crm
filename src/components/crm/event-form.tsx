"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/app/actions";

export function EventForm({
  action,
  initial = {},
  cancelHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: { name?: string; date?: string | null; location?: string | null; notes?: string | null };
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-4"
    >
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Event name *</Label>
        <Input id="name" name="name" required autoFocus defaultValue={initial.name ?? ""} className="h-10" placeholder="Founders Breakfast, November" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={initial.date ?? ""} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={initial.location ?? ""} className="h-10" placeholder="Venue or city" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} placeholder="Organiser, theme, who to look out for…" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Saving…" : "Save event"}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost", className: "h-10" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
