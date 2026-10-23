import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyRow, PageHeader, td, th } from "@/components/admin/ui";
import { RedeemVoucher } from "@/components/admin/redeem-voucher";
import { VoucherStatusPill } from "@/components/admin/voucher-status";
import { listVouchers } from "@/lib/admin-data";
import { formatDiscount } from "@/lib/vouchers";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Vouchers" };

export default function VouchersPage() {
  return (
    <>
      <PageHeader
        title="Vouchers"
        subtitle="Printed discount vouchers. Redeem them here at the front desk; the system tracks every use."
        actions={
          <Button asChild>
            <Link href="/admin/vouchers/new">
              <Plus aria-hidden="true" />
              New voucher
            </Link>
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-extrabold">Redeem a voucher</h2>
        <RedeemVoucher />
      </Card>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <VoucherList />
      </Suspense>
    </>
  );
}

async function VoucherList() {
  const vouchers = await listVouchers();

  return (
    <Card className="overflow-hidden">
      <DataTable minWidth={820}>
        <thead className="bg-background">
          <tr>
            <th className={th}>Voucher</th>
            <th className={th}>Discount</th>
            <th className={th}>Code</th>
            <th className={`${th} text-right`}>Used</th>
            <th className={th}>Expires</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.length === 0 && (
            <EmptyRow colSpan={6}>
              No vouchers yet.{" "}
              <Link href="/admin/vouchers/new" className="font-bold text-primary">
                Create the first one
              </Link>
              .
            </EmptyRow>
          )}
          {vouchers.map((v) => (
            <tr key={v.id} className="hover:bg-background/60">
              <td className={td}>
                <Link href={`/admin/vouchers/${v.id}`} className="font-bold hover:underline">
                  {v.name}
                </Link>
              </td>
              <td className={`${td} font-semibold`}>{formatDiscount(v.discount_type, v.discount_value)}</td>
              <td className={td}>
                {v.codeCount === 1 ? (
                  <span className="font-mono text-[13px] font-bold">{v.sharedCode ?? "1 code"}</span>
                ) : (
                  <span className="text-muted-foreground">{v.codeCount.toLocaleString()} codes</span>
                )}
              </td>
              <td className={`${td} text-right tabular-nums`}>
                <span className="font-bold">{v.used.toLocaleString()}</span>
                <span className="text-muted-foreground"> / {v.totalUses.toLocaleString()}</span>
              </td>
              <td className={`${td} text-muted-foreground`}>
                {v.expires_on ? formatDate(`${v.expires_on}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}
              </td>
              <td className={td}>
                <VoucherStatusPill status={v.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  );
}
