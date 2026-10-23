// Client-side formatting for the kiosk display, kept free of libphonenumber to stay small.

/** Digit groups for an Australian number, chosen from what's been typed so far. */
function groupsFor(digits: string): number[] {
  if (/^0[2378]/.test(digits)) return [2, 4, 4]; // landline: 03 6234 5678
  return [4, 3, 3]; // mobile and 1300/1800: 0412 345 678
}

/**
 * Formats typed digits into "0412 345 678" with underscores for the rest of a standard
 * 10-digit number. Longer, non-standard input just keeps going in groups of three.
 */
export function fillPhoneMask(digits: string): { typed: string; rest: string } {
  const groups = groupsFor(digits);
  const slots = groups.map((n) => "_".repeat(n)).join(" ");

  let out = "";
  let used = 0;
  let cut = 0;
  for (const ch of slots) {
    if (ch === "_" && used < digits.length) {
      out += digits[used++];
      cut = out.length;
    } else {
      out += ch;
    }
  }
  if (used < digits.length) {
    const extra = digits.slice(used).match(/.{1,3}/g)!.join(" ");
    return { typed: `${out} ${extra}`, rest: "" };
  }
  return { typed: out.slice(0, cut), rest: out.slice(cut) };
}

/** A quick client-side guess matching normalizePhone().standard for typical AU numbers. */
export function looksStandard(digits: string): boolean {
  return /^0[23478]\d{8}$/.test(digits) || /^1[38]00\d{6}$/.test(digits);
}
