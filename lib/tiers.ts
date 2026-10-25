export type Tier = "new" | "regular" | "vip";

export type TierThresholds = { tier_regular_points: number; tier_vip_points: number };

export const TIER_LABELS: Record<Tier, string> = { new: "New", regular: "Regular", vip: "VIP" };

/**
 * Tiers come from lifetime points (everything earned, from check-ins and points added by hand),
 * not visits, so a forgotten visit made up with Adjust points still moves the tier.
 */
export function tierFor(lifetimePoints: number, t: TierThresholds): Tier {
  if (lifetimePoints >= t.tier_vip_points) return "vip";
  if (lifetimePoints >= t.tier_regular_points) return "regular";
  return "new";
}

/** The next tier and how many points away it is, or null at the top tier. */
export function nextTier(lifetimePoints: number, t: TierThresholds): { tier: Tier; pointsToGo: number } | null {
  if (lifetimePoints < t.tier_regular_points) return { tier: "regular", pointsToGo: t.tier_regular_points - lifetimePoints };
  if (lifetimePoints < t.tier_vip_points) return { tier: "vip", pointsToGo: t.tier_vip_points - lifetimePoints };
  return null;
}

/** lifetime_points range [min, max) for a tier, used to filter customers in the database. */
export function tierRange(tier: Tier, t: TierThresholds): { min: number; max: number | null } {
  if (tier === "vip") return { min: t.tier_vip_points, max: null };
  if (tier === "regular") return { min: t.tier_regular_points, max: t.tier_vip_points };
  return { min: 0, max: t.tier_regular_points };
}
