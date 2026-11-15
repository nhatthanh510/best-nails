"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SellGiftCardButton } from "@/components/admin/gift-card-forms";
import { DownloadGiftCardPdfButton, GiftCardFormatPicker, printGiftCardNodes, PrintedGiftCard, printedGiftCardsIn } from "@/components/admin/printed-gift-card";
import { useGiftCardFormat } from "@/lib/gift-card-format";
import { createInactiveGiftCards, previewGiftCardCodes, type BlankGiftCard } from "@/app/admin/gift-card-actions";
import { downloadGiftCardPdf } from "@/lib/gift-card-pdf";
import { cn } from "@/lib/utils";

const COUNTS = [10, 20, 50];
/** What one run can hold (`preview_gift_card_codes` and `create_inactive_gift_cards` check it too). */
const MAX_COUNT = 100;

const segment = (active: boolean) =>
  cn(
    "min-h-11 rounded-[10px] border text-sm font-bold tabular-nums",
    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
  );

/**
 * Blank cards: gift cards printed in advance, with a code and QR but no amount, as with
 * Square's physical gift cards. They're saved as Not sold gift cards (the list's Not sold filter, so
 * each one can be tracked) and activated when sold: Activate gift card with the amount (the code
 * is the card's). It's under the header's Create gift card ▾, and in the list's Not sold tab.
 */
export function PrintBlankCardsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
        <Printer aria-hidden="true" />
        Print blank cards
      </Button>
      <BlankCardsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The Gift cards header's main button: Create gift card, with a ▾ beside it for the related,
 * occasional job of printing blank cards, the usual split-button pattern. One button's room at every
 * screen size, and nothing that reads as "print this gift card".
 */
export function CreateGiftCardSplitButton() {
  const [open, setOpen] = useState(false);
  return (
    // On phones PageHeader stretches its children and hides their icons; the group keeps no padding
    // of its own and its ▾ stays visible.
    <div className="flex max-sm:px-0!">
      <SellGiftCardButton className="rounded-r-none max-sm:flex-1" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" aria-label="More ways to create gift cards" className="w-11 flex-none rounded-l-none border-l border-l-primary-foreground/25 px-0">
            <ChevronDown className="size-4 max-sm:block!" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Printer aria-hidden="true" />
            Print blank cards…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BlankCardsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function BlankCardsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Print blank cards</DialogTitle>
          <DialogDescription>
            Gift cards printed in advance, with a code and QR but no amount. They stay Not sold until a customer buys one: then find the
            card&apos;s code and activate it with the amount.
          </DialogDescription>
        </DialogHeader>
        {open && <BlankCards onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function BlankCards({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState<BlankGiftCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saving, startSave] = useTransition();
  // Print once the saved cards are drawn (off screen, below); `n` asks again for each Print click.
  // Saving only saves: the next step offers Print and Download PDF.
  const [printRequest, setPrintRequest] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const [format] = useGiftCardFormat();

  const preview = (n: number) =>
    startPreview(async () => {
      const result = await previewGiftCardCodes(n);
      if (!result.ok) return setError(result.message);
      setError(null);
      setCodes(result.codes);
    });

  // The first preview, for the default count.
  useEffect(() => preview(10), []);

  // "Other": what's typed in its box, kept apart from `count` so "5" on the way to "50" doesn't
  // jump to the 50 preset. Its codes are fetched once typing pauses, not on every key.
  const [other, setOther] = useState<string | null>(null);
  const otherTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(otherTimer.current), []);
  const typeOther = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    setOther(digits);
    clearTimeout(otherTimer.current);
    const n = Number(digits);
    if (!digits || n < 1 || n > MAX_COUNT) return;
    setCount(n);
    otherTimer.current = setTimeout(() => preview(n), 400);
  };
  const otherCount = other === null || other === "" ? null : Number(other);
  const otherInvalid = otherCount !== null && (otherCount < 1 || otherCount > MAX_COUNT);

  const cards = () => (sheet.current ? printedGiftCardsIn(sheet.current) : []);
  const download = async () => {
    const list = cards();
    await downloadGiftCardPdf(list, format, `blank-cards-${list.length}-${format}.pdf`);
  };

  useEffect(() => {
    if (printRequest && sheet.current) printGiftCardNodes([...sheet.current.children], format);
    // Only a new Print click prints, not a change of size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printRequest]);

  // One step: save them as Not sold, then choose Print or Download PDF on the screen that follows.
  const save = () =>
    startSave(async () => {
      if (!codes) return;
      const result = await createInactiveGiftCards(codes);
      if (!result.ok) return setError(result.message);
      setError(null);
      setSaved(result.giftCards);
    });

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex flex-col items-center gap-2 rounded-xl bg-success-soft px-4 py-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-success text-background">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <span className="font-bold text-success">{saved.length} blank cards saved as Not sold</span>
          <span className="text-sm text-muted-foreground">
            {saved[0].code} to {saved.at(-1)!.code}. Each becomes Active when it&apos;s activated.
          </span>
        </div>
        {/* The size was picked on the form; Print and the PDF use it. */}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setPrintRequest((n) => n + 1)}>
            <Printer aria-hidden="true" />
            Print
          </Button>
          <DownloadGiftCardPdfButton download={download} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/gift-cards?filter=inactive" onClick={onDone} className="text-sm font-bold text-primary hover:underline">
            See them in the list
          </Link>
          <Button type="button" size="lg" onClick={onDone} autoFocus>
            Done
          </Button>
        </div>
        {/* The cards to print or capture: drawn off screen (a PDF needs them laid out), one per row. */}
        <div ref={sheet} aria-hidden="true" className="fixed top-0 -left-[10000px] flex w-[640px] flex-col gap-4">
          {saved.map((v) => (
            <PrintedGiftCard key={v.code} code={v.code} expiresOn={null} token={v.token} format={format} />
          ))}
        </div>
      </div>
    );
  }

  return (
    // Like the create form: from a wide dialog (`data-wide-form`) the preview sits beside the
    // choices and codes, so it fits without scrolling; narrower, it's one column.
    <div data-wide-form className="@container flex flex-col gap-4">
      <div className="grid gap-4 @2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @2xl:gap-7">
        {/* The card as it will be printed, in the size picked here. */}
        <div className="flex flex-col gap-2.5 @2xl:sticky @2xl:top-0 @2xl:self-start">
          <PrintedGiftCard code={codes?.[0] ?? ""} expiresOn={null} token={null} className="mx-auto max-w-[280px] @2xl:max-w-none" />
          <GiftCardFormatPicker compact className="mx-auto w-full max-w-[280px] @2xl:max-w-none" />
          <p className="text-center text-[13px] text-muted-foreground">One card per page, with a 2 mm bleed for a print shop.</p>
        </div>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">How many?</legend>
            <div className="grid grid-cols-4 gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={other === null && count === n}
                  onClick={() => {
                    clearTimeout(otherTimer.current);
                    setOther(null);
                    setCount(n);
                    preview(n);
                  }}
                  className={segment(other === null && count === n)}
                >
                  {n}
                </button>
              ))}
              <input
                aria-label={`Other number of cards, 1 to ${MAX_COUNT}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={3}
                placeholder="Other"
                value={other ?? ""}
                onChange={(e) => typeOther(e.target.value)}
                aria-invalid={otherInvalid || undefined}
                className={cn(
                  "min-h-11 w-full min-w-0 rounded-[10px] border bg-card px-3 text-center text-sm font-bold tabular-nums outline-none placeholder:font-medium placeholder:text-placeholder focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
                  other !== null && !otherInvalid && other !== "" ? "border-primary ring-1 ring-primary" : "border-input",
                )}
              />
            </div>
            {otherInvalid && <p className="text-[13px] font-semibold text-destructive">Between 1 and {MAX_COUNT} at a time.</p>}
          </fieldset>
          <section aria-labelledby="bc-codes" aria-busy={previewing} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="bc-codes" className="text-sm font-semibold">
                Codes {codes && <span className="font-medium text-muted-foreground">({codes.length})</span>}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => preview(count)} disabled={previewing || saving}>
                <RefreshCw className={cn(previewing && "animate-spin")} aria-hidden="true" />
                New codes
              </Button>
            </div>
            <ol
              className={cn(
                "grid max-h-52 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-xl border border-border bg-background px-4 py-3 sm:grid-cols-3",
                previewing && "opacity-50",
              )}
            >
              {(codes ?? Array.from({ length: count }, () => "")).map((code, i) => (
                <li key={code || i} className="flex items-baseline gap-2 py-0.5">
                  <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="font-mono text-sm font-bold tracking-wider">{code || "··········"}</span>
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-muted-foreground">Nothing is saved until you press Save. Then print them or download a PDF.</p>
          </section>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="sticky -bottom-4 -mx-4 -mb-4 border-t border-border bg-popover px-4 pt-3 pb-4">
        <Button type="button" size="lg" pending={saving} disabled={!codes || codes.length !== count || previewing || saving || otherInvalid || other === ""} onClick={save} className="w-full">
          <Check aria-hidden="true" />
          {saving ? "Saving…" : otherInvalid || other === "" ? "Save blank cards" : `Save ${codes?.length ?? count} blank cards`}
        </Button>
      </div>
    </div>
  );
}
