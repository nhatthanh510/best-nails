import { describe, expect, it } from "vitest";
import { formatMoney, giftVoucherStatus, looksMistyped, parseDollars } from "./gift-vouchers";

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

describe("looksMistyped", () => {
  it("accepts generated codes whose check digit is right, however they're typed", () => {
    expect(looksMistyped("BN48207138")).toBe(false);
    expect(looksMistyped("bn 4820 7138")).toBe(false);
    expect(looksMistyped("TBH73159287")).toBe(false);
  });

  it("catches one wrong digit or two swapped digits", () => {
    expect(looksMistyped("BN48207139")).toBe(true);
    expect(looksMistyped("BN48207183")).toBe(true);
    expect(looksMistyped("BN84207138")).toBe(true);
  });

  it("leaves printed numbers and older codes alone", () => {
    expect(looksMistyped("PV004217")).toBe(false);
    expect(looksMistyped("BN7K3M9QX2")).toBe(false);
  });
});

describe("giftVoucherStatus", () => {
  it("is expired after the expiry date, used up at $0, otherwise active", () => {
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-23" }, "2026-10-24")).toBe("expired");
    expect(giftVoucherStatus({ balance_cents: 0, expires_on: "2029-10-24" }, "2026-10-24")).toBe("used_up");
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-24" }, "2026-10-24")).toBe("active");
  });
});
