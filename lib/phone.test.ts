import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizePhone } from "./phone";
import { fillPhoneMask, isCompleteNumber, looksStandard } from "./phone-mask";

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
