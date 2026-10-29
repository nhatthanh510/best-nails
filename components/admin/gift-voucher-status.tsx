import { cn } from "@/lib/utils";
import { GIFT_VOUCHER_STATUS_LABELS, type GiftVoucherStatus } from "@/lib/gift-vouchers";

const STYLES: Record<GiftVoucherStatus, string> = {
  active: "bg-success-soft text-success",
  used_up: "bg-destructive/10 text-destructive",
  expired: "bg-warning-soft text-warning",
};

export function GiftVoucherStatusPill({ status }: { status: GiftVoucherStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", STYLES[status])}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {GIFT_VOUCHER_STATUS_LABELS[status]}
    </span>
  );
}
