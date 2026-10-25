import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { DataTable, ListPanel, EmptyRow, PageHeader, Pager, td, th } from "@/components/admin/ui";
import { ListPanelSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { SellGiftVoucherButton, UseGiftVoucherButton } from "@/components/admin/gift-voucher-forms";
import {
  GIFT_ACTIVITY_KINDS,
  GIFT_ACTIVITY_PAGE_SIZE,
  GIFT_ACTIVITY_RANGES,
  GIFT_VOUCHER_FILTERS,
  GIFT_VOUCHERS_PAGE_SIZE,
  getSettings,
  giftVoucherSummary,
  listGiftVoucherActivity,
  listGiftVouchers,
  staffNames,
  type GiftActivityKind,
  type GiftActivityRange,
  type GiftActivityRow,
  type GiftVoucherFilter,
} from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gift vouchers" };

const FILTER_LABELS: Record<GiftVoucherFilter, string> = {
  all: "All",
  active: "With balance",
  used_up: "Used up",
  expired: "Expired",
};

const KIND_LABELS: Record<GiftActivityKind, string> = { all: "All", sale: "Sold", spend: "Used" };
const RANGE_LABELS: Record<GiftActivityRange, string> = { "7d": "7 days", "30d": "30 days", all: "All time" };
const VIEWS = { vouchers: "Vouchers", activity: "Activity" } as const;
type View = keyof typeof VIEWS;

const chip = (active: boolean) =>
  cn(
    "flex min-h-10 flex-none items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap",
    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
  );
/** Sold and Used are opposite money flows, so each has its own colour (on the chip and the rows) to tell them apart at a glance. */
const KIND_TONES: Record<GiftActivityKind, { chip: string; text: string }> = {
  all: { chip: "border-primary bg-primary text-primary-foreground", text: "" },
  sale: { chip: "border-success bg-success text-white", text: "text-success" },
  spend: { chip: "border-warning bg-warning text-white", text: "text-warning" },
};
const kindChip = (kind: GiftActivityKind, active: boolean) =>
  cn(
    "flex min-h-10 flex-none items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap",
    active ? KIND_TONES[kind].chip : "border-input bg-card hover:bg-muted",
  );
const segment = (active: boolean) =>
  cn(
    "flex min-h-10 items-center px-3.5 text-sm font-bold whitespace-nowrap border-l border-input first:border-l-0",
    active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
  );


export default function GiftVouchersPage({ searchParams }: PageProps<"/admin/gift-vouchers">) {
  return (
    <>
      <PageHeader
        title="Gift vouchers"
        subtitle={
          // One line rather than stat tiles, so the list below has room to fit the screen.
          <Suspense fallback={<Skeleton className="mt-1 h-4 w-80 max-w-full" />}>
            <Summary />
          </Suspense>
        }
        actions={
          <>
            <UseGiftVoucherButton variant="outline" />
            <SellGiftVoucherButton />
          </>
        }
      />

      <Suspense fallback={<ListPanelSkeleton label="Loading gift vouchers" />}>
        <GiftVoucherLists searchParams={searchParams} />
      </Suspense>
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
      {total(s.soldThisMonthCents)} sold this month ({s.soldThisMonth.toLocaleString()} voucher{s.soldThisMonth === 1 ? "" : "s"})
    </>
  );
}

type Params = Awaited<PageProps<"/admin/gift-vouchers">["searchParams"]>;

/**
 * Two views of the same vouchers: the list (one row per voucher, with when it was last used)
 * and Activity (one row per sale, spend, undo or adjustment across all vouchers), so staff can
 * see who bought, who used and when without opening each voucher.
 */
async function GiftVoucherLists({ searchParams }: { searchParams: PageProps<"/admin/gift-vouchers">["searchParams"] }) {
  const params = await searchParams;
  return params.view === "activity" ? <ActivityList params={params} /> : <VoucherList params={params} />;
}

/** The view switch and search that start both toolbars. */
function ToolbarStart({ view, q, hidden }: { view: View; q: string; hidden: Record<string, string> }) {
  return (
    <>
      <nav aria-label="View" className="flex flex-none overflow-hidden rounded-xl border border-input">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={v === "activity" ? "/admin/gift-vouchers?view=activity" : "/admin/gift-vouchers"}
            aria-current={v === view ? "page" : undefined}
            className={segment(v === view)}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </nav>
      <SearchBox
        action="/admin/gift-vouchers"
        id="gv-q"
        label={view === "activity" ? "Search activity by code, name or phone" : "Search by code"}
        placeholder={view === "activity" ? "Code, name or phone" : "Search by code"}
        defaultValue={q}
        className="w-full max-md:order-first md:w-auto md:flex-[1_1_200px]"
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </SearchBox>
    </>
  );
}

async function VoucherList({ params }: { params: Params }) {
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
    <ListPanel id="list" className="scroll-mt-4">
      {/* The toolbar and rows are one panel, Gmail-style, so spare space under a short list reads as
          part of the list rather than an empty table. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
        <ToolbarStart view="vouchers" q={q} hidden={filter !== "all" ? { filter } : {}} />
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
            <th className={`${th} hidden w-32 lg:table-cell`}>Sold</th>
            <th className={`${th} hidden w-48 lg:table-cell`}>Last used</th>
            <th className={`${th} hidden w-30 sm:table-cell`}>Status</th>
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
                  {v.code}
                </Link>
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
              <td className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums`}>{formatMoney(v.balance_cents)}</td>
              <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell`}>
                {formatMoney(v.amount_cents)}
              </td>
              <td className={`${td} hidden whitespace-nowrap text-muted-foreground lg:table-cell`}>
                {formatDate(v.created_at, tz, { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className={`${td} hidden lg:table-cell`}>
                {v.lastUse ? (
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">{formatDate(v.lastUse.created_at, tz)}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{v.lastUse.customer ? fullName(v.lastUse.customer) : "No customer given"}</span>
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

/** What an activity row did, in words, with the amount signed the way the balance moved. */
function describe(r: GiftActivityRow) {
  const amount = formatMoney(Math.abs(r.delta_cents));
  if (r.kind === "sale") return { label: "Sold", amount: `+${amount}` };
  if (r.kind === "spend") return { label: r.voided_at ? "Used, then undone" : "Used", amount: `−${amount}` };
  if (r.kind === "undo") return { label: "Spend undone", amount: `+${amount}` };
  return { label: "Adjusted", amount: `${r.delta_cents > 0 ? "+" : "−"}${amount}` };
}

async function ActivityList({ params }: { params: Params }) {
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const kind = GIFT_ACTIVITY_KINDS.includes(params.kind as GiftActivityKind) ? (params.kind as GiftActivityKind) : "all";
  const range = (params.range as GiftActivityRange) in GIFT_ACTIVITY_RANGES ? (params.range as GiftActivityRange) : "30d";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total, pastEnd }, settings, names] = await Promise.all([
    listGiftVoucherActivity({ q, kind, range, page }),
    getSettings(),
    staffNames(),
  ]);
  const tz = settings.timezone;

  const href = (next: Partial<{ q: string; kind: string; range: string; page: number }>) => {
    const sp = new URLSearchParams({ view: "activity" });
    const merged = { q, kind, range, page: 1, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.kind !== "all") sp.set("kind", merged.kind);
    if (merged.range !== "30d") sp.set("range", merged.range);
    if (merged.page > 1) sp.set("page", String(merged.page));
    return `/admin/gift-vouchers?${sp}`;
  };
  if (pastEnd || (page > 1 && rows.length === 0)) redirect(href({ page: 1 }));

  const hidden: Record<string, string> = { view: "activity" };
  if (kind !== "all") hidden.kind = kind;
  if (range !== "30d") hidden.range = range;

  return (
    <ListPanel id="list" className="scroll-mt-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
        <ToolbarStart view="activity" q={q} hidden={hidden} />
        <FilterSelect
          label="What happened"
          value={kind}
          options={GIFT_ACTIVITY_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k], href: href({ kind: k }) }))}
          className="min-w-0 flex-1 md:hidden"
        />
        <div role="group" aria-label="What happened" className="hidden flex-wrap gap-2 md:flex">
          {GIFT_ACTIVITY_KINDS.map((k) => (
            <Link key={k} href={href({ kind: k })} aria-current={k === kind ? "true" : undefined} className={kindChip(k, k === kind)}>
              {KIND_LABELS[k]}
            </Link>
          ))}
        </div>
        <nav aria-label="Date range" className="flex flex-none overflow-hidden rounded-xl border border-input">
          {(Object.keys(GIFT_ACTIVITY_RANGES) as GiftActivityRange[]).map((r) => (
            <Link key={r} href={href({ range: r })} aria-current={r === range ? "true" : undefined} className={segment(r === range)}>
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </nav>
        <Pager compact page={page} pageSize={GIFT_ACTIVITY_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="ml-auto hidden md:flex" />
      </div>
      {/* One row per sale, spend, undo or adjustment, newest first. Phones fold the voucher,
          customer and staff member under what happened. */}
      <DataTable key={href({ page })} minWidth={0} fill>
        <thead className="bg-card">
          <tr>
            <th className={`${th} w-32 sm:w-44`}>When</th>
            <th className={th}>What happened</th>
            <th className={`${th} hidden w-40 md:table-cell`}>Voucher</th>
            <th className={`${th} hidden lg:table-cell`}>Customer</th>
            <th className={`${th} w-28 text-right`}>Amount</th>
            <th className={`${th} hidden w-28 text-right sm:table-cell`}>Balance after</th>
            <th className={`${th} hidden w-28 xl:table-cell`}>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <EmptyRow colSpan={7}>{q ? `Nothing in this period matches “${q}”.` : "No gift voucher activity in this period."}</EmptyRow>
          )}
          {rows.map((r) => {
            const d = describe(r);
            const who = r.customer ? fullName(r.customer) : null;
            return (
              <tr key={r.id} className={r.voided_at ? "text-muted-foreground" : "hover:bg-background/60"}>
                <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>
                  <span className="flex flex-col sm:flex-row sm:gap-1">
                    <span>{formatDate(r.created_at, tz)}</span>
                    <span>{formatTime(r.created_at, tz)}</span>
                  </span>
                </td>
                <td className={td}>
                  <span className={cn("font-bold", !r.voided_at && (r.kind === "sale" || r.kind === "spend") && KIND_TONES[r.kind].text)}>{d.label}</span>
                  {r.note && <span className="block text-[13px] text-muted-foreground">{r.note}</span>}
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-muted-foreground lg:hidden">
                    <Link href={`/admin/gift-vouchers/${r.voucher.id}`} className="font-mono font-bold hover:underline md:hidden">
                      {r.voucher.code}
                    </Link>
                    {who && <span>{who}</span>}
                  </span>
                </td>
                <td className={`${td} hidden md:table-cell`}>
                  <Link href={`/admin/gift-vouchers/${r.voucher.id}`} className="font-mono font-bold tracking-wider hover:underline">
                    {r.voucher.code}
                  </Link>
                </td>
                <td className={`${td} hidden lg:table-cell`}>
                  {r.customer ? (
                    <Link href={`/admin/customers/${r.customer.id}`} className="font-semibold hover:underline">
                      {who}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground" aria-label="No customer given">
                      –
                    </span>
                  )}
                </td>
                <td className={cn(`${td} text-right font-extrabold whitespace-nowrap tabular-nums`, r.voided_at && "line-through")}>{d.amount}</td>
                <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>
                  {formatMoney(r.balance_after_cents)}
                </td>
                <td className={`${td} hidden truncate text-muted-foreground xl:table-cell`}>{names.get(r.created_by ?? "") ?? "Staff"}</td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      {total > GIFT_ACTIVITY_PAGE_SIZE && (
        <Pager page={page} pageSize={GIFT_ACTIVITY_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="entries" anchor="list" className="md:hidden" />
      )}
    </ListPanel>
  );
}
