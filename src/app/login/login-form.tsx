"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/actions";

/** The browser's timezone, sent with the form so "today" matches the user's clock. */
export function useBrowserTimeZone() {
  const [tz, setTz] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  }, []);
  return tz;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);
  const tz = useBrowserTimeZone();

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="tz" value={tz} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          required
          className="h-11"
          aria-invalid={state?.error ? true : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
          aria-invalid={state?.error ? true : undefined}
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
