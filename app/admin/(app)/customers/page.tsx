import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Card, DataTable, EmptyRow, PageHeader, Pager, SortableTh, Avatar, TierBadge, td, th } from "@/components/admin/ui";
import { tierFor } from "@/lib/tiers";
import { ActionButton } from "@/components/admin/action-button";
import { AddCustomerButton } from "./add-customer-button";
import { checkInCustomer } from "@/app/admin/actions";
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
  vip: "VIP",
  regular: "Regular",
  recent: "Visited in 30 days",
  birthday: "Birthday this month",
  lapsed: "No visit in 90 days",
};

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<PageHeader title="Customers" subtitle="Loading…" />}>
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
  const { customers, total, pastEnd } = await listCustomers({ q, filter, sort, dir, page, tiers: settings });
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
        subtitle={`${total.toLocaleString()} ${filter === "all" && !q ? "members" : "matching"}`}
        actions={<AddCustomerButton />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/customers" className="relative min-w-0 flex-[1_1_320px]" role="search">
          <label htmlFor="q" className="sr-only">
            Search customers
          </label>
          <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4.5 text-muted-foreground" aria-hidden="true" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name or phone"
            className="h-11 w-full rounded-xl border border-input bg-card pr-3.5 pl-10.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          {sort !== "last_visit" && <input type="hidden" name="sort" value={sort} />}
          {dir !== DEFAULT_SORT_DIR[sort] && <input type="hidden" name="dir" value={dir} />}
        </form>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
          {CUSTOMER_FILTERS.map((f) => (
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
        {/* Narrower screens drop columns rather than scroll: phone and tier move under the name. */}
        <DataTable minWidth={0}>
          <thead className="bg-background">
            <tr>
              {sortable("name", "Name")}
              <th className={`${th} hidden xl:table-cell`}>Tier</th>
              <th className={`${th} hidden sm:table-cell`}>Phone</th>
              {sortable("points", "Points", "text-right")}
              {sortable("visits", "Visits", "hidden text-right sm:table-cell")}
              {sortable("last_visit", "Last visit", "hidden md:table-cell")}
              {sortable("joined", "Joined", "hidden xl:table-cell")}
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <EmptyRow colSpan={8}>{q ? `No customers match “${q}”.` : "No customers here yet."}</EmptyRow>
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
                        <TierBadge tier={tierFor(c.visit_count, settings)} />
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} hidden xl:table-cell`}>
                  <TierBadge tier={tierFor(c.visit_count, settings)} showNew />
                </td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>{formatPhone(c.phone)}</td>
                <td className={`${td} text-right font-bold tabular-nums`}>{c.points_balance}</td>
                <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{c.visit_count}</td>
                <td className={`${td} hidden whitespace-nowrap text-muted-foreground md:table-cell`}>{formatLastVisit(c.last_visit_at, tz)}</td>
                <td className={`${td} hidden text-muted-foreground xl:table-cell`}>
                  {formatDate(c.created_at, tz, { month: "short", year: "numeric" })}
                </td>
                <td className={`${td} text-right`}>
                  <ActionButton variant="outline" size="sm" action={checkInCustomer.bind(null, c.id)}>
                    Check in
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} anchor="list" />
      </Card>
    </>
  );
}

