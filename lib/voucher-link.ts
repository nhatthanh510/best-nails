/**
 * The public balance page a gift voucher's QR code opens. Uses the site's public URL, so a
 * voucher printed from any device points at the live site.
 */
export function voucherBalanceUrl(token: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/v/${token}`;
}
