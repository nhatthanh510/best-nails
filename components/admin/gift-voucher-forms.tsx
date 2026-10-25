"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Gift, Plus, RefreshCw, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/admin/form-dialog";
import { useActionToast } from "@/components/admin/action-button";
import {
  adjustGiftVoucher,
  checkGiftVoucherCode,
  generateGiftVoucherCode,
  sellGiftVoucher,
  spendGiftVoucher,
  updateGiftVoucher,
  type GiftVoucherCheck,
} from "@/app/admin/gift-voucher-actions";
import type { ActionState } from "@/app/admin/actions";
import { formatMoney, GIFT_VOUCHER_PRESETS, parseDollars } from "@/lib/gift-vouchers";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const segment = (active: boolean) =>
  cn(
    "min-h-11 rounded-[10px] border text-sm font-bold tabular-nums",
    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
  );

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function FormError({ state }: { state: ActionState }) {
  if (!state || state.ok) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-destructive">
      {state.message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Sell
// ---------------------------------------------------------------------------

export function SellGiftVoucherButton({ variant }: { variant?: "default" | "outline" }) {
  return (
    <FormDialog
      variant={variant}
      title="Sell a gift voucher"
      description="Take payment at the till as usual. The voucher is valid for 3 years."
      trigger={
        <>
          <Plus aria-hidden="true" />
          Sell gift voucher
        </>
      }
    >
      {(close) => <SellGiftVoucherForm onDone={close} />}
    </FormDialog>
  );
}

/** The front desk's "Use a gift voucher" form in a dialog, so list pages keep their room. */
export function UseGiftVoucherButton({ variant }: { variant?: "default" | "outline" }) {
  return (
    <FormDialog
      variant={variant}
      title="Use a gift voucher"
      description="Check the balance, then take today's service off it."
      trigger={
        <>
          <WalletCards aria-hidden="true" />
          Use gift voucher
        </>
      }
    >
      {(close) => <UseGiftVoucher onDone={close} />}
    </FormDialog>
  );
}

export function SellGiftVoucherForm({
  onDone,
  openAfterSale = true,
  defaultPhone = "",
}: {
  onDone: () => void;
  openAfterSale?: boolean;
  /** The customer it's for, e.g. the number typed on the kiosk; staff can change or clear it. */
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const generate = () =>
    startGenerate(async () => {
      const result = await generateGiftVoucherCode();
      if (result.ok) {
        setCode(result.code);
        setCodeError(null);
      } else setCodeError(result.message);
    });
  // Start with a generated code, so staff can see it (and write it on the card) before selling.
  useEffect(generate, []);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await sellGiftVoucher(prev, fd);
    if (result?.ok) {
      onDone();
      // In the admin, go to the new voucher; on the kiosk, stay on the check-in screen.
      if (openAfterSale && result.href) router.push(result.href);
    }
    return result;
  }, null);
  useActionToast(state);
  const cents = parseDollars(amount);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Amount</legend>
        <div className="grid grid-cols-3 gap-2">
          {GIFT_VOUCHER_PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={cents === p} onClick={() => setAmount(String(p / 100))} className={segment(cents === p)}>
              {formatMoney(p).replace(".00", "")}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            name="amount"
            aria-label="Amount in dollars"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7 text-base tabular-nums"
          />
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-code">Code</Label>
        <div className="flex gap-2">
          <Input
            id="gv-code"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            placeholder={generating ? "Generating…" : "Type or generate a code"}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono text-base tracking-wider uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
          />
          <Button type="button" variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw className={cn(generating && "animate-spin")} aria-hidden="true" />
            Generate
          </Button>
        </div>
        <p className={cn("text-[13px]", codeError ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {codeError ?? "Made with your business prefix. To use the number printed on a voucher card, type it in instead."}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-phone">
          Customer phone <span className="font-medium text-muted-foreground">(optional)</span>
        </Label>
        <Input id="gv-phone" name="phone" type="tel" inputMode="tel" placeholder="0412 345 678" defaultValue={defaultPhone} />
        <p className="text-[13px] text-muted-foreground">Leave blank if it&apos;s a present for someone who isn&apos;t a member yet.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-notes">
          Notes <span className="font-medium text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="gv-notes" name="notes" rows={2} maxLength={500} placeholder="e.g. Bought by Sarah for her mum" />
      </div>
      <FormError state={state} />
      <Button type="submit" size="lg" pending={pending} disabled={cents === null || cents < 100}>
        <Gift aria-hidden="true" />
        {pending ? "Selling…" : cents && cents >= 100 ? `Sell ${formatMoney(cents)} voucher` : "Sell voucher"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Use (front desk)
// ---------------------------------------------------------------------------

/**
 * Type the code, check the balance, then spend part of it on today's service. Pass `code` to
 * start from a known voucher (its own page) and `customerId` on a customer's page. `compact`
 * stacks the fields for a narrow column.
 */
export function UseGiftVoucher({
  code: fixedCode,
  customerId,
  compact = false,
  onDone,
  defaultPhone = "",
}: {
  code?: string;
  customerId?: string;
  compact?: boolean;
  /** Called after a successful spend, e.g. to close the dialog. */
  onDone?: () => void;
  /** Who is using it, e.g. the number typed on the kiosk. */
  defaultPhone?: string;
}) {
  const [code, setCode] = useState(fixedCode ?? "");
  const [check, setCheck] = useState<GiftVoucherCheck | null>(null);
  const [amount, setAmount] = useState("");
  const [checking, startCheck] = useTransition();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await spendGiftVoucher(prev, fd);
    if (result?.ok) {
      setAmount("");
      setCheck(null);
      if (!fixedCode) setCode("");
      onDone?.();
    }
    return result;
  }, null);
  useActionToast(state);

  const runCheck = () => {
    if (!code.trim()) return;
    startCheck(async () => setCheck(await checkGiftVoucherCode(code)));
  };
  const cents = parseDollars(amount);
  const balance = check?.ok ? check.balanceCents : 0;
  // More than is left can't be used; staff enter what's left and take the rest at the till.
  const over = cents !== null && cents > balance;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      {fixedCode ? (
        <input type="hidden" name="code" value={fixedCode} />
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", !compact && "sm:grid-cols-[1fr_auto] sm:items-end")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`gift-code${customerId ?? ""}`}>Gift voucher code</Label>
            <Input
              id={`gift-code${customerId ?? ""}`}
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Code on the voucher"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCheck(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !check?.ok) {
                  e.preventDefault();
                  runCheck();
                }
              }}
              className="font-mono text-base tracking-wider uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
            />
          </div>
          <Button type="button" variant="outline" onClick={runCheck} pending={checking} disabled={!code.trim()}>
            {checking ? "Checking…" : "Check balance"}
          </Button>
        </div>
      )}
      {fixedCode && !check && (
        <Button type="button" variant="outline" onClick={runCheck} pending={checking} className="self-start">
          {checking ? "Checking…" : "Use this voucher"}
        </Button>
      )}

      {check && !check.ok && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
          <CircleX className="size-4.5 flex-none" aria-hidden="true" />
          {check.message}
        </p>
      )}

      {check?.ok && (
        <div className="flex flex-col gap-3.5 rounded-xl border-2 border-success/40 bg-success-soft px-4 py-3.5">
          <div className="flex items-center gap-3">
            <CircleCheck className="size-6 flex-none text-success" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-lg font-extrabold">
                {formatMoney(check.balanceCents)} left{" "}
                <span className="font-mono text-sm font-bold whitespace-nowrap text-muted-foreground">{check.code}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                of {formatMoney(check.amountCents)} · expires {dateLabel(check.expiresOn)}
                {check.customerName && ` · ${check.customerName}`}
              </span>
            </div>
          </div>
          <div className={cn("grid grid-cols-1 gap-3", !compact && "sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-end")}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`spend${check.id}`}>Today&apos;s service</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id={`spend${check.id}`}
                  name="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  placeholder="35"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={over || undefined}
                  aria-describedby={`spend-summary${check.id}`}
                  className="bg-card pl-7 text-base tabular-nums"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`spend-note${check.id}`}>
                Note <span className="font-medium text-muted-foreground">(optional)</span>
              </Label>
              <Input id={`spend-note${check.id}`} name="note" maxLength={200} placeholder="e.g. Gel full set" className="bg-card" />
            </div>
          </div>
          {!customerId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`spend-phone${check.id}`}>
                Customer phone <span className="font-medium text-muted-foreground">(optional, who is using it today)</span>
              </Label>
              <Input id={`spend-phone${check.id}`} name="phone" type="tel" inputMode="tel" placeholder="0412 345 678" defaultValue={defaultPhone} className="bg-card" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id={`spend-summary${check.id}`} className={cn("text-sm font-semibold", over && "text-destructive")} aria-live="polite">
              {cents !== null && cents > 0 ? (
                over ? (
                  `This voucher only has ${formatMoney(balance)} left. Enter ${formatMoney(balance)} or less and take the rest at the till.`
                ) : (
                  `Leaves ${formatMoney(balance - cents)} on the voucher.`
                )
              ) : (
                // The voucher pays like cash, so a discount comes off first.
                <span className="font-normal text-muted-foreground">Using a discount today? Enter the price after the discount.</span>
              )}
            </p>
            <Button type="submit" pending={pending} disabled={cents === null || cents <= 0 || over}>
              <Gift aria-hidden="true" />
              {pending ? "Saving…" : cents && cents > 0 && !over ? `Use ${formatMoney(cents)}` : "Use voucher"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Managing a voucher (its own page)
// ---------------------------------------------------------------------------

export function GiftVoucherSettingsForm({
  id,
  phone,
  notes,
  expiresOn,
  minExpiry,
  isAdmin,
}: {
  id: string;
  phone: string | null;
  notes: string | null;
  expiresOn: string;
  /** 3 years after the sale: the earliest legal expiry. */
  minExpiry: string;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateGiftVoucher.bind(null, id), null);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-owner-phone">Customer phone</Label>
        <Input id="gv-owner-phone" name="phone" type="tel" inputMode="tel" defaultValue={phone ? formatPhone(phone) : ""} placeholder="Not linked" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-owner-notes">Notes</Label>
        <Textarea id="gv-owner-notes" name="notes" rows={2} maxLength={500} defaultValue={notes ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-expiry">Expires</Label>
        {isAdmin ? (
          <Input id="gv-expiry" name="expires_on" type="date" min={minExpiry} defaultValue={expiresOn} />
        ) : (
          <p id="gv-expiry" className="text-sm">
            {dateLabel(expiresOn)} <span className="text-muted-foreground">· only an admin can change it</span>
          </p>
        )}
      </div>
      <FormError state={state} />
      <Button type="submit" variant="outline" pending={pending} className="self-end">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function AdjustGiftVoucherForm({ id, balanceCents }: { id: string; balanceCents: number }) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await adjustGiftVoucher(id, prev, fd);
    if (result?.ok) setAmount("");
    return result;
  }, null);
  useActionToast(state);

  const cents = parseDollars(amount) ?? 0;
  const preview = direction === "add" ? balanceCents + cents : balanceCents - cents;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="direction" value={direction} />
      <div role="group" aria-label="Add or remove credit" className="grid grid-cols-2 gap-2">
        {(["add", "remove"] as const).map((d) => (
          <button key={d} type="button" aria-pressed={direction === d} onClick={() => setDirection(d)} className={cn(segment(direction === d), "capitalize")}>
            {d}
          </button>
        ))}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">$</span>
        <Input name="amount" aria-label="Amount in dollars" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7 tabular-nums" />
      </div>
      <Textarea name="note" rows={2} maxLength={200} required aria-label="Reason" placeholder="Reason, saved to the history" />
      <FormError state={state} />
      <Button type="submit" pending={pending} disabled={cents <= 0 || preview < 0} className="self-end">
        {cents > 0 ? `Save · new balance ${formatMoney(preview)}` : "Save"}
      </Button>
    </form>
  );
}
