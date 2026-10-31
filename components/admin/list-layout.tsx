import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollFade } from "./scroll-fade";

/**
 * A list page's frame by status (Gift vouchers), top to bottom: the title with the page's buttons
 * (PageHeader), a summary card of a few numbers, status tabs with counts, then the list panel with
 * its search and sort above the rows. Tabs suit statuses, where every row is in exactly one; for
 * overlapping filters (Customers' visit days) or a date range (Check-ins) use chips or a joined bar.
 */

export type Stat = { value: React.ReactNode; label: string; href?: string };

/** A few key numbers, divided like a strip; on phones an even grid. */
export function SummaryCard({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <section aria-label="Summary" className={cn("rounded-2xl border border-border bg-card px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <dl className="grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-y-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex min-w-0 flex-col-reverse gap-0.5 border-border px-3 not-last:border-r first:pl-0 last:pr-0 sm:px-7"
          >
            <dt className="text-[13px] text-muted-foreground">
              {s.href ? (
                <Link href={s.href} className="underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-current">
                  {s.label}
                </Link>
              ) : (
                s.label
              )}
            </dt>
            <dd className="truncate text-lg font-extrabold tabular-nums sm:text-[22px]">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export type Tab<T extends string> = { value: T; label: string; count?: number; href: string };

/**
 * One tab per status (or range), with its count: links, so the choice is in the URL. On a phone
 * they scroll sideways rather than wrap, with a fade on the side that has more (ScrollFade).
 */
export function StatusTabs<T extends string>({ label, value, tabs, className }: { label: string; value: T; tabs: Tab<T>[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ScrollFade className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = t.value === value;
            return (
              <li key={t.value}>
                <Link
                  href={t.href}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-[15px] whitespace-nowrap",
                    active ? "border-primary font-bold text-foreground" : "border-transparent font-semibold text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {t.label}
                  {t.count !== undefined && <span className={cn("tabular-nums", active ? "text-muted-foreground" : "")}>({t.count.toLocaleString()})</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollFade>
    </nav>
  );
}
