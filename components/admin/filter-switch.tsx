"use client";

import { useId, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { startNavProgress } from "./nav-progress";
import { cn } from "@/lib/utils";

/**
 * An on/off filter for a list, e.g. Gift vouchers' "Used today": a switch that goes to `href`
 * (the list with the filter flipped), so the choice stays in the URL. It flips straight away and
 * the list follows once it has loaded.
 */
export function FilterSwitch({ label, checked, href, className }: { label: string; checked: boolean; href: string; className?: string }) {
  const router = useRouter();
  const id = useId();
  const [shown, setShown] = useOptimistic(checked);
  const [, startTransition] = useTransition();
  return (
    <div className={cn("flex min-h-11 flex-none items-center gap-2.5", className)}>
      <Switch
        id={id}
        checked={shown}
        onCheckedChange={(next) => {
          startNavProgress();
          startTransition(() => {
            setShown(next);
            router.push(href, { scroll: false });
          });
        }}
      />
      <label htmlFor={id} className="cursor-pointer text-sm font-semibold whitespace-nowrap select-none">
        {label}
      </label>
    </div>
  );
}
