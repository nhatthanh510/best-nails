/**
 * Gift cards as a PDF, for a shop without a printer: download it and print it elsewhere. Each
 * card (a PrintedGiftCard on the page, so the PDF matches the screen exactly) becomes a sharp image,
 * laid out on A4 like the printed sheet (`lib/gift-card-sheet.ts`): credit-card size, 2 × 5 to a
 * page, touching, with crop marks. One gift card goes in the first slot, the same size. The
 * libraries load only when someone downloads.
 */

import { A4, CARD, cardSlot, cropMarks, sheetPages } from "@/lib/gift-card-sheet";

export async function downloadGiftCardPdf(cards: HTMLElement[], filename: string) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: [A4.w, A4.h], compress: true });

  // About 400 dpi at the printed size, so the QR codes scan. The card's wrapper is captured;
  // `data-capture` gives the card its printed edge (square corners, no outline; globals.css).
  const image = async (card: HTMLElement) => {
    const el = card.parentElement ?? card;
    el.dataset.capture = "";
    try {
      return await toJpeg(el, { quality: 0.95, pixelRatio: Math.max(2, 1400 / el.offsetWidth), backgroundColor: "#ffffff" });
    } finally {
      delete el.dataset.capture;
    }
  };

  let index = 0;
  for (const [p, page] of sheetPages(cards).entries()) {
    if (p > 0) pdf.addPage();
    for (const card of page) {
      const { x, y } = cardSlot(index++);
      pdf.addImage(await image(card), "JPEG", x, y, CARD.w, CARD.h);
    }
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.2);
    for (const m of cropMarks(page.length)) pdf.line(m.x1, m.y1, m.x2, m.y2);
  }
  pdf.save(filename);
}
