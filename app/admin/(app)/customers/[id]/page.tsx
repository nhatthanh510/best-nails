import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar, Card, DataTable, EmptyRow, Pager, StatTile, TierBadge, td, th } from "@/components/admin/ui";
import { TIER_LABELS, nextTier, tierFor } from "@/lib/tiers";
import { ActionButton, ConfirmButton } from "@/components/admin/action-button";
import { customerGiftVouchers, getCustomer, getSettings, staffNames } from "@/lib/admin-data";
import { UseGiftVoucher } from "@/components/admin/gift-voucher-forms";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { formatGiftCode, formatMoney } from "@/lib/gift-vouchers";
import { requireStaff } from "@/lib/auth";
import { checkInCustomer, deleteCustomer, redeemBirthday, redeemReward } from "@/app/admin/actions";
import { formatPhone, isStandardPhone } from "@/lib/phone";
import type { BirthdayStatus } from "@/lib/rewards";
import { formatBirthday, formatDate, formatLastVisit, formatTime, fullName, initials, signed } from "@/lib/format";
import { AdjustPointsForm, EditCustomerButton } from "./customer-actions";

const REASON_LABELS = {
  check_in: "Check-in",
  signup_bonus: "Sign-up bonus",
  redeem: "Reward redeemed",
  adjust: "Adjustment",
  void: "Check-in undone",
} as const;

export const metadata = { title: "Customer" };

const HISTORY_PAGE_SIZE = 25;

export default function CustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  return (
    <>
      <Link href="/admin/customers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All customers
      </Link>
      <Suspense fallback={<Card className="h-28" />}>
        <CustomerDetail params={params} searchParams={searchParams} />
      </Suspense>
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
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names, staff, giftVouchers] = await Promise.all([
    getCustomer(id),
    getSettings(),
    staffNames(),
    requireStaff(),
    customerGiftVouchers(id),
  ]);
  if (!data) notFound();
  const { customer: c, ledger, rewards, birthday: bday, birthdayHistory } = data;
  const tz = settings.timezone;
  const birthday = formatBirthday(c.birthday_month, c.birthday_day);

  // Birthday discounts cost no points, so they sit alongside the ledger rows in one history.
  const history = [
    ...ledger.map((t) => ({ kind: "points" as const, at: t.created_at, row: t })),
    ...birthdayHistory.map((b) => ({ kind: "birthday" as const, at: b.created_at, row: b })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.kind === "points" && b.kind === "points" ? b.row.seq - a.row.seq : 0));
  const historyHref = (p: number) => `/admin/customers/${c.id}${p > 1 ? `?page=${p}` : ""}`;
  if (page > 1 && (page - 1) * HISTORY_PAGE_SIZE >= history.length) redirect(historyHref(1));
  const historyPage = history.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
  const by = (staffId: string | null) => (staffId ? (names.get(staffId) ?? "Staff") : "Kiosk");
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
              <TierBadge tier={tierFor(c.visit_count, settings)} showNew />
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <EditCustomerButton customer={c} />
          <ActionButton action={checkInCustomer.bind(null, c.id)}>Check in now</ActionButton>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatTile label="Points balance" value={c.points_balance} />
        <StatTile label="Visits" value={c.visit_count} hint={tierHint(c.visit_count, settings)} />
        <StatTile label="Last visit" value={formatLastVisit(c.last_visit_at, tz)} />
        <StatTile label="Lifetime points" value={c.lifetime_points} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card id="history" className="min-w-0 flex-[999_1_480px] scroll-mt-4 pt-5 pb-2">
          <h2 className="px-5 pb-3 text-lg font-extrabold">Points history</h2>
          {/* On phones "by" moves under the activity and the running balance is left out. */}
          <DataTable minWidth={0}>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Activity</th>
                <th className={`${th} hidden sm:table-cell`}>By</th>
                <th className={`${th} text-right`}>Points</th>
                <th className={`${th} hidden text-right sm:table-cell`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <EmptyRow colSpan={5}>No activity yet.</EmptyRow>}
              {historyPage.map((h) =>
                h.kind === "points" ? (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{when(h.row.created_at)}</td>
                    <td className={td}>
                      <p className="font-bold">{REASON_LABELS[h.row.reason]}</p>
                      {h.row.note && <p className="text-[13px] text-muted-foreground">{h.row.note}</p>}
                      <p className="text-[13px] text-muted-foreground sm:hidden">{by(h.row.created_by)}</p>
                    </td>
                    <td className={`${td} hidden text-muted-foreground sm:table-cell`}>{by(h.row.created_by)}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums ${h.row.delta > 0 ? "text-success" : "text-destructive"}`}>
                      {signed(h.row.delta)}
                    </td>
                    <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{h.row.balance_after}</td>
                  </tr>
                ) : (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{when(h.row.created_at)}</td>
                    <td className={td}>
                      <p className="font-bold">Birthday discount</p>
                      <p className="text-[13px] text-muted-foreground">{h.row.percent}% off · {h.row.birthday_year}</p>
                      <p className="text-[13px] text-muted-foreground sm:hidden">{by(h.row.created_by)}</p>
                    </td>
                    <td className={`${td} hidden text-muted-foreground sm:table-cell`}>{by(h.row.created_by)}</td>
                    <td className={`${td} text-right text-muted-foreground`}>—</td>
                    <td className={`${td} hidden sm:table-cell`} />
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
            {rewards.length === 0 && !bday.enabled && (
              <p className="text-sm text-muted-foreground">
                No rewards yet. <Link href="/admin/rewards" className="font-bold text-primary">Create one</Link>.
              </p>
            )}
            {bday.enabled && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold">Birthday {settings.birthday_discount_percent}% off</span>
                  <span className="text-[13px] text-muted-foreground">{birthdayHint(bday)}</span>
                </div>
                <ActionButton
                  size="sm"
                  variant={bday.eligible ? "default" : "outline"}
                  disabled={!bday.eligible}
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
                    variant={short > 0 ? "outline" : "default"}
                    disabled={short > 0}
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
                Sell one
              </Link>
            </div>
            {giftVouchers.length > 0 && (
              <ul className="flex flex-col gap-2">
                {giftVouchers.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/admin/gift-vouchers/${g.id}`}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5 hover:bg-muted"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm font-bold tracking-wider">{formatGiftCode(g.code)}</span>
                        <span className="text-[13px] text-muted-foreground">of {formatMoney(g.amount_cents)}</span>
                      </span>
                      <span className="flex items-center gap-2.5">
                        {g.status !== "active" && <GiftVoucherStatusPill status={g.status} />}
                        <span className="font-extrabold tabular-nums">{formatMoney(g.balance_cents)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {/* Any gift voucher can be used here, including one bought for them by someone else. */}
            <UseGiftVoucher customerId={c.id} compact />
          </Card>

          <Card className="flex flex-col gap-3.5 p-5">
            <h2 className="text-lg font-extrabold">Adjust points</h2>
            <AdjustPointsForm customerId={c.id} balance={c.points_balance} />
          </Card>

          <Card className="flex flex-col gap-2.5 p-5">
            <h2 className="text-lg font-extrabold">Notes</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line">{c.notes || <span className="text-muted-foreground">No notes yet.</span>}</p>
          </Card>

          {staff.role === "owner" && (
            <ConfirmButton
              variant="ghost"
              className="w-fit text-destructive hover:text-destructive"
              title={`Delete ${fullName(c)}?`}
              description="This removes the customer, their visits and their points history. It can't be undone."
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
  if (b.used && b.in_window) return "Already used for this birthday";
  if (b.eligible) return b.days_away === 0 ? "Today is their birthday!" : "Available now";
  const until = (b.days_away ?? 0) - (b.window_days ?? 0);
  return until > 0 ? `Available in ${until} day${until === 1 ? "" : "s"}` : "This year's birthday window has passed";
}

function tierHint(visits: number, tiers: Parameters<typeof nextTier>[1]) {
  const next = nextTier(visits, tiers);
  if (!next) return "Top tier";
  return `${next.visitsToGo} more visit${next.visitsToGo === 1 ? "" : "s"} to ${TIER_LABELS[next.tier]}`;
}
