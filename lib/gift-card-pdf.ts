/**
 * Gift cards as a PDF: one card per page, each page the card plus a 2 mm bleed on every side
 * (`cardPage` in `lib/gift-card-sheet.ts`: 94 × 59 mm for a business card, 152 × 109 mm for A6),
 * the same pages as Print. Each card (a PrintedGiftCard on the page, so the PDF matches the screen
 * exactly) becomes a sharp image placed at the trim size on a page filled with the cards' ivory
 * (the bleed). The libraries load only when someone downloads.
 */

import { BLEED, BLEED_RGB, cardPage, GIFT_CARD_FORMATS, type GiftCardFormat } from "@/lib/gift-card-sheet";

export async function downloadGiftCardPdf(cards: HTMLElement[], format: GiftCardFormat, filename: string) {
  if (!cards.length) return;
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const { card: trim } = GIFT_CARD_FORMATS[format];
  const page = cardPage(format);
  const orientation = page.w > page.h ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "mm", format: [page.w, page.h], orientation, compress: true });

  // About 400 dpi at the printed size, so the QR codes scan. The card's wrapper is captured;
  // `data-capture` gives the card its printed edge (square corners, no border; globals.css).
  const image = async (card: HTMLElement) => {
    const el = card.parentElement ?? card;
    el.dataset.capture = "";
    try {
      const px = (trim.w / 25.4) * 400;
      return await toJpeg(el, { quality: 0.95, pixelRatio: Math.max(2, px / el.offsetWidth), backgroundColor: "#fbf8f2" });
    } finally {
      delete el.dataset.capture;
    }
  };

  for (const [i, card] of cards.entries()) {
    if (i > 0) pdf.addPage([page.w, page.h], orientation);
    pdf.setFillColor(...BLEED_RGB);
    pdf.rect(0, 0, page.w, page.h, "F");
    pdf.addImage(await image(card), "JPEG", BLEED, BLEED, trim.w, trim.h);
  }
  pdf.save(filename);
}
