"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, CircleCheck, CircleX, Copy, Gift, Plus, RefreshCw, TriangleAlert, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/admin/form-dialog";
import { useActionToast } from "@/components/admin/action-button";
import {
  adjustGiftCard,
  checkGiftCardCode,
  generateGiftCardCode,
  sellGiftCard,
  spendGiftCard,
  updateGiftCard,
  topUpGiftCard,
  blockGiftCard,
  type TopUpState,
  type CreatedGiftCard,
  type GiftCardCheck,
  type SellState,
} from "@/app/admin/gift-card-actions";
import type { ActionState } from "@/app/admin/actions";
import { formatMoney, GIFT_CARD_PRESETS, parseDollars } from "@/lib/gift-cards";
import { formatPhoneInput } from "@/lib/phone-mask";
import { cn } from "@/lib/utils";
import { GiftCardStatusPill } from "@/components/admin/gift-card-status";
import type { GiftCardStatus } from "@/lib/gift-cards";
import { toast } from "sonner";
import { useFormSubmit } from "@/lib/use-form-submit";
import { cleanNumber, numberInput } from "@/lib/number-input";
import { AddRemoveToggle, type Direction } from "@/components/admin/add-remove-toggle";
import { GiftCardFormatPicker, PrintGiftCardButton, PrintedGiftCard } from "@/components/admin/printed-gift-card";

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

/** `code`: activate a blank card printed ahead of time (from its own page), with its code fixed. */
export function SellGiftCardButton({ variant, code, className }: { variant?: "default" | "outline"; code?: string; className?: string }) {
  return (
    <FormDialog
      variant={variant}
      className={className}
      title={code ? `Activate ${code}` : "Create a gift card"}
      description="Take payment at the till as usual. The gift card is valid for 3 years."
      trigger={
        <>
          {code ? <Gift aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {code ? "Activate gift card" : "Create gift card"}
        </>
      }
    >
      {(close) => <SellGiftCardForm onDone={close} defaultCode={code} activate={Boolean(code)} confirmAsToast={Boolean(code)} />}
    </FormDialog>
  );
}

/**
 * The gift card page's main action: opens the use form for that gift card. The page already has
 * its balance, so the dialog opens complete instead of growing (and re-centring) after a check.
 */
export function UseThisGiftCardButton({ giftCard }: { giftCard: Extract<GiftCardCheck, { ok: true }> }) {
  return (
    <FormDialog title={`Use ${giftCard.code}`} description="Take today's service off this gift card." size="lg" trigger={<><WalletCards aria-hidden="true" />Use</>}>
      {(close) => <UseGiftCard code={giftCard.code} initialCheck={giftCard} onDone={close} />}
    </FormDialog>
  );
}

/**
 * The amount for a new gift card or added value: the presets and "Other" are one row of choices, so
 * a typed amount reads as the custom one (a separate full-width box would repeat the selected
 * preset). It posts `amount` in dollars.
 */
function AmountPicker({ amount, onChange, legend = "Amount" }: { amount: string; onChange: (amount: string) => void; legend?: string }) {
  const cents = parseDollars(amount);
  // Anything other than a preset (including an empty box being typed into) is the "Other" amount.
  const isOther = !GIFT_CARD_PRESETS.some((p) => p === cents) && amount !== "";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <input type="hidden" name="amount" value={amount} />
      <div className="grid grid-cols-4 gap-2">
        {GIFT_CARD_PRESETS.map((p) => (
          <button key={p} type="button" aria-pressed={cents === p} onClick={() => onChange(String(p / 100))} className={segment(cents === p)}>
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
            onChange={(e) => onChange(cleanNumber("money", e.target.value))}
            className="w-full min-w-0 bg-transparent tabular-nums outline-none placeholder:font-semibold placeholder:text-muted-foreground"
          />
        </label>
      </div>
      {isOther && cents !== null && cents < 100 && <p className="text-[13px] font-semibold text-destructive">At least $1.</p>}
    </fieldset>
  );
}

export function SellGiftCardForm({
  onDone,
  openAfterSale = true,
  defaultPhone = "",
  phoneKnown = false,
  defaultCode = "",
  activate = false,
  confirmAsToast = false,
}: {
  onDone: () => void;
  /**
   * Created from the blank card's own page: that page turns into the active gift card as this
   * returns, closing the dialog, so the confirmation is a toast instead of the Created screen.
   */
  confirmAsToast?: boolean;
  /** A printed gift card's code, when selling it from its own page. */
  defaultCode?: string;
  /**
   * Activating a blank card (a Not sold gift card): its code is already printed, so it's shown but
   * can't be changed, and the button says Activate rather than Create.
   */
  activate?: boolean;
  openAfterSale?: boolean;
  /** The customer it's for, e.g. the number typed on the kiosk; staff can change or clear it. */
  defaultPhone?: string;
  /** The customer is already shown (the kiosk's "For …" chip), so the phone field isn't repeated. */
  phoneKnown?: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("100");
  const [code, setCode] = useState(defaultCode);
  const [codeError, setCodeError] = useState<string | null>(null);
  // Notes are rare, so they open on demand and the form fits an iPad screen without scrolling.
  const [showNotes, setShowNotes] = useState(false);
  const [generating, startGenerate] = useTransition();
  const generate = () =>
    startGenerate(async () => {
      const result = await generateGiftCardCode();
      if (result.ok) {
        setCode(result.code);
        setCodeError(null);
      } else setCodeError(result.message);
    });
  // Errors show in the form; success swaps it for the "Gift card created" screen below.
  const [state, formAction, pending] = useActionState(async (prev: SellState, fd: FormData) => {
    const result = await sellGiftCard(prev, fd);
    if (confirmAsToast && result?.ok) toast.success(result.message);
    return result;
  }, null);
  const cents = parseDollars(amount);

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  if (state?.ok && state.giftCard && !confirmAsToast) {
    return (
      <GiftCardCreated
        giftCard={state.giftCard}
        onDone={onDone}
        // In the admin, staff can go to the new gift card; on the kiosk they stay on the check-in screen.
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
      {/* What the printed gift card will look like, as the code is chosen. */}
      <PrintedGiftCard code={code.trim()} expiresOn={null} token={null} className="mx-auto max-w-[300px]" />
      <AmountPicker amount={amount} onChange={setAmount} />
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
            readOnly={activate}
            placeholder={generating ? "Generating…" : "Number on the card"}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={cn(
              "font-mono text-base tracking-wider uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case",
              activate && "bg-muted text-muted-foreground focus-visible:ring-0",
            )}
          />
          {!activate && (
            <Button type="button" variant="outline" onClick={generate} disabled={generating}>
              <RefreshCw className={cn(generating && "animate-spin")} aria-hidden="true" />
              Generate
            </Button>
          )}
        </div>
        <p className={cn("text-[13px]", codeError ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {codeError ??
            (activate ? "The code printed on this blank card. It stays the same." : "Type the number printed on the gift card, or press Generate.")}
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
          {pending
            ? activate
              ? "Activating…"
              : "Creating…"
            : `${activate ? "Activate" : "Create"} ${cents && cents >= 100 ? `${formatMoney(cents)} gift card` : "gift card"}`}
        </Button>
      </div>
    </form>
  );
}

/**
 * Shown after creating a gift card, until Done: the printed card with its code and QR, to print
 * (or copy the code onto a card by hand; a toast would fade before they'd finished), and a
 * reminder to take payment.
 */
function GiftCardCreated({ giftCard: v, onDone, onOpen }: { giftCard: CreatedGiftCard; onDone: () => void; onOpen?: () => void }) {
  const [copied, setCopied] = useState(false);
  const card = useRef<HTMLDivElement>(null);
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
      <p role="status" className="flex items-center gap-2 text-sm font-bold text-success">
        <span className="flex size-6 items-center justify-center rounded-full bg-success text-background">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        {v.preprinted ? `Gift card ${v.code} activated · hand over the printed card` : `Gift card ${v.code} created · print it, or write the code on a card`}
      </p>
      <PrintedGiftCard ref={card} code={v.code} expiresOn={v.expiresOn || null} token={v.publicToken} className="mx-auto max-w-md" />
      <GiftCardFormatPicker />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy code"}
        </Button>
        <PrintGiftCardButton card={card} />
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
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        {onOpen && (
          <Button type="button" variant="outline" size="lg" onClick={onOpen}>
            Open gift card
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
 * start from a known gift card (its own page) and `customerId` on a customer's page. `compact`
 * stacks the fields for a narrow column. `gift cards` lists the customer's own, each with a Use
 * button that fills in its code: admin only, since on the shared kiosk the code itself is what
 * proves the person holds the gift card.
 */
export function UseGiftCard({
  code: fixedCode,
  customerId,
  compact = false,
  onDone,
  defaultPhone = "",
  giftCards = [],
  phoneKnown = false,
  initialCheck,
}: {
  /** The balance already known (the gift card's own page), so it isn't checked again on open. */
  initialCheck?: GiftCardCheck;
  code?: string;
  customerId?: string;
  compact?: boolean;
  /** Called after a successful spend, e.g. to close the dialog. */
  onDone?: () => void;
  /** Who is using it, e.g. the number typed on the kiosk. */
  defaultPhone?: string;
  giftCards?: { id: string; code: string; amountCents: number; balanceCents: number; status: GiftCardStatus }[];
  /** Who is using it is already shown (the kiosk's "For …" chip), so the phone field isn't repeated. */
  phoneKnown?: boolean;
}) {
  const [code, setCode] = useState(fixedCode ?? "");
  const [check, setCheck] = useState<GiftCardCheck | null>(initialCheck ?? null);
  const [amount, setAmount] = useState("");
  // After "Use the full balance": what's still owed for the service, taken at the till.
  const [tillCents, setTillCents] = useState(0);
  const [checking, startCheck] = useTransition();

  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await spendGiftCard(prev, fd);
    if (result?.ok) {
      setAmount("");
      setTillCents(0);
      setCheck(null);
      if (!fixedCode) setCode("");
    }
    return result;
  }, null);
  useActionToast(state, { onSuccess: onDone });

  const runCheck = (value = code) => {
    if (!value.trim()) return;
    startCheck(async () => setCheck(await checkGiftCardCode(value)));
  };
  const pick = (value: string) => {
    setCode(value);
    setAmount("");
    setTillCents(0);
    runCheck(value);
  };
  // A known gift card is checked straight away, unless its balance came with it.
  useEffect(() => {
    if (fixedCode && !initialCheck) runCheck(fixedCode);
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
      {giftCards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {giftCards.map((g) => (
            <li key={g.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-background py-2 pr-2 pl-3.5">
              <Link href={`/admin/gift-cards/${g.id}`} className="flex min-w-0 flex-col gap-0.5 hover:underline">
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
                <GiftCardStatusPill status={g.status} />
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
            <Label htmlFor={`gift-code${customerId ?? ""}`}>{giftCards.length > 0 && !giftCards.some((g) => g.code === code) ? "Another gift card? Type its code" : "Gift card code"}</Label>
            <Input
              id={`gift-code${customerId ?? ""}`}
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Code on the gift card"
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
          {/* The usual split payment: the gift card covers what's left, the till takes the rest. */}
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
                  <p>Leaves {formatMoney(balance - cents)} on the gift card.</p>
                )
              ) : (
                // The gift card pays like cash, so a discount comes off first.
                <p className="font-normal text-muted-foreground">Using a discount today? Enter the price after the discount.</p>
              )}
            </div>
            <Button type="submit" pending={pending} disabled={cents === null || cents <= 0 || over} className={cn("flex-none", compact ? "w-full" : "sm:min-w-40")}>
              <Gift aria-hidden="true" />
              {pending ? "Saving…" : cents && cents > 0 && !over ? `Use ${formatMoney(cents)}` : "Use gift card"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Managing a gift card (its own page)
// ---------------------------------------------------------------------------

export function GiftCardSettingsForm({
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
  const [state, formAction, pending] = useActionState(updateGiftCard.bind(null, id), null);
  useActionToast(state);

  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  return (
    <form {...formSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="gv-owner-phone">
          Customer phone <span className="font-medium text-muted-foreground">(optional)</span>
        </Label>
        <Input id="gv-owner-phone" name="phone" type="tel" {...numberInput("phone")} defaultValue={phone ? formatPhoneInput(phone) : ""} placeholder="0412 345 678" />
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
              At least 3 years after it was created or activated (Australian Consumer Law): {dateLabel(minExpiry)} or later.
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

export function AdjustGiftCardForm({ id, balanceCents }: { id: string; balanceCents: number }) {
  const [direction, setDirection] = useState<Direction>("add");
  const [amount, setAmount] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await adjustGiftCard(id, prev, fd);
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
      <AddRemoveToggle value={direction} onChange={setDirection} label="Put back or take off credit" labels={{ add: "Put back", remove: "Take off" }} />
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

// ---------------------------------------------------------------------------
// Top up (a customer puts more money on their gift card) and block (lost or stolen)
// ---------------------------------------------------------------------------

/** Top up from a gift card's page (`code`), or from the front desk with the code typed in. */
export function TopUpButton({
  code,
  variant = "outline",
  size,
  className,
}: {
  code?: string;
  variant?: "default" | "outline";
  /** "lg" beside Use on the gift card's page, so the two line up. */
  size?: "lg";
  className?: string;
}) {
  return (
    <FormDialog
      variant={variant}
      size={size}
      className={className}
      title={code ? `Top up ${code}` : "Top up a gift card"}
      description="Put more money on a gift card the customer already has. Take payment at the till as usual."
      trigger={
        <>
          <Plus aria-hidden="true" />
          Top up
        </>
      }
    >
      {(close) => <TopUpForm code={code} onDone={close} />}
    </FormDialog>
  );
}

/**
 * The amount to add, then the new balance, which stays up until Done so staff can tell the
 * customer. The new money gets the legal 3 years too, so the expiry may move out.
 */
export function TopUpForm({ code: fixedCode, onDone }: { code?: string; onDone: () => void }) {
  const [code, setCode] = useState(fixedCode ?? "");
  const [amount, setAmount] = useState("50");
  const [state, formAction, pending] = useActionState(async (prev: TopUpState, fd: FormData) => topUpGiftCard(prev, fd), null);
  const formSubmit = useFormSubmit(state, formAction, { resetOnSuccess: false });
  const cents = parseDollars(amount);

  if (state?.ok && state.topUp) {
    const t = state.topUp;
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex flex-col items-center gap-2 rounded-xl bg-success-soft px-4 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-success text-background">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-bold text-success">
            Topped up {t.code} with {formatMoney(t.addedCents)} · take payment at the till
          </span>
          <span className="text-[34px] leading-tight font-extrabold tabular-nums">{formatMoney(t.balanceCents)}</span>
          <span className="text-sm text-muted-foreground">New balance · valid until {dateLabel(t.expiresOn)}</span>
        </div>
        <Button type="button" size="lg" onClick={onDone} autoFocus className="self-end">
          Done
        </Button>
      </div>
    );
  }
  return (
    <form {...formSubmit} className="flex flex-col gap-4">
      {fixedCode ? (
        <input type="hidden" name="code" value={fixedCode} />
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="av-code">Gift card code</Label>
          <Input
            id="av-code"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono text-base tracking-wider uppercase"
          />
        </div>
      )}
      <AmountPicker amount={amount} onChange={setAmount} legend="Top-up amount" />
      <FormError state={state} />
      <Button type="submit" size="lg" pending={pending} disabled={cents === null || cents < 100 || !code.trim()} className="w-full">
        <Plus aria-hidden="true" />
        {pending ? "Topping up…" : cents && cents >= 100 ? `Top up ${formatMoney(cents)}` : "Top up"}
      </Button>
    </form>
  );
}

/** Block a lost or stolen gift card (admin), with the reason. Its balance is kept. `onDone` closes a dialog. */
export function BlockGiftCardForm({ id, onDone }: { id: string; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(blockGiftCard.bind(null, id), null);
  useActionToast(state, { errors: false, onSuccess: onDone });
  const formSubmit = useFormSubmit(state, formAction);
  return (
    <form {...formSubmit} className="flex flex-col gap-3">
      <Input name="reason" required maxLength={200} aria-label="Reason" placeholder="Reason, e.g. lost by the customer" />
      <FormError state={state} />
      <Button type="submit" variant="danger" pending={pending} className="self-end">
        <Ban aria-hidden="true" />
        Block gift card
      </Button>
    </form>
  );
}
