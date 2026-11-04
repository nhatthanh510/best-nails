import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({
  db: null as unknown as ReturnType<typeof import("@/test/fake-supabase").fakeSupabase>,
  service: null as unknown as ReturnType<typeof import("@/test/fake-supabase").fakeSupabase>,
  customer: null as null | "missing" | { id: string; first_name: string; last_name: string | null },
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.db.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.service.client }));
vi.mock("@/lib/customer-lookup", () => ({ findCustomer: vi.fn(async () => h.customer) }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "admin" })),
  requireSignedIn: vi.fn(async () => ({ id: "staff-1", role: "staff" })),
}));

const actions = await import("./gift-card-actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.db = fakeSupabase();
  h.service = fakeSupabase();
  h.customer = null;
});

describe("sellGiftCard (GA-01)", () => {
  const sell = (fields: Record<string, string>) => actions.sellGiftCard(null, form({ amount: "100", code: "QA12345678", phone: "", notes: "", ...fields }));

  it("needs at least $1 and a code", async () => {
    expect(await sell({ amount: "0.50" })).toEqual({ ok: false, message: "Enter the gift card amount, e.g. 100." });
    expect(await sell({ amount: "abc" })).toEqual({ ok: false, message: "Enter the gift card amount, e.g. 100." });
    expect(await sell({ code: "  " })).toEqual({ ok: false, message: "Enter the code on the gift card, or press Generate." });
    expect(h.db.client.rpc).not.toHaveBeenCalled();
  });

  it("refuses a phone number that isn't a customer", async () => {
    h.customer = "missing";
    expect(await sell({ phone: "0491570199" })).toEqual({ ok: false, message: "No customer has that phone number. Leave it blank or add them first." });
    expect(h.db.client.rpc).not.toHaveBeenCalled();
  });

  it("creates the gift card and returns what the confirmation screen shows", async () => {
    h.customer = { id: "c1", first_name: "Alice", last_name: "Ng" };
    h.db.next.rpc = { data: { id: "v1", code: "QA12345678" }, error: null };
    h.service.next.query = { data: { expires_on: "2029-10-26", public_token: "abcdefghijklmnopqrstuv" }, error: null };
    expect(await sell({ amount: "$150", notes: "For mum" })).toEqual({
      ok: true,
      message: "Created QA12345678 for $150.00. Take payment at the till.",
      href: "/admin/gift-cards/v1",
      giftCard: { id: "v1", code: "QA12345678", amountCents: 15000, expiresOn: "2029-10-26", publicToken: "abcdefghijklmnopqrstuv", preprinted: false, customerName: "Alice Ng" },
    });
    expect(h.db.client.rpc).toHaveBeenCalledWith("sell_gift_card", {
      p_amount_cents: 15000,
      p_code: "QA12345678",
      p_customer_id: "c1",
      p_notes: "For mum",
    });
  });

  it("shows the database's reason, e.g. a code already used", async () => {
    h.db.next.rpc = { data: null, error: { code: "22023", message: "the code QA12345678 is already used" } };
    expect(await sell({})).toEqual({ ok: false, message: "The code QA12345678 is already used." });
  });

  it("explains the 3-year minimum", async () => {
    h.db.next.rpc = { data: null, error: { code: "23514", message: "check constraint" } };
    expect(await sell({})).toEqual({ ok: false, message: "Gift cards must stay valid for at least 3 years from when they're created." });
  });
});

describe("checkGiftCardCode", () => {
  it("calls an unknown code with a wrong check digit a typo (GA-02)", async () => {
    h.db.next.rpc = { data: { status: "not_found" }, error: null };
    expect(await actions.checkGiftCardCode("BN48207183")).toEqual({
      ok: false,
      message: "This code looks mistyped: one of the digits is probably wrong. Check it against the gift card.",
    });
    expect(await actions.checkGiftCardCode("BN48207138")).toEqual({ ok: false, message: "No gift card has this code. Check it was typed correctly." });
  });

  it("explains used-up and expired gift cards", async () => {
    h.db.next.rpc = { data: { status: "used_up" }, error: null };
    expect(await actions.checkGiftCardCode("QA1")).toEqual({ ok: false, message: "This gift card has no balance left." });
    h.db.next.rpc = { data: { status: "expired" }, error: null };
    expect(await actions.checkGiftCardCode("QA1")).toEqual({ ok: false, message: "This gift card has expired." });
  });

  it("returns the balance of a valid gift card", async () => {
    h.db.next.rpc = {
      data: { status: "valid", id: "v1", code: "QA1", balance_cents: 4000, amount_cents: 10000, expires_on: "2029-10-26", customer_name: null },
      error: null,
    };
    expect(await actions.checkGiftCardCode("qa1")).toEqual({
      ok: true,
      id: "v1",
      code: "QA1",
      balanceCents: 4000,
      amountCents: 10000,
      expiresOn: "2029-10-26",
      customerName: null,
    });
  });
});

describe("spendGiftCard (GA-02)", () => {
  const spend = (fields: Record<string, string>) => actions.spendGiftCard(null, form({ code: "QA12345678", amount: "35", note: "", phone: "", ...fields }));

  it("needs an amount", async () => {
    expect(await spend({ amount: "0" })).toEqual({ ok: false, message: "Enter the amount for today's service, e.g. 35." });
    expect(await spend({ amount: "" })).toEqual({ ok: false, message: "Enter the amount for today's service, e.g. 35." });
  });

  it("says how much is left when the amount is over the balance", async () => {
    h.db.next.rpc = { data: { status: "over_balance", balance_cents: 2000 }, error: null };
    expect(await spend({ amount: "35" })).toEqual({
      ok: false,
      message: "This gift card only has $20.00 left. Enter $20.00 or less and take the rest at the till.",
    });
  });

  it("confirms the spend, and what to take at the till when the gift card didn't cover it all", async () => {
    h.db.next.rpc = { data: { status: "spent", spent_cents: 2000, balance_cents: 0, code: "QA12345678" }, error: null };
    expect(await spend({ amount: "20", till: "15.00" })).toEqual({
      ok: true,
      message: "Used $20.00 from QA12345678. $0.00 left. Take $15.00 at the till.",
    });
    expect(h.db.client.rpc).toHaveBeenCalledWith("spend_gift_card", { p_code: "QA12345678", p_amount_cents: 2000, p_customer_id: undefined, p_note: undefined });
  });

  it("refuses a phone number that isn't a customer", async () => {
    h.customer = "missing";
    expect(await spend({ phone: "0491570199" })).toEqual({ ok: false, message: "No customer has that phone number." });
  });
});

describe("adjustGiftCard (GA-03)", () => {
  const adjust = (fields: Record<string, string>) => actions.adjustGiftCard("v1", null, form({ direction: "add", amount: "10", note: "Typo at the till", ...fields }));

  it("needs a non-zero amount and a reason", async () => {
    expect(await adjust({ amount: "0" })).toEqual({ ok: false, message: "Enter an amount, e.g. 10." });
    expect(await adjust({ note: " " })).toEqual({ ok: false, message: "Give a reason, e.g. Typo at the till." });
  });

  it("sends Remove as a negative change and reports the new balance", async () => {
    h.db.next.rpc = { data: 4000, error: null };
    expect(await adjust({ direction: "remove", amount: "10" })).toEqual({ ok: true, message: "Balance is now $40.00." });
    expect(h.db.client.rpc).toHaveBeenCalledWith("adjust_gift_card", { p_gift_card_id: "v1", p_delta_cents: -1000, p_note: "Typo at the till" });
  });
});

describe("deleteGiftCard (GA-04)", () => {
  it("can't delete a gift card that has been used (RLS returns no row)", async () => {
    h.db.next.query = { data: [], error: null };
    expect(await actions.deleteGiftCard("v1")).toEqual({ ok: false, message: "This gift card has been used, so it can't be deleted." });
  });

  it("deletes an unspent gift card and goes back to the list", async () => {
    h.db.next.query = { data: [{ id: "v1" }], error: null };
    expect(await actions.deleteGiftCard("v1")).toEqual({ ok: true, message: "Gift card deleted.", href: "/admin/gift-cards" });
  });
});
