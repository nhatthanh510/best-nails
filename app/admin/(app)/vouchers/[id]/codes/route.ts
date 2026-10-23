import { getVoucher, listVoucherCodes } from "@/lib/admin-data";
import { formatDiscount } from "@/lib/vouchers";

/** CSV of every code for a voucher, for printing with the owner's own design. */
export async function GET(_: Request, { params }: RouteContext<"/admin/vouchers/[id]/codes">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  // getVoucher checks the staff session (and redirects to login if there isn't one).
  const data = await getVoucher(id);
  if (!data) return new Response("Not found", { status: 404 });
  const { voucher } = data;
  const codes = await listVoucherCodes(id);

  const discount = formatDiscount(voucher.discount_type, voucher.discount_value);
  // Quote cells with separators, and stop spreadsheets treating =, +, - or @ as a formula.
  const escape = (raw: string) => {
    const s = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ["code", "discount", "uses_allowed", "uses_left", "expires_on", "voucher"].join(","),
    ...codes.map((c) =>
      [c.code, discount, String(c.max_uses), String(c.max_uses - c.uses), voucher.expires_on ?? "", voucher.name].map(escape).join(","),
    ),
  ];
  const filename = `${voucher.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "voucher"}-codes.csv`;

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
