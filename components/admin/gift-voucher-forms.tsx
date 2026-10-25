"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, CircleX, Copy, Gift, Plus, RefreshCw, TriangleAlert, WalletCards } from "lucide-react";
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
  type CreatedVoucher,
  type GiftVoucherCheck,
  type SellState,
} from "@/app/admin/gift-voucher-actions";
import type { ActionState } from "@/app/admin/actions";
import { formatMoney, GIFT_VOUCHER_PRESETS, parseDollars } from "@/lib/gift-vouchers";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import type { GiftVoucherStatus } from "@/lib/gift-vouchers";
import { useFormSubmit } from "@/lib/use-form-submit";
import { cleanNumber, numberInput } from "@/lib/number-input";

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
      title="Create a gift voucher"
      description="Take payment at the till as usual. The voucher is valid for 3 years."
      trigger={
        <>
          <Plus aria-hidden="true" />
          Create gift voucher
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

/** The voucher page's main action: opens the use form for that voucher, already checked. */
export function UseThisVoucherButton({ code }: { code: string }) {
  return (
    <FormDialog title={`Use ${code}`} description="Take today's service off this voucher." size="lg" trigger={<><WalletCards aria-hidden="true" />Use this voucher</>}>
      {(close) => <UseGiftVoucher code={code} onDone={close} />}
    </FormDialog>
  );
}

export function SellGiftVoucherForm({
  onDone,
  openAfterSale = true,
  defaultPhone = "",
  phoneKnown = false,
}: {
  onDone: () => void;
  openAfterSale?: boolean;
  /** The customer it's for, e.g. the number typed on the kiosk; staff can change or clear it. */
  defaultPhone?: string;
  /** The customer is already shown (the kiosk's "For …" chip), so the phone field isn't repeated. */
  phoneKnown?: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  // Notes are rare, so they open on demand and the form fits an iPad screen without scrolling.
  const [showNotes, setShowNotes] = useState(false);
  const [generating, startGenerate] = useTransition();
  const generate = () =>
    startGenerate(async () => {
      const result = await generateGiftVoucherCode();
      if (result.ok) {
        setCode(result.code);
        setCodeError(null);
      } else setCodeError(result.message);
    });
  // Errors show in the form; success swaps it for the "Voucher created" screen below.
  const [state, formAction, pending] = useActionState(async (prev: SellState, fd: FormData) => sellGiftVoucher(prev, fd), null);
  const cents = parseDollars(amount);
  // Anything other than a preset (including an empty box being typed into) is the "Other" amount.
  const isOther = !GIFT_VOUCHER_PRESETS.some((p) => p === cents) && amount !== "";

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  if (state?.ok && state.voucher) {
    return (
      <VoucherCreated
        voucher={state.voucher}
        onDone={onDone}
        // In the admin, staff can go to the new voucher; on the kiosk they stay on the check-in screen.
        onOpen={
          openAfterSale && state.href
            ? () => {
                onDone();
                router.push(state.href!);
              }
            : undefined
        }
      />
    );
  }
  return (
    <form {...formSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Amount</legend>
        {/* The presets and "Other" are one row of choices, so a typed amount reads as the custom
            one (a separate full-width box would repeat the selected preset). */}
        <input type="hidden" name="amount" value={amount} />
        <div className="grid grid-cols-4 gap-2">
          {GIFT_VOUCHER_PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={cents === p} onClick={() => setAmount(String(p / 100))} className={segment(cents === p)}>
              {formatMoney(p).replace(".00", "")}
            </button>
          ))}
          <label
            className={cn(
              "flex min-h-11 min-w-0 items-center gap-1 rounded-[10px] border px-2.5 text-sm font-bold focus-within:ring-3 focus-within:ring-ring/50",
              isOther ? "border-primary bg-card" : "border-input bg-card",
            )}
          >
            <span className="text-muted-foreground" aria-hidden="true">
              $
            </span>
            <input
              aria-label="Other amount in dollars"
              {...numberInput("money")}
              maxLength={7}
              autoComplete="off"
              placeholder="Other"
              value={isOther ? amount : ""}
              onChange={(e) => setAmount(cleanNumber("money", e.target.value))}
              className="w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:font-semibold placeholder:text-muted-foreground"
            />
          </label>
        </div>
        {isOther && cents !== null && cents < 100 && <p className="text-[13px] font-semibold text-destructive">At least $1.</p>}
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
            required
            placeholder={generating ? "Generating…" : "Number on the card"}
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
          {codeError ?? "Type the number printed on the voucher card, or press Generate."}
        </p>
      </div>
      {phoneKnown ? (
        <input type="hidden" name="phone" value={defaultPhone} />
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="gv-phone">
            Customer phone <span className="font-medium text-muted-foreground">(optional)</span>
          </Label>
          <Input id="gv-phone" name="phone" type="tel" {...numberInput("phone")} placeholder="0412 345 678" defaultValue={defaultPhone} />
          <p className="text-[13px] text-muted-foreground">Leave blank for a present for someone who isn&apos;t a member yet.</p>
        </div>
      )}
      {showNotes ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="gv-notes">
            Notes <span className="font-medium text-muted-foreground">(optional)</span>
          </Label>
          <Textarea id="gv-notes" name="notes" rows={2} maxLength={500} autoFocus placeholder="e.g. Bought by Sarah for her mum" />
        </div>
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
          <Plus className="size-4" aria-hidden="true" />
          Add a note
        </button>
      )}
      <FormError state={state} />
      {/* Kept in view at the bottom of the dialog, however short the screen. */}
      <div className="sticky -bottom-4 -mx-4 -mb-4 border-t border-border bg-popover px-4 pt-3 pb-4">
        <Button type="submit" size="lg" pending={pending} disabled={cents === null || cents < 100 || !code.trim()} className="w-full">
          <Gift aria-hidden="true" />
          {pending ? "Creating…" : cents && cents >= 100 ? `Create ${formatMoney(cents)} voucher` : "Create voucher"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Shown after creating a voucher, until Done: the code in large type so staff can copy it onto
 * the card (a toast would fade before they'd finished), and a reminder to take payment.
 */
function VoucherCreated({ voucher: v, onDone, onOpen }: { voucher: CreatedVoucher; onDone: () => void; onOpen?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v.code);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not a secure page): the code is on screen to copy by hand.
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="flex flex-col items-center gap-2.5 rounded-xl bg-success-soft px-4 py-5 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-success text-background">
          <Check className="size-5.5" aria-hidden="true" />
        </span>
        <span className="text-[13px] font-bold tracking-[0.08em] text-success uppercase">Voucher created · write this code on the card</span>
        <span className="font-mono text-[34px] leading-tight font-extrabold tracking-[0.12em] break-all">{v.code}</span>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Amount</dt>
        <dd className="font-bold">{formatMoney(v.amountCents)} · take payment at the till</dd>
        {v.customerName && (
          <>
            <dt className="text-muted-foreground">For</dt>
            <dd className="font-bold">{v.customerName}</dd>
          </>
        )}
        {v.expiresOn && (
          <>
            <dt className="text-muted-foreground">Expires</dt>
            <dd className="font-bold">{dateLabel(v.expiresOn)}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        {onOpen && (
          <Button type="button" variant="outline" size="lg" onClick={onOpen}>
            Open voucher
          </Button>
        )}
        <Button type="button" size="lg" onClick={onDone} autoFocus>
          Done
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Use (front desk)
// ---------------------------------------------------------------------------

/**
 * Type the code, check the balance, then spend part of it on today's service. Pass `code` to
 * start from a known voucher (its own page) and `customerId` on a customer's page. `compact`
 * stacks the fields for a narrow column. `vouchers` lists the customer's own, each with a Use
 * button that fills in its code: admin only, since on the shared kiosk the code itself is what
 * proves the person holds the voucher.
 */
export function UseGiftVoucher({
  code: fixedCode,
  customerId,
  compact = false,
  onDone,
  defaultPhone = "",
  vouchers = [],
  phoneKnown = false,
}: {
  code?: string;
  customerId?: string;
  compact?: boolean;
  /** Called after a successful spend, e.g. to close the dialog. */
  onDone?: () => void;
  /** Who is using it, e.g. the number typed on the kiosk. */
  defaultPhone?: string;
  vouchers?: { id: string; code: string; amountCents: number; balanceCents: number; status: GiftVoucherStatus }[];
  /** Who is using it is already shown (the kiosk's "For …" chip), so the phone field isn't repeated. */
  phoneKnown?: boolean;
}) {
  const [code, setCode] = useState(fixedCode ?? "");
  const [check, setCheck] = useState<GiftVoucherCheck | null>(null);
  const [amount, setAmount] = useState("");
  // After "Use the full balance": what's still owed for the service, taken at the till.
  const [tillCents, setTillCents] = useState(0);
  const [checking, startCheck] = useTransition();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await spendGiftVoucher(prev, fd);
    if (result?.ok) {
      setAmount("");
      setTillCents(0);
      setCheck(null);
      if (!fixedCode) setCode("");
      onDone?.();
    }
    return result;
  }, null);
  useActionToast(state);

  const runCheck = (value = code) => {
    if (!value.trim()) return;
    startCheck(async () => setCheck(await checkGiftVoucherCode(value)));
  };
  const pick = (value: string) => {
    setCode(value);
    setAmount("");
    setTillCents(0);
    runCheck(value);
  };
  // A known voucher (its own page) is checked straight away.
  useEffect(() => {
    if (fixedCode) runCheck(fixedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the form opens
  }, []);
  const cents = parseDollars(amount);
  const balance = check?.ok ? check.balanceCents : 0;
  // More than is left can't be used; staff enter what's left and take the rest at the till.
  const over = cents !== null && cents > balance;

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-3.5">
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      {vouchers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {vouchers.map((g) => (
            <li key={g.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-background py-2 pr-2 pl-3.5">
              <Link href={`/admin/gift-vouchers/${g.id}`} className="flex min-w-0 flex-col gap-0.5 hover:underline">
                <span className="font-mono text-sm font-bold tracking-wider">{g.code}</span>
                <span className="text-[13px] text-muted-foreground">
                  {g.status === "active" ? `${formatMoney(g.balanceCents)} left of ${formatMoney(g.amountCents)}` : `of ${formatMoney(g.amountCents)}`}
                </span>
              </Link>
              {g.status === "active" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => pick(g.code)} aria-label={`Use ${g.code}`}>
                  Use
                </Button>
              ) : (
                <GiftVoucherStatusPill status={g.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      {fixedCode ? (
        <input type="hidden" name="code" value={fixedCode} />
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", !compact && "sm:grid-cols-[1fr_auto] sm:items-end")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`gift-code${customerId ?? ""}`}>{vouchers.length > 0 && !vouchers.some((g) => g.code === code) ? "Another voucher? Type its code" : "Gift voucher code"}</Label>
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
          <Button type="button" variant="outline" onClick={() => runCheck()} pending={checking} disabled={!code.trim()}>
            {checking ? "Checking…" : "Check balance"}
          </Button>
        </div>
      )}
      {fixedCode && !check && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {checking ? "Checking the balance…" : null}
        </p>
      )}

      {check && !check.ok && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-semibold text-destructive">
          <CircleX className="size-4.5 flex-none" aria-hidden="true" />
          {check.message}
        </p>
      )}

      {check?.ok && (
        <div className="flex flex-col gap-3.5 rounded-xl border-2 border-primary/45 bg-background px-4 py-3.5">
          {/* A brand card (ivory in the admin, espresso on the kiosk) with a gold edge: green stays
              a small status mark, not a panel colour. */}
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
                  {...numberInput("money")}
                  maxLength={7}
                  autoComplete="off"
                  autoFocus
                  placeholder="35"
                  value={amount}
                  onChange={(e) => {
                    setAmount(cleanNumber("money", e.target.value));
                    setTillCents(0);
                  }}
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
          {!customerId && phoneKnown && <input type="hidden" name="phone" value={defaultPhone} />}
          {!customerId && !phoneKnown && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`spend-phone${check.id}`}>
                Customer phone <span className="font-medium text-muted-foreground">(optional, who is using it today)</span>
              </Label>
              <Input id={`spend-phone${check.id}`} name="phone" type="tel" {...numberInput("phone")} placeholder="0412 345 678" defaultValue={defaultPhone} className="bg-card" />
            </div>
          )}
          {/* The usual split payment: the voucher covers what's left, the till takes the rest. */}
          <input type="hidden" name="till" value={tillCents > 0 ? (tillCents / 100).toFixed(2) : ""} />
          {/* One message slot beside the button, the same height whatever it says (a hint, what's
              left, the over-balance warning, or what to take at the till), so typing an amount never
              moves anything. Narrow columns (a customer's page) stack it above a full-width button. */}
          <div className={cn("flex gap-3", compact ? "flex-col" : "flex-col sm:flex-row sm:items-center")}>
            <div
              id={`spend-summary${check.id}`}
              aria-live="polite"
              className={cn("flex min-w-0 flex-1 items-center text-sm leading-5 font-semibold", compact ? "min-h-15" : "min-h-11")}
            >
              {cents !== null && cents > 0 ? (
                over ? (
                  <p role="alert" className="text-warning">
                    <TriangleAlert className="mr-1.5 inline size-4 -translate-y-px align-middle" aria-hidden="true" />
                    Only {formatMoney(balance)} left.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setTillCents(cents - balance);
                        setAmount((balance / 100).toFixed(2));
                      }}
                      className="font-bold text-primary underline underline-offset-2 hover:no-underline"
                    >
                      Use all {formatMoney(balance)}
                    </button>
                  </p>
                ) : tillCents > 0 ? (
                  <p>Uses all of it. Take {formatMoney(tillCents)} at the till.</p>
                ) : (
                  <p>Leaves {formatMoney(balance - cents)} on the voucher.</p>
                )
              ) : (
                // The voucher pays like cash, so a discount comes off first.
                <p className="font-normal text-muted-foreground">Using a discount today? Enter the price after the discount.</p>
              )}
            </div>
            <Button type="submit" pending={pending} disabled={cents === null || cents <= 0 || over} className={cn("flex-none", compact ? "w-full" : "sm:min-w-40")}>
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

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  return (
    <form {...formSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-owner-phone">Customer phone</Label>
        <Input id="gv-owner-phone" name="phone" type="tel" {...numberInput("phone")} defaultValue={phone ? formatPhone(phone) : ""} placeholder="Not linked" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-owner-notes">Notes</Label>
        <Textarea id="gv-owner-notes" name="notes" rows={2} maxLength={500} defaultValue={notes ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-expiry">Expires</Label>
        {isAdmin ? (
          <>
            <Input id="gv-expiry" name="expires_on" type="date" min={minExpiry} defaultValue={expiresOn} aria-describedby="gv-expiry-hint" />
            <p id="gv-expiry-hint" className="text-[13px] text-muted-foreground">
              At least 3 years after it was created (Australian Consumer Law): {dateLabel(minExpiry)} or later.
            </p>
          </>
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

  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-3.5">
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
        <Input name="amount" aria-label="Amount in dollars" {...numberInput("money")} maxLength={7} autoComplete="off" value={amount} onChange={(e) => setAmount(cleanNumber("money", e.target.value))} className="pl-7 tabular-nums" />
      </div>
      <Textarea name="note" rows={2} maxLength={200} required aria-label="Reason" placeholder="Reason, saved to the history" />
      <FormError state={state} />
      <Button type="submit" pending={pending} disabled={cents <= 0 || preview < 0} className="self-end">
        {cents > 0 ? `Save · new balance ${formatMoney(preview)}` : "Save"}
      </Button>
    </form>
  );
}
