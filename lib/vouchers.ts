import type { Database } from "@/lib/database.types";

export type Voucher = Database["public"]["Tables"]["vouchers"]["Row"];
export type VoucherStatus = "active" | "scheduled" | "expired" | "paused" | "used_up";

/** "15% off" or "$10 off". */
export function formatDiscount(type: Voucher["discount_type"], value: number) {
  if (type === "percent") return `${Number(value)}% off`;
  const dollars = Number(value);
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)} off`;
}

/** `today` is YYYY-MM-DD in the shop's timezone. */
export function voucherStatus(v: Pick<Voucher, "is_active" | "starts_on" | "expires_on">, used: number, total: number, today: string): VoucherStatus {
  if (!v.is_active) return "paused";
  if (v.expires_on && v.expires_on < today) return "expired";
  if (v.starts_on && v.starts_on > today) return "scheduled";
  if (total > 0 && used >= total) return "used_up";
  return "active";
}

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  active: "Active",
  scheduled: "Not started",
  expired: "Expired",
  paused: "Paused",
  used_up: "Used up",
};

/** Messages for check_voucher / redeem_voucher statuses that mean "can't use it". */
export const VOUCHER_PROBLEMS: Record<string, string> = {
  not_found: "No voucher has this code. Check it was typed correctly.",
  paused: "This voucher is paused.",
  not_started: "This voucher can't be used yet.",
  expired: "This voucher has expired.",
  used_up: "This code has already been used the maximum number of times.",
  already_used_by_customer: "This customer has already used this voucher.",
};
