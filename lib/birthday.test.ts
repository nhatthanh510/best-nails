import { describe, expect, it } from "vitest";
import { isBirthdayOn, isValidBirthday } from "./birthday";

describe("isValidBirthday", () => {
  it("accepts real dates including 29 February", () => {
    expect(isValidBirthday(2, 29)).toBe(true);
    expect(isValidBirthday(12, 31)).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(isValidBirthday(2, 30)).toBe(false);
    expect(isValidBirthday(4, 31)).toBe(false);
    expect(isValidBirthday(13, 1)).toBe(false);
  });
});

describe("isBirthdayOn", () => {
  it("celebrates 29 February on 28 February in other years", () => {
    expect(isBirthdayOn(2, 29, 2027, 2, 28)).toBe(true);
    expect(isBirthdayOn(2, 29, 2028, 2, 28)).toBe(false);
    expect(isBirthdayOn(2, 29, 2028, 2, 29)).toBe(true);
  });
});
