"use server";

import { getStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearKioskUnlocked, setKioskUnlocked } from "@/lib/kiosk-lock";

export type UnlockResult = { ok: true } | { ok: false; message: string };

/**
 * The kiosk's staff PIN, typed before Gift card, Admin or Sign out. The database checks it (and
 * locks it for a minute after 5 wrong tries). For Gift card, a correct PIN also unlocks the gift
 * card actions for this account until the dialog closes (or 10 minutes pass).
 */
export async function unlockKiosk(pin: string, purpose: "gift_card" | "admin" | "sign_out"): Promise<UnlockResult> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "This screen has been signed out." };
  const typed = String(pin ?? "");
  if (!/^[0-9]{4,8}$/.test(typed)) return { ok: false, message: "That PIN isn't right. Try again." };

  const { data, error } = await createAdminClient().rpc("check_kiosk_pin", { p_pin: typed });
  if (error) return { ok: false, message: "Couldn't check the PIN. Please try again." };
  if (data === "locked") return { ok: false, message: "Too many wrong tries. Wait a minute, then try again." };
  if (data === "wrong") return { ok: false, message: "That PIN isn't right. Try again." };
  // 'ok', or 'not_set' (turned off in Settings meanwhile): either way there's nothing to keep out.
  if (purpose === "gift_card") await setKioskUnlocked(staff.id);
  return { ok: true };
}

/** Locks the gift card actions again (the Gift card dialog closed). */
export async function lockKiosk(): Promise<void> {
  await clearKioskUnlocked();
}
