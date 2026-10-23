"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/components/admin/action-button";
import { addVoucherCodes, updateVoucher } from "@/app/admin/voucher-actions";
import type { Voucher } from "@/lib/vouchers";
import { cn } from "@/lib/utils";

export function EditVoucherForm({ voucher: v }: { voucher: Voucher }) {
  const [state, formAction, pending] = useActionState(updateVoucher.bind(null, v.id), null);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={80} defaultValue={v.name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="starts_on">Valid from</Label>
          <Input id="starts_on" name="starts_on" type="date" defaultValue={v.starts_on ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expires_on">Expires</Label>
          <Input id="expires_on" name="expires_on" type="date" defaultValue={v.expires_on ?? ""} />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="once_per_customer" defaultChecked={v.once_per_customer} className="size-5 accent-primary" />
        Once per customer
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-5 accent-primary" />
        Active (untick to pause all its codes)
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={v.notes ?? ""} />
      </div>
      <p className="text-[13px] text-muted-foreground">The discount can&apos;t be changed once vouchers are printed. Create a new voucher instead.</p>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function AddCodesForm({ voucherId }: { voucherId: string }) {
  const [mode, setMode] = useState<"batch" | "shared">("batch");
  const [state, formAction, pending] = useActionState(addVoucherCodes.bind(null, voucherId), null);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <div role="group" aria-label="Code type" className="grid grid-cols-2 gap-2">
        {(
          [
            ["batch", "More unique codes"],
            ["shared", "Another shared code"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "min-h-11 rounded-[10px] border px-2 text-[13px] font-bold",
              mode === m ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "batch" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prefix">Prefix</Label>
            <Input id="prefix" name="prefix" maxLength={6} defaultValue="BN" className="font-mono uppercase" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="count">How many</Label>
            <Input id="count" name="count" type="number" min={1} max={5000} required defaultValue={50} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="BN67890" className="font-mono uppercase" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="max_uses">Uses</Label>
            <Input id="max_uses" name="max_uses" type="number" min={1} max={100000} required defaultValue={100} />
          </div>
        </div>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending} className="self-end">
        {pending ? "Adding…" : "Add codes"}
      </Button>
    </form>
  );
}
