/**
 * The A4 sheet gift cards print on, shared by printing (`printGiftCardNodes`) and the PDF
 * (`downloadGiftCardPdf`) so they cut the same. Cards are credit-card size (CR80, 85.6 × 54 mm, as
 * shop gift cards are: they fit a wallet's card slot and gift card sleeves), 2 × 5 to a page,
 * touching, with crop marks in the margin: each cut separates two cards, so a full page takes 3
 * cuts down and 6 across. A page with fewer cards keeps the same slots. Everything is in mm from the
 * page's top-left corner.
 */

export const A4 = { w: 210, h: 297 };
export const CARD = { w: 85.6, h: 54 };
export const SHEET = { cols: 2, rows: 5, perPage: 10 };

const ORIGIN = { x: (A4.w - SHEET.cols * CARD.w) / 2, y: (A4.h - SHEET.rows * CARD.h) / 2 };
/** A crop mark starts this far from the cards and is this long, so it stays clear of the cut card. */
const MARK = { gap: 2, length: 5 };

const mm = (n: number) => Math.round(n * 100) / 100;

/** Where card `index` (0-based, across all pages) sits on its page. */
export function cardSlot(index: number) {
  const slot = index % SHEET.perPage;
  return { x: mm(ORIGIN.x + (slot % SHEET.cols) * CARD.w), y: mm(ORIGIN.y + Math.floor(slot / SHEET.cols) * CARD.h) };
}

/** The items split into pages of a sheet each. */
export function sheetPages<T>(items: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += SHEET.perPage) pages.push(items.slice(i, i + SHEET.perPage));
  return pages;
}

export type CropMark = { x1: number; y1: number; x2: number; y2: number };

/** Crop marks for a page holding `count` cards: one at each end of every cut line, outside the cards. */
export function cropMarks(count: number): CropMark[] {
  if (count <= 0) return [];
  const cols = Math.min(count, SHEET.cols);
  const rows = Math.min(Math.ceil(count / SHEET.cols), SHEET.rows);
  const left = ORIGIN.x;
  const top = ORIGIN.y;
  const right = left + cols * CARD.w;
  const bottom = top + rows * CARD.h;
  const near = MARK.gap;
  const far = MARK.gap + MARK.length;
  const marks: CropMark[] = [];
  for (let c = 0; c <= cols; c++) {
    const x = left + c * CARD.w;
    marks.push({ x1: x, y1: top - far, x2: x, y2: top - near }, { x1: x, y1: bottom + near, x2: x, y2: bottom + far });
  }
  for (let r = 0; r <= rows; r++) {
    const y = top + r * CARD.h;
    marks.push({ x1: left - far, y1: y, x2: left - near, y2: y }, { x1: right + near, y1: y, x2: right + far, y2: y });
  }
  return marks.map(({ x1, y1, x2, y2 }) => ({ x1: mm(x1), y1: mm(y1), x2: mm(x2), y2: mm(y2) }));
}
