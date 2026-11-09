"use client";

import { useRef, useTransition } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { encode } from "uqr";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/kiosk/brand";
import { CopyButton } from "@/components/admin/copy-button";
import { giftCardBalanceUrl } from "@/lib/gift-card-link";
import { downloadGiftCardPdf } from "@/lib/gift-card-pdf";
import { useGiftCardFormat } from "@/lib/gift-card-format";
import { BLEED, BLEED_RGB, cardPage, GIFT_CARD_FORMATS, type GiftCardFormat } from "@/lib/gift-card-sheet";
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
 * The A6 promo card's face (148 × 105 mm landscape, 1cqw = 1.48 mm printed): ivory all over, like
 * the business card, with a double gold frame 3 mm in, the brand and a large italic "Gift Card" on
 * the left, a short line on how it works, the code and expiry bottom-left and a large QR on the
 * right, with the logo as a faint watermark behind it.
 */
function PromoCardFace({ code, expiry, qr, qrLabel }: { code: React.ReactNode; expiry: string; qr: React.ReactNode; qrLabel: string }) {
  return (
    <div
      data-printed-gift-card
      className="relative flex aspect-[148/105] w-full overflow-hidden rounded-[2.4cqw] border border-[#e6dcc6] bg-[#fbf8f2] bg-[radial-gradient(ellipse_at_78%_45%,rgb(201_162_74/0.14),transparent_60%)] text-[#2b241c] [print-color-adjust:exact]"
    >
      {/* A double gold frame, 3 mm in from the edge. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-[2.05cqw] rounded-[1cqw] border-[0.16cqw] border-gold" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[2.75cqw] rounded-[0.6cqw] border-[0.1cqw] border-gold/55" />
      {/* The logo, large and faint, behind the QR. */}
      <BrandMark className="pointer-events-none absolute top-1/2 right-[3cqw] size-[58cqw] -translate-y-1/2 rounded-full opacity-[0.08]" sizes="400px" />

      <div className="relative flex min-w-0 flex-1 flex-col justify-between py-[7cqw] pr-[3cqw] pl-[8cqw]">
        <div className="flex items-center gap-[1.8cqw]">
          <span className="rounded-full bg-gold-sheen p-[0.3cqw]">
            <BrandMark className="block size-[7cqw]" sizes="96px" />
          </span>
          <span className="font-heading text-[3.4cqw] leading-none font-bold tracking-[0.14em] uppercase">Best Nails</span>
        </div>

        <div className="flex flex-col">
          {/* Solid deep gold (the app's --primary): a light gold is too faint on ivory and doesn't survive the PDF capture. */}
          <span className="pb-[0.8cqw] font-heading text-[15cqw] leading-[0.85] font-semibold text-[#8a6914] italic">Gift Card</span>
          <span aria-hidden="true" className="mt-[2.4cqw] mb-[2.4cqw] h-px w-[16cqw] bg-linear-to-r from-gold to-gold/0" />
          <span className="font-heading text-[3.6cqw] leading-[1.1] font-semibold">A treat to enjoy at Best Nails</span>
          <span className="mt-[1.2cqw] max-w-[52cqw] text-[1.8cqw] leading-[1.45] text-[#4f4538]">
            Use it towards any visit, over as many visits as you like. Scan the code any time to see what&apos;s left.
          </span>
        </div>

        <div className="flex flex-col gap-[1cqw]">
          <span className="text-[1.5cqw] leading-none font-bold tracking-[0.18em] text-[#8a6914] uppercase">Gift card code</span>
          <span className="font-mono text-[3cqw] leading-none font-semibold tracking-[0.14em] whitespace-nowrap">{code}</span>
          <span className="text-[1.5cqw] leading-[1.25] font-semibold tracking-[0.12em] text-[#6b5f4f] uppercase">{expiry}</span>
        </div>
      </div>

      {/* About 25 mm of code, on white with a 4-square quiet zone. */}
      <div className="relative flex flex-none flex-col items-center justify-center gap-[1.4cqw] pr-[8cqw] pl-[2cqw]">
        <div className="flex size-[19cqw] items-center justify-center rounded-[1.4cqw] bg-white p-[1.8cqw] ring-[0.3cqw] ring-gold/70">{qr}</div>
        <span className="text-[1.5cqw] leading-none font-bold tracking-[0.14em] text-[#8a6914] uppercase">{qrLabel}</span>
      </div>
    </div>
  );
}

/**
 * The gift card as it's handed over: logo, code, expiry and a QR code that opens its balance
 * page (`/v/<token>`). No amount, as on stored-value gift cards: it's spent over several visits,
 * so a printed value would be wrong after the first one (or on a reprint); the QR shows what's
 * left. Before it's created (`token` null, the create form's live preview) the QR spot says it's
 * added on creation, and an empty `code` shows dots. A blank printed ahead of time has no expiry
 * yet (`expiresOn` null): it starts at the sale. Two formats (`lib/gift-card-sheet.ts`): a
 * business card (90 × 55 mm, left-aligned like a bank card) and an A6 promo card (148 × 105 mm
 * landscape, `PromoCardFace`); without `format` it's the one last picked (`useGiftCardFormat`). Both
 * ivory with a gold double frame 3 mm in from the edge, in the serif wordmark and italic of the
 * app's headings. On screen it has a
 * card's rounded corners and a faint edge; printed (and in the PDF) it's square with no outline,
 * for straight cuts. Its own fixed colours, so it looks the same in the admin, on the kiosk and on
 * paper. Sizes are in container units (1cqw = 0.9 mm printed on a business card, 1.48 mm on A6):
 * lines at least 0.13 mm, small text about 6 pt, the QR at least 14 mm, and the frame 2 mm (business
 * card) or 3 mm (A6) in from the edge, so a cut slightly off can't clip it.
 */
export function PrintedGiftCard({
  code,
  expiresOn,
  token,
  format: fixed,
  className,
  ref,
}: {
  code: string;
  expiresOn: string | null;
  token: string | null;
  format?: GiftCardFormat;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const [picked] = useGiftCardFormat();
  const format = fixed ?? picked;
  const codeText = <span className={cn(!code && "text-[#9a8d78]")}>{code || "••••••••••"}</span>;
  const expiry = expiresOn ? `Valid until ${dateLabel(expiresOn)}` : "Valid 3 years from purchase";
  const qr = token ? (
    <Qr value={giftCardBalanceUrl(token)} className="size-full" />
  ) : (
    <QrCode className="size-[60%] text-[#9a8d78]" strokeWidth={1.5} aria-hidden="true" />
  );
  const qrLabel = token ? "Scan for balance" : "QR added when created";
  const face = "relative flex w-full flex-col overflow-hidden border border-[#e6dcc6] bg-[#fbf8f2] text-[#2b241c] [print-color-adjust:exact]";

  if (format === "a6") {
    return (
      <div ref={ref} className={cn("@container w-full", className)}>
        <PromoCardFace code={codeText} expiry={expiry} qr={qr} qrLabel={qrLabel} />
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("@container w-full", className)}>
      <div data-printed-gift-card className={cn(face, "aspect-[90/55] justify-between rounded-[3.5cqw] px-[7.4cqw] py-[6.5cqw]")}>
        {/* A double gold frame, 2 mm in from the edge: on a card this small 3 mm looked wide next to the A6 card. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-[2.25cqw] rounded-[1.6cqw] border-[0.21cqw] border-gold" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[3.15cqw] rounded-[0.95cqw] border-[0.15cqw] border-gold/70" />

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
            <span className="font-mono text-[3.8cqw] leading-none font-semibold tracking-[0.2em] break-all">{codeText}</span>
            <span className="mt-[1.8cqw] text-[2.35cqw] leading-[1.25] font-semibold tracking-[0.12em] text-[#6b5f4f] uppercase">{expiry}</span>
          </div>
          <div className="flex w-[21cqw] flex-none flex-col items-center gap-[1.5cqw]">
            {/* About 15 mm of code (0.47 mm squares, fine for phone cameras) with 2.1cqw of white around it: the 4-square quiet zone scanners expect. */}
            <div className="flex size-[21cqw] items-center justify-center rounded-[1.8cqw] bg-white p-[2.1cqw] ring-1 ring-gold/60">{qr}</div>
            <span className="text-center text-[2cqw] leading-[1.25] font-bold tracking-[0.1em] text-[#6b5f4f] uppercase">{qrLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Business card or A6 promo card: what Print and Download PDF make, remembered on this device. */
export function GiftCardFormatPicker({ className }: { className?: string }) {
  const [format, setFormat] = useGiftCardFormat();
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-[13px] font-semibold">Card size</legend>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(GIFT_CARD_FORMATS) as GiftCardFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={format === f}
            onClick={() => setFormat(f)}
            className={cn(
              "flex min-h-11 flex-col items-start justify-center rounded-[10px] border px-3 py-1.5 text-left",
              format === f ? "border-primary bg-accent ring-1 ring-primary" : "border-input bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-bold">{GIFT_CARD_FORMATS[f].name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{GIFT_CARD_FORMATS[f].size}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Prints only `nodes` (PrintedGiftCards of one `format`), one card per page, the same pages as the
 * PDF (`lib/gift-card-sheet.ts`): the card plus a 2 mm bleed in its ivory. Copies go into a
 * print-only root that hides the rest of the page (globals.css), so it works from a dialog or a
 * page, and it's removed after printing. The root's own @page sets the page size; print at 100%
 * ("Actual size") on card-size paper, or the printer scales it.
 */
export function printGiftCardNodes(nodes: Node[], format: GiftCardFormat) {
  document.getElementById("print-root")?.remove();
  const { card } = GIFT_CARD_FORMATS[format];
  const page = cardPage(format);
  const root = document.createElement("div");
  root.id = "print-root";
  const style = document.createElement("style");
  style.textContent = `@media print { @page { size: ${page.w}mm ${page.h}mm; margin: 0; } }`;
  root.append(style);
  for (const node of nodes) {
    const sheet = document.createElement("div");
    sheet.dataset.page = "";
    // A hair under the page's height, so rounding never spills onto an extra blank page. The page is
    // the cards' ivory: the bleed (print-color-adjust, or browsers drop the background).
    sheet.style.cssText = `width:${page.w}mm;height:${page.h - 0.5}mm;background:rgb(${BLEED_RGB.join(" ")});print-color-adjust:exact`;
    const cell = document.createElement("div");
    cell.style.cssText = `left:${BLEED}mm;top:${BLEED}mm;width:${card.w}mm;height:${card.h}mm`;
    cell.append(node.cloneNode(true));
    sheet.append(cell);
    root.append(sheet);
  }
  document.body.append(root);
  window.addEventListener("afterprint", () => root.remove(), { once: true });
  window.print();
}

export function PrintGiftCardButton({ card, className }: { card: React.RefObject<HTMLDivElement | null>; className?: string }) {
  const [format] = useGiftCardFormat();
  const print = () => card.current && printGiftCardNodes([card.current], format);
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

/** Download PDF: one card per page with a 2 mm bleed, the same pages as Print. */
export function DownloadGiftCardPdfButton({
  download,
  size,
  label = "Download PDF",
  className,
}: {
  download: () => Promise<void>;
  size?: "sm";
  label?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" size={size} pending={pending} onClick={() => start(download)} className={className}>
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Download PDF for the cards inside `card` (a PrintedGiftCard's ref). */
export function DownloadGiftCardButton({ card, filename, className }: { card: React.RefObject<HTMLDivElement | null>; filename: string; className?: string }) {
  const [format] = useGiftCardFormat();
  return (
    <DownloadGiftCardPdfButton
      className={className}
      download={async () => {
        if (card.current) await downloadGiftCardPdf(printedGiftCardsIn(card.current), format, `${filename}-${format}.pdf`);
      }}
    />
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
        <GiftCardFormatPicker />
        {/* Side by side under the card; stacked when they sit beside it, where the column is narrow. */}
        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-1">
          <PrintGiftCardButton card={card} />
          <DownloadGiftCardButton card={card} filename={`gift-card-${code}`} />
        </div>
        <GiftCardBalanceLink token={token} />
      </div>
    </div>
  );
}
