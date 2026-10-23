import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type KioskReward = { id: string; title: string; cost: number };

export type KioskContent = {
  rewards: KioskReward[];
  /** Null when the birthday discount is switched off. */
  birthday: { percent: number; windowDays: number } | null;
  idleSeconds: number;
  pointsPerVisit: number;
  signupBonus: number;
  timezone: string;
};

/** Rewards and program settings for the kiosk screens. Read by the kiosk page after the device check. */
export async function loadKioskContent(): Promise<KioskContent> {
  const supabase = createAdminClient();
  const [{ data: settings }, { data: rewards }] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("promotions").select("id, title, points_cost").eq("is_active", true).order("points_cost"),
  ]);

  return {
    rewards: (rewards ?? []).map((r) => ({ id: r.id, title: r.title, cost: r.points_cost })),
    birthday: settings?.birthday_discount_enabled
      ? { percent: settings.birthday_discount_percent, windowDays: settings.birthday_window_days }
      : null,
    idleSeconds: settings?.kiosk_idle_seconds ?? 60,
    pointsPerVisit: settings?.points_per_visit ?? 1,
    signupBonus: settings?.signup_bonus ?? 0,
    timezone: settings?.timezone ?? "Australia/Hobart",
  };
}
