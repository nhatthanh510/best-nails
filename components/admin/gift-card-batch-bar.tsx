"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Layers, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/action-button";
import { DownloadGiftCardPdfButton } from "@/components/admin/printed-gift-card";
import { useGiftCardPrinting } from "@/components/admin/bulk-select";
import { deleteGiftCards } from "@/app/admin/gift-card-actions";
import { GIFT_CARD_FORMATS } from "@/lib/gift-card-sheet";

/**
 * Above the Gift cards list while it shows one print run (a card's batch tag opens it): when and by
 * whom it was printed, and actions on the whole batch, not just the page (Print all, PDF, Copy codes,
 * Delete unused), so nothing has to be ticked card by card. × goes back to the full list.
 */
export function GiftCardBatchBar({
  printed,
  cards,
  closeHref,
}: {
  /** "Printed 14 Nov 2026, 10:44 pm by Admin". */
  printed: string;
  /** All the batch's cards, in code order; `unused` ones can be deleted. */
  cards: { id: string; code: string; unused: boolean }[];
  closeHref: string;
}) {
  const { format, printing, print, download, offscreen } = useGiftCardPrinting();
  const [, startCopy] = useTransition();
  const ids = cards.map((c) => c.id);
  const unused = cards.filter((c) => c.unused).map((c) => c.id);
  const size = GIFT_CARD_FORMATS[format].name.toLowerCase();

  const copyCodes = () =>
    startCopy(async () => {
      try {
        // One per line, e.g. to send to a print shop.
        await navigator.clipboard.writeText(cards.map((c) => c.code).join("\n"));
        toast.success(`${cards.length} codes copied.`);
      } catch {
        toast.error("Couldn't copy the codes.");
      }
    });

  return (
    <div role="region" aria-label="Print run" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-gold-soft/60 px-4 py-2.5">
      <Layers aria-hidden="true" className="size-4.5 flex-none text-primary" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-bold">Batch · {cards.length} cards</span>
        <span className="text-muted-foreground"> · {printed}</span>
      </p>
      <Button type="button" variant="outline" size="sm" pending={printing} onClick={() => print(ids)} disabled={!ids.length}>
        <Printer aria-hidden="true" />
        Print all {ids.length}
        <span className="sr-only"> {size}s</span>
      </Button>
      <DownloadGiftCardPdfButton size="sm" label="PDF" download={() => download(ids, `gift-cards-batch-${ids.length}`)} />
      <Button type="button" variant="outline" size="sm" onClick={copyCodes} disabled={!ids.length}>
        <Copy aria-hidden="true" />
        Copy codes
      </Button>
      {unused.length > 0 && (
        <ConfirmButton
          variant="danger"
          size="sm"
          title={`Delete ${unused.length} unused gift card${unused.length === 1 ? "" : "s"}?`}
          description="Every card in this batch that nothing has been spent from, for a batch that's lost or misprinted. Any that have been used are kept. This can't be undone."
          confirmLabel={`Delete ${unused.length}`}
          action={() => deleteGiftCards(unused)}
        >
          <Trash2 aria-hidden="true" />
          Delete unused
        </ConfirmButton>
      )}
      <Button asChild variant="ghost" size="icon" aria-label="Show all gift cards" className="-my-1">
        <Link href={closeHref}>
          <X aria-hidden="true" />
        </Link>
      </Button>
      {offscreen}
    </div>
  );
}
