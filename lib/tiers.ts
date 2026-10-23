export type Tier = "new" | "regular" | "vip";

export type TierThresholds = { tier_regular_visits: number; tier_vip_visits: number };

export const TIER_LABELS: Record<Tier, string> = { new: "New", regular: "Regular", vip: "VIP" };

export function tierFor(visits: number, t: TierThresholds): Tier {
  if (visits >= t.tier_vip_visits) return "vip";
  if (visits >= t.tier_regular_visits) return "regular";
  return "new";
}

/** The next tier and how many visits away it is, or null at the top tier. */
export function nextTier(visits: number, t: TierThresholds): { tier: Tier; visitsToGo: number } | null {
  if (visits < t.tier_regular_visits) return { tier: "regular", visitsToGo: t.tier_regular_visits - visits };
  if (visits < t.tier_vip_visits) return { tier: "vip", visitsToGo: t.tier_vip_visits - visits };
  return null;
}

/** visit_count range [min, max) for a tier, used to filter customers in the database. */
export function tierRange(tier: Tier, t: TierThresholds): { min: number; max: number | null } {
  if (tier === "vip") return { min: t.tier_vip_visits, max: null };
  if (tier === "regular") return { min: t.tier_regular_visits, max: t.tier_vip_visits };
  return { min: 0, max: t.tier_regular_visits };
}
