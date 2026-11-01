"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { startNavProgress } from "./nav-progress";

/**
 * A list's filters as one dropdown, for phones, where a row of chips doesn't fit: choosing an
 * option goes to its link, the same as tapping the chip. Uses the phone's own picker.
 */
export function FilterSelect({
  label,
  value,
  options,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
  className?: string;
}) {
  const router = useRouter();
  // The URL (and so `value`) only changes once the new list has loaded; until then, show the choice.
  const [shown, setShown] = useOptimistic(value);
  const [, startTransition] = useTransition();
  return (
    <label className={cn("relative flex-none", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={shown}
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value);
          if (!option) return;
          startNavProgress();
          startTransition(() => {
            setShown(option.value);
            router.push(option.href, { scroll: false });
          });
        }}
        // Full width of its slot (set by className): a native select otherwise grows to its longest option.
        className="h-11 w-full appearance-none truncate rounded-xl border border-input bg-card pr-9 pl-3.5 text-[15px] font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
