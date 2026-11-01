import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable, EmptyRow, ListPanel, PageHeader, Pager, Pill, TierBadge, td, th } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { SegmentedLinks } from "@/components/admin/segmented-links";
import { tierFor } from "@/lib/tiers";
import { CHECK_IN_RANGES, CHECK_INS_PAGE_SIZE, getSettings, listCheckIns, type CheckInRange, type VisitUse } from "@/lib/admin-data";
import { VisitPayment, VisitServices, VisitStaff, VisitSummary } from "@/components/admin/visit";
import { formatMoney } from "@/lib/gift-vouchers";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export const metadata = { title: "Check-ins" };

const RANGE_LABELS: Record<CheckInRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days" };

export default function CheckInsPage({ searchParams }: PageProps<"/admin/check-ins">) {
  return <CheckIns searchParams={searchParams} />;
}

async function CheckIns({ searchParams }: { searchParams: PageProps<"/admin/check-ins">["searchParams"] }) {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const params = await searchParams;
  const range = (params.range as CheckInRange) in CHECK_IN_RANGES ? (params.range as CheckInRange) : "today";
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";

  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total, totals, used, pastEnd }, settings] = await Promise.all([listCheckIns({ range, q, page }), getSettings()]);
  const tz = settings.timezone;
  // Every link keeps the search and range; changing either starts again from page 1.
  const href = (next: { range?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const r = next.range ?? range;
    const p = next.page ?? 1;
    if (q) sp.set("q", q);
    if (r !== "today") sp.set("range", r);
    if (p > 1) sp.set("page", String(p));
    return `/admin/check-ins${sp.size ? `?${sp}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && rows.length === 0)) redirect(href({ page: 1 }));
  // The kiosk asks every visit how they're paying; a period of only older visits (from before it
  // asked) has no Paid column rather than an empty one.
  const showPayment = rows.some((r) => r.payment_method);
  const ranges = (Object.keys(CHECK_IN_RANGES) as CheckInRange[]).map((r) => ({ value: r, label: RANGE_LABELS[r], href: href({ range: r }) }));
  return (
    <>
      <PageHeader
        title="Check-ins"
        subtitle={[
          `${totals.visits.toLocaleString()} visit${totals.visits === 1 ? "" : "s"}`,
          `${used.discounts.toLocaleString()} discount${used.discounts === 1 ? "" : "s"}`,
          `${formatMoney(used.giftCents)} from gift vouchers`,
        ].join(" · ")}
      />

      <ListPanel id="list" className="scroll-mt-4">
        {/* The toolbar and rows are one panel, as on Customers and Gift vouchers. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border p-3 md:flex-wrap md:gap-3 md:p-4">
          <SearchBox
            action="/admin/check-ins"
            id="q"
            label="Search check-ins by customer"
            placeholder="Search by name or phone"
            defaultValue={q}
            className="flex-1 md:flex-[1_1_200px]"
          >
            {range !== "today" && <input type="hidden" name="range" value={range} />}
          </SearchBox>
          {/* Phones: one dropdown beside the search. From tablet width up: the joined bar. */}
          <FilterSelect label="Date range" value={range} options={ranges} className="w-28 md:hidden" />
          <SegmentedLinks label="Date range" value={range} options={ranges} className="hidden md:flex" />
          {/* From tablet width up the pager sits in this toolbar; phones keep it under the list. */}
          <Pager compact page={page} pageSize={CHECK_INS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="ml-auto hidden md:flex" />
        </div>
        {/* Check-ins only happen on the kiosk, so there's no source to show. Every column but the
            customer has a fixed width, so new results don't re-space them. The key starts each new
            search, range or page at the top of the rows. */}
        <DataTable key={href({ page })} minWidth={0} fill>
          <thead className="bg-card">
            <tr>
              <th className={cn(th, range === "today" ? "w-28" : "w-32 sm:w-52")}>Time</th>
              <th className={th}>Customer</th>
              <th className={`${th} hidden lg:table-cell`}>Services</th>
              <th className={`${th} hidden lg:table-cell`}>Staff</th>
              {showPayment && <th className={`${th} hidden w-20 lg:table-cell`}>Paid</th>}
              <th className={`${th} hidden md:table-cell`}>Redeemed</th>
              <th className={`${th} w-20 text-right sm:w-24`}>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <EmptyRow colSpan={showPayment ? 7 : 6}>{q ? `No check-ins in this period match “${q}”.` : "No check-ins in this period."}</EmptyRow>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
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
                  <div className="mt-1 lg:hidden">
                    <VisitSummary services={r.services} staff={r.technician_name} payment={r.payment_method} />
                  </div>
                  {r.used.length > 0 && (
                    <div className="mt-1.5 md:hidden">
                      <UsedPills used={r.used} />
                    </div>
                  )}
                </td>
                <td className={`${td} hidden lg:table-cell`}>
                  <VisitServices services={r.services} />
                </td>
                <td className={`${td} hidden whitespace-nowrap lg:table-cell`}>
                  <VisitStaff name={r.technician_name} />
                </td>
                {showPayment && (
                  <td className={`${td} hidden lg:table-cell`}>
                    <VisitPayment method={r.payment_method} />
                  </td>
                )}
                <td className={`${td} hidden md:table-cell`}>
                  <UsedPills used={r.used} />
                </td>
                <td className={`${td} text-right font-extrabold tabular-nums`}>+{r.points_awarded}</td>
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

/**
 * What the customer used on the day of that visit. Each kind keeps one colour: points rewards
 * gold, birthday blue, gift vouchers brown (as "Used" on the Gift vouchers page).
 */
function UsedPills({ used }: { used: VisitUse[] }) {
  if (used.length === 0)
    return (
      <span className="text-muted-foreground" aria-label="Nothing used">
        –
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1.5">
      {used.map((u, i) =>
        u.kind === "points" ? (
          <Pill key={i} className="bg-accent whitespace-nowrap text-accent-foreground">
            {u.label} · points
          </Pill>
        ) : u.kind === "birthday" ? (
          <Pill key={i} className="bg-info-soft whitespace-nowrap text-info">
            Birthday {u.label}
          </Pill>
        ) : (
          <Pill key={i} className="bg-warning-soft whitespace-nowrap text-warning">
            Gift voucher {formatMoney(u.cents)}
          </Pill>
        ),
      )}
    </span>
  );
}
