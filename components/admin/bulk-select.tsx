"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/action-button";
import { DownloadGiftCardPdfButton, PrintedGiftCard, printedGiftCardsIn, printGiftCardNodes } from "@/components/admin/printed-gift-card";
import { deleteGiftCards, giftCardsToPrint, type PrintableGiftCardData } from "@/app/admin/gift-card-actions";
import { useGiftCardFormat } from "@/lib/gift-card-format";
import { downloadGiftCardPdf } from "@/lib/gift-card-pdf";
import { GIFT_CARD_FORMATS, isGiftCardFormat, type GiftCardFormat } from "@/lib/gift-card-sheet";

/**
 * Choosing several gift cards in the list to print again, download as a PDF again (when a batch's
 * file is lost) or delete at once. The rows stay server-rendered:
 * each one that can be deleted has a plain checkbox (BulkCheckbox), and these two read and set
 * them in the list panel they're in, so a new page, filter or search starts with none chosen.
 */

const boxes = (root: Element | null) => [...(root?.querySelectorAll<HTMLInputElement>("input[data-bulk]") ?? [])];
const panelOf = (el: Element | null) => el?.closest("[data-list-panel]") ?? null;

export function BulkCheckbox({ id, label }: { id: string; label: string }) {
  return <input type="checkbox" data-bulk value={id} aria-label={label} className="size-4.5 accent-primary" />;
}

/** The header checkbox: all, none, or a dash when some are chosen. */
export function BulkSelectAll() {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"none" | "some" | "all" | "empty">("empty");

  useEffect(() => {
    const panel = panelOf(ref.current);
    if (!panel) return;
    const sync = () => {
      const all = boxes(panel);
      const n = all.filter((b) => b.checked).length;
      setState(all.length === 0 ? "empty" : n === 0 ? "none" : n === all.length ? "all" : "some");
    };
    sync();
    panel.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(panel, { childList: true, subtree: true });
    return () => {
      panel.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Choose all on this page"
      checked={state === "all"}
      disabled={state === "empty"}
      onChange={(e) => {
        const panel = panelOf(e.currentTarget);
        const on = state !== "all";
        for (const b of boxes(panel)) b.checked = on;
        panel?.dispatchEvent(new Event("change"));
      }}
      className="size-4.5 accent-primary disabled:opacity-30"
    />
  );
}

/** Shown once any are chosen: how many, Clear, the card size, Print, PDF and Delete (after a confirmation). */
export function BulkActions() {
  const ref = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const panel = panelOf(ref.current);
    if (!panel) return;
    const sync = () => {
      const next = boxes(panel).filter((b) => b.checked).map((b) => b.value);
      // Only on a real change: this bar's own render is a DOM change the observer sees too.
      setIds((prev) => (prev.join() === next.join() ? prev : next));
    };
    sync();
    panel.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(panel, { childList: true, subtree: true });
    return () => {
      panel.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  const [format, setFormat] = useGiftCardFormat();
  const [cards, setCards] = useState<PrintableGiftCardData[]>([]);
  const [printing, startPrint] = useTransition();
  const sheet = useRef<HTMLDivElement>(null);

  // Fetch the chosen cards and draw them off screen, then `output` prints or captures them.
  const withCards = async (output: (nodes: HTMLElement) => Promise<void> | void) => {
    try {
      const result = await giftCardsToPrint(ids);
      if (!result.ok) return void toast.error(result.message);
      flushSync(() => setCards(result.giftCards));
      if (sheet.current) await output(sheet.current);
    } finally {
      setCards([]);
    }
  };
  const print = () => startPrint(() => withCards((el) => printGiftCardNodes([...el.children], format)));
  const download = () => withCards((el) => downloadGiftCardPdf(printedGiftCardsIn(el), format, `gift-cards-${ids.length}-${format}.pdf`));

  const clear = () => {
    const panel = panelOf(ref.current);
    for (const b of boxes(panel)) b.checked = false;
    panel?.dispatchEvent(new Event("change"));
  };

  return (
    <div ref={ref} role="region" aria-label="Chosen gift cards" aria-live="polite" className={ids.length ? "contents" : "hidden"}>
      {ids.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-accent/60 px-4 py-2">
          <span className="text-sm font-bold">
            {ids.length} chosen
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <select
            aria-label="Card size"
            value={format}
            onChange={(e) => isGiftCardFormat(e.target.value) && setFormat(e.target.value)}
            className="ml-auto h-9 rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm font-semibold"
          >
            {(Object.keys(GIFT_CARD_FORMATS) as GiftCardFormat[]).map((f) => (
              <option key={f} value={f}>
                {GIFT_CARD_FORMATS[f].name} ({GIFT_CARD_FORMATS[f].size})
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" pending={printing} onClick={print}>
            <Printer aria-hidden="true" />
            Print
          </Button>
          <DownloadGiftCardPdfButton size="sm" label="PDF" download={download} />
          <ConfirmButton
            variant="danger"
            size="sm"
            title={`Delete ${ids.length} gift card${ids.length === 1 ? "" : "s"}?`}
            description="For blank cards that are lost or misprinted, or gift cards created by mistake (refund those at the till). Any that have been used are kept. This can't be undone."
            confirmLabel={`Delete ${ids.length}`}
            action={() => deleteGiftCards(ids)}
          >
            <Trash2 aria-hidden="true" />
            Delete {ids.length}
          </ConfirmButton>
        </div>
      )}
      {/* The chosen cards, drawn off screen only while printing or making the PDF. */}
      {cards.length > 0 && (
        <div ref={sheet} aria-hidden="true" className="fixed top-0 -left-[10000px] flex w-[640px] flex-col gap-4">
          {cards.map((v) => (
            <PrintedGiftCard key={v.code} code={v.code} expiresOn={v.expiresOn} token={v.token} format={format} />
          ))}
        </div>
      )}
    </div>
  );
}
