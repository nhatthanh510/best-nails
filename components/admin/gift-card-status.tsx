import { cn } from "@/lib/utils";
import { GIFT_CARD_STATUS_LABELS, type GiftCardStatus } from "@/lib/gift-cards";

const STYLES: Record<GiftCardStatus, string> = {
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-foreground/10 text-foreground",
  active: "bg-success-soft text-success",
  used_up: "bg-destructive/10 text-destructive",
  expired: "bg-warning-soft text-warning",
};

export function GiftCardStatusPill({ status }: { status: GiftCardStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", STYLES[status])}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {GIFT_CARD_STATUS_LABELS[status]}
    </span>
  );
}
