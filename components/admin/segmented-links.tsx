import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one style for picking a time range (dashboard, check-ins): a joined bar of links, so the
 * choice is in the URL. Categories (status, birthday) use chips instead.
 */
export function SegmentedLinks<T extends string>({
  label,
  value,
  options,
  replace,
  scroll,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; href: string }[];
  replace?: boolean;
  scroll?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("flex flex-none overflow-hidden rounded-xl border border-input", className)}>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          replace={replace}
          scroll={scroll}
          aria-current={o.value === value ? "true" : undefined}
          className={cn(
            "flex min-h-10 items-center border-l border-input px-3.5 text-sm font-bold whitespace-nowrap first:border-l-0",
            o.value === value ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
