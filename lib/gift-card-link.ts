/**
 * The public balance page a gift card's QR code opens. Uses the site's public URL, so a
 * gift card printed from any device points at the live site.
 */
export function giftCardBalanceUrl(token: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/v/${token}`;
}
