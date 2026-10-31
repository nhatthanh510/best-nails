import type { Page } from "@playwright/test";
import { findVoucher, seedCustomer, seedVoucher, seedInactiveVoucher, testPhone } from "./support/db";
import { alert, expect, freshPage, settled, test } from "./support/fixtures";

/** Find voucher from the Gift vouchers page: type a code and see the voucher (or why not). */
async function findCode(page: Page, code: string) {
  await page.goto("/admin/gift-vouchers");
  await page.getByRole("button", { name: "Find voucher" }).click();
  const dialog = await settled(page.getByRole("dialog", { name: "Find a gift voucher" }));
  await dialog.getByLabel("Gift voucher code").fill(code);
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  return dialog;
}

/** Finds an active voucher and opens Use, which checks the balance straight away. */
async function checkCode(page: Page, code: string) {
  const dialog = await findCode(page, code);
  await dialog.getByRole("button", { name: "Use", exact: true }).click();
  return dialog;
}

/** The voucher page folds Details and Admin tools away; open one. */
async function openFold(page: Page, title: "Details" | "Admin tools") {
  await page.locator("summary").filter({ hasText: title }).click();
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

  test("G-19 the voucher card's QR opens its balance for anyone, signed out", async ({ page, browser }) => {
    const id = await seedVoucher({ code: "QA40000019", amountCents: 8000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    await expect(page.getByRole("img", { name: "QR code to check the balance" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

    const theirs = await freshPage(browser);
    await theirs.goto(`/v/${(await findVoucher("QA40000019"))!.public_token}`);
    await expect(theirs.getByRole("heading", { name: "$80.00", level: 1 })).toBeVisible();
    await expect(theirs.getByText("QA40000019")).toBeVisible();
    await theirs.goto("/v/AAAAAAAAAAAAAAAAAAAAAA");
    await expect(theirs.getByRole("heading", { name: "Voucher not found", level: 1 })).toBeVisible();
    await theirs.context().close();
  });

  test("G-20 a voucher printed ahead of time is inactive until it's activated from its page", async ({ page, browser }) => {
    const card = await seedInactiveVoucher("QA40000020");
    const theirs = await freshPage(browser);
    await theirs.goto(`/v/${card.public_token}`);
    await expect(theirs.getByRole("heading", { name: "Not activated yet", level: 1 })).toBeVisible();

    // Find voucher shows it's not sold yet, with Activate as the only action.
    const found = await findCode(page, "QA40000020");
    await expect(found.getByText("Not sold", { exact: true })).toBeVisible();
    await expect(found.getByRole("button", { name: "Activate voucher" })).toBeVisible();
    await expect(found.getByRole("button", { name: "Use", exact: true })).toHaveCount(0);

    // Tracked in the list under Not sold.
    await page.goto("/admin/gift-vouchers?filter=inactive");
    await page.getByRole("link", { name: "QA40000020", exact: true }).click();
    await expect(page.getByRole("heading", { name: "QA40000020", level: 1 })).toBeVisible();
    await expect(page.getByText("Not sold", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Activate voucher" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Activate QA40000020" }));
    // The code is the one printed on the card: it can't be changed or regenerated.
    await expect(dialog.getByLabel("Code")).toHaveValue("QA40000020");
    await expect(dialog.getByLabel("Code")).not.toBeEditable();
    await expect(dialog.getByRole("button", { name: "Generate" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "$50", exact: true }).click();
    await dialog.getByRole("button", { name: "Activate $50.00 voucher" }).click();
    // The page turns into the active voucher, with the reminder to take payment as a toast.
    await expect(page.getByText("Activated QA40000020 for $50.00. Take payment at the till.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();

    // The QR already on the card now shows the balance.
    expect((await findVoucher("QA40000020"))!.public_token).toBe(card.public_token);
    await theirs.reload();
    await expect(theirs.getByRole("heading", { name: "$50.00", level: 1 })).toBeVisible();
    await theirs.context().close();
  });

  test("G-21 several unused vouchers are deleted at once; used ones can't be chosen", async ({ page }) => {
    await seedInactiveVoucher("QA40000021");
    await seedInactiveVoucher("QA40000022");
    await page.goto("/admin/gift-vouchers?filter=inactive&q=QA4000002");
    await page.getByRole("checkbox", { name: "Choose QA40000021" }).check();
    await page.getByRole("checkbox", { name: "Choose QA40000022" }).check();
    await page.getByRole("button", { name: "Delete 2" }).click();
    const confirm = await settled(page.getByRole("dialog", { name: "Delete 2 vouchers?" }));
    await confirm.getByRole("button", { name: "Delete 2" }).click();
    await expect(page.getByText("Deleted 2 vouchers.")).toBeVisible();
    expect(await findVoucher("QA40000021")).toBeNull();
    expect(await findVoucher("QA40000022")).toBeNull();
  });

  test("G-22 add value to a voucher, then block it when it's lost and unblock it", async ({ page }) => {
    const id = await seedVoucher({ code: "QA40000023", amountCents: 5000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    await page.getByRole("button", { name: "Top up" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Top up QA40000023" }));
    await dialog.getByRole("button", { name: "$100", exact: true }).click();
    await dialog.getByRole("button", { name: "Top up $100.00" }).click();
    await expect(dialog.getByRole("status")).toContainText("Topped up QA40000023 with $100.00 · take payment at the till");
    await expect(dialog.getByRole("status")).toContainText("$150.00");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Topped up", { exact: true })).toBeVisible();
    expect((await findVoucher("QA40000023"))!.balance_cents).toBe(15000);

    await openFold(page, "Admin tools");
    await page.getByLabel("Reason").last().fill("Lost by the customer");
    await page.getByRole("button", { name: "Block voucher" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Blocked" })).toContainText("Lost by the customer");
    const found = await findCode(page, "QA40000023");
    await expect(found.getByText(/Blocked: Lost by the customer/)).toBeVisible();
    await expect(found.getByRole("button", { name: "Use", exact: true })).toHaveCount(0);

    await page.goto(`/admin/gift-vouchers/${id}`);
    await page.getByRole("button", { name: "Unblock" }).click();
    await expect(page.getByText("Voucher unblocked. It can be used again.")).toBeVisible();
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
    await expect(page.getByText("Used $40.50 from QA41000001. $59.50 left.")).toBeVisible();
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
    await expect(page.getByText("Used $50.00 from QA41000002. $0.00 left. Take $10.00 at the till.")).toBeVisible();
    expect(await findVoucher("QA41000002")).toMatchObject({ balance_cents: 0 });
  });

  test("G-09 a used-up voucher can't be used again", async ({ page }) => {
    await seedVoucher({ code: "QA41000003", amountCents: 2000 });
    let dialog = await checkCode(page, "QA41000003");
    await dialog.getByLabel("Today's service").fill("20");
    await dialog.getByRole("button", { name: "Use $20.00" }).click();
    await expect(page.getByText(/Used \$20\.00 from QA41000003/)).toBeVisible();

    // Used up: Top up is the only action left.
    dialog = await findCode(page, "QA41000003");
    await expect(dialog.getByText("Used up", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Use", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Top up" })).toBeVisible();
  });

  test("G-14 an expired voucher is refused", async ({ page }) => {
    await seedVoucher({ code: "QA41000004", amountCents: 5000, expired: true });
    const dialog = await findCode(page, "QA41000004");
    await expect(dialog.getByText("It has expired, so it can't be used or topped up.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Use", exact: true })).toHaveCount(0);
  });

  test("G-11/G-16 an unknown code, and one with two digits swapped", async ({ page }) => {
    // BN48207138 has a valid check digit but no voucher; swapping its last two digits breaks the check digit.
    await findCode(page, "BN48207138");
    await expect(alert(page, "No gift voucher has this code. Check it was typed correctly.")).toBeVisible();
    await findCode(page, "BN48207183");
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
  test("G-12 Correct balance needs a reason and changes the balance", async ({ page }) => {
    const id = await seedVoucher({ code: "QA42000001", amountCents: 5000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    await openFold(page, "Admin tools");
    const adjust = page.locator("form").filter({ has: page.getByRole("group", { name: "Put back or take off credit" }) });

    await adjust.getByRole("button", { name: "Take off" }).click();
    await adjust.getByLabel("Amount in dollars").fill("60");
    await expect(adjust.getByRole("button", { name: /^Save/ })).toBeDisabled();

    await adjust.getByRole("button", { name: "Put back" }).click();
    await adjust.getByLabel("Amount in dollars").fill("15");
    const save = adjust.getByRole("button", { name: "Save · new balance $65.00" });
    await save.click();
    expect(await findVoucher("QA42000001")).toMatchObject({ balance_cents: 5000 });

    await adjust.getByLabel("Reason").fill("Use entered twice at the till");
    await save.click();
    await expect(page.getByText("Balance is now $65.00.")).toBeVisible();
    await expect(page.getByRole("cell", { name: /Balance corrected/ })).toBeVisible();
    expect(await findVoucher("QA42000001")).toMatchObject({ balance_cents: 6500 });
  });

  test("G-17 an unspent voucher can be deleted", async ({ page }) => {
    const id = await seedVoucher({ code: "QA42000002", amountCents: 5000 });
    await page.goto(`/admin/gift-vouchers/${id}`);
    await openFold(page, "Admin tools");
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
    await expect(page.getByText(/Used \$10\.00/)).toBeVisible();

    await page.goto(`/admin/gift-vouchers/${id}`);
    await openFold(page, "Admin tools");
    await expect(page.getByText("It has been used, so it can't be deleted.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete voucher" })).toHaveCount(0);
  });

  test("G-23 status tabs with counts, the Used today switch and Sort by narrow the list", async ({ page }) => {
    await seedVoucher({ code: "QA42000005", amountCents: 9000 });
    await seedVoucher({ code: "QA42000006", amountCents: 1000 });
    await page.goto("/admin/gift-vouchers?q=QA4200000");
    const tabs = page.getByRole("navigation", { name: "Gift vouchers by status" });
    await expect(tabs.getByRole("link", { name: /^Active \(\d+\)$/ })).toBeVisible();
    await tabs.getByRole("link", { name: /^Active/ }).click();
    await expect(page).toHaveURL(/filter=active/);
    await expect(tabs.getByRole("link", { name: /^Active/ })).toHaveAttribute("aria-current", "page");

    await page.getByLabel("Sort by").selectOption("balance");
    await expect(page).toHaveURL(/sort=balance/);
    await expect(page.locator("tbody tr").first()).toContainText("QA42000005");

    const usedToday = page.getByRole("switch", { name: "Used today" });
    await expect(usedToday).not.toBeChecked();
    await usedToday.click();
    await expect(page).toHaveURL(/today=1/);
    await expect(usedToday).toBeChecked();
    // Neither has been used today.
    await expect(page.getByRole("link", { name: "QA42000005", exact: true })).toHaveCount(0);
  });

  test("G-24 a row's ⋯ menu offers what fits the voucher, and Top up works from the list", async ({ page }) => {
    await seedVoucher({ code: "QA42000007", amountCents: 2000 });
    await page.goto("/admin/gift-vouchers?q=QA42000007");
    await page.getByRole("button", { name: "Actions for QA42000007" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Use" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Activate voucher" })).toHaveCount(0);
    await menu.getByRole("menuitem", { name: "Top up" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Top up QA42000007" }));
    await dialog.getByRole("button", { name: "Top up $50.00" }).click();
    await expect(dialog.getByRole("status")).toContainText("$70.00");
    expect(await findVoucher("QA42000007")).toMatchObject({ balance_cents: 7000 });
  });

  test("G-18 the voucher search finds a customer's vouchers by name", async ({ page }) => {
    const id = await seedCustomer({ phone: testPhone(42), firstName: "Cleo", lastName: "Spender" });
    await seedVoucher({ code: "QA42000004", amountCents: 5000, customerId: id });
    await page.goto("/admin/gift-vouchers?q=Spender");
    await expect(page.getByRole("link", { name: "QA42000004", exact: true })).toBeVisible();
    await expect(page.getByText("Cleo Spender").filter({ visible: true }).first()).toBeVisible();
  });
});
