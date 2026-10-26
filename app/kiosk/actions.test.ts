import { beforeEach, describe, expect, it, vi } from "vitest";

// The kiosk actions run with the service-role client after guard(); both are faked here so the
// tests cover the validation and the mapping to what the public screen shows.
const h = vi.hoisted(() => ({
  staff: null as null | { id: string; role: "admin" | "staff" },
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getStaff: vi.fn(async () => h.staff) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: h.rpc,
    // The actions only call functions; a table read would show up here.
    from: h.from,
  }),
}));

const { checkIn, lookupPhone, redeemAtKiosk } = await import("./actions");

const CUSTOMER_ID = "6c1b2f0e-7a52-4f3e-9d7e-2b1f0c9a8e11";
const REWARD_ID = "0f8e6d2c-1b3a-4c5d-8e9f-a1b2c3d4e5f6";

/** Answers the read-only RPCs the actions call after a check-in or lookup. */
function rpcReturns(main: Record<string, unknown> | null, error: unknown = null) {
  h.rpc.mockImplementation(async (name: string) => {
    if (name === "_birthday_status") return { data: { eligible: false, in_window: false, used: false }, error: null };
    if (name === "kiosk_today") return { data: { checked_in_at: null, discount_used_today: false }, error: null };
    return { data: main, error };
  });
}

beforeEach(() => {
  h.staff = { id: "staff-1", role: "staff" };
  h.rpc.mockReset();
  h.from.mockClear();
  rpcReturns(null);
});

describe("guard (KA-01)", () => {
  it("refuses every action on a signed-out device without touching the database", async () => {
    h.staff = null;
    const signedOut = { status: "error", message: "This screen has been signed out. Ask the front desk for help." };
    expect(await lookupPhone("0491570101")).toEqual(signedOut);
    expect(await checkIn("0491570101")).toEqual(signedOut);
    expect(await redeemAtKiosk("0491570101", { kind: "birthday" })).toEqual(signedOut);
    expect(h.from).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("lookupPhone", () => {
  it("asks for more digits when the number is too short", async () => {
    expect(await lookupPhone("0491")).toEqual({ status: "invalid_phone", message: "Please enter at least 8 digits of your phone number." });
  });

  it("offers sign-up for an unknown number, formatted and flagged if unusual", async () => {
    expect(await lookupPhone("0491570101")).toEqual({ status: "not_found", formattedPhone: "0491 570 101", nonStandard: false });
    expect(await lookupPhone("0500000000")).toMatchObject({ status: "not_found", nonStandard: true });
  });

  it("returns only what the public screen shows (KA-02)", async () => {
    rpcReturns({
      first_name: "Alice",
      phone: "+61491570101",
      points_balance: 7,
      visit_count: 7,
      birthday: { eligible: false, in_window: false, used: false },
      today: { checked_in_at: null, discount_used_today: false },
    });
    const result = await lookupPhone("0491 570 101");
    // One round trip: the customer, birthday and today's status together.
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith("kiosk_lookup", { p_phone: "+61491570101" });
    expect(result).toEqual({
      status: "found",
      customer: {
        firstName: "Alice",
        maskedPhone: "04•• ••• 101",
        points: 7,
        visits: 7,
        birthday: { eligible: false, used: false },
        checkedInAt: null,
        discountUsedToday: false,
      },
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("+61491570101");
    expect(json).not.toContain("0491570101");
    expect(json).not.toContain(CUSTOMER_ID);
  });

  it("says rewards can't be reached when the read fails", async () => {
    rpcReturns(null, { message: "boom" });
    expect(await lookupPhone("0491570101")).toEqual({ status: "error", message: "We couldn't reach rewards right now." });
  });
});

describe("checkIn sign-up validation (KA-03, KA-04)", () => {
  it.each([
    [{ firstName: "   " }, "Please enter your first name."],
    [{ firstName: "Alice", birthdayMonth: 3 }, "Please pick both the day and the month of your birthday, or leave both blank."],
    [{ firstName: "Alice", birthdayDay: 3 }, "Please pick both the day and the month of your birthday, or leave both blank."],
    [{ firstName: "Alice", birthdayMonth: 2, birthdayDay: 31 }, "That birthday isn't a real date. Please check it."],
    [{ firstName: "Alice", birthdayMonth: 4, birthdayDay: 31 }, "That birthday isn't a real date. Please check it."],
  ])("refuses %o before calling the database", async (signup, message) => {
    expect(await checkIn("0491570101", signup)).toEqual({ status: "error", message });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuses a number that's too short", async () => {
    expect(await checkIn("0491")).toEqual({ status: "error", message: "Please enter at least 8 digits of your phone number." });
  });

  it("passes a 29 February birthday, trimmed names and no blank last name to the database", async () => {
    rpcReturns({ status: "checked_in", customer_id: CUSTOMER_ID, first_name: "Alice", points_awarded: 1, points_balance: 1 });
    const result = await checkIn("0491 570 101", { firstName: "  Alice ", lastName: "  ", birthdayMonth: 2, birthdayDay: 29 });
    expect(h.rpc).toHaveBeenCalledWith("kiosk_check_in", {
      p_phone: "+61491570101",
      p_first_name: "Alice",
      p_last_name: undefined,
      p_birthday_month: 2,
      p_birthday_day: 29,
    });
    expect(result).toEqual({
      status: "checked_in",
      firstName: "Alice",
      pointsAwarded: 1,
      points: 1,
      birthday: { eligible: false, used: false },
      discountUsedToday: false,
    });
  });

  it("passes the picked services and technician to the database", async () => {
    rpcReturns({ status: "checked_in", customer_id: CUSTOMER_ID, first_name: "Alice", points_awarded: 1, points_balance: 1 });
    await checkIn("0491570101", undefined, { serviceIds: [REWARD_ID], technicianId: CUSTOMER_ID });
    expect(h.rpc).toHaveBeenCalledWith("kiosk_check_in", expect.objectContaining({ p_service_ids: [REWARD_ID], p_technician_id: CUSTOMER_ID }));
  });

  it("refuses malformed picks without calling the database", async () => {
    expect(await checkIn("0491570101", undefined, { serviceIds: ["not-a-uuid"], technicianId: null })).toEqual({
      status: "error",
      message: "Please ask the front desk.",
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("reports an existing check-in today rather than awarding another point", async () => {
    rpcReturns({ status: "already_checked_in", customer_id: CUSTOMER_ID, first_name: "Alice", last_check_in_at: "2026-10-26T01:00:00Z", points_balance: 4 });
    expect(await checkIn("0491570101")).toMatchObject({ status: "already_checked_in", lastCheckInAt: "2026-10-26T01:00:00Z", points: 4 });
  });

  it("passes not_found through, so the kiosk can show sign-up", async () => {
    rpcReturns({ status: "not_found" });
    expect(await checkIn("0491570101")).toEqual({ status: "not_found" });
  });

  it("says rewards can't be reached when the database fails", async () => {
    rpcReturns(null, { message: "boom" });
    expect(await checkIn("0491570101")).toEqual({ status: "error", message: "We couldn't reach rewards right now." });
  });
});

describe("redeemAtKiosk", () => {
  it("refuses a malformed reward id without calling the database (KA-06)", async () => {
    expect(await redeemAtKiosk("0491570101", { kind: "reward", rewardId: "not-a-uuid" })).toEqual({
      status: "error",
      message: "Please ask the front desk.",
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", "We couldn't find your rewards account."],
    ["reward_unavailable", "That reward isn't available any more. Please ask the front desk."],
    ["check_in_required", "Please check in first, then you can redeem."],
    ["insufficient_points", "You don't have enough points for that reward yet."],
    ["already_used", "Your birthday discount has already been used this year."],
    ["not_eligible", "Your birthday discount isn't available today."],
    ["discount_used_today", "You've already had a discount today. It's one per visit, so save your points for next time."],
    ["something_new", "Please ask the front desk."],
  ])("explains status %s to the customer (KA-05)", async (status, message) => {
    rpcReturns({ status });
    expect(await redeemAtKiosk("0491570101", { kind: "reward", rewardId: REWARD_ID })).toEqual({ status: "error", message });
  });

  it("redeems a points reward", async () => {
    rpcReturns({ status: "redeemed", reward_title: "10% off", points_spent: 10, points_balance: 2, redeemed_at: "2026-10-26T02:00:00Z" });
    expect(await redeemAtKiosk("0491570101", { kind: "reward", rewardId: REWARD_ID })).toEqual({
      status: "redeemed",
      title: "10% off",
      pointsSpent: 10,
      points: 2,
      redeemedAt: "2026-10-26T02:00:00Z",
    });
    expect(h.rpc).toHaveBeenCalledWith("kiosk_redeem", { p_phone: "+61491570101", p_promotion_id: REWARD_ID });
  });

  it("redeems the birthday discount without spending points", async () => {
    rpcReturns({ status: "redeemed", percent: 10, points_balance: 3, redeemed_at: "2026-10-26T02:00:00Z" });
    expect(await redeemAtKiosk("0491570101", { kind: "birthday" })).toEqual({
      status: "redeemed",
      title: "Birthday 10% off",
      pointsSpent: 0,
      points: 3,
      redeemedAt: "2026-10-26T02:00:00Z",
    });
    expect(h.rpc).toHaveBeenCalledWith("kiosk_redeem_birthday", { p_phone: "+61491570101" });
  });
});
