import { cn } from "@/lib/utils";
import { VOUCHER_STATUS_LABELS, type VoucherStatus } from "@/lib/vouchers";

const STYLES: Record<VoucherStatus, string> = {
  active: "bg-success-soft text-success",
  scheduled: "bg-info-soft text-info",
  expired: "bg-secondary text-muted-foreground",
  paused: "bg-secondary text-muted-foreground",
  used_up: "bg-warning-soft text-warning",
};

export function VoucherStatusPill({ status }: { status: VoucherStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", STYLES[status])}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {VOUCHER_STATUS_LABELS[status]}
    </span>
  );
}
