import { describe, expect, it } from "vitest";
import { formatPhone, isStandardPhone, maskPhone, MAX_PHONE_DIGITS, normalizePhone } from "./phone";
import { fillPhoneMask, formatPhoneInput, isCompleteNumber, looksStandard, MAX_KIOSK_DIGITS } from "./phone-mask";

describe("normalizePhone", () => {
  it("accepts Australian numbers in any common format", () => {
    expect(normalizePhone("0412345678")).toEqual({ e164: "+61412345678", standard: true });
    expect(normalizePhone("0412 345 678")).toEqual({ e164: "+61412345678", standard: true });
    expect(normalizePhone("+61 412 345 678")).toEqual({ e164: "+61412345678", standard: true });
    expect(normalizePhone("61412345678")).toEqual({ e164: "+61412345678", standard: true });
    expect(normalizePhone("(03) 6234 5678")).toEqual({ e164: "+61362345678", standard: true });
  });

  it("keeps non-standard numbers but flags them", () => {
    expect(normalizePhone("04123456")).toEqual({ e164: "+614123456", standard: false });
    expect(normalizePhone("0500000000")).toEqual({ e164: "+61500000000", standard: false });
    // Same digits always give the same key, so the customer is found next time.
    expect(normalizePhone("0500 000 000")?.e164).toBe(normalizePhone("0500000000")?.e164);
  });

  it("rejects implausible lengths", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("041234")).toBeNull();
    expect(normalizePhone("04123456789012345")).toBeNull();
    // 13–14 local digits used to pass here and then fail the database's 15-digit limit.
    expect(normalizePhone("1234567890123")).toBeNull();
    expect(normalizePhone("12345678901234")).toBeNull();
    expect(normalizePhone("+61412345678")?.e164).toBe("+61412345678");
  });
});

describe("display helpers", () => {
  it("formats and masks", () => {
    expect(formatPhone("+61412345678")).toBe("0412 345 678");
    expect(formatPhone("+61362345678")).toBe("(03) 6234 5678");
    expect(formatPhone("+61500000000")).toBe("0500 000 000");
    expect(maskPhone("+61412345678")).toBe("04•• ••• 678");
    expect(maskPhone("+61362345678")).toBe("03 •••• •678");
    expect(maskPhone("+447700900123")).toBe("44• ••• ••• 123");
  });

  it("fills the kiosk mask as digits are typed", () => {
    expect(fillPhoneMask("")).toEqual({ typed: "", rest: "____ ___ ___" });
    expect(fillPhoneMask("0412")).toEqual({ typed: "0412", rest: " ___ ___" });
    expect(fillPhoneMask("0412345678")).toEqual({ typed: "0412 345 678", rest: "" });
    expect(fillPhoneMask("0362345678")).toEqual({ typed: "03 6234 5678", rest: "" });
    expect(fillPhoneMask("041234567890")).toEqual({ typed: "0412 345 678 90", rest: "" });
  });

  it("needs at least 10 digits of a 0… number before Continue, 8 for overseas numbers", () => {
    expect(isCompleteNumber("041234567")).toBe(false);
    expect(isCompleteNumber("0412345678")).toBe(true);
    expect(isCompleteNumber("04123456789")).toBe(true);
    expect(isCompleteNumber("4477009")).toBe(false);
    expect(isCompleteNumber("44770090")).toBe(true);
  });

  it("guesses standard numbers on the client", () => {
    expect(looksStandard("0412345678")).toBe(true);
    expect(looksStandard("0362345678")).toBe(true);
    expect(looksStandard("04123456")).toBe(false);
    expect(looksStandard("0500111222")).toBe(false);
  });
});

describe("normalizePhone edge cases", () => {
  it("strips dashes, brackets and surrounding spaces (P-01)", () => {
    expect(normalizePhone("  0412-345-678  ")?.e164).toBe("+61412345678");
    expect(normalizePhone("61 3 6234 5678")?.e164).toBe("+61362345678");
    // A local number typed without its leading 0 is still Australian.
    expect(normalizePhone("412345678")).toEqual({ e164: "+61412345678", standard: true });
  });

  it("treats the fictional test range as a standard mobile", () => {
    expect(normalizePhone("0491 570 101")).toEqual({ e164: "+61491570101", standard: true });
  });

  it("keeps international numbers typed with + as they are", () => {
    expect(normalizePhone("+44 7700 900123")?.e164).toBe("+447700900123");
  });

  it("accepts the length limits exactly (P-03)", () => {
    expect(normalizePhone("12345678")?.e164).toBe("+6112345678"); // 8 digits: the minimum
    expect(normalizePhone("1234567")).toBeNull(); // 7 digits
    expect(normalizePhone("041234567890")?.standard).toBe(false); // 12 digits: the maximum, kept but flagged
  });

  it("never produces more than 15 digits, the database's limit", () => {
    for (const input of ["041234567890", "+61412345678901", "61412345678901", "123456789012"]) {
      const e164 = normalizePhone(input)?.e164;
      if (e164) expect(e164).toMatch(/^\+\d{8,15}$/);
    }
  });
});

describe("isStandardPhone", () => {
  it("agrees with libphonenumber for stored numbers", () => {
    expect(isStandardPhone("+61412345678")).toBe(true);
    expect(isStandardPhone("+61362345678")).toBe(true);
    expect(isStandardPhone("+61500000000")).toBe(false);
  });
});

describe("maskPhone privacy (P-04)", () => {
  const cases = ["+61491570101", "+61362345678", "+614123456", "+6141234567890", "+447700900123", "+6112345678"];

  it.each(cases)("only shows the first two and last three digits of %s", (e164) => {
    const local = e164.startsWith("+61") ? `0${e164.slice(3)}` : e164.slice(1);
    const masked = maskPhone(e164);
    const shown = masked.replace(/[^0-9]/g, "");
    expect(shown).toBe(local.slice(0, 2) + local.slice(-3));
    // Every hidden digit is replaced, none dropped, so the length still looks right.
    expect(masked.replace(/ /g, "")).toHaveLength(local.length);
  });

  it("masks the fictional test number the way the kiosk shows it", () => {
    expect(maskPhone("+61491570101")).toBe("04•• ••• 101");
  });
});

describe("formatPhone fallbacks", () => {
  it("groups an invalid Australian number like a mobile rather than showing +61", () => {
    expect(formatPhone("+614123456")).toBe("0412 345 6");
  });
});

describe("kiosk mask while typing (P-05)", () => {
  it("switches to landline grouping once 02, 03, 07 or 08 is typed", () => {
    expect(fillPhoneMask("03")).toEqual({ typed: "03", rest: " ____ ____" });
    expect(fillPhoneMask("0")).toEqual({ typed: "0", rest: "___ ___ ___" });
  });

  it("keeps going past 10 digits in groups of three", () => {
    expect(fillPhoneMask("12345678")).toEqual({ typed: "1234 567 8", rest: "__" });
  });
});

describe("client and server agree (P-07, P-08)", () => {
  it("uses the same digit limit on the kiosk as on the server", () => {
    expect(MAX_KIOSK_DIGITS).toBe(MAX_PHONE_DIGITS);
  });

  it.each(["0412345678", "0491570101", "0362345678", "0298765432", "0712345678", "0892345678", "1300123456", "1800123456", "0512345678", "04123456"])(
    "looksStandard(%s) matches normalizePhone().standard",
    (digits) => {
      expect(looksStandard(digits)).toBe(normalizePhone(digits)!.standard);
    },
  );

  it("needs at least 8 digits however the number starts (P-06)", () => {
    expect(isCompleteNumber("")).toBe(false);
    expect(isCompleteNumber("0".repeat(9))).toBe(false);
    expect(isCompleteNumber("041234567890")).toBe(true);
  });
});

describe("formatPhoneInput (client forms)", () => {
  it("shows Australian numbers in local groups, like formatPhone for mobiles", () => {
    expect(formatPhoneInput("+61412345678")).toBe("0412 345 678");
    expect(formatPhoneInput("+61412345678")).toBe(formatPhone("+61412345678"));
    expect(formatPhoneInput("+61362345678")).toBe("03 6234 5678");
  });

  it("leaves overseas numbers as stored", () => {
    expect(formatPhoneInput("+6421234567")).toBe("+6421234567");
  });
});
