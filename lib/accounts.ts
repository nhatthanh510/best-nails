// Shared by the account forms (browser) and account actions (server).

/** Long enough to be worth having, short enough to read out across the counter. */
export const MIN_PASSWORD = 8;

// No 0/O, 1/l/I: an admin reads a temporary password out or writes it down for someone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random temporary password, e.g. "kP7mWx3qTa". */
export function generatePassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
