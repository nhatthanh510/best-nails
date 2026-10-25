import { Skeleton } from "@/components/ui/skeleton";
import { Card, ListPanel, PageHeader, fiveTileGrid } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

// Loading states shaped like the pages they stand in for (same grid, cards and row heights), so
// the content fills in place instead of the page jumping when it arrives. Page titles stay real
// text: they're known before any data loads and tell staff where they are.

const tilesGrid = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:gap-4";

/** Tells screen readers what's happening; the blocks themselves are hidden from them. */
function Loading({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export function StatTilesSkeleton({ count, grid = tilesGrid }: { count: number; grid?: string }) {
  return (
    <div className={grid}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4 sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16 sm:h-10" />
        </Card>
      ))}
    </div>
  );
}

/** Table rows: a name with a second line, then short cells. Used inside cards and list panels. */
export function RowsSkeleton({ rows, avatar = false }: { rows: number; avatar?: boolean }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-secondary px-5 py-3 last:border-0">
          {avatar && <Skeleton className="hidden size-9 flex-none rounded-full sm:block" />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Varied widths, so it reads as a list of names rather than a barcode. */}
            <Skeleton className={cn("h-4", ["w-40", "w-32", "w-48", "w-36"][i % 4])} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="h-9 w-20 flex-none rounded-[10px]" />
        </div>
      ))}
    </div>
  );
}

/** A side card: a heading and a few lines or fields. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-3.5 p-5", className)}>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
    </Card>
  );
}

/** Customers, Gift vouchers and Check-ins: the list panel with its toolbar and rows. */
export function ListPanelSkeleton({ rows = 10, avatar = false, label }: { rows?: number; avatar?: boolean; label: string }) {
  return (
    <ListPanel id="list" className="scroll-mt-4">
      <Loading label={label} />
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
        <Skeleton className="h-11 min-w-0 flex-[1_1_200px] rounded-xl" />
        <div className="flex gap-2">
          {[12, 14, 18, 16].map((w, i) => (
            <Skeleton key={i} className="h-10 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <Skeleton className="ml-auto hidden h-10 w-40 md:block" />
      </div>
      <div className="flex gap-4 border-b border-border px-5 py-3.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="ml-auto h-3.5 w-12" />
        <Skeleton className="hidden h-3.5 w-12 sm:block" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <RowsSkeleton rows={rows} avatar={avatar} />
      </div>
    </ListPanel>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Today at Best Nails" subtitle={<Skeleton className="mt-1 h-4 w-36" />} />
      <Loading label="Loading today's numbers" />
      <StatTilesSkeleton count={5} grid={fiveTileGrid} />
      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_520px] pt-5 pb-2">
          <Skeleton className="mx-5 mb-4 h-5 w-40" />
          <RowsSkeleton rows={6} />
        </Card>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </>
  );
}

/** Customer and gift voucher pages: the header card, tiles, the history and the side cards. */
export function DetailSkeleton({ tiles, label }: { tiles: number; label: string }) {
  return (
    <>
      <Loading label={label} />
      <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-11 w-20 rounded-[10px]" />
          <Skeleton className="h-11 w-32 rounded-[10px]" />
        </div>
      </Card>
      <StatTilesSkeleton count={tiles} />
      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_480px] pt-5 pb-2">
          <Skeleton className="mx-5 mb-4 h-5 w-36" />
          <RowsSkeleton rows={6} />
        </Card>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </>
  );
}

/** Settings and Rewards: cards of labelled fields. */
export function FormCardsSkeleton({ cards, label }: { cards: number; label: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Loading label={label} />
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="flex flex-col gap-5 p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4.5">
            {[0, 1].map((f) => (
              <div key={f} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-[10px]" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
