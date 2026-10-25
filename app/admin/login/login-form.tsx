"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "../actions";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-bold">Sign in</h1>
        <p className="text-[15px] text-muted-foreground">Staff only. Use the email your manager set up.</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@bestnails.com" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
