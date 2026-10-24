import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Card, DataTable, EmptyRow, PageHeader, Pager, StatTile, td, th } from "@/components/admin/ui";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { SellGiftVoucherButton, UseGiftVoucher } from "@/components/admin/gift-voucher-forms";
import {
  GIFT_VOUCHER_FILTERS,
  GIFT_VOUCHERS_PAGE_SIZE,
  getSettings,
  giftVoucherSummary,
  listGiftVouchers,
  type GiftVoucherFilter,
} from "@/lib/admin-data";
import { formatGiftCode, formatMoney } from "@/lib/gift-vouchers";
import { formatDate, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gift vouchers" };

const FILTER_LABELS: Record<GiftVoucherFilter, string> = {
  all: "All",
  active: "With balance",
  used_up: "Used up",
  expired: "Expired",
};

// Expiry dates are calendar dates, so format them at noon UTC to stay on the right day.
const day = (d: string) => formatDate(`${d}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" });

export default function GiftVouchersPage({ searchParams }: PageProps<"/admin/gift-vouchers">) {
  return (
    <>
      <PageHeader
        title="Gift vouchers"
        subtitle="Prepaid credit customers buy and spend over one or more visits. Take payment at the till; this tracks the balance."
        actions={<SellGiftVoucherButton />}
      />

      <Suspense fallback={<div className="h-28" />}>
        <Summary />
      </Suspense>

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-extrabold">Use a gift voucher</h2>
        <UseGiftVoucher />
      </Card>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <GiftVoucherList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Summary() {
  const s = await giftVoucherSummary();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <StatTile
        label="Unspent credit"
        value={formatMoney(s.outstandingCents)}
        hint={`On ${s.activeCount.toLocaleString()} voucher${s.activeCount === 1 ? "" : "s"} still in date`}
      />
      <StatTile label="Sold this month" value={formatMoney(s.soldThisMonthCents)} hint={`${s.soldThisMonth.toLocaleString()} vouchers`} />
    </div>
  );
}

async function GiftVoucherList({ searchParams }: { searchParams: PageProps<"/admin/gift-vouchers">["searchParams"] }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 40) : "";
  const filter = GIFT_VOUCHER_FILTERS.includes(params.filter as GiftVoucherFilter) ? (params.filter as GiftVoucherFilter) : "all";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ vouchers, total, pastEnd }, settings] = await Promise.all([listGiftVouchers({ q, filter, page }), getSettings()]);
  const tz = settings.timezone;

  const href = (next: Partial<{ q: string; filter: string; page: number }>) => {
    const sp = new URLSearchParams();
    const merged = { q, filter, page: 1, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.page > 1) sp.set("page", String(merged.page));
    const s = sp.toString();
    return `/admin/gift-vouchers${s ? `?${s}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && vouchers.length === 0)) redirect(href({ page: 1 }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/gift-vouchers" className="relative min-w-0 flex-[1_1_280px]" role="search">
          <label htmlFor="gv-q" className="sr-only">
            Search by code
          </label>
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4.5 text-muted-foreground" aria-hidden="true" />
          <input
            id="gv-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by code"
            className="h-11 w-full rounded-xl border border-input bg-card pr-3.5 pl-10.5 font-mono text-[15px] uppercase outline-none placeholder:font-sans placeholder:normal-case focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </form>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
          {GIFT_VOUCHER_FILTERS.map((f) => (
            <Link
              key={f}
              href={href({ filter: f })}
              aria-current={f === filter ? "true" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-full border px-3.5 text-sm font-bold",
                f === filter ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-muted",
              )}
            >
              {FILTER_LABELS[f]}
            </Link>
          ))}
        </div>
      </div>

      <Card id="list" className="scroll-mt-4 overflow-hidden">
        {/* Narrower screens fold the customer, sale date and status under the code. */}
        <DataTable minWidth={0}>
          <thead className="bg-background">
            <tr>
              <th className={th}>Code</th>
              <th className={`${th} hidden md:table-cell`}>Customer</th>
              <th className={`${th} text-right`}>Balance</th>
              <th className={`${th} hidden text-right sm:table-cell`}>Amount</th>
              <th className={`${th} hidden lg:table-cell`}>Sold</th>
              <th className={`${th} hidden xl:table-cell`}>Expires</th>
              <th className={`${th} hidden sm:table-cell`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 && (
              <EmptyRow colSpan={7}>{q ? `No gift voucher codes match “${q}”.` : "No gift vouchers here yet."}</EmptyRow>
            )}
            {vouchers.map((v) => (
              <tr key={v.id} className="hover:bg-background/60">
                <td className={td}>
                  <Link href={`/admin/gift-vouchers/${v.id}`} className="font-mono font-bold tracking-wider whitespace-nowrap hover:underline">
                    {formatGiftCode(v.code)}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground lg:hidden">
                    <span className="md:hidden">{v.customer ? fullName(v.customer) : "Not linked"}</span>
                    <span>Sold {formatDate(`${v.sold_on}T12:00:00Z`, "UTC")}</span>
                    <span className="sm:hidden">
                      <GiftVoucherStatusPill status={v.status} />
                    </span>
                  </p>
                </td>
                <td className={`${td} hidden md:table-cell`}>
                  {v.customer ? (
                    <Link href={`/admin/customers/${v.customer.id}`} className="font-semibold hover:underline">
                      {fullName(v.customer)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </td>
                <td className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums`}>{formatMoney(v.balance_cents)}</td>
                <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>
                  {formatMoney(v.amount_cents)}
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground lg:table-cell`}>
                  {formatDate(v.created_at, tz, { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground xl:table-cell`}>{day(v.expires_on)}</td>
                <td className={`${td} hidden sm:table-cell`}>
                  <GiftVoucherStatusPill status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {total > GIFT_VOUCHERS_PAGE_SIZE && (
          <Pager page={page} pageSize={GIFT_VOUCHERS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="vouchers" anchor="list" />
        )}
      </Card>
    </>
  );
}
