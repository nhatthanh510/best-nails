"use client";

import { useRef, useTransition } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { encode } from "uqr";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/kiosk/brand";
import { CopyButton } from "@/components/admin/copy-button";
import { voucherBalanceUrl } from "@/lib/voucher-link";
import { downloadVoucherPdf } from "@/lib/voucher-pdf";
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
 * The gift voucher as it's handed over: logo, code, expiry and a QR code that opens its balance
 * page (`/v/<token>`). No amount, as on stored-value gift cards: it's spent over several visits,
 * so a printed value would be wrong after the first one (or on a reprint); the QR shows what's
 * left. Before it's created (`token` null, the create form's live preview) the QR spot says it's
 * added on creation, and an empty `code` shows dots. A blank printed ahead of time has no expiry
 * yet (`expiresOn` null): it starts at the sale. Its own fixed colours, so it looks the same in the admin, on the kiosk and on paper. Text scales with
 * the card's width (container units), so one design serves the preview, the page and the print.
 */
export function VoucherCard({
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
        data-voucher-card
        className="relative flex aspect-[1.7] w-full flex-col overflow-hidden rounded-[4cqw] bg-kiosk-bg p-[5.5cqw] text-kiosk-ink [print-color-adjust:exact]"
      >
        {/* A soft gold glow and an inset hairline frame, echoing the logo's ring. */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-[30%] -right-[15%] size-[70%] rounded-full bg-gold/15 blur-[8cqw]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[2.2cqw] rounded-[2.6cqw] border border-gold/40" />

        <div className="relative flex items-center gap-[2.4cqw]">
          <BrandMark className="size-[9cqw]" sizes="96px" />
          <span className="font-heading text-[5.4cqw] leading-none font-bold tracking-wide">Best Nails</span>
        </div>

        <div className="relative mt-auto flex items-end justify-between gap-[4cqw]">
          <div className="flex min-w-0 flex-col gap-[1.6cqw]">
            <span className="font-heading text-[10.5cqw] leading-[0.9] font-bold text-gold-bright">Gift Voucher</span>
            <span className={cn("mt-[1.4cqw] font-mono text-[4.6cqw] leading-tight font-bold tracking-[0.14em] break-all", !code && "text-kiosk-faint")}>
              {code || "••••••••••"}
            </span>
            <span className="text-[2.7cqw] text-kiosk-muted">{expiresOn ? `Valid until ${dateLabel(expiresOn)}` : "Valid 3 years from purchase"}</span>
          </div>
          <div className="flex flex-none flex-col items-center gap-[1.2cqw]">
            <div className="flex size-[22cqw] items-center justify-center rounded-[2cqw] bg-white p-[1.6cqw]">
              {token ? (
                <Qr value={voucherBalanceUrl(token)} className="size-full" />
              ) : (
                <QrCode className="size-[60%] text-kiosk-faint" strokeWidth={1.5} aria-hidden="true" />
              )}
            </div>
            <span className="text-[2.3cqw] whitespace-nowrap text-kiosk-muted">{token ? "Scan for balance" : "QR added when created"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Prints only `nodes`: copies go into a print-only root that hides the rest of the page
 * (globals.css), so it works from a dialog or a page, and it's removed after printing. `sheet`
 * lays them out as cards to cut out, 10 to an A4 page with a gap between; otherwise it's one card.
 */
export function printVoucherNodes(nodes: Node[], sheet = false) {
  document.getElementById("print-root")?.remove();
  const root = document.createElement("div");
  root.id = "print-root";
  if (sheet) root.dataset.sheet = "";
  root.append(...nodes.map((n) => n.cloneNode(true)));
  document.body.append(root);
  window.addEventListener("afterprint", () => root.remove(), { once: true });
  window.print();
}

export function PrintVoucherButton({ card, className }: { card: React.RefObject<HTMLDivElement | null>; className?: string }) {
  const print = () => card.current && printVoucherNodes([card.current]);
  return (
    <Button type="button" variant="outline" onClick={print} className={className}>
      <Printer aria-hidden="true" />
      Print
    </Button>
  );
}

/** The cards inside `container` (VoucherCards), as they're drawn on screen. */
export function voucherCardsIn(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-voucher-card]")];
}

/** For a shop without a printer: the card as a PDF to print elsewhere. */
export function DownloadVoucherButton({ card, filename, className }: { card: React.RefObject<HTMLDivElement | null>; filename: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      pending={pending}
      onClick={() => start(async () => void (card.current && (await downloadVoucherPdf(voucherCardsIn(card.current), filename))))}
      className={className}
    >
      <Download aria-hidden="true" />
      Download PDF
    </Button>
  );
}

/**
 * The voucher's public balance page (what its QR opens), so staff can open it, check what the
 * customer sees, or copy it into a message. Anyone with the link sees the balance.
 */
export function VoucherBalanceLink({ token }: { token: string }) {
  const url = voucherBalanceUrl(token);
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
 * The card with Print, Download PDF and its balance link, for a voucher that exists. Stacked; in a
 * wide box (an @container, e.g. a one-column page on a tablet) the buttons sit beside the card.
 */
export function PrintableVoucher({ code, expiresOn, token }: { code: string; expiresOn: string | null; token: string }) {
  const card = useRef<HTMLDivElement>(null);
  return (
    <div className="grid w-full max-w-md gap-3 @xl:max-w-none @xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @xl:items-start @xl:gap-5">
      <VoucherCard ref={card} code={code} expiresOn={expiresOn} token={token} />
      <div className="flex min-w-0 flex-col gap-3">
        {/* Side by side under the card; stacked when they sit beside it, where the column is narrow. */}
        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-1">
          <PrintVoucherButton card={card} />
          <DownloadVoucherButton card={card} filename={`gift-voucher-${code}.pdf`} />
        </div>
        <VoucherBalanceLink token={token} />
      </div>
    </div>
  );
}
