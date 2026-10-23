"use client";

import { useActionState, useState, useTransition } from "react";
import { CircleCheck, CircleX, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/admin/action-button";
import { checkVoucherCode, redeemVoucherCode, type VoucherCheck } from "@/app/admin/voucher-actions";
import type { ActionState } from "@/app/admin/actions";

/**
 * Front-desk voucher redemption: type the code, check what it's worth, then redeem.
 * On a customer's page pass `customerId`; elsewhere a phone number can link the customer.
 */
export function RedeemVoucher({ customerId, compact = false }: { customerId?: string; compact?: boolean }) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [check, setCheck] = useState<VoucherCheck | null>(null);
  const [checking, startCheck] = useTransition();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await redeemVoucherCode(prev, fd);
    if (result?.ok) {
      setCode("");
      setPhone("");
      setCheck(null);
    }
    return result;
  }, null);
  useActionToast(state);

  const runCheck = () => {
    if (!code.trim()) return;
    startCheck(async () => setCheck(await checkVoucherCode(code, phone, customerId ?? "")));
  };

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      <div className={compact ? "flex flex-col gap-3" : "grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`voucher-code${customerId ?? ""}`}>Voucher code</Label>
          <Input
            id={`voucher-code${customerId ?? ""}`}
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="BN12345"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setCheck(null);
            }}
            onKeyDown={(e) => {
              // Enter checks first; staff confirm with the Redeem button.
              if (e.key === "Enter" && !check?.ok) {
                e.preventDefault();
                runCheck();
              }
            }}
            className="font-mono text-base tracking-wider uppercase"
          />
        </div>
        {!customerId && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="voucher-phone">
              Customer phone <span className="font-medium text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="voucher-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="0412 345 678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setCheck(null);
              }}
            />
          </div>
        )}
        <Button type="button" variant="outline" onClick={runCheck} disabled={!code.trim() || checking}>
          {checking ? "Checking…" : "Check code"}
        </Button>
      </div>

      {check && !check.ok && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
          <CircleX className="size-4.5 flex-none" aria-hidden="true" />
          {check.message}
        </p>
      )}

      {check?.ok && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-success/40 bg-success-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <CircleCheck className="size-6 flex-none text-success" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold">
                {check.discount} <span className="font-mono text-sm font-bold text-muted-foreground">{check.code}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {check.name}
                {check.maxUses > 1 && ` · ${check.usesLeft} of ${check.maxUses} uses left`}
                {check.expiresOn && ` · expires ${new Date(`${check.expiresOn}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}
                {check.customerName && ` · for ${check.customerName}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input name="note" placeholder="Note (optional)" maxLength={200} className="h-10 w-44" aria-label="Note" />
            <Button type="submit" disabled={pending}>
              <Ticket aria-hidden="true" />
              {pending ? "Redeeming…" : "Redeem"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
