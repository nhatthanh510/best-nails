import { Suspense } from "react";
import Link from "next/link";
import { Card, DataTable, EmptyRow, PageHeader, Pill, StatTile, TierBadge, td, th } from "@/components/admin/ui";
import { DashboardSkeleton } from "@/components/admin/skeletons";
import { getDashboard, getSettings, getTierCounts, getUpcomingBirthdays, giftVoucherSummary, listRewards } from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { UseGiftVoucherButton } from "@/components/admin/gift-voucher-forms";
import { tierFor } from "@/lib/tiers";
import { birthdayWindowLabel } from "@/lib/rewards";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTime, fullName } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const [stats, rewards, birthdays, tiers, gifts] = await Promise.all([
    getDashboard(),
    listRewards(),
    // The list is for offering the birthday discount, so it's skipped while that's switched off.
    settings.birthday_discount_enabled ? getUpcomingBirthdays(tz) : [],
    getTierCounts(settings),
    giftVoucherSummary(),
  ]);
  const activeRewards = rewards.filter((r) => r.is_active);

  return (
    <>
      <PageHeader
        title="Today at Best Nails"
        subtitle={new Date().toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric", timeZone: tz })}
        // A missed visit is a real check-in (Customers → Check in) or, for an earlier day, points
        // added with Adjust points, which count towards the tier.
        actions={<UseGiftVoucherButton variant="outline" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4">
        <StatTile label="Check-ins today" value={stats.checkInsToday} />
        <StatTile label="New customers (7 days)" value={stats.newCustomersThisWeek} />
        <StatTile
          label="Total customers"
          value={stats.totalCustomers.toLocaleString()}
          hint={`${stats.activeLast30Days.toLocaleString()} visited in the last 30 days`}
        />
        <StatTile
          label="Discounts given this month"
          value={stats.redeemedThisMonth + stats.birthdayDiscountsThisMonth}
          hint={`${stats.redeemedThisMonth} points · ${stats.birthdayDiscountsThisMonth} birthday`}
        />
        <StatTile
          label="Gift voucher credit"
          value={formatMoney(gifts.outstandingCents)}
          hint={`Unspent on ${gifts.activeCount.toLocaleString()} voucher${gifts.activeCount === 1 ? "" : "s"}`}
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
                <th className={`${th} hidden sm:table-cell`}>Phone</th>
                <th className={`${th} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody>
              {stats.checkIns.length === 0 && <EmptyRow colSpan={4}>No check-ins yet today.</EmptyRow>}
              {stats.checkIns.map((c) => (
                <tr key={c.id} className={c.voided_at ? "text-muted-foreground line-through" : undefined}>
                  <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>{formatTime(c.created_at, tz)}</td>
                  <td className={`${td} font-bold`}>
                    {c.customer && (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/customers/${c.customer.id}`} className="hover:underline">
                          {fullName(c.customer)}
                        </Link>
                        <TierBadge tier={tierFor(c.customer.lifetime_points, settings)} />
                      </span>
                    )}
                  </td>
                  <td className={`${td} hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>{c.customer && formatPhone(c.customer.phone)}</td>
                  <td className={`${td} text-right font-bold tabular-nums`}>+{c.points_awarded}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Your program</h2>
              <Link href="/admin/rewards" className="text-sm font-bold text-primary hover:underline">
                Manage
              </Link>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5">
                <span className="font-bold">Each check-in</span>
                <span>+1 point, once a day</span>
              </li>
              {activeRewards.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5">
                  <span className="font-bold">{r.title}</span>
                  <span>{r.points_cost} points</span>
                </li>
              ))}
              {settings.birthday_discount_enabled && (
                <li className="flex justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5">
                  <span className="font-bold">Birthday {settings.birthday_discount_percent}% off</span>
                  <span className="text-right">{birthdayWindowLabel(settings.birthday_window_days).replace("your ", "")}</span>
                </li>
              )}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-extrabold">Customer tiers</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {(
                [
                  ["vip", `${settings.tier_vip_points}+ points`],
                  ["regular", `${settings.tier_regular_points}–${settings.tier_vip_points - 1} points`],
                  ["new", `under ${settings.tier_regular_points} points`],
                ] as const
              ).map(([tier, range]) => (
                <li key={tier} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5">
                  <span className="flex items-center gap-2">
                    <TierBadge tier={tier} showNew />
                    <span className="text-muted-foreground">{range}</span>
                  </span>
                  <span className="font-extrabold tabular-nums">{tiers[tier].toLocaleString()}</span>
                </li>
              ))}
            </ul>
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
