"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SellGiftVoucherButton } from "@/components/admin/gift-voucher-forms";
import { printVoucherNodes, VoucherCard, voucherCardsIn } from "@/components/admin/voucher-card";
import { createInactiveGiftVouchers, previewGiftVoucherCodes, type PrintedVoucher } from "@/app/admin/gift-voucher-actions";
import { downloadVoucherPdf } from "@/lib/voucher-pdf";
import { cn } from "@/lib/utils";

const COUNTS = [10, 20, 50];

const segment = (active: boolean) =>
  cn(
    "min-h-11 rounded-[10px] border text-sm font-bold tabular-nums",
    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
  );

/**
 * Blank cards: gift vouchers printed in advance, with a code and QR but no amount, as with
 * Square's physical gift cards. They're saved as Not sold vouchers (the list's Not sold filter, so
 * each one can be tracked) and activated when sold: Create gift voucher with the card's code and
 * the amount. It's under the header's Create gift voucher ▾, and in the list's Not sold tab.
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
 * The Gift vouchers header's main button: Create gift voucher, with a ▾ beside it for the related,
 * occasional job of printing blank cards, the usual split-button pattern. One button's room at every
 * screen size, and nothing that reads as "print this voucher".
 */
export function CreateVoucherSplitButton() {
  const [open, setOpen] = useState(false);
  return (
    // On phones PageHeader stretches its children and hides their icons; the group keeps no padding
    // of its own and its ▾ stays visible.
    <div className="flex max-sm:px-0!">
      <SellGiftVoucherButton className="rounded-r-none max-sm:flex-1" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" aria-label="More ways to create vouchers" className="w-11 flex-none rounded-l-none border-l border-l-primary-foreground/25 px-0">
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
            Gift vouchers printed in advance, with a code and QR but no amount. They stay Not sold until a customer buys one: then find the
            card&apos;s code and create it with the amount.
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
  const [saved, setSaved] = useState<PrintedVoucher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saving, startSave] = useTransition();
  const [downloading, startDownload] = useTransition();
  // What to do once the saved cards are drawn (off screen, below): print them or make the PDF.
  const [next, setNext] = useState<{ kind: "print" | "pdf"; n: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const preview = (n: number) =>
    startPreview(async () => {
      const result = await previewGiftVoucherCodes(n);
      if (!result.ok) return setError(result.message);
      setError(null);
      setCodes(result.codes);
    });

  // The first preview, for the default count.
  useEffect(() => preview(10), []);

  const cards = () => (sheet.current ? voucherCardsIn(sheet.current) : []);
  const download = () =>
    startDownload(async () => {
      const list = cards();
      if (list.length) await downloadVoucherPdf(list, `blank-cards-${list.length}.pdf`);
    });

  useEffect(() => {
    if (!next || !sheet.current) return;
    if (next.kind === "print") printVoucherNodes([...sheet.current.children], true);
    else download();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [next]);

  const [saveKind, setSaveKind] = useState<"print" | "pdf">("print");
  const save = (kind: "print" | "pdf") =>
    startSave(async () => {
      setSaveKind(kind);
      if (!codes) return;
      const result = await createInactiveGiftVouchers(codes);
      if (!result.ok) return setError(result.message);
      setError(null);
      setSaved(result.vouchers);
      setNext({ kind, n: 1 });
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
            {saved[0].code} to {saved.at(-1)!.code}. Each becomes active when it&apos;s sold.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => setNext((n) => ({ kind: "print", n: (n?.n ?? 0) + 1 }))}>
            <Printer aria-hidden="true" />
            Print
          </Button>
          <Button type="button" variant="outline" pending={downloading} onClick={download}>
            <Download aria-hidden="true" />
            Download PDF
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/gift-vouchers?filter=inactive" onClick={onDone} className="text-sm font-bold text-primary hover:underline">
            See them in the list
          </Link>
          <Button type="button" size="lg" onClick={onDone} autoFocus>
            Done
          </Button>
        </div>
        {/* The cards to print or capture: drawn off screen (a PDF needs them laid out), one per row. */}
        <div ref={sheet} aria-hidden="true" className="fixed top-0 -left-[10000px] flex w-[640px] flex-col gap-4">
          {saved.map((v) => (
            <VoucherCard key={v.code} code={v.code} expiresOn={null} token={v.token} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">How many?</legend>
        <div className="grid grid-cols-3 gap-2">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={count === n}
              onClick={() => {
                setCount(n);
                preview(n);
              }}
              className={segment(count === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">10 fit on an A4 page, with a gap to cut between.</p>
      </fieldset>

      <VoucherCard code={codes?.[0] ?? ""} expiresOn={null} token={null} className="mx-auto max-w-[280px]" />

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
        <p className="text-[13px] text-muted-foreground">Nothing is saved until you print or download.</p>
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="sticky -bottom-4 -mx-4 -mb-4 grid grid-cols-2 gap-2 border-t border-border bg-popover px-4 pt-3 pb-4">
        <Button type="button" variant="outline" size="lg" pending={saving && saveKind === "pdf"} disabled={!codes || previewing || saving} onClick={() => save("pdf")}>
          <Download aria-hidden="true" />
          Save &amp; PDF
        </Button>
        <Button type="button" size="lg" pending={saving && saveKind === "print"} disabled={!codes || previewing || saving} onClick={() => save("print")}>
          <Printer aria-hidden="true" />
          Save &amp; print
        </Button>
      </div>
    </div>
  );
}
