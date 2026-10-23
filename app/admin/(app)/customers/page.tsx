import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, DataTable, EmptyRow, PageHeader, Avatar, td, th } from "@/components/admin/ui";
import { ActionButton } from "@/components/admin/action-button";
import { AddCustomerButton } from "./add-customer-button";
import { checkInCustomer } from "@/app/admin/actions";
import { CUSTOMER_FILTERS, PAGE_SIZE, getSettings, listCustomers, type CustomerFilter } from "@/lib/admin-data";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatLastVisit, fullName, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Customers" };

const FILTER_LABELS: Record<CustomerFilter, string> = {
  all: "All",
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
  const page = Math.max(1, Number(params.page) || 1);

  const [{ customers, total }, settings] = await Promise.all([listCustomers({ q, filter, page }), getSettings()]);
  const tz = settings.timezone;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (next: Partial<{ q: string; filter: string; page: number }>) => {
    const sp = new URLSearchParams();
    const merged = { q, filter, page: 1, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.page > 1) sp.set("page", String(merged.page));
    const s = sp.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

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

      <Card className="overflow-hidden">
        <DataTable minWidth={820}>
          <thead className="bg-background">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Phone</th>
              <th className={`${th} text-right`}>Points</th>
              <th className={`${th} text-right`}>Visits</th>
              <th className={th}>Last visit</th>
              <th className={th}>Joined</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <EmptyRow colSpan={7}>{q ? `No customers match “${q}”.` : "No customers here yet."}</EmptyRow>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-background/60">
                <td className={td}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 font-bold hover:underline">
                    <Avatar text={initials(c)} />
                    {fullName(c)}
                  </Link>
                </td>
                <td className={`${td} text-muted-foreground tabular-nums`}>{formatPhone(c.phone)}</td>
                <td className={`${td} text-right font-bold tabular-nums`}>{c.points_balance}</td>
                <td className={`${td} text-right tabular-nums`}>{c.visit_count}</td>
                <td className={`${td} text-muted-foreground`}>{formatLastVisit(c.last_visit_at, tz)}</td>
                <td className={`${td} text-muted-foreground`}>{formatDate(c.created_at, tz, { month: "short", year: "numeric" })}</td>
                <td className={`${td} text-right`}>
                  <ActionButton variant="outline" size="sm" action={checkInCustomer.bind(null, c.id)}>
                    Check in
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-muted-foreground">
          <span>
            {total === 0
              ? "No results"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()}`}
          </span>
          <div className="flex gap-2">
            <PageLink href={href({ page: page - 1 })} disabled={page <= 1}>
              Previous
            </PageLink>
            <PageLink href={href({ page: page + 1 })} disabled={page >= pages}>
              Next
            </PageLink>
          </div>
        </div>
      </Card>
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = "flex min-h-10 items-center rounded-[10px] border px-3.5 text-sm font-semibold";
  if (disabled)
    return (
      <span aria-disabled="true" className={`${cls} border-border text-muted-foreground/70`}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={`${cls} border-input bg-card text-foreground hover:bg-muted`}>
      {children}
    </Link>
  );
}
