import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export const MIN_PHONE_DIGITS = 8;
export const MAX_PHONE_DIGITS = 12;

export type NormalizedPhone = {
  /** Canonical key stored in the database: +61412345678. */
  e164: string;
  /** False for numbers that aren't a standard Australian (or international) format. They're still accepted. */
  standard: boolean;
};

/**
 * Turns what a customer typed into the canonical +<digits> form. Australian local numbers lose
 * their leading 0 (0412 345 678 → +61412345678). Unusual numbers are kept as typed rather than
 * rejected, so the same digits always map to the same customer. Returns null only when the
 * length is implausible.
 */
export function normalizePhone(input: string): NormalizedPhone | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS + 2) return null;

  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.startsWith("61") && digits.length >= 11) e164 = `+${digits}`;
  else if (digits.startsWith("0")) e164 = `+61${digits.slice(1)}`;
  else e164 = `+61${digits}`;

  // E.164 allows at most 15 digits; the database enforces the same bound.
  if (!/^\+\d{8,15}$/.test(e164)) return null;
  const local = e164.startsWith("+61") ? e164.length - 3 : digits.length;
  if (!trimmed.startsWith("+") && local > MAX_PHONE_DIGITS) return null;

  const parsed = parsePhoneNumberFromString(e164);
  return { e164, standard: Boolean(parsed?.isValid()) };
}

export function isStandardPhone(e164: string): boolean {
  return Boolean(parsePhoneNumberFromString(e164)?.isValid());
}

/** 0412 345 678 / (03) 6234 5678 for Australian numbers, international format otherwise. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.isValid()) return parsed.countryCallingCode === "61" ? parsed.formatNational() : parsed.formatInternational();
  if (e164.startsWith("+61")) return groupDigits(`0${e164.slice(3)}`);
  return e164;
}

/** •••• ••• 678: shown on the kiosk so a passer-by can't read someone's number. */
export function maskPhone(e164: string): string {
  return `•••• ••• ${e164.slice(-3)}`;
}

function groupDigits(d: string) {
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(" ");
}
