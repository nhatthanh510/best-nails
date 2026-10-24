import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyRow, PageHeader, Pager, Pill, TierBadge, td, th } from "@/components/admin/ui";
import { tierFor } from "@/lib/tiers";
import { ConfirmButton } from "@/components/admin/action-button";
import { voidCheckIn } from "@/app/admin/actions";
import { CHECK_IN_RANGES, CHECK_INS_PAGE_SIZE, getSettings, listCheckIns, staffNames, type CheckInRange } from "@/lib/admin-data";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Check-ins" };

const RANGE_LABELS: Record<CheckInRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };
const SOURCES = ["all", "kiosk", "admin"] as const;
const SOURCE_LABELS = { all: "All sources", kiosk: "Kiosk", admin: "Admin" };

export default function CheckInsPage({ searchParams }: PageProps<"/admin/check-ins">) {
  return (
    <Suspense fallback={<PageHeader title="Check-ins" subtitle="Loading…" />}>
      <CheckIns searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckIns({ searchParams }: { searchParams: PageProps<"/admin/check-ins">["searchParams"] }) {
  const params = await searchParams;
  const range = (params.range as CheckInRange) in CHECK_IN_RANGES ? (params.range as CheckInRange) : "today";
  const source = SOURCES.includes(params.source as (typeof SOURCES)[number]) ? (params.source as (typeof SOURCES)[number]) : "all";

  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total, totals, pastEnd }, settings, names] = await Promise.all([
    listCheckIns({ range, source, page }),
    getSettings(),
    staffNames(),
  ]);
  const tz = settings.timezone;
  // Changing the range or source starts again from page 1.
  const href = (next: { range?: string; source?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.source ?? source;
    const p = next.page ?? 1;
    if (r !== "today") sp.set("range", r);
    if (s !== "all") sp.set("source", s);
    if (p > 1) sp.set("page", String(p));
    return `/admin/check-ins${sp.size ? `?${sp}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && rows.length === 0)) redirect(href({ page: 1 }));
  const segment = (active: boolean) =>
    cn(
      "flex min-h-10.5 items-center px-4 text-sm font-bold border-l border-input first:border-l-0",
      active ? "bg-foreground text-background" : "bg-card hover:bg-muted",
    );

  return (
    <>
      <PageHeader
        title="Check-ins"
        subtitle={`${totals.visits.toLocaleString()} visit${totals.visits === 1 ? "" : "s"} · ${totals.points.toLocaleString()} points given`}
        actions={
          <Button asChild>
            <Link href="/admin/customers">
              <Plus aria-hidden="true" />
              Manual check-in
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Date range" className="flex overflow-hidden rounded-xl border border-input">
          {(Object.keys(CHECK_IN_RANGES) as CheckInRange[]).map((r) => (
            <Link key={r} href={href({ range: r })} aria-current={r === range ? "true" : undefined} className={segment(r === range)}>
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </nav>
        <nav aria-label="Source" className="flex overflow-hidden rounded-xl border border-input">
          {SOURCES.map((s) => (
            <Link key={s} href={href({ source: s })} aria-current={s === source ? "true" : undefined} className={segment(s === source)}>
              {SOURCE_LABELS[s]}
            </Link>
          ))}
        </nav>
      </div>

      <Card id="list" className="scroll-mt-4 overflow-hidden">
        {/* On phones the source moves under the customer's name. */}
        <DataTable minWidth={0}>
          <thead className="bg-background">
            <tr>
              <th className={th}>Time</th>
              <th className={th}>Customer</th>
              <th className={`${th} hidden sm:table-cell`}>Source</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Points</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>No check-ins in this period.</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id} className={r.voided_at ? "bg-background text-muted-foreground" : undefined}>
                <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>
                  {range === "today" ? (
                    formatTime(r.created_at, tz)
                  ) : (
                    // Date over time on phones, side by side from sm.
                    <span className="flex flex-col sm:flex-row sm:gap-1">
                      <span>{formatDate(r.created_at, tz)}</span>
                      <span>{formatTime(r.created_at, tz)}</span>
                    </span>
                  )}
                </td>
                <td className={td}>
                  {r.customer && (
                    <>
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/customers/${r.customer.id}`} className="font-bold hover:underline">
                          {fullName(r.customer)}
                        </Link>
                        <TierBadge tier={tierFor(r.customer.visit_count, settings)} />
                      </span>
                      <p className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(r.customer.phone)}</p>
                    </>
                  )}
                  <Pill className="mt-1.5 sm:hidden">{r.source === "kiosk" ? "Kiosk" : `Admin · ${names.get(r.created_by ?? "") ?? "staff"}`}</Pill>
                </td>
                <td className={`${td} hidden sm:table-cell`}>
                  <Pill>{r.source === "kiosk" ? "Kiosk" : `Admin · ${names.get(r.created_by ?? "") ?? "staff"}`}</Pill>
                </td>
                <td className={`${td} hidden text-right font-extrabold tabular-nums sm:table-cell ${r.voided_at ? "line-through" : ""}`}>
                  +{r.points_awarded}
                </td>
                <td className={`${td} text-right`}>
                  {r.voided_at ? (
                    <span className="text-[13px] font-bold">Undone by {names.get(r.voided_by ?? "") ?? "staff"}</span>
                  ) : (
                    <ConfirmButton
                      variant="outline"
                      size="sm"
                      title="Undo this check-in?"
                      description={`Removes ${r.points_awarded} points from ${r.customer ? fullName(r.customer) : "this customer"} and takes the visit off their count.`}
                      confirmLabel="Undo check-in"
                      action={voidCheckIn.bind(null, r.id)}
                    >
                      Undo
                    </ConfirmButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {total > CHECK_INS_PAGE_SIZE && (
          <Pager page={page} pageSize={CHECK_INS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="check-ins" anchor="list" />
        )}
      </Card>
    </>
  );
}
