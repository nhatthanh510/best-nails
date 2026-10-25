"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/admin/account-actions";

export function ForgotForm() {
  // The email link was old, already used, or opened in a different browser from the one that asked.
  const expired = useSearchParams().has("expired");
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-bold">Forgot password</h1>
        <p className="text-[15px] text-muted-foreground">
          We&apos;ll email you a link to choose a new one. Open it on this device. An admin can also reset it for you in Settings.
        </p>
      </div>
      {expired && !state && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          That link has expired or was already used. Ask for a new one.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@bestnails.com" required />
      </div>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"}>
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Sending…" : "Email me a link"}
      </Button>
    </form>
  );
}
