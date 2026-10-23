"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/components/admin/action-button";
import { createVoucher } from "@/app/admin/voucher-actions";
import type { ActionState } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex min-h-11 flex-col items-start justify-center rounded-xl border px-4 py-2.5 text-left",
            value === o.value ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-muted",
          )}
        >
          <span className="text-sm font-bold">{o.label}</span>
          {o.hint && <span className={cn("text-[13px]", value === o.value ? "text-background/80" : "text-muted-foreground")}>{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function NewVoucherForm() {
  const router = useRouter();
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [mode, setMode] = useState<"shared" | "batch">("shared");
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await createVoucher(prev, fd);
    if (result?.ok && result.href) router.push(result.href);
    return result;
  }, null);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="discount_type" value={discountType} />
      <input type="hidden" name="mode" value={mode} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="Spring flyer 15% off" />
        <span className="text-[13px] text-muted-foreground">For your reference. Staff see it when they redeem.</span>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-bold">Discount</legend>
        <Segmented
          label="Discount type"
          value={discountType}
          onChange={setDiscountType}
          options={[
            { value: "percent", label: "Percentage off", hint: "e.g. 15% off" },
            { value: "amount", label: "Dollar amount off", hint: "e.g. $10 off" },
          ]}
        />
        <div className="flex items-center gap-2">
          {discountType === "amount" && <span className="text-lg font-bold">$</span>}
          <Input
            name="discount_value"
            aria-label="Discount amount"
            type="number"
            inputMode="decimal"
            min={0.01}
            max={discountType === "percent" ? 100 : 10000}
            step={discountType === "percent" ? 1 : 0.01}
            required
            className="w-32"
          />
          {discountType === "percent" && <span className="text-sm font-bold">% off</span>}
          {discountType === "amount" && <span className="text-sm font-bold">off</span>}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-bold">Codes</legend>
        <Segmented
          label="Code type"
          value={mode}
          onChange={setMode}
          options={[
            { value: "shared", label: "One code, used many times", hint: "e.g. BN12345 on 100 flyers" },
            { value: "batch", label: "Unique codes, each used once", hint: "e.g. 200 numbered vouchers" },
          ]}
        />
        {mode === "shared" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required autoCapitalize="characters" placeholder="BN12345" className="font-mono uppercase" />
              <span className="text-[13px] text-muted-foreground">Type the code printed on your vouchers.</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="max_uses">Can be used</Label>
              <div className="flex items-center gap-2">
                <Input id="max_uses" name="max_uses" type="number" min={1} max={100000} required defaultValue={100} className="w-32" />
                <span className="text-sm font-semibold">times in total</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input id="prefix" name="prefix" maxLength={6} defaultValue="BN" autoCapitalize="characters" className="w-32 font-mono uppercase" />
              <span className="text-[13px] text-muted-foreground">Codes look like BN48213.</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="count">How many codes</Label>
              <Input id="count" name="count" type="number" min={1} max={5000} required defaultValue={100} className="w-32" />
              <span className="text-[13px] text-muted-foreground">Download them as a CSV to print.</span>
            </div>
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="starts_on">
            Valid from <span className="font-medium text-muted-foreground">(optional)</span>
          </Label>
          <Input id="starts_on" name="starts_on" type="date" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expires_on">
            Expires <span className="font-medium text-muted-foreground">(optional, last valid day)</span>
          </Label>
          <Input id="expires_on" name="expires_on" type="date" />
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="once_per_customer" defaultChecked className="size-5 accent-primary" />
        Each customer can use it only once (when a customer is linked at redemption)
      </label>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Notes <span className="font-medium text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} placeholder="Where these were handed out, conditions…" />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="self-end">
        {pending ? "Creating…" : "Create voucher"}
      </Button>
    </form>
  );
}
