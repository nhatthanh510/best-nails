import { describe, expect, it } from "vitest";
import { formatGiftCode, formatMoney, giftVoucherStatus, parseDollars } from "./gift-vouchers";

describe("parseDollars", () => {
  it("reads whole and decimal dollar amounts as cents", () => {
    expect(parseDollars("65")).toBe(6500);
    expect(parseDollars("65.5")).toBe(6550);
    expect(parseDollars("$65.50")).toBe(6550);
    expect(parseDollars(" 1,000 ")).toBe(100000);
  });

  it("doesn't pick up floating point errors", () => {
    expect(parseDollars("0.29")).toBe(29);
    expect(parseDollars("19.99")).toBe(1999);
  });

  it("rejects anything that isn't a dollar amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "$"]) expect(parseDollars(bad)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats cents as Australian dollars", () => {
    expect(formatMoney(6500)).toBe("$65.00");
    expect(formatMoney(150000)).toBe("$1,500.00");
  });
});

describe("formatGiftCode", () => {
  it("groups generated codes, whatever the business prefix", () => {
    expect(formatGiftCode("BN7K3M9QX2")).toBe("BN-7K3M-9QX2");
    expect(formatGiftCode("TBH7K3M9QX2")).toBe("TBH-7K3M-9QX2");
    expect(formatGiftCode("GV7K3M9QX2")).toBe("GV-7K3M-9QX2");
  });

  it("leaves printed numbers alone", () => {
    expect(formatGiftCode("PV004217")).toBe("PV004217");
    expect(formatGiftCode("0412345678")).toBe("0412345678");
  });
});

describe("giftVoucherStatus", () => {
  it("is expired after the expiry date, used up at $0, otherwise active", () => {
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-23" }, "2026-10-24")).toBe("expired");
    expect(giftVoucherStatus({ balance_cents: 0, expires_on: "2029-10-24" }, "2026-10-24")).toBe("used_up");
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-24" }, "2026-10-24")).toBe("active");
  });
});
