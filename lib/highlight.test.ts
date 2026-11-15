import { describe, expect, it } from "vitest";
import { giftCardSearchTerms, matchesShown, splitMatches } from "./highlight";

describe("splitMatches", () => {
  it("marks the part that matches, ignoring case", () => {
    expect(splitMatches("BN65791626", "6579")).toEqual([
      { text: "BN", match: false },
      { text: "6579", match: true },
      { text: "1626", match: false },
    ]);
    expect(splitMatches("Gina Gift", "gi")).toEqual([
      { text: "Gi", match: true },
      { text: "na ", match: false },
      { text: "Gi", match: true },
      { text: "ft", match: false },
    ]);
  });

  it("leaves the text whole when nothing matches", () => {
    expect(splitMatches("BN65791626", "")).toEqual([{ text: "BN65791626", match: false }]);
    expect(splitMatches("BN65791626", "zz")).toEqual([{ text: "BN65791626", match: false }]);
  });
});

describe("giftCardSearchTerms", () => {
  it("reads a code the way the list searches it", () => {
    expect(giftCardSearchTerms(" bn-6579 ")).toEqual({ code: "BN6579", name: "bn-6579" });
  });
});

describe("matchesShown", () => {
  it("matches a code (typed any way) or part of a name", () => {
    expect(matchesShown("BN38319158 BN23805914", "", "bn-383")).toBe(true);
    expect(matchesShown("BN38319158", "Gina Gift", "gin")).toBe(true);
    expect(matchesShown("BN38319158", "Gina Gift", "999")).toBe(false);
  });

  it("shows everything for an empty search", () => {
    expect(matchesShown("BN38319158", "", "  ")).toBe(true);
  });
});
