"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/components/admin/action-button";
import { findCustomerByPhone, type ActionState } from "@/app/admin/actions";
import type { Customer } from "@/lib/admin-data";
import { formatPhone } from "@/lib/phone";
import { MONTHS } from "@/lib/format";
import { daysInMonth } from "@/lib/birthday";
import { useFormSubmit } from "@/lib/use-form-submit";
import { numberInput } from "@/lib/number-input";

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
  useActionToast(state, { errors: false });

  // Checked when staff leave the phone field, so a duplicate shows before the rest is typed.
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const [, startLookup] = useTransition();
  const lookUp = (phone: string) => startLookup(async () => setExisting(phone.trim() ? await findCustomerByPhone(phone, customer?.id) : null));
  // Only real dates: the day list follows the month (29 Feb allowed), as on the kiosk.
  const [day, setDay] = useState(customer?.birthday_day ? String(customer.birthday_day) : "");
  const [month, setMonth] = useState(customer?.birthday_month ? String(customer.birthday_month) : "");
  const maxDay = month ? daysInMonth(Number(month)) : 31;

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-4">
      {/* The phone first: it's who the customer is everywhere else (the kiosk starts with it). */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          {...numberInput("phone")}
          required
          autoFocus={!customer}
          placeholder="0412 345 678"
          defaultValue={customer ? formatPhone(customer.phone) : ""}
          onBlur={(e) => lookUp(e.target.value)}
          onChange={() => existing && setExisting(null)}
          aria-invalid={existing ? true : undefined}
          aria-describedby={existing ? "phone-taken" : undefined}
        />
        {existing && (
          <p id="phone-taken" role="status" className="rounded-[10px] bg-warning-soft px-3 py-2.5 text-sm font-semibold text-warning">
            Already a customer: {existing.name}.{" "}
            <Link href={`/admin/customers/${existing.id}`} onClick={onDone} className="font-extrabold underline-offset-2 hover:underline">
              Open their page
            </Link>
          </p>
        )}
      </div>
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
      <fieldset className="flex flex-col gap-2">
        {/* Day before month, as on the kiosk and as dates are written in Australia. */}
        <legend className="mb-2 text-sm font-bold">Birthday</legend>
        <div className="flex gap-3">
          <select name="birthday_day" aria-label="Birthday day" value={day} onChange={(e) => setDay(e.target.value)} className={selectClass}>
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select
            name="birthday_month"
            aria-label="Birthday month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              if (e.target.value && Number(day) > daysInMonth(Number(e.target.value))) setDay("");
            }}
            className={selectClass}
          >
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
        <Button type="submit" pending={pending} disabled={Boolean(existing)}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
