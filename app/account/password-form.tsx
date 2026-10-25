"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword } from "@/app/admin/account-actions";
import type { ActionState } from "@/app/admin/actions";
import { MIN_PASSWORD } from "@/lib/accounts";
import { useFormSubmit } from "@/lib/use-form-submit";

const COPY = {
  temporary: { title: "Choose your password", text: "You signed in with a temporary password. Choose one only you know to carry on." },
  reset: { title: "Choose a new password", text: "You came from a reset link, so you don't need your old password." },
  change: { title: "Change your password", text: "Type your current password, then the new one twice." },
};

export function PasswordForm({
  reason,
  email,
  name,
  role,
}: {
  reason: "temporary" | "reset" | null;
  email: string;
  name: string;
  role: "admin" | "staff";
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await changeOwnPassword(prev, fd);
    if (result?.ok && result.href) router.push(result.href);
    return result;
  }, null);
  const copy = COPY[reason ?? "change"];

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  return (
    <form {...formSubmit} className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] leading-tight font-bold">{copy.title}</h1>
        <p className="text-[15px] text-muted-foreground">{copy.text}</p>
      </div>
      <p className="rounded-xl bg-background px-3.5 py-2.5 text-sm">
        <span className="font-bold">{name}</span>
        <span className="text-muted-foreground"> · {role === "admin" ? "Admin" : "Staff"}</span>
        <span className="block truncate text-muted-foreground">{email}</span>
      </p>
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {!reason && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required />
        <span className="text-[13px] text-muted-foreground">At least {MIN_PASSWORD} characters.</span>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">New password again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} required />
      </div>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"}>
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" pending={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
