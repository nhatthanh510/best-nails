"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <label className={cn("relative flex-none", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value);
          if (option) router.push(option.href, { scroll: false });
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
      <ChevronDown className="pointer-events-none absolute top-3.5 right-3 size-4 text-muted-foreground" aria-hidden="true" />
    </label>
  );
}
