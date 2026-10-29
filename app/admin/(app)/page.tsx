import { Suspense } from "react";
import Link from "next/link";
import { Card, DataTable, EmptyRow, PageHeader, Pill, StatTile, TierBadge, dashboardTileGrid, td, th } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { DashboardSkeleton } from "@/components/admin/skeletons";
import { VisitServices, VisitStaff, VisitSummary } from "@/components/admin/visit";
import {
  DASHBOARD_PERIODS,
  getCloseToReward,
  getDashboard,
  getNotBackLately,
  getSettings,
  getUpcomingBirthdays,
  listRewards,
  NOT_BACK_DAYS,
  type DashboardPeriod,
  type NudgeCustomer,
} from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { UseGiftVoucherButton } from "@/components/admin/gift-voucher-forms";
import { tierFor } from "@/lib/tiers";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTime, fullName } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = { today: "Today", week: "7 days", month: "This month" };

/**
 * What the owner checks during or after a day: four tiles and the top services for today (or the
 * last 7 days / this month, ?period=), who came in today for what and with whom, and short lists
 * worth a word (birthdays, nearly at a reward, regulars not back lately). Totals that change slowly live on
 * their own pages (credit on Gift vouchers, the program on Rewards). There's deliberately no
 * per-technician count: visit counts aren't a fair measure of anyone's work and read as a ranking.
 */
async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { period: periodParam } = await searchParams;
  const period = DASHBOARD_PERIODS.includes(periodParam as DashboardPeriod) ? (periodParam as DashboardPeriod) : "today";
  // Started together: the lists that need the settings or the cheapest reward wait only for those.
  const settingsPromise = getSettings();
  const rewardCostPromise = listRewards().then((rewards) => {
    const costs = rewards.filter((r) => r.is_active).map((r) => r.points_cost);
    return costs.length ? { cost: Math.min(...costs), title: rewards.find((r) => r.is_active && r.points_cost === Math.min(...costs))!.title } : null;
  });
  const [settings, stats, reward, birthdays, closeToReward, notBack] = await Promise.all([
    settingsPromise,
    getDashboard(period),
    rewardCostPromise,
    // The list is for offering the birthday discount, so it's skipped while that's switched off.
    settingsPromise.then((s) => (s.birthday_discount_enabled ? getUpcomingBirthdays(s.timezone) : [])),
    rewardCostPromise.then((r) => getCloseToReward(r?.cost ?? null)),
    settingsPromise.then(getNotBackLately),
  ]);
  const tz = settings.timezone;
  const weekday = new Date().toLocaleDateString("en-AU", { weekday: "long", timeZone: tz });
  const change = stats.checkInsInPeriod - stats.checkInsBefore;
  // What the check-ins are compared with (see periodWindow in lib/admin-data.ts).
  const before = { today: `last ${weekday} so far`, week: "the 7 days before", month: "this time last month" }[period];
  const joined = { today: "Joined today", week: "Joined in the last 7 days", month: "Joined this month" }[period];
  const vouchers = stats.vouchers;
  // The dates the tiles cover, e.g. "23 – 29 Oct" (today is in the page subtitle already).
  const dayMonth = (daysAgo: number) => formatDate(new Date(Date.now() - daysAgo * 86_400_000).toISOString(), tz, { day: "numeric", month: "short" });
  const dayOfMonth = Number(new Date().toLocaleDateString("en-AU", { day: "numeric", timeZone: tz }));
  const range = { today: "Today so far", week: `${dayMonth(6)} – ${dayMonth(0)}`, month: `${dayMonth(dayOfMonth - 1)} – ${dayMonth(0)}` }[period];

  return (
    <>
      <PageHeader
        title="Today at Best Nails"
        subtitle={new Date().toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric", timeZone: tz })}
        actions={<UseGiftVoucherButton variant="outline" />}
      />

      <div className="-mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{range}</h2>
        {/* Links, so the period is in the URL (back button, bookmarks) and the page stays a server render. */}
        <div role="group" aria-label="Period" className="flex gap-1 rounded-full border border-input bg-card p-1">
          {DASHBOARD_PERIODS.map((p) => (
            <Link
              key={p}
              href={p === "today" ? "/admin" : `/admin?period=${p}`}
              scroll={false}
              replace
              aria-current={p === period ? "true" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-full px-3.5 text-sm font-bold whitespace-nowrap",
                p === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>
      <div className={dashboardTileGrid}>
        <StatTile
          label="Check-ins"
          value={stats.checkInsInPeriod}
          hint={change === 0 ? `Same as ${before}` : `${change > 0 ? "+" : "−"}${Math.abs(change)} vs ${before}`}
        />
        <StatTile label="New members" value={stats.newMembers} hint={joined} />
        <StatTile
          label="Discounts redeemed"
          value={stats.redeemed + stats.birthdayDiscounts}
          hint={
            settings.birthday_discount_enabled || stats.birthdayDiscounts > 0
              ? `${stats.redeemed} with points · ${stats.birthdayDiscounts} birthday`
              : `${stats.redeemed} with points`
          }
        />
        <StatTile
          label="Gift vouchers sold"
          value={formatMoney(vouchers.soldCents)}
          hint={
            vouchers.used > 0
              ? `${vouchers.sold} sold · ${formatMoney(vouchers.usedCents)} used on ${vouchers.used}`
              : `${vouchers.sold} sold · none used${period === "today" ? " yet" : ""}`
          }
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_520px] pt-5 pb-2">
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-lg font-extrabold">Today&apos;s check-ins</h2>
            <Link href="/admin/check-ins" className="text-sm font-bold text-primary hover:underline">
              {stats.checkInsToday > stats.checkIns.length ? `View all ${stats.checkInsToday}` : "View all"}
            </Link>
          </div>
          <DataTable minWidth={0}>
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Customer</th>
                <th className={`${th} hidden xl:table-cell`}>Service</th>
                <th className={`${th} hidden xl:table-cell`}>Technician</th>
                <th className={`${th} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody>
              {stats.checkIns.length === 0 && <EmptyRow colSpan={5}>No check-ins yet today.</EmptyRow>}
              {stats.checkIns.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{formatTime(c.created_at, tz)}</td>
                  <td className={td}>
                    {c.customer && (
                      <>
                        <span className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/customers/${c.customer.id}`} className="font-bold hover:underline">
                            {fullName(c.customer)}
                          </Link>
                          <TierBadge tier={tierFor(c.customer.lifetime_points, settings)} />
                        </span>
                        <p className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(c.customer.phone)}</p>
                      </>
                    )}
                    {/* The service and technician columns fold in here below xl (the side column leaves the table narrow). */}
                    <div className="mt-1 xl:hidden">
                      <VisitSummary services={c.services} staff={c.technician_name} />
                    </div>
                  </td>
                  <td className={`${td} hidden xl:table-cell`}>
                    <VisitServices services={c.services} />
                  </td>
                  <td className={`${td} hidden whitespace-nowrap xl:table-cell`}>
                    <VisitStaff name={c.technician_name} />
                  </td>
                  <td className={`${td} text-right font-bold tabular-nums`}>+{c.points_awarded}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-extrabold">Top services · {PERIOD_LABELS[period].toLowerCase()}</h2>
            {stats.topServices.length === 0 && <p className="text-sm text-muted-foreground">No services picked yet.</p>}
            <ul className="flex flex-col gap-2.5 text-sm">
              {stats.topServices.map((sv) => (
                <li key={`${sv.category_name}/${sv.name}`} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-bold">{sv.name}</span> <span className="text-[13px] text-muted-foreground">· {sv.category_name}</span>
                    </span>
                    <span className="font-extrabold tabular-nums">{sv.uses}</span>
                  </span>
                  {/* Share of the most picked, so the bars compare services at a glance. */}
                  <span aria-hidden="true" className="h-1.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(sv.uses / stats.topServices[0].uses) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            {reward && closeToReward ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-extrabold">1 visit from {reward.title}</h2>
                  {closeToReward.total > 0 && <span className="text-sm text-muted-foreground">{closeToReward.total}</span>}
                </div>
                {closeToReward.total === 0 && <p className="text-sm text-muted-foreground">Nobody right now.</p>}
                <NudgeList
                  customers={closeToReward.customers}
                  more={closeToReward.total - closeToReward.customers.length}
                  aside={(c) => (c.last_visit_at ? `Last in ${formatDate(c.last_visit_at, tz, { day: "numeric", month: "short" })}` : null)}
                />
              </>
            ) : (
              // A new shop starts without a reward: points pile up with nothing to spend them on.
              <p className="flex justify-between gap-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
                <span className="font-bold">No reward yet</span>
                <Link href="/admin/rewards" className="font-bold hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-extrabold">Regulars not back in {NOT_BACK_DAYS / 7} weeks</h2>
              {notBack.total > 0 && <span className="text-sm text-muted-foreground">{notBack.total}</span>}
            </div>
            {notBack.total === 0 && <p className="text-sm text-muted-foreground">All your regulars have been in lately.</p>}
            <NudgeList
              customers={notBack.customers}
              more={notBack.total - notBack.customers.length}
              aside={(c) => (c.last_visit_at ? `Last in ${formatDate(c.last_visit_at, tz, { day: "numeric", month: "short" })}` : null)}
            />
          </Card>

          {settings.birthday_discount_enabled && (
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-extrabold">Birthdays this week</h2>
                {birthdays.length > 0 && <span className="text-sm text-muted-foreground">{birthdays.length}</span>}
              </div>
              {birthdays.length === 0 && <p className="text-sm text-muted-foreground">None in the next 7 days.</p>}
              <BirthdayList birthdays={birthdays.slice(0, BIRTHDAYS_SHOWN)} tz={tz} />
              {/* A long week folds away, so the dashboard doesn't grow a tall column. */}
              {birthdays.length > BIRTHDAYS_SHOWN && (
                <details className="group flex flex-col gap-3">
                  <summary className="w-fit cursor-pointer text-sm font-bold text-primary hover:underline group-open:hidden">
                    Show {birthdays.length - BIRTHDAYS_SHOWN} more
                  </summary>
                  <BirthdayList birthdays={birthdays.slice(BIRTHDAYS_SHOWN)} tz={tz} />
                </details>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Name and phone (staff call or mention it at the till), with a short note on the right. */
function NudgeList({ customers, more, aside }: { customers: NudgeCustomer[]; more: number; aside: (c: NudgeCustomer) => string | null }) {
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {customers.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-col">
              <Link href={`/admin/customers/${c.id}`} className="font-bold hover:underline">
                {fullName(c)}
              </Link>
              <span className="text-[13px] text-muted-foreground tabular-nums">{formatPhone(c.phone)}</span>
            </span>
            <span className="flex-none text-right text-muted-foreground">{aside(c)}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="text-[13px] text-muted-foreground">and {more} more</p>}
    </>
  );
}

const BIRTHDAYS_SHOWN = 8;

/** Name and phone (first names alone are often shared), the day, and whether the discount's been used. */
function BirthdayList({ birthdays, tz }: { birthdays: Awaited<ReturnType<typeof getUpcomingBirthdays>>; tz: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {birthdays.map((b) => (
        <li key={b.id} className="flex items-start justify-between gap-3 text-sm">
          <span className="flex min-w-0 flex-col">
            <Link href={`/admin/customers/${b.id}`} className="font-bold hover:underline">
              {fullName(b)}
            </Link>
            <span className="text-[13px] text-muted-foreground tabular-nums">{formatPhone(b.phone)}</span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <span className="text-muted-foreground">{formatDate(b.date.toISOString(), tz, { weekday: "short", day: "numeric", month: "short" })}</span>
            {b.used && <Pill className="text-[12px]">Discount used</Pill>}
          </span>
        </li>
      ))}
    </ul>
  );
}
