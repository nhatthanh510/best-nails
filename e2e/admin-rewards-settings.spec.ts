import { createReward, getSettings, seedCustomer, testPhone } from "./support/db";
import { alert, expect, nextFrame, settled, test } from "./support/fixtures";

test.describe("Admin: rewards", () => {
  test("RW-01 create, pause and delete a reward; 0 points is refused", async ({ page }) => {
    await page.goto("/admin/rewards");
    await page.getByRole("button", { name: "Add reward" }).click();
    await page.getByLabel("Reward", { exact: true }).fill("E2E Free nail art");
    await page.getByLabel("Points needed").fill("0");
    await page.getByRole("button", { name: "Create reward" }).click();
    await expect(alert(page, "It needs to cost at least 1 point.")).toBeVisible();

    await page.getByLabel("Points needed").fill("12");
    await page.getByRole("button", { name: "Create reward" }).click();
    // The editor closes on save; the confirmation still shows (it used to be lost with the editor).
    await expect(page.getByText("Reward created.")).toBeVisible();
    const row = page.getByText("E2E Free nail art", { exact: true }).locator("..").locator("..");
    await expect(row).toContainText("12 points (12 visits) · redeemed 0 times");
    await expect(row).toContainText("Active");

    await page.getByRole("button", { name: "Edit E2E Free nail art" }).click();
    await page.getByLabel(/^Active/).uncheck();
    await page.getByRole("button", { name: "Save reward" }).click();
    await expect(page.getByText("Reward saved.")).toBeVisible();
    await expect(row).toContainText("Paused");

    await page.getByRole("button", { name: "Edit E2E Free nail art" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const confirm = await settled(page.getByRole("dialog", { name: "Delete “E2E Free nail art”?" }));
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Reward deleted.")).toBeVisible();
    await expect(page.getByText("E2E Free nail art")).toHaveCount(0);
  });

  test("R-07 a paused reward isn't shown on the kiosk", async ({ page }) => {
    await createReward("E2E Paused reward", 5, false);
    await page.goto("/kiosk");
    await expect(page.getByRole("heading", { name: /Welcome in/ })).toBeVisible();
    await expect(page.getByText("E2E Paused reward")).toHaveCount(0);
  });

  test("RW-02 turning the birthday discount on shows it on the kiosk", async ({ page }) => {
    await page.goto("/admin/rewards");
    await page.getByLabel("Offer a birthday discount").check();
    await page.getByRole("textbox", { name: /^New/ }).fill("10");
    await page.getByRole("textbox", { name: /^Regular/ }).fill("15");
    await page.getByRole("textbox", { name: /^VIP/ }).fill("20");
    await page.getByRole("button", { name: "Save birthday discount" }).click();
    await expect(page.getByText("Birthday discount saved.")).toBeVisible();
    expect(await getSettings()).toMatchObject({
      birthday_discount_enabled: true,
      birthday_value_new: 10,
      birthday_value_regular: 15,
      birthday_value_vip: 20,
    });

    // The kiosk names the top tier's discount and the tiers to reach.
    await page.goto("/kiosk");
    await expect(page.getByText("10% off on your birthday — up to 20% off for VIPs")).toBeVisible();
    await expect(page.getByText(/Visit more to reach Regular and VIP for a bigger birthday treat\./)).toBeVisible();
  });

  test("RW-03 a tier's birthday discount can be a dollar amount", async ({ page }) => {
    await page.goto("/admin/rewards");
    await page.getByLabel("Offer a birthday discount").check();
    for (const tier of ["New", "Regular", "VIP"]) {
      await page.getByLabel(`${tier} discount type`).selectOption("$ off");
      await page.getByRole("textbox", { name: new RegExp(`^${tier}`) }).fill("20");
    }
    await page.getByRole("button", { name: "Save birthday discount" }).click();
    await expect(page.getByText("Birthday discount saved.")).toBeVisible();
    expect(await getSettings()).toMatchObject({ birthday_kind_vip: "amount", birthday_value_vip: 2000 });

    await page.goto("/kiosk");
    await expect(page.getByText("$20 off on your birthday", { exact: true })).toBeVisible();
  });
});

test.describe("Admin: settings", () => {
  test("ST-02 VIP at or below Regular shows an error and disables Save", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel("VIP from").fill("10");
    await expect(alert(page, "VIP needs more points than Regular.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await page.getByLabel("VIP from").fill("11");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  test("tier thresholds apply to customers straight away", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(50), firstName: "Dot", points: 5 });
    await page.goto("/admin/settings");
    await page.getByLabel("Regular from").fill("5");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page.goto(`/admin/customers/${id}`);
    await expect(page.getByText("Regular", { exact: true }).first()).toBeVisible();
  });

  test("ST-03 the code prefix is letters only and is used for new codes", async ({ page }) => {
    await page.goto("/admin/settings");
    const prefix = page.getByLabel("Business code prefix");
    // Typed key by key: anything but letters is dropped as it's typed.
    await prefix.clear();
    await prefix.pressSequentially("t1b-h");
    await expect(prefix).toHaveValue("TBH");
    await expect(page.getByText("TBH48207138")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page.goto("/admin/gift-vouchers");
    await page.getByRole("button", { name: "Create gift voucher" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Create a gift voucher" }));
    await dialog.getByRole("button", { name: "Generate" }).click();
    await expect(dialog.getByLabel("Code")).toHaveValue(/^TBH\d{8}$/);
  });

  test("ST-01 leaving with unsaved changes asks first", async ({ page }) => {
    await page.goto("/admin/settings");
    // The tier preview only updates once React is running, so the change below is really seen.
    await page.getByLabel("Regular from").fill("12");
    await expect(page.getByRole("list", { name: "Tiers" })).toContainText("12–19 points");
    await page.getByLabel("Return to start after").selectOption("90");
    await nextFrame(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Customers" }).click();
    const leave = await settled(page.getByRole("dialog", { name: "Leave without saving?" }));
    await leave.getByRole("button", { name: "Stay" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.getByLabel("Return to start after")).toHaveValue("90");

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Customers" }).click();
    await (await settled(leave)).getByRole("button", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/admin\/customers$/);
    expect(await getSettings()).toMatchObject({ kiosk_idle_seconds: 60, tier_regular_points: 10 });
  });
});
