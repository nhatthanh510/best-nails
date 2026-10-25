import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Crown, Star } from "lucide-react";
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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2.375rem] leading-tight font-bold">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-border bg-card", className)} {...props} />;
}

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-4xl font-extrabold tracking-tight tabular-nums">{value}</p>
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
export function DataTable({ minWidth = 720, children }: { minWidth?: number; children: React.ReactNode }) {
  // `relative` keeps absolutely positioned cells (the sr-only "Actions" headers) inside the
  // scroll box; without it they widen the whole page.
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
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
 */
export function Pager({
  page,
  pageSize,
  total,
  href,
  noun = "",
  anchor,
}: {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
  noun?: string;
  anchor?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = (p: number) => `${href(p)}${anchor ? `#${anchor}` : ""}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-muted-foreground">
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

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = "flex min-h-10 items-center rounded-[10px] border px-3.5 text-sm font-semibold";
  if (disabled)
    return (
      <span aria-disabled="true" className={`${cls} border-border text-muted-foreground/70`}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={`${cls} border-input bg-card text-foreground hover:bg-muted`}>
      {children}
    </Link>
  );
}
