import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Crown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_LABELS, type Tier } from "@/lib/tiers";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    // From tablet width the buttons always stay top-right, and a long subtitle wraps beside them.
    <div className="flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap sm:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[2.375rem] leading-tight font-bold">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {/* On phones the buttons share one full-width row instead of stacking; without their icons
          and with less padding, two labels fit side by side down to 375px. */}
      {actions && (
        <div className="flex gap-2.5 max-sm:w-full max-sm:gap-2 max-sm:*:flex-1 max-sm:*:px-3 max-sm:[&_svg]:hidden sm:mt-1 sm:flex-none sm:flex-wrap sm:justify-end">{actions}</div>
      )}
    </div>
  );
}

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-border bg-card", className)} {...props} />;
}

/** The dashboard's four "today" tiles: two by two on phones and iPads in portrait, one row from lg. */
export const dashboardTileGrid = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4";

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4 sm:p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      {/* Smaller on phones, where tiles sit two to a row. A word ("Yesterday", "Ready") is a size
          down from a number, so it fits a quarter-width tile. */}
      <p
        className={cn(
          "font-extrabold tracking-tight tabular-nums",
          typeof value === "string" && /[a-z]/i.test(value) ? "text-xl sm:text-[28px] sm:leading-10" : "text-2xl sm:text-4xl",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[13px] font-semibold", className)}>
      {children}
    </span>
  );
}

export function Avatar({ text, size = "md" }: { text: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-accent font-extrabold text-accent-foreground",
        size === "md" ? "size-9 text-[13px]" : "size-16 text-[22px]",
      )}
    >
      {text}
    </span>
  );
}

/** Table shell with a horizontal scroll box so wide tables don't break phone layouts. */
/**
 * The card around a searchable list, with `<DataTable fill>` inside. From tablet width up, a page
 * with one fits the screen (see the admin layout): the card takes the height left under the
 * content above it and only its rows scroll, so the page doesn't change height or get a second
 * scrollbar as results change. Phones keep the normal page scroll.
 */
export function ListPanel({ className, ...props }: React.ComponentProps<"section">) {
  return <Card data-list-panel className={cn("overflow-hidden md:flex md:min-h-56 md:flex-1 md:flex-col", className)} {...props} />;
}

export function DataTable({
  minWidth = 720,
  fill = false,
  children,
}: {
  minWidth?: number;
  /** Fill a `ListPanel`: the rows scroll inside it under pinned column headers. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  // `relative` keeps absolutely positioned cells (the sr-only "Actions" headers) inside the
  // scroll box; without it they widen the whole page.
  return (
    <div className={cn("relative overflow-x-auto", fill && "md:min-h-0 md:flex-1 md:overflow-y-auto md:[scrollbar-gutter:stable]")}>
      <table
        className={cn(
          "w-full border-collapse text-sm",
          // Sticky cells lose their collapsed border, so the header's bottom line is a shadow.
          // Rows are a little denser, so a short laptop screen shows more of them.
          fill &&
            "md:[&_td]:py-2 md:[&_th]:sticky md:[&_th]:top-0 md:[&_th]:z-10 md:[&_th]:bg-card md:[&_th]:shadow-[inset_0_-1px_0_var(--color-border)]",
        )}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export const th = "border-b border-border px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground first:pl-5 last:pr-5";
export const td = "border-b border-secondary px-3 py-3 first:pl-5 last:pr-5";

/** A column header that links to the list sorted by that column. */
export function SortableTh({
  label,
  href,
  active,
  dir,
  className,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn(th, className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-mx-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 whitespace-nowrap hover:bg-muted hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden="true" />
      </Link>
    </th>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  vip: "bg-foreground text-gold-bright",
  regular: "bg-accent text-accent-foreground",
  new: "bg-secondary text-muted-foreground",
};

/** Customer tier from total visits. New is only shown when `showNew` is set, to keep lists quiet. */
export function TierBadge({ tier, showNew = false }: { tier: Tier; showNew?: boolean }) {
  if (tier === "new" && !showNew) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", TIER_STYLES[tier])}>
      {tier === "vip" && <Crown className="size-3.5" aria-hidden="true" />}
      {tier === "regular" && <Star className="size-3.5" aria-hidden="true" />}
      {TIER_LABELS[tier]}
    </span>
  );
}

/**
 * "Showing 26–50 of 611" with Previous / Next links, under a paged table. `anchor` is the id of
 * the list's card: the links scroll back to its top rather than leaving you at the bottom.
 * `compact` is the toolbar version above a ListPanel, "26–50 of 611 ‹ ›", like Gmail's.
 */
export function Pager({
  page,
  pageSize,
  total,
  href,
  noun = "",
  anchor,
  compact = false,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
  noun?: string;
  anchor?: string;
  compact?: boolean;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = (p: number) => `${href(p)}${anchor ? `#${anchor}` : ""}`;
  // In a toolbar, a single page needs no pager: the rows are all there, and hiding it keeps the
  // toolbar on one row on an iPad.
  if (compact && pages <= 1) return null;
  if (compact)
    return (
      <nav aria-label="Pages" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums", className)}>
        {/* A fixed width, so "No results" vs "26–50 of 1,234" doesn't nudge the search box. */}
        <span className="mr-1 min-w-28 text-right whitespace-nowrap">
          {total === 0 ? "No results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
        </span>
        <PageLink href={link(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="size-4.5" aria-hidden="true" />
        </PageLink>
        <PageLink href={link(page + 1)} disabled={page >= pages} label="Next page">
          <ChevronRight className="size-4.5" aria-hidden="true" />
        </PageLink>
      </nav>
    );
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-muted-foreground", className)}>
      <span>
        {total === 0
          ? "No results"
          : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}${noun ? ` ${noun}` : ""}`}
      </span>
      <div className="flex gap-2">
        <PageLink href={link(page - 1)} disabled={page <= 1}>
          Previous
        </PageLink>
        <PageLink href={link(page + 1)} disabled={page >= pages}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

/** `label` names an icon-only link. */
function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label?: string; children: React.ReactNode }) {
  const cls = cn("flex min-h-10 items-center rounded-[10px] border text-sm font-semibold", label ? "min-w-10 justify-center" : "px-3.5");
  if (disabled)
    return (
      <span aria-disabled="true" aria-label={label} className={`${cls} border-border text-muted-foreground/70`}>
        {children}
      </span>
    );
  return (
    <Link href={href} aria-label={label} className={`${cls} border-input bg-card text-foreground hover:bg-muted`}>
      {children}
    </Link>
  );
}
