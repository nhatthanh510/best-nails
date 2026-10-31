import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Cake, Check, ChevronLeft, NotebookPen } from "lucide-react";
import { Avatar, BirthdayBadge, Card, DataTable, EmptyRow, Pager, Pill, StatTile, TierBadge, td, th } from "@/components/admin/ui";
import { TIER_LABELS, nextTier, tierFor } from "@/lib/tiers";
import { ActionButton, ConfirmButton } from "@/components/admin/action-button";
import { customerGiftVouchers, customerTitle, getCustomer, getSettings, staffNames } from "@/lib/admin-data";
import { VisitServices, VisitStaff, VisitSummary } from "@/components/admin/visit";
import { UseGiftVoucher } from "@/components/admin/gift-voucher-forms";
import { requireAdmin } from "@/lib/auth";
import { deleteCustomer, redeemBirthday, redeemReward } from "@/app/admin/actions";
import { formatPhone, isStandardPhone } from "@/lib/phone";
import { discountLabel, type BirthdayStatus } from "@/lib/rewards";
import { formatBirthday, formatDate, formatLastVisit, formatTime, fullName, initials, isShopToday, signed } from "@/lib/format";
import { AdjustPointsForm, EditCustomerButton } from "./customer-actions";
import { formatMoney } from "@/lib/gift-vouchers";

const REASON_LABELS = {
  check_in: "Check-in",
  signup_bonus: "Sign-up bonus",
  redeem: "Reward redeemed",
  adjust: "Adjustment",
  void: "Check-in undone",
} as const;

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const name = /^[0-9a-f-]{36}$/i.test(id) ? await customerTitle(id) : null;
  return { title: name ?? "Customer" };
}

const HISTORY_PAGE_SIZE = 25;

export default function CustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  return (
    <>
      <Link href="/admin/customers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All customers
      </Link>
      <CustomerDetail params={params} searchParams={searchParams} />
    </>
  );
}

async function CustomerDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/customers/[id]">["params"];
  searchParams: PageProps<"/admin/customers/[id]">["searchParams"];
}) {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names, staff, giftVouchers] = await Promise.all([
    getCustomer(id),
    getSettings(),
    staffNames(),
    requireAdmin(),
    customerGiftVouchers(id),
  ]);
  if (!data) notFound();
  const { customer: c, ledger, rewards, birthday: bday, birthdayHistory } = data;
  const tz = settings.timezone;
  const birthday = formatBirthday(c.birthday_month, c.birthday_day);
  // Check-ins happen on the kiosk; the header just says whether they've had today's.
  const checkedInToday = isShopToday(c.last_visit_at, tz);
  // The cheapest active reward is what the visits count towards (the punch card on the kiosk).
  const reward = rewards[0] ?? null;
  // One discount per visit (points reward or birthday), as the database enforces.
  const discountToday =
    ledger.find((t) => t.reason === "redeem" && isShopToday(t.created_at, tz))?.note ??
    (birthdayHistory.some((b) => isShopToday(b.created_at, tz)) ? "Birthday discount" : null);

  // Birthday discounts cost no points, so they sit alongside the ledger rows in one history.
  const history = [
    ...ledger.map((t) => ({ kind: "points" as const, at: t.created_at, row: t })),
    ...birthdayHistory.map((b) => ({ kind: "birthday" as const, at: b.created_at, row: b })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.kind === "points" && b.kind === "points" ? b.row.seq - a.row.seq : 0));
  const historyHref = (p: number) => `/admin/customers/${c.id}${p > 1 ? `?page=${p}` : ""}`;
  if (page > 1 && (page - 1) * HISTORY_PAGE_SIZE >= history.length) redirect(historyHref(1));
  const historyPage = history.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
  // Only what an admin did in the admin says who ("by Admin · Thu": a name on its own can read
  // like a day); check-ins and kiosk redemptions are always the kiosk.
  const by = (staffId: string | null) =>
    staffId && <p className="text-[13px] text-muted-foreground">by Admin · {names.get(staffId) ?? "staff"}</p>;
  // Date over time on phones, side by side from sm.
  const when = (iso: string) => (
    <span className="flex flex-col sm:flex-row sm:gap-1">
      <span>
        {formatDate(iso, tz, {
          day: "numeric",
          month: "short",
          // Like formatDateTime: the year only for past years.
          ...(new Date(iso).getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
        })}
      </span>
      <span>{formatTime(iso, tz)}</span>
    </span>
  );

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4.5">
          <Avatar text={initials(c)} size="lg" />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[32px] leading-tight font-bold">{fullName(c)}</h1>
              <TierBadge tier={tierFor(c.lifetime_points, settings)} showNew />
              {bday.in_window && (bday.used || (bday.eligible && !discountToday)) && (
                <BirthdayBadge state={bday.used ? "claimed" : "claimable"} daysAway={bday.days_away ?? 0} label={discountLabel(bday) ?? "Discount"} />
              )}
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {formatPhone(c.phone)}
                {!isStandardPhone(c.phone) && (
                  <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">Non-standard number</span>
                )}
              </span>
              {birthday && <span>Birthday {birthday}</span>}
              <span>Member since {formatDate(c.created_at, tz, { month: "short", year: "numeric" })}</span>
            </p>
            {bday.enabled && bday.in_window && (
              <Pill className="mt-1 w-fit bg-accent text-accent-foreground">
                <Cake className="size-3.5" aria-hidden="true" />
                {bday.used ? "Birthday week · discount used" : discountLabel(bday) ? `Birthday week · ${discountLabel(bday)} available` : "Birthday week · no discount for their tier"}
              </Pill>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <EditCustomerButton customer={c} />
          {checkedInToday && (
            <span className="flex min-h-11 items-center gap-2 rounded-[10px] bg-success-soft px-4 text-[15px] font-bold text-success">
              <Check className="size-4.5" strokeWidth={2.6} aria-hidden="true" />
              Checked in today · {formatTime(c.last_visit_at!, tz)}
            </span>
          )}
        </div>
        {/* Notes (allergies, preferences) belong where staff look first, not at the bottom. */}
        {c.notes && (
          <div className="flex w-full gap-2.5 rounded-xl bg-background px-4 py-3 text-sm">
            <NotebookPen className="mt-0.5 size-4 flex-none text-primary" aria-hidden="true" />
            <p className="leading-relaxed whitespace-pre-line">{c.notes}</p>
          </div>
        )}
      </Card>

      {/* Four tiles: two by two until there's room for a row of four, so none is left on its own. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 wide:grid-cols-4">
        <StatTile label="Points balance" value={c.points_balance} hint={tierHint(c.lifetime_points, settings)} />
        <StatTile label="Visits" value={c.visit_count} hint="Check-ins at the shop" />
        <StatTile label="Last visit" value={formatLastVisit(c.last_visit_at, tz)} />
        {/* With one point per visit, lifetime points would just repeat Visits; what's next is more useful. */}
        <StatTile
          label="Next reward"
          value={!reward ? "—" : c.points_balance >= reward.points_cost ? "Ready" : `${reward.points_cost - c.points_balance} to go`}
          hint={
            !reward ? (
              "No reward set up yet"
            ) : (
              <span className="flex flex-col gap-1.5">
                <span>
                  {c.points_balance >= reward.points_cost
                    ? `${reward.title} can be redeemed`
                    : `${Math.min(c.points_balance, reward.points_cost)} / ${reward.points_cost} points to ${reward.title}`}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-gold"
                    style={{ width: `${Math.min(100, (c.points_balance / reward.points_cost) * 100)}%` }}
                  />
                </span>
              </span>
            )
          }
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card id="history" className="@container min-w-0 flex-[999_1_480px] scroll-mt-4 pt-5 pb-2">
          <h2 className="px-5 pb-3 text-lg font-extrabold">Points history</h2>
          {/* Sized by the card, not the screen (it shares the row with the side cards on an iPad):
              a check-in's services and staff get their own columns once the card is wide enough,
              and otherwise sit under the activity. A narrow card leaves out the running balance. */}
          <DataTable minWidth={0}>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Activity</th>
                <th className={`${th} hidden @2xl:table-cell`}>Services</th>
                <th className={`${th} hidden @2xl:table-cell`}>Staff</th>
                <th className={`${th} text-right`}>Points</th>
                <th className={`${th} hidden text-right @md:table-cell`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <EmptyRow colSpan={6}>No activity yet.</EmptyRow>}
              {historyPage.map((h) =>
                h.kind === "points" ? (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{when(h.row.created_at)}</td>
                    <td className={td}>
                      <p className="font-bold whitespace-nowrap">{REASON_LABELS[h.row.reason]}</p>
                      {h.row.note && <p className="text-[13px] text-muted-foreground">{h.row.note}</p>}
                      {by(h.row.created_by)}
                      {h.row.visit && (
                        <div className="@2xl:hidden">
                          <VisitSummary services={h.row.visit.services} staff={h.row.visit.technician_name} />
                        </div>
                      )}
                    </td>
                    <td className={`${td} hidden @2xl:table-cell`}>{h.row.visit && <VisitServices services={h.row.visit.services} />}</td>
                    <td className={`${td} hidden whitespace-nowrap @2xl:table-cell`}>{h.row.visit && <VisitStaff name={h.row.visit.technician_name} />}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums ${h.row.delta > 0 ? "text-success" : "text-destructive"}`}>
                      {signed(h.row.delta)}
                    </td>
                    <td className={`${td} hidden text-right tabular-nums @md:table-cell`}>{h.row.balance_after}</td>
                  </tr>
                ) : (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{when(h.row.created_at)}</td>
                    <td className={td}>
                      <p className="font-bold">Birthday discount</p>
                      <p className="text-[13px] text-muted-foreground">
                        {discountLabel(h.row)} · {h.row.birthday_year}
                      </p>
                      {by(h.row.created_by)}
                    </td>
                    <td className={`${td} hidden @2xl:table-cell`} />
                    <td className={`${td} hidden @2xl:table-cell`} />
                    <td className={`${td} text-right text-muted-foreground`}>—</td>
                    <td className={`${td} hidden @md:table-cell`} />
                  </tr>
                ),
              )}
            </tbody>
          </DataTable>
          {history.length > HISTORY_PAGE_SIZE && (
            <Pager page={page} pageSize={HISTORY_PAGE_SIZE} total={history.length} href={historyHref} noun="entries" anchor="history" />
          )}
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-extrabold">Redeem a discount</h2>
            {discountToday && (
              <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-semibold text-success">
                {discountToday} used today. It&apos;s one discount per visit.
              </p>
            )}
            {rewards.length === 0 && !bday.enabled && (
              <p className="text-sm text-muted-foreground">
                No rewards yet. <Link href="/admin/rewards" className="font-bold text-primary">Create one</Link>.
              </p>
            )}
            {bday.enabled && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{discountLabel(bday) ? `Birthday ${discountLabel(bday)}` : "Birthday discount"}</span>
                  <span className="text-[13px] text-muted-foreground">{birthdayHint(bday)}</span>
                </div>
                <ActionButton
                  size="sm"
                  variant={bday.eligible && !discountToday ? "default" : "outline"}
                  disabled={!bday.eligible || Boolean(discountToday)}
                  action={redeemBirthday.bind(null, c.id)}
                >
                  Redeem
                </ActionButton>
              </div>
            )}
            {rewards.map((r) => {
              const short = r.points_cost - c.points_balance;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{r.title}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {r.points_cost} pts{short > 0 ? ` · needs ${short} more` : ""}
                    </span>
                  </div>
                  <ActionButton
                    size="sm"
                    variant={short > 0 || discountToday ? "outline" : "default"}
                    disabled={short > 0 || Boolean(discountToday)}
                    action={redeemReward.bind(null, c.id, r.id)}
                  >
                    Redeem
                  </ActionButton>
                </div>
              );
            })}
          </Card>

          <Card className="flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">Gift vouchers</h2>
              <Link href="/admin/gift-vouchers" className="text-sm font-bold text-primary hover:underline">
                All gift vouchers
              </Link>
            </div>
            {/* Their own vouchers are one tap; any other (e.g. a present) by typing its code. */}
            <UseGiftVoucher
              customerId={c.id}
              compact
              vouchers={giftVouchers.map((g) => ({
                id: g.id,
                code: g.code,
                amountCents: g.amount_cents ?? 0,
                balanceCents: g.balance_cents,
                status: g.status,
              }))}
            />
          </Card>

          <Card className="flex flex-col gap-3.5 p-5">
            <h2 className="text-lg font-extrabold">Adjust points</h2>
            <AdjustPointsForm customerId={c.id} balance={c.points_balance} />
          </Card>


          {staff.role === "admin" && (
            <ConfirmButton
              variant="danger"
              className="w-full"
              title={`Delete ${fullName(c)}?`}
              description="This removes the customer, their visits and their points history. It can't be undone."
              notice={unlinkedVoucherNotice(giftVouchers)}
              confirmLabel="Delete customer"
              action={deleteCustomer.bind(null, c.id)}
            >
              Delete customer
            </ConfirmButton>
          )}
        </div>
      </div>
    </>
  );
}

function birthdayHint(b: BirthdayStatus) {
  if (!b.has_birthday) return "No birthday on file. Add it with Edit";
  if (b.enabled && !discountLabel(b)) return "Their tier has no birthday discount";
  if (b.too_new) return "Available from their second visit";
  if (b.used && b.in_window) return "Already used for this birthday";
  if (b.eligible) return b.days_away === 0 ? "Today is their birthday!" : "Available now";
  const until = (b.days_away ?? 0) - (b.window_days ?? 0);
  return until > 0 ? `Available in ${until} day${until === 1 ? "" : "s"}` : "This year's birthday window has passed";
}

/** Tiers follow lifetime points: "38 earned · 2 more to VIP". */
function tierHint(lifetimePoints: number, tiers: Parameters<typeof nextTier>[1]) {
  const next = nextTier(lifetimePoints, tiers);
  const earned = `${lifetimePoints} earned`;
  if (!next) return `${earned} · top tier`;
  return `${earned} · ${next.pointsToGo} more to ${TIER_LABELS[next.tier]}`;
}

/** Deleting a customer keeps their gift vouchers (they're money the shop owes) but unlinks them. */
function unlinkedVoucherNotice(vouchers: { status: string; balance_cents: number }[]) {
  const open = vouchers.filter((g) => g.status === "active" && g.balance_cents > 0);
  if (open.length === 0) return undefined;
  const left = formatMoney(open.reduce((sum, g) => sum + g.balance_cents, 0));
  return open.length === 1
    ? `They have 1 gift voucher with ${left} left. It stays valid, but won't be linked to anyone.`
    : `They have ${open.length} gift vouchers with ${left} left in all. They stay valid, but won't be linked to anyone.`;
}
