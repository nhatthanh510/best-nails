import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, Redirect } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({
  staff: null as null | { id: string; role: "admin" | "staff"; mustChangePassword: boolean },
  db: null as unknown as ReturnType<typeof import("@/test/fake-supabase").fakeSupabase>,
}));

vi.mock("next/navigation", async () => {
  const { Redirect } = await import("@/test/fake-supabase");
  return {
    redirect: (to: string) => {
      throw new Redirect(to);
    },
  };
});
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.db.client }));
vi.mock("@/lib/auth", () => ({
  getStaff: vi.fn(async () => h.staff),
  requireAdmin: vi.fn(async () => h.staff),
  homeFor: (role: string) => (role === "admin" ? "/admin" : "/kiosk"),
}));

const actions = await import("./actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Runs an action that may redirect, and returns where it went (or the result). */
async function run<T>(p: Promise<T>): Promise<T | { redirect: string }> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.to };
    throw e;
  }
}

beforeEach(() => {
  h.db = fakeSupabase();
  h.staff = { id: "admin-1", role: "admin", mustChangePassword: false };
});

describe("signIn routing (AA-01)", () => {
  const signIn = (fields: Record<string, string>) => run(actions.signIn(null, form(fields)));

  it("asks for both fields", async () => {
    expect(await signIn({ email: "", password: "x" })).toEqual({ ok: false, message: "Enter your email and password." });
    expect(h.db.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("gives one message for a wrong email or password", async () => {
    h.db.client.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    expect(await signIn({ email: "a@b.test", password: "nope" })).toEqual({ ok: false, message: "That email and password don't match." });
  });

  it("signs out an Auth user who has no staff row", async () => {
    h.staff = null;
    expect(await signIn({ email: "a@b.test", password: "pw" })).toEqual({ ok: false, message: "This account doesn't have access to Best Nails." });
    expect(h.db.client.auth.signOut).toHaveBeenCalled();
  });

  it("sends a temporary password to choose a new one first", async () => {
    h.staff = { id: "s", role: "admin", mustChangePassword: true };
    expect(await signIn({ email: "a@b.test", password: "pw", next: "/admin/customers" })).toEqual({ redirect: "/account" });
  });

  it("sends an admin back where they were heading, but only on this site", async () => {
    expect(await signIn({ email: "a@b.test", password: "pw", next: "/admin/customers?q=1" })).toEqual({ redirect: "/admin/customers?q=1" });
    expect(await signIn({ email: "a@b.test", password: "pw", next: "//evil.com" })).toEqual({ redirect: "/admin" });
    expect(await signIn({ email: "a@b.test", password: "pw" })).toEqual({ redirect: "/admin" });
  });

  it("sends a staff account to the kiosk, whatever admin page it asked for", async () => {
    h.staff = { id: "s", role: "staff", mustChangePassword: false };
    expect(await signIn({ email: "a@b.test", password: "pw", next: "/admin/customers" })).toEqual({ redirect: "/kiosk" });
    expect(await signIn({ email: "a@b.test", password: "pw", next: "/account" })).toEqual({ redirect: "/account" });
  });
});

describe("createCustomer (AA-02)", () => {
  const valid = { phone: "0491 570 101", first_name: "Alice", last_name: "", birthday_day: "", birthday_month: "", notes: "" };
  const create = (fields: Partial<typeof valid>) => actions.createCustomer(null, form({ ...valid, ...fields }));

  it.each([
    [{ phone: "0491" }, "Enter a phone number with 8 to 12 digits."],
    [{ first_name: "  " }, "First name is required."],
    [{ birthday_month: "3" }, "Enter both the birthday month and day, or neither."],
    [{ birthday_day: "3" }, "Enter both the birthday month and day, or neither."],
    [{ birthday_month: "2", birthday_day: "30" }, "That birthday isn't a real date."],
  ])("refuses %o", async (fields, message) => {
    expect(await create(fields)).toEqual({ ok: false, message });
    expect(h.db.client.from).not.toHaveBeenCalled();
  });

  it("stores the normalised number and never sends points", async () => {
    h.db.next.query = { data: { id: "c1" }, error: null };
    expect(await create({ birthday_day: "29", birthday_month: "2", notes: "  Gel only " })).toEqual({
      ok: true,
      message: "Customer added.",
      href: "/admin/customers/c1",
    });
    const insert = h.db.calls.find((c) => c.method === "insert")!;
    expect(insert.table).toBe("customers");
    expect(insert.args[0]).toEqual({
      phone: "+61491570101",
      first_name: "Alice",
      last_name: null,
      birthday_month: 2,
      birthday_day: 29,
      notes: "Gel only",
    });
  });

  it("saves a non-standard number with a warning", async () => {
    h.db.next.query = { data: { id: "c1" }, error: null };
    expect(await create({ phone: "0500 000 000" })).toMatchObject({
      ok: true,
      message: "Customer added. The phone number isn't a standard Australian format, so double-check it.",
    });
  });

  it("explains a duplicate number", async () => {
    h.db.next.query = { data: null, error: { code: "23505", message: "duplicate key" } };
    expect(await create({})).toEqual({ ok: false, message: "A customer with this phone number already exists." });
  });

  it("explains a permissions error", async () => {
    h.db.next.query = { data: null, error: { code: "42501", message: "forbidden" } };
    expect(await create({})).toEqual({ ok: false, message: "You don't have permission to do that." });
  });
});

describe("adjustPoints (AA-03)", () => {
  const adjust = (fields: Record<string, string>) => actions.adjustPoints("c1", null, form({ direction: "add", amount: "1", note: "Missed visit", ...fields }));

  it("needs at least one point and a reason", async () => {
    expect(await adjust({ amount: "0" })).toEqual({ ok: false, message: "Enter at least 1 point." });
    expect(await adjust({ note: "  " })).toEqual({ ok: false, message: "Add a reason so the history makes sense later." });
    expect(h.db.client.rpc).not.toHaveBeenCalled();
  });

  it("sends Remove as a negative change", async () => {
    h.db.next.rpc = { data: 3, error: null };
    expect(await adjust({ direction: "remove", amount: "2" })).toEqual({ ok: true, message: "Saved · new balance 3 pts" });
    expect(h.db.client.rpc).toHaveBeenCalledWith("adjust_points", { p_customer_id: "c1", p_delta: -2, p_note: "Missed visit" });
  });

  it("shows the database's reason when there aren't enough points", async () => {
    h.db.next.rpc = { data: null, error: { code: "22023", message: "insufficient points" } };
    expect(await adjust({ direction: "remove", amount: "50" })).toEqual({ ok: false, message: "Insufficient points." });
  });
});

describe("saveSettings (AA-04)", () => {
  const valid = { kiosk_idle_seconds: "60", tier_regular_points: "10", tier_vip_points: "20", code_prefix: "BN", timezone: "Australia/Hobart" };
  const save = (fields: Partial<typeof valid>) => actions.saveSettings(null, form({ ...valid, ...fields }));

  it("needs VIP above Regular", async () => {
    expect(await save({ tier_vip_points: "10" })).toEqual({ ok: false, message: "VIP needs more points than Regular." });
  });

  it("needs a 2 to 4 letter prefix", async () => {
    for (const code_prefix of ["B", "BNTXX", "B1"]) {
      expect(await save({ code_prefix })).toEqual({ ok: false, message: "The code prefix must be 2 to 4 letters, e.g. BN." });
    }
  });

  it("refuses an unknown timezone", async () => {
    expect(await save({ timezone: "Mars/Olympus" })).toEqual({ ok: false, message: "Unknown timezone." });
  });

  it("upper-cases the prefix before saving", async () => {
    expect(await save({ code_prefix: " tbh " })).toEqual({ ok: true, message: "Settings saved." });
    const update = h.db.calls.find((c) => c.method === "update")!;
    expect(update.args[0]).toMatchObject({ code_prefix: "TBH", tier_regular_points: 10, tier_vip_points: 20, kiosk_idle_seconds: 60 });
  });
});

describe("rewards and birthday (AA-05)", () => {
  it("needs a name and at least one point", async () => {
    expect(await actions.saveReward(null, form({ title: " ", points_cost: "10" }))).toEqual({ ok: false, message: "Give the reward a name, e.g. 10% off." });
    expect(await actions.saveReward(null, form({ title: "10% off", points_cost: "0" }))).toEqual({ ok: false, message: "It needs to cost at least 1 point." });
  });

  it("creates new rewards as type reward, active only when ticked", async () => {
    expect(await actions.saveReward(null, form({ title: "10% off", points_cost: "10" }))).toEqual({ ok: true, message: "Reward created." });
    expect(h.db.calls.find((c) => c.method === "insert")!.args[0]).toEqual({ title: "10% off", points_cost: 10, is_active: false, type: "reward" });
  });

  it("updates an existing reward by id", async () => {
    const id = "0f8e6d2c-1b3a-4c5d-8e9f-a1b2c3d4e5f6";
    expect(await actions.saveReward(null, form({ id, title: "15% off", points_cost: "12", is_active: "on" }))).toEqual({ ok: true, message: "Reward saved." });
    expect(h.db.calls.find((c) => c.method === "update")!.args[0]).toEqual({ title: "15% off", points_cost: 12, is_active: true });
    expect(h.db.calls.find((c) => c.method === "eq")!.args).toEqual(["id", id]);
  });

  it("needs a birthday discount of at least 1%", async () => {
    expect(await actions.saveBirthdayDiscount(null, form({ birthday_discount_percent: "0", birthday_window_days: "7" }))).toEqual({
      ok: false,
      message: "Enter a discount of at least 1%.",
    });
  });

  it("explains each birthday redemption outcome", async () => {
    h.db.next.rpc = { data: { status: "redeemed", percent: 10 }, error: null };
    expect(await actions.redeemBirthday("c1")).toEqual({ ok: true, message: "Birthday 10% off redeemed." });
    h.db.next.rpc = { data: { status: "already_used" }, error: null };
    expect(await actions.redeemBirthday("c1")).toEqual({ ok: false, message: "The birthday discount was already used for this birthday." });
    h.db.next.rpc = { data: { status: "not_eligible" }, error: null };
    expect(await actions.redeemBirthday("c1")).toEqual({ ok: false, message: "The birthday discount isn't available today." });
  });
});
