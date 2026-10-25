import type { Database } from "@/lib/database.types";

export type Reward = Database["public"]["Tables"]["promotions"]["Row"];

/** Result of the _birthday_status SQL function. */
export type BirthdayStatus = {
  enabled: boolean;
  has_birthday: boolean;
  eligible: boolean;
  birthday?: string;
  days_away?: number;
  in_window?: boolean;
  used?: boolean;
  percent?: number;
  window_days?: number;
};

/** "Birthday week" when the window is about a week either side, else "within N days of your birthday". */
export function birthdayWindowLabel(days: number) {
  if (days === 0) return "on your birthday";
  if (days === 7) return "in your birthday week";
  return `within ${days} day${days === 1 ? "" : "s"} of your birthday`;
}
