import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { DataTable, ListPanel, EmptyRow, PageHeader, Pager, td, th } from "@/components/admin/ui";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { SellGiftVoucherButton, UseGiftVoucherButton } from "@/components/admin/gift-voucher-forms";
import { GIFT_VOUCHER_FILTERS, GIFT_VOUCHERS_PAGE_SIZE, getSettings, giftVoucherSummary, listGiftVouchers, type GiftVoucherFilter } from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { formatDate, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/admin/copy-button";

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export const metadata = { title: "Gift vouchers" };

const FILTER_LABELS: Record<GiftVoucherFilter, string> = {
  all: "All",
  used_today: "Used today",
  active: "With balance",
  used_up: "Used up",
  expired: "Expired",
};

const chip = (active: boolean) =>
  cn(
    "flex min-h-10 flex-none items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap",
    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
  );


export default function GiftVouchersPage({ searchParams }: PageProps<"/admin/gift-vouchers">) {
  return (
    <>
      <PageHeader
        title="Gift vouchers"
        subtitle={
          // One line rather than stat tiles, so the list below has room to fit the screen.
          <Summary />
        }
        actions={
          <>
            <UseGiftVoucherButton variant="outline" />
            <SellGiftVoucherButton />
          </>
        }
      />

      <GiftVoucherLists searchParams={searchParams} />
    </>
  );
}

async function Summary() {
  const s = await giftVoucherSummary();
  const total = (cents: number) => <strong className="font-bold text-foreground tabular-nums">{formatMoney(cents)}</strong>;
  return (
    <>
      {total(s.outstandingCents)} unspent on {s.activeCount.toLocaleString()} voucher{s.activeCount === 1 ? "" : "s"} still in date
      {" · "}
      {total(s.soldThisMonthCents)} in new vouchers this month ({s.soldThisMonth.toLocaleString()})
    </>
  );
}

type Params = Awaited<PageProps<"/admin/gift-vouchers">["searchParams"]>;

async function GiftVoucherLists({ searchParams }: { searchParams: PageProps<"/admin/gift-vouchers">["searchParams"] }) {
  return <VoucherList params={await searchParams} />;
}

async function VoucherList({ params }: { params: Params }) {
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
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
    <ListPanel id="list" className="scroll-mt-4">
      {/* The toolbar and rows are one panel, Gmail-style, so spare space under a short list reads as
          part of the list rather than an empty table. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
        <SearchBox
          action="/admin/gift-vouchers"
          id="gv-q"
          label="Search by code, name or phone"
          placeholder="Code, name or phone"
          defaultValue={q}
          className="w-full max-md:order-first md:w-auto md:flex-[1_1_200px]"
        >
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </SearchBox>
        {/* Phones: one dropdown beside the search. From tablet width up: the chips. */}
        <FilterSelect
          label="Filter gift vouchers"
          value={filter}
          options={GIFT_VOUCHER_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f], href: href({ filter: f }) }))}
          className="min-w-0 flex-1 md:hidden"
        />
        <div role="group" aria-label="Filter" className="hidden flex-wrap gap-2 md:flex">
          {GIFT_VOUCHER_FILTERS.map((f) => (
            <Link key={f} href={href({ filter: f })} aria-current={f === filter ? "true" : undefined} className={chip(f === filter)}>
              {FILTER_LABELS[f]}
            </Link>
          ))}
        </div>
        {/* From tablet width up the pager sits in this toolbar, Gmail-style; phones keep it under the list. */}
        <Pager compact page={page} pageSize={GIFT_VOUCHERS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="ml-auto hidden md:flex" />
      </div>
      {/* Narrower screens fold the customer, last use and status under the code. The customer (the
          code on phones) takes the spare width and the rest are fixed, so results don't re-space them.
          The key starts each new search, filter or page at the top of the rows. */}
      <DataTable key={href({ page })} minWidth={0} fill>
        <thead className="bg-card">
          <tr>
            <th className={`${th} md:w-44`}>Code</th>
            <th className={`${th} hidden md:table-cell`}>Customer</th>
            <th className={`${th} w-28 text-right`}>Balance</th>
            <th className={`${th} hidden w-28 text-right xl:table-cell`}>Amount</th>
            <th className={`${th} hidden w-32 lg:table-cell`}>Created</th>
            <th className={`${th} hidden w-48 lg:table-cell`}>Last used</th>
            <th className={`${th} hidden w-30 sm:table-cell`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.length === 0 && (
            <EmptyRow colSpan={7}>{q ? `No gift vouchers match “${q}”.` : filter === "used_today" ? "No gift vouchers used today." : "No gift vouchers here yet."}</EmptyRow>
          )}
          {vouchers.map((v) => (
            // A used-up voucher gets a red tint, so staff spot at a glance that there's no credit left.
            <tr key={v.id} className={v.status === "used_up" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-background/60"}>
              <td className={td}>
                <span className="flex items-center gap-0.5">
                  <Link href={`/admin/gift-vouchers/${v.id}`} className="font-mono font-bold tracking-wider whitespace-nowrap hover:underline">
                    {v.code}
                  </Link>
                  <CopyButton text={v.code} label={`Copy ${v.code}`} className="-my-2" />
                </span>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground lg:hidden">
                  {v.customer && <span className="md:hidden">{fullName(v.customer)}</span>}
                  <span>{v.lastUse ? `Last used ${formatDate(v.lastUse.created_at, tz)}` : "Not used yet"}</span>
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
                  <span className="text-muted-foreground" aria-label="Not linked">
                    –
                  </span>
                )}
              </td>
              <td className={cn(`${td} text-right whitespace-nowrap tabular-nums`, "font-extrabold", v.status === "used_up" && "text-destructive")}>
                {formatMoney(v.balance_cents)}
              </td>
              <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell`}>
                {formatMoney(v.amount_cents)}
              </td>
              <td className={`${td} hidden whitespace-nowrap text-muted-foreground lg:table-cell`}>
                {formatDate(v.created_at, tz, { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className={`${td} hidden lg:table-cell`}>
                {v.lastUse ? (
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">{formatDate(v.lastUse.created_at, tz, { day: "numeric", month: "short", year: "numeric" })}</span>
                    {/* Amount and who, so the second line can't be read as a note. */}
                    <span className="truncate text-[13px] text-muted-foreground">
                      <span className="font-semibold tabular-nums">{formatMoney(Math.abs(v.lastUse.delta_cents))}</span>
                      {v.lastUse.customer ? ` by ${fullName(v.lastUse.customer)}` : " · no customer linked"}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not used yet</span>
                )}
              </td>
              <td className={`${td} hidden sm:table-cell`}>
                <GiftVoucherStatusPill status={v.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {total > GIFT_VOUCHERS_PAGE_SIZE && (
        <Pager page={page} pageSize={GIFT_VOUCHERS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="vouchers" anchor="list" className="md:hidden" />
      )}
    </ListPanel>
  );
}
