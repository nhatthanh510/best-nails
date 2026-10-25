import { describe, expect, it } from "vitest";
import { nextTier, tierFor, tierRange } from "./tiers";

const t = { tier_regular_points: 10, tier_vip_points: 20 };

describe("tiers", () => {
  it("assigns tiers at the thresholds", () => {
    expect(tierFor(0, t)).toBe("new");
    expect(tierFor(9, t)).toBe("new");
    expect(tierFor(10, t)).toBe("regular");
    expect(tierFor(19, t)).toBe("regular");
    expect(tierFor(20, t)).toBe("vip");
  });

  it("says how far the next tier is", () => {
    expect(nextTier(7, t)).toEqual({ tier: "regular", pointsToGo: 3 });
    expect(nextTier(12, t)).toEqual({ tier: "vip", pointsToGo: 8 });
    expect(nextTier(25, t)).toBeNull();
  });

  it("gives visit ranges matching tierFor", () => {
    expect(tierRange("new", t)).toEqual({ min: 0, max: 10 });
    expect(tierRange("regular", t)).toEqual({ min: 10, max: 20 });
    expect(tierRange("vip", t)).toEqual({ min: 20, max: null });
  });
});
