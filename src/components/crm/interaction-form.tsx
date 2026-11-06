"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "@/app/actions";
import { INTERACTION_KINDS } from "@/lib/crm";

export function InteractionForm({
  action,
  today,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Logged. Next reminder reset.");
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <NativeSelect name="kind" defaultValue="whatsapp" aria-label="How" className="w-full [&_select]:h-10">
          {INTERACTION_KINDS.map((k) => (
            <NativeSelectOption key={k.value} value={k.value}>
              {k.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input name="occurredOn" type="date" defaultValue={today} max={today} aria-label="When" className="h-10" />
      </div>
      <Textarea name="note" rows={2} placeholder="What did you talk about? (optional)" />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "Saving…" : "Log check-in"}
      </Button>
    </form>
  );
}
