import { createReward, findCustomer, seedCustomer, testPhone } from "./support/db";
import { expect, test } from "./support/fixtures";

// A 7-point reward: $30 off when the 7 visits since the last reward were paid in cash, else $10.
const REWARD = "E2E cash reward";
const redeemList = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Rewards you can redeem" });

test.beforeEach(async () => {
  await createReward(REWARD, 7, true, { discountCents: 1000, cashDiscountCents: 3000 });
});

test.describe("Kiosk: cash reward", () => {
  test("CR-01 the seventh visit paid in cash gets $30 off", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(70), firstName: "Kim", points: 6, pointsPaidBy: "cash" });
    await kiosk.goto();
    await kiosk.enter(testPhone(70));
    await kiosk.skipVisitSteps("Cash");

    await expect(page.getByText("You're checked in, Kim!")).toBeVisible();
    await expect(redeemList(page).getByText("For paying cash on 7 visits · Uses 7 of your 7 points")).toBeVisible();
    await kiosk.redeem("$30 off");

    await expect(page.getByRole("status").filter({ hasText: "$30 off" })).toBeVisible();
    await expect(page.getByText("For paying cash on 7 visits")).toBeVisible();
    expect(await findCustomer(testPhone(70))).toMatchObject({ points_balance: 0 });
  });

  test("CR-02 paying by card on a visit gets $10 off", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(71), firstName: "Lu", points: 6, pointsPaidBy: "cash" });
    await kiosk.goto();
    await kiosk.enter(testPhone(71));
    // Services first (the menu comes with the app), then how they're paying: last, so Check in.
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: /^Next/ }).click();
    // Then the technician step when the shop has technicians: skip it.
    const payment = page.getByRole("heading", { name: "How are you paying today?" });
    const staff = page.getByRole("heading", { name: "Who's looking after you?" });
    await expect(payment.or(staff)).toBeVisible();
    if (await staff.isVisible()) await page.getByRole("button", { name: /^Skip/ }).click();

    await expect(payment).toBeVisible();
    await expect(page.getByText("if all are paid in cash, $10 off otherwise.")).toBeVisible();
    // Tapping Card checks in; there's no separate Check in button.
    await page.getByRole("group", { name: "Payment method" }).getByRole("button", { name: /^Card/ }).click();

    await expect(page.getByText("You're checked in, Lu!")).toBeVisible();
    await expect(page.getByText("Paying by card")).toBeVisible();
    await kiosk.redeem("$10 off");
    await expect(page.getByRole("status").filter({ hasText: "$10 off" })).toBeVisible();
  });
});
