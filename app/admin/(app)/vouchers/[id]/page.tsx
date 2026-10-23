import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyRow, StatTile, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/action-button";
import { RedeemVoucher } from "@/components/admin/redeem-voucher";
import { VoucherStatusPill } from "@/components/admin/voucher-status";
import { deleteVoucher, voidVoucherRedemption } from "@/app/admin/voucher-actions";
import { getSettings, getVoucher, staffNames } from "@/lib/admin-data";
import { formatDiscount } from "@/lib/vouchers";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { AddCodesForm, EditVoucherForm } from "./voucher-forms";

export const metadata = { title: "Voucher" };

export default function VoucherPage({ params }: PageProps<"/admin/vouchers/[id]">) {
  return (
    <>
      <Link href="/admin/vouchers" className="flex min-h-8 w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
        <ChevronLeft className="size-4" strokeWidth={2.4} aria-hidden="true" />
        All vouchers
      </Link>
      <Suspense fallback={<Card className="h-28" />}>
        <VoucherDetail params={params} />
      </Suspense>
    </>
  );
}

async function VoucherDetail({ params }: { params: PageProps<"/admin/vouchers/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, settings, names] = await Promise.all([getVoucher(id), getSettings(), staffNames()]);
  if (!data) notFound();
  const { voucher: v, codes, codesTotal, codesShown, redemptions } = data;
  const tz = settings.timezone;
  const shared = v.codeCount === 1 && codes[0]?.max_uses > 1;
  const left = v.totalUses - v.used;
  const day = (d: string) => formatDate(`${d}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-extrabold tracking-tight">{v.name}</h1>
            <VoucherStatusPill status={v.status} />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{formatDiscount(v.discount_type, v.discount_value)}</span>
            <span>{v.starts_on ? `From ${day(v.starts_on)}` : "Valid now"}</span>
            <span>{v.expires_on ? `Expires ${day(v.expires_on)}` : "No expiry"}</span>
            <span>{v.once_per_customer ? "Once per customer" : "Customers can reuse"}</span>
          </p>
          {v.notes && <p className="text-sm whitespace-pre-line">{v.notes}</p>}
        </div>
        {shared && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Code</span>
            <span className="rounded-xl border-2 border-dashed border-input px-4 py-2 font-mono text-2xl font-extrabold tracking-widest">
              {codes[0].code}
            </span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatTile label="Used" value={v.used.toLocaleString()} />
        <StatTile label="Uses left" value={left.toLocaleString()} hint={`of ${v.totalUses.toLocaleString()} in total`} />
        <StatTile label="Codes" value={v.codeCount.toLocaleString()} hint={shared ? "One shared code" : "Each used once"} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-lg font-extrabold">Redeem</h2>
            <RedeemVoucher />
          </Card>

          <Card className="pt-5 pb-2">
            <h2 className="px-5 pb-3 text-lg font-extrabold">Redemptions</h2>
            <DataTable minWidth={620}>
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Code</th>
                  <th className={th}>Customer</th>
                  <th className={th}>By</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {redemptions.length === 0 && <EmptyRow colSpan={5}>Not used yet.</EmptyRow>}
                {redemptions.map((r) => (
                  <tr key={r.id} className={r.voided_at ? "bg-background text-muted-foreground" : undefined}>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDateTime(r.created_at, tz)}
                      {r.note && <p className="text-[13px] text-muted-foreground">{r.note}</p>}
                    </td>
                    <td className={`${td} font-mono text-[13px] font-bold`}>{r.code?.code}</td>
                    <td className={td}>
                      {r.customer ? (
                        <Link href={`/admin/customers/${r.customer.id}`} className="font-bold hover:underline">
                          {fullName(r.customer)}
                          <span className="ml-2 font-normal text-muted-foreground">{formatPhone(r.customer.phone)}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </td>
                    <td className={`${td} text-muted-foreground`}>{names.get(r.created_by ?? "") ?? "Staff"}</td>
                    <td className={`${td} text-right`}>
                      {r.voided_at ? (
                        <span className="text-[13px] font-bold">Undone</span>
                      ) : (
                        <ConfirmButton
                          variant="outline"
                          size="sm"
                          title="Undo this redemption?"
                          description="The use is given back, so the code can be redeemed again."
                          confirmLabel="Undo"
                          action={voidVoucherRedemption.bind(null, r.id)}
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

          {!shared && (
            <Card className="pt-5 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
                <h2 className="text-lg font-extrabold">Codes</h2>
                <Button asChild variant="outline" size="sm">
                  <a href={`/admin/vouchers/${v.id}/codes`} download>
                    <Download aria-hidden="true" />
                    Download CSV
                  </a>
                </Button>
              </div>
              <DataTable minWidth={360}>
                <thead>
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id}>
                      <td className={`${td} font-mono font-bold tracking-wider`}>{c.code}</td>
                      <td className={td}>
                        {c.uses >= c.max_uses ? (
                          <span className="font-semibold text-muted-foreground">Used</span>
                        ) : (
                          <span className="font-semibold text-success">Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {codesTotal > codesShown && (
                <p className="px-5 py-3 text-sm text-muted-foreground">
                  Showing {codesShown.toLocaleString()} of {codesTotal.toLocaleString()} codes. Download the CSV for all of them.
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-lg font-extrabold">Settings</h2>
            <EditVoucherForm voucher={v} />
          </Card>
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-lg font-extrabold">Add codes</h2>
            <AddCodesForm voucherId={v.id} />
          </Card>
          {v.used === 0 && (
            <ConfirmButton
              variant="ghost"
              className="w-fit text-destructive hover:text-destructive"
              title={`Delete “${v.name}”?`}
              description="It hasn't been used yet, so its codes are removed too. This can't be undone."
              confirmLabel="Delete voucher"
              action={deleteVoucher.bind(null, v.id)}
            >
              Delete voucher
            </ConfirmButton>
          )}
        </div>
      </div>
    </>
  );
}
