import { cn } from "@/lib/utils";

/**
 * A placeholder block in the shape of content that's still loading. A soft pulse, a shade
 * darker than the ivory cards so it shows on both cards and the page; still for reduced motion.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--muted),var(--foreground)_8%)] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
