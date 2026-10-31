import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { FilterSwitch } from "@/components/admin/filter-switch";
import { DataTable, ListPanel, EmptyRow, PageHeader, Pager, td, th } from "@/components/admin/ui";
import { StatusTabs, SummaryCard } from "@/components/admin/list-layout";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { FindVoucherButton } from "@/components/admin/find-voucher";
import { CreateVoucherSplitButton, PrintBlankCardsButton } from "@/components/admin/blank-vouchers";
import { BulkActions, BulkCheckbox, BulkSelectAll } from "@/components/admin/bulk-select";
import {
  GIFT_VOUCHER_FILTERS,
  GIFT_VOUCHER_SORTS,
  GIFT_VOUCHERS_PAGE_SIZE,
  getSettings,
  giftVoucherCounts,
  giftVoucherSummary,
  listGiftVouchers,
  type GiftVoucherFilter,
  type GiftVoucherSort,
} from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { formatDate, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/admin/copy-button";
import { VoucherRowActions } from "@/components/admin/voucher-row-actions";
import { voucherBalanceUrl } from "@/lib/voucher-link";
import { ExternalLink } from "lucide-react";

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export const metadata = { title: "Gift vouchers" };

const FILTER_LABELS: Record<GiftVoucherFilter, string> = {
  all: "All",
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
  inactive: "Not sold",
  blocked: "Blocked",
};

const SORT_LABELS: Record<GiftVoucherSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  balance: "Highest balance",
  expiring: "Expiring soonest",
};

export default function GiftVouchersPage({ searchParams }: PageProps<"/admin/gift-vouchers">) {
  return (
    <>
      <PageHeader
        title="Gift vouchers"
        actions={
          <>
            {/* Everything for a voucher a customer already has (use, top up, activate a blank card)
                starts from its code. Print blank cards is under Create gift voucher's ▾. */}
            <FindVoucherButton />
            <CreateVoucherSplitButton />
          </>
        }
      />
      <Summary />
      <GiftVoucherLists searchParams={searchParams} />
    </>
  );
}

/** The numbers worth knowing at a glance. */
async function Summary() {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const s = await giftVoucherSummary();
  return (
    <SummaryCard
      stats={[
        { value: formatMoney(s.outstandingCents), label: "Unused credit", href: "/admin/gift-vouchers?filter=active" },
        { value: s.activeCount.toLocaleString(), label: "Active vouchers", href: "/admin/gift-vouchers?filter=active" },
        { value: formatMoney(s.soldThisMonthCents), label: `New this month (${s.soldThisMonth.toLocaleString()})` },
      ]}
    />
  );
}

type Params = Awaited<PageProps<"/admin/gift-vouchers">["searchParams"]>;

async function GiftVoucherLists({ searchParams }: { searchParams: PageProps<"/admin/gift-vouchers">["searchParams"] }) {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  return <VoucherList params={await searchParams} />;
}

async function VoucherList({ params }: { params: Params }) {
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const filter = GIFT_VOUCHER_FILTERS.includes(params.filter as GiftVoucherFilter) ? (params.filter as GiftVoucherFilter) : "all";
  // "Used today" isn't a status, so it's a toggle that works with any tab (older links said filter=used_today).
  const usedToday = params.today === "1" || params.filter === "used_today";
  const sort = GIFT_VOUCHER_SORTS.includes(params.sort as GiftVoucherSort) ? (params.sort as GiftVoucherSort) : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ vouchers, total, pastEnd }, settings, counts] = await Promise.all([
    listGiftVouchers({ q, filter, usedToday, sort, page }),
    getSettings(),
    giftVoucherCounts(),
  ]);
  const tz = settings.timezone;

  // Every link keeps the tab, search, toggle and sort; anything that changes the list goes back to page 1.
  const href = (next: Partial<{ q: string; filter: string; today: boolean; sort: GiftVoucherSort; page: number }>) => {
    const sp = new URLSearchParams();
    const merged = { q, filter, today: usedToday, sort, page: 1, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.today) sp.set("today", "1");
    if (merged.sort !== "newest") sp.set("sort", merged.sort);
    if (merged.page > 1) sp.set("page", String(merged.page));
    const s = sp.toString();
    return `/admin/gift-vouchers${s ? `?${s}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && vouchers.length === 0)) redirect(href({ page: 1 }));

  return (
    <>
      <StatusTabs
        label="Gift vouchers by status"
        value={filter}
        tabs={GIFT_VOUCHER_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f], count: counts[f], href: href({ filter: f }) }))}
      />
      <ListPanel id="list" className="scroll-mt-4">
        {/* The search and sort sit above the rows, in one panel, so spare space under a short list
            reads as part of the list rather than an empty table. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border p-3 md:gap-3 md:p-4">
          <SearchBox
            action="/admin/gift-vouchers"
            id="gv-q"
            label="Search by code, name or phone"
            placeholder="Code, name or phone"
            defaultValue={q}
            className="min-w-0 flex-1 md:max-w-sm"
          >
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {usedToday && <input type="hidden" name="today" value="1" />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          </SearchBox>
          {/* For checking against the till at the end of the day; works with any tab. */}
          <FilterSwitch label="Used today" checked={usedToday} href={href({ today: !usedToday })} className="hidden md:flex" />
          <div className="ml-auto flex flex-none items-center gap-2.5">
            <span className="hidden text-sm font-semibold text-muted-foreground lg:inline">Sort by</span>
            <FilterSelect
              label="Sort by"
              value={sort}
              options={GIFT_VOUCHER_SORTS.map((o) => ({ value: o, label: SORT_LABELS[o], href: href({ sort: o }) }))}
              className="w-32 md:w-44"
            />
          </div>
          {/* From tablet width up the pager sits in this toolbar, Gmail-style; phones keep it under the list. */}
          <Pager compact page={page} pageSize={GIFT_VOUCHERS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="hidden md:flex" />
        </div>
        {filter === "inactive" && (
          // Where blank cards are tracked, say what they are.
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/60 px-4 py-2.5 text-[13px] text-muted-foreground">
            <span className="min-w-0 flex-1">Blank cards printed in advance, waiting to be activated. When one is bought, find its code and activate it with the amount.</span>
            <PrintBlankCardsButton />
          </div>
        )}
        <BulkActions key={`bulk:${href({ page })}`} />
        {/* Narrower screens fold the customer, last use and status under the code. The customer (the
            code on phones) takes the spare width and the rest are fixed, so results don't re-space them.
            The key starts each new search, filter or page at the top of the rows. */}
        <DataTable key={href({ page })} minWidth={0} fill>
          <thead className="bg-card">
            <tr>
              {/* Choosing several to delete is a desk job, so phones leave the checkboxes out. */}
              <th className={`${th} hidden w-12 pr-0 sm:table-cell`}>
                <BulkSelectAll />
              </th>
              <th className={`${th} md:w-44`}>Code</th>
              <th className={`${th} hidden md:table-cell`}>Customer</th>
              <th className={`${th} w-28 text-right`}>Balance</th>
              <th className={`${th} hidden w-28 text-right xl:table-cell`}>Amount</th>
              <th className={`${th} hidden w-32 wide:table-cell`}>Created</th>
              <th className={`${th} hidden w-32 xl:table-cell`}>Expires</th>
              <th className={`${th} hidden w-48 wide:table-cell`}>Last used</th>
              <th className={`${th} hidden w-30 sm:table-cell`}>Status</th>
              <th className={`${th} w-22 px-0`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 && (
              <EmptyRow colSpan={10}>{q ? `No gift vouchers match “${q}”.` : usedToday ? "No gift vouchers here were used today." : filter === "inactive" ? "No blank cards waiting to be activated. Print some with Print blank cards." : "No gift vouchers here yet."}</EmptyRow>
            )}
            {vouchers.map((v) => (
              // A used-up voucher gets a red tint, so staff spot at a glance that there's no credit left.
              <tr key={v.id} className={v.status === "used_up" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-background/60"}>
                <td className={`${td} hidden pr-0 sm:table-cell`}>
                  {/* Only one nothing has been spent from can be deleted. */}
                  {!v.lastUse && <BulkCheckbox id={v.id} label={`Choose ${v.code}`} />}
                </td>
                <td className={td}>
                  <span className="flex items-center gap-0.5">
                    <Link href={`/admin/gift-vouchers/${v.id}`} className="font-mono font-bold tracking-wider whitespace-nowrap hover:underline">
                      {v.code}
                    </Link>
                    <CopyButton text={v.code} label={`Copy ${v.code}`} className="-my-2" />
                  </span>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground wide:hidden">
                    {v.customer && <span className="md:hidden">{fullName(v.customer)}</span>}
                    <span>{v.status === "inactive" ? "Not sold yet" : v.lastUse ? `Last used ${formatDate(v.lastUse.created_at, tz)}` : "Not used yet"}</span>
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
                  {/* The balance page the card's QR opens (what the customer sees), in a new tab, for
                      every voucher. A Not sold card has no balance yet, so it says so. */}
                  <span className="inline-flex items-center gap-1">
                    {v.status === "inactive" ? (
                      <span className="text-[13px] font-semibold text-muted-foreground">No balance yet</span>
                    ) : (
                      formatMoney(v.balance_cents)
                    )}
                    <a
                      href={voucherBalanceUrl(v.public_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open the balance page for ${v.code}`}
                      title="Open the balance page"
                      className="-my-2 inline-flex size-7 items-center justify-center rounded-md font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </span>
                  {/* Phones: the status sits under the balance, so a row stays two lines. */}
                  <span className="mt-1 flex justify-end sm:hidden">
                    <GiftVoucherStatusPill status={v.status} />
                  </span>
                </td>
                <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell`}>
                  {v.amount_cents === null ? "–" : formatMoney(v.amount_cents)}
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground wide:table-cell`}>
                  {formatDate(v.created_at, tz, { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground xl:table-cell`}>
                  {v.expires_on ? formatDate(`${v.expires_on}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" }) : "–"}
                </td>
                <td className={`${td} hidden wide:table-cell`}>
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
                    <span className="text-muted-foreground">{v.status === "inactive" ? "Not sold yet" : "Not used yet"}</span>
                  )}
                </td>
                <td className={`${td} hidden sm:table-cell`}>
                  <GiftVoucherStatusPill status={v.status} />
                </td>
                <td className={`${td} px-0`}>
                  <VoucherRowActions
                    voucher={{ id: v.id, code: v.code, status: v.status, token: v.public_token, expiresOn: v.expires_on, neverUsed: !v.lastUse }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {total > GIFT_VOUCHERS_PAGE_SIZE && (
          <Pager page={page} pageSize={GIFT_VOUCHERS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="vouchers" anchor="list" className="md:hidden" />
        )}
      </ListPanel>
    </>
  );
}
