import { describe, expect, it } from "vitest";
import { cleanNumber } from "./number-input";

describe("cleanNumber (F-02)", () => {
  it("keeps only digits", () => {
    expect(cleanNumber("digits", "a1b2 3-4")).toBe("1234");
    expect(cleanNumber("digits", "1e3")).toBe("13");
  });

  it("keeps one decimal point and at most two decimals for money", () => {
    expect(cleanNumber("money", "$1,000.5")).toBe("1000.5");
    expect(cleanNumber("money", "12.345")).toBe("12.34");
    expect(cleanNumber("money", "1.2.3")).toBe("1.23");
    expect(cleanNumber("money", "-5")).toBe("5");
  });

  it("keeps what people type in phone numbers", () => {
    expect(cleanNumber("phone", "+61 (0) 412-345 abc")).toBe("+61 (0) 412-345 ");
  });
});
