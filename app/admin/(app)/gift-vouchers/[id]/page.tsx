import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, DataTable, EmptyRow, StatTile, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/action-button";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import { AdjustGiftVoucherForm, GiftVoucherSettingsForm, UseGiftVoucher } from "@/components/admin/gift-voucher-forms";
import { deleteGiftVoucher, voidGiftVoucherSpend } from "@/app/admin/gift-voucher-actions";
import { requireStaff } from "@/lib/auth";
import { getGiftVoucher, getSettings, staffNames, type GiftVoucherTransaction } from "@/lib/admin-data";
import { formatGiftCode, formatMoney } from "@/lib/gift-vouchers";
import { formatDate, formatTime, fullName } from "@/lib/format";

export const metadata = { title: "Gift voucher" };

const ENTRY_LABELS: Record<GiftVoucherTransaction["kind"], string> = {
  sale: "Sold",
  spend: "Spent",
  undo: "Spend undone",
  adjust: "Adjusted by the owner",
};

// Sale and expiry dates are calendar dates, so format them at noon UTC to stay on the right day.
const day = (d: string) => formatDate(`${d}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" });

/** The legal minimum expiry: 3 years after the sale (29 Feb becomes 28 Feb, as in Postgres). */
function threeYearsAfter(d: string) {
  const [y, m, dd] = d.split("-");
  return `${Number(y) + 3}-${m}-${m === "02" && dd === "29" ? "28" : dd}`;
}

export default function GiftVoucherPage({ params }: PageProps<"/admin/gift-vouchers/[id]">) {
  return (
    <>
      <Link href="/admin/gift-vouchers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All gift vouchers
      </Link>
      <Suspense fallback={<Card className="h-28" />}>
        <GiftVoucherDetail params={params} />
      </Suspense>
    </>
  );
}

async function GiftVoucherDetail({ params }: { params: PageProps<"/admin/gift-vouchers/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names, staff] = await Promise.all([getGiftVoucher(id), getSettings(), staffNames(), requireStaff()]);
  if (!data) notFound();
  const { voucher: v, transactions } = data;
  const tz = settings.timezone;
  const isOwner = staff.role === "owner";
  const spent = transactions.filter((t) => t.kind === "spend" && !t.voided_at).reduce((sum, t) => sum - t.delta_cents, 0);
  const everSpent = transactions.some((t) => t.kind === "spend");
  const when = (iso: string) => (
    <span className="flex flex-col sm:flex-row sm:gap-1">
      <span>
        {formatDate(iso, tz, {
          day: "numeric",
          month: "short",
          // The year only for past years, as in a customer's history.
          ...(new Date(iso).getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
        })}
      </span>
      <span>{formatTime(iso, tz)}</span>
    </span>
  );

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[26px] font-extrabold tracking-wider">{formatGiftCode(v.code)}</h1>
            <GiftVoucherStatusPill status={v.status} />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              Gift voucher · <span className="font-bold text-foreground">{formatMoney(v.amount_cents)}</span>
            </span>
            <span>
              Sold {day(v.sold_on)}
              {v.sold_by && ` by ${names.get(v.sold_by) ?? "staff"}`}
            </span>
            <span>Expires {day(v.expires_on)}</span>
            <span>
              {v.customer ? (
                <Link href={`/admin/customers/${v.customer.id}`} className="font-bold text-primary hover:underline">
                  {fullName(v.customer)}
                </Link>
              ) : (
                "Not linked to a customer"
              )}
            </span>
          </p>
          {v.notes && <p className="text-sm whitespace-pre-line">{v.notes}</p>}
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatTile label="Balance" value={formatMoney(v.balance_cents)} hint={v.status === "expired" ? "Expired, can't be used" : undefined} />
        <StatTile label="Spent" value={formatMoney(spent)} />
        <StatTile label="Original amount" value={formatMoney(v.amount_cents)} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          {v.status === "active" && (
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-lg font-extrabold">Use this voucher</h2>
              <UseGiftVoucher code={v.code} />
            </Card>
          )}

          <Card className="pt-5 pb-2">
            <h2 className="px-5 pb-3 text-lg font-extrabold">History</h2>
            <DataTable minWidth={0}>
              <thead>
                <tr>
                  <th className={`${th} hidden sm:table-cell`}>Date</th>
                  <th className={th}>Activity</th>
                  <th className={`${th} hidden sm:table-cell`}>By</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={`${th} hidden text-right sm:table-cell`}>Balance</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && <EmptyRow colSpan={6}>No activity yet.</EmptyRow>}
                {transactions.map((t) => (
                  <tr key={t.id} className={t.voided_at ? "bg-background text-muted-foreground" : undefined}>
                    <td className={`${td} hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell`}>{when(t.created_at)}</td>
                    <td className={td}>
                      <p className="font-bold">
                        {ENTRY_LABELS[t.kind]}
                        {t.voided_at && <span className="font-semibold text-muted-foreground"> · undone</span>}
                      </p>
                      {(t.note || t.customer) && (
                        <p className="text-[13px] text-muted-foreground">
                          {[t.note, t.customer && t.kind !== "sale" ? fullName(t.customer) : null].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {/* On phones the date and staff name move here. */}
                      <p className="text-[13px] text-muted-foreground sm:hidden">
                        {formatDate(t.created_at, tz)} {formatTime(t.created_at, tz)} · {names.get(t.created_by ?? "") ?? "Staff"}
                      </p>
                    </td>
                    <td className={`${td} hidden text-muted-foreground sm:table-cell`}>{names.get(t.created_by ?? "") ?? "Staff"}</td>
                    <td
                      className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums ${t.voided_at ? "line-through" : t.delta_cents > 0 ? "text-success" : "text-destructive"}`}
                    >
                      {t.delta_cents > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(t.delta_cents))}
                    </td>
                    <td className={`${td} hidden text-right whitespace-nowrap tabular-nums sm:table-cell`}>{formatMoney(t.balance_after_cents)}</td>
                    <td className={`${td} text-right`}>
                      {t.kind === "spend" && !t.voided_at && (
                        <ConfirmButton
                          variant="outline"
                          size="sm"
                          title="Undo this spend?"
                          description={`Puts ${formatMoney(-t.delta_cents)} back on ${formatGiftCode(v.code)}.`}
                          confirmLabel="Undo spend"
                          action={voidGiftVoucherSpend.bind(null, t.id)}
                        >
                          Undo
                        </ConfirmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-lg font-extrabold">Details</h2>
            <GiftVoucherSettingsForm
              id={v.id}
              phone={v.customer?.phone ?? null}
              notes={v.notes}
              expiresOn={v.expires_on}
              minExpiry={threeYearsAfter(v.sold_on)}
              isOwner={isOwner}
            />
          </Card>
          {isOwner && (
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-extrabold">Adjust balance</h2>
                <p className="text-[13px] text-muted-foreground">For corrections only. To undo a spend, use Undo in the history.</p>
              </div>
              <AdjustGiftVoucherForm id={v.id} balanceCents={v.balance_cents} />
            </Card>
          )}
          {isOwner && !everSpent && (
            <ConfirmButton
              variant="ghost"
              className="w-fit text-destructive hover:text-destructive"
              title={`Delete ${formatGiftCode(v.code)}?`}
              description="Only for a voucher sold by mistake. Refund the customer at the till. This can't be undone."
              confirmLabel="Delete voucher"
              action={deleteGiftVoucher.bind(null, v.id)}
            >
              Delete voucher
            </ConfirmButton>
          )}
        </div>
      </div>
    </>
  );
}
