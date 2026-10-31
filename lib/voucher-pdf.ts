/**
 * Gift vouchers as a PDF, for a shop without a printer: download it and print it elsewhere. Each
 * card (a VoucherCard on the page, so the PDF matches the screen exactly) becomes a sharp image,
 * laid out on A4 like the printed sheet (globals.css, #print-root[data-sheet]): 2 × 5 cards with a
 * gap to cut between. A single voucher is one larger card at the top of the page. The libraries
 * load only when someone downloads.
 */

// Shared with the print layout in globals.css: keep them in step.
export const SHEET = { cardMm: 80, ratio: 1.7, colGapMm: 12, rowGapMm: 8, cols: 2, rows: 5 };
const SINGLE_MM = 120;
const A4 = { w: 210, h: 297 };

export async function downloadVoucherPdf(cards: HTMLElement[], filename: string) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // About 400 dpi at the printed size, so the QR codes scan. The card's wrapper is captured, so the
  // white background only fills behind its rounded corners (JPEG has no transparency).
  const image = (card: HTMLElement) => {
    const el = card.parentElement ?? card;
    return toJpeg(el, { quality: 0.95, pixelRatio: Math.max(2, 1400 / el.offsetWidth), backgroundColor: "#ffffff" });
  };

  if (cards.length === 1) {
    const h = SINGLE_MM / SHEET.ratio;
    pdf.addImage(await image(cards[0]), "JPEG", (A4.w - SINGLE_MM) / 2, 25, SINGLE_MM, h);
  } else {
    const h = SHEET.cardMm / SHEET.ratio;
    const perPage = SHEET.cols * SHEET.rows;
    const left = (A4.w - (SHEET.cols * SHEET.cardMm + (SHEET.cols - 1) * SHEET.colGapMm)) / 2;
    const top = (A4.h - (SHEET.rows * h + (SHEET.rows - 1) * SHEET.rowGapMm)) / 2;
    for (const [i, card] of cards.entries()) {
      if (i > 0 && i % perPage === 0) pdf.addPage();
      const slot = i % perPage;
      const x = left + (slot % SHEET.cols) * (SHEET.cardMm + SHEET.colGapMm);
      const y = top + Math.floor(slot / SHEET.cols) * (h + SHEET.rowGapMm);
      pdf.addImage(await image(card), "JPEG", x, y, SHEET.cardMm, h);
    }
  }
  pdf.save(filename);
}
