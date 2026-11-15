// Gift cards hold money, stored in cents. These helpers are shared by the admin pages and
// actions, and stay free of server-only imports.

/**
 * `inactive`: a blank card printed ahead of time and not sold yet, so it has no amount or expiry.
 * `blocked`: switched off by an admin (lost or stolen); its balance is kept until it's unblocked.
 */
export type GiftCardStatus = "inactive" | "active" | "used_up" | "expired" | "blocked";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/** 6500 → "$65.00". For amounts that can have cents (balances, uses), so a column lines up. */
export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

const wholeMoney = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

/**
 * 15000 → "$150", 6550 → "$65.50": no pointless ".00". For amounts that are whole dollars by rule
 * (what a gift card is created, activated or topped up with, and what's been loaded on it) and for
 * totals that stand on their own (Unused credit, "Paid with gift cards"); figures in a column that
 * can have cents (balances, uses, history) keep formatMoney, so they line up.
 */
export function formatDollars(cents: number) {
  return cents % 100 === 0 ? wholeMoney.format(cents / 100) : money.format(cents / 100);
}

/** "65", "65.5", "$65.50" or "1,000" → cents; null if it isn't a dollar amount. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  // Whole and fractional parts separately, so 0.29 doesn't become 28.999… cents.
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/**
 * The earliest expiry a gift card created today may have: 3 years from today in the shop's
 * timezone (Australian Consumer Law), as YYYY-MM-DD. A 29 Feb today gives 28 Feb, as Postgres does.
 * It's the forms' default and minimum; the database checks it again with the shop's own timezone.
 */
export function minGiftCardExpiry(timeZone = "Australia/Hobart", now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-");
  return `${Number(y) + 3}-${m}-${m === "02" && d === "29" ? "28" : d}`;
}

/** As the database stores and compares codes: upper-case letters and digits only. */
export function normalizeGiftCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generated codes are a 2–4 letter business prefix + 7 digits + a Luhn check digit, e.g.
 * BN48207138 (`_new_gift_card_code`). True when a code has that shape but the check digit
 * is wrong: almost certainly a typo (one wrong digit, or two swapped) rather than another code.
 */
export function looksMistyped(input: string) {
  const m = /^[A-Z]{2,4}(\d{8})$/.exec(normalizeGiftCode(input));
  if (!m) return false;
  let sum = 0;
  [...m[1]].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  });
  return sum % 10 !== 0;
}

/** The owner's business prefix for generated codes: 2 to 4 letters, e.g. BN for Best Nails. */
export const CODE_PREFIX_PATTERN = /^[A-Z]{2,4}$/;

/** `today` is YYYY-MM-DD in the shop's timezone. */
export function giftCardStatus(
  v: { balance_cents: number; sold_on: string | null; expires_on: string | null; blocked_at?: string | null },
  today: string,
): GiftCardStatus {
  // Not sold yet (a blank card): it gets its expiry when it's activated.
  if (v.sold_on === null || v.expires_on === null) return "inactive";
  if (v.blocked_at) return "blocked";
  if (v.expires_on < today) return "expired";
  if (v.balance_cents === 0) return "used_up";
  return "active";
}

export const GIFT_CARD_STATUS_LABELS: Record<GiftCardStatus, string> = {
  inactive: "Not sold",
  blocked: "Blocked",
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
};

/** Messages for check_gift_card / spend_gift_card statuses that mean "can't use it". */
export const GIFT_CARD_PROBLEMS: Record<string, string> = {
  not_found: "No gift card has this code. Check it was typed correctly.",
  mistyped: "This code looks mistyped: one of the digits is probably wrong. Check it against the gift card.",
  used_up: "This gift card has no balance left.",
  expired: "This gift card has expired.",
  blocked: "This gift card is blocked (reported lost or stolen). An admin can unblock it on its page.",
  not_sold: "This blank card hasn't been activated yet. Activate it with the amount the customer pays first.",
};

/** Quick amounts on the sell form. */
export const GIFT_CARD_PRESETS = [5000, 10000, 15000];
