import { describe, expect, it } from "vitest";
import { generatePassword, MIN_PASSWORD } from "./accounts";

describe("generatePassword (F-03)", () => {
  it("is long enough to pass the minimum", () => {
    expect(generatePassword()).toHaveLength(10);
    expect(generatePassword().length).toBeGreaterThanOrEqual(MIN_PASSWORD);
    expect(generatePassword(16)).toHaveLength(16);
  });

  it("never uses characters that are easy to misread aloud or on paper", () => {
    const sample = Array.from({ length: 200 }, () => generatePassword(20)).join("");
    expect(sample).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]+$/);
    expect(sample).not.toMatch(/[0O1lI]/);
  });

  it("is different each time", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(set.size).toBe(50);
  });
});
