/**
 * Returns `next` only if it's a path on this site, else `fallback`. Browsers ignore tabs and
 * newlines and treat "\" like "/", so "/\t/evil.com" or "/\evil.com" would leave the site;
 * reject any control character or backslash, then confirm the URL resolves to our origin.
 */
export function safeRedirectPath(next: string, fallback: string): string {
  if (!next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  const base = "http://best-nails.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
