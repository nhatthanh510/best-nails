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

/** Mirrors MAX_PHONE_DIGITS in lib/phone.ts (kept out of the client bundle). */
export const MAX_KIOSK_DIGITS = 12;

/**
 * When the kiosk's Continue can be pressed. Every Australian number written with a leading 0
 * (mobile or landline) has 10 digits, so those need at least 10; anything else (an overseas
 * number) at least 8. Longer numbers are allowed, with the "not a standard Australian number"
 * warning, so unusual numbers are never blocked.
 */
export function isCompleteNumber(digits: string): boolean {
  return digits.length >= (digits.startsWith("0") ? 10 : 8);
}

/** A quick client-side guess matching normalizePhone().standard for typical AU numbers. */
export function looksStandard(digits: string): boolean {
  return /^0[23478]\d{8}$/.test(digits) || /^1[38]00\d{6}$/.test(digits);
}

/**
 * Whether a phone field should show the "not a standard Australian number" warning, mirroring
 * normalizePhone(): "61…" and a missing leading 0 are read as Australian. While typing
 * (`finished` false) it only judges once there are 10 digits, so a number half-way through
 * doesn't warn; once the field is left, a short number warns too. Saving is never blocked.
 */
export function phoneNeedsCheck(value: string, finished: boolean): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("61") && digits.length >= 11) digits = `0${digits.slice(2)}`;
  else if (/^[2-9]/.test(digits)) digits = `0${digits}`;
  if (!digits || (!finished && digits.length < 10)) return false;
  return !looksStandard(digits);
}

/**
 * A stored +61… number in local form for pre-filling a phone field in a client form: "0412 345
 * 678" / "03 6234 5678", and any other +61 number as 0 + its digits in groups of 4-3-rest, like
 * formatPhone in lib/phone.ts (the full version, which brings libphonenumber into the browser
 * bundle). Overseas numbers stay as stored.
 */
export function formatPhoneInput(e164: string): string {
  if (!e164.startsWith("+61")) return e164;
  const local = `0${e164.slice(3)}`;
  if (looksStandard(local)) return fillPhoneMask(local).typed;
  return [local.slice(0, 4), local.slice(4, 7), local.slice(7)].filter(Boolean).join(" ");
}
