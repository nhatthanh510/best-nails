/**
 * The two printed gift card formats and their pages, shared by printing (`printGiftCardNodes`),
 * the PDF (`downloadGiftCardPdf`) and the card itself (`PrintedGiftCard`).
 *
 * - **Business card**, 90 × 55 mm: Australia's standard business card, what Officeworks and other
 *   print shops cut, landscape.
 * - **Promo card**, A6 landscape, 148 × 105 mm: a larger one-sided card, e.g. to go in an envelope
 *   or on display. Ivory all over, like the business card.
 *
 * Print and the PDF are the same: one card per page, each page the card plus a 2 mm bleed on every
 * side (business card 94 × 59 mm, A6 152 × 109 mm), as Officeworks asks for. The bleed is the
 * cards' ivory, so a cut slightly off shows only more ivory. Everything is in mm from the page's
 * top-left corner.
 */

export type GiftCardFormat = "business" | "a6";

type Size = { w: number; h: number };
type Format = {
  name: string;
  /** For buttons and hints: the size in words. */
  size: string;
  card: Size;
};

export const GIFT_CARD_FORMATS: Record<GiftCardFormat, Format> = {
  business: { name: "Business card", size: "90 × 55 mm", card: { w: 90, h: 55 } },
  a6: { name: "Promo card", size: "A6 · 148 × 105 mm", card: { w: 148, h: 105 } },
};

export const isGiftCardFormat = (v: unknown): v is GiftCardFormat => v === "business" || v === "a6";

/** The bleed: the card's ivory runs this far past the cut on every side. */
export const BLEED = 2;
/** The cards' ivory (#fbf8f2), which fills the bleed. */
export const BLEED_RGB = [251, 248, 242] as const;

/** One page of Print or the PDF: the card plus its bleed. */
export function cardPage(format: GiftCardFormat): Size {
  const { card } = GIFT_CARD_FORMATS[format];
  return { w: card.w + 2 * BLEED, h: card.h + 2 * BLEED };
}
