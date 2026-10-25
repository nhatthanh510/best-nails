import { describe, expect, it } from "vitest";
import { nextTier, tierFor, tierRange, type Tier } from "./tiers";

const t = { tier_regular_points: 10, tier_vip_points: 20 };

describe("tiers (T-01)", () => {
  it("assigns tiers at the thresholds", () => {
    expect(tierFor(0, t)).toBe("new");
    expect(tierFor(9, t)).toBe("new");
    expect(tierFor(10, t)).toBe("regular");
    expect(tierFor(19, t)).toBe("regular");
    expect(tierFor(20, t)).toBe("vip");
  });

  it("follows custom thresholds from Settings", () => {
    const tight = { tier_regular_points: 1, tier_vip_points: 2 };
    expect([0, 1, 2, 50].map((n) => tierFor(n, tight))).toEqual(["new", "regular", "vip", "vip"]);
  });

  it("says how far the next tier is", () => {
    expect(nextTier(0, t)).toEqual({ tier: "regular", pointsToGo: 10 });
    expect(nextTier(7, t)).toEqual({ tier: "regular", pointsToGo: 3 });
    expect(nextTier(12, t)).toEqual({ tier: "vip", pointsToGo: 8 });
    expect(nextTier(19, t)).toEqual({ tier: "vip", pointsToGo: 1 });
    expect(nextTier(20, t)).toBeNull();
    expect(nextTier(25, t)).toBeNull();
  });

  it("gives lifetime-point ranges matching tierFor", () => {
    expect(tierRange("new", t)).toEqual({ min: 0, max: 10 });
    expect(tierRange("regular", t)).toEqual({ min: 10, max: 20 });
    expect(tierRange("vip", t)).toEqual({ min: 20, max: null });
  });

  it("puts every point total in exactly the range of its tier (T-02)", () => {
    const tiers: Tier[] = ["new", "regular", "vip"];
    for (let n = 0; n <= 40; n++) {
      const inRange = tiers.filter((tier) => {
        const { min, max } = tierRange(tier, t);
        return n >= min && (max === null || n < max);
      });
      expect(inRange).toEqual([tierFor(n, t)]);
    }
  });
});
