import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Direction = "add" | "remove";

/**
 * Add / Remove switch for adjustment forms: green with a plus, red with a minus, so the two can't be
 * confused. `labels` renames them where "Add" would mean something else (a voucher's Correct
 * balance, beside Add value).
 */
export function AddRemoveToggle({
  value,
  onChange,
  label,
  labels,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
  label: string;
  labels?: Record<Direction, string>;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {(["add", "remove"] as const).map((d) => {
        const Icon = d === "add" ? Plus : Minus;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border text-sm font-bold",
              // The default words are lower-case keys; given labels are already written as shown.
              !labels && "capitalize",
              value !== d && "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              value === d && d === "add" && "border-success bg-success-soft text-success",
              value === d && d === "remove" && "border-destructive bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {labels?.[d] ?? d}
          </button>
        );
      })}
    </div>
  );
}
