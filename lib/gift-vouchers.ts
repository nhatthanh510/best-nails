// Gift vouchers hold money, stored in cents. These helpers are shared by the admin pages and
// actions, and stay free of server-only imports.

/**
 * `inactive`: a blank card printed ahead of time and not sold yet, so it has no amount or expiry.
 * `blocked`: switched off by an admin (lost or stolen); its balance is kept until it's unblocked.
 */
export type GiftVoucherStatus = "inactive" | "active" | "used_up" | "expired" | "blocked";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/** 6500 → "$65.00". */
export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

/** "65", "65.5", "$65.50" or "1,000" → cents; null if it isn't a dollar amount. */
export function parseDollars(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  // Whole and fractional parts separately, so 0.29 doesn't become 28.999… cents.
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** As the database stores and compares codes: upper-case letters and digits only. */
export function normalizeGiftCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generated codes are a 2–4 letter business prefix + 7 digits + a Luhn check digit, e.g.
 * BN48207138 (`_new_gift_voucher_code`). True when a code has that shape but the check digit
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
export function giftVoucherStatus(
  v: { balance_cents: number; expires_on: string | null; blocked_at?: string | null },
  today: string,
): GiftVoucherStatus {
  if (v.expires_on === null) return "inactive";
  if (v.blocked_at) return "blocked";
  if (v.expires_on < today) return "expired";
  if (v.balance_cents === 0) return "used_up";
  return "active";
}

export const GIFT_VOUCHER_STATUS_LABELS: Record<GiftVoucherStatus, string> = {
  inactive: "Not sold",
  blocked: "Blocked",
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
};

/** Messages for check_gift_voucher / spend_gift_voucher statuses that mean "can't use it". */
export const GIFT_VOUCHER_PROBLEMS: Record<string, string> = {
  not_found: "No gift voucher has this code. Check it was typed correctly.",
  mistyped: "This code looks mistyped: one of the digits is probably wrong. Check it against the voucher.",
  used_up: "This gift voucher has no balance left.",
  expired: "This gift voucher has expired.",
  blocked: "This voucher is blocked (reported lost or stolen). An admin can unblock it on its page.",
  not_sold: "This voucher hasn't been sold yet. Create it with an amount first.",
};

/** Quick amounts on the sell form. */
export const GIFT_VOUCHER_PRESETS = [5000, 10000, 15000];
