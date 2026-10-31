import type { Page } from "@playwright/test";
import { createReward, db, findCustomer, seedCustomer, shopToday, testPhone, updateSettings } from "./support/db";
import { alert, expect, settled, test } from "./support/fixtures";

/**
 * A dashboard or detail tile, found by its label. Next keeps pages visited earlier mounted but
 * hidden, so only visible elements count.
 */
const tile = (page: Page, label: string) =>
  page.locator("div").filter({ visible: true }).filter({ has: page.getByText(label, { exact: true }) }).last();

test.describe("Admin: customers", () => {
  test("C-01 add a customer, phone first, and land on their page", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await expect(dialog.getByLabel("Mobile number")).toBeFocused();
    await dialog.getByLabel("Mobile number").fill("0491 570 130");
    await dialog.getByLabel("First name").fill("Olive");
    await dialog.getByLabel("Last name").fill("Ng");
    await dialog.getByLabel("Birthday month").selectOption({ label: "October" });
    await dialog.getByLabel("Birthday day").selectOption("27");
    await dialog.getByLabel("Notes").fill("Gel only, no acetone");
    await dialog.getByRole("button", { name: "Add customer" }).click();

    await expect(page.getByRole("heading", { name: "Olive Ng", level: 1 })).toBeVisible();
    await expect(page.getByText("0491 570 130")).toBeVisible();
    await expect(page.getByText("Birthday 27 Oct")).toBeVisible();
    await expect(page.getByText("Gel only, no acetone")).toBeVisible();
    // Customers start at zero and earn from their next check-in.
    await expect(tile(page, "Points balance")).toContainText("0");
    await expect(tile(page, "Last visit")).toContainText("Never");
    expect(await findCustomer(testPhone(30))).toMatchObject({ first_name: "Olive", points_balance: 0, visit_count: 0 });
  });

  test("C-02 a number that's already a customer is flagged as soon as the phone is entered", async ({ page }) => {
    await seedCustomer({ phone: testPhone(31), firstName: "Pat", lastName: "Lee" });
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    // Typed in international format, still the same customer.
    await dialog.getByLabel("Mobile number").fill("+61 491 570 131");
    await dialog.getByLabel("First name").focus();
    await expect(dialog.getByText("Already a customer: Pat Lee.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add customer" })).toBeDisabled();
    await dialog.getByRole("link", { name: "Open their page" }).click();
    await expect(page.getByRole("heading", { name: "Pat Lee", level: 1 })).toBeVisible();
  });

  test("C-03 searching by a local number finds the stored +61 number", async ({ page }) => {
    await seedCustomer({ phone: testPhone(32), firstName: "Quinn", lastName: "Search" });
    await seedCustomer({ phone: testPhone(33), firstName: "Rae", lastName: "Other" });
    await page.goto("/admin/customers");
    await page.getByLabel("Search customers").fill("0491570132");
    await expect(page).toHaveURL(/q=0491570132/);
    await expect(page.getByRole("link", { name: /Quinn Search/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Rae Other/ })).toHaveCount(0);

    await page.getByLabel("Search customers").fill("rae");
    await expect(page.getByRole("link", { name: /Rae Other/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Quinn Search/ })).toHaveCount(0);
  });

  test("C-06 Adjust points needs a reason, and +1 at 9 lifetime points makes them Regular", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(34), firstName: "Sam", points: 9 });
    await page.goto(`/admin/customers/${id}`);
    await expect(page.getByText("New", { exact: true }).first()).toBeVisible();

    const adjust = page.locator("form").filter({ has: page.getByRole("group", { name: "Add or remove points" }) });
    const save = adjust.getByRole("button", { name: /^Save/ });
    await expect(save).toBeDisabled();

    // Removing more than the balance is blocked before saving.
    await adjust.getByRole("button", { name: "remove" }).click();
    await adjust.getByLabel("Points", { exact: true }).fill("50");
    await expect(save).toBeDisabled();

    await adjust.getByRole("button", { name: "add" }).click();
    await adjust.getByLabel("Points", { exact: true }).fill("1");
    await expect(save).toHaveText("Save · new balance 10");
    await save.click();
    // The reason is required, so nothing is saved yet.
    expect(await findCustomer(testPhone(34))).toMatchObject({ points_balance: 9 });

    await adjust.getByLabel("Reason").fill("Missed visit on Friday");
    await save.click();
    await expect(page.getByText("Saved · new balance 10 pts")).toBeVisible();
    await expect(tile(page, "Points balance")).toContainText("10");
    await expect(page.getByText("Regular", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /Adjustment.*Missed visit on Friday/ })).toBeVisible();
    // A made-up visit moves the tier but isn't counted as a visit.
    expect(await findCustomer(testPhone(34))).toMatchObject({ points_balance: 10, lifetime_points: 10, visit_count: 0 });
  });

  test("redeem a reward at the till, then only one discount that day", async ({ page }) => {
    await createReward("E2E 10% off", 10);
    const id = await seedCustomer({ phone: testPhone(35), firstName: "Tess", checkedIn: true, points: 19 });
    await page.goto(`/admin/customers/${id}`);
    await expect(page.getByText(/Checked in today/)).toBeVisible();

    const redeemCard = page.locator("div").filter({ has: page.getByRole("heading", { name: "Redeem a discount" }) }).last();
    await redeemCard.getByRole("button", { name: "Redeem" }).click();
    await expect(page.getByText("Reward redeemed · 10 pts left")).toBeVisible();
    await expect(redeemCard.getByText("E2E 10% off used today. It's one discount per visit.")).toBeVisible();
    await expect(redeemCard.getByRole("button", { name: "Redeem" })).toBeDisabled();
    expect(await findCustomer(testPhone(35))).toMatchObject({ points_balance: 10, lifetime_points: 20 });
  });

  test("edit a customer's details", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(36), firstName: "Uma" });
    await page.goto(`/admin/customers/${id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit customer" });
    await dialog.getByLabel("Last name").fill("Vance");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Customer saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Uma Vance", level: 1 })).toBeVisible();
  });

  test("an impossible birthday can't be picked in the admin either", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await dialog.getByLabel("Birthday month").selectOption({ label: "February" });
    await expect(dialog.getByLabel("Birthday day").locator("option", { hasText: /^30$/ })).toHaveCount(0);

    // Half a birthday is refused by the server, with the typed values kept.
    await dialog.getByLabel("Mobile number").fill("0491 570 137");
    await dialog.getByLabel("First name").fill("Wren");
    await dialog.getByRole("button", { name: "Add customer" }).click();
    await expect(alert(page, "Enter both the birthday month and day, or neither.")).toBeVisible();
    await expect(dialog.getByLabel("First name")).toHaveValue("Wren");
  });

  test("C-08 delete a customer after confirming", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(38), firstName: "Xena", checkedIn: true });
    await page.goto(`/admin/customers/${id}`);
    await page.getByRole("button", { name: "Delete customer" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete Xena?" });
    await (await settled(confirm)).getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    expect(await findCustomer(testPhone(38))).not.toBeNull();

    await page.getByRole("button", { name: "Delete customer" }).click();
    await (await settled(confirm)).getByRole("button", { name: "Delete customer" }).click();
    await expect(page).toHaveURL(/\/admin\/customers$/);
    expect(await findCustomer(testPhone(38))).toBeNull();
  });
});

test.describe("Admin: today's activity", () => {
  test("CI-01 a kiosk check-in shows on the dashboard and the Check-ins page", async ({ page }) => {
    await seedCustomer({ phone: testPhone(39), firstName: "Yara", lastName: "Today", checkedIn: true });
    await page.goto("/admin");
    await expect(page.getByRole("cell", { name: /Yara Today/ })).toBeVisible();

    await page.goto("/admin/check-ins");
    await expect(page.getByRole("heading", { name: "Check-ins", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Yara Today/ })).toBeVisible();
  });
});

test.describe("Admin: birthday badge", () => {
  test("B-05 a customer who can claim the birthday discount today has a Birthday badge by their name", async ({ page }) => {
    await updateSettings({ birthday_discount_enabled: true });
    const { month, day } = shopToday();
    // A returning customer (2+ lifetime points) on their birthday, and one who joined today.
    await seedCustomer({ phone: testPhone(45), firstName: "Bea", lastName: "Badge", birthday: { month, day }, checkedIn: true, points: 1 });
    await seedCustomer({ phone: testPhone(46), firstName: "Neil", lastName: "Newbie", birthday: { month, day }, checkedIn: true });

    const row = (name: string) => page.getByRole("row").filter({ hasText: name });
    // The Customers list shows it beside their birthday in the DoB column; not for someone who just joined.
    await page.goto("/admin/customers?q=Badge");
    const dob = row("Bea Badge").getByRole("cell").nth(1);
    await expect(dob.getByText("Birthday today")).toBeVisible();
    await expect(dob.getByText("10% off")).toBeVisible();
    await page.goto("/admin/customers?q=Newbie");
    await expect(row("Neil Newbie").getByText(/Birthday today/)).toHaveCount(0);

    // Once it's used, it says Claimed. (Check-ins has no badge: its Redeemed column shows it.)
    await db().rpc("kiosk_redeem_birthday", { p_phone: "+61491570145" });
    await page.goto("/admin/customers?q=Badge");
    await expect(row("Bea Badge").getByText("Claimed", { exact: true }).filter({ visible: true })).toBeVisible();
  });
});
