import type { Page } from "@playwright/test";
import { PASSWORD, createAccount } from "./support/db";
import { alert, expect, freshPage, hydrated, settled, signIn, test } from "./support/fixtures";

async function openMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  return page.getByRole("menu");
}

test.describe("Admin: accounts", () => {
  test("AC-01 add a staff account with a temporary password they replace on first sign-in", async ({ page, browser }) => {
    const email = "e2e-tmp-added@bestnails.test";
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Add an account" }));
    await dialog.getByLabel("Name").fill("E2E Added");
    await dialog.getByLabel("Email").fill(email);
    await expect(dialog.getByLabel("Role")).toHaveValue("staff");
    const temporary = await dialog.getByLabel("Temporary password").inputValue();
    expect(temporary).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{10}$/);
    await dialog.getByRole("button", { name: "Add account" }).click();

    await expect(page.getByText("E2E Added can sign in now.")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole("listitem").filter({ hasText: email });
    await expect(row.getByText("Temporary password")).toBeVisible();
    await expect(row.getByText("Staff", { exact: true })).toBeVisible();

    const theirs = await freshPage(browser);
    await signIn(theirs, email, temporary);
    await expect(theirs).toHaveURL(/\/account$/);
    await expect(theirs.getByRole("heading", { name: "Choose your password" })).toBeVisible();
    await theirs.context().close();
  });

  test("AC-02 an email that already has an account is refused", async ({ page }) => {
    await createAccount({ email: "e2e-tmp-dupe@bestnails.test", password: PASSWORD, name: "Dupe", role: "staff" });
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Add an account" }));
    await dialog.getByLabel("Name").fill("Dupe Again");
    await dialog.getByLabel("Email").fill("e2e-tmp-dupe@bestnails.test");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByText("An account with this email already exists.")).toBeVisible();
  });

  test("AC-05/AC-06 a removed account can't sign in until it's restored", async ({ page, browser }) => {
    const email = "e2e-tmp-remove@bestnails.test";
    await createAccount({ email, password: PASSWORD, name: "Remy", role: "staff" });
    await page.goto("/admin/settings");

    await (await openMenu(page, "Remy")).getByRole("menuitem", { name: "Remove" }).click();
    const confirm = await settled(page.getByRole("dialog", { name: "Remove Remy?" }));
    await confirm.getByRole("button", { name: "Remove account" }).click();
    await expect(page.getByText("Account removed. It can't sign in any more.")).toBeVisible();
    await expect(page.getByText("Removed accounts (1)")).toBeVisible();

    const theirs = await freshPage(browser);
    await theirs.goto("/admin/login");
    await hydrated(theirs.getByRole("button", { name: "Sign in" }));
    await theirs.getByLabel("Email").fill(email);
    await theirs.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await theirs.getByRole("button", { name: "Sign in" }).click();
    await expect(alert(theirs, "That email and password don't match.")).toBeVisible();

    await page.getByText("Removed accounts (1)").click();
    await (await openMenu(page, "Remy")).getByRole("menuitem", { name: "Restore" }).click();
    await expect(page.getByText("Account restored.")).toBeVisible();
    await signIn(theirs, email, PASSWORD);
    await expect(theirs).toHaveURL(/\/kiosk$/);
    await theirs.context().close();
  });

  test("AC-07 a removed account can be deleted for good", async ({ page }) => {
    await createAccount({ email: "e2e-tmp-delete@bestnails.test", password: PASSWORD, name: "Dana", role: "staff" });
    await page.goto("/admin/settings");
    await (await openMenu(page, "Dana")).getByRole("menuitem", { name: "Remove" }).click();
    await (await settled(page.getByRole("dialog", { name: "Remove Dana?" }))).getByRole("button", { name: "Remove account" }).click();
    await expect(page.getByText("Removed accounts (1)")).toBeVisible();

    await page.getByText("Removed accounts (1)").click();
    await (await openMenu(page, "Dana")).getByRole("menuitem", { name: "Delete for good" }).click();
    await (await settled(page.getByRole("dialog", { name: "Delete Dana for good?" }))).getByRole("button", { name: "Delete for good" }).click();
    await expect(page.getByText("Dana's account is deleted.")).toBeVisible();
    await expect(page.getByText("Removed accounts")).toHaveCount(0);
  });

  test("AC-03/AC-08 the signed-in admin can't change their own role or remove themselves", async ({ page }) => {
    await page.goto("/admin/settings");
    const menu = await openMenu(page, "Admin");
    await expect(menu.getByRole("menuitem", { name: "Edit name" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Change password" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Remove" })).toHaveCount(0);

    await menu.getByRole("menuitem", { name: "Edit name" }).click();
    const dialog = await settled(page.getByRole("dialog", { name: "Your account" }));
    await expect(dialog.getByLabel("Role")).toHaveCount(0);
  });
});
