import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable, EmptyRow, ListPanel, PageHeader, Pager, Pill, TierBadge, td, th } from "@/components/admin/ui";
import { ListPanelSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBox } from "@/components/admin/search-box";
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
    <Suspense
      fallback={
        <>
          <PageHeader title="Check-ins" subtitle={<Skeleton className="mt-1 h-4 w-40" />} />
          <ListPanelSkeleton label="Loading check-ins" />
        </>
      }
    >
      <CheckIns searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckIns({ searchParams }: { searchParams: PageProps<"/admin/check-ins">["searchParams"] }) {
  const params = await searchParams;
  const range = (params.range as CheckInRange) in CHECK_IN_RANGES ? (params.range as CheckInRange) : "today";
  const source = SOURCES.includes(params.source as (typeof SOURCES)[number]) ? (params.source as (typeof SOURCES)[number]) : "all";
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";

  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total, totals, pastEnd }, settings, names] = await Promise.all([
    listCheckIns({ range, source, q, page }),
    getSettings(),
    staffNames(),
  ]);
  const tz = settings.timezone;
  // Every link keeps the search, range and source; changing any of them starts again from page 1.
  const href = (next: { range?: string; source?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.source ?? source;
    const p = next.page ?? 1;
    if (q) sp.set("q", q);
    if (r !== "today") sp.set("range", r);
    if (s !== "all") sp.set("source", s);
    if (p > 1) sp.set("page", String(p));
    return `/admin/check-ins${sp.size ? `?${sp}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && rows.length === 0)) redirect(href({ page: 1 }));
  const segment = (active: boolean) =>
    cn(
      "flex min-h-10 items-center px-3.5 text-sm font-bold whitespace-nowrap border-l border-input first:border-l-0",
      active ? "bg-foreground text-background" : "bg-card hover:bg-muted",
    );

  return (
    <>
      <PageHeader
        title="Check-ins"
        subtitle={`${totals.visits.toLocaleString()} visit${totals.visits === 1 ? "" : "s"} · ${totals.points.toLocaleString()} points given`}
      />

      <ListPanel id="list" className="scroll-mt-4">
        {/* The toolbar and rows are one panel, as on Customers and Gift vouchers. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchBox
            action="/admin/check-ins"
            id="q"
            label="Search check-ins by customer"
            placeholder="Search by name or phone"
            defaultValue={q}
            className="flex-[1_1_200px]"
          >
            {range !== "today" && <input type="hidden" name="range" value={range} />}
            {source !== "all" && <input type="hidden" name="source" value={source} />}
          </SearchBox>
          <nav aria-label="Date range" className="flex flex-none overflow-hidden rounded-xl border border-input">
            {(Object.keys(CHECK_IN_RANGES) as CheckInRange[]).map((r) => (
              <Link key={r} href={href({ range: r })} aria-current={r === range ? "true" : undefined} className={segment(r === range)}>
                {RANGE_LABELS[r]}
              </Link>
            ))}
          </nav>
          <nav aria-label="Source" className="flex flex-none overflow-hidden rounded-xl border border-input">
            {SOURCES.map((s) => (
              <Link key={s} href={href({ source: s })} aria-current={s === source ? "true" : undefined} className={segment(s === source)}>
                {SOURCE_LABELS[s]}
              </Link>
            ))}
          </nav>
          {/* From tablet width up the pager sits in this toolbar; phones keep it under the list. */}
          <Pager compact page={page} pageSize={CHECK_INS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="ml-auto hidden md:flex" />
        </div>
        {/* On phones the source moves under the customer's name. Every column but the customer has
            a fixed width, so new results don't re-space them. The key starts each new search,
            filter or page at the top of the rows. */}
        <DataTable key={href({ page })} minWidth={0} fill>
          <thead className="bg-card">
            <tr>
              <th className={cn(th, range === "today" ? "w-28" : "w-32 sm:w-52")}>Time</th>
              <th className={th}>Customer</th>
              <th className={`${th} hidden w-40 sm:table-cell`}>Source</th>
              <th className={`${th} hidden w-24 text-right sm:table-cell`}>Points</th>
              <th className={`${th} w-28 sm:w-48`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={5}>{q ? `No check-ins in this period match “${q}”.` : "No check-ins in this period."}</EmptyRow>
            )}
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
                        <TierBadge tier={tierFor(r.customer.lifetime_points, settings)} />
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
                      description={`Removes ${r.points_awarded} point${r.points_awarded === 1 ? "" : "s"} from ${r.customer ? fullName(r.customer) : "this customer"} and takes the visit off their count.`}
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
          <Pager
            page={page}
            pageSize={CHECK_INS_PAGE_SIZE}
            total={total}
            href={(p) => href({ page: p })}
            noun="check-ins"
            anchor="list"
            className="md:hidden"
          />
        )}
      </ListPanel>
    </>
  );
}
