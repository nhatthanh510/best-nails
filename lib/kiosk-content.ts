import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { birthdayOffer, birthdayPitch, type TierDiscount } from "@/lib/rewards";

export type KioskReward = { id: string; title: string; cost: number };
export type KioskServiceCategory = { id: string; name: string; services: { id: string; name: string }[] };
export type KioskTechnician = { id: string; name: string };

export type KioskContent = {
  rewards: KioskReward[];
  /**
   * Null when the birthday discount is switched off (or no tier gets one). The discount depends on
   * the customer's tier: `offer` is the short form ("10% off", "up to $20 off", or null when the
   * tiers mix percents and amounts), and `pitch` the program card's line naming the tiers, to get
   * customers visiting more.
   */
  birthday: { offer: string | null; pitch: NonNullable<ReturnType<typeof birthdayPitch>>; windowDays: number } | null;
  /** The menu shown after Check in: categories turned on, each with at least one service on. */
  services: KioskServiceCategory[];
  /** Technicians turned on, for "Who's looking after you?". Either step is skipped when empty. */
  technicians: KioskTechnician[];
  idleSeconds: number;
  timezone: string;
};

/** Rewards, the service menu, technicians and program settings for the kiosk screens. Read by the kiosk page after the device check. */
export async function loadKioskContent(): Promise<KioskContent> {
  const supabase = createAdminClient();
  const [{ data: settings }, { data: rewards }, { data: categories }, { data: technicians }] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("promotions").select("id, title, points_cost").eq("is_active", true).order("points_cost"),
    supabase
      .from("service_categories")
      .select("id, name, services(id, name, sort_order, is_active)")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("technicians").select("id, name").eq("is_active", true).order("sort_order").order("name"),
  ]);

  const birthdayTiers: TierDiscount[] = settings
    ? [
        { tier: "new", kind: settings.birthday_kind_new, value: settings.birthday_value_new },
        { tier: "regular", kind: settings.birthday_kind_regular, value: settings.birthday_value_regular },
        { tier: "vip", kind: settings.birthday_kind_vip, value: settings.birthday_value_vip },
      ]
    : [];
  const pitch = birthdayPitch(birthdayTiers);

  return {
    rewards: (rewards ?? []).map((r) => ({ id: r.id, title: r.title, cost: r.points_cost })),
    birthday:
      settings?.birthday_discount_enabled && pitch
        ? { offer: birthdayOffer(birthdayTiers), pitch, windowDays: settings.birthday_window_days }
        : null,
    services: (categories ?? [])
      .map((c) => ({
        id: c.id,
        name: c.name,
        services: c.services
          .filter((s) => s.is_active)
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .map((s) => ({ id: s.id, name: s.name })),
      }))
      .filter((c) => c.services.length > 0),
    technicians: technicians ?? [],
    idleSeconds: settings?.kiosk_idle_seconds ?? 60,
    timezone: settings?.timezone ?? "Australia/Hobart",
  };
}
