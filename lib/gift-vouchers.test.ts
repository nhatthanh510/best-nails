import { describe, expect, it } from "vitest";
import {
  CODE_PREFIX_PATTERN,
  formatMoney,
  GIFT_VOUCHER_PROBLEMS,
  giftVoucherStatus,
  looksMistyped,
  normalizeGiftCode,
  parseDollars,
} from "./gift-vouchers";

/** Reference Luhn check digit (as `_luhn_check_digit` in SQL), to build valid codes in tests. */
function luhnDigit(digits: string) {
  let sum = 0;
  [...digits].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 0) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  });
  return String((10 - (sum % 10)) % 10);
}
const validCode = (prefix: string, seven: string) => `${prefix}${seven}${luhnDigit(seven)}`;

describe("parseDollars (M-01)", () => {
  it("reads whole and decimal dollar amounts as cents", () => {
    expect(parseDollars("65")).toBe(6500);
    expect(parseDollars("65.5")).toBe(6550);
    expect(parseDollars("$65.50")).toBe(6550);
    expect(parseDollars(" 1,000 ")).toBe(100000);
    expect(parseDollars("1,000.05")).toBe(100005);
    expect(parseDollars("0")).toBe(0);
  });

  it("doesn't pick up floating point errors", () => {
    expect(parseDollars("0.29")).toBe(29);
    expect(parseDollars("19.99")).toBe(1999);
    expect(parseDollars("4999.99")).toBe(499999);
  });

  it("rejects anything that isn't a dollar amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "$", ".5", "5.", "1.2.3", "5 0"]) expect(parseDollars(bad)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats cents as Australian dollars", () => {
    expect(formatMoney(6500)).toBe("$65.00");
    expect(formatMoney(150000)).toBe("$1,500.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
  });
});

describe("normalizeGiftCode (M-02)", () => {
  it("keeps only upper-case letters and digits, as the database does", () => {
    expect(normalizeGiftCode("bn-4820 7138")).toBe("BN48207138");
    expect(normalizeGiftCode(" qa_12.34 ")).toBe("QA1234");
    expect(normalizeGiftCode("   ")).toBe("");
  });
});

describe("looksMistyped (M-03)", () => {
  it("accepts generated codes whose check digit is right, however they're typed", () => {
    expect(looksMistyped("BN48207138")).toBe(false);
    expect(looksMistyped("bn 4820 7138")).toBe(false);
    expect(looksMistyped("bn-4820-7138")).toBe(false);
    expect(looksMistyped("TBH73159287")).toBe(false);
    expect(looksMistyped(validCode("ABCD", "1234567"))).toBe(false);
  });

  it("catches one wrong digit or two swapped digits", () => {
    expect(looksMistyped("BN48207139")).toBe(true);
    expect(looksMistyped("BN48207183")).toBe(true);
    expect(looksMistyped("BN84207138")).toBe(true);
  });

  it("catches every single-digit error in a generated code", () => {
    const code = validCode("BN", "4820713");
    const digits = code.slice(2);
    for (let i = 0; i < digits.length; i++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === digits[i]) continue;
        const typo = `BN${digits.slice(0, i)}${d}${digits.slice(i + 1)}`;
        expect(looksMistyped(typo), typo).toBe(true);
      }
    }
  });

  it("catches adjacent swaps except 0↔9, which Luhn can't see", () => {
    const code = validCode("BN", "1357924");
    const digits = code.slice(2);
    for (let i = 0; i < digits.length - 1; i++) {
      const [a, b] = [digits[i], digits[i + 1]];
      if (a === b || (a + b === "09" || a + b === "90")) continue;
      const swapped = `BN${digits.slice(0, i)}${b}${a}${digits.slice(i + 2)}`;
      expect(looksMistyped(swapped), swapped).toBe(true);
    }
  });

  it("leaves printed numbers and older codes alone", () => {
    expect(looksMistyped("PV004217")).toBe(false);
    expect(looksMistyped("BN7K3M9QX2")).toBe(false);
    expect(looksMistyped("ABCDE12345678")).toBe(false); // five-letter prefix: not a generated code
    expect(looksMistyped("BN123456789")).toBe(false); // nine digits: not a generated code
  });
});

describe("giftVoucherStatus (M-04)", () => {
  it("is expired after the expiry date, used up at $0, otherwise active", () => {
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-23" }, "2026-10-24")).toBe("expired");
    expect(giftVoucherStatus({ balance_cents: 0, expires_on: "2029-10-24" }, "2026-10-24")).toBe("used_up");
    expect(giftVoucherStatus({ balance_cents: 500, expires_on: "2026-10-24" }, "2026-10-24")).toBe("active");
  });

  it("calls a voucher expired even when it's also used up", () => {
    expect(giftVoucherStatus({ balance_cents: 0, expires_on: "2026-10-23" }, "2026-10-24")).toBe("expired");
  });
});

describe("constants", () => {
  it("allows 2 to 4 upper-case letters as the code prefix", () => {
    for (const ok of ["BN", "TBH", "ABCD"]) expect(CODE_PREFIX_PATTERN.test(ok)).toBe(true);
    for (const bad of ["B", "ABCDE", "bn", "B1", ""]) expect(CODE_PREFIX_PATTERN.test(bad)).toBe(false);
  });

  it("has a message for every reason a voucher can't be used", () => {
    expect(Object.keys(GIFT_VOUCHER_PROBLEMS).sort()).toEqual(["expired", "mistyped", "not_found", "used_up"]);
  });
});
