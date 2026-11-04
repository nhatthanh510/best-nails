"use client";

import { useRef, useTransition } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { encode } from "uqr";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/kiosk/brand";
import { CopyButton } from "@/components/admin/copy-button";
import { giftCardBalanceUrl } from "@/lib/gift-card-link";
import { downloadGiftCardPdf } from "@/lib/gift-card-pdf";
import { A4, CARD, cardSlot, cropMarks, sheetPages } from "@/lib/gift-card-sheet";
import { cn } from "@/lib/utils";

const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The QR as one SVG path (one square per dark module), so it prints sharp at any size. */
function Qr({ value, className }: { value: string; className?: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 0 });
  let d = "";
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR code to check the balance" className={className}>
      <path d={d} fill="#16110c" />
    </svg>
  );
}

/**
 * The gift card as it's handed over: logo, code, expiry and a QR code that opens its balance
 * page (`/v/<token>`). No amount, as on stored-value gift cards: it's spent over several visits,
 * so a printed value would be wrong after the first one (or on a reprint); the QR shows what's
 * left. Before it's created (`token` null, the create form's live preview) the QR spot says it's
 * added on creation, and an empty `code` shows dots. A blank printed ahead of time has no expiry
 * yet (`expiresOn` null): it starts at the sale. Credit-card size (85.6 × 54 mm, `CARD` in
 * `lib/gift-card-sheet.ts`), ivory with a gold double frame, light on ink for sheets of blanks, laid
 * out left-aligned like a bank card in the serif wordmark and italic of the app's headings.
 * On screen it has a card's rounded corners and a faint edge; printed (and in the PDF) it's square
 * with no outline, for straight cuts along the crop marks. Its own fixed colours, so it looks the
 * same in the admin, on the kiosk and on paper. Sizes are in container units (1cqw = 0.856 mm
 * printed): lines at least 0.13 mm, small text about 6 pt, and nothing important within 3.5 mm of
 * the edge, so a cut slightly off can't clip it.
 */
export function PrintedGiftCard({
  code,
  expiresOn,
  token,
  className,
  ref,
}: {
  code: string;
  expiresOn: string | null;
  token: string | null;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className={cn("@container w-full", className)}>
      <div
        data-printed-gift-card
        className="relative flex aspect-[85.6/54] w-full flex-col justify-between overflow-hidden rounded-[3.7cqw] border border-[#e6dcc6] bg-[#fbf8f2] px-[8.5cqw] py-[7.9cqw] text-[#2b241c] [print-color-adjust:exact]"
      >
        {/* A double gold frame, 3.5 mm in from the edge. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-[4.1cqw] rounded-[2cqw] border-[0.22cqw] border-gold" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[5cqw] rounded-[1.2cqw] border-[0.15cqw] border-gold/70" />

        {/* Left-aligned like a bank card: the brand top-left, the details bottom-left, the QR bottom-right. */}
        <div className="relative flex items-center gap-[2cqw]">
          <span className="flex-none rounded-full bg-gold-sheen p-[0.3cqw]">
            <BrandMark className="block size-[8.2cqw]" sizes="96px" />
          </span>
          <span className="font-heading text-[4.4cqw] leading-none font-bold tracking-[0.02em]">Best Nails</span>
        </div>

        {/* Both sides end on one line, and the details are sized so the tall letters of "Gift Card" reach the QR's top. */}
        <div className="relative flex items-end justify-between gap-[3.5cqw]">
          <div className="flex min-w-0 flex-col">
            {/* Solid deep gold (the app's --primary): a light gold gradient is too faint on ivory and doesn't survive the PDF capture. */}
            <span className="pb-[0.6cqw] font-heading text-[12cqw] leading-[0.9] font-semibold text-[#8a6914] italic">Gift Card</span>
            <span aria-hidden="true" className="mt-[2cqw] mb-[3.2cqw] h-px w-[17.6cqw] bg-linear-to-r from-gold to-gold/0" />
            <span className={cn("font-mono text-[3.8cqw] leading-none font-semibold tracking-[0.2em] break-all", !code && "text-[#9a8d78]")}>
              {code || "••••••••••"}
            </span>
            <span className="mt-[1.8cqw] text-[2.35cqw] leading-[1.25] font-semibold tracking-[0.12em] text-[#6b5f4f] uppercase">
              {expiresOn ? `Valid until ${dateLabel(expiresOn)}` : "Valid 3 years from purchase"}
            </span>
          </div>
          <div className="flex w-[21cqw] flex-none flex-col items-center gap-[1.5cqw]">
            {/* About 14.4 mm of code (0.44 mm squares, fine for phone cameras) with 2.1cqw of white around it: the 4-square quiet zone scanners expect. */}
            <div className="flex size-[21cqw] items-center justify-center rounded-[1.8cqw] bg-white p-[2.1cqw] ring-1 ring-gold/60">
              {token ? (
                <Qr value={giftCardBalanceUrl(token)} className="size-full" />
              ) : (
                <QrCode className="size-[60%] text-[#9a8d78]" strokeWidth={1.5} aria-hidden="true" />
              )}
            </div>
            <span className="text-center text-[2cqw] leading-[1.25] font-bold tracking-[0.1em] text-[#6b5f4f] uppercase">
              {token ? "Scan for balance" : "QR added when created"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Prints only `nodes` (PrintedGiftCards), at their real size on A4 sheets with crop marks
 * (`lib/gift-card-sheet.ts`, the same layout as the PDF): copies go into a print-only root that
 * hides the rest of the page (globals.css), so it works from a dialog or a page, and it's removed
 * after printing. Print at 100% ("Actual size"), or the cards come out smaller than a card.
 */
export function printGiftCardNodes(nodes: Node[]) {
  document.getElementById("print-root")?.remove();
  const root = document.createElement("div");
  root.id = "print-root";
  let index = 0;
  for (const cards of sheetPages(nodes)) {
    const page = document.createElement("div");
    page.dataset.page = "";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${A4.w} ${A4.h}`);
    svg.setAttribute("aria-hidden", "true");
    for (const m of cropMarks(cards.length)) {
      const line = document.createElementNS(SVG_NS, "line");
      for (const [k, v] of Object.entries(m)) line.setAttribute(k, String(v));
      svg.append(line);
    }
    page.append(svg);
    for (const card of cards) {
      const { x, y } = cardSlot(index++);
      const cell = document.createElement("div");
      cell.style.cssText = `left:${x}mm;top:${y}mm;width:${CARD.w}mm;height:${CARD.h}mm`;
      cell.append(card.cloneNode(true));
      page.append(cell);
    }
    root.append(page);
  }
  document.body.append(root);
  window.addEventListener("afterprint", () => root.remove(), { once: true });
  window.print();
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function PrintGiftCardButton({ card, className }: { card: React.RefObject<HTMLDivElement | null>; className?: string }) {
  const print = () => card.current && printGiftCardNodes([card.current]);
  return (
    <Button type="button" variant="outline" onClick={print} className={className}>
      <Printer aria-hidden="true" />
      Print
    </Button>
  );
}

/** The cards inside `container` (PrintedGiftCards), as they're drawn on screen. */
export function printedGiftCardsIn(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-printed-gift-card]")];
}

/** For a shop without a printer: the card as a PDF to print elsewhere. */
export function DownloadGiftCardButton({ card, filename, className }: { card: React.RefObject<HTMLDivElement | null>; filename: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      pending={pending}
      onClick={() => start(async () => void (card.current && (await downloadGiftCardPdf(printedGiftCardsIn(card.current), filename))))}
      className={className}
    >
      <Download aria-hidden="true" />
      Download PDF
    </Button>
  );
}

/**
 * The gift card's public balance page (what its QR opens), so staff can open it, check what the
 * customer sees, or copy it into a message. Anyone with the link sees the balance.
 */
export function GiftCardBalanceLink({ token }: { token: string }) {
  const url = giftCardBalanceUrl(token);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">Balance page · what the QR code opens</span>
      <div className="flex min-w-0 items-center gap-1 rounded-[10px] border border-input bg-background py-1 pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={url}>
          {url}
        </span>
        <CopyButton text={url} label="Copy balance link" />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open balance page"
          title="Open balance page"
          className="inline-flex size-9 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/**
 * The card with Print, Download PDF and its balance link, for a gift card that exists. Stacked; in a
 * wide box (an @container, e.g. a one-column page on a tablet) the buttons sit beside the card.
 */
export function PrintableGiftCard({ code, expiresOn, token }: { code: string; expiresOn: string | null; token: string }) {
  const card = useRef<HTMLDivElement>(null);
  return (
    <div className="grid w-full max-w-md gap-3 @xl:max-w-none @xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @xl:items-start @xl:gap-5">
      <PrintedGiftCard ref={card} code={code} expiresOn={expiresOn} token={token} />
      <div className="flex min-w-0 flex-col gap-3">
        {/* Side by side under the card; stacked when they sit beside it, where the column is narrow. */}
        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-1">
          <PrintGiftCardButton card={card} />
          <DownloadGiftCardButton card={card} filename={`gift-card-${code}.pdf`} />
        </div>
        <GiftCardBalanceLink token={token} />
      </div>
    </div>
  );
}
