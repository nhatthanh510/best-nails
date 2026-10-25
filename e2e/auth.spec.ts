import { ADMIN, PASSWORD, createAccount } from "./support/db";
import { alert, expect, freshPage, hydrated, signIn, test } from "./support/fixtures";

test.describe("Signing in", () => {
  test("A-01 the admin signs in and lands on the dashboard", async ({ browser }) => {
    const page = await freshPage(browser);
    await signIn(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Today at Best Nails" })).toBeVisible();
    await page.context().close();
  });

  test("A-02 a wrong password shows one message and keeps the email", async ({ browser }) => {
    const page = await freshPage(browser);
    await page.goto("/admin/login");
    await hydrated(page.getByRole("button", { name: "Sign in" }));
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alert(page, "That email and password don't match.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
    await page.context().close();
  });

  test("A-03 a signed-out visitor is sent to sign in, then back to the page they wanted", async ({ browser }) => {
    const page = await freshPage(browser);
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fcustomers$/);
    await hydrated(page.getByRole("button", { name: "Sign in" }));
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/customers$/);
    await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
    await page.context().close();
  });

  test("S-01 a signed-out kiosk asks for a staff member to sign in", async ({ browser }) => {
    const page = await freshPage(browser);
    await page.goto("/kiosk");
    await expect(page.getByRole("heading", { name: "Ask a staff member to sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff sign in" })).toHaveAttribute("href", "/admin/login?next=/kiosk");
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
    await page.context().close();
  });
});

test.describe("Staff accounts", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  test("A-04 a staff account is kept out of the admin", async ({ page }) => {
    for (const path of ["/admin", "/admin/customers", "/admin/settings", "/admin/gift-vouchers"]) {
      await page.goto(path);
      await expect(page, `${path} should send staff to the kiosk`).toHaveURL(/\/kiosk$/);
    }
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});

test.describe("Temporary passwords", () => {
  test("A-05/A-06 a new account must choose its own password before using the kiosk", async ({ browser }) => {
    const email = "e2e-tmp-new@bestnails.test";
    await createAccount({ email, password: "temp-pass-1", name: "New Starter", role: "staff", tempPassword: true });
    const page = await freshPage(browser);
    await signIn(page, email, "temp-pass-1");

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();
    // A temporary password doesn't need to be typed again.
    await expect(page.getByLabel("Current password")).toHaveCount(0);

    // The kiosk sends them back until they've chosen one.
    await page.goto("/kiosk");
    await expect(page).toHaveURL(/\/account$/);

    await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("New password again").fill(`${PASSWORD}x`);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(alert(page, "The two new passwords don't match.")).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("New password again").fill(PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/kiosk$/);
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.context().close();
  });

  test("A-07 changing a password needs the current one", async ({ browser }) => {
    const email = "e2e-tmp-change@bestnails.test";
    await createAccount({ email, password: PASSWORD, name: "Changer", role: "staff" });
    const page = await freshPage(browser);
    await signIn(page, email, PASSWORD);
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
    await page.getByLabel("Current password").fill("wrong-password");
    await page.getByLabel("New password", { exact: true }).fill("another-pass-2");
    await page.getByLabel("New password again").fill("another-pass-2");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(alert(page, "Your current password isn't right.")).toBeVisible();
    await page.context().close();
  });
});

test.describe("Signing out of the kiosk", () => {
  test("signing out stops the kiosk until someone signs in again", async ({ browser }) => {
    // Its own account: signing out ends every session of that account.
    const email = "e2e-tmp-signout@bestnails.test";
    await createAccount({ email, password: PASSWORD, name: "Leaver", role: "staff" });
    const page = await freshPage(browser);
    await signIn(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/kiosk$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/kiosk");
    await expect(page.getByRole("heading", { name: "Ask a staff member to sign in" })).toBeVisible();
    await page.context().close();
  });
});
