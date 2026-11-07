import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Staff } from "@/lib/auth";

/**
 * The kiosk's shop PIN (Settings → Kiosk PIN). The one iPad is signed in all day and customers hold
 * it, so the gift card actions a staff account can take need the PIN as well as the session: a
 * correct PIN sets a short-lived signed cookie for that account, and the Gift card dialog clears it
 * when it closes. Admin accounts skip it, because they also use these actions from the admin pages.
 */
const COOKIE = "kiosk_unlocked";
const TTL_SECONDS = 10 * 60;

function sign(value: string) {
  return createHmac("sha256", `kiosk-unlock:${process.env.SUPABASE_SECRET_KEY}`).update(value).digest("base64url");
}

export async function kioskPinIsSet(): Promise<boolean> {
  const { data } = await createAdminClient().rpc("kiosk_pin_status");
  return (data as { is_set?: boolean } | null)?.is_set === true;
}

/** After a correct PIN: unlock the gift card actions for this account for a few minutes. */
export async function setKioskUnlocked(staffId: string) {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const value = `${staffId}.${expires}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearKioskUnlocked() {
  (await cookies()).delete(COOKIE);
}

async function isUnlocked(staffId: string) {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [id, expires, mac] = raw.split(".");
  if (!id || !expires || !mac || id !== staffId || Number(expires) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sign(`${id}.${expires}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const PIN_NEEDED = "Enter the staff PIN first. Close this and tap Gift card again.";

/**
 * For the gift card actions staff can take on the kiosk: null when the account may go ahead, or
 * the message to show. Admins always may; staff need the PIN when one is set.
 */
export async function tillLocked(staff: Staff): Promise<string | null> {
  if (staff.role === "admin") return null;
  if (await isUnlocked(staff.id)) return null;
  return (await kioskPinIsSet()) ? PIN_NEEDED : null;
}
