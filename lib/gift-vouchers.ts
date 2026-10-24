// Gift vouchers hold money, stored in cents. These helpers are shared by the admin pages and
// actions, and stay free of server-only imports.

export type GiftVoucherStatus = "active" | "used_up" | "expired";

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

/**
 * Generated codes (a 2–4 letter business prefix + 8 characters) are shown in groups:
 * BN-7K3M-9QX2. Printed numbers typed in by staff are shown as stored.
 */
export function formatGiftCode(code: string) {
  const m = /^([A-Z]{2,4})([A-Z0-9]{4})([A-Z0-9]{4})$/.exec(code);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : code;
}

/** The owner's business prefix for generated codes: 2 to 4 letters, e.g. BN for Best Nails. */
export const CODE_PREFIX_PATTERN = /^[A-Z]{2,4}$/;

/** `today` is YYYY-MM-DD in the shop's timezone. */
export function giftVoucherStatus(v: { balance_cents: number; expires_on: string }, today: string): GiftVoucherStatus {
  if (v.expires_on < today) return "expired";
  if (v.balance_cents === 0) return "used_up";
  return "active";
}

export const GIFT_VOUCHER_STATUS_LABELS: Record<GiftVoucherStatus, string> = {
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
};

/** Messages for check_gift_voucher / spend_gift_voucher statuses that mean "can't use it". */
export const GIFT_VOUCHER_PROBLEMS: Record<string, string> = {
  not_found: "No gift voucher has this code. Check it was typed correctly.",
  used_up: "This gift voucher has no balance left.",
  expired: "This gift voucher has expired.",
};

/** Quick amounts on the sell form. */
export const GIFT_VOUCHER_PRESETS = [5000, 10000, 15000];
