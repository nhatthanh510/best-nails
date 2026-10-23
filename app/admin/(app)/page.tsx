import { Suspense } from "react";
import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyRow, PageHeader, Pill, StatTile, TierBadge, td, th } from "@/components/admin/ui";
import { getDashboard, getSettings, getTierCounts, getUpcomingBirthdays, listRewards } from "@/lib/admin-data";
import { tierFor } from "@/lib/tiers";
import { birthdayWindowLabel } from "@/lib/rewards";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatTime, fullName } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageHeader title="Today at Best Nails" subtitle="Loading…" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const settings = await getSettings();
  const tz = settings.timezone;
  const [stats, rewards, birthdays, tiers] = await Promise.all([
    getDashboard(),
    listRewards(),
    getUpcomingBirthdays(tz),
    getTierCounts(settings),
  ]);
  const activeRewards = rewards.filter((r) => r.is_active);

  return (
    <>
      <PageHeader
        title="Today at Best Nails"
        subtitle={new Date().toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric", timeZone: tz })}
        actions={
          <>
          <Button asChild variant="outline">
            <Link href="/admin/vouchers">
              <Ticket aria-hidden="true" />
              Redeem voucher
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/customers">
              <Plus aria-hidden="true" />
              Manual check-in
            </Link>
          </Button>
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <StatTile label="Check-ins today" value={stats.checkInsToday} />
        <StatTile label="New customers (7 days)" value={stats.newCustomersThisWeek} />
        <StatTile
          label="Total customers"
          value={stats.totalCustomers.toLocaleString()}
          hint={`${stats.activeLast30Days.toLocaleString()} visited in the last 30 days`}
        />
        <StatTile
          label="Discounts given this month"
          value={stats.redeemedThisMonth + stats.birthdayDiscountsThisMonth + stats.vouchersThisMonth}
          hint={`${stats.redeemedThisMonth} points · ${stats.birthdayDiscountsThisMonth} birthday · ${stats.vouchersThisMonth} vouchers`}
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_520px] pt-5 pb-2">
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-lg font-extrabold">Today&apos;s check-ins</h2>
            <Link href="/admin/check-ins" className="text-sm font-bold text-primary hover:underline">
              View all
            </Link>
          </div>
          <DataTable minWidth={560}>
            <thead>
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Customer</th>
                <th className={th}>Phone</th>
                <th className={th}>Source</th>
                <th className={`${th} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody>
              {stats.checkIns.length === 0 && <EmptyRow colSpan={5}>No check-ins yet today.</EmptyRow>}
              {stats.checkIns.map((c) => (
                <tr key={c.id} className={c.voided_at ? "text-muted-foreground line-through" : undefined}>
                  <td className={`${td} text-muted-foreground tabular-nums`}>{formatTime(c.created_at, tz)}</td>
                  <td className={`${td} font-bold`}>
                    {c.customer && (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/customers/${c.customer.id}`} className="hover:underline">
                          {fullName(c.customer)}
                        </Link>
                        <TierBadge tier={tierFor(c.customer.visit_count, settings)} />
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-muted-foreground tabular-nums`}>{c.customer && formatPhone(c.customer.phone)}</td>
                  <td className={td}>
                    <Pill>{c.source === "kiosk" ? "Kiosk" : "Admin"}</Pill>
                  </td>
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
                <span>
                  +{settings.points_per_visit} point{settings.points_per_visit === 1 ? "" : "s"}
                </span>
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
                  ["vip", `${settings.tier_vip_visits}+ visits`, "/admin/customers?filter=vip"],
                  ["regular", `${settings.tier_regular_visits}–${settings.tier_vip_visits - 1} visits`, "/admin/customers?filter=regular"],
                  ["new", `under ${settings.tier_regular_visits} visits`, null],
                ] as const
              ).map(([tier, range, href]) => {
                const row = (
                  <>
                    <span className="flex items-center gap-2">
                      <TierBadge tier={tier} showNew />
                      <span className="text-muted-foreground">{range}</span>
                    </span>
                    <span className="font-extrabold tabular-nums">{tiers[tier].toLocaleString()}</span>
                  </>
                );
                const cls = "flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5";
                return (
                  <li key={tier}>
                    {href ? (
                      <Link href={href} className={`${cls} hover:bg-muted`}>
                        {row}
                      </Link>
                    ) : (
                      <div className={cls}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-lg font-extrabold">Birthdays this week</h2>
            {birthdays.length === 0 && <p className="text-sm text-muted-foreground">None in the next 7 days.</p>}
            {birthdays.map((b) => (
              <div key={b.id} className="flex justify-between text-sm">
                <Link href={`/admin/customers/${b.id}`} className="font-bold hover:underline">
                  {fullName(b)}
                </Link>
                <span className="text-muted-foreground">
                  {formatDate(b.date.toISOString(), tz, { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
