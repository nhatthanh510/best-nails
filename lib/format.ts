// Display helpers shared by admin pages. Times are shown in the shop's timezone.

export function formatTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone });
}

export function formatDateTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-AU", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDate(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-AU", { ...opts, timeZone });
}

/** "Today", "Yesterday", "Oct 12" or "Jun 3, 2025". */
export function formatLastVisit(iso: string | null, timeZone: string) {
  if (!iso) return "Never";
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone });
  const now = new Date();
  if (day(new Date(iso)) === day(now)) return "Today";
  if (day(new Date(iso)) === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const sameYear = new Date(iso).getFullYear() === now.getFullYear();
  return formatDate(iso, timeZone, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fullName(c: { first_name: string; last_name: string | null }) {
  return c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name;
}

export function initials(c: { first_name: string; last_name: string | null }) {
  return (c.first_name[0] + (c.last_name?.[0] ?? "")).toUpperCase();
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatBirthday(month: number | null, day: number | null) {
  return month && day ? `${MONTHS[month - 1].slice(0, 3)} ${day}` : null;
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}
