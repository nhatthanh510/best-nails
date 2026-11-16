import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Layers, WalletCards } from "lucide-react";
import { SearchBox } from "@/components/admin/search-box";
import { FilterSelect } from "@/components/admin/filter-select";
import { FilterSwitch } from "@/components/admin/filter-switch";
import { DataTable, ListPanel, EmptyRow, PageHeader, Pager, td, th } from "@/components/admin/ui";
import { StatusTabs, SummaryCard } from "@/components/admin/list-layout";
import { GiftCardStatusPill } from "@/components/admin/gift-card-status";
import { FindGiftCardButton } from "@/components/admin/find-gift-card";
import { CreateGiftCardSplitButton, PrintBlankCardsButton } from "@/components/admin/blank-gift-cards";
import { BulkActions, BulkCheckbox, BulkSelectAll } from "@/components/admin/bulk-select";
import {
  GIFT_CARD_FILTERS,
  GIFT_CARD_SORTS,
  GIFT_CARDS_PAGE_SIZE,
  getSettings,
  giftCardCounts,
  getGiftCardBatch,
  giftCardSummary,
  listGiftCards,
  type GiftCardFilter,
  type GiftCardListRow,
  type GiftCardSort,
} from "@/lib/admin-data";
import { formatDollars, formatMoney } from "@/lib/gift-cards";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/admin/copy-button";
import { GiftCardRowActions } from "@/components/admin/gift-card-row-actions";
import { GiftCardBatchBar } from "@/components/admin/gift-card-batch-bar";
import { Highlight } from "@/components/admin/highlight";
import { InstantFilter } from "@/components/admin/instant-filter";
import { giftCardSearchTerms } from "@/lib/highlight";

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export const metadata = { title: "Gift cards" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FILTER_LABELS: Record<GiftCardFilter, string> = {
  all: "All",
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
  inactive: "Not sold",
  blocked: "Blocked",
};

const SORT_LABELS: Record<GiftCardSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  balance: "Highest balance",
  expiring: "Expiring soonest",
};

/** Where an empty tab's gift cards would come from. */
const EMPTY_HINTS: Partial<Record<string, string>> = {
  all: "Create one when a customer buys a gift card.",
  active: "A gift card is here from when it's created until its balance is used.",
  used_up: "A gift card moves here once its whole balance has been used. A top-up makes it active again.",
  expired: "A gift card moves here after its expiry date, 3 years or more after it was last loaded.",
  blocked: "A lost or stolen gift card shows here once it's blocked from its page.",
};

export default function GiftCardsPage({ searchParams }: PageProps<"/admin/gift-cards">) {
  return (
    <>
      <PageHeader
        title="Gift cards"
        actions={
          <>
            {/* Everything for a gift card a customer already has (use, top up, activate a blank card)
                starts from its code. Print blank cards is under Create gift card's ▾. */}
            <FindGiftCardButton />
            <CreateGiftCardSplitButton />
          </>
        }
      />
      <Summary />
      <GiftCardLists searchParams={searchParams} />
    </>
  );
}

/** The numbers worth knowing at a glance. */
async function Summary() {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const s = await giftCardSummary();
  return (
    <SummaryCard
      stats={[
        { value: formatDollars(s.outstandingCents), label: "Unused credit", href: "/admin/gift-cards?filter=active" },
        { value: s.activeCount.toLocaleString(), label: "Active gift cards", href: "/admin/gift-cards?filter=active" },
        { value: formatDollars(s.soldThisMonthCents), label: `New this month (${s.soldThisMonth.toLocaleString()})` },
      ]}
    />
  );
}

type Params = Awaited<PageProps<"/admin/gift-cards">["searchParams"]>;

async function GiftCardLists({ searchParams }: { searchParams: PageProps<"/admin/gift-cards">["searchParams"] }) {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  return <GiftCardList params={await searchParams} />;
}

async function GiftCardList({ params }: { params: Params }) {
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const filter = GIFT_CARD_FILTERS.includes(params.filter as GiftCardFilter) ? (params.filter as GiftCardFilter) : "all";
  // "Used today" isn't a status, so it's a toggle that works with any tab (older links said filter=used_today).
  const usedToday = params.today === "1" || params.filter === "used_today";
  const sort = GIFT_CARD_SORTS.includes(params.sort as GiftCardSort) ? (params.sort as GiftCardSort) : "newest";
  const page = Math.max(1, Number(params.page) || 1);
  // One print run's cards (a card's batch tag opens it).
  const batchId = typeof params.batch === "string" && UUID.test(params.batch) ? params.batch : "";

  const [{ giftCards, total, pastEnd }, settings, counts, batch] = await Promise.all([
    listGiftCards({ q, filter, usedToday, sort, page, batch: batchId || undefined }),
    getSettings(),
    giftCardCounts(),
    batchId ? getGiftCardBatch(batchId) : null,
  ]);
  const tz = settings.timezone;
  // What a search matched (a code or part of a name), marked in the rows.
  const search = q ? giftCardSearchTerms(q) : undefined;

  // Every link keeps the tab, search, toggle, sort and batch; anything that changes the list goes back to page 1.
  const href = (next: Partial<{ q: string; filter: string; today: boolean; sort: GiftCardSort; page: number; batch: string }>) => {
    const sp = new URLSearchParams();
    const merged = { q, filter, today: usedToday, sort, page: 1, batch: batchId, ...next };
    if (merged.q) sp.set("q", merged.q);
    if (merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.today) sp.set("today", "1");
    if (merged.sort !== "newest") sp.set("sort", merged.sort);
    if (merged.page > 1) sp.set("page", String(merged.page));
    if (merged.batch) sp.set("batch", merged.batch);
    const s = sp.toString();
    return `/admin/gift-cards${s ? `?${s}` : ""}`;
  };
  // A stale or hand-typed page number past the end starts again from the first page.
  if (pastEnd || (page > 1 && giftCards.length === 0)) redirect(href({ page: 1 }));
  // A batch tag opens the whole batch: every status, no search.
  const batchHref = (id: string) => href({ batch: id, filter: "all", q: "", today: false });
  const printed = (iso: string) => formatDate(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <StatusTabs
        label="Gift cards by status"
        value={filter}
        tabs={GIFT_CARD_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f], count: counts[f], href: href({ filter: f }) }))}
      />
      <ListPanel id="list" className="scroll-mt-4">
        {/* The search and sort sit above the rows, in one panel, so spare space under a short list
            reads as part of the list rather than an empty table. */}
        <div className="flex shrink-0 items-center max-md:flex-wrap gap-2 border-b border-border p-3 md:gap-3 md:p-4">
          <SearchBox
            action="/admin/gift-cards"
            id="gv-q"
            label="Search by code, name or phone"
            placeholder="Code, name or phone"
            defaultValue={q}
            className="min-w-0 flex-1 md:max-w-sm"
          >
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {usedToday && <input type="hidden" name="today" value="1" />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            {batchId && <input type="hidden" name="batch" value={batchId} />}
          </SearchBox>
          {/* For checking against the till at the end of the day; works with any tab. */}
          <FilterSwitch label="Used today" checked={usedToday} href={href({ today: !usedToday })} className="max-md:order-last max-md:w-full" />
          <div className="ml-auto flex flex-none items-center gap-2.5">
            <span className="hidden text-sm font-semibold text-muted-foreground lg:inline">Sort by</span>
            <FilterSelect
              label="Sort by"
              value={sort}
              options={GIFT_CARD_SORTS.map((o) => ({ value: o, label: SORT_LABELS[o], href: href({ sort: o }) }))}
              className="w-32 md:w-44"
            />
          </div>
          {/* From tablet width up the pager sits in this toolbar, Gmail-style; phones keep it under the list. */}
          <Pager compact page={page} pageSize={GIFT_CARDS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} className="hidden md:flex" />
        </div>
        {filter === "inactive" && (
          // Where blank cards are tracked, say what they are.
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/60 px-4 py-2.5 text-[13px] text-muted-foreground">
            <span className="min-w-0 flex-1">Blank cards printed in advance, waiting to be activated. When one is bought, find its code and activate it with the amount.</span>
            <PrintBlankCardsButton />
          </div>
        )}
        {batch && (
          <GiftCardBatchBar
            printed={`Printed ${printed(batch.createdAt)}${batch.printedBy ? ` by ${batch.printedBy}` : ""}`}
            cards={batch.cards}
            closeHref={href({ batch: "" })}
          />
        )}
        {/* Narrows the rows on screen as you type, until the search result arrives. */}
        <InstantFilter q={q} />
        {/* In a batch, ticking the whole page offers "Choose all N in this batch". */}
        <BulkActions key={`bulk:${href({ page })}`} batch={batch?.cards.filter((c) => c.unused).map((c) => c.id)} />
        {/* Narrower screens fold the customer, last use and status under the code. The customer (the
            code on phones) takes the spare width and the rest are fixed, so results don't re-space them.
            The key starts each new search, filter or page at the top of the rows. */}
        <DataTable key={href({ page })} minWidth={0} fill>
          <thead className="bg-card">
            <tr>
              {/* At every width, so a batch can be printed or tidied up from a phone too. */}
              <th className={`${th} w-10 pr-0 sm:w-12`}>
                <BulkSelectAll />
              </th>
              <th className={`${th} md:w-44`}>Code</th>
              <th className={`${th} hidden md:table-cell`}>Customer</th>
              {/* Its print run, in a column of its own so the tags line up (phones: under the code). */}
              <th className={`${th} hidden w-44 md:table-cell`}>Batch</th>
              <th className={`${th} w-28 text-right`}>Balance</th>
              <th className={`${th} hidden w-28 text-right xl:table-cell`}>Loaded</th>
              <th className={`${th} hidden w-32 xl:table-cell`}>Expires</th>
              <th className={`${th} hidden w-30 sm:table-cell`}>Status</th>
              <th className={`${th} w-12 px-0`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {giftCards.length === 0 && (
              <EmptyRow
                colSpan={9}
                icon={WalletCards}
                hint={
                  q
                    ? "Check the code, or search by the customer's name or phone."
                    : usedToday
                      ? "Gift cards used today show up here, to check against the till."
                      : filter === "inactive"
                        ? "Print some with Print blank cards, then activate one when it's sold."
                        : EMPTY_HINTS[filter]
                }
              >
                {q ? `No gift cards match “${q}”` : usedToday ? "No gift cards used today" : filter === "inactive" ? "No blank cards waiting" : "No gift cards here"}
              </EmptyRow>
            )}
            {giftCards.map((v) => (
              <GiftCardTableRow
                key={v.id}
                v={v}
                tz={tz}
                search={search}
                usedToday={usedToday}
                batchTag={v.batch && !batchId ? { href: batchHref(v.batch.id), label: `Batch ${formatDate(v.batch.createdAt, tz)} · ${v.batch.size}`, title: `Printed ${printed(v.batch.createdAt)}: show its ${v.batch.size} cards` } : undefined}
              />
            ))}
          </tbody>
        </DataTable>
        {total > GIFT_CARDS_PAGE_SIZE && (
          <Pager page={page} pageSize={GIFT_CARDS_PAGE_SIZE} total={total} href={(p) => href({ page: p })} noun="gift cards" anchor="list" className="md:hidden" />
        )}
      </ListPanel>
    </>
  );
}

/**
 * One gift card. A used-up gift card gets a red tint, so staff spot at a glance that there's no credit
 * left. The whole row opens the gift card (the code's link stretches over it); the checkbox, copy,
 * customer, batch tag and ⋯ sit above that link. `search`: what a search matched, marked in the
 * code and name. `batchTag`: the print run it came from, a tag that shows that batch's cards.
 */
function GiftCardTableRow({
  v,
  tz,
  search,
  usedToday,
  batchTag,
}: {
  v: GiftCardListRow;
  tz: string;
  search?: { code: string; name: string };
  /** The Used today view: the row says how much was used and when, to check against the till. */
  usedToday?: boolean;
  batchTag?: { href: string; label: string; title: string };
}) {
  // In the Used today view, the latest use (today's).
  const till = usedToday ? v.lastUse : null;
  return (
    // data-instant-*: what the InstantFilter matches while a search loads.
    <tr
      data-instant-codes={v.code}
      data-instant-names={v.customer ? fullName(v.customer) : ""}
      className={cn("relative cursor-pointer", v.status === "used_up" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-background/60")}>
      <td className={`${td} relative z-1 pr-0`}>
        {/* Only one nothing has been spent from can be deleted. */}
        {!v.lastUse && <BulkCheckbox id={v.id} label={`Choose ${v.code}`} />}
      </td>
      <td className={td}>
        <span className="flex items-center gap-0.5">
          <Link
            href={`/admin/gift-cards/${v.id}`}
            className="font-mono font-bold tracking-wider whitespace-nowrap after:absolute after:inset-0 hover:underline"
          >
            <Highlight text={v.code} term={search?.code} />
          </Link>
          <CopyButton text={v.code} label={`Copy ${v.code}`} className="relative z-1 -my-2" />
        </span>
        {/* Under the code: on phones, the customer and batch (their columns are hidden there); and in
            the Used today view, at every width, today's use to check against the till. Otherwise a
            card's history is on its page, and the status pill says whether it's been sold. */}
        {(till || v.customer || batchTag) && (
          <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground", !till && "md:hidden")}>
            {v.customer && (
              <span className="md:hidden">
                <Highlight text={fullName(v.customer)} term={search?.name} />
              </span>
            )}
            {till && (
              <span className="whitespace-nowrap">
                Used <span className="font-semibold text-foreground tabular-nums">{formatMoney(Math.abs(till.delta_cents))}</span> at{" "}
                {formatTime(till.created_at, tz)}
              </span>
            )}
            {batchTag && <BatchTag {...batchTag} className="md:hidden" />}
          </p>
        )}
      </td>
      <td className={`${td} hidden md:table-cell`}>
        {v.customer ? (
          <Link href={`/admin/customers/${v.customer.id}`} className="relative z-1 font-semibold hover:underline">
            <Highlight text={fullName(v.customer)} term={search?.name} />
          </Link>
        ) : (
          <span className="text-muted-foreground" aria-label="Not linked">
            –
          </span>
        )}
      </td>
      <td className={`${td} hidden md:table-cell`}>
        {batchTag ? (
          <BatchTag {...batchTag} />
        ) : (
          <span className="text-muted-foreground" aria-label="Not from a batch">
            –
          </span>
        )}
      </td>
      <td className={cn(`${td} text-right whitespace-nowrap tabular-nums`, "font-extrabold", v.status === "used_up" && "text-destructive")}>
        {/* A Not sold card has no balance yet, so it says so. */}
        {v.status === "inactive" ? (
          <span className="text-[13px] font-semibold text-muted-foreground">No balance yet</span>
        ) : (
          formatMoney(v.balance_cents)
        )}
        {/* Phones: the status sits under the balance, so a row stays two lines. */}
        <span className="mt-1 flex justify-end sm:hidden">
          <GiftCardStatusPill status={v.status} />
        </span>
      </td>
      <td className={`${td} hidden text-right whitespace-nowrap text-muted-foreground tabular-nums xl:table-cell`}>
        {v.loadedCents === null ? "–" : formatDollars(v.loadedCents)}
      </td>
      <td className={`${td} hidden whitespace-nowrap text-muted-foreground xl:table-cell`}>
        {v.expires_on ? formatDate(`${v.expires_on}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" }) : "–"}
      </td>
      <td className={`${td} hidden sm:table-cell`}>
        <GiftCardStatusPill status={v.status} />
      </td>
      <td className={`${td} relative z-1 px-0`}>
        <GiftCardRowActions
          giftCard={{
            id: v.id,
            code: v.code,
            status: v.status,
            token: v.public_token,
            expiresOn: v.expires_on,
            neverUsed: !v.lastUse,
            balanceCents: v.balance_cents,
            loadedCents: v.loadedCents,
            customerName: v.customer ? fullName(v.customer) : null,
          }}
        />
      </td>
    </tr>
  );
}

/** A card's print run: tap to see just that batch, with Print all, PDF and Copy codes. */
function BatchTag({ href, label, title, className }: { href: string; label: string; title: string; className?: string }) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "relative z-1 inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap text-primary hover:underline",
        className,
      )}
    >
      <Layers aria-hidden="true" className="size-3.5" />
      {label}
    </Link>
  );
}
