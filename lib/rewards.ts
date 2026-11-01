import type { Database } from "@/lib/database.types";
import { TIER_LABELS, type Tier } from "@/lib/tiers";

export type Reward = Database["public"]["Tables"]["promotions"]["Row"];

export type DiscountKind = Database["public"]["Enums"]["discount_kind"];

/** A discount as the database records it: exactly one of a percent or an amount in cents. */
export type Discount = { percent?: number | null; amount_cents?: number | null };

/** "10% off" or "$20 off" ("$7.50 off" with cents). Null when there's no discount. */
export function discountLabel(d: Discount): string | null {
  if (d.percent) return `${d.percent}% off`;
  if (d.amount_cents) return `${dollars(d.amount_cents)} off`;
  return null;
}

/**
 * A points reward's amounts: `discountCents` (e.g. $10 off), and `cashDiscountCents` (e.g. $30 off)
 * when at least `cost` of the visits since the customer's last points reward were paid in cash.
 * Both null for a reward described only by its title ("Free nail art").
 */
export type RewardAmounts = { cost: number; discountCents: number | null; cashDiscountCents: number | null };

/** The reward pays more for cash visits (both amounts set, cash bigger). */
export function hasCashBonus(r: RewardAmounts): boolean {
  return r.discountCents != null && r.cashDiscountCents != null && r.cashDiscountCents > r.discountCents;
}

/** What the reward is worth to a customer with `cashVisits` cash visits since their last points reward (cents), or null for a title-only reward. Mirrors `_reward_value` in SQL. */
export function rewardValueCents(r: RewardAmounts, cashVisits: number): number | null {
  if (r.discountCents == null) return null;
  return r.cashDiscountCents != null && cashVisits >= r.cost ? r.cashDiscountCents : r.discountCents;
}

/** The reward's name for a customer: "$30 off" / "$10 off" from its amounts, or its title. */
export function rewardName(r: RewardAmounts & { title: string }, cashVisits: number): string {
  const cents = rewardValueCents(r, cashVisits);
  return cents ? `${dollars(cents)} off` : r.title;
}

/**
 * The cash rule in one line, stated as information rather than a push to pay cash, e.g. "$10 off
 * after 7 visits, or $30 off when all 7 are paid in cash". Null when the reward doesn't pay more
 * for cash.
 */
export function cashBonusLine(r: RewardAmounts): string | null {
  if (!hasCashBonus(r)) return null;
  const all = r.cost === 1 ? "it's" : `all ${r.cost} are`;
  return `${dollars(r.discountCents!)} off after ${r.cost} visit${r.cost === 1 ? "" : "s"}, or ${dollars(r.cashDiscountCents!)} off when ${all} paid in cash`;
}

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/**
 * What the kiosk advertises when the birthday discount depends on the tier: the one discount when
 * every tier gets the same, "up to" the best when they're all percents or all amounts, and null
 * (a plain "birthday discount") when they mix. Tiers with none are left out.
 */
export function birthdayOffer(tiers: { kind: DiscountKind; value: number }[]): string | null {
  const offered = tiers.filter((t) => t.value > 0);
  if (offered.length === 0) return null;
  const kinds = new Set(offered.map((t) => t.kind));
  if (kinds.size > 1) return null;
  const best = Math.max(...offered.map((t) => t.value));
  const label = discountLabel(offered[0].kind === "percent" ? { percent: best } : { amount_cents: best });
  const same = offered.length === tiers.length && new Set(offered.map((t) => t.value)).size === 1;
  return same ? label : `up to ${label}`;
}

export type TierDiscount = { tier: Tier; kind: DiscountKind; value: number };

/**
 * The kiosk's birthday line, written to get customers visiting more: the starting discount, the
 * top tier's, and which tiers to reach for more. E.g. "10% off on your birthday — up to 15% off
 * for VIPs" with "Visit more to reach Regular and VIP for a bigger birthday treat.". `tiers` in
 * order New, Regular, VIP; null when no tier gets one.
 */
export function birthdayPitch(tiers: TierDiscount[]): { headline: string; nudge: string | null } | null {
  const offered = tiers.filter((t) => t.value > 0);
  if (offered.length === 0) return null;
  const label = (t: TierDiscount) => discountLabel(t.kind === "percent" ? { percent: t.value } : { amount_cents: t.value });
  const plural = (t: TierDiscount) => `${TIER_LABELS[t.tier]}s`;
  const first = offered[0];
  const top = offered[offered.length - 1];
  const better = (t: TierDiscount) => t.kind !== first.kind || t.value > first.value;

  let headline = `${label(first)} on your birthday`;
  if (first.tier !== "new") headline += ` for ${plural(first)}`;
  if (better(top)) headline += ` — ${top.kind === first.kind ? "up to " : ""}${label(top)} for ${plural(top)}`;

  // The tiers to reach: those that give more than New customers get (any that give one, when New
  // customers get none).
  const newGetsOne = first.tier === "new";
  const reach = offered.filter((t) => t.tier !== "new" && (!newGetsOne || better(t))).map((t) => TIER_LABELS[t.tier]);
  const nudge = reach.length ? `Visit more to reach ${reach.join(" and ")} for a ${newGetsOne ? "bigger " : ""}birthday treat.` : null;
  return { headline, nudge };
}

/** Result of the _birthday_status SQL function. */
export type BirthdayStatus = {
  enabled: boolean;
  has_birthday: boolean;
  eligible: boolean;
  birthday?: string;
  days_away?: number;
  in_window?: boolean;
  used?: boolean;
  /** Under 2 lifetime points: it starts from their second visit. */
  too_new?: boolean;
  /** The customer's tier's discount: one of these, both null when their tier has none. */
  percent?: number | null;
  amount_cents?: number | null;
  window_days?: number;
};

/** "Birthday week" when the window is about a week either side, else "within N days of your birthday". */
export function birthdayWindowLabel(days: number) {
  if (days === 0) return "on your birthday";
  if (days === 7) return "in your birthday week";
  return `within ${days} day${days === 1 ? "" : "s"} of your birthday`;
}
