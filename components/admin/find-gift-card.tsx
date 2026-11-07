"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Ban, CircleX, Plus, Search, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/admin/form-dialog";
import { GiftCardStatusPill } from "@/components/admin/gift-card-status";
import { SellGiftCardForm, TopUpForm, UseGiftCard } from "@/components/admin/gift-card-forms";
import { findGiftCard, type FindResult } from "@/app/admin/gift-card-actions";
import { formatMoney } from "@/lib/gift-cards";

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The front desk's one way in: Find gift card, in a dialog (the Gift cards page and the dashboard). */
export function FindGiftCardButton({ variant = "outline" }: { variant?: "default" | "outline" }) {
  return (
    <FormDialog
      variant={variant}
      title="Find a gift card"
      description="Type the code on the gift card. You'll see its balance and what you can do with it."
      trigger={
        <>
          <Search aria-hidden="true" />
          Find gift card
        </>
      }
    >
      {(close) => <FindGiftCard onDone={close} />}
    </FormDialog>
  );
}

type Mode = "found" | "use" | "top_up" | "create";

/**
 * Type a code, see the gift card, then only the actions that fit it, as on a Square or Toast till:
 * a blank card that isn't sold yet → Create; active → Use or Top up; used up → Top up; expired or
 * blocked → why not. A code that doesn't exist (and isn't a typo) can be created, for a number
 * printed elsewhere. `onKiosk` leaves out the link to the gift card's admin page, and `defaultPhone`
 * / `phoneKnown` pass the customer typed on the kiosk on to the forms.
 */
export function FindGiftCard({
  onDone,
  onKiosk = false,
  defaultPhone = "",
  phoneKnown = false,
}: {
  onDone: () => void;
  onKiosk?: boolean;
  defaultPhone?: string;
  phoneKnown?: boolean;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<FindResult | null>(null);
  const [mode, setMode] = useState<Mode>("found");
  const [finding, startFind] = useTransition();

  const find = () => {
    if (!code.trim()) return;
    startFind(async () => {
      setMode("found");
      setResult(await findGiftCard(code));
    });
  };
  const back = (
    <button type="button" onClick={() => setMode("found")} className="flex w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to {result?.ok ? result.giftCard.code : code}
    </button>
  );

  // The chosen action, for the gift card found (or a new code).
  if (mode !== "found") {
    const found = result?.ok ? result.giftCard.code : code.trim().toUpperCase();
    return (
      <div className="flex flex-col gap-4">
        {back}
        {mode === "use" && (
          <UseGiftCard
            code={found}
            // Its balance was just looked up, so the form opens complete rather than checking again.
            initialCheck={
              result?.ok && result.giftCard.expiresOn && result.giftCard.loadedCents !== null
                ? {
                    ok: true,
                    id: result.giftCard.id,
                    code: result.giftCard.code,
                    balanceCents: result.giftCard.balanceCents,
                    amountCents: result.giftCard.loadedCents,
                    expiresOn: result.giftCard.expiresOn,
                    customerName: result.giftCard.customerName,
                  }
                : undefined
            }
            onDone={onDone}
            defaultPhone={defaultPhone}
            phoneKnown={phoneKnown}
          />
        )}
        {mode === "top_up" && <TopUpForm code={found} onDone={onDone} />}
        {mode === "create" && (
          <SellGiftCardForm
            onDone={onDone}
            defaultCode={found}
            // A blank card is activated with its printed code; a new code is created.
            activate={result?.ok === true && result.giftCard.status === "inactive"}
            openAfterSale={!onKiosk}
            defaultPhone={defaultPhone}
            phoneKnown={phoneKnown}
          />
        )}
      </div>
    );
  }

  const v = result?.ok ? result.giftCard : null;
  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="grid grid-cols-[1fr_auto] items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="find-code">Gift card code</Label>
          <Input
            id="find-code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            placeholder="Code on the gift card"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
            }}
            className="font-mono text-base tracking-wider uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
          />
        </div>
        <Button type="submit" variant="outline" pending={finding} disabled={!code.trim()}>
          {!finding && <Search aria-hidden="true" />}
          Find
        </Button>
      </form>

      {result && !result.ok && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-destructive/10 px-3.5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <CircleX className="size-4.5 flex-none" aria-hidden="true" />
            {result.message}
          </p>
          {result.canCreate && (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setMode("create")}>
              <Plus aria-hidden="true" />
              Create a gift card with this code
            </Button>
          )}
        </div>
      )}

      {v && (
        <section aria-label={`Gift card ${v.code}`} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-lg font-extrabold tracking-wider">{v.code}</span>
            <GiftCardStatusPill status={v.status} />
          </div>

          {v.status === "inactive" ? (
            <p className="text-sm text-muted-foreground">A blank card that hasn&apos;t been sold yet, so it has no balance. Activate it with the amount the customer pays.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[36px] leading-none font-extrabold tabular-nums">{formatMoney(v.balanceCents)}</span>
              <span className="text-sm text-muted-foreground">
                left{v.loadedCents !== null && ` of ${formatMoney(v.loadedCents)} loaded`}
                {v.expiresOn && ` · ${v.status === "expired" ? "expired" : "valid until"} ${dateLabel(v.expiresOn)}`}
                {v.customerName && ` · ${v.customerName}`}
              </span>
            </div>
          )}

          {v.status === "blocked" && (
            <p className="flex items-start gap-2 text-sm">
              <Ban className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              <span>
                Blocked{v.blockedReason && `: ${v.blockedReason}`}. It can&apos;t be used or topped up until an admin unblocks it on its page.
              </span>
            </p>
          )}
          {v.status === "expired" && <p className="text-sm">It has expired, so it can&apos;t be used or topped up.</p>}

          <div className="grid grid-cols-2 gap-2">
            {v.status === "inactive" && (
              <Button type="button" size="lg" className="col-span-2" onClick={() => setMode("create")}>
                <Plus aria-hidden="true" />
                Activate gift card
              </Button>
            )}
            {v.status === "active" && (
              <>
                <Button type="button" size="lg" onClick={() => setMode("use")}>
                  <WalletCards aria-hidden="true" />
                  Use
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setMode("top_up")}>
                  <Plus aria-hidden="true" />
                  Top up
                </Button>
              </>
            )}
            {v.status === "used_up" && (
              <Button type="button" size="lg" className="col-span-2" onClick={() => setMode("top_up")}>
                <Plus aria-hidden="true" />
                Top up
              </Button>
            )}
          </div>

          {!onKiosk && (
            <Link href={`/admin/gift-cards/${v.id}`} onClick={onDone} className="flex w-fit items-center gap-1 text-sm font-bold text-primary hover:underline">
              Open its page: history, print, details
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
