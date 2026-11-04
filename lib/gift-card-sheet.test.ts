import { describe, expect, it } from "vitest";
import { A4, CARD, cardSlot, cropMarks, sheetPages } from "./gift-card-sheet";

describe("gift card sheet", () => {
  it("centres 2 × 5 credit-card-size cards on A4, touching", () => {
    expect(cardSlot(0)).toEqual({ x: 19.4, y: 13.5 });
    expect(cardSlot(1)).toEqual({ x: 105, y: 13.5 });
    expect(cardSlot(9)).toEqual({ x: 105, y: 229.5 });
    // The last card ends inside the page, with the same margin as the first.
    expect(cardSlot(9).x + CARD.w).toBeCloseTo(A4.w - 19.4);
    expect(cardSlot(9).y + CARD.h).toBeCloseTo(A4.h - 13.5);
  });

  it("starts every page at the first slot", () => {
    expect(cardSlot(10)).toEqual(cardSlot(0));
    expect(sheetPages([...Array(23).keys()]).map((p) => p.length)).toEqual([10, 10, 3]);
  });

  it("puts a crop mark at both ends of every cut line, inside the page and off the cards", () => {
    // A full page: 3 vertical and 6 horizontal cut lines.
    const full = cropMarks(10);
    expect(full).toHaveLength(3 * 2 + 6 * 2);
    for (const m of full) {
      expect(Math.min(m.x1, m.x2)).toBeGreaterThanOrEqual(0);
      expect(Math.max(m.x1, m.x2)).toBeLessThanOrEqual(A4.w);
      expect(Math.min(m.y1, m.y2)).toBeGreaterThanOrEqual(0);
      expect(Math.max(m.y1, m.y2)).toBeLessThanOrEqual(A4.h);
      const insideCards = m.x1 > 19.4 && m.x2 < 190.6 && m.y1 > 13.5 && m.y2 < 283.5;
      expect(insideCards).toBe(false);
    }
    // One card: its own four edges only.
    expect(cropMarks(1)).toHaveLength(2 * 2 + 2 * 2);
    expect(cropMarks(0)).toEqual([]);
  });
});
