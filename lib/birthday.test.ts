import { describe, expect, it } from "vitest";
import { daysInMonth, isBirthdayOn, isValidBirthday } from "./birthday";

describe("daysInMonth", () => {
  it("allows 29 days in February and follows the calendar otherwise", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(daysInMonth)).toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });
});

describe("isValidBirthday", () => {
  it("accepts real dates including 29 February", () => {
    expect(isValidBirthday(2, 29)).toBe(true);
    expect(isValidBirthday(12, 31)).toBe(true);
    expect(isValidBirthday(1, 1)).toBe(true);
  });
  it("rejects impossible dates (B-06)", () => {
    expect(isValidBirthday(2, 30)).toBe(false);
    expect(isValidBirthday(4, 31)).toBe(false);
    expect(isValidBirthday(13, 1)).toBe(false);
    expect(isValidBirthday(0, 1)).toBe(false);
    expect(isValidBirthday(1, 0)).toBe(false);
    expect(isValidBirthday(1.5, 1)).toBe(false);
    expect(isValidBirthday(1, Number.NaN)).toBe(false);
  });
});

describe("isBirthdayOn (B-05)", () => {
  it("celebrates 29 February on 28 February in other years", () => {
    expect(isBirthdayOn(2, 29, 2027, 2, 28)).toBe(true);
    expect(isBirthdayOn(2, 29, 2028, 2, 28)).toBe(false);
    expect(isBirthdayOn(2, 29, 2028, 2, 29)).toBe(true);
  });
  it("follows the century rule for leap years", () => {
    expect(isBirthdayOn(2, 29, 2100, 2, 28)).toBe(true); // 2100 isn't a leap year
    expect(isBirthdayOn(2, 29, 2000, 2, 28)).toBe(false); // 2000 is
  });
  it("only matches the same day and month", () => {
    expect(isBirthdayOn(10, 27, 2026, 10, 27)).toBe(true);
    expect(isBirthdayOn(10, 27, 2026, 11, 27)).toBe(false);
    expect(isBirthdayOn(10, 27, 2026, 10, 26)).toBe(false);
    // Only 29 Feb moves; a 28 Feb birthday isn't also celebrated on the 29th.
    expect(isBirthdayOn(2, 28, 2028, 2, 29)).toBe(false);
  });
});
