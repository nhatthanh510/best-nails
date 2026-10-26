import { createReward, findCustomer, seedCustomer, shopToday, testPhone, updateSettings } from "./support/db";
import { expect, test } from "./support/fixtures";

const REWARD = "E2E 10% off";
const redeemList = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Rewards you can redeem" });

test.beforeEach(async () => {
  await createReward(REWARD, 10);
});

test.describe("Kiosk: points reward", () => {
  test("check in with 9 points, then redeem the reward on the success screen", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(10), firstName: "Gina", points: 9 });
    await kiosk.goto();
    await kiosk.enter(testPhone(10));
    // 9 points: not ready until today's visit is added.
    await expect(page.getByText(`1 more visit to ${REWARD}`)).toBeVisible();
    await kiosk.checkIn();

    await expect(page.getByText("You're checked in, Gina!")).toBeVisible();
    // Someone about to redeem isn't rushed by a countdown.
    await expect(page.getByText(/closing in/)).toHaveCount(0);
    await expect(redeemList(page).getByText("Uses 10 of your 10 points")).toBeVisible();
    await kiosk.redeem(REWARD);

    await expect(page.getByRole("status").filter({ hasText: REWARD })).toBeVisible();
    await expect(page.getByText("Show this screen to the front desk when you pay.")).toBeVisible();
    await expect(page.getByText("−10")).toBeVisible();
    // Redeeming spends the balance but not lifetime points, so the tier stays.
    expect(await findCustomer(testPhone(10))).toMatchObject({ points_balance: 0, lifetime_points: 10, visit_count: 1 });
  });

  test("R-04 a customer back at the till after checking in goes straight to redeeming", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(11), firstName: "Hana", checkedIn: true, points: 9 });
    await kiosk.goto();
    await kiosk.enter(testPhone(11));

    await expect(page.getByRole("heading", { name: "Welcome back, Hana!" })).toBeVisible();
    await expect(page.getByText(/Checked in today at/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(0);

    // Two steps, so a stray tap doesn't spend the points: Cancel backs out.
    const row = redeemList(page).getByRole("listitem").filter({ hasText: REWARD });
    await row.getByRole("button", { name: "Redeem", exact: true }).click();
    await row.getByRole("button", { name: "Cancel" }).click();
    await expect(row.getByRole("button", { name: "Redeem", exact: true })).toBeVisible();
    expect(await findCustomer(testPhone(11))).toMatchObject({ points_balance: 10 });

    await kiosk.redeem(REWARD);
    await expect(page.getByText("Redeemed", { exact: true })).toBeVisible();
    await expect(page.getByText("Points left")).toBeVisible();
  });

  test("R-06 after today's discount the kiosk offers nothing more, even with points for another", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(12), firstName: "Iris", checkedIn: true, points: 19 });
    await kiosk.goto();
    await kiosk.enter(testPhone(12));
    await kiosk.redeem(REWARD);
    await expect(page.getByText("Redeemed", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Done/ }).click();

    await kiosk.enter(testPhone(12));
    await expect(page.getByText("You've had today's discount")).toBeVisible();
    await expect(page.getByText("10 points saved for your next visit · one discount per visit")).toBeVisible();
    await expect(redeemList(page)).toHaveCount(0);
    expect(await findCustomer(testPhone(12))).toMatchObject({ points_balance: 10 });
  });

  test("No thanks, I'm done keeps the points", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(13), firstName: "Jo", checkedIn: true, points: 9 });
    await kiosk.goto();
    await kiosk.enter(testPhone(13));
    await page.getByRole("button", { name: "No thanks, I'm done" }).click();
    await expect(page.getByRole("heading", { name: /Welcome in/ })).toBeVisible();
    expect(await findCustomer(testPhone(13))).toMatchObject({ points_balance: 10 });
  });
});

test.describe("Kiosk: birthday discount", () => {
  test.beforeEach(async () => {
    await updateSettings({ birthday_discount_enabled: true });
  });

  test("B-02 in the birthday window, the birthday discount is redeemed with no points", async ({ kiosk, page }) => {
    const { month, day } = shopToday();
    await seedCustomer({ phone: testPhone(14), firstName: "Kim", birthday: { month, day } });
    await kiosk.goto();
    await kiosk.enter(testPhone(14));
    await expect(page.getByText("Happy birthday! 10% off is waiting.")).toBeVisible();
    await kiosk.checkIn();

    await expect(redeemList(page).getByText("Our gift to you. No points needed")).toBeVisible();
    await kiosk.redeem("Birthday 10% off");
    await expect(page.getByRole("status").filter({ hasText: "Birthday 10% off" })).toBeVisible();
    await expect(page.getByText("Points used")).toHaveCount(0);
    expect(await findCustomer(testPhone(14))).toMatchObject({ points_balance: 1 });
  });

  test("the birthday discount counts as today's one discount", async ({ kiosk, page }) => {
    const { month, day } = shopToday();
    await seedCustomer({ phone: testPhone(15), firstName: "Lee", birthday: { month, day }, checkedIn: true, points: 9 });
    await kiosk.goto();
    await kiosk.enter(testPhone(15));
    // Both are on offer, but only one can be used.
    await expect(redeemList(page).getByRole("listitem")).toHaveCount(2);
    await kiosk.redeem("Birthday 10% off");
    await page.getByRole("button", { name: /^Done/ }).click();

    await kiosk.enter(testPhone(15));
    await expect(page.getByText("You've had today's discount")).toBeVisible();
    expect(await findCustomer(testPhone(15))).toMatchObject({ points_balance: 10 });
  });

  test("B-03 with the birthday discount off, nothing is offered on the birthday", async ({ kiosk, page }) => {
    await updateSettings({ birthday_discount_enabled: false });
    const { month, day } = shopToday();
    await seedCustomer({ phone: testPhone(16), firstName: "Mo", birthday: { month, day }, checkedIn: true });
    await kiosk.goto();
    await kiosk.enter(testPhone(16));
    await expect(page.getByText(/Happy birthday/)).toHaveCount(0);
    await expect(redeemList(page)).toHaveCount(0);
  });
});
