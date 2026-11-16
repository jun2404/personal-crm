"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/app/actions";
import { useBrowserTimeZone } from "../login/login-form";

export function SignupForm({ canClaim }: { canClaim: boolean }) {
  const [state, action, pending] = useActionState(signup, null);
  const tz = useBrowserTimeZone();

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <input type="hidden" name="tz" value={tz} />
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" autoFocus className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 8 characters.
        </p>
      </div>

      {canClaim && (
        <details className="rounded-lg border bg-muted/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Used this app before accounts existed?</summary>
          <p className="mt-2 text-muted-foreground">
            Enter the old app password and every contact and event saved so far moves into this new account. Only
            one account can do this.
          </p>
          <div className="mt-3 space-y-2">
            <Label htmlFor="legacyPassword">Old app password</Label>
            <Input
              id="legacyPassword"
              name="legacyPassword"
              type="password"
              autoComplete="off"
              className="h-11 bg-background"
            />
          </div>
        </details>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Your contacts are private to your account.</p>
    </form>
  );
}
