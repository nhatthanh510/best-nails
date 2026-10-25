import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable, ListPanel, EmptyRow, PageHeader, Pager, SortableTh, Avatar, TierBadge, td, th } from "@/components/admin/ui";
import { ListPanelSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { tierFor } from "@/lib/tiers";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { AddCustomerButton } from "./add-customer-button";
import {
  CUSTOMER_FILTERS,
  CUSTOMER_SORTS,
  DEFAULT_SORT_DIR,
  PAGE_SIZE,
  getSettings,
  listCustomers,
  type CustomerFilter,
  type CustomerSort,
  type SortDir,
} from "@/lib/admin-data";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatLastVisit, fullName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Customers" };

const FILTER_LABELS: Record<CustomerFilter, string> = {
  all: "All",
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  birthday: "Birthday this month",
};

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Customers" subtitle={<Skeleton className="mt-1 h-4 w-24" />} />
          <ListPanelSkeleton avatar label="Loading customers" />
        </>
      }
    >
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const filter = CUSTOMER_FILTERS.includes(params.filter as CustomerFilter) ? (params.filter as CustomerFilter) : "all";
  const sort = CUSTOMER_SORTS.includes(params.sort as CustomerSort) ? (params.sort as CustomerSort) : "last_visit";
  const dir: SortDir = params.dir === "asc" || params.dir === "desc" ? params.dir : DEFAULT_SORT_DIR[sort];
  const page = Math.max(1, Number(params.page) || 1);

  const settings = await getSettings();
  const { customers, total, pastEnd } = await listCustomers({ q, filter, sort, dir, page });
  const tz = settings.timezone;

  // Every link keeps the search, filter and sort; anything that changes the list goes back to page 1.
  const href = (next: Partial<{ q: string; filter: string; sort: CustomerSort; dir: SortDir; page: number }>) => {
    const sp = new URLSearchParams();
    const merged = { q, filter, sort, dir, page: 1, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.sort !== "last_visit") sp.set("sort", merged.sort);
    if (merged.dir !== DEFAULT_SORT_DIR[merged.sort]) sp.set("dir", merged.dir);
    if (merged.page > 1) sp.set("page", String(merged.page));
    const s = sp.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };
  // Clicking the sorted column flips it; another column starts in its natural direction.
  const sortable = (column: CustomerSort, label: string, className?: string) => (
    <SortableTh
      label={label}
      active={sort === column}
      dir={dir}
      href={href({ sort: column, dir: sort === column ? (dir === "asc" ? "desc" : "asc") : DEFAULT_SORT_DIR[column] })}
      className={className}
    />
  );
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && customers.length === 0)) redirect(href({ page: 1 }));

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${total.toLocaleString()} ${filter === "all" && !q ? (total === 1 ? "member" : "members") : "matching"}`}
        actions={<AddCustomerButton />}
      />

      <ListPanel id="list" className="scroll-mt-4">
        {/* The toolbar and rows are one panel, Gmail-style, so spare space under a short list reads as
            part of the list rather than an empty table. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border p-4">
          <SearchBox
            action="/admin/customers"
            id="q"
            label="Search customers"
            placeholder="Search by name or phone"
            defaultValue={q}
            className="w-full md:w-auto md:flex-[1_1_200px]"
          >
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {sort !== "last_visit" && <input type="hidden" name="sort" value={sort} />}
            {dir !== DEFAULT_SORT_DIR[sort] && <input type="hidden" name="dir" value={dir} />}
          </SearchBox>
          {/* Phones: one dropdown beside the search. From tablet width up: the chips. */}
          <FilterSelect
            label="Filter customers"
            value={filter}
            options={CUSTOMER_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f], href: href({ filter: f }) }))}
            className="w-full md:hidden"
          />
          <div role="group" aria-label="Filter" className="hidden flex-wrap gap-2 md:flex">
            {CUSTOMER_FILTERS.map((f) => (
              <Link
                key={f}
                href={href({ filter: f })}
                aria-current={f === filter ? "true" : undefined}
                className={cn(
                  "flex min-h-10 flex-none items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap",
                  f === filter ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                )}
              >
                {FILTER_LABELS[f]}
              </Link>
            ))}
          </div>
          {/* From tablet width up the pager sits in this toolbar, Gmail-style; phones keep it under the list. */}
          <Pager compact page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="ml-auto hidden md:flex" />
        </div>
        {/* Narrower screens drop columns rather than scroll: phone and tier move under the name.
            Every column but the name has a fixed width, so new search results don't re-space them.
            The key starts each new search, sort or page at the top of the rows. */}
        <DataTable key={href({ page })} minWidth={0} fill>
          <thead className="bg-card">
            <tr>
              {sortable("name", "Name")}
              <th className={`${th} hidden w-28 xl:table-cell`}>Tier</th>
              <th className={`${th} hidden w-36 sm:table-cell`}>Phone</th>
              {sortable("points", "Points", "w-24 text-right")}
              {sortable("lifetime", "Lifetime points", "hidden w-40 text-right sm:table-cell")}
              {sortable("last_visit", "Last visit", "hidden w-30 md:table-cell")}
              {sortable("joined", "Joined", "hidden w-26 xl:table-cell")}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <EmptyRow colSpan={7}>{q ? `No customers match “${q}”.` : "No customers here yet."}</EmptyRow>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-background/60">
                <td className={td}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="hidden sm:block">
                      <Avatar text={initials(c)} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-bold">{fullName(c)}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground tabular-nums xl:hidden">
                        <span className="whitespace-nowrap sm:hidden">{formatPhone(c.phone)}</span>
                        <TierBadge tier={tierFor(c.lifetime_points, settings)} />
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} hidden xl:table-cell`}>
                  <TierBadge tier={tierFor(c.lifetime_points, settings)} showNew />
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>{formatPhone(c.phone)}</td>
                <td className={`${td} text-right font-bold tabular-nums`}>
                  {c.points_balance}
                  {/* The Lifetime points column is hidden on phones; it decides the tier, so keep it here. */}
                  <span className="block text-[12px] font-medium whitespace-nowrap text-muted-foreground sm:hidden">{c.lifetime_points} lifetime</span>
                </td>
                <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{c.lifetime_points}</td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground md:table-cell`}>{formatLastVisit(c.last_visit_at, tz)}</td>
                <td className={`${td} hidden text-muted-foreground xl:table-cell`}>
                  {formatDate(c.created_at, tz, { month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} anchor="list" className="md:hidden" />
      </ListPanel>
    </>
  );
}

