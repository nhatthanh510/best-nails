import { writeFile, mkdir } from "node:fs/promises";
import { test as setup, expect } from "@playwright/test";
import { ADMIN, STAFF, activeShopRewards, createAccount, getSettings } from "./support/db";
import { signIn } from "./support/fixtures";

// Signs in the shared admin and staff logins once, and remembers the shop's settings and active
// rewards so the teardown can put them back after the tests have changed them.

setup("remember settings and rewards", async () => {
  await mkdir("e2e/.auth", { recursive: true });
  await writeFile("e2e/.auth/settings.json", JSON.stringify(await getSettings(), null, 2));
  await writeFile("e2e/.auth/rewards.json", JSON.stringify(await activeShopRewards()));
});

setup("sign in as the admin", async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});

setup("sign in as a staff account", async ({ browser }) => {
  await createAccount({ ...STAFF, role: "staff" });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await signIn(page, STAFF.email, STAFF.password);
  await expect(page).toHaveURL(/\/kiosk$/);
  await context.storageState({ path: "e2e/.auth/staff.json" });
  await context.close();
});
