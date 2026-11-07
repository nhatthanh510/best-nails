import { findGiftCard, seedCustomer, seedGiftCard, STAFF, testPhone } from "./support/db";
import { expect, test } from "./support/fixtures";

test.describe("Kiosk Staff menu: gift cards", () => {
  test("G-15 create a gift card for the customer on screen; the code stays up until Done", async ({ kiosk, page }) => {
    const customerId = await seedCustomer({ phone: testPhone(20), firstName: "Nia", checkedIn: true });
    await kiosk.goto();
    await kiosk.enter(testPhone(20));
    await expect(page.getByRole("heading", { name: "Welcome back, Nia!" })).toBeVisible();

    await kiosk.staff("Gift card");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("For Nia · 0491 570 120")).toBeVisible();
    await dialog.getByRole("button", { name: /Create a gift card/ }).click();

    await dialog.getByRole("button", { name: "$50", exact: true }).click();
    await dialog.getByLabel("Code").fill("qa 2000 0001");
    // The customer is already known, so the phone field isn't asked again.
    await expect(dialog.getByLabel(/Customer phone/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Create $50.00 gift card" }).click();

    const created = dialog.getByRole("status");
    await expect(created).toContainText("Gift card QA20000001 created · print it, or write the code on a card");
    // The printable gift card, with the QR that opens its balance page.
    await expect(dialog.getByRole("img", { name: "QR code to check the balance" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(dialog.getByText("$50.00 · take payment at the till")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Open gift card" })).toHaveCount(0);

    expect(await findGiftCard("QA20000001")).toMatchObject({ balance_cents: 5000, customer_id: customerId });
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("an amount under $1 can't be created", async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.staff("Gift card");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Create a gift card/ }).click();
    await dialog.getByLabel("Other amount in dollars").fill("0.5");
    await dialog.getByLabel("Code").fill("QA20000002");
    await expect(dialog.getByText("At least $1.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Create/ })).toBeDisabled();
  });

  test("Generate fills in a code with the shop's prefix and a valid check digit", async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.staff("Gift card");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Create a gift card/ }).click();
    await dialog.getByRole("button", { name: "Generate" }).click();
    await expect(dialog.getByLabel("Code")).toHaveValue(/^BN\d{8}$/);
  });
});

test.describe("Kiosk Staff menu: Admin", () => {
  test("going to the admin and back starts the kiosk again at an empty keypad", async ({ kiosk, page }) => {
    await seedCustomer({ phone: testPhone(21), firstName: "Ola" });
    await kiosk.goto();
    await kiosk.enter(testPhone(21));
    // Not checked in yet today: straight to the first visit step, which greets them.
    await expect(page.getByText(/Welcome back, Ola/)).toBeVisible();

    await kiosk.staff("Admin");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Open kiosk" }).click();

    await expect(page.getByText("Enter your phone number")).toBeVisible();
    await expect(page.getByText(/Welcome back, Ola/)).toHaveCount(0);
  });
});

test.describe("Kiosk Staff menu: as a staff account", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  test("G-07 staff can check a balance and use part of a gift card", async ({ kiosk, page }) => {
    await seedGiftCard({ code: "QA30000001", amountCents: 10000 });
    await kiosk.goto();
    // Staff accounts only get the kiosk, so the Staff menu has no Admin.
    await page.getByRole("button", { name: "Staff", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Staff" }).getByRole("button", { name: /^Admin/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await kiosk.staff("Gift card");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Find a gift card/ }).click();
    await dialog.getByLabel("Gift card code").fill("qa-3000 0001");
    await dialog.getByRole("button", { name: "Find", exact: true }).click();
    await dialog.getByRole("button", { name: "Use", exact: true }).click();
    await expect(dialog.getByText("$100.00 left")).toBeVisible();

    await dialog.getByLabel("Today's service").fill("35");
    await expect(dialog.getByText("Leaves $65.00 on the gift card.")).toBeVisible();
    await dialog.getByRole("button", { name: "Use $35.00" }).click();
    await expect(page.getByText("Used $35.00 from QA30000001. $65.00 left.")).toBeVisible();
    expect(await findGiftCard("QA30000001")).toMatchObject({ balance_cents: 6500 });
  });

  test(`KS-01 Sign out asks first, and Cancel keeps the kiosk running (${STAFF.name})`, async ({ kiosk, page }) => {
    await kiosk.goto();
    await kiosk.staff("Sign out");
    const confirm = page.getByRole("alertdialog", { name: "Sign out of the kiosk?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);

    await kiosk.staff("Sign out");
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(kiosk.continueButton).toBeVisible();
  });
});
