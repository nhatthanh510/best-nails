import { describe, expect, it } from "vitest";
import { birthdayOffer, birthdayPitch, birthdayWindowLabel, cashBonusLine, discountLabel, hasCashBonus, rewardName, rewardValueCents } from "./rewards";

describe("birthdayWindowLabel", () => {
  it("names the window the way the kiosk says it", () => {
    expect(birthdayWindowLabel(0)).toBe("on your birthday");
    expect(birthdayWindowLabel(7)).toBe("in your birthday week");
    expect(birthdayWindowLabel(3)).toBe("within 3 days of your birthday");
    expect(birthdayWindowLabel(1)).toBe("within 1 day of your birthday");
    expect(birthdayWindowLabel(31)).toBe("within 31 days of your birthday");
  });
});

describe("discountLabel", () => {
  it("shows a percent or a dollar amount, with cents only when there are some", () => {
    expect(discountLabel({ percent: 10 })).toBe("10% off");
    expect(discountLabel({ amount_cents: 2000 })).toBe("$20 off");
    expect(discountLabel({ amount_cents: 750 })).toBe("$7.50 off");
    expect(discountLabel({ percent: null, amount_cents: null })).toBeNull();
  });
});

describe("birthdayOffer", () => {
  const p = (value: number) => ({ kind: "percent" as const, value });
  const a = (value: number) => ({ kind: "amount" as const, value });

  it("names the one discount when every tier gets it", () => {
    expect(birthdayOffer([p(10), p(10), p(10)])).toBe("10% off");
    expect(birthdayOffer([a(2000), a(2000), a(2000)])).toBe("$20 off");
  });

  it("says up to the best one when tiers differ", () => {
    expect(birthdayOffer([p(10), p(15), p(20)])).toBe("up to 20% off");
    expect(birthdayOffer([p(0), p(10), p(10)])).toBe("up to 10% off");
    expect(birthdayOffer([a(1000), a(2500), p(0)])).toBe("up to $25 off");
  });

  it("gives nothing to advertise when percents and amounts mix, or no tier gets one", () => {
    expect(birthdayOffer([p(10), a(2000), p(10)])).toBeNull();
    expect(birthdayOffer([p(0), a(0), p(0)])).toBeNull();
  });
});

describe("birthdayPitch", () => {
  const tiers = (n: [string, number], r: [string, number], v: [string, number]) =>
    (
      [
        ["new", n],
        ["regular", r],
        ["vip", v],
      ] as const
    ).map(([tier, [kind, value]]) => ({ tier, kind: kind as "percent" | "amount", value }));

  it("names the top tier's discount and the tiers to reach", () => {
    expect(birthdayPitch(tiers(["percent", 10], ["percent", 10], ["percent", 15]))).toEqual({
      headline: "10% off on your birthday — up to 15% off for VIPs",
      nudge: "Visit more to reach VIP for a bigger birthday treat.",
    });
    expect(birthdayPitch(tiers(["percent", 10], ["percent", 12], ["percent", 15]))).toEqual({
      headline: "10% off on your birthday — up to 15% off for VIPs",
      nudge: "Visit more to reach Regular and VIP for a bigger birthday treat.",
    });
    expect(birthdayPitch(tiers(["percent", 10], ["percent", 10], ["amount", 3000]))).toEqual({
      headline: "10% off on your birthday — $30 off for VIPs",
      nudge: "Visit more to reach VIP for a bigger birthday treat.",
    });
  });

  it("is just the discount when every tier gets the same", () => {
    expect(birthdayPitch(tiers(["percent", 10], ["percent", 10], ["percent", 10]))).toEqual({ headline: "10% off on your birthday", nudge: null });
  });

  it("says who it's for when New customers get none", () => {
    expect(birthdayPitch(tiers(["percent", 0], ["percent", 10], ["percent", 15]))).toEqual({
      headline: "10% off on your birthday for Regulars — up to 15% off for VIPs",
      nudge: "Visit more to reach Regular and VIP for a birthday treat.",
    });
    expect(birthdayPitch(tiers(["percent", 0], ["percent", 0], ["amount", 2000]))).toEqual({
      headline: "$20 off on your birthday for VIPs",
      nudge: "Visit more to reach VIP for a birthday treat.",
    });
    expect(birthdayPitch(tiers(["percent", 0], ["percent", 0], ["percent", 0]))).toBeNull();
  });
});

describe("cash bonus reward", () => {
  const cash = { title: "Loyalty reward", cost: 7, discountCents: 1000, cashDiscountCents: 3000 };
  const titleOnly = { title: "Free nail art", cost: 7, discountCents: null, cashDiscountCents: null };

  it("gives the cash amount from the reward's points in cash visits, the other amount below that", () => {
    expect(rewardValueCents(cash, 7)).toBe(3000);
    expect(rewardValueCents(cash, 9)).toBe(3000);
    expect(rewardValueCents(cash, 6)).toBe(1000);
    expect(rewardValueCents(titleOnly, 7)).toBeNull();
  });

  it("names the reward by what it's worth, or by its title", () => {
    expect(rewardName(cash, 7)).toBe("$30 off");
    expect(rewardName(cash, 0)).toBe("$10 off");
    expect(rewardName(titleOnly, 7)).toBe("Free nail art");
  });

  it("explains the rule only when cash pays more", () => {
    expect(hasCashBonus(cash)).toBe(true);
    expect(cashBonusLine(cash)).toBe("$10 off after 7 visits, or $30 off when all 7 are paid in cash");
    expect(cashBonusLine({ ...cash, cost: 1 })).toBe("$10 off after 1 visit, or $30 off when it's paid in cash");
    expect(hasCashBonus({ ...cash, cashDiscountCents: 1000 })).toBe(false);
    expect(cashBonusLine(titleOnly)).toBeNull();
  });
});
