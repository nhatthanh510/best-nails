"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/admin/form-dialog";
import { CustomerForm } from "@/components/admin/customer-form";
import { useActionToast } from "@/components/admin/action-button";
import { adjustPoints, updateCustomer } from "@/app/admin/actions";
import type { Customer } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export function EditCustomerButton({ customer }: { customer: Customer }) {
  return (
    <FormDialog variant="outline" title="Edit customer" trigger="Edit">
      {(close) => <CustomerForm action={updateCustomer.bind(null, customer.id)} customer={customer} submitLabel="Save" onDone={close} />}
    </FormDialog>
  );
}

export function AdjustPointsForm({ customerId, balance }: { customerId: string; balance: number }) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof adjustPoints>[1], fd: FormData) => {
    const result = await adjustPoints(customerId, prev, fd);
    if (result?.ok) setAmount("");
    return result;
  }, null);
  useActionToast(state);

  const n = Number(amount) || 0;
  const preview = direction === "add" ? balance + n : balance - n;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="direction" value={direction} />
      <div role="group" aria-label="Add or remove points" className="grid grid-cols-2 gap-2">
        {(["add", "remove"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={direction === d}
            onClick={() => setDirection(d)}
            className={cn(
              "min-h-11 rounded-[10px] border text-sm font-bold capitalize",
              direction === d ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-muted",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Points</Label>
        <Input id="amount" name="amount" type="number" inputMode="numeric" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Reason</Label>
        <Textarea id="note" name="note" rows={2} maxLength={200} required placeholder="Saved to the history log" />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" pending={pending} disabled={n <= 0 || preview < 0} className="self-end">
        {n > 0 ? `Save · new balance ${preview}` : "Save"}
      </Button>
    </form>
  );
}
