import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Avatar, Card, DataTable, EmptyRow, StatTile, td, th } from "@/components/admin/ui";
import { ActionButton, ConfirmButton } from "@/components/admin/action-button";
import { getCustomer, getSettings, staffNames } from "@/lib/admin-data";
import { requireStaff } from "@/lib/auth";
import { checkInCustomer, deleteCustomer, redeemBirthday, redeemReward } from "@/app/admin/actions";
import { formatPhone, isStandardPhone } from "@/lib/phone";
import type { BirthdayStatus } from "@/lib/rewards";
import { formatBirthday, formatDate, formatDateTime, formatLastVisit, fullName, initials, signed } from "@/lib/format";
import { AdjustPointsForm, EditCustomerButton } from "./customer-actions";

const REASON_LABELS = {
  check_in: "Check-in",
  signup_bonus: "Sign-up bonus",
  redeem: "Reward redeemed",
  adjust: "Adjustment",
  void: "Check-in undone",
} as const;

export const metadata = { title: "Customer" };

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <>
      <Link href="/admin/customers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All customers
      </Link>
      <Suspense fallback={<Card className="h-28" />}>
        <CustomerDetail params={params} />
      </Suspense>
    </>
  );
}

async function CustomerDetail({ params }: { params: PageProps<"/admin/customers/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names, staff] = await Promise.all([getCustomer(id), getSettings(), staffNames(), requireStaff()]);
  if (!data) notFound();
  const { customer: c, ledger, rewards, birthday: bday, birthdayHistory } = data;
  const tz = settings.timezone;
  const birthday = formatBirthday(c.birthday_month, c.birthday_day);

  // Birthday discounts cost no points, so they sit alongside the ledger rows in one history.
  const history = [
    ...ledger.map((t) => ({ kind: "points" as const, at: t.created_at, row: t })),
    ...birthdayHistory.map((b) => ({ kind: "birthday" as const, at: b.created_at, row: b })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.kind === "points" && b.kind === "points" ? b.row.seq - a.row.seq : 0));

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4.5">
          <Avatar text={initials(c)} size="lg" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-extrabold tracking-tight">{fullName(c)}</h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {formatPhone(c.phone)}
                {!isStandardPhone(c.phone) && (
                  <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">Non-standard number</span>
                )}
              </span>
              {birthday && <span>Birthday {birthday}</span>}
              <span>Member since {formatDate(c.created_at, tz, { month: "short", year: "numeric" })}</span>
              <span>{c.sms_opt_in ? "SMS opt-in" : "No SMS"}</span>
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
        <StatTile label="Visits" value={c.visit_count} />
        <StatTile label="Last visit" value={formatLastVisit(c.last_visit_at, tz)} />
        <StatTile label="Lifetime points" value={c.lifetime_points} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_480px] pt-5 pb-2">
          <h2 className="px-5 pb-3 text-lg font-extrabold">Points history</h2>
          <DataTable minWidth={560}>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Activity</th>
                <th className={th}>By</th>
                <th className={`${th} text-right`}>Points</th>
                <th className={`${th} text-right`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && <EmptyRow colSpan={5}>No activity yet.</EmptyRow>}
              {history.map((h) =>
                h.kind === "points" ? (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(h.row.created_at, tz)}</td>
                    <td className={td}>
                      <p className="font-bold">{REASON_LABELS[h.row.reason]}</p>
                      {h.row.note && <p className="text-[13px] text-muted-foreground">{h.row.note}</p>}
                    </td>
                    <td className={`${td} text-muted-foreground`}>{h.row.created_by ? (names.get(h.row.created_by) ?? "Staff") : "Kiosk"}</td>
                    <td className={`${td} text-right font-extrabold tabular-nums ${h.row.delta > 0 ? "text-success" : "text-destructive"}`}>
                      {signed(h.row.delta)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{h.row.balance_after}</td>
                  </tr>
                ) : (
                  <tr key={h.row.id}>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDateTime(h.row.created_at, tz)}</td>
                    <td className={td}>
                      <p className="font-bold">Birthday discount</p>
                      <p className="text-[13px] text-muted-foreground">{h.row.percent}% off · {h.row.birthday_year}</p>
                    </td>
                    <td className={`${td} text-muted-foreground`}>{h.row.created_by ? (names.get(h.row.created_by) ?? "Staff") : "Kiosk"}</td>
                    <td className={`${td} text-right text-muted-foreground`}>—</td>
                    <td className={`${td} text-right`} />
                  </tr>
                ),
              )}
            </tbody>
          </DataTable>
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
