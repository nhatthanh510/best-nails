import { describe, expect, it } from "vitest";
import { BLEED, cardPage, GIFT_CARD_FORMATS, isGiftCardFormat } from "./gift-card-sheet";

describe("gift card formats", () => {
  it("are a 90 × 55 mm business card and a landscape A6 promo card", () => {
    expect(GIFT_CARD_FORMATS.business.card).toEqual({ w: 90, h: 55 });
    expect(GIFT_CARD_FORMATS.a6.card).toEqual({ w: 148, h: 105 });
  });

  it("print one card per page, the card plus a 2 mm bleed on every side", () => {
    expect(BLEED).toBe(2);
    expect(cardPage("business")).toEqual({ w: 94, h: 59 });
    expect(cardPage("a6")).toEqual({ w: 152, h: 109 });
  });

  it("recognises only the two formats", () => {
    expect(isGiftCardFormat("business")).toBe(true);
    expect(isGiftCardFormat("a6")).toBe(true);
    expect(isGiftCardFormat("a4")).toBe(false);
    expect(isGiftCardFormat(null)).toBe(false);
  });
});
