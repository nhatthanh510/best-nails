import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Ban, ChevronDown, ChevronLeft } from "lucide-react";
import { Card, DataTable, EmptyRow, td, th } from "@/components/admin/ui";
import { ActionButton, ConfirmButton } from "@/components/admin/action-button";
import { GiftVoucherStatusPill } from "@/components/admin/gift-voucher-status";
import {
  AdjustGiftVoucherForm,
  BlockGiftVoucherForm,
  GiftVoucherSettingsForm,
  SellGiftVoucherButton,
  TopUpButton,
  UseThisVoucherButton,
} from "@/components/admin/gift-voucher-forms";
import { deleteGiftVoucher, unblockGiftVoucher } from "@/app/admin/gift-voucher-actions";
import { PrintableVoucher } from "@/components/admin/voucher-card";
import { requireAdmin } from "@/lib/auth";
import { getGiftVoucher, getSettings, giftVoucherCode, staffNames, type GiftVoucherRow, type GiftVoucherTransaction } from "@/lib/admin-data";
import { formatMoney } from "@/lib/gift-vouchers";
import { formatDate, formatTime, fullName } from "@/lib/format";

// The kiosk changes what this page shows, so it's never cached: a click waits for fresh data with
// the current page still up (and the sidebar's loading line) rather than showing a skeleton.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/admin/gift-vouchers/[id]">) {
  const { id } = await params;
  const code = /^[0-9a-f-]{36}$/i.test(id) ? await giftVoucherCode(id) : null;
  return { title: code ? `Gift voucher ${code}` : "Gift voucher" };
}

// The same words as the buttons that make them: Create, Top up, Use, Correct balance.
const ENTRY_LABELS: Record<GiftVoucherTransaction["kind"], string> = {
  sale: "Created",
  top_up: "Topped up",
  spend: "Used",
  undo: "Use undone",
  adjust: "Balance corrected",
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
      <GiftVoucherDetail params={params} />
    </>
  );
}

/**
 * Two columns where there's room (`wide`): on the left what staff need at the till (the balance, the actions
 * that fit the voucher's state, and the card to print); on the right its history, then the
 * details and admin tools, folded away as they're rarely needed. One column on phones, same order.
 */
const columns = "grid items-start gap-5 wide:grid-cols-[minmax(0,380px)_minmax(0,1fr)]";

/** A Card that folds open: for what's rarely needed (details, admin tools). */
function Fold({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 text-lg font-extrabold hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-5 px-5 pt-1 pb-5">{children}</div>
    </details>
  );
}

function Section({ title, hint, children, divided = false }: { title: string; hint?: string; children: React.ReactNode; divided?: boolean }) {
  return (
    <section className={divided ? "flex flex-col gap-3 border-t border-border pt-5" : "flex flex-col gap-3"}>
      <div className="flex flex-col gap-1">
        <h3 className="font-bold">{title}</h3>
        {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

async function GiftVoucherDetail({ params }: { params: PageProps<"/admin/gift-vouchers/[id]">["params"] }) {
  // Request time only: a link prefetch prerenders the page with the cookies, and it reads the clock.
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names, staff] = await Promise.all([getGiftVoucher(id), getSettings(), staffNames(), requireAdmin()]);
  if (!data) notFound();
  const { voucher: v, transactions } = data;
  const tz = settings.timezone;
  const isAdmin = staff.role === "admin";
  // Who did something: their name (a deleted account shows as Staff).
  const by = (userId: string | null) => (userId && names.get(userId)) || "Staff";
  if (v.status === "inactive") return <NotSoldVoucher voucher={v} printedBy={by(v.sold_by)} tz={tz} isAdmin={isAdmin} />;
  // Sold, so it has a sale date and an expiry.
  const soldOn = v.sold_on!;
  const expiresOn = v.expires_on!;
  const used = transactions.filter((t) => t.kind === "spend" && !t.voided_at).reduce((sum, t) => sum - t.delta_cents, 0);
  // The sale plus any top-ups since.
  const loaded = transactions.filter((t) => t.kind === "sale" || t.kind === "top_up").reduce((sum, t) => sum + t.delta_cents, 0);
  const everUsed = transactions.some((t) => t.kind === "spend");
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
    <div className={columns}>
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[24px] font-extrabold tracking-wider">{v.code}</h1>
            <GiftVoucherStatusPill status={v.status} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-muted-foreground">Balance</span>
            <span className={`text-[44px] leading-none font-extrabold tabular-nums ${v.status === "used_up" ? "text-destructive" : ""}`}>
              {formatMoney(v.balance_cents)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {formatMoney(loaded)} loaded · {formatMoney(used)} used
            </span>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{v.status === "expired" ? "Expired" : "Valid until"}</dt>
            <dd className="font-semibold">{day(expiresOn)}</dd>
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-semibold">
              {v.customer ? (
                <Link href={`/admin/customers/${v.customer.id}`} className="text-primary hover:underline">
                  {fullName(v.customer)}
                </Link>
              ) : (
                <span className="font-normal text-muted-foreground">Not linked</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>
              {day(soldOn)} by {by(v.sold_by)}
            </dd>
          </dl>
          {v.notes && <p className="rounded-xl bg-background px-3.5 py-2.5 text-sm whitespace-pre-line">{v.notes}</p>}

          {v.blocked_at && (
            <div role="status" className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-3">
              <p className="flex items-start gap-2 text-sm">
                <Ban className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                <span>
                  <span className="font-bold">Blocked</span> {formatDate(v.blocked_at, tz, { day: "numeric", month: "short", year: "numeric" })} by{" "}
                  {by(v.blocked_by)}
                  {v.blocked_reason && `: ${v.blocked_reason}`}. Nothing can be used or topped up; the balance is kept.
                </span>
              </p>
              {isAdmin && (
                <ActionButton variant="outline" size="sm" className="w-fit" action={unblockGiftVoucher.bind(null, v.id)}>
                  Unblock
                </ActionButton>
              )}
            </div>
          )}
          {v.status === "expired" && <p className="text-sm text-muted-foreground">It has expired, so it can&apos;t be used or topped up.</p>}

          {/* Only the till actions that fit: Use needs a balance; Top up works on an active or used-up voucher. */}
          {(v.status === "active" || v.status === "used_up") && (
            <div className="grid grid-cols-2 gap-2">
              {v.status === "active" && <UseThisVoucherButton code={v.code} />}
              <TopUpButton code={v.code} variant={v.status === "used_up" ? "default" : "outline"} className={v.status === "used_up" ? "col-span-2" : undefined} />
            </div>
          )}
        </Card>

        <Card className="@container flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold">Printed voucher</h2>
            <p className="text-[13px] text-muted-foreground">The customer scans the QR code to see the balance left.</p>
          </div>
          <PrintableVoucher code={v.code} expiresOn={expiresOn} token={v.public_token} />
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Card className="pt-5 pb-2">
          <h2 className="px-5 pb-3 text-lg font-extrabold">History</h2>
          <DataTable minWidth={0}>
            <thead>
              <tr>
                <th className={`${th} hidden sm:table-cell`}>Date</th>
                <th className={th}>Activity</th>
                <th className={`${th} hidden sm:table-cell`}>By</th>
                <th className={`${th} text-right`}>Amount</th>
                {/* The running balance needs the room of a wide screen beside the summary column. */}
                <th className={`${th} hidden text-right sm:below-wide:table-cell xl:table-cell`}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && <EmptyRow colSpan={5}>No activity yet.</EmptyRow>}
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
                    {/* On phones the date and who did it move here. */}
                    <p className="text-[13px] text-muted-foreground sm:hidden">
                      {formatDate(t.created_at, tz)} {formatTime(t.created_at, tz)} · {by(t.created_by)}
                    </p>
                  </td>
                  <td className={`${td} hidden text-muted-foreground sm:table-cell`}>{by(t.created_by)}</td>
                  <td
                    className={`${td} text-right font-extrabold whitespace-nowrap tabular-nums ${t.voided_at ? "line-through" : t.delta_cents > 0 ? "text-success" : "text-destructive"}`}
                  >
                    {t.delta_cents > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(t.delta_cents))}
                  </td>
                  <td className={`${td} hidden text-right whitespace-nowrap tabular-nums sm:below-wide:table-cell xl:table-cell`}>{formatMoney(t.balance_after_cents)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>

        <Fold title="Details">
          <GiftVoucherSettingsForm
            id={v.id}
            phone={v.customer?.phone ?? null}
            notes={v.notes}
            expiresOn={expiresOn}
            minExpiry={threeYearsAfter(soldOn)}
            isAdmin={isAdmin}
          />
        </Fold>

        {/* Admin-only fixes, kept apart from the till actions. */}
        {isAdmin && (
          <Fold title="Admin tools">
            <Section
              title="Correct balance"
              hint="Only to fix a mistake, e.g. a use entered twice: put it back with the reason. When a customer pays for more credit, use Top up instead."
            >
              <AdjustGiftVoucherForm id={v.id} balanceCents={v.balance_cents} />
            </Section>
            {!v.blocked_at && (
              <Section divided title="Block voucher" hint="If it's lost or stolen, so nobody else can use it. The balance is kept, and you can unblock it later.">
                <BlockGiftVoucherForm id={v.id} />
              </Section>
            )}
            <Section divided title="Delete voucher">
              {everUsed ? (
                <p className="text-[13px] text-muted-foreground">It has been used, so it can&apos;t be deleted. To fix its balance, use Correct balance.</p>
              ) : (
                <ConfirmButton
                  variant="danger"
                  className="w-full"
                  title={`Delete ${v.code}?`}
                  description="Only for a voucher created by mistake. Refund the customer at the till. This can't be undone."
                  confirmLabel="Delete voucher"
                  action={deleteGiftVoucher.bind(null, v.id)}
                >
                  Delete voucher
                </ConfirmButton>
              )}
            </Section>
          </Fold>
        )}
      </div>
    </div>
  );
}

/**
 * A blank card printed ahead of time and not sold yet: no balance, history or expiry until a
 * customer buys it. Its card can be printed again, and one that's lost or spoiled can be deleted.
 */
function NotSoldVoucher({ voucher: v, printedBy, tz, isAdmin }: { voucher: GiftVoucherRow; printedBy: string; tz: string; isAdmin: boolean }) {
  return (
    <div className={columns}>
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[24px] font-extrabold tracking-wider">{v.code}</h1>
            <GiftVoucherStatusPill status={v.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            A blank card printed {formatDate(v.created_at, tz, { day: "numeric", month: "short", year: "numeric" })} by {printedBy}. It has no balance
            until a customer buys it: create it with the amount they pay. Its 3 years start that day, and the QR code on the card then shows the
            balance.
          </p>
          <SellGiftVoucherButton code={v.code} className="w-full" />
        </Card>
        <Card className="@container flex flex-col gap-4 p-5">
          <h2 className="text-lg font-extrabold">Printed voucher</h2>
          <PrintableVoucher code={v.code} expiresOn={null} token={v.public_token} />
        </Card>
      </div>
      {isAdmin && (
        <div className="flex min-w-0 flex-col gap-5">
          <Fold title="Admin tools">
            <Section title="Delete voucher" hint="For a blank card that's lost or spoiled. Its code and QR code stop working.">
              <ConfirmButton
                variant="danger"
                className="w-full"
                title={`Delete ${v.code}?`}
                description="For a blank card that's lost or spoiled. Its code and QR code stop working. This can't be undone."
                confirmLabel="Delete voucher"
                action={deleteGiftVoucher.bind(null, v.id)}
              >
                Delete voucher
              </ConfirmButton>
            </Section>
          </Fold>
        </div>
      )}
    </div>
  );
}
