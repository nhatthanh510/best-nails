import type { Page } from "@playwright/test";
import { findVoucher, seedCustomer, seedVoucher, testPhone } from "./support/db";
import { alert, expect, settled, test } from "./support/fixtures";

/** Opens Use gift voucher from the Gift vouchers page and checks a code. */
async function checkCode(page: Page, code: string) {
  await page.goto("/admin/gift-vouchers");
  await page.getByRole("button", { name: "Use gift voucher" }).click();
  const dialog = await settled(page.getByRole("dialog", { name: "Use a gift voucher" }));
  await dialog.getByLabel("Gift voucher code").fill(code);
  await dialog.getByRole("button", { name: "Check balance" }).click();
  return dialog;
}

test.describe("Admin: creating gift vouchers", () => {
  test("create a voucher linked to a customer, then open it", async ({ page }) => {
    await seedCustomer({ phone: testPhone(40), firstName: "Abby", lastName: "Card" });
    await page.goto("/admin/gift-vouchers");
    await page.getByRole("button", { name: "Create gift voucher" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Create a gift voucher" }));

    await dialog.getByLabel("Other amount in dollars").fill("75");
    await dialog.getByLabel("Code").fill("QA40000001");
    await dialog.getByLabel(/Customer phone/).fill("0491 570 140");
    await dialog.getByRole("button", { name: "Add a note" }).click();
    await dialog.getByLabel(/Notes/).fill("Bought by her sister");
    await dialog.getByRole("button", { name: "Create $75.00 voucher" }).click();

    await expect(dialog.getByRole("status")).toContainText("QA40000001");
    await expect(dialog.getByText("Abby Card")).toBeVisible();
    await dialog.getByRole("button", { name: "Open voucher" }).click();

    await expect(page.getByRole("heading", { name: "QA40000001", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abby Card" })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: "Bought by her sister" })).toBeVisible();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  });

  test("G-04 a code that's already used is refused, with what was typed kept", async ({ page }) => {
    await seedVoucher({ code: "QA40000002", amountCents: 5000 });
    await page.goto("/admin/gift-vouchers");
    await page.getByRole("button", { name: "Create gift voucher" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Create a gift voucher" }));
    await dialog.getByLabel("Code").fill("qa-4000-0002");
    await dialog.getByRole("button", { name: /^Create \$100\.00 voucher$/ }).click();
    await expect(alert(page, "The code QA40000002 is already used.")).toBeVisible();
    await expect(dialog.getByLabel("Code")).toHaveValue("QA-4000-0002");
  });

  test("a phone number that isn't a customer is refused", async ({ page }) => {
    await page.goto("/admin/gift-vouchers");
    await page.getByRole("button", { name: "Create gift voucher" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Create a gift voucher" }));
    await dialog.getByLabel("Code").fill("QA40000003");
    await dialog.getByLabel(/Customer phone/).fill("0491 570 199");
    await dialog.getByRole("button", { name: /^Create/ }).click();
    await expect(alert(page, "No customer has that phone number. Leave it blank or add them first.")).toBeVisible();
    expect(await findVoucher("QA40000003")).toBeNull();
  });
});

test.describe("Admin: using gift vouchers", () => {
  test("G-07 use part of a voucher typed in lower case with spaces", async ({ page }) => {
    await seedVoucher({ code: "QA41000001", amountCents: 10000 });
    const dialog = await checkCode(page, "qa 4100 0001");
    await expect(dialog.getByText("$100.00 left")).toBeVisible();
    await dialog.getByLabel("Today's service").fill("40.50");
    await dialog.getByRole("button", { name: "Use $40.50" }).click();
    await expect(page.getByText("Spent $40.50 from QA41000001. $59.50 left.")).toBeVisible();
    expect(await findVoucher("QA41000001")).toMatchObject({ balance_cents: 5950 });
  });

  test("G-08 more than the balance is blocked; Use all takes the rest at the till", async ({ page }) => {
    await seedVoucher({ code: "QA41000002", amountCents: 5000 });
    const dialog = await checkCode(page, "QA41000002");
    await dialog.getByLabel("Today's service").fill("60");
    await expect(alert(page, "Only $50.00 left.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Use voucher" })).toBeDisabled();

    await dialog.getByRole("button", { name: "Use all $50.00" }).click();
    await expect(dialog.getByLabel("Today's service")).toHaveValue("50.00");
    await expect(dialog.getByText("Uses all of it. Take $10.00 at the till.")).toBeVisible();
    await dialog.getByRole("button", { name: "Use $50.00" }).click();
    await expect(page.getByText("Spent $50.00 from QA41000002. $0.00 left. Take $10.00 at the till.")).toBeVisible();
    expect(await findVoucher("QA41000002")).toMatchObject({ balance_cents: 0 });
  });

  test("G-09 a used-up voucher can't be used again", async ({ page }) => {
    await seedVoucher({ code: "QA41000003", amountCents: 2000 });
    let dialog = await checkCode(page, "QA41000003");
    await dialog.getByLabel("Today's service").fill("20");
    await dialog.getByRole("button", { name: "Use $20.00" }).click();
    await expect(page.getByText(/Spent \$20\.00 from QA41000003/)).toBeVisible();

    dialog = await checkCode(page, "QA41000003");
    await expect(alert(page, "This gift voucher has no balance left.")).toBeVisible();
  });

  test("G-14 an expired voucher is refused", async ({ page }) => {
    await seedVoucher({ code: "QA41000004", amountCents: 5000, expired: true });
    await checkCode(page, "QA41000004");
    await expect(alert(page, "This gift voucher has expired.")).toBeVisible();
  });

  test("G-11/G-16 an unknown code, and one with two digits swapped", async ({ page }) => {
    // BN48207138 has a valid check digit but no voucher; swapping its last two digits breaks the check digit.
    await checkCode(page, "BN48207138");
    await expect(alert(page, "No gift voucher has this code. Check it was typed correctly.")).toBeVisible();
    await checkCode(page, "BN48207183");
    await expect(alert(page, "This code looks mistyped: one of the digits is probably wrong.")).toBeVisible();
  });

  test("a customer's own vouchers are one tap on their page", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(41), firstName: "Bel" });
    await seedVoucher({ code: "QA41000005", amountCents: 3000, customerId: id });
    await page.goto(`/admin/customers/${id}`);
    await page.getByRole("button", { name: "Use QA41000005" }).click();
    // The balance check runs straight away and the amount field is ready to type into.
    await expect(page.getByText("$30.00 left QA41000005")).toBeVisible();
    await expect(page.getByLabel("Today's service")).toBeFocused();
  });
});

test.describe("Admin: managing a voucher", () => {
  test("G-12 Adjust balance needs a reason and changes the balance", async ({ page }) => {
    const id = await seedVoucher({ code: "QA42000001", amountCents: 5000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    const adjust = page.locator("form").filter({ has: page.getByRole("group", { name: "Add or remove credit" }) });

    await adjust.getByRole("button", { name: "remove" }).click();
    await adjust.getByLabel("Amount in dollars").fill("60");
    await expect(adjust.getByRole("button", { name: /^Save/ })).toBeDisabled();

    await adjust.getByRole("button", { name: "add" }).click();
    await adjust.getByLabel("Amount in dollars").fill("15");
    const save = adjust.getByRole("button", { name: "Save · new balance $65.00" });
    await save.click();
    expect(await findVoucher("QA42000001")).toMatchObject({ balance_cents: 5000 });

    await adjust.getByLabel("Reason").fill("Use entered twice at the till");
    await save.click();
    await expect(page.getByText("Balance is now $65.00.")).toBeVisible();
    await expect(page.getByRole("cell", { name: /Adjusted by an admin/ })).toBeVisible();
    expect(await findVoucher("QA42000001")).toMatchObject({ balance_cents: 6500 });
  });

  test("G-17 an unspent voucher can be deleted", async ({ page }) => {
    const id = await seedVoucher({ code: "QA42000002", amountCents: 5000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    await page.getByRole("button", { name: "Delete voucher" }).click();
    const confirm = await settled(page.getByRole("dialog", { name: "Delete QA42000002?" }));
    await confirm.getByRole("button", { name: "Delete voucher" }).click();
    await expect(page).toHaveURL(/\/admin\/gift-vouchers$/);
    expect(await findVoucher("QA42000002")).toBeNull();
  });

  test("G-17 a voucher that's been used has no Delete, and says why", async ({ page }) => {
    const id = await seedVoucher({ code: "QA42000003", amountCents: 5000 });
    const dialog = await checkCode(page, "QA42000003");
    await dialog.getByLabel("Today's service").fill("10");
    await dialog.getByRole("button", { name: "Use $10.00" }).click();
    await expect(page.getByText(/Spent \$10\.00/)).toBeVisible();

    await page.goto(`/admin/gift-vouchers/${id}`);
    await expect(page.getByText("This voucher has been used, so it can't be deleted.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete voucher" })).toHaveCount(0);
  });

  test("G-18 the Activity view lists who created and used a voucher", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(42), firstName: "Cleo", lastName: "Spender" });
    await seedVoucher({ code: "QA42000004", amountCents: 5000, customerId: id });
    await page.goto("/admin/gift-vouchers?view=activity&q=QA42000004");
    await expect(page.getByRole("cell", { name: /Created/ }).first()).toBeVisible();
    await expect(page.getByText("Cleo Spender").filter({ visible: true }).first()).toBeVisible();
  });
});
