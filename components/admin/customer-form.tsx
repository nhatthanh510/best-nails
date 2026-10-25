"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/components/admin/action-button";
import type { ActionState } from "@/app/admin/actions";
import type { Customer } from "@/lib/admin-data";
import { formatPhone } from "@/lib/phone";
import { MONTHS } from "@/lib/format";

const selectClass = "h-11 rounded-[10px] border border-input bg-card px-3 text-[15px]";

export function CustomerForm({
  action,
  customer,
  submitLabel,
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  customer?: Customer;
  submitLabel: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) {
      onDone?.();
      if (result.href) router.push(result.href);
    }
    return result;
  }, null);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" required maxLength={50} defaultValue={customer?.first_name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" maxLength={50} defaultValue={customer?.last_name ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          placeholder="0412 345 678"
          defaultValue={customer ? formatPhone(customer.phone) : ""}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        {/* Day before month, as on the kiosk and as dates are written in Australia. */}
        <legend className="mb-2 text-sm font-bold">Birthday</legend>
        <div className="flex gap-3">
          <select name="birthday_day" aria-label="Birthday day" defaultValue={customer?.birthday_day ?? ""} className={selectClass}>
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select name="birthday_month" aria-label="Birthday month" defaultValue={customer?.birthday_month ?? ""} className={selectClass}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={customer?.notes ?? ""} placeholder="Preferences, allergies…" />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" pending={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
